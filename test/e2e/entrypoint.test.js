'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { runEntrypoint, flagValue } = require('../helpers/run-entrypoint')
const { startFakeGitHub } = require('../helpers/fake-github')
const { kicsResults } = require('../helpers/fixtures')
const { knownBug } = require('../helpers/known-bug')

const DEFAULT_QUERIES = '/app/bin/assets/queries'

test('required input', async (t) => {
    await t.test('refuses to scan without a path', async (t) => {
        const run = await runEntrypoint(t, { inputs: { path: '' } })
        assert.equal(run.code, 1)
        assert.match(run.stdout, /ERR input path can't be empty/)
        assert.equal(run.kicsRan, false)
        assert.equal(run.nodeCall, undefined, 'the JS stage must not run either')
    })

    await t.test('scans the given path', async (t) => {
        const run = await runEntrypoint(t, { inputs: { path: 'terraform,k8s/deploy.yaml' } })
        assert.equal(flagValue(run.args, '-p'), 'terraform,k8s/deploy.yaml')
    })

    await t.test('tolerates a path wrapped in double quotes', async (t) => {
        const run = await runEntrypoint(t, { inputs: { path: '"terraform,modules"' } })
        assert.equal(flagValue(run.args, '-p'), 'terraform,modules')
    })

    await t.test('keeps a path containing spaces as one argument', knownBug('the unquoted $INPUT_PATH is word-split, so "my infra" becomes two arguments'), async (t) => {
        const run = await runEntrypoint(t, { inputs: { path: 'my infra' } })
        assert.deepEqual(run.args.slice(run.args.indexOf('-p'), run.args.indexOf('-p') + 2), ['-p', 'my infra'])
    })
})

test('baseline command line', async (t) => {
    await t.test('runs `kics scan` without the progress bar, which would pollute CI logs', async (t) => {
        const run = await runEntrypoint(t)
        assert.deepEqual(run.args.slice(0, 2), ['scan', '--no-progress'])
    })

    await t.test('with no optional inputs, passes only path, output, report format and bundled queries', async (t) => {
        const run = await runEntrypoint(t)
        assert.deepEqual(run.args, ['scan', '--no-progress', '-p', 'infra', '-o', './', '--report-formats', 'json', '-q', DEFAULT_QUERIES])
    })

    await t.test('uses the queries bundled in the image unless told otherwise', async (t) => {
        assert.equal(flagValue((await runEntrypoint(t)).args, '-q'), DEFAULT_QUERIES)
        assert.equal(flagValue((await runEntrypoint(t, { inputs: { queries: 'my/queries' } })).args, '-q'), 'my/queries')
    })
})

test('inputs mapped to KICS flags', async (t) => {
    const valued = [
        ['payload_path', 'payload.json', '-d'],
        ['config_path', 'kics.config', '--config'],
        ['exclude_paths', './vendor/*,legacy.tf', '-e'],
        ['exclude_results', 'abc123,def456', '-x'],
        ['exclude_severities', 'info,low', '--exclude-severities'],
        ['exclude_queries', '11111111-2222-3333-4444-555555555555', '--exclude-queries'],
        ['exclude_categories', 'Observability,Backup', '--exclude-categories'],
        ['platform_type', 'Terraform,Dockerfile', '--type'],
        ['fail_on', 'high,medium', '--fail-on'],
        ['timeout', '60', '--timeout'],
        ['profiling', 'CPU', '--profiling'],
        ['libraries_path', 'libs', '-b'],
        ['secrets_regexes_path', 'secrets.json', '-r'],
        ['ignore_on_exit', 'results', '--ignore-on-exit'],
        ['cloud_provider', 'aws,gcp', '--cloud-provider'],
        ['queries', 'queries/custom,queries/team', '-q'],
    ]
    for (const [input, value, flag] of valued) {
        await t.test(`${input} -> ${flag} ${value}`, async (t) => {
            const run = await runEntrypoint(t, { inputs: { [input]: value } })
            assert.equal(flagValue(run.args, flag), value, run.args.join(' '))
        })
    }

    const switches = [
        ['exclude_gitignore', '--exclude-gitignore'],
        ['disable_secrets', '--disable-secrets'],
        ['disable_full_descriptions', '--disable-full-descriptions'],
        ['verbose', '-v'],
    ]
    for (const [input, flag] of switches) {
        await t.test(`${input}: true -> ${flag}`, async (t) => {
            const run = await runEntrypoint(t, { inputs: { [input]: 'true' } })
            assert.ok(run.args.includes(flag), run.args.join(' '))
        })

        await t.test(`${input} left unset -> no ${flag}`, async (t) => {
            const run = await runEntrypoint(t)
            assert.ok(!run.args.includes(flag))
        })

        await t.test(`${input}: false -> no ${flag}`, knownBug('any non-empty value, including "false", enables the flag (#121)'), async (t) => {
            const run = await runEntrypoint(t, { inputs: { [input]: 'false' } })
            assert.ok(!run.args.includes(flag), `${input}: false must not enable ${flag}: ${run.args.join(' ')}`)
        })
    }

    await t.test('include_queries -> -i <ids>', knownBug('the flag is built from $INPUT_PROFILING instead of $INPUT_INCLUDE_QUERIES (#98)'), async (t) => {
        const run = await runEntrypoint(t, { inputs: { include_queries: '229588ef-8fde-40c8-8756-f4f2b5825ded' } })
        assert.equal(flagValue(run.args, '-i'), '229588ef-8fde-40c8-8756-f4f2b5825ded')
    })

    await t.test('bom: true -> -m', async (t) => {
        const run = await runEntrypoint(t, { inputs: { bom: 'true' } })
        assert.ok(run.args.includes('-m'), run.args.join(' '))
    })

    await t.test('bom and include_queries do not borrow the value of profiling', knownBug('both flags are built from $INPUT_PROFILING (see #98)'), async (t) => {
        const run = await runEntrypoint(t, { inputs: { bom: 'true', include_queries: 'q-1', profiling: 'CPU' } })
        assert.equal(flagValue(run.args, '--profiling'), 'CPU')
        assert.notEqual(flagValue(run.args, '-m'), 'CPU', 'bom is a switch, it takes no value')
        assert.equal(flagValue(run.args, '-i'), 'q-1')
    })
})

test('report formats', async (t) => {
    const cases = [
        [undefined, 'json'],
        ['json', 'json'],
        ['sarif', 'sarif,json'],
        ['sarif,json', 'sarif,json'],
        ['json,sarif', 'json,sarif'],
    ]
    for (const [requested, passed] of cases) {
        await t.test(`output_formats ${requested === undefined ? 'unset' : `"${requested}"`} -> --report-formats ${passed}`, async (t) => {
            const run = await runEntrypoint(t, { inputs: requested === undefined ? {} : { output_formats: requested } })
            assert.equal(flagValue(run.args, '--report-formats'), passed)
        })
    }
})

test('handover to the JavaScript stage', async (t) => {
    await t.test('passes KICS exit code through KICS_EXIT_CODE', async (t) => {
        for (const exit of [0, 20, 50]) {
            const run = await runEntrypoint(t, { results: kicsResults(), kicsExitCode: exit })
            assert.equal(run.nodeCall.KICS_EXIT_CODE, String(exit))
        }
    })

    await t.test('still runs the JavaScript stage when KICS exits non-zero, so results get reported', async (t) => {
        const run = await runEntrypoint(t, { results: kicsResults(), kicsExitCode: 50 })
        assert.ok(run.nodeCall, 'node must run')
        assert.equal(run.nodeCall.args, 'dist/index.js')
    })

    await t.test('runs the JavaScript stage from /app, where the bundle and the results copy live', async (t) => {
        const run = await runEntrypoint(t, { results: kicsResults() })
        assert.equal(run.nodeCall.cwd, run.appDir)
    })

    await t.test('copies results.json next to the bundle', async (t) => {
        const run = await runEntrypoint(t, { results: kicsResults() })
        const copy = JSON.parse(fs.readFileSync(path.join(run.appDir, 'results.json'), 'utf8'))
        assert.equal(copy.total_counter, 4)
    })

    await t.test('asks KICS to write into output_path and copies that directory', async (t) => {
        const run = await runEntrypoint(t, { results: kicsResults(), inputs: { output_path: 'myoutput/' } })
        assert.equal(flagValue(run.args, '-o'), 'myoutput/')
        assert.ok(fs.existsSync(path.join(run.appDir, 'myoutput', 'results.json')), 'main.js reads <output_path>/results.json relative to /app')
    })

    await t.test('scans relative to the workflow workspace', async (t) => {
        const run = await runEntrypoint(t, { results: kicsResults() })
        assert.ok(fs.existsSync(path.join(run.workspace, 'results.json')), 'KICS wrote into GITHUB_WORKSPACE')
    })
})

test('whole action: entrypoint, KICS, JavaScript stage and GitHub', async (t) => {
    await t.test('a scan with findings comments on the PR, annotates, and fails the step', async (t) => {
        const fake = await startFakeGitHub(t)
        const run = await runEntrypoint(t, {
            runMain: true,
            apiUrl: fake.url,
            results: kicsResults(),
            kicsExitCode: 50,
            inputs: { enable_comments: 'true', enable_jobs_summary: 'true', output_formats: 'sarif' },
        })

        assert.equal(run.code, 1, run.stdout + run.stderr)
        assert.match(run.stdout, /::error::KICS scan failed with exit code 50/)
        assert.equal((run.stdout.match(/^::warning /gm) || []).length, 4, 'one annotation per finding')
        assert.equal(fake.comments.length, 1)
        assert.match(fake.comments[0].body, /\| TOTAL \| 4 \|/)
        assert.match(run.summary, /\| TOTAL \| 4 \|/)
        assert.equal(flagValue(run.args, '--report-formats'), 'sarif,json')
    })

    await t.test('a clean scan passes quietly', async (t) => {
        const run = await runEntrypoint(t, { runMain: true, results: kicsResults({ queries: [] }), kicsExitCode: 0, inputs: { enable_annotations: 'true' } })
        assert.equal(run.code, 0, run.stdout + run.stderr)
        assert.doesNotMatch(run.stdout, /^::(warning|error)/m)
    })

    await t.test('the workspace is left without a results.json nobody asked for', knownBug('output_formats: sarif still leaves results.json in the workspace; main.js only removes the copy inside /app'), async (t) => {
        const run = await runEntrypoint(t, { runMain: true, results: kicsResults(), inputs: { output_formats: 'sarif' } })
        assert.equal(fs.existsSync(path.join(run.workspace, 'results.json')), false)
    })

    await t.test('reports from a config file with a custom output-name are still picked up', knownBug('main.js only reads results.json, so a config with output-name makes the scan fail with ENOENT (#96, #106)'), async (t) => {
        const run = await runEntrypoint(t, {
            runMain: true,
            results: kicsResults(),
            resultsName: 'my-results',
            workspaceFiles: { 'kics.json': JSON.stringify({ 'output-name': 'my-results' }) },
            inputs: { config_path: 'kics.json', enable_jobs_summary: 'true' },
        })
        assert.match(run.summary, /\| TOTAL \| 4 \|/, run.stdout + run.stderr)
    })

    await t.test('results.json is left readable for the next workflow steps', knownBug('KICS runs as root and writes mode 600, so later steps and upload-sarif cannot read it (#130)'), async (t) => {
        const run = await runEntrypoint(t, { results: kicsResults(), resultsMode: '600' })
        const mode = fs.statSync(path.join(run.workspace, 'results.json')).mode
        assert.notEqual(mode & 0o044, 0, `mode is ${(mode & 0o777).toString(8)}`)
    })
})


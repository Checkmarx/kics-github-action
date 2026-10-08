'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { runAction } = require('../helpers/run-action')
const { startFakeGitHub, humanComment } = require('../helpers/fake-github')
const { kicsResults, query, finding } = require('../helpers/fixtures')
const { knownBug } = require('../helpers/known-bug')

const KICS_FOUND_RESULTS = '50'

const SILENT_FAILURE =
    'main() swallows every exception, so a KICS failure is never reported when GitHub or results.json cannot be used'

test('pull request comment', async (t) => {
    await t.test('is not posted unless enable_comments is on (the default)', async (t) => {
        const fake = await startFakeGitHub(t)
        const run = await runAction(t, { results: kicsResults(), apiUrl: fake.url })
        assert.equal(run.code, 0)
        assert.deepEqual(fake.calls(), [], 'no API traffic at all')
    })

    await t.test('reports the scan on the pull request when enable_comments is on', async (t) => {
        const fake = await startFakeGitHub(t)
        const run = await runAction(t, { results: kicsResults(), inputs: { enable_comments: 'true' }, apiUrl: fake.url, prNumber: 7 })

        assert.equal(run.code, 0, run.stdout + run.stderr)
        assert.deepEqual(fake.calls(), ['GET /repos/o/r/issues/7/comments', 'POST /repos/o/r/issues/7/comments'])
        const body = fake.comments[0].body
        assert.match(body, /KICS version: v2\.1\.20/)
        assert.match(body, /\| HIGH \| 1 \|/)
        assert.match(body, /\| TOTAL \| 4 \|/)
        assert.ok(!body.includes('### Queries Results'), 'queries are opt-in')
    })

    await t.test('updates its own comment when the PR is scanned again', async (t) => {
        const fake = await startFakeGitHub(t, { comments: [humanComment(1), humanComment(2)] })
        const inputs = { enable_comments: 'true' }

        await runAction(t, { results: kicsResults(), inputs, apiUrl: fake.url })
        await runAction(t, { results: kicsResults({ kics_version: 'v9.9.9' }), inputs, apiUrl: fake.url })

        const kicsComments = fake.comments.filter((c) => c.body.startsWith('![kics-logo]('))
        assert.equal(kicsComments.length, 1)
        assert.match(kicsComments[0].body, /v9\.9\.9/)
    })

    await t.test('includes the queries table with comments_with_queries, minus the excluded columns', async (t) => {
        const fake = await startFakeGitHub(t)
        await runAction(t, {
            results: kicsResults(),
            inputs: { enable_comments: 'true', comments_with_queries: 'true', excluded_column_for_comments_with_queries: 'similarity_id,search_line' },
            apiUrl: fake.url,
        })

        const body = fake.comments[0].body
        assert.match(body, /### Queries Results/)
        assert.match(body, /\[S3 Bucket Without Versioning\]\(https:\/\/docs\.kics\.io/)
        assert.ok(!body.includes('Similarity Id'))
        assert.ok(!body.includes('Search Line'))
        assert.match(body, /\| Severity/, 'non-excluded columns remain')
    })

    await t.test('uses the default excluded columns from action.yml when none are given', async (t) => {
        const fake = await startFakeGitHub(t)
        await runAction(t, { results: kicsResults(), inputs: { enable_comments: 'true', comments_with_queries: 'true' }, apiUrl: fake.url })
        const body = fake.comments[0].body
        for (const hidden of ['Description Id', 'Similarity Id', 'Search Line', 'Search Value']) assert.ok(!body.includes(hidden), hidden)
    })

    await t.test('input values are case-insensitive booleans', async (t) => {
        const fake = await startFakeGitHub(t)
        await runAction(t, { results: kicsResults(), inputs: { enable_comments: 'TRUE', comments_with_queries: 'True' }, apiUrl: fake.url })
        assert.match(fake.comments[0].body, /### Queries Results/)
    })

    await t.test('is skipped without failing the step when not running for a pull request', knownBug('on push events prNumber is "", so the action calls /issues//comments, gets a 404 and swallows it'), async (t) => {
        const fake = await startFakeGitHub(t)
        const run = await runAction(t, { results: kicsResults(), inputs: { enable_comments: 'true' }, apiUrl: fake.url, event: 'push' })
        assert.equal(run.code, 0)
        assert.deepEqual(fake.calls(), [], 'there is no PR to talk to')
    })
})

test('annotations', async (t) => {
    await t.test('one warning per finding, pointing at file and line', async (t) => {
        const run = await runAction(t, { results: kicsResults(), inputs: { enable_annotations: 'true' } })

        assert.equal(run.warnings.length, 4)
        assert.deepEqual(run.warnings[0], {
            message: 'S3 bucket should have versioning enabled',
            properties: { file: 'test/samples/positive1.tf', line: '12', endLine: '12', title: '[MEDIUM] S3 Bucket Without Versioning' },
        })
        assert.ok(run.warnings.some((w) => w.properties.file === 'test/samples/positive2.tf' && w.properties.line === '30' && w.properties.title.startsWith('[HIGH]')))
    })

    await t.test('a query that hits several files is annotated on each of them', async (t) => {
        const files = ['a.tf', 'b.tf', 'c.tf'].map((file_name, i) => finding({ file_name, line: i + 1 }))
        const run = await runAction(t, { results: kicsResults({ queries: [query({ files })] }), inputs: { enable_annotations: 'true' } })
        assert.deepEqual(run.warnings.map((w) => [w.properties.file, w.properties.line]), [['a.tf', '1'], ['b.tf', '2'], ['c.tf', '3']])
    })

    await t.test('a clean scan produces no annotations', async (t) => {
        const run = await runAction(t, { results: kicsResults({ queries: [] }), inputs: { enable_annotations: 'true' } })
        assert.equal(run.warnings.length, 0)
        assert.equal(run.code, 0)
    })

    await t.test('enable_annotations: false produces none', async (t) => {
        const run = await runAction(t, { results: kicsResults(), inputs: { enable_annotations: 'false' } })
        assert.equal(run.warnings.length, 0)
    })

    await t.test('annotates by default as declared in action.yml', async (t) => {
        const run = await runAction(t, { results: kicsResults() })
        assert.equal(run.warnings.length, 4)
    })
})

test('job summary', async (t) => {
    await t.test('is written when enable_jobs_summary is on', async (t) => {
        const run = await runAction(t, { results: kicsResults(), inputs: { enable_jobs_summary: 'true', comments_with_queries: 'true' } })
        assert.match(run.summary, /KICS version: v2\.1\.20/)
        assert.match(run.summary, /\| TOTAL \| 4 \|/)
        assert.match(run.summary, /### Queries Results/)
    })

    await t.test('is left empty by default', async (t) => {
        const run = await runAction(t, { results: kicsResults() })
        assert.equal(run.summary, '')
    })

    await t.test('works without any pull request or API access (push events)', async (t) => {
        const run = await runAction(t, { results: kicsResults(), inputs: { enable_jobs_summary: 'true' }, event: 'push' })
        assert.equal(run.code, 0)
        assert.match(run.summary, /TOTAL/)
    })
})

test('workflow status follows the KICS exit code', async (t) => {
    await t.test('passes when KICS exits 0', async (t) => {
        const run = await runAction(t, { results: kicsResults({ queries: [] }), kicsExitCode: '0' })
        assert.equal(run.code, 0)
        assert.deepEqual(run.errors, [])
        assert.match(run.stdout, /KICS scan status code: 0/)
    })

    await t.test('fails with the KICS exit code when KICS reports results', async (t) => {
        const run = await runAction(t, { results: kicsResults(), kicsExitCode: KICS_FOUND_RESULTS })
        assert.equal(run.code, 1)
        assert.deepEqual(run.errors.map((e) => e.message), ['KICS scan failed with exit code 50'])
    })

    await t.test('still publishes the report before failing the step', async (t) => {
        const fake = await startFakeGitHub(t)
        const run = await runAction(t, {
            results: kicsResults(),
            kicsExitCode: KICS_FOUND_RESULTS,
            inputs: { enable_comments: 'true', enable_jobs_summary: 'true' },
            apiUrl: fake.url,
        })
        assert.equal(run.code, 1)
        assert.equal(fake.comments.length, 1, 'PR comment posted')
        assert.match(run.summary, /TOTAL/, 'job summary written')
        assert.equal(run.warnings.length, 4, 'annotations emitted')
    })

    await t.test('fails when KICS fails and the PR comment cannot be posted', knownBug(SILENT_FAILURE), async (t) => {
        const fake = await startFakeGitHub(t, { failWith: 500 })
        const run = await runAction(t, { results: kicsResults(), kicsExitCode: KICS_FOUND_RESULTS, inputs: { enable_comments: 'true' }, apiUrl: fake.url })
        assert.equal(run.code, 1, 'a GitHub API outage must not turn a failed scan into a green build')
    })

    await t.test('fails when KICS failed and wrote no results.json', knownBug(SILENT_FAILURE), async (t) => {
        const run = await runAction(t, { kicsExitCode: '126' })
        assert.equal(run.code, 1, run.stdout + run.stderr)
        assert.ok(run.errors.length > 0)
    })

    await t.test('reports a missing results.json instead of passing silently', knownBug(SILENT_FAILURE), async (t) => {
        const run = await runAction(t, { kicsExitCode: '0', inputs: { enable_comments: 'true' } })
        assert.notEqual(run.code, 0, 'the scan produced no report, which is not a success')
    })
})

test('results location and cleanup', async (t) => {
    await t.test('reads results.json from output_path', async (t) => {
        const run = await runAction(t, { results: kicsResults(), inputs: { output_path: 'reports', enable_jobs_summary: 'true' } })
        assert.equal(run.code, 0)
        assert.match(run.summary, /TOTAL/)
    })

    await t.test('removes the results.json it asked KICS for when the user did not request json', async (t) => {
        const run = await runAction(t, { results: kicsResults(), inputs: { output_formats: 'sarif' } })
        assert.equal(run.resultsFileExists, false)
    })

    await t.test('removes it when no output format was chosen at all', async (t) => {
        const run = await runAction(t, { results: kicsResults() })
        assert.equal(run.resultsFileExists, false)
    })

    for (const formats of ['json', 'sarif,json', 'JSON,sarif']) {
        await t.test(`keeps results.json when output_formats is "${formats}"`, async (t) => {
            const run = await runAction(t, { results: kicsResults(), inputs: { output_formats: formats } })
            assert.equal(run.resultsFileExists, true)
        })
    }
})

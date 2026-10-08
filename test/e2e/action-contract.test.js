'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { ROOT, loadManifest, runnerInputEnv } = require('../helpers/action-manifest')

const { inputs, env } = loadManifest()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const reads = (source, pattern) => [...source.matchAll(pattern)].map((m) => m[1])
const consumed = new Set([
    ...reads(read('entrypoint.sh'), /\$\{?(INPUT_[A-Z_]+)/g),
    ...reads(read('src/main.js'), /process\.env\.(INPUT_[A-Z_]+)/g),
])
consumed.delete('INPUT_PARAM') // entrypoint.sh's own "-p <path>" variable, not an action input

const KNOWN_UNUSED_INPUTS = { type: 'declared in action.yml but entrypoint.sh only reads platform_type, so `type:` is silently ignored' }

test('action.yml parsing assumptions hold', async (t) => {
    await t.test('declares inputs and the runs.env mappings the tests rely on', () => {
        assert.ok(Object.keys(inputs).length > 20, 'inputs section parsed')
        assert.equal(env.INPUT_EXCLUDED_COLUMNS_FOR_COMMENTS_WITH_QUERIES, 'excluded_column_for_comments_with_queries')
    })

    await t.test('path is the only required input', () => {
        assert.deepEqual(Object.keys(inputs).filter((n) => inputs[n].required === 'true'), ['path'])
    })

    await t.test('runs as a docker action built from the repository Dockerfile', () => {
        assert.match(read('action.yml'), /^runs:\n {2}using: "docker"\n {2}image: Dockerfile$/m)
    })
})

test('every INPUT_* variable the code reads is provided by the runner', async (t) => {
    const provided = new Set(Object.keys(runnerInputEnv()))
    for (const name of [...consumed].sort()) {
        await t.test(name, () => assert.ok(provided.has(name), `${name} is read but no input or runs.env entry in action.yml provides it`))
    }
})

test('every declared input is used by the code', async (t) => {
    const viaEnvMapping = new Set(Object.entries(env).filter(([key]) => consumed.has(key)).map(([, input]) => input))
    for (const name of Object.keys(inputs)) {
        const used = consumed.has(`INPUT_${name.toUpperCase()}`) || viaEnvMapping.has(name)
        const options = name in KNOWN_UNUSED_INPUTS ? { todo: KNOWN_UNUSED_INPUTS[name] } : {}
        await t.test(name, options, () => assert.ok(used, `input "${name}" is declared but never read`))
    }
})

test('defaults a workflow gets without configuration', async (t) => {
    await t.test('annotations on; comments, job summary and queries table off', () => {
        const defaults = runnerInputEnv()
        assert.equal(defaults.INPUT_ENABLE_ANNOTATIONS, 'true')
        assert.equal(defaults.INPUT_ENABLE_COMMENTS, 'false')
        assert.equal(defaults.INPUT_ENABLE_JOBS_SUMMARY, 'false')
        assert.equal(defaults.INPUT_COMMENTS_WITH_QUERIES, 'false')
    })

    await t.test('the token defaults to the workflow GITHUB_TOKEN', () => {
        assert.match(read('action.yml'), /token:[\s\S]*?default: \$\{\{\s*github\.token\s*\}\}/)
    })
})

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { knownBug } = require('../helpers/known-bug')
const { ROOT, loadManifest } = require('../helpers/action-manifest')

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

test('nothing is downloaded or installed when the action runs (#160, #58)', () => {
    const forbidden = /\b(apk|apt|apt-get|npm|npx|yarn|pip|pip3|curl|wget)\b/
    const offending = read('entrypoint.sh').split('\n').filter((line) => forbidden.test(line))
    assert.deepEqual(offending, [])
})

test('base images are pinned by digest (#84, #85, #101)', () => {
    const stages = new Set()
    const unpinned = []
    for (const line of read('Dockerfile').split('\n')) {
        const from = line.match(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i)
        if (!from) continue
        if (!stages.has(from[1]) && !from[1].includes('@sha256:')) unpinned.push(from[1])
        if (from[2]) stages.add(from[2])
    }
    assert.deepEqual(unpinned, [])
})

test('every third-party action in the workflows is pinned to a full commit SHA', () => {
    const dir = path.join(ROOT, '.github', 'workflows')
    const unpinned = []
    for (const file of fs.readdirSync(dir)) {
        for (const [, ref] of fs.readFileSync(path.join(dir, file), 'utf8').matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
            if (!ref.startsWith('./') && !/@[0-9a-f]{40}$/.test(ref)) unpinned.push(`${file}: ${ref}`)
        }
    }
    assert.deepEqual(unpinned, [])
})

test('README', async (t) => {
    const readme = read('README.md')

    await t.test('documents only inputs that exist in action.yml (#94)', () => {
        const table = readme.split('## Inputs')[1].split('\n## ')[0]
        const documented = [...table.matchAll(/^\|\s*([a-z_]+)\s*\|/gm)].map((m) => m[1])
        const declared = Object.keys(loadManifest().inputs)
        assert.ok(documented.length > 10, 'inputs table parsed')
        assert.deepEqual(documented.filter((name) => !declared.includes(name)), [])
    })

    const sarifExamples = [...readme.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => b.includes('upload-sarif'))

    await t.test('has SARIF upload examples', () => assert.ok(sarifExamples.length > 0))

    for (const [i, block] of sarifExamples.entries()) {
        const options = block.includes('config_path') ? knownBug('the config file example sets neither ignore_on_exit nor ignore-on-exit, so the job fails before the SARIF upload (#76)') : {}
        await t.test(`SARIF upload example ${i + 1} does not fail before the upload`, options, () => assert.match(block, /ignore[_-]on[_-]exit/))
    }
})

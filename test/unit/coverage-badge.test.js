'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { lineCoverage, colorFor, badge } = require('../../scripts/coverage-badge')

const lcov = (...files) => files.map(([lf, lh]) => `SF:x.js\nLF:${lf}\nLH:${lh}\nend_of_record`).join('\n')

test('coverage badge', async (t) => {
    await t.test('weights files by their number of lines, not by file count', () => {
        assert.equal(lineCoverage(lcov([100, 90], [10, 0])), 81.8)
    })

    await t.test('refuses an empty report instead of publishing a misleading badge', () => {
        assert.throws(() => lineCoverage(''), /no instrumented lines/)
    })

    await t.test('colour follows the coverage bands', () => {
        const bands = [[100, 'brightgreen'], [90, 'brightgreen'], [89.9, 'green'], [80, 'green'], [79.9, 'yellowgreen'], [70, 'yellowgreen'], [60, 'yellow'], [50, 'orange'], [49.9, 'red'], [0, 'red']]
        for (const [percent, color] of bands) assert.equal(colorFor(percent), color, `${percent}%`)
    })

    await t.test('produces a shields.io endpoint document', () => {
        assert.deepEqual(badge(87.5), { schemaVersion: 1, label: 'coverage', message: '87.5%', color: 'green' })
    })
})

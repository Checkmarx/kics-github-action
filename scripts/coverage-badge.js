'use strict'

const fs = require('node:fs')

function lineCoverage(lcov) {
    let found = 0
    let hit = 0
    for (const line of lcov.split('\n')) {
        if (line.startsWith('LF:')) found += Number(line.slice(3))
        else if (line.startsWith('LH:')) hit += Number(line.slice(3))
    }
    if (found === 0) throw new Error('lcov report contains no instrumented lines')
    return Math.round((hit / found) * 1000) / 10
}

function colorFor(percent) {
    if (percent >= 90) return 'brightgreen'
    if (percent >= 80) return 'green'
    if (percent >= 70) return 'yellowgreen'
    if (percent >= 60) return 'yellow'
    if (percent >= 50) return 'orange'
    return 'red'
}

function badge(percent) {
    return { schemaVersion: 1, label: 'coverage', message: `${percent}%`, color: colorFor(percent) }
}

if (require.main === module) {
    const [lcovPath, outPath] = process.argv.slice(2)
    if (!lcovPath || !outPath) {
        console.error('usage: coverage-badge.js <lcov.info> <badge.json>')
        process.exit(2)
    }
    const percent = lineCoverage(fs.readFileSync(lcovPath, 'utf8'))
    fs.writeFileSync(outPath, JSON.stringify(badge(percent)) + '\n')
    console.log(percent)
}

module.exports = { lineCoverage, colorFor, badge }

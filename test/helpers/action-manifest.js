'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const ACTION_YML = path.join(ROOT, 'action.yml')

function unquote(value) {
    const v = value.trim()
    return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v
}

function loadManifest() {
    const lines = fs.readFileSync(ACTION_YML, 'utf8').split('\n')
    const inputs = {}
    const env = {}
    let section = ''
    let current = null

    for (const line of lines) {
        const top = line.match(/^([a-z]+):/)
        if (top) {
            section = top[1]
            continue
        }
        if (section === 'inputs') {
            const name = line.match(/^ {2}([a-z_]+):\s*$/)
            if (name) {
                current = inputs[name[1]] = { required: false }
                continue
            }
            const prop = line.match(/^ {4}(default|required):\s*(.*)$/)
            if (prop && current) current[prop[1]] = unquote(prop[2])
        }
        if (section === 'runs') {
            const mapping = line.match(/^ {4}(INPUT_[A-Z_]+):\s*\$\{\{\s*inputs\.([a-z_]+)\s*\}\}/)
            if (mapping) env[mapping[1]] = mapping[2]
        }
    }
    return { inputs, env }
}

function runnerInputEnv(overrides = {}, { token = 'test-token' } = {}) {
    const { inputs, env } = loadManifest()
    const unknown = Object.keys(overrides).filter((name) => !(name in inputs))
    if (unknown.length) throw new Error(`not an input of action.yml: ${unknown.join(', ')}`)

    const value = (name) => {
        if (name in overrides) return String(overrides[name])
        const def = inputs[name].default
        if (def === undefined) return ''
        return def.includes('github.token') ? token : def
    }

    const result = {}
    for (const name of Object.keys(inputs)) result[`INPUT_${name.toUpperCase()}`] = value(name)
    for (const [key, name] of Object.entries(env)) result[key] = value(name)
    return result
}

module.exports = { ROOT, loadManifest, runnerInputEnv }

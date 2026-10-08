'use strict'

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { ROOT, runnerInputEnv } = require('./action-manifest')

const MAIN_JS = path.join(ROOT, 'src', 'main.js')

function run(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options)
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (d) => (stdout += d))
        child.stderr.on('data', (d) => (stderr += d))
        child.on('error', reject)
        child.on('close', (code) => resolve({ code, stdout, stderr }))
    })
}

function baseEnv() {
    const env = { PATH: process.env.PATH, HOME: os.tmpdir() }
    // keep collecting coverage from the spawned process when the suite runs with coverage enabled
    if (process.env.NODE_V8_COVERAGE) env.NODE_V8_COVERAGE = process.env.NODE_V8_COVERAGE
    return env
}

function githubContext(dir, { event = 'pull_request', prNumber = 1, apiUrl, repository = 'o/r' } = {}) {
    const eventPath = path.join(dir, 'event.json')
    const payload = event === 'pull_request' ? { pull_request: { number: prNumber } } : { ref: 'refs/heads/master' }
    fs.writeFileSync(eventPath, JSON.stringify(payload))
    const summaryPath = path.join(dir, 'step-summary.md')
    fs.writeFileSync(summaryPath, '')
    const env = {
        GITHUB_REPOSITORY: repository,
        GITHUB_EVENT_NAME: event,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_STEP_SUMMARY: summaryPath,
    }
    if (apiUrl) env.GITHUB_API_URL = apiUrl
    return { env, summaryPath }
}

function workflowCommands(stdout, name) {
    return stdout
        .split('\n')
        .map((line) => line.match(new RegExp(`^::${name}(?: ([^:]*))?::(.*)$`)))
        .filter(Boolean)
        .map(([, props = '', message]) => ({
            message: decodeURIComponent(message.replace(/%0A/gi, '\n')),
            properties: Object.fromEntries(
                props.split(',').filter(Boolean).map((p) => {
                    const i = p.indexOf('=')
                    return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]
                })
            ),
        }))
}

async function runAction(t, { results, inputs = {}, kicsExitCode = '0', apiUrl, event, prNumber } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kics-action-'))
    const outputDir = inputs.output_path ? path.join(dir, inputs.output_path) : dir
    fs.mkdirSync(outputDir, { recursive: true })
    const resultsFile = path.join(outputDir, 'results.json')
    if (results !== undefined) fs.writeFileSync(resultsFile, JSON.stringify(results))

    const context = githubContext(dir, { event, prNumber, apiUrl })
    const env = {
        ...baseEnv(),
        ...runnerInputEnv(inputs),
        ...context.env,
        KICS_EXIT_CODE: kicsExitCode,
    }

    const { code, stdout, stderr } = await run(process.execPath, [MAIN_JS], { cwd: dir, env })

    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

    return {
        code,
        stdout,
        stderr,
        warnings: workflowCommands(stdout, 'warning'),
        errors: workflowCommands(stdout, 'error'),
        summary: fs.readFileSync(context.summaryPath, 'utf8'),
        resultsFileExists: fs.existsSync(resultsFile),
        dir,
    }
}

module.exports = { runAction, run, baseEnv, githubContext, workflowCommands, MAIN_JS }

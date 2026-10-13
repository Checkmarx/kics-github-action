'use strict'

// Redirects the hard-coded /app paths of entrypoint.sh into a sandbox; throws if those lines change shape.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { ROOT, runnerInputEnv } = require('./action-manifest')
const { run, baseEnv, githubContext, MAIN_JS } = require('./run-action')

const ENTRYPOINT = path.join(ROOT, 'entrypoint.sh')

const CONTAINER_PATH_REWRITES = [
    [/^\/app\/bin\/kics scan/m, (sandbox) => `${sandbox}/app/bin/kics scan`],
    [/^cp -r "\$\{CP_PATH\}" "\/app\/"$/m, (sandbox) => `cp -r "\${CP_PATH}" "${sandbox}/app/"`],
    [/^cd \/app$/m, (sandbox) => `cd ${sandbox}/app`],
]

function sandboxedEntrypoint(sandbox) {
    let script = fs.readFileSync(ENTRYPOINT, 'utf8')
    for (const [pattern, replacement] of CONTAINER_PATH_REWRITES) {
        if (!pattern.test(script)) throw new Error(`entrypoint.sh changed: no line matches ${pattern}; update test/helpers/run-entrypoint.js`)
        script = script.replace(pattern, replacement(sandbox))
    }
    return script
}

const FAKE_KICS = `#!/bin/bash
printf '%s\\n' "$@" > "$SANDBOX/kics-args.txt"
out=./
while [ $# -gt 0 ]; do
  if [ "$1" = "-o" ]; then out="$2"; fi
  shift
done
if [ -n "$FAKE_KICS_RESULTS" ]; then
  mkdir -p "$out"
  file="$out/\${FAKE_KICS_NAME:-results}.json"
  cp "$FAKE_KICS_RESULTS" "$file"
  if [ -n "$FAKE_KICS_MODE" ]; then chmod "$FAKE_KICS_MODE" "$file"; fi
fi
exit "\${FAKE_KICS_EXIT:-0}"
`

const NODE_SHIM = `#!/bin/bash
{ echo "cwd=$(pwd)"; echo "args=$*"; echo "KICS_EXIT_CODE=$KICS_EXIT_CODE"; } > "$SANDBOX/node-call.txt"
if [ -n "$RUN_MAIN" ]; then exec "$REAL_NODE" "$MAIN_JS"; fi
`

function write(file, content, mode) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content, { mode })
}

async function runEntrypoint(t, { inputs = {}, results, kicsExitCode = 0, runMain = false, apiUrl, workspaceFiles = {}, resultsName, resultsMode } = {}) {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'kics-entrypoint-'))
    t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }))

    const workspace = path.join(sandbox, 'workspace')
    fs.mkdirSync(workspace)
    for (const [name, content] of Object.entries(workspaceFiles)) write(path.join(workspace, name), content)

    write(path.join(sandbox, 'app', 'bin', 'kics'), FAKE_KICS, 0o755)
    fs.mkdirSync(path.join(sandbox, 'app', 'dist'))
    write(path.join(sandbox, 'bin', 'node'), NODE_SHIM, 0o755)
    write(path.join(sandbox, 'entrypoint.sh'), sandboxedEntrypoint(sandbox), 0o755)

    let resultsFile = ''
    if (results !== undefined) {
        resultsFile = path.join(sandbox, 'canned-results.json')
        fs.writeFileSync(resultsFile, JSON.stringify(results))
    }

    const context = githubContext(sandbox, { apiUrl })
    const env = {
        ...baseEnv(),
        PATH: `${path.join(sandbox, 'bin')}:${process.env.PATH}`,
        ...runnerInputEnv({ path: 'infra', ...inputs }),
        ...context.env,
        GITHUB_WORKSPACE: workspace,
        SANDBOX: sandbox,
        FAKE_KICS_RESULTS: resultsFile,
        FAKE_KICS_EXIT: String(kicsExitCode),
        FAKE_KICS_NAME: resultsName ?? '',
        FAKE_KICS_MODE: resultsMode ?? '',
        REAL_NODE: process.execPath,
        MAIN_JS,
    }
    if (runMain) env.RUN_MAIN = '1'

    // bash, not the container's ash: the script only uses constructs both support
    const { code, stdout, stderr } = await run('bash', [path.join(sandbox, 'entrypoint.sh')], { cwd: workspace, env })

    const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined)
    const argsText = read(path.join(sandbox, 'kics-args.txt'))
    const nodeCall = read(path.join(sandbox, 'node-call.txt'))

    return {
        code,
        stdout,
        stderr,
        kicsRan: argsText !== undefined,
        args: argsText === undefined ? [] : argsText.trimEnd().split('\n'),
        nodeCall: nodeCall && Object.fromEntries(nodeCall.trimEnd().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])),
        sandbox,
        workspace,
        appDir: path.join(sandbox, 'app'),
        summary: read(context.summaryPath),
    }
}

function flagValue(args, flag) {
    const i = args.indexOf(flag)
    return i === -1 ? undefined : args[i + 1]
}

module.exports = { runEntrypoint, flagValue }

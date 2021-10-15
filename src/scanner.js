const exec = require('@actions/exec');

const core = require("@actions/core");

const kicsBinary = 'kics';

const kicsInput = {
    path: { value_type: "string", flag: '--path', value: core.getInput('path') },
    ignore_on_exit: { value_type: "list", flag: '--ignore-on-exit', value: core.getInput('ignore_on_exit') },
    fail_on: { value_type: "list", flag: '--fail-on', value: core.getInput('fail_on') },
    timeout: { value_type: "int", flag: '--timeout', value: core.getInput('timeout') },
    profiling: { value_type: "list", flag: '--profiling', value: core.getInput('profiling') },
    config_path: { value_type: "string", flag: '--config', value: core.getInput('config_path') },
    payload_path: { value_type: "string", flag: '--payload-path', value: core.getInput('payload_path') },
    exclude_paths: { value_type: "list", flag: '--exclude-paths', value: core.getInput('exclude_paths') },
    exclude_queries: { value_type: "list", flag: '--exclude-queries', value: core.getInput('exclude_queries') },
    exclude_categories: { value_type: "list", flag: '--exclude-categories', value: core.getInput('exclude_categories') },
    exclude_results: { value_type: "list", flag: '--exclude-results', value: core.getInput('exclude_results') },
    output_formats: { value_type: "list", flag: '--report-formats', value: core.getInput('output_formats') },
    output_path: { value_type: "string", flag: '--output-path', value: core.getInput('output_path') },
    queries: { value_type: "string", flag: '--queries-path', value: core.getInput('queries') },
    verbose: { value_type: "bool", flag: '--verbose', value: core.getInput('verbose') },
    secrets_regexes_path: { value_type: "string", flag: '--secrets-regexes-path', value: core.getInput('secrets_regexes_path') },
    libraries_path: { value_type: "string", flag: '--libraries-path', value: core.getInput('libraries-path') },
    disable_secrets: { value_type: "bool", flag: '--disable-secrets', value: core.getInput('disable_secrets') },
    disable_full_descriptions: { value_type: "bool", flag: '--disable-full-descriptions', value: core.getInput('disable_full_descriptions') },
    types: { value_type: "list", flag: '--types', value: core.getInput('types') },
    bom: { value_type: "bool", flag: '--bom', value: core.getInput('bom') },
};

async function scanWithKICS(enableComments) {
    if (!kicsInput.path.value) {
        core.error('Path to scan is not set');
        throw new Error('Path to scan is not set');
    }
    let cmdArgs = [];
    for (let input in kicsInput) {
        if (kicsInput[input].value_type === 'string') {
            if (kicsInput[input].value) {
                cmdArgs.push(kicsInput[input].flag);
                cmdArgs.push(kicsInput[input].value);
            }
        } else if (kicsInput[input].value_type === 'list') {
            if (kicsInput[input].value) {
                cmdArgs.push(kicsInput[input].flag);
                cmdArgs.push(kicsInput[input].value);
            }
        } else if (kicsInput[input].value_type === 'bool') {
            if (kicsInput[input].value) {
                cmdArgs.push(kicsInput[input].flag);
            }
        }
    }
    if (enableComments) {
        if (!cmdArgs.find(arg => arg == '--output-path')) {
            cmdArgs.push('--output-path');
            cmdArgs.push('./');
        }
    }

    return await exec.exec(`${kicsBinary} scan --no-progress ${cmdArgs.join(" ")}`)
}

module.exports = {
    scanWithKICS
};
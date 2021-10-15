const exec = require('@actions/exec');

const core = require("@actions/core");

const kicsInputs = {
    path: { flag: '--path', value: core.getInput('path') },
    ignore_on_exit: { flag: '--ignore-on-exit', value: core.getInput('ignore_on_exit') },
    fail_on: { flag: '--fail-on', value: core.getInput('fail_on') },
    timeout: { flag: '--timeout', value: core.getInput('timeout') },
    profiling: { flag: '--profiling', value: core.getInput('profiling') },
    config_path: { flag: '--config', value: core.getInput('config_path') },
    payload_path: { flag: '--payload-path', value: core.getInput('payload_path') },
    exclude_paths: { flag: '--exclude-paths', value: core.getInput('exclude_paths') },
    exclude_queries: { flag: '--exclude-queries', value: core.getInput('exclude_queries') },
    exclude_categories: { flag: '--exclude-categories', value: core.getInput('exclude_categories') },
    exclude_results: { flag: '--exclude-results', value: core.getInput('exclude_results') },
    output_formats: { flag: '--report-formats', value: core.getInput('output_formats') },
    output_path: { flag: '--output-path', value: core.getInput('output_path') },
    queries: { flag: '--queries-path', value: core.getInput('queries') },
    verbose: { flag: '--verbose', value: core.getInput('verbose') },
    secrets_regexes_path: { flag: '--secrets-regexes-path', value: core.getInput('secrets_regexes_path') },
    libraries_path: { flag: '--libraries-path', value: core.getInput('libraries-path') },
    disable_secrets: { flag: '--disable-secrets', value: core.getInput('disable_secrets') },
    disable_full_descriptions: { flag: '--disable-full-descriptions', value: core.getInput('disable_full_descriptions') },
    types: { flag: '--types', value: core.getInput('types') },
    bom: { flag: '--bom', value: core.getInput('bom') },
};

async function scanWithKICS(kicsPath) {
    let statusCode = 0;
    if (kicsInputs.config_path.value) {
        statusCode = await exec.exec(`${kicsPath} scan ${kicsInputs.config_path.flag} ${kicsInputs.config_path.value}`);
    }
}

module.exports = {
    scanWithKICS
};
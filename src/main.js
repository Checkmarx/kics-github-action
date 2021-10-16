const install = require("./install");
const commenter = require("./commenter");
const scanner = require("./scanner");

const core = require("@actions/core");
const github = require("@actions/github");

const fs = require("fs");

const actionInputs = {
    kics_version: { value: core.getInput('kics_version') },
    enable_comments: { value: core.getInput('enable_comments') },
}

const exitStatus = {
    results: {
        codes: {
            HIGH: 50,
            MEDIUM: 40,
            LOW: 30,
            INFO: 20,
        },
        isResultExitStatus: function (exitCode) {
            for (const key in this.codes) {
                if (this.codes[key] === exitCode) {
                    return true;
                }
            }
            return false;
        }
    }
}

function setWorkflowStatus(statusCode) {
    console.log(`KICS scan status code: ${statusCode}`);

    const ignoreOnExit = core.getInput('ignore_on_exit');

    if (ignoreOnExit.toLowerCase() === 'all') {
        console.log(`ignore_on_exit=all :: Ignoring exit code ${statusCode}`);
        return;
    }

    if (ignoreOnExit.toLowerCase() === 'results') {
        if (exitStatus.results.isResultExitStatus(statusCode)) {
            console.log(`ignore_on_exit=results :: Ignoring exit code ${statusCode}`);
            return;
        }
    }
    if (ignoreOnExit.toLowerCase() === 'errors') {
        if (!exitStatus.results.isResultExitStatus(statusCode)) {
            console.log(`ignore_on_exit=errors :: Ignoring exit code ${statusCode}`);
            return;
        }
    }

    core.setFailed(`KICS scan failed with exit code ${statusCode}`);
}

function readJSON(filename) {
    const rawdata = fs.readFileSync(filename);
    const parsedJSON = JSON.parse(rawdata.toString());
    return parsedJSON;
}

async function main() {
    console.log("Running KICS action...");
    try {
        const githubToken = core.getInput("token");
        const octokit = github.getOctokit(githubToken);
        let enableComments = actionInputs.enable_comments.value.toLocaleLowerCase() === "true";
        let context = {};
        let repo = '';
        let prNumber = '';

        if (github.context) {
            context = github.context;
            if (context.repo) {
                repo = context.repo;
            }
            if (context.payload && context.payload.pull_request) {
                prNumber = context.payload.pull_request.number;
            }
        }

        await install.installKICS();
        const scanResults = await scanner.scanWithKICS(enableComments);
        if (enableComments) {
            let parsedResults = readJSON(scanResults.resultsFile);
            await commenter.postPRComment(parsedResults, repo, prNumber, octokit);
        }

        setWorkflowStatus(scanResults.statusCode);
    } catch (e) {
        console.error(e);
        core.setFailed(e.message);
    }
}

main();

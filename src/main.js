const install = require("./install");
const commenter = require("./commenter");
const scanner = require("./scanner");

const core = require("@actions/core");
const github = require("@actions/github");
const io = require("@actions/io");

const fs = require("fs");

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

    if (statusCode === 0) {
        return;
    }

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

function cleanupOutput(resultsJSONFile) {
    const outputFormats = core.getInput('output_formats');
    if (!outputFormats.toLowerCase().includes('json') || core.getInput('output_path') === '') {
        io.rmRF(resultsJSONFile);
    }
}

async function main() {
    console.log("Running KICS action...");
    try {
        const githubToken = core.getInput("token");
        const octokit = github.getOctokit(githubToken);
        let enableComments = core.getInput('enable_comments').toLocaleLowerCase() === "true";
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
            let parsedResults = readJSON(scanResults.resultsJSONFile);
            await commenter.postPRComment(parsedResults, repo, prNumber, octokit);
        }

        cleanupOutput(scanResults.resultsJSONFile);
        setWorkflowStatus(scanResults.statusCode);
    } catch (e) {
        console.error(e);
        core.setFailed(e.message);
    }
}

main();

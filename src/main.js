const commenter = require("./commenter");
const annotator = require("./annotator");
const core = require("@actions/core");
const github = require("@actions/github");
const io = require("@actions/io");
const filepath = require('path');
const fs = require("fs");

function readJSON(filename) {
    const rawdata = fs.readFileSync(filename);
    const parsedJSON = JSON.parse(rawdata.toString());
    return parsedJSON;
}

async function cleanupOutput(resultsJSONFile, outputFormats) {
    if (!outputFormats.toLowerCase().includes('json') || outputFormats === '') {
        // the entrypoint copied the report into the action dir, KICS wrote the original into the workspace
        const copies = new Set([filepath.resolve(resultsJSONFile), filepath.resolve(process.env.GITHUB_WORKSPACE || '', resultsJSONFile)]);
        for (const copy of copies) {
            await io.rmRF(copy);
        }
    }
}

function processOutputPath(output, outputName) {
    const resultsFilename = outputName || "results";
    if (output === '') {
        return {
            path: "./",
            resultsJSONFile: `./${resultsFilename}.json`
        }
    }

    return {
        path: output,
        resultsJSONFile: filepath.join(output, `/${resultsFilename}.json`)
    }
}

function setWorkflowStatus(statusCode) {
    console.log(`KICS scan status code: ${statusCode}`);

    if (statusCode === "0") {
        return;
    }

    core.setFailed(`KICS scan failed with exit code ${statusCode}`);
}

async function main() {
    console.log("Running KICS action...");

    // Get ENV variables
    const githubToken = process.env.INPUT_TOKEN;
    let enableAnnotations = process.env.INPUT_ENABLE_ANNOTATIONS;
    let enableComments = process.env.INPUT_ENABLE_COMMENTS;
    let enableJobsSummary = process.env.INPUT_ENABLE_JOBS_SUMMARY;
    const commentsWithQueries = process.env.INPUT_COMMENTS_WITH_QUERIES;
    const excludedColumnsForCommentsWithQueries = process.env.INPUT_EXCLUDED_COLUMNS_FOR_COMMENTS_WITH_QUERIES.split(',');
    const outputPath = processOutputPath(process.env.INPUT_OUTPUT_PATH, process.env.INPUT_OUTPUT_NAME);
    const outputFormats = process.env.INPUT_OUTPUT_FORMATS;
    const exitCode = process.env.KICS_EXIT_CODE

    // the scan verdict comes first so a reporting failure can never hide it
    setWorkflowStatus(exitCode);

    try {
        const octokit = github.getOctokit(githubToken);
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

        enableAnnotations = enableAnnotations ? enableAnnotations : "false"
        enableComments = enableComments ? enableComments : "false"
        enableJobsSummary = enableJobsSummary ? enableJobsSummary : "false"

        let parsedResults;
        try {
            parsedResults = readJSON(outputPath.resultsJSONFile);
        } catch (e) {
            core.setFailed(`Could not read the KICS results: ${e.message}`);
            return;
        }
        if (enableAnnotations.toLocaleLowerCase() === "true") {
            annotator.annotateChangesWithResults(parsedResults);
        }
        if (enableComments.toLocaleLowerCase() === "true" && prNumber !== '') {
            await commenter.postPRComment(parsedResults, repo, prNumber, octokit, commentsWithQueries.toLocaleLowerCase() === "true", excludedColumnsForCommentsWithQueries);
        }
        if (enableJobsSummary.toLocaleLowerCase() === "true") {
            await commenter.postJobSummary(parsedResults, commentsWithQueries.toLocaleLowerCase() === "true", excludedColumnsForCommentsWithQueries);
        }

        await cleanupOutput(outputPath.resultsJSONFile, outputFormats);
    } catch (e) {
        console.error(e);
    }
}

main();

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

function cleanupOutput(resultsJSONFile, outputFormats) {
    if (!outputFormats.toLowerCase().includes('json') || outputFormats === '') {
        io.rmRF(resultsJSONFile);
    }
}

function processOutputPath(output) {
    if (output === '') {
        return {
            path: "./",
            resultsJSONFile: "./results.json"
        }
    }

    return {
        path: output,
        resultsJSONFile: filepath.join(output, "/results.json")
    }
}

function setWorkflowStatus(statusCode, results, failOnThreshold) {
    console.log(`KICS scan status code: ${statusCode}`);

    // If failOnThreshold is provided, check severity counters
    if (failOnThreshold && typeof results === 'object' && results.severity_counters) {
        let failed = false;
        for (const [severity, rule] of Object.entries(failOnThreshold)) {
            const count = results.severity_counters[severity.toUpperCase()] || 0;
            if (rule && rule.op && typeof rule.value === 'number') {
                if ((rule.op === 'gt' && count > rule.value) ||
                    (rule.op === 'lt' && count < rule.value) ||
                    (rule.op === 'gte' && count >= rule.value) ||
                    (rule.op === 'lte' && count <= rule.value)) {
                    console.log(`Failing workflow: ${severity} issues (${count}) ${rule.op} ${rule.value}`);
                    failed = true;
                }
            }
        }
        if (failed) {
            core.setFailed(`KICS scan failed due to fail_on_threshold: ${JSON.stringify(failOnThreshold)}`);
            return;
        } else {
            // If fail_on_threshold is set and not triggered, always pass
            return;
        }
    }

    // Default behavior
    if (statusCode === "0") {
        return;
    }
    core.setFailed(`KICS scan failed with exit code ${statusCode}`);
}

function parseFailOnThreshold(input) {
    if (!input) return undefined;
    // Accept JSON or comma-separated string (e.g., "high>5,low<20")
    try {
        if (input.trim().startsWith('{')) {
            return JSON.parse(input);
        }
        const map = {};
        input.split(',').forEach(pair => {
            const match = pair.trim().match(/^(\w+)\s*([><]=?)\s*(\d+)$/);
            if (match) {
                const [, key, op, value] = match;
                let opName = '';
                if (op === '>') opName = 'gt';
                else if (op === '>=') opName = 'gte';
                else if (op === '<') opName = 'lt';
                else if (op === '<=') opName = 'lte';
                map[key.toLowerCase()] = { op: opName, value: Number(value) };
            }
        });
        return Object.keys(map).length ? map : undefined;
    } catch (e) {
        console.error('Could not parse INPUT_FAIL_ON_THRESHOLD:', e);
        return undefined;
    }
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
    const outputPath = processOutputPath(process.env.INPUT_OUTPUT_PATH);
    const outputFormats = process.env.INPUT_OUTPUT_FORMATS;
    const exitCode = process.env.KICS_EXIT_CODE

    // Read fail_on_threshold using core.getInput for consistency
    const failOnThresholdRaw = core.getInput('fail_on_threshold');
    const failOnThreshold = parseFailOnThreshold(failOnThresholdRaw);

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

        const parsedResults = readJSON(outputPath.resultsJSONFile);
        if (enableAnnotations.toLocaleLowerCase() === "true") {
            annotator.annotateChangesWithResults(parsedResults);
        }
        if (enableComments.toLocaleLowerCase() === "true") {
            await commenter.postPRComment(parsedResults, repo, prNumber, octokit, commentsWithQueries.toLocaleLowerCase() === "true", excludedColumnsForCommentsWithQueries);
        }
        if (enableJobsSummary.toLocaleLowerCase() === "true") {
            await commenter.postJobSummary(parsedResults, commentsWithQueries.toLocaleLowerCase() === "true", excludedColumnsForCommentsWithQueries);
        }

        setWorkflowStatus(exitCode, parsedResults, failOnThreshold);
        cleanupOutput(outputPath.resultsJSONFile, outputFormats);
    } catch (e) {
        console.error(e);
    }
}

main();

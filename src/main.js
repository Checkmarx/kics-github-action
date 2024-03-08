const commenter = require("./commenter");
const annotator = require("./annotator");
const core = require("@actions/core");
const github = require("@actions/github");
const io = require("@actions/io");
const filepath = require('path');
const fs = require("fs");
const yaml = require('js-yaml');
const { parse } = require('hcl-parser');
const toml = require('@iarna/toml');

function readJSON(filename) {
    const rawData = fs.readFileSync(filename);
    return JSON.parse(rawData.toString());
}

function cleanupOutput(resultsJSONFile, outputFormats) {
    if (!outputFormats.toLowerCase().includes('json') || outputFormats === '') {
        io.rmRF(resultsJSONFile);
    }
}

async function processOutputPath(output, configPath) {
    let resultsFileName = '';
    if (configPath !== '') {
        [config_type, content] = await fileAnalyzer(configPath);

        if (config_type !== '') {
            output = content["output-path"] || output;
            resultsFileName = content["output-name"] || '';
        }
    }

    if (output === '') {
        return {
            path: "./",
            resultsJSONFile: "./results.json"
        }
    }

    return {
        path: output,
        resultsJSONFile: resultsFileName || filepath.join(output, "/results.json")
    }
}

async function fileAnalyzer(filePath) {
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    let temp = {};

    // Attempt to parse as JSON
    try {
        temp = JSON.parse(fileContent);
        return ['json', temp];
    } catch (jsonErr) {}

    // Attempt to parse as YAML
    try {
        temp = yaml.safeLoad(fileContent);
        return ['yaml', temp];
    } catch (yamlErr) {}

    // Attempt to parse as TOML
    try {
        temp = toml.parse(fileContent);
        return ['toml', temp];
    } catch (tomlErr) {}

    // Attempt to parse as HCL
    try {
        const parsed = parse(fileContent);
        if (parsed.body && parsed.body.length > 0) {
            temp = parsed.body[0];
            return ['hcl', temp];
        }
    } catch (hclErr) {}

    console.log(`Error analyzing file: Invalid configuration file format`);
    return ['', {}];
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
    const outputPath = processOutputPath(process.env.INPUT_OUTPUT_PATH, process.env.INPUT_CONFIG_PATH);
    const outputFormats = process.env.INPUT_OUTPUT_FORMATS;
    const exitCode = process.env.KICS_EXIT_CODE

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

        setWorkflowStatus(exitCode);
        cleanupOutput(outputPath.resultsJSONFile, outputFormats);
    } catch (e) {
        console.error(e);
    }
}

main();

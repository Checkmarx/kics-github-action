const commenter = require("./commenter");
const annotator = require("./annotator");
const core = require("@actions/core");
const github = require("@actions/github");
const io = require("@actions/io");
const filepath = require('path');
const fs = require("fs");
const yaml = require('js-yaml');
const HCL = require("js-hcl-parser")
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
    if (configPath !== '' ) {

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

    if (resultsFileName === '') {
        resultsFileName = filepath.join(output, "/results.json")
    } else {
        resultsFileName = filepath.join(output, resultsFileName);
    }

    return {
        path: output,
        resultsJSONFile: resultsFileName
    }
}

function readFileContent(filePath) {
    try {
        const stats = fs.statSync(filePath); // Use fs.statSync to get file stats synchronously
        if (!stats.isFile()) {
            throw new Error('Provided path is not a file.');
        }
        const data = fs.readFileSync(filePath, 'utf8'); // Use fs.readFileSync to read file content synchronously
        return data;
    } catch (error) {
        console.error('Error reading file:', error);
        return ''; // Return empty string or handle the error as needed
    }
}
async function fileAnalyzer(filePath) {
    const fileContent = await readFileContent(filePath);
    let temp = {};

    if (fileContent === '') {
        console.log('Error analyzing file: Empty file content');
        return ['', {}];
    }
    // Attempt to parse as JSON
    try {
        const jsonData = JSON.parse(fileContent);
        return ['json', jsonData];
    } catch (jsonError) {
        // Attempt to parse as HCL
        try {
            const parsed = HCL.parse(fileContent);
            const jsonData = JSON.parse(parsed);
            return ['hcl', jsonData];
        } catch (hclErr) {
            console.log(`Error analyzing file: ${hclErr}`);
            // Attempt to parse as TOML
            try {
                temp = toml.parse(fileContent);
                return ['toml', temp];
            } catch (tomlErr) {
                // Attempt to parse as YAML
                try {
                    temp = yaml.load(fileContent);
                    return ['yaml', temp];
                } catch (yamlErr) {
                    console.log(`Error analyzing file: ${yamlErr}`);
                    console.log(`Error analyzing file: Invalid configuration file format`);
                    return ['', {}];
                }
            }
        }
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

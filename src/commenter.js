const fs = require("fs");
const moment = require('moment')

const kicsLogo = "https://user-images.githubusercontent.com/75368139/136991766-a4e5bc8b-63db-48f7-9384-740e9f15c9f6.png"
const severityOrder = ["HIGH", "MEDIUM", "LOW", "INFO", "TRACE"];
const severityIcons = {
    "HIGH": "https://user-images.githubusercontent.com/23239410/92157087-97285600-ee32-11ea-988f-0aca12c4c126.png",
    "MEDIUM": "https://user-images.githubusercontent.com/23239410/92157093-98598300-ee32-11ea-83d7-af52251a011b.png",
    "LOW": "https://user-images.githubusercontent.com/23239410/92157091-98598300-ee32-11ea-8498-19bd7d62019b.png",
    "INFO": "https://user-images.githubusercontent.com/23239410/92157090-97c0ec80-ee32-11ea-9b2e-aa6b32b03d54.png",
    "TRACE": "https://user-images.githubusercontent.com/23239410/92157090-97c0ec80-ee32-11ea-9b2e-aa6b32b03d54.png"
}


function readJSON(filename) {
    const rawdata = fs.readFileSync(filename);
    const parsedJSON = JSON.parse(rawdata.toString());
    return parsedJSON;
}

function createComment(results) {
    let message = "![kics-logo](" + kicsLogo + ")\n";

    message += "---";
    message += `\n**KICS version: ${results['kics_version']}**\n`
    message += "\n**Total Results: " + results['total_counter'] + "**\n\n";
    message += "| | Category | Results |\n";
    message += "| --- |--- | --- |\n";
    let severityCounters = results['severity_counters']
    for (let severity of severityOrder) {
        if (severity in severityCounters) {
            message += "| ![" + severity + "](" + severityIcons[severity] + ") |" + severity.toUpperCase() + " | " + severityCounters[severity.toUpperCase()] + " |\n";
        }
    }

    message += "\n**Scan Metrics**\n\n";
    message += "| Metric | Values |\n";
    message += "| --- | --- |\n";
    message += "| Files scanned | " + results['files_scanned'] + "\n";
    message += "| Files parsed | " + results['files_parsed'] + "\n";
    message += "| Files failed to scan | " + results['files_failed_to_scan'] + "\n";
    message += "| Total queries | " + results['queries_total'] + "\n";
    message += "| Queries failed to execute | " + results['queries_failed_to_execute'] + "\n";

    let executionTime = moment(results['end']).diff(moment(results['start']), 'seconds');

    message += "| Execution time | " + executionTime + "s\n";

    return message;
}

async function postPRComment(repo, prNumber) {
    const githubToken = core.getInput("token");
    const octokit = github.getOctokit(githubToken);
    const results = readJSON("results.json");
    const message = createComment(results);
    console.log(message);

    const { data: comments } = await octokit.rest.issues.listComments({
        ...repo,
        issue_number: prNumber,
    });

    const comment = comments.find((comment) => {
        return (
            comment.user.login === "github-actions[bot]" &&
            comment.body.startsWith("![kics-logo](" + kicsLogo + ")\n")
        );
    });

    if (comment) {
        await octokit.rest.issues.updateComment({
            ...repo,
            comment_id: comment.id,
            body: message
        });
    } else {
        await octokit.rest.issues.createComment({
            ...repo,
            issue_number: prNumber,
            body: message
        });
    }
}

module.exports = {
    postPRComment
};
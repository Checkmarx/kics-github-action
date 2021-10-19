const moment = require('moment')

const kicsLogo = "https://user-images.githubusercontent.com/75368139/136991766-a4e5bc8b-63db-48f7-9384-740e9f15c9f6.png"
const severityOrder = ["HIGH", "MEDIUM", "LOW", "INFO", "TRACE"];
const severityIcons = {
    "HIGH": "https://user-images.githubusercontent.com/23239410/92157087-97285600-ee32-11ea-988f-0aca12c4c126.png",
    "MEDIUM": "https://user-images.githubusercontent.com/23239410/92157093-98598300-ee32-11ea-83d7-af52251a011b.png",
    "LOW": "https://user-images.githubusercontent.com/23239410/92157091-98598300-ee32-11ea-8498-19bd7d62019b.png",
    "INFO": "https://user-images.githubusercontent.com/75368139/137872145-b13b5200-6919-43c2-a49b-d3fdbbc20f63.png",
    "TRACE": "https://user-images.githubusercontent.com/23239410/92157090-97c0ec80-ee32-11ea-9b2e-aa6b32b03d54.png",
}
const emptyIcon = "https://user-images.githubusercontent.com/75368139/137874724-5118ebc4-9769-4eb2-923d-e4ca479f747f.png"

function createComment(results) {
    let message = "![kics-logo](" + kicsLogo + ")\n";
    message += `\n**KICS version: ${results['kics_version']}**\n`

    message += "<table>\n";
    message += "<tr></tr>\n";
    message += "<tr><td>\n\n";

    message += "| | Category | Results |\n";
    message += "| --- |--- | --- |\n";
    let severityCounters = results['severity_counters']
    for (let severity of severityOrder) {
        if (severity in severityCounters) {
            message += `| ![${severity}](${severityIcons[severity]}) | ${severity.toUpperCase()} | ${severityCounters[severity.toUpperCase()]} |\n`;
        }
    }
    message += `| ![TOTAL](${emptyIcon}) | TOTAL | ${results['total_counter']} |`;

    message += "\n\n</td><td>\n\n";

    message += "| | Metric | Values |\n";
    message += "| --- | --- | --- |\n";
    message += `| ![placeholder](${emptyIcon}) | Files scanned | ${results['files_scanned']}\n`;
    message += `| ![placeholder](${emptyIcon}) | Files parsed | ${results['files_parsed']}\n`;
    message += `| ![placeholder](${emptyIcon}) | Files failed to scan | ${results['files_failed_to_scan']}\n`;
    message += `| ![placeholder](${emptyIcon}) | Total executed queries | ${results['queries_total']}\n`;
    message += `| ![placeholder](${emptyIcon}) | Queries failed to execute | ${results['queries_failed_to_execute']}\n`;
    message += `| ![placeholder](${emptyIcon}) | Execution time | ${moment(results['end']).diff(moment(results['start']), 'seconds')}\n`;

    message += "\n</td></tr>\n</table>\n\n";

    return message;
}

async function postPRComment(results, repo, prNumber, octokit) {
    const message = createComment(results);

    const { data: comments } = await octokit.rest.issues.listComments({
        ...repo,
        issue_number: prNumber,
    });

    const comment = comments.find((comment) => {
        return (
            comment.user.login === "github-actions[bot]" &&
            comment.body.startsWith("![kics-logo](")
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

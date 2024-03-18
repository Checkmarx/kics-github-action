const moment = require('moment')
const { summary } = require('@actions/core/lib/summary');

const kicsLogo = "https://user-images.githubusercontent.com/111127232/203838108-ad537fea-4573-495a-9619-18500ee81dd9.png"
const severityOrder = ["CRITICAL","HIGH", "MEDIUM", "LOW", "INFO", "TRACE"];
const severityIcons = {
    "CRITICAL": "https://raw.githubusercontent.com/Checkmarx/kics-github-action/88fa5c6bfb020c2ad298af00c4cd5b8dfbced92d/images/Critical.png",
    "HIGH": "https://user-images.githubusercontent.com/23239410/92157087-97285600-ee32-11ea-988f-0aca12c4c126.png",
    "MEDIUM": "https://user-images.githubusercontent.com/23239410/92157093-98598300-ee32-11ea-83d7-af52251a011b.png",
    "LOW": "https://user-images.githubusercontent.com/23239410/92157091-98598300-ee32-11ea-8498-19bd7d62019b.png",
    "INFO": "https://user-images.githubusercontent.com/75368139/137872145-b13b5200-6919-43c2-a49b-d3fdbbc20f63.png",
    "TRACE": "https://user-images.githubusercontent.com/23239410/92157090-97c0ec80-ee32-11ea-9b2e-aa6b32b03d54.png",
}
const emptyIcon = "https://user-images.githubusercontent.com/75368139/137874724-5118ebc4-9769-4eb2-923d-e4ca479f747f.png"

function createComment(results, withQueries = false, excludedColumnsForCommentsWithQueries) {
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

    message += "| Metric | Values |\n";
    message += "| --- | --- |\n";
    message += `| Files scanned ![placeholder](${emptyIcon}) | ${results['files_scanned']}\n`;
    message += `| Files parsed ![placeholder](${emptyIcon}) | ${results['files_parsed']}\n`;
    message += `| Files failed to scan ![placeholder](${emptyIcon}) | ${results['files_failed_to_scan']}\n`;
    message += `| Total executed queries ![placeholder](${emptyIcon}) | ${results['queries_total']}\n`;
    message += `| Queries failed to execute ![placeholder](${emptyIcon}) | ${results['queries_failed_to_execute']}\n`;
    message += `| Execution time ![placeholder](${emptyIcon}) | ${moment(results['end']).diff(moment(results['start']), 'seconds')}\n`;

    message += "\n</td></tr>\n</table>\n\n";

    if (withQueries === false) {
        return message;
    }
    message += "### Queries Results\n"

    message += "<table>\n";
    message += "<tr></tr>\n";
    message += "<tr><td>\n\n";

    const flattenedQueries = computeFlattenedQueries(results)
    const headers = computeHeaders(flattenedQueries)

    const excludedColumns = [
        "query_url",
        ... excludedColumnsForCommentsWithQueries
    ]

    // display header
    for (let i in headers) {
        if (excludedColumns.includes(headers[i])) {
            continue
        }
        let title = headers[i]
            .match(/([^\W_]+)/g)
            .map(v => v.charAt(0).toUpperCase() + v.substr(1).toLowerCase())
            .join(" ")
        message += `| ${title}`
    }
    message += "|\n"

    // display line separation
    for (let i in headers) {
        if (excludedColumns.includes(headers[i])) {
            continue
        }
        message += "|:---"
    }
    message += "|\n"

    flattenedQueries.forEach(function (query) {
        headers.forEach(function (header) {
            if (excludedColumns.includes(header)) {
                return
            }
            if (query[header] === undefined) {
                message += "| "
                return
            }
            if (header === "query_name") {
                message += `| [${query[header]}](${query["query_url"]})`
                return
            }
            message += `| ${query[header].toString().replace("\n", " ")}`
        })
        message += "|\n"
    })

    message += "\n</td></tr>\n</table>\n\n";

    return message;
}

function computeFlattenedQueries(results) {
    let flattenedQueries = []
    for (let index in results["queries"]) {
        let value = results["queries"][index]
        const { ['files']: files, ...valueWithoutFiles } = value

        for (let idx in value["files"]) {
            flattenedQueries.push({...valueWithoutFiles, ...value["files"][idx]})
        }
    }
    return flattenedQueries
}

function computeHeaders(flattenedQueries) {
    let tmpHeader = []
    for (let ft in flattenedQueries) {
        tmpHeader = [
            ... tmpHeader,
            ... Object.entries(flattenedQueries[ft]).map(v => v[0])
        ]
    }
    return [...new Set(tmpHeader.map(v => v))]
}

async function postPRComment(results, repo, prNumber, octokit, commentWithQueries = false, excludedColumnsForCommentsWithQueries) {
    const message = createComment(results, commentWithQueries, excludedColumnsForCommentsWithQueries);

    const {data: comments} = await octokit.rest.issues.listComments({
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

async function postJobSummary(results, commentWithQueries = false, excludedColumnsForCommentsWithQueries) {
    const message = createComment(results, commentWithQueries, excludedColumnsForCommentsWithQueries);
    await summary.addRaw(message).write()
}

module.exports = {
    postPRComment,
    postJobSummary
};

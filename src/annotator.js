const core = require("@actions/core");

function extractAnnotations(results) {
    let annotations = [];
    for (i in results.queries) {
        let query = results.queries[i];
        for (j in query.files) {
            let file = query.files[j];
            annotations.push({
                file: file['file_name'],
                startLine: file['line'],
                endLine: file['line'],
                severity: query['severity'],
                queryName: query['query_name'],
                description: query['description'],
            });
        }
    }

    return annotations;
}

function annotateChangesWithResults(results) {
    const annotations = extractAnnotations(results);
    annotations.forEach(annotation => {
        core.warning(annotation.description, {
            title: `[${annotation.severity}] ${annotation.queryName}`,
            startLine: annotation.startLine,
            endLine: annotation.endLine,
            file: annotation.file,
        });
    });

}

module.exports = {
    annotateChangesWithResults
}

async function fetchPRFiles(octokit, repo, prNumber) {
  try {
    const { data: files } = await octokit.rest.pulls.listFiles({
      ...repo,
      pull_number: prNumber,
    });
    return files;
  } catch (error) {
    console.error("Error fetching PR files:", error);
    return [];
  }
}

function parseChangedLines(prFiles) {
  const changedFiles = {};

  prFiles.forEach((file) => {
    const changedLines = [];

    // Skip files without patches (like binary files or deleted files)
    if (!file.patch) {
      changedFiles[file.filename] = changedLines;
      return;
    }

    // Parse each hunk in the patch to find added/modified lines
    const hunkRegex = /@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/g;
    let match;

    while ((match = hunkRegex.exec(file.patch)) !== null) {
      const start = parseInt(match[1]);
      const count = match[2] ? parseInt(match[2]) : 1;

      // Only include lines that were added/modified (count > 0)
      if (count > 0) {
        for (let i = start; i < start + count; i++) {
          changedLines.push(i);
        }
      }
    }

    // Remove duplicates and sort
    changedFiles[file.filename] = [...new Set(changedLines)].sort(
      (a, b) => a - b
    );
  });

  return changedFiles;
}

function filterResultsByChangedFiles(results, changedFiles) {
  console.log("Filtering results for diff-aware reporting...");

  const filteredResults = JSON.parse(JSON.stringify(results)); // Deep clone
  const filteredQueries = [];

  // Filter findings based on changed files and lines
  for (const query of results.queries) {
    const filteredFiles = [];

    for (const file of query.files) {
      const fileName = file.file_name;
      const fileLine = file.line;

      // Check if this file was changed in the PR
      if (changedFiles.hasOwnProperty(fileName)) {
        const changedLines = changedFiles[fileName];

        // If no specific lines changed (e.g., new file), include all findings
        // Otherwise, only include findings on changed lines
        if (changedLines.length === 0 || changedLines.includes(fileLine)) {
          filteredFiles.push(file);
        }
      }
    }

    // If this query has findings in changed files/lines, include it
    if (filteredFiles.length > 0) {
      const filteredQuery = { ...query, files: filteredFiles };
      filteredQueries.push(filteredQuery);
    }
  }

  // Update the filtered results
  filteredResults.queries = filteredQueries;

  // Recalculate counters based on filtered findings
  const newSeverityCounters = {};
  let totalCounter = 0;

  // Initialize severity counters
  for (const severity of [
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    "INFO",
    "TRACE",
  ]) {
    newSeverityCounters[severity] = 0;
  }

  // Count findings by severity
  filteredQueries.forEach((query) => {
    const severity = query.severity.toUpperCase();
    const findingCount = query.files.length;
    if (newSeverityCounters.hasOwnProperty(severity)) {
      newSeverityCounters[severity] += findingCount;
    }
    totalCounter += findingCount;
  });

  filteredResults.severity_counters = newSeverityCounters;
  filteredResults.total_counter = totalCounter;

  console.log(
    `Filtered results: ${totalCounter} findings in changed files (originally ${results.total_counter})`
  );

  return filteredResults;
}

async function applyDiffAwareFiltering(parsedResults, octokit, repo, prNumber) {
  console.log("Diff-aware reporting enabled for PR #" + prNumber);
  const prFiles = await fetchPRFiles(octokit, repo, prNumber);
  if (prFiles.length > 0) {
    const changedFiles = parseChangedLines(prFiles);
    return filterResultsByChangedFiles(parsedResults, changedFiles);
  } else {
    console.log(
      "No PR files found or error fetching files, using original results"
    );
    return parsedResults;
  }
}

module.exports = {
  applyDiffAwareFiltering,
};

const install = require("./install");
const commenter = require("./commenter");
const scanner = require("./scanner");
const core = require("@actions/core");

const actionInputs = {
    kics_version: { value: core.getInput('kics_version') },
    enable_pr_comments: { value: core.getInput('enable_pr_comments') },
}

async function main() {
    console.log("Running KICS action...");
    try {
        // const context = github.context;
        // const repository = context.repo;
        // const pullRequestNumber = context.payload.pull_request.number;
        const kicsPath = await install.installKICS(actionInputs.kics_version.value);
        console.log("KICS installed at: " + kicsPath);
        //await scanner.scanWithKICS(kicsPath);
        // if (actionInputs.enable_pr_comments.value === "true") {
        //     await commenter.commentOnPullRequest(repository, pullRequestNumber);
        // }
    } catch (e) {
        console.error(e);
        core.setFailed(e.message);
    }
}

main();
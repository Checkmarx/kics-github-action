const install = require("./install");
const commenter = require("./commenter");
const scanner = require("./scanner");
const core = require("@actions/core");
const github = require("@actions/github");

const actionInputs = {
    kics_version: { value: core.getInput('kics_version') },
    enable_comments: { value: core.getInput('enable_comments') },
}

async function main() {
    console.log("Running KICS action...");
    try {
        let enableComments = actionInputs.enable_comments.value.toLocaleLowerCase() === "true";
        const context = github.context;
        const repository = context.repo;
        console.log(context);
        const pullRequestNumber = context.payload.pull_request.number;
        await install.installKICS();
        await scanner.scanWithKICS(enableComments);
        if (enableComments) {
            await commenter.commentOnPullRequest(repository, pullRequestNumber);
        }
    } catch (e) {
        console.error(e);
        core.setFailed(e.message);
    }
}

main();
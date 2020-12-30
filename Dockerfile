FROM checkmarx/kics:latest

ENTRYPOINT ["/app/bin/kics","-p /github/workspace/$INPUT_DIRECTORY"]
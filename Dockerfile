FROM checkmarx/kics:latest

ENTRYPOINT ["/app/bin/kics","-p $INPUT_DIRECTORY"]
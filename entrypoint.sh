#!/bin/ash
DATETIME="$(date '+%H:%M')"

####################################
# Check if Scan Path is Present    #
####################################
if [ -z "$INPUT_PATH" ]; then
    echo "${DATETIME} - ERR input path can't be empty"
    exit 1
else
    INPUT_PATH=$(echo "$INPUT_PATH" | sed -e 's/^"//' -e 's/"$//')
fi

###########################
# Set KICS Flags Values   #
###########################
# Flags that take a path go in "$@" so a path containing spaces stays one argument
set --
[[ ! -z "$INPUT_PAYLOAD_PATH" ]] && set -- "$@" -d "$INPUT_PAYLOAD_PATH"
[[ ! -z "$INPUT_CONFIG_PATH" ]] && set -- "$@" --config "$INPUT_CONFIG_PATH"
[[ ! -z "$INPUT_EXCLUDE_PATHS" ]] && set -- "$@" -e "$INPUT_EXCLUDE_PATHS"
[[ ! -z "$INPUT_EXCLUDE_RESULTS" ]] && EXCLUDE_RESULTS_PARAM="-x $INPUT_EXCLUDE_RESULTS"
[[ ! -z "$INPUT_EXCLUDE_SEVERITIES" ]] && EXCLUDE_SEVERITIES_PARAM="--exclude-severities $INPUT_EXCLUDE_SEVERITIES"
[[ ! -z "$INPUT_EXCLUDE_QUERIES" ]] && EXCLUDE_QUERIES_PARAM="--exclude-queries $INPUT_EXCLUDE_QUERIES"
[[ ! -z "$INPUT_EXCLUDE_CATEGORIES" ]] && EXCLUDE_CATEGORIES_PARAM="--exclude-categories $INPUT_EXCLUDE_CATEGORIES"
[[ "$INPUT_EXCLUDE_GITIGNORE" == "true" ]] && EXCLUDE_GITIGNORE="--exclude-gitignore"
INPUT_PLATFORM_TYPE="${INPUT_PLATFORM_TYPE:-$INPUT_TYPE}"
[[ ! -z "$INPUT_PLATFORM_TYPE" ]] && PLATFORM_TYPE_PARAM="--type $INPUT_PLATFORM_TYPE"
[[ ! -z "$INPUT_FAIL_ON" ]] && FAIL_ON_PARAM="--fail-on $INPUT_FAIL_ON"
[[ ! -z "$INPUT_TIMEOUT" ]] && TIMEOUT_PARAM="--timeout $INPUT_TIMEOUT"
[[ ! -z "$INPUT_PROFILING" ]] && PROFILING_PARAM="--profiling $INPUT_PROFILING"
[[ "$INPUT_BOM" == "true" ]] && BOM_PARAM="-m"
[[ ! -z "$INPUT_INCLUDE_QUERIES" ]] && INCLUDE_QUERIES_PARAM="-i $INPUT_INCLUDE_QUERIES"
[[ "$INPUT_DISABLE_SECRETS" == "true" ]] && DISABLE_SECRETS_PARAM="--disable-secrets"
[[ "$INPUT_DISABLE_FULL_DESCRIPTIONS" == "true" ]] && DISABLE_FULL_DESCRIPTIONS_PARAM="--disable-full-descriptions"
[[ ! -z "$INPUT_LIBRARIES_PATH" ]] && set -- "$@" -b "$INPUT_LIBRARIES_PATH"
[[ ! -z "$INPUT_SECRETS_REGEXES_PATH" ]] && set -- "$@" -r "$INPUT_SECRETS_REGEXES_PATH"
[[ ! -z "$INPUT_IGNORE_ON_EXIT" ]] && IGNORE_ON_EXIT_PARAM="--ignore-on-exit $INPUT_IGNORE_ON_EXIT"
[[ ! -z "$INPUT_CLOUD_PROVIDER" ]] && CLOUD_PROVIDER="--cloud-provider $INPUT_CLOUD_PROVIDER"

[[ "$INPUT_VERBOSE" == "true" ]] && VERBOSE_PARAM="-v"

#######################
# Set Queries Path    #
#######################
if [ ! -z "$INPUT_QUERIES" ]; then
    set -- "$@" -q "$INPUT_QUERIES"
else
    set -- "$@" -q /app/bin/assets/queries
fi

###############################################
# Add JSON as Report Format if not present    #
###############################################
if [ -n "$INPUT_OUTPUT_FORMATS" ]; then
    if [[ $INPUT_OUTPUT_FORMATS == *"json"* ]]; then
        OUTPUT_FORMATS_PARAM="--report-formats $INPUT_OUTPUT_FORMATS"
    else
        OUTPUT_FORMATS_PARAM="--report-formats $INPUT_OUTPUT_FORMATS,json"
    fi
else
    OUTPUT_FORMATS_PARAM="--report-formats json"
fi

############################
# Check for Output Path    #
############################

CP_PATH="./results.json"
if [ ! -z "$INPUT_OUTPUT_PATH" ]; then
    set -- "$@" -o "$INPUT_OUTPUT_PATH"
    CP_PATH=$INPUT_OUTPUT_PATH
else
    set -- "$@" -o ./
fi

####################
# Run KICS Scan    #
####################
cd "$GITHUB_WORKSPACE"
echo "${DATETIME} - INF : about to scan directory $INPUT_PATH"
echo "${DATETIME} - INF : kics command kics -p $INPUT_PATH $OUTPUT_FORMATS_PARAM $PLATFORM_TYPE_PARAM $EXCLUDE_CATEGORIES_PARAM $EXCLUDE_RESULTS_PARAM $EXCLUDE_SEVERITIES_PARAM $EXCLUDE_QUERIES_PARAM $EXCLUDE_GITIGNORE $VERBOSE_PARAM $IGNORE_ON_EXIT_PARAM $FAIL_ON_PARAM $TIMEOUT_PARAM $PROFILING_PARAM $BOM_PARAM $INCLUDE_QUERIES_PARAM $DISABLE_SECRETS_PARAM $DISABLE_FULL_DESCRIPTIONS_PARAM $CLOUD_PROVIDER $*"
/app/bin/kics scan --no-progress -p "$INPUT_PATH" $OUTPUT_FORMATS_PARAM $PLATFORM_TYPE_PARAM $EXCLUDE_CATEGORIES_PARAM $EXCLUDE_RESULTS_PARAM $EXCLUDE_SEVERITIES_PARAM $EXCLUDE_QUERIES_PARAM $EXCLUDE_GITIGNORE $VERBOSE_PARAM $IGNORE_ON_EXIT_PARAM $FAIL_ON_PARAM $TIMEOUT_PARAM $PROFILING_PARAM $BOM_PARAM $INCLUDE_QUERIES_PARAM $DISABLE_SECRETS_PARAM $DISABLE_FULL_DESCRIPTIONS_PARAM $CLOUD_PROVIDER "$@"

export KICS_EXIT_CODE=$?

cp -r "${CP_PATH}" "/app/"

cd /app

node dist/index.js

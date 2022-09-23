#!/bin/ash
DATETIME="$(date '+%H:%M')"

####################################
# Check if Scan Path is Present    #
####################################
if [ -z "$INPUT_PATH" ]; then
    echo "${DATETIME} - ERR input path can't be empty"
    exit 1
else
    INPUT_PARAM="-p $INPUT_PATH"
fi

###########################
# Set KICS Flags Values   #
###########################
[[ ! -z "$INPUT_PAYLOAD_PATH" ]] && PAYLOAD_PATH_PARAM="-d $INPUT_PAYLOAD_PATH"
[[ ! -z "$INPUT_CONFIG_PATH" ]] && CONFIG_PATH_PARAM="--config $INPUT_CONFIG_PATH"
[[ ! -z "$INPUT_EXCLUDE_PATHS" ]] && EXCLUDE_PATHS_PARAM="-e $INPUT_EXCLUDE_PATHS"
[[ ! -z "$INPUT_EXCLUDE_RESULTS" ]] && EXCLUDE_RESULTS_PARAM="-x $INPUT_EXCLUDE_RESULTS"
[[ ! -z "$INPUT_EXCLUDE_SEVERITIES" ]] && EXCLUDE_SEVERITIES_PARAM="--exclude-severities $INPUT_EXCLUDE_SEVERITIES"
[[ ! -z "$INPUT_EXCLUDE_QUERIES" ]] && EXCLUDE_QUERIES_PARAM="--exclude-queries $INPUT_EXCLUDE_QUERIES"
[[ ! -z "$INPUT_EXCLUDE_CATEGORIES" ]] && EXCLUDE_CATEGORIES_PARAM="--exclude-categories $INPUT_EXCLUDE_CATEGORIES"
[[ ! -z "$INPUT_EXCLUDE_GITIGNORE" ]] && EXCLUDE_GITIGNORE="--exclude-gitignore"
[[ ! -z "$INPUT_PLATFORM_TYPE" ]] && PLATFORM_TYPE_PARAM="--type $INPUT_PLATFORM_TYPE"
[[ ! -z "$INPUT_FAIL_ON" ]] && FAIL_ON_PARAM="--fail-on $INPUT_FAIL_ON"
[[ ! -z "$INPUT_TIMEOUT" ]] && TIMEOUT_PARAM="--timeout $INPUT_TIMEOUT"
[[ ! -z "$INPUT_PROFILING" ]] && PROFILING_PARAM="--profiling $INPUT_PROFILING"
[[ ! -z "$INPUT_BOM" ]] && BOM_PARAM="-m $INPUT_PROFILING"
[[ ! -z "$INPUT_INCLUDE_QUERIES" ]] && INCLUDE_QUERIES_PARAM="-i $INPUT_PROFILING"
[[ ! -z "$INPUT_DISABLE_SECRETS" ]] && DISABLE_SECRETS_PARAM="--disable-secrets"
[[ ! -z "$INPUT_DISABLE_FULL_DESCRIPTIONS" ]] && DISABLE_FULL_DESCRIPTIONS_PARAM="--disable-full-descriptions"
[[ ! -z "$INPUT_LIBRARIES_PATH" ]] && LIBRARIES_PATH_PARAM="-b $INPUT_LIBRARIES_PATH"
[[ ! -z "$INPUT_SECRETS_REGEXES_PATH" ]] && SECRETS_REGEXES_PATH_PARAM="-r $INPUT_SECRETS_REGEXES_PATH"
[[ ! -z "$INPUT_IGNORE_ON_EXIT" ]] && IGNORE_ON_EXIT_PARAM="--ignore-on-exit $INPUT_IGNORE_ON_EXIT"
[[ ! -z "$INPUT_CLOUD_PROVIDER" ]] && CLOUD_PROVIDER="--cloud-provider $INPUT_CLOUD_PROVIDER"

[[ ! -z "$INPUT_VERBOSE" ]] && VERBOSE_PARAM="-v"

#######################
# Set Queries Path    #
#######################
if [ ! -z "$INPUT_QUERIES" ]; then
    QUERIES_PARAM="-q $INPUT_QUERIES"
else
    QUERIES_PARAM="-q /app/bin/assets/queries"
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
    OUTPUT_PATH_PARAM="-o $INPUT_OUTPUT_PATH"
    CP_PATH=$INPUT_OUTPUT_PATH
else
    OUTPUT_PATH_PARAM="-o ./"
fi

####################
# Run KICS Scan    #
####################
cd $GITHUB_WORKSPACE
echo "${DATETIME} - INF : about to scan directory $INPUT_PATH"
echo "${DATETIME} - INF : kics command kics $INPUT_PARAM $OUTPUT_PATH_PARAM $OUTPUT_FORMATS_PARAM $PLATFORM_TYPE_PARAM $PAYLOAD_PATH_PARAM $CONFIG_PATH_PARAM $EXCLUDE_PATHS_PARAM $EXCLUDE_CATEGORIES_PARAM $EXCLUDE_RESULTS_PARAM $EXCLUDE_SEVERITIES_PARAM $EXCLUDE_QUERIES_PARAM $EXCLUDE_GITIGNORE $QUERIES_PARAM $VERBOSE_PARAM $IGNORE_ON_EXIT_PARAM $FAIL_ON_PARAM $TIMEOUT_PARAM $PROFILING_PARAM $BOM_PARAM $INCLUDE_QUERIES_PARAM $DISABLE_SECRETS_PARAM $DISABLE_FULL_DESCRIPTIONS_PARAM $LIBRARIES_PATH_PARAM $SECRETS_REGEXES_PATH_PARAM $CLOUD_PROVIDER"
/app/bin/kics scan --no-progress $INPUT_PARAM $OUTPUT_PATH_PARAM $OUTPUT_FORMATS_PARAM $PLATFORM_TYPE_PARAM $PAYLOAD_PATH_PARAM $CONFIG_PATH_PARAM $EXCLUDE_PATHS_PARAM $EXCLUDE_CATEGORIES_PARAM $EXCLUDE_RESULTS_PARAM $EXCLUDE_SEVERITIES_PARAM $EXCLUDE_QUERIES_PARAM $EXCLUDE_GITIGNORE $QUERIES_PARAM $VERBOSE_PARAM $IGNORE_ON_EXIT_PARAM $FAIL_ON_PARAM $TIMEOUT_PARAM $PROFILING_PARAM $BOM_PARAM $INCLUDE_QUERIES_PARAM $DISABLE_SECRETS_PARAM $DISABLE_FULL_DESCRIPTIONS_PARAM $LIBRARIES_PATH_PARAM $SECRETS_REGEXES_PATH_PARAM $CLOUD_PROVIDER

export KICS_EXIT_CODE=$?

cp -r "${CP_PATH}" "/app/"

cd /app

# install and run nodejs
apk add --update nodejs npm
npm ci
npm run build --if-present
node dist/index.js

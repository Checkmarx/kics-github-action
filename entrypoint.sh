#!/bin/ash
DATETIME="`date '+%H:%M'`"

if [ -z "$INPUT_PATH" ]
then
      echo "${DATETIME} - ERR input path can't be empty"
      exit 1
else
      INPUT_PARAM="-p $INPUT_PATH"
fi

[[ ! -z "$INPUT_OUTPUT_PATH" ]] && OUTPUT_PATH_PARAM="-o $INPUT_OUTPUT_PATH"
[[ ! -z "$INPUT_PAYLOAD_PATH" ]] && PAYLOAD_PATH_PARAM="-d $INPUT_PAYLOAD_PATH"
[[ ! -z "$INPUT_VERBOSE" ]] && VERBOSE_PARAM="-v"

if [ ! -z "$INPUT_QUERIES" ]
then
    QUERIES_PARAM="-q $INPUT_QUERIES"
else
    QUERIES_PARAM="-q /usr/bin/assets/queries"
fi

cd $GITHUB_WORKSPACE
echo "${DATETIME} - INF : about to scan directory $INPUT_PATH"
echo "${DATETIME} - INF : kics command kics $INPUT_PARAM $OUTPUT_PATH_PARAM $PAYLOAD_PATH_PARAM $QUERIES_PARAM $VERBOSE_PARAM"
/app/bin/kics $INPUT_PARAM $OUTPUT_PATH_PARAM $PAYLOAD_PATH_PARAM $QUERIES_PARAM $VERBOSE_PARAM
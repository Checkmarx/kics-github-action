#!/bin/bash
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

tag=`curl --silent "https://api.github.com/repos/Checkmarx/kics/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'`
echo "${DATETIME} - INF latest tag is $tag"
version=`echo $tag | sed -r 's/^.{1}//'`
echo "${DATETIME} - INF version is $version"

echo "${DATETIME} - INF downloading latest kics binaries kics_${version}_linux_x64.tar.gz"
wget -q -c "https://github.com/Checkmarx/kics/releases/download/${tag}/kics_${version}_linux_x64.tar.gz" -O - | tar -xz --directory /usr/bin &>/dev/null

echo "${DATETIME} - INF : about to scan directory $INPUT_PATH"
kics $INPUT_PARAM $OUTPUT_PATH_PARAM $PAYLOAD_PATH_PARAM $QUERIES_PARAM $VERBOSE_PARAM
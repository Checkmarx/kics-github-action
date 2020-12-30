#!/bin/bash

INPUT_PARAM="-p $INPUT_PATH"

[[ ! -z "$INPUT_OUTPUT_PATH" ]] && OUTPUT_PATH_PARAM="-o $INPUT_OUTPUT_PATH"
[[ ! -z "$INPUT_PAYLOAD_PATH" ]] && PAYLOAD_PATH_PARAM="-d $INPUT_PAYLOAD_PATH"
[[ ! -z "$INPUT_QUERIES" ]] && QUERIES_PARAM="-q $INPUT_QUERIES"
[[ ! -z "$INPUT_VERBOSE" ]] && VERBOSE_PARAM="-v"

tag=`curl --silent "https://api.github.com/repos/Checkmarx/kics/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'`
echo 'latest tag is' $tag
version=`echo $tag | sed -r 's/^.{1}//'`
echo 'version is' $version

echo "Downloading latest kics binaries"
wget -c "https://github.com/Checkmarx/kics/releases/download/${tag}/kics_${version}_linux_x64.tar.gz" -O - | tar -xz

echo "about to scan directory" $INPUT_PATH
./kics $INPUT_PARAM $OUTPUT_PATH_PARAM $PAYLOAD_PATH_PARAM $QUERIES_PARAM $VERBOSE_PARAM
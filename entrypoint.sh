#!/bin/sh -l

tag=`curl --silent "https://api.github.com/repos/Checkmarx/kics/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'`

echo 'latest tag is' $tag

version=`echo $tag | sed -r 's/^.{1}//'`

echo 'version is' $version

echo "Downloading latest kics binaries"

wget -c "https://github.com/Checkmarx/kics/releases/download/${tag}/kics_${version}_linux_x64.tar.gz" -O - | tar -xz

echo "about to scan directory" $INPUT_DIRECTORY

./kics -p $INPUT_DIRECTORY -o results.json
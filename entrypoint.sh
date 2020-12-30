#!/bin/sh -l

echo "Downloading latest kics binaries"

wget -c https://github.com/Checkmarx/kics/releases/latest/download/kics_1.0.0_linux_x64.tar.gz -O - | tar -xz

echo "about to scan directory" $INPUT_DIRECTORY

./kics -p $INPUT_DIRECTORY 
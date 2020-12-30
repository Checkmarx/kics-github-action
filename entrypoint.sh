#!/bin/sh -l

wget -c https://github.com/Checkmarx/kics/releases/latest/download/kics_1.0.0_linux_x64.tar.gz -O - | tar -xz

./kics -p $INPUT_DIRECTORY 
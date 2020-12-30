#!/bin/sh -l

curl "https://github.com/Checkmarx/kics/releases/latest/download/kics_1.0.0_linux_x64.tar.gz" -o kics.tar.gz

ls -la

tar -zxvf kics.tar.gz

chmod +x kics

./kics -p $INPUT_DIRECTORY 
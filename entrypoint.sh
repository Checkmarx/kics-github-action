#!/bin/bash
DATETIME="`date '+%H:%M'`"

echo "about to run kics scan on $INPUTS_PATH"
cd /github/workspace
./app/bin/kics -p $INPUTS_PATH -o $INPUTS.OUTPUT_PATH

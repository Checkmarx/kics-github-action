#!/bin/bash
DATETIME="`date '+%H:%M'`"

./app/bin/kics -p $GITHUB_WORKSPACE/$INPUTS_PATH -o $INPUTS.OUTPUT_PATH
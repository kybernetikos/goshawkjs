#!/usr/bin/env bash

DIRECTORY=`dirname $0`
GOS=~/dev/jsgos/src/goshawkdb.io/server/cmd/goshawkdb/goshawkdb

$GOS -config $DIRECTORY/config.json --wssPort 9999 -cert $DIRECTORY/clusterCert.pem -dir $DIRECTORY/data

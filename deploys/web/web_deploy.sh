#!/bin/sh
sh ./deploys/getOfflineConfig.sh
rm -rf ./dist
npm run build
npm run es5
cp ./deploys/web/CNAME ./dist/CNAME
cd ./dist
surge ./

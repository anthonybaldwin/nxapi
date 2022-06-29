#!/usr/bin/env bash

taskkill //IM "Nintendo Switch Online.exe" //F
rm -rf app/*
rm -rf dist/*
npx tsc
npx rollup --config
node bin/nxapi.js util validate-discord-titles
PACKAGE=`npm --color="always" pack`
mv "$PACKAGE" nxapi.tgz
npx electron-builder build --windows --publish never
mv dist/app/package 
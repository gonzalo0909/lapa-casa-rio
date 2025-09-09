#!/usr/bin/env bash
set -euo pipefail
echo "== Install =="
npm ci
echo "== Predeploy check =="
npm run predeploy
echo "== Done =="

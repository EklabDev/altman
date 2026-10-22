#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=================================================="
echo "          Altman: Local Test Suite Runner         "
echo "=================================================="

# 1. Compile TypeScript tests
echo "[1/2] Compiling TypeScript source and tests..."
npx tsc -p ./

# 2. Run Mocha Unit Tests
echo "[2/2] Running Unit Test Suite (Parsers, Templating, jsrsasign Sandbox, Newman, CodeGen)..."
npx mocha "dist/test/**/*.test.js" --reporter spec

echo ""
echo "✅ All Altman unit tests passed successfully!"

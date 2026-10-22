#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=================================================="
echo "    Altman: Local Package & Install Automation   "
echo "=================================================="

# 1. Compile and Bundle with esbuild
echo "[1/3] Compiling and bundling Altman extension..."
npm run build

# 2. Package into .vsix
echo "[2/3] Packaging into .vsix..."
npx @vscode/vsce package --no-dependencies --allow-missing-repository -o altman-0.1.0.vsix

# 3. Check for VS Code CLI and install
echo "[3/3] Installing into local VS Code..."
if command -v code >/dev/null 2>&1; then
  code --install-extension altman-0.1.0.vsix --force
  echo ""
  echo "✅ Successfully installed Altman into VS Code!"
  echo ""
  echo "To use Altman:"
  echo "1. In VS Code, press Cmd+Shift+P (or Ctrl+Shift+P)"
  echo "2. Type: 'Altman: Open Local API Client' and press Enter"
  echo "3. Or click 'Altman' in the bottom-right status bar"
  echo "4. All collections & environments are stored 100% locally in your workspace's .altman/ folder"
else
  echo "⚠️ 'code' CLI not found in PATH."
  echo "You can manually install the generated VSIX file in VS Code:"
  echo "Extensions View (Cmd+Shift+X) -> '...' menu -> 'Install from VSIX...' -> select $DIR/altman-0.1.0.vsix"
fi

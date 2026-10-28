const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProduction = process.argv.includes('--production');

function copyMonacoAssets() {
  const src = path.join(__dirname, 'node_modules/monaco-editor/min/vs');
  const dest = path.join(__dirname, 'media/monaco/vs');
  if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log('Monaco assets synchronized to media/monaco/vs');
  }
}

async function build() {
  try {
    copyMonacoAssets();
    await esbuild.build({
      entryPoints: ['src/extension.ts'],
      bundle: true,
      outfile: 'dist/extension.js',
      external: ['vscode'],
      format: 'cjs',
      platform: 'node',
      target: 'node18',
      sourcemap: !isProduction,
      minify: isProduction,
      logLevel: 'info',
    });
    console.log('Build finished successfully.');
  } catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
  }
}

build();


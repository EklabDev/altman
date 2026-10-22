const esbuild = require('esbuild');

const isProduction = process.argv.includes('--production');

async function build() {
  try {
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

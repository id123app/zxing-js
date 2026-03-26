import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import resolve from '@rollup/plugin-node-resolve';

// Resolve zxing-wasm package root robustly by walking up from the resolved
// entry until we find the directory containing its package.json.
// This avoids brittle hard-coded directory depth assumptions.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const cjsReaderPath = require.resolve('zxing-wasm/reader');

function findPackageRootSync(startPath) {
  let dir = path.dirname(startPath);
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'zxing-wasm') return dir;
      } catch { /* continue searching */ }
    }
    dir = path.dirname(dir);
  }
  throw new Error('Could not find zxing-wasm package root from ' + startPath);
}

const pkgRoot = findPackageRootSync(cjsReaderPath);
const zxingWasmReaderPath = path.join(pkgRoot, 'dist/es/reader/index.js');

export default {
  input: 'dist/es2015/index.js',
  external: [
    '@zxing/text-encoding',
    // zxing-wasm is bundled (not external) so UMD works without separate script loading
  ],
  plugins: [
    // Explicitly resolve zxing-wasm/reader (older Rollup resolver may not support package exports)
    {
      resolveId(source) {
        if (source === 'zxing-wasm/reader') {
          return zxingWasmReaderPath;
        }
      },
    },
    resolve({
      // Don't prefer Node.js built-ins over bundled/browser versions (externals are controlled via `external` above)
      preferBuiltins: false,
    }),
  ],
  context: '(globalThis || global || self || window || undefined)',
  output: {
    format: 'umd',
    name: 'ZXing',
    sourcemap: true,
    file: 'dist/umd/index.js',
    // UMD doesn't support code splitting; zxing-wasm is bundled so users don't need a separate script.
    // Trade-off: larger bundle for all UMD users. Use ESM build for tree-shaking if bundle size matters.
    inlineDynamicImports: true,
  },
};

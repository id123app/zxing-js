import path from 'path';
import { createRequire } from 'module';
import resolve from '@rollup/plugin-node-resolve';

// Use Node resolution to find package (works with Yarn PnP, pnpm, etc.)
// Note: zxing-wasm exports don't expose package.json, so we derive pkg root from the CJS reader path.
// Structure: node_modules/zxing-wasm/dist/cjs/reader/index.js -> 4 dirnames to reach pkg root.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const cjsReaderPath = require.resolve('zxing-wasm/reader');
const pkgRoot = path.dirname(path.dirname(path.dirname(path.dirname(cjsReaderPath))));
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

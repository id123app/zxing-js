import path from 'path';
import resolve from '@rollup/plugin-node-resolve';

const zxingWasmReaderPath = path.resolve(process.cwd(), 'node_modules/zxing-wasm/dist/es/reader/index.js');

export default {
  input: 'dist/es2015/index.js',
  external: [
    '@zxing/text-encoding',
    // Note: zxing-wasm is NOT external - it will be bundled so npm install works seamlessly
  ],
  plugins: [
    // Explicitly resolve zxing-wasm/reader (older resolve may not support package exports)
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
    // Inline dynamic imports for UMD format (UMD doesn't support code splitting)
    inlineDynamicImports: true,
  },
};

import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'dist/es2015/index.js',
  external: [
    '@zxing/text-encoding',
    'zxing-wasm/reader', // External: users must load zxing-wasm separately in browser
    'zxing-wasm', // Also mark base package as external
  ],
  plugins: [
    resolve({
      // Don't try to resolve external dependencies
      preferBuiltins: false,
    }),
  ],
  context: '(globalThis || global || self || window || undefined)',
  output: {
    format: 'umd',
    name: 'ZXing',
    sourcemap: true,
    file: 'dist/umd/index.js',
    // Prevent code splitting for UMD format
    inlineDynamicImports: false,
  },
};

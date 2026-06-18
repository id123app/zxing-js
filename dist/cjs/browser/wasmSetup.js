"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureWasmPrepared = ensureWasmPrepared;
var reader_1 = require("zxing-wasm/reader");
// Override the default locateFile to prevent external CDN calls (fastly.jsdelivr.net).
// Resolve the WASM binary relative to this script's location. The UMD bundle lives at
// node_modules/zxing-js/dist/umd/index.js and the WASM binary at
// node_modules/zxing-wasm/dist/reader/zxing_reader.wasm.
var _scriptSrc = (typeof document !== 'undefined' && document.currentScript instanceof HTMLScriptElement)
    ? document.currentScript.src
    : '';
var _prepared = false;
/**
 * Ensures prepareZXingModule is called exactly once, regardless of how many
 * reader modules import this helper.
 */
function ensureWasmPrepared() {
    if (_prepared)
        return;
    _prepared = true;
    (0, reader_1.prepareZXingModule)({
        overrides: {
            locateFile: function (path, _prefix) {
                if (_scriptSrc && path.endsWith('.wasm')) {
                    // Use URL to properly resolve ../../../ relative to the script location
                    return new URL('../../../zxing-wasm/dist/reader/' + path, _scriptSrc).href;
                }
                return _prefix + path;
            },
        },
    });
}
// Prepare on first import
ensureWasmPrepared();

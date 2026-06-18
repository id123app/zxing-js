"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserQRCodeReader = void 0;
var BrowserCodeReader_1 = require("./BrowserCodeReader");
var QRCodeReader_1 = require("../core/qrcode/QRCodeReader");
var BarcodeFormat_1 = require("../core/BarcodeFormat");
var NotFoundException_1 = require("../core/NotFoundException");
var Result_1 = require("../core/Result");
var ResultPoint_1 = require("../core/ResultPoint");
// Import zxing-wasm - will be bundled in UMD builds
var reader_1 = require("zxing-wasm/reader");
// Ensure WASM locateFile override is configured exactly once
require("./wasmSetup");
var BrowserQRCodeReader = /** @class */ (function (_super) {
    __extends(BrowserQRCodeReader, _super);
    /**
     * Creates an instance of BrowserQRCodeReader.
     *
     * You can construct this class in two ways:
     * - `new BrowserQRCodeReader(timeBetweenScansMillis?)`
     * - `new BrowserQRCodeReader(options?)`
     *
     * When a `number` is provided, it is treated as the time delay between subsequent
     * decode attempts, in milliseconds.
     *
     * When an `options` object is provided, it may contain:
     * - `timeBetweenScansMillis?: number` — time delay between subsequent decode tries (default: `500`).
     * - `useWasm?: boolean` — whether to prefer the WASM-based reader when available (default: `true`).
     *
     * Note: WASM auto-detection is triggered on construction.
     *
     * @param {number | { timeBetweenScansMillis?: number; useWasm?: boolean }} [timeBetweenScansMillisOrOptions=500]
     *        Either the time delay between subsequent decode tries, or an options object.
     */
    function BrowserQRCodeReader(timeBetweenScansMillisOrOptions) {
        if (timeBetweenScansMillisOrOptions === void 0) { timeBetweenScansMillisOrOptions = 500; }
        var _this = this;
        var _a;
        var timeBetweenScansMillis = typeof timeBetweenScansMillisOrOptions === 'number'
            ? timeBetweenScansMillisOrOptions
            : ((_a = timeBetweenScansMillisOrOptions.timeBetweenScansMillis) !== null && _a !== void 0 ? _a : 500);
        _this = _super.call(this, new QRCodeReader_1.default(), timeBetweenScansMillis) || this;
        // Auto-detect WASM on construction
        BrowserQRCodeReader.autoDetectWasm();
        // If useWasm is explicitly set, use it. Otherwise, default to true (will try WASM first)
        _this.useWasm =
            typeof timeBetweenScansMillisOrOptions === 'number'
                ? true // Default to trying WASM first
                : (timeBetweenScansMillisOrOptions.useWasm !== undefined
                    ? Boolean(timeBetweenScansMillisOrOptions.useWasm)
                    : true); // Default to trying WASM first
        return _this;
    }
    /**
     * Clears the manually injected WASM module (if any) so it can be garbage collected.
     * Does not affect the statically imported or bundled zxing-wasm reader, which cannot be reset.
     * Use this when you injected a module via injectWasmReader() and want to release it.
     *
     * Note: Existing instances will re-check WASM availability on their next decodeAsync() call.
     */
    BrowserQRCodeReader.resetWasm = function () {
        BrowserQRCodeReader.wasmReaderModule = null;
    };
    /**
     * Manually inject zxing-wasm module for browser environments.
     * Call this before using WASM mode if zxing-wasm is loaded separately.
     *
     * Note: This method clears any previous load error since a successful injection
     * indicates the error is no longer relevant. All existing instances will re-check
     * WASM availability on their next decodeAsync() call.
     *
     * @param module - Object containing the readBarcodes function from zxing-wasm
     * @throws Error if module or module.readBarcodes is invalid
     *
     * @example
     * // After loading zxing-wasm via script tag or npm:
     * import { readBarcodes } from 'zxing-wasm/reader'; // npm install zxing-wasm
     * BrowserQRCodeReader.injectWasmReader({ readBarcodes });
     */
    BrowserQRCodeReader.injectWasmReader = function (module) {
        if (!module) {
            throw new Error('injectWasmReader: module parameter is required');
        }
        if (typeof module.readBarcodes !== 'function') {
            throw new Error('injectWasmReader: module.readBarcodes must be a function');
        }
        BrowserQRCodeReader.wasmReaderModule = module;
    };
    /**
     * Validate that a candidate WASM module has the expected shape.
     * Prevents accepting arbitrary objects from the global scope.
     */
    BrowserQRCodeReader.isValidWasmModule = function (candidate) {
        if (candidate == null || typeof candidate !== 'object')
            return false;
        var mod = candidate;
        return typeof mod.readBarcodes === 'function';
    };
    /**
     * Auto-detect and inject WASM if available from global variables.
     */
    BrowserQRCodeReader.autoDetectWasm = function () {
        if (BrowserQRCodeReader.wasmReaderModule) {
            return; // Already injected, skip to avoid redundant work
        }
        // Check for ZXingWASM global (from script tag)
        if (typeof window !== 'undefined' && window.ZXingWASM) {
            var globalZXingWASM = window.ZXingWASM;
            if (BrowserQRCodeReader.isValidWasmModule(globalZXingWASM)) {
                try {
                    BrowserQRCodeReader.injectWasmReader({ readBarcodes: globalZXingWASM.readBarcodes });
                }
                catch (e) {
                    // If injection fails, silently continue — WASM is optional
                }
            }
        }
    };
    /**
     * Check if WASM is available (without throwing).
     *
     * @returns true if WASM is available, false otherwise
     */
    BrowserQRCodeReader.isWasmAvailable = function () {
        BrowserQRCodeReader.autoDetectWasm();
        var reader = BrowserQRCodeReader.getWasmReader();
        return reader !== null;
    };
    BrowserQRCodeReader.getWasmReader = function () {
        // Strategy 1: Check if manually injected (highest priority)
        if (BrowserQRCodeReader.wasmReaderModule) {
            return BrowserQRCodeReader.wasmReaderModule;
        }
        // Strategy 2: Use imported npm package (bundled in UMD, or available in ES modules)
        if (typeof reader_1.readBarcodes === 'function') {
            return { readBarcodes: reader_1.readBarcodes };
        }
        // Strategy 3: Try global variable (from script tag - fallback)
        if (typeof window !== 'undefined') {
            var globalZXingWASM = window.ZXingWASM;
            if (BrowserQRCodeReader.isValidWasmModule(globalZXingWASM)) {
                return { readBarcodes: globalZXingWASM.readBarcodes };
            }
        }
        return null;
    };
    BrowserQRCodeReader.prototype.decodeAsync = function (element) {
        return __awaiter(this, void 0, void 0, function () {
            var wasmReader, canvas, ctx, elementType, imageData, expectedLength, wasmReadBarcodes, options, results, readBarcodesResult, isPromise, _a, callError_1, resultsArray, first, decodedText, points, safePoints, e_1;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        // Check WASM availability
                        BrowserQRCodeReader.autoDetectWasm();
                        wasmReader = BrowserQRCodeReader.getWasmReader();
                        // If WASM is disabled or not available, use regular decode
                        if (!this.useWasm || !wasmReader) {
                            return [2 /*return*/, _super.prototype.decodeAsync.call(this, element)];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 8, , 9]);
                        canvas = this.getCaptureCanvas(element);
                        ctx = this.getCaptureCanvasContext(element);
                        // Validate canvas and context are available
                        if (!canvas || !ctx) {
                            throw new Error('Failed to get capture canvas or context');
                        }
                        // Validate element is ready before attempting to draw
                        if (element instanceof HTMLVideoElement) {
                            // Check if video is ready (readyState >= 2 means HAVE_CURRENT_DATA - enough data loaded for current frame)
                            // readyState values: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
                            // We require at least HAVE_CURRENT_DATA (2) to ensure we can capture a valid frame
                            if (element.readyState < 2) {
                                throw new Error("Video element is not ready for capture (readyState: ".concat(element.readyState, ", required: >= 2)"));
                            }
                            // Also check video dimensions are valid
                            if (!element.videoWidth || !element.videoHeight) {
                                throw new Error("Video element has invalid dimensions: ".concat(element.videoWidth, "x").concat(element.videoHeight));
                            }
                            // Draw frame on canvas - can throw SecurityError if canvas is tainted (CORS issue)
                            // Pass ctx explicitly to ensure it's initialized
                            try {
                                this.drawFrameOnCanvas(element, undefined, ctx);
                            }
                            catch (drawError) {
                                throw new Error("Failed to draw video frame on canvas: ".concat(drawError instanceof Error ? drawError.message : String(drawError)));
                            }
                        }
                        else if (element instanceof HTMLImageElement) {
                            // Check if image is loaded and has valid dimensions
                            if (!element.complete) {
                                throw new Error('Image element is not fully loaded (complete: false)');
                            }
                            if (!element.naturalWidth || !element.naturalHeight) {
                                throw new Error("Image element has invalid dimensions: ".concat(element.naturalWidth, "x").concat(element.naturalHeight));
                            }
                            // Draw image on canvas - can throw SecurityError if canvas is tainted (CORS issue)
                            // Pass ctx explicitly to ensure it's initialized
                            try {
                                this.drawImageOnCanvas(element, undefined, ctx);
                            }
                            catch (drawError) {
                                throw new Error("Failed to draw image on canvas: ".concat(drawError instanceof Error ? drawError.message : String(drawError)));
                            }
                        }
                        else {
                            elementType = ((_b = element.constructor) === null || _b === void 0 ? void 0 : _b.name) || typeof element;
                            throw new Error("Unsupported element type: ".concat(elementType));
                        }
                        // Validate canvas dimensions
                        if (canvas.width <= 0 || canvas.height <= 0) {
                            throw new Error("Invalid canvas dimensions: ".concat(canvas.width, "x").concat(canvas.height));
                        }
                        imageData = void 0;
                        try {
                            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        }
                        catch (getImageDataError) {
                            if (getImageDataError instanceof DOMException && getImageDataError.name === 'SecurityError') {
                                throw getImageDataError;
                            }
                            throw new Error("Failed to get image data from canvas: ".concat(getImageDataError instanceof Error ? getImageDataError.message : String(getImageDataError)));
                        }
                        // Validate imageData is available and has expected structure
                        if (!imageData || !imageData.data) {
                            throw new Error('Failed to get image data from canvas');
                        }
                        expectedLength = canvas.width * canvas.height * 4;
                        if (imageData.data.length !== expectedLength) {
                            throw new Error("ImageData length mismatch: expected ".concat(expectedLength, ", got ").concat(imageData.data.length));
                        }
                        wasmReadBarcodes = wasmReader.readBarcodes;
                        options = {
                            formats: ['QRCode'],
                            tryHarder: true,
                            tryRotate: true,
                            tryInvert: true,
                            maxNumberOfSymbols: 1,
                        };
                        results = void 0;
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 6, , 7]);
                        readBarcodesResult = wasmReadBarcodes(imageData, options);
                        isPromise = readBarcodesResult != null &&
                            typeof readBarcodesResult === 'object' &&
                            typeof readBarcodesResult.then === 'function';
                        if (!isPromise) return [3 /*break*/, 4];
                        return [4 /*yield*/, readBarcodesResult];
                    case 3:
                        _a = _c.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = readBarcodesResult;
                        _c.label = 5;
                    case 5:
                        results = _a;
                        return [3 /*break*/, 7];
                    case 6:
                        callError_1 = _c.sent();
                        throw new Error("Failed to call zxing-wasm readBarcodes: ".concat(callError_1 instanceof Error ? callError_1.message : String(callError_1)));
                    case 7:
                        // Validate results structure
                        if (!results) {
                            throw new NotFoundException_1.default();
                        }
                        resultsArray = Array.isArray(results) ? results : [results];
                        if (resultsArray.length === 0) {
                            throw new NotFoundException_1.default();
                        }
                        first = resultsArray[0];
                        if (!first || typeof first !== 'object') {
                            throw new NotFoundException_1.default();
                        }
                        // Check if result is valid
                        if (!first.isValid) {
                            // If result has an error, throw NotFoundException to trigger fallback
                            throw new NotFoundException_1.default();
                        }
                        // Validate text exists (null/undefined), but allow empty strings as valid QR code results
                        if (first.text === null || first.text === undefined || typeof first.text !== 'string') {
                            throw new NotFoundException_1.default();
                        }
                        decodedText = first.text;
                        points = BrowserQRCodeReader.extractResultPoints(first);
                        safePoints = points !== null && points !== void 0 ? points : [];
                        return [2 /*return*/, new Result_1.default(decodedText, null, 0, safePoints, BarcodeFormat_1.default.QR_CODE)];
                    case 8:
                        e_1 = _c.sent();
                        // If WASM fails with a "not found" result, propagate the NotFoundException.
                        // This matches the base behavior and avoids a second decode attempt on the same frame.
                        if (e_1 instanceof NotFoundException_1.default) {
                            throw e_1; // Re-throw NotFoundException - it's expected and does not trigger fallback
                        }
                        // Canvas tainted by cross-origin content: falling back would hit the same tainted
                        // canvas and throw an unhelpful SecurityError, so surface a descriptive error instead.
                        if (e_1 instanceof DOMException && e_1.name === 'SecurityError') {
                            this.captureCanvas = undefined;
                            this.captureCanvasContext = undefined;
                            throw new Error('Canvas is tainted and cannot be read (CORS issue). Ensure images have proper CORS headers.');
                        }
                        // For any other error (WASM load failure, API mismatch, etc.), fall back
                        // to the regular TypeScript-based decoder for backward compatibility.
                        return [2 /*return*/, _super.prototype.decodeAsync.call(this, element)];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Extract ResultPoint array from zxing-wasm result if position data is available and valid
     */
    BrowserQRCodeReader.extractResultPoints = function (result) {
        if (!result.position) {
            return null;
        }
        var _a = result.position, topLeft = _a.topLeft, topRight = _a.topRight, bottomRight = _a.bottomRight, bottomLeft = _a.bottomLeft;
        // Validate that all required position points exist, have x/y coordinates, and are finite numbers
        if (!topLeft || !topRight || !bottomRight || !bottomLeft ||
            typeof topLeft.x !== 'number' || !Number.isFinite(topLeft.x) ||
            typeof topLeft.y !== 'number' || !Number.isFinite(topLeft.y) ||
            typeof topRight.x !== 'number' || !Number.isFinite(topRight.x) ||
            typeof topRight.y !== 'number' || !Number.isFinite(topRight.y) ||
            typeof bottomRight.x !== 'number' || !Number.isFinite(bottomRight.x) ||
            typeof bottomRight.y !== 'number' || !Number.isFinite(bottomRight.y) ||
            typeof bottomLeft.x !== 'number' || !Number.isFinite(bottomLeft.x) ||
            typeof bottomLeft.y !== 'number' || !Number.isFinite(bottomLeft.y)) {
            return null;
        }
        return [
            new ResultPoint_1.default(topLeft.x, topLeft.y),
            new ResultPoint_1.default(topRight.x, topRight.y),
            new ResultPoint_1.default(bottomRight.x, bottomRight.y),
            new ResultPoint_1.default(bottomLeft.x, bottomLeft.y),
        ];
    };
    BrowserQRCodeReader.wasmReaderModule = null;
    return BrowserQRCodeReader;
}(BrowserCodeReader_1.BrowserCodeReader));
exports.BrowserQRCodeReader = BrowserQRCodeReader;

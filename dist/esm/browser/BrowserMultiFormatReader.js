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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var _a;
import { BrowserCodeReader } from './BrowserCodeReader';
import MultiFormatReader from '../core/MultiFormatReader';
import BarcodeFormat from '../core/BarcodeFormat';
import DecodeHintType from '../core/DecodeHintType';
import NotFoundException from '../core/NotFoundException';
import Result from '../core/Result';
import ResultPoint from '../core/ResultPoint';
// Import zxing-wasm - will be bundled in UMD builds
import { readBarcodes } from 'zxing-wasm/reader';
// Ensure WASM locateFile override is configured exactly once
import './wasmSetup';
import { DEFAULT_LINEAR_FORMATS, hasValidLinearGeometry, } from './internal/wasmLinearGeometry';
/** Mapping from zxing-wasm format strings to BarcodeFormat enum values */
var WASM_FORMAT_TO_BARCODE_FORMAT = {
    'Aztec': BarcodeFormat.AZTEC,
    'Codabar': BarcodeFormat.CODABAR,
    'Code39': BarcodeFormat.CODE_39,
    'Code93': BarcodeFormat.CODE_93,
    'Code128': BarcodeFormat.CODE_128,
    'DataBar': BarcodeFormat.RSS_14,
    'DataBarExpanded': BarcodeFormat.RSS_EXPANDED,
    'DataMatrix': BarcodeFormat.DATA_MATRIX,
    'EAN-8': BarcodeFormat.EAN_8,
    'EAN-13': BarcodeFormat.EAN_13,
    'ITF': BarcodeFormat.ITF,
    'PDF417': BarcodeFormat.PDF_417,
    'QRCode': BarcodeFormat.QR_CODE,
    'UPC-A': BarcodeFormat.UPC_A,
    'UPC-E': BarcodeFormat.UPC_E,
};
/** Mapping from BarcodeFormat enum to zxing-wasm format strings */
var BARCODE_FORMAT_TO_WASM = (_a = {},
    _a[BarcodeFormat.AZTEC] = 'Aztec',
    _a[BarcodeFormat.CODABAR] = 'Codabar',
    _a[BarcodeFormat.CODE_39] = 'Code39',
    _a[BarcodeFormat.CODE_93] = 'Code93',
    _a[BarcodeFormat.CODE_128] = 'Code128',
    _a[BarcodeFormat.RSS_14] = 'DataBar',
    _a[BarcodeFormat.RSS_EXPANDED] = 'DataBarExpanded',
    _a[BarcodeFormat.DATA_MATRIX] = 'DataMatrix',
    _a[BarcodeFormat.EAN_8] = 'EAN-8',
    _a[BarcodeFormat.EAN_13] = 'EAN-13',
    _a[BarcodeFormat.ITF] = 'ITF',
    _a[BarcodeFormat.PDF_417] = 'PDF417',
    _a[BarcodeFormat.QR_CODE] = 'QRCode',
    _a[BarcodeFormat.UPC_A] = 'UPC-A',
    _a[BarcodeFormat.UPC_E] = 'UPC-E',
    _a);
/**
 * Default max pixel dimension for WASM processing. Frames larger than this are
 * downscaled before passing to readBarcodes, dramatically improving
 * frame rate (and thus detection reliability) for live camera feeds.
 * 640px is sufficient for all common barcode types from camera.
 */
var DEFAULT_WASM_MAX_DIMENSION = 640;
var BrowserMultiFormatReader = /** @class */ (function (_super) {
    __extends(BrowserMultiFormatReader, _super);
    /**
     * @param hints Decode hints (e.g. POSSIBLE_FORMATS)
     * @param timeBetweenScansMillis Delay between decode attempts (default 500)
     * @param wasmMaxDimension Max pixel dimension before downscaling for WASM (default 640).
     *        Increase for high-density barcodes, decrease for faster processing on slow devices.
     */
    function BrowserMultiFormatReader(hints, timeBetweenScansMillis, wasmMaxDimension) {
        if (hints === void 0) { hints = null; }
        if (timeBetweenScansMillis === void 0) { timeBetweenScansMillis = 500; }
        if (wasmMaxDimension === void 0) { wasmMaxDimension = DEFAULT_WASM_MAX_DIMENSION; }
        var _this = this;
        var reader = new MultiFormatReader();
        reader.setHints(hints);
        _this = _super.call(this, reader, timeBetweenScansMillis, hints) || this;
        /** Cached downscale canvas for WASM processing */
        _this._wasmCanvas = null;
        _this._wasmCtx = null;
        _this._wasmMaxDimension = wasmMaxDimension > 0 ? wasmMaxDimension : DEFAULT_WASM_MAX_DIMENSION;
        return _this;
    }
    Object.defineProperty(BrowserMultiFormatReader.prototype, "hints", {
        get: function () {
            return this._hints;
        },
        set: function (hints) {
            this._hints = hints || null;
            // Since we don't pass the hints in `decodeBitmap` as other Browser readers do, we need to set them here.
            this.reader.setHints(hints);
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Overwrite decodeBitmap to call decodeWithState, which will pay
     * attention to the hints set in the constructor function
     */
    BrowserMultiFormatReader.prototype.decodeBitmap = function (binaryBitmap) {
        try {
            return this.reader.decodeWithState(binaryBitmap);
        }
        finally {
            // Readers need to be reset before being reused on another bitmap.
            this.reader.reset();
        }
    };
    /**
     * Get the zxing-wasm format strings based on POSSIBLE_FORMATS hint.
     * Returns undefined to scan all formats when no specific formats are set.
     */
    BrowserMultiFormatReader.prototype.getWasmFormats = function () {
        var e_1, _a;
        var hints = this._hints;
        if (!hints)
            return undefined;
        var possibleFormats = hints.get(DecodeHintType.POSSIBLE_FORMATS);
        if (!possibleFormats || possibleFormats.length === 0)
            return undefined;
        var wasmFormats = [];
        try {
            for (var possibleFormats_1 = __values(possibleFormats), possibleFormats_1_1 = possibleFormats_1.next(); !possibleFormats_1_1.done; possibleFormats_1_1 = possibleFormats_1.next()) {
                var format = possibleFormats_1_1.value;
                var wf = BARCODE_FORMAT_TO_WASM[format];
                if (wf)
                    wasmFormats.push(wf);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (possibleFormats_1_1 && !possibleFormats_1_1.done && (_a = possibleFormats_1.return)) _a.call(possibleFormats_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return wasmFormats.length > 0 ? wasmFormats : undefined;
    };
    /**
     * Get or create a downscaled canvas for WASM processing.
     * Reuses the canvas if dimensions haven't changed.
     */
    BrowserMultiFormatReader.prototype.getWasmCanvas = function (srcWidth, srcHeight) {
        var maxDim = Math.max(srcWidth, srcHeight);
        var scale = maxDim > this._wasmMaxDimension ? this._wasmMaxDimension / maxDim : 1;
        var dstWidth = Math.round(srcWidth * scale);
        var dstHeight = Math.round(srcHeight * scale);
        if (!this._wasmCanvas || this._wasmCanvas.width !== dstWidth || this._wasmCanvas.height !== dstHeight) {
            if (typeof document === 'undefined')
                return null;
            this._wasmCanvas = document.createElement('canvas');
            this._wasmCanvas.width = dstWidth;
            this._wasmCanvas.height = dstHeight;
            try {
                this._wasmCtx = this._wasmCanvas.getContext('2d', { willReadFrequently: true });
            }
            catch (_a) {
                this._wasmCtx = this._wasmCanvas.getContext('2d');
            }
        }
        return { canvas: this._wasmCanvas, ctx: this._wasmCtx, scale: scale };
    };
    /**
     * WASM-backed async decode. Uses zxing-wasm readBarcodes for fast multi-format
     * barcode detection. Pre-downscales large frames for faster processing.
     * Falls back to the pure TypeScript decoder if WASM is unavailable.
     */
    BrowserMultiFormatReader.prototype.decodeAsync = function (element) {
        return __awaiter(this, void 0, void 0, function () {
            var possibleFormatsHint, callerProvidedFormatsHint, hasUnmappableHintedFormat, srcWidth, srcHeight, wasm, canvas, ctx, scale, imageData_1, wasmFormats, noMappableSubset, baseOptions_1, runWasm, isValidResult, results, first, barcodeFormat, points, e_2;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (typeof readBarcodes !== 'function') {
                            return [2 /*return*/, _super.prototype.decodeAsync.call(this, element)];
                        }
                        possibleFormatsHint = (_a = this._hints) === null || _a === void 0 ? void 0 : _a.get(DecodeHintType.POSSIBLE_FORMATS);
                        callerProvidedFormatsHint = Array.isArray(possibleFormatsHint) && possibleFormatsHint.length > 0;
                        hasUnmappableHintedFormat = callerProvidedFormatsHint &&
                            possibleFormatsHint.some(function (fmt) { return BARCODE_FORMAT_TO_WASM[fmt] === undefined; });
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 7, , 8]);
                        srcWidth = void 0;
                        srcHeight = void 0;
                        if (element instanceof HTMLVideoElement) {
                            if (element.readyState < 2) {
                                throw new Error("Video not ready (readyState: ".concat(element.readyState, ")"));
                            }
                            srcWidth = element.videoWidth;
                            srcHeight = element.videoHeight;
                            if (!srcWidth || !srcHeight) {
                                throw new Error("Invalid video dimensions: ".concat(srcWidth, "x").concat(srcHeight));
                            }
                        }
                        else if (element instanceof HTMLImageElement) {
                            if (!element.complete) {
                                throw new Error('Image not loaded');
                            }
                            srcWidth = element.naturalWidth || element.width;
                            srcHeight = element.naturalHeight || element.height;
                            if (!srcWidth || !srcHeight) {
                                throw new Error("Invalid image dimensions");
                            }
                        }
                        else {
                            throw new Error('Unsupported element type');
                        }
                        wasm = this.getWasmCanvas(srcWidth, srcHeight);
                        if (!wasm || !wasm.ctx) {
                            throw new Error('Failed to create WASM canvas');
                        }
                        canvas = wasm.canvas, ctx = wasm.ctx, scale = wasm.scale;
                        // Validate dimensions before drawing
                        if (canvas.width <= 0 || canvas.height <= 0) {
                            throw new Error("Invalid WASM canvas dimensions: ".concat(canvas.width, "x").concat(canvas.height));
                        }
                        // Draw element scaled down onto the WASM canvas
                        ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
                        imageData_1 = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        if (!imageData_1 || !imageData_1.data) {
                            throw new Error('Failed to get image data');
                        }
                        wasmFormats = this.getWasmFormats();
                        noMappableSubset = !wasmFormats || wasmFormats.length === 0;
                        if (callerProvidedFormatsHint && noMappableSubset) {
                            return [2 /*return*/, _super.prototype.decodeAsync.call(this, element)];
                        }
                        baseOptions_1 = {
                            tryHarder: true,
                            tryRotate: false,
                            tryInvert: false,
                            tryDownscale: false,
                            maxNumberOfSymbols: 1,
                        };
                        runWasm = function (formats) { return __awaiter(_this, void 0, void 0, function () {
                            var raw, isPromise, resolved, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        raw = readBarcodes(imageData_1, __assign(__assign({}, baseOptions_1), { formats: formats }));
                                        isPromise = raw != null && typeof raw === 'object' && typeof raw.then === 'function';
                                        if (!isPromise) return [3 /*break*/, 2];
                                        return [4 /*yield*/, raw];
                                    case 1:
                                        _a = _b.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _a = raw;
                                        _b.label = 3;
                                    case 3:
                                        resolved = _a;
                                        // readBarcodes may return either an array of results or, in some
                                        // bindings, a single result object. Normalize both to an array so
                                        // downstream code can treat the shape uniformly. Anything else
                                        // (null/undefined/primitive) is treated as no result.
                                        if (Array.isArray(resolved))
                                            return [2 /*return*/, resolved];
                                        if (resolved && typeof resolved === 'object')
                                            return [2 /*return*/, [resolved]];
                                        return [2 /*return*/, []];
                                }
                            });
                        }); };
                        isValidResult = function (r) {
                            return r.length > 0 && !!r[0] && r[0].isValid &&
                                typeof r[0].text === 'string' &&
                                WASM_FORMAT_TO_BARCODE_FORMAT[r[0].format] !== undefined;
                        };
                        results = void 0;
                        if (!wasmFormats) return [3 /*break*/, 3];
                        return [4 /*yield*/, runWasm(wasmFormats)];
                    case 2:
                        results = _b.sent();
                        return [3 /*break*/, 6];
                    case 3: return [4 /*yield*/, runWasm(['Matrix-Codes'])];
                    case 4:
                        results = _b.sent();
                        if (!!isValidResult(results)) return [3 /*break*/, 6];
                        return [4 /*yield*/, runWasm(DEFAULT_LINEAR_FORMATS)];
                    case 5:
                        results = _b.sent();
                        _b.label = 6;
                    case 6:
                        if (results.length === 0)
                            throw new NotFoundException();
                        first = results[0];
                        if (!first || !first.isValid)
                            throw new NotFoundException();
                        if (first.text === null || first.text === undefined || typeof first.text !== 'string') {
                            throw new NotFoundException();
                        }
                        barcodeFormat = WASM_FORMAT_TO_BARCODE_FORMAT[first.format];
                        if (barcodeFormat === undefined) {
                            throw new NotFoundException();
                        }
                        // Reject 1D results whose detection box is roughly square or heavily skewed.
                        // These are noise-driven false positives from 2D module patterns (the QR code
                        // case the demo surfaced). Real 1D barcodes pointed at the camera form a
                        // visibly elongated, near-rectangular detection box.
                        //
                        // Only validate when the caller did NOT provide a POSSIBLE_FORMATS hint. When
                        // the caller has explicitly opted into a format set, trust them: this allows
                        // legitimately square or tall codes (e.g., stacked DataBar Expanded) to decode
                        // under an explicit hint without being rejected by the default-scan heuristic.
                        // Use the raw hint presence rather than `wasmFormats`, because `wasmFormats`
                        // can also be undefined when POSSIBLE_FORMATS is set but contains only formats
                        // that have no zxing-wasm mapping (e.g., MAXICODE).
                        if (!callerProvidedFormatsHint && !hasValidLinearGeometry(first)) {
                            throw new NotFoundException();
                        }
                        points = BrowserMultiFormatReader.extractResultPoints(first, scale);
                        return [2 /*return*/, new Result(first.text, null, 0, points !== null && points !== void 0 ? points : [], barcodeFormat)];
                    case 7:
                        e_2 = _b.sent();
                        if (e_2 instanceof NotFoundException) {
                            // When the caller's POSSIBLE_FORMATS hint includes formats the WASM
                            // layer cannot decode (e.g., MAXICODE), give the TS decoder a chance
                            // to handle them before propagating. The TS MultiFormatReader honors
                            // the full hint set.
                            if (hasUnmappableHintedFormat) {
                                return [2 /*return*/, _super.prototype.decodeAsync.call(this, element)];
                            }
                            throw e_2;
                        }
                        // Distinguish security errors (CORS) — these won't be fixed by falling back
                        if (e_2 instanceof DOMException && e_2.name === 'SecurityError') {
                            this._wasmCanvas = null;
                            this._wasmCtx = null;
                            throw new Error('Canvas is tainted (CORS). Ensure media has proper cross-origin headers.');
                        }
                        // For WASM load/runtime errors, fall back to pure TypeScript decoder
                        return [2 /*return*/, _super.prototype.decodeAsync.call(this, element)];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    BrowserMultiFormatReader.prototype.reset = function () {
        _super.prototype.reset.call(this);
        this._wasmCanvas = null;
        this._wasmCtx = null;
    };
    /**
     * Extract ResultPoint array from WASM result, scaling coordinates back
     * to the original video resolution.
     */
    BrowserMultiFormatReader.extractResultPoints = function (result, scale) {
        if (!result.position)
            return null;
        var _a = result.position, topLeft = _a.topLeft, topRight = _a.topRight, bottomRight = _a.bottomRight, bottomLeft = _a.bottomLeft;
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
        // Scale points back from downscaled coordinates to original video resolution
        var invScale = 1 / scale;
        return [
            new ResultPoint(topLeft.x * invScale, topLeft.y * invScale),
            new ResultPoint(topRight.x * invScale, topRight.y * invScale),
            new ResultPoint(bottomRight.x * invScale, bottomRight.y * invScale),
            new ResultPoint(bottomLeft.x * invScale, bottomLeft.y * invScale),
        ];
    };
    return BrowserMultiFormatReader;
}(BrowserCodeReader));
export { BrowserMultiFormatReader };

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { BrowserCodeReader } from './BrowserCodeReader';
import QRCodeReader from '../core/qrcode/QRCodeReader';
import BarcodeFormat from '../core/BarcodeFormat';
import NotFoundException from '../core/NotFoundException';
import Result from '../core/Result';
import ResultPoint from '../core/ResultPoint';
// Import zxing-wasm - will be bundled in UMD builds
import { readBarcodes } from 'zxing-wasm/reader';
// Ensure WASM locateFile override is configured exactly once
import './wasmSetup';
export class BrowserQRCodeReader extends BrowserCodeReader {
    /**
     * Clears the manually injected WASM module (if any) so it can be garbage collected.
     * Does not affect the statically imported or bundled zxing-wasm reader, which cannot be reset.
     * Use this when you injected a module via injectWasmReader() and want to release it.
     *
     * Note: Existing instances will re-check WASM availability on their next decodeAsync() call.
     */
    static resetWasm() {
        BrowserQRCodeReader.wasmReaderModule = null;
    }
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
    static injectWasmReader(module) {
        if (!module) {
            throw new Error('injectWasmReader: module parameter is required');
        }
        if (typeof module.readBarcodes !== 'function') {
            throw new Error('injectWasmReader: module.readBarcodes must be a function');
        }
        BrowserQRCodeReader.wasmReaderModule = module;
    }
    /**
     * Validate that a candidate WASM module has the expected shape.
     * Prevents accepting arbitrary objects from the global scope.
     */
    static isValidWasmModule(candidate) {
        if (candidate == null || typeof candidate !== 'object')
            return false;
        const mod = candidate;
        return typeof mod.readBarcodes === 'function';
    }
    /**
     * Auto-detect and inject WASM if available from global variables.
     */
    static autoDetectWasm() {
        if (BrowserQRCodeReader.wasmReaderModule) {
            return; // Already injected, skip to avoid redundant work
        }
        // Check for ZXingWASM global (from script tag)
        if (typeof window !== 'undefined' && window.ZXingWASM) {
            const globalZXingWASM = window.ZXingWASM;
            if (BrowserQRCodeReader.isValidWasmModule(globalZXingWASM)) {
                try {
                    BrowserQRCodeReader.injectWasmReader({ readBarcodes: globalZXingWASM.readBarcodes });
                }
                catch (e) {
                    // If injection fails, silently continue — WASM is optional
                }
            }
        }
    }
    /**
     * Check if WASM is available (without throwing).
     *
     * @returns true if WASM is available, false otherwise
     */
    static isWasmAvailable() {
        BrowserQRCodeReader.autoDetectWasm();
        const reader = BrowserQRCodeReader.getWasmReader();
        return reader !== null;
    }
    static getWasmReader() {
        // Strategy 1: Check if manually injected (highest priority)
        if (BrowserQRCodeReader.wasmReaderModule) {
            return BrowserQRCodeReader.wasmReaderModule;
        }
        // Strategy 2: Use imported npm package (bundled in UMD, or available in ES modules)
        if (typeof readBarcodes === 'function') {
            return { readBarcodes };
        }
        // Strategy 3: Try global variable (from script tag - fallback)
        if (typeof window !== 'undefined') {
            const globalZXingWASM = window.ZXingWASM;
            if (BrowserQRCodeReader.isValidWasmModule(globalZXingWASM)) {
                return { readBarcodes: globalZXingWASM.readBarcodes };
            }
        }
        return null;
    }
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
    constructor(timeBetweenScansMillisOrOptions = 500) {
        var _a;
        const timeBetweenScansMillis = typeof timeBetweenScansMillisOrOptions === 'number'
            ? timeBetweenScansMillisOrOptions
            : ((_a = timeBetweenScansMillisOrOptions.timeBetweenScansMillis) !== null && _a !== void 0 ? _a : 500);
        super(new QRCodeReader(), timeBetweenScansMillis);
        // Auto-detect WASM on construction
        BrowserQRCodeReader.autoDetectWasm();
        // If useWasm is explicitly set, use it. Otherwise, default to true (will try WASM first)
        this.useWasm =
            typeof timeBetweenScansMillisOrOptions === 'number'
                ? true // Default to trying WASM first
                : (timeBetweenScansMillisOrOptions.useWasm !== undefined
                    ? Boolean(timeBetweenScansMillisOrOptions.useWasm)
                    : true); // Default to trying WASM first
    }
    decodeAsync(element) {
        const _super = Object.create(null, {
            decodeAsync: { get: () => super.decodeAsync }
        });
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Check WASM availability
            BrowserQRCodeReader.autoDetectWasm();
            const wasmReader = BrowserQRCodeReader.getWasmReader();
            // If WASM is disabled or not available, use regular decode
            if (!this.useWasm || !wasmReader) {
                return _super.decodeAsync.call(this, element);
            }
            try {
                // Initialize canvas and context first before drawing
                const canvas = this.getCaptureCanvas(element);
                const ctx = this.getCaptureCanvasContext(element);
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
                        throw new Error(`Video element is not ready for capture (readyState: ${element.readyState}, required: >= 2)`);
                    }
                    // Also check video dimensions are valid
                    if (!element.videoWidth || !element.videoHeight) {
                        throw new Error(`Video element has invalid dimensions: ${element.videoWidth}x${element.videoHeight}`);
                    }
                    // Draw frame on canvas - can throw SecurityError if canvas is tainted (CORS issue)
                    // Pass ctx explicitly to ensure it's initialized
                    try {
                        this.drawFrameOnCanvas(element, undefined, ctx);
                    }
                    catch (drawError) {
                        throw new Error(`Failed to draw video frame on canvas: ${drawError instanceof Error ? drawError.message : String(drawError)}`);
                    }
                }
                else if (element instanceof HTMLImageElement) {
                    // Check if image is loaded and has valid dimensions
                    if (!element.complete) {
                        throw new Error('Image element is not fully loaded (complete: false)');
                    }
                    if (!element.naturalWidth || !element.naturalHeight) {
                        throw new Error(`Image element has invalid dimensions: ${element.naturalWidth}x${element.naturalHeight}`);
                    }
                    // Draw image on canvas - can throw SecurityError if canvas is tainted (CORS issue)
                    // Pass ctx explicitly to ensure it's initialized
                    try {
                        this.drawImageOnCanvas(element, undefined, ctx);
                    }
                    catch (drawError) {
                        throw new Error(`Failed to draw image on canvas: ${drawError instanceof Error ? drawError.message : String(drawError)}`);
                    }
                }
                else {
                    // TypeScript knows this is unreachable due to HTMLVisualMediaElement type,
                    // but we keep this for runtime safety and better error messages
                    const elementType = ((_a = element.constructor) === null || _a === void 0 ? void 0 : _a.name) || typeof element;
                    throw new Error(`Unsupported element type: ${elementType}`);
                }
                // Validate canvas dimensions
                if (canvas.width <= 0 || canvas.height <= 0) {
                    throw new Error(`Invalid canvas dimensions: ${canvas.width}x${canvas.height}`);
                }
                // Get image data from canvas - can throw SecurityError if canvas is tainted (CORS issue)
                // Let SecurityError propagate as DOMException so the outer catch can distinguish it
                // from WASM failures and avoid falling back to the same tainted canvas.
                let imageData;
                try {
                    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                }
                catch (getImageDataError) {
                    if (getImageDataError instanceof DOMException && getImageDataError.name === 'SecurityError') {
                        throw getImageDataError;
                    }
                    throw new Error(`Failed to get image data from canvas: ${getImageDataError instanceof Error ? getImageDataError.message : String(getImageDataError)}`);
                }
                // Validate imageData is available and has expected structure
                if (!imageData || !imageData.data) {
                    throw new Error('Failed to get image data from canvas');
                }
                // Validate imageData has expected length (width * height * 4 for RGBA)
                const expectedLength = canvas.width * canvas.height * 4;
                if (imageData.data.length !== expectedLength) {
                    throw new Error(`ImageData length mismatch: expected ${expectedLength}, got ${imageData.data.length}`);
                }
                // Renamed from `readBarcodes` to avoid shadowing the module-level import
                const wasmReadBarcodes = wasmReader.readBarcodes;
                // Build options - downscaling is always disabled in the WASM path for all frame sizes.
                // This ensures accurate scanning of high-density QR codes (1500+ characters), especially
                // on Windows machines with lower camera resolutions. The zxing-wasm tryDownscale option
                // is deprecated and not passed.
                const options = {
                    formats: ['QRCode'],
                    tryHarder: true,
                    tryRotate: true,
                    tryInvert: true,
                    maxNumberOfSymbols: 1,
                };
                // Call readBarcodes - it may return a Promise or a value directly
                // If it throws synchronously, the outer try-catch will handle it
                let results;
                try {
                    const readBarcodesResult = wasmReadBarcodes(imageData, options);
                    // Handle both Promise and direct value returns
                    // Use robust Promise detection: check for .then method (works across realms and polyfills)
                    // This is more reliable than instanceof Promise which can fail with cross-realm Promises
                    const isPromise = readBarcodesResult != null &&
                        typeof readBarcodesResult === 'object' &&
                        typeof readBarcodesResult.then === 'function';
                    results = isPromise ? yield readBarcodesResult : readBarcodesResult;
                }
                catch (callError) {
                    throw new Error(`Failed to call zxing-wasm readBarcodes: ${callError instanceof Error ? callError.message : String(callError)}`);
                }
                // Validate results structure
                if (!results) {
                    throw new NotFoundException();
                }
                // Ensure results is an array
                const resultsArray = Array.isArray(results) ? results : [results];
                if (resultsArray.length === 0) {
                    throw new NotFoundException();
                }
                // Validate first result has expected structure
                const first = resultsArray[0];
                if (!first || typeof first !== 'object') {
                    throw new NotFoundException();
                }
                // Check if result is valid
                if (!first.isValid) {
                    // If result has an error, throw NotFoundException to trigger fallback
                    throw new NotFoundException();
                }
                // Validate text exists (null/undefined), but allow empty strings as valid QR code results
                if (first.text === null || first.text === undefined || typeof first.text !== 'string') {
                    throw new NotFoundException();
                }
                const decodedText = first.text;
                // Extract position points if available and valid
                const points = BrowserQRCodeReader.extractResultPoints(first);
                // Result constructor requires ResultPoint[], so use empty array if null
                const safePoints = points !== null && points !== void 0 ? points : [];
                return new Result(decodedText, null, 0, safePoints, BarcodeFormat.QR_CODE);
            }
            catch (e) {
                // If WASM fails with a "not found" result, propagate the NotFoundException.
                // This matches the base behavior and avoids a second decode attempt on the same frame.
                if (e instanceof NotFoundException) {
                    throw e; // Re-throw NotFoundException - it's expected and does not trigger fallback
                }
                // Canvas tainted by cross-origin content: falling back would hit the same tainted
                // canvas and throw an unhelpful SecurityError, so surface a descriptive error instead.
                if (e instanceof DOMException && e.name === 'SecurityError') {
                    this.captureCanvas = undefined;
                    this.captureCanvasContext = undefined;
                    throw new Error('Canvas is tainted and cannot be read (CORS issue). Ensure images have proper CORS headers.');
                }
                // For any other error (WASM load failure, API mismatch, etc.), fall back
                // to the regular TypeScript-based decoder for backward compatibility.
                return _super.decodeAsync.call(this, element);
            }
        });
    }
    /**
     * Extract ResultPoint array from zxing-wasm result if position data is available and valid
     */
    static extractResultPoints(result) {
        if (!result.position) {
            return null;
        }
        const { topLeft, topRight, bottomRight, bottomLeft } = result.position;
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
            new ResultPoint(topLeft.x, topLeft.y),
            new ResultPoint(topRight.x, topRight.y),
            new ResultPoint(bottomRight.x, bottomRight.y),
            new ResultPoint(bottomLeft.x, bottomLeft.y),
        ];
    }
}
BrowserQRCodeReader.wasmReaderModule = null;

import { BrowserCodeReader } from './BrowserCodeReader';
import { HTMLVisualMediaElement } from './HTMLVisualMediaElement';
import QRCodeReader from '../core/qrcode/QRCodeReader';
import BarcodeFormat from '../core/BarcodeFormat';
import NotFoundException from '../core/NotFoundException';
import Result from '../core/Result';
import ResultPoint from '../core/ResultPoint';

// Import zxing-wasm - will be bundled in UMD builds
import { readBarcodes } from 'zxing-wasm/reader';

/**
 * Options for zxing-wasm readBarcodes function
 */
interface ZXingWasmReaderOptions {
    formats?: string[];
    tryHarder?: boolean;
    tryRotate?: boolean;
    tryInvert?: boolean;
    /** @deprecated Downscaling options are not used. Downscaling is disabled to ensure full resolution 
     * scanning for high-density QR codes (1500+ characters), especially on Windows machines with lower camera resolutions. */
    tryDownscale?: boolean;
    /** @deprecated See tryDownscale */
    downscaleFactor?: number;
    /** @deprecated See tryDownscale */
    downscaleThreshold?: number;
    maxNumberOfSymbols?: number;
}

/**
 * Result from zxing-wasm readBarcodes function
 */
interface ZXingWasmResult {
    isValid: boolean;
    error?: string;
    text: string;
    format: string;
    position?: {
        topLeft: { x: number; y: number };
        topRight: { x: number; y: number };
        bottomRight: { x: number; y: number };
        bottomLeft: { x: number; y: number };
    };
}

/**
 * @deprecated Moving to @zxing/browser
 *
 * QR Code reader to use from browser.
 */
export class BrowserQRCodeReader extends BrowserCodeReader {
    private static wasmReaderModule: any = null; // Allow manual injection
    
    /**
     * Clears the manually injected WASM module (if any) so it can be garbage collected.
     * Does not affect the statically imported or bundled zxing-wasm reader, which cannot be reset.
     * Use this when you injected a module via injectWasmReader() and want to release it.
     *
     * Note: Existing instances will re-check WASM availability on their next decodeAsync() call.
     */
    public static resetWasm(): void {
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
    public static injectWasmReader(module: { readBarcodes: any }): void {
        if (!module) {
            throw new Error('injectWasmReader: module parameter is required');
        }
        if (typeof module.readBarcodes !== 'function') {
            throw new Error('injectWasmReader: module.readBarcodes must be a function');
        }
        BrowserQRCodeReader.wasmReaderModule = module;
    }
    
    /**
     * Auto-detect and inject WASM if available from global variables.
     */
    private static autoDetectWasm(): void {
        // Check for ZXingWASM global (from script tag)
        if (typeof window !== 'undefined' && (window as any).ZXingWASM) {
            const globalZXingWASM = (window as any).ZXingWASM;
            if (typeof globalZXingWASM.readBarcodes === 'function') {
                try {
                    BrowserQRCodeReader.injectWasmReader({ readBarcodes: globalZXingWASM.readBarcodes });
                } catch (e) {
                    // If injection fails, silently continue
                }
            }
        }
    }
    
    /**
     * Check if WASM is available (without throwing).
     * 
     * @returns true if WASM is available, false otherwise
     */
    public static isWasmAvailable(): boolean {
        BrowserQRCodeReader.autoDetectWasm();
        const reader = BrowserQRCodeReader.getWasmReader();
        return reader !== null;
    }
    
    private static getWasmReader(): { readBarcodes: any } | null {
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
            const globalZXingWASM = (window as any).ZXingWASM;
            if (globalZXingWASM && typeof globalZXingWASM.readBarcodes === 'function') {
                return globalZXingWASM;
            }
        }
        
        return null;
    }

    private readonly useWasm: boolean;

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
    public constructor(timeBetweenScansMillisOrOptions: number | { timeBetweenScansMillis?: number; useWasm?: boolean } = 500) {
        const timeBetweenScansMillis =
            typeof timeBetweenScansMillisOrOptions === 'number'
                ? timeBetweenScansMillisOrOptions
                : (timeBetweenScansMillisOrOptions.timeBetweenScansMillis ?? 500);

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

    public async decodeAsync(element: HTMLVisualMediaElement): Promise<Result> {
        // Check WASM availability
        BrowserQRCodeReader.autoDetectWasm();
        const wasmReader = BrowserQRCodeReader.getWasmReader();
        
        // If WASM is disabled or not available, use regular decode
        if (!this.useWasm || !wasmReader) {
            return super.decodeAsync(element);
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
                } catch (drawError) {
                    throw new Error(`Failed to draw video frame on canvas: ${drawError instanceof Error ? drawError.message : String(drawError)}`);
                }
            } else if (element instanceof HTMLImageElement) {
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
                } catch (drawError) {
                    throw new Error(`Failed to draw image on canvas: ${drawError instanceof Error ? drawError.message : String(drawError)}`);
                }
            } else {
                // TypeScript knows this is unreachable due to HTMLVisualMediaElement type,
                // but we keep this for runtime safety and better error messages
                const elementType = (element as any).constructor?.name || typeof element;
                throw new Error(`Unsupported element type: ${elementType}`);
            }
            
            // Validate canvas dimensions
            if (canvas.width <= 0 || canvas.height <= 0) {
                throw new Error(`Invalid canvas dimensions: ${canvas.width}x${canvas.height}`);
            }
            
            // Get image data from canvas - can throw SecurityError if canvas is tainted (CORS issue)
            let imageData: ImageData;
            try {
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            } catch (getImageDataError) {
                // SecurityError occurs when canvas is tainted (e.g., cross-origin image without CORS headers)
                if (getImageDataError instanceof DOMException && getImageDataError.name === 'SecurityError') {
                    throw new Error('Canvas is tainted and cannot be read (CORS issue). Ensure images have proper CORS headers.');
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

            // Validate wasmReader is still available (defensive check)
            if (!wasmReader) {
                return super.decodeAsync(element);
            }

            // Get readBarcodes function from the module
            if (!wasmReader.readBarcodes) {
                return super.decodeAsync(element);
            }
            
            const readBarcodes = wasmReader.readBarcodes;
            
            // Defensive runtime check: validate readBarcodes is actually callable
            // This is technically redundant after the checks above, but provides an extra safety layer
            // in case the module structure is unexpected or has been modified at runtime
            if (typeof readBarcodes !== 'function') {
                throw new Error('zxing-wasm readBarcodes is not a function');
            }
            
            // Build options - downscaling is always disabled in the WASM path for all frame sizes.
            // This ensures accurate scanning of high-density QR codes (1500+ characters), especially
            // on Windows machines with lower camera resolutions. The zxing-wasm tryDownscale option
            // is deprecated and not passed.
            const options: ZXingWasmReaderOptions = {
                formats: ['QRCode'],
                tryHarder: true,
                tryRotate: true,
                tryInvert: true,
                maxNumberOfSymbols: 1,
            };
            
            // Call readBarcodes - it may return a Promise or a value directly
            // If it throws synchronously, the outer try-catch will handle it
            let results: any;
            try {
                const readBarcodesResult = readBarcodes(imageData, options);
                
                // Handle both Promise and direct value returns
                // Use robust Promise detection: check for .then method (works across realms and polyfills)
                // This is more reliable than instanceof Promise which can fail with cross-realm Promises
                const isPromise = readBarcodesResult != null && 
                                  typeof readBarcodesResult === 'object' && 
                                  typeof (readBarcodesResult as any).then === 'function';
                results = isPromise ? await readBarcodesResult : readBarcodesResult;
            } catch (callError) {
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
            const first = resultsArray[0] as ZXingWasmResult;
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
            const safePoints: ResultPoint[] = points ?? [];

            return new Result(decodedText, null, 0, safePoints, BarcodeFormat.QR_CODE);
        } catch (e) {
            // If WASM fails with a "not found" result, propagate the NotFoundException.
            // This matches the base behavior and avoids a second decode attempt on the same frame.
            if (e instanceof NotFoundException) {
                throw e; // Re-throw NotFoundException - it's expected and does not trigger fallback
            }
            // For any other error (WASM load failure, API mismatch, etc.), fall back
            // to the regular TypeScript-based decoder for backward compatibility.
            return super.decodeAsync(element);
        }
    }
    
    /**
     * Extract ResultPoint array from zxing-wasm result if position data is available and valid
     */
    private static extractResultPoints(result: ZXingWasmResult): ResultPoint[] | null {
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

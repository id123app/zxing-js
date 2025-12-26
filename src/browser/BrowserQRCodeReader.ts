import { BrowserCodeReader } from './BrowserCodeReader';
import QRCodeReader from '../core/qrcode/QRCodeReader';
import BarcodeFormat from '../core/BarcodeFormat';
import NotFoundException from '../core/NotFoundException';
import Result from '../core/Result';
import ResultPoint from '../core/ResultPoint';

/**
 * @deprecated Moving to @zxing/browser
 *
 * QR Code reader to use from browser.
 */
export class BrowserQRCodeReader extends BrowserCodeReader {
    private static wasmReaderPromise: Promise<any> | null = null;
    private static wasmLoadError: Error | null = null;
    private static wasmReaderModule: any = null; // Allow manual injection
    private static wasmAutoDetected: boolean = false; // Track if we've tried auto-detection
    
    /**
     * Manually inject zxing-wasm module for browser environments.
     * Call this before using WASM mode if zxing-wasm is loaded separately.
     * 
     * @example
     * // After loading zxing-wasm via script tag or CDN:
     * import { readBarcodes } from 'https://cdn.jsdelivr.net/npm/zxing-wasm@latest/dist/reader/index.js';
     * BrowserQRCodeReader.injectWasmReader({ readBarcodes });
     */
    public static injectWasmReader(module: { readBarcodes: any }): void {
        BrowserQRCodeReader.wasmReaderModule = module;
        BrowserQRCodeReader.wasmReaderPromise = Promise.resolve(module);
        BrowserQRCodeReader.wasmLoadError = null;
    }
    
    /**
     * Auto-detect and inject WASM if available (ZXingWASM global from IIFE build)
     */
    private static autoDetectWasm(): void {
        if (BrowserQRCodeReader.wasmAutoDetected) {
            return; // Already tried
        }
        BrowserQRCodeReader.wasmAutoDetected = true;
        
        // Check for ZXingWASM global (from IIFE build)
        if (typeof window !== 'undefined' && (window as any).ZXingWASM && (window as any).ZXingWASM.readBarcodes) {
            BrowserQRCodeReader.injectWasmReader({ readBarcodes: (window as any).ZXingWASM.readBarcodes });
        }
    }
    
    /**
     * Check if WASM is available (without throwing)
     */
    private static async isWasmAvailable(): Promise<boolean> {
        BrowserQRCodeReader.autoDetectWasm();
        
        if (BrowserQRCodeReader.wasmReaderModule) {
            return true;
        }
        
        if (BrowserQRCodeReader.wasmLoadError) {
            return false;
        }
        
        // Try to get WASM reader, but don't throw if it fails
        try {
            await BrowserQRCodeReader.getWasmReader();
            return true;
        } catch (e) {
            return false;
        }
    }
    
    private static async getWasmReader() {
        if (BrowserQRCodeReader.wasmLoadError) {
            throw BrowserQRCodeReader.wasmLoadError;
        }
        if (!BrowserQRCodeReader.wasmReaderPromise) {
            // Lazy-load WASM module. Try multiple strategies for browser compatibility:
            // 1. Dynamic import (works in modern browsers with ES modules)
            // 2. Global variable (if loaded via script tag)
            // 3. Require (for Node.js/CommonJS environments)
            BrowserQRCodeReader.wasmReaderPromise = (async () => {
                try {
                    // Strategy 0: Check if manually injected
                    if (BrowserQRCodeReader.wasmReaderModule) {
                        return BrowserQRCodeReader.wasmReaderModule;
                    }
                    
                    // Strategy 1: Try global variable ZXingWASM (IIFE build from CDN)
                    if (typeof window !== 'undefined' && (window as any).ZXingWASM) {
                        return (window as any).ZXingWASM;
                    }
                    
                    // Strategy 1b: Try zxingWasm (if manually set)
                    if (typeof window !== 'undefined' && (window as any).zxingWasm) {
                        return (window as any).zxingWasm;
                    }
                    
                    // Strategy 2: Try dynamic import (works in modern browsers with ES modules)
                    // Note: This only works if zxing-wasm is available as an ES module
                    if (typeof window !== 'undefined') {
                        try {
                            // Dynamic import is a global function
                            // @ts-ignore - dynamic import may not be in types
                            const importFunc = (specifier: string) => import(specifier);
                            return await importFunc('zxing-wasm/reader');
                        } catch (e) {
                            // Dynamic import failed (module not available), try other strategies
                        }
                    }
                    
                    // Strategy 3: Try require (for Node.js/CommonJS)
                    if (typeof require !== 'undefined') {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            return require('zxing-wasm/reader');
                        } catch (e) {
                            // require failed
                        }
                    }
                    
                    // Strategy 4: Try Function-based dynamic import (works in some bundlers)
                    try {
                        const importFunc = new Function('specifier', 'return import(specifier)');
                        return await importFunc('zxing-wasm/reader');
                    } catch (e) {
                        // All strategies failed
                    }
                    
                    throw new Error(
                        'zxing-wasm is not available. ' +
                        'For browser use, load zxing-wasm via IIFE script tag:\n' +
                        '<script src="https://cdn.jsdelivr.net/npm/zxing-wasm@latest/dist/iife/reader/index.js"></script>\n' +
                        'This will expose ZXingWASM global variable, or use BrowserQRCodeReader.injectWasmReader({ readBarcodes })'
                    );
                } catch (e) {
                    BrowserQRCodeReader.wasmLoadError = e instanceof Error ? e : new Error(String(e));
                    throw BrowserQRCodeReader.wasmLoadError;
                }
            })();
        }
        return BrowserQRCodeReader.wasmReaderPromise;
    }

    private readonly useWasm: boolean;
    private _wasmAvailable: boolean | null = null; // Cache WASM availability

    /**
     * Creates an instance of BrowserQRCodeReader.
     * @param {number} [timeBetweenScansMillis=500] the time delay between subsequent decode tries
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

    public async decodeAsync(element: import('./HTMLVisualMediaElement').HTMLVisualMediaElement): Promise<Result> {
        // Check WASM availability if not cached
        if (this._wasmAvailable === null) {
            this._wasmAvailable = await BrowserQRCodeReader.isWasmAvailable();
        }
        
        // If WASM is disabled or not available, use regular decode
        if (!this.useWasm || !this._wasmAvailable) {
            return super.decodeAsync(element);
        }

        try {
            // Capture ImageData from the existing canvas pipeline
            this.getCaptureCanvasContext(element);
            if (element instanceof HTMLVideoElement) {
                this.drawFrameOnCanvas(element);
            } else {
                this.drawImageOnCanvas(element as HTMLImageElement);
            }

            const canvas = this.getCaptureCanvas(element);
            const ctx = this.getCaptureCanvasContext(element);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Determine if this is likely a large/dense QR code based on canvas size
            // Large codes (800+ chars) need full resolution - don't downscale
            const isLikelyLargeCode = canvas.width > 400 || canvas.height > 400;

            const { readBarcodes } = await BrowserQRCodeReader.getWasmReader();
            const results = await readBarcodes(imageData, {
                formats: ['QRCode'],
                tryHarder: true,
                tryRotate: true,
                tryInvert: true,
                // CRITICAL: Don't downscale large QR codes - they need full resolution
                // Downscaling helps with speed for small codes, but destroys large code detection
                tryDownscale: !isLikelyLargeCode,
                downscaleFactor: isLikelyLargeCode ? 1 : 3,
                downscaleThreshold: isLikelyLargeCode ? Infinity : 500,
                maxNumberOfSymbols: 1,
            });

            if (!results || results.length === 0) {
                throw new NotFoundException();
            }

            const first = results[0];
            const points: ResultPoint[] = (first.position?.topLeft && first.position?.topRight && first.position?.bottomRight && first.position?.bottomLeft)
                ? [
                    new ResultPoint(first.position.topLeft.x, first.position.topLeft.y),
                    new ResultPoint(first.position.topRight.x, first.position.topRight.y),
                    new ResultPoint(first.position.bottomRight.x, first.position.bottomRight.y),
                    new ResultPoint(first.position.bottomLeft.x, first.position.bottomLeft.y),
                ]
                : null;

            return new Result(first.text, null, 0, points, BarcodeFormat.QR_CODE);
        } catch (e) {
            // If WASM fails (module not loaded, API error, etc.), fall back to regular decode
            // This ensures backward compatibility even if zxing-wasm isn't available
            if (e instanceof NotFoundException) {
                throw e; // Re-throw NotFoundException - it's expected
            }
            // For any other error (WASM load failure, API mismatch, etc.), fall back
            console.warn('[BrowserQRCodeReader] WASM decode failed, falling back to regular decode:', e);
            return super.decodeAsync(element);
        }
    }
}

import { BrowserCodeReader } from './BrowserCodeReader';
import QRCodeReader from '../core/qrcode/QRCodeReader';
import BarcodeFormat from '../core/BarcodeFormat';
import NotFoundException from '../core/NotFoundException';
import Result from '../core/Result';
import ResultPoint from '../core/ResultPoint';

/**
 * Options for zxing-wasm readBarcodes function
 */
interface ZXingWasmReaderOptions {
    formats?: string[];
    tryHarder?: boolean;
    tryRotate?: boolean;
    tryInvert?: boolean;
    tryDownscale?: boolean;
    downscaleFactor?: number;
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
    // Constants for QR code size detection and downscaling
    private static readonly LARGE_QR_CODE_THRESHOLD = 400; // pixels - canvas dimension threshold for large QR codes
    private static readonly DEFAULT_DOWNSCALE_FACTOR = 3; // Factor for downscaling small QR codes
    private static readonly DEFAULT_DOWNSCALE_THRESHOLD = 500; // Threshold in pixels for downscaling
    
    // zxing-wasm version - matches package.json dependency
    private static readonly ZXING_WASM_VERSION = '2.2.4';
    
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
     * If not available, automatically load it from CDN
     */
    private static async autoDetectWasm(): Promise<void> {
        if (BrowserQRCodeReader.wasmAutoDetected) {
            return; // Already tried
        }
        BrowserQRCodeReader.wasmAutoDetected = true;
        
        // Check for ZXingWASM global (from IIFE build)
        if (typeof window !== 'undefined' && (window as any).ZXingWASM && (window as any).ZXingWASM.readBarcodes) {
            BrowserQRCodeReader.injectWasmReader({ readBarcodes: (window as any).ZXingWASM.readBarcodes });
            return;
        }
        
        // If not available, try to load from CDN
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            try {
                await BrowserQRCodeReader.loadWasmFromCDN();
            } catch (e) {
                // Silently fail - WASM will just be unavailable
                // Note: In production, consider using a logging framework instead of console.debug
            }
        }
    }
    
    /**
     * Dynamically load zxing-wasm from CDN
     */
    private static async loadWasmFromCDN(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (typeof window !== 'undefined' && (window as any).ZXingWASM) {
                BrowserQRCodeReader.injectWasmReader({ readBarcodes: (window as any).ZXingWASM.readBarcodes });
                resolve();
                return;
            }
            
            // Check if script is already being loaded
            const existingScript = document.querySelector('script[src*="zxing-wasm"]');
            if (existingScript) {
                // Wait for it to load
                existingScript.addEventListener('load', () => {
                    if ((window as any).ZXingWASM) {
                        BrowserQRCodeReader.injectWasmReader({ readBarcodes: (window as any).ZXingWASM.readBarcodes });
                        resolve();
                    } else {
                        reject(new Error('zxing-wasm script loaded but ZXingWASM global not found'));
                    }
                });
                existingScript.addEventListener('error', reject);
                return;
            }
            
            // Create and load script
            // Note: Using specific version for stability. Users can also load zxing-wasm via npm
            // and it will be auto-detected, avoiding CDN dependency.
            const script = document.createElement('script');
            script.src = `https://cdn.jsdelivr.net/npm/zxing-wasm@${BrowserQRCodeReader.ZXING_WASM_VERSION}/dist/iife/reader/index.js`;
            script.async = true;
            script.onload = () => {
                if ((window as any).ZXingWASM && (window as any).ZXingWASM.readBarcodes) {
                    BrowserQRCodeReader.injectWasmReader({ readBarcodes: (window as any).ZXingWASM.readBarcodes });
                    resolve();
                } else {
                    reject(new Error('zxing-wasm script loaded but ZXingWASM or ZXingWASM.readBarcodes not found'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load zxing-wasm from CDN'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Check if WASM is available (without throwing)
     */
    private static async isWasmAvailable(): Promise<boolean> {
        await BrowserQRCodeReader.autoDetectWasm();
        
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
            // Strategy order: 1. Manual injection, 2. Global variable, 3. Dynamic import (ES modules), 4. require (Node.js/CommonJS)
            BrowserQRCodeReader.wasmReaderPromise = (async () => {
                try {
                    // Strategy 1: Check if manually injected
                    if (BrowserQRCodeReader.wasmReaderModule) {
                        return BrowserQRCodeReader.wasmReaderModule;
                    }
                    
                    // Strategy 2: Try global variable ZXingWASM (IIFE build from CDN or script tag)
                    if (typeof window !== 'undefined' && (window as any).ZXingWASM) {
                        return (window as any).ZXingWASM;
                    }
                    
                    // Strategy 2b: Try zxingWasm (if manually set)
                    if (typeof window !== 'undefined' && (window as any).zxingWasm) {
                        return (window as any).zxingWasm;
                    }
                    
                    // Strategy 3: Try dynamic import (works in modern browsers with ES modules)
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
                    
                    // Strategy 4: Try require (for Node.js/CommonJS)
                    if (typeof require !== 'undefined') {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            return require('zxing-wasm/reader');
                        } catch (e) {
                            // require failed
                        }
                    }
                    
                    // Note: Removed Function-based dynamic import strategy due to CSP concerns
                    // Users should load zxing-wasm via npm, script tag, or use injectWasmReader
                    
                    throw new Error(
                        'zxing-wasm is not available. ' +
                        'For browser use, either:\n' +
                        `1. Load via script tag: <script src="https://cdn.jsdelivr.net/npm/zxing-wasm@${BrowserQRCodeReader.ZXING_WASM_VERSION}/dist/iife/reader/index.js"></script>\n` +
                        '2. Install via npm: npm install zxing-wasm (will be auto-detected)\n' +
                        '3. Use BrowserQRCodeReader.injectWasmReader({ readBarcodes })'
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
     * @param {number | { timeBetweenScansMillis?: number; useWasm?: boolean }} [timeBetweenScansMillisOrOptions=500]
     *        Either the time delay between subsequent decode tries, or an options object.
     */
    public constructor(timeBetweenScansMillisOrOptions: number | { timeBetweenScansMillis?: number; useWasm?: boolean } = 500) {
        const timeBetweenScansMillis =
            typeof timeBetweenScansMillisOrOptions === 'number'
                ? timeBetweenScansMillisOrOptions
                : (timeBetweenScansMillisOrOptions.timeBetweenScansMillis ?? 500);

        super(new QRCodeReader(), timeBetweenScansMillis);

        // Auto-detect and load WASM on construction (async, won't block)
        void BrowserQRCodeReader.autoDetectWasm();
        
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

            // Determine if this is likely a large/dense QR code based on canvas dimensions
            // Large canvas sizes (> 400px in either dimension) need full resolution - don't downscale
            const isLikelyLargeCode = canvas.width > BrowserQRCodeReader.LARGE_QR_CODE_THRESHOLD || 
                                     canvas.height > BrowserQRCodeReader.LARGE_QR_CODE_THRESHOLD;

            const { readBarcodes } = await BrowserQRCodeReader.getWasmReader();
            
            // Build options - only include downscale options if we want to downscale
            const options: ZXingWasmReaderOptions = {
                formats: ['QRCode'],
                tryHarder: true,
                tryRotate: true,
                tryInvert: true,
                maxNumberOfSymbols: 1,
            };
            
            // CRITICAL: Don't downscale large QR codes - they need full resolution
            // Only add downscale options if we want to downscale (for small codes)
            if (!isLikelyLargeCode) {
                options.tryDownscale = true;
                options.downscaleFactor = BrowserQRCodeReader.DEFAULT_DOWNSCALE_FACTOR;
                options.downscaleThreshold = BrowserQRCodeReader.DEFAULT_DOWNSCALE_THRESHOLD;
            }
            // For large codes, don't set downscale options at all (use full resolution)
            
            const results = await readBarcodes(imageData, options) as ZXingWasmResult[];

            if (!results || results.length === 0) {
                throw new NotFoundException();
            }

            const first = results[0];
            
            // Check if result is valid
            if (!first.isValid) {
                // If result has an error, log it and throw
                const errorMsg = first.error || 'Unknown WASM decode error';
                console.error('[BrowserQRCodeReader] WASM decode failed:', errorMsg, first);
                throw new Error(`WASM decode failed: ${errorMsg}`);
            }
            
            if (!first.text) {
                console.warn('[BrowserQRCodeReader] WASM detected QR code but text is empty');
                throw new NotFoundException();
            }
            
            const decodedText = first.text;
            
            const points: ResultPoint[] = (first.position?.topLeft && first.position?.topRight && first.position?.bottomRight && first.position?.bottomLeft)
                ? [
                    new ResultPoint(first.position.topLeft.x, first.position.topLeft.y),
                    new ResultPoint(first.position.topRight.x, first.position.topRight.y),
                    new ResultPoint(first.position.bottomRight.x, first.position.bottomRight.y),
                    new ResultPoint(first.position.bottomLeft.x, first.position.bottomLeft.y),
                ]
                : null;

            return new Result(decodedText, null, 0, points, BarcodeFormat.QR_CODE);
        } catch (e) {
            // If WASM fails (module not loaded, API error, etc.), fall back to regular decode
            // This ensures backward compatibility even if zxing-wasm isn't available
            if (e instanceof NotFoundException) {
                throw e; // Re-throw NotFoundException - it's expected
            }
            // For any other error (WASM load failure, API mismatch, etc.), fall back
            // Note: In production, consider using a logging framework instead of console.warn
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
        
        // Validate that all required position points exist and have x/y coordinates
        if (!topLeft || !topRight || !bottomRight || !bottomLeft ||
            typeof topLeft.x !== 'number' || typeof topLeft.y !== 'number' ||
            typeof topRight.x !== 'number' || typeof topRight.y !== 'number' ||
            typeof bottomRight.x !== 'number' || typeof bottomRight.y !== 'number' ||
            typeof bottomLeft.x !== 'number' || typeof bottomLeft.y !== 'number') {
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

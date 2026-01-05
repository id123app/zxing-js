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
     * // After loading zxing-wasm via script tag, CDN, or npm:
     * import { readBarcodes } from 'zxing-wasm/reader'; // npm install zxing-wasm
     * // or: import { readBarcodes } from 'https://cdn.jsdelivr.net/npm/zxing-wasm@2.2.4/dist/reader/index.js';
     * BrowserQRCodeReader.injectWasmReader({ readBarcodes });
     */
    public static injectWasmReader(module: { readBarcodes: any }): void {
        BrowserQRCodeReader.wasmReaderModule = module;
        BrowserQRCodeReader.wasmReaderPromise = Promise.resolve(module);
        BrowserQRCodeReader.wasmLoadError = null;
    }
    
    /**
     * Auto-detect and inject WASM if available.
     * Priority: 1) npm dependency (via dynamic import/require), 2) Global variable, 3) CDN (last resort)
     * 
     * Note: npm dependency is preferred for stability, version control, and offline builds.
     * CDN loading is only used as a fallback when npm dependency is not available.
     */
    private static async autoDetectWasm(): Promise<void> {
        // Atomic check-and-set to prevent race conditions
        if (BrowserQRCodeReader.wasmAutoDetected) {
            return; // Already tried
        }
        // Set flag immediately to prevent concurrent execution
        BrowserQRCodeReader.wasmAutoDetected = true;
        
        // First, try to detect npm dependency (preferred method)
        // This happens automatically in getWasmReader() via dynamic import/require
        
        // Then check for ZXingWASM global (from script tag or CDN)
        if (typeof window !== 'undefined' && (window as any).ZXingWASM && (window as any).ZXingWASM.readBarcodes) {
            BrowserQRCodeReader.injectWasmReader({ readBarcodes: (window as any).ZXingWASM.readBarcodes });
            return;
        }
        
        // Last resort: try to load from CDN (only if npm dependency and global are not available)
        // This requires internet connection and is less stable than npm dependency
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
     * Dynamically load zxing-wasm from CDN (last resort fallback).
     * 
     * Note: This is only used when npm dependency is not available.
     * For production use, prefer installing zxing-wasm via npm for:
     * - Version stability (pinned versions)
     * - Offline builds
     * - Better security (no external CDN dependency)
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
            // Lazy-load WASM module. Try multiple strategies in priority order:
            // 1. Manual injection (highest priority - user explicitly provided)
            // 2. npm dependency via dynamic import (ES modules; preferred for stability/offline builds)
            // 3. npm dependency via require (CommonJS)
            // 4. Global variable (from script tag or already-loaded CDN)
            BrowserQRCodeReader.wasmReaderPromise = (async () => {
                try {
                    // Strategy 1: Check if manually injected (highest priority)
                    if (BrowserQRCodeReader.wasmReaderModule) {
                        return BrowserQRCodeReader.wasmReaderModule;
                    }
                    
                    // Strategy 2: Try npm dependency via dynamic import (ES modules)
                    // This works when zxing-wasm is installed via npm and available as a module
                    // Preferred over CDN for stability, version control, and offline builds
                    // Works in: ES module contexts, bundlers (webpack, vite, rollup with proper config)
                    try {
                        // Try standard import path first
                        // @ts-ignore - dynamic import may not be in types, module structure varies
                        const module: any = await import('zxing-wasm/reader');
                        if (module && module.readBarcodes) {
                            return module;
                        }
                        // Handle default export if present
                        if (module && module.default && module.default.readBarcodes) {
                            return module.default;
                        }
                    } catch (e) {
                        // Dynamic import failed, try alternative paths
                        try {
                            // Try alternative import path (some bundlers resolve differently)
                            // @ts-ignore
                            const module: any = await import('zxing-wasm');
                            if (module && module.readBarcodes) {
                                return module;
                            }
                            // Handle default export if present
                            if (module && module.default && module.default.readBarcodes) {
                                return module.default;
                            }
                        } catch (e2) {
                            // Both import paths failed, continue to next strategy
                        }
                    }
                    
                    // Strategy 3: Try npm dependency via require (Node.js/CommonJS)
                    // This works in Node.js environments or bundlers that support require
                    if (typeof require !== 'undefined') {
                        try {
                            // Try standard require path
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            const module: any = require('zxing-wasm/reader');
                            if (module && module.readBarcodes) {
                                return module;
                            }
                            // Handle default export if present
                            if (module && module.default && module.default.readBarcodes) {
                                return module.default;
                            }
                        } catch (e) {
                            // Try alternative require path
                            try {
                                // eslint-disable-next-line @typescript-eslint/no-var-requires
                                const module: any = require('zxing-wasm');
                                if (module && module.readBarcodes) {
                                    return module;
                                }
                                // Handle default export if present
                                if (module && module.default && module.default.readBarcodes) {
                                    return module.default;
                                }
                            } catch (e2) {
                                // Both require paths failed
                            }
                        }
                    }
                    
                    // Strategy 4: Try global variable ZXingWASM (from script tag or CDN)
                    // This is a fallback when npm dependency is not available
                    if (typeof window !== 'undefined') {
                        const globalZXingWASM = (window as any).ZXingWASM;
                        if (globalZXingWASM && (globalZXingWASM.readBarcodes || globalZXingWASM.default?.readBarcodes)) {
                            return globalZXingWASM.readBarcodes ? globalZXingWASM : globalZXingWASM.default;
                        }
                        
                        // Strategy 4b: Try zxingWasm (if manually set)
                        const globalZxingWasm = (window as any).zxingWasm;
                        if (globalZxingWasm && (globalZxingWasm.readBarcodes || globalZxingWasm.default?.readBarcodes)) {
                            return globalZxingWasm.readBarcodes ? globalZxingWasm : globalZxingWasm.default;
                        }
                    }
                    
                    // Note: Removed Function-based dynamic import strategy due to CSP concerns
                    // Users should load zxing-wasm via npm, script tag, or use injectWasmReader
                    
                    throw new Error(
                        'zxing-wasm is not available. ' +
                        'Recommended: Install via npm for stability and offline builds:\n' +
                        '  npm install zxing-wasm\n' +
                        'This will be auto-detected. Alternatively:\n' +
                        `1. Load via script tag: <script src="https://cdn.jsdelivr.net/npm/zxing-wasm@${BrowserQRCodeReader.ZXING_WASM_VERSION}/dist/iife/reader/index.js"></script>\n` +
                        '2. Use BrowserQRCodeReader.injectWasmReader({ readBarcodes })'
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

            const wasmModule = await BrowserQRCodeReader.getWasmReader();
            // Handle both direct export and default export formats
            const readBarcodes = wasmModule.readBarcodes || wasmModule.default?.readBarcodes || wasmModule;
            if (typeof readBarcodes !== 'function') {
                throw new Error('zxing-wasm readBarcodes function not found in module');
            }
            
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
                // If result has an error, throw NotFoundException to trigger fallback
                throw new NotFoundException();
            }
            
            if (!first.text) {
                throw new NotFoundException();
            }
            
            const decodedText = first.text;
            
            // Extract position points if available and valid (can be null)
            const points = BrowserQRCodeReader.extractResultPoints(first);

            return new Result(decodedText, null, 0, points, BarcodeFormat.QR_CODE);
        } catch (e) {
            // If WASM fails (module not loaded, API error, etc.), fall back to regular decode
            // This ensures backward compatibility even if zxing-wasm isn't available
            if (e instanceof NotFoundException) {
                throw e; // Re-throw NotFoundException - it's expected
            }
            // For any other error (WASM load failure, API mismatch, etc.), fall back
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

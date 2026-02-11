import { BrowserCodeReader } from './BrowserCodeReader';
import { HTMLVisualMediaElement } from './HTMLVisualMediaElement';
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
    // zxing-wasm version - matches package.json dependency
    private static readonly ZXING_WASM_VERSION = '2.2.4';
    
    private static wasmReaderPromise: Promise<any> | null = null;
    private static wasmLoadError: Error | null = null;
    private static wasmReaderModule: any = null; // Allow manual injection
    private static wasmAutoDetectPromise: Promise<void> | null = null; // Cache auto-detection promise to prevent race conditions
    private static wasmCdnLoadPromise: Promise<void> | null = null; // Cache CDN loading promise to prevent duplicate loads
    
    /**
     * Reset all static WASM-related caches so that they can be garbage collected.
     * This is useful for long-running or single-page applications that need to
     * release memory after the reader is no longer in use.
     * 
     * Note: Existing instances will re-check WASM availability on their next
     * decodeAsync() call after this method is called.
     */
    public static resetWasm(): void {
        BrowserQRCodeReader.wasmReaderPromise = null;
        BrowserQRCodeReader.wasmLoadError = null;
        BrowserQRCodeReader.wasmReaderModule = null;
        BrowserQRCodeReader.wasmAutoDetectPromise = null;
        BrowserQRCodeReader.wasmCdnLoadPromise = null;
        BrowserQRCodeReader.invalidateInstanceCaches(); // Invalidate instance caches
    }

    /**
     * Explicitly clear the last recorded WASM load error.
     * 
     * This can be used by consumers who, after handling or bypassing a load failure
     * (for example, via manual injection), want to reset the error state.
     * All existing instances will re-check WASM availability on their next decodeAsync() call.
     */
    public static clearWasmLoadError(): void {
        BrowserQRCodeReader.wasmLoadError = null;
        BrowserQRCodeReader.invalidateInstanceCaches(); // Invalidate instance caches to allow retry
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
     * // After loading zxing-wasm via script tag, CDN, or npm:
     * import { readBarcodes } from 'zxing-wasm/reader'; // npm install zxing-wasm
     * // or: import { readBarcodes } from 'https://cdn.jsdelivr.net/npm/zxing-wasm@2.2.4/dist/reader/index.js';
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
        BrowserQRCodeReader.wasmReaderPromise = Promise.resolve(module);
        BrowserQRCodeReader.wasmLoadError = null; // Clear error since injection succeeded
        BrowserQRCodeReader.invalidateInstanceCaches(); // Invalidate instance caches
    }
    
    /**
     * Auto-detect and inject WASM if available from global variables or CDN.
     * 
     * Note: This method only checks for global variables (ZXingWASM) and attempts CDN loading.
     * npm dependency detection happens lazily on the first decode attempt when getWasmReader() 
     * is called (e.g. via isWasmAvailable() or decodeAsync()).
     * 
     * Priority order for full detection (including npm):
     * 1) Manual injection (via injectWasmReader)
     * 2) npm dependency (detected in getWasmReader)
     * 3) Global variable (from script tag or CDN)
     * 4) CDN loading (last resort)
     */
    private static async autoDetectWasm(): Promise<void> {
        // Return cached promise if already detecting to prevent race conditions
        if (BrowserQRCodeReader.wasmAutoDetectPromise) {
            return BrowserQRCodeReader.wasmAutoDetectPromise;
        }
        
        BrowserQRCodeReader.wasmAutoDetectPromise = (async () => {
            // Note: npm dependency detection is not performed here; it happens lazily on the first
            // decode attempt when getWasmReader() is called (e.g. via isWasmAvailable() or decodeAsync()).
            
            // Check for ZXingWASM global (from script tag or CDN)
            if (typeof window !== 'undefined' && (window as any).ZXingWASM) {
                const globalZXingWASM = (window as any).ZXingWASM;
                // Validate readBarcodes is a function before calling injectWasmReader
                if (typeof globalZXingWASM.readBarcodes === 'function') {
                    try {
                        BrowserQRCodeReader.injectWasmReader({ readBarcodes: globalZXingWASM.readBarcodes });
                        return;
                    } catch (e) {
                        // If injection fails, continue to next strategy
                    }
                }
            }
            
            // Last resort: try to load from CDN (only if npm dependency and global are not available)
            // This requires internet connection and is less stable than npm dependency
            if (typeof window !== 'undefined' && typeof document !== 'undefined' && document !== null) {
                try {
                    await BrowserQRCodeReader.loadWasmFromCDN();
                } catch (e) {
                    // Silently fail - WASM will just be unavailable
                    // Note: In production, consider using a logging framework instead of console.debug
                }
            }
        })();
        
        return BrowserQRCodeReader.wasmAutoDetectPromise;
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
        // Return cached promise if already loading to prevent duplicate loads
        if (BrowserQRCodeReader.wasmCdnLoadPromise) {
            return BrowserQRCodeReader.wasmCdnLoadPromise;
        }
        
        BrowserQRCodeReader.wasmCdnLoadPromise = new Promise((resolve, reject) => {
            // Capture document reference to avoid stale reference issues
            const doc = typeof document !== 'undefined' ? document : null;
            if (!doc || !doc.head) {
                reject(new Error('document or document.head is not available'));
                return;
            }
            
            // Check if already loaded
            if (typeof window !== 'undefined' && (window as any).ZXingWASM) {
                const globalZXingWASM = (window as any).ZXingWASM;
                // Validate readBarcodes is a function before calling injectWasmReader
                if (typeof globalZXingWASM.readBarcodes === 'function') {
                    try {
                        BrowserQRCodeReader.injectWasmReader({ readBarcodes: globalZXingWASM.readBarcodes });
                        resolve();
                        return;
                    } catch (e) {
                        // If injection fails, continue to script loading
                    }
                }
            }
            
            // Check if script is already being loaded
            const existingScript = doc.querySelector('script[src*="zxing-wasm"]');
            if (existingScript) {
                // Wait for it to load - use { once: true } to prevent duplicate listeners
                existingScript.addEventListener('load', () => {
                    const globalZXingWASM = (window as any).ZXingWASM;
                    if (globalZXingWASM && typeof globalZXingWASM.readBarcodes === 'function') {
                        try {
                            BrowserQRCodeReader.injectWasmReader({ readBarcodes: globalZXingWASM.readBarcodes });
                            resolve();
                        } catch (e) {
                            reject(new Error('zxing-wasm script loaded but injection failed'));
                        }
                    } else {
                        reject(new Error('zxing-wasm script loaded but ZXingWASM or ZXingWASM.readBarcodes not found'));
                    }
                }, { once: true });
                existingScript.addEventListener('error', () => {
                    reject(new Error('Failed to load zxing-wasm from CDN'));
                }, { once: true });
                return;
            }
            
            // Create and load script
            // Note: Using specific version for stability. Users can also load zxing-wasm via npm
            // and it will be auto-detected, avoiding CDN dependency.
            const script = doc.createElement('script');
            script.src = `https://cdn.jsdelivr.net/npm/zxing-wasm@${BrowserQRCodeReader.ZXING_WASM_VERSION}/dist/iife/reader/index.js`;
            script.async = true;
            script.onload = () => {
                const globalZXingWASM = (window as any).ZXingWASM;
                if (globalZXingWASM && typeof globalZXingWASM.readBarcodes === 'function') {
                    try {
                        BrowserQRCodeReader.injectWasmReader({ readBarcodes: globalZXingWASM.readBarcodes });
                        resolve();
                    } catch (e) {
                        reject(new Error('zxing-wasm script loaded but injection failed'));
                    }
                } else {
                    reject(new Error('zxing-wasm script loaded but ZXingWASM or ZXingWASM.readBarcodes not found'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load zxing-wasm from CDN'));
            doc.head.appendChild(script);
        });
        
        return BrowserQRCodeReader.wasmCdnLoadPromise;
    }
    
    /**
     * Check if WASM is available (without throwing).
     * 
     * This method can be used to check WASM availability before attempting to decode.
     * It will attempt to detect and load WASM if not already done.
     * 
     * @returns Promise that resolves to true if WASM is available, false otherwise
     */
    public static async isWasmAvailable(): Promise<boolean> {
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
                        if (module && typeof module.readBarcodes === 'function') {
                            return module;
                        }
                        // Handle default export if present
                        if (module?.default && typeof module.default.readBarcodes === 'function') {
                            return module.default;
                        }
                    } catch (e) {
                        // Dynamic import failed, try alternative paths
                        try {
                            // Try alternative import path (some bundlers resolve differently)
                            // @ts-ignore
                            const module: any = await import('zxing-wasm');
                            if (module && typeof module.readBarcodes === 'function') {
                                return module;
                            }
                            // Handle default export if present
                            if (module?.default && typeof module.default.readBarcodes === 'function') {
                                return module.default;
                            }
                        } catch (e2) {
                            // Both import paths failed, continue to next strategy
                        }
                    }
                    
                    // Strategy 3: Try npm dependency via require (Node.js/CommonJS)
                    // This works in Node.js environments or bundlers that support require
                    if (typeof require === 'function') {
                        try {
                            // Try standard require path
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            const module: any = require('zxing-wasm/reader');
                            if (module && typeof module.readBarcodes === 'function') {
                                return module;
                            }
                            // Handle default export if present
                            if (module?.default && typeof module.default.readBarcodes === 'function') {
                                return module.default;
                            }
                        } catch (e) {
                            // Try alternative require path
                            try {
                                // eslint-disable-next-line @typescript-eslint/no-var-requires
                                const module: any = require('zxing-wasm');
                                if (module && typeof module.readBarcodes === 'function') {
                                    return module;
                                }
                                // Handle default export if present
                                if (module?.default && typeof module.default.readBarcodes === 'function') {
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
                        if (globalZXingWASM) {
                            // Check if readBarcodes is a function (not just truthy)
                            if (typeof globalZXingWASM.readBarcodes === 'function') {
                                return globalZXingWASM;
                            }
                            // Check default export
                            if (globalZXingWASM.default) {
                                if (typeof globalZXingWASM.default.readBarcodes === 'function') {
                                    return globalZXingWASM.default;
                                }
                                if (typeof globalZXingWASM.default === 'function') {
                                    return globalZXingWASM.default;
                                }
                            }
                        }
                        
                        // Strategy 4b: Try zxingWasm (if manually set)
                        const globalZxingWasm = (window as any).zxingWasm;
                        if (globalZxingWasm) {
                            // Check if readBarcodes is a function (not just truthy)
                            if (typeof globalZxingWasm.readBarcodes === 'function') {
                                return globalZxingWasm;
                            }
                            // Check default export
                            if (globalZxingWasm.default) {
                                if (typeof globalZxingWasm.default.readBarcodes === 'function') {
                                    return globalZxingWasm.default;
                                }
                                if (typeof globalZxingWasm.default === 'function') {
                                    return globalZxingWasm.default;
                                }
                            }
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
    private _wasmCheckVersion: number = 0; // Version of WASM state when cache was set
    
    // Version counter for WASM state changes - increments when state changes
    // Note: Resets to 0 when approaching Number.MAX_SAFE_INTEGER to prevent overflow
    private static wasmStateVersion: number = 0;
    
    /**
     * Invalidate WASM availability cache for all instances.
     * Called when WASM state changes (e.g., after injectWasmReader or resetWasm).
     */
    private static invalidateInstanceCaches(): void {
        BrowserQRCodeReader.wasmStateVersion++;
        // Reset to 0 when approaching max safe integer to prevent overflow
        // This is extremely unlikely in practice, but provides safety
        if (BrowserQRCodeReader.wasmStateVersion >= Number.MAX_SAFE_INTEGER - 1000) {
            BrowserQRCodeReader.wasmStateVersion = 0;
        }
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
     * Note: WASM auto-detection is triggered asynchronously on construction (fire-and-forget).
     * The first call to `decodeAsync()` will wait for WASM detection to complete if needed.
     * To ensure WASM is ready before first use, you can await `BrowserQRCodeReader.isWasmAvailable()`
     * after construction.
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

    public async decodeAsync(element: HTMLVisualMediaElement): Promise<Result> {
        // Check WASM availability if not cached or if WASM state has changed
        // Use a loop to handle version changes during async calls (prevents race conditions)
        // Add max iteration limit to prevent infinite loops in edge cases
        const MAX_VERSION_CHECK_ITERATIONS = 10;
        let iterationCount = 0;
        while (this._wasmAvailable === null || this._wasmCheckVersion !== BrowserQRCodeReader.wasmStateVersion) {
            // Safety check: prevent infinite loops if version keeps changing
            if (iterationCount >= MAX_VERSION_CHECK_ITERATIONS) {
                // If version keeps changing rapidly, use the last known availability state
                // If _wasmAvailable is still null, it will be set to false by the check below
                // This prevents infinite loops while still allowing retries on next call
                this._wasmCheckVersion = BrowserQRCodeReader.wasmStateVersion;
                // If we still don't have availability, force a check (but only once more)
                if (this._wasmAvailable === null) {
                    this._wasmAvailable = await BrowserQRCodeReader.isWasmAvailable();
                }
                break;
            }
            iterationCount++;
            
            const versionBeforeCheck = BrowserQRCodeReader.wasmStateVersion;
            this._wasmAvailable = await BrowserQRCodeReader.isWasmAvailable();
            const versionAfterCheck = BrowserQRCodeReader.wasmStateVersion;
            // If version didn't change during the async call, we're done
            if (versionBeforeCheck === versionAfterCheck) {
                this._wasmCheckVersion = versionAfterCheck;
                break;
            }
            // Version changed during async call, loop will re-check with new version
        }
        
        // If WASM is disabled or not available, use regular decode
        if (!this.useWasm || !this._wasmAvailable) {
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

            const wasmModule = await BrowserQRCodeReader.getWasmReader();
            // Handle both direct export and default export formats
            // Check if module itself is a function first, then check properties
            let readBarcodes: any;
            if (typeof wasmModule === 'function') {
                readBarcodes = wasmModule;
            } else if (wasmModule && typeof wasmModule.readBarcodes === 'function') {
                readBarcodes = wasmModule.readBarcodes;
            } else if (wasmModule?.default && typeof wasmModule.default.readBarcodes === 'function') {
                readBarcodes = wasmModule.default.readBarcodes;
            } else if (wasmModule?.default && typeof wasmModule.default === 'function') {
                readBarcodes = wasmModule.default;
            } else {
                throw new Error('zxing-wasm readBarcodes function not found in module');
            }
            
            // Defensive runtime check: validate readBarcodes is actually callable
            // This is technically redundant after the checks above, but provides an extra safety layer
            // in case the module structure is unexpected or has been modified at runtime
            if (typeof readBarcodes !== 'function') {
                throw new Error('zxing-wasm readBarcodes is not a function');
            }
            
            // Build options - disable downscaling entirely to ensure full resolution scanning
            // This matches the behavior of direct URL integration that successfully scanned 1500+ characters
            // Downscaling was causing issues on Windows machines with lower camera resolutions
            // 
            // Performance note: Disabling downscaling may slightly impact performance for very small QR codes,
            // but ensures accurate scanning of high-density codes. The trade-off is acceptable for the
            // improved reliability and character capacity (1500+ vs 700 characters).
            const options: ZXingWasmReaderOptions = {
                formats: ['QRCode'],
                tryHarder: true,
                tryRotate: true,
                tryInvert: true,
                maxNumberOfSymbols: 1,
                // Note: Downscaling disabled to ensure high-density QR codes (1500+ characters) 
                // can be scanned accurately, especially on Windows machines with lower camera resolutions
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

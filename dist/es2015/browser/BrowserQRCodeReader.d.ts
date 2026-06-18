import { BrowserCodeReader } from './BrowserCodeReader';
import { HTMLVisualMediaElement } from './HTMLVisualMediaElement';
import Result from '../core/Result';
import './wasmSetup';
/**
 * Options for zxing-wasm readBarcodes function.
 * @see https://github.com/Sec-ant/zxing-wasm - API may change between versions.
 * @version Based on zxing-wasm@2.2.4
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
 * Result from zxing-wasm readBarcodes function.
 * @see https://github.com/Sec-ant/zxing-wasm - API may change between versions.
 * @version Based on zxing-wasm@2.2.4
 */
interface ZXingWasmResult {
    isValid: boolean;
    error?: string;
    text: string;
    format: string;
    position?: {
        topLeft: {
            x: number;
            y: number;
        };
        topRight: {
            x: number;
            y: number;
        };
        bottomRight: {
            x: number;
            y: number;
        };
        bottomLeft: {
            x: number;
            y: number;
        };
    };
}
/**
 * @deprecated Moving to @zxing/browser
 *
 * QR Code reader to use from browser.
 */
/** Module shape expected from zxing-wasm/reader (readBarcodes may return sync or async) */
interface WasmReaderModule {
    readBarcodes: (imageData: ImageData, options?: ZXingWasmReaderOptions) => ZXingWasmResult[] | Promise<ZXingWasmResult[]>;
}
export declare class BrowserQRCodeReader extends BrowserCodeReader {
    private static wasmReaderModule;
    /**
     * Clears the manually injected WASM module (if any) so it can be garbage collected.
     * Does not affect the statically imported or bundled zxing-wasm reader, which cannot be reset.
     * Use this when you injected a module via injectWasmReader() and want to release it.
     *
     * Note: Existing instances will re-check WASM availability on their next decodeAsync() call.
     */
    static resetWasm(): void;
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
    static injectWasmReader(module: WasmReaderModule): void;
    /**
     * Validate that a candidate WASM module has the expected shape.
     * Prevents accepting arbitrary objects from the global scope.
     */
    private static isValidWasmModule;
    /**
     * Auto-detect and inject WASM if available from global variables.
     */
    private static autoDetectWasm;
    /**
     * Check if WASM is available (without throwing).
     *
     * @returns true if WASM is available, false otherwise
     */
    static isWasmAvailable(): boolean;
    private static getWasmReader;
    private readonly useWasm;
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
    constructor(timeBetweenScansMillisOrOptions?: number | {
        timeBetweenScansMillis?: number;
        useWasm?: boolean;
    });
    decodeAsync(element: HTMLVisualMediaElement): Promise<Result>;
    /**
     * Extract ResultPoint array from zxing-wasm result if position data is available and valid
     */
    private static extractResultPoints;
}
export {};

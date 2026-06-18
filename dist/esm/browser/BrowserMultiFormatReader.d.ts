import { BrowserCodeReader } from './BrowserCodeReader';
import { HTMLVisualMediaElement } from './HTMLVisualMediaElement';
import MultiFormatReader from '../core/MultiFormatReader';
import BinaryBitmap from '../core/BinaryBitmap';
import DecodeHintType from '../core/DecodeHintType';
import Result from '../core/Result';
import './wasmSetup';
export declare class BrowserMultiFormatReader extends BrowserCodeReader {
    protected readonly reader: MultiFormatReader;
    /** Cached downscale canvas for WASM processing */
    private _wasmCanvas;
    private _wasmCtx;
    /** Configurable max pixel dimension for WASM downscaling */
    private _wasmMaxDimension;
    get hints(): Map<DecodeHintType, any>;
    set hints(hints: Map<DecodeHintType, any>);
    /**
     * @param hints Decode hints (e.g. POSSIBLE_FORMATS)
     * @param timeBetweenScansMillis Delay between decode attempts (default 500)
     * @param wasmMaxDimension Max pixel dimension before downscaling for WASM (default 640).
     *        Increase for high-density barcodes, decrease for faster processing on slow devices.
     */
    constructor(hints?: Map<DecodeHintType, any>, timeBetweenScansMillis?: number, wasmMaxDimension?: number);
    /**
     * Overwrite decodeBitmap to call decodeWithState, which will pay
     * attention to the hints set in the constructor function
     */
    decodeBitmap(binaryBitmap: BinaryBitmap): Result;
    /**
     * Get the zxing-wasm format strings based on POSSIBLE_FORMATS hint.
     * Returns undefined to scan all formats when no specific formats are set.
     */
    private getWasmFormats;
    /**
     * Get or create a downscaled canvas for WASM processing.
     * Reuses the canvas if dimensions haven't changed.
     */
    private getWasmCanvas;
    /**
     * WASM-backed async decode. Uses zxing-wasm readBarcodes for fast multi-format
     * barcode detection. Pre-downscales large frames for faster processing.
     * Falls back to the pure TypeScript decoder if WASM is unavailable.
     */
    decodeAsync(element: HTMLVisualMediaElement): Promise<Result>;
    reset(): void;
    /**
     * Extract ResultPoint array from WASM result, scaling coordinates back
     * to the original video resolution.
     */
    private static extractResultPoints;
}

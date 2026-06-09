import { BrowserCodeReader } from './BrowserCodeReader';
import { HTMLVisualMediaElement } from './HTMLVisualMediaElement';
import MultiFormatReader from '../core/MultiFormatReader';
import BinaryBitmap from '../core/BinaryBitmap';
import BarcodeFormat from '../core/BarcodeFormat';
import DecodeHintType from '../core/DecodeHintType';
import NotFoundException from '../core/NotFoundException';
import Result from '../core/Result';
import ResultPoint from '../core/ResultPoint';

// Import zxing-wasm - will be bundled in UMD builds
import { readBarcodes } from 'zxing-wasm/reader';

// Ensure WASM locateFile override is configured exactly once
import './wasmSetup';

/** Options for zxing-wasm readBarcodes function. */
interface ZXingWasmReaderOptions {
    formats?: string[];
    tryHarder?: boolean;
    tryRotate?: boolean;
    tryInvert?: boolean;
    tryDownscale?: boolean;
    maxNumberOfSymbols?: number;
}

/** Result from zxing-wasm readBarcodes function. */
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

/** Mapping from zxing-wasm format strings to BarcodeFormat enum values */
const WASM_FORMAT_TO_BARCODE_FORMAT: Record<string, BarcodeFormat> = {
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
const BARCODE_FORMAT_TO_WASM: Record<number, string> = {
    [BarcodeFormat.AZTEC]: 'Aztec',
    [BarcodeFormat.CODABAR]: 'Codabar',
    [BarcodeFormat.CODE_39]: 'Code39',
    [BarcodeFormat.CODE_93]: 'Code93',
    [BarcodeFormat.CODE_128]: 'Code128',
    [BarcodeFormat.RSS_14]: 'DataBar',
    [BarcodeFormat.RSS_EXPANDED]: 'DataBarExpanded',
    [BarcodeFormat.DATA_MATRIX]: 'DataMatrix',
    [BarcodeFormat.EAN_8]: 'EAN-8',
    [BarcodeFormat.EAN_13]: 'EAN-13',
    [BarcodeFormat.ITF]: 'ITF',
    [BarcodeFormat.PDF_417]: 'PDF417',
    [BarcodeFormat.QR_CODE]: 'QRCode',
    [BarcodeFormat.UPC_A]: 'UPC-A',
    [BarcodeFormat.UPC_E]: 'UPC-E',
};

/**
 * Default max pixel dimension for WASM processing. Frames larger than this are
 * downscaled before passing to readBarcodes, dramatically improving
 * frame rate (and thus detection reliability) for live camera feeds.
 * 640px is sufficient for all common barcode types from camera.
 */
const DEFAULT_WASM_MAX_DIMENSION = 640;

/**
 * Linear (1D) formats scanned by default when no POSSIBLE_FORMATS hint is set.
 */
const DEFAULT_LINEAR_FORMATS: string[] = [
  'Codabar', 'Code39', 'Code93', 'Code128',
  'DataBar', 'DataBarExpanded',
  'EAN-8', 'EAN-13', 'ITF',
  'UPC-A', 'UPC-E',
];

/**
 * zxing-wasm format strings that are linear (1D) barcodes.
 * Used to apply geometry validation to 1D results, since 1D detectors can
 * occasionally find spurious matches in dense 2D module noise.
 */
const LINEAR_FORMAT_SET = new Set<string>([
  'Codabar', 'Code39', 'Code93', 'Code128',
  'DataBar', 'DataBarExpanded',
  'EAN-8', 'EAN-13', 'ITF',
  'UPC-A', 'UPC-E',
]);

/**
 * A real 1D barcode the user is pointing the camera at has a wide-and-short
 * detection box. False positives from 2D module noise have a roughly square
 * (or near-square) detection box. Reject 1D results whose detected width is
 * less than this multiple of the detected height.
 */
const MIN_LINEAR_ASPECT_RATIO = 1.5;

/**
 * A real 1D barcode detection forms a near-rectangle, so the corner at topLeft
 * (between the top edge and the left edge) is close to 90 degrees even when
 * captured at a camera angle. False positives from 2D module noise often form
 * a heavily skewed parallelogram whose corners deviate far from perpendicular.
 * Allow up to this many degrees of deviation from 90.
 */
const MAX_LINEAR_CORNER_ANGLE_DEVIATION_DEG = 10;

/**
 * Returns true if the result has acceptable geometry. Always true for 2D
 * formats and for results without position data (we cannot validate). For
 * 1D formats with position data, requires both:
 *   - the detection box to be visibly elongated (width / height >= MIN_LINEAR_ASPECT_RATIO)
 *   - the topLeft corner to be roughly perpendicular (within MAX_LINEAR_CORNER_ANGLE_DEVIATION_DEG of 90 degrees)
 */
function hasValidLinearGeometry(result: ZXingWasmResult): boolean {
  if (!LINEAR_FORMAT_SET.has(result.format)) return true;
  const pos = result.position;
  if (!pos) return true;
  const { topLeft, topRight, bottomLeft } = pos;
  if (!topLeft || !topRight || !bottomLeft) return true;

  const wdx = topRight.x - topLeft.x;
  const wdy = topRight.y - topLeft.y;
  const width = Math.sqrt(wdx * wdx + wdy * wdy);

  const hdx = bottomLeft.x - topLeft.x;
  const hdy = bottomLeft.y - topLeft.y;
  const height = Math.sqrt(hdx * hdx + hdy * hdy);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) {
    return true;
  }

  // Aspect ratio: width must dominate
  if (width / height < MIN_LINEAR_ASPECT_RATIO) return false;

  // Corner angle at topLeft: angle between the top edge and the left edge.
  // For a real (possibly perspective-distorted) rectangle this is near 90 deg.
  const dot = wdx * hdx + wdy * hdy;
  const cosAngle = dot / (width * height);
  // Clamp to [-1, 1] to defend against floating point drift
  const clamped = Math.max(-1, Math.min(1, cosAngle));
  const angleDeg = Math.acos(clamped) * 180 / Math.PI;
  if (Math.abs(angleDeg - 90) > MAX_LINEAR_CORNER_ANGLE_DEVIATION_DEG) return false;

  return true;
}

export class BrowserMultiFormatReader extends BrowserCodeReader {

  protected readonly reader: MultiFormatReader;

  /** Cached downscale canvas for WASM processing */
  private _wasmCanvas: HTMLCanvasElement | null = null;
  private _wasmCtx: CanvasRenderingContext2D | null = null;

  /** Configurable max pixel dimension for WASM downscaling */
  private _wasmMaxDimension: number;

  get hints(): Map<DecodeHintType, any> {
    return this._hints;
  }

  set hints(hints: Map<DecodeHintType, any>) {
    this._hints = hints || null;

    // Since we don't pass the hints in `decodeBitmap` as other Browser readers do, we need to set them here.
    this.reader.setHints(hints);
  }

  /**
   * @param hints Decode hints (e.g. POSSIBLE_FORMATS)
   * @param timeBetweenScansMillis Delay between decode attempts (default 500)
   * @param wasmMaxDimension Max pixel dimension before downscaling for WASM (default 640).
   *        Increase for high-density barcodes, decrease for faster processing on slow devices.
   */
  public constructor(
    hints: Map<DecodeHintType, any> = null,
    timeBetweenScansMillis: number = 500,
    wasmMaxDimension: number = DEFAULT_WASM_MAX_DIMENSION
  ) {
    const reader = new MultiFormatReader();
    reader.setHints(hints);
    super(reader, timeBetweenScansMillis, hints);
    this._wasmMaxDimension = wasmMaxDimension > 0 ? wasmMaxDimension : DEFAULT_WASM_MAX_DIMENSION;
  }

  /**
   * Overwrite decodeBitmap to call decodeWithState, which will pay
   * attention to the hints set in the constructor function
   */
  public decodeBitmap(binaryBitmap: BinaryBitmap): Result {
    try {
      return this.reader.decodeWithState(binaryBitmap);
    } finally {
      // Readers need to be reset before being reused on another bitmap.
      this.reader.reset();
    }
  }

  /**
   * Get the zxing-wasm format strings based on POSSIBLE_FORMATS hint.
   * Returns undefined to scan all formats when no specific formats are set.
   */
  private getWasmFormats(): string[] | undefined {
    const hints = this._hints;
    if (!hints) return undefined;

    const possibleFormats = hints.get(DecodeHintType.POSSIBLE_FORMATS) as BarcodeFormat[];
    if (!possibleFormats || possibleFormats.length === 0) return undefined;

    const wasmFormats: string[] = [];
    for (const format of possibleFormats) {
      const wf = BARCODE_FORMAT_TO_WASM[format];
      if (wf) wasmFormats.push(wf);
    }

    return wasmFormats.length > 0 ? wasmFormats : undefined;
  }

  /**
   * Get or create a downscaled canvas for WASM processing.
   * Reuses the canvas if dimensions haven't changed.
   */
  private getWasmCanvas(srcWidth: number, srcHeight: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; scale: number } | null {
    const maxDim = Math.max(srcWidth, srcHeight);
    const scale = maxDim > this._wasmMaxDimension ? this._wasmMaxDimension / maxDim : 1;
    const dstWidth = Math.round(srcWidth * scale);
    const dstHeight = Math.round(srcHeight * scale);

    if (!this._wasmCanvas || this._wasmCanvas.width !== dstWidth || this._wasmCanvas.height !== dstHeight) {
      if (typeof document === 'undefined') return null;
      this._wasmCanvas = document.createElement('canvas');
      this._wasmCanvas.width = dstWidth;
      this._wasmCanvas.height = dstHeight;
      try {
        this._wasmCtx = this._wasmCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      } catch {
        this._wasmCtx = this._wasmCanvas.getContext('2d');
      }
    }

    return { canvas: this._wasmCanvas, ctx: this._wasmCtx, scale };
  }

  /**
   * WASM-backed async decode. Uses zxing-wasm readBarcodes for fast multi-format
   * barcode detection. Pre-downscales large frames for faster processing.
   * Falls back to the pure TypeScript decoder if WASM is unavailable.
   */
  public async decodeAsync(element: HTMLVisualMediaElement): Promise<Result> {
    if (typeof readBarcodes !== 'function') {
      return super.decodeAsync(element);
    }

    try {
      // Get source dimensions
      let srcWidth: number;
      let srcHeight: number;

      if (element instanceof HTMLVideoElement) {
        if (element.readyState < 2) {
          throw new Error(`Video not ready (readyState: ${element.readyState})`);
        }
        srcWidth = element.videoWidth;
        srcHeight = element.videoHeight;
        if (!srcWidth || !srcHeight) {
          throw new Error(`Invalid video dimensions: ${srcWidth}x${srcHeight}`);
        }
      } else if (element instanceof HTMLImageElement) {
        if (!element.complete) {
          throw new Error('Image not loaded');
        }
        srcWidth = element.naturalWidth || element.width;
        srcHeight = element.naturalHeight || element.height;
        if (!srcWidth || !srcHeight) {
          throw new Error(`Invalid image dimensions`);
        }
      } else {
        throw new Error('Unsupported element type');
      }

      // Get downscaled canvas for WASM processing
      const wasm = this.getWasmCanvas(srcWidth, srcHeight);
      if (!wasm || !wasm.ctx) {
        throw new Error('Failed to create WASM canvas');
      }

      const { canvas, ctx, scale } = wasm;

      // Validate dimensions before drawing
      if (canvas.width <= 0 || canvas.height <= 0) {
        throw new Error(`Invalid WASM canvas dimensions: ${canvas.width}x${canvas.height}`);
      }

      // Draw element scaled down onto the WASM canvas
      ctx.drawImage(element as any, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (!imageData || !imageData.data) {
        throw new Error('Failed to get image data');
      }

      const wasmFormats = this.getWasmFormats();

      const baseOptions: ZXingWasmReaderOptions = {
        tryHarder: true,
        tryRotate: false,
        tryInvert: false,
        tryDownscale: false,
        maxNumberOfSymbols: 1,
      };

      const runWasm = async (formats: string[]): Promise<any> => {
        const r = readBarcodes(imageData, { ...baseOptions, formats } as any);
        const isPromise = r != null && typeof r === 'object' && typeof (r as any).then === 'function';
        return isPromise ? await r : r;
      };

      // Also require a mappable format so that 2D codes outside our 15-entry mapping
      // (e.g., MicroQRCode, rMQRCode, MaxiCode) do not block the Linear-Codes fallback.
      const isValidResult = (r: any) =>
        Array.isArray(r) && r.length > 0 && r[0] && r[0].isValid &&
        typeof r[0].text === 'string' &&
        WASM_FORMAT_TO_BARCODE_FORMAT[r[0].format] !== undefined;

      // When scanning all formats, prefer 2D (Matrix) over 1D (Linear) to mirror the
      // original MultiFormatReader behavior. This avoids 1D false positives in dense
      // QR codes.
      let results: any;
      if (wasmFormats) {
        results = await runWasm(wasmFormats);
      } else {
        results = await runWasm(['Matrix-Codes']);
        if (!isValidResult(results)) {
          results = await runWasm(DEFAULT_LINEAR_FORMATS);
        }
      }

      if (!results) throw new NotFoundException();

      const resultsArray = Array.isArray(results) ? results : [results];
      if (resultsArray.length === 0) throw new NotFoundException();

      const first = resultsArray[0] as ZXingWasmResult;
      if (!first || !first.isValid) throw new NotFoundException();
      if (first.text === null || first.text === undefined || typeof first.text !== 'string') {
        throw new NotFoundException();
      }

      const barcodeFormat = WASM_FORMAT_TO_BARCODE_FORMAT[first.format];
      if (barcodeFormat === undefined) {
        throw new NotFoundException();
      }

      // Reject 1D results whose detection box is roughly square or taller-than-wide.
      // These are noise-driven false positives from 2D module patterns (the QR code
      // case the demo surfaced). Real 1D barcodes pointed at the camera always have
      // a visibly elongated detection box.
      if (!hasValidLinearGeometry(first)) {
        throw new NotFoundException();
      }

      // Extract points and scale back to original video resolution
      const points = BrowserMultiFormatReader.extractResultPoints(first, scale);

      return new Result(first.text, null, 0, points ?? [], barcodeFormat);
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      // Distinguish security errors (CORS) — these won't be fixed by falling back
      if (e instanceof DOMException && e.name === 'SecurityError') {
        this._wasmCanvas = null;
        this._wasmCtx = null;
        throw new Error('Canvas is tainted (CORS). Ensure media has proper cross-origin headers.');
      }
      // For WASM load/runtime errors, fall back to pure TypeScript decoder
      return super.decodeAsync(element);
    }
  }

  public reset() {
    super.reset();
    this._wasmCanvas = null;
    this._wasmCtx = null;
  }

  /**
   * Extract ResultPoint array from WASM result, scaling coordinates back
   * to the original video resolution.
   */
  private static extractResultPoints(result: ZXingWasmResult, scale: number): ResultPoint[] | null {
    if (!result.position) return null;

    const { topLeft, topRight, bottomRight, bottomLeft } = result.position;

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
    const invScale = 1 / scale;
    return [
      new ResultPoint(topLeft.x * invScale, topLeft.y * invScale),
      new ResultPoint(topRight.x * invScale, topRight.y * invScale),
      new ResultPoint(bottomRight.x * invScale, bottomRight.y * invScale),
      new ResultPoint(bottomLeft.x * invScale, bottomLeft.y * invScale),
    ];
  }
}

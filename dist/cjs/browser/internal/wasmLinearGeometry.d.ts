/**
 * Internal helpers for the WASM scan path inside BrowserMultiFormatReader.
 *
 * NOTE: This module is intentionally kept out of the package root re-exports
 * (`src/browser.ts` and `src/index.ts`). The types and functions here are
 * implementation details of the default-scan heuristic, not public API:
 *   - `ZXingWasmResult` mirrors a third-party (zxing-wasm) shape that may
 *     change between versions.
 *   - `hasValidLinearGeometry` is a heuristic threshold-based filter intended
 *     for internal use and is subject to tuning without semver impact.
 *
 * Tests import this module directly via its relative path.
 */
/** Result from zxing-wasm readBarcodes function. Internal mirror only. */
export interface ZXingWasmResult {
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
 * Linear (1D) zxing-wasm format strings scanned by default when no
 * POSSIBLE_FORMATS hint is set. Single source of truth for the default 1D
 * fallback list.
 *
 * Includes the DataBar family (`DataBar` / RSS-14 and `DataBarExpanded` /
 * RSS Expanded). Those detectors are permissive enough that they can match
 * spurious GS1 patterns inside dense 2D module noise (notably QR codes),
 * which is why `hasValidLinearGeometry` below additionally rejects 1D
 * detections whose bounding box is roughly square or heavily skewed: the
 * geometric signature of those noise-driven matches. Trade-off: stacked
 * variants of DataBar Expanded that legitimately fit a non-elongated box
 * will not decode under the default no-hint scan. Callers that need
 * stacked-DataBar Expanded support should pass a `POSSIBLE_FORMATS` hint
 * including `BarcodeFormat.RSS_EXPANDED`, which bypasses the geometry
 * check.
 *
 * Exported as `readonly string[]` (and frozen at runtime) to prevent
 * accidental mutation.
 */
export declare const DEFAULT_LINEAR_FORMATS: readonly string[];
/**
 * A real 1D barcode the user is pointing the camera at has a clearly elongated
 * detection box (long edge dominates the short edge). False positives from 2D
 * module noise have a roughly square (or near-square) detection box. Reject 1D
 * results whose long-side / short-side ratio is below this. Orientation-
 * independent: applies whether the barcode is captured landscape or portrait.
 */
export declare const MIN_LINEAR_ASPECT_RATIO = 1.5;
/**
 * A real 1D barcode detection forms a near-rectangle, so the corner at topLeft
 * (between the top edge and the left edge) is close to 90 degrees even when
 * captured at a camera angle. False positives from 2D module noise often form
 * a heavily skewed parallelogram whose corners deviate far from perpendicular.
 * Allow up to this many degrees of deviation from 90.
 */
export declare const MAX_LINEAR_CORNER_ANGLE_DEVIATION_DEG = 10;
/**
 * Returns true if the result has acceptable geometry to be accepted under a
 * default (no-hint) scan. Always true for 2D formats and for results whose
 * position field is entirely absent (the WASM library may legitimately omit
 * it). For 1D formats with a position object present, requires both:
 *   - the detection box to be visibly elongated (max(width, height) /
 *     min(width, height) >= MIN_LINEAR_ASPECT_RATIO, orientation-independent)
 *   - the topLeft corner to be roughly perpendicular (within
 *     MAX_LINEAR_CORNER_ANGLE_DEVIATION_DEG of 90 degrees)
 * A position object that exists but is missing any of the three corners used
 * by the checks is treated as invalid geometry, as is degenerate (non-finite
 * or zero) width/height.
 *
 * Only intended for the default-scan (no POSSIBLE_FORMATS hint) path. The
 * gating logic in `BrowserMultiFormatReader.decodeAsync` skips this check
 * when the caller has explicitly opted into a format set via
 * `POSSIBLE_FORMATS`, so callers that need to decode legitimately
 * non-elongated codes (e.g., stacked DataBar Expanded) can do so by passing
 * the appropriate hint.
 */
export declare function hasValidLinearGeometry(result: ZXingWasmResult): boolean;

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
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
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
export const DEFAULT_LINEAR_FORMATS: readonly string[] = Object.freeze([
  'Codabar', 'Code39', 'Code93', 'Code128',
  'DataBar', 'DataBarExpanded',
  'EAN-8', 'EAN-13', 'ITF',
  'UPC-A', 'UPC-E',
]);

/**
 * zxing-wasm format strings that are linear (1D) barcodes. Derived from
 * DEFAULT_LINEAR_FORMATS so the two cannot drift out of sync.
 * Used internally by `hasValidLinearGeometry` to gate the geometry
 * validation to 1D results only. Module-private (not exported) so callers
 * cannot mutate the shared Set at runtime.
 */
const LINEAR_FORMAT_SET: ReadonlySet<string> = new Set(DEFAULT_LINEAR_FORMATS);

/**
 * A real 1D barcode the user is pointing the camera at has a clearly elongated
 * detection box (long edge dominates the short edge). False positives from 2D
 * module noise have a roughly square (or near-square) detection box. Reject 1D
 * results whose long-side / short-side ratio is below this. Orientation-
 * independent: applies whether the barcode is captured landscape or portrait.
 */
export const MIN_LINEAR_ASPECT_RATIO = 1.5;

/**
 * A real 1D barcode detection forms a near-rectangle, so the corner at topLeft
 * (between the top edge and the left edge) is close to 90 degrees even when
 * captured at a camera angle. False positives from 2D module noise often form
 * a heavily skewed parallelogram whose corners deviate far from perpendicular.
 * Allow up to this many degrees of deviation from 90.
 */
export const MAX_LINEAR_CORNER_ANGLE_DEVIATION_DEG = 10;

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
export function hasValidLinearGeometry(result: ZXingWasmResult): boolean {
  if (!LINEAR_FORMAT_SET.has(result.format)) return true;
  const pos = result.position;
  // No position object at all: the WASM library may legitimately omit it,
  // so we cannot validate. Be permissive.
  if (!pos) return true;
  // Position object exists but is missing any of the corners we need: this
  // is malformed/partial data — treat as invalid for a linear format.
  const { topLeft, topRight, bottomLeft } = pos;
  if (!topLeft || !topRight || !bottomLeft) return false;

  const wdx = topRight.x - topLeft.x;
  const wdy = topRight.y - topLeft.y;
  const width = Math.sqrt(wdx * wdx + wdy * wdy);

  const hdx = bottomLeft.x - topLeft.x;
  const hdy = bottomLeft.y - topLeft.y;
  const height = Math.sqrt(hdx * hdx + hdy * hdy);

  // Degenerate position data on a 1D format result is itself suspicious; reject
  // rather than allow noise-driven matches through.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) {
    return false;
  }

  // Aspect ratio: one side must dominate the other. Orientation-independent so
  // a 1D barcode rotated 90 degrees (long edge along topLeft->bottomLeft) is
  // still accepted.
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  if (longSide / shortSide < MIN_LINEAR_ASPECT_RATIO) return false;

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

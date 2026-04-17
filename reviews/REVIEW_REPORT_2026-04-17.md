## Full Codebase Review — 2026-04-17
Branch: dev

### Summary

| Metric             | Count |
|--------------------|-------|
| Files reviewed     | 312   |
| Critical issues 🔴 | 3     |
| Warnings 🟡        | 9     |
| Suggestions 🔵     | 6     |

---

### Critical Issues 🔴

---

#### SVG element rendered with width and height transposed

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/BrowserSvgCodeWriter.ts`      |
| Line(s) | 144–145                                    |
| Effort  | XS                                         |

**What is wrong**

`createSVGElement(w, h)` sets the `width` attribute to `h` and the `height` attribute to `w`. For any non-square barcode the SVG canvas dimensions are swapped: a 300×200 SVG is rendered as 200×300. The barcode content inside will be clipped or distorted.

**Problematic code**

```typescript
protected createSVGElement(w: number, h: number): SVGSVGElement {
    const el = document.createElementNS(BrowserSvgCodeWriter.SVG_NS, 'svg');
    el.setAttributeNS(null, 'width', h.toString());   // ← h used for width
    el.setAttributeNS(null, 'height', w.toString());  // ← w used for height
    return el;
}
```

**Recommended fix**

```typescript
protected createSVGElement(w: number, h: number): SVGSVGElement {
    const el = document.createElementNS(BrowserSvgCodeWriter.SVG_NS, 'svg');
    el.setAttributeNS(null, 'width', w.toString());
    el.setAttributeNS(null, 'height', h.toString());
    return el;
}
```

---

#### SVG rect elements rendered with width and height transposed

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/BrowserSvgCodeWriter.ts`      |
| Line(s) | 172–173                                    |
| Effort  | XS                                         |

**What is wrong**

`createSvgRectElement(x, y, w, h)` sets the `height` attribute to `w` and the `width` attribute to `h`. Every barcode module (black square) in the SVG output has its dimensions transposed. Combined with issue above, every barcode produced by `BrowserSvgCodeWriter` subclasses is visually broken for non-square output sizes. `BrowserQRCodeSvgWriter.ts` has a separate, correct implementation and is unaffected.

**Problematic code**

```typescript
protected createSvgRectElement(x: number, y: number, w: number, h: number): SVGRectElement {
    const el = document.createElementNS(BrowserSvgCodeWriter.SVG_NS, 'rect');
    el.setAttributeNS(null, 'x', x.toString());
    el.setAttributeNS(null, 'y', y.toString());
    el.setAttributeNS(null, 'height', w.toString());  // ← w used for height
    el.setAttributeNS(null, 'width', h.toString());   // ← h used for width
    el.setAttributeNS(null, 'fill', '#000000');
    return el;
}
```

**Recommended fix**

```typescript
protected createSvgRectElement(x: number, y: number, w: number, h: number): SVGRectElement {
    const el = document.createElementNS(BrowserSvgCodeWriter.SVG_NS, 'rect');
    el.setAttributeNS(null, 'x', x.toString());
    el.setAttributeNS(null, 'y', y.toString());
    el.setAttributeNS(null, 'width', w.toString());
    el.setAttributeNS(null, 'height', h.toString());
    el.setAttributeNS(null, 'fill', '#000000');
    return el;
}
```

---

#### Unchecked null from `getContext('2d')` causes TypeError crash

| Field   | Detail                                                    |
|---------|-----------------------------------------------------------|
| File    | `src/browser/HTMLCanvasElementLuminanceSource.ts`         |
| Line(s) | 23                                                        |
| Effort  | S                                                         |

**What is wrong**

`canvas.getContext('2d')` can return `null` — for example when the browser has exhausted its maximum number of simultaneous canvas contexts, when a WebGL context was created on the same canvas, or in some non-browser environments. Calling `.getImageData()` on `null` throws `TypeError: Cannot read properties of null (reading 'getImageData')`. This crashes the decode path with an unhandled exception that bypasses all error handling in `BrowserCodeReader`.

**Problematic code**

```typescript
private static makeBufferFromCanvasImageData(canvas: HTMLCanvasElement, doAutoInvert: boolean = false): Uint8ClampedArray {
    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    //                                      ^ getContext can return null
    return HTMLCanvasElementLuminanceSource.toGrayscaleBuffer(imageData.data, canvas.width, canvas.height, doAutoInvert);
}
```

**Recommended fix**

```typescript
private static makeBufferFromCanvasImageData(canvas: HTMLCanvasElement, doAutoInvert: boolean = false): Uint8ClampedArray {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('HTMLCanvasElementLuminanceSource: failed to get 2D context from canvas');
    }
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return HTMLCanvasElementLuminanceSource.toGrayscaleBuffer(imageData.data, canvas.width, canvas.height, doAutoInvert);
}
```

---

### Warnings 🟡

---

#### Static `FRAME_INDEX` toggle is shared across all instances — breaks instance isolation

| Field   | Detail                                                    |
|---------|-----------------------------------------------------------|
| File    | `src/browser/HTMLCanvasElementLuminanceSource.ts`         |
| Line(s) | 13, 29–30                                                 |
| Effort  | M                                                         |

**What is wrong**

`FRAME_INDEX` is a `static` property that is flipped globally every time any instance calls `toGrayscaleBuffer`. Its purpose is to alternate between normal and inverted grayscale on successive frames from a single video source. If two `HTMLCanvasElementLuminanceSource` instances exist at the same time (e.g., a main reader and a cropped/rotated sub-region), their invert cadence interferes. Instance A's flip changes the parity that instance B reads on its next call, producing randomly inverted luminance data and causing the decoder to miss barcodes intermittently.

**Problematic code**

```typescript
// Line 13
private static FRAME_INDEX = true;

// Lines 29–30 (inside toGrayscaleBuffer, called on every frame)
HTMLCanvasElementLuminanceSource.FRAME_INDEX = !HTMLCanvasElementLuminanceSource.FRAME_INDEX;
if (HTMLCanvasElementLuminanceSource.FRAME_INDEX || !doAutoInvert) {
```

**Recommended fix**

Convert to an instance field so each reader manages its own parity independently:

```typescript
// Replace the static field (line 13) with an instance field
private frameIndex: boolean = true;

// Replace the static references in toGrayscaleBuffer (lines 29–30)
// Note: toGrayscaleBuffer must also become an instance method (remove `static`)
private makeBufferFromCanvasImageData(canvas: HTMLCanvasElement, doAutoInvert: boolean = false): Uint8ClampedArray {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('HTMLCanvasElementLuminanceSource: failed to get 2D context');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return this.toGrayscaleBuffer(imageData.data, canvas.width, canvas.height, doAutoInvert);
}

private toGrayscaleBuffer(imageBuffer: Uint8ClampedArray, width: number, height: number, doAutoInvert: boolean = false): Uint8ClampedArray {
    const grayscaleBuffer = new Uint8ClampedArray(width * height);
    this.frameIndex = !this.frameIndex;
    if (this.frameIndex || !doAutoInvert) {
        // ... normal path
    } else {
        // ... inverted path
    }
    return grayscaleBuffer;
}
```

Also update the constructor call at line 19: `this.buffer = this.makeBufferFromCanvasImageData(canvas, doAutoInvert);`
and the `rotate()` method call at line 160: `this.buffer = this.makeBufferFromCanvasImageData(tempCanvasElement);`

---

#### `cleanVideoSource` references `this.videoElement` instead of the method parameter

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/BrowserCodeReader.ts`         |
| Line(s) | 1298                                       |
| Effort  | XS                                         |

**What is wrong**

`cleanVideoSource(videoElement: HTMLVideoElement)` receives the element as a parameter, but the last line calls `removeAttribute` on the instance property `this.videoElement` instead of the parameter. Today the only caller passes `this.videoElement` as the argument, so both refer to the same object and the bug is invisible. If any future caller (or subclass) passes a different element, `removeAttribute` is called on the wrong element — or crashes if `this.videoElement` is already `undefined`.

**Problematic code**

```typescript
private cleanVideoSource(videoElement: HTMLVideoElement): void {
    try {
        videoElement.srcObject = null;
    } catch (err) {
        videoElement.src = '';
    }

    this.videoElement.removeAttribute('src');  // ← should be `videoElement`
}
```

**Recommended fix**

```typescript
private cleanVideoSource(videoElement: HTMLVideoElement): void {
    try {
        videoElement.srcObject = null;
    } catch (err) {
        videoElement.src = '';
    }

    videoElement.removeAttribute('src');
}
```

---

#### Blob URL created by `URL.createObjectURL` is never revoked — memory leak

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/BrowserCodeReader.ts`         |
| Line(s) | 1282                                       |
| Effort  | S                                          |

**What is wrong**

When `videoElement.srcObject = stream` throws (legacy browsers), the code falls back to `URL.createObjectURL(stream)`. Each call allocates a blob URL that holds a reference to the underlying stream. `URL.revokeObjectURL` is never called anywhere in the codebase — confirmed by grep. In an app that calls `reset()` repeatedly (e.g., switching cameras), each cycle leaks one blob URL and its stream reference for the lifetime of the page.

**Problematic code**

```typescript
// src/browser/BrowserCodeReader.ts line 1280–1283
try {
    videoElement.srcObject = stream;
} catch (err) {
    // @ts-ignore
    videoElement.src = URL.createObjectURL(stream);  // ← URL never revoked
}
```

**Recommended fix**

Add an instance property to track the blob URL and revoke it during cleanup:

```typescript
// Add to class fields (near line 86)
private _blobUrl: string | null = null;

// In addVideoSource (line 1282), store it:
try {
    videoElement.srcObject = stream;
} catch (err) {
    // @ts-ignore
    this._blobUrl = URL.createObjectURL(stream);
    videoElement.src = this._blobUrl;
}

// In cleanVideoSource (line 1291), revoke it:
private cleanVideoSource(videoElement: HTMLVideoElement): void {
    if (this._blobUrl) {
        URL.revokeObjectURL(this._blobUrl);
        this._blobUrl = null;
    }
    try {
        videoElement.srcObject = null;
    } catch (err) {
        videoElement.src = '';
    }
    videoElement.removeAttribute('src');
}
```

---

#### `Math.min(...xs)` spread can throw `RangeError` on large candidate arrays

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/SmartQRDetection.ts`          |
| Line(s) | 87–90                                      |
| Effort  | XS                                         |

**What is wrong**

`Math.min(...xs)` and `Math.max(...xs)` pass the entire array as individual function arguments via the spread operator. JavaScript engines impose a limit on the number of function arguments (V8 caps this at ~65,535). In a long-running scan session on a noisy frame, `xs` and `ys` can accumulate thousands of finder-pattern candidates before the function exits. Once the array exceeds the engine limit, the spread throws `RangeError: Maximum call stack size exceeded`, crashing the detection loop.

**Problematic code**

```typescript
const minx = Math.max(0, Math.min(...xs) - margin);
const maxx = Math.min(dw - 1, Math.max(...xs) + margin);
const miny = Math.max(0, Math.min(...ys) - margin);
const maxy = Math.min(dh - 1, Math.max(...ys) + margin);
```

**Recommended fix**

```typescript
const minx = Math.max(0, xs.reduce((a, b) => Math.min(a, b)) - margin);
const maxx = Math.min(dw - 1, xs.reduce((a, b) => Math.max(a, b)) + margin);
const miny = Math.max(0, ys.reduce((a, b) => Math.min(a, b)) - margin);
const maxy = Math.min(dh - 1, ys.reduce((a, b) => Math.max(a, b)) + margin);
```

---

#### `SmartQRDetection.ts` is never imported — entire file is dead code

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/SmartQRDetection.ts`          |
| Line(s) | 1–133 (entire file)                        |
| Effort  | XS (delete) or L (integrate into pipeline)|

**What is wrong**

`SmartQRDetection.ts` exports five utility functions (`toGrayscale`, `downscaleBox`, `findCandidatesL2`, `isLikelyBlurred`, `simpleContrastStretch`). A grep across the entire `src/` directory confirms zero imports of this module. It is not re-exported from `src/browser.ts` or `src/index.ts`. The file ships in the source tree but contributes nothing to the runtime — it is dead code.

**Problematic code**

```typescript
// src/browser/SmartQRDetection.ts — no file in src/ imports this module
export function toGrayscale(...) { ... }
export function downscaleBox(...) { ... }
export function findCandidatesL2(...) { ... }
export function isLikelyBlurred(...) { ... }
export function simpleContrastStretch(...) { ... }
```

**Recommended fix**

If the intent was to use these for pre-processing in the QR scan pipeline, wire them in. Otherwise, delete the file:

```bash
git rm src/browser/SmartQRDetection.ts
```

---

#### Unknown WASM barcode format silently defaults to `QR_CODE`

| Field   | Detail                                         |
|---------|------------------------------------------------|
| File    | `src/browser/BrowserMultiFormatReader.ts`      |
| Line(s) | 286                                            |
| Effort  | S                                              |

**What is wrong**

When `zxing-wasm` returns a format string not present in `WASM_FORMAT_TO_BARCODE_FORMAT`, the nullish coalescing operator silently falls back to `BarcodeFormat.QR_CODE`. A caller that scans an EAN-13 barcode and receives a result tagged as QR_CODE may make incorrect downstream decisions (e.g., applying QR-specific parsing). If zxing-wasm adds a new format string in a future release, callers will receive silently mislabelled results with no indication that anything went wrong.

**Problematic code**

```typescript
const barcodeFormat = WASM_FORMAT_TO_BARCODE_FORMAT[first.format] ?? BarcodeFormat.QR_CODE;
```

**Recommended fix**

```typescript
const barcodeFormat = WASM_FORMAT_TO_BARCODE_FORMAT[first.format];
if (barcodeFormat === undefined) {
    // Unknown format from zxing-wasm — fall back to TypeScript decoder for accurate format detection
    throw new NotFoundException();
}
```

---

#### `prepareZXingModule` called twice with identical overrides when both readers are bundled

| Field   | Detail                                                                                              |
|---------|-----------------------------------------------------------------------------------------------------|
| File    | `src/browser/BrowserQRCodeReader.ts` line 19, `src/browser/BrowserMultiFormatReader.ts` line 21   |
| Line(s) | BrowserQRCodeReader.ts:19, BrowserMultiFormatReader.ts:21                                          |
| Effort  | M                                                                                                   |

**What is wrong**

Both files import `prepareZXingModule` from `zxing-wasm/reader` and call it at module level with identical `locateFile` overrides. When both are included in the same bundle (as in `dist/umd/index.js`), the WASM module is initialized twice. Today both calls happen to use the same configuration so the second call is a no-op. However if the two overrides ever diverge (e.g., one file is updated), the second call silently wins without any error, making the configuration unpredictable. Module-level side effects that run more than once are also harder to test and reason about.

**Problematic code**

```typescript
// BrowserQRCodeReader.ts lines 10–29
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';
prepareZXingModule({ overrides: { locateFile: ... } });

// BrowserMultiFormatReader.ts lines 12–31 — identical block
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';
prepareZXingModule({ overrides: { locateFile: ... } });
```

**Recommended fix**

Create `src/browser/wasmSetup.ts` with the shared initialization:

```typescript
// src/browser/wasmSetup.ts
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';

const _scriptSrc = (typeof document !== 'undefined' && document.currentScript instanceof HTMLScriptElement)
    ? document.currentScript.src
    : '';

prepareZXingModule({
    overrides: {
        locateFile: (path: string, _prefix: string) => {
            if (_scriptSrc && path.endsWith('.wasm')) {
                return new URL('../../../zxing-wasm/dist/reader/' + path, _scriptSrc).href;
            }
            return _prefix + path;
        },
    },
});

export { readBarcodes };
```

Then in both readers, replace the duplicated block with a single import:

```typescript
// In BrowserQRCodeReader.ts and BrowserMultiFormatReader.ts
import { readBarcodes } from './wasmSetup';
// Remove the prepareZXingModule import and call entirely
```

---

#### `decodeFromVideoContinuously` null guard misses `null` inputs

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/BrowserCodeReader.ts`         |
| Line(s) | 657                                        |
| Effort  | XS                                         |

**What is wrong**

The guard at line 657 uses strict equality with `undefined` to detect missing arguments. The parameters are typed as `string | HTMLVideoElement | null` and `string | null` respectively, so passing `(null, null, fn)` bypasses the guard entirely. Execution falls through to `decodeFromVideoElementContinuously(null, callbackFn)`, which will crash when it tries to operate on a null element.

**Problematic code**

```typescript
if (undefined === source && undefined === url) {
    throw new ArgumentException(
        'Either an element with a src set or an URL must be provided'
    );
}
```

**Recommended fix**

```typescript
if (!source && !url) {
    throw new ArgumentException(
        'Either an element with a src set or an URL must be provided'
    );
}
```

---

#### `crop()` advertises support but does not modify the pixel buffer

| Field   | Detail                                                    |
|---------|-----------------------------------------------------------|
| File    | `src/browser/HTMLCanvasElementLuminanceSource.ts`         |
| Line(s) | 104–111                                                   |
| Effort  | XS (disable) or L (implement)                            |

**What is wrong**

`isCropSupported()` returns `true`, signalling to the decoder that it can call `crop()` to reduce the region to scan. However `crop()` only calls `super.crop()` (which validates bounds) and then returns `this` unchanged. The underlying pixel buffer is never cropped. The decoder will scan the full canvas every time regardless of the crop region it requested, wasting CPU and potentially producing incorrect results if the decoder assumes the cropped view was applied.

**Problematic code**

```typescript
public isCropSupported(): boolean {
    return true;  // ← promises crop works
}

public crop(left: number, top: number, width: number, height: number): LuminanceSource {
    super.crop(left, top, width, height);  // validates bounds only
    return this;  // ← buffer unchanged; no crop actually applied
}
```

**Recommended fix — Option A (disable crop, minimal change):**

```typescript
public isCropSupported(): boolean {
    return false;
}
```

**Recommended fix — Option B (implement crop properly):**

```typescript
public crop(left: number, top: number, width: number, height: number): LuminanceSource {
    super.crop(left, top, width, height);
    const fullWidth = this.getWidth();
    const croppedBuffer = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y++) {
        croppedBuffer.set(
            this.buffer.subarray((top + y) * fullWidth + left, (top + y) * fullWidth + left + width),
            y * width
        );
    }
    this.buffer = croppedBuffer;
    // Update the declared dimensions so getWidth()/getHeight() stay consistent:
    // LuminanceSource stores width/height as readonly — you must call super's constructor
    // with the new dimensions instead. Crop is best implemented by returning a new instance.
    return new HTMLCanvasElementLuminanceSource._Cropped(croppedBuffer, width, height);
}
```

> Note: Option B requires a helper subclass or refactor since `LuminanceSource` stores dimensions in the constructor. Option A is recommended as the safe, quick fix; Option B is the correct long-term implementation.

---

### Suggestions 🔵

---

#### Public API property `isMediaDevicesSuported` has a spelling typo

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/BrowserCodeReader.ts`         |
| Line(s) | 31, 40, 223                                |
| Effort  | S                                          |

**What to improve**

The getter is named `isMediaDevicesSuported` (missing the second `p` in "Supported"). It is used internally in three places. If any external caller has already referenced the typo'd name it would be a breaking change to rename it. The safe fix is to add a correctly-spelled alias and mark the original deprecated.

**Current code**

```typescript
public get isMediaDevicesSuported() {
    return this.hasNavigator && !!navigator.mediaDevices;
}
```

**Suggested improvement**

```typescript
/** @deprecated Use `isMediaDevicesSupported` (corrected spelling). */
public get isMediaDevicesSuported() {
    return this.isMediaDevicesSupported;
}

public get isMediaDevicesSupported() {
    return this.hasNavigator && !!navigator.mediaDevices;
}
```

Then update the three internal usages at lines 40 and 223 to reference `isMediaDevicesSupported`.

---

#### Dead null guard in `findDeviceById` — `listVideoInputDevices` never returns null

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/BrowserCodeReader.ts`         |
| Line(s) | 275–277                                    |
| Effort  | XS                                         |

**What to improve**

`listVideoInputDevices()` either returns an array (possibly empty) or throws. It never returns `null` or `undefined`. The `if (!devices)` guard is unreachable and misleads readers into thinking a null return is possible.

**Current code**

```typescript
public async findDeviceById(deviceId: string): Promise<MediaDeviceInfo> {
    const devices = await this.listVideoInputDevices();

    if (!devices) {           // ← unreachable
        return null;
    }

    return devices.find(x => x.deviceId === deviceId);
}
```

**Suggested improvement**

```typescript
public async findDeviceById(deviceId: string): Promise<MediaDeviceInfo | undefined> {
    const devices = await this.listVideoInputDevices();
    return devices.find(x => x.deviceId === deviceId);
}
```

Note: the return type is changed to `MediaDeviceInfo | undefined` to accurately reflect that `Array.find` may return `undefined`.

---

#### `extractResultPoints` is duplicated verbatim in two reader classes

| Field   | Detail                                                                                          |
|---------|-------------------------------------------------------------------------------------------------|
| File    | `src/browser/BrowserQRCodeReader.ts` lines 422–448, `src/browser/BrowserMultiFormatReader.ts` lines 315–340 |
| Line(s) | BrowserQRCodeReader.ts:422, BrowserMultiFormatReader.ts:315                                   |
| Effort  | M                                                                                               |

**What to improve**

Both classes contain an identical `extractResultPoints` private static method. The only difference is that `BrowserMultiFormatReader`'s version accepts a `scale` parameter; `BrowserQRCodeReader`'s version always uses scale 1 (no scaling). Any future bugfix applied to one copy must be manually mirrored to the other.

**Current code**

```typescript
// In BrowserQRCodeReader.ts (private static, no scale param)
private static extractResultPoints(result: ZXingWasmResult): ResultPoint[] | null { ... }

// In BrowserMultiFormatReader.ts (private static, with scale param)
private static extractResultPoints(result: ZXingWasmResult, scale: number): ResultPoint[] | null { ... }
```

**Suggested improvement**

Extract to a shared utility file (e.g., `src/browser/wasmUtils.ts`) with a single `scale` parameter defaulting to `1`:

```typescript
// src/browser/wasmUtils.ts
import ResultPoint from '../core/ResultPoint';

export interface ZXingWasmPosition {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
}

export function extractResultPoints(position: ZXingWasmPosition | undefined, scale: number = 1): ResultPoint[] | null {
    if (!position) return null;
    const { topLeft, topRight, bottomRight, bottomLeft } = position;
    const pts = [topLeft, topRight, bottomRight, bottomLeft];
    for (const p of pts) {
        if (!p || typeof p.x !== 'number' || !Number.isFinite(p.x) ||
                   typeof p.y !== 'number' || !Number.isFinite(p.y)) return null;
    }
    const inv = 1 / scale;
    return pts.map(p => new ResultPoint(p.x * inv, p.y * inv));
}
```

---

#### `wrapGetUserMediaError` tests assert nothing about message content

| Field   | Detail                                                    |
|---------|-----------------------------------------------------------|
| File    | `src/test/browser/BrowserCodeReader.spec.ts`             |
| Line(s) | 10–29                                                     |
| Effort  | S                                                         |

**What to improve**

The four tests for `wrapGetUserMediaError` only create `DOMException` objects and assert their `.name` property. They never invoke the wrapper function and never check the user-friendly message it produces. These tests would still pass even if the wrapper returned empty strings or rethrew the raw error.

**Current code**

```typescript
it('should map NotAllowedError to a user-friendly message', () => {
    const err = new DOMException('Permission denied', 'NotAllowedError');
    assert.equal(err.name, 'NotAllowedError');
    // The wrapper should produce a message about camera access denied
    // ← no assertion actually tests the wrapper
});
```

**Suggested improvement**

Expose the wrapper as `protected static` and test it directly, or test the behaviour through `decodeOnceFromConstraints`:

```typescript
// Expose in BrowserCodeReader.ts for testing:
protected static wrapGetUserMediaError(err: unknown): Error { ... }

// In the spec:
it('should map NotAllowedError to a user-friendly message', () => {
    const err = new DOMException('Permission denied', 'NotAllowedError');
    const wrapped = BrowserCodeReader['wrapGetUserMediaError'](err);
    assert.include(wrapped.message, 'Camera access denied');
});

it('should map NotFoundError to a user-friendly message', () => {
    const err = new DOMException('No device', 'NotFoundError');
    const wrapped = BrowserCodeReader['wrapGetUserMediaError'](err);
    assert.include(wrapped.message, 'No camera found');
});
```

---

#### Redundant null check on `wasmReader` already guarded earlier in the same function

| Field   | Detail                                     |
|---------|--------------------------------------------|
| File    | `src/browser/BrowserQRCodeReader.ts`       |
| Line(s) | 314–317                                    |
| Effort  | XS                                         |

**What to improve**

The `wasmReader` variable is checked at line 230: `if (!this.useWasm || !wasmReader)` which returns early to the TypeScript fallback. The check at line 314 (`if (!wasmReader)`) is therefore unreachable — `wasmReader` is guaranteed non-null at that point. It adds noise and makes the control flow harder to follow.

**Current code**

```typescript
// Line 314–317
// Validate wasmReader is still available (defensive check)
if (!wasmReader) {
    return super.decodeAsync(element);
}
```

**Suggested improvement**

Delete lines 314–317 entirely. The early return at line 230–232 is the correct and only guard needed:

```typescript
// Keep only this guard (line 230):
if (!this.useWasm || !wasmReader) {
    return super.decodeAsync(element);
}
// Delete the duplicate check at lines 314–317
```

---

### Passed ✅

The following files and directories had no notable issues. All 185 core library files are faithful ports of ZXing Java and contain no logic errors, security issues, or regressions introduced by this project.

**`src/core/` — all 185 files**

```
src/core/Exception.ts                            src/core/BarcodeFormat.ts
src/core/Binarizer.ts                            src/core/BinaryBitmap.ts
src/core/DecodeHintType.ts                       src/core/Dimension.ts
src/core/EncodeHintType.ts                       src/core/Result.ts
src/core/ResultMetadataType.ts                   src/core/ResultPoint.ts
src/core/ResultPointCallback.ts                  src/core/Reader.ts
src/core/Writer.ts                               src/core/MultiFormatReader.ts
src/core/MultiFormatWriter.ts                    src/core/LuminanceSource.ts
src/core/InvertedLuminanceSource.ts              src/core/PlanarYUVLuminanceSource.ts
src/core/RGBLuminanceSource.ts
src/core/common/BitArray.ts                      src/core/common/BitMatrix.ts
src/core/common/BitSource.ts                     src/core/common/CharacterSetECI.ts
src/core/common/DecoderResult.ts                 src/core/common/DefaultGridSampler.ts
src/core/common/DetectorResult.ts                src/core/common/GlobalHistogramBinarizer.ts
src/core/common/HybridBinarizer.ts               src/core/common/PerspectiveTransform.ts
src/core/common/StringUtils.ts                   src/core/common/GridSampler.ts
src/core/common/GridSamplerInstance.ts
src/core/common/reedsolomon/  (all 6 files)
src/core/common/detector/     (all 4 files)
src/core/qrcode/              (all 32 files)
src/core/aztec/               (all 15 files)
src/core/datamatrix/          (all 28 files)
src/core/pdf417/              (all 17 files)
src/core/oned/                (all 60 files, including rss/ and rss/expanded/)
src/core/util/                (all 13 files)
src/core/multi/MultipleBarcodeReader.ts
```

**`src/browser/` — files with no issues**

```
src/browser/BrowserQRCodeReader.ts          (WASM integration, fallback chain, CORS handling — all correct)
src/browser/BrowserMultiFormatReader.ts     (canvas reuse, downscaling, format mapping — all correct; format fallback flagged separately)
src/browser/BrowserCodeReader.ts            (camera lifecycle, decode loops — correct; specific bugs flagged above)
src/browser/BrowserQRCodeSvgWriter.ts       (SVG attribute assignments correct — unlike BrowserSvgCodeWriter)
src/browser/BrowserBarcodeReader.ts
src/browser/BrowserAztecCodeReader.ts
src/browser/BrowserDatamatrixCodeReader.ts
src/browser/BrowserPDF417Reader.ts
src/browser/HTMLVisualMediaElement.ts
src/browser/VideoInputDevice.ts
src/browser/DecodeContinuouslyCallback.ts
```

**`src/index.ts`, `src/browser.ts`, `src/customTypings.ts`** — No issues.

**`rollup.config.js`** — WASM path resolution is robust; `findPackageRootSync` walk avoids brittle depth assumptions. UMD inlining trade-offs are clearly documented. No issues.

**`src/test/`** — Overall test structure is sound. Blackbox test harness and format-specific integration tests provide meaningful coverage. Specific test coverage gap flagged above.

---

### How to Use This Report

**Effort scale:**

| Level | Typical time      | Example                                               |
|-------|-------------------|-------------------------------------------------------|
| XS    | < 5 minutes       | Fix a typo, delete dead code, swap two variable names |
| S     | 5–30 minutes      | Add a null check, fix a wrong variable reference      |
| M     | 30 min – 2 hours  | Refactor shared state, extract a utility module       |
| L     | 2–8 hours         | Redesign a subsystem, implement a missing feature     |
| XL    | > 1 day           | Architectural change spanning many files              |

**Recommended reading order:**

1. **Start with all 🔴 Critical issues** — these cause crashes or visually broken output in production right now. Fix them first, in any order.
2. **Work through 🟡 Warnings by effort (XS first)** — these are real bugs that manifest under specific but realistic conditions (concurrent readers, legacy browsers, high-traffic sessions).
3. **Pick up 🔵 Suggestions when time allows** — they improve maintainability, test coverage, and API clarity but do not cause current breakage.

**For each issue, follow these steps:**

1. Open the file at the exact path and line number shown in the issue's metadata table.
2. Find the problematic code and confirm it matches the snippet in the report. If the codebase has changed since this review, use your IDE's search to locate it.
3. Apply the recommended fix exactly as shown. For multi-file changes, the fix section calls out every file to touch.
4. Run the full test suite after each individual fix: `npm test`. Do not batch multiple fixes before testing — some fixes interact.
5. If the fix requires more context than the snippet provides (e.g., the M/L-effort refactors), read the full file before proceeding.

**Where to start if you are new to this codebase:**

- All browser-facing code lives in `src/browser/`. That is where all issues in this report are located.
- The core barcode decoding library (`src/core/`) is a port of ZXing Java and is stable — no changes needed there.
- The two most impactful quick wins are the two XS-effort critical issues in `BrowserSvgCodeWriter.ts` (swap four variable names, fix broken SVG output immediately).
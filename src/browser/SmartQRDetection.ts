export type ROI = { x: number; y: number; w: number; h: number };

export function toGrayscale(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const N = w * h, g = new Uint8Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    g[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000 | 0;
  }
  return g;
}

export function downscaleBox(src: Uint8Array, W: number, H: number, dw: number, dh: number): Uint8Array {
  const out = new Uint8Array(dw * dh);
  const sx = W / dw, sy = H / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.min(H, Math.floor((y + 1) * sy));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.min(W, Math.floor((x + 1) * sx));
      let sum = 0, cnt = 0;
      for (let yy = y0; yy < y1; yy++) {
        let k = yy * W + x0;
        for (let xx = x0; xx < x1; xx++, k++) {
          sum += src[k];
          cnt++;
        }
      }
      out[y * dw + x] = (sum / cnt) | 0;
    }
  }
  return out;
}

export function findCandidatesL2(gray: Uint8Array, W: number, H: number): ROI | undefined {
  // Less aggressive downscaling for large QR codes
  const dw = Math.max(240, (W/2)|0);
  const dh = Math.max(180, (H/2)|0);
  const L2 = downscaleBox(gray, W, H, dw, dh);

  const xs: number[] = [], ys: number[] = [];

  // Scan more lines for better detection
  for (let y = 2; y < dh - 2; y += 1) { // Changed from y += 2 to y += 1
    let last = -1, k = 0;
    const run = [0,0,0,0,0];
    const row = y*dw;

    for (let x = 0; x < dw; x++) {
      const v = L2[row + x] < 128 ? 1 : 0;
      if (k === 0) {
        last = v;
        run[k++] = 1;
        continue;
      }
      if (v === last) {
        run[k-1]++;
        continue;
      }
      last = v;
      run[k++] = 1;
      if (k === 5) {
        const s = run[0]+run[1]+run[2]+run[3]+run[4];
        const scale = s/7;
        // More flexible pattern matching
        const ok =
          Math.abs(run[0]-scale) < scale*0.7 &&    // Increased tolerance
          Math.abs(run[1]-scale) < scale*0.7 &&
          Math.abs(run[2]-3*scale) < 3*scale*0.7 &&
          Math.abs(run[3]-scale) < scale*0.7 &&
          Math.abs(run[4]-scale) < scale*0.7;

        if (ok) {
          const cx = x - run[4] - run[3] - (run[2]>>1);
          xs.push(cx);
          ys.push(y);
        }
        run[0] = run[2];
        run[1] = run[3];
        run[2] = run[4];
        k = 3;
      }
    }
  }

  if (!xs.length) return;

  // More generous bounding box
  const margin = 30;  // Increased from 20
  const minx = Math.max(0, Math.min(...xs) - margin);
  const maxx = Math.min(dw-1, Math.max(...xs) + margin);
  const miny = Math.max(0, Math.min(...ys) - margin);
  const maxy = Math.min(dh-1, Math.max(...ys) + margin);

  const sx = W/dw, sy = H/dh;
  return {
    x: (minx*sx)|0,
    y: (miny*sy)|0,
    w: ((maxx-minx)*sx)|0,
    h: ((maxy-miny)*sy)|0
  };
}

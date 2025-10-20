export class SharpnessAnalyzer {
  private readonly SHARP_THRESHOLD: number = 150;
  private readonly BLUR_THRESHOLD: number = 80;
  private readonly MIN_SAMPLE_SIZE: number = 64;

  /**
   * Calculate image sharpness using variance of Laplacian
   */
  public calculateSharpness(imageData: Uint8ClampedArray, width: number, height: number): number {
    const downscaled = this.downscaleImageData(imageData, width, height);
    const gray = this.toGrayscale(downscaled.data, downscaled.width, downscaled.height);
    return this.varianceOfLaplacian(gray, downscaled.width, downscaled.height);
  }

  /**
   * Get distance recommendation based on sharpness
   */
  public getDistanceHint(sharpness: number): string {
    if (sharpness < this.BLUR_THRESHOLD) {
      return 'Move closer';
    } else if (sharpness > this.SHARP_THRESHOLD) {
      return 'Move away';
    } else {
      return 'Good distance';
    }
  }

  /**
   * Get sharpness level as percentage (0-100)
   */
  public getSharpnessPercentage(sharpness: number): number {
    const maxExpectedSharpness = 300;
    return Math.min(100, Math.max(0, Math.round((sharpness / maxExpectedSharpness) * 100)));
  }

  private downscaleImageData(imageData: Uint8ClampedArray, srcWidth: number, srcHeight: number): { data: Uint8ClampedArray; width: number; height: number } {
    const scale = Math.max(this.MIN_SAMPLE_SIZE / Math.min(srcWidth, srcHeight), 1);
    const targetWidth = Math.max(this.MIN_SAMPLE_SIZE, Math.floor(srcWidth * scale));
    const targetHeight = Math.max(this.MIN_SAMPLE_SIZE, Math.floor(srcHeight * scale));

    if (targetWidth >= srcWidth && targetHeight >= srcHeight) {
      return { data: imageData, width: srcWidth, height: srcHeight };
    }

    const targetData = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    const xRatio = srcWidth / targetWidth;
    const yRatio = srcHeight / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.floor(x * xRatio);
        const srcY = Math.floor(y * yRatio);
        const srcIndex = (srcY * srcWidth + srcX) * 4;
        const targetIndex = (y * targetWidth + x) * 4;

        targetData[targetIndex] = imageData[srcIndex];
        targetData[targetIndex + 1] = imageData[srcIndex + 1];
        targetData[targetIndex + 2] = imageData[srcIndex + 2];
        targetData[targetIndex + 3] = imageData[srcIndex + 3];
      }
    }

    return { data: targetData, width: targetWidth, height: targetHeight };
  }

  private toGrayscale(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
    const gray = new Uint8Array(width * height);
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
      gray[i] = (rgba[j] * 0.299 + rgba[j + 1] * 0.587 + rgba[j + 2] * 0.114);
    }
    return gray;
  }

  private varianceOfLaplacian(gray: Uint8Array, width: number, height: number): number {
    let sum = 0;
    let sumSquared = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const laplacian =
          gray[(y-1)*width + x] +
          gray[y*width + x-1] +
          gray[y*width + x+1] +
          gray[(y+1)*width + x] -
          4 * gray[y*width + x];

        sum += laplacian;
        sumSquared += laplacian * laplacian;
        count++;
      }
    }

    if (count === 0) return 0;

    const mean = sum / count;
    const variance = (sumSquared / count) - (mean * mean);
    return Math.max(0, variance);
  }
}

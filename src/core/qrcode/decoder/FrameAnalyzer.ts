import { BitMatrix } from '../../../index';

/**
 * Advanced analyzer for QR scanning feedback.
 * Detects framing, distance, and stability to guide user.
 */
export class FrameAnalyzer {
  private lastHint = '';
  private hintStabilityCount = 0;
  private lastDensity = 0;
  private lastFinderCount = 0;

  private readonly MIN_SIZE = 50;
  private readonly SAMPLE_STEP = 4;
  private readonly STABILITY_THRESHOLD = 2;

  /**
   * Analyze a single frame and return a stable user hint.
   */
  public analyzeFrame(matrix: BitMatrix): string {
    const width = matrix.getWidth();
    const height = matrix.getHeight();

    if (width < this.MIN_SIZE || height < this.MIN_SIZE) {
      return this.getStableHint('Move closer');
    }

    const densityInfo = this.analyzeDensity(matrix, width, height);
    const structureInfo = this.analyzeStructure(matrix, width, height);

    let hint: string;

    // --- Detect unstable movement early ---
    if (this.isUnstable(densityInfo.density, structureInfo.finderPatterns)) {
      hint = 'Hold steady';
    } else if (densityInfo.density < 0.02) {
      hint = 'Too dark';
    } else if (densityInfo.density < 0.05) {
      hint = 'Move closer';
    } else if (densityInfo.density > 0.45) {
      hint = 'Move away';
    } else if (structureInfo.finderPatterns < 1) {
      hint = 'Center QR code';
    } else if (densityInfo.distribution < 0.3) {
      hint = 'Center QR code';
    } else {
      hint = 'Scanning...';
    }

    this.lastDensity = densityInfo.density;
    this.lastFinderCount = structureInfo.finderPatterns;

    return this.getStableHint(hint);
  }


  // Smooths hint changes to avoid flickering between frames
  private getStableHint(currentHint: string): string {
    if (currentHint === this.lastHint) {
      this.hintStabilityCount++;
    } else {
      this.hintStabilityCount = 1;
      this.lastHint = currentHint;
    }

    return this.hintStabilityCount >= this.STABILITY_THRESHOLD
      ? currentHint
      : this.lastHint;
  }

  // Detect unstable camera movement based on density/finder variation
  private isUnstable(density: number, finderCount: number): boolean {
    const densityChange = Math.abs(density - this.lastDensity);
    const finderChange = Math.abs(finderCount - this.lastFinderCount);

    // More sensitive threshold
    const unstable = densityChange > 0.02 || finderChange > 0;

    // Optional: small random "stabilization" window
    if (unstable) {
      this.hintStabilityCount = 0; // reset stability to force feedback
    }

    return unstable;
  }

  // Estimate overall and central pixel density
  private analyzeDensity(matrix: BitMatrix, width: number, height: number): {
    density: number;
    distribution: number;
  } {
    let blackCount = 0;
    let centerBlackCount = 0;

    const cx1 = Math.floor(width * 0.35);
    const cx2 = Math.floor(width * 0.65);
    const cy1 = Math.floor(height * 0.35);
    const cy2 = Math.floor(height * 0.65);

    for (let y = 0; y < height; y += this.SAMPLE_STEP) {
      for (let x = 0; x < width; x += this.SAMPLE_STEP) {
        if (matrix.get(x, y)) {
          blackCount++;
          if (x >= cx1 && x <= cx2 && y >= cy1 && y <= cy2) {
            centerBlackCount++;
          }
        }
      }
    }

    const totalSamples = Math.floor(
      (width / this.SAMPLE_STEP) * (height / this.SAMPLE_STEP)
    );
    const density = blackCount / Math.max(1, totalSamples);
    const distribution = centerBlackCount / Math.max(1, blackCount);

    return { density, distribution };
  }

  // Rough detection of finder-like patterns
  private analyzeStructure(matrix: BitMatrix, width: number, height: number): {
    finderPatterns: number;
  } {
    let finderPatterns = 0;
    const step = Math.max(3, Math.floor(Math.min(width, height) / 40));

    for (let y = step * 2; y < height - step * 8; y += step * 2) {
      for (let x = step * 2; x < width - step * 8; x += step * 2) {
        if (this.detectFinderPattern(matrix, x, y, step)) {
          finderPatterns++;
          if (finderPatterns >= 3) break;
        }
      }
      if (finderPatterns >= 3) break;
    }

    return { finderPatterns };
  }

  private detectFinderPattern(matrix: BitMatrix, startX: number, startY: number, step: number): boolean {
    // Basic 1:1:3:1:1 finder ratio check
    const sample = (dx: number, dy: number) => {
      const x = startX + dx * step;
      const y = startY + dy * step;
      return x < matrix.getWidth() && y < matrix.getHeight() && matrix.get(x, y);
    };

    const pattern = [
      sample(-2, 0),
      sample(-1, 0),
      sample(0, 0),
      sample(1, 0),
      sample(2, 0),
    ];

    const blackRatio = pattern.filter(Boolean).length / pattern.length;
    return blackRatio >= 0.6;
  }
}

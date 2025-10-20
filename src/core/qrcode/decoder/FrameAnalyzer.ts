import { BitMatrix } from '../../../index';

/**
 * Analyzes frame quality and provides user hints for QR code scanning
 */
export class FrameAnalyzer {
  /**
   * Analyze frame and provide user hints
   */
  public analyzeFrame(matrix: BitMatrix): string {
    const width = matrix.getWidth();
    const height = matrix.getHeight();

    // Early return for invalid dimensions
    if (width < 50 || height < 50) {
      return 'Move closer - image resolution too low';
    }

    // Multi-dimensional analysis
    const densityInfo = this.analyzeDensity(matrix, width, height);
    const sharpnessInfo = this.analyzeEdgeSharpness(matrix, width, height);
    const structureInfo = this.analyzeStructure(matrix, width, height);
    const lightingInfo = this.analyzeLighting(matrix, width, height);

    // Decision tree for hints
    if (densityInfo.density < 0.02) {
      return 'Move closer - QR code is too small or too far away';
    } else if (densityInfo.density > 0.65) {
      return 'Move away - image is too dark or QR code is too large';
    } else if (lightingInfo.contrast < 0.3) {
      return 'Improve lighting - low contrast detected';
    } else if (lightingInfo.brightness < 0.2) {
      return 'Increase brightness - image too dark';
    } else if (lightingInfo.brightness > 0.8) {
      return 'Reduce brightness - image too bright';
    } else if (sharpnessInfo.edgeSharpness < 0.25) {
      return 'Adjust focus - image is blurry';
    } else if (structureInfo.finderPatterns === 0 && densityInfo.density > 0.1) {
      return 'Center QR code - pattern not recognized';
    } else if (densityInfo.distribution < 0.4) {
      return 'Center QR code in frame';
    } else if (sharpnessInfo.edgeSharpness > 0.6 && structureInfo.finderPatterns >= 1) {
      return 'Good position - try scanning now';
    } else if (structureInfo.finderPatterns >= 2) {
      return 'Almost there - adjust focus slightly';
    } else {
      return 'Adjust camera position and focus';
    }
  }

  private analyzeDensity(matrix: BitMatrix, width: number, height: number): { density: number, distribution: number } {
    let blackCount = 0;
    let centerBlackCount = 0;

    const centerX1 = Math.floor(width * 0.3);
    const centerX2 = Math.floor(width * 0.7);
    const centerY1 = Math.floor(height * 0.3);
    const centerY2 = Math.floor(height * 0.7);

    for (let y = 0; y < height; y += 3) {
      for (let x = 0; x < width; x += 3) {
        if (matrix.get(x, y)) {
          blackCount++;
          if (x >= centerX1 && x <= centerX2 && y >= centerY1 && y <= centerY2) {
            centerBlackCount++;
          }
        }
      }
    }

    const totalSamples = Math.floor((width / 3) * (height / 3));
    const density = blackCount / Math.max(1, totalSamples);
    const distribution = centerBlackCount / Math.max(1, blackCount);

    return { density, distribution };
  }

  private analyzeEdgeSharpness(matrix: BitMatrix, width: number, height: number): {
    edgeSharpness: number,
    transitions: number
  } {
    let sharpEdges = 0;
    let totalPossibleEdges = 0;

    // Horizontal edge detection
    for (let y = 2; y < height - 2; y += 4) {
      for (let x = 2; x < width - 4; x += 2) {
        const current = matrix.get(x, y);
        const right1 = matrix.get(x + 1, y);
        const right2 = matrix.get(x + 2, y);

        if (current !== right1 && right1 === right2) {
          sharpEdges++;
        }
        totalPossibleEdges++;
      }
    }

    // Vertical edge detection
    for (let x = 2; x < width - 2; x += 4) {
      for (let y = 2; y < height - 4; y += 2) {
        const current = matrix.get(x, y);
        const down1 = matrix.get(x, y + 1);
        const down2 = matrix.get(x, y + 2);

        if (current !== down1 && down1 === down2) {
          sharpEdges++;
        }
        totalPossibleEdges++;
      }
    }

    const edgeSharpness = totalPossibleEdges > 0 ? sharpEdges / totalPossibleEdges : 0;

    return {
      edgeSharpness,
      transitions: sharpEdges
    };
  }

  private analyzeStructure(matrix: BitMatrix, width: number, height: number): {
    finderPatterns: number,
    symmetry: number
  } {
    let finderPatterns = 0;

    const step = Math.max(3, Math.floor(Math.min(width, height) / 50));

    for (let y = step * 2; y < height - step * 7; y += step) {
      for (let x = step * 2; x < width - step * 7; x += step) {
        if (this.detectFinderPattern(matrix, x, y, step)) {
          finderPatterns++;
          x += step * 6;
        }
      }
    }

    return {
      finderPatterns: Math.min(3, finderPatterns),
      symmetry: this.analyzeSymmetry(matrix, width, height)
    };
  }

  private detectFinderPattern(matrix: BitMatrix, startX: number, startY: number, step: number): boolean {
    const horizontalPattern = this.checkRatioPattern(matrix, startX, startY, step, 1, 0);
    if (!horizontalPattern) return false;

    return this.checkRatioPattern(matrix, startX, startY, step, 0, 1);
  }

  private checkRatioPattern(matrix: BitMatrix, startX: number, startY: number, step: number, dx: number, dy: number): boolean {
    const ratios = [1, 1, 3, 1, 1];
    let position = 0;

    for (let i = 0; i < ratios.length; i++) {
      const segmentLength = ratios[i] * step;
      const expectedColor = (i % 2) === 0;
      let matchCount = 0;

      for (let j = 0; j < segmentLength; j++) {
        const x = startX + (position + j) * dx;
        const y = startY + (position + j) * dy;

        if (x >= matrix.getWidth() || y >= matrix.getHeight()) {
          return false;
        }

        if (matrix.get(x, y) === expectedColor) {
          matchCount++;
        }
      }

      if (matchCount < segmentLength * 0.6) {
        return false;
      }

      position += segmentLength;
    }

    return true;
  }

  private analyzeLighting(matrix: BitMatrix, width: number, height: number): { contrast: number, brightness: number } {
    let blackCount = 0;
    let whiteCount = 0;
    let edgeTransitions = 0;

    for (let y = 0; y < height; y += 5) {
      for (let x = 0; x < width; x += 5) {
        if (matrix.get(x, y)) {
          blackCount++;
        } else {
          whiteCount++;
        }

        if (x > 0 && matrix.get(x, y) !== matrix.get(x - 1, y)) {
          edgeTransitions++;
        }
        if (y > 0 && matrix.get(x, y) !== matrix.get(x, y - 1)) {
          edgeTransitions++;
        }
      }
    }

    const totalSamples = blackCount + whiteCount;
    const brightness = whiteCount / Math.max(1, totalSamples);
    const maxPossibleEdges = (width * height) / 25 * 2;
    const contrast = Math.min(1, edgeTransitions / (maxPossibleEdges * 0.1));

    return { contrast, brightness };
  }

  private analyzeSymmetry(matrix: BitMatrix, width: number, height: number): number {
    let matchingPixels = 0;
    let totalCompared = 0;

    for (let y = 0; y < Math.floor(height / 2); y += 4) {
      for (let x = 0; x < Math.floor(width / 2); x += 4) {
        const topLeft = matrix.get(x, y);
        const topRight = matrix.get(width - 1 - x, y);
        const bottomLeft = matrix.get(x, height - 1 - y);
        const bottomRight = matrix.get(width - 1 - x, height - 1 - y);

        if (topLeft === topRight) matchingPixels++;
        if (topLeft === bottomLeft) matchingPixels++;
        if (topLeft === bottomRight) matchingPixels++;

        totalCompared += 3;
      }
    }

    return totalCompared > 0 ? matchingPixels / totalCompared : 0;
  }
}

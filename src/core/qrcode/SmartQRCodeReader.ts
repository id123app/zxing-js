/*
 * Copyright 2007 ZXing authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*namespace com.google.zxing.qrcode {*/

import BarcodeFormat from '../BarcodeFormat';
import BinaryBitmap from '../BinaryBitmap';
import BitMatrix from '../common/BitMatrix';
import DecoderResult from '../common/DecoderResult';
import DecodeHintType from '../DecodeHintType';
import NotFoundException from '../NotFoundException';
import Reader from '../Reader';
import Result from '../Result';
import ResultMetadataType from '../ResultMetadataType';
import ResultPoint from '../ResultPoint';
import Decoder from './decoder/Decoder';
import QRCodeDecoderMetaData from './decoder/QRCodeDecoderMetaData';
import Detector from './detector/Detector';

/**
 * This implementation can detect and decode QR Codes in an image.
 *
 * @author Sean Owen
 */
export default class SmartQRCodeReader implements Reader {

  private static NO_POINTS = new Array<ResultPoint>();

  private decoder = new Decoder();

  protected getDecoder(): Decoder {
    return this.decoder;
  }

  /**
   * Locates and decodes a QR code in an image.
   *
   * @return a representing: string the content encoded by the QR code
   * @throws NotFoundException if a QR code cannot be found
   * @throws FormatException if a QR code cannot be decoded
   * @throws ChecksumException if error correction fails
   */
  /*@Override*/
  public decode(image: BinaryBitmap, hints?: Map<DecodeHintType, any>): Result {
    let decoderResult: DecoderResult;
    let points: Array<ResultPoint>;
    if (hints !== undefined && hints !== null && undefined !== hints.get(DecodeHintType.PURE_BARCODE)) {
      const bits = SmartQRCodeReader.extractPureBits(image.getBlackMatrix());
      decoderResult = this.decoder.decodeBitMatrix(bits, hints);
      points = SmartQRCodeReader.NO_POINTS;
    } else {
      const detectorResult = new Detector(image.getBlackMatrix()).detect(hints);
      decoderResult = this.decoder.decodeBitMatrix(detectorResult.getBits(), hints);
      points = detectorResult.getPoints();
    }

    // If the code was mirrored: swap the bottom-left and the top-right points.
    if (decoderResult.getOther() instanceof QRCodeDecoderMetaData) {
      (<QRCodeDecoderMetaData>decoderResult.getOther()).applyMirroredCorrection(points);
    }

    const result = new Result(decoderResult.getText(), decoderResult.getRawBytes(), undefined, points, BarcodeFormat.QR_CODE, undefined);
    const byteSegments: Array<Uint8Array> = decoderResult.getByteSegments();
    if (byteSegments !== null) {
      result.putMetadata(ResultMetadataType.BYTE_SEGMENTS, byteSegments);
    }
    const ecLevel: string = decoderResult.getECLevel();
    if (ecLevel !== null) {
      result.putMetadata(ResultMetadataType.ERROR_CORRECTION_LEVEL, ecLevel);
    }
    if (decoderResult.hasStructuredAppend()) {
      result.putMetadata(ResultMetadataType.STRUCTURED_APPEND_SEQUENCE,
        decoderResult.getStructuredAppendSequenceNumber());
      result.putMetadata(ResultMetadataType.STRUCTURED_APPEND_PARITY,
        decoderResult.getStructuredAppendParity());
    }

    const hint = this.getHintForFrame(image);
    if (hint !== null) {
      result.putMetadata(ResultMetadataType.POSITION_HINT, hint);
    }

    return result;
  }

  /*@Override*/
  public reset(): void {
    // do nothing
  }

  /**
   * This method detects a code in a "pure" image -- that is, pure monochrome image
   * which contains only an unrotated, unskewed, image of a code, with some white border
   * around it. This is a specialized method that works exceptionally fast in this special
   * case.
   *
   * @see com.google.zxing.datamatrix.DataMatrixReader#extractPureBits(BitMatrix)
   */
  private static extractPureBits(image: BitMatrix): BitMatrix /*throws NotFoundException */ {

    const leftTopBlack: Int32Array = image.getTopLeftOnBit();
    const rightBottomBlack: Int32Array = image.getBottomRightOnBit();
    if (leftTopBlack === null || rightBottomBlack === null) {
      throw new NotFoundException();
    }

    const moduleSize: number /*float*/ = this.moduleSize(leftTopBlack, image);

    let top = leftTopBlack[1];
    let bottom = rightBottomBlack[1];
    let left = leftTopBlack[0];
    let right = rightBottomBlack[0];

    // Sanity check!
    if (left >= right || top >= bottom) {
      throw new NotFoundException();
    }

    if (bottom - top !== right - left) {
      // Special case, where bottom-right module wasn't black so we found something else in the last row
      // Assume it's a square, so use height as the width
      right = left + (bottom - top);
      if (right >= image.getWidth()) {
        // Abort if that would not make sense -- off image
        throw new NotFoundException();
      }
    }

    const matrixWidth = Math.round((right - left + 1) / moduleSize);
    const matrixHeight = Math.round((bottom - top + 1) / moduleSize);
    if (matrixWidth <= 0 || matrixHeight <= 0) {
      throw new NotFoundException();
    }
    if (matrixHeight !== matrixWidth) {
      // Only possibly decode square regions
      throw new NotFoundException();
    }

    // Push in the "border" by half the module width so that we start
    // sampling in the middle of the module. Just in case the image is a
    // little off, this will help recover.
    const nudge = /*(int) */Math.floor(moduleSize / 2.0);
    top += nudge;
    left += nudge;

    // But careful that this does not sample off the edge
    // "right" is the farthest-right valid pixel location -- right+1 is not necessarily
    // This is positive by how much the inner x loop below would be too large
    const nudgedTooFarRight = left + /*(int) */Math.floor((matrixWidth - 1) * moduleSize) - right;
    if (nudgedTooFarRight > 0) {
      if (nudgedTooFarRight > nudge) {
        // Neither way fits; abort
        throw new NotFoundException();
      }
      left -= nudgedTooFarRight;
    }
    // See logic above
    const nudgedTooFarDown = top + /*(int) */Math.floor((matrixHeight - 1) * moduleSize) - bottom;
    if (nudgedTooFarDown > 0) {
      if (nudgedTooFarDown > nudge) {
        // Neither way fits; abort
        throw new NotFoundException();
      }
      top -= nudgedTooFarDown;
    }

    // Now just read off the bits
    const bits = new BitMatrix(matrixWidth, matrixHeight);
    for (let y = 0; y < matrixHeight; y++) {
      const iOffset = top + /*(int) */Math.floor(y * moduleSize);
      for (let x = 0; x < matrixWidth; x++) {
        if (image.get(left + /*(int) */Math.floor(x * moduleSize), iOffset)) {
          bits.set(x, y);
        }
      }
    }
    return bits;
  }

  private static moduleSize(leftTopBlack: Int32Array, image: BitMatrix): number/*float*/ /*throws NotFoundException */ {
    const height: number /*int*/ = image.getHeight();
    const width: number /*int*/ = image.getWidth();
    let x = leftTopBlack[0];
    let y = leftTopBlack[1];
    let inBlack: boolean = true;
    let transitions = 0;
    while (x < width && y < height) {
      if (inBlack !== image.get(x, y)) {
        if (++transitions === 5) {
          break;
        }
        inBlack = !inBlack;
      }
      x++;
      y++;
    }
    if (x === width || y === height) {
      throw new NotFoundException();
    }
    return (x - leftTopBlack[0]) / 7.0;
  }

  /**
   * Enhanced frame analysis for providing user hints
   */
  public getHintForFrame(image: BinaryBitmap): string {
    const matrix = image.getBlackMatrix();
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

  /**
   * Analyze pixel density and distribution
   */
  private analyzeDensity(matrix: BitMatrix, width: number, height: number): { density: number, distribution: number } {
    let blackCount = 0;
    let centerBlackCount = 0;

    const centerX1 = Math.floor(width * 0.3);
    const centerX2 = Math.floor(width * 0.7);
    const centerY1 = Math.floor(height * 0.3);
    const centerY2 = Math.floor(height * 0.7);

    // Sample with step 3 for better accuracy
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

  /**
   * Analyze edge sharpness using multi-directional edge detection
   */
  private analyzeEdgeSharpness(matrix: BitMatrix, width: number, height: number): { edgeSharpness: number, transitions: number } {
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

  /**
   * Analyze QR code structure and finder patterns
   */
  private analyzeStructure(matrix: BitMatrix, width: number, height: number): { finderPatterns: number, symmetry: number } {
    let finderPatterns = 0;

    // Search for finder patterns with adaptive step size
    const step = Math.max(3, Math.floor(Math.min(width, height) / 50));

    for (let y = step * 2; y < height - step * 7; y += step) {
      for (let x = step * 2; x < width - step * 7; x += step) {
        if (this.detectFinderPattern(matrix, x, y, step)) {
          finderPatterns++;
          // Skip area around found pattern to avoid duplicates
          x += step * 6;
        }
      }
    }

    return {
      finderPatterns: Math.min(3, finderPatterns),
      symmetry: this.analyzeSymmetry(matrix, width, height)
    };
  }

  /**
   * Detect QR code finder pattern (1:1:3:1:1 ratio)
   */
  private detectFinderPattern(matrix: BitMatrix, startX: number, startY: number, step: number): boolean {
    // Check horizontal pattern
    const horizontalPattern = this.checkRatioPattern(matrix, startX, startY, step, 1, 0);
    if (!horizontalPattern) return false;

    // Check vertical pattern at the same position
    const verticalPattern = this.checkRatioPattern(matrix, startX, startY, step, 0, 1);
    if (!verticalPattern) return false;

    return true;
  }

  private checkRatioPattern(matrix: BitMatrix, startX: number, startY: number, step: number, dx: number, dy: number): boolean {
    const ratios = [1, 1, 3, 1, 1]; // Finder pattern ratio
    let position = 0;

    for (let i = 0; i < ratios.length; i++) {
      const segmentLength = ratios[i] * step;
      const expectedColor = (i % 2) === 0; // Alternating colors
      let matchCount = 0;

      for (let j = 0; j < segmentLength; j++) {
        const x = startX + (position + j) * dx;
        const y = startY + (position + j) * dy;

        // Check bounds
        if (x >= matrix.getWidth() || y >= matrix.getHeight()) {
          return false;
        }

        if (matrix.get(x, y) === expectedColor) {
          matchCount++;
        }
      }

      // Require at least 60% match for the segment
      if (matchCount < segmentLength * 0.6) {
        return false;
      }

      position += segmentLength;
    }

    return true;
  }

  /**
   * Analyze lighting conditions
   */
  private analyzeLighting(matrix: BitMatrix, width: number, height: number): { contrast: number, brightness: number } {
    let blackCount = 0;
    let whiteCount = 0;
    let edgeTransitions = 0;

    // Sample image for lighting analysis
    for (let y = 0; y < height; y += 5) {
      for (let x = 0; x < width; x += 5) {
        if (matrix.get(x, y)) {
          blackCount++;
        } else {
          whiteCount++;
        }

        // Check for edges (contrast indicator)
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
    const maxPossibleEdges = (width * height) / 25 * 2; // Approximate
    const contrast = Math.min(1, edgeTransitions / (maxPossibleEdges * 0.1));

    return { contrast, brightness };
  }

  /**
   * Analyze image symmetry
   */
  private analyzeSymmetry(matrix: BitMatrix, width: number, height: number): number {
    let matchingPixels = 0;
    let totalCompared = 0;

    // Compare quadrants for symmetry
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

  /**
   * Legacy method for backward compatibility
   */
  private hasSharpEdges(matrix: BitMatrix): boolean {
    const sharpnessInfo = this.analyzeEdgeSharpness(matrix, matrix.getWidth(), matrix.getHeight());
    return sharpnessInfo.edgeSharpness > 0.3;
  }
}

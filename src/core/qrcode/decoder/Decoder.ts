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

/*namespace com.google.zxing.qrcode.decoder {*/

import ChecksumException from '../../ChecksumException';
import BitMatrix from '../../common/BitMatrix';
import DecoderResult from '../../common/DecoderResult';
import GenericGF from '../../common/reedsolomon/GenericGF';
import ReedSolomonDecoder from '../../common/reedsolomon/ReedSolomonDecoder';
import DecodeHintType from '../../DecodeHintType';
import BitMatrixParser from './BitMatrixParser';
import DataBlock from './DataBlock';
import DecodedBitStreamParser from './DecodedBitStreamParser';
import QRCodeDecoderMetaData from './QRCodeDecoderMetaData';


/*import java.util.Map;*/

/**
 * <p>The main class which implements QR Code decoding -- as opposed to locating and extracting
 * the QR Code from an image.</p>
 *
 * @author Sean Owen
 */
export default class Decoder {

  private rsDecoder: ReedSolomonDecoder;
  // Reusable Int32Array buffer to avoid per-block allocations for large QR versions
  private rsBuffer: Int32Array | null = null;

  public constructor() {
    this.rsDecoder = new ReedSolomonDecoder(GenericGF.QR_CODE_FIELD_256);
  }

  /**
   * <p>Convenience method that can decode a QR Code represented as a 2D array of booleans.
   * "true" is taken to mean a black module.</p>
   *
   * @param image booleans representing white/black QR Code modules
   * @param hints decoding hints that should be used to influence decoding
   * @return text and bytes encoded within the QR Code
   * @throws FormatException if the QR Code cannot be decoded
   * @throws ChecksumException if error correction fails
   */
  public decodeBooleanArray(image: boolean[][], hints?: Map<DecodeHintType, any>): DecoderResult {
    return this.decodeBitMatrix(BitMatrix.parseFromBooleanArray(image), hints);
  }

  /**
   * <p>Decodes a QR Code represented as a {@link BitMatrix}. A 1 or "true" is taken to mean a black module.</p>
   *
   * @param bits booleans representing white/black QR Code modules
   * @param hints decoding hints that should be used to influence decoding
   * @return text and bytes encoded within the QR Code
   * @throws FormatException if the QR Code cannot be decoded
   * @throws ChecksumException if error correction fails
   */
  public decodeBitMatrix(bits: BitMatrix, hints?: Map<DecodeHintType, any>): DecoderResult {

    // Construct a parser and read version, error-correction level
    const parser = new BitMatrixParser(bits);
    let ex = null;
    try {
      return this.decodeBitMatrixParser(parser, hints);
    } catch (e/*: FormatException, ChecksumException*/) {
      ex = e;
    }

    try {

      // Revert the bit matrix
      parser.remask();

      // Will be attempting a mirrored reading of the version and format info.
      parser.setMirror(true);

      // Preemptively read the version.
      parser.readVersion();

      // Preemptively read the format information.
      parser.readFormatInformation();

      /*
       * Since we're here, this means we have successfully detected some kind
       * of version and format information when mirrored. This is a good sign,
       * that the QR code may be mirrored, and we should try once more with a
       * mirrored content.
       */
      // Prepare for a mirrored reading.
      parser.mirror();

      const result = this.decodeBitMatrixParser(parser, hints);

      // Success! Notify the caller that the code was mirrored.
      result.setOther(new QRCodeDecoderMetaData(true));

      return result;

    } catch (e/*FormatException | ChecksumException*/) {
      // Throw the exception from the original reading
      if (ex !== null) {
        throw ex;
      }
      throw e;

    }
  }

  private decodeBitMatrixParser(parser: BitMatrixParser, hints: Map<DecodeHintType, any>): DecoderResult {
    const version = parser.readVersion();
    const ecLevel = parser.readFormatInformation().getErrorCorrectionLevel();

    // Read codewords
    const codewords = parser.readCodewords();
    // Separate into data blocks
    const dataBlocks = DataBlock.getDataBlocks(codewords, version, ecLevel);

    // Count total number of data bytes and compute max block size for buffer reuse
    let totalBytes = 0;
    let maxBlockSize = 0;
    for (const dataBlock of dataBlocks) {
      const blockLen = dataBlock.getCodewords().length;
      totalBytes += dataBlock.getNumDataCodewords();
      if (blockLen > maxBlockSize) {
        maxBlockSize = blockLen;
      }
    }
    const resultBytes = new Uint8Array(totalBytes);
    let resultOffset = 0;

    // Ensure a reusable Int32 buffer large enough for the largest block
    if (!this.rsBuffer || this.rsBuffer.length < maxBlockSize) {
      this.rsBuffer = new Int32Array(maxBlockSize);
    }
    const sharedRsBuffer = this.rsBuffer;

    // Error-correct and copy data blocks together into a stream of bytes.
    // correctErrors will write corrected data bytes directly into resultBytes to avoid an extra copy.
    for (const dataBlock of dataBlocks) {
      const codewordBytes = dataBlock.getCodewords();
      const numDataCodewords = dataBlock.getNumDataCodewords();
      this.correctErrors(codewordBytes, numDataCodewords, resultBytes, resultOffset, sharedRsBuffer);
      resultOffset += numDataCodewords;
    }

    // Decode the contents of that stream of bytes
    return DecodedBitStreamParser.decode(resultBytes, version, ecLevel, hints);
  }

  /**
   * <p>Given data and error-correction codewords received, possibly corrupted by errors, attempts to
   * correct the errors in-place using Reed-Solomon error correction.</p>
   *
   * This version writes corrected data codewords directly into the provided output buffer at outputOffset,
   * avoiding an extra write-back/copy step.
   *
   * @param codewordBytes data and error correction codewords
   * @param numDataCodewords number of codewords that are data bytes
   * @param output where to write the corrected data bytes
   * @param outputOffset offset into output to start writing
   * @param rsBuffer
   * @throws ChecksumException if error correction fails
   */
  private correctErrors(
    codewordBytes: Uint8Array,
    numDataCodewords: number /*int*/,
    output: Uint8Array,
    outputOffset: number,
    rsBuffer?: Int32Array
  ): void /*throws ChecksumException*/ {
    const length = codewordBytes.length;
    // Use provided buffer (preallocated) or create a temporary one if not provided
    const buffer = rsBuffer && rsBuffer.length >= length ? rsBuffer : new Int32Array(length);

    // Fast copy input bytes into int buffer using native bulk set (much faster than JS loop)
    // Note: Int32Array.set accepts array-like sources; values will be converted.
    buffer.set(codewordBytes, 0);

    try {
      // Decode in place on the int buffer (use a subarray view limited to 'length')
      this.rsDecoder.decode(buffer.subarray(0, length), length - numDataCodewords);
    } catch (ignored/*: ReedSolomonException*/) {
      throw new ChecksumException();
    }

    // Bulk write corrected data codewords directly into the final output buffer.
    // Use a subarray view of the int buffer and let TypedArray.set handle conversion.
    output.set(buffer.subarray(0, numDataCodewords), outputOffset);
  }

}

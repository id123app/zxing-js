import { ASCIIEncoder } from './ASCIIEncoder';
import { Base256Encoder } from './Base256Encoder';
import { C40Encoder } from './C40Encoder';
import {
  ASCII_ENCODATION,
  BASE256_ENCODATION,
  EDIFACT_ENCODATION,
  MACRO_05,
  MACRO_05_HEADER,
  MACRO_06,
  MACRO_06_HEADER,
  MACRO_TRAILER,
  PAD,
  SymbolShapeHint,
} from './constants';
import { EdifactEncoder } from './EdifactEncoder';
import { Encoder } from './Encoder';
import { EncoderContext } from './EncoderContext';
import { EncoderUtils } from './EncoderUtils';
import { X12Encoder } from './X12Encoder';
import { TextEncoder } from './TextEncoder';
import Dimension from '../../Dimension';

/**
 * DataMatrix ECC 200 data encoder following the algorithm described in ISO/IEC 16022:200(E) in
 * annex S.
 */
class HighLevelEncoder {
  private static randomize253State(codewordPosition: number): number {
    const pseudoRandom = ((149 * codewordPosition) % 253) + 1;
    const tempVariable = PAD + pseudoRandom;
    return tempVariable <= 254 ? tempVariable : tempVariable - 254;
  }

  /**
   * Performs message encoding of a DataMatrix message using the algorithm described in annex P
   * of ISO/IEC 16022:2000(E).
   *
   * @param msg     the message
   * @param shape   requested shape. May be {@code SymbolShapeHint.FORCE_NONE},
   *                {@code SymbolShapeHint.FORCE_SQUARE} or {@code SymbolShapeHint.FORCE_RECTANGLE}.
   * @param minSize the minimum symbol size constraint or null for no constraint
   * @param maxSize the maximum symbol size constraint or null for no constraint
   * @param forceC40 enforce C40 encoding
   * @return the encoded message (the char values range from 0 to 255)
   */
  public static encodeHighLevel(
    msg: string,
    shape = SymbolShapeHint.FORCE_NONE,
    minSize: Dimension = null,
    maxSize: Dimension = null,
    forceC40 = false
  ): string {
    // the codewords 0..255 are encoded as Unicode characters
    const c40Encoder = new C40Encoder();
    const encoders: Encoder[] = [
      new ASCIIEncoder(),
      c40Encoder,
      new TextEncoder(),
      new X12Encoder(),
      new EdifactEncoder(),
      new Base256Encoder(),
    ];

    const context = new EncoderContext(msg);
    context.setSymbolShape(shape);
    context.setSizeConstraints(minSize, maxSize);

    if (msg.startsWith(MACRO_05_HEADER) && msg.endsWith(MACRO_TRAILER)) {
      context.writeCodeword(MACRO_05);
      context.setSkipAtEnd(2);
      context.pos += MACRO_05_HEADER.length;
    } else if (msg.startsWith(MACRO_06_HEADER) && msg.endsWith(MACRO_TRAILER)) {
      context.writeCodeword(MACRO_06);
      context.setSkipAtEnd(2);
      context.pos += MACRO_06_HEADER.length;
    }

    let encodingMode = ASCII_ENCODATION; // Default mode

    if (forceC40) {
      c40Encoder.encodeMaximal(context);
      encodingMode = context.getNewEncoding();
      context.resetEncoderSignal();
    }

    while (context.hasMoreCharacters()) {
      encoders[encodingMode].encode(context);
      if (context.getNewEncoding() >= 0) {
        encodingMode = context.getNewEncoding();
        context.resetEncoderSignal();
      }
    }
    const len = context.getCodewordCount();
    context.updateSymbolInfo();
    const capacity = context.getSymbolInfo().getDataCapacity();
    if (
      len < capacity &&
      encodingMode !== ASCII_ENCODATION &&
      encodingMode !== BASE256_ENCODATION &&
      encodingMode !== EDIFACT_ENCODATION
    ) {
      context.writeCodeword('\u00fe'); // Unlatch (254)
    }
    // Padding
    const codewords = context.getCodewords();
    if (codewords.length() < capacity) {
      codewords.append(PAD);
    }
    while (codewords.length() < capacity) {
      codewords.append(this.randomize253State(codewords.length() + 1));
    }

    return context.getCodewords().toString();
  }

  // Delegate all utility methods to EncoderUtils for backward compatibility
  static lookAheadTest(msg: string, startpos: number, currentMode: number): number {
    return EncoderUtils.lookAheadTest(msg, startpos, currentMode);
  }

  static isDigit(ch: number): boolean {
    return EncoderUtils.isDigit(ch);
  }

  static isExtendedASCII(ch: number): boolean {
    return EncoderUtils.isExtendedASCII(ch);
  }

  static isNativeC40(ch: number): boolean {
    return EncoderUtils.isNativeC40(ch);
  }

  static isNativeText(ch: number): boolean {
    return EncoderUtils.isNativeText(ch);
  }

  static isNativeX12(ch: number): boolean {
    return EncoderUtils.isNativeX12(ch);
  }

  static isNativeEDIFACT(ch: number): boolean {
    return EncoderUtils.isNativeEDIFACT(ch);
  }

  public static determineConsecutiveDigitCount(msg: string, startpos: number = 0): number {
    return EncoderUtils.determineConsecutiveDigitCount(msg, startpos);
  }

  static illegalCharacter(singleCharacter: string): void {
    EncoderUtils.illegalCharacter(singleCharacter);
  }
}

export default HighLevelEncoder;

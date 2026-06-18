import { ASCIIEncoder } from './ASCIIEncoder';
import { Base256Encoder } from './Base256Encoder';
import { C40Encoder } from './C40Encoder';
import { ASCII_ENCODATION, BASE256_ENCODATION, EDIFACT_ENCODATION, MACRO_05, MACRO_05_HEADER, MACRO_06, MACRO_06_HEADER, MACRO_TRAILER, PAD, } from './constants';
import { EdifactEncoder } from './EdifactEncoder';
import { EncoderContext } from './EncoderContext';
import { EncoderUtils } from './EncoderUtils';
import { X12Encoder } from './X12Encoder';
import { TextEncoder } from './TextEncoder';
/**
 * DataMatrix ECC 200 data encoder following the algorithm described in ISO/IEC 16022:200(E) in
 * annex S.
 */
class HighLevelEncoder {
    static randomize253State(codewordPosition) {
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
    static encodeHighLevel(msg, shape = 0 /* SymbolShapeHint.FORCE_NONE */, minSize = null, maxSize = null, forceC40 = false) {
        // the codewords 0..255 are encoded as Unicode characters
        const c40Encoder = new C40Encoder();
        const encoders = [
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
        }
        else if (msg.startsWith(MACRO_06_HEADER) && msg.endsWith(MACRO_TRAILER)) {
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
        if (len < capacity &&
            encodingMode !== ASCII_ENCODATION &&
            encodingMode !== BASE256_ENCODATION &&
            encodingMode !== EDIFACT_ENCODATION) {
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
    static lookAheadTest(msg, startpos, currentMode) {
        return EncoderUtils.lookAheadTest(msg, startpos, currentMode);
    }
    static isDigit(ch) {
        return EncoderUtils.isDigit(ch);
    }
    static isExtendedASCII(ch) {
        return EncoderUtils.isExtendedASCII(ch);
    }
    static isNativeC40(ch) {
        return EncoderUtils.isNativeC40(ch);
    }
    static isNativeText(ch) {
        return EncoderUtils.isNativeText(ch);
    }
    static isNativeX12(ch) {
        return EncoderUtils.isNativeX12(ch);
    }
    static isNativeEDIFACT(ch) {
        return EncoderUtils.isNativeEDIFACT(ch);
    }
    static determineConsecutiveDigitCount(msg, startpos = 0) {
        return EncoderUtils.determineConsecutiveDigitCount(msg, startpos);
    }
    static illegalCharacter(singleCharacter) {
        EncoderUtils.illegalCharacter(singleCharacter);
    }
}
export default HighLevelEncoder;

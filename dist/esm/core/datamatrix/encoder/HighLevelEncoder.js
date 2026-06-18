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
var HighLevelEncoder = /** @class */ (function () {
    function HighLevelEncoder() {
    }
    HighLevelEncoder.randomize253State = function (codewordPosition) {
        var pseudoRandom = ((149 * codewordPosition) % 253) + 1;
        var tempVariable = PAD + pseudoRandom;
        return tempVariable <= 254 ? tempVariable : tempVariable - 254;
    };
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
    HighLevelEncoder.encodeHighLevel = function (msg, shape, minSize, maxSize, forceC40) {
        if (shape === void 0) { shape = 0 /* SymbolShapeHint.FORCE_NONE */; }
        if (minSize === void 0) { minSize = null; }
        if (maxSize === void 0) { maxSize = null; }
        if (forceC40 === void 0) { forceC40 = false; }
        // the codewords 0..255 are encoded as Unicode characters
        var c40Encoder = new C40Encoder();
        var encoders = [
            new ASCIIEncoder(),
            c40Encoder,
            new TextEncoder(),
            new X12Encoder(),
            new EdifactEncoder(),
            new Base256Encoder(),
        ];
        var context = new EncoderContext(msg);
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
        var encodingMode = ASCII_ENCODATION; // Default mode
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
        var len = context.getCodewordCount();
        context.updateSymbolInfo();
        var capacity = context.getSymbolInfo().getDataCapacity();
        if (len < capacity &&
            encodingMode !== ASCII_ENCODATION &&
            encodingMode !== BASE256_ENCODATION &&
            encodingMode !== EDIFACT_ENCODATION) {
            context.writeCodeword('\u00fe'); // Unlatch (254)
        }
        // Padding
        var codewords = context.getCodewords();
        if (codewords.length() < capacity) {
            codewords.append(PAD);
        }
        while (codewords.length() < capacity) {
            codewords.append(this.randomize253State(codewords.length() + 1));
        }
        return context.getCodewords().toString();
    };
    // Delegate all utility methods to EncoderUtils for backward compatibility
    HighLevelEncoder.lookAheadTest = function (msg, startpos, currentMode) {
        return EncoderUtils.lookAheadTest(msg, startpos, currentMode);
    };
    HighLevelEncoder.isDigit = function (ch) {
        return EncoderUtils.isDigit(ch);
    };
    HighLevelEncoder.isExtendedASCII = function (ch) {
        return EncoderUtils.isExtendedASCII(ch);
    };
    HighLevelEncoder.isNativeC40 = function (ch) {
        return EncoderUtils.isNativeC40(ch);
    };
    HighLevelEncoder.isNativeText = function (ch) {
        return EncoderUtils.isNativeText(ch);
    };
    HighLevelEncoder.isNativeX12 = function (ch) {
        return EncoderUtils.isNativeX12(ch);
    };
    HighLevelEncoder.isNativeEDIFACT = function (ch) {
        return EncoderUtils.isNativeEDIFACT(ch);
    };
    HighLevelEncoder.determineConsecutiveDigitCount = function (msg, startpos) {
        if (startpos === void 0) { startpos = 0; }
        return EncoderUtils.determineConsecutiveDigitCount(msg, startpos);
    };
    HighLevelEncoder.illegalCharacter = function (singleCharacter) {
        EncoderUtils.illegalCharacter(singleCharacter);
    };
    return HighLevelEncoder;
}());
export default HighLevelEncoder;

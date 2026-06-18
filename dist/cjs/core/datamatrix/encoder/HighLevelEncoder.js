"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ASCIIEncoder_1 = require("./ASCIIEncoder");
var Base256Encoder_1 = require("./Base256Encoder");
var C40Encoder_1 = require("./C40Encoder");
var constants_1 = require("./constants");
var EdifactEncoder_1 = require("./EdifactEncoder");
var EncoderContext_1 = require("./EncoderContext");
var EncoderUtils_1 = require("./EncoderUtils");
var X12Encoder_1 = require("./X12Encoder");
var TextEncoder_1 = require("./TextEncoder");
/**
 * DataMatrix ECC 200 data encoder following the algorithm described in ISO/IEC 16022:200(E) in
 * annex S.
 */
var HighLevelEncoder = /** @class */ (function () {
    function HighLevelEncoder() {
    }
    HighLevelEncoder.randomize253State = function (codewordPosition) {
        var pseudoRandom = ((149 * codewordPosition) % 253) + 1;
        var tempVariable = constants_1.PAD + pseudoRandom;
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
        var c40Encoder = new C40Encoder_1.C40Encoder();
        var encoders = [
            new ASCIIEncoder_1.ASCIIEncoder(),
            c40Encoder,
            new TextEncoder_1.TextEncoder(),
            new X12Encoder_1.X12Encoder(),
            new EdifactEncoder_1.EdifactEncoder(),
            new Base256Encoder_1.Base256Encoder(),
        ];
        var context = new EncoderContext_1.EncoderContext(msg);
        context.setSymbolShape(shape);
        context.setSizeConstraints(minSize, maxSize);
        if (msg.startsWith(constants_1.MACRO_05_HEADER) && msg.endsWith(constants_1.MACRO_TRAILER)) {
            context.writeCodeword(constants_1.MACRO_05);
            context.setSkipAtEnd(2);
            context.pos += constants_1.MACRO_05_HEADER.length;
        }
        else if (msg.startsWith(constants_1.MACRO_06_HEADER) && msg.endsWith(constants_1.MACRO_TRAILER)) {
            context.writeCodeword(constants_1.MACRO_06);
            context.setSkipAtEnd(2);
            context.pos += constants_1.MACRO_06_HEADER.length;
        }
        var encodingMode = constants_1.ASCII_ENCODATION; // Default mode
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
            encodingMode !== constants_1.ASCII_ENCODATION &&
            encodingMode !== constants_1.BASE256_ENCODATION &&
            encodingMode !== constants_1.EDIFACT_ENCODATION) {
            context.writeCodeword('\u00fe'); // Unlatch (254)
        }
        // Padding
        var codewords = context.getCodewords();
        if (codewords.length() < capacity) {
            codewords.append(constants_1.PAD);
        }
        while (codewords.length() < capacity) {
            codewords.append(this.randomize253State(codewords.length() + 1));
        }
        return context.getCodewords().toString();
    };
    // Delegate all utility methods to EncoderUtils for backward compatibility
    HighLevelEncoder.lookAheadTest = function (msg, startpos, currentMode) {
        return EncoderUtils_1.EncoderUtils.lookAheadTest(msg, startpos, currentMode);
    };
    HighLevelEncoder.isDigit = function (ch) {
        return EncoderUtils_1.EncoderUtils.isDigit(ch);
    };
    HighLevelEncoder.isExtendedASCII = function (ch) {
        return EncoderUtils_1.EncoderUtils.isExtendedASCII(ch);
    };
    HighLevelEncoder.isNativeC40 = function (ch) {
        return EncoderUtils_1.EncoderUtils.isNativeC40(ch);
    };
    HighLevelEncoder.isNativeText = function (ch) {
        return EncoderUtils_1.EncoderUtils.isNativeText(ch);
    };
    HighLevelEncoder.isNativeX12 = function (ch) {
        return EncoderUtils_1.EncoderUtils.isNativeX12(ch);
    };
    HighLevelEncoder.isNativeEDIFACT = function (ch) {
        return EncoderUtils_1.EncoderUtils.isNativeEDIFACT(ch);
    };
    HighLevelEncoder.determineConsecutiveDigitCount = function (msg, startpos) {
        if (startpos === void 0) { startpos = 0; }
        return EncoderUtils_1.EncoderUtils.determineConsecutiveDigitCount(msg, startpos);
    };
    HighLevelEncoder.illegalCharacter = function (singleCharacter) {
        EncoderUtils_1.EncoderUtils.illegalCharacter(singleCharacter);
    };
    return HighLevelEncoder;
}());
exports.default = HighLevelEncoder;

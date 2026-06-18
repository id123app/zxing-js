"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncoderUtils = void 0;
var constants_1 = require("./constants");
var Arrays_1 = require("../../util/Arrays");
var Integer_1 = require("../../util/Integer");
/**
 * Shared utility methods used by DataMatrix encoders.
 * Extracted from HighLevelEncoder to break circular dependencies.
 */
var EncoderUtils = /** @class */ (function () {
    function EncoderUtils() {
    }
    EncoderUtils.lookAheadTest = function (msg, startpos, currentMode) {
        var newMode = this.lookAheadTestIntern(msg, startpos, currentMode);
        if (currentMode === constants_1.X12_ENCODATION && newMode === constants_1.X12_ENCODATION) {
            var endpos = Math.min(startpos + 3, msg.length);
            for (var i = startpos; i < endpos; i++) {
                if (!this.isNativeX12(msg.charCodeAt(i))) {
                    return constants_1.ASCII_ENCODATION;
                }
            }
        }
        else if (currentMode === constants_1.EDIFACT_ENCODATION &&
            newMode === constants_1.EDIFACT_ENCODATION) {
            var endpos = Math.min(startpos + 4, msg.length);
            for (var i = startpos; i < endpos; i++) {
                if (!this.isNativeEDIFACT(msg.charCodeAt(i))) {
                    return constants_1.ASCII_ENCODATION;
                }
            }
        }
        return newMode;
    };
    EncoderUtils.lookAheadTestIntern = function (msg, startpos, currentMode) {
        if (startpos >= msg.length) {
            return currentMode;
        }
        var charCounts;
        // step J
        if (currentMode === constants_1.ASCII_ENCODATION) {
            charCounts = [0, 1, 1, 1, 1, 1.25];
        }
        else {
            charCounts = [1, 2, 2, 2, 2, 2.25];
            charCounts[currentMode] = 0;
        }
        var charsProcessed = 0;
        var mins = new Uint8Array(6);
        var intCharCounts = [];
        while (true) {
            // step K
            if (startpos + charsProcessed === msg.length) {
                Arrays_1.default.fill(mins, 0);
                Arrays_1.default.fill(intCharCounts, 0);
                var min = this.findMinimums(charCounts, intCharCounts, Integer_1.default.MAX_VALUE, mins);
                var minCount = this.getMinimumCount(mins);
                if (intCharCounts[constants_1.ASCII_ENCODATION] === min) {
                    return constants_1.ASCII_ENCODATION;
                }
                if (minCount === 1) {
                    if (mins[constants_1.BASE256_ENCODATION] > 0) {
                        return constants_1.BASE256_ENCODATION;
                    }
                    if (mins[constants_1.EDIFACT_ENCODATION] > 0) {
                        return constants_1.EDIFACT_ENCODATION;
                    }
                    if (mins[constants_1.TEXT_ENCODATION] > 0) {
                        return constants_1.TEXT_ENCODATION;
                    }
                    if (mins[constants_1.X12_ENCODATION] > 0) {
                        return constants_1.X12_ENCODATION;
                    }
                }
                return constants_1.C40_ENCODATION;
            }
            var c = msg.charCodeAt(startpos + charsProcessed);
            charsProcessed++;
            // step L
            if (this.isDigit(c)) {
                charCounts[constants_1.ASCII_ENCODATION] += 0.5;
            }
            else if (this.isExtendedASCII(c)) {
                charCounts[constants_1.ASCII_ENCODATION] = Math.ceil(charCounts[constants_1.ASCII_ENCODATION]);
                charCounts[constants_1.ASCII_ENCODATION] += 2.0;
            }
            else {
                charCounts[constants_1.ASCII_ENCODATION] = Math.ceil(charCounts[constants_1.ASCII_ENCODATION]);
                charCounts[constants_1.ASCII_ENCODATION]++;
            }
            // step M
            if (this.isNativeC40(c)) {
                charCounts[constants_1.C40_ENCODATION] += 2.0 / 3.0;
            }
            else if (this.isExtendedASCII(c)) {
                charCounts[constants_1.C40_ENCODATION] += 8.0 / 3.0;
            }
            else {
                charCounts[constants_1.C40_ENCODATION] += 4.0 / 3.0;
            }
            // step N
            if (this.isNativeText(c)) {
                charCounts[constants_1.TEXT_ENCODATION] += 2.0 / 3.0;
            }
            else if (this.isExtendedASCII(c)) {
                charCounts[constants_1.TEXT_ENCODATION] += 8.0 / 3.0;
            }
            else {
                charCounts[constants_1.TEXT_ENCODATION] += 4.0 / 3.0;
            }
            // step O
            if (this.isNativeX12(c)) {
                charCounts[constants_1.X12_ENCODATION] += 2.0 / 3.0;
            }
            else if (this.isExtendedASCII(c)) {
                charCounts[constants_1.X12_ENCODATION] += 13.0 / 3.0;
            }
            else {
                charCounts[constants_1.X12_ENCODATION] += 10.0 / 3.0;
            }
            // step P
            if (this.isNativeEDIFACT(c)) {
                charCounts[constants_1.EDIFACT_ENCODATION] += 3.0 / 4.0;
            }
            else if (this.isExtendedASCII(c)) {
                charCounts[constants_1.EDIFACT_ENCODATION] += 17.0 / 4.0;
            }
            else {
                charCounts[constants_1.EDIFACT_ENCODATION] += 13.0 / 4.0;
            }
            // step Q
            if (this.isSpecialB256(c)) {
                charCounts[constants_1.BASE256_ENCODATION] += 4.0;
            }
            else {
                charCounts[constants_1.BASE256_ENCODATION]++;
            }
            // step R
            if (charsProcessed >= 4) {
                Arrays_1.default.fill(mins, 0);
                Arrays_1.default.fill(intCharCounts, 0);
                this.findMinimums(charCounts, intCharCounts, Integer_1.default.MAX_VALUE, mins);
                if (intCharCounts[constants_1.ASCII_ENCODATION] <
                    this.min(intCharCounts[constants_1.BASE256_ENCODATION], intCharCounts[constants_1.C40_ENCODATION], intCharCounts[constants_1.TEXT_ENCODATION], intCharCounts[constants_1.X12_ENCODATION], intCharCounts[constants_1.EDIFACT_ENCODATION])) {
                    return constants_1.ASCII_ENCODATION;
                }
                if (intCharCounts[constants_1.BASE256_ENCODATION] < intCharCounts[constants_1.ASCII_ENCODATION] ||
                    intCharCounts[constants_1.BASE256_ENCODATION] + 1 <
                        this.min(intCharCounts[constants_1.C40_ENCODATION], intCharCounts[constants_1.TEXT_ENCODATION], intCharCounts[constants_1.X12_ENCODATION], intCharCounts[constants_1.EDIFACT_ENCODATION])) {
                    return constants_1.BASE256_ENCODATION;
                }
                if (intCharCounts[constants_1.EDIFACT_ENCODATION] + 1 <
                    this.min(intCharCounts[constants_1.BASE256_ENCODATION], intCharCounts[constants_1.C40_ENCODATION], intCharCounts[constants_1.TEXT_ENCODATION], intCharCounts[constants_1.X12_ENCODATION], intCharCounts[constants_1.ASCII_ENCODATION])) {
                    return constants_1.EDIFACT_ENCODATION;
                }
                if (intCharCounts[constants_1.TEXT_ENCODATION] + 1 <
                    this.min(intCharCounts[constants_1.BASE256_ENCODATION], intCharCounts[constants_1.C40_ENCODATION], intCharCounts[constants_1.EDIFACT_ENCODATION], intCharCounts[constants_1.X12_ENCODATION], intCharCounts[constants_1.ASCII_ENCODATION])) {
                    return constants_1.TEXT_ENCODATION;
                }
                if (intCharCounts[constants_1.X12_ENCODATION] + 1 <
                    this.min(intCharCounts[constants_1.BASE256_ENCODATION], intCharCounts[constants_1.C40_ENCODATION], intCharCounts[constants_1.EDIFACT_ENCODATION], intCharCounts[constants_1.TEXT_ENCODATION], intCharCounts[constants_1.ASCII_ENCODATION])) {
                    return constants_1.X12_ENCODATION;
                }
                if (intCharCounts[constants_1.C40_ENCODATION] + 1 <
                    this.min(intCharCounts[constants_1.ASCII_ENCODATION], intCharCounts[constants_1.BASE256_ENCODATION], intCharCounts[constants_1.EDIFACT_ENCODATION], intCharCounts[constants_1.TEXT_ENCODATION])) {
                    if (intCharCounts[constants_1.C40_ENCODATION] < intCharCounts[constants_1.X12_ENCODATION]) {
                        return constants_1.C40_ENCODATION;
                    }
                    if (intCharCounts[constants_1.C40_ENCODATION] === intCharCounts[constants_1.X12_ENCODATION]) {
                        var p = startpos + charsProcessed + 1;
                        while (p < msg.length) {
                            var tc = msg.charCodeAt(p);
                            if (this.isX12TermSep(tc)) {
                                return constants_1.X12_ENCODATION;
                            }
                            if (!this.isNativeX12(tc)) {
                                break;
                            }
                            p++;
                        }
                        return constants_1.C40_ENCODATION;
                    }
                }
            }
        }
    };
    EncoderUtils.min = function (f1, f2, f3, f4, f5) {
        var val = Math.min(f1, Math.min(f2, Math.min(f3, f4)));
        if (f5 === undefined) {
            return val;
        }
        else {
            return Math.min(val, f5);
        }
    };
    EncoderUtils.findMinimums = function (charCounts, intCharCounts, min, mins) {
        for (var i = 0; i < 6; i++) {
            var current = (intCharCounts[i] = Math.ceil(charCounts[i]));
            if (min > current) {
                min = current;
                Arrays_1.default.fill(mins, 0);
            }
            if (min === current) {
                mins[i] = mins[i] + 1;
            }
        }
        return min;
    };
    EncoderUtils.getMinimumCount = function (mins) {
        var minCount = 0;
        for (var i = 0; i < 6; i++) {
            minCount += mins[i];
        }
        return minCount || 0;
    };
    EncoderUtils.isDigit = function (ch) {
        return ch >= '0'.charCodeAt(0) && ch <= '9'.charCodeAt(0);
    };
    EncoderUtils.isExtendedASCII = function (ch) {
        return ch >= 128 && ch <= 255;
    };
    EncoderUtils.isNativeC40 = function (ch) {
        return (ch === ' '.charCodeAt(0) ||
            (ch >= '0'.charCodeAt(0) && ch <= '9'.charCodeAt(0)) ||
            (ch >= 'A'.charCodeAt(0) && ch <= 'Z'.charCodeAt(0)));
    };
    EncoderUtils.isNativeText = function (ch) {
        return (ch === ' '.charCodeAt(0) ||
            (ch >= '0'.charCodeAt(0) && ch <= '9'.charCodeAt(0)) ||
            (ch >= 'a'.charCodeAt(0) && ch <= 'z'.charCodeAt(0)));
    };
    EncoderUtils.isNativeX12 = function (ch) {
        return (this.isX12TermSep(ch) ||
            ch === ' '.charCodeAt(0) ||
            (ch >= '0'.charCodeAt(0) && ch <= '9'.charCodeAt(0)) ||
            (ch >= 'A'.charCodeAt(0) && ch <= 'Z'.charCodeAt(0)));
    };
    EncoderUtils.isX12TermSep = function (ch) {
        return (ch === 13 || // CR
            ch === '*'.charCodeAt(0) ||
            ch === '>'.charCodeAt(0));
    };
    EncoderUtils.isNativeEDIFACT = function (ch) {
        return ch >= ' '.charCodeAt(0) && ch <= '^'.charCodeAt(0);
    };
    /**
     * Checks if a character requires special handling in Base256 encoding.
     *
     * Per the Java ZXing reference implementation, no characters currently
     * require special B256 handling — all byte values 0–255 are treated
     * uniformly. This method exists as a hook for future specification
     * changes. Callers use the return value to add extra weight (4.0) to
     * the B256 character count in the look-ahead algorithm; returning false
     * means every character costs exactly 1.0 in B256 mode.
     */
    EncoderUtils.isSpecialB256 = function (_ch) {
        return false;
    };
    EncoderUtils.determineConsecutiveDigitCount = function (msg, startpos) {
        if (startpos === void 0) { startpos = 0; }
        var len = msg.length;
        var idx = startpos;
        while (idx < len && this.isDigit(msg.charCodeAt(idx))) {
            idx++;
        }
        return idx - startpos;
    };
    EncoderUtils.illegalCharacter = function (singleCharacter) {
        var hex = Integer_1.default.toHexString(singleCharacter.charCodeAt(0));
        hex = '0000'.substring(0, 4 - hex.length) + hex;
        throw new Error('Illegal character: ' + singleCharacter + ' (0x' + hex + ')');
    };
    return EncoderUtils;
}());
exports.EncoderUtils = EncoderUtils;

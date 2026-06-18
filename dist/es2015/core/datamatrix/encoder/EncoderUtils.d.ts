/**
 * Shared utility methods used by DataMatrix encoders.
 * Extracted from HighLevelEncoder to break circular dependencies.
 */
export declare class EncoderUtils {
    static lookAheadTest(msg: string, startpos: number, currentMode: number): number;
    static lookAheadTestIntern(msg: string, startpos: number, currentMode: number): number;
    private static min;
    private static findMinimums;
    private static getMinimumCount;
    static isDigit(ch: number): boolean;
    static isExtendedASCII(ch: number): boolean;
    static isNativeC40(ch: number): boolean;
    static isNativeText(ch: number): boolean;
    static isNativeX12(ch: number): boolean;
    private static isX12TermSep;
    static isNativeEDIFACT(ch: number): boolean;
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
    private static isSpecialB256;
    static determineConsecutiveDigitCount(msg: string, startpos?: number): number;
    static illegalCharacter(singleCharacter: string): void;
}

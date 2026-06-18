import { SymbolShapeHint } from './constants';
import Dimension from '../../Dimension';
/**
 * DataMatrix ECC 200 data encoder following the algorithm described in ISO/IEC 16022:200(E) in
 * annex S.
 */
declare class HighLevelEncoder {
    private static randomize253State;
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
    static encodeHighLevel(msg: string, shape?: SymbolShapeHint, minSize?: Dimension, maxSize?: Dimension, forceC40?: boolean): string;
    static lookAheadTest(msg: string, startpos: number, currentMode: number): number;
    static isDigit(ch: number): boolean;
    static isExtendedASCII(ch: number): boolean;
    static isNativeC40(ch: number): boolean;
    static isNativeText(ch: number): boolean;
    static isNativeX12(ch: number): boolean;
    static isNativeEDIFACT(ch: number): boolean;
    static determineConsecutiveDigitCount(msg: string, startpos?: number): number;
    static illegalCharacter(singleCharacter: string): void;
}
export default HighLevelEncoder;

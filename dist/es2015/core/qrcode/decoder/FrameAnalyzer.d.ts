import { BitMatrix } from '../../../index';
/**
 * Advanced analyzer for QR scanning feedback.
 * Detects framing, distance, and stability to guide user.
 */
export declare class FrameAnalyzer {
    private lastHint;
    private hintStabilityCount;
    private lastDensity;
    private lastFinderCount;
    private readonly MIN_SIZE;
    private readonly SAMPLE_STEP;
    private readonly STABILITY_THRESHOLD;
    /**
     * Analyze a single frame and return a stable user hint.
     */
    analyzeFrame(matrix: BitMatrix): string;
    private getStableHint;
    private isUnstable;
    private analyzeDensity;
    private analyzeStructure;
    private detectFinderPattern;
}

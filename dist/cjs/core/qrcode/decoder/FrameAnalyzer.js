"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrameAnalyzer = void 0;
/**
 * Advanced analyzer for QR scanning feedback.
 * Detects framing, distance, and stability to guide user.
 */
var FrameAnalyzer = /** @class */ (function () {
    function FrameAnalyzer() {
        this.lastHint = '';
        this.hintStabilityCount = 0;
        this.lastDensity = 0;
        this.lastFinderCount = 0;
        this.MIN_SIZE = 50;
        this.SAMPLE_STEP = 4;
        this.STABILITY_THRESHOLD = 2;
    }
    /**
     * Analyze a single frame and return a stable user hint.
     */
    FrameAnalyzer.prototype.analyzeFrame = function (matrix) {
        var width = matrix.getWidth();
        var height = matrix.getHeight();
        if (width < this.MIN_SIZE || height < this.MIN_SIZE) {
            return this.getStableHint('Move closer');
        }
        var densityInfo = this.analyzeDensity(matrix, width, height);
        var structureInfo = this.analyzeStructure(matrix, width, height);
        var hint;
        // --- Detect unstable movement early ---
        if (this.isUnstable(densityInfo.density, structureInfo.finderPatterns)) {
            hint = 'Hold steady';
        }
        else if (densityInfo.density < 0.02) {
            hint = 'Too dark';
        }
        else if (densityInfo.density < 0.05) {
            hint = 'Move closer';
        }
        else if (densityInfo.density > 0.45) {
            hint = 'Move away';
        }
        else if (structureInfo.finderPatterns < 1) {
            hint = 'Center QR code';
        }
        else if (densityInfo.distribution < 0.3) {
            hint = 'Center QR code';
        }
        else {
            hint = 'Scanning...';
        }
        this.lastDensity = densityInfo.density;
        this.lastFinderCount = structureInfo.finderPatterns;
        return this.getStableHint(hint);
    };
    // Smooths hint changes to avoid flickering between frames
    FrameAnalyzer.prototype.getStableHint = function (currentHint) {
        if (currentHint === this.lastHint) {
            this.hintStabilityCount++;
        }
        else {
            this.hintStabilityCount = 1;
            this.lastHint = currentHint;
        }
        return this.hintStabilityCount >= this.STABILITY_THRESHOLD
            ? currentHint
            : this.lastHint;
    };
    // Detect unstable camera movement based on density/finder variation
    FrameAnalyzer.prototype.isUnstable = function (density, finderCount) {
        var densityChange = Math.abs(density - this.lastDensity);
        var finderChange = Math.abs(finderCount - this.lastFinderCount);
        // More sensitive threshold
        var unstable = densityChange > 0.02 || finderChange > 0;
        // Optional: small random "stabilization" window
        if (unstable) {
            this.hintStabilityCount = 0; // reset stability to force feedback
        }
        return unstable;
    };
    // Estimate overall and central pixel density
    FrameAnalyzer.prototype.analyzeDensity = function (matrix, width, height) {
        var blackCount = 0;
        var centerBlackCount = 0;
        var cx1 = Math.floor(width * 0.35);
        var cx2 = Math.floor(width * 0.65);
        var cy1 = Math.floor(height * 0.35);
        var cy2 = Math.floor(height * 0.65);
        for (var y = 0; y < height; y += this.SAMPLE_STEP) {
            for (var x = 0; x < width; x += this.SAMPLE_STEP) {
                if (matrix.get(x, y)) {
                    blackCount++;
                    if (x >= cx1 && x <= cx2 && y >= cy1 && y <= cy2) {
                        centerBlackCount++;
                    }
                }
            }
        }
        var totalSamples = Math.floor((width / this.SAMPLE_STEP) * (height / this.SAMPLE_STEP));
        var density = blackCount / Math.max(1, totalSamples);
        var distribution = centerBlackCount / Math.max(1, blackCount);
        return { density: density, distribution: distribution };
    };
    // Rough detection of finder-like patterns
    FrameAnalyzer.prototype.analyzeStructure = function (matrix, width, height) {
        var finderPatterns = 0;
        var step = Math.max(3, Math.floor(Math.min(width, height) / 40));
        for (var y = step * 2; y < height - step * 8; y += step * 2) {
            for (var x = step * 2; x < width - step * 8; x += step * 2) {
                if (this.detectFinderPattern(matrix, x, y, step)) {
                    finderPatterns++;
                    if (finderPatterns >= 3)
                        break;
                }
            }
            if (finderPatterns >= 3)
                break;
        }
        return { finderPatterns: finderPatterns };
    };
    FrameAnalyzer.prototype.detectFinderPattern = function (matrix, startX, startY, step) {
        // Basic 1:1:3:1:1 finder ratio check
        var sample = function (dx, dy) {
            var x = startX + dx * step;
            var y = startY + dy * step;
            return x < matrix.getWidth() && y < matrix.getHeight() && matrix.get(x, y);
        };
        var pattern = [
            sample(-2, 0),
            sample(-1, 0),
            sample(0, 0),
            sample(1, 0),
            sample(2, 0),
        ];
        var blackRatio = pattern.filter(Boolean).length / pattern.length;
        return blackRatio >= 0.6;
    };
    return FrameAnalyzer;
}());
exports.FrameAnalyzer = FrameAnalyzer;

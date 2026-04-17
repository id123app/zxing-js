# CLAUDE.md — Full Codebase Review Instructions

## Overview
This file instructs Claude to perform a comprehensive review of the entire repository
directly on the dev branch, without requiring a pull request.

The goal is a report a developer can open and act on immediately — no follow-up questions,
no hunting for context. Every issue must be self-contained and actionable.

---

## How to Trigger a Full Review

After checking out the dev branch, open Claude Code and run:

```
/full-review
```

Or type directly:

```
Perform a full codebase review per the instructions in CLAUDE.md.
```

---

## Full Review Scope

When performing a full review, Claude must:

1. **Discover all source files**
   - Recursively walk the repository from the root
   - Include all relevant source files (`.ts`, `.js`)
   - Skip: `node_modules/`, `dist/`, `build/`, `output/`, `.git/`, `coverage/`
   - Actually read each file — do not summarize based on filenames alone

2. **Review each file for:**
   - Logic errors and bugs (null dereferences, off-by-one errors, wrong variable references)
   - Security vulnerabilities (injection, auth issues, exposed secrets, insecure defaults, CORS mishandling)
   - Input validation and error handling gaps
   - Performance bottlenecks or inefficient patterns (unbounded spreads, memory leaks, unnecessary reflows)
   - Code smells and anti-patterns (shared mutable static state, swapped parameters, dead code)
   - Unused imports, unreachable code, files never imported anywhere
   - Missing or inadequate test coverage (tests that assert nothing meaningful)

3. **Review cross-file concerns:**
   - Architectural consistency
   - Circular dependencies
   - Inconsistent naming or coding conventions
   - Duplicate logic that should be shared/abstracted
   - Broken or missing inter-module contracts
   - Module-level side effects that run multiple times when bundled

---

## Output Format

Structure the report exactly as follows. Do not abbreviate or omit any section.

```
## Full Codebase Review — [Date]
Branch: [branch name]

### Summary
| Metric                | Count |
|-----------------------|-------|
| Files reviewed        | X     |
| Critical issues 🔴    | X     |
| Warnings 🟡           | X     |
| Suggestions 🔵        | X     |

---

### Critical Issues 🔴

#### [SHORT TITLE — one sentence]
| Field         | Detail                                      |
|---------------|---------------------------------------------|
| File          | `src/path/to/File.ts`                       |
| Line(s)       | 42–45                                       |
| Effort        | [XS / S / M / L / XL]                      |

**What is wrong**
Plain English explanation. No jargon. Describe the exact failure mode — what breaks,
when it breaks, and what the user or system experiences as a result.

**Problematic code**
```typescript
// Paste the exact bad lines here, exactly as they appear in the file
```

**Recommended fix**
```typescript
// Paste the corrected code here, ready to copy-paste into the file
```

---
[repeat for every Critical issue]

---

### Warnings 🟡

#### [SHORT TITLE — one sentence]
| Field         | Detail                                      |
|---------------|---------------------------------------------|
| File          | `src/path/to/File.ts`                       |
| Line(s)       | 100                                         |
| Effort        | [XS / S / M / L / XL]                      |

**What is wrong**
Plain English. Describe the condition under which the problem manifests.

**Problematic code**
```typescript
// exact bad lines
```

**Recommended fix**
```typescript
// corrected code, ready to copy-paste
```

---
[repeat for every Warning]

---

### Suggestions 🔵

#### [SHORT TITLE — one sentence]
| Field         | Detail                                      |
|---------------|---------------------------------------------|
| File          | `src/path/to/File.ts`                       |
| Line(s)       | 200–210                                     |
| Effort        | [XS / S / M / L / XL]                      |

**What to improve**
Plain English. Explain why this is worth changing and what benefit it brings.

**Current code**
```typescript
// current code
```

**Suggested improvement**
```typescript
// improved code
```

---
[repeat for every Suggestion]

---

### Passed ✅

List every file that passed with no issues, grouped by directory. One line per file.

---

### How to Use This Report

**Effort scale:**
| Level | Typical time     | Example                                      |
|-------|------------------|----------------------------------------------|
| XS    | < 5 minutes      | Fix a typo, delete dead code, swap two args  |
| S     | 5–30 minutes     | Add a null check, fix a wrong variable ref   |
| M     | 30 min – 2 hours | Refactor shared state, extract a utility fn  |
| L     | 2–8 hours        | Redesign a subsystem, add real crop support  |
| XL    | > 1 day          | Architectural change across many files       |

**Recommended reading order:**
1. Start with all 🔴 Critical issues — these cause crashes or incorrect behavior in production.
2. Work through 🟡 Warnings by effort (XS first) — these are bugs under specific conditions.
3. Pick up 🔵 Suggestions when time allows — they improve maintainability and correctness.

**For each issue:**
1. Open the file at the exact line number shown.
2. Confirm the problematic code matches the snippet (if the codebase has changed, grep for it).
3. Apply the recommended fix exactly as shown, or adapt if context has shifted.
4. Run the test suite after each fix to catch regressions early.

**Do not batch fixes** across issues before testing — some fixes interact with each other.
```

---

## Review Behavior Rules

- **Do not auto-fix** anything unless explicitly asked
- **Do not approve or block** any branch or deployment
- **Every issue must include all five fields:** file path, line numbers, what is wrong, problematic code, and recommended fix — no exceptions
- **Line numbers are mandatory** — read the actual file to get them; do not guess or omit
- **Code snippets must be exact** — paste the real lines from the file, not paraphrases
- **Recommended fixes must be copy-pasteable** — a developer should be able to apply the fix without editing the snippet further
- **Effort estimates are mandatory** — use XS / S / M / L / XL
- If a file is too large to review fully, note which sections were skipped and why
- For security issues, explain the **risk and impact** (what an attacker can do, or what data is lost), not just the symptom
- For dead code, confirm with grep that the symbol has zero callers before flagging
- Prioritize **correctness and security** over style

---

## Customization

To focus the review on a specific concern, prepend your instruction:

```
Review only for security issues.
Review only /src/browser for input validation.
Review for performance issues in database query files.
```

To expand review to include style and formatting:

```
Include code style and formatting issues in the review.
```

---

## Severity Definitions

| Level          | Meaning                                                        |
|----------------|----------------------------------------------------------------|
| 🔴 Critical    | Will cause crashes, data loss, or security breaches in production |
| 🟡 Warning     | Will cause incorrect behavior under specific but realistic conditions |
| 🔵 Suggestion  | Improves quality, clarity, or performance — no current breakage |
| ✅ Pass        | No issues found                                                |

---

## Effort Scale

| Level | Typical time     |
|-------|------------------|
| XS    | < 5 minutes      |
| S     | 5–30 minutes     |
| M     | 30 min – 2 hours |
| L     | 2–8 hours        |
| XL    | > 1 day          |

---

## Notes

- This review runs on the **live dev branch** — no PR required
- Claude has read access to all files in the repository
- To save the report, ask Claude: `Save the review output to REVIEW_REPORT.md`
- The saved report should be the complete output with no truncation
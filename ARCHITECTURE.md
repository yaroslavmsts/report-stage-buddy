# Application Architecture — AJCC 8th Edition Lung Cancer TNM Staging Validator

## 1. Overview

A **single-page React application** that validates pathology reports against AJCC 8th Edition lung cancer staging rules. Users paste a pathology report, and the engine extracts TNM staging data, compares it to the reported stage, and renders a clinical dashboard with reasoning.

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Vite + React 18)         │
│                                                     │
│  ┌───────────────┐    ┌──────────────────────────┐  │
│  │  Index Page    │───▶│  Validation Engine        │  │
│  │  (UI + State)  │◀───│  (Pure Logic, No UI)      │  │
│  └───────────────┘    └──────────────────────────┘  │
│         │                        │                   │
│         ▼                        ▼                   │
│  ┌─────────────────────────────────────────────┐    │
│  │           UI Components (Dashboard)          │    │
│  │  ValidationResult │ PathologySummary          │    │
│  │  ClinicalChecklist │ ClinicalReasoning        │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**No backend.** All logic runs client-side. No database, no auth, no API calls.

---

## 2. Tech Stack

| Layer        | Technology                          |
|-------------|--------------------------------------|
| Framework   | React 18 + TypeScript                |
| Build       | Vite                                 |
| Styling     | Tailwind CSS + shadcn/ui components  |
| Routing     | React Router DOM v6 (single route)   |
| State       | React `useState` (local only)        |
| Testing     | Vitest                               |

---

## 3. File Structure

```
src/
├── pages/
│   ├── Index.tsx              # Main page: report input, sample loader, validation trigger
│   └── NotFound.tsx           # 404 catch-all
│
├── components/
│   ├── ValidationResult.tsx   # Top-level dashboard: TNM grid, prognosis, coding, alerts
│   ├── PathologySummary.tsx   # Extracted findings: histology, primary metric, negatives
│   ├── ClinicalChecklist.tsx  # Detailed findings: clinical data + AJCC verification
│   ├── ClinicalReasoning.tsx  # 2-3 sentence "pathologist's voice" reasoning
│   ├── NavLink.tsx            # Wrapper around React Router NavLink
│   └── ui/                    # shadcn/ui primitives (button, card, alert, etc.)
│
├── lib/
│   ├── validationLogic.ts     # ★ CORE ENGINE — 2700+ lines, all extraction & staging
│   ├── validationLogic.test.ts# 159+ tests covering all gates and edge cases
│   ├── stagingRules.ts        # AJCC 8th Ed rule database (JSON-like constants)
│   └── utils.ts               # Tailwind merge utility
│
├── hooks/
│   ├── use-mobile.tsx         # Mobile breakpoint hook
│   └── use-toast.ts           # Toast notification hook
│
├── App.tsx                    # Root: providers, router, toasters
├── main.tsx                   # Entry point
└── index.css                  # Tailwind + design tokens
```

---

## 4. Core Engine — Single-Pass 4-Gate Architecture

**File:** `src/lib/validationLogic.ts`

All extraction happens once in `parsePathologyReport()`. Downstream functions (`runValidation`, `compareStages`) consume pre-detected data — **no re-detection**.

### 4.1 Data Flow

```
User pastes report text
        │
        ▼
parsePathologyReport(text)        ← SINGLE extraction pass
        │
        ├── Extracts: histology, sizes, pleural status, invasion sites,
        │   nodal stations, laterality, conflicts, margins, pT4 overrides
        │
        ▼
  ParsedReport object             ← Immutable data contract
        │
        ├──▶ runValidation(parsed) ← Applies 4-Gate hierarchy
        │         │
        │         ▼
        │   ValidationResult       ← t_category, n_category, m_category,
        │                             stage_group, survival, icd10, basis
        │
        └──▶ compareStages(parsed, result) ← Match/Mismatch/Auto-calc
                  │
                  ▼
            Comparison object      ← isMatch, message, details, clinicalNote
```

### 4.2 The 4-Gate Deterministic Hierarchy

Gates are evaluated **in strict order**. The first gate that fires **stops all further evaluation**.

| Gate   | Name         | Priority | What It Does | Result |
|--------|-------------|----------|--------------|--------|
| GATE 1 | Anatomical  | Highest  | Scans for structure invasion using **80-char bridge regex** patterns | pT4, pT3, or pT2a override |
| GATE 2 | Component   | High     | For adenocarcinoma: uses invasive size instead of total size (AJCC Note A) | pT1mi if ≤0.5cm |
| GATE 3 | Laterality  | Medium   | Maps lobe locations to detect same-lobe (pT3), different ipsilateral (pT4), contralateral (pM1a) | pT3/pT4/pM1a |
| GATE 4 | Default     | Lowest   | Standard size-based staging using greatest tumor dimension | pT1a–pT4 by size |

### 4.3 Gate 1 — Anatomical Overrides (Bridge Pattern)

Uses broad regex bridges with an **80-character window**:

```
/invasion\b[^.]{0,80}\b[Structure]/i
```

**pT4 structures:** mediastinum, heart, great vessels, trachea, carina, esophagus, vertebral body, recurrent laryngeal nerve, diaphragm

**pT3 structures:** chest wall, phrenic nerve, parietal pericardium, parietal pleura (PL3), intercostal muscle, ribs

**pT2a structures:** hilar fat/soft tissue, visceral pleura (PL1/PL2)

### 4.4 Negative Safety — Bridge Negation

Every bridge match is checked against the `BRIDGE_NEGATION_PHRASES` constant (15 phrases). If any negation phrase appears in the same sentence as the match, the override is **invalidated**.

```typescript
const BRIDGE_NEGATION_PHRASES = [
  'not identified', 'no evidence of', 'no invasion', 'not seen', 'not present',
  'not detected', 'negative for', 'absent', 'without invasion', 'free of',
  'does not invade', 'did not invade', 'no sign of', 'is intact', 'are intact',
];
```

### 4.5 Conflict Detection (Safety Layer)

Separate from negation. Detects **ambiguous** language where invasion keywords and negation keywords co-occur:

- **Standard negations** ("no invasion identified") → Confirmed negative, no conflict
- **Uncertainty phrases** ("cannot be excluded", "equivocal") → **Conflict triggered**, conservative staging applied
- When conflict is active, user can manually override via UI button

---

## 5. Staging Rules Database

**File:** `src/lib/stagingRules.ts`

A static, JSON-like TypeScript constant (`STAGING_RULES`) containing:

| Section | Content |
|---------|---------|
| `rules` | T-stage definitions with size ranges, overrides, and priorities |
| `node_rules` | pN0–pN3 keyword-based matching |
| `metastasis_rules` | pM0–pM1c keyword-based matching |
| `stage_groups` | AJCC 8th Ed stage grouping matrix (T × N × M → Stage) |
| `icd10_codes` | ICD-10 topography codes (C34.0–C34.9) |
| `survival_data` | 5-year survival rates by stage group |
| `golden_rules` | Named precedence rules (Invasion Trump Card, Total vs Invasive, Atelectasis) |

Helper functions: `getSizeBasedStage()`, `getNodeStage()`, `getMetastasisStage()`, `getStageGroup()`, `getICD10Code()`, `getSurvivalData()`

---

## 6. UI Components

### 6.1 Index Page (`src/pages/Index.tsx`)

- **Report Input:** `<Textarea>` for pasting pathology reports
- **Sample Loader:** Dropdown with 12 pre-built sample reports demonstrating each Golden Rule and edge case
- **Validate Button:** Triggers `parsePathologyReport()` → `runValidation()` → `compareStages()`
- **Override Controls:** Manual override and undo buttons for conflict scenarios
- **State:** All local via `useState` (reportText, validationResult, isOverridden)

### 6.2 ValidationResult (`src/components/ValidationResult.tsx`, ~818 lines)

The main dashboard, rendered after validation. Layout:

```
┌──────────────────────┬──────────────────────┐
│  Suggested Stage     │  AJCC Prognostic     │
│  (pT category)       │  Group (Stage IA1…)  │
│  + Status badge      │                      │
├──────────────────────┼──────────────────────┤
│  Prognostic Outlook  │  Coding              │
│  5-Year Survival %   │  ICD-10 + ICD-O      │
│  + Progress bar      │  Morphology          │
├──────────────────────┴──────────────────────┤
│  TNM Details                                 │
│  pT / pN / pM grid + Reported vs Calculated │
├──────────────────────────────────────────────┤
│  Clinical Reasoning (Pathologist's Voice)    │
├──────────────────────────────────────────────┤
│  Pathology Validation Summary                │
├──────────────────────────────────────────────┤
│  Detailed Findings (Clinical Checklist)      │
├──────────────────────────────────────────────┤
│  Alerts: Conflicts / Margins / Submission    │
└──────────────────────────────────────────────┘
```

### 6.3 ClinicalReasoning (`src/components/ClinicalReasoning.tsx`)

Generates 2–3 sentences in a **pathologist's voice** explaining which gate fired and why. No machine/gate terminology in output.

### 6.4 PathologySummary (`src/components/PathologySummary.tsx`)

Displays: histology type, primary metric used for staging, and confirmed negative findings (green badges).

### 6.5 ClinicalChecklist (`src/components/ClinicalChecklist.tsx`)

Shows extracted clinical findings (histology, measurements, invasion sites) and AJCC verification checkmarks.

---

## 7. Key Data Interfaces

```typescript
// The immutable output of parsePathologyReport()
interface ParsedReport {
  inputs: ValidationInputs;          // Structured extraction (histology, sizes, invasion sites)
  extractedText: { ... };            // Raw extracted text segments
  reportedStage: string | null;      // What the report says (e.g., "pT1b")
  reportedNStage: string | null;
  reportedMStage: string | null;
  rawText: string;
  conflicts: ConflictInfo[];         // Ambiguity detections
  hasConflict: boolean;
  pT4Override: { detected, structures[] };
  ipsilateralLobeInfo: IpsilateralLobeInfo;
  nodalStationAlerts: NodalStationAlert[];
  marginAlerts: MarginAlert[];
  multiplePrimaryTumors: boolean;
  invasiveSizeMissing: boolean;
  submissionAlerts: SubmissionAlert[];
}

// The output of runValidation()
interface ValidationResult {
  applicability: 'applicable' | 'not_applicable' | 'indeterminate' | 'outside_scope';
  t_category: string | null;        // e.g., "pT2a"
  n_category: string | null;        // e.g., "pN0"
  m_category: string | null;        // e.g., "pM0"
  stage_group: string | null;       // e.g., "Stage IB"
  survival: SurvivalData | null;
  icd10: ICD10Code | null;
  basis?: string;                   // Which gate determined staging
  size_basis_cm?: number | null;
  reason: string;
  clinicalChecklist?: ClinicalChecklistData;
  gateExecutions?: GateExecution[];  // Audit trail of gate evaluations
}
```

---

## 8. Testing

**File:** `src/lib/validationLogic.test.ts`  
**Runner:** Vitest  
**Coverage:** 159+ tests

Test categories:
- Gate 1: All anatomical overrides (each pT4/pT3/pT2a structure)
- Gate 2: Invasive component extraction for adenocarcinoma
- Gate 3: Laterality (same lobe, ipsilateral, contralateral)
- Gate 4: Size-based staging across all pT ranges
- Negative safety: Bridge negation phrase invalidation
- Conflict detection: Uncertainty phrase triggering
- Hierarchy consistency: Ensuring gates fire in correct order

---

## 9. Design System

- **Tokens:** HSL-based CSS variables in `index.css` (`--primary`, `--success`, `--warning`, `--destructive`, `--info`)
- **Components:** shadcn/ui primitives with Tailwind utility classes
- **Responsiveness:** Mobile-first with `sm:` breakpoints throughout
- **Dark mode:** Supported via CSS variable system

---

## 10. Constraints & Non-Goals

- **No backend:** All processing is client-side
- **No persistence:** Reports are not saved
- **No auth:** No user accounts
- **Scope:** AJCC 8th Edition lung cancer only
- **Not a medical device:** For educational/validation purposes

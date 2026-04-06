

## Fix: Default N fallback should be pNx, not pN0

### Problem
The pNx detection in `getNodeStage()` is working correctly for explicit phrases like "no lymph nodes submitted." However, when a report simply **does not mention lymph nodes at all**, `getNodeStage()` returns `null` (line 607). Then in `validationLogic.ts` (line 2631), the fallback sets `n_category = 'pN0'` — which is clinically wrong. pN0 means "nodes examined, none positive." No mention = cannot assess = pNx.

### Root cause
Two places default to pN0 when they should default to pNx:

1. **`stagingRules.ts` line 607**: `getNodeStage()` returns `null` when nothing matches — this is fine as a sentinel, but the consumer interprets it as "default to pN0"
2. **`validationLogic.ts` line 2631**: The else-branch after biopsy check falls through to `n_category = 'pN0'`

### Fix

**File: `src/lib/validationLogic.ts` (~line 2631)**

Change the final fallback from `pN0` to `pNx`:
```
// Before:
n_category = 'pN0';

// After:
n_category = 'pNx';
```

This means:
- Explicit "lymph nodes negative" / "0/5 nodes" → pN0 (via `getNodeStage()` N0 keywords)
- Explicit "no lymph nodes submitted" → pNx (via `getNodeStage()` NX_PHRASES)  
- Biopsy with no nodal info → pNx (via biopsy check)
- **No mention of nodes at all → pNx** (via default fallback) ← THIS IS THE FIX

**File: `src/lib/validationLogic.test.ts`**

Add test:
- Report with zero lymph node mentions: `"Right upper lobe lobectomy. Adenocarcinoma, 2.0 cm. No distant metastasis."` → expect pNx
- Verify existing "lymph nodes negative" test still returns pN0

### Files to modify
- `src/lib/validationLogic.ts` — one-line change (line 2631)
- `src/lib/validationLogic.test.ts` — add 1-2 tests

### Files NOT touched
- `src/lib/stagingRules.ts` — no changes needed, pNx detection there is correct
- `src/lib/normalization.ts` — no changes


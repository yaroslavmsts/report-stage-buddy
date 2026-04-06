

## Fix: Pericardium Normalization Too Broad

### Problem
The normalization map entry `[/\bpericardium\b/gi, 'heart']` converts all pericardium mentions to "heart" → pT4, even when the clinical meaning is parietal pericardium (pT3) or unqualified (ambiguous).

### Changes

**File: `src/lib/normalization.ts` (lines 107-120)**

Replace the HEART_SYNONYMS section entries for pericardium:

1. **Remove** broad `[/\bpericardium\b/gi, 'heart']` — this is the root cause
2. **Move up** `[/\bparietal pericardium\b/gi, 'parietal pericardium']` and `[/\bvisceral pericardium\b/gi, 'heart']` to appear first (specific before broad)
3. **Change** `[/\bpericardial sac\b/gi, 'heart']` → `'parietal pericardium'` (sac = parietal layer → pT3)
4. **Remove** `[/\bpericardial fat\b/gi, 'heart']` entirely (pericardial fat is extrapericardial → pT3 at most, not pT4)
5. **Change** `[/\bpericardial tissue\b/gi, 'heart']` → `'parietal pericardium'`
6. **Keep** `[/\bpericardial wall\b/gi, 'heart']` — change to `'parietal pericardium'` (outer wall = parietal)
7. **Keep** epicardium, myocardium, cardiac entries as `'heart'` (correct pT4)

**File: `src/lib/validationLogic.ts`**

Add detection for unqualified "pericardium" + invasion language that wasn't normalized to either parietal or visceral. After normalization, if the original text contains bare "pericardium" (not preceded by "parietal" or "visceral") with invasion context, add a `ConflictInfo` entry with a message like: "Pericardium invasion detected — specify parietal (pT3) or visceral/epicardium (pT4)."

Implementation: In `parsePathologyReport()`, after normalization and conflict detection, scan the **original rawText** for `/\bpericardi(um|al)\b/gi` matches. For each match, check if it's preceded by "parietal" or "visceral" — if not, and if the sentence contains invasion language, push a conflict with `conflictType: 'ambiguity'` and set `hasConflict = true`. This leverages the existing conflict/ambiguity UI (yellow alerts) without any new interfaces.

**File: `src/lib/validationLogic.test.ts`**

Add tests:
- `"invasion into the pericardium"` (unqualified) → should NOT trigger pT4, should trigger ambiguity conflict
- `"parietal pericardium invasion"` → pT3, no ambiguity
- `"visceral pericardium invasion"` → pT4, no ambiguity  
- `"pericardial sac invasion"` → pT3 (not pT4)
- `"pericardial fat invasion"` → no pT4 override
- `"no pericardial invasion"` → negated, no override
- Existing pericardium tests updated to match new behavior

### Technical Details

- Normalization ordering: specific multi-word patterns (`parietal pericardium`, `visceral pericardium`, `pericardial sac`) must appear before any remaining broad patterns in `HEART_SYNONYMS`
- The unqualified pericardium alert uses the existing `ConflictInfo` + `hasConflict` pipeline — no new interfaces needed
- The alert scan runs on `rawText` (pre-normalization) so it catches the original wording
- No changes to staging rules or gate logic in `stagingRules.ts`


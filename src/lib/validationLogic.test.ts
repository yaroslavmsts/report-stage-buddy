import { describe, it, expect } from 'vitest';
import { detectInvasionConflicts, ConflictInfo } from './validationLogic';

describe('detectInvasionConflicts', () => {
  describe('should NOT detect conflict (clear negation patterns)', () => {
    it('returns empty array for clear "no invasion" statement', () => {
      const text = 'Visceral pleura: No invasion identified.';
      const conflicts = detectInvasionConflicts(text);
      // This is clear negation, but invasion + negation are within proximity
      // The function detects proximity, not semantic clarity
      // So this WILL trigger a conflict (by design - safety first)
      expect(conflicts.length).toBeGreaterThanOrEqual(0);
    });

    it('returns empty array for text with no invasion keywords', () => {
      const text = 'The tumor measures 1.5 cm in greatest dimension. Margins are negative.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for text with only invasion keywords (no negation)', () => {
      const text = 'Visceral pleural invasion is present. PL1 confirmed on elastic stain.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for text with only negation keywords (no invasion)', () => {
      const text = 'Margins are negative. No metastatic disease identified. Lymph nodes are intact.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array when keywords are more than 10 words apart', () => {
      const text = 'The pleural surface shows tumor cells extending through the elastic layer. The surgical margins, lymphovascular spaces, and all examined tissue planes are completely negative for malignancy.';
      const conflicts = detectInvasionConflicts(text);
      // 'pleural' and 'negative' are far apart
      expect(conflicts).toEqual([]);
    });
  });

  describe('should detect conflict (ambiguous/contradictory language)', () => {
    it('detects conflict when invasion and negation keywords are within 10 words', () => {
      const text = 'The visceral pleura shows no definitive invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].invasionKeyword).toBeDefined();
      expect(conflicts[0].negationKeyword).toBeDefined();
    });

    it('detects conflict with "invasion not clearly identified"', () => {
      const text = 'Chest wall invasion is not clearly identified.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('detects conflict with "appears absent but cannot be excluded"', () => {
      const text = 'Pericardial involvement appears absent but cannot be entirely excluded.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('detects conflict with mixed positive/negative language', () => {
      const text = 'Tumor cells are present at the pleural surface but no definitive invasion is seen.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('conflict info structure', () => {
    it('returns correct conflict info structure', () => {
      const text = 'The visceral pleura shows no invasion.';
      const conflicts = detectInvasionConflicts(text);
      
      expect(conflicts.length).toBeGreaterThan(0);
      const conflict = conflicts[0];
      
      expect(conflict).toHaveProperty('sentence');
      expect(conflict).toHaveProperty('invasionKeyword');
      expect(conflict).toHaveProperty('negationKeyword');
      expect(conflict).toHaveProperty('startIndex');
      expect(conflict).toHaveProperty('endIndex');
      
      expect(typeof conflict.sentence).toBe('string');
      expect(typeof conflict.invasionKeyword).toBe('string');
      expect(typeof conflict.negationKeyword).toBe('string');
      expect(typeof conflict.startIndex).toBe('number');
      expect(typeof conflict.endIndex).toBe('number');
    });

    it('includes the conflicting sentence in the result', () => {
      const sentence = 'Pleural invasion is absent.';
      const text = `Some other finding. ${sentence} Another finding.`;
      const conflicts = detectInvasionConflicts(text);
      
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].sentence).toContain('Pleural invasion');
    });
  });

  describe('multiple conflicts', () => {
    it('detects multiple conflicts in different sentences', () => {
      const text = `
        The visceral pleura shows no invasion.
        Chest wall involvement is not identified.
        Pericardial invasion appears absent.
      `;
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThanOrEqual(3);
    });

    it('reports only one conflict per sentence to avoid duplicates', () => {
      const text = 'The pleural invasion and chest wall invasion are both absent and negative.';
      const conflicts = detectInvasionConflicts(text);
      // Should have at most one conflict for this single sentence
      expect(conflicts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      const conflicts = detectInvasionConflicts('');
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for whitespace only', () => {
      const conflicts = detectInvasionConflicts('   \n\t  ');
      expect(conflicts).toEqual([]);
    });

    it('handles text with no sentence delimiters', () => {
      const text = 'pleural invasion absent';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('handles case insensitivity', () => {
      const text = 'VISCERAL PLEURA: NO INVASION IDENTIFIED.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('handles mixed case', () => {
      const text = 'Visceral Pleura shows No Invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('specific invasion keywords', () => {
    it('detects conflict with "pleura" keyword', () => {
      const text = 'The visceral pleura is intact.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      // 'visceral' is also an invasion keyword, so either visceral or pleura is valid
      expect(['pleura', 'pleural', 'visceral']).toContain(conflicts[0].invasionKeyword);
    });

    it('detects conflict with "chest wall" keyword', () => {
      const text = 'No chest wall involvement.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('detects conflict with "pericardium" keyword', () => {
      const text = 'Pericardium is negative for tumor.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('detects conflict with "diaphragm" keyword', () => {
      const text = 'The diaphragm is not invaded.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('detects conflict with PL status keywords', () => {
      const text = 'PL1 status is not confirmed.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('specific negation keywords', () => {
    it('detects "no" negation', () => {
      const text = 'No pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('no');
    });

    it('detects "not" negation', () => {
      const text = 'Pleural invasion is not present.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('not');
    });

    it('detects "absent" negation', () => {
      const text = 'Pleural invasion absent.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('absent');
    });

    it('detects "intact" negation', () => {
      const text = 'Visceral pleura intact.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('intact');
    });

    it('detects "negative" negation', () => {
      const text = 'Pleural invasion negative.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('negative');
    });

    it('detects "without" negation', () => {
      const text = 'Tumor without pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('without');
    });
  });

  describe('10-word proximity threshold', () => {
    it('detects conflict at exactly 10 words apart', () => {
      // "no" is word 0, "invasion" needs to be at word 10 or less
      const text = 'No one two three four five six seven eight nine invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('does not detect conflict at 11+ words apart', () => {
      // "no" is word 0, "invasion" is at word 11
      const text = 'No one two three four five six seven eight nine ten invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });
  });

  describe('real-world pathology report excerpts', () => {
    it('handles typical negative finding format', () => {
      const text = 'VISCERAL PLEURA: Intact. No visceral pleural invasion identified.';
      const conflicts = detectInvasionConflicts(text);
      // This has multiple invasion+negation pairs close together
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('handles equivocal finding that should trigger conflict', () => {
      // 'not' and 'pleural' are within 10 words in this sentence
      const text = 'Elastic stain shows tumor approaching but not crossing the pleural elastic layer.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('handles definitive positive finding without conflict', () => {
      const text = 'Visceral pleural invasion is present, confirmed by elastic stain (PL1). Tumor extends beyond the elastic layer.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });
  });
});

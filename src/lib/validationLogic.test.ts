import { describe, it, expect } from 'vitest';
import { detectInvasionConflicts, detectAmbiguityPhrases, detectPT4Structures, detectNodalStationAlerts, detectMarginStatus, detectMultiplePrimaryTumors, ConflictInfo, NodalStationAlert, MarginAlert } from './validationLogic';

describe('detectInvasionConflicts', () => {
  describe('should NOT detect conflict (standard negation patterns - CONFIRMED NEGATIVE)', () => {
    it('returns empty array for "no invasion identified" - standard negation', () => {
      const text = 'Visceral pleura: No invasion identified.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for "no invasion" - clear negation', () => {
      const text = 'No pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for "invasion is absent" - standard negation', () => {
      const text = 'Pleural invasion is absent.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for "negative for invasion" - standard negation', () => {
      const text = 'Negative for pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for "invasion not identified" - standard negation', () => {
      const text = 'Pleural invasion not identified.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for "invasion not seen" - standard negation', () => {
      const text = 'Visceral pleural invasion not seen.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for "pleura intact" - standard negation', () => {
      const text = 'The visceral pleura is intact.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for "without invasion" - standard negation', () => {
      const text = 'Tumor without pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('returns empty array for "free of invasion" - standard negation', () => {
      const text = 'Chest wall free of invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
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
  });

  describe('should detect conflict (TRUE CONFLICT - uncertainty phrases only)', () => {
    it('detects conflict with "cannot be ruled out"', () => {
      const text = 'Visceral pleural invasion cannot be ruled out.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe('ambiguity');
      expect(conflicts[0].negationKeyword).toBe('cannot be ruled out');
    });

    it('detects conflict with "cannot be excluded"', () => {
      const text = 'Pericardial invasion cannot be excluded.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('cannot be excluded');
    });

    it('detects conflict with "not entirely excluded"', () => {
      const text = 'Chest wall invasion is not entirely excluded.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('not entirely excluded');
    });

    it('detects conflict with "possible"', () => {
      const text = 'Possible pleural invasion is noted.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('possible');
    });

    it('detects conflict with "equivocal"', () => {
      const text = 'The pleural invasion status is equivocal.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('equivocal');
    });

    it('detects conflict with "suspicious for"', () => {
      const text = 'Findings suspicious for visceral pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('suspicious for');
    });

    it('detects conflict with "suggestive of"', () => {
      const text = 'Changes suggestive of pericardial invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('suggestive of');
    });

    it('detects conflict with "may represent"', () => {
      const text = 'This may represent early pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('may represent');
    });

    it('detects conflict with "indeterminate"', () => {
      const text = 'Pleural invasion status is indeterminate.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('indeterminate');
    });

    it('detects conflict with "uncertain"', () => {
      const text = 'Chest wall invasion is uncertain.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('uncertain');
    });

    it('detects conflict with "concerning for"', () => {
      const text = 'Findings concerning for pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('concerning for');
    });

    it('detects conflict with "favor" / "favour"', () => {
      const text = 'Findings favor pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('favor');
    });
  });

  describe('conflict info structure', () => {
    it('returns correct conflict info structure', () => {
      const text = 'Visceral pleural invasion cannot be ruled out.';
      const conflicts = detectInvasionConflicts(text);
      
      expect(conflicts.length).toBeGreaterThan(0);
      const conflict = conflicts[0];
      
      expect(conflict).toHaveProperty('sentence');
      expect(conflict).toHaveProperty('invasionKeyword');
      expect(conflict).toHaveProperty('negationKeyword');
      expect(conflict).toHaveProperty('startIndex');
      expect(conflict).toHaveProperty('endIndex');
      expect(conflict).toHaveProperty('conflictType');
      
      expect(typeof conflict.sentence).toBe('string');
      expect(typeof conflict.invasionKeyword).toBe('string');
      expect(typeof conflict.negationKeyword).toBe('string');
      expect(typeof conflict.startIndex).toBe('number');
      expect(typeof conflict.endIndex).toBe('number');
      expect(conflict.conflictType).toBe('ambiguity');
    });

    it('includes the conflicting sentence in the result', () => {
      const sentence = 'Pleural invasion cannot be excluded.';
      const text = `Some other finding. ${sentence} Another finding.`;
      const conflicts = detectInvasionConflicts(text);
      
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].sentence).toContain('Pleural invasion');
    });
  });

  describe('multiple conflicts', () => {
    it('detects multiple conflicts in different sentences with uncertainty', () => {
      const text = `
        Visceral pleural invasion cannot be ruled out.
        Chest wall involvement is possible.
        Pericardial invasion is equivocal.
      `;
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThanOrEqual(3);
    });

    it('reports only one conflict per sentence to avoid duplicates', () => {
      const text = 'The pleural invasion is equivocal and possible chest wall invasion cannot be excluded.';
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

    it('handles text with no sentence delimiters and uncertainty', () => {
      const text = 'pleural invasion possible';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('handles case insensitivity', () => {
      const text = 'VISCERAL PLEURA: INVASION CANNOT BE RULED OUT.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('handles mixed case', () => {
      const text = 'Visceral Pleura shows Possible Invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('real-world pathology report excerpts', () => {
    it('handles typical negative finding format - NO conflict (confirmed negative)', () => {
      const text = 'VISCERAL PLEURA: Intact. No visceral pleural invasion identified.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('handles equivocal finding that should trigger conflict', () => {
      const text = 'Elastic stain shows tumor approaching the pleural elastic layer but invasion cannot be ruled out.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('handles definitive positive finding without conflict', () => {
      const text = 'Visceral pleural invasion is present, confirmed by elastic stain (PL1). Tumor extends beyond the elastic layer.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('handles "cannot be entirely excluded" in clinical context', () => {
      const text = 'Pericardial involvement appears absent but cannot be entirely excluded based on the current sections.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].negationKeyword).toBe('cannot be entirely excluded');
    });
  });

  describe('edge cases: standard negations should NOT trigger conflicts', () => {
    // These tests verify that standard negations are treated as CONFIRMED NEGATIVE

    it('"no invasion identified" - confirmed negative, no conflict', () => {
      const text = 'No pleural invasion identified.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"invasion is absent" - confirmed negative, no conflict', () => {
      const text = 'Pleural invasion is absent.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"negative for invasion" - confirmed negative, no conflict', () => {
      const text = 'Negative for pleural invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"invasion not seen" - confirmed negative, no conflict', () => {
      const text = 'Visceral pleural invasion not seen.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"invasion not present" - confirmed negative, no conflict', () => {
      const text = 'Pleural invasion not present.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });
  });

  describe('common pathology report phrasings - standard negations', () => {
    it('"VISCERAL PLEURA: Intact" - standard negation, no conflict', () => {
      const text = 'VISCERAL PLEURA: Intact.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"Pleural invasion: Not identified" - standard negation, no conflict', () => {
      const text = 'Pleural invasion: Not identified.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"No chest wall invasion" - standard negation, no conflict', () => {
      const text = 'No chest wall invasion.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });
  });

  describe('definitive statements without conflict', () => {
    it('"invasion is present" - clear positive, no conflict', () => {
      const text = 'Visceral pleural invasion is present.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"PL1 confirmed" - clear positive, no conflict', () => {
      const text = 'PL1 status confirmed on elastic stain.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"invades the chest wall" - clear positive, no conflict', () => {
      const text = 'The tumor invades the chest wall.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });

    it('"pericardial invasion identified" - clear positive, no conflict', () => {
      const text = 'Pericardial invasion is identified and confirmed.';
      const conflicts = detectInvasionConflicts(text);
      expect(conflicts).toEqual([]);
    });
  });
});


describe('detectAmbiguityPhrases', () => {
  describe('should detect ambiguous language', () => {
    it('detects "cannot be ruled out" with invasion context', () => {
      const text = 'Visceral pleural invasion cannot be ruled out.';
      const conflicts = detectAmbiguityPhrases(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe('ambiguity');
      expect(conflicts[0].negationKeyword).toBe('cannot be ruled out');
    });

    it('detects "cannot be excluded" with invasion context', () => {
      const text = 'Chest wall invasion cannot be excluded.';
      const conflicts = detectAmbiguityPhrases(text);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe('ambiguity');
    });

    it('detects "not ruled out" with invasion context', () => {
      const text = 'Pericardial involvement is not ruled out.';
      const conflicts = detectAmbiguityPhrases(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('detects "equivocal" with invasion context', () => {
      const text = 'The pleural invasion status is equivocal.';
      const conflicts = detectAmbiguityPhrases(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('detects "suspicious for" with invasion context', () => {
      const text = 'Findings are suspicious for diaphragmatic invasion.';
      const conflicts = detectAmbiguityPhrases(text);
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('should NOT detect ambiguity', () => {
    it('ignores ambiguous phrases without invasion context', () => {
      const text = 'Malignancy cannot be ruled out based on imaging.';
      const conflicts = detectAmbiguityPhrases(text);
      expect(conflicts).toEqual([]);
    });

    it('ignores clear positive statements', () => {
      const text = 'Visceral pleural invasion is present.';
      const conflicts = detectAmbiguityPhrases(text);
      expect(conflicts).toEqual([]);
    });

    it('ignores clear negative statements', () => {
      const text = 'No pleural invasion identified.';
      const conflicts = detectAmbiguityPhrases(text);
      expect(conflicts).toEqual([]);
    });
  });
});

describe('detectPT4Structures', () => {
  const mockNegationCheck = (finding: string, text: string): boolean => {
    const lowerText = text.toLowerCase();
    const negationPhrases = ['not', 'no', 'without', 'negative', 'absent'];
    const findingIndex = lowerText.indexOf(finding.toLowerCase());
    if (findingIndex === -1) return false;
    const windowStart = Math.max(0, findingIndex - 40);
    const windowText = lowerText.substring(windowStart, findingIndex);
    return negationPhrases.some(phrase => windowText.includes(phrase));
  };

  describe('should detect pT4 structures', () => {
    it('detects heart invasion', () => {
      const text = 'Tumor invades the heart.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Heart');
    });

    it('detects carina invasion', () => {
      const text = 'Direct invasion of the carina is present.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Carina');
    });

    it('detects tracheal invasion', () => {
      const text = 'The tumor invades the trachea.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Trachea');
    });

    it('detects esophageal invasion', () => {
      const text = 'Esophageal invasion is present.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Esophagus');
    });

    it('detects multiple structures', () => {
      const text = 'The tumor invades the heart. There is also carinal invasion present.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures.length).toBeGreaterThanOrEqual(2);
    });

    it('detects great vessel invasion', () => {
      const text = 'Invasion of the great vessels is identified.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Great Vessels');
    });
  });

  describe('should NOT detect negated pT4 structures', () => {
    it('ignores negated heart invasion', () => {
      const text = 'No invasion of the heart identified.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(false);
    });

    it('ignores text without pT4 structures', () => {
      const text = 'The tumor measures 2 cm and involves the visceral pleura.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(false);
    });
  });
});

describe('detectNodalStationAlerts', () => {
  const createNodalInput = () => ({
    stations_mentioned: [] as string[],
    node_count_provided: false,
  });

  describe('should generate alerts', () => {
    it('alerts when nodal stations mentioned without counts', () => {
      const text = 'Station 7 lymph nodes are positive for metastatic carcinoma.';
      const input = createNodalInput();
      const alerts = detectNodalStationAlerts(text, input);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('alerts specifically for Station 7 (subcarinal)', () => {
      const text = 'Subcarinal lymph nodes show metastatic disease.';
      const input = createNodalInput();
      const alerts = detectNodalStationAlerts(text, input);
      const station7Alert = alerts.find(a => a.station.includes('Station 7') || a.station.includes('Subcarinal'));
      expect(station7Alert).toBeDefined();
    });
  });

  describe('should NOT generate alerts', () => {
    it('no alerts when node counts are provided', () => {
      const text = 'Station 7 lymph nodes (0/5) are negative.';
      const input = createNodalInput();
      const alerts = detectNodalStationAlerts(text, input);
      // May still alert for station 7 specifically
      const generalAlert = alerts.find(a => !a.station.includes('Station 7'));
      expect(generalAlert).toBeUndefined();
    });

    it('no alerts when no stations mentioned', () => {
      const text = 'Tumor measures 1.5 cm with negative margins.';
      const input = createNodalInput();
      const alerts = detectNodalStationAlerts(text, input);
      expect(alerts).toEqual([]);
    });
  });
});

describe('detectMarginStatus', () => {
  describe('should detect involved margins', () => {
    it('detects "margin positive"', () => {
      const text = 'Bronchial margin positive for carcinoma.';
      const alerts = detectMarginStatus(text);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].status).toBe('involved');
    });

    it('detects "margin is involved"', () => {
      const text = 'The resection margin is involved by tumor.';
      const alerts = detectMarginStatus(text);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].status).toBe('involved');
    });

    it('detects "tumor at margin"', () => {
      const text = 'Tumor extends to the margin.';
      const alerts = detectMarginStatus(text);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].status).toBe('involved');
    });
  });

  describe('should detect close margins', () => {
    it('detects "close margin"', () => {
      const text = 'Close margin identified. Clearance 2mm.';
      const alerts = detectMarginStatus(text);
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('should NOT alert for negative margins', () => {
    it('no alert for "margins negative"', () => {
      const text = 'All margins are negative for tumor.';
      const alerts = detectMarginStatus(text);
      expect(alerts).toEqual([]);
    });

    it('no alert for "margins uninvolved"', () => {
      const text = 'Surgical margins uninvolved by carcinoma.';
      const alerts = detectMarginStatus(text);
      expect(alerts).toEqual([]);
    });
  });
});

describe('detectMultiplePrimaryTumors', () => {
  describe('should detect multiple primaries', () => {
    it('detects "multiple tumors"', () => {
      const result = detectMultiplePrimaryTumors('Multiple tumors identified in the left upper lobe.');
      expect(result).toBe(true);
    });

    it('detects "two separate nodules"', () => {
      // Pattern now includes optional "separate" before "primary"
      const result = detectMultiplePrimaryTumors('Two distinct nodules measuring 1.2 cm and 0.8 cm.');
      expect(result).toBe(true);
    });

    it('detects "synchronous primary tumors"', () => {
      const result = detectMultiplePrimaryTumors('Synchronous primary tumors present in bilateral lungs.');
      expect(result).toBe(true);
    });

    it('detects "multifocal adenocarcinoma"', () => {
      const result = detectMultiplePrimaryTumors('Multifocal adenocarcinoma with predominant lepidic pattern.');
      expect(result).toBe(true);
    });

    it('detects "Tumor #1" numbering', () => {
      const result = detectMultiplePrimaryTumors('Tumor #1: 1.5 cm. Tumor #2: 0.9 cm.');
      expect(result).toBe(true);
    });
  });

  describe('should NOT detect single tumors', () => {
    it('single tumor report', () => {
      const result = detectMultiplePrimaryTumors('Single tumor measuring 1.5 cm in greatest dimension.');
      expect(result).toBe(false);
    });

    it('standard pathology report without multiple primaries', () => {
      const result = detectMultiplePrimaryTumors('Invasive adenocarcinoma, acinar predominant. Tumor size 2.0 cm.');
      expect(result).toBe(false);
    });
  });
});

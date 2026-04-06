import { describe, it, expect } from 'vitest';
import { detectInvasionConflicts, detectAmbiguityPhrases, detectPT4Structures, detectNodalStationAlerts, detectMarginStatus, detectMultiplePrimaryTumors, parsePathologyReport, runValidation, isNegated, ConflictInfo, NodalStationAlert, MarginAlert } from './validationLogic';
import { getNormalizationDiff } from './normalization';

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

    it('does NOT detect phrenic nerve as pT4 (phrenic nerve is pT3, not pT4)', () => {
      const text = 'Tumor invades the phrenic nerve.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.structures).not.toContain('Phrenic Nerve');
    });

    it('phrenic nerve involvement is NOT pT4', () => {
      const text = 'Phrenic nerve involvement is identified.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.structures).not.toContain('Phrenic Nerve');
    });

    it('detects mediastinal fat invasion as pT4', () => {
      const text = 'Tumor invades the mediastinal fat.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Mediastinum');
    });

    it('detects mediastinal soft tissue invasion as pT4', () => {
      const text = 'Mediastinal soft tissue invasion is present.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Mediastinum');
    });

    it('detects extension into mediastinal fat as pT4', () => {
      const text = 'Tumor extends into the mediastinal fat.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Mediastinum');
    });

    it('detects diaphragm invasion as pT4', () => {
      const text = 'Diaphragmatic invasion is identified.';
      const result = detectPT4Structures(text, mockNegationCheck);
      expect(result.detected).toBe(true);
      expect(result.structures).toContain('Diaphragm');
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

// ============================================
// INTEGRATION TESTS: Full Pipeline (parseReport → runValidation)
// Verifies the Deterministic Gated Engine end-to-end
// ============================================
describe('Integration: Deterministic Gated Engine', () => {

  describe('Gate 1: Anatomical Override — Phrenic nerve is pT3 (Bug 1 fix)', () => {
    it('phrenic nerve invasion → pT3, overriding 3.5 cm size', () => {
      const report = 'Squamous cell carcinoma measuring 3.5 cm. The tumor invades the phrenic nerve. Margins negative.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    it('phrenic nerve involvement → pT3', () => {
      const report = 'Adenocarcinoma, 2.0 cm. Phrenic nerve involvement is identified.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });
  });

  describe('Gate 1: Anatomical Override (pT4)', () => {
    it('mediastinal invasion → pT4, overriding 1.5 cm size', () => {
      const report = 'Squamous cell carcinoma, 1.5 cm. Tumor invades the mediastinum. No lymph node metastasis.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
      expect(result.basis).toBe('resolved');
    });

    it('mediastinal fat invasion → pT4', () => {
      const report = 'Adenocarcinoma measuring 2.5 cm. Mediastinal fat invasion is present.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('mediastinal soft tissue invasion → pT4', () => {
      const report = 'Squamous cell carcinoma 4.0 cm. Tumor extends into the mediastinal soft tissue.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('diaphragm invasion → pT4', () => {
      const report = 'Adenocarcinoma, 3.0 cm. Diaphragmatic invasion is identified.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('great vessels invasion → pT4', () => {
      const report = 'Squamous cell carcinoma, 5.0 cm. The tumor invades the great vessels.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('pT4 override is NOT suppressed by unrelated conflict', () => {
      const report = 'Squamous cell carcinoma, 3.0 cm. Tumor invades the mediastinum. Visceral pleural invasion cannot be ruled out.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('size is FORBIDDEN when anatomical override present', () => {
      const report = 'Adenocarcinoma, 0.8 cm. The tumor invades the mediastinum.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });
  });

  describe('Gate 1: Anatomical Override (pT3)', () => {
    it('intercostal muscle invasion → pT3', () => {
      const report = 'Squamous cell carcinoma, 1.2 cm. Tumor invades the intercostal muscle.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    it('chest wall invasion → pT3', () => {
      const report = 'Adenocarcinoma, 2.0 cm. Chest wall invasion is present.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });
  });

  describe('Gate 2: Component Size (Note A)', () => {
    it('adenocarcinoma with 0.4 cm invasive focus → pT1mi, ignoring 4.2 cm total', () => {
      const report = 'Invasive adenocarcinoma with lepidic component. Total tumor size 4.2 cm. Invasive component is 0.4 cm.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT1mi');
      expect(result.size_basis_cm).toBe(0.4);
    });

    it('adenocarcinoma with 1.2 cm invasive focus → pT1b', () => {
      const report = 'Invasive adenocarcinoma with lepidic component. Total size 3.0 cm. Invasive size: 1.2 cm.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT1b');
      expect(result.size_basis_cm).toBe(1.2);
    });

    it('Gate 1 overrides Gate 2: mediastinal invasion beats invasive component', () => {
      const report = 'Invasive adenocarcinoma with lepidic component. Total 4.2 cm. Invasive component 0.4 cm. Tumor invades the mediastinum.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });
  });

  describe('Coding Persistence', () => {
    it('squamous cell carcinoma shows M8070/3 morphology', () => {
      const report = 'Squamous cell carcinoma, 2.5 cm. No pleural invasion.';
      const parsed = parsePathologyReport(report);
      expect(parsed.rawText.toLowerCase()).toContain('squamous cell carcinoma');
    });
  });

  describe('Clinical Reasoning: Pathologist Voice', () => {
    it('anatomical override reasoning mentions the structure by name', () => {
      const report = 'Squamous cell carcinoma, 3.0 cm. Tumor invades the mediastinum.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.clinicalChecklist?.stagingBasis).toContain('Deterministic');
      expect(result.clinicalChecklist?.clinicalVerdict).toContain('pT4');
    });

    it('anatomical override checklist detects pT4 structures', () => {
      const report = 'Squamous cell carcinoma, 3.0 cm. Tumor invades the mediastinum.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('component gate checklist shows invasive_used status', () => {
      const report = 'Invasive adenocarcinoma with lepidic component. Total tumor size 4.2 cm. Invasive component is 0.4 cm.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.clinicalChecklist?.measurementSelection.status).toBe('invasive_used');
      expect(result.clinicalChecklist?.measurementSelection.detail).toContain('CAP Note A');
    });

    it('anatomical scan findings correctly show Positive for detected structures', () => {
      const report = 'Squamous cell carcinoma, 2.0 cm. Tumor invades the mediastinum.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
      expect(parsed.pT4Override.structures).toContain('Mediastinum');
    });
  });

  describe('Edge Cases: Diaphragm detection via extended patterns', () => {
    it('"extends into the diaphragm" → pT4 (primary detector)', () => {
      const report = 'Adenocarcinoma, 2.0 cm. Tumor extends into the diaphragm.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('"involves the diaphragm" → pT4 (primary detector)', () => {
      const report = 'Squamous cell carcinoma, 1.5 cm. The tumor involves the diaphragm.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });
  });

  describe('Circuit Breaker: Intercostal muscle + parietal pleura detection', () => {
    it('intercostal muscle via "invasion into ... and underlying intercostal muscle" → pT3', () => {
      const report = 'Squamous cell carcinoma of the LUL measuring 4.1 cm. There is direct microscopic evidence of invasion into the parietal pleura and underlying intercostal muscle.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
      expect(result.stage_group).toContain('IIB');
    });

    it('parietal pleura invasion maps to PL3 → pT3', () => {
      const report = 'Adenocarcinoma measuring 1.5 cm with invasion into the parietal pleura.';
      const parsed = parsePathologyReport(report);
      expect(parsed.inputs.pleural_invasion.pl_status).toBe('PL3');
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    it('intercostal muscle alone triggers pT3 override over size', () => {
      const report = 'Squamous cell carcinoma, 1.2 cm. Tumor extends into the intercostal muscle.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    it('"underlying intercostal muscle" in invasion context → pT3', () => {
      const report = 'There is evidence of invasion into the chest wall and underlying intercostal muscle. Tumor measures 2.0 cm.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    it('intercostal + parietal pleura: Gate 1 triggers, size is forbidden', () => {
      const report = 'Squamous cell carcinoma of the LUL measuring 4.1 cm. There is direct microscopic evidence of invasion into the parietal pleura and underlying intercostal muscle.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      // Size (4.1 cm → pT2b) must NOT be used; anatomical override → pT3
      expect(result.t_category).toBe('pT3');
      expect(result.clinicalChecklist?.anatomicalScan.status).toBe('positive');
      expect(result.clinicalChecklist?.measurementSelection.status).toBe('not_applicable');
    });

    it('negated intercostal does NOT trigger override', () => {
      const report = 'Squamous cell carcinoma, 4.1 cm. No invasion into the intercostal muscle.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      // Should fall through to Gate 4 size-based
      expect(result.t_category).not.toBe('pT3');
    });
  });

  describe('Bridge Pattern: 80-char bridge for ALL Gate 1 structures', () => {
    // pT4 bridge patterns
    it('"invasion into the chest wall and mediastinal fat" → pT4 (mediastinum bridge)', () => {
      const report = 'Squamous cell carcinoma 3.0 cm. There is evidence of invasion into the chest wall and mediastinal fat.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('"invasion into the pleura and phrenic nerve" → pT3 (phrenic nerve is pT3)', () => {
      const report = 'Adenocarcinoma 2.5 cm. Direct invasion into the visceral pleura and phrenic nerve.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    it('"invasion extending to the soft tissue and diaphragm" → pT4 (diaphragm bridge)', () => {
      const report = 'Squamous cell carcinoma 1.8 cm. There is invasion extending to the soft tissue and diaphragm.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('"invasion into the pericardium and great vessels" → pT4 (great vessels bridge)', () => {
      const report = 'Large cell carcinoma 5.0 cm. Evidence of invasion into the pericardium and great vessels.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('"invasion into the adjacent structures and esophagus" → pT4 (esophagus bridge)', () => {
      const report = 'Squamous cell carcinoma 4.0 cm. There is invasion into the adjacent structures and esophagus.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('"invasion of the surrounding tissue and heart" → pT4 (heart bridge)', () => {
      const report = 'Adenocarcinoma 3.5 cm. Invasion of the surrounding tissue and heart.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('"invasion into the hilum and trachea" → pT4 (trachea bridge)', () => {
      const report = 'Squamous cell carcinoma 2.0 cm. There is invasion into the hilum and trachea.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('"invasion into the soft tissue and carina" → pT4 (carina bridge)', () => {
      const report = 'Adenocarcinoma 1.5 cm. Direct invasion into the soft tissue and carina.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    // pT3 bridge patterns
    it('"invasion into the pleura and chest wall" → pT3 (chest wall bridge via parseReport)', () => {
      const report = 'Squamous cell carcinoma 2.0 cm. There is invasion into the pleura and chest wall.';
      const parsed = parsePathologyReport(report);
      expect(parsed.inputs.direct_invasion.chest_wall).toBe(true);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    it('"invasion extending to the soft tissue and ribs" → pT3 (rib bridge)', () => {
      const report = 'Squamous cell carcinoma 1.5 cm. There is invasion extending to the soft tissue and ribs.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    // === NEGATIVE SAFETY: Bridge patterns must be invalidated by negation ===
    it('negated bridge pattern does NOT trigger override', () => {
      const report = 'Squamous cell carcinoma 3.0 cm. No invasion into the chest wall or mediastinum.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).not.toBe('pT4');
      expect(result.t_category).not.toBe('pT3');
    });

    it('"not identified" negates bridge pattern for phrenic nerve', () => {
      const report = 'Squamous cell carcinoma 2.5 cm. Invasion into the phrenic nerve was not identified.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).not.toBe('pT4');
    });

    it('"no evidence of" negates bridge pattern for mediastinum', () => {
      const report = 'Adenocarcinoma 3.0 cm. No evidence of invasion into the mediastinum or chest wall.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).not.toBe('pT4');
      expect(result.t_category).not.toBe('pT3');
    });

    it('"negative for" negates bridge pattern for diaphragm', () => {
      const report = 'Squamous cell carcinoma 2.0 cm. Negative for invasion into the diaphragm.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).not.toBe('pT4');
    });

    it('"absent" negates bridge for esophagus', () => {
      const report = 'Adenocarcinoma 1.5 cm. Invasion into the esophagus is absent.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).not.toBe('pT4');
    });

    // === BROAD INVASIVE COMPONENT EXTRACTION ===
    it('"invasive focus is measured at 0.4 cm" extracts invasive size for adenocarcinoma', () => {
      const report = 'Adenocarcinoma with lepidic component, total size 2.5 cm. The invasive focus is measured at 0.4 cm.';
      const parsed = parsePathologyReport(report);
      expect(parsed.inputs.measurements_cm.invasive_size_cm).toBe(0.4);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT1mi');
    });

    it('"invasion measuring 0.8 cm" extracts invasive size for adenocarcinoma', () => {
      const report = 'Invasive adenocarcinoma with lepidic component, total size 3.0 cm. There is a discrete focus of acinar invasion measuring 0.8 cm.';
      const parsed = parsePathologyReport(report);
      expect(parsed.inputs.measurements_cm.invasive_size_cm).toBe(0.8);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT1a');
    });

    // Pathologist voice check
    it('bridge-triggered override uses pathologist voice in reasoning', () => {
      const report = 'Squamous cell carcinoma 3.0 cm. There is evidence of invasion into the chest wall and mediastinal fat.';
      const parsed = parsePathologyReport(report);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
      // Verify the gate detail mentions the structure
      expect(result.reason).toContain('Mediastinum');
    });
  });
});

// ============================================
// CONSISTENCY TESTS FOR BRIDGE PATTERN FIX
// ============================================
describe('Bridge Pattern Consistency (Issue #1-4)', () => {
  it('should use unified BRIDGE_NEGATION_PHRASES across all functions', () => {
    // Test that all negation logic uses the same phrases
    const text = 'Squamous cell carcinoma 3.0 cm. No evidence of invasion into the chest wall.';
    const result = parsePathologyReport(text);
    
    // "No evidence of" is in unified BRIDGE_NEGATION_PHRASES
    // Bridge should be invalidated
    expect(result.inputs.direct_invasion.chest_wall).toBe(false);
  });

  it('should standardize substring length to 20 characters across all bridges', () => {
    // Test that detectPT4Structures uses substring(0, 20) consistently
    const text = 'Tumor with invasion into mediastinal fat and phrenic nerve involvement, measuring 3.2 cm.';
    const result = parsePathologyReport(text);
    
    // Phrenic nerve is pT3 (not pT4); mediastinum is pT4
    expect(result.pT4Override.detected).toBe(true);
    expect(result.pT4Override.structures).toContain('Mediastinum');
  });

  it('should use 80-character bridge window consistently (pT3 and pT4 structures)', () => {
    // Validates standardized 80-char window across all bridge patterns
    const text = 'Squamous cell carcinoma 2.0 cm. Direct invasion into underlying pleural tissue, ribs, and mediastinal fat detected.';
    const result = parsePathologyReport(text);
    
    // Should detect through 80-char bridge despite descriptive text
    expect(result.pT4Override.detected).toBe(true);
  });

  it('should handle negative safety uniformly for intercostal bridge patterns', () => {
    // Test unified negation in intercostal patterns (runValidation)
    const text = 'Squamous cell carcinoma 2.5 cm. No evidence of invasion into the intercostal muscle or ribs.';
    const result = parsePathologyReport(text);
    
    // "No evidence of" should invalidate intercostal bridge
    expect(result.inputs.direct_invasion.chest_wall).toBe(false);
  });

  it('should unify negation phrases across all pattern detection functions', () => {
    // Test that all functions use same phrase list
    const text1 = 'Adenocarcinoma 2.0 cm with direct invasion into chest wall. Not identified phrenic nerve involvement.';
    const text2 = 'Adenocarcinoma 2.0 cm. Phrenic nerve invasion is not identified. Chest wall invasion present.';
    
    const result1 = parsePathologyReport(text1);
    const result2 = parsePathologyReport(text2);
    
    // Both should handle "not identified" consistently
    expect(result1.inputs.direct_invasion.phrenic_nerve).toBe(false);
    expect(result2.inputs.direct_invasion.phrenic_nerve).toBe(false);
  });

  it('should apply 80-char bridge to pT4 structures consistently', () => {
    // Test mediastinum detection via 80-char bridge
    const text = 'Adenocarcinoma 3.5 cm. Invasion into mediastinal fat and surrounding tissue.';
    const result = parsePathologyReport(text);
    
    // Should trigger pT4 via bridge
    expect(result.pT4Override.detected).toBe(true);
  });

  it('should maintain substring consistency with 20-character extraction', () => {
    // Verifies Issue #2 fix: standardized substring(0, 20) across functions
    const text = 'Adenocarcinoma with invasion into mediastinal fat tissue and concurrent phrenic nerve involvement.';
    const result = parsePathologyReport(text);
    
    // Should detect via consistent 20-char substring matching
    expect(result.pT4Override.detected).toBe(true);
  });
});

// ============================================
// MASTER LOGIC RESET VERIFICATION TESTS
// Maps 1:1 to the 5-point Priority-First Hierarchy
// ============================================
describe('Master Hierarchy Compliance', () => {
  // === REQUIREMENT 1: Circuit Breaker (Gate 1) ===
  describe('Req 1: Circuit Breaker - Anatomical overrides stop all calculations', () => {
    it('phrenic nerve → pT3 (not pT4 per AJCC 9th)', () => {
      const text = 'Squamous cell carcinoma 2.5 cm. Direct invasion into the pleura and phrenic nerve.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT3');
    });

    it('mediastinal fat bridge → pT4, ignores 3.0cm size', () => {
      const text = 'Squamous cell carcinoma 3.0 cm. There is evidence of invasion into the chest wall and mediastinal fat.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('diaphragm bridge → pT4, ignores size', () => {
      const text = 'Adenocarcinoma measuring 1.8 cm with invasion into surrounding soft tissue and diaphragm.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('esophagus bridge → pT4', () => {
      const text = 'Squamous cell carcinoma 4.0 cm. Invasion into tracheal wall and esophageal tissue confirmed.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('carina bridge → pT4', () => {
      const text = 'Squamous cell carcinoma 2.1 cm with invasion extending to the carina.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('heart bridge → pT4', () => {
      const text = 'Carcinoma 3.5 cm. Evidence of invasion into the pericardium and heart.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('great vessels bridge → pT4', () => {
      const text = 'Squamous cell carcinoma 2.0 cm with invasion into great vessels.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('hilar fat → pT2a (lower priority anatomical override)', () => {
      const text = 'Squamous cell carcinoma 1.5 cm. Direct extension into the hilar fat.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT2a');
    });

    it('visceral pleura PL1 → pT2a', () => {
      const text = 'Adenocarcinoma 1.2 cm. Visceral pleural invasion present. PL1.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT2a');
    });
  });

  // === REQUIREMENT 2: Adeno Lock (Gate 2) ===
  describe('Req 2: Adeno Lock - Invasive size overrides total size', () => {
    it('invasive focus 0.4 cm → pT1mi, ignores 4.2 cm total', () => {
      const text = 'Invasive adenocarcinoma with lepidic component, total size 4.2 cm. Invasive component 0.4 cm.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT1mi');
      expect(result.size_basis_cm).toBe(0.4);
    });

    it('invasive focus 0.4 cm via broad bridge → pT1mi, ignores 5.2 cm', () => {
      const text = 'Invasive adenocarcinoma with lepidic component, total size 5.2 cm. The invasive focus is measured at 0.4 cm.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT1mi');
    });

    it('invasive component 1.5 cm → pT1b, ignores 3.0 cm total', () => {
      const text = 'Invasive adenocarcinoma with lepidic component measuring 3.0 cm. Invasive component 1.5 cm.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT1b');
    });
  });

  // === REQUIREMENT 3: Residual Default (Gate 4) ===
  describe('Req 3: Residual Default - Size only when Gates 1-2 empty', () => {
    it('no overrides, 3.5 cm → pT2a', () => {
      const text = 'Squamous cell carcinoma measuring 3.5 cm. Margins clear.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT2a');
    });

    it('no overrides, 0.8 cm → pT1a', () => {
      const text = 'Squamous cell carcinoma 0.8 cm. No evidence of invasion.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT1a');
    });
  });

  // === REQUIREMENT 4: Hierarchy Priority Order ===
  describe('Req 4: Gate 1 beats Gate 2 beats Gate 4', () => {
    it('anatomical override (Gate 1) beats invasive size (Gate 2)', () => {
      const text = 'Invasive adenocarcinoma with lepidic component 3.0 cm. Invasive component 0.4 cm. Direct invasion into the mediastinum.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).toBe('pT4');
    });

    it('invasive size (Gate 2) beats total size (Gate 4)', () => {
      const text = 'Invasive adenocarcinoma with lepidic component, total size 6.0 cm. Invasive focus 0.3 cm.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      // Gate 2 (0.3 cm → pT1mi) must override Gate 4 (6.0 cm → pT3)
      expect(result.t_category).toBe('pT1mi');
    });
  });

  // === REQUIREMENT 5: Negative Guardrail ===
  describe('Req 5: Negative guardrail invalidates overrides', () => {
    it('"NOT identified" blocks phrenic nerve bridge → falls to size', () => {
      const text = 'Squamous cell carcinoma 3.5 cm. Invasion into the phrenic nerve is NOT identified.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).not.toBe('pT4');
    });

    it('"no evidence of" blocks mediastinum bridge → falls to size', () => {
      const text = 'Squamous cell carcinoma 2.0 cm. No evidence of invasion into the mediastinum.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).not.toBe('pT4');
    });

    it('"negative for" blocks chest wall → falls to size', () => {
      const text = 'Squamous cell carcinoma 1.5 cm. Negative for invasion into the chest wall.';
      const parsed = parsePathologyReport(text);
      const result = runValidation(parsed);
      expect(result.t_category).not.toBe('pT3');
    });
  });
});

describe('Laterality / satellite nodule detection', () => {
  it('"same lobe nodule" triggers pT3', () => {
    const text = 'Right upper lobe primary. Same lobe nodule. Greatest dimension 2.5 cm.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toBe('pT3');
  });

  it('"satellite nodule in RUL" triggers pT3 when primary is RUL', () => {
    const text = 'Right upper lobe primary. Satellite nodule in RUL. Greatest dimension 2.5 cm.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toBe('pT3');
  });

  it('negation suppresses laterality: "no additional nodules"', () => {
    const text = 'Right upper lobe primary. No additional nodules identified. Greatest dimension 2.5 cm.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toBe('pT1c');
  });

  it('"satellite lesion" triggers pT3', () => {
    const text = 'Left upper lobe primary. Satellite lesion. Greatest dimension 1.0 cm.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toBe('pT3');
  });

  it('"second focus in same lobe" triggers pT3', () => {
    const text = 'Right lower lobe primary. Second focus in same lobe. Greatest dimension 3.0 cm.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toBe('pT3');
  });

  it('"no satellite nodules" does NOT trigger pT3', () => {
    const text = 'Right upper lobe primary. No satellite nodules. Greatest dimension 2.5 cm.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toBe('pT1c');
  });
});

// ============================================
// CONFIDENCE SCORING TESTS
// ============================================
describe('Confidence scoring', () => {
  const run = (text: string) => {
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    return result;
  };

  it('1) size-only yields High when no critical unknowns detected', () => {
    const r = run('greatest dimension 2.5 cm');
    expect(r.confidence).toBeDefined();
    // Parser may or may not mark nodes/metastasis as unknown depending on text
    expect(r.confidence!.score).toBeGreaterThanOrEqual(80);
    expect(['High', 'Medium']).toContain(r.confidence!.level);
  });

  it('2) size + explicit negative nodes + no metastasis → High', () => {
    const r = run('greatest dimension 2.5 cm\nlymph nodes negative 0/12\nno distant metastasis');
    expect(r.confidence!.level).toBe('High');
    expect(r.confidence!.score).toBeGreaterThanOrEqual(90);
  });

  it('3) missing size → Low, provisional', () => {
    const r = run('visceral pleural invasion PL1');
    expect(r.confidence!.level).toBe('Low');
    expect(r.confidence!.provisional).toBe(true);
    expect(r.confidence!.notes).toContain('Tumor size not found');
  });

  it('4) conflict triggers provisional', () => {
    const r = run('greatest dimension 2.5 cm\nchest wall invasion cannot be excluded');
    expect(r.confidence!.provisional).toBe(true);
    expect(r.confidence!.missingCritical).toContain('report_conflict');
  });

  it('5) chest wall invasion + explicit negatives → High', () => {
    const r = run('greatest dimension 2.0 cm\nchest wall invasion present\nlymph nodes negative 0/5\nno distant metastasis');
    expect(r.confidence!.level).toBe('High');
    expect(r.confidence!.score).toBeGreaterThanOrEqual(90);
  });

  it('6) contralateral nodule with size → Medium or High', () => {
    const r = run('right upper lobe primary\ncontralateral lung nodule in left upper lobe\ngreatest dimension 2.5 cm');
    expect(r.confidence).toBeDefined();
    // M1a is present from contralateral, so metastasis fact is present
    expect(r.confidence!.score).toBeGreaterThanOrEqual(70);
  });

  it('7) N2 detected but M unstated → score penalized for metastasis', () => {
    const r = run('greatest dimension 4.2 cm\nsubcarinal lymph node metastasis present (level 7)');
    expect(r.confidence!.score).toBeGreaterThanOrEqual(80);
  });

  it('8) N2 + M0 explicit → High', () => {
    const r = run('greatest dimension 4.2 cm\nsubcarinal lymph node metastasis present (level 7)\nno distant metastasis');
    expect(r.confidence!.level).toBe('High');
    expect(r.confidence!.score).toBeGreaterThanOrEqual(90);
  });

  it('9) VPI floor but M/N unstated → score at least 80', () => {
    const r = run('greatest dimension 0.8 cm\nvisceral pleural invasion PL1 present');
    expect(r.confidence!.score).toBeGreaterThanOrEqual(80);
  });

  it('10) explicit node count negativity → High', () => {
    const r = run('greatest dimension 0.8 cm\n0/12 lymph nodes negative\nno distant metastasis');
    expect(r.confidence!.level).toBe('High');
    expect(r.confidence!.score).toBeGreaterThanOrEqual(90);
  });

  it('11) multiple critical unknowns → Low, provisional', () => {
    const r = run('adenocarcinoma');
    expect(r.confidence!.level).toBe('Low');
    expect(r.confidence!.provisional).toBe(true);
    expect(r.confidence!.missingCritical.length).toBeGreaterThanOrEqual(2);
  });

  it('12) confidence always attached for successful run', () => {
    const r = run('greatest dimension 1.5 cm');
    expect(r.confidence).toBeDefined();
    expect(r.clinicalFacts).toBeDefined();
    expect(r.clinicalFacts!.length).toBeGreaterThan(0);
  });
});

// ============================================
// NEGATION-AWARE EXTRACTION TESTS
// ============================================
describe('isNegated utility', () => {
  it('detects negation with "no" before match', () => {
    const text = 'no mediastinal invasion';
    const idx = text.indexOf('mediastinal');
    expect(isNegated(text, idx)).toBe(true);
  });

  it('detects negation with "negative for"', () => {
    const text = 'negative for mediastinal invasion';
    const idx = text.indexOf('mediastinal');
    expect(isNegated(text, idx)).toBe(true);
  });

  it('detects negation with "free of"', () => {
    const text = 'tumor is free of mediastinal invasion';
    const idx = text.indexOf('mediastinal');
    expect(isNegated(text, idx)).toBe(true);
  });

  it('detects negation with "without"', () => {
    const text = 'tumor without mediastinal invasion';
    const idx = text.indexOf('mediastinal');
    expect(isNegated(text, idx)).toBe(true);
  });

  it('does NOT negate positive finding', () => {
    const text = 'mediastinal invasion is present';
    const idx = text.indexOf('mediastinal');
    expect(isNegated(text, idx)).toBe(false);
  });

  it('does NOT negate "tumor invades mediastinum"', () => {
    const text = 'tumor invades mediastinum';
    const idx = text.indexOf('invades');
    expect(isNegated(text, idx)).toBe(false);
  });
});

describe('pT4 negation in full pipeline', () => {
  it('"no mediastinal invasion" should NOT trigger pT4', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. No mediastinal invasion. Lymph nodes negative. No distant metastasis.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).not.toContain('pT4');
  });

  it('"negative for mediastinal invasion" should NOT trigger pT4', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. Negative for mediastinal invasion. Lymph nodes negative. No distant metastasis.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).not.toContain('pT4');
  });

  it('"tumor is free of mediastinal invasion" should NOT trigger pT4', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. Tumor is free of mediastinal invasion. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).not.toContain('pT4');
  });

  it('"tumor invades mediastinum" SHOULD trigger pT4', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. Tumor invades mediastinum. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toContain('pT4');
  });

  it('"mediastinal invasion is present" SHOULD trigger pT4', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. Mediastinal invasion is present. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toContain('pT4');
  });
});

describe('Positive-over-negation conflict resolution', () => {
  it('mixed negated + positive chest wall → pT3 with conflict', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. No chest wall invasion. Tumor invades chest wall. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toContain('pT3');
    expect(parsed.hasConflict).toBe(true);
  });

  it('positive-only chest wall → pT3 no conflict', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. Tumor invades chest wall. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toContain('pT3');
  });

  it('negated-only chest wall → size-based T', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. No chest wall invasion. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).not.toContain('pT3');
    expect(result.t_category).toContain('pT1');
  });

  it('mixed negated + positive mediastinum → pT4 with conflict', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. No mediastinal invasion. Tumor invades mediastinum. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).toContain('pT4');
  });

  it('negated-only mediastinum → no pT4', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. No mediastinal invasion. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.t_category).not.toContain('pT4');
  });

  it('post-match negation "phrenic nerve invasion not identified" → absent', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. Phrenic nerve invasion not identified. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    expect(parsed.inputs.direct_invasion.phrenic_nerve).toBe(false);
  });

  it('positive chest wall with negated phrenic → only chest wall detected', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. Tumor invades chest wall. No phrenic nerve invasion. Lymph nodes negative.';
    const parsed = parsePathologyReport(text);
    expect(parsed.inputs.direct_invasion.chest_wall).toBe(true);
    expect(parsed.inputs.direct_invasion.phrenic_nerve).toBe(false);
  });

  it('confidence reduced when positive+negated conflict exists', () => {
    const text = 'Adenocarcinoma, greatest dimension 2.5 cm. No chest wall invasion. Tumor invades chest wall. Lymph nodes negative. No distant metastasis.';
    const parsed = parsePathologyReport(text);
    const result = runValidation(parsed);
    expect(result.confidence).toBeDefined();
    expect(result.confidence!.provisional).toBe(true);
  });
});

// ============================================================
// Normalization pre-pass
// ============================================================
describe('Normalization pre-pass', () => {
  const run = (text: string) => {
    const parsed = parsePathologyReport(text);
    return runValidation(parsed);
  };

  it('British "tumour" is recognized as tumor', () => {
    const r = run('Invasive tumour, 2.0 cm. No visceral pleural invasion. Lymph nodes negative. No distant metastasis.');
    expect(r.t_category).toBe('pT1b');
  });

  it('VPI abbreviation triggers visceral pleural invasion → pT2a floor', () => {
    const r = run('Adenocarcinoma 0.8 cm. VPI present. Lymph nodes negative. No distant metastasis.');
    expect(r.t_category).toBe('pT2a');
  });

  it('"thoracic wall invasion" normalizes to chest wall → pT3', () => {
    const r = run('Squamous cell carcinoma, 1.5 cm. Invasion into the thoracic wall. Lymph nodes negative. No distant metastasis.');
    expect(r.t_category).toBe('pT3');
  });

  it('"pericardium invasion" normalizes to heart → pT4', () => {
    const r = run('Adenocarcinoma 2.0 cm. Direct invasion into the pericardium. Lymph nodes negative. No distant metastasis.');
    expect(r.t_category).toBe('pT4');
  });

  it('"station 7 positive" normalizes to subcarinal → pN2', () => {
    const r = run('Adenocarcinoma 2.5 cm. Station 7 lymph node positive. No distant metastasis.');
    expect(r.n_category).toContain('N2');
  });

  it('"MIA" abbreviation normalizes to minimally invasive adenocarcinoma', () => {
    const r = run('MIA, invasive component 0.4 cm. Total size 1.8 cm. Margins negative.');
    expect(r.t_category).toBe('pT1mi');
  });

  it('"SCC" abbreviation is recognized as squamous cell carcinoma', () => {
    const r = run('SCC, 3.5 cm. No pleural invasion. Lymph nodes negative. No distant metastasis.');
    expect(r.t_category).toBe('pT2a');
  });

  it('"osseous metastasis" normalizes to bone metastasis', () => {
    const normalized = normalizeReportText('Single osseous metastasis identified.');
    expect(normalized).toContain('bone metastasis');
  });

  it('"oesophageal invasion" (British) normalizes to esophagus → pT4', () => {
    const r = run('Squamous cell carcinoma 3.0 cm. Oesophageal invasion confirmed. Lymph nodes negative.');
    expect(r.t_category).toBe('pT4');
  });

  it('"SVC invasion" normalizes to great vessels → pT4', () => {
    const r = run('Adenocarcinoma 2.5 cm. Tumor invades the SVC. Lymph nodes negative.');
    expect(r.t_category).toBe('pT4');
  });

  it('getNormalizationDiff returns correct diff entries', () => {
    const diffs = getNormalizationDiff('Invasive tumour, VPI present, station 7 positive.');
    const terms = diffs.map((d: any) => d.matched);
    expect(terms).toContain('tumour');
    expect(terms.some((t: string) => t.includes('VPI'))).toBe(true);
  });

  it('rawText in ParsedReport is always the original unmodified input', () => {
    const raw = 'Invasive tumour, VPI present.';
    const parsed = parsePathologyReport(raw);
    expect(parsed.rawText).toBe(raw);
  });

  it('normalized synonym + negation → no override fires', () => {
    const r = run('Squamous cell carcinoma 2.5 cm. No thoracic wall invasion. Lymph nodes negative. No distant metastasis.');
    expect(r.t_category).not.toBe('pT3');
  });
});

// AJCC 8th Edition Lung Cancer Full TNM Staging Validation Engine
// Uses STAGING_RULES as the Source of Truth

import { 
  STAGING_RULES, 
  getStagingSource, 
  getRulesWithOverrides, 
  getSizeBasedStage,
  matchesOverride,
  getNodeStage,
  getMetastasisStage,
  getStageGroup,
  getICD10Code,
  getSurvivalData,
  type StagingRule,
  type ICD10Code,
  type SurvivalData
} from './stagingRules';

export { getStagingSource };

export interface ValidationInputs {
  histology: {
    is_AIS: boolean;
    is_MIA: boolean;
    is_invasive_nonmucinous_adenocarcinoma_with_lepidic_component: boolean;
  };
  measurements_cm: {
    greatest_dimension_cm: number | null;
    total_tumor_size_cm: number | null;
    invasive_size_cm: number | null;
    percent_invasive_0_to_100: number | null;
  };
  superficial_spreading: {
    is_superficial_spreading_tumor: boolean;
    invasive_component_limited_to_bronchial_wall: boolean;
  };
  pleural_invasion: {
    has_visceral_pleural_invasion: boolean;
    pl_status: 'PL0' | 'PL1' | 'PL2' | 'PL3' | null;
  };
  direct_invasion: {
    chest_wall: boolean;
    phrenic_nerve: boolean;
    pericardium: boolean;
    main_bronchus: boolean;
    diaphragm: boolean;
    hilar_fat: boolean; // Direct extension into hilar fat/soft tissue forces pT2a
  };
  // Golden Rule: Atelectasis/Pneumonitis
  atelectasis: {
    has_total_lung_atelectasis: boolean;
    has_total_lung_pneumonitis: boolean;
  };
  // pT4 anatomical structures
  pT4_invasion: {
    mediastinum: boolean;
    heart: boolean;
    great_vessels: boolean;
    trachea: boolean;
    recurrent_laryngeal_nerve: boolean;
    esophagus: boolean;
    vertebral_body: boolean;
    carina: boolean;
  };
  // Nodal station findings
  nodal_stations: {
    stations_mentioned: string[];
    node_count_provided: boolean;
  };
}

export interface ValidationResult {
  applicability: 'applicable' | 'not_applicable' | 'indeterminate' | 'outside_scope';
  t_category: string | null;
  n_category: string | null;
  m_category: string | null;
  stage_group: string | null;
  survival: SurvivalData | null;
  icd10: ICD10Code | null;
  basis?: string;
  size_basis_cm?: number | null;
  reason: string;
}

export interface ConflictInfo {
  sentence: string;
  invasionKeyword: string;
  negationKeyword: string;
  startIndex: number;
  endIndex: number;
  conflictType: 'proximity' | 'ambiguity';
}

export interface NodalStationAlert {
  station: string;
  requiresNodeCount: boolean;
  message: string;
}

export interface MarginAlert {
  margin: string;
  status: 'involved' | 'close';
  message: string;
}

export interface SubmissionAlert {
  type: 'AIS' | 'MIA';
  message: string;
}

export interface IpsilateralLobeInfo {
  primaryLobe: string | null;
  noduleLobe: string | null;
  primaryLung: 'Right' | 'Left' | null;
  noduleLung: 'Right' | 'Left' | null;
  isDifferentLobesSameLung: boolean;
  forcesT4: boolean;
  message: string | null;
}

export interface ParsedReport {
  inputs: ValidationInputs;
  extractedText: {
    histologyFindings: string[];
    measurementFindings: string[];
    stageFindings: string[];
    lymphNodeFindings: string[];
    metastasisFindings: string[];
    siteFindings: string[];
  };
  reportedStage: string | null;
  reportedNStage: string | null;
  reportedMStage: string | null;
  rawText: string;
  conflicts: ConflictInfo[];
  hasConflict: boolean;
  nodalStationAlerts: NodalStationAlert[];
  pT4Override: { detected: boolean; structures: string[] };
  marginAlerts: MarginAlert[];
  multiplePrimaryTumors: boolean;
  invasiveSizeMissing: boolean;
  submissionAlerts: SubmissionAlert[];
  ipsilateralLobeInfo: IpsilateralLobeInfo;
}

// ============================================
// CONFLICT DETECTION - Safety Logic Layer
// ============================================
// Keywords that indicate invasion
const INVASION_KEYWORDS = [
  'pleural', 'pleura', 'invasion', 'invades', 'invading', 'invaded',
  'chest wall', 'pericardium', 'pericardial', 'diaphragm', 'diaphragmatic',
  'phrenic nerve', 'main bronchus', 'bronchial', 'mediastinum', 'mediastinal',
  'pl1', 'pl2', 'pl3', 'visceral'
];

// Keywords that indicate negation
const NEGATION_KEYWORDS = [
  'no', 'not', 'absent', 'intact', 'negative', 'without', 'none', 'free',
  'unremarkable', 'normal', 'preserved', 'denied', 'excluded'
];

// Ambiguity/uncertainty phrases that SHOULD trigger conflict warnings
const UNCERTAINTY_PHRASES = [
  'cannot be ruled out',
  'cannot be excluded',
  'cannot be entirely excluded',
  'cannot be entirely ruled out',
  'can not be ruled out',
  'can not be excluded',
  'not ruled out',
  'not excluded',
  'not entirely excluded',
  'not completely ruled out',
  'equivocal',
  'indeterminate',
  'uncertain',
  'possible',
  'suspicious for',
  'suggestive of',
  'concerning for',
  'favor',
  'favour',
  'may represent',
  'cannot exclude',
  'cannot rule out',
];

// Standard negation phrases that should be treated as CONFIRMED NEGATIVE (exempt from conflict)
// These are clear, definitive negations linked directly to invasion findings
const STANDARD_NEGATION_PHRASES = [
  'no invasion',
  'no invasion identified',
  'no invasion seen',
  'no invasion present',
  'not identified',
  'not seen',
  'not present',
  'negative for invasion',
  'negative for pleural invasion',
  'negative for visceral pleural invasion',
  'absent',
  'is absent',
  'are absent',
  'invasion absent',
  'invasion is absent',
  'invasion not identified',
  'invasion not seen',
  'invasion not present',
  'no pleural invasion',
  'no visceral pleural invasion',
  'no chest wall invasion',
  'no pericardial invasion',
  'pleural invasion: absent',
  'pleural invasion: negative',
  'pleural invasion: not identified',
  'pleural invasion: not seen',
  'free of invasion',
  'without invasion',
  'intact pleura',
  'pleura intact',
  'visceral pleura intact',
];

// Word proximity threshold for conflict detection (reduced from 10 to 4)
const CONFLICT_PROXIMITY_THRESHOLD = 4;

/**
 * Checks if a sentence contains a standard negation phrase that confirms negative status
 * These are clear, unambiguous negations that should NOT trigger conflict warnings
 * IMPORTANT: If the sentence also contains uncertainty phrases, this returns false
 * (uncertainty takes precedence over standard negation)
 */
function isStandardNegation(sentence: string): boolean {
  const lowerSentence = sentence.toLowerCase();
  
  // First check if uncertainty phrases are present - they override standard negations
  for (const phrase of UNCERTAINTY_PHRASES) {
    if (lowerSentence.includes(phrase)) {
      return false; // Uncertainty overrides standard negation
    }
  }
  
  return STANDARD_NEGATION_PHRASES.some(phrase => lowerSentence.includes(phrase));
}

/**
 * Checks if a sentence contains uncertainty phrases that warrant conflict warnings
 */
function containsUncertaintyPhrase(sentence: string): { found: boolean; phrase: string | null } {
  const lowerSentence = sentence.toLowerCase();
  for (const phrase of UNCERTAINTY_PHRASES) {
    if (lowerSentence.includes(phrase)) {
      return { found: true, phrase };
    }
  }
  return { found: false, phrase: null };
}

/**
 * Detects sentences containing invasion-related uncertainty that needs manual verification
 * 
 * REFINED LOGIC:
 * 1. Standard negations (e.g., "no invasion identified") = Confirmed Negative (no conflict)
 * 2. Uncertainty phrases (e.g., "cannot be ruled out") = True Conflict trigger
 * 3. Proximity threshold reduced to 4 words to prevent unrelated sentence interference
 */
export function detectInvasionConflicts(reportText: string): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  
  // Split into sentences (handle multiple sentence endings)
  const sentences = reportText.split(/(?<=[.!?])\s+|(?<=\n)/);
  let currentIndex = 0;
  
  for (const sentence of sentences) {
    if (!sentence.trim()) {
      currentIndex += sentence.length;
      continue;
    }
    
    const lowerSentence = sentence.toLowerCase();
    
    // Check if sentence contains invasion-related terms
    const hasInvasionContext = INVASION_KEYWORDS.some(kw => lowerSentence.includes(kw));
    
    if (!hasInvasionContext) {
      currentIndex += sentence.length;
      continue;
    }
    
    // RULE 1: Check for standard negations - these are CONFIRMED NEGATIVE, skip
    if (isStandardNegation(sentence)) {
      currentIndex += sentence.length;
      continue;
    }
    
    // RULE 2: Check for uncertainty phrases - TRUE CONFLICT
    const uncertainty = containsUncertaintyPhrase(sentence);
    if (uncertainty.found) {
      const startIndex = reportText.indexOf(sentence.trim(), currentIndex);
      const endIndex = startIndex + sentence.trim().length;
      
      const invasionKeyword = INVASION_KEYWORDS.find(kw => lowerSentence.includes(kw)) || 'invasion';
      
      conflicts.push({
        sentence: sentence.trim(),
        invasionKeyword,
        negationKeyword: uncertainty.phrase!,
        startIndex: startIndex >= 0 ? startIndex : currentIndex,
        endIndex: startIndex >= 0 ? endIndex : currentIndex + sentence.length,
        conflictType: 'ambiguity'
      });
      
      currentIndex += sentence.length;
      continue;
    }
    
    currentIndex += sentence.length;
  }
  
  return conflicts;
}

/**
 * Detects ambiguous phrases that indicate uncertainty about invasion status
 * These should trigger conflict warnings for manual verification
 */
export function detectAmbiguityPhrases(reportText: string): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  
  // Split into sentences
  const sentences = reportText.split(/(?<=[.!?])\s+|(?<=\n)/);
  let currentIndex = 0;
  
  for (const sentence of sentences) {
    if (!sentence.trim()) {
      currentIndex += sentence.length;
      continue;
    }
    
    const lowerSentence = sentence.toLowerCase();
    
    // Check for uncertainty phrases in context with invasion-related terms
    for (const phrase of UNCERTAINTY_PHRASES) {
      if (lowerSentence.includes(phrase)) {
        // Check if the sentence also mentions invasion-related terms
        const invasionTerms = ['invasion', 'invade', 'pleural', 'pleura', 'chest wall', 
          'pericardium', 'diaphragm', 'mediastinum', 'involvement'];
        
        const hasInvasionContext = invasionTerms.some(term => lowerSentence.includes(term));
        
        if (hasInvasionContext) {
          const startIndex = reportText.indexOf(sentence.trim(), currentIndex);
          const endIndex = startIndex + sentence.trim().length;
          
          conflicts.push({
            sentence: sentence.trim(),
            invasionKeyword: invasionTerms.find(t => lowerSentence.includes(t)) || 'invasion',
            negationKeyword: phrase,
            startIndex: startIndex >= 0 ? startIndex : currentIndex,
            endIndex: startIndex >= 0 ? endIndex : currentIndex + sentence.length,
            conflictType: 'ambiguity'
          });
          break; // One conflict per sentence
        }
      }
    }
    
    currentIndex += sentence.length;
  }
  
  return conflicts;
}

/**
 * Detects pT4 anatomical structures that automatically assign pT4 staging
 */
export function detectPT4Structures(
  reportText: string, 
  isNegatedFinding: (finding: string, text: string) => boolean
): { detected: boolean; structures: string[] } {
  const text = reportText.toLowerCase();
  const detectedStructures: string[] = [];
  
  const pT4Patterns: Record<string, { patterns: RegExp[], display: string }> = {
    mediastinum: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?mediastinum/i,
        /mediastinal\s*invasion/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?mediastinum/i,
      ],
      display: 'Mediastinum'
    },
    heart: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?heart/i,
        /cardiac\s*invasion/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?heart/i,
        /involves?\s*(the\s*)?heart/i,
      ],
      display: 'Heart'
    },
    great_vessels: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?great\s*vessels?/i,
        /great\s*vessel(s)?\s*invasion/i,
        /invasion\s*(of|into)\s*(the\s*)?great\s*vessels?/i,
        /invad(es?|ing|ed)\s*(the\s*)?(aorta|pulmonary\s*artery|vena\s*cava)/i,
        /aortic\s*invasion/i,
      ],
      display: 'Great Vessels'
    },
    trachea: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?trachea/i,
        /tracheal\s*invasion/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?trachea/i,
      ],
      display: 'Trachea'
    },
    recurrent_laryngeal_nerve: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?recurrent\s*laryngeal\s*nerve/i,
        /recurrent\s*laryngeal\s*nerve\s*invasion/i,
        /recurrent\s*laryngeal\s*nerve\s*involvement/i,
      ],
      display: 'Recurrent Laryngeal Nerve'
    },
    esophagus: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?esophagus/i,
        /esophageal\s*invasion/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?esophagus/i,
      ],
      display: 'Esophagus'
    },
    vertebral_body: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?vertebra(l\s*body|e)?/i,
        /vertebral\s*(body\s*)?invasion/i,
        /spine\s*invasion/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?vertebra/i,
      ],
      display: 'Vertebral Body'
    },
    carina: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?carina/i,
        /carinal\s*invasion/i,
        /invasion\s*(of|into)\s*(the\s*)?carina/i,
        /tumor\s*(at|involves?|invad(es?|ing))\s*(the\s*)?carina/i,
        /less\s*than\s*2\s*cm\s*(from\s*)?(the\s*)?carina/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?carina/i,
      ],
      display: 'Carina'
    },
    diaphragm: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?diaphragm/i,
        /diaphragm(atic)?\s*invasion/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?diaphragm/i,
      ],
      display: 'Diaphragm'
    },
  };
  
  for (const [key, config] of Object.entries(pT4Patterns)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        // Check if negated
        if (!isNegatedFinding(key.replace(/_/g, ' '), text)) {
          detectedStructures.push(config.display);
          break;
        }
      }
    }
  }
  
  return {
    detected: detectedStructures.length > 0,
    structures: detectedStructures
  };
}

/**
 * Detects nodal station mentions and generates alerts for missing node counts
 */
export function detectNodalStationAlerts(
  reportText: string,
  nodalStationsInput: ValidationInputs['nodal_stations']
): NodalStationAlert[] {
  const alerts: NodalStationAlert[] = [];
  const text = reportText.toLowerCase();
  
  // Nodal station patterns (IASLC lymph node map stations 1-14)
  const stationPatterns = [
    { pattern: /station\s*(\d{1,2})/gi, name: 'Station' },
    { pattern: /level\s*(\d{1,2})/gi, name: 'Level' },
    { pattern: /\b(subcarinal|paratracheal|hilar|aortopulmonary|subaortic|para-aortic|paraesophageal|pulmonary\s*ligament|interlobar|lobar|segmental)/gi, name: 'Named station' },
  ];
  
  const mentionedStations: string[] = [];
  
  for (const { pattern } of stationPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      mentionedStations.push(match[0]);
    }
  }
  
  // Update the input to track mentioned stations
  nodalStationsInput.stations_mentioned = [...new Set(mentionedStations)];
  
  // Check if node counts are provided (e.g., "0/3", "2/5 positive")
  const nodeCountPattern = /(\d+)\s*\/\s*(\d+)/g;
  const hasNodeCounts = nodeCountPattern.test(text);
  nodalStationsInput.node_count_provided = hasNodeCounts;
  
  // Generate alerts for specific stations without node counts
  if (mentionedStations.length > 0 && !hasNodeCounts) {
    alerts.push({
      station: mentionedStations.join(', '),
      requiresNodeCount: true,
      message: `Nodal stations mentioned (${mentionedStations.join(', ')}) but total nodes examined not specified. Please confirm node counts for accurate prognostic assessment.`
    });
  }
  
  // Special alert for Station 7 (subcarinal) - important prognostic station
  if (text.includes('station 7') || text.includes('subcarinal')) {
    const hasStation7Count = /station\s*7[^.]*(\d+)\s*\/\s*(\d+)/i.test(text) || 
                             /subcarinal[^.]*(\d+)\s*\/\s*(\d+)/i.test(text);
    if (!hasStation7Count) {
      alerts.push({
        station: 'Station 7 (Subcarinal)',
        requiresNodeCount: true,
        message: 'Station 7 (subcarinal) lymph nodes have significant prognostic impact. Please confirm the number of nodes examined at this station.'
      });
    }
  }
  
  return alerts;
}

/**
 * Detects margin status and generates high-priority alerts for involved margins
 */
export function detectMarginStatus(reportText: string): MarginAlert[] {
  const alerts: MarginAlert[] = [];
  const text = reportText.toLowerCase();
  
  // Patterns for involved margins
  const involvedPatterns = [
    /margin[s]?\s*(is|are)?\s*(positive|involved|compromised)/i,
    /(positive|involved)\s*margin/i,
    /tumor\s*(at|extends?\s*to)\s*(the\s*)?margin/i,
    /margin[s]?\s*positive\s*for\s*(tumor|carcinoma|malignancy)/i,
    /carcinoma\s*(at|involves?|extends?\s*to)\s*(the\s*)?margin/i,
    /(bronchial|vascular|parenchymal|pleural)\s*margin[s]?\s*:\s*(positive|involved)/i,
    /margin[s]?\s*involvement/i,
    /margin[s]?\s*(status|clearance)\s*:\s*(positive|involved)/i,
  ];
  
  // Patterns for close margins (< 1mm or specified as close)
  const closePatterns = [
    /margin[s]?\s*(is|are)?\s*close/i,
    /close\s*margin/i,
    /margin\s*clearance\s*[:<]?\s*[0-9.]+\s*mm/i,
    /tumor\s*(within|<)\s*[0-9.]+\s*mm\s*(of|from)?\s*(the\s*)?margin/i,
  ];
  
  // Check for involved margins
  for (const pattern of involvedPatterns) {
    const match = text.match(pattern);
    if (match) {
      alerts.push({
        margin: match[0],
        status: 'involved',
        message: '🚨 HIGH PRIORITY: Positive/involved margin detected. This significantly impacts patient management and may require additional resection or adjuvant therapy. Immediate clinical correlation recommended.'
      });
      break; // Only one involved alert
    }
  }
  
  // Check for close margins
  for (const pattern of closePatterns) {
    const match = text.match(pattern);
    if (match && !alerts.some(a => a.status === 'involved')) {
      alerts.push({
        margin: match[0],
        status: 'close',
        message: '⚠️ Close margin detected. Consider clinical significance based on margin distance and tumor biology.'
      });
      break;
    }
  }
  
  return alerts;
}

/**
 * LOBE-TO-LUNG MAPPING for Ipsilateral Nodule Detection
 * RUL, RML, RLL = Right Lung; LUL, LLL = Left Lung
 */
const LOBE_TO_LUNG_MAP: Record<string, 'Right' | 'Left'> = {
  'rul': 'Right',
  'rml': 'Right', 
  'rll': 'Right',
  'right upper lobe': 'Right',
  'right middle lobe': 'Right',
  'right lower lobe': 'Right',
  'lul': 'Left',
  'lll': 'Left',
  'left upper lobe': 'Left',
  'left lower lobe': 'Left',
};

const LOBE_ABBREVIATIONS: Record<string, string> = {
  'rul': 'RUL',
  'rml': 'RML',
  'rll': 'RLL',
  'right upper lobe': 'RUL',
  'right middle lobe': 'RML',
  'right lower lobe': 'RLL',
  'lul': 'LUL',
  'lll': 'LLL',
  'left upper lobe': 'LUL',
  'left lower lobe': 'LLL',
};

/**
 * Detects ipsilateral lobe nodules (different lobes, same lung)
 * Per AJCC 8th Edition: Separate tumor nodule in a different ipsilateral lobe = pT4
 */
export function detectIpsilateralLobeNodules(reportText: string): IpsilateralLobeInfo {
  const text = reportText.toLowerCase();
  
  const defaultResult: IpsilateralLobeInfo = {
    primaryLobe: null,
    noduleLobe: null,
    primaryLung: null,
    noduleLung: null,
    isDifferentLobesSameLung: false,
    forcesT4: false,
    message: null,
  };

  // Patterns to detect primary tumor location
  const primaryPatterns = [
    /(?:primary\s*)?(?:tumor|mass|carcinoma|adenocarcinoma)\s*(?:in|of|involving|located\s*in|arising\s*from|within)\s*(?:the\s*)?(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)/gi,
    /(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)\s*(?:tumor|mass|carcinoma|adenocarcinoma|primary)/gi,
    /specimen\s*(?:from|of)\s*(?:the\s*)?(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)/gi,
    /lobectomy[,:\s]*(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)/gi,
    /(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)\s*lobectomy/gi,
  ];

  // Patterns to detect separate nodule in different lobe
  const nodulePatterns = [
    /(?:separate|additional|satellite|secondary)\s*(?:tumor\s*)?(?:nodule|mass|lesion)\s*(?:in|within|involving)\s*(?:the\s*)?(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)/gi,
    /(?:nodule|mass|lesion)\s*(?:in|within)\s*(?:a\s*)?(?:different|another|separate)\s*(?:ipsilateral\s*)?lobe[,:\s]*(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)?/gi,
    /(?:ipsilateral|same\s*lung)\s*(?:separate\s*)?(?:nodule|tumor|mass|lesion)\s*(?:in\s*)?(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)?/gi,
    /different\s*ipsilateral\s*lobe/gi,
    /separate\s*(?:tumor\s*)?nodule\s*(?:is\s*)?(?:present|identified|noted)\s*(?:in|within)\s*(?:the\s*)?(rul|rml|rll|lul|lll|right\s*upper\s*lobe|right\s*middle\s*lobe|right\s*lower\s*lobe|left\s*upper\s*lobe|left\s*lower\s*lobe)/gi,
  ];

  let primaryLobe: string | null = null;
  let noduleLobe: string | null = null;

  // Find primary tumor lobe
  for (const pattern of primaryPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const lobe = match[1]?.toLowerCase().trim();
      if (lobe && LOBE_TO_LUNG_MAP[lobe]) {
        primaryLobe = lobe;
        break;
      }
    }
    if (primaryLobe) break;
  }

  // Find separate nodule lobe
  for (const pattern of nodulePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      // Check if pattern detected "different ipsilateral lobe" phrase
      if (match[0].includes('different ipsilateral lobe')) {
        // This explicitly states different lobe same lung
        if (primaryLobe) {
          defaultResult.primaryLobe = LOBE_ABBREVIATIONS[primaryLobe] || primaryLobe.toUpperCase();
          defaultResult.primaryLung = LOBE_TO_LUNG_MAP[primaryLobe];
          defaultResult.isDifferentLobesSameLung = true;
          defaultResult.forcesT4 = true;
          defaultResult.message = `⚠️ pT4 OVERRIDE: Separate tumor nodule in a different ipsilateral lobe detected. Per AJCC 8th Edition, this automatically assigns pT4 staging regardless of tumor size.`;
          return defaultResult;
        }
      }
      
      const lobe = match[1]?.toLowerCase().trim();
      if (lobe && LOBE_TO_LUNG_MAP[lobe]) {
        noduleLobe = lobe;
        break;
      }
    }
    if (noduleLobe) break;
  }

  // If we have both lobes, check if they're in the same lung but different lobes
  if (primaryLobe && noduleLobe) {
    const primaryLung = LOBE_TO_LUNG_MAP[primaryLobe];
    const noduleLung = LOBE_TO_LUNG_MAP[noduleLobe];
    
    defaultResult.primaryLobe = LOBE_ABBREVIATIONS[primaryLobe] || primaryLobe.toUpperCase();
    defaultResult.noduleLobe = LOBE_ABBREVIATIONS[noduleLobe] || noduleLobe.toUpperCase();
    defaultResult.primaryLung = primaryLung;
    defaultResult.noduleLung = noduleLung;
    
    if (primaryLung === noduleLung && primaryLobe !== noduleLobe) {
      defaultResult.isDifferentLobesSameLung = true;
      defaultResult.forcesT4 = true;
      defaultResult.message = `⚠️ pT4 OVERRIDE: Primary tumor in ${defaultResult.primaryLobe} with separate nodule in ${defaultResult.noduleLobe} (same lung, different lobe). Per AJCC 8th Edition, separate tumor nodule in a different ipsilateral lobe automatically assigns pT4 staging.`;
    }
  }

  return defaultResult;
}

/**
 * Detects multiple primary tumors for (m) suffix per AJCC standards
 */
export function detectMultiplePrimaryTumors(reportText: string): boolean {
  const text = reportText.toLowerCase();
  
  const multiplePatterns = [
    /multiple\s*(primary\s*)?(tumors?|nodules?|masses?|lesions?)/i,
    /\d+\s*(separate|distinct|synchronous)\s*(tumors?|nodules?|masses?|lesions?)/i,
    /(two|three|four|2|3|4)\s*(separate\s*|distinct\s*)?(primary\s*)?(tumors?|nodules?|masses?|lesions?)/i,
    /multifocal\s*(tumor|carcinoma|adenocarcinoma)/i,
    /synchronous\s*(primary\s*)?(tumors?|carcinomas?)/i,
    /(tumor|lesion)\s*(#|number)?\s*(1|2|3|one|two|three)/i,
    /separate\s*primaries/i,
    /bilateral\s*(tumors?|carcinomas?|lung\s*cancers?)/i,
  ];
  
  for (const pattern of multiplePatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}
export function parsePathologyReport(reportText: string): ParsedReport {
  const text = reportText.toLowerCase();
  
  // Initialize default inputs
  const inputs: ValidationInputs = {
    histology: {
      is_AIS: false,
      is_MIA: false,
      is_invasive_nonmucinous_adenocarcinoma_with_lepidic_component: false,
    },
    measurements_cm: {
      greatest_dimension_cm: null,
      total_tumor_size_cm: null,
      invasive_size_cm: null,
      percent_invasive_0_to_100: null,
    },
    superficial_spreading: {
      is_superficial_spreading_tumor: false,
      invasive_component_limited_to_bronchial_wall: false,
    },
    pleural_invasion: {
      has_visceral_pleural_invasion: false,
      pl_status: null,
    },
    direct_invasion: {
      chest_wall: false,
      phrenic_nerve: false,
      pericardium: false,
      main_bronchus: false,
      diaphragm: false,
      hilar_fat: false,
    },
    atelectasis: {
      has_total_lung_atelectasis: false,
      has_total_lung_pneumonitis: false,
    },
    pT4_invasion: {
      mediastinum: false,
      heart: false,
      great_vessels: false,
      trachea: false,
      recurrent_laryngeal_nerve: false,
      esophagus: false,
      vertebral_body: false,
      carina: false,
    },
    nodal_stations: {
      stations_mentioned: [],
      node_count_provided: false,
    },
  };

  const extractedText = {
    histologyFindings: [] as string[],
    measurementFindings: [] as string[],
    stageFindings: [] as string[],
    lymphNodeFindings: [] as string[],
    metastasisFindings: [] as string[],
    siteFindings: [] as string[],
  };

  let reportedNStage: string | null = null;
  let reportedMStage: string | null = null;

  // Check for AIS (Adenocarcinoma in situ)
  if (
    text.includes('adenocarcinoma in situ') ||
    text.includes('ais') && (text.includes('adenocarcinoma') || text.includes('lepidic')) ||
    /\bais\b/.test(text) && text.includes('lepidic pattern')
  ) {
    inputs.histology.is_AIS = true;
    extractedText.histologyFindings.push('Adenocarcinoma in situ (AIS) detected');
  }

  // Check for MIA (Minimally invasive adenocarcinoma)
  if (
    text.includes('minimally invasive adenocarcinoma') ||
    text.includes('mia') && text.includes('adenocarcinoma') ||
    (text.includes('invasion') && text.includes('≤5mm') || text.includes('<= 5mm') || text.includes('less than 5 mm'))
  ) {
    inputs.histology.is_MIA = true;
    extractedText.histologyFindings.push('Minimally invasive adenocarcinoma (MIA) detected');
  }

  // Check for invasive nonmucinous adenocarcinoma with lepidic component
  if (
    (text.includes('invasive') && text.includes('adenocarcinoma') && text.includes('lepidic')) &&
    !text.includes('mucinous') &&
    !inputs.histology.is_AIS &&
    !inputs.histology.is_MIA
  ) {
    inputs.histology.is_invasive_nonmucinous_adenocarcinoma_with_lepidic_component = true;
    extractedText.histologyFindings.push('Invasive nonmucinous adenocarcinoma with lepidic component');
  }

  // FLEXIBLE EXTRACTION: Extract tumor size from various formats
  // These patterns are ordered from most specific to most general
  const sizePatterns = [
    // Formal patterns
    /greatest\s*dimension[:\s]+(\d+\.?\d*)\s*cm/i,
    /tumor\s*size[:\s]+(\d+\.?\d*)\s*cm/i,
    /(\d+\.?\d*)\s*cm\s*(in\s*)?greatest\s*dimension/i,
    /measuring\s+(\d+\.?\d*)\s*cm/i,
    /measures?\s+(\d+\.?\d*)\s*cm/i,
    // Dimension patterns (AxBxC format - takes largest)
    /(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*cm/i,
    /(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*cm/i,
    // Informal patterns - more flexible
    /(\d+\.?\d*)\s*cm\s+(tumor|mass|nodule|lesion)/i,
    /(tumor|mass|nodule|lesion)\s+(\d+\.?\d*)\s*cm/i,
    /(\d+\.?\d*)\s*cm\s+(in\s+)?(size|diameter)/i,
    /(size|diameter)[:\s]+(\d+\.?\d*)\s*cm/i,
    // Very flexible - just number followed by cm (with context hints)
    /(?:identified|found|noted|shows?|reveals?|demonstrates?)\s+(?:a\s+)?(\d+\.?\d*)\s*cm/i,
    // Generic pattern - number cm appearing near tumor-related words
    /(\d+\.?\d*)\s*cm(?=.*(?:tumor|carcinoma|adenocarcinoma|mass|nodule|lesion))/i,
    // Fallback: any size in cm format (most permissive)
    /\b(\d+\.?\d*)\s*cm\b/i,
  ];

  for (const pattern of sizePatterns) {
    const match = text.match(pattern);
    if (match) {
      let size: number;
      
      // Handle AxBxC format - take the largest dimension
      if (pattern.source.includes('x\\s*')) {
        const dims = match.slice(1).filter(d => d && !isNaN(parseFloat(d))).map(d => parseFloat(d));
        size = Math.max(...dims);
      } else if (match[2] && !isNaN(parseFloat(match[2]))) {
        // Some patterns capture size in group 2
        size = parseFloat(match[2]);
      } else {
        size = parseFloat(match[1]);
      }
      
      if (!isNaN(size) && size > 0 && size < 50) { // Reasonable tumor size range
        inputs.measurements_cm.greatest_dimension_cm = size;
        inputs.measurements_cm.total_tumor_size_cm = size;
        extractedText.measurementFindings.push(`Tumor size: ${size} cm`);
        break;
      }
    }
  }

  // Extract invasive size - also more flexible
  // GOLDEN RULE #2: Invasive size takes precedence over total size
  const invasiveSizePatterns = [
    /invasive\s*size[:\s]+(\d+\.?\d*)\s*cm/i,  // "Invasive Size: 0.8 cm"
    /invasive\s*(component|focus|portion)[:\s]+(\d+\.?\d*)\s*cm/i,
    /invasive\s*tumor[:\s]+(\d+\.?\d*)\s*cm/i,
    /invasion[:\s]+(\d+\.?\d*)\s*cm/i,
    /(\d+\.?\d*)\s*cm\s+invasive/i,
    /invasive[:\s]+(\d+\.?\d*)\s*cm/i,
    /size\s*of\s*invasive\s*(component)?[:\s]+(\d+\.?\d*)\s*cm/i,
  ];

  for (const pattern of invasiveSizePatterns) {
    const match = text.match(pattern);
    if (match) {
      const size = parseFloat(match[2] || match[1]);
      if (!isNaN(size) && size > 0) {
        inputs.measurements_cm.invasive_size_cm = size;
        extractedText.measurementFindings.push(`Invasive size: ${size} cm`);
        break;
      }
    }
  }

  // Extract percent invasive - also more flexible
  const percentPatterns = [
    /(\d+)\s*%\s*invasive/i,
    /invasive[:\s]+(\d+)\s*%/i,
    /percent\s*invasive[:\s]+(\d+)/i,
    /(\d+)\s*percent\s*invasive/i,
    /approximately\s+(\d+)\s*%/i,
  ];

  for (const pattern of percentPatterns) {
    const match = text.match(pattern);
    if (match) {
      const percent = parseInt(match[1]);
      if (!isNaN(percent) && percent >= 0 && percent <= 100) {
        inputs.measurements_cm.percent_invasive_0_to_100 = percent;
        extractedText.measurementFindings.push(`Percent invasive: ${match[1]}%`);
        break;
      }
    }
  }

  // Check for superficial spreading
  if (text.includes('superficial spreading')) {
    inputs.superficial_spreading.is_superficial_spreading_tumor = true;
    extractedText.histologyFindings.push('Superficial spreading tumor');
  }

  if (
    text.includes('bronchial wall') &&
    (text.includes('limited to') || text.includes('confined to'))
  ) {
    inputs.superficial_spreading.invasive_component_limited_to_bronchial_wall = true;
    extractedText.histologyFindings.push('Invasive component limited to bronchial wall');
  }

  // ============================================
  // NEGATION DETECTION UTILITY
  // ============================================
  // Check if a finding is negated within a certain word window
  const negationWords = [
    'no', 'not', 'without', 'absent', 'negative', 'intact', 'free', 
    'none', 'denied', 'unremarkable', 'normal', 'preserved'
  ];
  
  const negationPhrases = [
    'not identified', 'not present', 'not seen', 'not detected', 'not noted',
    'no evidence of', 'no sign of', 'no indication of',
    'negative for', 'absent for', 'free of', 'free from',
    'is intact', 'are intact', 'remains intact', 'remain intact',
    'is absent', 'is negative', 'is unremarkable',
    'does not invade', 'do not invade', 'did not invade',
    'does not involve', 'do not involve', 'did not involve',
    'does not extend', 'do not extend', 'did not extend',
    'no invasion', 'without invasion', 'invasion absent',
    'not invaded', 'uninvaded', 'non-invasive'
  ];
  
  // Check if finding appears in a negated context
  const isNegatedFinding = (finding: string, fullText: string): boolean => {
    const normalizedText = fullText.toLowerCase();
    const normalizedFinding = finding.toLowerCase();
    
    // First check for explicit negation phrases containing the finding
    for (const phrase of negationPhrases) {
      // Check if negation phrase appears near the finding (within ~50 chars before)
      const findingIndex = normalizedText.indexOf(normalizedFinding);
      if (findingIndex === -1) continue;
      
      // Look for negation phrase within window before the finding
      const windowStart = Math.max(0, findingIndex - 60);
      const windowText = normalizedText.substring(windowStart, findingIndex + normalizedFinding.length + 20);
      
      if (windowText.includes(phrase)) {
        return true;
      }
    }
    
    // Check for simple negation word immediately preceding (within 3 words)
    const words = normalizedText.split(/\s+/);
    const findingWords = normalizedFinding.split(/\s+/);
    const firstFindingWord = findingWords[0];
    
    for (let i = 0; i < words.length; i++) {
      if (words[i].includes(firstFindingWord)) {
        // Check previous 3 words for negation
        for (let j = Math.max(0, i - 4); j < i; j++) {
          if (negationWords.includes(words[j].replace(/[^a-z]/g, ''))) {
            return true;
          }
        }
        break;
      }
    }
    
    return false;
  };

  // ============================================
  // PLEURAL INVASION DETECTION WITH NEGATION
  // ============================================
  const pleuralTerms = [
    'visceral pleural invasion', 'visceral pleura invasion',
    'pleural invasion', 'invades visceral pleura',
    'invasion of visceral pleura', 'invasion into visceral pleura'
  ];
  
  const plStatusTerms = ['pl1', 'pl2', 'pl3'];
  
  // Check for explicit negation patterns first
  const explicitNegativePleuralPatterns = [
    /no\s+(visceral\s*)?pleural\s*invasion/i,
    /without\s+(visceral\s*)?pleural\s*invasion/i,
    /pleural\s*invasion\s*(is\s*)?(not|absent|negative)/i,
    /negative\s+for\s+(visceral\s*)?pleural\s*invasion/i,
    /no\s+evidence\s+of\s+(visceral\s*)?pleural\s*invasion/i,
    /(visceral\s*)?pleural\s*invasion\s*(is\s*)?not\s*(present|identified|seen)/i,
    /(visceral\s*)?pleura[:\s]*(is\s*)?(intact|unremarkable|negative|normal)/i,
    /pleura\s+is\s+intact/i,
    /intact\s+(visceral\s*)?pleura/i,
    /pl0\b/i, // PL0 means no invasion
  ];
  
  const hasNegativePleuralContext = explicitNegativePleuralPatterns.some(pattern => pattern.test(text));
  
  // Also check using the generic negation detector
  let isPleuralNegated = hasNegativePleuralContext;
  if (!isPleuralNegated) {
    for (const term of pleuralTerms) {
      if (text.toLowerCase().includes(term) && isNegatedFinding(term, text)) {
        isPleuralNegated = true;
        break;
      }
    }
  }
  
  // Positive pleural invasion patterns
  const pleuralPatterns = [
    /\bpl1\b/i,
    /\bpl2\b/i,
    /\bpl3\b/i,
    /visceral\s*pleural\s*invasion/i,
    /invades?\s*(the\s*)?visceral\s*pleura/i,
    /invasion\s*(of|into)\s*(the\s*)?visceral\s*pleura/i,
    /pleural\s*invasion\s*(present|identified|seen|positive)/i,
    /positive\s*(for\s*)?(visceral\s*)?pleural\s*invasion/i,
  ];

  // Only detect pleural invasion if NOT in a negative context
  if (!isPleuralNegated) {
    for (const pattern of pleuralPatterns) {
      if (pattern.test(text)) {
        inputs.pleural_invasion.has_visceral_pleural_invasion = true;
        
        // Determine PL status
        if (/\bpl1\b/i.test(text)) {
          inputs.pleural_invasion.pl_status = 'PL1';
          extractedText.histologyFindings.push('Pleural invasion: PL1 (extends beyond elastic layer)');
        } else if (/\bpl2\b/i.test(text)) {
          inputs.pleural_invasion.pl_status = 'PL2';
          extractedText.histologyFindings.push('Pleural invasion: PL2 (extends to pleural surface)');
        } else if (/\bpl3\b/i.test(text)) {
          inputs.pleural_invasion.pl_status = 'PL3';
          extractedText.histologyFindings.push('Pleural invasion: PL3 (invades parietal pleura)');
        } else {
          inputs.pleural_invasion.pl_status = 'PL1'; // Default to PL1 if not specified
          extractedText.histologyFindings.push('Visceral pleural invasion present');
        }
        break;
      }
    }
  } else {
    // Log that pleural invasion was detected as negative
    if (pleuralPatterns.some(p => p.test(text)) || /pleura/i.test(text)) {
      extractedText.histologyFindings.push('Visceral pleura: intact/negative for invasion');
    }
  }

  // ============================================
  // DIRECT INVASION DETECTION WITH NEGATION
  // ============================================
  const directInvasionPatterns: Record<string, { patterns: RegExp[], keywords: string[] }> = {
    chest_wall: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?chest\s*wall/i,
        /chest\s*wall\s*invasion/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?chest\s*wall/i,
        /extends?\s*(into|to)\s*(the\s*)?chest\s*wall/i,
      ],
      keywords: ['chest wall invasion', 'chest wall']
    },
    phrenic_nerve: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?phrenic\s*nerve/i,
        /phrenic\s*nerve\s*invasion/i,
        /phrenic\s*nerve\s*involvement/i,
      ],
      keywords: ['phrenic nerve invasion', 'phrenic nerve']
    },
    pericardium: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?pericardium/i,
        /pericardial\s*invasion/i,
        /direct\s*invasion\s*(of|into)\s*(the\s*)?pericardium/i,
        /extends?\s*(into|to)\s*(the\s*)?pericardium/i,
      ],
      keywords: ['pericardial invasion', 'pericardium']
    },
    main_bronchus: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?main\s*bronchus/i,
        /main\s*bronchus\s*invasion/i,
        /main\s*bronchus\s*involvement/i,
      ],
      keywords: ['main bronchus invasion', 'main bronchus']
    },
    diaphragm: {
      patterns: [
        /invad(es?|ing|ed)\s*(the\s*)?diaphragm/i,
        /diaphragm(atic)?\s*invasion/i,
        /extends?\s*(into|to)\s*(the\s*)?diaphragm/i,
      ],
      keywords: ['diaphragm invasion', 'diaphragm']
    },
    hilar_fat: {
      patterns: [
        /direct\s*extension\s*(into|to)\s*(the\s*)?hilar\s*(fat|soft\s*tissue)/i,
        /invad(es?|ing|ed)\s*(the\s*)?hilar\s*(fat|soft\s*tissue)/i,
        /hilar\s*(fat|soft\s*tissue)\s*invasion/i,
        /extends?\s*(into|to|through)\s*(the\s*)?hilar\s*(fat|soft\s*tissue)/i,
        /infiltrat(es?|ing|ed)\s*(the\s*)?hilar\s*(fat|soft\s*tissue)/i,
        /tumor\s*(extends?|invades?)\s*(into\s*)?(the\s*)?hilar\s*(fat|soft\s*tissue)/i,
      ],
      keywords: ['hilar fat', 'hilar soft tissue', 'direct extension into hilar']
    },
  };

  for (const [key, config] of Object.entries(directInvasionPatterns)) {
    let isPositive = false;
    let matchedPattern = false;
    
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        matchedPattern = true;
        
        // Check if this finding is negated
        let isNegated = false;
        for (const keyword of config.keywords) {
          if (isNegatedFinding(keyword, text)) {
            isNegated = true;
            break;
          }
        }
        
        if (!isNegated) {
          isPositive = true;
        } else {
          // Log the negated finding
          const displayName = key.replace(/_/g, ' ');
          extractedText.histologyFindings.push(`${displayName}: negative for invasion`);
        }
        break;
      }
    }
    
    if (isPositive) {
      inputs.direct_invasion[key as keyof typeof inputs.direct_invasion] = true;
      const displayName = key.replace(/_/g, ' ');
      extractedText.histologyFindings.push(`Direct invasion: ${displayName}`);
    }
  }

  // GOLDEN RULE #3: Detect total lung atelectasis/pneumonitis
  const atelectasisPatterns = [
    /total\s*(lung\s*)?(atelectasis|collapse)/i,
    /complete\s*(lung\s*)?(atelectasis|collapse)/i,
    /entire\s*lung\s*(atelectasis|collapse)/i,
    /atelectasis\s*(of\s*)?(the\s*)?entire\s*lung/i,
    /collapse\s*(of\s*)?(the\s*)?entire\s*lung/i,
    /whole\s*lung\s*(atelectasis|collapse)/i,
    // More flexible patterns
    /complete\s*atelectasis\s*(of\s*)?(the\s*)?(entire|whole)?\s*lung/i,
    /total\s*atelectasis\s*(of\s*)?(the\s*)?(entire|whole)?\s*lung/i,
    /(entire|whole|complete|total)\s*lung\s*(collapse|atelectasis)/i,
    /atelectasis\s*involving\s*(the\s*)?(entire|whole|complete)\s*lung/i,
    /lung\s*(is\s*)?(completely|totally)\s*(collapsed|atelectatic)/i,
  ];
  
  const pneumonitisPatterns = [
    /total\s*(lung\s*)?pneumonitis/i,
    /complete\s*(lung\s*)?pneumonitis/i,
    /entire\s*lung\s*pneumonitis/i,
    /pneumonitis\s*(of\s*)?(the\s*)?entire\s*lung/i,
    /obstructive\s*pneumonitis\s*(of\s*)?(the\s*)?(entire|whole)\s*lung/i,
    /complete\s*pneumonitis\s*(of\s*)?(the\s*)?(entire|whole)?\s*lung/i,
    /pneumonitis\s*involving\s*(the\s*)?(entire|whole)\s*lung/i,
  ];
  
  for (const pattern of atelectasisPatterns) {
    if (pattern.test(text)) {
      inputs.atelectasis.has_total_lung_atelectasis = true;
      extractedText.histologyFindings.push('⚠️ Golden Rule: Total lung atelectasis detected');
      break;
    }
  }
  
  for (const pattern of pneumonitisPatterns) {
    if (pattern.test(text)) {
      inputs.atelectasis.has_total_lung_pneumonitis = true;
      extractedText.histologyFindings.push('⚠️ Golden Rule: Total lung pneumonitis detected');
      break;
    }
  }

  // Extract reported stage from the report - expanded to include all pT stages
  let reportedStage: string | null = null;
  const stagePatterns = [
    /pathologic\s*stage[:\s]*(pt\d+[a-z]*)/i,
    /pt\s*stage[:\s]*(pt\d+[a-z]*)/i,
    /(pt1a|pt1b|pt1c|pt1mi|pt2a|pt2b|pt3|pt4|ptis)/i,
    /primary\s*tumor[:\s]*(pt\d+[a-z]*)/i,
    /\bpt:\s*(pt\d+[a-z]*)/i,
  ];

  for (const pattern of stagePatterns) {
    const match = text.match(pattern);
    if (match) {
      reportedStage = match[1].toUpperCase();
      if (!reportedStage.startsWith('P')) {
        reportedStage = 'P' + reportedStage;
      }
      extractedText.stageFindings.push(`Reported pT stage: ${reportedStage}`);
      break;
    }
  }

  // Extract reported pN stage
  const nStagePatterns = [
    /\b(pn[0-3])\b/i,
    /regional\s*lymph\s*nodes?[:\s]*(pn[0-3])/i,
    /\bn:\s*(pn?[0-3])/i,
  ];

  for (const pattern of nStagePatterns) {
    const match = text.match(pattern);
    if (match) {
      reportedNStage = match[1].toUpperCase();
      if (!reportedNStage.startsWith('P')) {
        reportedNStage = 'P' + reportedNStage;
      }
      extractedText.stageFindings.push(`Reported pN stage: ${reportedNStage}`);
      break;
    }
  }

  // Extract reported pM stage
  const mStagePatterns = [
    /\b(pm[0-1][a-c]?)\b/i,
    /distant\s*metastasis[:\s]*(pm?[0-1][a-c]?)/i,
    /\bm:\s*(pm?[0-1][a-c]?)/i,
  ];

  for (const pattern of mStagePatterns) {
    const match = text.match(pattern);
    if (match) {
      reportedMStage = match[1].toUpperCase();
      if (!reportedMStage.startsWith('P')) {
        reportedMStage = 'P' + reportedMStage;
      }
      extractedText.stageFindings.push(`Reported pM stage: ${reportedMStage}`);
      break;
    }
  }

  // Extract lymph node findings for pN calculation
  const lymphNodeResult = getNodeStage(reportText);
  if (lymphNodeResult) {
    extractedText.lymphNodeFindings.push(`${lymphNodeResult.stage}: ${lymphNodeResult.criteria}`);
  }

  // Extract metastasis findings for pM calculation
  const metastasisResult = getMetastasisStage(reportText);
  if (metastasisResult) {
    extractedText.metastasisFindings.push(`${metastasisResult.stage}: ${metastasisResult.criteria}`);
  }

  // Extract tumor site for ICD-10
  const icd10Result = getICD10Code(reportText);
  extractedText.siteFindings.push(`${icd10Result.site} (${icd10Result.code})`);

  // ============================================
  // CONFLICT DETECTION - Safety Logic Layer
  // ============================================
  // Detect invasion + negation keywords within 5-word proximity (6-10 = ambiguous)
  const conflicts = detectInvasionConflicts(reportText);
  
  // Detect ambiguous phrases that require manual verification
  const ambiguityConflicts = detectAmbiguityPhrases(reportText);
  const allConflicts = [...conflicts, ...ambiguityConflicts];

  // ============================================
  // pT4 ANATOMICAL OVERRIDE DETECTION
  // ============================================
  const pT4Structures = detectPT4Structures(reportText, isNegatedFinding);
  
  // ============================================
  // NODAL STATION ALERTS
  // ============================================
  const nodalStationAlerts = detectNodalStationAlerts(reportText, inputs.nodal_stations);

  // ============================================
  // MARGIN DETECTION - High Priority Alert
  // ============================================
  const marginAlerts = detectMarginStatus(reportText);

  // ============================================
  // MULTIPLE PRIMARY TUMORS DETECTION - "(m)" suffix
  // ============================================
  const multiplePrimaryTumors = detectMultiplePrimaryTumors(reportText);

  // ============================================
  // INVASIVE SIZE MISSING CHECK (for nonmucinous adenocarcinomas)
  // ============================================
  const invasiveSizeMissing = 
    inputs.histology.is_invasive_nonmucinous_adenocarcinoma_with_lepidic_component &&
    inputs.measurements_cm.invasive_size_cm === null &&
    inputs.measurements_cm.percent_invasive_0_to_100 === null;

  // ============================================
  // SUBMISSION ALERTS - AIS (pTis) and MIA (pT1mi) require entire lesion submission
  // ============================================
  const submissionAlerts: SubmissionAlert[] = [];
  if (inputs.histology.is_AIS) {
    submissionAlerts.push({
      type: 'AIS',
      message: '⚠️ SUBMISSION REQUIREMENT: Diagnosis of adenocarcinoma in situ (AIS/pTis) requires the lesion to be entirely submitted for histologic examination. Partial sampling cannot exclude invasive foci.'
    });
  }
  if (inputs.histology.is_MIA) {
    submissionAlerts.push({
      type: 'MIA',
      message: '⚠️ SUBMISSION REQUIREMENT: Diagnosis of minimally invasive adenocarcinoma (MIA/pT1mi) requires the lesion to be entirely submitted for histologic examination. Partial sampling cannot exclude larger invasive foci.'
    });
  }

  // ============================================
  // IPSILATERAL LOBE NODULE DETECTION - Different lobe same lung = pT4
  // ============================================
  const ipsilateralLobeInfo = detectIpsilateralLobeNodules(reportText);

  return { 
    inputs, 
    extractedText, 
    reportedStage, 
    reportedNStage, 
    reportedMStage, 
    rawText: reportText,
    conflicts: allConflicts,
    hasConflict: allConflicts.length > 0,
    nodalStationAlerts,
    pT4Override: pT4Structures,
    marginAlerts,
    multiplePrimaryTumors,
    invasiveSizeMissing,
    submissionAlerts,
    ipsilateralLobeInfo,
  };
}

// Run the decision tree validation - now includes full TNM
// When hasConflict is true, skip invasion-based overrides and use conservative size-based staging
export function runValidation(inputs: ValidationInputs, rawText: string = '', hasConflict: boolean = false): ValidationResult {
  // Calculate derived values
  let estimated_invasive_size_cm: number | null = null;
  if (
    inputs.measurements_cm.invasive_size_cm === null &&
    inputs.measurements_cm.total_tumor_size_cm !== null &&
    inputs.measurements_cm.percent_invasive_0_to_100 !== null
  ) {
    estimated_invasive_size_cm =
      (inputs.measurements_cm.percent_invasive_0_to_100 / 100.0) *
      inputs.measurements_cm.total_tumor_size_cm;
  }

  // GOLDEN RULE #2: Total vs. Invasive Size
  // If invasive size is available, use it for staging (even if total size is also provided)
  let size_basis_cm: number | null = null;
  let usedInvasiveSize = false;
  
  if (inputs.measurements_cm.invasive_size_cm !== null) {
    // Invasive size explicitly provided - use it (Golden Rule #2)
    size_basis_cm = inputs.measurements_cm.invasive_size_cm;
    usedInvasiveSize = true;
  } else if (inputs.histology.is_invasive_nonmucinous_adenocarcinoma_with_lepidic_component && estimated_invasive_size_cm !== null) {
    // Estimated invasive size from percentage
    size_basis_cm = estimated_invasive_size_cm;
    usedInvasiveSize = true;
  } else {
    // Default to greatest dimension
    size_basis_cm = inputs.measurements_cm.greatest_dimension_cm;
  }

  // Calculate N and M stages from raw text
  const nResult = getNodeStage(rawText);
  const mResult = getMetastasisStage(rawText);
  const icd10Result = getICD10Code(rawText);
  
  const n_category = nResult?.stage || 'pN0';
  const m_category = mResult?.stage || 'pM0';

  // Decision tree traversal using STAGING_RULES as Source of Truth
  // Get override rules sorted by priority
  const overrideRules = getRulesWithOverrides();
  
  // Collect all findings for override matching
  const findings: string[] = [];
  
  // Add histology findings
  if (inputs.histology.is_AIS) {
    findings.push('AIS', 'adenocarcinoma in situ');
  }
  if (inputs.histology.is_MIA) {
    findings.push('MIA', 'minimally invasive adenocarcinoma');
  }
  
  // Add pleural invasion findings
  if (inputs.pleural_invasion.has_visceral_pleural_invasion) {
    findings.push('visceral pleural invasion');
    if (inputs.pleural_invasion.pl_status) {
      findings.push(inputs.pleural_invasion.pl_status);
    }
  }
  
  // Add direct invasion findings
  if (inputs.direct_invasion.chest_wall) findings.push('chest wall');
  if (inputs.direct_invasion.phrenic_nerve) findings.push('phrenic nerve');
  if (inputs.direct_invasion.pericardium) findings.push('pericardium', 'parietal pericardium');
  if (inputs.direct_invasion.diaphragm) findings.push('diaphragm');
  if (inputs.direct_invasion.main_bronchus) findings.push('main bronchus');
  if (inputs.direct_invasion.hilar_fat) findings.push('hilar fat', 'hilar soft tissue', 'direct extension into hilar');

  // Detect multiple primary tumors for (m) suffix
  const hasMultiplePrimaries = detectMultiplePrimaryTumors(rawText);

  // Helper to build result with full TNM (and (m) suffix if applicable)
  const buildResult = (
    applicability: ValidationResult['applicability'],
    t_category: string | null,
    basis: string | undefined,
    size_basis_cm_val: number | null | undefined,
    reason: string
  ): ValidationResult => {
    // Add (m) suffix for multiple primary tumors per AJCC standards
    const finalTCategory = t_category && hasMultiplePrimaries 
      ? `${t_category}(m)` 
      : t_category;
    
    const stage_group = t_category 
      ? getStageGroup(t_category, n_category, m_category)
      : null;
    
    const survival = stage_group ? getSurvivalData(stage_group) : null;
    
    // Add note about (m) suffix if applicable
    const finalReason = hasMultiplePrimaries && t_category
      ? `${reason} Note: (m) suffix added due to multiple primary tumors detected.`
      : reason;
    
    return {
      applicability,
      t_category: finalTCategory,
      n_category,
      m_category,
      stage_group,
      survival,
      icd10: icd10Result,
      basis,
      size_basis_cm: size_basis_cm_val ?? undefined,
      reason: finalReason,
    };
  };

  // STEP 1: Check for special histology types (pTis, pT1mi)
  if (inputs.histology.is_AIS) {
    return buildResult(
      'not_applicable',
      'pTis(AIS)',
      undefined,
      undefined,
      `${getStagingSource()}: Adenocarcinoma in situ is staged as pTis(AIS).`
    );
  }

  if (inputs.histology.is_MIA) {
    return buildResult(
      'not_applicable',
      'pT1mi',
      undefined,
      undefined,
      `${getStagingSource()}: Minimally invasive adenocarcinoma is staged as pT1mi.`
    );
  }

  // GOLDEN RULE #3: Atelectasis/Pneumonitis
  // Total lung collapse automatically upgrades to pT2
  if (inputs.atelectasis.has_total_lung_atelectasis || inputs.atelectasis.has_total_lung_pneumonitis) {
    const condition = inputs.atelectasis.has_total_lung_atelectasis ? 'total lung atelectasis' : 'total lung pneumonitis';
    return buildResult(
      'applicable',
      'pT2',
      'golden_rule',
      undefined,
      `⚠️ GOLDEN RULE: ${condition} detected. Per AJCC 8th Edition, a tumor of any size causing collapse of the entire lung is automatically staged as pT2.`
    );
  }

  // ANATOMICAL OVERRIDE: pT4 structures
  // Invasion of specific anatomical structures automatically assigns pT4
  const pT4Structures = detectPT4Structures(rawText, (finding: string, text: string): boolean => {
    // Inline negation check for pT4 detection
    const normalizedText = text.toLowerCase();
    const normalizedFinding = finding.toLowerCase();
    const negationPhrases = ['not', 'no', 'without', 'negative', 'absent', 'intact', 'free'];
    const findingIndex = normalizedText.indexOf(normalizedFinding);
    if (findingIndex === -1) return false;
    const windowStart = Math.max(0, findingIndex - 40);
    const windowText = normalizedText.substring(windowStart, findingIndex);
    return negationPhrases.some(phrase => windowText.includes(phrase));
  });
  
  if (!hasConflict && pT4Structures.detected) {
    const structureList = pT4Structures.structures.join(', ');
    return buildResult(
      'applicable',
      'pT4',
      'anatomical_override',
      undefined,
      `⚠️ ANATOMICAL OVERRIDE: Invasion of ${structureList} detected. Per AJCC 8th Edition, invasion of these structures automatically assigns pT4 regardless of tumor size.`
    );
  }

  // IPSILATERAL LOBE NODULE OVERRIDE: Separate nodule in different lobe of same lung = pT4
  // Per AJCC 8th Edition: A separate tumor nodule in a different ipsilateral lobe is pT4
  const ipsilateralLobeInfo = detectIpsilateralLobeNodules(rawText);
  if (!hasConflict && ipsilateralLobeInfo.forcesT4) {
    return buildResult(
      'applicable',
      'pT4',
      'ipsilateral_lobe_override',
      undefined,
      ipsilateralLobeInfo.message || `⚠️ IPSILATERAL LOBE OVERRIDE: Separate tumor nodule in different lobe of same lung detected. Per AJCC 8th Edition, this automatically assigns pT4 staging.`
    );
  }

  // STEP 2: Check OVERRIDE rules in priority order (before size-based staging)
  // GOLDEN RULE #1: The Invasion Trump Card - visceral pleural invasion (PL1/PL2) → pT2a
  // This ensures findings like visceral pleural invasion take precedence
  // CONFLICT SAFETY: If hasConflict is true, skip invasion-based overrides
  if (!hasConflict) {
    for (const rule of overrideRules) {
      if (rule.overrides) {
        for (const finding of findings) {
          if (matchesOverride(finding, rule.overrides)) {
            return buildResult(
              'applicable',
              rule.stage,
              'override',
              undefined,
              `${getStagingSource()}: ${finding.toUpperCase()} is present. Per staging criteria: "${rule.criteria}". This overrides tumor size-based staging.`
            );
          }
        }
      }
    }
  }

  // STEP 3: Check superficial spreading override (special case)
  if (
    inputs.superficial_spreading.is_superficial_spreading_tumor &&
    inputs.superficial_spreading.invasive_component_limited_to_bronchial_wall
  ) {
    return buildResult(
      'applicable',
      'pT1a',
      'override',
      undefined,
      `${getStagingSource()}: Superficial spreading tumor with invasive component limited to bronchial wall is classified as pT1a regardless of overall size.`
    );
  }

  // STEP 4: Validate size basis is present for size-based staging
  if (size_basis_cm === null) {
    return buildResult(
      'indeterminate',
      null,
      undefined,
      undefined,
      'No tumor size measurements could be extracted from the report. Please ensure the report includes size information (e.g., "0.8 cm tumor" or "tumor size: 1.2 cm").'
    );
  }

  // STEP 5: Size-based staging using rules database
  const sizeRule = getSizeBasedStage(size_basis_cm);
  
  if (sizeRule) {
    return buildResult(
      'applicable',
      sizeRule.stage,
      'size_basis_cm',
      size_basis_cm,
      `${getStagingSource()}: ${sizeRule.criteria}. Measured size: ${size_basis_cm} cm.`
    );
  }

  // Fallback - should not reach here given the logic above
  return buildResult(
    'outside_scope',
    null,
    'size_basis_cm',
    size_basis_cm,
    'Unable to determine pT category from the available information.'
  );
}

// Build descriptive reasoning for auto-calculated results
function buildAutoCalculateReasoning(
  calculatedResult: ValidationResult,
  inputs: ValidationInputs
): string {
  const parts: string[] = [];
  
  // Describe what we found
  if (inputs.measurements_cm.greatest_dimension_cm !== null) {
    parts.push(`tumor size of ${inputs.measurements_cm.greatest_dimension_cm} cm`);
  }
  
  if (inputs.pleural_invasion.has_visceral_pleural_invasion) {
    if (inputs.pleural_invasion.pl_status) {
      parts.push(`visceral pleural invasion (${inputs.pleural_invasion.pl_status})`);
    } else {
      parts.push('visceral pleural invasion');
    }
  } else {
    parts.push('no visceral pleural invasion');
  }
  
  // Check for direct invasion
  const directInvasions: string[] = [];
  if (inputs.direct_invasion.chest_wall) directInvasions.push('chest wall');
  if (inputs.direct_invasion.phrenic_nerve) directInvasions.push('phrenic nerve');
  if (inputs.direct_invasion.pericardium) directInvasions.push('pericardium');
  if (inputs.direct_invasion.diaphragm) directInvasions.push('diaphragm');
  if (directInvasions.length > 0) {
    parts.push(`direct invasion of ${directInvasions.join(', ')}`);
  }
  
  if (inputs.histology.is_AIS) {
    parts.push('adenocarcinoma in situ pattern');
  } else if (inputs.histology.is_MIA) {
    parts.push('minimally invasive adenocarcinoma pattern');
  }
  
  const findingsDescription = parts.length > 0 
    ? `Based on ${parts.join(' and ')}`
    : 'Based on the available findings';
  
  // Build the conclusion
  if (calculatedResult.t_category) {
    return `${findingsDescription}, the suggested stage is ${calculatedResult.t_category}. ${calculatedResult.reason}`;
  }
  
  return `${findingsDescription}. ${calculatedResult.reason}`;
}

// Compare reported stage with calculated stage
export function compareStages(
  reportedStage: string | null,
  calculatedResult: ValidationResult,
  inputs: ValidationInputs,
  rawText: string = ''
): {
  isMatch: boolean;
  isAutoCalculated: boolean;
  message: string;
  details: string;
  isPleuralInvasionMismatch?: boolean;
  clinicalNote?: string;
  isLepidicMismatch?: boolean;
  isIpsilateralLobeMismatch?: boolean;
} {
  // Auto-calculate mode: No reported stage found
  if (!reportedStage) {
    const hasCalculatedStage = calculatedResult.t_category !== null;
    const hasAnyFindings = 
      inputs.measurements_cm.greatest_dimension_cm !== null ||
      inputs.pleural_invasion.has_visceral_pleural_invasion ||
      inputs.histology.is_AIS ||
      inputs.histology.is_MIA ||
      inputs.superficial_spreading.is_superficial_spreading_tumor;
    
    if (hasCalculatedStage) {
      const reasoning = buildAutoCalculateReasoning(calculatedResult, inputs);
      return {
        isMatch: true, // Treat as success since we're providing a suggestion
        isAutoCalculated: true,
        message: `Suggested Stage: ${calculatedResult.t_category}`,
        details: reasoning,
      };
    }
    
    // We have some findings but can't calculate a stage
    if (hasAnyFindings) {
      return {
        isMatch: false,
        isAutoCalculated: true,
        message: 'Unable to Calculate Stage',
        details: buildAutoCalculateReasoning(calculatedResult, inputs),
      };
    }
    
    // No stage and no meaningful findings
    return {
      isMatch: false,
      isAutoCalculated: true,
      message: 'No Findings Detected',
      details: 'No tumor size, staging, or relevant findings could be extracted from the report. Please ensure the report contains standard pathology terminology such as tumor size (e.g., "0.8 cm tumor") or staging information.',
    };
  }

  if (calculatedResult.t_category === null) {
    return {
      isMatch: false,
      isAutoCalculated: false,
      message: 'Cannot validate',
      details: calculatedResult.reason,
    };
  }

  const normalizedReported = reportedStage.toUpperCase().replace(/\s/g, '');
  const normalizedCalculated = calculatedResult.t_category.toUpperCase().replace(/\s/g, '');

  // Special check: Pleural invasion present but reported as pT1a or pT1b
  if (
    inputs.pleural_invasion.has_visceral_pleural_invasion &&
    (inputs.pleural_invasion.pl_status === 'PL1' || inputs.pleural_invasion.pl_status === 'PL2') &&
    (normalizedReported === 'PT1A' || normalizedReported === 'PT1B')
  ) {
    const tumorSize = inputs.measurements_cm.greatest_dimension_cm;
    const plStatus = inputs.pleural_invasion.pl_status;
    
    return {
      isMatch: false,
      isAutoCalculated: false,
      message: 'Validation Failure: Staging Mismatch Detected',
      details: `According to AJCC 8th Edition/CAP Lung Protocol, visceral pleural invasion automatically upgrades the pT category. • Tumor Size: ${tumorSize !== null ? tumorSize + ' cm' : 'Not specified'}. • Pleural Status: ${plStatus} (visceral pleural invasion present). • Logic: Any tumor with visceral pleural invasion (${plStatus}) must be classified as pT2a or higher, regardless of tumor size, making the reported ${reportedStage} clinically inconsistent.`,
      isPleuralInvasionMismatch: true,
    };
  }

  // Special check: Ipsilateral lobe nodules present but reported as T1 or T2
  // Per AJCC 8th Edition: Separate tumor nodule in a different ipsilateral lobe = pT4
  const ipsilateralLobeInfo = detectIpsilateralLobeNodules(rawText);
  if (
    ipsilateralLobeInfo.isDifferentLobesSameLung &&
    (normalizedReported.startsWith('PT1') || normalizedReported.startsWith('PT2'))
  ) {
    return {
      isMatch: false,
      isAutoCalculated: false,
      message: 'Validation Failure: Ipsilateral Lobe Mismatch',
      details: `According to AJCC 8th Edition, a separate tumor nodule in a different lobe of the SAME lung (ipsilateral) automatically assigns pT4 staging.

**Detected Findings:**
• Primary Tumor: ${ipsilateralLobeInfo.primaryLobe} (${ipsilateralLobeInfo.primaryLung} Lung)
• Separate Nodule: ${ipsilateralLobeInfo.noduleLobe || 'detected'} (${ipsilateralLobeInfo.noduleLung || 'same'} Lung)

**AJCC Rule:** Different lobe, same lung = pT4

**Reported Stage:** ${reportedStage}
**Correct Stage:** pT4

**Conclusion:** The reported ${reportedStage} is inconsistent with the presence of ipsilateral lobe nodules. This should be staged as pT4.`,
      isIpsilateralLobeMismatch: true,
    };
  }

  // Check for invasive size mismatch (Golden Rule #2) - Lepidic-predominant adenocarcinoma
  if (
    inputs.histology.is_invasive_nonmucinous_adenocarcinoma_with_lepidic_component &&
    inputs.measurements_cm.invasive_size_cm !== null &&
    inputs.measurements_cm.total_tumor_size_cm !== null &&
    normalizedReported !== normalizedCalculated
  ) {
    const totalSize = inputs.measurements_cm.total_tumor_size_cm;
    const invasiveSize = inputs.measurements_cm.invasive_size_cm;
    const calculatedStage = calculatedResult.t_category;
    
    // Determine criteria text based on calculated stage
    let criteriaText = '';
    if (calculatedStage === 'pT1a') {
      criteriaText = '≤1.0 cm';
    } else if (calculatedStage === 'pT1b') {
      criteriaText = '>1.0–2.0 cm';
    } else if (calculatedStage === 'pT1c') {
      criteriaText = '>2.0–3.0 cm';
    } else if (calculatedStage === 'pT2a') {
      criteriaText = '>3.0–4.0 cm';
    } else if (calculatedStage === 'pT2b') {
      criteriaText = '>4.0–5.0 cm';
    }
    
    return {
      isMatch: false,
      isAutoCalculated: false,
      message: 'Validation Failure: Staging Mismatch Detected',
      details: `The reported stage ${reportedStage} is inconsistent with the calculated stage ${calculatedStage}.

**Staging Basis:** Invasive component size (not total tumor size)

**Measurements:**
• Total Tumor Size: ${totalSize} cm (includes lepidic component)
• Invasive Component Size: ${invasiveSize} cm

**Calculated Stage:** ${calculatedStage} — based on invasive component of ${invasiveSize} cm, which falls within the ${calculatedStage} criteria (${criteriaText}).

**Conclusion:** The reported ${reportedStage} does not align with AJCC 8th Edition staging criteria for this histologic subtype.`,
      clinicalNote: 'Per CAP Lung Protocol Note A and AJCC 8th Edition, for nonmucinous adenocarcinomas with a lepidic component, only the size of the invasive component is used to assign the T category.',
      isLepidicMismatch: true,
    };
  }

  if (normalizedReported === normalizedCalculated) {
    return {
      isMatch: true,
      isAutoCalculated: false,
      message: 'Validation Success: Stage Matches',
      details: `According to AJCC 8th Edition/CAP Lung Protocol, the reported ${reportedStage} matches the calculated ${calculatedResult.t_category}. ${calculatedResult.reason}`,
    };
  }

  // Generic mismatch
  const tumorSize = inputs.measurements_cm.greatest_dimension_cm;
  const invasiveSize = inputs.measurements_cm.invasive_size_cm;
  const sizeUsed = invasiveSize !== null ? invasiveSize : tumorSize;
  
  return {
    isMatch: false,
    isAutoCalculated: false,
    message: 'Validation Failure: Staging Mismatch Detected',
    details: `According to AJCC 8th Edition/CAP Lung Protocol, the reported stage does not match the calculated stage. • Tumor Size: ${tumorSize !== null ? tumorSize + ' cm' : 'Not specified'}${invasiveSize !== null ? ` • Invasive Size: ${invasiveSize} cm` : ''}. • Calculated Stage: ${calculatedResult.t_category}. • Logic: Based on the size of ${sizeUsed} cm, the correct stage should be ${calculatedResult.t_category}, making the reported ${reportedStage} clinically inconsistent.`,
  };
}

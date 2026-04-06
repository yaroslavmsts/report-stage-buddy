// AJCC 9th Edition - Lung Cancer Full TNM Staging Rules
// This is the Source of Truth for all staging calculations
// Effective January 1, 2025

export interface GoldenRule {
  id: string;
  name: string;
  description: string;
  priority: number;
}

export interface StagingRule {
  stage: string;
  criteria: string;
  min_size_cm?: number;
  max_size_cm?: number;
  overrides?: string[];
  priority?: number;
}

export interface NodeRule {
  stage: string;
  criteria: string;
  keywords: string[];
}

export interface MetastasisRule {
  stage: string;
  criteria: string;
  keywords: string[];
}

export interface StageGroup {
  group: string;
  t: string[];
  n: string[];
  m: string[];
}

export interface ICD10Code {
  site: string;
  code: string;
  description: string;
  keywords: string[];
}

export interface SurvivalData {
  stage: string;
  five_year_survival: string;
}

export interface StagingRulesDatabase {
  staging_system: string;
  source: string;
  golden_rules: GoldenRule[];
  rules: StagingRule[];
  node_rules: NodeRule[];
  metastasis_rules: MetastasisRule[];
  stage_groups: StageGroup[];
  icd10_codes: ICD10Code[];
  survival_data: SurvivalData[];
}

// Golden Rules - these take precedence in staging decisions
export const GOLDEN_RULES: GoldenRule[] = [
  {
    id: "invasion_trump_card",
    name: "The Invasion Trump Card",
    description: "Visceral pleural invasion (PL1/PL2) automatically makes a tumor pT2a, even if the size is only 0.2 cm.",
    priority: 1
  },
  {
    id: "total_vs_invasive",
    name: "Total vs. Invasive Size",
    description: "For T1 stages, if a report provides both \"Total Size\" and \"Invasive Size,\" the Invasive Size is used for staging.",
    priority: 2
  },
  {
    id: "atelectasis_pneumonitis",
    name: "Atelectasis/Pneumonitis",
    description: "If a tumor of any size causes collapse of the entire lung (total atelectasis/pneumonitis), it is automatically pT2.",
    priority: 3
  }
];

// Regional Lymph Node (pN) Rules — AJCC 9th Edition: N2 split into N2a/N2b
export const NODE_RULES: NodeRule[] = [
  {
    stage: "pN0",
    criteria: "No regional lymph node metastasis",
    keywords: ["no lymph node metastasis", "lymph nodes negative", "0/", "nodes negative", "no metastatic carcinoma in lymph nodes", "lymph nodes: negative"]
  },
  {
    stage: "pN1",
    criteria: "Metastasis in ipsilateral peribronchial and/or ipsilateral hilar lymph nodes, OR direct invasion of peribronchial/hilar lymph node by primary tumor",
    keywords: ["ipsilateral hilar", "peribronchial", "hilar lymph node metastasis", "n1 node", "level 10", "level 11", "level 12", "level 13", "level 14", "direct invasion of lymph node", "directly invades lymph node", "tumor invades hilar lymph node", "tumor invades peribronchial lymph node", "direct extension into lymph node", "directly involves lymph node"]
  },
  {
    stage: "pN2a",
    criteria: "Metastasis in a SINGLE ipsilateral mediastinal or subcarinal station",
    keywords: ["single station", "single mediastinal", "n2a", "one station"]
  },
  {
    stage: "pN2b",
    criteria: "Metastasis in MULTIPLE ipsilateral mediastinal or subcarinal stations",
    keywords: ["multiple stations", "n2b", "two stations", "three stations"]
  },
  {
    stage: "pN3",
    criteria: "Metastasis in contralateral mediastinal, contralateral hilar, ipsilateral or contralateral scalene, or supraclavicular lymph nodes",
    keywords: ["contralateral mediastinal", "contralateral hilar", "scalene", "supraclavicular", "n3 node"]
  }
];

// Shared N2-level keywords used for initial N2 detection before subclassification
const N2_SHARED_KEYWORDS = [
  "ipsilateral mediastinal", "subcarinal", "mediastinal lymph node metastasis",
  "n2 node", "level 2", "level 4", "level 5", "level 6", "level 7", "level 8", "level 9"
];

// Distant Metastasis (pM) Rules — AJCC 9th Edition: M1c split into M1c1/M1c2
export const METASTASIS_RULES: MetastasisRule[] = [
  {
    stage: "pM0",
    criteria: "No distant metastasis",
    keywords: ["no distant metastasis", "m0", "no metastasis"]
  },
  {
    stage: "pM1a",
    criteria: "Separate tumor nodule in contralateral lobe, pleural or pericardial nodules, or malignant pleural/pericardial effusion",
    keywords: ["contralateral lobe nodule", "contralateral lung nodule", "contralateral lobe", "opposite lung nodule", "pleural effusion", "pericardial effusion", "malignant effusion", "pleural nodule", "pericardial nodule", "pleural metastasis"]
  },
  {
    stage: "pM1b",
    criteria: "Single extrathoracic metastasis in a single organ",
    keywords: ["single extrathoracic metastasis", "single distant metastasis", "single organ metastasis", "m1b"]
  },
  {
    stage: "pM1c1",
    criteria: "Multiple extrathoracic metastases in a SINGLE organ system",
    keywords: ["multiple extrathoracic metastases single organ", "m1c1"]
  },
  {
    stage: "pM1c2",
    criteria: "Multiple extrathoracic metastases in MULTIPLE organ systems",
    keywords: ["multiple extrathoracic metastases multiple organs", "m1c2"]
  }
];

// AJCC 9th Edition Stage Grouping — FULL REBUILD
export const STAGE_GROUPS: StageGroup[] = [
  // Stage 0
  { group: "Stage 0", t: ["Tis"], n: ["N0"], m: ["M0"] },

  // Stage IA
  { group: "Stage IA1", t: ["T1mi", "T1a"], n: ["N0"], m: ["M0"] },
  { group: "Stage IA2", t: ["T1b"], n: ["N0"], m: ["M0"] },
  { group: "Stage IA3", t: ["T1c"], n: ["N0"], m: ["M0"] },

  // Stage IB
  { group: "Stage IB", t: ["T2a"], n: ["N0"], m: ["M0"] },

  // Stage IIA
  { group: "Stage IIA", t: ["T2b"], n: ["N0"], m: ["M0"] },

  // Stage IIB — AJCC 9th: T1a-T2b/N2a/M0 all map here (was IIIA in 8th)
  { group: "Stage IIB", t: ["T1a", "T1b", "T1c", "T2a", "T2b"], n: ["N1"], m: ["M0"] },
  { group: "Stage IIB", t: ["T3"], n: ["N0"], m: ["M0"] },
  { group: "Stage IIB", t: ["T1a", "T1b", "T1c", "T2a", "T2b"], n: ["N2a"], m: ["M0"] },

  // Stage IIIA
  { group: "Stage IIIA", t: ["T3"], n: ["N1"], m: ["M0"] },
  { group: "Stage IIIA", t: ["T4"], n: ["N0", "N1"], m: ["M0"] },

  // Stage IIIB
  { group: "Stage IIIB", t: ["T1a", "T1b", "T1c", "T2a", "T2b"], n: ["N2b"], m: ["M0"] },
  { group: "Stage IIIB", t: ["T1a", "T1b", "T1c", "T2a", "T2b"], n: ["N3"], m: ["M0"] },
  { group: "Stage IIIB", t: ["T3", "T4"], n: ["N2a"], m: ["M0"] },

  // Stage IIIC
  { group: "Stage IIIC", t: ["T3", "T4"], n: ["N2b"], m: ["M0"] },
  { group: "Stage IIIC", t: ["T3", "T4"], n: ["N3"], m: ["M0"] },

  // Stage IV
  { group: "Stage IVA", t: ["any"], n: ["any"], m: ["M1a", "M1b"] },
  { group: "Stage IVB", t: ["any"], n: ["any"], m: ["M1c", "M1c1", "M1c2"] }
];

// ICD-10 Codes for Lung Cancer by Site
export const ICD10_CODES: ICD10Code[] = [
  {
    site: "Main bronchus",
    code: "C34.0",
    description: "Malignant neoplasm of main bronchus",
    keywords: ["main bronchus", "carina", "mainstem"]
  },
  {
    site: "Upper lobe",
    code: "C34.1",
    description: "Malignant neoplasm of upper lobe, bronchus or lung",
    keywords: ["upper lobe", "right upper lobe", "left upper lobe", "rul", "lul", "apical", "anterior segment upper"]
  },
  {
    site: "Middle lobe",
    code: "C34.2",
    description: "Malignant neoplasm of middle lobe, bronchus or lung",
    keywords: ["middle lobe", "right middle lobe", "rml"]
  },
  {
    site: "Lower lobe",
    code: "C34.3",
    description: "Malignant neoplasm of lower lobe, bronchus or lung",
    keywords: ["lower lobe", "right lower lobe", "left lower lobe", "rll", "lll", "basal", "superior segment lower"]
  },
  {
    site: "Overlapping sites",
    code: "C34.8",
    description: "Malignant neoplasm of overlapping sites of bronchus and lung",
    keywords: ["overlapping", "multiple lobes", "crossing fissure"]
  },
  {
    site: "Unspecified",
    code: "C34.9",
    description: "Malignant neoplasm of bronchus or lung, unspecified",
    keywords: ["lung", "bronchus", "pulmonary"]
  }
];

// Source of Truth JSON for AJCC 9th Edition Lung Cancer Full TNM Staging
export const STAGING_RULES: StagingRulesDatabase = {
  staging_system: "AJCC 9th Edition - Lung Cancer (TNM)",
  source: "IASLC Staging Manual 9th Edition, 2024",
  golden_rules: GOLDEN_RULES,
  rules: [
    {
      stage: "pTis",
      criteria: "Carcinoma in situ (AIS)",
      max_size_cm: 0,
      priority: 1
    },
    {
      stage: "pT1mi",
      criteria: "Minimally invasive adenocarcinoma; invasive component <= 0.5 cm",
      max_size_cm: 0.5,
      priority: 2
    },
    {
      stage: "pT1a",
      criteria: "Tumor size <= 1.0 cm",
      max_size_cm: 1.0,
      priority: 10
    },
    {
      stage: "pT1b",
      criteria: "Tumor size > 1.0 cm and <= 2.0 cm",
      min_size_cm: 1.0,
      max_size_cm: 2.0,
      priority: 10
    },
    {
      stage: "pT1c",
      criteria: "Tumor size > 2.0 cm and <= 3.0 cm",
      min_size_cm: 2.0,
      max_size_cm: 3.0,
      priority: 10
    },
    {
      stage: "pT2a",
      criteria: "Tumor size > 3.0 cm and <= 4.0 cm OR any size with visceral pleural invasion (PL1: beyond elastic layer, PL2: to pleural surface) OR direct extension into hilar fat/hilar soft tissue",
      min_size_cm: 3.0,
      max_size_cm: 4.0,
      overrides: ["visceral pleural invasion", "PL1", "PL2", "hilar fat", "hilar soft tissue", "direct extension into hilar"],
      priority: 5
    },
    {
      stage: "pT2b",
      criteria: "Tumor size > 4.0 cm and <= 5.0 cm",
      min_size_cm: 4.0,
      max_size_cm: 5.0,
      priority: 10
    },
    {
      stage: "pT3",
      criteria: "Tumor size > 5.0 cm and <= 7.0 cm OR direct invasion of chest wall, phrenic nerve, parietal pericardium, OR parietal pleura (PL3) OR separate tumor nodule in same lobe",
      min_size_cm: 5.0,
      max_size_cm: 7.0,
      overrides: ["chest wall", "phrenic nerve", "parietal pericardium", "parietal pleura", "PL3", "same lobe nodule"],
      priority: 4
    },
    {
      stage: "pT4",
      criteria: "Tumor size > 7.0 cm OR invasion of diaphragm, mediastinum, heart, great vessels, trachea, carina, esophagus, vertebral body, or recurrent laryngeal nerve OR separate tumor nodule in different ipsilateral lobe",
      min_size_cm: 7.0,
      overrides: ["diaphragm", "mediastinum", "heart", "great vessels", "trachea", "carina", "esophagus", "vertebral body", "recurrent laryngeal nerve", "ipsilateral lobe nodule"],
      priority: 3
    }
  ],
  node_rules: NODE_RULES,
  metastasis_rules: METASTASIS_RULES,
  stage_groups: STAGE_GROUPS,
  icd10_codes: ICD10_CODES,
  survival_data: [] // Populated after SURVIVAL_DATA is defined
};

// Get the staging system source label
export function getStagingSource(): string {
  return `Source: ${STAGING_RULES.source}`;
}

// Get staging rule by stage name
export function getRuleByStage(stage: string): StagingRule | undefined {
  return STAGING_RULES.rules.find(
    rule => rule.stage.toUpperCase() === stage.toUpperCase()
  );
}

// Get all override keywords for a specific stage
export function getOverridesForStage(stage: string): string[] {
  const rule = getRuleByStage(stage);
  return rule?.overrides || [];
}

// Check if a finding matches any override keyword
export function matchesOverride(finding: string, overrides: string[]): boolean {
  const normalizedFinding = finding.toLowerCase();
  return overrides.some(override => 
    normalizedFinding.includes(override.toLowerCase())
  );
}

// Get all rules with overrides (for priority checking)
export function getRulesWithOverrides(): StagingRule[] {
  return STAGING_RULES.rules
    .filter(rule => rule.overrides && rule.overrides.length > 0)
    .sort((a, b) => (a.priority || 10) - (b.priority || 10));
}

// Get size-based staging rule — Bug 8 fix: explicit fallback for >7cm
export function getSizeBasedStage(size_cm: number): StagingRule | undefined {
  // Handle edge cases first
  if (size_cm <= 0) {
    return STAGING_RULES.rules.find(r => r.stage === 'pTis');
  }
  if (size_cm <= 1.0) {
    return STAGING_RULES.rules.find(r => r.stage === 'pT1a');
  }

  // Filter to rules with size ranges, sort by min_size ascending
  const sizeRules = STAGING_RULES.rules
    .filter(rule => rule.max_size_cm !== undefined || rule.min_size_cm !== undefined)
    .sort((a, b) => (a.min_size_cm ?? 0) - (b.min_size_cm ?? 0));

  for (const rule of sizeRules) {
    const minSize = rule.min_size_cm ?? 0;
    const maxSize = rule.max_size_cm ?? Infinity;

    if (size_cm > minSize && size_cm <= maxSize) {
      return rule;
    }
  }

  // Explicit fallback: any size > 7.0 cm → pT4
  if (size_cm > 7.0) {
    return STAGING_RULES.rules.find(r => r.stage === 'pT4');
  }

  return undefined;
}

// Helper: identify local nodal negation around a station/keyword mention
function isNegatedNodeMention(text: string, matchIndex: number): boolean {
  const sentenceStart = Math.max(
    text.lastIndexOf('.', matchIndex - 1),
    text.lastIndexOf('\n', matchIndex - 1),
    text.lastIndexOf(';', matchIndex - 1)
  ) + 1;

  const nextPeriod = text.indexOf('.', matchIndex);
  const nextNewline = text.indexOf('\n', matchIndex);
  const nextSemicolon = text.indexOf(';', matchIndex);
  const sentenceEndCandidates = [nextPeriod, nextNewline, nextSemicolon].filter(index => index !== -1);
  const sentenceEnd = sentenceEndCandidates.length > 0 ? Math.min(...sentenceEndCandidates) : text.length;

  const sentence = text.slice(sentenceStart, sentenceEnd).toLowerCase();
  const relativeIndex = matchIndex - sentenceStart;
  const contextStart = Math.max(0, relativeIndex - 40);
  const contextEnd = Math.min(sentence.length, relativeIndex + 80);
  const context = sentence.slice(contextStart, contextEnd);

  return [
    /\bnegative\b/i,
    /\bnodes?\s+negative\b/i,
    /\bno\s+(?:lymph\s+node\s+)?metastas(?:is|es)\b/i,
    /\bno\s+metastatic\s+carcinoma\b/i,
    /\bwithout\s+metastas(?:is|es)\b/i,
    /\bfree\s+of\s+metastas(?:is|es)\b/i,
    /\buninvolved\b/i,
    /\b0\s*\/\s*\d+\b/i,
  ].some(pattern => pattern.test(context));
}

function hasNonNegatedKeyword(text: string, keyword: string): boolean {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escapedKeyword, 'gi');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (!isNegatedNodeMention(text, match.index)) {
      return true;
    }
  }

  return false;
}

// Helper: count unique N2-level stations mentioned in non-negated positive text
function countN2Stations(text: string): number {
  const stationSet = new Set<string>();
  const stationPattern = /(?:station|level)\s*(\d{1,2})[rl]?\b/gi;
  let match;
  while ((match = stationPattern.exec(text)) !== null) {
    const num = parseInt(match[1]);
    if ([2, 4, 5, 6, 7, 8, 9].includes(num) && !isNegatedNodeMention(text, match.index)) {
      stationSet.add(String(num));
    }
  }

  const namedMappings: Array<{ pattern: RegExp; station: string; predicate?: () => boolean }> = [
    { pattern: /\bsubcarinal\b/gi, station: '7' },
    { pattern: /\bparatracheal\b/gi, station: 'paratracheal', predicate: () => !stationSet.has('2') && !stationSet.has('4') },
    { pattern: /\baortopulmonary\b/gi, station: '5_6' },
    { pattern: /\bsubaortic\b/gi, station: '5_6' },
    { pattern: /\bparaesophageal\b/gi, station: '8' },
  ];

  for (const { pattern, station, predicate } of namedMappings) {
    let namedMatch: RegExpExecArray | null;
    while ((namedMatch = pattern.exec(text)) !== null) {
      if (!isNegatedNodeMention(text, namedMatch.index) && (!predicate || predicate())) {
        stationSet.add(station);
      }
    }
  }

  return stationSet.size;
}

// Helper: check if an organ mention is in a negated context
// Looks for negation words in the same sentence, near the match
function isNegatedOrganMention(text: string, matchIndex: number): boolean {
  // Find sentence boundaries
  const sentenceStart = Math.max(
    text.lastIndexOf('.', matchIndex - 1),
    text.lastIndexOf('\n', matchIndex - 1),
    text.lastIndexOf(';', matchIndex - 1)
  ) + 1;
  const nextPeriod = text.indexOf('.', matchIndex);
  const nextNewline = text.indexOf('\n', matchIndex);
  const nextSemicolon = text.indexOf(';', matchIndex);
  const ends = [nextPeriod, nextNewline, nextSemicolon].filter(i => i !== -1);
  const sentenceEnd = ends.length > 0 ? Math.min(...ends) : text.length;
  const sentence = text.slice(sentenceStart, sentenceEnd).toLowerCase();

  // Check for negation patterns in the sentence
  return /\bno\b|\bnot\b|\bwithout\b|\bnegative\b|\babsent\b|\bdenied\b|\bno evidence\b|\brule(?:d)?\s*out\b|\bexcluded\b/.test(sentence);
}

// Helper: count organ systems with POSITIVE (non-negated) metastatic involvement
function countOrgansWithMets(text: string): Set<string> {
  const normalizedText = text.toLowerCase();
  const organs = new Set<string>();
  const hasMetContext = /metastas|mets?\b/i.test(normalizedText);
  if (!hasMetContext) return organs;

  const organPatterns: Array<{ name: string; pattern: RegExp }> = [
    { name: 'brain', pattern: /\b(?:brain|cerebral|intracranial)\b/gi },
    { name: 'bone', pattern: /\b(?:bone|osseous|skeletal)\b/gi },
    { name: 'liver', pattern: /\b(?:liver|hepatic)\b/gi },
    { name: 'adrenal', pattern: /\b(?:adrenal)\b/gi },
    { name: 'skin', pattern: /\b(?:skin|cutaneous)\b/gi },
    { name: 'kidney', pattern: /\b(?:kidney|renal)\b/gi },
  ];

  for (const { name, pattern } of organPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalizedText)) !== null) {
      if (!isNegatedOrganMention(normalizedText, match.index)) {
        organs.add(name);
        break; // one positive mention is enough
      }
    }
  }

  return organs;
}

// Get pN stage based on findings — AJCC 9th: N2a/N2b subclassification
export function getNodeStage(text: string): { stage: string; criteria: string; subclassAmbiguous?: boolean } | null {
  const normalizedText = text.toLowerCase();


  const n3Rule = NODE_RULES.find(r => r.stage === 'pN3')!;
  for (const keyword of n3Rule.keywords) {
    if (hasNonNegatedKeyword(normalizedText, keyword.toLowerCase())) {
      return { stage: 'pN3', criteria: n3Rule.criteria };
    }
  }

  let n2Detected = false;
  for (const keyword of N2_SHARED_KEYWORDS) {
    if (hasNonNegatedKeyword(normalizedText, keyword)) {
      n2Detected = true;
      break;
    }
  }

  const n2aRule = NODE_RULES.find(r => r.stage === 'pN2a')!;
  const n2bRule = NODE_RULES.find(r => r.stage === 'pN2b')!;
  for (const kw of n2aRule.keywords) {
    if (hasNonNegatedKeyword(normalizedText, kw)) {
      n2Detected = true;
      break;
    }
  }
  for (const kw of n2bRule.keywords) {
    if (hasNonNegatedKeyword(normalizedText, kw)) {
      n2Detected = true;
      break;
    }
  }

  if (n2Detected) {
    for (const kw of n2bRule.keywords) {
      if (hasNonNegatedKeyword(normalizedText, kw)) {
        return { stage: 'pN2b', criteria: n2bRule.criteria };
      }
    }
    for (const kw of n2aRule.keywords) {
      if (hasNonNegatedKeyword(normalizedText, kw)) {
        return { stage: 'pN2a', criteria: n2aRule.criteria };
      }
    }

    const stationCount = countN2Stations(normalizedText);
    if (stationCount === 1) {
      return { stage: 'pN2a', criteria: n2aRule.criteria };
    }
    if (stationCount >= 2) {
      return { stage: 'pN2b', criteria: n2bRule.criteria };
    }

    return {
      stage: 'pN2',
      criteria: 'Metastasis in ipsilateral mediastinal and/or subcarinal lymph nodes (subclass not determined)',
      subclassAmbiguous: true
    };
  }

  const n1Rule = NODE_RULES.find(r => r.stage === 'pN1')!;
  for (const keyword of n1Rule.keywords) {
    if (hasNonNegatedKeyword(normalizedText, keyword.toLowerCase())) {
      return { stage: 'pN1', criteria: n1Rule.criteria };
    }
  }

  // pNx detection — nodes not submitted / not sampled / not examined
  // Placed AFTER N3/N2/N1 so positive nodes always take precedence
  const NX_PHRASES = [
    'no lymph nodes submitted',
    'no nodes submitted',
    'lymph nodes not submitted',
    'no lymph nodes received',
    'lymph nodes not sampled',
    'no lymph nodes identified',
    'lymph node sampling not performed',
    'nodal assessment not performed',
    'no lymph node material',
    'lymph nodes not received',
    'nodes not sampled',
    'no nodal tissue',
    'no nodal material',
    'lymph nodes not identified',
    'lymph nodes not examined',
    'no lymph nodes examined',
  ];
  for (const phrase of NX_PHRASES) {
    if (normalizedText.includes(phrase)) {
      return { stage: 'pNx', criteria: 'Regional lymph nodes cannot be assessed (not submitted/sampled)' };
    }
  }

  // Biopsy specimen detection → pNx (biopsy specimens typically don't include nodal tissue)
  // Only triggers if NO explicit nodal staging info is present anywhere in the report
  const BIOPSY_PATTERNS = /\b(?:biopsy|needle biopsy|core biopsy|wedge biopsy|transbronchial biopsy|endobronchial biopsy|ct[- ]?guided biopsy|fine needle aspirat\w*)\b/i;
  const HAS_NODAL_INFO = /\blymph\s*node|nodal\s*stag|\bstation\s*\d|\blevel\s*\d|\b\d+\s*\/\s*\d+\s*(?:lymph|node)|\bnodes?\s*(?:positive|negative|examined|sampled|submitted|received|identified)\b/i;
  if (BIOPSY_PATTERNS.test(normalizedText) && !HAS_NODAL_INFO.test(normalizedText)) {
    return { stage: 'pNx', criteria: 'Regional lymph nodes cannot be assessed (biopsy specimen — no nodal tissue submitted)' };
  }

  const n0Rule = NODE_RULES.find(r => r.stage === 'pN0')!;
  for (const keyword of n0Rule.keywords) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return { stage: 'pN0', criteria: n0Rule.criteria };
    }
  }

  return null;
}

// Get pM stage based on findings — AJCC 9th: M1c1/M1c2 subclassification
export function getMetastasisStage(text: string): { stage: string; criteria: string; subclassAmbiguous?: boolean } | null {
  const normalizedText = text.toLowerCase();

  // M1c detection: keywords + pattern-based
  const m1cKeywords = ['multiple extrathoracic metastases', 'multiple distant metastases', 'widespread metastases', 'm1c'];
  let m1cDetected = false;
  for (const kw of m1cKeywords) {
    if (normalizedText.includes(kw)) { m1cDetected = true; break; }
  }
  // Pattern: "multiple [organ] metastases"
  if (!m1cDetected && /multiple\s+\w+\s+metastas/i.test(text)) {
    m1cDetected = true;
  }
  // Multi-organ involvement
  const organSystems = countOrgansWithMets(normalizedText);
  if (organSystems.size >= 2) m1cDetected = true;

  if (m1cDetected) {
    if (organSystems.size >= 2) {
      return { stage: 'pM1c2', criteria: 'Multiple extrathoracic metastases in multiple organ systems' };
    } else if (organSystems.size === 1) {
      return { stage: 'pM1c1', criteria: 'Multiple extrathoracic metastases in a single organ system' };
    } else {
      return { stage: 'pM1c', criteria: 'Multiple extrathoracic metastases (subclass not determined)', subclassAmbiguous: true };
    }
  }

  // M1b
  const m1bRule = METASTASIS_RULES.find(r => r.stage === 'pM1b')!;
  for (const keyword of m1bRule.keywords) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return { stage: 'pM1b', criteria: m1bRule.criteria };
    }
  }

  // M1a
  const m1aRule = METASTASIS_RULES.find(r => r.stage === 'pM1a')!;
  for (const keyword of m1aRule.keywords) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return { stage: 'pM1a', criteria: m1aRule.criteria };
    }
  }

  // M0
  const m0Rule = METASTASIS_RULES.find(r => r.stage === 'pM0')!;
  for (const keyword of m0Rule.keywords) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return { stage: 'pM0', criteria: m0Rule.criteria };
    }
  }

  return null;
}

// Get AJCC 9th stage group based on T, N, M
export function getStageGroup(tStage: string, nStage: string, mStage: string): string {
  // Normalize stages (remove 'p' prefix and '(m)' suffix for matching)
  const normalizedT = tStage.replace(/^p/i, '').replace(/\(m\)$/i, '').toUpperCase();
  const normalizedN = nStage.replace(/^p/i, '').toUpperCase();
  const normalizedM = mStage.replace(/^p/i, '').toUpperCase();

  // Check for M1 first (Stage IV takes precedence)
  if (normalizedM.startsWith('M1')) {
    if (normalizedM === 'M1C' || normalizedM === 'M1C1' || normalizedM === 'M1C2') {
      return 'Stage IVB';
    }
    return 'Stage IVA';
  }

  // For N2 without subclass, treat as N2A (conservative)
  const effectiveN = normalizedN === 'N2' ? 'N2A' : normalizedN;

  // Find matching stage group
  for (const group of STAGE_GROUPS) {
    const tMatch = group.t.includes('any') || group.t.some(t => normalizedT === t.toUpperCase());
    const nMatch = group.n.includes('any') || group.n.some(n => effectiveN === n.toUpperCase());
    const mMatch = group.m.includes('any') || group.m.some(m => normalizedM === m.toUpperCase());

    if (tMatch && nMatch && mMatch) {
      return group.group;
    }
  }

  return 'Unable to determine';
}

// Get ICD-10 code based on tumor site
// Priority: lobe-specific codes first, then main bronchus, then fallback.
// Strip lymph node station text to avoid false "bronchus" matches from normalization.
export function getICD10Code(text: string): ICD10Code {
  // Remove lymph node / station context that may contain "bronchus" after normalization
  const siteText = text
    .replace(/\b(level\s+\d+[A-Za-z]?\s+lymph\s+node|subcarinal\s+lymph\s+node|lymph\s+node[s]?\s+(negative|positive|metastasis|unremarkable)|nodal\s+[a-z]+)/gi, '')
    .toLowerCase();

  // Check lobe-specific codes FIRST (C34.1, C34.2, C34.3, C34.8)
  const lobeCodes = ICD10_CODES.filter(c => ['C34.1', 'C34.2', 'C34.3', 'C34.8'].includes(c.code));
  for (const code of lobeCodes) {
    for (const keyword of code.keywords) {
      if (siteText.includes(keyword.toLowerCase())) {
        return code;
      }
    }
  }

  // Then check main bronchus (C34.0)
  const mainBronchus = ICD10_CODES.find(c => c.code === 'C34.0')!;
  for (const keyword of mainBronchus.keywords) {
    if (siteText.includes(keyword.toLowerCase())) {
      return mainBronchus;
    }
  }

  return ICD10_CODES.find(c => c.code === 'C34.9')!;
}

// 5-Year Survival Data by Pathologic Stage (AJCC 9th Edition IASLC data)
export const SURVIVAL_DATA: SurvivalData[] = [
  { stage: "Stage IA1", five_year_survival: "92%" },
  { stage: "Stage IA2", five_year_survival: "88%" },
  { stage: "Stage IA3", five_year_survival: "82%" },
  { stage: "Stage IB", five_year_survival: "75%" },
  { stage: "Stage IIA", five_year_survival: "68%" },
  { stage: "Stage IIB", five_year_survival: "60%" },
  { stage: "Stage IIIA", five_year_survival: "42%" },
  { stage: "Stage IIIB", five_year_survival: "26%" },
  { stage: "Stage IIIC", five_year_survival: "13%" },
  { stage: "Stage IVA", five_year_survival: "10%" },
  { stage: "Stage IVB", five_year_survival: "< 1%" }
];

// Get 5-year survival rate for a stage group
export function getSurvivalData(stageGroup: string): SurvivalData | null {
  return SURVIVAL_DATA.find(s => s.stage === stageGroup) || null;
}

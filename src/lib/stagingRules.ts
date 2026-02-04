// AJCC 8th Edition - Lung Cancer Full TNM Staging Rules
// This is the Source of Truth for all staging calculations

export interface GoldenRule {
  id: string;
  name: string;
  description: string;
  priority: number; // Lower = higher priority (checked first)
}

export interface StagingRule {
  stage: string;
  criteria: string;
  min_size_cm?: number;
  max_size_cm?: number;
  overrides?: string[];
  priority?: number; // Lower number = higher priority
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

// Regional Lymph Node (pN) Rules
export const NODE_RULES: NodeRule[] = [
  {
    stage: "pN0",
    criteria: "No regional lymph node metastasis",
    keywords: ["no lymph node metastasis", "lymph nodes negative", "0/", "nodes negative", "no metastatic carcinoma in lymph nodes", "lymph nodes: negative"]
  },
  {
    stage: "pN1",
    criteria: "Metastasis in ipsilateral peribronchial and/or ipsilateral hilar lymph nodes",
    keywords: ["ipsilateral hilar", "peribronchial", "hilar lymph node metastasis", "n1 node", "level 10", "level 11", "level 12", "level 13", "level 14"]
  },
  {
    stage: "pN2",
    criteria: "Metastasis in ipsilateral mediastinal and/or subcarinal lymph nodes",
    keywords: ["ipsilateral mediastinal", "subcarinal", "mediastinal lymph node metastasis", "n2 node", "level 2", "level 4", "level 5", "level 6", "level 7", "level 8", "level 9"]
  },
  {
    stage: "pN3",
    criteria: "Metastasis in contralateral mediastinal, contralateral hilar, ipsilateral or contralateral scalene, or supraclavicular lymph nodes",
    keywords: ["contralateral mediastinal", "contralateral hilar", "scalene", "supraclavicular", "n3 node"]
  }
];

// Distant Metastasis (pM) Rules
export const METASTASIS_RULES: MetastasisRule[] = [
  {
    stage: "pM0",
    criteria: "No distant metastasis",
    keywords: ["no distant metastasis", "m0", "no metastasis"]
  },
  {
    stage: "pM1a",
    criteria: "Separate tumor nodule in contralateral lobe, pleural or pericardial nodules, or malignant pleural/pericardial effusion",
    keywords: ["contralateral lobe nodule", "pleural effusion", "pericardial effusion", "malignant effusion", "pleural nodule", "pericardial nodule", "pleural metastasis"]
  },
  {
    stage: "pM1b",
    criteria: "Single extrathoracic metastasis in a single organ",
    keywords: ["single extrathoracic metastasis", "single distant metastasis", "single organ metastasis", "m1b"]
  },
  {
    stage: "pM1c",
    criteria: "Multiple extrathoracic metastases in one or more organs",
    keywords: ["multiple extrathoracic metastases", "multiple distant metastases", "widespread metastases", "m1c"]
  }
];

// AJCC 8th Edition Stage Grouping
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
  
  // Stage IIB
  { group: "Stage IIB", t: ["T1a", "T1b", "T1c", "T2a", "T2b"], n: ["N1"], m: ["M0"] },
  { group: "Stage IIB", t: ["T3"], n: ["N0"], m: ["M0"] },
  
  // Stage IIIA
  { group: "Stage IIIA", t: ["T1a", "T1b", "T1c", "T2a", "T2b"], n: ["N2"], m: ["M0"] },
  { group: "Stage IIIA", t: ["T3"], n: ["N1"], m: ["M0"] },
  { group: "Stage IIIA", t: ["T4"], n: ["N0", "N1"], m: ["M0"] },
  
  // Stage IIIB
  { group: "Stage IIIB", t: ["T1a", "T1b", "T1c", "T2a", "T2b"], n: ["N3"], m: ["M0"] },
  { group: "Stage IIIB", t: ["T3", "T4"], n: ["N2"], m: ["M0"] },
  
  // Stage IIIC
  { group: "Stage IIIC", t: ["T3", "T4"], n: ["N3"], m: ["M0"] },
  
  // Stage IV
  { group: "Stage IVA", t: ["any"], n: ["any"], m: ["M1a", "M1b"] },
  { group: "Stage IVB", t: ["any"], n: ["any"], m: ["M1c"] }
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

// Source of Truth JSON for AJCC 8th Edition Lung Cancer Full TNM Staging
export const STAGING_RULES: StagingRulesDatabase = {
  staging_system: "AJCC 8th Edition - Lung Cancer (TNM)",
  source: "AJCC 8th Edition Logic JSON",
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
      criteria: "Tumor size > 3.0 cm and <= 4.0 cm OR any size with visceral pleural invasion (PL1/PL2)",
      min_size_cm: 3.0,
      max_size_cm: 4.0,
      overrides: ["visceral pleural invasion", "PL1", "PL2"],
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
      criteria: "Tumor size > 5.0 cm and <= 7.0 cm OR direct invasion of chest wall, phrenic nerve, or parietal pericardium",
      min_size_cm: 5.0,
      max_size_cm: 7.0,
      overrides: ["chest wall", "phrenic nerve", "parietal pericardium"],
      priority: 4
    },
    {
      stage: "pT4",
      criteria: "Tumor size > 7.0 cm OR invasion of diaphragm, heart, great vessels, trachea, or carina",
      min_size_cm: 7.0,
      overrides: ["diaphragm", "heart", "great vessels", "trachea", "carina"],
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

// Get size-based staging rule
export function getSizeBasedStage(size_cm: number): StagingRule | undefined {
  // Filter to only size-based rules (priority 10) and find matching
  const sizeRules = STAGING_RULES.rules.filter(rule => 
    rule.priority === 10 || (!rule.overrides && rule.max_size_cm !== undefined)
  );
  
  for (const rule of sizeRules) {
    const minSize = rule.min_size_cm ?? 0;
    const maxSize = rule.max_size_cm ?? Infinity;
    
    if (size_cm > minSize && size_cm <= maxSize) {
      return rule;
    }
    // Handle edge case for pT1a (≤1.0)
    if (rule.stage === 'pT1a' && size_cm <= maxSize) {
      return rule;
    }
  }
  
  // If larger than all defined ranges, return pT4
  if (size_cm > 7.0) {
    return STAGING_RULES.rules.find(r => r.stage === 'pT4');
  }
  
  return undefined;
}

// Get pN stage based on findings
export function getNodeStage(text: string): { stage: string; criteria: string } | null {
  const normalizedText = text.toLowerCase();
  
  // Check from highest stage (N3) to lowest (N0) for proper priority
  for (const rule of [...NODE_RULES].reverse()) {
    for (const keyword of rule.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return { stage: rule.stage, criteria: rule.criteria };
      }
    }
  }
  
  return null;
}

// Get pM stage based on findings
export function getMetastasisStage(text: string): { stage: string; criteria: string } | null {
  const normalizedText = text.toLowerCase();
  
  // Check from highest stage (M1c) to lowest for proper priority
  for (const rule of [...METASTASIS_RULES].reverse()) {
    for (const keyword of rule.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return { stage: rule.stage, criteria: rule.criteria };
      }
    }
  }
  
  return null;
}

// Get AJCC stage group based on T, N, M
export function getStageGroup(tStage: string, nStage: string, mStage: string): string {
  // Normalize stages (remove 'p' prefix for matching)
  const normalizedT = tStage.replace(/^p/i, '').toUpperCase();
  const normalizedN = nStage.replace(/^p/i, '').toUpperCase();
  const normalizedM = mStage.replace(/^p/i, '').toUpperCase();
  
  // Check for M1 first (Stage IV takes precedence)
  if (normalizedM.startsWith('M1')) {
    if (normalizedM === 'M1C') {
      return 'Stage IVB';
    }
    return 'Stage IVA';
  }
  
  // Find matching stage group
  for (const group of STAGE_GROUPS) {
    const tMatch = group.t.includes('any') || group.t.some(t => normalizedT.includes(t.toUpperCase()));
    const nMatch = group.n.includes('any') || group.n.some(n => normalizedN === n.toUpperCase());
    const mMatch = group.m.includes('any') || group.m.some(m => normalizedM === m.toUpperCase());
    
    if (tMatch && nMatch && mMatch) {
      return group.group;
    }
  }
  
  return 'Unable to determine';
}

// Get ICD-10 code based on tumor site
export function getICD10Code(text: string): ICD10Code {
  const normalizedText = text.toLowerCase();
  
  // Check each code's keywords
  for (const code of ICD10_CODES) {
    // Skip unspecified - it's the fallback
    if (code.code === 'C34.9') continue;
    
    for (const keyword of code.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return code;
      }
    }
  }
  
  // Return unspecified as fallback
  return ICD10_CODES.find(c => c.code === 'C34.9')!;
}

// 5-Year Survival Data by Pathologic Stage (AJCC 8th Edition)
export const SURVIVAL_DATA: SurvivalData[] = [
  { stage: "Stage IA1", five_year_survival: "90%" },
  { stage: "Stage IA2", five_year_survival: "85%" },
  { stage: "Stage IA3", five_year_survival: "80%" },
  { stage: "Stage IB", five_year_survival: "73%" },
  { stage: "Stage IIA", five_year_survival: "65%" },
  { stage: "Stage IIB", five_year_survival: "56%" },
  { stage: "Stage IIIA", five_year_survival: "41%" },
  { stage: "Stage IIIB", five_year_survival: "24%" },
  { stage: "Stage IIIC", five_year_survival: "12%" },
  { stage: "Stage IVA", five_year_survival: "10%" },
  { stage: "Stage IVB", five_year_survival: "< 1%" }
];

// Get 5-year survival rate for a stage group
export function getSurvivalData(stageGroup: string): SurvivalData | null {
  return SURVIVAL_DATA.find(s => s.stage === stageGroup) || null;
}

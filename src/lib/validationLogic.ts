// AJCC 8th Edition Lung Cancer pT Staging Validation Engine
// Uses STAGING_RULES as the Source of Truth

import { 
  STAGING_RULES, 
  getStagingSource, 
  getRulesWithOverrides, 
  getSizeBasedStage,
  matchesOverride,
  type StagingRule 
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
  };
  // Golden Rule: Atelectasis/Pneumonitis
  atelectasis: {
    has_total_lung_atelectasis: boolean;
    has_total_lung_pneumonitis: boolean;
  };
}

export interface ValidationResult {
  applicability: 'applicable' | 'not_applicable' | 'indeterminate' | 'outside_scope';
  t_category: string | null;
  basis?: string;
  size_basis_cm?: number | null;
  reason: string;
}

export interface ParsedReport {
  inputs: ValidationInputs;
  extractedText: {
    histologyFindings: string[];
    measurementFindings: string[];
    stageFindings: string[];
  };
  reportedStage: string | null;
}

// Parse the pathology report text to extract relevant information
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
    },
    atelectasis: {
      has_total_lung_atelectasis: false,
      has_total_lung_pneumonitis: false,
    },
  };

  const extractedText = {
    histologyFindings: [] as string[],
    measurementFindings: [] as string[],
    stageFindings: [] as string[],
  };

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
  const invasiveSizePatterns = [
    /invasive\s*(component|size|focus|portion)[:\s]+(\d+\.?\d*)\s*cm/i,
    /invasive\s*tumor[:\s]+(\d+\.?\d*)\s*cm/i,
    /invasion[:\s]+(\d+\.?\d*)\s*cm/i,
    /(\d+\.?\d*)\s*cm\s+invasive/i,
    /invasive[:\s]+(\d+\.?\d*)\s*cm/i,
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

  // Check for pleural invasion (PL1, PL2, or visceral pleural invasion)
  const pleuralPatterns = [
    /\bpl1\b/i,
    /\bpl2\b/i,
    /\bpl3\b/i,
    /visceral\s*pleural\s*invasion/i,
    /invades?\s*(the\s*)?visceral\s*pleura/i,
    /invasion\s*(of|into)\s*(the\s*)?visceral\s*pleura/i,
    /pleural\s*invasion\s*(present|identified|seen)/i,
  ];

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

  // Check for direct invasion patterns (pT3 criteria)
  const directInvasionPatterns = {
    chest_wall: [
      /invad(es?|ing|ed)\s*(the\s*)?chest\s*wall/i,
      /chest\s*wall\s*invasion/i,
      /direct\s*invasion\s*(of|into)\s*(the\s*)?chest\s*wall/i,
      /extends?\s*(into|to)\s*(the\s*)?chest\s*wall/i,
    ],
    phrenic_nerve: [
      /invad(es?|ing|ed)\s*(the\s*)?phrenic\s*nerve/i,
      /phrenic\s*nerve\s*invasion/i,
      /phrenic\s*nerve\s*involvement/i,
    ],
    pericardium: [
      /invad(es?|ing|ed)\s*(the\s*)?pericardium/i,
      /pericardial\s*invasion/i,
      /direct\s*invasion\s*(of|into)\s*(the\s*)?pericardium/i,
      /extends?\s*(into|to)\s*(the\s*)?pericardium/i,
    ],
    main_bronchus: [
      /invad(es?|ing|ed)\s*(the\s*)?main\s*bronchus/i,
      /main\s*bronchus\s*invasion/i,
      /main\s*bronchus\s*involvement/i,
    ],
    diaphragm: [
      /invad(es?|ing|ed)\s*(the\s*)?diaphragm/i,
      /diaphragm(atic)?\s*invasion/i,
      /extends?\s*(into|to)\s*(the\s*)?diaphragm/i,
    ],
  };

  for (const [key, patterns] of Object.entries(directInvasionPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        inputs.direct_invasion[key as keyof typeof inputs.direct_invasion] = true;
        const displayName = key.replace(/_/g, ' ');
        extractedText.histologyFindings.push(`Direct invasion: ${displayName}`);
        break;
      }
    }
  }

  // GOLDEN RULE: Detect total lung atelectasis/pneumonitis
  const atelectasisPatterns = [
    /total\s*(lung\s*)?(atelectasis|collapse)/i,
    /complete\s*(lung\s*)?(atelectasis|collapse)/i,
    /entire\s*lung\s*(atelectasis|collapse)/i,
    /atelectasis\s*(of\s*)?(the\s*)?entire\s*lung/i,
    /collapse\s*(of\s*)?(the\s*)?entire\s*lung/i,
    /whole\s*lung\s*(atelectasis|collapse)/i,
  ];
  
  const pneumonitisPatterns = [
    /total\s*(lung\s*)?pneumonitis/i,
    /complete\s*(lung\s*)?pneumonitis/i,
    /entire\s*lung\s*pneumonitis/i,
    /pneumonitis\s*(of\s*)?(the\s*)?entire\s*lung/i,
    /obstructive\s*pneumonitis\s*(of\s*)?(the\s*)?(entire|whole)\s*lung/i,
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
      extractedText.stageFindings.push(`Reported stage: ${reportedStage}`);
      break;
    }
  }

  return { inputs, extractedText, reportedStage };
}

// Run the decision tree validation
export function runValidation(inputs: ValidationInputs): ValidationResult {
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

  // STEP 1: Check for special histology types (pTis, pT1mi)
  if (inputs.histology.is_AIS) {
    return {
      applicability: 'not_applicable',
      t_category: 'pTis(AIS)',
      reason: `${getStagingSource()}: Adenocarcinoma in situ is staged as pTis(AIS).`,
    };
  }

  if (inputs.histology.is_MIA) {
    return {
      applicability: 'not_applicable',
      t_category: 'pT1mi',
      reason: `${getStagingSource()}: Minimally invasive adenocarcinoma is staged as pT1mi.`,
    };
  }

  // GOLDEN RULE #3: Atelectasis/Pneumonitis
  // Total lung collapse automatically upgrades to pT2
  if (inputs.atelectasis.has_total_lung_atelectasis || inputs.atelectasis.has_total_lung_pneumonitis) {
    const condition = inputs.atelectasis.has_total_lung_atelectasis ? 'total lung atelectasis' : 'total lung pneumonitis';
    return {
      applicability: 'applicable',
      t_category: 'pT2',
      basis: 'golden_rule',
      reason: `⚠️ GOLDEN RULE: ${condition} detected. Per AJCC 8th Edition, a tumor of any size causing collapse of the entire lung is automatically staged as pT2.`,
    };
  }

  // STEP 2: Check OVERRIDE rules in priority order (before size-based staging)
  // GOLDEN RULE #1: The Invasion Trump Card - visceral pleural invasion (PL1/PL2) → pT2a
  // This ensures findings like visceral pleural invasion take precedence
  for (const rule of overrideRules) {
    if (rule.overrides) {
      for (const finding of findings) {
        if (matchesOverride(finding, rule.overrides)) {
          // Build descriptive reason
          const matchedOverride = rule.overrides.find(o => 
            finding.toLowerCase().includes(o.toLowerCase()) || 
            o.toLowerCase().includes(finding.toLowerCase())
          );
          
          return {
            applicability: 'applicable',
            t_category: rule.stage,
            basis: 'override',
            reason: `${getStagingSource()}: ${finding.toUpperCase()} is present. Per staging criteria: "${rule.criteria}". This overrides tumor size-based staging.`,
          };
        }
      }
    }
  }

  // STEP 3: Check superficial spreading override (special case)
  if (
    inputs.superficial_spreading.is_superficial_spreading_tumor &&
    inputs.superficial_spreading.invasive_component_limited_to_bronchial_wall
  ) {
    return {
      applicability: 'applicable',
      t_category: 'pT1a',
      basis: 'override',
      reason: `${getStagingSource()}: Superficial spreading tumor with invasive component limited to bronchial wall is classified as pT1a regardless of overall size.`,
    };
  }

  // STEP 4: Validate size basis is present for size-based staging
  if (size_basis_cm === null) {
    return {
      applicability: 'indeterminate',
      t_category: null,
      reason: 'No tumor size measurements could be extracted from the report. Please ensure the report includes size information (e.g., "0.8 cm tumor" or "tumor size: 1.2 cm").',
    };
  }

  // STEP 5: Size-based staging using rules database
  const sizeRule = getSizeBasedStage(size_basis_cm);
  
  if (sizeRule) {
    return {
      applicability: 'applicable',
      t_category: sizeRule.stage,
      basis: 'size_basis_cm',
      size_basis_cm: size_basis_cm,
      reason: `${getStagingSource()}: ${sizeRule.criteria}. Measured size: ${size_basis_cm} cm.`,
    };
  }

  // Fallback - should not reach here given the logic above
  return {
    applicability: 'outside_scope',
    t_category: null,
    basis: 'size_basis_cm',
    size_basis_cm: size_basis_cm,
    reason: 'Unable to determine pT category from the available information.',
  };
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
  inputs: ValidationInputs
): {
  isMatch: boolean;
  isAutoCalculated: boolean;
  message: string;
  details: string;
  isPleuralInvasionMismatch?: boolean;
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
    return {
      isMatch: false,
      isAutoCalculated: false,
      message: 'INCONSISTENT: Pleural invasion requires pT2a',
      details: `RED FLAG: Visceral pleural invasion (${inputs.pleural_invasion.pl_status}) is documented in the report, but the reported stage is ${reportedStage}. Per AJCC 8th edition staging criteria, any tumor with visceral pleural invasion (PL1 or PL2) must be classified as pT2a or higher, regardless of tumor size. The correct stage should be pT2a.`,
      isPleuralInvasionMismatch: true,
    };
  }

  if (normalizedReported === normalizedCalculated) {
    return {
      isMatch: true,
      isAutoCalculated: false,
      message: 'Stage matches',
      details: `Reported ${reportedStage} matches calculated ${calculatedResult.t_category}. ${calculatedResult.reason}`,
    };
  }

  return {
    isMatch: false,
    isAutoCalculated: false,
    message: 'Stage mismatch',
    details: `Reported ${reportedStage} does not match calculated ${calculatedResult.t_category}. ${calculatedResult.reason}`,
  };
}

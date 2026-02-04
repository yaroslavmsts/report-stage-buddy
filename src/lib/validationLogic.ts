// CAP Lung 4.0.0.2 AJCC8 pT1a vs pT1b Decision Tree Implementation

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

  // Extract measurements - greatest dimension
  const greatestDimPatterns = [
    /greatest\s*dimension[:\s]+(\d+\.?\d*)\s*cm/i,
    /tumor\s*size[:\s]+(\d+\.?\d*)\s*cm/i,
    /measuring\s+(\d+\.?\d*)\s*cm/i,
    /(\d+\.?\d*)\s*cm\s*(in\s*)?greatest\s*dimension/i,
    /(\d+\.?\d*)\s*x\s*\d+\.?\d*\s*x\s*\d+\.?\d*\s*cm/i, // Takes first dimension from AxBxC
  ];

  for (const pattern of greatestDimPatterns) {
    const match = text.match(pattern);
    if (match) {
      inputs.measurements_cm.greatest_dimension_cm = parseFloat(match[1]);
      inputs.measurements_cm.total_tumor_size_cm = parseFloat(match[1]);
      extractedText.measurementFindings.push(`Greatest dimension: ${match[1]} cm`);
      break;
    }
  }

  // Extract invasive size
  const invasiveSizePatterns = [
    /invasive\s*(component|size|focus)[:\s]+(\d+\.?\d*)\s*cm/i,
    /invasive\s*tumor[:\s]+(\d+\.?\d*)\s*cm/i,
    /invasion[:\s]+(\d+\.?\d*)\s*cm/i,
  ];

  for (const pattern of invasiveSizePatterns) {
    const match = text.match(pattern);
    if (match) {
      const size = parseFloat(match[2] || match[1]);
      inputs.measurements_cm.invasive_size_cm = size;
      extractedText.measurementFindings.push(`Invasive size: ${size} cm`);
      break;
    }
  }

  // Extract percent invasive
  const percentPatterns = [
    /(\d+)\s*%\s*invasive/i,
    /invasive[:\s]+(\d+)\s*%/i,
    /percent\s*invasive[:\s]+(\d+)/i,
  ];

  for (const pattern of percentPatterns) {
    const match = text.match(pattern);
    if (match) {
      inputs.measurements_cm.percent_invasive_0_to_100 = parseInt(match[1]);
      extractedText.measurementFindings.push(`Percent invasive: ${match[1]}%`);
      break;
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

  // Extract reported stage from the report
  let reportedStage: string | null = null;
  const stagePatterns = [
    /pathologic\s*stage[:\s]*(pt\d+[a-z]*)/i,
    /pt\s*stage[:\s]*(pt\d+[a-z]*)/i,
    /(pt1a|pt1b|pt1c|pt1mi|ptis)/i,
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

  let size_basis_cm: number | null = null;
  if (inputs.histology.is_invasive_nonmucinous_adenocarcinoma_with_lepidic_component) {
    size_basis_cm = inputs.measurements_cm.invasive_size_cm ?? estimated_invasive_size_cm;
  } else {
    size_basis_cm = inputs.measurements_cm.greatest_dimension_cm;
  }

  // Decision tree traversal
  // Check AIS
  if (inputs.histology.is_AIS) {
    return {
      applicability: 'not_applicable',
      t_category: 'pTis(AIS)',
      reason: 'Adenocarcinoma in situ is staged as pTis(AIS), not pT1a/pT1b.',
    };
  }

  // Check MIA
  if (inputs.histology.is_MIA) {
    return {
      applicability: 'not_applicable',
      t_category: 'pT1mi',
      reason: 'Minimally invasive adenocarcinoma is staged as pT1mi, not pT1a/pT1b.',
    };
  }

  // Check superficial spreading override
  if (
    inputs.superficial_spreading.is_superficial_spreading_tumor &&
    inputs.superficial_spreading.invasive_component_limited_to_bronchial_wall
  ) {
    return {
      applicability: 'applicable',
      t_category: 'pT1a',
      basis: 'override',
      reason:
        'Superficial spreading tumor with invasive component limited to bronchial wall is classified as pT1a regardless of overall size.',
    };
  }

  // Validate size basis present
  if (size_basis_cm === null) {
    return {
      applicability: 'indeterminate',
      t_category: null,
      reason:
        'Cannot determine pT1a vs pT1b because required size basis is missing (need greatest dimension OR invasive size/estimate if lepidic-component rule applies).',
    };
  }

  // Check T1a size
  if (size_basis_cm <= 1.0) {
    return {
      applicability: 'applicable',
      t_category: 'pT1a',
      basis: 'size_basis_cm',
      size_basis_cm: size_basis_cm,
      reason: 'Size basis ≤ 1.0 cm.',
    };
  }

  // Check T1b size
  if (size_basis_cm > 1.0 && size_basis_cm <= 2.0) {
    return {
      applicability: 'applicable',
      t_category: 'pT1b',
      basis: 'size_basis_cm',
      size_basis_cm: size_basis_cm,
      reason: 'Size basis > 1.0 cm and ≤ 2.0 cm.',
    };
  }

  // Outside scope
  return {
    applicability: 'outside_scope',
    t_category: null,
    basis: 'size_basis_cm',
    size_basis_cm: size_basis_cm,
    reason:
      'Size basis falls outside pT1a (≤1.0 cm) and pT1b (>1.0–2.0 cm). Evaluate other pT categories (e.g., pT1c or higher).',
  };
}

// Compare reported stage with calculated stage
export function compareStages(
  reportedStage: string | null,
  calculatedResult: ValidationResult
): {
  isMatch: boolean;
  message: string;
  details: string;
} {
  if (!reportedStage) {
    return {
      isMatch: false,
      message: 'No stage found in report',
      details: 'Could not extract a pT stage from the pathology report text.',
    };
  }

  if (calculatedResult.t_category === null) {
    return {
      isMatch: false,
      message: 'Cannot validate',
      details: calculatedResult.reason,
    };
  }

  const normalizedReported = reportedStage.toUpperCase().replace(/\s/g, '');
  const normalizedCalculated = calculatedResult.t_category.toUpperCase().replace(/\s/g, '');

  if (normalizedReported === normalizedCalculated) {
    return {
      isMatch: true,
      message: 'Stage matches',
      details: `Reported ${reportedStage} matches calculated ${calculatedResult.t_category}. ${calculatedResult.reason}`,
    };
  }

  return {
    isMatch: false,
    message: 'Stage mismatch',
    details: `Reported ${reportedStage} does not match calculated ${calculatedResult.t_category}. ${calculatedResult.reason}`,
  };
}

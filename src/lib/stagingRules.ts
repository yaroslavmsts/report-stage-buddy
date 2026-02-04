// AJCC 8th Edition - Lung Cancer pT Staging Rules
// This is the Source of Truth for all staging calculations

export interface StagingRule {
  stage: string;
  criteria: string;
  min_size_cm?: number;
  max_size_cm?: number;
  overrides?: string[];
  priority?: number; // Lower number = higher priority
}

export interface StagingRulesDatabase {
  staging_system: string;
  source: string;
  rules: StagingRule[];
}

// Source of Truth JSON for AJCC 8th Edition Lung Cancer pT Staging
export const STAGING_RULES: StagingRulesDatabase = {
  staging_system: "AJCC 8th Edition - Lung Cancer (pT)",
  source: "AJCC 8th Edition Logic JSON",
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
  ]
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

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ValidationResult } from '@/components/ValidationResult';
import { parsePathologyReport, runValidation, compareStages, getStagingSource } from '@/lib/validationLogic';
import { STAGING_RULES, GOLDEN_RULES } from '@/lib/stagingRules';
import { Loader2, FileText, Shield, AlertTriangle, Database, Zap, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Sample reports demonstrating each Golden Rule
const SAMPLE_REPORTS = {
  basic: {
    name: "Basic pT1b (Size-based)",
    description: "Standard size-based staging without overrides",
    report: `PATHOLOGY REPORT

DIAGNOSIS: Left upper lobe wedge resection - Invasive adenocarcinoma

TUMOR SIZE: 1.3 cm in greatest dimension

HISTOLOGIC TYPE: Invasive nonmucinous adenocarcinoma with lepidic component (60% lepidic, 40% acinar pattern)

INVASIVE COMPONENT: 0.8 cm

MARGINS: Negative

LYMPH NODES: No lymph node metastasis identified (0/3)

PATHOLOGIC STAGE: pT1b pN0

MICROSCOPIC DESCRIPTION:
Sections show a well-differentiated invasive adenocarcinoma with predominant lepidic growth pattern and a focus of acinar invasion measuring 0.8 cm. No lymphovascular invasion identified.`
  },
  goldenRule1: {
    name: "⚡ Golden Rule #1: Invasion Trump Card",
    description: "Visceral pleural invasion (PL1) overrides size → pT2a",
    report: `PATHOLOGY REPORT

DIAGNOSIS: Right upper lobe lobectomy - Invasive adenocarcinoma

TUMOR SIZE: 0.9 cm in greatest dimension

HISTOLOGIC TYPE: Invasive adenocarcinoma, acinar predominant

VISCERAL PLEURAL INVASION: Present (PL1 - invasion beyond elastic layer)

MARGINS: Negative

LYMPH NODES: Hilar lymph nodes negative for malignancy (0/5)

PATHOLOGIC STAGE: pT1a pN0

MICROSCOPIC DESCRIPTION:
Despite its small size (0.9 cm), the tumor extends to the visceral pleura with breach of the elastic layer, qualifying as PL1 visceral pleural invasion. Per AJCC 8th Edition, this automatically upstages to pT2a regardless of tumor size.

NOTE: This report intentionally shows pT1a to demonstrate the Invasion Trump Card mismatch - the correct stage should be pT2a due to PL1 invasion.`
  },
  goldenRule2: {
    name: "⚡ Golden Rule #2: Total vs Invasive Size",
    description: "Uses invasive size (0.8 cm) instead of total size (2.5 cm)",
    report: `PATHOLOGY REPORT

DIAGNOSIS: Left lower lobe segmentectomy - Invasive adenocarcinoma

TUMOR MEASUREMENTS:
- Total tumor size: 2.5 cm in greatest dimension
- Invasive component size: 0.8 cm

HISTOLOGIC TYPE: Invasive nonmucinous adenocarcinoma with predominant lepidic component (70% lepidic, 30% acinar)

MARGINS: Negative, closest margin 0.5 cm

LYMPH NODES: Level 11 lymph nodes negative (0/2)

PATHOLOGIC STAGE: pT1a pN0

MICROSCOPIC DESCRIPTION:
The tumor is composed predominantly of lepidic growth pattern (70%) with a discrete focus of acinar invasion measuring 0.8 cm. The invasive component is well-demarcated within the larger lepidic area. Per AJCC 8th Edition, the INVASIVE SIZE (0.8 cm) is used for staging in tumors with lepidic component, not the total size (2.5 cm).`
  },
  goldenRule3: {
    name: "⚡ Golden Rule #3: Atelectasis/Pneumonitis",
    description: "Total lung collapse → automatic pT2",
    report: `PATHOLOGY REPORT

DIAGNOSIS: Right pneumonectomy - Invasive squamous cell carcinoma

TUMOR SIZE: 0.7 cm in greatest dimension

HISTOLOGIC TYPE: Invasive squamous cell carcinoma, moderately differentiated

BRONCHIAL INVOLVEMENT: Tumor involves the main bronchus causing complete obstruction

ASSOCIATED FINDINGS: Total right lung atelectasis/collapse secondary to bronchial obstruction

MARGINS: Bronchial margin negative

LYMPH NODES: Subcarinal lymph nodes with metastatic carcinoma (2/4 positive)

PATHOLOGIC STAGE: pT2 pN2

MICROSCOPIC DESCRIPTION:
Despite the small primary tumor size (0.7 cm), there is complete collapse of the right lung (total atelectasis) due to bronchial obstruction. Per AJCC 8th Edition Golden Rule, any tumor causing total lung atelectasis or pneumonitis is automatically staged as pT2 regardless of size.`
  },
  stageIIIA: {
    name: "Stage IIIA Example",
    description: "Large tumor with N2 nodal involvement",
    report: `PATHOLOGY REPORT

DIAGNOSIS: Left upper lobe lobectomy with mediastinal lymph node dissection - Invasive adenocarcinoma

TUMOR SIZE: 4.2 cm in greatest dimension

HISTOLOGIC TYPE: Invasive adenocarcinoma, solid predominant with focal micropapillary features

VISCERAL PLEURAL INVASION: Absent (PL0)

MARGINS: Negative

LYMPH NODES:
- Hilar lymph nodes (Level 10): Negative (0/3)
- Subcarinal lymph nodes (Level 7): Positive for metastatic carcinoma (2/5)
- Ipsilateral mediastinal (Level 5): Positive for metastatic carcinoma (1/2)

PATHOLOGIC STAGE: pT2a pN2

MICROSCOPIC DESCRIPTION:
A 4.2 cm invasive adenocarcinoma with solid predominant pattern and aggressive features including micropapillary component. Metastatic carcinoma identified in ipsilateral mediastinal and subcarinal lymph nodes, consistent with N2 disease. Final stage: Stage IIIA (T2a N2 M0).`
  },
  stageIV: {
    name: "Stage IV Example",
    description: "Malignant pleural effusion → pM1a",
    report: `PATHOLOGY REPORT

DIAGNOSIS: Right lower lobe wedge biopsy with pleural fluid cytology - Invasive adenocarcinoma

TUMOR SIZE: 1.8 cm in greatest dimension

HISTOLOGIC TYPE: Invasive adenocarcinoma, acinar predominant

PLEURAL FLUID CYTOLOGY: POSITIVE for malignant cells consistent with adenocarcinoma

VISCERAL PLEURAL INVASION: Present, with malignant pleural effusion

LYMPH NODES: Hilar lymph node with metastatic carcinoma (1/2 positive)

PATHOLOGIC STAGE: pT2a pN1 pM1a

MICROSCOPIC DESCRIPTION:
The primary tumor measures 1.8 cm with visceral pleural invasion. Pleural fluid cytology demonstrates malignant cells morphologically consistent with primary lung adenocarcinoma. Per AJCC 8th Edition, malignant pleural effusion is classified as M1a, resulting in Stage IVA disease.`
  },
  negationExample: {
    name: "🔍 Negation Handling Example",
    description: "Tests 'intact pleura' → defaults to size-based staging",
    report: `PATHOLOGY REPORT

DIAGNOSIS: Right upper lobe lobectomy - Invasive adenocarcinoma

TUMOR SIZE: 1.5 cm in greatest dimension

HISTOLOGIC TYPE: Invasive adenocarcinoma, acinar predominant

VISCERAL PLEURA: Intact. No visceral pleural invasion identified.

CHEST WALL: Not involved. No invasion of chest wall structures.

PERICARDIUM: Negative for invasion.

MARGINS: All surgical margins are negative for malignancy.

LYMPH NODES: 
- Hilar lymph nodes: Negative for metastatic carcinoma (0/4)
- No mediastinal lymph node sampling performed

PATHOLOGIC STAGE: pT1b pN0

MICROSCOPIC DESCRIPTION:
Sections reveal a 1.5 cm well-differentiated invasive adenocarcinoma with acinar pattern. The tumor is confined to the pulmonary parenchyma. The visceral pleura is intact with no evidence of invasion. Elastic stain confirms intact elastic layer (PL0). The chest wall and pericardium are not invaded. All lymph nodes examined are negative for metastatic disease.

NOTE: This example demonstrates proper negation handling - despite mentions of pleura, chest wall, and pericardium, the negative phrasing ("intact", "no invasion", "negative for") ensures size-based staging is used correctly.`
  },
  conflictExample: {
    name: "⚠️ Conflict Detection Example",
    description: "Demonstrates ambiguous language triggering safety layer",
    report: `PATHOLOGY REPORT

DIAGNOSIS: Left lower lobe lobectomy - Invasive adenocarcinoma

TUMOR SIZE: 2.3 cm in greatest dimension

HISTOLOGIC TYPE: Invasive adenocarcinoma, solid predominant

VISCERAL PLEURA: The visceral pleura shows no definitive invasion but tumor cells are present at the pleural surface.

CHEST WALL: Chest wall invasion is not clearly identified, however tumor abuts the parietal pleura.

PERICARDIUM: Pericardial involvement appears absent but cannot be entirely excluded.

MARGINS: Surgical margins are negative.

LYMPH NODES:
- Hilar lymph nodes: Negative for metastatic carcinoma (0/3)

PATHOLOGIC STAGE: pT2a pN0

MICROSCOPIC DESCRIPTION:
The tumor measures 2.3 cm and demonstrates solid growth pattern. The pleural invasion status is equivocal - elastic stain shows tumor approaching but not definitively crossing the elastic layer. The chest wall appears intact but the proximity of tumor to chest wall raises concern.

NOTE: This example demonstrates CONFLICT DETECTION - sentences contain both invasion keywords AND negation keywords in close proximity, triggering the safety layer for manual verification.`
  }
};

const Index = () => {
  const [reportText, setReportText] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    comparison: { isMatch: boolean; message: string; details: string };
    calculatedResult: ReturnType<typeof runValidation>;
    parsedReport: ReturnType<typeof parsePathologyReport>;
  } | null>(null);

  const handleValidate = async () => {
    if (!reportText.trim()) return;

    setIsValidating(true);
    
    // Simulate a brief processing delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const parsedReport = parsePathologyReport(reportText);
    // Pass hasConflict to runValidation for conservative staging when conflicts detected
    const calculatedResult = runValidation(parsedReport.inputs, parsedReport.rawText, parsedReport.hasConflict);
    const comparison = compareStages(parsedReport.reportedStage, calculatedResult, parsedReport.inputs);

    setValidationResult({
      comparison,
      calculatedResult,
      parsedReport,
    });

    setIsValidating(false);
  };

  const handleLoadSample = (sampleKey: keyof typeof SAMPLE_REPORTS) => {
    setReportText(SAMPLE_REPORTS[sampleKey].report);
    setValidationResult(null);
  };

  const handleClear = () => {
    setReportText('');
    setValidationResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">TNM Staging Validator</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">CAP Lung 4.0.0.2 • AJCC 8th Edition</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          {/* Input Section */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Pathology Report
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Paste the complete pathology report text below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <Textarea
                  placeholder="Paste your pathology report here..."
                  value={reportText}
                  onChange={(e) => {
                    setReportText(e.target.value);
                    setValidationResult(null);
                  }}
                  className="min-h-[250px] sm:min-h-[300px] lg:min-h-[400px] font-mono text-xs sm:text-sm resize-none"
                />
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    onClick={handleValidate}
                    disabled={!reportText.trim() || isValidating}
                    className="w-full sm:w-auto sm:flex-1 lg:flex-none"
                    size="default"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      'Validate Staging'
                    )}
                  </Button>
                  <div className="flex gap-2 sm:gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          size="default"
                        >
                          Load Sample
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-72">
                        <DropdownMenuLabel>Sample Reports</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleLoadSample('basic')}>
                          <div>
                            <p className="font-medium">{SAMPLE_REPORTS.basic.name}</p>
                            <p className="text-xs text-muted-foreground">{SAMPLE_REPORTS.basic.description}</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-destructive">⚡ Golden Rule Examples</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleLoadSample('goldenRule1')}>
                          <div>
                            <p className="font-medium">{SAMPLE_REPORTS.goldenRule1.name}</p>
                            <p className="text-xs text-muted-foreground">{SAMPLE_REPORTS.goldenRule1.description}</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleLoadSample('goldenRule2')}>
                          <div>
                            <p className="font-medium">{SAMPLE_REPORTS.goldenRule2.name}</p>
                            <p className="text-xs text-muted-foreground">{SAMPLE_REPORTS.goldenRule2.description}</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleLoadSample('goldenRule3')}>
                          <div>
                            <p className="font-medium">{SAMPLE_REPORTS.goldenRule3.name}</p>
                            <p className="text-xs text-muted-foreground">{SAMPLE_REPORTS.goldenRule3.description}</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Stage Grouping Examples</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleLoadSample('stageIIIA')}>
                          <div>
                            <p className="font-medium">{SAMPLE_REPORTS.stageIIIA.name}</p>
                            <p className="text-xs text-muted-foreground">{SAMPLE_REPORTS.stageIIIA.description}</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleLoadSample('stageIV')}>
                          <div>
                            <p className="font-medium">{SAMPLE_REPORTS.stageIV.name}</p>
                            <p className="text-xs text-muted-foreground">{SAMPLE_REPORTS.stageIV.description}</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>🔍 Safety Logic Layer</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleLoadSample('negationExample')}>
                          <div>
                            <p className="font-medium">{SAMPLE_REPORTS.negationExample.name}</p>
                            <p className="text-xs text-muted-foreground">{SAMPLE_REPORTS.negationExample.description}</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleLoadSample('conflictExample')}>
                          <div>
                            <p className="font-medium">{SAMPLE_REPORTS.conflictExample.name}</p>
                            <p className="text-xs text-muted-foreground">{SAMPLE_REPORTS.conflictExample.description}</p>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {reportText && (
                      <Button
                        variant="ghost"
                        onClick={handleClear}
                        className="flex-1 sm:flex-none"
                        size="default"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Golden Rules Card - Collapsible on mobile */}
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="pt-4 sm:pt-6">
                <div className="flex gap-2 sm:gap-3">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm min-w-0 flex-1">
                    <p className="font-bold text-destructive mb-2">⚡ Golden Rules</p>
                    <ul className="space-y-2">
                      {GOLDEN_RULES.map((rule) => (
                        <li key={rule.id} className="border-l-2 border-destructive/50 pl-2 sm:pl-3">
                          <p className="font-semibold text-foreground text-xs sm:text-sm">{rule.name}</p>
                          <p className="text-muted-foreground text-[10px] sm:text-xs leading-relaxed">{rule.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card - Hidden on mobile, shown on tablet+ */}
            <Card className="border-primary/20 bg-primary/5 hidden sm:block">
              <CardContent className="pt-4 sm:pt-6">
                <div className="flex gap-2 sm:gap-3">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-muted-foreground min-w-0 flex-1">
                    <p className="font-medium text-foreground mb-1">Validation Scope</p>
                    <p className="mb-2 text-xs sm:text-sm">
                      This tool validates T staging for lung adenocarcinoma according to AJCC 8th Edition criteria:
                    </p>
                    <ul className="space-y-1 text-[10px] sm:text-xs">
                      {STAGING_RULES.rules.map((rule) => (
                        <li key={rule.stage} className="break-words">
                          <strong>{rule.stage}:</strong> {rule.criteria}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-2 border-t border-primary/20 flex items-center gap-2">
                      <Database className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground text-xs sm:text-sm">{getStagingSource()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            {validationResult ? (
              <ValidationResult
                comparison={validationResult.comparison}
                calculatedResult={validationResult.calculatedResult}
                parsedReport={validationResult.parsedReport}
              />
            ) : (
              <Card className="min-h-[200px] sm:min-h-[300px] lg:min-h-[400px] flex items-center justify-center border-dashed">
                <CardContent>
                  <div className="text-center text-muted-foreground px-4">
                    <Shield className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 mx-auto mb-3 sm:mb-4 opacity-30" />
                    <p className="font-medium text-sm sm:text-base">No validation results yet</p>
                    <p className="text-xs sm:text-sm mt-1">
                      Paste a pathology report and tap "Validate Staging"
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Mobile-only: Source footer */}
        <div className="mt-4 text-center text-[10px] text-muted-foreground sm:hidden">
          <Database className="h-3 w-3 inline-block mr-1" />
          {getStagingSource()}
        </div>
      </main>
    </div>
  );
};

export default Index;

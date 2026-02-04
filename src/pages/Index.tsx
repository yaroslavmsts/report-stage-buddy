import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ValidationResult } from '@/components/ValidationResult';
import { parsePathologyReport, runValidation, compareStages, getStagingSource } from '@/lib/validationLogic';
import { STAGING_RULES, GOLDEN_RULES } from '@/lib/stagingRules';
import { Loader2, FileText, Shield, AlertTriangle, Database, Zap } from 'lucide-react';

const SAMPLE_REPORT = `PATHOLOGY REPORT

DIAGNOSIS: Left upper lobe wedge resection - Invasive adenocarcinoma

TUMOR SIZE: 1.3 cm in greatest dimension

HISTOLOGIC TYPE: Invasive nonmucinous adenocarcinoma with lepidic component (60% lepidic, 40% acinar pattern)

INVASIVE COMPONENT: 0.8 cm

MARGINS: Negative

PATHOLOGIC STAGE: pT1b

MICROSCOPIC DESCRIPTION:
Sections show a well-differentiated invasive adenocarcinoma with predominant lepidic growth pattern and a focus of acinar invasion measuring 0.8 cm. No lymphovascular invasion identified.`;

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
    const calculatedResult = runValidation(parsedReport.inputs);
    const comparison = compareStages(parsedReport.reportedStage, calculatedResult, parsedReport.inputs);

    setValidationResult({
      comparison,
      calculatedResult,
      parsedReport,
    });

    setIsValidating(false);
  };

  const handleLoadSample = () => {
    setReportText(SAMPLE_REPORT);
    setValidationResult(null);
  };

  const handleClear = () => {
    setReportText('');
    setValidationResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">TNM Staging Validator</h1>
              <p className="text-sm text-muted-foreground">CAP Lung Protocol 4.0.0.2 • AJCC 8th Edition</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Pathology Report
                </CardTitle>
                <CardDescription>
                  Paste the complete pathology report text below. The validator will extract histology, measurements, and staging information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste your pathology report here..."
                  value={reportText}
                  onChange={(e) => {
                    setReportText(e.target.value);
                    setValidationResult(null);
                  }}
                  className="min-h-[400px] font-mono text-sm resize-none"
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleValidate}
                    disabled={!reportText.trim() || isValidating}
                    className="flex-1 sm:flex-none"
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
                  <Button
                    variant="outline"
                    onClick={handleLoadSample}
                    className="flex-1 sm:flex-none"
                  >
                    Load Sample
                  </Button>
                  {reportText && (
                    <Button
                      variant="ghost"
                      onClick={handleClear}
                      className="flex-1 sm:flex-none"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Golden Rules Card */}
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Zap className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-destructive mb-2">⚡ Golden Rules</p>
                    <ul className="space-y-2">
                      {GOLDEN_RULES.map((rule) => (
                        <li key={rule.id} className="border-l-2 border-destructive/50 pl-3">
                          <p className="font-semibold text-foreground">{rule.name}</p>
                          <p className="text-muted-foreground text-xs">{rule.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Validation Scope</p>
                    <p className="mb-2">
                      This tool validates T staging for lung adenocarcinoma according to AJCC 8th Edition criteria:
                    </p>
                    <ul className="space-y-1 text-xs">
                      {STAGING_RULES.rules.map((rule) => (
                        <li key={rule.stage}>
                          <strong>{rule.stage}:</strong> {rule.criteria}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-2 border-t border-primary/20 flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{getStagingSource()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div>
            {validationResult ? (
              <ValidationResult
                comparison={validationResult.comparison}
                calculatedResult={validationResult.calculatedResult}
                parsedReport={validationResult.parsedReport}
              />
            ) : (
              <Card className="h-full min-h-[400px] flex items-center justify-center border-dashed">
                <CardContent>
                  <div className="text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">No validation results yet</p>
                    <p className="text-sm mt-1">
                      Paste a pathology report and click "Validate Staging" to begin
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

import { FileText, CheckCircle2, Microscope, Ruler, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ParsedReport, ValidationResult as ValidationResultType, ClinicalChecklistData } from '@/lib/validationLogic';

interface PathologySummaryProps {
  parsedReport: ParsedReport;
  calculatedResult: ValidationResultType;
  checklist?: ClinicalChecklistData;
}

/**
 * Extracts confirmed negative findings from the raw report text.
 * Identifies standard negation phrases and displays them as 'Confirmed Negative' (green).
 */
function extractNegativeFindings(parsedReport: ParsedReport): string[] {
  const negatives: string[] = [];
  const text = parsedReport.rawText.toLowerCase();

  // Visceral pleural invasion
  if (
    text.includes('no visceral pleural invasion') ||
    text.includes('pleura intact') ||
    text.includes('visceral pleura intact') ||
    text.includes('visceral pleura: intact') ||
    text.match(/visceral pleural invasion[:\s]*(absent|negative|not identified|not seen)/i) ||
    (text.includes('pl0') && !text.includes('pl1') && !text.includes('pl2') && !text.includes('pl3'))
  ) {
    negatives.push('Visceral Pleural Invasion');
  }

  // Chest wall invasion
  if (
    text.includes('no chest wall invasion') ||
    text.match(/chest wall[^.]{0,30}not (involved|identified|seen)/i) ||
    text.match(/chest wall[:\s]*(negative|absent|not involved)/i)
  ) {
    negatives.push('Chest Wall Invasion');
  }

  // Pericardial invasion
  if (
    text.includes('no pericardial invasion') ||
    text.match(/pericardium[^.]{0,30}(negative|absent|not identified)/i) ||
    text.match(/pericardial[^.]{0,30}(negative|absent)/i)
  ) {
    negatives.push('Pericardial Invasion');
  }

  // Lymphovascular invasion
  if (
    text.includes('no lymphovascular invasion') ||
    text.match(/lymphovascular invasion[^.]{0,30}(not identified|absent|negative|not seen)/i)
  ) {
    negatives.push('Lymphovascular Invasion');
  }

  // Surgical margins
  if (
    text.match(/margins?[^.]{0,30}negative/i) ||
    text.match(/margins?[^.]{0,30}free/i) ||
    text.includes('margins are negative')
  ) {
    negatives.push('Positive Surgical Margins');
  }

  // Lymph node metastasis
  if (
    text.match(/lymph nodes?[^.]{0,40}negative/i) ||
    text.match(/\(0\/\d+\)/) ||
    text.match(/no lymph node metastasis/i) ||
    text.match(/no metastatic carcinoma/i)
  ) {
    negatives.push('Lymph Node Metastasis');
  }

  return negatives;
}

/**
 * Determines the primary metric used for staging.
 */
function getPrimaryMetric(checklist?: ClinicalChecklistData, calculatedResult?: ValidationResultType): string {
  if (!checklist) return 'Not determined';

  const basis = checklist.stagingBasis;

  if (basis.includes('Component') && checklist.measurementSelection.invasiveSize) {
    return `Invasive size: ${checklist.measurementSelection.invasiveSize} cm (per CAP Note A)`;
  }

  if (basis.includes('Anatomical')) {
    const triggeredGate = checklist.gateExecutions?.find(g => g.stoppedHere);
    return triggeredGate?.detail?.replace(/→.*/, '').trim() || 'Anatomical override';
  }

  if (basis.includes('Laterality')) {
    return checklist.lateralityCheck.detail || 'Laterality override';
  }

  // Default: size-based
  if (calculatedResult?.size_basis_cm != null) {
    return `Greatest dimension: ${calculatedResult.size_basis_cm.toFixed(1)} cm`;
  }

  return checklist.measurementSelection.usedSize
    ? `Tumor size: ${checklist.measurementSelection.usedSize} cm`
    : 'Size-based staging';
}

export function PathologySummary({ parsedReport, calculatedResult, checklist }: PathologySummaryProps) {
  const histologyValue = checklist?.histologyVerification.value
    || parsedReport.extractedText.histologyFindings[0]
    || 'Not specified';

  const primaryMetric = getPrimaryMetric(checklist, calculatedResult);
  const negativeFindings = extractNegativeFindings(parsedReport);

  return (
    <Card className="border-2 border-primary/30 bg-card">
      <CardHeader className="pb-2 sm:pb-3 border-b border-border">
        <CardTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Pathology Validation Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Histology */}
        <div className="flex items-start gap-3">
          <Microscope className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Histology
            </p>
            <p className="text-sm sm:text-base font-medium text-foreground mt-0.5">
              {histologyValue}
            </p>
          </div>
        </div>

        {/* Primary Metric */}
        <div className="flex items-start gap-3">
          <Ruler className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Primary Metric
            </p>
            <p className="text-sm sm:text-base font-medium text-foreground mt-0.5">
              {primaryMetric}
            </p>
          </div>
        </div>

        {/* Negative Findings */}
        {negativeFindings.length > 0 && (
          <div className="flex items-start gap-3">
            <Shield className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Negative Findings
              </p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {negativeFindings.map((finding, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 border border-success/20 text-xs font-medium text-success"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {finding}: Confirmed Negative
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

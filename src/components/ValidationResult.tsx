import { CheckCircle, XCircle, AlertCircle, Info, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ValidationResult as ValidationResultType, ParsedReport } from '@/lib/validationLogic';

interface ValidationResultProps {
  comparison: {
    isMatch: boolean;
    isAutoCalculated?: boolean;
    message: string;
    details: string;
  };
  calculatedResult: ValidationResultType;
  parsedReport: ParsedReport;
}

export function ValidationResult({ comparison, calculatedResult, parsedReport }: ValidationResultProps) {
  const isPass = comparison.isMatch && !comparison.isAutoCalculated;
  const isAutoCalculated = comparison.isAutoCalculated && comparison.isMatch;
  const isIndeterminate = calculatedResult.applicability === 'indeterminate' && !comparison.isAutoCalculated;
  const isInsufficientData = comparison.isAutoCalculated && !comparison.isMatch;
  const isOutsideScope = calculatedResult.applicability === 'outside_scope';

  const getStatusConfig = () => {
    if (isAutoCalculated) {
      return {
        icon: Lightbulb,
        bgClass: 'bg-primary/10 border-primary/30',
        iconClass: 'text-primary',
        textClass: 'text-primary',
        label: 'AUTO-CALCULATED',
        pulseClass: '',
      };
    }
    if (isPass) {
      return {
        icon: CheckCircle,
        bgClass: 'bg-success/10 border-success/30',
        iconClass: 'text-success',
        textClass: 'text-success',
        label: 'VALID',
        pulseClass: 'animate-pulse-success',
      };
    }
    if (isIndeterminate || isInsufficientData) {
      return {
        icon: AlertCircle,
        bgClass: 'bg-warning/10 border-warning/30',
        iconClass: 'text-warning',
        textClass: 'text-warning',
        label: isInsufficientData ? 'INSUFFICIENT DATA' : 'INDETERMINATE',
        pulseClass: '',
      };
    }
    return {
      icon: XCircle,
      bgClass: 'bg-destructive/10 border-destructive/30',
      iconClass: 'text-destructive',
      textClass: 'text-destructive',
      label: 'MISMATCH',
      pulseClass: 'animate-pulse-error',
    };
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  // Determine display labels based on auto-calculate mode
  const calculatedStageLabel = isAutoCalculated ? 'Suggested Stage' : 'Calculated Stage';
  const hasCalculatedStage = calculatedResult.t_category !== null;

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card className={`border-2 ${config.bgClass} ${config.pulseClass}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${config.bgClass}`}>
              <StatusIcon className={`h-10 w-10 ${config.iconClass}`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-2xl font-bold ${config.textClass}`}>
                {config.label}
              </h3>
              <p className="text-muted-foreground mt-1">
                {comparison.message}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Validation Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">Reported Stage</p>
              <p className="text-xl font-semibold">
                {parsedReport.reportedStage || (
                  <span className="text-muted-foreground italic">Not found in report</span>
                )}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${isAutoCalculated ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
              <p className="text-sm font-medium text-muted-foreground mb-1">{calculatedStageLabel}</p>
              <p className={`text-xl font-semibold ${isAutoCalculated ? 'text-primary' : ''}`}>
                {hasCalculatedStage ? calculatedResult.t_category : (
                  <span className="text-muted-foreground italic">Cannot determine</span>
                )}
              </p>
            </div>
          </div>

          {/* Always show reasoning if we have any findings or a calculated result */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Reasoning</p>
            <p className="text-foreground">
              {comparison.details || calculatedResult.reason}
            </p>
          </div>

          {calculatedResult.size_basis_cm !== undefined && calculatedResult.size_basis_cm !== null && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Size Basis Used</p>
              <p className="text-foreground font-medium">{calculatedResult.size_basis_cm.toFixed(2)} cm</p>
            </div>
          )}

          {calculatedResult.basis && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Basis for Staging</p>
              <p className="text-foreground font-medium capitalize">
                {calculatedResult.basis === 'size_basis_cm' ? 'Tumor Size' : 
                 calculatedResult.basis === 'pleural_invasion' ? 'Pleural Invasion' :
                 calculatedResult.basis === 'override' ? 'Superficial Spreading Override' :
                 calculatedResult.basis}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Findings Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Extracted Findings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {parsedReport.extractedText.histologyFindings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Histology</p>
                <ul className="space-y-1">
                  {parsedReport.extractedText.histologyFindings.map((finding, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.measurementFindings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Measurements</p>
                <ul className="space-y-1">
                  {parsedReport.extractedText.measurementFindings.map((finding, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.stageFindings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Staging</p>
                <ul className="space-y-1">
                  {parsedReport.extractedText.stageFindings.map((finding, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.histologyFindings.length === 0 &&
              parsedReport.extractedText.measurementFindings.length === 0 &&
              parsedReport.extractedText.stageFindings.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No specific findings were extracted from the report. Please ensure the report contains standard pathology terminology.
                </p>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

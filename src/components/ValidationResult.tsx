import { CheckCircle, XCircle, AlertCircle, Info, Lightbulb, Activity, DollarSign, Heart, FileText, AlertTriangle, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ValidationResult as ValidationResultType, ParsedReport, ConflictInfo } from '@/lib/validationLogic';

interface ValidationResultProps {
  comparison: {
    isMatch: boolean;
    isAutoCalculated?: boolean;
    message: string;
    details: string;
    clinicalNote?: string;
    isLepidicMismatch?: boolean;
  };
  calculatedResult: ValidationResultType;
  parsedReport: ParsedReport;
}

export function ValidationResult({ comparison, calculatedResult, parsedReport }: ValidationResultProps) {
  const hasConflict = parsedReport.hasConflict;
  const isPass = comparison.isMatch && !comparison.isAutoCalculated && !hasConflict;
  const isAutoCalculated = comparison.isAutoCalculated && comparison.isMatch && !hasConflict;
  const isIndeterminate = calculatedResult.applicability === 'indeterminate' && !comparison.isAutoCalculated;
  const isInsufficientData = comparison.isAutoCalculated && !comparison.isMatch;

  const getStatusConfig = () => {
    // CONFLICT DETECTED takes highest priority
    if (hasConflict) {
      return {
        icon: AlertTriangle,
        bgClass: 'bg-amber-500/10 border-amber-500/50',
        iconClass: 'text-amber-500',
        textClass: 'text-amber-600 dark:text-amber-400',
        label: 'CONFLICT DETECTED',
        pulseClass: 'animate-pulse',
      };
    }
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

  // Get survival percentage as number for progress bar
  const getSurvivalPercentage = (): number => {
    if (!calculatedResult.survival) return 0;
    const match = calculatedResult.survival.five_year_survival.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const survivalPercentage = getSurvivalPercentage();

  // Get survival color based on percentage
  const getSurvivalColor = (percentage: number): string => {
    if (percentage >= 70) return 'text-success';
    if (percentage >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getSurvivalBgColor = (percentage: number): string => {
    if (percentage >= 70) return 'bg-success';
    if (percentage >= 40) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main Status Card */}
      <Card className={`border-2 ${config.bgClass} ${config.pulseClass}`}>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`p-2 sm:p-3 rounded-full ${config.bgClass} flex-shrink-0`}>
              <StatusIcon className={`h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 ${config.iconClass}`} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`text-lg sm:text-xl lg:text-2xl font-bold ${config.textClass} truncate`}>
                {config.label}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">
                {hasConflict 
                  ? 'Linguistic conflict detected. Using conservative size-based staging only.'
                  : comparison.message}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conflict Detection Alert */}
      {hasConflict && parsedReport.conflicts.length > 0 && (
        <Alert className="border-2 border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-2">
            Linguistic Conflict Detected
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-amber-500/70 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs p-3">
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-foreground">Conflict Detection vs Negation Handling</p>
                    <div className="space-y-1.5">
                      <p><span className="font-medium text-success">✓ Negation Handling:</span> Recognizes clear negative statements like "No invasion" or "Pleura intact" and correctly excludes invasion from staging.</p>
                      <p><span className="font-medium text-amber-500">⚠ Conflict Detection:</span> Flags ambiguous sentences where invasion AND negation keywords appear within 10 words, suggesting contradictory or equivocal language that requires manual review.</p>
                    </div>
                    <p className="text-muted-foreground italic">Example conflict: "No definitive invasion but tumor cells present at pleural surface"</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm text-foreground">
              The report contains contradictory terms regarding invasion status. Please verify manually.
            </p>
            
            {/* Highlighted conflicting sentences */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Conflicting Sentences Found:
              </p>
              {parsedReport.conflicts.map((conflict, index) => (
                <div 
                  key={index}
                  className="p-2 sm:p-3 rounded-md bg-amber-500/20 border border-amber-500/30"
                >
                  <p className="text-xs sm:text-sm font-mono text-foreground leading-relaxed">
                    "{conflict.sentence}"
                  </p>
                  <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Found: <span className="font-semibold">"{conflict.invasionKeyword}"</span> + <span className="font-semibold">"{conflict.negationKeyword}"</span> within 10-word proximity
                  </p>
                </div>
              ))}
            </div>

            {/* Conservative staging disclaimer */}
            <div className="p-2 rounded bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-amber-600 dark:text-amber-400">⚠️ Conservative Staging Applied:</span> Due to the detected conflict, invasion-based staging overrides have been disabled. The calculated stage is based on tumor size only. Invasion status could not be safely determined.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* AJCC Prognostic Group Card - Main staging focus */}
      {calculatedResult.stage_group && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">AJCC Prognostic Group</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">{calculatedResult.stage_group}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart Value-Adds: Billing & Prognostic Sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Prognostic Outlook Card */}
        {calculatedResult.survival && (
          <Card className="border border-success/30 bg-success/5">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                Prognostic Outlook
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">5-Year Pathologic Survival</p>
                <p className={`text-2xl sm:text-3xl font-bold ${getSurvivalColor(survivalPercentage)}`}>
                  {calculatedResult.survival.five_year_survival}
                </p>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2 sm:h-2.5">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getSurvivalBgColor(survivalPercentage)}`}
                  style={{ width: `${survivalPercentage}%` }}
                />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Based on {calculatedResult.stage_group} pathologic staging
              </p>
            </CardContent>
          </Card>
        )}

        {/* Billing & Coding Card */}
        {calculatedResult.icd10 && (
          <Card className="border border-info/30 bg-info/5">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
                Billing & Coding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">ICD-10-CM Code</p>
                <p className="text-2xl sm:text-3xl font-bold text-info">{calculatedResult.icd10.code}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-medium text-foreground">{calculatedResult.icd10.site}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{calculatedResult.icd10.description}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* TNM Summary Card */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            TNM Staging Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          {/* TNM Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className={`p-2 sm:p-4 rounded-lg ${isAutoCalculated ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-0.5 sm:mb-1 text-center">pT (Tumor)</p>
              <p className={`text-lg sm:text-xl lg:text-2xl font-bold text-center ${isAutoCalculated ? 'text-primary' : ''}`}>
                {hasCalculatedStage ? calculatedResult.t_category : 'N/A'}
              </p>
            </div>
            <div className="p-2 sm:p-4 bg-muted rounded-lg">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-0.5 sm:mb-1 text-center">pN (Nodes)</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-center">
                {calculatedResult.n_category || 'N/A'}
              </p>
            </div>
            <div className="p-2 sm:p-4 bg-muted rounded-lg">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-0.5 sm:mb-1 text-center">pM (Metastasis)</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-center">
                {calculatedResult.m_category || 'N/A'}
              </p>
            </div>
          </div>

          {/* Reported vs Calculated comparison */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 border-t pt-3 sm:pt-4">
            <div className="p-2 sm:p-4 bg-muted rounded-lg">
              <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">Reported pT Stage</p>
              <p className="text-base sm:text-lg lg:text-xl font-semibold truncate">
                {parsedReport.reportedStage || (
                  <span className="text-muted-foreground italic text-xs sm:text-sm">Not found</span>
                )}
              </p>
            </div>
            <div className={`p-2 sm:p-4 rounded-lg ${isAutoCalculated ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
              <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">{calculatedStageLabel}</p>
              <p className={`text-base sm:text-lg lg:text-xl font-semibold truncate ${isAutoCalculated ? 'text-primary' : ''}`}>
                {hasCalculatedStage ? calculatedResult.t_category : (
                  <span className="text-muted-foreground italic text-xs sm:text-sm">N/A</span>
                )}
              </p>
            </div>
          </div>

          {/* Reasoning - Always show */}
          <div className="border-t pt-3 sm:pt-4">
            <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Reasoning</p>
            <div className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
              {comparison.details || calculatedResult.reason}
            </div>
          </div>

          {/* Clinical Note - Show for lepidic mismatch cases */}
          {comparison.clinicalNote && (
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-info/10 border border-info/30 rounded-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <Info className="h-4 w-4 sm:h-5 sm:w-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-info uppercase tracking-wide mb-1">
                    Clinical Note
                  </p>
                  <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                    {comparison.clinicalNote}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Size & Basis - Compact layout */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {calculatedResult.size_basis_cm !== undefined && calculatedResult.size_basis_cm !== null && (
              <div className="border-t pt-3 sm:pt-4">
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">Size Basis</p>
                <p className="text-sm sm:text-base text-foreground font-medium">{calculatedResult.size_basis_cm.toFixed(2)} cm</p>
              </div>
            )}

            {calculatedResult.basis && (
              <div className="border-t pt-3 sm:pt-4">
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">Staging Basis</p>
                <p className="text-sm sm:text-base text-foreground font-medium capitalize truncate">
                  {calculatedResult.basis === 'size_basis_cm' ? 'Tumor Size' : 
                   calculatedResult.basis === 'pleural_invasion' ? 'Pleural Invasion' :
                   calculatedResult.basis === 'override' ? 'Override Rule' :
                   calculatedResult.basis === 'golden_rule' ? 'Golden Rule' :
                   calculatedResult.basis}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extracted Findings Card */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            Extracted Findings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {parsedReport.extractedText.histologyFindings.length > 0 && (
              <div>
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Histology</p>
                <ul className="space-y-0.5 sm:space-y-1">
                  {parsedReport.extractedText.histologyFindings.map((finding, i) => (
                    <li key={i} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span className="break-words">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.measurementFindings.length > 0 && (
              <div>
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Measurements</p>
                <ul className="space-y-0.5 sm:space-y-1">
                  {parsedReport.extractedText.measurementFindings.map((finding, i) => (
                    <li key={i} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span className="break-words">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.stageFindings.length > 0 && (
              <div>
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Staging</p>
                <ul className="space-y-0.5 sm:space-y-1">
                  {parsedReport.extractedText.stageFindings.map((finding, i) => (
                    <li key={i} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span className="break-words">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.lymphNodeFindings.length > 0 && (
              <div>
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Lymph Node Status</p>
                <ul className="space-y-0.5 sm:space-y-1">
                  {parsedReport.extractedText.lymphNodeFindings.map((finding, i) => (
                    <li key={i} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span className="break-words">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.metastasisFindings.length > 0 && (
              <div>
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Metastasis Status</p>
                <ul className="space-y-0.5 sm:space-y-1">
                  {parsedReport.extractedText.metastasisFindings.map((finding, i) => (
                    <li key={i} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span className="break-words">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.siteFindings.length > 0 && (
              <div>
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Tumor Site</p>
                <ul className="space-y-0.5 sm:space-y-1">
                  {parsedReport.extractedText.siteFindings.map((finding, i) => (
                    <li key={i} className="text-xs sm:text-sm flex items-start gap-1.5 sm:gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span className="break-words">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedReport.extractedText.histologyFindings.length === 0 &&
              parsedReport.extractedText.measurementFindings.length === 0 &&
              parsedReport.extractedText.stageFindings.length === 0 &&
              parsedReport.extractedText.lymphNodeFindings.length === 0 &&
              parsedReport.extractedText.metastasisFindings.length === 0 && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  No specific findings were extracted from the report.
                </p>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Source Attribution Footer */}
      <div className="text-center pt-2 pb-1">
        <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 leading-relaxed">
          Survival data and ICD-10 codes sourced from AJCC 8th Edition and PathologyOutlines.com.
          <br />
          For clinical reference only. Individual outcomes may vary.
        </p>
      </div>
    </div>
  );
}

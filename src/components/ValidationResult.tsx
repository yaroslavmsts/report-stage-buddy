
import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, Lightbulb, Activity, Heart, FileText, AlertTriangle, HelpCircle, MapPin, Scissors, UserCheck, Code2, Search, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ValidationResult as ValidationResultType, ParsedReport, ConflictInfo, NodalStationAlert, MarginAlert, SubmissionAlert, IpsilateralLobeInfo, ClinicalChecklistData, GateExecution, TriggerEvidence, ClinicalFact, ConfidenceResult } from '@/lib/validationLogic';
import { Badge } from '@/components/ui/badge';
import { ClinicalChecklist, ChecklistItem } from '@/components/ClinicalChecklist';
import { PathologySummary } from '@/components/PathologySummary';
import { ClinicalReasoning } from '@/components/ClinicalReasoning';

// Helper function to build checklist items from clinical checklist data
function buildChecklistItems(checklist: ClinicalChecklistData): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  
  items.push({
    label: 'Histology Verification',
    status: checklist.histologyVerification.isAdenocarcinoma ? 'passed' : 'not_applicable',
    value: checklist.histologyVerification.value,
  });
  
  const measurementStatus = checklist.measurementSelection.status === 'invasive_used' 
    ? 'triggered' 
    : (checklist.measurementSelection.status === 'size_used' ? 'passed' : 'not_applicable');
  
  items.push({
    label: 'Measurement Selection',
    status: measurementStatus,
    value: checklist.measurementSelection.status === 'invasive_used'
      ? `Invasive Size (${checklist.measurementSelection.invasiveSize} cm) prioritized`
      : checklist.measurementSelection.status === 'size_used'
        ? `Greatest Dimension: ${checklist.measurementSelection.usedSize} cm`
        : 'No measurement available',
    detail: checklist.measurementSelection.status === 'invasive_used' && checklist.measurementSelection.totalSize
      ? `Total Size (${checklist.measurementSelection.totalSize} cm) discarded per CAP Note A`
      : undefined,
  });
  
  const anatomicalFindings = Object.entries(checklist.anatomicalScan.findings)
    .filter(([_, value]) => value !== 'N/A')
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ');
  
  const positiveAnatomical = Object.values(checklist.anatomicalScan.findings)
    .some(v => v === 'Positive' || (typeof v === 'string' && v.startsWith('Positive')));
  
  items.push({
    label: 'Anatomical Scan',
    status: positiveAnatomical ? 'triggered' : 'negative',
    value: positiveAnatomical 
      ? checklist.anatomicalScan.triggeredOverride || 'Override triggered'
      : 'No anatomical overrides',
    detail: anatomicalFindings.substring(0, 80) + (anatomicalFindings.length > 80 ? '...' : ''),
  });
  
  const lateralityStatus = checklist.lateralityCheck.status;
  let lateralityValue = 'Unifocal';
  let lateralityStatusType: ChecklistItem['status'] = 'negative';
  
  if (lateralityStatus === 'contralateral') {
    lateralityValue = 'Contralateral nodule → pM1a';
    lateralityStatusType = 'triggered';
  } else if (lateralityStatus === 'ipsilateral_different_lobe') {
    lateralityValue = 'Different ipsilateral lobe → pT4';
    lateralityStatusType = 'triggered';
  } else if (lateralityStatus === 'same_lobe') {
    lateralityValue = 'Same lobe nodule → pT3';
    lateralityStatusType = 'triggered';
  }
  
  items.push({
    label: 'Laterality Check',
    status: lateralityStatusType,
    value: lateralityValue,
    detail: checklist.lateralityCheck.detail !== 'Unifocal' 
      ? checklist.lateralityCheck.detail 
      : undefined,
  });
  
  return items;
}

/**
 * Derives an ICD-O morphology code from parsed histology.
 */
function getICDOMorphology(parsedReport: ParsedReport): { code: string; descriptor: string } | null {
  const text = parsedReport.rawText.toLowerCase();

  if (text.includes('squamous cell carcinoma')) {
    return { code: 'M8070/3', descriptor: 'Squamous cell carcinoma, NOS' };
  }
  if (text.includes('large cell carcinoma')) {
    return { code: 'M8012/3', descriptor: 'Large cell carcinoma, NOS' };
  }
  if (text.includes('small cell carcinoma')) {
    return { code: 'M8041/3', descriptor: 'Small cell carcinoma, NOS' };
  }
  if (text.includes('carcinoid')) {
    return { code: 'M8240/3', descriptor: 'Carcinoid tumor, NOS' };
  }
  if (text.includes('mucinous adenocarcinoma')) {
    return { code: 'M8480/3', descriptor: 'Mucinous adenocarcinoma' };
  }
  if (text.includes('adenocarcinoma in situ') || /\bais\b/i.test(text)) {
    return { code: 'M8250/2', descriptor: 'Adenocarcinoma in situ, nonmucinous' };
  }
  if (text.includes('minimally invasive adenocarcinoma') || text.includes('mia')) {
    return { code: 'M8256/3', descriptor: 'Minimally invasive adenocarcinoma' };
  }
  if (text.includes('lepidic') && text.includes('adenocarcinoma')) {
    return { code: 'M8250/3', descriptor: 'Lepidic adenocarcinoma' };
  }
  if (text.includes('acinar') && text.includes('adenocarcinoma')) {
    return { code: 'M8551/3', descriptor: 'Acinar adenocarcinoma' };
  }
  if (text.includes('papillary') && text.includes('adenocarcinoma')) {
    return { code: 'M8260/3', descriptor: 'Papillary adenocarcinoma' };
  }
  if (text.includes('micropapillary') && text.includes('adenocarcinoma')) {
    return { code: 'M8265/3', descriptor: 'Micropapillary adenocarcinoma' };
  }
  if (text.includes('solid') && text.includes('adenocarcinoma')) {
    return { code: 'M8230/3', descriptor: 'Solid adenocarcinoma' };
  }
  if (text.includes('adenocarcinoma')) {
    return { code: 'M8140/3', descriptor: 'Adenocarcinoma, NOS' };
  }
  if (text.includes('carcinoma')) {
    return { code: 'M8010/3', descriptor: 'Carcinoma, NOS' };
  }
  return null;
}

function highlightMatch(sentence: string, phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return sentence.replace(regex, '<mark class="bg-warning/40 text-foreground rounded px-0.5">$1</mark>');
}

const GATE_LABELS: Record<string, string> = {
  'GATE 1': 'GATE 1 — Anatomical Override',
  'GATE 2': 'GATE 2 — Component Size',
  'GATE 3': 'GATE 3 — Laterality',
  'GATE 4': 'GATE 4 — Default Size',
};

function WhyThisStagePanel({ evidence }: { evidence: TriggerEvidence[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="border border-muted">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg">
            <Search className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground">Why This Stage?</span>
            <span className="text-xs text-muted-foreground ml-1">({evidence.length} trigger{evidence.length !== 1 ? 's' : ''})</span>
            <svg
              className={`ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-3">
            {evidence.map((item, index) => (
              <div key={index} className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {GATE_LABELS[item.gate] || item.gate}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">{item.ruleType}</span>
                </div>
                <div
                  className="text-xs sm:text-sm font-mono text-foreground leading-relaxed bg-background p-2 rounded border border-border"
                  dangerouslySetInnerHTML={{ __html: highlightMatch(
                    item.sentence.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
                    item.matchedPhrase
                  )}}
                />
                <p className="text-xs text-muted-foreground italic">{item.explanation}</p>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ConfidencePanel({ confidence, facts }: { confidence: ConfidenceResult; facts: ClinicalFact[] }) {
  const [isOpen, setIsOpen] = useState(false);

  const levelConfig = {
    High: { icon: ShieldCheck, badgeClass: 'bg-success/20 text-success border-success/30', barClass: 'bg-success' },
    Medium: { icon: ShieldQuestion, badgeClass: 'bg-warning/20 text-warning border-warning/30', barClass: 'bg-warning' },
    Low: { icon: ShieldAlert, badgeClass: 'bg-destructive/20 text-destructive border-destructive/30', barClass: 'bg-destructive' },
  };
  const config = levelConfig[confidence.level];
  const LevelIcon = config.icon;

  const missingFacts = facts.filter(f => confidence.missingCritical.includes(f.id));

  return (
    <Card className="border border-muted">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg">
            <LevelIcon className={`h-4 w-4 flex-shrink-0 ${confidence.level === 'High' ? 'text-success' : confidence.level === 'Medium' ? 'text-warning' : 'text-destructive'}`} />
            <span className="text-sm font-semibold text-foreground">Confidence</span>
            <Badge variant="outline" className={`ml-1 text-[10px] ${config.badgeClass}`}>
              {confidence.level} — {confidence.score}/100
            </Badge>
            {confidence.provisional && (
              <Badge variant="outline" className="ml-1 text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                Provisional
              </Badge>
            )}
            <svg
              className={`ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-3">
            {/* Score bar */}
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${config.barClass}`}
                  style={{ width: `${confidence.score}%` }}
                />
              </div>
            </div>

            {confidence.provisional && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-foreground">
                  <span className="font-semibold text-destructive">Provisional</span> — review missing or conflicting items below before finalizing stage.
                </p>
              </div>
            )}

            {/* Missing items checklist */}
            {missingFacts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Missing / Conflicting Items</p>
                {missingFacts.map((fact) => (
                  <div key={fact.id} className="flex items-start gap-2 p-2 rounded bg-muted/50 border border-border">
                    <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${fact.status === 'conflict' ? 'bg-warning' : 'bg-destructive/60'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{fact.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Status: {fact.status} · Affects: {fact.affects.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* What could change notes */}
            {confidence.notes.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">What Could Change the Stage?</p>
                <ul className="space-y-1">
                  {confidence.notes.map((note, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                      <span className="text-warning mt-0.5">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

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
  onOverride?: () => void;
  onUndoOverride?: () => void;
  isOverridden?: boolean;
  overrideTimestamp?: string;
}

export function ValidationResult({ comparison, calculatedResult, parsedReport, onOverride, onUndoOverride, isOverridden, overrideTimestamp }: ValidationResultProps) {
  const hasConflict = parsedReport.hasConflict && !isOverridden;
  const isPass = comparison.isMatch && !comparison.isAutoCalculated && !hasConflict;
  const isAutoCalculated = comparison.isAutoCalculated && comparison.isMatch && !hasConflict;
  const isIndeterminate = calculatedResult.applicability === 'indeterminate' && !comparison.isAutoCalculated;
  const isInsufficientData = comparison.isAutoCalculated && !comparison.isMatch;

  const getStatusConfig = () => {
    if (isOverridden) {
      return { icon: UserCheck, bgClass: 'bg-info/10 border-info/50', iconClass: 'text-info', textClass: 'text-info', label: 'USER VERIFIED', pulseClass: '' };
    }
    if (hasConflict) {
      return { icon: AlertTriangle, bgClass: 'bg-amber-500/10 border-amber-500/50', iconClass: 'text-amber-500', textClass: 'text-amber-600 dark:text-amber-400', label: 'CONFLICT DETECTED', pulseClass: 'animate-pulse' };
    }
    if (isAutoCalculated) {
      return { icon: Lightbulb, bgClass: 'bg-primary/10 border-primary/30', iconClass: 'text-primary', textClass: 'text-primary', label: 'AUTO-CALCULATED', pulseClass: '' };
    }
    if (isPass) {
      return { icon: CheckCircle, bgClass: 'bg-success/10 border-success/30', iconClass: 'text-success', textClass: 'text-success', label: 'VALID', pulseClass: 'animate-pulse-success' };
    }
    if (isIndeterminate || isInsufficientData) {
      return { icon: AlertCircle, bgClass: 'bg-warning/10 border-warning/30', iconClass: 'text-warning', textClass: 'text-warning', label: isInsufficientData ? 'INSUFFICIENT DATA' : 'INDETERMINATE', pulseClass: '' };
    }
    return { icon: XCircle, bgClass: 'bg-destructive/10 border-destructive/30', iconClass: 'text-destructive', textClass: 'text-destructive', label: 'MISMATCH', pulseClass: 'animate-pulse-error' };
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;
  const calculatedStageLabel = isAutoCalculated ? 'Suggested Stage' : 'Calculated Stage';
  const hasCalculatedStage = calculatedResult.t_category !== null;

  const getSurvivalPercentage = (): number => {
    if (!calculatedResult.survival) return 0;
    const match = calculatedResult.survival.five_year_survival.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const survivalPercentage = getSurvivalPercentage();

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

  const icdoMorphology = getICDOMorphology(parsedReport);

  return (
    <div className="space-y-3 sm:space-y-4">

      {/* ============================================================
          SECTION 1: TOP-LEVEL DASHBOARD
          Suggested Stage + AJCC Group side-by-side, then Prognostic + Coding
          ============================================================ */}

      {/* Row 1: Suggested Stage + AJCC Prognostic Group */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Suggested Stage (Large) */}
        <Card className={`border-2 ${config.bgClass} ${config.pulseClass}`}>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 sm:p-3 rounded-full ${config.bgClass} flex-shrink-0`}>
                <StatusIcon className={`h-6 w-6 sm:h-8 sm:w-8 ${config.iconClass}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {calculatedStageLabel}
                </p>
                <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${config.textClass}`}>
                  {hasCalculatedStage ? calculatedResult.t_category : 'N/A'}
                </p>
                <p className={`text-xs sm:text-sm font-semibold mt-1 ${config.textClass}`}>
                  {config.label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AJCC Prognostic Group */}
        <Card className={`border-2 ${calculatedResult.stage_provisional ? 'border-warning/50 bg-warning/5' : 'border-primary/30 bg-primary/5'}`}>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3">
              <Activity className={`h-5 w-5 sm:h-6 sm:w-6 ${calculatedResult.stage_provisional ? 'text-warning' : 'text-primary'}`} />
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">AJCC Prognostic Group</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${calculatedResult.stage_provisional ? 'text-warning' : 'text-primary'}`}>
                    {calculatedResult.stage_group || 'N/A'}
                  </p>
                  {calculatedResult.stage_provisional && (
                    <Badge variant="outline" className="border-warning text-warning text-[10px]">Provisional</Badge>
                  )}
                </div>
                {calculatedResult.stage_provisional_note && (
                  <p className="text-[10px] sm:text-xs text-warning mt-1">{calculatedResult.stage_provisional_note}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Prognostic Outlook + Coding */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Prognostic Outlook */}
        <Card className="border border-success/30 bg-success/5">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
              Prognostic Outlook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {calculatedResult.survival ? (
              <>
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">5-Year Pathologic Survival</p>
                  <p className={`text-2xl sm:text-3xl font-bold ${getSurvivalColor(survivalPercentage)}`}>
                    {calculatedResult.survival.five_year_survival}
                  </p>
                </div>
                <div className="w-full bg-muted rounded-full h-2 sm:h-2.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${getSurvivalBgColor(survivalPercentage)}`}
                    style={{ width: `${survivalPercentage}%` }}
                  />
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Based on {calculatedResult.stage_group} pathologic staging{calculatedResult.stage_provisional ? ' (provisional)' : ''}
                </p>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground italic">Insufficient data for prognosis</p>
            )}
          </CardContent>
        </Card>

        {/* Coding */}
        <Card className="border border-info/30 bg-info/5">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Code2 className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
              Coding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* ICD-10 Topography */}
            {calculatedResult.icd10 && (
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">ICD-10 Topography</p>
                <p className="text-xl sm:text-2xl font-bold text-info">{calculatedResult.icd10.code}</p>
                <p className="text-xs sm:text-sm text-foreground">{calculatedResult.icd10.site}</p>
              </div>
            )}
            {/* ICD-O Morphology */}
            {icdoMorphology && (
              <div className="border-t border-info/20 pt-2">
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">ICD-O Morphology</p>
                <p className="text-xl sm:text-2xl font-bold text-info">{icdoMorphology.code}</p>
                <p className="text-xs sm:text-sm text-foreground">{icdoMorphology.descriptor}</p>
              </div>
            )}
            {!calculatedResult.icd10 && !icdoMorphology && (
              <p className="text-xs sm:text-sm text-muted-foreground italic">No coding data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          SECTION 2: TNM DETAILS
          ============================================================ */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            TNM Details
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

          {/* N2/M1c Subclassification Alerts */}
          {(calculatedResult.n2SubclassAlert || calculatedResult.m1cSubclassAlert) && (
            <div className="space-y-2">
              {calculatedResult.n2SubclassAlert && (
                <div className="p-2 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">{calculatedResult.n2SubclassAlert}</p>
                </div>
              )}
              {calculatedResult.m1cSubclassAlert && (
                <div className="p-2 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">{calculatedResult.m1cSubclassAlert}</p>
                </div>
              )}
            </div>
          )}

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

          {/* Clinical Note */}
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

          {/* Size & Basis */}
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
                   calculatedResult.basis === 'override' ? 'Anatomical Override' :
                   calculatedResult.basis === 'golden_rule' ? 'Clinical Override' :
                   calculatedResult.basis}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      {/* ============================================================
          SECTION 4: CLINICAL REASONING
          ============================================================ */}
      <ClinicalReasoning
        parsedReport={parsedReport}
        calculatedResult={calculatedResult}
        checklist={calculatedResult.clinicalChecklist}
      />

      {/* ============================================================
          SECTION 4.5: WHY THIS STAGE? — Trigger Evidence Panel
          ============================================================ */}
      {parsedReport.triggerEvidence && parsedReport.triggerEvidence.length > 0 && (
        <WhyThisStagePanel evidence={parsedReport.triggerEvidence} />
      )}

      {/* ============================================================
          SECTION 4.6: CONFIDENCE PANEL
          ============================================================ */}
      {calculatedResult.confidence && calculatedResult.clinicalFacts && (
        <ConfidencePanel
          confidence={calculatedResult.confidence}
          facts={calculatedResult.clinicalFacts}
        />
      )}

      {/* ============================================================
          SECTION 5: DETAILED FINDINGS (CHECKLIST)
          ============================================================ */}
      {calculatedResult.clinicalChecklist && (
        <ClinicalChecklist
          items={buildChecklistItems(calculatedResult.clinicalChecklist)}
          clinicalVerdict={calculatedResult.clinicalChecklist.clinicalVerdict}
          stagingBasis={calculatedResult.clinicalChecklist.stagingBasis}
          gateExecutions={calculatedResult.clinicalChecklist.gateExecutions}
        />
      )}

      {/* ============================================================
          SECTION 6: CONDITIONAL ALERTS (BOTTOM)
          ============================================================ */}

      {/* User Verified Banner */}
      {isOverridden && parsedReport.conflicts.length > 0 && (
        <Alert className="border-2 border-info/50 bg-info/10">
          <UserCheck className="h-5 w-5 text-info" />
          <AlertTitle className="text-info font-semibold">
            ✓ User Verified - Manual Override Applied
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm text-foreground">
              The conflict warnings have been reviewed and findings confirmed. Full staging logic has been restored, including invasion-based overrides.
            </p>
            {overrideTimestamp && (
              <p className="text-xs text-muted-foreground">
                Override applied at: {overrideTimestamp}
              </p>
            )}
            <div className="p-2 rounded bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground italic">
                ⚠️ <span className="font-semibold">Note:</span> Manual override applied by user. Safety protocols bypassed for this calculation.
              </p>
            </div>
            
            {onUndoOverride && (
              <div className="pt-2 border-t border-info/30">
                <Button 
                  onClick={onUndoOverride}
                  variant="outline"
                  className="w-full border-amber-500 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Undo Override & Restore Conservative Staging
                </Button>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  This will restore safety protocols and revert to conservative size-based staging.
                </p>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* pT4 Override Alert */}
      {parsedReport.pT4Override?.detected && (
        <Alert className="border-2 border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertTitle className="text-destructive font-semibold">
            ⚠️ Critical Structure Invasion Detected
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm text-foreground mb-2">
              Invasion of the following critical structures was identified, requiring pT4 classification regardless of tumor size:
            </p>
            <div className="flex flex-wrap gap-2">
              {parsedReport.pT4Override.structures.map((structure, index) => (
                <span key={index} className="px-2 py-1 bg-destructive/20 text-destructive rounded text-xs font-medium">
                  {structure}
                </span>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Ipsilateral Lobe Nodule Alert */}
      {parsedReport.ipsilateralLobeInfo?.isDifferentLobesSameLung && (
        <Alert className="border-2 border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertTitle className="text-destructive font-semibold">
            ⚠️ Separate Tumor in Different Ipsilateral Lobe
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p className="text-sm text-foreground">
              A separate tumor nodule in a different lobe of the same lung was identified. Per AJCC 9th Edition, this requires pT4 classification.
            </p>
            <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
              <div className="flex flex-wrap gap-3 text-xs">
                <div>
                  <span className="font-medium text-muted-foreground">Primary Tumor:</span>{' '}
                  <span className="font-semibold text-foreground">{parsedReport.ipsilateralLobeInfo.primaryLobe} ({parsedReport.ipsilateralLobeInfo.primaryLung} Lung)</span>
                </div>
                {parsedReport.ipsilateralLobeInfo.noduleLobe && (
                  <div>
                    <span className="font-medium text-muted-foreground">Separate Nodule:</span>{' '}
                    <span className="font-semibold text-foreground">{parsedReport.ipsilateralLobeInfo.noduleLobe} ({parsedReport.ipsilateralLobeInfo.noduleLung} Lung)</span>
                  </div>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Nodal Station Alerts */}
      {parsedReport.nodalStationAlerts?.length > 0 && (
        <Alert className="border-2 border-info/50 bg-info/10">
          <MapPin className="h-5 w-5 text-info" />
          <AlertTitle className="text-info font-semibold">
            📍 Nodal Station Alert
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            {parsedReport.nodalStationAlerts.map((alert, index) => (
              <div key={index} className="p-2 rounded bg-info/10 border border-info/20">
                <p className="text-xs sm:text-sm text-foreground">{alert.message}</p>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Margin Alert */}
      {parsedReport.marginAlerts?.length > 0 && (
        <Alert className={`border-2 ${parsedReport.marginAlerts.some(a => a.status === 'involved') ? 'border-destructive/70 bg-destructive/15' : 'border-amber-500/50 bg-amber-500/10'}`}>
          <Scissors className={`h-5 w-5 ${parsedReport.marginAlerts.some(a => a.status === 'involved') ? 'text-destructive' : 'text-amber-500'}`} />
          <AlertTitle className={`font-semibold ${parsedReport.marginAlerts.some(a => a.status === 'involved') ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
            🚨 Margin Status Alert
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            {parsedReport.marginAlerts.map((alert, index) => (
              <div key={index} className={`p-2 rounded border ${alert.status === 'involved' ? 'bg-destructive/10 border-destructive/30' : 'bg-amber-500/10 border-amber-500/20'}`}>
                <p className="text-xs sm:text-sm text-foreground font-medium mb-1">
                  Found: "{alert.margin}"
                </p>
                <p className="text-xs text-foreground">{alert.message}</p>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Invasive Size Missing Alert */}
      {parsedReport.invasiveSizeMissing && (
        <Alert className="border-2 border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold">
            ⚠️ Invasive Size Required
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm text-foreground">
              This report describes a <strong>nonmucinous adenocarcinoma with lepidic component</strong>. 
              Per CAP Note A, the <strong>invasive component size</strong> (not total tumor size) must be used for T-staging.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Please ensure the report includes either:
            </p>
            <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside space-y-1">
              <li>Invasive component size (e.g., "invasive component: 0.8 cm")</li>
              <li>Percentage of invasion (e.g., "60% invasive pattern")</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Multiple Primary Tumors Badge */}
      {parsedReport.multiplePrimaryTumors && (
        <Alert className="border-2 border-info/50 bg-info/10">
          <Info className="h-5 w-5 text-info" />
          <AlertTitle className="text-info font-semibold">
            Multiple Primary Tumors Detected - (m) Suffix Applied
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm text-foreground">
              The report indicates multiple primary tumors. Per AJCC standards, the "(m)" suffix has been appended to the T-category (e.g., pT1b(m)).
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Submission Alert */}
      {parsedReport.submissionAlerts?.length > 0 && (
        <Alert className="border-2 border-amber-500/50 bg-amber-500/10">
          <FileText className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold">
            ⚠️ Submission Requirement Alert
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            {parsedReport.submissionAlerts.map((alert, index) => (
              <div key={index} className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs sm:text-sm text-foreground">{alert.message}</p>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

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

      {/* ============================================================
          SECTION 7: CONFLICT DETECTED (VERY BOTTOM)
          ============================================================ */}
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
                      <p><span className="font-medium text-amber-500">⚠ Conflict Detection:</span> Flags ambiguous sentences where invasion AND negation keywords appear within close proximity, suggesting contradictory or equivocal language that requires manual review.</p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm text-foreground">
              The report contains contradictory or ambiguous terms regarding invasion status. Please verify manually.
            </p>
            
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
                    {conflict.conflictType === 'ambiguity' ? (
                      <>⚠️ Ambiguous phrase: <span className="font-semibold">"{conflict.negationKeyword}"</span> suggests uncertainty about {conflict.invasionKeyword}</>
                    ) : (
                      <>Found: <span className="font-semibold">"{conflict.invasionKeyword}"</span> + <span className="font-semibold">"{conflict.negationKeyword}"</span> in close proximity</>
                    )}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-2 rounded bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-amber-600 dark:text-amber-400">⚠️ Conservative Staging Applied:</span> Due to the detected conflict, invasion-based staging overrides have been disabled. The calculated stage is based on tumor size only.
              </p>
            </div>

            {onOverride && (
              <div className="pt-2 border-t border-amber-500/30">
                <Button 
                  onClick={onOverride}
                  variant="outline"
                  className="w-full border-info text-info hover:bg-info/10 hover:text-info"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Confirm Findings & Override
                </Button>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Clicking this will accept the findings as reviewed and re-enable full staging logic including invasion overrides.
                </p>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Source Attribution Footer */}
      <div className="text-center pt-2 pb-1">
        <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 leading-relaxed">
          Survival data and ICD-10 codes sourced from AJCC 9th Edition / IASLC Staging Manual 9th Edition, 2024.
          <br />
          For clinical reference only. Individual outcomes may vary.
        </p>
      </div>
    </div>
  );
}

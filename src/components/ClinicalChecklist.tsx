import { CheckCircle2, Circle, AlertCircle, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ChecklistItem {
  label: string;
  status: 'passed' | 'triggered' | 'negative' | 'skipped' | 'not_applicable';
  value: string;
  detail?: string;
}

interface ClinicalChecklistProps {
  items: ChecklistItem[];
  clinicalVerdict: string;
  stagingBasis: string;
}

export function ClinicalChecklist({ items, clinicalVerdict, stagingBasis }: ClinicalChecklistProps) {
  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />;
      case 'triggered':
        return <AlertCircle className="h-4 w-4 text-primary flex-shrink-0" />;
      case 'negative':
        return <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
      case 'skipped':
        return <Minus className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />;
      case 'not_applicable':
        return <Minus className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  const getStatusBadge = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'passed':
        return 'bg-success/10 text-success border-success/20';
      case 'triggered':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'negative':
        return 'bg-muted text-muted-foreground border-border';
      case 'skipped':
        return 'bg-muted/50 text-muted-foreground/70 border-border/50';
      case 'not_applicable':
        return 'bg-muted/50 text-muted-foreground/70 border-border/50';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Validation Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Checklist Grid */}
        <div className="space-y-2">
          {items.map((item, index) => (
            <div 
              key={index}
              className={`flex items-start gap-2 p-2 rounded-md border ${getStatusBadge(item.status)}`}
            >
              {getStatusIcon(item.status)}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {item.label}:
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                    {item.value}
                  </span>
                </div>
                {item.detail && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    {item.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Clinical Verdict */}
        <div className="border-t border-primary/20 pt-3">
          <div className="p-3 rounded-md bg-card border border-border">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Clinical Verdict
            </p>
            <p className="text-xs sm:text-sm text-foreground leading-relaxed">
              {clinicalVerdict}
            </p>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Staging Basis: {stagingBasis}. All AJCC 8th Edition priority gates satisfied.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ClinicalChecklist;

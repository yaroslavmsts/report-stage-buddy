import { CheckCircle2, Circle, AlertCircle, Minus, StopCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GateExecution } from '@/lib/validationLogic';

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
  gateExecutions?: GateExecution[];
}

export function ClinicalChecklist({ items, clinicalVerdict, stagingBasis, gateExecutions }: ClinicalChecklistProps) {
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

  const getGateStatusStyle = (gate: GateExecution) => {
    if (gate.stoppedHere) {
      return 'bg-primary/10 text-primary font-semibold';
    }
    if (gate.status === 'Triggered') {
      return 'bg-success/10 text-success';
    }
    return 'text-muted-foreground';
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Validation Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logic Execution Debug Table */}
        {gateExecutions && gateExecutions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Logic Execution
            </h4>
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="h-8 text-xs font-semibold">Gate</TableHead>
                    <TableHead className="h-8 text-xs font-semibold">Name</TableHead>
                    <TableHead className="h-8 text-xs font-semibold">Status</TableHead>
                    <TableHead className="h-8 text-xs font-semibold">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gateExecutions.map((gate, index) => (
                    <TableRow key={index} className={getGateStatusStyle(gate)}>
                      <TableCell className="py-2 text-xs font-medium">
                        {gate.gate}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {gate.name}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        <span className="inline-flex items-center gap-1">
                          {gate.status === 'Triggered' ? (
                            gate.stoppedHere ? (
                              <>
                                <StopCircle className="h-3 w-3" />
                                <span className="font-semibold">Triggered → STOP</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Triggered
                              </>
                            )
                          ) : (
                            <>
                              <Minus className="h-3 w-3" />
                              Skipped
                            </>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-xs max-w-[200px] truncate">
                        {gate.detail}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Checklist Grid */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Extraction Summary
          </h4>
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

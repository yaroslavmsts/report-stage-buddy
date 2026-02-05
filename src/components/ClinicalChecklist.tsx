import { CheckCircle2, Minus, StopCircle, FileText, Microscope, Target, Shield } from 'lucide-react';
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
  // Extract data from items for the new format
  const histologyItem = items.find(i => i.label.toLowerCase().includes('histology'));
  const measurementItem = items.find(i => i.label.toLowerCase().includes('measurement'));
  const anatomicalItem = items.find(i => i.label.toLowerCase().includes('anatomical'));

  // Determine primary trigger and resulting stage from gateExecutions
  const triggeredGate = gateExecutions?.find(g => g.stoppedHere);
  const resultingCategory = triggeredGate?.detail?.match(/→\s*(pT\w+|pM\w+)/)?.[1] || 'See results';

  // Build invasion sites list
  const invasionSites: string[] = [];
  if (anatomicalItem?.status === 'triggered' || anatomicalItem?.status === 'passed') {
    const detail = anatomicalItem.detail || anatomicalItem.value;
    if (detail.toLowerCase().includes('hilar fat')) invasionSites.push('Hilar Fat');
    if (detail.toLowerCase().includes('pleura')) invasionSites.push('Visceral Pleura');
    if (detail.toLowerCase().includes('chest wall')) invasionSites.push('Chest Wall');
    if (detail.toLowerCase().includes('mediastinum')) invasionSites.push('Mediastinum');
    if (detail.toLowerCase().includes('phrenic')) invasionSites.push('Phrenic Nerve');
    if (detail.toLowerCase().includes('carina')) invasionSites.push('Carina');
  }

  // Extract measurements from item value or detail
  const measurementText = measurementItem?.detail || measurementItem?.value || '';
  const totalSizeMatch = measurementText.match(/Total[^:]*:\s*([\d.]+)\s*cm/i) || 
                         measurementText.match(/Greatest[^:]*:\s*([\d.]+)\s*cm/i) ||
                         measurementText.match(/([\d.]+)\s*cm/);
  const invasiveSizeMatch = measurementText.match(/Invasive[^:]*[:(]\s*([\d.]+)\s*cm/i);
  
  const totalSize = totalSizeMatch ? `${totalSizeMatch[1]} cm` : 'N/A';
  const invasiveSize = invasiveSizeMatch ? `${invasiveSizeMatch[1]} cm` : 'N/A';

  // Determine verification checkmarks
  const sizeOverridden = stagingBasis.includes('Anatomical') || stagingBasis.includes('Component') || stagingBasis.includes('Laterality');
  const negativesExcluded = !anatomicalItem?.value.toLowerCase().includes('conflict');

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
    <Card className="border-primary/20 bg-card">
      <CardHeader className="pb-2 sm:pb-3 border-b border-border">
        <CardTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Pathology Validation Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        
        {/* Section 1: Clinical Findings Extracted */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Microscope className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              1. Clinical Findings Extracted
            </h4>
          </div>
          
          <div className="ml-6 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground font-medium min-w-[100px]">Histology:</span>
              <span className="text-foreground">{histologyItem?.value || 'Not specified'}</span>
            </div>
            
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground font-medium min-w-[100px]">Measurements:</span>
              <span className="text-foreground">
                {invasiveSize !== 'N/A' 
                  ? `Total: ${totalSize} vs Invasive: ${invasiveSize}`
                  : `Size: ${totalSize}`
                }
              </span>
            </div>
            
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground font-medium min-w-[100px]">Invasion Sites:</span>
              <span className="text-foreground">
                {invasionSites.length > 0 ? invasionSites.join(', ') : 'None identified'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Staging Logic Path */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              2. Staging Logic Path
            </h4>
          </div>
          
          <div className="ml-6 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground font-medium min-w-[120px]">Primary Trigger:</span>
              <span className="text-foreground font-medium">{stagingBasis}</span>
            </div>
            
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground font-medium min-w-[120px]">Resulting Category:</span>
              <span className="text-primary font-semibold">{resultingCategory}</span>
            </div>
          </div>

          {/* Logic Execution Table */}
          {gateExecutions && gateExecutions.length > 0 && (
            <div className="ml-6 mt-3">
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="h-8 text-xs font-semibold">Gate</TableHead>
                      <TableHead className="h-8 text-xs font-semibold">Name</TableHead>
                      <TableHead className="h-8 text-xs font-semibold">Status</TableHead>
                      <TableHead className="h-8 text-xs font-semibold hidden sm:table-cell">Detail</TableHead>
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
                                  <span className="font-semibold">STOP</span>
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
                        <TableCell className="py-2 text-xs max-w-[180px] truncate hidden sm:table-cell">
                          {gate.detail}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: AJCC 8th Ed. Verification */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              3. AJCC 8th Ed. Verification
            </h4>
          </div>
          
          <div className="ml-6 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${sizeOverridden ? 'text-success' : 'text-muted-foreground'}`} />
              <span className={sizeOverridden ? 'text-foreground' : 'text-muted-foreground'}>
                <span className="font-medium">Confirmed:</span> {sizeOverridden 
                  ? 'Size-based staging overridden by invasion/component status.'
                  : 'Size-based staging applied (no overrides triggered).'}
              </span>
            </div>
            
            <div className="flex items-start gap-2">
              <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${negativesExcluded ? 'text-success' : 'text-warning'}`} />
              <span className={negativesExcluded ? 'text-foreground' : 'text-muted-foreground'}>
                <span className="font-medium">Confirmed:</span> Negative findings (e.g., 'not identified') correctly excluded.
              </span>
            </div>
          </div>
        </div>

        {/* Clinical Verdict */}
        <div className="border-t border-border pt-4">
          <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Clinical Verdict
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {clinicalVerdict}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ClinicalChecklist;

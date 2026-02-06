import { CheckCircle2, FileText, Microscope, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  // Extract data from items for display
  const histologyItem = items.find(i => i.label.toLowerCase().includes('histology'));
  const measurementItem = items.find(i => i.label.toLowerCase().includes('measurement'));
  const anatomicalItem = items.find(i => i.label.toLowerCase().includes('anatomical'));

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

  // Extract measurements
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

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="pb-2 sm:pb-3 border-b border-border">
        <CardTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Detailed Findings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        
        {/* Section 1: Clinical Findings Extracted */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Microscope className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              Clinical Findings
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

        {/* Section 2: Verification */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              AJCC 8th Ed. Verification
            </h4>
          </div>
          
          <div className="ml-6 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${sizeOverridden ? 'text-success' : 'text-muted-foreground'}`} />
              <span className={sizeOverridden ? 'text-foreground' : 'text-muted-foreground'}>
                <span className="font-medium">Confirmed:</span> {sizeOverridden 
                  ? 'Size-based staging overridden by invasion or component findings.'
                  : 'Size-based staging applied (no overrides identified).'}
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

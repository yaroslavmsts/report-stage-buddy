import { Stethoscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ParsedReport, ValidationResult as ValidationResultType, ClinicalChecklistData } from '@/lib/validationLogic';

interface ClinicalReasoningProps {
  parsedReport: ParsedReport;
  calculatedResult: ValidationResultType;
  checklist?: ClinicalChecklistData;
}

/**
 * Generates 2-3 clear, clinical-grade reasoning sentences
 * written as if a pathologist is explaining their thoughts in a finalized report.
 * No gate/machine terminology — natural pathologist voice only.
 */
function generateClinicalReasoning(
  parsedReport: ParsedReport,
  calculatedResult: ValidationResultType,
  checklist?: ClinicalChecklistData
): string[] {
  const sentences: string[] = [];
  const tCat = calculatedResult.t_category || 'pTx';

  // --- Sentence 1: Metric Selection / pT Justification ---
  if (checklist) {
    const basis = checklist.stagingBasis;

    if (basis.includes('Component') && checklist.measurementSelection.invasiveSize) {
      const totalSize = checklist.measurementSelection.totalSize;
      if (totalSize) {
        sentences.push(
          `Based on the ${checklist.measurementSelection.invasiveSize} cm invasive component, this case is staged as ${tCat} despite the larger ${totalSize} cm total tumor size.`
        );
      } else {
        sentences.push(
          `Based on the ${checklist.measurementSelection.invasiveSize} cm invasive component, this case is staged as ${tCat}.`
        );
      }
    } else if (basis.includes('Anatomical')) {
      const triggeredGate = checklist.gateExecutions?.find(g => g.stoppedHere);
      const rawDetail = triggeredGate?.detail || '';
      // Extract the anatomical site name without gate/arrow notation
      const site = rawDetail.replace(/→.*/, '').replace(/Gate\s*\d+/gi, '').trim();
      if (site) {
        sentences.push(
          `The tumor demonstrates direct invasion of ${site.toLowerCase()}, which requires classification as ${tCat} regardless of tumor size.`
        );
      } else {
        sentences.push(
          `An anatomical finding requires classification as ${tCat}, overriding standard size-based staging.`
        );
      }
    } else if (basis.includes('Laterality')) {
      const lateralDetail = checklist.lateralityCheck.detail || '';
      if (calculatedResult.m_category === 'pM1a') {
        sentences.push(
          `A tumor nodule was identified in the contralateral lung, classifying this case as pM1a.`
        );
      } else if (lateralDetail.toLowerCase().includes('different') && lateralDetail.toLowerCase().includes('lobe')) {
        sentences.push(
          `A separate tumor nodule in a different ipsilateral lobe was identified, requiring ${tCat} classification.`
        );
      } else if (lateralDetail.toLowerCase().includes('same lobe')) {
        sentences.push(
          `A satellite nodule within the same lobe was identified, contributing to ${tCat} classification.`
        );
      } else {
        sentences.push(
          `Laterality assessment identified multi-lobe involvement, resulting in ${tCat} classification.`
        );
      }
    } else {
      // Default size-based
      const size = calculatedResult.size_basis_cm;
      sentences.push(
        `The tumor measures ${size != null ? size.toFixed(1) + ' cm' : 'within the reported dimensions'} in greatest dimension, corresponding to ${tCat} by standard size criteria.`
      );
    }
  } else {
    sentences.push(
      `${tCat} was determined based on the available pathology findings.`
    );
  }

  // --- Sentence 2: Exclusion / Verification ---
  const hasAnatomicalOverride = parsedReport.pT4Override?.detected;
  const hasContralateral = parsedReport.ipsilateralLobeInfo?.isContralateralNodule;
  const hasIpsilateral = parsedReport.ipsilateralLobeInfo?.isDifferentLobesSameLung;
  const hasSameLobe = parsedReport.ipsilateralLobeInfo?.isSameLobeNodule;

  if (hasAnatomicalOverride) {
    sentences.push(
      `Critical structure invasion (${parsedReport.pT4Override.structures.join(', ')}) was confirmed on review of the submitted sections.`
    );
  } else if (hasContralateral) {
    sentences.push(
      `The contralateral nodule was morphologically consistent with the primary tumor, supporting metastatic classification.`
    );
  } else if (hasIpsilateral || hasSameLobe) {
    sentences.push(
      `No additional anatomical overrides or distant metastatic involvement were identified in the provided sections.`
    );
  } else {
    sentences.push(
      `No anatomical overrides or nodal involvements were identified in the provided sections.`
    );
  }

  // --- Sentence 3: Final Consensus ---
  if (calculatedResult.stage_group) {
    const nodalLabel = calculatedResult.n_category
      ? `${calculatedResult.n_category === 'pN0' ? 'negative' : 'positive'} nodal status`
      : 'negative nodal status';

    sentences.push(
      `The overall findings are consistent with a Stage ${calculatedResult.stage_group} classification with ${nodalLabel}.`
    );
  }

  return sentences;
}

export function ClinicalReasoning({ parsedReport, calculatedResult, checklist }: ClinicalReasoningProps) {
  const sentences = generateClinicalReasoning(parsedReport, calculatedResult, checklist);

  if (sentences.length === 0) return null;

  return (
    <Card className="border border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
          <Stethoscope className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Clinical Reasoning
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sentences.map((sentence, i) => (
            <p key={i} className="text-xs sm:text-sm text-foreground leading-relaxed">
              {sentence}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

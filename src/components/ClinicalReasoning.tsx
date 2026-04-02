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
 * written as if a pathologist is recording their final thoughts in a report.
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
          `The staging is driven by the ${checklist.measurementSelection.invasiveSize} cm invasive focus, which takes precedence over the ${totalSize} cm total tumor dimension per AJCC Note A, resulting in ${tCat} classification.`
        );
      } else {
        sentences.push(
          `The ${checklist.measurementSelection.invasiveSize} cm invasive component determines the staging as ${tCat}.`
        );
      }
    } else if (basis.includes('Anatomical')) {
      // Extract the anatomical structure(s) from pT4Override or gate detail
      const pT4Structures = parsedReport.pT4Override?.structures || [];
      const triggeredExec = checklist.gateExecutions?.find(g => g.stoppedHere);
      const rawDetail = triggeredExec?.detail || '';
      
      // Prefer pT4Override structures (clean names), fall back to gate detail
      let structureName = '';
      if (pT4Structures.length > 0) {
        structureName = pT4Structures.join(' and ').toLowerCase();
      } else {
        // Extract from gate detail, removing arrow notation
        structureName = rawDetail
          .replace(/→.*/, '')
          .replace(/Invasion\s*of:\s*/i, '')
          .replace(/Gate\s*\d+/gi, '')
          .replace(/GATE\s*\d+/gi, '')
          .trim()
          .toLowerCase();
      }
      
      if (structureName) {
        sentences.push(
          `Direct invasion into the ${structureName} was identified, triggering a ${tCat} classification and overriding tumor size. Per AJCC 8th Edition, anatomical invasion takes absolute priority over tumor dimensions.`
        );
      } else {
        sentences.push(
          `Direct anatomical invasion was identified, triggering a ${tCat} classification and overriding standard size-based staging per AJCC 8th Edition.`
        );
      }
    } else if (basis.includes('Laterality')) {
      const lateralDetail = checklist.lateralityCheck.detail || '';
      if (calculatedResult.m_category === 'pM1a') {
        sentences.push(
          `A tumor nodule was identified in the contralateral lung, requiring pM1a classification.`
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
          `Multi-lobe involvement was identified, resulting in ${tCat} classification.`
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

  // --- Sentence 2: Anatomical Exclusion / Verification ---
  const hasAnatomicalOverride = parsedReport.pT4Override?.detected;
  const hasContralateral = parsedReport.ipsilateralLobeInfo?.isContralateralNodule;
  const hasIpsilateral = parsedReport.ipsilateralLobeInfo?.isDifferentLobesSameLung;
  const hasSameLobe = parsedReport.ipsilateralLobeInfo?.isSameLobeNodule;
  const hasConflict = parsedReport.hasConflict;
  const conflicts = parsedReport.conflicts || [];
  const isProvisional = calculatedResult.confidence?.provisional;

  if (hasAnatomicalOverride) {
    const structures = parsedReport.pT4Override.structures.join(', ').toLowerCase();
    sentences.push(
      `Critical structure invasion (${structures}) was confirmed on review of the submitted sections.`
    );
  } else if (hasContralateral) {
    sentences.push(
      `The contralateral nodule was morphologically consistent with the primary tumor, supporting metastatic classification.`
    );
  } else if (hasIpsilateral || hasSameLobe) {
    sentences.push(
      `Central structures and pleural surfaces were evaluated and found to be uninvolved.`
    );
  } else if (hasConflict && conflicts.length > 0) {
    // Uncertain/ambiguous invasion was mentioned but not confirmed
    const structureNames = [...new Set(conflicts.map(c => c.invasionKeyword))];
    const structureLabel = structureNames.join(' / ');
    sentences.push(
      `Possible ${structureLabel} involvement was mentioned, but the wording was uncertain and did not support a confirmed override. Size-based staging was used provisionally.`
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

    if (isProvisional || (hasConflict && conflicts.length > 0)) {
      sentences.push(
        `The overall findings yield a provisional Stage ${calculatedResult.stage_group} classification with ${nodalLabel}. Clinical correlation is recommended to resolve uncertain findings.`
      );
    } else {
      sentences.push(
        `The overall findings confirm a Stage ${calculatedResult.stage_group} classification with ${nodalLabel}.`
      );
    }
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

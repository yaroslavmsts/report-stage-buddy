import { Stethoscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ParsedReport, ValidationResult as ValidationResultType, ClinicalChecklistData } from '@/lib/validationLogic';

interface ClinicalReasoningProps {
  parsedReport: ParsedReport;
  calculatedResult: ValidationResultType;
  checklist?: ClinicalChecklistData;
}

/**
 * Generates exactly 2-3 clinical-grade reasoning sentences:
 * 1. pT selection justification (metric/override)
 * 2. Anatomical verification / exclusion of distant disease
 * 3. Final prognostic group alignment
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
      sentences.push(
        `${tCat} assigned based on a ${checklist.measurementSelection.invasiveSize} cm invasive focus${totalSize ? `, overriding the ${totalSize} cm total adenocarcinoma size` : ''} per AJCC Note A.`
      );
    } else if (basis.includes('Anatomical')) {
      const triggeredGate = checklist.gateExecutions?.find(g => g.stoppedHere);
      const detail = triggeredGate?.detail || 'anatomical structure invasion';
      sentences.push(
        `${tCat} assigned based on anatomical override — ${detail.replace(/→.*/, '').trim()} — which supersedes size-based staging per AJCC 8th Edition.`
      );
    } else if (basis.includes('Laterality')) {
      const lateralDetail = checklist.lateralityCheck.detail || 'multi-lobe involvement';
      sentences.push(
        `${calculatedResult.m_category === 'pM1a' ? 'pM1a' : tCat} assigned based on laterality assessment: ${lateralDetail}.`
      );
    } else {
      // Default size-based
      const size = calculatedResult.size_basis_cm;
      sentences.push(
        `${tCat} assigned based on tumor greatest dimension of ${size != null ? size.toFixed(1) + ' cm' : 'measured size'} using standard AJCC 8th Edition size criteria.`
      );
    }
  } else {
    sentences.push(
      `${tCat} determined by the staging engine based on available pathology data.`
    );
  }

  // --- Sentence 2: Anatomical Verification ---
  const hasAnatomicalOverride = parsedReport.pT4Override?.detected;
  const hasIpsilateral = parsedReport.ipsilateralLobeInfo?.isDifferentLobesSameLung;
  const hasContralateral = parsedReport.ipsilateralLobeInfo?.isContralateralNodule;
  const hasSameLobe = parsedReport.ipsilateralLobeInfo?.isSameLobeNodule;

  if (hasAnatomicalOverride) {
    sentences.push(
      `Anatomical scan identified invasion of critical structures (${parsedReport.pT4Override.structures.join(', ')}), confirming pT4 classification.`
    );
  } else if (hasContralateral) {
    sentences.push(
      `Laterality mapping detected a contralateral lung nodule, classifying distant metastasis as pM1a per AJCC criteria.`
    );
  } else if (hasIpsilateral) {
    sentences.push(
      `Evaluation confirmed a separate tumor nodule in a different ipsilateral lobe (${parsedReport.ipsilateralLobeInfo?.primaryLobe} → ${parsedReport.ipsilateralLobeInfo?.noduleLobe}), mandating pT4 staging.`
    );
  } else if (hasSameLobe) {
    sentences.push(
      `A satellite nodule in the same lobe was identified, contributing to pT3 classification per AJCC 8th Edition.`
    );
  } else {
    sentences.push(
      `Evaluation of anatomical sites confirmed no evidence of hilar fat, visceral pleural, or mediastinal involvement requiring staging override.`
    );
  }

  // --- Sentence 3: Final Consensus ---
  if (calculatedResult.stage_group) {
    const histoLabel = checklist?.histologyVerification.isAdenocarcinoma
      ? 'adenocarcinoma histology'
      : 'tumor histology';
    const nodalLabel = calculatedResult.n_category
      ? `${calculatedResult.n_category} nodal status`
      : 'negative nodal status';

    sentences.push(
      `The integration of ${histoLabel} and ${nodalLabel} results in a definitive ${calculatedResult.stage_group} classification.`
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

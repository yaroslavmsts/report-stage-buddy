// ============================================================
// normalization.ts
// Clinical vocabulary normalization pre-pass for Report Stage Buddy
// AJCC 9th Edition - Lung Cancer TNM Staging
//
// HOW IT WORKS:
// normalizeReportText() runs BEFORE any staging logic.
// It replaces synonyms, abbreviations, and spelling variants
// with canonical terms that the detection engine expects.
//
// SAFE TO ADD: unambiguous anatomical synonyms, known abbreviations
// UNSAFE TO ADD: context-dependent abbreviations (e.g. "Med", "SVC"
//   outside pathology context), broad terms like "neoplasm"
//
// DEBUG: set NORMALIZATION_DEBUG = true to log diffs in development
// ============================================================

const NORMALIZATION_DEBUG = process.env.NODE_ENV === 'development';

// ============================================================
// SECTION 1: CHEST WALL & PARIETAL STRUCTURES (→ pT3)
// ============================================================
const CHEST_WALL_SYNONYMS: [RegExp, string][] = [
  [/\bthoracic wall\b/gi,                        'chest wall'],
  [/\bcostal wall\b/gi,                           'chest wall'],
  [/\brib cage\b/gi,                              'chest wall'],
  [/\bribcage\b/gi,                               'chest wall'],
  // NOTE: intercostal muscle/space NOT normalized — engine has specific intercostal detection patterns
  [/\bsubcutaneous chest tissue\b/gi,             'chest wall'],
  // NOTE: external/internal intercostal NOT normalized — engine has specific patterns
  [/\bchest wall soft tissue\b/gi,                'chest wall'],
  [/\bthoracic soft tissue\b/gi,                  'chest wall'],
  [/\bparietal soft tissue\b/gi,                  'chest wall'],
  // NOTE: rib/ribs NOT normalized — engine has specific rib detection patterns
  [/\bcostal bone\b/gi,                           'chest wall'],
  [/\bcostal cartilage\b/gi,                      'chest wall'],
  [/\bsternum\b/gi,                               'chest wall'],
  [/\bsternal\b/gi,                               'chest wall'],
];

// ============================================================
// SECTION 2: MEDIASTINAL STRUCTURES (→ pT4)
// ============================================================
const MEDIASTINUM_SYNONYMS: [RegExp, string][] = [
  // NOTE: "mediastinal fat" NOT normalized — engine detects it specifically
  [/\bmediastinal soft tissue\b/gi,               'mediastinum'],
  [/\bmediastinal adipose\b/gi,                   'mediastinum'],
  [/\bmediastinal connective tissue\b/gi,         'mediastinum'],
  [/\bmediastinal structures\b/gi,                'mediastinum'],
  [/\bmediastinal contents\b/gi,                  'mediastinum'],
  [/\bmediastinal tissue\b/gi,                    'mediastinum'],
  [/\bparamediastinal\b/gi,                       'mediastinum'],
  [/\bmediastinal extension\b/gi,                 'mediastinum'],
];

// ============================================================
// SECTION 3: PHRENIC NERVE (→ pT3 in AJCC 9th)
// ============================================================
const PHRENIC_NERVE_SYNONYMS: [RegExp, string][] = [
  // NOTE: bare "phrenic" removed — causes double "phrenic nerve nerve" when "phrenic nerve" is in text
  [/\bn\. phrenicus\b/gi,                         'phrenic nerve'],
  [/\bnerve phrenicus\b/gi,                       'phrenic nerve'],
  // NOTE: "phrenic nerve involvement/invasion" already canonical — no normalization needed
];

// ============================================================
// SECTION 4: DIAPHRAGM (→ pT4)
// ============================================================
const DIAPHRAGM_SYNONYMS: [RegExp, string][] = [
  [/\bdiaphragmatic muscle\b/gi,                  'diaphragm'],
  [/\bdiaphragmatic surface\b/gi,                 'diaphragm'],
  [/\bdiaphragmatic dome\b/gi,                    'diaphragm'],
  [/\bdiaphragmatic crus\b/gi,                    'diaphragm'],
  [/\bhemidiaphragm\b/gi,                         'diaphragm'],
  [/\bleft hemidiaphragm\b/gi,                    'diaphragm'],
  [/\bright hemidiaphragm\b/gi,                   'diaphragm'],
  [/\bdiaphragmatic pleura\b/gi,                  'diaphragm'],
];

// ============================================================
// SECTION 5: GREAT VESSELS (→ pT4)
// ============================================================
const GREAT_VESSELS_SYNONYMS: [RegExp, string][] = [
  [/\baorta\b/gi,                                 'great vessels'],
  [/\baortic wall\b/gi,                           'great vessels'],
  [/\baortic adventitia\b/gi,                     'great vessels'],
  [/\bpulmonary artery\b/gi,                      'great vessels'],
  [/\bpulmonary vein\b/gi,                        'great vessels'],
  [/\bpulmonary trunk\b/gi,                       'great vessels'],
  [/\bsuperior vena cava\b/gi,                    'great vessels'],
  [/\bSVC\b/g,                                    'great vessels'],
  [/\binferior vena cava\b/gi,                    'great vessels'],
  [/\bIVC\b/g,                                    'great vessels'],
  [/\bbrachiocephalic vein\b/gi,                  'great vessels'],
  [/\bsubclavian artery\b/gi,                     'great vessels'],
  [/\bsubclavian vein\b/gi,                       'great vessels'],
  [/\bazygos vein\b/gi,                           'great vessels'],
  [/\bhemiazygos vein\b/gi,                       'great vessels'],
  [/\bmain pulmonary artery\b/gi,                 'great vessels'],
  [/\bintrapericardial vessels\b/gi,              'great vessels'],
  [/\bvascular structures\b/gi,                   'great vessels'],
];

// ============================================================
// SECTION 6: HEART & PERICARDIUM
// Specific pericardial layers FIRST (pT3 vs pT4), then cardiac structures (pT4).
// Bare "pericardium" is intentionally NOT normalized — handled as ambiguity alert
// in validationLogic.ts when invasion language is present.
// ============================================================
const HEART_SYNONYMS: [RegExp, string][] = [
  // --- Specific pericardial layers (must come first) ---
  [/\bparietal pericardium\b/gi,                  'parietal pericardium'], // pT3
  [/\bvisceral pericardium\b/gi,                  'heart'],               // pT4
  [/\bepicardium\b/gi,                            'heart'],               // pT4 (visceral layer)
  // --- Pericardial qualifiers → parietal (outer structures) ---
  [/\bpericardial sac\b/gi,                       'parietal pericardium'], // sac = parietal layer → pT3
  [/\bpericardial wall\b/gi,                      'parietal pericardium'], // outer wall = parietal → pT3
  [/\bpericardial tissue\b/gi,                    'parietal pericardium'], // non-specific tissue → pT3
  // --- pericardial fat: REMOVED — extrapericardial, not pT4 ---
  // --- Bare "pericardium" / "pericardial": NOT normalized — ambiguity alert ---
  // --- Cardiac structures (definite pT4) ---
  [/\bmyocardium\b/gi,                            'heart'],
  [/\bcardiac muscle\b/gi,                        'heart'],
  [/\bcardiac wall\b/gi,                          'heart'],
  [/\batrium\b/gi,                                'heart'],
  [/\bventricle\b/gi,                             'heart'],
  [/\bleft atrium\b/gi,                           'heart'],
  [/\bright atrium\b/gi,                          'heart'],
];

// ============================================================
// SECTION 7: TRACHEA & CARINA (→ pT4)
// ============================================================
const TRACHEA_SYNONYMS: [RegExp, string][] = [
  [/\btracheal wall\b/gi,                         'trachea'],
  [/\btracheal mucosa\b/gi,                       'trachea'],
  [/\btracheal lumen\b/gi,                        'trachea'],
  [/\bcarinal involvement\b/gi,                   'carina'],
  [/\bcarinal invasion\b/gi,                      'carina'],
  [/\bcarina involvement\b/gi,                    'carina'],
  [/\bcarinal region\b/gi,                        'carina'],
  // NOTE: "main bronchus <2 cm from carina" is NOT normalized to carina —
  // it is handled as a separate pT2b pattern in the engine
];

// ============================================================
// SECTION 8: ESOPHAGUS (→ pT4)
// ============================================================
const ESOPHAGUS_SYNONYMS: [RegExp, string][] = [
  [/\boesophagus\b/gi,                            'esophagus'],  // British spelling
  [/\boesophageal\b/gi,                           'esophageal'],
  [/\besophageal wall\b/gi,                       'esophagus'],
  [/\besophageal mucosa\b/gi,                     'esophagus'],
  [/\besophageal adventitia\b/gi,                 'esophagus'],
];

// ============================================================
// SECTION 9: VERTEBRAL BODY (→ pT4)
// ============================================================
const VERTEBRAL_SYNONYMS: [RegExp, string][] = [
  [/\bspine\b/gi,                                 'vertebral body'],
  [/\bspinal column\b/gi,                         'vertebral body'],
  [/\bvertebra\b/gi,                              'vertebral body'],
  [/\bvertebrae\b/gi,                             'vertebral body'],
  [/\bvertebral\b/gi,                             'vertebral body'],
  [/\bthoracic vertebra\b/gi,                     'vertebral body'],
  [/\bthoracic spine\b/gi,                        'vertebral body'],
  [/\bspinal body\b/gi,                           'vertebral body'],
  [/\bspinal bone\b/gi,                           'vertebral body'],
  [/\bT\d{1,2} vertebra\b/gi,                    'vertebral body'],  // e.g. "T4 vertebra"
];

// ============================================================
// SECTION 10: RECURRENT LARYNGEAL NERVE (→ pT4)
// ============================================================
const RLN_SYNONYMS: [RegExp, string][] = [
  [/\brecurrent laryngeal\b/gi,                   'recurrent laryngeal nerve'],
  [/\bRLN\b/g,                                    'recurrent laryngeal nerve'],
  [/\bvocal cord paralysis\b/gi,                  'recurrent laryngeal nerve'],
  [/\bvocal cord palsy\b/gi,                      'recurrent laryngeal nerve'],
  [/\bvocal fold paralysis\b/gi,                  'recurrent laryngeal nerve'],
  [/\bvocal fold palsy\b/gi,                      'recurrent laryngeal nerve'],
  [/\bhoarseness\b/gi,                            'recurrent laryngeal nerve'],  // indirect, use cautiously
];

// ============================================================
// SECTION 11: VISCERAL PLEURA & PL STATUS (→ pT2a/pT3)
// ============================================================
const PLEURAL_SYNONYMS: [RegExp, string][] = [
  // VPI abbreviation
  [/\bVPI\b/g,                                    'visceral pleural invasion'],
  [/\bVP invasion\b/gi,                           'visceral pleural invasion'],
  // Synonym forms
  [/\bvisceral pleura invasion\b/gi,              'visceral pleural invasion'],
  [/\bpleural surface invasion\b/gi,              'visceral pleural invasion'],
  [/\bpleural invasion\b/gi,                      'visceral pleural invasion'],
  [/\bpleural involvement\b/gi,                   'visceral pleural invasion'],
  [/\bvisceral pleura involvement\b/gi,           'visceral pleural invasion'],
  [/\bpleural elastic layer invasion\b/gi,        'visceral pleural invasion'],
  [/\bbeyond the elastic layer\b/gi,              'visceral pleural invasion PL1'],
  [/\bthrough the elastic layer\b/gi,             'visceral pleural invasion PL1'],
  [/\bto the pleural surface\b/gi,                'visceral pleural invasion PL2'],
  [/\bat the pleural surface\b/gi,                'visceral pleural invasion PL2'],
  // PL status abbreviations
  [/\bPL-1\b/gi,                                  'PL1'],
  [/\bPL-2\b/gi,                                  'PL2'],
  [/\bPL-3\b/gi,                                  'PL3'],
  [/\bpleural layer 1\b/gi,                       'PL1'],
  [/\bpleural layer 2\b/gi,                       'PL2'],
  [/\bpleural layer 3\b/gi,                       'PL3'],
  // Parietal pleura → PL3
  [/\bparietal pleura invasion\b/gi,              'parietal pleura PL3'],
  [/\bparietal pleural invasion\b/gi,             'parietal pleura PL3'],
  [/\bparietal pleura involvement\b/gi,           'parietal pleura PL3'],
];

// ============================================================
// SECTION 12: TUMOR TYPE SYNONYMS
// ============================================================
const TUMOR_TYPE_SYNONYMS: [RegExp, string][] = [
  // Adenocarcinoma variants
  [/\badenoCA\b/gi,                               'adenocarcinoma'],
  [/\bADC\b/g,                                    'adenocarcinoma'],
  [/\bbronchoalveolar carcinoma\b/gi,             'adenocarcinoma'],  // old term → lepidic adeno
  [/\bBAC\b/g,                                    'adenocarcinoma'],
  // Squamous cell variants
  [/\bsquamous carcinoma\b/gi,                    'squamous cell carcinoma'],
  [/\bSCC\b/g,                                    'squamous cell carcinoma'],
  [/\bsquamous cell CA\b/gi,                      'squamous cell carcinoma'],
  [/\bepidermoid carcinoma\b/gi,                  'squamous cell carcinoma'],
  // Small cell
  [/\bSCLC\b/g,                                   'small cell carcinoma'],
  [/\bsmall cell lung cancer\b/gi,                'small cell carcinoma'],
  [/\boat cell carcinoma\b/gi,                    'small cell carcinoma'],
  // Large cell neuroendocrine
  [/\bLCNEC\b/g,                                  'large cell neuroendocrine carcinoma'],
  [/\blarge cell NEC\b/gi,                        'large cell neuroendocrine carcinoma'],
  // Carcinoid
  [/\btypical carcinoid\b/gi,                     'typical carcinoid'],
  [/\batypical carcinoid\b/gi,                    'atypical carcinoid'],
  [/\bTC\b/g,                                     'typical carcinoid'],   // ambiguous — use carefully
  [/\bAC\b/g,                                     'atypical carcinoid'],  // ambiguous — use carefully
  // MIA / AIS
  [/\bMIA\b/g,                                    'minimally invasive adenocarcinoma'],
  [/\bminimally invasive adeno\b/gi,              'minimally invasive adenocarcinoma'],
  [/\bAIS\b/g,                                    'adenocarcinoma in situ'],
  [/\bin situ adenocarcinoma\b/gi,                'adenocarcinoma in situ'],
  [/\blepidic adenocarcinoma in situ\b/gi,        'adenocarcinoma in situ'],
  // NSCLC (non-specific)
  [/\bNSCLC\b/g,                                  'non-small cell carcinoma'],
  [/\bnon-small cell lung cancer\b/gi,            'non-small cell carcinoma'],
  [/\bcarcinoma NOS\b/gi,                         'carcinoma'],
];

// ============================================================
// SECTION 13: LYMPH NODE TERMINOLOGY
// ============================================================
const LYMPH_NODE_SYNONYMS: [RegExp, string][] = [
  // Abbreviations
  [/\bLN\b/g,                                     'lymph node'],
  [/\bLNs\b/g,                                    'lymph nodes'],
  [/\bLN metastasis\b/gi,                         'lymph node metastasis'],
  [/\bnodal metastasis\b/gi,                      'lymph node metastasis'],
  [/\bnodal involvement\b/gi,                     'lymph node metastasis'],
  // Station synonyms → canonical station names
  [/\bstation 7\b/gi,                             'subcarinal lymph node'],
  [/\blevel 7\b/gi,                               'subcarinal lymph node'],
  [/\bsubcarinal node\b/gi,                       'subcarinal lymph node'],
  [/\bsubcarinal station\b/gi,                    'subcarinal lymph node'],
  [/\bstation 4R\b/gi,                            'level 4R lymph node'],
  [/\bstation 4L\b/gi,                            'level 4L lymph node'],
  [/\bstation 2R\b/gi,                            'level 2R lymph node'],
  [/\bstation 2L\b/gi,                            'level 2L lymph node'],
  [/\bstation 5\b/gi,                             'level 5 lymph node'],
  [/\bstation 6\b/gi,                             'level 6 lymph node'],
  [/\bstation 8\b/gi,                             'level 8 lymph node'],
  [/\bstation 9\b/gi,                             'level 9 lymph node'],
  [/\bstation 10\b/gi,                            'level 10 lymph node'],
  [/\bstation 11\b/gi,                            'level 11 lymph node'],
  // Descriptive → station mapping
  [/\bparatracheal lymph node\b/gi,               'level 4 lymph node'],
  [/\blower paratracheal\b/gi,                    'level 4 lymph node'],
  [/\bupper paratracheal\b/gi,                    'level 2 lymph node'],
  [/\baortopulmonary window\b/gi,                 'level 5 lymph node'],
  [/\bpara-aortic lymph node\b/gi,               'level 6 lymph node'],
  [/\bparaganglionic\b/gi,                        'level 9 lymph node'],
  [/\binterlobar lymph node\b/gi,                 'level 11 lymph node'],
  [/\bintrapulmonary lymph node\b/gi,             'level 12 lymph node'],
  // Negative result variants
  [/(?<!\blymph\s)\bnodes negative\b/gi,           'lymph nodes negative'],
  [/(?<!\blymph\s)\bnodes clear\b/gi,             'lymph nodes negative'],
  [/\bno nodal metastasis\b/gi,                   'lymph nodes negative'],
  [/\bnodal disease absent\b/gi,                  'lymph nodes negative'],
  [/\bno nodal involvement\b/gi,                  'lymph nodes negative'],
  [/\blymph nodes unremarkable\b/gi,              'lymph nodes negative'],
  [/\bno metastatic carcinoma in lymph nodes\b/gi,'lymph nodes negative'],
  // Lobe abbreviations used in nodal context
  [/\bLUL\b/g,                                    'left upper lobe'],
  [/\bRUL\b/g,                                    'right upper lobe'],
  [/\bRLL\b/g,                                    'right lower lobe'],
  [/\bLLL\b/g,                                    'left lower lobe'],
  [/\bRML\b/g,                                    'right middle lobe'],
];

// ============================================================
// SECTION 14: METASTASIS TERMINOLOGY
// ============================================================
const METASTASIS_SYNONYMS: [RegExp, string][] = [
  // Spelling / abbreviation variants
  [/\bmets\b/gi,                                  'metastases'],
  [/\bmet\b/gi,                                   'metastasis'],
  [/\bdistant spread\b/gi,                        'distant metastasis'],
  [/\bsystemic spread\b/gi,                       'distant metastasis'],
  [/\bextrapulmonary spread\b/gi,                 'distant metastasis'],
  [/\bhaematogenous spread\b/gi,                  'distant metastasis'],  // British
  [/\bhematogenous spread\b/gi,                   'distant metastasis'],
  // Contralateral nodule (M1a)
  [/\bopposite lung nodule\b/gi,                  'contralateral lung nodule'],
  [/\bcontralateral lobe nodule\b/gi,             'contralateral lung nodule'],
  [/\bcontralateral pulmonary nodule\b/gi,        'contralateral lung nodule'],
  [/\bopposite lobe\b/gi,                         'contralateral lobe'],
  [/\bother lung\b/gi,                            'contralateral lung'],
  // Malignant effusion (M1a)
  [/\bmalignant pleural effusion\b/gi,            'malignant effusion'],
  [/\bmalignant pericardial effusion\b/gi,        'malignant effusion'],
  [/\bpleural carcinomatosis\b/gi,                'pleural metastasis'],
  [/\bpleural implants\b/gi,                      'pleural nodule'],
  [/\bpleural studding\b/gi,                      'pleural nodule'],
  [/\bpericardial implants\b/gi,                  'pericardial nodule'],
  // Compound metastasis phrasing (normalize to canonical form before organ detection)
  [/\bmetastatic disease involving\b/gi,            'metastasis in'],
  [/\bmetastatic involvement of\b/gi,               'metastasis in'],
  [/\bmetastases involving\b/gi,                     'metastases in'],
  [/\bdistant disease in\b/gi,                       'metastasis in'],
  [/\bmetastatic spread to\b/gi,                     'metastasis in'],
  [/\bdisseminated to\b/gi,                          'metastasis in'],
  [/\bmetastatic deposits in\b/gi,                   'metastasis in'],
  [/\bmetastatic foci in\b/gi,                       'metastasis in'],
  // Organ-specific (relevant for M1c1 vs M1c2 detection)
  [/\bhepatic metastasis\b/gi,                    'liver metastasis'],
  [/\bhepatic metastases\b/gi,                    'liver metastases'],
  [/\bosseous structures\b/gi,                    'bone'],
  [/\bosseous disease\b/gi,                       'bone metastasis'],
  [/\bosseous involvement\b/gi,                   'bone metastasis'],
  [/\bosseous metastasis\b/gi,                    'bone metastasis'],
  [/\bosseous metastases\b/gi,                    'bone metastases'],
  [/\bskeletal metastasis\b/gi,                   'bone metastasis'],
  [/\bbone mets\b/gi,                             'bone metastases'],
  [/\bbony metastasis\b/gi,                       'bone metastasis'],
  [/\bcerebral metastasis\b/gi,                   'brain metastasis'],
  [/\bcerebral metastases\b/gi,                   'brain metastases'],
  [/\bintracranial metastasis\b/gi,               'brain metastasis'],
  [/\badrenal metastasis\b/gi,                    'adrenal metastasis'],
  [/\badrenal gland metastasis\b/gi,              'adrenal metastasis'],
  [/\brenal metastasis\b/gi,                      'kidney metastasis'],
];

// ============================================================
// SECTION 15: TUMOR SIZE LANGUAGE
// ============================================================
const SIZE_SYNONYMS: [RegExp, string][] = [
  // Common dictation variants for size
  [/\bgreatest diameter\b/gi,                     'greatest dimension'],
  [/\blargest diameter\b/gi,                      'greatest dimension'],
  [/\bmaximum diameter\b/gi,                      'greatest dimension'],
  [/\bmaximum dimension\b/gi,                     'greatest dimension'],
  [/\blargest dimension\b/gi,                     'greatest dimension'],
  [/\btumour size\b/gi,                           'tumor size'],
  [/\btumour measures\b/gi,                       'tumor measures'],
  [/\bmeasures up to\b/gi,                        'measures'],
  [/\bin greatest extent\b/gi,                    'in greatest dimension'],
  // Invasive component variants
  [/\binvasive focus\b/gi,                        'invasive component'],
  [/\binvasive portion\b/gi,                      'invasive component'],
  [/\binvasive area\b/gi,                         'invasive component'],
  [/\binvasive element\b/gi,                      'invasive component'],
  [/\binvasive tumour\b/gi,                       'invasive component'],
  [/\bsolid component\b/gi,                       'invasive component'],  // use cautiously
  [/\bsolid portion\b/gi,                         'invasive component'],  // use cautiously
  [/\bpure invasive\b/gi,                         'invasive component'],
  // Total size variants
  [/\boverall size\b/gi,                          'total size'],
  [/\baggregate size\b/gi,                        'total size'],
  [/\bcombined size\b/gi,                         'total size'],
  [/\bgross size\b/gi,                            'total size'],
  [/\bgross dimension\b/gi,                       'total size'],
];

// ============================================================
// SECTION 16: MARGIN TERMINOLOGY
// ============================================================
const MARGIN_SYNONYMS: [RegExp, string][] = [
  [/\bresection margin\b/gi,                      'surgical margin'],
  [/\bsurgical resection margin\b/gi,             'surgical margin'],
  [/\bcut end\b/gi,                               'surgical margin'],
  [/\bbronchial stump\b/gi,                       'bronchial margin'],
  [/\bbronchial cut end\b/gi,                     'bronchial margin'],
  [/\bvascular margin\b/gi,                       'vascular resection margin'],
  [/\bmargin uninvolved\b/gi,                     'margin negative'],
  [/\bmargin clear\b/gi,                          'margin negative'],
  [/\bfree margin\b/gi,                           'margin negative'],
  [/\bR0 resection\b/gi,                          'margin negative'],
  [/\bR1 resection\b/gi,                          'margin positive'],
  [/\bR2 resection\b/gi,                          'margin positive'],
  [/\btumour at margin\b/gi,                      'tumor at margin'],
  [/\btumour involves margin\b/gi,                'margin positive'],
  [/\bmargin involved\b/gi,                       'margin positive'],
];

// ============================================================
// SECTION 17: SATELLITE NODULE TERMINOLOGY
// ============================================================
const SATELLITE_SYNONYMS: [RegExp, string][] = [
  [/\bsatellite lesion\b/gi,                      'satellite nodule'],
  [/\bsatellite focus\b/gi,                       'satellite nodule'],
  [/\bsatellite tumour\b/gi,                      'satellite nodule'],
  [/\bsecond focus\b/gi,                          'satellite nodule'],
  [/\bsecond tumour nodule\b/gi,                  'satellite nodule'],
  [/\bseparate tumour focus\b/gi,                 'satellite nodule'],
  [/\bseparate nodule\b/gi,                       'satellite nodule'],
  [/\badditional nodule\b/gi,                     'satellite nodule'],
  [/\bsynchronous nodule\b/gi,                    'satellite nodule'],
  [/\bintrapulmonary metastasis\b/gi,             'satellite nodule'],
  [/\bintrapulmonary nodule\b/gi,                 'satellite nodule'],
];

// ============================================================
// SECTION 18: BRITISH / CANADIAN ENGLISH VARIANTS
// ============================================================
const SPELLING_VARIANTS: [RegExp, string][] = [
  [/\btumour\b/gi,                                'tumor'],
  [/\btumours\b/gi,                               'tumors'],
  [/\bfavour\b/gi,                                'favor'],
  [/\bfavourable\b/gi,                            'favorable'],
  [/\bfavoured\b/gi,                              'favored'],
  [/\bcolour\b/gi,                                'color'],
  [/\bbehaviour\b/gi,                             'behavior'],
  [/\bneoplasm\b/gi,                              'tumor'],    // only if you want broad catch
  [/\bneoplasms\b/gi,                             'tumors'],
  [/\bhaemorrhage\b/gi,                           'hemorrhage'],
  [/\bhaemorrhagic\b/gi,                          'hemorrhagic'],
  [/\bnecrosis\b/gi,                              'necrosis'],  // same — no change needed
  [/\blocoregional\b/gi,                          'loco-regional'],
];

// ============================================================
// SECTION 19: GENERAL PATHOLOGY SHORTHAND
// ============================================================
const GENERAL_SHORTHAND: [RegExp, string][] = [
  [/\bCA\b/g,                                     'carcinoma'],
  [/\bCa\b/g,                                     'carcinoma'],
  [/\bmet carcinoma\b/gi,                         'metastatic carcinoma'],
  [/\bmets carcinoma\b/gi,                        'metastatic carcinoma'],
  [/\bno LVI\b/gi,                                'no lymphovascular invasion'],
  [/\bLVI present\b/gi,                           'lymphovascular invasion present'],
  [/\bLVI\b/g,                                    'lymphovascular invasion'],
  [/\bPNI\b/g,                                    'perineural invasion'],
  [/\bno PNI\b/gi,                                'no perineural invasion'],
  [/\bIHC\b/g,                                    'immunohistochemistry'],
  [/\bIHC stain\b/gi,                             'immunohistochemical stain'],
  [/\bH&E\b/g,                                    'hematoxylin and eosin'],
  [/\bH and E\b/gi,                               'hematoxylin and eosin'],
  [/\bgrade 1\b/gi,                               'well differentiated'],
  [/\bgrade 2\b/gi,                               'moderately differentiated'],
  [/\bgrade 3\b/gi,                               'poorly differentiated'],
  [/\bWD\b/g,                                     'well differentiated'],
  [/\bMD\b/g,                                     'moderately differentiated'],
  [/\bPD\b/g,                                     'poorly differentiated'],
];

// ============================================================
// MASTER MAP — ordered intentionally
// Order matters: more specific patterns before broader ones
// ============================================================
export const NORMALIZATION_MAP: [RegExp, string][] = [
  ...SPELLING_VARIANTS,       // fix spelling first so subsequent patterns match
  ...CHEST_WALL_SYNONYMS,
  ...MEDIASTINUM_SYNONYMS,
  ...PHRENIC_NERVE_SYNONYMS,
  ...DIAPHRAGM_SYNONYMS,
  ...GREAT_VESSELS_SYNONYMS,
  ...HEART_SYNONYMS,
  ...TRACHEA_SYNONYMS,
  ...ESOPHAGUS_SYNONYMS,
  ...VERTEBRAL_SYNONYMS,
  ...RLN_SYNONYMS,
  ...PLEURAL_SYNONYMS,
  ...TUMOR_TYPE_SYNONYMS,
  ...LYMPH_NODE_SYNONYMS,
  ...METASTASIS_SYNONYMS,
  ...SIZE_SYNONYMS,
  ...MARGIN_SYNONYMS,
  ...SATELLITE_SYNONYMS,
  ...GENERAL_SHORTHAND,
];

// ============================================================
// CORE FUNCTION
// ============================================================
export function normalizeReportText(rawText: string): string {
  let normalized = rawText;

  for (const [pattern, replacement] of NORMALIZATION_MAP) {
    normalized = normalized.replace(pattern, replacement);
  }

  if (NORMALIZATION_DEBUG) {
    if (normalized !== rawText) {
      console.group('[normalization] Changes applied');
      console.log('RAW:', rawText);
      console.log('NORMALIZED:', normalized);
      console.groupEnd();
    } else {
      console.log('[normalization] No changes applied');
    }
  }

  return normalized;
}

// ============================================================
// UTILITY: get diff of what changed (for testing / UI display)
// ============================================================
export function getNormalizationDiff(rawText: string): {
  pattern: string;
  replacement: string;
  matched: string;
}[] {
  const diffs: { pattern: string; replacement: string; matched: string }[] = [];

  for (const [pattern, replacement] of NORMALIZATION_MAP) {
    const clonedPattern = new RegExp(pattern.source, pattern.flags);
    const matches = rawText.match(clonedPattern);
    if (matches) {
      diffs.push({
        pattern: pattern.source,
        replacement,
        matched: matches.join(', '),
      });
    }
  }

  return diffs;
}

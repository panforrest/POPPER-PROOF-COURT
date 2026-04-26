/**
 * The four sample hypotheses provided in Fulcrum Science's challenge brief.
 * Used on the landing page (one-click chips) and the Counsel Chambers
 * drafting page (pre-fill the textarea).
 */

export type SampleCase = {
  id: string;
  domain: string;
  plainEnglish: string;
  hypothesis: string;
};

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "crp-biosensor",
    domain: "Diagnostics",
    plainEnglish:
      "Cheap, fast blood test for inflammation — without lab equipment?",
    hypothesis:
      "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing.",
  },
  {
    id: "lactobacillus",
    domain: "Gut Health",
    plainEnglish:
      "Does a specific probiotic measurably strengthen the gut lining in mice?",
    hypothesis:
      "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.",
  },
  {
    id: "trehalose",
    domain: "Cell Biology",
    plainEnglish:
      "Can swapping one cryoprotectant keep more frozen cells alive?",
    hypothesis:
      "Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose's superior membrane stabilization at low temperatures.",
  },
  {
    id: "sporomusa",
    domain: "Climate",
    plainEnglish:
      "Can a microbe convert CO₂ into useful chemicals more efficiently?",
    hypothesis:
      "Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%.",
  },
];

export const findSampleCase = (id: string): SampleCase | undefined =>
  SAMPLE_CASES.find((c) => c.id === id);

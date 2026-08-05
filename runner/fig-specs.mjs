// fig-specs.mjs — declarative specs for the PAPER distribution figures (composed by compose-figs.mjs).
// Each figure is a grid: gene rows × experiment/variant columns, every cell a histogram-over-time panel.
//
// GENE-NAME DECODER (paper name  ->  code data-field base/cap  ->  experiment-id token). The code
// identifiers are historical and CROSSED vs the paper: paper "Seed Dispersal" = code `weight`, paper
// "Abscission" = code `dispersal`. See the repo README. We key genes by their PAPER concept and hide
// the crossing here so specs read in paper terms.
export const GENES = {
  root:       { base: 'root',      cap: 'Root',      idtok: 'Roots',     paper: 'Root Depth' },
  fecundity:  { base: 'seed',      cap: 'Seed',      idtok: 'Fecundity', paper: 'Fecundity' },
  dispersal:  { base: 'weight',    cap: 'Weight',    idtok: 'Weight',    paper: 'Seed Dispersal' },
  abscission: { base: 'dispersal', cap: 'Dispersal', idtok: 'Dispersal', paper: 'Abscission' },
};
export const ALL4 = ['root', 'fecundity', 'dispersal', 'abscission'];
export const SYND3 = ['root', 'dispersal', 'abscission'];   // the 3 genes the syndrome figures track

// column kinds:
//   { label, exp, variant }       fixed experiment id, one population variant ('pop'|'wild'|'dome')
//   { label, mode }               DIAGONAL: cell(gene) uses the experiment whose id contains
//                                  `${mode}${GENES[gene].idtok}` (e.g. mode 'harv_max', gene root -> harv_maxRoots)
//   any column may add { highlight: '<geneKey>' } to red-box the directly-selected gene's row.
export const SPECS = [
  {
    id: 'control', fig: 'Wild Types',
    title: 'Wild Types — natural selection, predation, and non-selective planting',
    caption: 'Gene distributions in the three control (“wild type”) scenarios: (I) no humans, plants under natural selection only; (II) humans harvest non-selectively (predation); (III) humans harvest and plant, both non-selectively. Value low→high bottom→top, time→right; pooled over replicates.',
    genes: ALL4,
    cols: [
      { label: 'WT I · no humans', exp: 'p01_nohumans', variant: 'pop' },
      { label: 'WT II · non-selective harvest', exp: 'p02_wt2_predation', variant: 'pop' },
      { label: 'WT III · harvest + non-selective plant', exp: 'p03_wt3_plantrandom', variant: 'pop' },
    ],
  },
  {
    id: 'prelims', fig: 'Genes Under Selection',
    title: 'Genes under selection — selective harvesting vs selective planting',
    caption: 'Each row is one gene; each column applies a selection pressure to that gene. Columns 1–2 harvest the maximum / minimum value of the gene (planting is non-selective); columns 3–4 plant the maximum / minimum value (harvesting is non-selective). Selective harvesting drives a trait DOWN; selective planting drives it UP.',
    genes: ALL4,
    diagonal: true,
    cols: [
      { label: 'harvest max', mode: 'harv_max' },
      { label: 'harvest min', mode: 'harv_min' },
      { label: 'plant max', mode: 'plant_max' },
      { label: 'plant min', mode: 'plant_min' },
    ],
  },
  {
    id: 'split', fig: 'Domestication Syndrome',
    title: 'Domestication syndrome — selectively planting non-shattering seeds',
    caption: 'Selective planting of the non-shattering (minimum abscission) variant splits the population into a wild (abscission ≥ 0.6) and a domesticated (abscission < 0.6) subpopulation. Separating on abscission also separates the other genes — the correlated multi-gene shift that defines domestication syndrome.',
    genes: ALL4,
    cols: [
      { label: 'total population', exp: 'p19_plant_minDispersal', variant: 'pop' },
      { label: 'wild variant (absc ≥ 0.6)', exp: 'p19_plant_minDispersal', variant: 'wild' },
      { label: 'domesticated variant (absc < 0.6)', exp: 'p19_plant_minDispersal', variant: 'dome' },
    ],
  },
  {
    id: 'domesticated', fig: 'Domesticated Variants',
    title: 'Domesticated variants across five selective-planting experiments',
    caption: 'The domesticated (abscission < 0.6) subpopulation from the five selective-planting experiments that produced one. Red box marks the gene under direct selection; the other genes shift by indirect selection (syndrome). The last column is the non-shattering case of the previous figure.',
    genes: ALL4,
    cols: [
      { label: 'plant deep roots', exp: 'p12_plant_maxRoots', variant: 'dome', highlight: 'root' },
      { label: 'plant high fecundity', exp: 'p13_plant_maxFecundity', variant: 'dome', highlight: 'fecundity' },
      { label: 'plant max dispersal', exp: 'p14_plant_maxWeight', variant: 'dome', highlight: 'dispersal' },
      { label: 'plant min dispersal', exp: 'p18_plant_minWeight', variant: 'dome', highlight: 'dispersal' },
      { label: 'plant non-shattering', exp: 'p19_plant_minDispersal', variant: 'dome', highlight: 'abscission' },
    ],
  },
  {
    id: 'wild', fig: 'Wild Variants',
    title: 'No domestication — three selective-planting experiments that stayed wild',
    caption: 'Three selective-planting experiments where no domesticated subpopulation emerged; the total population resembles Wild Type III. Red box marks the selected gene. Selecting the shattering (max abscission) variant fails because it is indistinguishable from the wild population, so no reproductive isolation can begin.',
    genes: ALL4,
    cols: [
      { label: 'plant shattering', exp: 'p15_plant_maxDispersal', variant: 'pop', highlight: 'abscission' },
      { label: 'plant shallow roots', exp: 'p16_plant_minRoots', variant: 'pop', highlight: 'root' },
      { label: 'plant low fecundity', exp: 'p17_plant_minFecundity', variant: 'pop', highlight: 'fecundity' },
    ],
  },
  {
    id: 'first', fig: 'Unintended Selective Planting',
    title: 'Unintended selective planting — replanting the first-harvested seeds',
    caption: 'Humans replant the first seeds harvested each day (the “bottom of the basket”), which are disproportionately from the arid region near the shelters. This unintentional, geography-based selection domesticates the crop with no trait-based choice at all: total / wild / domesticated subpopulations.',
    genes: SYND3,
    cols: [
      { label: 'total population', exp: 'p20_plant_bottom', variant: 'pop' },
      { label: 'wild variant', exp: 'p20_plant_bottom', variant: 'wild' },
      { label: 'domesticated variant', exp: 'p20_plant_bottom', variant: 'dome' },
    ],
  },
  {
    id: 'lineage', fig: 'Lineage-Age Selection',
    title: 'Lineage-age planting — the reproductive-isolation mechanism, isolated',
    caption: 'Planting purely by lineage age (generations since a seed’s line was last sown) with no trait selection. Planting the FRESHEST lineage (recently-sown offspring) reproductively isolates the planted crop and domesticates it (dome ≈ 0.51); planting the OLDEST lineage does not (dome ≈ 0.03). A direct, controlled test of reproductive isolation as the driver.',
    genes: ALL4,
    cols: [
      { label: 'plant freshest lineage', exp: 'lin_mingsp_pop80', variant: 'pop' },
      { label: 'plant freshest — domesticated', exp: 'lin_mingsp_pop80', variant: 'dome' },
      { label: 'plant oldest lineage', exp: 'lin_maxgsp_pop80', variant: 'pop' },
    ],
  },
  // NOTE: 'sickles' figure intentionally omitted for now — it needs a harvest-non-shattering-WITHOUT-planting
  // run that does not exist in the current matrix (every harvest experiment plants randomly). Decide whether
  // to run it or fold the sickle result into 'prelims' (abscission row, harvest-min column = the sickle case).
];

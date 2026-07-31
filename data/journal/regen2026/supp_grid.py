# supp_grid.py "12,20" out.pdf  — SPACING PROTOTYPE for the supplement experiment blocks.
# One block per experiment: 5 rows (Root Depth, Fecundity, Seed Dispersal, Abscission, Lineage age)
# x 5 columns (Total, Wild, Domesticated, Harvested, Planted). Figure is sized to the full text area
# minus ~1in for a caption (7 x 8 in). Pass 2 or 3 experiments to compare 2-up vs 3-up.
# Reads CSVs from gen-csvs.mjs: {gene}{NN}[wild|dome] (standing), harv_{gene}{NN} / plant_{gene}{NN}
# (harvested/planted event distributions), for gene in roots/seeds/weight/disp/gsp.
import sys, os
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as colors

plt.rcParams["font.family"] = "Times New Roman"
CSVDIR = "./csvs/"

NAMES = {
    "01": "Wild Type I (no humans)", "02": "Wild Type II (harvest only)",
    "03": "Wild Type III (harvest + random plant)",
    "04": "Harvest max Root Depth", "05": "Harvest max Fecundity",
    "06": "Harvest max Seed Dispersal", "07": "Harvest max Abscission",
    "08": "Harvest min Root Depth", "09": "Harvest min Fecundity",
    "10": "Harvest min Seed Dispersal", "11": "Harvest min Abscission",
    "12": "Plant max Root Depth", "13": "Plant max Fecundity",
    "14": "Plant max Seed Dispersal", "15": "Plant max Abscission",
    "16": "Plant min Root Depth", "17": "Plant min Fecundity",
    "18": "Plant min Seed Dispersal", "19": "Plant min Abscission",
    "20": "Plant first harvested (bottom of basket)",
    "21": "Plant last harvested (top of basket)",
    "22": "Sickle (harvest non-shattering, no planting)",
    "40": "Lineage age (plant youngest lineage)",
    "41": "Lineage age (plant oldest lineage)",
}
GENES = [("roots", "Root Depth"), ("seeds", "Fecundity"), ("weight", "Seed Dispersal"), ("disp", "Abscission")]
COLS = ["Total", "Wild", "Domesticated", "Harvested", "Planted"]

def colormap():
    bottom = plt.get_cmap("gist_rainbow_r"); top = plt.get_cmap("bwr_r")
    return colors.ListedColormap(np.vstack((top(np.linspace(0.5, 1, 24)), bottom(np.linspace(0.24, 1, 232)))), "m")
CMAP = colormap()

def readFile(name):
    path = CSVDIR + name + ".csv"
    if not os.path.exists(path): return None
    hist = [[] for _ in range(20)]
    with open(path) as f: lines = f.readlines()
    for line in lines[200:]:                      # skip the 200-sample equilibration (as hist_split.py)
        try:
            nums = [float(x) for x in line.strip().split(",")]
            if len(nums) < 20: continue
            for j in range(20): hist[19 - j].append(nums[j])
        except ValueError: pass
    a = np.array(hist, dtype=float)
    return a if a.size else None

def cell(ax, hist, denom=None):
    ax.set_xticks([]); ax.set_yticks([])
    if hist is None: ax.set_facecolor("#eeeeee"); return
    T = hist.shape[1]
    if denom is None: d = hist.sum(axis=0)                       # normalize by own per-column total
    else: d = denom[:T] if len(denom) >= T else np.concatenate([denom, np.ones(T - len(denom))])  # align total's denom
    d = np.where(d == 0, 1, d)
    ax.imshow(hist / d, aspect="auto", cmap=CMAP, vmin=0, vmax=1, origin="upper", interpolation="nearest")
    for s in ax.spines.values(): s.set_visible(True); s.set_linewidth(0.4)

exps = sys.argv[1].split(","); out = sys.argv[2]; N = len(exps)
fig = plt.figure(figsize=(7, 8))
subfigs = np.atleast_1d(fig.subfigures(N, 1, hspace=0.06))
for sf, exp in zip(subfigs, exps):
    axs = sf.subplots(5, 5)
    sf.subplots_adjust(left=0.125, right=0.995, top=0.85, bottom=0.03, wspace=0.06, hspace=0.14)
    sf.suptitle(f"Experiment {exp} — {NAMES.get(exp, '')}", fontsize=9, y=0.965)
    rows = GENES + [("gsp", "Lineage age")]      # 5th row = lineage age (gsp)
    for r, (pfx, rlabel) in enumerate(rows):
        tot = readFile(pfx + exp)                 # total-population denominator for the wild/dome split
        denom = tot.sum(axis=0) if tot is not None else None
        for c, col in enumerate(COLS):
            ax = axs[r][c]
            if col == "Total": h, dn = tot, None
            elif col == "Wild": h, dn = readFile(pfx + exp + "wild"), denom
            elif col == "Domesticated": h, dn = readFile(pfx + exp + "dome"), denom
            elif col == "Harvested": h, dn = readFile("harv_" + pfx + exp), None
            else: h, dn = readFile("plant_" + pfx + exp), None   # Planted
            cell(ax, h, dn)
            if r == 0: ax.set_title(col, fontsize=7.5, pad=2)
            if c == 0: ax.set_ylabel(rlabel, fontsize=7.5, rotation=0, ha="right", va="center", labelpad=6)
plt.savefig(out, dpi=200)
print("wrote", out)

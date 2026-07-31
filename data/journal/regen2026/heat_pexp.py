# heat_pexp.py <pexp-grid.json> <out.pdf> — render the discrete p-experiment / gsp grid as two heatmaps
# (domestication | lineage divergence) side-by-side, matching heat_sweeps.py's paper style but with
# categorical (string) row/column labels and blank (white) cells where an experiment has no counterpart
# (harvest rows have no bottom/top or gsp variant).
import sys, json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["font.size"] = 10

FLAG_COLOR = "#c0504d"   # muted brick red for the excluded artifact cell — outside the viridis ramp, no clash

with open(sys.argv[1]) as f:
    D = json.load(f)
rows, cols = D["rows"], D["cols"]
cmap = plt.get_cmap("viridis").copy()   # perceptually uniform, colorblind-safe (as the sweep figs)
cmap.set_bad("white")                    # missing cells render white

def panel(ax, matrix, clabel, vmax, flags=()):
    # vector quads (pcolormesh), not imshow: the tiny embedded raster imshow writes gets sheared by some
    # PDF rasterizers; pcolormesh emits true rectangles that stay crisp in the embedded PDF and in LaTeX.
    flags = {tuple(f) for f in flags}
    nr, nc = len(matrix), len(matrix[0])
    # flagged cells are masked out of the colormesh (so they neither take a viridis color nor count toward
    # the scale) and painted with a fixed red patch instead.
    Z = np.ma.masked_invalid(np.array([[np.nan if (v is None or (i, j) in flags) else v
                                        for j, v in enumerate(r)] for i, r in enumerate(matrix)], dtype=float))
    X, Y = np.arange(nc + 1), np.arange(nr + 1)
    im = ax.pcolormesh(X, Y, Z, cmap=cmap, vmin=0, vmax=vmax, edgecolors="white", linewidth=0.6)
    ax.set_aspect("equal")
    ax.invert_yaxis()                    # row 0 (harvest max) at the top
    for (fi, fj) in flags:
        ax.add_patch(Rectangle((fj, fi), 1, 1, facecolor=FLAG_COLOR, edgecolor="white", linewidth=0.6, zorder=2))
    for i in range(nr):                  # per-cell value labels (white on dark cells, black on light)
        for j in range(nc):
            v = matrix[i][j]
            if v is None:
                continue
            if (i, j) in flags:
                txt = "white"
            else:
                r, g, b, _ = cmap(min(1.0, v / vmax) if vmax else 0.0)
                txt = "black" if (0.299 * r + 0.587 * g + 0.114 * b) > 0.55 else "white"
            lab = f"{v:.2f}"
            if lab == "-0.00":
                lab = "0.00"
            ax.text(j + 0.5, i + 0.5, lab, ha="center", va="center", fontsize=9, color=txt)
    ax.set_xticks([j + 0.5 for j in range(nc)], cols, rotation=40, ha="right")
    ax.set_yticks([i + 0.5 for i in range(nr)], rows)
    ax.tick_params(length=0)
    for s in ax.spines.values():
        s.set_visible(True)
    cb = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cb.set_label(clabel)
    cb.ax.tick_params(length=0)
    return ax

nrows, ncols = len(rows), len(cols)
CELLW, CELLH = 0.62, 0.52
NPANEL = 3
figw = NPANEL * ncols * CELLW + 4.2
figh = nrows * CELLH + 2.0
flags = D.get("flags", [])
flagset = {tuple(f) for f in flags}
domeM = D.get("domeCorrected", D["dome"])   # corrected dome (baseline-subtracted), as the other plots
gapM = D["gap"]                             # signed mean lineage-age gap (harvested - planted)
fig, axes = plt.subplots(1, 3, figsize=(figw, figh), constrained_layout=True)
domeMax = max(1e-9, max((v for i, r in enumerate(domeM) for j, v in enumerate(r)
                         if v is not None and (i, j) not in flagset), default=1.0))
divMax = max(1e-9, max((v for r in D["div"] for v in r if v is not None), default=1.0))
gapMax = max(1e-9, max((v for r in gapM for v in r if v is not None), default=1.0))
panel(axes[0], domeM, "domestication (corrected)", domeMax, flags=flags)
panel(axes[1], D["div"], "lineage divergence", divMax)   # p07 is normal here (~baseline), so not flagged
panel(axes[2], gapM, "mean lineage-age gap", gapMax)
axes[1].set_yticklabels([])
axes[2].set_yticklabels([])
plt.savefig(sys.argv[2])

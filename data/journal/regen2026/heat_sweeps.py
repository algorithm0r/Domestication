# heat_sweeps.py <sweepdata.json> <out.pdf> — render one sweep as two heatmaps (domestication | lineage
# divergence) side-by-side, matching the paper style: Times New Roman size 10, the same rainbow colormap
# as the distribution figures, square cells, a colorbar per panel, and NO text besides axis labels and
# numbers (no titles, legends, in-cell values, or status markers).
import sys, json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as colors

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["font.size"] = 10

with open(sys.argv[1]) as f:
    D = json.load(f)
rows, cols = D["rows"], D["cols"]
cmap = plt.get_cmap("viridis").copy()   # perceptually uniform, colorblind-safe (as the prior sweep figs)
cmap.set_bad("white")                    # out-of-range / missing cells render white

def fmt(v):
    return (f"{v:.2f}" if (isinstance(v, float) and 0 < v < 1) else f"{int(v)}")

def panel(ax, matrix, clabel):
    Z = np.array([[np.nan if v is None else v for v in r] for r in matrix], dtype=float)
    vmax = np.nanmax(Z) if np.isfinite(Z).any() and np.nanmax(Z) > 0 else 1.0
    im = ax.imshow(Z, cmap=cmap, vmin=0, vmax=vmax, aspect="equal", origin="upper")
    for i in range(Z.shape[0]):          # per-cell value labels (white on dark cells, black on light)
        for j in range(Z.shape[1]):
            v = Z[i, j]
            if np.isnan(v):
                continue
            r, g, b, _ = cmap(v / vmax if vmax else 0.0)
            txt = "black" if (0.299 * r + 0.587 * g + 0.114 * b) > 0.55 else "white"
            lab = f"{v:.2f}"
            if lab == "-0.00":
                lab = "0.00"
            ax.text(j, i, lab, ha="center", va="center", fontsize=10, color=txt)
    ax.set_xticks(range(len(cols)), [fmt(c) for c in cols])
    ax.set_yticks(range(len(rows)), [str(r) for r in rows])
    ax.set_xlabel(D["colLabel"])
    ax.tick_params(length=0)
    for s in ax.spines.values():
        s.set_visible(True)
    cb = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cb.set_label(clabel)
    cb.ax.tick_params(length=0)
    return ax

# size the figure to the data so cells are square with no wasted space (energy's 5 cols < pp's 11 cols)
CELL = 0.42
nrows, ncols = len(rows), len(cols)
figw = 2 * ncols * CELL + 2.8      # two panels + two colorbars + the y-axis label/ticks
figh = nrows * CELL + 1.1
fig, axes = plt.subplots(1, 2, figsize=(figw, figh), constrained_layout=True)
panel(axes[0], D["dome"], "domestication")
axes[0].set_ylabel(D["rowLabel"])
panel(axes[1], D["div"], "lineage divergence")
axes[1].set_yticklabels([])          # share the population axis
axes[1].set_ylabel("")

plt.savefig(sys.argv[2])

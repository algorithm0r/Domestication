# heat_mega.py <megafig-data.json> <out.pdf> — the mega sweep panel: rows = domestication, lineage
# divergence (TV), mean lineage-age gap; columns = the four sweeps (planting effort, seeds saved, planting
# selectivity, metabolic energy). Every panel shares the population y-axis, so they stack at equal height.
# Heatmaps only, no in-cell numbers. One shared colour scale + colorbar per metric row. Times New Roman 10.
import sys, json
import numpy as np
import matplotlib.pyplot as plt

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["font.size"] = 10

D = json.load(open(sys.argv[1]))
sweeps = D["sweeps"]
ALL_METRICS = [("dome", "domestication"), ("div", "lineage divergence"), ("gap", "mean lineage-age gap")]
sel = sys.argv[3] if len(sys.argv) > 3 else "all"          # "dome" | "div" | "gap" for one row, else all three
METRICS = [m for m in ALL_METRICS if m[0] == sel] if sel in ("dome", "div", "gap") else ALL_METRICS
cmap = plt.get_cmap("viridis").copy(); cmap.set_bad("white")

def fmt(v):
    return f"{int(round(v))}" if abs(v - round(v)) < 1e-9 else f"{v:.2f}"

nrows, ncols = len(METRICS), len(sweeps)
fig, axes = plt.subplots(nrows, ncols, figsize=(7.0, 1.3 + 1.3 * nrows), squeeze=False, constrained_layout=True)

for r, (mkey, mlabel) in enumerate(METRICS):
    vmax = max((v for sw in sweeps for row in sw[mkey] for v in row if v is not None), default=1.0)
    vmax = max(vmax, 1e-9)
    im = None
    for c, sw in enumerate(sweeps):
        ax = axes[r, c]
        M = sw[mkey]; nr, nc = len(M), len(M[0])
        Z = np.ma.masked_invalid(np.array([[np.nan if v is None else v for v in row] for row in M], dtype=float))
        im = ax.pcolormesh(np.arange(nc + 1), np.arange(nr + 1), Z, cmap=cmap, vmin=0, vmax=vmax)
        ax.set_aspect("auto")
        ax.tick_params(length=0)
        # x ticks (first / last swept value) only on the bottom metric row
        if r == nrows - 1:
            ax.set_xticks([0.5, nc - 0.5], [fmt(sw["cols"][0]), fmt(sw["cols"][-1])])
            for lbl, ha in zip(ax.get_xticklabels(), ("left", "right")):
                lbl.set_ha(ha)                       # tuck the first/last value inside the plot
            ax.tick_params(axis="x", pad=2.5)        # small gap between the value labels and the plot
            ax.set_xlabel(sw["colLabel"].title())
        else:
            ax.set_xticks([])
        # y ticks (population), rotated vertical, only on the left column
        if c == 0:
            pops = sw["rows"]
            ax.set_yticks([0.5, nr / 2, nr - 0.5], [fmt(pops[0]), fmt(pops[len(pops) // 2]), fmt(pops[-1])])
            ax.tick_params(axis="y", rotation=90)
        else:
            ax.set_yticks([])
    cb = fig.colorbar(im, ax=list(axes[r, :]), fraction=0.03, pad=0.015)  # one colorbar per metric row
    cb.set_label(mlabel.title())
    cb.ax.tick_params(length=0)

fig.supylabel("Human Population", fontsize=10)
plt.savefig(sys.argv[2])

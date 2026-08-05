# collapse_lens.py <gspcollapse-data.json> <out.pdf> <mode> [width_in]  — the collapse under one or both
# divergence lenses. mode = tv | delta | both. Both panels use the SAME points; only the x-axis changes:
# TV = total-variation distance between the planted and harvested lineage-age distributions (symmetric,
# saturates); Δmean = difference in mean lineage age, harvested minus planted (directional, in gsp bins).
# Minimal style: every swept setting is one grey dot, a single black pooled binned-mean line, the discrete
# trait-planting experiments as dark diamonds, and the two lineage-age experiments as stars (red = youngest
# lineage, blue = oldest). No legend — the marker roles are given in the caption. Times New Roman 10.
import sys, json
import matplotlib.pyplot as plt

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["font.size"] = 10

D = json.load(open(sys.argv[1]))
mode = sys.argv[3] if len(sys.argv) > 3 else "both"
ASPECT = 12.4 / 5.0                       # width/height of the two-panel layout; preserved for any width

XLABEL = {"tv": "Total variation between planted and harvested lineages",
          "delta": "Mean lineage-age gap (harvested − planted)"}
GREY = "#b3b3b3"; DIAMOND = "#333333"; GSP_COL = {"youngest": "#d62728", "oldest": "#2166ac"}

if mode == "both":
    w = float(sys.argv[4]) if len(sys.argv) > 4 else 12.4
    figsize = (w, w / ASPECT); panelw = w / 2.0
else:
    figsize = (7.6, 5.0); panelw = 7.6
SC = panelw / 3.3                         # marker scale keyed to per-panel width (ref = 3.3in \columnwidth)

def binned(pts, xk, nb):
    sp = sorted(pts, key=lambda p: p[xk]); per = max(1, -(-len(sp) // nb)); ln = []
    for i in range(0, len(sp), per):
        g = sp[i:i + per]
        if g: ln.append((sum(p[xk] for p in g) / len(g), sum(p["dome"] for p in g) / len(g)))
    return ln

def panel(ax, xk):
    pts = D["points"]
    ax.grid(True, color="#ececec", linewidth=0.6, zorder=0)
    ax.scatter([p[xk] for p in pts], [p["dome"] for p in pts], s=7 * SC, c=GREY, alpha=0.55, edgecolors="none", zorder=2)
    ln = binned(pts, xk, 10)              # single pooled binned-mean line
    ax.plot([a for a, b in ln], [b for a, b in ln], color="black", lw=1.8, zorder=5)
    ax.scatter([a for a, b in ln], [b for a, b in ln], s=14 * SC, facecolors="white", edgecolors="black", linewidths=1.2, zorder=6)
    plant = [a for a in D["anchors"] if a["kind"] == "plant"]
    if plant:
        ax.scatter([a[xk] for a in plant], [a["dome"] for a in plant], marker="D", s=20 * SC,
                   facecolors=DIAMOND, edgecolors="white", linewidths=0.6, zorder=7)
    for a in D["anchors"]:
        if not a["kind"].startswith("gsp"): continue
        tag = "youngest" if "youngest" in a["kind"] else "oldest"
        ax.scatter([a[xk]], [a["dome"]], marker="*", s=75 * SC, facecolors=GSP_COL[tag], edgecolors="black", linewidths=0.6, zorder=9)
    ax.set_xlabel(XLABEL[xk])
    ax.tick_params(length=0)
    if xk == "tv": ax.set_xlim(left=0)

if mode == "both":
    fig, axes = plt.subplots(1, 2, figsize=figsize, constrained_layout=True)
    panel(axes[0], "tv"); panel(axes[1], "delta")
    axes[0].set_ylabel("Domestication (corrected)")
else:
    fig, ax = plt.subplots(figsize=figsize, constrained_layout=True)
    panel(ax, mode)
    ax.set_ylabel("Domestication (corrected)")

plt.savefig(sys.argv[2])

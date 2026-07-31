# collapse_panels.py <gspcollapse-data.json> <out.pdf>  — the collapse broken out by sweep, for the supplement.
# Top: two large pooled panels, domestication vs lineage divergence under the TV (left) and mean-gap (right)
# lenses, every swept setting as a grey point with a black pooled binned-mean line and the overall Pearson r.
# Below each, a 2x2 block of that lens's four per-sweep collapses (planting effort, seeds saved, planting
# selectivity, metabolic energy), each with its own r. TV panels sit under the TV panel, mean under the mean.
import sys, json
import matplotlib.pyplot as plt

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["font.size"] = 9

D = json.load(open(sys.argv[1]))
pts = D["points"]
SWEEPS = ["planters", "saved%", "selective%", "energy"]
LABEL = {"planters": "Planting effort", "saved%": "Seeds saved", "selective%": "Planting selectivity", "energy": "Metabolic energy"}
XLAB = {"tv": "Total variation (planted vs harvested lineage)", "delta": "Mean lineage-age gap (harvested − planted)"}
GREY = "#a3a3a3"

def pearson(xs, ys):
    n = len(xs)
    if n < 3: return float("nan")
    mx = sum(xs) / n; my = sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs); syy = sum((y - my) ** 2 for y in ys)
    return sxy / (sxx * syy) ** 0.5 if sxx > 0 and syy > 0 else float("nan")

def binned(P, xk, nb=10):
    sp = sorted(P, key=lambda p: p[xk]); per = max(1, -(-len(sp) // nb)); ln = []
    for i in range(0, len(sp), per):
        g = sp[i:i + per]
        if g: ln.append((sum(p[xk] for p in g) / len(g), sum(p["dome"] for p in g) / len(g)))
    return ln

def panel(ax, P, xk, s=6, lw=1.5):
    ax.grid(True, color="#ececec", linewidth=0.6, zorder=0)
    ax.scatter([p[xk] for p in P], [p["dome"] for p in P], s=s, c=GREY, alpha=0.5, edgecolors="none", zorder=2)
    ln = binned(P, xk)
    ax.plot([a for a, b in ln], [b for a, b in ln], color="black", lw=lw, zorder=5)
    ax.tick_params(length=0)
    if xk == "tv": ax.set_xlim(left=0)
    return pearson([p[xk] for p in P], [p["dome"] for p in P])

fig = plt.figure(figsize=(7, 6.7))
gs = fig.add_gridspec(3, 4, height_ratios=[1.55, 1, 1], hspace=0.55, wspace=0.34,
                      left=0.075, right=0.985, top=0.955, bottom=0.085)

# top: two large pooled panels (grey)
axTV = fig.add_subplot(gs[0, 0:2]); rTV = panel(axTV, pts, "tv")
axTV.set_title(f"All sweeps  (r = {rTV:.2f})"); axTV.set_ylabel("Domestication (corrected)"); axTV.set_xlabel(XLAB["tv"], fontsize=8)
axDe = fig.add_subplot(gs[0, 2:4]); rDe = panel(axDe, pts, "delta")
axDe.set_title(f"All sweeps  (r = {rDe:.2f})"); axDe.set_xlabel(XLAB["delta"], fontsize=8)

# per-sweep small panels: TV lens in the left two columns, mean-gap lens in the right two columns
for grp, xk, cols in [(0, "tv", (0, 1)), (1, "delta", (2, 3))]:
    for k, sw in enumerate(SWEEPS):
        rr = 1 + k // 2; cc = cols[k % 2]
        ax = fig.add_subplot(gs[rr, cc]); sp = [p for p in pts if p["sweep"] == sw]
        r = panel(ax, sp, xk, s=5, lw=1.1)
        ax.set_title(f"{LABEL[sw]}  (r = {r:.2f})", fontsize=7.5)
        ax.tick_params(labelsize=6.5)
        if cc == cols[0]: ax.set_ylabel("Domestication", fontsize=7)
fig.text(0.29, 0.02, XLAB["tv"], ha="center", fontsize=8)
fig.text(0.75, 0.02, XLAB["delta"], ha="center", fontsize=8)

plt.savefig(sys.argv[2])
print("wrote", sys.argv[2])

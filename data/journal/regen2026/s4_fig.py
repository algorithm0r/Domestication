# s4_fig.py <out_anchor.pdf> <out_convergence.pdf> — the two Convergence & Robustness figures.
# Fig 1 (anchor): single run | pooled ensemble | running mean +/- 95% CI, for the anchor experiment
#   (p20_plant_bottom, pop 80), showing why individual runs are pooled and how fast the estimate settles.
# Fig 2 (ensemble): histogram of replicates N per setting (stacked by regime) | histogram of the achieved
#   95% CI half-width across all 927 settings, with the 0.02 stopping threshold marked.
# Inputs are fixed paths: s4-anchor.json (from s4-anchor.mjs), csvs/disp20.csv (pooled anchor, from gen-csvs),
# and runner/data/domestication-final-2026/aggregate.json.
import sys, os, json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as colors

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["font.size"] = 10

HERE = os.path.dirname(os.path.abspath(__file__))
RUNNER = os.path.abspath(os.path.join(HERE, "..", "..", "..", "runner"))
ANCHOR_JSON = os.path.join(HERE, "s4-anchor.json")
POOLED_CSV = os.path.join(HERE, "csvs", "disp20.csv")
AGG = os.path.join(RUNNER, "data", "domestication-final-2026", "aggregate.json")
CI_TARGET = 0.02
SKIP = 200   # equilibration samples dropped, as the S3 grids

def colormap():
    bottom = plt.get_cmap("gist_rainbow_r"); top = plt.get_cmap("bwr_r")
    return colors.ListedColormap(np.vstack((top(np.linspace(0.5, 1, 24)), bottom(np.linspace(0.24, 1, 232)))), "m")
CMAP = colormap()

def orient(rows):
    # rows: list of per-tick 20-bin arrays -> oriented (bin, tick) array with equilibration skipped and
    # trailing all-zero ticks trimmed, matching supp_grid.readFile so single and pooled render identically.
    a = np.array(rows, dtype=float)
    if a.ndim != 2 or a.shape[1] < 20:
        return None
    a = a[:, :20]
    last = a.shape[0]
    while last > 0 and not a[last - 1].any():
        last -= 1
    a = a[SKIP:last]
    if not a.size:
        return None
    return a.T[::-1]                       # (bin low..high bottom..top, tick)

def heat(ax, hist, title):
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_title(title, fontsize=10, pad=4)
    if hist is None:
        ax.set_facecolor("#eeeeee"); return
    d = hist.sum(axis=0); d = np.where(d == 0, 1, d)     # per-tick normalization (proportion), as S3
    ax.imshow(hist / d, aspect="auto", cmap=CMAP, vmin=0, vmax=1, origin="upper", interpolation="nearest")

# ---------- Figure 1: anchor vs. hardest boundary case ----------
D = json.load(open(ANCHOR_JSON))
pooled_anchor_rows = [[float(x) for x in ln.split(",")] for ln in open(POOLED_CSV).read().splitlines() if ln.strip()]

def running(ax, domes, title=None):
    # running mean of the non-shattering fraction +/- 95% CI as replicates accumulate, over the 0.02 target
    # zone (grey). ylim fits the funnel but keeps a minimum window so a low-variance case doesn't over-zoom.
    domes = np.asarray(domes, float); n = len(domes)
    ks = np.arange(1, n + 1)
    mean = np.array([domes[:k].mean() for k in ks])
    sd = np.array([domes[:k].std(ddof=1) if k > 1 else np.nan for k in ks])
    half = 1.96 * sd / np.sqrt(ks)
    mfin = mean[-1]
    ax.axhspan(mfin - CI_TARGET, mfin + CI_TARGET, color="#e8e8e8", zorder=0)
    ax.fill_between(ks[1:], (mean - half)[1:], (mean + half)[1:], color="#9ecae1", alpha=0.85, lw=0, zorder=2)
    ax.plot(ks, mean, color="#08519c", lw=1.6, zorder=3)
    if title:
        ax.set_title(title, fontsize=10, pad=4)
    blo = np.nanmin((mean - half)[1:]) if n > 1 else mfin
    bhi = np.nanmax((mean + half)[1:]) if n > 1 else mfin
    lo = min(blo, mfin - 0.035) - 0.005; hi = max(bhi, mfin + 0.035) + 0.005
    ax.set_ylim(max(0.0, lo), min(1.0, hi)); ax.set_xlim(1, n)
    ax.grid(True, color="#f0f0f0", lw=0.6, zorder=1); ax.tick_params(labelsize=8, length=0)
    ax.text(0.5, 0.04, f"n = {n},  final CI half-width = {half[-1]:.3f}", transform=ax.transAxes,
            fontsize=7.5, ha="center", va="bottom", color="#08519c")

fig1 = plt.figure(figsize=(7, 4.7))
gs = fig1.add_gridspec(2, 3, width_ratios=[1, 1, 1.25], wspace=0.3, hspace=0.3,
                       left=0.115, right=0.985, top=0.9, bottom=0.09)
rows_spec = [
    (orient(D["anchor"]["single"]), orient(pooled_anchor_rows), D["anchor"]["domes"], D["anchor"]["label"]),
    (orient(D["worst"]["single"]), orient(D["worst"]["pooled"]), D["worst"]["domes"], D["worst"]["label"]),
]
for r, (single, pooled, domes, label) in enumerate(rows_spec):
    top = (r == 0); bot = (r == len(rows_spec) - 1)
    axS = fig1.add_subplot(gs[r, 0]); heat(axS, single, "Single run" if top else None)
    axP = fig1.add_subplot(gs[r, 1]); heat(axP, pooled, "Pooled ensemble" if top else None)
    axR = fig1.add_subplot(gs[r, 2]); running(axR, domes, "Running mean $\\pm$ 95% CI" if top else None)
    if bot:
        axS.set_xlabel("time", fontsize=9); axP.set_xlabel("time", fontsize=9)
        axR.set_xlabel("replicates included", fontsize=9)
    axR.set_ylabel("non-shattering fraction", fontsize=8.5)
    pos = axS.get_position()
    fig1.text(0.028, (pos.y0 + pos.y1) / 2, label, rotation=90, va="center", ha="center", fontsize=8.3)
fig1.savefig(sys.argv[1])
print("wrote", sys.argv[1], "| anchor n", D["anchor"]["n"], "| worst n", D["worst"]["n"])

# ---------- Figure 2: ensemble-wide replication and precision ----------
A = json.load(open(AGG))
REG = ["wild", "interior", "boundary"]
RCOL = {"wild": "#74c476", "interior": "#6baed6", "boundary": "#fd8d3c"}
Ns = {r: [s["n"] for s in A if s.get("regime") == r] for r in REG}
cis = np.array([s["meanCIhalf"] for s in A if isinstance(s.get("meanCIhalf"), (int, float))])
allN = [s["n"] for s in A]

fig2, (ax1, ax2) = plt.subplots(1, 2, figsize=(7, 2.7))
fig2.subplots_adjust(left=0.085, right=0.985, top=0.88, bottom=0.17, wspace=0.24)

nmax = max(allN); nmin = min(allN)
floor = sum(1 for v in allN if v == nmin)
ax1.hist([Ns[r] for r in REG], bins=np.arange(nmin - 0.5, nmax + 1.5, 1), stacked=True, log=True,
         color=[RCOL[r] for r in REG], label=[r.capitalize() for r in REG], edgecolor="white", linewidth=0.2)
ax1.set_title("Replicates per condition", fontsize=9.5)
ax1.set_xlabel("replicates run", fontsize=9); ax1.set_ylabel("conditions (log)", fontsize=9)
ax1.legend(frameon=False, fontsize=8, loc="upper right"); ax1.tick_params(labelsize=8, length=0)
ax1.set_xlim(nmin - 1, nmax + 1)
ax1.text(0.5, 0.86, f"{floor}/{len(A)} ({100*floor/len(A):.0f}%) converge at the floor of {nmin}",
         transform=ax1.transAxes, fontsize=7.8, ha="center", color="#555555")
for s in ("top", "right"): ax1.spines[s].set_visible(False)

ax2.hist(cis, bins=np.linspace(0, CI_TARGET, 41), color="#6baed6", edgecolor="white", linewidth=0.3)
ax2.axvline(CI_TARGET, color="#c0504d", lw=1.1, ls="--")
ax2.text(CI_TARGET, ax2.get_ylim()[1] * 0.98, f"target {CI_TARGET:g} ", ha="right", va="top", fontsize=8, color="#c0504d")
ax2.set_title("Achieved 95% CI half-width", fontsize=9.5)
ax2.set_xlabel("CI half-width on the mean", fontsize=9); ax2.set_ylabel("conditions", fontsize=9)
ax2.tick_params(labelsize=8, length=0)
for s in ("top", "right"): ax2.spines[s].set_visible(False)
fig2.savefig(sys.argv[2])
print("wrote", sys.argv[2], "| conditions", len(A), "| CI median", round(float(np.median(cis)), 4), "max", round(float(cis.max()), 4))

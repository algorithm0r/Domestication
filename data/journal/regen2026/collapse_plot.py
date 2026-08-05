# collapse_plot.py <collapse-data.json> <out.pdf> — the collapse scatter in the paper style (matplotlib,
# Times New Roman size 10): every setting is one point (corrected domestication vs lineage divergence),
# colored by sweep; a per-sweep binned-mean line in each sweep's color (legend shows each sweep's Pearson
# r), plus the pooled binned-mean line in black. Axis labels + numbers only.
import sys, json
import matplotlib.pyplot as plt

plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["font.size"] = 10

D = json.load(open(sys.argv[1]))

fig, ax = plt.subplots(figsize=(7.6, 5.0), constrained_layout=True)
ax.grid(True, color="#e9e9e9", linewidth=0.6, zorder=0)

# scatter, grouped by sweep
by = {}
for p in D["points"]:
    by.setdefault(p["sweep"], ([], []))
    by[p["sweep"]][0].append(p["tv"])
    by[p["sweep"]][1].append(p["dome"])
for s in D["sweeps"]:
    xs, ys = by.get(s["name"], ([], []))
    lbl = f"{s['name']} (n={s['n']}" + (f", r={s['r']:.2f})" if s["r"] is not None else ")")
    ax.scatter(xs, ys, s=13, c=s["color"], alpha=0.55, edgecolors="none", zorder=2, label=lbl)

# per-sweep binned-mean lines (each sweep's own trace through the collapse)
for s in D["sweeps"]:
    if s["line"]:
        lx = [p["x"] for p in s["line"]]
        ly = [p["y"] for p in s["line"]]
        ax.plot(lx, ly, color=s["color"], lw=2, zorder=3)
        ax.scatter(lx, ly, s=15, color=s["color"], edgecolors="white", linewidths=0.8, zorder=4)

# pooled binned-mean line
pl = D["pooled"]["line"]
plx = [p["x"] for p in pl]
ply = [p["y"] for p in pl]
ax.plot(plx, ply, color="black", lw=2, zorder=5, label=f"pooled (r={D['pooled']['r']:.2f})")
ax.scatter(plx, ply, s=22, facecolors="white", edgecolors="black", linewidths=1.3, zorder=6)

# discrete anchor experiments overlaid on the sweep cloud (not in the pooled r):
# the ten trait-planting runs as outlined diamonds, the two gsp runs as special stars.
anchors = D.get("anchors", [])
plant = [a for a in anchors if a["kind"] == "plant"]
if plant:
    ax.scatter([a["tv"] for a in plant], [a["dome"] for a in plant], marker="D", s=34,
               facecolors="#444444", edgecolors="white", linewidths=0.7, zorder=7,
               label=f"planting experiments (n={len(plant)})")
for a in anchors:
    if a["kind"] != "gsp":
        continue
    ax.scatter([a["tv"]], [a["dome"]], marker="*", s=300, facecolors="#d62728",
               edgecolors="black", linewidths=0.9, zorder=9,
               label="lineage-age planting (gsp)" if "youngest" in a["label"] else None)
    tag = "youngest" if "youngest" in a["label"] else "oldest"
    ax.annotate(tag, (a["tv"], a["dome"]), textcoords="offset points", xytext=(9, -2),
                fontsize=9, color="#d62728", zorder=9)

ax.set_xlabel("lineage divergence  —  TV(planted, harvested gsp)")
ax.set_ylabel("domestication (corrected dome)")
ax.set_xlim(left=0)
ax.legend(loc="upper left", fontsize=9, frameon=False)
ax.tick_params(length=0)

plt.savefig(sys.argv[2])

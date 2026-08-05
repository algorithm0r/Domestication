# hist_first.py <NN>  — the "Unintended Selective Planting / Plant First Harvested" figure (First.pdf).
# Adapted from hist_split.py (its correct Total/Wild/Domesticated normalization — wild/dome divided by
# the TOTAL column's per-tick sums), trimmed to the 3 genes the paper shows (Root Depth, Seed Dispersal,
# Abscission; fecundity omitted). Replaces the original hist_bottom.py, which read pre-normalized .txt
# and did no normalization (raw counts saturated the heatmap).
import sys
import seaborn as sns
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as colors

def readFile(fileName):
    inFile = open('./csvs/' + fileName + '.csv', 'r')
    histogram = [[] for _ in range(20)]
    for i in range(200):            # skip first 200 samples (show 50k-150k)
        next(inFile)
    for line in inFile:
        lines = line[:-1]
        arr = lines.split(',')
        try:
            numArr = [float(num) for num in arr]
            for j in range(20):
                histogram[19 - j].append(numArr[j])
        except ValueError as e:
            print()
    return histogram

def createColorMap():
    bottom = plt.get_cmap("gist_rainbow_r")
    top = plt.get_cmap("bwr_r")
    newcolors = np.vstack((top(np.linspace(0.5, 1, 24)), (bottom(np.linspace(0.24, 1, 232)))))
    return colors.ListedColormap(newcolors, "newMap")

inFiles = []
prefixList = ["roots", "weight", "disp"]      # Root Depth, Seed Dispersal, Abscission (fecundity omitted)
arg = sys.argv[1]
MODE = sys.argv[3] if len(sys.argv) > 3 else "first"      # column-title set: original First, or lineage
TITLES = (["Plant First Harvested", "Plant First Harvested\n        Wild Seeds", "Plant First Harvested\n Domesticated Seeds"]
          if MODE == "first" else
          ["Plant Freshest Lineage", "Plant Freshest Lineage\n        Wild Seeds", "Plant Freshest Lineage\n Domesticated Seeds"])
for name in prefixList:
    inFiles.append(name + arg)
    inFiles.append(name + arg + "wild")
    inFiles.append(name + arg + "dome")

plt.rcParams["font.family"] = "Times New Roman"

rows = 3
cols = 3
fig, axn = plt.subplots(rows, cols, sharey=True)
cbar_ax = fig.add_axes([.86, .08, .01, .82])
fig.subplots_adjust(wspace=0.05, hspace=0.25, right=0.85, bottom=0.08, left=0.10, top=0.90)
c_map = createColorMap()
first_plot_col_sums = None

for plotNum in range(len(inFiles)):
    histogram = readFile(inFiles[plotNum])
    row = ['' for _ in range(20)]
    df = pd.DataFrame(histogram, index=row)
    if plotNum % cols == 0:                    # Total column: store its per-tick sums
        numEntries = df.sum(axis=0)
        first_plot_col_sums = numEntries
    else:                                      # Wild / Dome: normalize against the Total's sums
        numEntries = first_plot_col_sums
    df = df.div(numEntries, axis=1)
    plt.subplot(rows, cols, plotNum + 1)
    axes = plt.gca()
    ax = sns.heatmap(df, vmin=0, vmax=1, cmap=c_map, cbar=plotNum == 0,
                     cbar_ax=None if plotNum < 0 else cbar_ax, cbar_kws={"label": "% of population"})
    ax.margins(0.01)
    if plotNum == 0:
        cbar = ax.collections[0].colorbar
        cbar.set_ticks([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])
        cbar.set_ticklabels(["0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%"], rotation=90, va='center')
    for _, spine in ax.spines.items():
        spine.set_visible(True)
    axes.tick_params(left=False, bottom=False, pad=-4)
    axes.tick_params(axis='x', pad=-1.5)
    title = TITLES
    title_pos = [50, 50, 50]
    if plotNum // cols == 0:  # first row titles — auto-centered over each column
        axes.set_title(title[plotNum], fontsize=10, pad=3)
    if plotNum // cols == rows - 1:
        axes.set_xticks([20, 175], ["50k", "100k"], rotation=0)
    else:
        axes.get_xaxis().set_visible(False)
    if plotNum % 3 != 0:
        axes.set_yticks([3, 17], ["Max", "Min"])
    else:
        axes.tick_params(left=False)
    inTitle = ['Root Depth', 'Seed Dispersal', 'Abscission']
    inTitle_pos = [15, 17, 15]
    if plotNum % cols == 0:
        axes.text(-35, inTitle_pos[plotNum // cols], inTitle[plotNum // cols], fontsize=10, rotation=90)
    if plotNum == cols:
        axes.text(-55, 15, "Gene Value", fontsize=10, rotation=90)
    if plotNum == 2 * cols + cols // 2:
        axes.set_xlabel("Time Step", labelpad=0, fontsize=10)
    axes.title.set_size(10)

plt.savefig(sys.argv[2] if len(sys.argv) > 2 else "First.pdf")

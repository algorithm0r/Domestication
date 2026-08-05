# library
import sys
import seaborn as sns
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as colors

# read files
def readFile(fileName):
    print(fileName)
    inFile = open('./csvs/' + fileName + '.csv', 'r')
    histogram = [[] for _ in range(20)]
    # skip first 200 data points
    numLines = 0
    for i in range(200):
       next(inFile)
    for line in inFile:
        numLines += 1
        if numLines > 400:
            break
        lines = line[:-1]
        arr = lines.split(',')
        try:
            numArr = [float(num) for num in arr]
            for j in range(20):
                histogram[19 - j].append(numArr[j])
        except ValueError as e:
            print()

    #print(numLines)
    return histogram

def createColorMap():
    # put two colormaps end-to-end
    bottom = plt.get_cmap("gist_rainbow_r")
    top = plt.get_cmap("bwr_r")
    newcolors = np.vstack((top(np.linspace(0.5, 1, 24)), (bottom(np.linspace(0.24, 1, 232)))))
    return colors.ListedColormap(newcolors, "newMap")

# import data
inFiles = []

labels = []


# First column = Wild Type III (non-selective harvest + planting) as the baseline the selection
# experiments are read against; each row shows that row's gene under WT III, then the four selection
# conditions for that gene (harvest max/min, plant max/min).
inFiles = ["roots03","roots04","roots08", "roots12", "roots16",
           "seeds03","seeds05","seeds09", "seeds13", "seeds17",
           "weight03","weight06","weight10", "weight14", "weight18",
           "disp03","disp07","disp11", "disp15", "disp19"]
plt.rcParams["font.family"] = "Times New Roman"

plotNum = 1
rows = 4
cols = 5

fig, axn = plt.subplots(rows, cols, sharey=True)
cbar_ax = fig.add_axes([.86, .08, .01, .82])
fig.subplots_adjust(wspace=0.05, hspace=0.25, right=0.85, bottom = 0.08, left=0.10, top=0.90)

c_map = createColorMap()

for plotNum in range(len(inFiles)):
    histogram = readFile(inFiles[plotNum])
    #print(len(histogram[0]))
    row = []
 
    for i in range(20):
        row.append('')

    df = pd.DataFrame(histogram, index=row)
    df = df.div(df.sum(axis=0), axis=1)
    plt.subplot(rows, cols, plotNum+1)

    axes = plt.gca()

    ax = sns.heatmap(df,
                     vmin=0,
                     vmax=1,
                     cmap=c_map,
                     cbar=plotNum == 0,
                     cbar_ax=None if plotNum < 0 else cbar_ax,
                     cbar_kws={"label": "% of population"})

    # Add vertical lines based on column position
    current_col = plotNum % cols

    ax.margins(0.01)
    if plotNum == 0:
        cbar = ax.collections[0].colorbar
        cbar.set_ticks([0,0.1, 0.2,0.3, 0.4,0.5, 0.6,0.7, 0.8,0.9, 1])
        cbar.set_ticklabels(["0%","10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%"], rotation=90, va='center')
    
    # draws the border around each plot
    for _, spine in ax.spines.items():
        spine.set_visible(True)
    
    axes.tick_params(left=False,bottom=False,pad = -4)
    axes.tick_params(axis='x',pad = -1.5)
    
    title = ["Wild Type III","Harvest Max","Harvest Min", "Plant Max", "Plant Min"]
    if plotNum//cols == 0: # first row titles — auto-centered over each column (fits 5 columns)
        axes.set_title(title[plotNum], fontsize=9, pad=3)
    
    # add labels to the bottom row only
    if plotNum//cols == rows - 1:
        axes.set_xticks([20,175],["50k","100k"], rotation = 0)
    else:
        axes.get_xaxis().set_visible(False)
    
    if plotNum%cols != 0:   # Max/Min y-labels — set on the later columns so seaborn's shared-axis reset doesn't clobber them (matches hist_control)
        axes.set_yticks([3,17],["Max","Min"])
    else:
        axes.tick_params(left=False)
    
    inTitle = ['Root Depth', 'Fecundity', 'Seed Dispersal','Abscission']
    inTitle_pos =  [17,16,19,16]
    if plotNum%cols == 0: # first column titles
        axes.text(-58, inTitle_pos[plotNum//cols], inTitle[plotNum//cols], fontsize=10, rotation=90)
    if plotNum == cols:
        axes.text(-92, 30, "Gene Value", fontsize=10, rotation=90)
    if plotNum == 2*cols + cols//2:
        axes.set_xlabel("Time Step", labelpad=0, fontsize=10)
   #     axes.text(310, 25, "Time Step", fontsize=10)
    axes.title.set_size(10)

# --- set the Wild Type III baseline (col 0) apart from the experiment columns (1-4) ---
# wspace is uniform, so open a wider gap after col 0 by assigning explicit x-positions (each
# panel keeps its row y0/height), then draw a dashed divider down the gap.
left, right = 0.10, 0.85
SMALL, BIG = 0.012, 0.0275
pw = (right - left - BIG - (cols - 2) * SMALL) / cols
xs, x = [], left
for c in range(cols):
    xs.append(x)
    x += pw + (BIG if c == 0 else SMALL)
for r in range(rows):
    for c in range(cols):
        p = axn[r][c].get_position()
        axn[r][c].set_position([xs[c], p.y0, pw, p.height])
x_div = xs[0] + pw + BIG / 2.0
y_bot = axn[rows - 1][0].get_position().y0
y_top = axn[0][0].get_position().y1
fig.add_artist(plt.Line2D([x_div, x_div], [y_bot, y_top], transform=fig.transFigure,
                          color='black', linestyle='--', linewidth=0.9))

f = plt.figure(num=1)
plt.savefig("prelims.pdf")

plt.show()

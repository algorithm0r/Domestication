# library
import sys
import seaborn as sns
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as colors
##from matplotlib.mlab import bivariate_normal

# import data
inFiles = []
inTitle = []

labels = []

prefixList = ["roots","seeds","weight","disp"]

for name in prefixList:
    inFiles.append(name+"random"+sys.argv[1])
    inFiles.append(name+"random"+sys.argv[1]+"wild")
    inFiles.append(name+"random"+sys.argv[1]+"dome")

inTitle.append('Root Depth')
inTitle.append('Fecundity')
inTitle.append('Seed Dispersal')
inTitle.append('Abscission')

plt.rcParams["font.family"] = "Times New Roman"

c = 1
fig, axn = plt.subplots(4, 3, sharey=True)
##plt.figure(num = 1, figsize = (10,16), dpi = 80)
cbar_ax = fig.add_axes([.91, .08, .01, .82])
fig.subplots_adjust(wspace=0.05, hspace=0.25, right=0.90, bottom = 0.08, left=0.06, top=0.90)
for x in range(len(inFiles)):
    inFile = open(inFiles[x] + '.txt', 'r')
    histogram = []
    hist = []
    for i in range(20):
        histogram.append([])
    # skip first 100 data points
    for i in range(100):
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

    row = []
    row.append('Max')
    for i in range(16):
        row.append('')
    row.append('Min')
    row.append('Min')
    row.append('Min')
    #for i in range(3):
    #    row.append('')

    df = pd.DataFrame(histogram, index=row)
    plt.subplot(4, 3, c)

    axes = plt.gca()
    bottom = plt.get_cmap("gist_rainbow_r")
    top = plt.get_cmap("bwr_r")
    newcolors = np.vstack((top(np.linspace(0.5, 1, 24)), (bottom(np.linspace(0.24, 1, 232)))))
    c_map = colors.ListedColormap(newcolors, "newMap")
    ax = sns.heatmap(df,
                     vmin=0,
                     vmax=1,
                     cmap=c_map,
                     cbar=c == 4,
                     cbar_ax=None if c < 4 else cbar_ax,
                     cbar_kws={"label": "% of population"})

    ax.margins(0.01)
    if c == 4:
        cbar = ax.collections[0].colorbar
        cbar.set_ticks([0, 0.2, 0.4, 0.6, 0.8, 1])
        cbar.set_ticklabels(["0%", "20%", "40%", "60%", "80%", "100%"], rotation=90, va='center')
    
    # draws the border around each plot
    for _, spine in ax.spines.items():
        spine.set_visible(True)
    title = ["Combined Population","Wild Variant", "Domesticated Variant"]
    title_pos = [8,24,8]
    axes.set_yticks([3,17],["Max","Min"])
    axes.set_xticks([10,88])
    axes.set_xticklabels(["10000","20000"],rotation=0)
    axes.tick_params(left=False,bottom=False,pad = -2.5)
    axes.tick_params(axis='x',pad = -1.5)
    if x//3 == 0: # first row titles
        axes.text(title_pos[x],-6,title[x], size="12")
    if x//3 != 3: # last row ticks
        axes.get_xaxis().set_visible(False)
    if x%3 != 0: # first column axes
        axes.tick_params(left=False)
    if x%3 == 1: # middle column titles
        plt.title(inTitle[x//3],y=1.0,pad=4)
    if x == 6:
        axes.text(-18, 6, "Gene Value", fontsize=12, rotation=90)
    if x == 10:
        axes.set_xlabel("Time Step", labelpad=0, fontsize=12)
    axes.title.set_size(10)
    c += 1

f = plt.figure(num=1)
#f.set_figwidth(3)
#f.set_figheight(8)
plt.savefig("control.pdf")

plt.show()

# library
import sys
import seaborn as sns
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as colors

# read files
def readFile(fileName):
    inFile = open('./csvs/' + fileName + '.csv', 'r')
    histogram = [[] for _ in range(20)]
    # skip first 200 data points
    #numLines = 0
    for i in range(200):
        next(inFile)
    for line in inFile:
    #    numLines += 1
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

prefixList = ["roots", "seeds","weight","disp"]
# prefixList = ["roots","weight","disp"]

for name in prefixList:
    for arg in sys.argv[1:]:
        inFiles.append(name + arg + "dome")


plt.rcParams["font.family"] = "Times New Roman"

plotNum = 1
rows = 4    
cols = len(sys.argv) - 1

fig, axn = plt.subplots(rows, cols, sharey=True)
cbar_ax = fig.add_axes([.86, .08, .01, .82])
fig.subplots_adjust(wspace=0.05, hspace=0.25, right=0.85, bottom = 0.08, left=0.10, top=0.90)

c_map = createColorMap()

for plotNum in range(len(inFiles)):
    full_df = pd.DataFrame(readFile(inFiles[plotNum][:-4]))
    numEntries = full_df.sum(axis=0)

    histogram = readFile(inFiles[plotNum])
    row = []
 
    for i in range(20):
        row.append('')

    df = pd.DataFrame(histogram, index=row)

    df = df.div(numEntries, axis=1)
    plt.subplot(rows, cols, plotNum+1)

    axes = plt.gca()
    ax = sns.heatmap(df,
                     vmin=0,
                     vmax=1,
                     cmap=c_map,
                     cbar=plotNum == 0,
                     cbar_ax=None if plotNum < 0 else cbar_ax,
                     cbar_kws={"label": "% of population"})

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
    
    title = ["        Planting\nMax Root Depth", "      Planting\nMax Fecundity", "      Planting\nMax Dispersal","     Planting\nMin Dispersal", "       Planting\nMin Abscission"]
    title_pos = [0,20,25,30,10]
    if plotNum//cols == 0: # first row titles
        axes.text(title_pos[plotNum],-1,title[plotNum], size="10")
    
    # highlight specific subplots
    if plotNum in [0, 6, 12, 13,19]:  # Change this list to the subplots you want to highlight
        for _, spine in ax.spines.items():
            spine.set_edgecolor('red')  # Set the outline color to red
            spine.set_linewidth(2)  # Make the outline thicker
    else:
        for _, spine in ax.spines.items():
            spine.set_edgecolor('black')  # Default outline color
            spine.set_linewidth(1)  # Default outline width


    # add labels to the bottom row only
    if plotNum//cols == rows - 1:
        axes.set_xticks([50,335],["50k","150k"], rotation = 0) #[25,370] with 3
    else:
        axes.get_xaxis().set_visible(False)
    
    if plotNum%3 != 0: 
        axes.set_yticks([3,17],["Max","Min"])
    else:
        axes.tick_params(left=False)
    
    inTitle = ['Root Depth', 'Fecundity', 'Seed Dispersal','Abscission']
    inTitle_pos =  [17,16,19,16]
    # inTitle = ['Root Depth', 'Seed Dispersal','Abscission']
    # inTitle_pos =  [15,17,15]
    if plotNum%cols == 0: # middle column titles
        axes.text(-115, inTitle_pos[plotNum//cols], inTitle[plotNum//cols], fontsize=10, rotation=90)
    if plotNum == 2*cols:
        axes.text(-180, 5, "Gene Value", fontsize=10, rotation=90)
    if plotNum == 3*cols + cols//2:
   #     axes.set_xlabel("Time Step", labelpad=0, fontsize=10)
        axes.text(80, 27, "Time Step", fontsize=10)
    axes.title.set_size(10)

f = plt.figure(num=1)
plt.savefig("./imgs/domesticationSyndrome.png")
plt.savefig("./imgs/domesticationSyndrome.pdf")

plt.show()

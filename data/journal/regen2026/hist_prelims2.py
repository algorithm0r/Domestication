import matplotlib.pyplot as plt
import matplotlib.colors as colors
import seaborn as sns
import pandas as pd
import numpy as np

# Define file range
prefixes = ["roots", "seeds", "weight", "disp"]
file_ids = [f"{prefixes[i%4]}{i:02}" for i in range(4, 20)]
inFiles = [f"{file_id}" for file_id in file_ids]

# Helper function to read file and get one histogram
def readFile(fileName):
    inFile = open('./csvs/' + fileName + '.csv', 'r')
    histogram = [[] for _ in range(20)]
    numLines = 0

    for line in inFile:
        numLines += 1
        if numLines > 400:
            break
        
        lines = line[:-1]
        lines = line.split(',')
        try:
            numArr = [float(num) for num in lines]
            for j in range(20):
                histogram[19 - j].append(numArr[j])
        except ValueError:
            continue

    inFile.close()
    return histogram

# Custom colormap
def createColorMap():
    bottom = plt.get_cmap("gist_rainbow_r")
    top = plt.get_cmap("bwr_r")
    newcolors = np.vstack((top(np.linspace(0.5, 1, 24)), bottom(np.linspace(0.24, 1, 232))))
    return colors.ListedColormap(newcolors, "newMap")

plt.rcParams["font.family"] = "Times New Roman"

# Set up plot grid
fig, axn = plt.subplots(4, 4, sharey=True)
cbar_ax = fig.add_axes([.86, .08, .01, .82])
fig.subplots_adjust(wspace=0.05, hspace=0.25, right=0.85, bottom=0.08, left=0.10, top=0.90)

# Create colormap
c_map = createColorMap()

# Iterate through files and plots
for plotNum, inFile in enumerate(inFiles):
    histogram = readFile(inFile)  
    df = pd.DataFrame([histogram])
    df = df.div(df.sum(axis=0), axis=1)  # Normalize

    ax = axn[plotNum // 4, plotNum % 4]
    sns.heatmap(df,
                vmin=0,
                vmax=1,
                cmap=c_map,
                ax=ax,
                cbar=(plotNum == 0),
                cbar_ax=cbar_ax if plotNum == 0 else None,
                cbar_kws={"label": "% of population"})

    ax.set_xticks([])
    ax.set_yticks([])

# Adjust final layout and save
fig.text(0.5, 0.04, "Time Step", ha='center', fontsize=10)
fig.text(0.04, 0.5, "Gene Value", va='center', rotation='vertical', fontsize=10)
plt.savefig("modified_control.pdf")
plt.show()

# library
import sys
import seaborn as sns
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as colors
##from matplotlib.mlab import bivariate_normal

# read files
def readFile(fileName, skip):
    inFile = open(fileName + '.txt', 'r')
    histogram = [[] for _ in range(20)]
    # skip first <skip> data points
    for i in range(skip):
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

histogram = readFile("disp08", 0)

plt.rcParams["font.family"] = "Times New Roman"

# put two colormaps end-to-end
bottom = plt.get_cmap("gist_rainbow_r")
top = plt.get_cmap("bwr_r")
newcolors = np.vstack((top(np.linspace(0.5, 1, 24)), (bottom(np.linspace(0.24, 1, 232)))))
c_map = colors.ListedColormap(newcolors, "newMap")

fig, axn = plt.subplots()

row = []
row.append('Max')
for i in range(16):
    row.append('')
row.append('Min')
row.append('')
row.append('')

df = pd.DataFrame(histogram, index=row)
print(df.shape)

axes = plt.gca()
ax = sns.heatmap(df,
                     vmin=0,
                     vmax=1,
                     cmap=c_map)

ax.margins(0.01)
    

f = plt.figure(num=1)
plt.savefig("control.pdf")

plt.show()

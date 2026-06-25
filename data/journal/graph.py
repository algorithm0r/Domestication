import matplotlib.pyplot as plt
import pandas as pd
import sys
from matplotlib.ticker import FuncFormatter

def plot_domestic_population_data(metadata_file):
    plt.figure(figsize=(6, 3.6))

    # Read the metadata file to get filenames and labels
    with open(metadata_file, 'r') as file:
        title, xlabel, ylabel = file.readline().split(", ")
        for line in file:
            parts = line.strip().split(',')
            if len(parts) != 2:
                print(f"Skipping invalid line: {line}")
                continue

            filename, label = parts
            try:
                # Read the full data (first row) and domestic population data (third row)
                data = pd.read_csv(filename, header=None)
                full_data = data.iloc[0]  # First row - full data
                domestic_population_data = data.iloc[2]  # Third row - domestic population data
                
                # Skip the first 200 data points for both
                full_data = full_data[200:]
                domestic_population_data = domestic_population_data[200:]
                
                # Convert to numeric
                full_data = pd.to_numeric(full_data, errors='coerce')
                domestic_population_data = pd.to_numeric(domestic_population_data, errors='coerce')
                
                # Calculate percentage: (domestic / full) * 100
                percentage_data = (domestic_population_data / full_data) * 100

                # Plot the percentage data using the label from the metadata file
                plt.plot(percentage_data, label=label)
            except Exception as e:
                print(f"Error processing {filename}: {e}")

    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    plt.legend()
    
    # Format x-axis to show actual generation numbers (index * 250)
    ax = plt.gca()
    ax.xaxis.set_major_formatter(FuncFormatter(lambda x, pos: f'{int((x) * 250 / 1000)}k'))
    
    plt.savefig(sys.argv[1][:-4] + ".png")
    plt.savefig(sys.argv[1][:-4] + ".pdf")
    plt.show()

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python script.py metadata_file.csv")
    else:
        metadata_file = sys.argv[1]
        plot_domestic_population_data(metadata_file)
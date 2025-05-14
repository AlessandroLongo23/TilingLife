import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# 1. load the data
df = pd.read_csv("./out/tiling-graph-3.csv")

# identify Conway’s Game of Life by its rule string
life_str = "B3/S23"
life_row = df[df["rulestr"] == life_str].iloc[0]
life_rho = life_row["rho"]
life_D   = life_row["D"]

# 2. ρ–D scatter
plt.figure()
plt.scatter(df["rho"], df["D"], alpha=0.5)
plt.scatter([life_rho], [life_D], color="orange", edgecolors="black", s=80, label="Game of Life")
plt.legend()
plt.xlabel("ρ (density)")
plt.ylabel("D (complexity)")
plt.title("Density vs Complexity")
plt.grid(True)
plt.tight_layout()
plt.show()

# 3. complexity vs rule index
plt.figure()
plt.plot(df["rule"], df["D"], marker="o", linestyle="", alpha=0.5, label="all rules")
plt.scatter([life_row["rule"]], [life_D], color="orange", edgecolors="black", s=80, label="Game of Life")
plt.legend()
plt.xlabel("Rule index")
plt.ylabel("D (complexity)")
plt.title("Complexity for each rule")
plt.grid(True)
plt.tight_layout()
plt.show()

# 4. 100 closest rules to Game of Life in the ρ–D plane
# compute Euclidean distance in (rho, D)
df["dist"] = np.sqrt((df["rho"] - life_rho)**2 + (df["D"] - life_D)**2)

# exclude the Game of Life itself and pick 100 nearest
nearest = df[df["rulestr"] != life_str].nsmallest(100, "dist")

plt.figure()
plt.scatter(nearest["rho"], nearest["D"], alpha=0.7)
# annotate each point with its rulestr
for _, row in nearest.iterrows():
    plt.text(row["rho"], row["D"], row["rulestr"],
             fontsize=6, ha="right", va="bottom")

# also mark Game of Life in orange
plt.scatter([life_rho], [life_D], color="orange", edgecolors="black", s=80, label="Game of Life")
plt.legend()
plt.xlabel("ρ (density)")
plt.ylabel("D (complexity)")
plt.title("100 Rules Closest to Game of Life")
plt.grid(True)
plt.tight_layout()
plt.show()


import taichi as ti
import numpy as np
import time
import logging
import json

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

alive_p = 0.5
iterations = 10
random_starts = 5
infile = "tiling-graph.json"
outfile = "output.json"

ti.init(arch=ti.gpu, default_fp=ti.f32, default_ip=ti.i32, random_seed=int(time.time()))

with open(infile, "r") as f:
    data = json.load(f)
    logger.info(f"Loaded {data}")

nodes = int(data["n"])
logger.info(f"Nodes: {nodes}")

nlist = [[] for _ in range(nodes)]

for edge in data["edges"]:
    t = edge["type"] # either "side" or "vertex"
    u = edge["source"]
    v = edge["target"]
    nlist[u].append(v)
    nlist[v].append(u)

maxn = 0
for n in nlist:
    maxn = max(maxn, len(n))

logger.info(f"Max neighbors: {maxn}")

neighbors = ti.field(dtype=ti.i32, shape=(nodes, maxn))
for i in range(nodes):
    for j in range(len(nlist[i])):
        neighbors[i, j] = nlist[i][j]
    for j in range(len(nlist[i]), maxn):
        neighbors[i, j] = -1

current = ti.field(dtype=ti.i32, shape=(nodes))
next = ti.field(dtype=ti.i32, shape=(nodes))

# Random initialiazion

for i in range(nodes):
    if np.random.rand() < alive_p:
        current[i] = 1
    else:
        current[i] = 0


@ti.func
def count_neighbors(i):
    count = 0
    for j in range(maxn):
        neighbor_idx = neighbors[i, j]
        if neighbor_idx >= 0:
            if current[neighbor_idx] == 1:
                count += 1
    return count

@ti.kernel
def entry():
    for i in range(nodes):
        count = count_neighbors(i)
        if current[i] == 1:
            if count < 2 or count > 3:
                next[i] = 0
            else:
                next[i] = 1
        else:
            if count == 3:
                next[i] = 1
            else:
                next[i] = 0

# Add a kernel to swap buffers
@ti.kernel
def swap_buffers():
    for i in range(nodes):
        current[i] = next[i]

# Fix the iteration loop
iterations_out = []
for it in range(iterations):
    # print("State before iteration", it)
    # print_state()
    
    # Run the Game of Life rules
    entry()
    
    # Properly swap buffers using a Taichi kernel
    swap_buffers()
    
    # Record the state - you'll need to read back to Python
    iter_out = []
    for i in range(nodes):
        # Access Taichi field from Python correctly
        iter_out.append(current[i])
    
    iterations_out.append(iter_out)
    
    # Count alive cells via a Taichi kernel for better performance
    alive_count = 0
    for i in range(nodes):
        if current[i] == 1:
            alive_count += 1
    
    logger.info(f"Iteration {it}: Alive count: {alive_count}/{nodes}")

with open(outfile, "w") as f:
    json.dump(iterations_out, f, indent=2)
    logger.info(f"Output saved to {outfile}")
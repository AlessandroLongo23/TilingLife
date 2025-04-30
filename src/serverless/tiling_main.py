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

# Load graph data
with open(infile, "r") as f:
    data = json.load(f)
    logger.info(f"Loaded {data}")

nodes = int(data["n"])
logger.info(f"Nodes: {nodes}")

# Build neighbor lists
nlist = [[] for _ in range(nodes)]
for edge in data["edges"]:
    u = edge["source"]
    v = edge["target"]
    nlist[u].append(v)
    nlist[v].append(u)

# Get max neighbor count to set field dimensions
maxn = max(len(n) for n in nlist)
logger.info(f"Max neighbors: {maxn}")

# Define Taichi fields
neighbors = ti.field(dtype=ti.i32, shape=(nodes, maxn))
neighbor_count = ti.field(dtype=ti.i32, shape=(nodes))
current = ti.field(dtype=ti.i32, shape=(nodes))
next = ti.field(dtype=ti.i32, shape=(nodes))

# Store states for all iterations at once
all_states = ti.field(dtype=ti.i32, shape=(iterations+1, nodes))
alive_counts = ti.field(dtype=ti.i32, shape=(iterations+1))

# Initialize neighbor lists in Taichi fields
@ti.kernel
def init_neighbors():
    for i in range(nodes):
        neighbor_count[i] = 0
        
@ti.kernel
def set_neighbor(node: ti.i32, idx: ti.i32, value: ti.i32):
    neighbors[node, idx] = value
    neighbor_count[node] = ti.max(neighbor_count[node], idx + 1)

# Random initialization
@ti.kernel
def init_random():
    for i in range(nodes):
        if ti.random() < alive_p:
            current[i] = 1
        else:
            current[i] = 0
        # Store initial state
        all_states[0, i] = current[i]
    
    # Count alive cells in initial state
    alive_count = 0
    for i in range(nodes):
        if current[i] == 1:
            alive_count += 1
    alive_counts[0] = alive_count

@ti.func
def count_neighbors(i):
    count = 0
    for j in range(neighbor_count[i]):
        neighbor_idx = neighbors[i, j]
        if neighbor_idx >= 0 and current[neighbor_idx] == 1:
            count += 1
    return count

@ti.kernel
def apply_rules():
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

@ti.kernel
def swap_buffers(iteration: ti.i32):
    alive_count = 0
    for i in range(nodes):
        current[i] = next[i]
        # Store state for this iteration
        all_states[iteration, i] = current[i]
        if current[i] == 1:
            alive_count += 1
    alive_counts[iteration] = alive_count

# Initialize neighbor data from Python
for i in range(nodes):
    for j, neighbor in enumerate(nlist[i]):
        set_neighbor(i, j, neighbor)
    # Fill remaining slots with -1
    for j in range(len(nlist[i]), maxn):
        set_neighbor(i, j, -1)

# Initialize random state
init_random()

# Run all iterations at once
for it in range(1, iterations + 1):
    apply_rules()
    swap_buffers(it)
    logger.info(f"Iteration {it}: Alive count: {alive_counts[it]}/{nodes}")

# Extract results back to Python (only once at the end)
iterations_out = []
for it in range(iterations + 1):
    iter_out = []
    for i in range(nodes):
        iter_out.append(all_states[it, i])
    iterations_out.append(iter_out)

# Write results
with open(outfile, "w") as f:
    json.dump(iterations_out, f, indent=2)
    logger.info(f"Output saved to {outfile}")
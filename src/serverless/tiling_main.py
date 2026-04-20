import taichi as ti
import numpy as np
import time
import logging
import json
import math

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

alive_p = 0.2
iterations = 500
random_starts = 100 # Number of different starting configurations
infile = "tiling-graph.json"
outfile = "output.json"

ti.init(arch=ti.gpu, default_fp=ti.f32, default_ip=ti.i32, random_seed=int(time.time()))

# Load graph data
with open(infile, "r") as f:
    data = json.load(f)
    logger.info(f"Loaded {data}")

nodes_per_config = int(data["n"])
logger.info(f"Nodes per configuration: {nodes_per_config}")

# Duplicate nodes for multiple starting configurations
nodes = nodes_per_config * random_starts
logger.info(f"Total nodes after duplication: {nodes}")

# Build neighbor lists with appropriate offsets
nlist = [[] for _ in range(nodes)]
for config_idx in range(random_starts):
    offset = config_idx * nodes_per_config
    
    # Add edges with the appropriate offset
    for edge in data["edges"]:
        u = edge["source"] + offset
        v = edge["target"] + offset
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

# Metrics fields - we'll calculate these at the end
density = ti.field(dtype=ti.f32, shape=(iterations+1))
marginal_entropy = ti.field(dtype=ti.f32, shape=(iterations+1))
conditional_entropy = ti.field(dtype=ti.f32, shape=(iterations+1))
complexity = ti.field(dtype=ti.f32, shape=(iterations+1))

# Efficient neighbor initialization using NumPy arrays to minimize kernel calls
@ti.kernel
def init_all_neighbors(neighbors_np: ti.types.ndarray(), counts_np: ti.types.ndarray()):
    for i in range(nodes):
        neighbor_count[i] = counts_np[i]
        for j in range(counts_np[i]):
            neighbors[i, j] = neighbors_np[i, j]
        # Fill remaining with -1
        for j in range(counts_np[i], maxn):
            neighbors[i, j] = -1

# Random initialization
@ti.kernel
def init_random():
    alive_count = 0
    for i in range(nodes):
        if ti.random() < alive_p:
            current[i] = 1
            alive_count += 1
        else:
            current[i] = 0
        # Store initial state
        all_states[0, i] = current[i]
    
    # Store alive count directly in the field
    alive_counts[0] = alive_count

@ti.func
def count_neighbors(i):
    count = 0
    for j in range(neighbor_count[i]):
        neighbor_idx = neighbors[i, j]
        if neighbor_idx >= 0 and current[neighbor_idx] == 1:
            count += 1
    return count

logger.info(f"Computing set of rules, with {maxn} neighbors per node")
rcount = 2 ** (2 * maxn)
logger.info(f"{rcount} rules to compute")

should_survive = ti.field(dtype=ti.i32, shape=(maxn))
should_spawn = ti.field(dtype=ti.i32, shape=(maxn))

@ti.kernel
def apply_rules():
    for i in range(nodes):
        count = count_neighbors(i)
        if current[i] == 1:
            # Cell is alive
            if should_survive[count] == 1:
                next[i] = 1
            else:
                next[i] = 0
        else:
            # Cell is dead
            if should_spawn[count] == 1:
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

# Calculate density for a single iteration
@ti.kernel
def calculate_density(iteration: ti.i32):
    density[iteration] = alive_counts[iteration] / nodes

def set_rule_from_i(i):
    """
    Set the birth and survival rules based on the index i
    i: index from 0 to 2^18 - 1 (= 262143)
    for Conway's Game of Life, the rule is 6152
    """
    for j in range(9):
        if (i >> j) & 1:
            should_spawn[j] = 1
        else:
            should_spawn[j] = 0

    for j in range(9):
        if (i >> (j + 9)) & 1:
            should_survive[j] = 1
        else:
            should_survive[j] = 0

def rule_index_to_string(i: int) -> str:
    birth = ''.join(str(n) for n in range(9) if (i >> n) & 1)
    survive = ''.join(str(n) for n in range(9) if (i >> (n + 9)) & 1)
    return f"B{birth}/S{survive}"

for i in range(rcount):
    set_rule_from_i(i)
    logger.info(f"Running simulation with rule {rule_index_to_string(i)}")


    # Prepare neighbor data with NumPy arrays
    neighbors_np = np.full((nodes, maxn), -1, dtype=np.int32)
    counts_np = np.zeros(nodes, dtype=np.int32)

    for i in range(nodes):
        counts_np[i] = len(nlist[i])
        for j, neighbor in enumerate(nlist[i]):
            neighbors_np[i, j] = neighbor

    # Initialize neighbors efficiently with a single kernel call
    init_all_neighbors(neighbors_np, counts_np)

    # Free the NumPy arrays as they're no longer needed
    del neighbors_np
    del counts_np

    # Initialize random state
    init_random()

    # Run all iterations at once
    calculate_density(0)  # Calculate density during simulation
    logger.info(f"Iteration 0: Alive count: {alive_counts[0]}/{nodes}, ρ={density[0]:.4f}")

    for it in range(1, iterations + 1):
        apply_rules()
        swap_buffers(it)
        calculate_density(it)
        logger.debug(f"Iteration {it}: Alive count: {alive_counts[it]}/{nodes}, ρ={density[it]:.4f}")
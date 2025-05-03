import taichi as ti
import numpy as np
import time
import logging
import json
import math

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

alive_p = 0.2
iterations = 20
random_starts = 1  # Number of different starting configurations
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

# Calculate density for a single iteration
@ti.kernel
def calculate_density(iteration: ti.i32):
    alive_count = 0
    for i in range(nodes):
        if all_states[iteration, i] == 1:
            alive_count += 1
    density[iteration] = alive_count / nodes

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
calculate_density(0)  # Only calculate density during simulation
logger.info(f"Iteration 0: Alive count: {alive_counts[0]}/{nodes}, ρ={density[0]:.4f}")

for it in range(1, iterations + 1):
    apply_rules()
    swap_buffers(it)
    calculate_density(it)
    logger.info(f"Iteration {it}: Alive count: {alive_counts[it]}/{nodes}, ρ={density[it]:.4f}")

# Calculate metrics only for the final iteration
def calculate_final_metrics():
    start_time = time.time()
    logger.info("Calculating metrics for final iteration...")
    
    # Extract final state to numpy
    state = np.zeros(nodes, dtype=np.int32)
    for i in range(nodes):
        state[i] = all_states[iterations, i]
    
    # 1. Density already calculated during simulation
    rho = density[iterations]
    
    # 2. Calculate marginal entropy H(S)
    h_s = 0.0
    if 0 < rho < 1:
        h_s = -(rho * math.log2(rho) + (1-rho) * math.log2(1-rho))
    marginal_entropy[iterations] = h_s
    
    # 3. Calculate conditional entropy
    joint_counts = np.zeros((2, 2), dtype=np.int32)
    total_pairs = 0
    
    for i in range(nodes):
        cell_state = state[i]
        for neighbor_idx in nlist[i]:
            neighbor_state = state[neighbor_idx]
            joint_counts[cell_state, neighbor_state] += 1
            total_pairs += 1
    
    # Convert to joint probability
    p_joint = joint_counts / total_pairs if total_pairs > 0 else np.zeros((2, 2))
    
    # Calculate conditional entropy H(S|X)
    p_x = np.sum(p_joint, axis=0)  # Marginal probability of neighbors
    h_cond = 0.0
    
    for s in [0, 1]:
        for x in [0, 1]:
            if p_joint[s, x] > 0 and p_x[x] > 0:
                p_s_given_x = p_joint[s, x] / p_x[x]
                h_cond -= p_joint[s, x] * math.log2(p_s_given_x)
    
    conditional_entropy[iterations] = h_cond
    
    # 4. Calculate complexity (D)
    d = h_s - h_cond
    complexity[iterations] = max(0.0, d)  # Ensure non-negative
    
    end_time = time.time()
    logger.info(f"Metrics calculation completed in {end_time - start_time:.3f} seconds")
    
    # Log the results
    logger.info(f"Final metrics - Iteration {iterations}")
    logger.info(f"  ρ={rho:.4f}, H(S)={h_s:.4f}, G={h_cond:.4f}, D={max(0.0, d):.4f}")

    # Return values for the metrics output
    return {
        "iterations": iterations + 1,
        "nodes": nodes,
        "density": [float(density[it]) for it in range(iterations + 1)],
        "marginal_entropy": float(h_s),
        "conditional_entropy": float(h_cond),
        "complexity": float(max(0.0, d))
    }

# Calculate metrics only for the final iteration
metrics_out = calculate_final_metrics()

iterations_out = []
if False:
    for it in range(iterations + 1):
        iter_out = []
        for i in range(nodes):
            iter_out.append(all_states[it, i])
        iterations_out.append(iter_out)

# Write results
with open(outfile, "w") as f:
    output_data = {
        "states": iterations_out,
        "metrics": metrics_out
    }
    json.dump(output_data, f, indent=2)
    logger.info(f"Output saved to {outfile}")
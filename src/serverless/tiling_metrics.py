import taichi as ti
import numpy as np
import time
import logging
import json

# ─── Logging ────────────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# ─── Parameters ────────────────────────────────────────────────────────────
alive_p    = 0.2
iterations = 1000
infile     = "tiling-graph.json"
outfile    = "output.json"

# ─── Taichi init ───────────────────────────────────────────────────────────
ti.init(
    arch=ti.gpu,
    default_fp=ti.f32,
    default_ip=ti.i32,
    random_seed=int(time.time())
)

# ─── Load graph ────────────────────────────────────────────────────────────
with open(infile, "r") as f:
    data = json.load(f)
    logger.info(f"Loaded graph: {data}")

nodes = int(data["n"])
# Build Python neighbor list
nlist = [[] for _ in range(nodes)]
for edge in data["edges"]:
    u, v = edge["source"], edge["target"]
    nlist[u].append(v)
    nlist[v].append(u)

maxn = max(len(nb) for nb in nlist)
logger.info(f"Max neighbors per node: {maxn}")

# ─── Taichi fields ─────────────────────────────────────────────────────────
neighbors       = ti.field(dtype=ti.i32, shape=(nodes, maxn))
neighbor_count  = ti.field(dtype=ti.i32, shape=(nodes,))
current, next_ = ti.field(dtype=ti.i32, shape=(nodes,)), ti.field(dtype=ti.i32, shape=(nodes,))
all_states      = ti.field(dtype=ti.i32, shape=(iterations+1, nodes))
alive_counts    = ti.field(dtype=ti.i32, shape=(iterations+1,))

# Metric fields
rho_field = ti.field(dtype=ti.f32, shape=(iterations+1,))
H_field   = ti.field(dtype=ti.f32, shape=(iterations+1,))
G_field   = ti.field(dtype=ti.f32, shape=(iterations+1,))
D_field   = ti.field(dtype=ti.f32, shape=(iterations+1,))

# ─── Kernels & funcs ───────────────────────────────────────────────────────
@ti.kernel
def init_neighbors():
    for i in range(nodes):
        neighbor_count[i] = 0
        for j in range(maxn):
            neighbors[i, j] = -1

@ti.kernel
def set_neighbor(node: ti.i32, idx: ti.i32, value: ti.i32):
    neighbors[node, idx] = value
    neighbor_count[node] = ti.max(neighbor_count[node], idx + 1)

@ti.func
def safe_log2(x: ti.f32) -> ti.f32:
    return ti.log(x) / ti.log(2.0)

@ti.kernel
def init_random():
    # random start + store state 0
    alive = 0
    for i in range(nodes):
        current[i] = 1 if ti.random() < alive_p else 0
        all_states[0, i] = current[i]
        alive += current[i]
    alive_counts[0] = alive

    # metrics at t=0
    rho       = alive / nodes
    rho_field[0] = rho
    # marginal entropy
    if 0 < rho < 1:
        H_field[0] = - (rho * safe_log2(rho) + (1 - rho) * safe_log2(1 - rho))
    else:
        H_field[0] = 0.0
    G_field[0] = 0.0
    D_field[0] = 0.0

@ti.func
def count_neighbors(i: ti.i32) -> ti.i32:
    s = 0
    for j in range(neighbor_count[i]):
        nb = neighbors[i, j]
        if nb >= 0 and current[nb] == 1:
            s += 1
    return s

@ti.kernel
def apply_rules():
    for i in range(nodes):
        c = count_neighbors(i)
        if current[i] == 1:
            next_[i] = 1 if 2 <= c <= 3 else 0
        else:
            next_[i] = 1 if c == 3 else 0

@ti.kernel
def swap_buffers(iteration: ti.i32):
    alive = 0
    # pair counts: [00, 01, 10, 11]
    pc0 = ti.i32(0)
    pc1 = ti.i32(0)
    pc2 = ti.i32(0)
    pc3 = ti.i32(0)

    for i in range(nodes):
        current[i] = next_[i]
        all_states[iteration, i] = current[i]
        alive += current[i]

        # accumulate (s, x) pairs over edges
        for j in range(neighbor_count[i]):
            nb = neighbors[i, j]
            if nb >= 0:
                idx = current[i] * 2 + current[nb]
                if   idx == 0: pc0 += 1
                elif idx == 1: pc1 += 1
                elif idx == 2: pc2 += 1
                else:           pc3 += 1

    alive_counts[iteration] = alive

    # ρ
    rho = alive / nodes
    rho_field[iteration] = rho

    # H
    H = 0.0
    if 0 < rho < 1:
        H = - (rho * safe_log2(rho) + (1 - rho) * safe_log2(1 - rho))
    H_field[iteration] = H

    # G & D
    total = pc0 + pc1 + pc2 + pc3
    if total > 0:
        P0, P1, P2, P3 = pc0/total, pc1/total, pc2/total, pc3/total
        Px0, Px1     = P0+P2,          P1+P3
        G = 0.0
        if P0 > 0: G -= P0*safe_log2(P0/Px0)
        if P2 > 0: G -= P2*safe_log2(P2/Px0)
        if P1 > 0: G -= P1*safe_log2(P1/Px1)
        if P3 > 0: G -= P3*safe_log2(P3/Px1)
        G_field[iteration] = G
        D_field[iteration] = H - G
    else:
        G_field[iteration] = 0.0
        D_field[iteration] = 0.0

# ─── Setup & run ───────────────────────────────────────────────────────────
init_neighbors()
for i in range(nodes):
    for j, nb in enumerate(nlist[i]):
        set_neighbor(i, j, nb)

init_random()
for it in range(1, iterations+1):
    apply_rules()
    swap_buffers(it)
    logger.info(
        f"Iter {it}: alive={alive_counts[it]}, "
        f"ρ={rho_field[it]:.3f}, H={H_field[it]:.3f}, "
        f"G={G_field[it]:.3f}, D={D_field[it]:.3f}"
    )

# ─── Extract & save ────────────────────────────────────────────────────────
states    = all_states.to_numpy()
alive_out = alive_counts.to_numpy()
rho_out   = rho_field.to_numpy()
H_out     = H_field.to_numpy()
G_out     = G_field.to_numpy()
D_out     = D_field.to_numpy()

output = {
    "states":       states.tolist(),
    "alive_counts": alive_out.tolist(),
    "rho":          rho_out.tolist(),
    "H":            H_out.tolist(),
    "G":            G_out.tolist(),
    "D":            D_out.tolist(),
}

with open(outfile, "w") as f:
    json.dump(output, f, indent=2)
    logger.info(f"Results saved to {outfile}")
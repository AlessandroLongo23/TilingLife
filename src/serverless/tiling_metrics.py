import taichi as ti
import numpy as np
import time
import logging
import json
import math
import csv

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

alive_p        = 0.2
iterations     = 1000
random_starts  = 100
infile         = "tiling-graph.json"
outfile        = "metrics.csv"          # <── CSV

ti.init(arch=ti.gpu,
        default_fp=ti.f32,
        default_ip=ti.i32,
        random_seed=int(time.time()))

# ----------------------------------------------------------------------
#  graph loading (unchanged)
# ----------------------------------------------------------------------
with open(infile, "r") as f:
    data = json.load(f)

nodes_per_config = int(data["n"])
nodes            = nodes_per_config * random_starts

nlist = [[] for _ in range(nodes)]
for cfg in range(random_starts):
    off = cfg * nodes_per_config
    for e in data["edges"]:
        u = e["source"] + off
        v = e["target"] + off
        nlist[u].append(v)
        nlist[v].append(u)

maxn = max(len(n) for n in nlist)

# ----------------------------------------------------------------------
#  Taichi fields + kernels  (identical to previous reply)
# ----------------------------------------------------------------------
neighbors       = ti.field(ti.i32, shape=(nodes, maxn))
neighbor_count  = ti.field(ti.i32, shape=(nodes))
current         = ti.field(ti.i32, shape=(nodes))
next            = ti.field(ti.i32, shape=(nodes))

all_states      = ti.field(ti.i32, shape=(iterations + 1, nodes))
alive_counts    = ti.field(ti.i32, shape=(iterations + 1))

density              = ti.field(ti.f32, shape=(iterations + 1))
marginal_entropy     = ti.field(ti.f32, shape=(iterations + 1))
conditional_entropy  = ti.field(ti.f32, shape=(iterations + 1))
complexity           = ti.field(ti.f32, shape=(iterations + 1))
joint_counts         = ti.field(ti.i32, shape=(iterations + 1, 4))

LN2 = 0.6931471805599453

@ti.func
def log2f(x: ti.f32) -> ti.f32:
    return ti.log(x) / ti.static(LN2)

@ti.kernel
def init_all_neighbors(neigh_np: ti.types.ndarray(), cnt_np: ti.types.ndarray()):
    for i in range(nodes):
        neighbor_count[i] = cnt_np[i]
        for j in range(cnt_np[i]):
            neighbors[i, j] = neigh_np[i, j]
        for j in range(cnt_np[i], maxn):
            neighbors[i, j] = -1

@ti.kernel
def init_random():
    alive = 0
    for i in range(nodes):
        if ti.random() < alive_p:
            current[i] = 1
            alive += 1
        else:
            current[i] = 0
        all_states[0, i] = current[i]
    alive_counts[0] = alive

@ti.func
def count_neighbors(i):
    c = 0
    for j in range(neighbor_count[i]):
        nb = neighbors[i, j]
        if nb >= 0 and current[nb] == 1:
            c += 1
    return c

should_survive = ti.field(ti.i32, shape=(maxn))
should_spawn   = ti.field(ti.i32, shape=(maxn))
rcount         = 2 ** (2 * maxn)

@ti.kernel
def apply_rules():
    for i in range(nodes):
        c = count_neighbors(i)
        if current[i] == 1:
            next[i] = 1 if should_survive[c] else 0
        else:
            next[i] = 1 if should_spawn[c] else 0

@ti.kernel
def swap_buffers(iteration: ti.i32):
    alive = 0
    for i in range(nodes):
        current[i]       = next[i]
        all_states[iteration, i] = current[i]
        if current[i] == 1:
            alive += 1
    alive_counts[iteration] = alive

@ti.kernel
def calculate_density(iteration: ti.i32):
    density[iteration] = alive_counts[iteration] / nodes

@ti.kernel
def compute_metrics(iteration: ti.i32):
    for k in ti.static(range(4)):
        joint_counts[iteration, k] = 0
    for i in range(nodes):
        s = current[i]
        for j in range(neighbor_count[i]):
            nb = neighbors[i, j]
            if nb >= 0:
                u   = current[nb]
                ti.atomic_add(joint_counts[iteration, s*2+u], 1)

    c00 = ti.cast(joint_counts[iteration, 0], ti.f32)
    c01 = ti.cast(joint_counts[iteration, 1], ti.f32)
    c10 = ti.cast(joint_counts[iteration, 2], ti.f32)
    c11 = ti.cast(joint_counts[iteration, 3], ti.f32)
    tot = c00 + c01 + c10 + c11

    ρ   = density[iteration]
    H   = 0.0
    eps = 1e-6
    if ρ > eps and ρ < 1.0 - eps:
        H = -(ρ*log2f(ρ) + (1-ρ)*log2f(1-ρ))
    marginal_entropy[iteration] = H

    if tot > 0:
        p00, p01, p10, p11 = c00/tot, c01/tot, c10/tot, c11/tot
        Pu0, Pu1 = p00+p10, p01+p11
        G = 0.0
        if p00 > 0 and Pu0 > 0: G += -p00*log2f(p00/Pu0)
        if p10 > 0 and Pu0 > 0: G += -p10*log2f(p10/Pu0)
        if p01 > 0 and Pu1 > 0: G += -p01*log2f(p01/Pu1)
        if p11 > 0 and Pu1 > 0: G += -p11*log2f(p11/Pu1)
        conditional_entropy[iteration] = G
        complexity[iteration]          = H - G
    else:
        conditional_entropy[iteration] = 0.0
        complexity[iteration]          = 0.0

# ----------------------------------------------------------------------
def set_rule_from_i(i: int):
    for j in range(9):
        should_spawn[j]   = (i >> j)       & 1
        should_survive[j] = (i >> (j + 9)) & 1

def rule_index_to_string(i: int) -> str:
    birth   = ''.join(str(n) for n in range(9) if (i >> n) & 1)
    survive = ''.join(str(n) for n in range(9) if (i >> (n + 9)) & 1)
    return f"B{birth}/S{survive}"

# ----------------------------------------------------------------------
#  copy neighbour table to GPU once
# ----------------------------------------------------------------------
nb_np   = np.full((nodes, maxn), -1, dtype=np.int32)
cnt_np  = np.zeros(nodes, dtype=np.int32)
for i, nbrs in enumerate(nlist):
    cnt_np[i]   = len(nbrs)
    nb_np[i, :len(nbrs)] = nbrs

init_all_neighbors(nb_np, cnt_np)

# ----------------------------------------------------------------------
#  CSV output
# ----------------------------------------------------------------------
with open(outfile, "w", newline="") as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow(["rule", "rulestr", "iter", "rho", "H", "G", "D"])   # header

    rcount = 10

    for rule_i in range(rcount):
        set_rule_from_i(rule_i)
        rulestr = rule_index_to_string(rule_i)
        logger.info(f"Running rule {rulestr}")

        init_random()
        calculate_density(0)
        compute_metrics(0)

        for it in range(1, iterations + 1):
            apply_rules()
            swap_buffers(it)
            calculate_density(it)
            compute_metrics(it)

        # ─── write this rule's whole time‑series to the CSV ───
        rho_np = density.to_numpy()
        H_np   = marginal_entropy.to_numpy()
        G_np   = conditional_entropy.to_numpy()
        D_np   = complexity.to_numpy()

        for it in range(iterations + 1):
            writer.writerow([rule_i, rulestr, it,
                             f"{rho_np[it]:.6f}",
                             f"{H_np[it]:.6f}",
                             f"{G_np[it]:.6f}",
                             f"{D_np[it]:.6f}"])
        csvfile.flush()      # ensure data is on disk

logger.info(f"CSV written to {outfile}")
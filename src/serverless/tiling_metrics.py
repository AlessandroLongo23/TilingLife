import taichi as ti
import numpy as np
import time
import logging
import json
import csv
import sys
from tqdm import tqdm

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

alive_p    = 0.2
steps      = 1000                # number of Life iterations
starts     = 100                 # how many disconnected copies of the graph

# ──────────────────────  parameters  ─────────────────────────────────

# Read infline from arguments

infile  = sys.argv[1] if len(sys.argv) > 1 else "tiling-graph.json"
outfile = sys.argv[2] if len(sys.argv) > 2 else "metrics.csv"

ti.init(arch=ti.gpu,
        default_fp=ti.f32,
        default_ip=ti.i32,
        random_seed=int(time.time()))

# ──────────────────  load graph & duplicate  ──────────────────────────
with open(infile, "r") as f:
    g = json.load(f)

n_cfg   = int(g["n"])
nodes   = n_cfg * starts

nlist = [[] for _ in range(nodes)]
for c in range(starts):
    off = c * n_cfg
    for e in g["edges"]:
        u = e["source"] + off
        v = e["target"] + off
        nlist[u].append(v)
        nlist[v].append(u)

maxn = max(len(nb) for nb in nlist)
logger.info(f"Loaded {nodes} nodes with {maxn} max neighbors")

# ─────────────────────  Taichi fields  ────────────────────────────────
neighbors      = ti.field(ti.i32, shape=(nodes, maxn))
neighbor_count = ti.field(ti.i32, shape=(nodes))

current = ti.field(ti.i32, shape=(nodes))
next    = ti.field(ti.i32, shape=(nodes))

# final-step metrics (scalars)
density             = ti.field(ti.f32, shape=())  # ρ
marginal_entropy    = ti.field(ti.f32, shape=())  # H(S)
conditional_entropy = ti.field(ti.f32, shape=())  # G
complexity          = ti.field(ti.f32, shape=())  # D = H - G

# helpers for computing metrics
joint_counts  = ti.field(ti.i32, shape=4)     # bins: (00,01,10,11)
alive_count   = ti.field(ti.i32, shape=())    # total live cells
LN2 = 0.6931471805599453

# ──────────────────────  kernels  ─────────────────────────────────────
@ti.func
def log2f(x: ti.f32) -> ti.f32:
    return ti.log(x) / ti.static(LN2)

@ti.kernel
def init_neighbors(nb: ti.types.ndarray(), cnt: ti.types.ndarray()):
    for i in range(nodes):
        neighbor_count[i] = cnt[i]
        for j in range(cnt[i]):
            neighbors[i, j] = nb[i, j]
        for j in range(cnt[i], maxn):
            neighbors[i, j] = -1

@ti.kernel
def random_fill():
    for i in range(nodes):
        current[i] = 1 if ti.random() < alive_p else 0

@ti.func
def live_neighbours(i):
    c = 0
    for j in range(neighbor_count[i]):
        nb = neighbors[i, j]
        if nb >= 0 and current[nb] == 1:
            c += 1
    return c

should_survive = ti.field(ti.i32, shape=(maxn))
should_spawn   = ti.field(ti.i32, shape=(maxn))

@ti.kernel
def life_step():
    for i in range(nodes):
        n = live_neighbours(i)
        if current[i] == 1:
            next[i] = 1 if should_survive[n] else 0
        else:
            next[i] = 1 if should_spawn[n] else 0
    for i in range(nodes):
        current[i] = next[i]  # swap buffers

@ti.kernel
def compute_metrics():
    # reset accumulators
    for k in ti.static(range(4)):
        joint_counts[k] = 0
    alive_count[None] = 0

    # one-pass over nodes and edges
    for i in range(nodes):
        s = current[i]
        if s == 1:
            ti.atomic_add(alive_count[None], 1)
        for j in range(neighbor_count[i]):
            nb = neighbors[i, j]
            if nb >= 0:
                u = current[nb]
                ti.atomic_add(joint_counts[s * 2 + u], 1)

    # density ρ
    ρ = ti.cast(alive_count[None], ti.f32) / nodes
    density[None] = ρ

    # H(S)
    H = 0.0
    eps = 1e-6
    if ρ > eps and ρ < 1.0 - eps:
        H = -(ρ * log2f(ρ) + (1 - ρ) * log2f(1 - ρ))
    marginal_entropy[None] = H

    # conditional entropy G = H(S|U) and complexity D = H - G
    c00 = ti.cast(joint_counts[0], ti.f32)
    c01 = ti.cast(joint_counts[1], ti.f32)
    c10 = ti.cast(joint_counts[2], ti.f32)
    c11 = ti.cast(joint_counts[3], ti.f32)
    tot = c00 + c01 + c10 + c11

    if tot > 0:
        p00, p01, p10, p11 = c00 / tot, c01 / tot, c10 / tot, c11 / tot
        Pu0, Pu1 = p00 + p10, p01 + p11
        G = 0.0
        if p00 > 0.0 and Pu0 > 0.0:
            G += -p00 * log2f(p00 / Pu0)
        if p10 > 0.0 and Pu0 > 0.0:
            G += -p10 * log2f(p10 / Pu0)
        if p01 > 0.0 and Pu1 > 0.0:
            G += -p01 * log2f(p01 / Pu1)
        if p11 > 0.0 and Pu1 > 0.0:
            G += -p11 * log2f(p11 / Pu1)
        conditional_entropy[None] = G
        complexity[None]          = H - G
    else:
        conditional_entropy[None] = 0.0
        complexity[None]          = 0.0

# ───────────────────  host-side helpers  ──────────────────────────────
def set_rule(idx: int):
    for n in range(17):  # Support 0 to 16 neighbors
        should_spawn[n]   = (idx >> n) & 1
        should_survive[n] = (idx >> (n + 17)) & 1  # Offset increased to 17

def rulestr(idx: int) -> str:
    b = ''.join(str(n) for n in range(17) if (idx >> n) & 1)
    s = ''.join(str(n) for n in range(17) if (idx >> (n + 17)) & 1)  # Offset increased to 17
    return f"B{b}/S{s}"

# ───────────────────  upload neighbours once  ─────────────────────────
nb_np  = np.full((nodes, maxn), -1, np.int32)
cnt_np = np.zeros(nodes,              np.int32)
for i, nbrs in enumerate(nlist):
    cnt_np[i]            = len(nbrs)
    nb_np[i, :len(nbrs)] = nbrs
init_neighbors(nb_np, cnt_np)

# ────────────────────────  main loop  ────────────────────────────────

def generate_all_rule_indices(max_neighbors: int) -> list:
    """
    Generate rule indices for all possible combinations of birth (B) and survival (S) rules
    where each rule can include any subset of neighbors from 0 to max_neighbors.
    
    Parameters:
    - max_neighbors: Maximum number of neighbors to consider (0 to max_neighbors)
    
    Returns:
    - List of rule indices compatible with set_rule() and rulestr()
    """
    rule_indices = []
    
    # Generate all possible birth rule combinations
    for b in range(2**(max_neighbors+1)):
        # Generate all possible survival rule combinations
        for s in range(2**(max_neighbors+1)):
            # Encode as a rule index
            rule_idx = b | (s << 17)
            rule_indices.append(rule_idx)
            
    return rule_indices

logger.info(f"Max neighbors: {maxn}")
maxn = min(maxn, 8)
logger.info(f"Max neighbors (clamped): {maxn}")

rules = generate_all_rule_indices(maxn)

logger.info(f"Found {len(rules)} rules")

with open(outfile, "w", newline="") as fp:
    writer = csv.writer(fp)
    writer.writerow(["rule", "rulestr", "rho", "H", "G", "D"])

    for r in tqdm(rules, desc="Rules", unit="rule"):
        set_rule(r)
        random_fill()

        for _ in range(steps):
            life_step()

        compute_metrics()

        rho = density[None]
        H   = marginal_entropy[None]
        G   = conditional_entropy[None]
        D   = complexity[None]

        writer.writerow([r, rulestr(r),
                         f"{rho:.6f}", f"{H:.6f}", f"{G:.6f}", f"{D:.6f}"])
        fp.flush()

        # logger.info(f"{rulestr(r):12s}  ρ={rho:.3f}  D={D:.3f}")
        tqdm.write(f"{rulestr(r):12s}  ρ={rho:.3f}  D={D:.3f}")

logger.info(f"Finished. Metrics saved to {outfile}")
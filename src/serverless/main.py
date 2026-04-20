import taichi as ti
import numpy as np
from tqdm import tqdm
from tqdm.contrib.logging import logging_redirect_tqdm
from dataclasses import dataclass, asdict
from typing import List
import time
import argparse
import logging
from itertools import combinations
import json

logger = logging.getLogger(__name__)

ti.init(arch=ti.gpu, default_fp=ti.f32, default_ip=ti.i32, random_seed=int(time.time()))

n = 256
alive_p = 0.15
iterations = 1000
random_starts = 5

# Stick with the original grid structure but we'll create a function
# to run each start in sequence with maximum GPU utilization for each
current = ti.field(dtype=ti.i32, shape=(n, n))
next = ti.field(dtype=ti.i32, shape=(n, n))

# Keep scalar metrics
alive_count = ti.field(dtype=ti.i32, shape=())
population_sum = ti.field(dtype=ti.i32, shape=())
births_sum = ti.field(dtype=ti.i32, shape=())
deaths_sum = ti.field(dtype=ti.i32, shape=())

current_birth_rule = ti.field(dtype=ti.i8, shape=(9))
current_survive_rule = ti.field(dtype=ti.i8, shape=(9))


@dataclass
class StartMetrics:
    average_population: float
    acivity: float
    final_alive: float

@dataclass
class RuleMetrics:
    average_population: float
    activity: float
    final_alive: float

    @staticmethod
    def from_starts(starts: List[StartMetrics]):
        average_population = 0.0
        for start in starts:
            average_population += start.average_population
        average_population /= len(starts)

        activity = 0.0
        for start in starts:
            activity += start.acivity
        activity /= len(starts)

        final_alive = 0.0
        for start in starts:
            final_alive += start.final_alive
        final_alive /= len(starts)

        return RuleMetrics(
            average_population=average_population,
            activity=activity,
            final_alive=final_alive
        )

@dataclass
class ResultRow:
    rule_index: int
    rule_format: str
    rule_metrics: RuleMetrics


@ti.kernel
def init():
    for i, j in current:
        if ti.random() < alive_p:
            current[i, j] = 1
        else:
            current[i, j] = 0
    
    # Reset metric fields
    alive_count[None] = 0
    population_sum[None] = 0
    births_sum[None] = 0
    deaths_sum[None] = 0

@ti.func
def count_neighbors(i, j):
    count = 0
    for di in range(-1, 2):
        for dj in range(-1, 2):
            if di != 0 or dj != 0:
                ni, nj = (i + di) % n, (j + dj) % n
                count += current[ni, nj]
    return count

@ti.func
def update_metrics():
    alive_count[None] = 0
    for i, j in current:
        if current[i, j] == 1:
            alive_count[None] += 1
    
    population_sum[None] += alive_count[None]

@ti.func
def should_birth(count):
    return current_birth_rule[count] == 1

@ti.func
def should_survive(count):
    return current_survive_rule[count] == 1

@ti.kernel
def update_swap():
    update_metrics()

    for i, j in next:
        neighbors = count_neighbors(i, j)
        if current[i, j] == 1:
            if should_survive(neighbors):
                next[i, j] = 1
            else:
                next[i, j] = 0
                deaths_sum[None] += 1
        else:
            if should_birth(neighbors):
                next[i, j] = 1
                births_sum[None] += 1
            else:
                next[i, j] = 0
    
    # Swap buffers
    for i, j in current:
        current[i, j] = next[i, j]


def single_start_simulation() -> StartMetrics:
    # Reset metrics
    alive_count[None] = 0
    population_sum[None] = 0
    births_sum[None] = 0
    deaths_sum[None] = 0

    # Initialize a single start
    init()
    
    # Run simulation
    for step in range(iterations):
        update_swap()
    
    # Calculate metrics for this start
    average_population = population_sum[None] / iterations / (n * n)
    activity = (births_sum[None] + deaths_sum[None]) / iterations / (n * n)
    final_alive = alive_count[None] / (n * n)
    
    return StartMetrics(
        average_population=average_population,
        acivity=activity,
        final_alive=final_alive
    )


def test_rule() -> RuleMetrics:
    # Run multiple starts in sequence but with maximum GPU utilization for each
    metrics_list = []
    for _ in range(random_starts):
        metrics = single_start_simulation()
        metrics_list.append(metrics)
    
    return RuleMetrics.from_starts(metrics_list)


def set_rule_from_i(i):
    """
    Set the birth and survival rules based on the index i
    i: index from 0 to 2^18 - 1 (= 262143)
    for Conway's Game of Life, the rule is 6152
    """
    for j in range(9):
        if (i >> j) & 1:
            current_birth_rule[j] = 1
        else:
            current_birth_rule[j] = 0

    for j in range(9):
        if (i >> (j + 9)) & 1:
            current_survive_rule[j] = 1
        else:
            current_survive_rule[j] = 0

def rule_index_to_string(i: int) -> str:
    birth = ''.join(str(n) for n in range(9) if (i >> n) & 1)
    survive = ''.join(str(n) for n in range(9) if (i >> (n + 9)) & 1)
    return f"B{birth}/S{survive}"

def compute_rule_indices(birth_str: str, survive_str: str) -> List[int]:
    # 1) Parse into integer neighbor‐counts
    birth_vals   = [int(ch) for ch in birth_str]
    survive_vals = [int(ch) for ch in survive_str]

    # 2) Generate all subsets of a list
    def all_subsets(vals):
        for r in range(len(vals) + 1):
            for combo in combinations(vals, r):
                yield combo

    # 3) Build the 18-bit indices
    indices = []
    for b_subset in all_subsets(birth_vals):
        for s_subset in all_subsets(survive_vals):
            # bits 0–8 for birth, bits 9–17 for survive
            birth_mask   = sum(1 << b       for b in b_subset)
            survive_mask = sum(1 << (s + 9) for s in s_subset)
            indices.append(birth_mask | survive_mask)

    return indices


def main(args):
    global random_starts, iterations, alive_p
    
    # Update global configuration
    random_starts = args.random_starts
    iterations = args.iterations
    alive_p = args.alive_p
    
    birth = args.birth
    survive = args.survive

    rules = compute_rule_indices(birth, survive)
    logger.debug(f"Found {len(rules)} rules")

    results = []

    with logging_redirect_tqdm():
        for i in tqdm(rules):
            set_rule_from_i(i)
            rule_metrics = test_rule()

            result = ResultRow(
                rule_index=i,
                rule_format=rule_index_to_string(i),
                rule_metrics=rule_metrics
            )
            results.append(result)
    
    with open(args.output, 'w') as f:
        json.dump([asdict(r) for r in results], f, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Game of Life Simulation")
    parser.add_argument('--iterations', type=int, default=iterations, help="Number of iterations")
    parser.add_argument('--random_starts', type=int, default=random_starts, help="Number of random starts")
    parser.add_argument('--alive_p', type=float, default=alive_p, help="Probability of a cell being alive")
    parser.add_argument('--log_level', type=str, default='INFO', help="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)")
    parser.add_argument('--birth', type=str, default="012345678", help="Birth values")
    parser.add_argument('--survive', type=str, default="012345678", help="Survive values")
    parser.add_argument('--output', type=str, help="Output file", required=True)

    args = parser.parse_args()
    logger.info(f"Arguments: {args}")

    level = getattr(logging, args.log_level.upper(), None)
    logging.basicConfig(level=level, format='%(asctime)s - %(levelname)s - %(message)s')

    main(args)
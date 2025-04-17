import taichi as ti
import numpy as np
from tqdm import tqdm
from dataclasses import dataclass
from typing import List
import time

show_gui = False

ti.init(arch=ti.gpu, default_fp=ti.f32, default_ip=ti.i32, kernel_profiler=True, random_seed=int(time.time()))

n = 256
alive_p = 0.15
iterations = 1000
random_starts = 5

current = ti.field(dtype=ti.i32, shape=(n, n))
next = ti.field(dtype=ti.i32, shape=(n, n))
pixels = ti.field(dtype=ti.f32, shape=(n, n))

# Used for computing statistics
alive_count = ti.field(dtype=ti.i32, shape=()) # Total number of alive cells in the current frame
population_sum = ti.field(dtype=ti.i32, shape=()) # Total number of alive cells in the simulation since the start

births_sum = ti.field(dtype=ti.i32, shape=()) # Total number of births in the simulation since the start
deaths_sum = ti.field(dtype=ti.i32, shape=()) # Total number of deaths in the simulation since the start

alive = ti.field(dtype=ti.i32, shape=(n, n))

current_birth_rule = ti.field(dtype=ti.i8, shape=(9))
current_survive_rule = ti.field(dtype=ti.i8, shape=(9))


@dataclass
class StartMetrics:
    average_population: float
    acivity: float

@dataclass
class RuleMetrics:
    average_population: float
    activity: float

    @staticmethod
    def from_starts(starts: List[StartMetrics]):

        # Calculate the average population and activity across all starts
        average_population = 0.0
        for start in starts:
            average_population += start.average_population
        average_population /= len(starts)

        # Calculate the average activity across all starts
        activity = 0.0
        for start in starts:
            activity += start.acivity
        activity /= len(starts)


        return RuleMetrics(
            average_population=average_population,
            activity=activity
        )


@ti.kernel
def init():
    for i, j in current:
        if ti.random() < alive_p:
            current[i, j] = 1
        else:
            current[i, j] = 0

@ti.func
def count_neighbors(i, j):
    """Count the number of live neighbors for a cell"""
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
            # alive_count += 1
            alive_count[None] += 1
    
    population_sum[None] += alive_count[None]



def summarize_metrics() -> StartMetrics:
    average_population = population_sum[None]
    average_population /= iterations
    average_population /= (n * n)

    activity = births_sum[None] + deaths_sum[None]
    activity /= iterations
    activity /= (n * n)

    return StartMetrics(
        average_population=average_population,
        acivity=activity
    )

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

@ti.kernel
def compute_pixels():
    for i, j in pixels:
        if current[i, j] == 1:
            pixels[i, j] = 1.0
        else:
            pixels[i, j] = 0.0


gui = ti.GUI("Game of Life", (n, n))

def test_start() -> StartMetrics:
    alive_count[None] = 0
    population_sum[None] = 0
    births_sum[None] = 0
    deaths_sum[None] = 0

    init()
    for step in range(iterations):
        if show_gui:
            compute_pixels()
            gui.set_image(pixels)
            gui.show()

        update_swap()
    
    return summarize_metrics()


def test_rule() -> RuleMetrics:
    metrics_list = []
    for i in range(random_starts):
        metrics = test_start()
        metrics_list.append(metrics)
        print(metrics)
    
    return RuleMetrics.from_starts(metrics_list)
    

def main():
    current_birth_rule.fill(0)
    current_birth_rule[3] = 1
    current_survive_rule.fill(0)
    current_survive_rule[2] = 1
    current_survive_rule[3] = 1

    rule_metrics = test_rule()

    print("Final Rule Metrics:")
    print(f"Average population: {rule_metrics.average_population:.4f}")
    print(f"Activity: {rule_metrics.activity:.4f}")



if __name__ == "__main__":
    main()
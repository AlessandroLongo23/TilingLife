import taichi as ti
import numpy as np
from tqdm import tqdm
from dataclasses import dataclass
from typing import List

show_gui = False

ti.init(arch=ti.gpu, default_fp=ti.f32, default_ip=ti.i32, kernel_profiler=True)

n = 256
alive_p = 0.15
iterations = 1000
random_starts = 100

current = ti.field(dtype=ti.i32, shape=(n, n))
next = ti.field(dtype=ti.i32, shape=(n, n))
pixels = ti.field(dtype=ti.f32, shape=(n, n))

# Used for computing statistics
alive_count = ti.field(dtype=ti.i32, shape=()) # Total number of alive cells in the current frame
population_sum = ti.field(dtype=ti.i32, shape=()) # Total number of alive cells in the simulation since the start

@dataclass
class StartMetrics:
    average_population: float

@dataclass
class RuleMetrics:
    average_population: float

    @staticmethod
    def from_starts(starts: List[StartMetrics]):
        average_population = 0.0
        for start in starts:
            average_population += start.average_population
        average_population /= len(starts)

        return RuleMetrics(average_population=average_population)


@ti.kernel
def init():
    for i, j in current:
        if ti.random() < 0.15:
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
def compute_metrics():
    alive_count[None] = 0
    for i, j in current:
        if current[i, j] == 1:
            # alive_count += 1
            alive_count[None] += 1
    
    population_sum[None] += alive_count[None]



def summary_metrics() -> StartMetrics:
    average_population = population_sum[None]
    average_population /= iterations
    average_population /= (n * n)

    return StartMetrics(average_population=average_population)


@ti.kernel
def update_swap():

    compute_metrics()

    for i, j in next:
        neighbors = count_neighbors(i, j)
        if current[i, j] == 1:
            if neighbors < 2 or neighbors > 3:
                next[i, j] = 0
            else:
                next[i, j] = 1
        else:
            if neighbors == 3:
                next[i, j] = 1
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

    init()
    for step in range(iterations):
        if show_gui:
            compute_pixels()
            gui.set_image(pixels)
            gui.show()

        update_swap()
    
    return summary_metrics()


def test_rule() -> RuleMetrics:
    metrics_list = []
    for i in range(random_starts):
        metrics = test_start()
        metrics_list.append(metrics)
    
    return RuleMetrics.from_starts(metrics_list)

def main():
    rule_metrics = test_rule()

    print("Final Rule Metrics:")
    print(f"Average population: {rule_metrics.average_population:.4f}")


if __name__ == "__main__":
    main()
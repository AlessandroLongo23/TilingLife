import taichi as ti
import numpy as np
import time
from tqdm import tqdm

# Initialize Taichi with CPU/GPU backend
ti.init(arch=ti.gpu, default_fp=ti.f32, default_ip=ti.i32, kernel_profiler=True)

# Configuration
n = 256  # Grid size
cell_size = 1  # Cell size for visualization

# Taichi fields
cells = ti.field(dtype=ti.i32, shape=(n, n))
next_cells = ti.field(dtype=ti.i32, shape=(n, n))
# Pre-allocate the image field outside the loop (only needed for visualization)
img = ti.Vector.field(3, dtype=ti.f32, shape=(n, n))
# Field to track state changes for each cell
change_count = ti.field(dtype=ti.i32, shape=(n, n))

@ti.kernel
def initialize():
    """Initialize the grid with random values"""
    for i, j in cells:
        if ti.random() < 0.15:  # 15% probability of a cell being alive
            cells[i, j] = 1
        else:
            cells[i, j] = 0
        change_count[i, j] = 0  # Initialize change count to 0

@ti.func
def count_neighbors(i, j):
    """Count the number of live neighbors for a cell"""
    count = 0
    for di in range(-1, 2):
        for dj in range(-1, 2):
            if di != 0 or dj != 0:  # Skip the cell itself
                ni, nj = (i + di) % n, (j + dj) % n  # Wrap around the edges
                count += cells[ni, nj]
    return count

@ti.kernel
def update_and_swap(birth: ti.types.ndarray(), birth_len: ti.i32, 
               survive: ti.types.ndarray(), survive_len: ti.i32) -> ti.i32:
    """Update the grid based on Game of Life rules, swap buffers, and return change count"""
    changes = 0
    for i, j in next_cells:
        neighbors = count_neighbors(i, j)
        if cells[i, j] == 1:  # Cell is alive
            survived = False
            for s in range(survive_len):
                if neighbors == survive[s]:
                    survived = True
            
            if survived:
                next_cells[i, j] = 1  # Survives
            else:
                next_cells[i, j] = 0  # Dies from under/overpopulation
                change_count[i, j] += 1  # Count this state change
                changes += 1
        else:  # Cell is dead
            birth_cell = False
            for b in range(birth_len):
                if neighbors == birth[b]:
                    birth_cell = True
            
            if birth_cell:
                next_cells[i, j] = 1  # Becomes alive through reproduction
                change_count[i, j] += 1  # Count this state change
                changes += 1
            else:
                next_cells[i, j] = 0  # Stays dead
    
    # Swap buffers in the same kernel to save an extra kernel launch
    for i, j in cells:
        cells[i, j] = next_cells[i, j]
    
    return changes

@ti.kernel
def calculate_metrics_kernel() -> ti.i32:
    """Calculate metrics in a single kernel call"""
    alive_count = 0
    total_changes = 0
    
    for i, j in cells:
        alive_count += cells[i, j]
        total_changes += change_count[i, j]
    
    return (alive_count << 32) | total_changes  # Pack both values into a single integer

@ti.kernel
def visualize():
    """Update the visualization image"""
    for i, j in img:
        if cells[i, j] == 1:
            img[i, j] = ti.Vector([1.0, 1.0, 1.0])
        else:
            img[i, j] = ti.Vector([0.0, 0.0, 0.0])

def calculate_metrics(birth_rules, survive_rules, iterations=100, verbose=True):
    """Run simulation for given iterations and calculate metrics"""
    initialize()
    
    # Convert lists to numpy arrays for Taichi
    birth = np.array(birth_rules, dtype=np.int32)
    survive = np.array(survive_rules, dtype=np.int32)
    
    # Get lengths
    birth_len = len(birth_rules)
    survive_len = len(survive_rules)
    
    if verbose:
        print(f"Running simulation for {iterations} iterations...")
        print(f"Using rules: B{''.join(map(str, birth_rules))}/S{''.join(map(str, survive_rules))}")
    
    # We don't need to store changes per step if we're just calculating final metrics
    for step in range(iterations):
        # Combined update and swap
        update_and_swap(birth, birth_len, survive, survive_len)
        
        if verbose and step % 100 == 0:
            # Only calculate intermediate metrics when verbose is enabled
            metrics_packed = calculate_metrics_kernel()
            alive_cells = metrics_packed >> 32
            total_changes = metrics_packed & 0xFFFFFFFF
            print(f"Step {step}/{iterations}: Alive: {alive_cells}, Changes: {total_changes}")
    
    # Calculate final metrics
    metrics_packed = calculate_metrics_kernel()
    alive_cells = metrics_packed >> 32
    total_changes = metrics_packed & 0xFFFFFFFF
    total_cells = n * n
    
    # AMD = Average number of changes per cell / number of iterations
    amd = total_changes / (total_cells * iterations)
    
    # FSR = Number of alive cells / total cells
    fsr = alive_cells / total_cells
    
    if verbose:
        print(f"\nResults after {iterations} iterations:")
        print(f"Total changes: {total_changes}")
        print(f"Alive cells: {alive_cells}")
        print(f"AMD (Average Mean Dynamicity): {amd:.6f}")
        print(f"FSR (Final Survival Rate): {fsr:.6f}")
    
    return {
        "amd": amd,
        "fsr": fsr,
        "total_changes": total_changes,
        "alive_cells": alive_cells
    }

def encode_rule(rule_number):
    """Encode a rule number into birth and survive lists"""
    # Lower 9 bits for birth rules (0-8 neighbors)
    birth = []
    for i in range(10):
        if (rule_number & (1 << i)) != 0:
            birth.append(i)
    
    # Next 9 bits for survive rules
    survive = []
    for i in range(10):
        if (rule_number & (1 << (i + 10))) != 0:
            survive.append(i)
    
    return birth, survive

window = ti.ui.Window("Game of Life", (n * cell_size, n * cell_size))
canvas = window.get_canvas()

def run_interactive_simulation(birth_rules, survive_rules):
    """Run the Game of Life simulation with visualization"""
    initialize()
    
    # Convert lists to numpy arrays for Taichi
    birth = np.array(birth_rules, dtype=np.int32)
    survive = np.array(survive_rules, dtype=np.int32)
    
    # Get lengths
    birth_len = len(birth_rules)
    survive_len = len(survive_rules)
    
    print(f"Running interactive simulation with rules: B{''.join(map(str, birth_rules))}/S{''.join(map(str, survive_rules))}")
    
    frame_count = 0
    start_time = time.time()
    
    while window.running:
        # Update simulation
        update_and_swap(birth, birth_len, survive, survive_len)
        
        # Update visualization
        visualize()
        canvas.set_image(img)
        window.show()
        
        # Calculate and display FPS
        frame_count += 1
        if frame_count % 10 == 0:
            elapsed = time.time() - start_time
            fps = frame_count / elapsed
            print(f"FPS: {fps:.1f}")
            frame_count = 0
            start_time = time.time()

if __name__ == "__main__":
    ti.profiler.clear_kernel_profiler_info()
    
    # Analyze performance first
    print("Analyzing performance...")
    test_rules = [
        ([3], [2, 3]),       # Conway's Game of Life
        ([3, 6], [2, 3]),    # HighLife
        ([2], [])            # Seeds
    ]
    
    for rule_name, (birth, survive) in zip(["Conway", "HighLife", "Seeds"], test_rules):
        print(f"\nTesting {rule_name} rule...")
        metrics = calculate_metrics(birth, survive, 100, verbose=True)
    
    print("\nKernel profiling results:")
    ti.profiler.print_kernel_profiler_info()
    
    # Run full metrics testing only if needed
    run_big_test = True
    if run_big_test:
        print("Running full rule test...")
        metrics = {}
        total_rules = 512 * 512  # Reduced rule space for testing
        for i in tqdm(range(total_rules), desc="Testing rules", unit="rule"):
            birth, survive = encode_rule(i)
            metrics[i] = calculate_metrics(birth, survive, 100, verbose=False)
        
        # Find the most interesting rule sets
        sorted_metrics = sorted(metrics.items(), key=lambda x: x[1]['amd'], reverse=True)
        print("\nTop 10 rules by Average Mean Dynamicity:")
        for rule_num, rule_metrics in sorted_metrics[:10]:
            birth, survive = encode_rule(rule_num)
            print(f"Rule {rule_num}: B{''.join(map(str, birth))}/S{''.join(map(str, survive))} - AMD: {rule_metrics['amd']:.6f}, FSR: {rule_metrics['fsr']:.6f}")
    
    # Visualize the most interesting rule
    # run_interactive = True
    # if run_interactive:
        # run_interactive_simulation([3], [2, 3])

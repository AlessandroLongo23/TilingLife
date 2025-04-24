import taichi as ti
import numpy as np
import time
from tqdm import tqdm

# Initialize Taichi with CPU/GPU backend
ti.init(arch=ti.gpu, default_fp=ti.f32, default_ip=ti.i32, kernel_profiler=True)

# Configuration
n = 256  # Grid size
cell_size = 1  # Cell size for visualization

# Define a better memory layout for better cache performance
# Using SOA (Structure of Arrays) layout for better SIMD utilization
cells = ti.field(dtype=ti.i32, shape=(n, n))
next_cells = ti.field(dtype=ti.i32, shape=(n, n))
# Pre-allocate the image field outside the loop (only needed for visualization)
img = ti.Vector.field(3, dtype=ti.f32, shape=(n, n))
# Field to track state changes for each cell
change_count = ti.field(dtype=ti.i32, shape=(n, n))

# Define data structures for birth and survival rules to avoid Python callbacks
max_rule_count = 9
birth_rule_field = ti.field(dtype=ti.i32, shape=max_rule_count)
survive_rule_field = ti.field(dtype=ti.i32, shape=max_rule_count)
rule_counts = ti.field(dtype=ti.i32, shape=2)  # [birth_count, survive_count]

@ti.kernel
def initialize():
    """Initialize the grid with random values"""
    for i, j in ti.ndrange(n, n):
        if ti.random() < 0.15:  # 15% probability of a cell being alive
            cells[i, j] = 1
        else:
            cells[i, j] = 0
        change_count[i, j] = 0  # Initialize change count to 0

@ti.kernel
def load_rules(birth: ti.types.ndarray(), birth_len: ti.i32, survive: ti.types.ndarray(), survive_len: ti.i32):
    """Load rule arrays into Taichi fields for faster access"""
    rule_counts[0] = ti.min(birth_len, max_rule_count)
    rule_counts[1] = ti.min(survive_len, max_rule_count)
    
    for i in range(rule_counts[0]):
        birth_rule_field[i] = birth[i]
        
    for i in range(rule_counts[1]):
        survive_rule_field[i] = survive[i]

@ti.func
def count_neighbors(i, j):
    """Count the number of live neighbors for a cell using direct indexing"""
    # Precompute wrap-around indices with bit operations for performance
    # Faster modulo for powers of 2
    im1 = (i - 1) & (n - 1) # Equivalent to (i - 1) % n when n is a power of 2
    ip1 = (i + 1) & (n - 1)
    jm1 = (j - 1) & (n - 1)
    jp1 = (j + 1) & (n - 1)
    
    # Direct sum all neighbors without loops for better vectorization
    count = cells[im1, jm1] + cells[im1, j] + cells[im1, jp1] + \
            cells[i, jm1]                   + cells[i, jp1] + \
            cells[ip1, jm1] + cells[ip1, j] + cells[ip1, jp1]
    
    return count

@ti.func
def matches_rule(neighbors, rule_array, rule_count):
    """Check if a neighbor count matches any rule in the array"""
    result = 0
    for i in range(rule_count):
        if neighbors == rule_array[i]:
            result = 1
    return result

@ti.kernel
def update_and_swap() -> ti.i32:
    """Update the grid based on Game of Life rules using ultra-optimized branchless logic"""
    changes = 0
    
    # Process cells in blocks for better cache utilization
    for i, j in ti.ndrange((0, n), (0, n)):
        # Count live neighbors
        neighbors = count_neighbors(i, j)
        
        # Current state
        state = cells[i, j]
        
        # Check rules
        birth_match = matches_rule(neighbors, birth_rule_field, rule_counts[0])
        survive_match = matches_rule(neighbors, survive_rule_field, rule_counts[1])
        
        # Ultra-efficient branchless logic - directly calculate next state
        # For a dead cell (state=0): birth_match determines state
        # For a live cell (state=1): survive_match determines state
        next_state = (birth_match & (1 - state)) | (survive_match & state)
        
        # Record state and count changes
        next_cells[i, j] = next_state
        changed = ti.cast(next_state != state, ti.i32)
        changes += changed
        change_count[i, j] += changed
    
    # Update the main grid with vectorized operation
    for i, j in ti.ndrange((0, n), (0, n)):
        cells[i, j] = next_cells[i, j]
    
    return changes

@ti.kernel
def calculate_metrics_kernel() -> ti.i32:
    """Calculate metrics in a single kernel call"""
    alive_count = 0
    total_changes = 0
    
    # Aggregate values in parallel
    ti.loop_config(block_dim=32)
    for i, j in ti.ndrange(n, n):
        alive_count += cells[i, j]
        total_changes += change_count[i, j]
    
    return (alive_count << 32) | total_changes  # Pack both values into a single integer

@ti.kernel
def visualize():
    """Update the visualization image with vectorized operations"""
    for i, j in ti.ndrange(n, n):
        # Branchless visualization using direct state value
        img[i, j] = ti.Vector([cells[i, j], cells[i, j], cells[i, j]])

def calculate_metrics(birth_rules, survive_rules, iterations=100, verbose=True):
    """Run simulation for given iterations and calculate metrics"""
    # Ensure n is a power of 2 for optimized bit operations
    if n & (n - 1) != 0:
        print("Warning: Grid size is not a power of 2, which may reduce performance")
    
    initialize()
    
    # Convert to numpy arrays for Taichi
    birth_array = np.array(birth_rules, dtype=np.int32)
    survive_array = np.array(survive_rules, dtype=np.int32)
    
    # Load rules into Taichi fields
    load_rules(birth_array, len(birth_array), survive_array, len(survive_array))
    
    if verbose:
        print(f"Running simulation for {iterations} iterations...")
        print(f"Using rules: B{''.join(map(str, birth_rules))}/S{''.join(map(str, survive_rules))}")
    
    # Cache warmup iteration
    update_and_swap()
    
    # Main simulation loop
    for step in range(iterations):
        update_and_swap()
        
        if verbose and step % 100 == 0:
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
    for i in range(9):  # Only consider 0-8 neighbors
        if (rule_number & (1 << i)) != 0:
            birth.append(i)
    
    # Next 9 bits for survive rules
    survive = []
    for i in range(9):  # Only consider 0-8 neighbors
        if (rule_number & (1 << (i + 9))) != 0:
            survive.append(i)
    
    return birth, survive

window = ti.ui.Window("Game of Life", (n * cell_size, n * cell_size))
canvas = window.get_canvas()

def run_interactive_simulation(birth_rules, survive_rules):
    """Run the Game of Life simulation with visualization"""
    initialize()
    
    # Convert to numpy arrays for Taichi
    birth_array = np.array(birth_rules, dtype=np.int32)
    survive_array = np.array(survive_rules, dtype=np.int32)
    
    # Load rules into Taichi fields
    load_rules(birth_array, len(birth_array), survive_array, len(survive_array))
    
    print(f"Running interactive simulation with rules: B{''.join(map(str, birth_rules))}/S{''.join(map(str, survive_rules))}")
    
    frame_count = 0
    start_time = time.time()
    
    while window.running:
        # Update simulation with optimized implementation
        update_and_swap()
        
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

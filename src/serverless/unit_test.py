import json
import argparse
import sys

def create_grid_graph(width=3, height=3):
    """Create a grid graph where each cell is connected to its 8 neighbors."""
    n = width * height
    edges = []
    
    for i in range(n):
        row_i = i // width
        col_i = i % width
        
        # Check all 8 neighbors (horizontally, vertically, and diagonally)
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                # Skip the cell itself
                if dr == 0 and dc == 0:
                    continue
                
                new_row = row_i + dr
                new_col = col_i + dc
                
                # Check if neighbor is within grid boundaries
                if 0 <= new_row < height and 0 <= new_col < width:
                    j = new_row * width + new_col
                    
                    # To avoid duplicate edges, only add edge if i < j
                    if i < j:
                        edge_type = "side" if dr == 0 or dc == 0 else "diagonal"
                        edges.append({"source": i, "target": j, "type": edge_type})
    
    return {
        "n": n,
        "edges": edges,
        "width": width,
        "height": height
    }

def generate_mode(output_file, width=3, height=3):
    """Generate grid graph and save to file"""
    grid_graph = create_grid_graph(width, height)
    
    # Save to JSON file
    with open(output_file, "w") as f:
        json.dump(grid_graph, f, indent=2)
    
    print(f"Grid graph created and saved as {output_file}")

def get_neighbors(node, edges):
    """Get all neighbors of a node from the edges list."""
    neighbors = []
    for edge in edges:
        if edge["source"] == node:
            neighbors.append(edge["target"])
        elif edge["target"] == node:
            neighbors.append(edge["source"])
    return neighbors

def check_game_of_life_rules(current_state, next_state, edges):
    """Check if the evolution follows Game of Life rules."""
    for i in range(len(current_state)):
        neighbors = get_neighbors(i, edges)
        live_neighbors = sum(current_state[j] for j in neighbors)
        
        if current_state[i] == 1:  # Cell is alive
            # Should survive if it has 2-3 live neighbors
            expected = 1 if 2 <= live_neighbors <= 3 else 0
        else:  # Cell is dead
            # Should become alive if exactly 3 live neighbors
            expected = 1 if live_neighbors == 3 else 0
            
        if next_state[i] != expected:
            return False, f"Cell {i} with {live_neighbors} live neighbors should be {expected}"
    
    return True, "Evolution follows Game of Life rules"

def check_mode(iterations_file, grid_file):
    """Check if iterations follow Game of Life rules"""
    # Load the grid
    with open(grid_file, "r") as f:
        grid_graph = json.load(f)
    
    # Load the iterations
    with open(iterations_file, "r") as f:
        iterations = json.load(f)
    
    # Check each consecutive pair of iterations
    for t in range(len(iterations) - 1):
        current_state = iterations[t]
        next_state = iterations[t+1]
        
        valid, message = check_game_of_life_rules(current_state, next_state, grid_graph["edges"])
        if not valid:
            print(f"Error at iteration {t} to {t+1}: {message}")
            return False
    
    print("All iterations follow Game of Life rules")
    return True

def main():
    parser = argparse.ArgumentParser(description='Game of Life Grid Generator and Checker')
    parser.add_argument('mode', choices=['generate', 'check'], help='Mode: generate grid or check evolution')
    parser.add_argument('--output', default="grid_graph.json", help='Output file for grid')
    parser.add_argument('--width', type=int, default=3, help='Grid width (for generate mode)')
    parser.add_argument('--height', type=int, default=3, help='Grid height (for generate mode)')
    parser.add_argument('--iterations', help='Iterations file to check')
    parser.add_argument('--grid', help='Grid file to use for checking')
    
    args = parser.parse_args()
    
    if args.mode == 'generate':
        generate_mode(args.output, args.width, args.height)
    elif args.mode == 'check':
        if not args.iterations or not args.grid:
            print("Error: --iterations and --grid arguments required for check mode")
            sys.exit(1)
        check_mode(args.iterations, args.grid)

if __name__ == "__main__":
    main()
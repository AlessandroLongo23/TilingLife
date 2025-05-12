#!/usr/bin/env python3

import json
import math
from typing import List, Dict, Any, Tuple

def load_data(json_file: str) -> List[Dict[str, Any]]:
    """Load data from a JSON file."""
    print(f"Loading data from {json_file}...")
    with open(json_file, 'r') as f:
        return json.load(f)

def find_rule_by_index(data: List[Dict[str, Any]], rule_index: int) -> Dict[str, Any]:
    """Find a rule by its index."""
    for rule in data:
        if rule.get("rule_index") == rule_index:
            return rule
    raise ValueError(f"Rule with index {rule_index} not found")

def calculate_distances(data: List[Dict[str, Any]], target_rule: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Calculate distances between target rule and all other rules for each metric."""
    # Get the target metrics
    target_metrics = target_rule["rule_metrics"]
    
    results = []
    
    for rule in data:
        # Skip if it's the target rule itself
        if rule["rule_index"] == target_rule["rule_index"]:
            continue
        
        rule_metrics = rule["rule_metrics"]
        
        # Calculate distances for each metric
        avg_pop_distance = abs(target_metrics["average_population"] - rule_metrics["average_population"])
        activity_distance = abs(target_metrics["activity"] - rule_metrics["activity"])
        final_alive_distance = abs(target_metrics["final_alive"] - rule_metrics["final_alive"])
        
        # Calculate combined distance (Euclidean distance)
        combined_distance = math.sqrt(
            avg_pop_distance**2 + 
            activity_distance**2 + 
            final_alive_distance**2
        )
        
        results.append({
            "rule_index": rule["rule_index"],
            "rule_format": rule["rule_format"],
            "avg_pop_distance": avg_pop_distance,
            "activity_distance": activity_distance,
            "final_alive_distance": final_alive_distance,
            "combined_distance": combined_distance
        })
    
    return results

def find_closest_rules(distances: List[Dict[str, Any]], metric: str, n: int = 50) -> List[Dict[str, Any]]:
    """Find the n closest rules based on a specific metric."""
    sorted_distances = sorted(distances, key=lambda x: x[f"{metric}_distance"])
    return sorted_distances[:n]

def display_closest_rules(closest: List[Dict[str, Any]], metric: str) -> None:
    """Display the closest rules for a specific metric."""
    print(f"\nTop 50 closest rules to rule 6152 by {metric}:")
    print(f"{'Rule Index':<10} {'Rule Format':<10} {'Distance':<15}")
    print("-" * 35)
    
    for rule in closest:
        distance = rule[f"{metric}_distance"]
        print(f"{rule['rule_index']:<10} {rule['rule_format']:<10} {distance:<15.6f}")

def main():
    # Define file paths
    json_file = "24734614.json"
    target_rule_index = 6152
    
    try:
        # Load data
        data = load_data(json_file)
        
        # Find target rule
        target_rule = find_rule_by_index(data, target_rule_index)
        print(f"Found rule {target_rule_index} ({target_rule['rule_format']})")
        
        # Calculate distances
        distances = calculate_distances(data, target_rule)
        
        # Find and display closest rules for each metric
        metrics = ["avg_pop", "activity", "final_alive", "combined"]
        
        for metric in metrics:
            closest = find_closest_rules(distances, metric)
            display_closest_rules(closest, metric)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()

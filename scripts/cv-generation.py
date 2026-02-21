import math
import json

tol = 1e-6
max_n = 40
interval = math.pi / 12
interval_deg = int(round(math.degrees(interval)))

def isMultiple(value, divisor):
    rem = value % divisor
    return abs(rem) < tol or abs(rem - divisor) < tol

if __name__ == "__main__":
    regular_results = []
    for n in range(3, max_n):
        for d in range(2, math.ceil(n / 2)):
            a = math.pi * (1 - 2 * d / n)
            b = math.pi * (1 + 2 * (d - 1) / n)
            if isMultiple(a, interval) and isMultiple(b, interval):
                regular_results.append({
                    "n": n, 
                    "d": d, 
                })

    with open(f"polygons/regular_stars_{interval_deg}deg.json", "w") as f:
        json.dump(regular_results, f, indent=4)

    parametric_results = []
    for n in range(3, max_n):
        a = interval
        max_a = math.pi * (n - 2) / n
        while a < max_a:
            b = 2 * math.pi * (1 - 1 / n) - a
            if isMultiple(b, interval):
                parametric_results.append({
                    "n": n, 
                    "alpha": round(math.degrees(a)), 
                })
            a += interval

    with open(f"polygons/parametric_stars_{interval_deg}deg.json", "w") as f:
        json.dump(parametric_results, f, indent=4)

    print(f"Files created: regular_stars_{interval_deg}deg.json and parametric_stars_{interval_deg}deg.json")
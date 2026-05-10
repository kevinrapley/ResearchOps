#!/usr/bin/env python3
from pathlib import Path
import argparse, json, yaml

def load(path):
    text=Path(path).read_text(encoding="utf-8")
    return yaml.safe_load(text) if str(path).endswith((".yaml",".yml")) else json.loads(text)

def measurement_index(results):
    index = {}
    for item in results.get("measurements", []):
        if item.get("metric"):
            index[item["metric"]] = item.get("value")
        if item.get("canonical_metric"):
            index[item["canonical_metric"]] = item.get("value")
    return index

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--budget", required=True)
    parser.add_argument("--results", required=True)
    parser.add_argument("--mode", choices=["blocking","advisory"], default="blocking")
    args=parser.parse_args()
    budget=load(args.budget)
    results=load(args.results)
    measurements=measurement_index(results)
    failures=[]
    for item in budget.get("budgets", []):
        metric=item["metric"]
        threshold=float(item["threshold"])
        tolerance=float(item.get("tolerance_percent",0))
        comparator=item.get("comparator", "max")
        if metric not in measurements:
            failures.append(f"Missing measurement for {metric}")
            continue
        value=float(measurements[metric])
        if comparator == "min":
            allowed=threshold*(1-tolerance/100.0)
            if value < allowed:
                failures.append(f"{metric}={value} below allowed {allowed}")
        else:
            allowed=threshold*(1+tolerance/100.0)
            if value > allowed:
                failures.append(f"{metric}={value} exceeds allowed {allowed}")
    if failures:
        for f in failures: print(f)
        if args.mode == "blocking":
            raise SystemExit(1)
    print("Performance budget passed.")

if __name__ == "__main__":
    main()

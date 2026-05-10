#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
import yaml

def load(path):
    text = Path(path).read_text(encoding="utf-8")
    return yaml.safe_load(text) if str(path).endswith((".yaml", ".yml")) else json.loads(text)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--budget", required=True)
    parser.add_argument("--results", required=True)
    parser.add_argument("--allow-missing", action="store_true")
    args = parser.parse_args()

    budget = load(args.budget)
    results = load(args.results)
    result_metrics = set()
    errors = []
    for item in results.get("measurements", []):
        if item.get("metric") is None:
            errors.append("measurement missing metric")
        if item.get("value") is None:
            errors.append(f"measurement {item.get('metric')} missing value")
        if item.get("metric"):
            result_metrics.add(item["metric"])
        if item.get("canonical_metric"):
            result_metrics.add(item["canonical_metric"])
    required_metrics = {item.get("metric") for item in budget.get("budgets", [])}
    missing = sorted(required_metrics - result_metrics)
    if missing and not args.allow_missing:
        errors.append("performance results missing budget metrics: " + ", ".join(missing))
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Performance results validation passed.")

if __name__ == "__main__":
    main()

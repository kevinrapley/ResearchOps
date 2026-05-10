#!/usr/bin/env python3
from pathlib import Path
import argparse
import csv
import json
import re
import statistics
import xml.etree.ElementTree as ET
import yaml

def numeric(value):
    try:
        return float(value)
    except Exception:
        return value

def measurement(metric, value, unit=None, source=None):
    result = {"metric": metric, "value": numeric(value)}
    if unit:
        result["unit"] = unit
    if source:
        result["source"] = source
    return result

def percentile(values, pct):
    if not values:
        return None
    values = sorted(values)
    k = (len(values) - 1) * (pct / 100)
    f = int(k)
    c = min(f + 1, len(values) - 1)
    if f == c:
        return values[int(k)]
    return values[f] * (c - k) + values[c] * (k - f)

def apply_profile(adapter, measurements, profile_path):
    if not profile_path:
        return measurements
    data = yaml.safe_load(Path(profile_path).read_text(encoding="utf-8")) or {}
    mapping = (data.get("profiles") or {}).get(adapter, {})
    for item in measurements:
        canonical = mapping.get(item["metric"])
        if canonical:
            item["canonical_metric"] = canonical
            item["metric"] = canonical
            item["original_metric"] = item.get("original_metric") or next((k for k, v in mapping.items() if v == canonical), item["metric"])
    return measurements

def adapt_pytest_benchmark(path):
    data=json.loads(Path(path).read_text(encoding="utf-8"))
    out=[]
    for item in data.get("benchmarks", []):
        name=item.get("name", "benchmark")
        stats=item.get("stats", {})
        if "mean" in stats: out.append(measurement(f"{name}_mean_seconds", stats["mean"], "seconds", str(path)))
        if "max" in stats: out.append(measurement(f"{name}_max_seconds", stats["max"], "seconds", str(path)))
    return out

def adapt_go_bench(path):
    out=[]
    text=Path(path).read_text(encoding="utf-8", errors="ignore")
    for line in text.splitlines():
        m=re.match(r"(Benchmark\S+)\s+\d+\s+([0-9.]+)\s+ns/op", line)
        if m:
            out.append(measurement(f"{m.group(1)}_ns_per_op", float(m.group(2)), "ns/op", str(path)))
    return out

def adapt_lighthouse(path):
    data=json.loads(Path(path).read_text(encoding="utf-8"))
    cats=data.get("categories", {})
    out=[]
    for key in ["performance", "accessibility", "best-practices", "seo"]:
        if key in cats and "score" in cats[key]:
            out.append(measurement(f"lighthouse_{key}_score", cats[key]["score"], "ratio", str(path)))
    audits=data.get("audits", {})
    if "largest-contentful-paint" in audits:
        out.append(measurement("lcp_ms", audits["largest-contentful-paint"].get("numericValue"), "ms", str(path)))
    return [m for m in out if m.get("value") is not None]

def adapt_k6(path):
    data=json.loads(Path(path).read_text(encoding="utf-8"))
    metrics=data.get("metrics", {})
    out=[]
    for name, key in [("http_req_duration", "p(95)"), ("http_req_failed", "rate")]:
        if name in metrics:
            values=metrics[name].get("values", {})
            if key in values:
                out.append(measurement(f"k6_{name}_{key.replace('(','').replace(')','')}", values[key], None, str(path)))
    return out

def adapt_autocannon(path):
    data=json.loads(Path(path).read_text(encoding="utf-8"))
    out=[]
    if "latency" in data and "p95" in data["latency"]:
        out.append(measurement("autocannon_latency_p95_ms", data["latency"]["p95"], "ms", str(path)))
    if "requests" in data and "average" in data["requests"]:
        out.append(measurement("autocannon_requests_average", data["requests"]["average"], "requests/second", str(path)))
    return out

def adapt_jmeter_jtl(path):
    path = Path(path)
    samples = []
    if path.suffix.lower() == ".xml":
        root = ET.parse(path).getroot()
        for el in root.iter():
            if el.tag.endswith("sample") or el.tag.endswith("httpSample"):
                if "t" in el.attrib:
                    samples.append(float(el.attrib["t"]))
    else:
        with path.open(newline="", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                value = row.get("elapsed") or row.get("t")
                if value:
                    samples.append(float(value))
    out = []
    if samples:
        out.append(measurement("jmeter_elapsed_p95_ms", percentile(samples, 95), "ms", str(path)))
        out.append(measurement("jmeter_elapsed_mean_ms", statistics.mean(samples), "ms", str(path)))
    return out

def adapt_gatling(path):
    data=json.loads(Path(path).read_text(encoding="utf-8"))
    stats = data.get("stats") or data.get("contents", {}).get("Global Information", {}).get("stats") or {}
    out=[]
    if "percentiles3" in stats:
        out.append(measurement("gatling_p95_ms", stats["percentiles3"].get("total"), "ms", str(path)))
    if "meanResponseTime" in stats:
        out.append(measurement("gatling_mean_ms", stats["meanResponseTime"].get("total"), "ms", str(path)))
    return [m for m in out if m.get("value") is not None]

def adapt_artillery(path):
    data=json.loads(Path(path).read_text(encoding="utf-8"))
    aggregate = data.get("aggregate") or data
    summaries = aggregate.get("summaries") or {}
    rates = aggregate.get("rates") or {}
    out=[]
    http_response_time = summaries.get("http.response_time") or summaries.get("http.response_time.2xx") or {}
    if "p95" in http_response_time:
        out.append(measurement("artillery_http_response_time_p95_ms", http_response_time["p95"], "ms", str(path)))
    if "http.request_rate" in rates:
        out.append(measurement("artillery_http_request_rate", rates["http.request_rate"], "requests/second", str(path)))
    return out

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--type", choices=["pytest-benchmark", "go-bench", "lighthouse", "k6", "autocannon", "jmeter", "gatling", "artillery"], required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--profile", default=None)
    args=parser.parse_args()
    adapters={
        "pytest-benchmark": adapt_pytest_benchmark,
        "go-bench": adapt_go_bench,
        "lighthouse": adapt_lighthouse,
        "k6": adapt_k6,
        "autocannon": adapt_autocannon,
        "jmeter": adapt_jmeter_jtl,
        "gatling": adapt_gatling,
        "artillery": adapt_artillery,
    }
    measurements=apply_profile(args.type, adapters[args.type](args.input), args.profile)
    Path(args.output).write_text(yaml.safe_dump({"adapter": args.type, "measurements": measurements}, sort_keys=False), encoding="utf-8")
    print(f"Wrote {args.output} with {len(measurements)} measurements")

if __name__ == "__main__":
    main()

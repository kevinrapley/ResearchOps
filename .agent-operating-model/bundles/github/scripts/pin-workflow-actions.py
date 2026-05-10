#!/usr/bin/env python3
from pathlib import Path
import argparse
import re
import json
import urllib.request
import yaml

FULL_SHA = re.compile(r"^[0-9a-fA-F]{40}$")
USES_RE = re.compile(r"(\buses:\s*)([^@\s]+)@([^\s#]+)")

def github_api_get(url, token=None):
    request = urllib.request.Request(url)
    request.add_header("Accept", "application/vnd.github+json")
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))

def classify(action):
    if action.startswith("./") or action.startswith("../"):
        return "local"
    if action.startswith("docker://"):
        return "docker"
    owner = action.split("/", 1)[0]
    if owner in {"actions", "github"}:
        return "first-party"
    return "third-party"

def resolve_sha(action, ref, token=None):
    if FULL_SHA.match(ref):
        return ref
    if action.startswith("./") or action.startswith("../") or action.startswith("docker://"):
        return ref
    if "/" not in action:
        return ref
    url = f"https://api.github.com/repos/{action}/commits/{ref}"
    data = github_api_get(url, token)
    return data["sha"]

def load_lock(path):
    if not Path(path).exists():
        return {"actions": {}}
    return yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {"actions": {}}

def save_lock(path, data):
    Path(path).write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8")

def process_workflow(path, lock, resolve=False, token=None, write_changes=False):
    text = Path(path).read_text(encoding="utf-8")
    changes = []
    def replace(match):
        prefix, action, ref = match.group(1), match.group(2), match.group(3)
        kind = classify(action)
        if kind in {"local", "docker"}:
            return match.group(0)
        entry = lock.setdefault("actions", {}).setdefault(action, {"ref": ref, "classification": kind})
        sha = entry.get("sha")
        if not sha and resolve:
            sha = resolve_sha(action, ref, token)
            entry["sha"] = sha
            entry["ref"] = ref
            entry["classification"] = kind
        if sha and FULL_SHA.match(sha):
            changes.append({"action": action, "from": ref, "to": sha})
            return f"{prefix}{action}@{sha}"
        return match.group(0)
    new_text = USES_RE.sub(replace, text)
    if write_changes and new_text != text:
        Path(path).write_text(new_text, encoding="utf-8")
    return changes

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workflow-dir", required=True)
    parser.add_argument("--lock-file", required=True)
    parser.add_argument("--resolve", action="store_true")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--token-env", default="GITHUB_TOKEN")
    args = parser.parse_args()
    import os
    token = os.environ.get(args.token_env)
    lock = load_lock(args.lock_file)
    workflow_dir = Path(args.workflow_dir)
    files = sorted(list(workflow_dir.glob("*.yml")) + list(workflow_dir.glob("*.yaml"))) if workflow_dir.is_dir() else [workflow_dir]
    all_changes = []
    for wf in files:
        all_changes.extend(process_workflow(wf, lock, resolve=args.resolve, token=token, write_changes=args.write))
    save_lock(args.lock_file, lock)
    print(yaml.safe_dump({"changes": all_changes, "lock_file": args.lock_file}, sort_keys=False))

if __name__ == "__main__":
    main()

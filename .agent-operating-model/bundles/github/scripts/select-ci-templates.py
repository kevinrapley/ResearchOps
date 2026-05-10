#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
import sys
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from repository_conditions import build_traits, select_workflow_templates

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--format", choices=["yaml", "json"], default="yaml")
    parser.add_argument("--public-service", action="store_true")
    parser.add_argument("--web", action="store_true")
    parser.add_argument("--performance-sensitive", action="store_true")
    parser.add_argument("--release", action="store_true")
    parser.add_argument("--bundle-release", action="store_true")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    traits = build_traits(
        repo,
        public_service=args.public_service,
        web=args.web,
        performance_sensitive=args.performance_sensitive,
        release=args.release,
        bundle_release=args.bundle_release,
    )
    languages, selected = select_workflow_templates(repo, traits)
    result = {
        "repository": str(repo),
        "traits": traits,
        "detected_languages": languages,
        "selected_templates": selected,
        "required_status_checks": [item["required_status_check"] for item in selected],
    }
    print(json.dumps(result, indent=2) if args.format == "json" else yaml.safe_dump(result, sort_keys=False))

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from pathlib import Path
import argparse
import json

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", required=True)
    parser.add_argument("--min-components", type=int, default=0)
    parser.add_argument("--require-dependencies", action="store_true")
    parser.add_argument("--require-licences", action="store_true")
    parser.add_argument("--require-purls", action="store_true")
    parser.add_argument("--require-tool-metadata", action="store_true")
    args = parser.parse_args()
    data = json.loads(Path(args.path).read_text(encoding="utf-8"))
    errors = []
    components = data.get("components", [])
    if data.get("bomFormat") != "CycloneDX":
        errors.append("SBOM bomFormat must be CycloneDX")
    if not isinstance(components, list):
        errors.append("SBOM components must be a list")
        components = []
    if len(components) < args.min_components:
        errors.append(f"SBOM has {len(components)} components; expected at least {args.min_components}")
    for index, component in enumerate(components):
        if not component.get("name"):
            errors.append(f"Component {index} missing name")
        if not component.get("bom-ref"):
            errors.append(f"Component {index} missing bom-ref")
        if args.require_purls and component.get("type") != "application" and not component.get("purl"):
            errors.append(f"Component {index} missing purl")
    if args.require_dependencies and not data.get("dependencies"):
        errors.append("SBOM dependency graph is required")
    if args.require_licences and not any(c.get("licenses") for c in components):
        errors.append("At least one component must include licence metadata")
    if args.require_tool_metadata and not (data.get("metadata") or {}).get("tools"):
        errors.append("SBOM metadata.tools is required")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print(f"SBOM validation passed with {len(components)} components.")

if __name__ == "__main__":
    main()

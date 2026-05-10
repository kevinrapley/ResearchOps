#!/usr/bin/env python3
from pathlib import Path
import argparse, json, yaml

ROOT = Path(__file__).resolve().parents[1]

def load(path):
    text = Path(path).read_text(encoding="utf-8")
    return yaml.safe_load(text) if str(path).endswith((".yaml",".yml")) else json.loads(text)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--selection", required=True)
    parser.add_argument("--archetype", default="all")
    parser.add_argument("--skip-required-non-workflow", action="store_true", help="Validate only selected templates; do not require base scaffolds.")
    args = parser.parse_args()
    selection = load(args.selection)
    registry = yaml.safe_load((ROOT / "template-registry.yaml").read_text(encoding="utf-8"))
    registry_by_path = {item["template_path"]: item for item in registry.get("templates", [])}
    errors = []

    for item in selection.get("selected_templates", []):
        template = item.get("template_path")
        if template not in registry_by_path:
            errors.append(f"Selected template not in registry: {template}")
        elif not (ROOT / template).exists():
            errors.append(f"Selected template missing on disk: {template}")

    if not args.skip_required_non_workflow:
        required = []
        for item in registry.get("templates", []):
            if item.get("required") and (args.archetype in item.get("archetypes", []) or "all" in item.get("archetypes", [])):
                required.append(item["template_path"])
        selected_paths = {item.get("template_path") for item in selection.get("selected_templates", [])}
        missing_required = [path for path in required if path not in selected_paths]
        if missing_required:
            errors.append("Missing required templates: " + ", ".join(missing_required))

    if errors:
        for err in errors:
            print(err)
        raise SystemExit(1)
    print("Selected template set validation passed.")

if __name__ == "__main__":
    main()

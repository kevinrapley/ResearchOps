#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
import yaml

BUNDLE_ROOT = Path(__file__).resolve().parents[1]
REQUIRED_MARKDOWN_SECTIONS = {
    "automated": ["automated checks", "axe", "pa11y", "lighthouse accessibility"],
    "keyboard": ["keyboard", "manual keyboard"],
    "focus": ["focus"],
    "screen_reader": ["screen reader", "screen-reader"],
    "known_defects": ["known defects", "defects"],
    "release_decision": ["release decision", "decision"],
}

def load_text(path):
    return Path(path).read_text(encoding="utf-8", errors="ignore")

def load_data(path):
    text = load_text(path)
    return yaml.safe_load(text) if str(path).endswith((".yaml", ".yml")) else json.loads(text)

def validate_schema(data, schema_path):
    errors = []
    try:
        from jsonschema import Draft7Validator
    except Exception as exc:
        return [f"jsonschema is required for structured accessibility evidence validation: {exc}"]
    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    validator = Draft7Validator(schema)
    for error in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        path = ".".join(str(p) for p in error.path) or "$"
        errors.append(f"schema:{path}: {error.message}")
    return errors

def resolve_artifact_path(file_path, evidence_path, root):
    p = Path(file_path)
    if p.is_absolute():
        return p
    candidates = [
        Path(root) / p,
        Path(evidence_path).parent / p,
        BUNDLE_ROOT / p,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]

def markdown_section_has_content(text, heading_terms):
    lines = text.splitlines()
    for i, line in enumerate(lines):
        normalized = line.strip().lower()
        if normalized.startswith("#") and any(term in normalized for term in heading_terms):
            body = []
            for next_line in lines[i+1:]:
                if next_line.strip().startswith("#"):
                    break
                if next_line.strip() and not next_line.strip().startswith("<!--"):
                    body.append(next_line.strip())
            return bool(body)
    return False

def validate_tool_output(tool, data, evidence_path, root):
    errors = []
    file_path = data.get("file")
    if not file_path:
        errors.append(f"{tool}.file is required")
        return errors
    p = resolve_artifact_path(file_path, evidence_path, root)
    if not p.exists():
        errors.append(f"{tool} output file not found: {file_path}")
        return errors
    parsed = json.loads(p.read_text(encoding="utf-8"))
    if tool == "axe":
        if not isinstance(parsed.get("violations", []), list):
            errors.append("axe output must contain violations list")
        if len(parsed.get("violations", [])) > 0:
            errors.append("axe output contains violations")
    elif tool == "pa11y":
        if not isinstance(parsed, list):
            errors.append("pa11y output must be a list")
        if len(parsed) > 0:
            errors.append("pa11y output contains issues")
    elif tool == "lighthouse":
        score = ((parsed.get("categories") or {}).get("accessibility") or {}).get("score")
        if score is None:
            errors.append("lighthouse output missing categories.accessibility.score")
        elif float(score) < 0.9:
            errors.append("lighthouse accessibility score below 0.9")
    return errors

def validate_structured(path, schema_path, root):
    data = load_data(path)
    errors = validate_schema(data, schema_path)
    automated = data.get("automated_checks") or {}
    for tool in ["axe", "pa11y", "lighthouse"]:
        if tool not in automated:
            errors.append(f"automated_checks.{tool} is required")
        else:
            errors.extend(validate_tool_output(tool, automated[tool], path, root))
    for field in ["keyboard_tests", "screen_reader_tests", "assistive_technology_matrix", "defects"]:
        if not data.get(field):
            errors.append(f"{field} is required and must not be empty")
    for test in data.get("keyboard_tests", []):
        if not test.get("steps") or test.get("result") != "pass":
            errors.append("keyboard_tests entries require steps and result: pass")
    for test in data.get("screen_reader_tests", []):
        if not all(test.get(k) for k in ["screen_reader", "browser", "notes"]) or test.get("result") != "pass":
            errors.append("screen_reader_tests entries require screen_reader, browser, notes and result: pass")
    severities = [d.get("severity") for d in data.get("defects", []) if d.get("status") != "closed"]
    if any(s in {"high", "critical"} for s in severities):
        errors.append("open high or critical accessibility defects block release")
    if data.get("release_decision") not in {"pass", "pass_with_gap"}:
        errors.append("release_decision must be pass or pass_with_gap")
    return errors

def validate_markdown(path):
    text = load_text(path)
    errors = []
    for key, terms in REQUIRED_MARKDOWN_SECTIONS.items():
        if not markdown_section_has_content(text, terms):
            errors.append(f"Missing populated accessibility evidence section: {key}")
    if not any(term in text.lower() for term in ["manual", "keyboard", "screen reader"]):
        errors.append("Manual accessibility evidence is required, not only automated results")
    return errors

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--schema", default="contracts/accessibility-evidence.schema.json")
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    path = Path(args.path)
    root = Path(args.root)
    if not root.is_absolute():
        root = (Path.cwd() / root).resolve()
    schema_path = Path(args.schema)
    if not schema_path.is_absolute():
        schema_path = BUNDLE_ROOT / schema_path
    if path.suffix in {".yaml", ".yml", ".json"}:
        errors = validate_structured(path, schema_path, root)
    else:
        errors = validate_markdown(path)
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Accessibility evidence validation passed.")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from pathlib import Path
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
import yaml

ROOT = Path(__file__).resolve().parents[1]
CITATION = re.compile(r"【[^】]*†L\d+(?:-L\d+)?】")
SECRET_PATTERNS = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?i)(api[_-]?key|secret|password)\s*[:=]\s*['\"][^'\"]{8,}['\"]"),
]
GENERATED_PARTS = {"__pycache__", ".pytest_cache", "node_modules", "dist", "build", "coverage", "artifacts", "tmp", "temp", "__MACOSX"}
GENERATED_SUFFIXES = {".pyc", ".pyo", ".log"}
REQUIRED_OUTPUT_FIELDS = {
    "response",
    "mode_selected",
    "repository_classification",
    "evidence_read",
    "branch_decision",
    "mutation_strategy",
    "files_changed",
    "commands_run",
    "validation_results",
    "gaps",
    "waivers",
    "risk_decision",
    "pr_readiness",
    "safe_audit_trail",
}
REQUIRED_GRADE_FIELDS = {
    "grader_id",
    "score",
    "decision",
    "blocking_failures",
    "evidence",
    "deductions",
    "feedback",
}


def is_generated(path: Path) -> bool:
    try:
        parts = set(path.relative_to(ROOT).parts)
    except ValueError:
        parts = set(path.parts)
    return bool(parts & GENERATED_PARTS) or path.suffix in GENERATED_SUFFIXES


def files_for_manifest():
    return {
        p.relative_to(ROOT).as_posix()
        for p in ROOT.rglob("*")
        if p.is_file() and p.name != "registry-manifest.yaml" and not is_generated(p)
    }


def load_yaml(path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def check_schema_shape(path, data, errors):
    if not path.name.endswith(".schema.json"):
        return
    if "$schema" not in data:
        errors.append(f"Schema missing $schema: {path.relative_to(ROOT)}")
    if data.get("type") != "object":
        errors.append(f"Schema type must be object: {path.relative_to(ROOT)}")
    if "properties" not in data:
        errors.append(f"Schema missing properties: {path.relative_to(ROOT)}")


def strict_schema_checks(schema_docs, errors):
    try:
        from jsonschema import Draft7Validator
    except Exception as exc:
        errors.append(f"Strict mode requires jsonschema: {exc}")
        return
    for path, data in schema_docs:
        try:
            Draft7Validator.check_schema(data)
        except Exception as exc:
            errors.append(f"Invalid JSON schema {path.relative_to(ROOT)}: {exc}")


def contract_strength_checks(errors):
    output = json.loads((ROOT / "output.schema.json").read_text(encoding="utf-8"))
    grade = json.loads((ROOT / "grade.schema.json").read_text(encoding="utf-8"))
    output_required = set(output.get("required", []))
    grade_required = set(grade.get("required", []))

    missing_output = sorted(REQUIRED_OUTPUT_FIELDS - output_required)
    if missing_output:
        errors.append("output.schema.json missing required contract fields: " + ", ".join(missing_output))
    if output.get("additionalProperties") is not False:
        errors.append("output.schema.json must set additionalProperties to false")
    if "safe_audit_trail" not in output.get("properties", {}):
        errors.append("output.schema.json must require a safe_audit_trail property")

    missing_grade = sorted(REQUIRED_GRADE_FIELDS - grade_required)
    if missing_grade:
        errors.append("grade.schema.json missing required contract fields: " + ", ".join(missing_grade))
    if grade.get("additionalProperties") is not False:
        errors.append("grade.schema.json must set additionalProperties to false")
    decision = grade.get("properties", {}).get("decision", {})
    if set(decision.get("enum", [])) != {"pass", "pass_with_gap", "fail"}:
        errors.append("grade.schema.json decision enum must be pass, pass_with_gap, fail")

    for rel in ["contracts/evidence-state.schema.json", "contracts/safe-audit-trail.schema.json"]:
        if not (ROOT / rel).exists():
            errors.append(f"Required shared contract missing: {rel}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    errors = []
    schema_docs = []

    for p in ROOT.rglob("*"):
        if not p.is_file() or is_generated(p):
            continue
        if p.suffix == ".xml":
            try:
                tree = ET.parse(p)
                if not tree.getroot().attrib.get("version"):
                    errors.append(f"XML root missing version: {p.relative_to(ROOT)}")
            except Exception as exc:
                errors.append(f"XML parse error: {p.relative_to(ROOT)}: {exc}")
        elif p.suffix == ".json":
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                check_schema_shape(p, data, errors)
                if p.name.endswith(".schema.json"):
                    schema_docs.append((p, data))
            except Exception as exc:
                errors.append(f"JSON parse error: {p.relative_to(ROOT)}: {exc}")
        elif p.suffix in {".yaml", ".yml"}:
            try:
                load_yaml(p)
            except Exception as exc:
                errors.append(f"YAML parse error: {p.relative_to(ROOT)}: {exc}")

    if args.strict:
        strict_schema_checks(schema_docs, errors)
        contract_strength_checks(errors)

    for p in ROOT.rglob("*"):
        if p.is_file() and not is_generated(p) and p.suffix.lower() in {".md", ".xml", ".yaml", ".yml", ".json", ".py", ".txt"}:
            txt = p.read_text(encoding="utf-8", errors="ignore")
            if CITATION.search(txt):
                errors.append(f"Transient citation marker found: {p.relative_to(ROOT)}")

    manifest = ROOT / "registry-manifest.yaml"
    data = load_yaml(manifest)
    manifest_files = set()
    for artifact in data.get("artifacts", []):
        rel = artifact["path"]
        manifest_files.add(rel)
        path = ROOT / rel
        if is_generated(path):
            errors.append(f"Generated artefact must not be in manifest: {rel}")
            continue
        if not path.exists():
            errors.append(f"Manifest path missing: {rel}")
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != artifact.get("sha256"):
            errors.append(f"Manifest hash mismatch: {rel}")

    actual_files = files_for_manifest()
    missing = sorted(actual_files - manifest_files)
    extra = sorted(manifest_files - actual_files)
    if missing:
        errors.append("Files missing from manifest: " + ", ".join(missing[:20]))
    if extra:
        errors.append("Manifest contains extra/generated files: " + ", ".join(extra[:20]))

    spec = load_yaml(ROOT / "prompt.spec.yaml")
    assembly = spec.get("assembly", {})
    for key in ["always_load", "mode_modules", "role_modules", "contract_modules", "grader_modules"]:
        for rel in assembly.get(key, []) or []:
            if not (ROOT / rel).exists():
                errors.append(f"prompt.spec.yaml references missing path under {key}: {rel}")
    if assembly.get("template_registry") and not (ROOT / assembly["template_registry"]).exists():
        errors.append(f"prompt.spec.yaml template_registry missing: {assembly.get('template_registry')}")

    registry = load_yaml(ROOT / "template-registry.yaml")
    seen = set()
    for item in registry.get("templates", []):
        tid = item.get("id")
        if tid in seen:
            errors.append(f"Duplicate template id: {tid}")
        seen.add(tid)
        if not (ROOT / item.get("template_path", "")).exists():
            errors.append(f"Template registry path missing: {item.get('template_path')}")
        if item.get("template_path") == "templates/RECENT_LEARNINGS-template.md" and item.get("destination_path") != "RECENT_LEARNINGS.md":
            errors.append("RECENT_LEARNINGS-template.md must scaffold to RECENT_LEARNINGS.md")

    evals = load_yaml(ROOT / "evals.yaml")
    for item in evals.get("evals", []):
        if not (ROOT / item.get("fixture_repo", "")).exists():
            errors.append(f"Eval fixture_repo does not exist: {item.get('fixture_repo')}")
        for grader in item.get("graders", []):
            gp = ROOT / "graders" / (grader if str(grader).endswith(".xml") else f"{grader}.xml")
            if not gp.exists():
                errors.append(f"Eval references missing grader: {grader}")

    for p in list((ROOT / "examples").rglob("*")) + list((ROOT / "templates").rglob("*")):
        if p.is_file() and not is_generated(p):
            txt = p.read_text(encoding="utf-8", errors="ignore")
            for pattern in SECRET_PATTERNS:
                if pattern.search(txt):
                    errors.append(f"Potential secret pattern found in {p.relative_to(ROOT)}")

    if errors:
        for err in errors:
            print(err)
        raise SystemExit(1)
    print("Bundle validation passed.")

if __name__ == "__main__":
    main()

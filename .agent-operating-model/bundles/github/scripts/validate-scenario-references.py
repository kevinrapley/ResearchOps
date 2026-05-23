#!/usr/bin/env python3
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
SCENARIOS = ROOT / "examples" / "scenarios"

REFERENCE_LISTS = [
    ("expected_mode.file", lambda data: [data.get("expected_mode", {}).get("file")]),
    ("roles.primary", lambda data: data.get("roles", {}).get("primary", [])),
    ("roles.supporting", lambda data: data.get("roles", {}).get("supporting", [])),
    ("references.must_load", lambda data: data.get("references", {}).get("must_load", [])),
    ("contracts.must_apply", lambda data: data.get("contracts", {}).get("must_apply", [])),
    ("graders.must_consider", lambda data: data.get("graders", {}).get("must_consider", [])),
]


def load_yaml(path):
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def path_exists(rel):
    return bool(rel) and (ROOT / rel).exists()


def template_registry():
    registry = load_yaml(ROOT / "template-registry.yaml")
    by_id = {}
    by_path = {}
    for item in registry.get("templates", []):
        tid = item.get("id")
        tpath = item.get("template_path")
        if tid:
            by_id[tid] = item
        if tpath:
            by_path[tpath] = item
    return by_id, by_path


def check_path_refs(path, data, errors):
    for label, getter in REFERENCE_LISTS:
        refs = [item for item in as_list(getter(data)) if item]
        for ref in refs:
            if not isinstance(ref, str):
                errors.append(f"{path.name}: {label} contains non-string reference: {ref!r}")
                continue
            if not path_exists(ref):
                errors.append(f"{path.name}: {label} references missing path: {ref}")


def selected_template_items(data):
    items = []
    if isinstance(data.get("selected_template"), dict):
        items.append(data["selected_template"])
    items.extend(item for item in data.get("selected_templates", []) or [] if isinstance(item, dict))
    return items


def check_selected_templates(path, data, registry_by_id, registry_by_path, errors):
    for item in selected_template_items(data):
        tid = item.get("id")
        tpath = item.get("template_path")
        destination = item.get("destination_path")
        if not tid:
            errors.append(f"{path.name}: selected template is missing id")
            continue
        if tid not in registry_by_id:
            errors.append(f"{path.name}: selected template id not found in template-registry.yaml: {tid}")
            continue
        registry_item = registry_by_id[tid]
        if tpath and registry_item.get("template_path") != tpath:
            errors.append(f"{path.name}: selected template {tid} path mismatch: scenario={tpath} registry={registry_item.get('template_path')}")
        if destination and registry_item.get("destination_path") != destination:
            errors.append(f"{path.name}: selected template {tid} destination mismatch: scenario={destination} registry={registry_item.get('destination_path')}")
        if not path_exists(registry_item.get("template_path")):
            errors.append(f"{path.name}: selected template {tid} references missing template path: {registry_item.get('template_path')}")
        associated_contract = registry_item.get("associated_contract")
        if associated_contract and not path_exists(associated_contract):
            errors.append(f"{path.name}: selected template {tid} associated contract missing: {associated_contract}")
        for grader in registry_item.get("associated_graders", []) or []:
            if not path_exists(grader):
                errors.append(f"{path.name}: selected template {tid} associated grader missing: {grader}")

    for item in data.get("rejected_templates", []) or []:
        if not isinstance(item, dict):
            errors.append(f"{path.name}: rejected_templates contains non-object entry")
            continue
        tid = item.get("id")
        reason = item.get("reason")
        if not tid:
            errors.append(f"{path.name}: rejected template is missing id")
        if not reason:
            errors.append(f"{path.name}: rejected template {tid or '<missing>'} is missing reason")
        if tid and tid not in registry_by_id:
            errors.append(f"{path.name}: rejected template id not found in template-registry.yaml: {tid}")


def check_required_sections(path, data, errors):
    for field in ["id", "kind", "status", "user_prompt", "repository_context", "expected_mode", "roles", "contracts", "graders"]:
        if field not in data:
            errors.append(f"{path.name}: missing required scenario field: {field}")
    if data.get("kind") != "scenario":
        errors.append(f"{path.name}: kind must be scenario")
    if data.get("status") not in {"canonical", "draft", "deprecated"}:
        errors.append(f"{path.name}: status must be canonical, draft, or deprecated")
    if "failure_conditions" in data and not data.get("failure_conditions"):
        errors.append(f"{path.name}: failure_conditions must not be empty when provided")


def main():
    errors = []
    registry_by_id, registry_by_path = template_registry()
    scenario_files = sorted(SCENARIOS.glob("*.yaml"))
    if not scenario_files:
        errors.append("No scenario files found under examples/scenarios")
    seen_ids = set()
    for path in scenario_files:
        try:
            data = load_yaml(path)
        except Exception as exc:
            errors.append(f"{path.name}: YAML parse error: {exc}")
            continue
        sid = data.get("id")
        if sid in seen_ids:
            errors.append(f"{path.name}: duplicate scenario id: {sid}")
        if sid:
            seen_ids.add(sid)
        check_required_sections(path, data, errors)
        check_path_refs(path, data, errors)
        check_selected_templates(path, data, registry_by_id, registry_by_path, errors)

    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Scenario reference validation passed.")


if __name__ == "__main__":
    main()

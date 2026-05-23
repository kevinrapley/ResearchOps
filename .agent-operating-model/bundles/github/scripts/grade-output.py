#!/usr/bin/env python3
from pathlib import Path
import argparse, json, yaml, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {"task_id","mode","files_read","files_changed","commands_run","contracts_validated","artifacts_created","gaps_recorded","waivers_recorded"}


def load_data(path):
    text = Path(path).read_text(encoding="utf-8")
    return yaml.safe_load(text) if str(path).endswith((".yaml",".yml")) else json.loads(text)


def validate_evidence(e):
    missing = REQUIRED - set(e)
    if missing:
        raise ValueError(f"Evidence missing required fields: {sorted(missing)}")


def load_grader(grader):
    gp = ROOT / "graders" / (grader if str(grader).endswith(".xml") else f"{grader}.xml")
    tree = ET.parse(gp)
    root = tree.getroot()
    criteria = [(c.attrib.get("id"), float(c.attrib.get("weight","0")), (c.text or "")) for c in root.findall(".//criterion")]
    pass_min = float(root.find(".//pass").attrib["minimum_score"])
    gap_min = float(root.find(".//pass_with_gap").attrib["minimum_score"])
    return criteria, pass_min, gap_min


def any_passed(items):
    return any(isinstance(i, dict) and i.get("status") == "passed" for i in items)


def evidence_state_record(state, rationale, source="agent-evidence"):
    return {
        "state": state,
        "rationale": rationale,
        "source": source,
    }


def emit_grade_result(grader_id, score, decision, blocking_failures, evidence, deductions):
    feedback_parts = []
    if decision == "pass":
        feedback_parts.append("Evidence satisfies the grader threshold.")
    elif decision == "pass_with_gap":
        feedback_parts.append("Evidence satisfies the gap threshold but has deductions that need review.")
    else:
        feedback_parts.append("Evidence does not satisfy the grader threshold or has blocking failures.")
    if blocking_failures:
        feedback_parts.append("Blocking failures: " + "; ".join(blocking_failures))
    if deductions:
        feedback_parts.append("Deductions: " + "; ".join(deductions[:3]))
    result = {
        "grader_id": grader_id,
        "score": round(score, 3),
        "decision": decision,
        "blocking_failures": blocking_failures,
        "evidence": evidence,
        "deductions": deductions,
        "feedback": " ".join(feedback_parts),
        "evidence_states": [
            evidence_state_record("verified" if decision != "fail" else "observed", "Grader result produced from structured agent evidence.")
        ],
    }
    print(yaml.safe_dump(result, sort_keys=False))


def github_settings_score(e):
    raw = e.get("github_settings") or {}
    gs = raw.get("observed_state") or raw.get("desired_state") or raw
    bp = gs.get("branch_protection") or {}
    sf = gs.get("security_features") or {}
    verification = raw.get("verification_method", "file" if (raw.get("desired_state") or not raw.get("observed_state")) else "api")
    checks = [
        bool(gs.get("default_branch")) and bool(bp),
        int(bp.get("required_reviews", 0) or 0) >= 1,
        bp.get("require_code_owner_reviews") is True,
        bool(bp.get("required_status_checks")),
        gs.get("workflow_permissions") in {"read", "restricted", "read-only"},
        all(sf.get(k) is True for k in ["dependabot","secret_scanning","code_scanning","dependency_review"]),
        sf.get("sbom_on_release") is True,
        verification in {"file", "api", "mixed"}
    ]
    score = sum(checks) / len(checks)
    evidence = [f"github_settings_check_{i+1}: {'pass' if ok else 'fail'}" for i, ok in enumerate(checks)]
    evidence.append(f"verification_method: {verification}")
    return score, evidence


def criterion_satisfied(text, e):
    t = text.lower()
    files_read = " ".join(e.get("files_read", [])).lower()
    files_changed = " ".join(e.get("files_changed", [])).lower()
    artifacts = " ".join(e.get("artifacts_created", [])).lower()
    contracts = " ".join(e.get("contracts_validated", [])).lower()
    repo_state = e.get("repository_state") or {}
    if "repository" in t and "state" in t:
        return repo_state.get("direct_state_verified") is True
    if "readme" in t or "instructions" in t:
        return any(x in files_read for x in ["readme", "agents.md", "contributing", "security.md", "recent_learnings"])
    if "recent" in t and "learning" in t:
        rl = e.get("recent_learnings") or {}
        return rl.get("read") is True or rl.get("updated") is True
    if "trap" in t or "project-specific" in t:
        rl = e.get("recent_learnings") or {}
        return rl.get("updated") is True or bool(rl.get("entry"))
    if "actionable" in t or "changelog" in t:
        rl = e.get("recent_learnings") or {}
        entry = str(rl.get("entry", "")).strip().lower()
        return bool(entry) and "changelog" not in entry
    if "manifest" in t or "stack" in t:
        return any(x in files_read for x in ["package.json","pyproject","go.mod","cargo.toml","pom.xml","gemfile","composer.json"])
    if "workflow" in t or "status check" in t:
        return bool(repo_state.get("selected_workflows")) or ".github/workflows" in files_changed or ".github/workflows" in artifacts
    if "format" in t or "lint" in t or "type" in t or "test" in t:
        return any_passed(e.get("commands_run", [])) or any_passed(e.get("tests_run", []))
    if "accessibility" in t or "keyboard" in t or "focus" in t or "screen reader" in t:
        acc = e.get("accessibility") or {}
        if acc.get("required") is False:
            return True
        return bool(acc.get("automated_checks")) and bool(acc.get("keyboard_checks")) and bool(acc.get("focus_checks"))
    if "gap" in t:
        return isinstance(e.get("gaps_recorded"), list)
    if "waiver" in t:
        return isinstance(e.get("waivers_recorded"), list)
    if "provenance" in t or "origin" in t:
        return "provenance" in artifacts or "provenance" in contracts
    if "release" in t or "changelog" in t or "rollback" in t:
        return any(x in artifacts or x in files_changed for x in ["release","changelog","rollback"])
    if "harm" in t or "affected groups" in t or "mitigation" in t:
        return bool(e.get("harms")) or "harm-register" in artifacts or "harm-register" in contracts
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--grader", required=True)
    parser.add_argument("--evidence", required=True)
    args = parser.parse_args()
    e = load_data(Path(args.evidence))
    validate_evidence(e)
    grader_id = Path(args.grader).stem
    if "github-settings" in grader_id:
        score, ev_lines = github_settings_score(e)
        decision = "pass" if score >= 0.85 else "pass_with_gap" if score >= 0.70 else "fail"
        emit_grade_result(grader_id, score, decision, [] if decision != "fail" else ["github_settings_below_threshold"], ev_lines, [])
        return
    criteria, pass_min, gap_min = load_grader(args.grader)
    score = 0.0
    ev_lines = []
    deductions = []
    for cid, weight, text in criteria:
        if criterion_satisfied(text, e):
            score += weight
            ev_lines.append(f"Criterion {cid} satisfied: {text}")
        else:
            deductions.append(f"Criterion {cid} not evidenced: {text}")
    claims = " ".join(e.get("claims", [])).lower()
    blocking = []
    if "tests passed" in claims and not (any_passed(e.get("commands_run", [])) or any_passed(e.get("tests_run", []))):
        blocking.append("Claimed tests passed without passing command/test evidence.")
    decision = "pass" if score >= pass_min and not blocking else "pass_with_gap" if score >= gap_min and not blocking else "fail"
    emit_grade_result(grader_id, score, decision, blocking, ev_lines, deductions)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from pathlib import Path
import fnmatch
import yaml

ROOT = Path(__file__).resolve().parents[1]

def file_list(repo: Path):
    return [
        p.relative_to(repo).as_posix()
        for p in repo.rglob("*")
        if p.is_file() and "__pycache__" not in p.parts and p.suffix not in {".pyc", ".pyo"}
    ]

def file_exists(repo: Path, pattern: str, files=None):
    files = files if files is not None else file_list(repo)
    if any(ch in pattern for ch in "*?[]"):
        return any(fnmatch.fnmatch(f, pattern) for f in files)
    return (repo / pattern).exists()

def read_text_if_exists(repo: Path, rel: str):
    path = repo / rel
    return path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""

def infer_web(repo: Path, files=None):
    files = files if files is not None else file_list(repo)
    package = read_text_if_exists(repo, "package.json").lower()
    if any(term in package for term in ["react", "next", "vite", "svelte", "vue", "angular", "govuk-frontend"]):
        return True
    return any(f in files for f in ["index.html", "public/index.html"]) or any(f.startswith("src/app") for f in files)

def infer_public_service(repo: Path):
    blob = "\n".join([
        read_text_if_exists(repo, "package.json"),
        read_text_if_exists(repo, "README.md"),
        read_text_if_exists(repo, "govuk-frontend.config.js"),
        read_text_if_exists(repo, "service-manual.md"),
    ]).lower()
    return "govuk" in blob or "public service" in blob or "service manual" in blob or "wcag" in blob

def infer_performance_sensitive(repo: Path):
    return (repo / "performance-budget.yaml").exists() or (repo / "performance-budget.yml").exists()

def build_traits(repo: Path, public_service=False, web=False, performance_sensitive=False, release=False, bundle_release=False):
    files = file_list(repo)
    return {
        "web": web or infer_web(repo, files),
        "public_service": public_service or infer_public_service(repo),
        "performance_sensitive": performance_sensitive or infer_performance_sensitive(repo),
        "release": release,
        "bundle_release": bundle_release,
    }

def condition_matches(condition, repo: Path, files, traits):
    condition = str(condition)
    if condition in {"all-repositories", "instantiate repository or when matching artefact is needed"}:
        return True
    if condition.startswith("file_exists:"):
        return file_exists(repo, condition.split(":", 1)[1], files)
    if condition.startswith("dir_exists:"):
        return (repo / condition.split(":", 1)[1]).is_dir()
    if condition == "web-ui":
        return traits.get("web") is True
    if condition == "public-service":
        return traits.get("public_service") is True
    if condition == "performance-sensitive":
        return traits.get("performance_sensitive") is True
    if condition == "release":
        return traits.get("release") is True
    if condition == "bundle-release":
        return traits.get("bundle_release") is True
    return False

def load_registry(root: Path = ROOT):
    return yaml.safe_load((root / "template-registry.yaml").read_text(encoding="utf-8"))

def select_workflow_templates(repo: Path, traits=None, root: Path = ROOT):
    traits = traits if traits is not None else build_traits(repo)
    files = file_list(repo)
    registry = load_registry(root)
    selected = []
    detected = set()
    for item in registry.get("templates", []):
        template_path = item.get("template_path", "")
        if not template_path.startswith("templates/github/.github/workflows/"):
            continue
        triggers = item.get("trigger_conditions", []) or []
        if triggers and not any(condition_matches(condition, repo, files, traits) for condition in triggers):
            continue
        destination = item.get("destination_path", "")
        if not destination.startswith(".github/"):
            destination = ".github/workflows/" + Path(template_path).name
        required_for = item.get("required_for", []) or []
        for value in required_for:
            if value not in {"all", "web-app", "api-service", "library", "cli", "agent-system"}:
                detected.add(value)
        selected.append({
            "id": item.get("id"),
            "template_path": template_path,
            "destination_path": destination,
            "required_for": required_for,
            "trigger_conditions": triggers,
            "required_status_check": item.get("required_status_check") or Path(template_path).stem.replace("-", " ").title(),
        })
    return sorted(detected), selected

def required_repository_files(risk_level="standard", traits=None):
    traits = traits or {}
    required = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "RECENT_LEARNINGS.md", "github-settings.yaml", "conformance-matrix.yaml", "gap-register.yaml"]
    high_risk = risk_level in {"high", "high-stakes", "regulated", "safety-critical", "public-sector", "personal-data", "ai-assisted"}
    if high_risk or traits.get("public_service"):
        required.append("harm-register.yaml")
    if traits.get("web") or traits.get("public_service"):
        required.append("accessibility-evidence.md")
    if traits.get("performance_sensitive"):
        required.append("performance-budget.yaml")
    return required

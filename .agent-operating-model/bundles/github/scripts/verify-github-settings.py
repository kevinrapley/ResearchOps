#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
import sys
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from github_settings_verification import verify_settings

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="Local repository path.")
    parser.add_argument("--settings", default="github-settings.yaml")
    parser.add_argument("--api", action="store_true", help="Inspect GitHub repository settings through the GitHub REST API.")
    parser.add_argument("--require-api", action="store_true", help="Fail if GitHub API verification cannot run or does not pass.")
    parser.add_argument("--owner")
    parser.add_argument("--repo-name")
    parser.add_argument("--branch")
    parser.add_argument("--token-env", default="GITHUB_TOKEN")
    parser.add_argument("--allow-api-unavailable", action="store_true")
    parser.add_argument("--output", choices=["yaml", "json"], default="yaml")
    args = parser.parse_args()

    local_repo = Path(args.repo)
    settings_path = Path(args.settings)
    if not settings_path.is_absolute():
        settings_path = local_repo / settings_path

    result, errors = verify_settings(
        local_repo,
        settings_path,
        api=args.api,
        owner=args.owner,
        repo_name=args.repo_name,
        branch=args.branch,
        token_env=args.token_env,
        allow_api_unavailable=args.allow_api_unavailable,
        require_api=args.require_api,
    )
    print(json.dumps(result, indent=2) if args.output == "json" else yaml.safe_dump(result, sort_keys=False))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()

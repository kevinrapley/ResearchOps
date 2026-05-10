#!/usr/bin/env python3
from io import BytesIO
from urllib.error import HTTPError
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import importlib
import github_settings_verification as gsv
gsv = importlib.reload(gsv)

class FakeResponse:
    def __init__(self, status=200, body=b"{}"):
        self.status = status
        self.code = status
        self._body = body
    def read(self):
        return self._body
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False

def expect_error(fn, text):
    try:
        fn()
    except Exception as exc:
        if text not in str(exc):
            raise AssertionError(f"Expected error containing {text!r}, got {exc!r}") from exc
        return
    raise AssertionError(f"Expected error containing {text!r}")

def main():
    original = gsv.urllib.request.urlopen
    try:
        gsv.urllib.request.urlopen = lambda request, timeout=20: FakeResponse(status=204, body=b"")
        result = gsv.github_api_get("https://api.github.test/204", "token", strict=True)
        assert result == {}, "204 No Content should return empty object"

        def raise_403(request, timeout=20):
            raise HTTPError(request.full_url, 403, "Forbidden", hdrs=None, fp=BytesIO(b""))
        gsv.urllib.request.urlopen = raise_403
        expect_error(lambda: gsv.github_api_get("https://api.github.test/403", "token", strict=True), "insufficient token permissions")

        def raise_404(request, timeout=20):
            raise HTTPError(request.full_url, 404, "Not Found", hdrs=None, fp=BytesIO(b""))
        gsv.urllib.request.urlopen = raise_404
        expect_error(lambda: gsv.github_api_get("https://api.github.test/404", "token", strict=True), "not observable")

        gsv.urllib.request.urlopen = lambda request, timeout=20: FakeResponse(status=200, body=b"{}")
        api_state = {
            "branch_protection": {
                "required_status_checks": [],
                "required_approving_review_count": 1,
                "require_code_owner_reviews": True,
                "require_conversation_resolution": False,
                "require_signed_commits": False,
                "linear_history": False
            },
            "actions_policy": {"allowed_actions": "all", "default_workflow_permissions": "write"},
            "codeowners": {"errors": []},
            "rulesets": [],
            "environments": []
        }
        errors, warnings = gsv.api_semantic_checks(api_state, ["CI (Conformance)"])
        assert any("missing selected checks" in error for error in errors), "missing required status checks should be reported"
        assert any("rulesets" in warning for warning in warnings), "missing rulesets should be reported clearly"
        assert any("environments" in warning for warning in warnings), "missing environments should be reported clearly"

    finally:
        gsv.urllib.request.urlopen = original
    print("GitHub API strict-mode fixture validation passed.")

if __name__ == "__main__":
    main()

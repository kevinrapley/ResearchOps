def test_fixture_metadata():
    metadata = {
        "kind": "eval-output",
        "mode": "repo-instantiate",
        "language": "python",
    }

    assert metadata["kind"] == "eval-output"
    assert metadata["mode"] == "repo-instantiate"
    assert metadata["language"] == "python"

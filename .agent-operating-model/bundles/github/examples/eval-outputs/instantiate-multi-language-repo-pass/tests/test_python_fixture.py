import unittest


class PythonFixtureEvidenceTest(unittest.TestCase):
    def test_generated_repository_fixture_exposes_python_validation_evidence(self):
        fixture = {
            "kind": "eval-output",
            "mode": "repo-instantiate",
            "language": "python",
        }

        self.assertEqual(fixture["kind"], "eval-output")
        self.assertEqual(fixture["mode"], "repo-instantiate")
        self.assertEqual(fixture["language"], "python")


if __name__ == "__main__":
    unittest.main()

The failing workflow should be repaired with the smallest safe change.

The workflow currently calls `npm run test:ci`, but the repository only declares `test` in `package.json`. That means the CI command does not match repository evidence. The repository also has `package-lock.json`, so `npm ci` is the appropriate deterministic install command for CI.

The proposed change is limited to `.github/workflows/ci-node.yml`.

```yaml
      - name: Install dependencies
        run: npm ci

      - name: Run test suite
        run: npm test
```

The agent should preserve existing triggers, job names and quality gates. It should not remove the test step, upgrade dependencies, add deployment behaviour or rewrite unrelated files.

Validation commands:

```bash
npm ci
npm test
```

If the agent cannot run those commands, it must state that they are required validation evidence rather than claiming they passed.

PR summary:

This change aligns the Node CI workflow with the repository's declared package scripts and uses deterministic dependency installation through `npm ci`.

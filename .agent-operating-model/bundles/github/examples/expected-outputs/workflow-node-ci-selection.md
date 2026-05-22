The correct workflow choice is Node CI.

The repository has `package.json`, `package-lock.json`, `src/server.js` and `test/server.test.js`. That is enough evidence to classify the repository as a Node service with automated tests.

The workflow should use `actions/checkout`, `actions/setup-node`, deterministic dependency installation with `npm ci`, then run the declared quality commands from `package.json`.

The expected workflow shape is:

```yaml
name: CI Node

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run lint
        run: npm run lint

      - name: Run tests
        run: npm test
```

The agent should not add deployment, release, accessibility or performance jobs unless repository evidence shows they are required.

The minimum evidence for the decision is `package.json`, `package-lock.json`, the test file, and the selected template entry in `template-registry.yaml`.

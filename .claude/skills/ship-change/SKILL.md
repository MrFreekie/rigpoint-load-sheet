---
name: ship-change
description: Take a finished RigPoint Load Sheet change from branch to live - pull request, review, conflicts with main, merging (only on the owner's say-so), watching the deploy and checking the live site. Use when work is ready to go out or when a PR needs bringing up to date.
---

# Shipping a change

Merging to `main` deploys to https://mrfreekie.github.io/rigpoint-load-sheet/. Nothing goes to `main` except by merging a pull request, and only when the owner says to merge.

## 1. Pull request

- Branch from up-to-date `main`. Commit messages end with the session's `Co-Authored-By` line.
- Push and open a PR with `gh pr create`. Description: what changed, why, how it was tested, new dependencies with reasons, what still needs the owner. End with the session's generated-PR line.
- Run the `verify-change` skill; wait for CI to pass (`gh pr checks <n>`).
- For anything touching the calculation, files or library, ask the `reviewer` agent for a review and include its findings.

## 2. Bringing a PR up to date

Merge, do not rebase (no force-pushes):

```bash
git checkout <branch> && git pull && git merge origin/main
```

Resolve conflicts by keeping both sides where both are intended (common case: both branches appended to the end of `src/ui/styles.css`). If `spec_version` conflicts, take the higher version and move it forward again if this branch changes the library. Rerun `verify-change`, push, and note the merge in the PR description.

## 3. Merge (owner's decision)

Only when the owner says so:

```bash
gh pr merge <n> --merge --delete-branch
```

Library PRs also need the second reviewer's agreement.

## 4. Deploy and check

```bash
gh run list --branch main --workflow Deploy --limit 1
gh run watch <id> --exit-status
```

Then run the live-site tests from `verify-change`. Installed apps show "Update available – reload" on their next hourly check.

## 5. Tidy up

`git checkout main && git pull`, delete the merged local branch, and bring any other open PRs up to date if the merge caused conflicts.

# ugs-map-viewer (agent context)

Repo-specific conventions. Org-wide rules live in the shared `agents-config` AGENTS.md — this
file only covers what's specific to this repo.

## Code comments

- Keep comments short. A line or two of *why*, not a paragraph of history.
- Never reference a Jira ticket, GitHub PR, or GitHub issue number in a code comment (no
  `ALL-####`, no `#123`). Tickets close, get renumbered, or go stale — the comment outlives
  them and shouldn't lean on IDs nobody reading the code can look up. If something needs a
  paper trail, put it in the commit message or PR description, not the source.
- Don't narrate the history of a decision ("an earlier pass assumed X, re-confirmed during Y
  that this was wrong"). State the current fact only — what's true now and why, not who found
  it or when.
- Cut anything a reviewer would call bookkeeping: status updates, "not visible yet" tracking
  notes tied to a ticket, links to old PRs. If it's about the state of a rollout rather than the
  code itself, it belongs in the PR body.

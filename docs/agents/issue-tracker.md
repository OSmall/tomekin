# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations; it infers `OSmall/tomekin`
from this clone's remote.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <path>`. Write multiline bodies to a file first.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments` with appropriate state and
  label
  filters.
- **Comment, label, or close**: use `gh issue comment`, `gh issue edit`, and `gh issue close`.

## Ticket relationships

`/to-tickets` publishes tickets in dependency order, blockers first. If the source spec is an existing issue, link its
tickets as sub-issues. Apply the configured `ready-for-agent` label to these tickets; they are already agent-ready.

- **Sub-issue**: `gh api --method POST repos/OSmall/tomekin/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`.
  If sub-issues are unavailable, put `Part of #<parent>` at the top of the child body and list the child in the parent's
  task list.
- **Blocking edge**:
  `gh api --method POST repos/OSmall/tomekin/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`.
  Use native issue dependencies when available; otherwise put `Blocked by: #<n>, #<n>` at the top of the child body.
- **Database IDs**: obtain the child or blocker's numeric database ID with
  `gh api repos/OSmall/tomekin/issues/<number> --jq .id`; it is distinct from the issue number and `node_id`.
- **Ready tickets**: an issue is unblocked when every blocker is closed. Read
  `gh api repos/OSmall/tomekin/issues/<number> --jq .issue_dependencies_summary.blocked_by` for its count of open native
  blockers; when using the text fallback, check the referenced issues' states.

## Pull requests as a triage surface

**PRs as a request surface: no.** GitHub pull requests are not part of the triage queue. Change this flag to `yes` only
if external PRs should be treated as feature requests.

## Skill vocabulary

When a skill says to publish to the issue tracker, create a GitHub issue. When it says to fetch the relevant ticket, run
`gh issue view <number> --json number,title,body,labels,comments`.

## Wayfinding operations

`/wayfinder` uses one `wayfinder:map` GitHub issue as its map and child issues as tickets. Label children by type
(`wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`) and link them using the ticket
relationships above. The ready frontier consists of open children with no open blockers and no assignee, in map order.
Claim a ticket with `gh issue edit <number> --add-assignee @me`. Resolve it with an answer comment, close it, and add a
summary and link to the map's Decisions-so-far.

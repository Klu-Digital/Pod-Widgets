# Prompts

The prompts I typed into Claude Code while building this project, oldest first, grouped by session.
Prompts given to sub-agents and Orca workers are left out, as are `/clear` and `/model`.

## Session 1 (2026-10-27 19:43)

### 2026-10-27 19:43

````text
Main Challenge:
```
Build a web application with minimal styling. Where a user can add one, or more basic text
widgets by clicking a button. The widget allows users to input a string of text, no need to
worry about allowing formatting or fancy fonts. But there should be a way to add multiple text
widgets and each text widget should have a border around it. Any component that is
reusable (e.g. input boxes, buttons) should be a reusable component.
The text should not be shared between widgets. Each widget is its own independent entity
that can be filled with its own content. When a user is done typing, the text from that widget
should be sent to the backend to be stored.
If the page is refreshed, the same widgets should be populated with the same text as
entered before the page refresh.
```

Additional Ideas we could add:
normal text widget
banner text widget (e.g. idea, warning, etc.)
image widget
multiple pages
audit widget creation

Some things to consider:
- I will host this on a throwaway VPS
- Remove the existing authn and authz system -- instead, ask the user to enter their name on first entry. An identity should be saved in localstorage.
- Include a created_by column for the widgets.
- Idea for the data structure: use Class Table Inheritance. create a `widget` table and create sub-tables under it
- use a rich text editor for text widgets. possibly use https://github.com/shadcn-labs/editorcn
- banner text widget should be similar to normal text widgets, but they should have an icon (just use emojis) + a background color.
- use s3 compatible storage for images. locally, i have minio installed
- i want to also have the ability to delete widgets.
    - soft delete them and make a toast appear for 10 seconds for the user to undo the change if needed.
    - possibly use optimistic updates here to optimize the experience of the user
- add this to your memory: don't overkill the tests -- just test core functionality. we don't need tests for every single thing
    - use `vp` (vite plus) for running tests
    - use `testcontainers` to run mock dbs 

Please create GitHub issues through the `gh` cli. Create Epics and create tickets under those epics. Please be cautious of the time -- this should all be doable in 90 minutes.
Do not output actual code yet.
Please add the following per ticket:
Size, Description, Prerequisites, etc. (any other thing useful)
The issues should appear in https://github.com/Klu-Digital/Pod-Widgets/issues
````

### 2026-10-27 19:44

````text
also, per epic, please mention parallelizable issues
````

## Session 2 (2026-10-27 19:55)

### 2026-10-27 19:55

````text
/orchestration Please implement this Epic:
https://github.com/Klu-Digital/Pod-Widgets/issues/1

Please use the `gh` cli to view the issue/epic.
You are the orchestrator -- please use `dsh` headless to scout and implement.
For now, just do everything in the main branch -- don't branch out.
Commit per issue change.
Use `gh` to update issues accordingly e.g. inprogress, complete, etc.
Don't push anything yet.

After everything, provide a guide on how a human like me should review the changes.
````

### 2026-10-27 20:08

````text
/orchestration https://github.com/Klu-Digital/Pod-Widgets/issues

Please use the `gh` cli to view the issues.
You are the orchestrator -- please use a Haiku 5.5 instances to scout, and Sonnet 5.5 (high reasoning) to implement.
Create new terminal instances if you need to.
Create worktrees if you need to

Please do an initial batch of changes that are parallelizable. Update issues/epics accordingly with comments, and update their status as necessary.
Don't do everything in one go -- batch the changes so it's managable to review the changes.

After everything, provide a guide on how a human like me should review the changes.
````

### 2026-10-27 20:50

````text
Please provide the prompt to run for the next batch. 
I'll pass it into another session to clear the context.
I've reviewed the work and it looks sound.
````

## Session 3 (2026-10-27 20:56)

### 2026-10-27 20:56

````text
/orchestration Run wave 2 of https://github.com/Klu-Digital/Pod-Widgets/issues (use the `gh` CLI to read issues/epics).

Roles: you are the orchestrator. Use Haiku 5.5 (`--model claude-haiku-5-5`) for read-only scouts and Sonnet 5.5 high (`--model claude-sonnet-5-5 --effort high`) for implementation. Create Orca worktrees/terminals as needed. Do NOT push anything.

## Step 0 — land wave 1 (already human-reviewed and approved)
- In the main checkout: `git checkout main && git merge --ff-only k22i/wave-1-integration`. If it is not a fast-forward, stop and ask me.
- Close #8, #10, #13, #14 with a short comment ("Merged locally into main via k22i/wave-1-integration; reviewed by a human"), remove their `in-progress` label, and tick their checkboxes in the epic bodies (#1, #2, #3).
- Leave the old wave-1 worktrees/branches alone (I'll clean them up).

## Wave 2 scope (parallel, both based on the new main)
1. **#9 Name prompt + localStorage identity on the API context** (Epic #1). Notes:
   - #8 already collapsed `packages/api/src/procedures.ts` to `publicProcedure` + `mutationProcedure` (`afterCommit` before `transaction`, which is load-bearing; keep it). Add `identityProcedure` / `identityMutationProcedure` on top of those.
   - The `TextField` from #13 exists in `apps/web/src/components/`; use it for the name dialog.
   - Check the server's CORS `allowHeaders` (and anything else that filters request headers) so `x-identity-id` / `x-identity-name` actually reach the server; the web uses the same origin through the Vite proxy / nginx `/rpc`.
   - Keep `SimpleCsrfProtectionLinkPlugin` on the `RPCLink`.
   - Lean tests: one unit/db test proving a missing or invalid identity → 400, and one web test for the first-visit prompt vs. stored identity.
2. **#21 VPS docker-compose, env, bucket CORS** (Epic #7): DRAFT only (compose file + `.env.vps.example` + a short deploy section in docs). The real deploy and smoke test stay blocked on #15, so leave the issue open and say so in a comment. There are no auth env vars anymore (removed in #8).

Do NOT start #11 yet. It needs #9 approved first and will be wave 3.

## Process (same as wave 1, which worked well)
- `run-create`, then one Haiku scout per ticket writing a Markdown report (file:line anchors, gotchas, under ~250 lines) to a scratchpad file. Hand that report path to the Sonnet implementer.
- Each implementer works in its own `--worktree new-top-level --name issue-<N>-<slug> --base-branch main` and makes ONE commit `<type>(#N): <summary>` with a decisions body and `Refs #N`.
- Before committing: `pnpm fix`, `pnpm check`, `pnpm check-types`, and `pnpm exec vp test run` for the relevant project. Docker is available for db tests. Workers write a review note (changes, decisions, commands + results, how to verify manually) and pass it as `--report-path`.
- Workers follow AGENTS.md / TERSE.md and do not touch GitHub issues, push, or open PRs; you (the coordinator) do all issue updates.
- Make the tricky decisions yourself (or ask me if they're product-level), and record them in issue comments.
- After both finish: one Sonnet worker merges both branches with `--no-ff` into a new `wave-2-integration` worktree/branch. Any extra fixes go in a separate `fix(integration): ...` commit. It runs check, check-types, the full `vp test run`, `db:purge -- --yes && db:deploy`, and boots `dev:server` + `dev:web` (curl the root). Re-run check-types/check/tests yourself to verify.
- GitHub: label #9 and #21 `in-progress` when starting and comment with status/decisions as you go; comment on epics #1 and #7. Leave tickets open until I review.

## Orca gotchas learned in wave 1
- Launch workers one `worker-start` call at a time, not several in one long command. A batch call ran past its timeout and 3 of 4 terminals died with no output.
- Don't pass `--timeout-ms` to `worker-start` (it broke the retry receipts).
- In zsh, `set -- $pair` does not word-split; pass IDs explicitly.
- Retry a dead worker with `--task <task_id> --retry-of <dispatch_id>` only after `worker-list` shows `exited`.
- If a `worker_done` is rejected for an unknown task ID (a worker mistyped it), message that dispatch to resend with the exact IDs from its preamble.
- Compare `launch.effective` to confirm the model/effort actually used.
- Before ending, `worker-list --run <run> --terminal-state reclaimable` must return 0.

## Finish with
A human review guide like wave 1's: a branch/commit table, decisions to sanity-check, a per-ticket review order with the files to scrutinise, how to run it locally (fresh browser → name prompt; refresh → no prompt; a request without headers → 400), and the recommended merge path (`--ff-only` of the integration branch). Then give me the prompt for wave 3 (#11, then #12 + #15 in parallel).
````

### 2026-10-27 21:23

````text
please merge by ticket into main and use conventional commit messages. i don't want to run a single merge command since history might be lost.
pls remember that this is the preferred merge strategy
````

## Session 4 (2026-10-27 21:27)

### 2026-10-27 21:27

````text
/orchestration Run wave 3 of https://github.com/Klu-Digital/Pod-Widgets/issues (use `gh`).

Roles: you orchestrate. Haiku 5.5 (`--model claude-haiku-5-5`) for read-only scouts, Sonnet 5.5 high (`--model claude-sonnet-5-5 --effort high`) for implementation. Do NOT push.

## Wave 3a — #11 Widget API (Epic #2), alone
- Use `identityProcedure` (reads) / `identityMutationProcedure` (writes) from packages/api/src/procedures.ts; `created_by` / `created_by_id` come from `context.identity`, never from input. Keep afterCommit-before-transaction.
- CTI tables from #10 (one migration already exists; add NO new migration unless unavoidable — ask me first).
- List, create, update, soft delete, restore, audit writes, per the ticket. Mount the router in packages/api/src/routers/index.ts.
- Lean tests only: one db test for the happy path + soft delete/restore; one HTTP-level test (apps/server app.db.test.ts style) proving a widget call WITHOUT identity headers returns 400.

## Wave 3b — after #11 succeeds, in parallel, both based on the #11 branch
1. **#12 Core db tests for the widget API** (Epic #2): lean, core behaviour only.
2. **#15 Widget board** (Epic #3): add/list/autosave/reload using WidgetFrame, AddWidgetButton, TextField, RichTextEditor from #13/#14. Gate widget queries on `useIdentity().identity` (no 400s behind the first-visit dialog). One web test for add + autosave debounce.

## Process (same as waves 1–2)
- `run-create`; one Haiku scout per ticket → Markdown report (file:line anchors, gotchas, < ~250 lines) in the scratchpad; hand the path to the Sonnet implementer.
- Each implementer: `--worktree new-top-level --name issue-<N>-<slug> --base-branch <main for #11, k22i/issue-11-... for #12/#15>`, ONE commit `<type>(#N): <summary>` with a decisions body and `Refs #N`.
- Before committing: `pnpm fix`, `pnpm check`, `pnpm check-types`, `pnpm exec vp test run` for the relevant projects (Docker available). Review note passed as `--report-path`.
- Workers don't touch GitHub, push, or open PRs; you do all issue updates and record tricky decisions in issue comments.
- Label #11/#12/#15 `in-progress` when starting; comment status on tickets and epics #2/#3. Leave tickets open until I review. Once #15 is integrated, comment on #21 that the real VPS deploy is unblocked.

## Orca gotchas
- One `worker-start` per call; no `--timeout-ms` on worker-start; pass IDs explicitly in zsh.
- Retry only after `worker-list` shows `exited` (`--task <id> --retry-of <dispatch>`).
- Compare `launch.effective`; before ending, `worker-list --run <run> --terminal-state reclaimable` must return 0.

## Finish with
A human review guide (branch/commit table, decisions, per-ticket review order + files, how to run locally: add widgets, type, refresh → persists; no identity → 400), recommended merge path (`--ff-only` of the integration branch), and the prompt for wave 4 (#16 + #21 real deploy, then stretch #17–#20).

The scout reports and review notes are in /private/tmp/claude-501/-Users-kevinmallari-Developer-Pod-Widgets/1c114647-2e84-47b9-a8bf-398605e3921a/scratchpad/ (review-9.md, review-21.md, review-integration.md).
````

### 2026-10-27 21:56

````text
I've reviewed the changes, please remove any image widget references. I'm deferring that due to lack of time.
nothing else other than that. please merge changes into main using convetional commits
````

## Session 5 (2026-10-27 21:34)

### 2026-10-27 21:34

````text
https://github.com/Klu-Digital/Pod-Widgets/issues (use `gh`).
Please update issues that are done, unblocked, etc.
Base the information from the commits in this branch
````

## Session 6 (2026-10-27 22:00)

### 2026-10-27 22:00

````text
/orchestration Run wave 4 of https://github.com/Klu-Digital/Pod-Widgets/issues (use `gh`). Waves 1–3 are on main (#11 widget API, #12 db tests, #15 widget board at d4794e0).

Scope: #16, #17, #20 only. Out of scope: #18 and #19 (deferred for time; image widgets were removed from the API in 7e24be7, and the board shows the oldest page) and #21 (I'm deploying myself). Don't touch those.

Roles: you orchestrate. Haiku 5.5 (`--model claude-haiku-5-5`) read-only scouts, Sonnet 5.5 high (`--model claude-sonnet-5-5 --effort high`) implementers. Do NOT push.

## Wave 4 — all three in parallel, each from main
1. #16 Optimistic soft delete with 10s undo toast: IconButton (#13) in the WidgetFrame actions slot; widgets.delete / widgets.restore from #11 (idempotent, audited). Optimistically remove from the widgets.list cache, roll back on error; undo calls restore. Keep useAutosave's flush-on-unmount so a pending edit isn't lost when a widget is removed. One lean web test (delete + undo).
2. #17 Banner widget: new apps/web/src/components/widgets/banner-widget.tsx plus a registry entry; API already supports type "banner" (create with variant, updateContent, updateBanner). Use WidgetFrame's tone prop (static class maps only, per shadcn/* lint rules). Reuse useAutosave for content. No API or migration changes; ask me if one seems needed.
3. #20 Widget audit log view: read-only, from widget_audit (created/deleted/restored with actor). Add a query + identityProcedure read in packages/api following ADR 0005 (router → *.queries.ts); mount in routers/index.ts. Web view per the ticket. One lean db test for the query.
Conflict watch: #16 and #17 both touch the widget registry and text-widget/frame actions, and #17 and #20 may both edit routers/index.ts. Keep edits minimal so per-ticket merges stay clean.

## Process (same as waves 1–3)
- run-create; label each ticket in-progress; one Haiku scout per ticket → Markdown report (< ~250 lines, file:line anchors) in the scratchpad; hand the path to the implementer.
- Implementers: --worktree new-top-level --name issue-<N>-<slug> --base-branch main, ONE commit `<type>(#N): <summary>` with a decisions body and `Refs #N`. Before committing: pnpm --filter web routes:generate, pnpm fix, pnpm check, pnpm check-types, pnpm knip, pnpm exec vp test run for the relevant projects (Docker available). Review note via --report-path.
- Lean tests only. Workers don't touch GitHub; you comment status and tricky decisions on tickets and epics, and leave tickets open.
- Integration branch k22i/wave-4-integration (--no-ff per ticket, fix(integration) commit only if needed) with full checks + a live dev run (other processes may hold 1900/2600; use other ports, don't kill them).

## Orca gotchas
- One worker-start per call; no --timeout-ms on worker-start; pass IDs explicitly in zsh. Retry only after worker-list shows exited (--task <id> --retry-of <dispatch>). Compare launch.effective. Before ending, worker-list --run <run> --terminal-state reclaimable must return 0.

## Finish with
A human review guide (branch/commit table, decisions, per-ticket review order + files, how to run locally: delete + undo, add/edit a banner, open the audit log), the per-ticket `--no-ff` merge commands into main with conventional messages, and a short list of what remains (#18, #19 deferred; #21 manual).

Prior notes: /private/tmp/claude-501/-Users-kevinmallari-Developer-Pod-Widgets/88ff8c6b-660a-45e4-8131-6a619173374b/scratchpad/ (scout-*.md, review-*.md, review-integration.md).
````

### 2026-10-27 22:33

````text
please merge the changes individually to main and update the tickets accordingly
````

## Session 7 (2026-10-27 22:39)

### 2026-10-27 22:39

````text
please display the widgets as html/text inside the cards. add an edit button per widget, which should put the content inside the rich text editor. problem right now is that i always see rich text editors, which is not good UI/UX @apps/web/src/components/widgets/widget-board.tsx 
add tests for this'
````

### 2026-10-27 22:40

````text
or better yet, when clicking on the text, make it editable and make the rich text formatting (bold, italics, etc.) floating
````

## Session 8 (2026-10-27 23:02)

### 2026-10-27 23:02

````text
please deprecate unused code and infrastructure
````

## Session 9 (2026-10-27 23:26)

### 2026-10-27 23:26

````text
are you able to put all my prompts in the project in a PROMPTS.md file?
note: MY PROMPTS -- so don't include prompts you passed into sub-agents
````

<!--
Thanks for opening a PR. Keep this template short and honest.
A reviewer should be able to understand the change without reading the diff.

If your PR is a draft / WIP, mark it as a draft.
-->

## What

This change makes the station dashboard notifications dropdown visible again by raising the station top navigation above the scrollable dashboard content. The notification bell, unread counter, and notification list logic are unchanged.

## Why

On `/station/dashboard`, the bell showed an unread count but the dropdown panel could render behind the dashboard layout, so station users could not see the notification list even when 24 unread notifications existed. Client and admin dropdowns already worked, so the fix is isolated to the station shell/header stacking context.

## How to verify

- [ ] Open `/station/dashboard` with a station account that has unread notifications.
- [ ] Click the notification bell and confirm the dropdown panel appears above the dashboard content.
- [ ] Verify the unread count still displays and the list items remain clickable.

## Checklist

- [ ] Branch follows the naming convention (`feature/<slug>`, `fix/<slug>`, …)
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] `bun run check` passes locally
- [ ] `bun run typecheck` passes
- [ ] New behavior is covered by tests
- [ ] Architecture rules pass (`bunx depcruise --config .dependency-cruiser.cjs apps packages`)
- [ ] [`CHANGELOG.md`](../CHANGELOG.md) updated if this change is user-facing
- [ ] [`docs/adr/`](../docs/adr/) updated or new ADR added if a structural decision changed
- [ ] No secrets committed; no PII in fixtures

## Notes for the reviewer

This is intentionally a minimal UI fix. I did not touch the notification fetch logic, the unread count endpoints, or the client/admin notification flows.
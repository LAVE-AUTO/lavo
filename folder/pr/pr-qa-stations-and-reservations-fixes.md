<!--
Thanks for opening a PR. Keep this template short and honest.
A reviewer should be able to understand the change without reading the diff.

If your PR is a draft / WIP, mark it as a draft.
-->

## What

This branch consolidates the recent frontend work on the station workspace and related brand/navigation polish: the station shell and top nav were aligned with the admin/public chrome, the station header identity and notification dropdown were fixed, reservations and queue flows were separated more clearly, walk-in entry handling was expanded, station history/support/QR pages received premium polish, availability shortcuts were made more visible, and several shared labels, cards, and brand tokens were cleaned up to keep the UI consistent.

## Why

The branch closes a set of visible inconsistencies across the station experience and keeps the merchant-facing UI in step with the rest of the app. In particular, `/station/dashboard` needed the notifications panel to remain visible, reservations and queue needed a clearer separation, and several station pages still had rough edges in labels, layout, and branding.

## How to verify

- [ ] Open `/station/dashboard` with a station account that has unread notifications and confirm the dropdown appears above the dashboard content.
- [ ] Open `/station/reservations` and `/station/queue` to confirm the two flows are clearly separated and still work.
- [ ] Check `/station/history`, `/station/support`, and `/station/qr` to confirm the premium polish and layout updates render correctly.
- [ ] Open `/station/availability` and `/station/config` to confirm the shortcut visibility, photo previews, and schedule prefill behave as expected.

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

This branch is mostly frontend-only polish and UX consistency work. The notification data flow is unchanged; the important change is that the station dropdown now stays visible in the app shell.
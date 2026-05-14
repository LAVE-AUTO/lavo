# Contributing

## Principles

- Keep changes aligned with `Hurryline/.hidden/Hurryline_TRELLO.md` and the technical specification.
- Prefer small, reviewable pull requests with clear scope.
- Maintain domain boundaries: UI routes/pages -> API routes -> `src/server/*` services -> data access.
- Avoid duplicated concepts across documentation (reference existing docs instead).

## Development Workflow

1. Create a branch from the default branch.
2. Implement the change with TypeScript-first and validation-first practices.
3. Run lint and tests locally.
4. Open a pull request with a short summary and test plan.

## Quality Gates

```bash
npm run lint
npm test
npm run build
```

## Documentation

- Keep documentation in English.
- Do not add user guides yet unless explicitly requested.
- Ensure Mermaid flowcharts use `flowchart TD`.


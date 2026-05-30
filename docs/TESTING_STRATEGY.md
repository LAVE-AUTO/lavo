# Hurryline Testing Strategy

## Testing Pyramid

```mermaid
flowchart TD
    Pyramid[Testing Pyramid] --> Unit[Unit tests - 101]
    Pyramid --> Integration[Integration tests - 5]
    Pyramid --> E2E[E2E tests - 5]

    Unit --> Targets1[Helpers, validators, lib modules]
    Unit --> Targets2[Route handlers and domain services]

    Integration --> ApiRoutes[Cross-module API/domain behaviors]
    Integration --> DbLayer[Persistence and service interactions]

    E2E --> UiFlows[Critical UI flows]
    E2E --> RoleAreas[Client/station/admin path checks]
```

## Test Coverage Goals

- **Unit**: High confidence on business rules and boundary validation.
- **Integration**: Validate critical workflows across modules.
- **E2E**: Protect top user journeys and role-based UX integrity.

## Testing Tools

- **Jest** (`npm test`, `npm run test:watch`, `npm run test:coverage`)
- **React Testing Library** + **jest-dom**
- **Playwright** (`npm run test:e2e`, `npm run test:e2e:ui`)

## Running Tests

```bash
npm test
npm run test:watch
npm run test:coverage
npm run test:e2e
```

Expected results:

- Jest summary with pass/fail count.
- Coverage output for unit-focused scope.
- Playwright report for end-to-end scenarios.

## CI/CD Integration

```mermaid
flowchart TD
    Dev[Developer push] --> Install[npm install]
    Install --> Lint[npm run lint]
    Lint --> Unit[npm test]
    Unit --> Build[npm run build]
    Build --> E2E[npm run test:e2e]
    E2E --> Gate{All checks pass?}
    Gate -->|Yes| Merge[Merge / deploy]
    Gate -->|No| Fix[Fix and rerun]
```

## Current Test Inventory

- Unit: **101** files
- Integration: **5** files
- E2E: **5** specs


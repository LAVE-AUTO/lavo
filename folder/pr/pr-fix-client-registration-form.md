# [FRONT] Redesign phone input, replace station mocks with API calls

**Base branch:** `dev` ← **Head branch:** `fix/client-registration-form`

---

## Summary

This PR redesigns the phone input component to visually separate the country selector from the phone number input, and replaces mock station data with real API calls to the backend for the station list, detail, and stats views.

---

## Context and motivation

The previous `PhoneInput` used `react-phone-number-input`'s combined component which merged the country select and phone number input into a single field, relying on BEM CSS classes with no associated stylesheet. The user could not easily distinguish the country selector from the number input, and the dial code was repeated in both the select and the text field.

Station views (list, detail, stats, metadata) were all hardcoded to import from `MOCK_STATIONS`, displaying 8 fictional Montreal stations. The backend API (`GET /api/v1/stations`, `GET /api/v1/stations/:id`) and DB seeds (7 French stations) were already fully implemented but not consumed by the frontend.

---

## Changes

### New files

| File | Description |
|---|---|
| `src/services/station-api.ts` | Frontend station API service — fetches from `GET /api/v1/stations` and `GET /api/v1/stations/:id`, maps snake_case API response to camelCase frontend types (`Station`, `StationDetailData`) |

### Modified files

| File | Changes |
|---|---|
| `src/components/auth/PhoneInput.tsx` | Complete rewrite — removed `PhoneInputLib` combined component, built separate `CountrySelect` (flag + dial code dropdown) and `<input type="tel">` side by side. Uses `getCountries()`, `getCountryCallingCode()`, `flags` exports directly. Exports `PhoneInputValue` type (`{ country, localNumber }`) |
| `src/components/auth/RegisterForm.tsx` | Updated form state from `phone: string` to `phone: PhoneInputValue`, validation uses `joinPhoneNumber()` to build E.164 before `validatePhone()`, submit sends joined phone to API |
| `src/helpers/validators.ts` | Added `joinPhoneNumber(country, localNumber)` helper — strips non-digits, prepends `+{dialCode}`, returns full E.164 string |
| `src/components/stations/StationListView.tsx` | Replaced `MOCK_STATIONS` import with `fetchStations()` API call on mount. Added loading spinner. Uses API groups (`available_now`, `most_appreciated`, `most_visited`) when no filters are active, falls back to client-side filtering on fetched data |
| `src/components/stations/StationsStats.tsx` | Replaced `MOCK_STATIONS` with server-side `listStationsPublic()` call. Computes total, available, cities, reviews from real data |
| `src/components/stations/StationDetail.tsx` | Replaced `MOCK_STATIONS.find()` with `fetchStationById(id)` API call. Added loading spinner during fetch |
| `src/app/[locale]/(public)/stations/[id]/page.tsx` | Replaced `MOCK_STATIONS.find()` with server-side `getStationDetailPublic(id)` for `generateMetadata()` |

---

## Features implemented

### Phone input redesign
- Country select and phone number input are two visually distinct elements separated by a gap
- Country select displays flag icon + dial code (e.g. "+1") with a chevron
- Dropdown has search, flag icons, country names and dial codes (identical to before)
- Phone text input accepts only the local number — no repeated dial code prefix
- Styling matches `FormField` component: `border-[1.5px] rounded-lg`, gold focus ring, error state
- New `joinPhoneNumber(country, localNumber)` helper concatenates `+{dialCode}{digits}` for API submission
- `RegisterForm` validates the joined E.164 number before submit, sends it to the backend

### Station mock-to-API migration
- `station-api.ts` maps API snake_case fields to frontend camelCase types:
  - `average_score` → `rating`, `total_ratings` → `reviewCount`, `available_slots` → `availableSlots`, `wash_post_count` → `totalSlots`, `is_open` → `isOpen`
- Station detail maps `vehicleFormats` to `vehicleTypes` and computes `priceFrom` from active format prices
- Opening hours derived from `stationConfig.opening_time` / `closing_time`
- `StationListView` fetches on mount with loading state, uses API groups for section rendering
- `StationsStats` calls the station service directly (server component)
- `StationDetail` fetches by ID with loading spinner
- Station detail page metadata fetches from the real DB
- Fallback defaults for fields not in DB: `tags: []`, `reviews: []`, `serviceCategories: []`, `extras: []`

### What remains on mocks
- **Favorites page** (`src/app/[locale]/(public)/favorites/page.tsx`) — no favorites API exists yet
- **Reservations pages** — backend route returns `notImplementedResponse()`
- `serviceCategories`, `extras`, `reviews` on station detail — these entities do not exist in the DB schema yet

---

## Testing

- [x] Register — phone input shows separate country select and number input
- [x] Register — selecting a country updates flag and dial code in select only
- [x] Register — phone number input accepts local number without dial code
- [x] Register — form validates joined E.164 number, displays errors for invalid numbers
- [x] Register — form submits correct phone format to API
- [x] Station list — fetches from API, loading spinner shown during fetch
- [x] Station list — sections (Disponible maintenant, Les plus apprecies, Les plus revisites) display API groups
- [x] Station list — search, city, price, sort filters work on fetched data
- [x] Station stats — displays real counts from DB (total, available, cities, reviews)
- [x] Station detail — fetches from API by ID, displays real station data
- [x] Station detail — loading spinner shown during fetch, 404 fallback on unknown ID
- [x] Station detail page — page title and meta description from real data
- [x] Dark mode and light mode on all affected pages
- [x] Responsive — mobile, tablet, desktop

---

## Notes for reviewers

- Station data now comes from the **real API** — a running backend with seeded DB is required for testing.
- `serviceCategories`, `extras` and `reviews` are returned as empty arrays from the mapping layer since these entities do not exist in the DB schema. The station detail UI sections relying on these will show empty state until the backend implements them.
- The favorites page still uses `MOCK_STATIONS` — a favorites API is needed before migration.
- The reservations pages still use mock data — the `GET /api/v1/reservations` route is a placeholder.
- `station-api.ts` uses `getFromApi` which goes through the axios instance with `withCredentials: true` — no auth required for public station endpoints.

---

## Additional changes (code review & UX pass)

The following fixes were made on top of the original PR scope as part of a senior frontend code review pass.

### UI component library (`src/components/ui/`)

New shared components extracted from inline patterns found across the codebase:

| Component | Description |
|---|---|
| `Button.tsx` | Unified submit button — variants `primary/secondary/ghost/danger`, sizes `sm/md/lg`, loading state with spinner, `fullWidth` prop |
| `Input.tsx` | `forwardRef` text input with label, error state, left/right icon slots, gold focus ring |
| `Checkbox.tsx` | `forwardRef` checkbox with `accent-gold`, optional inline label |
| `Select.tsx` | `forwardRef` native select with custom chevron, placeholder option, label, error state |
| `Textarea.tsx` | `forwardRef` textarea with label, error state, branded border |
| `Card.tsx` | Container card — variants `default`, `elevated`, `flat`, `station` |
| `Badge.tsx` | Status/tag badges — 9 variants covering station status, distance, verified, pill |
| `Alert.tsx` | Inline alert banner — 4 variants `success/error/warning/info` with colored left border |
| `Modal.tsx` | Accessible modal — backdrop click, Escape key, body scroll lock, header/footer slots, 4 size presets |
| `Tabs.tsx` | Scrollable tab strip with gold active indicator, optional count badge and icon per tab |
| `PageSpinner.tsx` | Centered full-page gold spinner — `py` and `label` props |
| `Toggle.tsx` | Branded gold toggle switch (extracted from `StationListView`) |
| `EmptyState.tsx` | Empty state block — `icon`, `title`, `description`, `action` props |
| `SectionHeader.tsx` | Section heading — `title`, `count` pill, `action` slot, `accentBar` gold left border |

All auth forms (`LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `ChangePasswordForm`, `VerifyEmailView`) and station components (`StationListView`, `StationDetail`) were updated to use the new shared components in place of inline duplicated markup.

### Bug fixes

| File | Bug | Fix |
|---|---|---|
| `src/context/auth-context.tsx` | `refetchUser()` read `data?.data?.user` but `/api/v1/auth/me` returns `{ data: SafeUser }` — user context was never updated after `refetchUser()` calls (e.g. after password change) | Changed to `data?.data` |
| `src/components/ui/Toast.tsx` | Used `() => JSX.Element` type — global `JSX` namespace was removed in React 19 | Changed to `() => ReactElement` imported from `react` |
| `src/components/auth/SocialButtons.tsx` | `signIn('google')` was called without `await` or error handling — loading state would get stuck if OAuth threw | Wrapped in `try/catch`, reset loading state on error |
| `src/components/auth/ResetPasswordForm.tsx` | Checked `data?.code === 'INVALID_TOKEN'` which does not exist in the `ApiCode` enum — dead branch, the backend only returns `TOKEN_EXPIRED` | Removed dead branch |
| `src/components/auth/ChangePasswordForm.tsx` | `Spinner` import was removed during refactoring but `Spinner` is still used for the page-level auth-loading state | Re-added import |
| `src/components/auth/VerifyEmailView.tsx` | Same as above | Re-added import |

### ESLint fixes

| File | Rule | Fix |
|---|---|---|
| `src/components/stations/StationListView.tsx` | `react-hooks/set-state-in-effect` — redundant `setLoading(true)` in effect body | Removed (state already initialized to `true`) |
| `src/components/stations/useUserLocation.ts` | `react-hooks/set-state-in-effect` — redundant `setLocation(cachedLocation)` in effect body | Removed (`useState` already seeded with `cachedLocation`) |
| `src/components/ui/Toast.tsx` | `react-hooks/set-state-in-effect` — `setExiting(false)` and `setVisible(false)` called synchronously | Moved all setState calls inside `requestAnimationFrame` callback |
| `src/components/merchant/MerchantQrSection.tsx` | `@typescript-eslint/no-unused-vars` — `locale` assigned but never used | Removed `useLocale()` call and import |
| `src/components/stations/booking/BookingFlow.tsx` | `@typescript-eslint/no-unused-vars` — `category` prop destructured but never used in body | Removed from destructuring (interface kept for callers) |

### UX improvement — compact filter panel

The station filter panel was reorganized from a single stacked column of 8 sections into a 2-column grid to reduce vertical height:

- Removed duplicate sort chips from the panel (already visible in the persistent quick-sort strip)
- **City** + **Available only** toggle placed side by side
- **Categories** + **Vehicle type** dropdowns placed side by side
- **Services** + **Date** placed side by side
- Price range and time range keep their existing inline layout
- Tightened padding and label font size (13 px labels, `p-4`/`space-y-4`)

---

## Backend error recommendations

The `npm run lint` audit identified errors in backend files outside the frontend scope. These should be addressed in a dedicated backend cleanup PR.

### `scripts/seed.ts`

**Error:** `@typescript-eslint/no-require-imports` — `require()` used instead of ES module `import`.

**Recommendation:** Replace the `require()` call with a top-level `import`. If the script must run with `ts-node` in CommonJS mode, add `import type` where applicable or configure `ts-node` with `--esm`. Alternatively, add a targeted `// eslint-disable-next-line @typescript-eslint/no-require-imports` comment with a justification if CommonJS is a hard constraint for the seed runner.

---

### `src/app/api/v1/station/formats/route.ts`

**Warning:** `@typescript-eslint/no-unused-vars` — `findStationByUserId` is imported but never used in this route file.

**Recommendation:** Remove the unused import. If the function will be used in a future implementation of the route, add it back when the route is implemented.

---

### `tests/unit/app/api/v1/station/formats/[id]/route.test.ts` and `tests/unit/app/api/v1/station/formats/route.test.ts`

**Error:** `@typescript-eslint/no-explicit-any` — `any` used in mock return types.

**Recommendation:** Replace `any` with the actual return type of the mocked function (e.g. `Promise<FormatRow | null>`). Use `vi.mocked()` or cast with `as jest.MockedFunction<typeof yourFn>` to get proper inference on the mock without resorting to `any`.

---

### `tests/unit/server/reservations/entry-repository.test.ts`

**Error:** `@typescript-eslint/no-require-imports` — four `require()` calls inside test body (likely for dynamic mock modules).

**Recommendation:** Migrate to top-level `import` with Jest's `jest.mock()` factory pattern, or use `jest.resetModules()` + dynamic `import()` in an async test setup. If the `require()` calls are genuinely needed for module isolation, add scoped disable comments with a short explanation.

---

### `tests/unit/server/station/config-service.test.ts`, `format-service.test.ts`, `slot-service.test.ts`

**Error:** `@typescript-eslint/no-explicit-any` — widespread `any` usage in mock setup and spy types.

**Recommendation:** Define narrow mock interfaces or use `jest.MockedFunction<typeof fn>` / `jest.Mocked<ClassName>` utilities to replace `any`. For Drizzle query chain mocks, consider a typed `DeepMockProxy<DB>` pattern (e.g. using `jest-mock-extended`) so the entire db proxy is typed without manual `any` casts.

---

### `tests/unit/server/station/upload-service.test.ts`

**Warning:** `@typescript-eslint/no-unused-vars` — `_opts` parameter defined but never read.

**Recommendation:** Prefix unused callback parameters with `_` (already done here) — but the rule is still triggering, which means the ESLint config does not have the `varsIgnorePattern: '^_'` / `argsIgnorePattern: '^_'` exception configured for `@typescript-eslint/no-unused-vars`. Add the following to the ESLint config:

```json
"@typescript-eslint/no-unused-vars": ["error", {
  "varsIgnorePattern": "^_",
  "argsIgnorePattern": "^_",
  "ignoreRestSiblings": true
}]
```

---

### `tests/unit/validators/station.test.ts`

**Error:** `@typescript-eslint/no-require-imports` — top-level `require()` in a test file.

**Recommendation:** Replace with a standard `import` statement. Test files should use the same module system as the rest of the project (`import`/`export`).

---

### `src/server/notifications/notification-service.ts`, `src/server/payments/payment-service.ts`, `src/server/station/station-service.ts`

**Warning:** `@typescript-eslint/no-unused-vars` — stub parameters (`_params`, `_s`, `_c`) in not-yet-implemented service functions.

**Recommendation:** These are acceptable stubs. Apply the `argsIgnorePattern: '^_'` ESLint rule exception described above so the warnings are suppressed by convention rather than by inline disable comments.

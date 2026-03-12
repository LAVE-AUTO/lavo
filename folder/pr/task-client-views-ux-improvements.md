# PR: Client Views UX Improvements

**Branch:** `fix/client-views`
**Base:** `main`

## Summary

- **Toast animations**: Added slide-in/slide-out CSS keyframe animations for toasts. Desktop: bottom-right slide from right. Mobile: top-center slide from top. Phase state machine (`hidden → entering → visible → exiting`) for smooth transitions.
- **Station cards**: Replaced "available slots" stat with live distance from user's current position using `haversineKm`. Stats grid now shows: Distance | Wait time | Open/Closed.
- **Favorites hook**: New `useFavorites` hook (`useFavorites.ts`) with SSR-safe localStorage persistence (`lavo_favorites` key). Used in `StationDetail.tsx` — heart button fills gold when favorited.
- **Station detail layout**: Widened from `max-w-3xl` to `max-w-[1440px] px-6 lg:px-16` to match navbar width on desktop. Content stays readable with inner `max-w-3xl` wrapper.
- **Station list search swap**: Main search bar now filters by city/address. Secondary search (in filter panel) filters by merchant name. Native `<input type="time">` replaces `CustomSelect` dropdown for time range (supports keyboard + browser clock picker). Mobile filter text sizes reduced to prevent line wrapping.
- **Arrival step accordion**: Redesigned `ArrivalStep.tsx` with accordion-style sections — "File d'attente" and "Réserver un créneau" are collapsible panels. Queue section shows a real-time card with current queue count and user's estimated position (`queueCount + 1`).
- **Context-aware success screen**: `BookingFlow.tsx` — `queue_now` → Google Maps itinerary CTA using user's GPS origin + station coordinates. `queue_later`/`book_slot` → queue position info + "Voir mes réservations" CTA.
- **Dark mode token fix**: Replaced `dark:bg-gray-800` and `dark:bg-[#1A1A18]` with correct brand tokens (`dark:bg-dark-card`, `dark:bg-dark-surface`) throughout booking modal and reservation cards.
- **Queue entry detail page**: New page at `/client/reservations/queue/[id]` showing real-time position (simulated polling every 30s), estimated wait, service summary, and Google Maps CTA. Queue cards in `/client/reservations` are now clickable links.

## Files Changed

- `src/components/ui/Toast.tsx` — phase state machine, dual mobile/desktop DOM nodes, CSS animations
- `src/app/globals.css` — added `toast-progress`, `toast-enter/exit-top/right` keyframes
- `src/components/stations/StationCard.tsx` — distance stat replacing available slots
- `src/components/stations/useFavorites.ts` — new SSR-safe favorites hook
- `src/components/stations/StationDetail.tsx` — wider layout, functional favorites button
- `src/components/stations/StationListView.tsx` — search swap, native time input, mobile text sizes
- `src/components/stations/booking/ArrivalStep.tsx` — accordion sections, queue position card
- `src/components/stations/booking/BookingFlow.tsx` — context-aware success, dark mode fix
- `src/app/[locale]/(client)/client/reservations/page.tsx` — queue cards now clickable links
- `src/app/[locale]/(client)/client/reservations/queue/[id]/page.tsx` — new queue detail page
- `messages/fr.json`, `messages/en.json` — new i18n keys for all above features

## Test Plan

- [ ] Toast slides in from right on desktop (≥640px), from top on mobile
- [ ] Toast progress bar drains correctly, exit animation plays on dismiss
- [ ] Station card shows distance when geolocation is granted, `--` when denied
- [ ] Favorites button fills gold when clicked, persists across page reload
- [ ] Station detail page spans full navbar width on lg screens
- [ ] Main search bar filters by city, filter panel name search filters by merchant
- [ ] Time input accepts keyboard (`HH:MM`) and shows browser clock picker
- [ ] Arrival step — clicking "File d'attente" header expands queue section, collapses book section and vice versa
- [ ] Queue position card shows `queueCount` and `queueCount + 1`
- [ ] `queue_now` success → Maps CTA opens Google Maps with directions
- [ ] `queue_later`/`book_slot` success → "Voir mes réservations" redirects to `/client/reservations`
- [ ] Queue cards in `/client/reservations` are clickable links
- [ ] Queue detail page shows live position counter (decrements every 30s in mock)
- [ ] All pages render correctly in dark mode with brand token colors

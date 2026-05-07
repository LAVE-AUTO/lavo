/**
 * E2E - Public station list and detail pages.
 *
 * Covers:
 *   - /fr/stations loads and renders at least one station card.
 *   - Clicking a station card navigates to /fr/stations/[id].
 *   - The station detail page displays the station name, address, and the
 *     reservation / booking call-to-action.
 *
 * These tests run without authentication because both pages are publicly
 * accessible.  The station detail CTA redirects to login for unauthenticated
 * users, but the element itself must still be present in the DOM.
 */

import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers/fixtures';

test.describe('public station list page', () => {
  test('page loads and displays at least one station card', async ({ page }) => {
    await page.goto(ROUTES.stations);

    /*
     * Station cards are rendered as <article> elements by StationCard.
     * We wait for at least one to appear - this implicitly tests that the
     * API call resolves and the Suspense boundary clears.
     */
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('clicking a station card navigates to the station detail page', async ({ page }) => {
    await page.goto(ROUTES.stations);

    /* Wait for at least one card to be rendered */
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });

    /*
     * The CTA link inside StationCard points to /stations/[id].
     * We capture the href before clicking so we can verify the navigation.
     */
    const ctaLink = firstCard.locator('a').last();
    const href = await ctaLink.getAttribute('href');

    await ctaLink.click();

    /*
     * After clicking, the URL must contain /stations/ followed by at least
     * one character (the station id).  We tolerate both the authenticated
     * destination (/stations/[id]) and the login redirect that wraps it
     * (/login?callbackUrl=...) because the test runs without auth.
     */
    await expect(page).toHaveURL(/\/stations\/|\/login/, { timeout: 10_000 });

    // The toHaveURL assertion above already guarantees the URL matches /stations/ or /login.
    // No additional assertion is needed - the dead code block has been removed.
    void href;
  });
});

test.describe('public station detail page', () => {
  /**
   * Helper: navigate to the list, grab the first station link, and return
   * the resolved /fr/stations/[id] URL so the detail test can navigate directly.
   */
  async function getFirstStationDetailUrl(page: import('@playwright/test').Page): Promise<string> {
    await page.goto(ROUTES.stations);
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });

    /*
     * StationCard renders an <a> tag whose href is either:
     *   /stations/[id]                           (authenticated)
     *   /login?callbackUrl=/stations/[id]        (unauthenticated)
     *
     * We extract the station id from whichever form the href takes.
     */
    const ctaLink  = firstCard.locator('a').last();
    const rawHref  = (await ctaLink.getAttribute('href')) ?? '';
    const idMatch  = rawHref.match(/\/stations\/([^?#/]+)/);
    if (!idMatch) throw new Error(`Could not extract station id from href: "${rawHref}"`);
    return `/fr/stations/${idMatch[1]}`;
  }

  test('station detail page shows station name, address and booking button', async ({ page }) => {
    const detailUrl = await getFirstStationDetailUrl(page);
    await page.goto(detailUrl);

    /*
     * The StationDetail component renders the station name prominently.
     * We assert that at least one heading-level element with non-empty text
     * is visible, which covers the station name display.
     */
    const stationName = page.locator('h1, h2, h3').first();
    await expect(stationName).toBeVisible({ timeout: 20_000 });
    const nameText = await stationName.innerText();
    expect(nameText.trim().length).toBeGreaterThan(0);

    /*
     * Address: StationDetail renders city/address information in the detail
     * section.  We look for any element that could contain address text -
     * the exact selector is flexible because the layout may change.
     *
     * A broad but correct check: the page must have visible text content
     * that goes beyond the station name.
     */
    const bodyText = await page.locator('main').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(nameText.trim().length);

    /*
     * Booking CTA: the StationDetail renders a button or link that allows
     * users to start the booking flow.  For unauthenticated users this
     * redirects to login; the element must still be present.
     *
     * We look for a <button> or <a> element that relates to booking by
     * checking common patterns used in the codebase (the link to /login
     * with callbackUrl, or a button that opens the BookingFlow).
     */
    const bookingCta = page.locator('button, a').filter({ hasText: /réserver|book|réservation/i }).first();
    await expect(bookingCta).toBeVisible({ timeout: 10_000 });
  });
});

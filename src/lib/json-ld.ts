/**
 * JSON-LD serialization helper.
 * Safe alternative to bare JSON.stringify for use inside
 * <script type="application/ld+json"> tags.
 *
 * JSON.stringify does not escape <, >, or & which allows a crafted
 * station name or description containing </script> to break out of the
 * script block and inject arbitrary HTML/JS (stored XSS via JSON-LD).
 */

/**
 * Serializes a value to a JSON string that is safe to embed inside an HTML
 * <script> tag. Escapes <, >, and & using their Unicode escape equivalents
 * so that no injected content can terminate the script block.
 *
 * @param data - The value to serialize (must be JSON-serializable)
 * @returns A JSON string safe for use with dangerouslySetInnerHTML in a
 *          <script type="application/ld+json"> element
 *
 * @example
 * <script
 *   type="application/ld+json"
 *   dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
 * />
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

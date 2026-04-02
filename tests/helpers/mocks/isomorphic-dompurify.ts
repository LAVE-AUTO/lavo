/**
 * Stub for isomorphic-dompurify in tests.
 *
 * The real package is not installed (requires: npm install isomorphic-dompurify).
 * This stub passes content through unchanged so that service unit tests can
 * override sanitize via jest.mock('isomorphic-dompurify', ...) and control
 * the returned value independently.
 */
const DOMPurify = {
  sanitize: (input: string): string => input,
};

export default DOMPurify;

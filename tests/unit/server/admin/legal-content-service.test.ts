/**
 * Unit tests for the legal content service.
 *
 * Covers:
 *   - getLegalContent: returns content when a matching row exists
 *   - getLegalContent: returns null when no row is found
 *   - updateLegalContent: calls the DB upsert with sanitized content
 *   - updateLegalContent: strips XSS script tags before storing
 *
 * Note on empty-string behaviour:
 *   The service does not throw on empty string - that invariant is enforced at the
 *   validator layer (updateLegalContentBodySchema.content has min(1)). The service
 *   trusts that its callers pass validated input.
 *
 * @jest-environment node
 */

// %%%%% Mocks %%%%%

const mockSanitize = jest.fn((input: string) => input);

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: (input: string) => mockSanitize(input) },
}));

const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
const mockValues = jest.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

const mockFindFirst = jest.fn();

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      settings: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));


// %%%%% Imports %%%%%

import { getLegalContent, updateLegalContent } from '@/server/admin/legal-content-service';


// %%%%% Fixtures %%%%%

const ADMIN_ID = 'admin-uuid-abcd-1234';


// %%%%% Setup %%%%%

beforeEach(() => {
  jest.clearAllMocks();
});


// %%%%% Tests %%%%%

describe('getLegalContent', () => {

  it('returns the content string when a row is found', async () => {
    mockFindFirst.mockResolvedValue({ value: '<p>CGU content</p>' });

    const result = await getLegalContent('cgu');

    expect(result).toBe('<p>CGU content</p>');
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  it('returns null when no matching row exists', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const result = await getLegalContent('politique_confidentialite');

    expect(result).toBeNull();
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  it('returns null when the row value is null', async () => {
    mockFindFirst.mockResolvedValue({ value: null });

    const result = await getLegalContent('mentions_legales');

    expect(result).toBeNull();
  });
});

describe('updateLegalContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default sanitize: pass through
    mockSanitize.mockImplementation((input: string) => input);
  });

  it('calls the DB upsert with the sanitized content and correct metadata', async () => {
    const rawContent = '<p>Valid legal text</p>';
    const sanitizedContent = '<p>Valid legal text</p>';
    mockSanitize.mockReturnValue(sanitizedContent);

    await updateLegalContent('cgu', rawContent, ADMIN_ID);

    expect(mockSanitize).toHaveBeenCalledWith(rawContent);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledTimes(1);

    const insertedRow = mockValues.mock.calls[0][0];
    expect(insertedRow.type).toBe('legal');
    expect(insertedRow.key).toBe('cgu');
    expect(insertedRow.value).toBe(sanitizedContent);
    expect(insertedRow.updated_by).toBe(ADMIN_ID);
    expect(insertedRow.entity_id).toBeNull();
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it('strips XSS script tags from the content before storing', async () => {
    const maliciousContent = '<script>alert("xss")</script><p>Legal text</p>';
    const sanitizedContent = '<p>Legal text</p>';
    mockSanitize.mockReturnValue(sanitizedContent);

    await updateLegalContent('mentions_legales', maliciousContent, ADMIN_ID);

    expect(mockSanitize).toHaveBeenCalledWith(maliciousContent);

    const insertedRow = mockValues.mock.calls[0][0];
    // The stored value must be the sanitized output, never the raw malicious input
    expect(insertedRow.value).toBe(sanitizedContent);
    expect(insertedRow.value).not.toContain('<script>');
  });

  it('stores the correct key for politique_confidentialite', async () => {
    mockSanitize.mockImplementation((input: string) => input);

    await updateLegalContent('politique_confidentialite', 'Privacy policy text', ADMIN_ID);

    const insertedRow = mockValues.mock.calls[0][0];
    expect(insertedRow.key).toBe('politique_confidentialite');
    expect(insertedRow.type).toBe('legal');
  });

  it('calls onConflictDoUpdate to enable idempotent upserts', async () => {
    await updateLegalContent('cgu', 'Some content', ADMIN_ID);

    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    const conflictArg = mockOnConflictDoUpdate.mock.calls[0][0];
    // The conflict resolution must update value, updated_by, and updated_at
    expect(conflictArg).toHaveProperty('set');
    expect(conflictArg.set).toHaveProperty('value');
    expect(conflictArg.set).toHaveProperty('updated_by');
    expect(conflictArg.set).toHaveProperty('updated_at');
  });
});

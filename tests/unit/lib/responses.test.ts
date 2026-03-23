jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      _body: body,
      json: async () => body,
    }),
  },
}));

import {
  successResponse,
  errorResponse,
  fromAppError,
  error400,
  error401,
  error403,
  error404,
  error409,
  error500,
  notImplementedResponse,
} from '@/lib/responses';
import { AppError, ValidationError, NotFoundError } from '@/lib/errors';
import { ApiCode } from '@/types/api-codes';
import { HTTP_STATUS } from '@/helpers/constants';

async function getBody(res: { json: () => Promise<unknown> }) {
  return res.json();
}

describe('responses', () => {
  describe('successResponse', () => {
    it('returns 200 and body with data only when no message', async () => {
      const res = successResponse({ id: '1' });
      expect(res.status).toBe(HTTP_STATUS.OK);
      const body = await getBody(res);
      expect(body).toEqual({ data: { id: '1' } });
      expect(body && typeof body === 'object' && 'success' in body).toBe(false);
    });

    it('returns body with message and data when message provided', async () => {
      const res = successResponse({ ok: true }, 'Done');
      const body = await getBody(res);
      expect(body).toEqual({ message: 'Done', data: { ok: true } });
      expect(body && typeof body === 'object' && 'success' in body).toBe(false);
    });

    it('uses given status code', () => {
      const res = successResponse(null, undefined, HTTP_STATUS.CREATED);
      expect(res.status).toBe(201);
    });
  });

  describe('errorResponse', () => {
    it('returns error body with message and status, no success field', async () => {
      const res = errorResponse('Bad request', HTTP_STATUS.BAD_REQUEST);
      expect(res.status).toBe(400);
      const body = await getBody(res) as { message: string; success?: boolean };
      expect(body.message).toBe('Bad request');
      expect('success' in body).toBe(false);
    });

    it('includes code when provided', async () => {
      const res = errorResponse('Conflict', HTTP_STATUS.CONFLICT, {
        code: ApiCode.EMAIL_ALREADY_EXISTS,
      });
      const body = await getBody(res) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.EMAIL_ALREADY_EXISTS);
    });

    it('includes errors array when provided', async () => {
      const res = errorResponse('Validation failed', 400, {
        code: ApiCode.VALIDATION_FAILED,
        errors: [{ field: 'email', message: 'Invalid' }],
      });
      const body = (await getBody(res)) as {
        errors: Array<{ field?: string; message: string }>;
      };
      expect(body.errors).toEqual([{ field: 'email', message: 'Invalid' }]);
    });

    it('omits optional fields when not provided', async () => {
      const res = errorResponse('Just message', HTTP_STATUS.BAD_REQUEST);
      const body = (await getBody(res)) as Record<string, unknown>;
      expect(body).toMatchObject({ message: 'Just message' });
      expect(body).not.toHaveProperty('code');
      expect(body).not.toHaveProperty('errors');
    });

    it('omits errors when empty array provided', async () => {
      const res = errorResponse('No details', HTTP_STATUS.BAD_REQUEST, {
        errors: [],
      });
      const body = (await getBody(res)) as Record<string, unknown>;
      expect(body).toMatchObject({ message: 'No details' });
      expect(body).not.toHaveProperty('errors');
    });
  });

  describe('fromAppError', () => {
    it('maps AppError to error response with inferred code', async () => {
      const err = new ValidationError('Invalid input');
      const res = fromAppError(err);
      expect(res.status).toBe(400);
      const body = await getBody(res) as { message: string; code: ApiCode };
      expect(body.message).toBe('Invalid input');
      expect(body.code).toBe(ApiCode.VALIDATION_FAILED);
    });

    it('uses NOT_FOUND for NotFoundError', async () => {
      const res = fromAppError(new NotFoundError('Missing'));
      expect(res.status).toBe(404);
      const body = await getBody(res) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.NOT_FOUND);
    });

    it('accepts explicit code override', async () => {
      const err = new AppError('Conflict', HTTP_STATUS.CONFLICT);
      const res = fromAppError(err, ApiCode.EMAIL_ALREADY_EXISTS);
      const body = await getBody(res) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.EMAIL_ALREADY_EXISTS);
    });
  });

  describe('error helpers', () => {
    it('error400 sets status and VALIDATION_FAILED by default', async () => {
      const res = error400('Invalid');
      expect(res.status).toBe(400);
      const body = await getBody(res) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.VALIDATION_FAILED);
    });

    it('error400 can pass errors array', async () => {
      const res = error400('Invalid', undefined, [
        { field: 'x', message: 'Required' },
      ]);
      const body = await getBody(res) as { errors: unknown[] };
      expect(body.errors).toHaveLength(1);
    });

    it('error401 sets 401 and UNAUTHORIZED', async () => {
      const res = error401();
      expect(res.status).toBe(401);
      const body = await getBody(res) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.UNAUTHORIZED);
    });

    it('error403 sets 403 and FORBIDDEN', async () => {
      const res = error403();
      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      const body = (await getBody(res)) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.FORBIDDEN);
    });

    it('error404 sets 404 and NOT_FOUND', async () => {
      const res = error404('Not found');
      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
      const body = (await getBody(res)) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.NOT_FOUND);
    });

    it('error409 sets 409 and CONFLICT', async () => {
      const res = error409();
      expect(res.status).toBe(HTTP_STATUS.CONFLICT);
      const body = (await getBody(res)) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.CONFLICT);
    });

    it('error500 sets 500 and INTERNAL_ERROR', async () => {
      const res = error500();
      expect(res.status).toBe(HTTP_STATUS.SERVER_ERROR);
      const body = (await getBody(res)) as { code: ApiCode };
      expect(body.code).toBe(ApiCode.INTERNAL_ERROR);
    });
  });

  describe('dev-only _dev field', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      jest.replaceProperty(process.env, 'NODE_ENV', originalEnv);
    });

    it('includes _dev message only in development', async () => {
      jest.replaceProperty(process.env, 'NODE_ENV', 'development');
      const error = new Error('Boom');
      const res = errorResponse(
        'Internal',
        HTTP_STATUS.SERVER_ERROR,
        { code: ApiCode.INTERNAL_ERROR },
        error
      );
      const body = (await getBody(res)) as { _dev?: string };
      expect(body._dev).toBe('Boom');
    });

    it('does not include _dev outside development', async () => {
      jest.replaceProperty(process.env, 'NODE_ENV', 'test');
      const res = errorResponse(
        'Internal',
        HTTP_STATUS.SERVER_ERROR,
        { code: ApiCode.INTERNAL_ERROR },
        new Error('Boom')
      );
      const body = (await getBody(res)) as { _dev?: string };
      expect(body._dev).toBeUndefined();
    });
  });

  describe('notImplementedResponse', () => {
    it('returns 501 with NOT_IMPLEMENTED code', async () => {
      const res = notImplementedResponse('Not implemented');
      expect(res.status).toBe(501);
      const body = (await getBody(res)) as { message: string; code: ApiCode };
      expect(body.message).toBe('Not implemented');
      expect(body.code).toBe(ApiCode.NOT_IMPLEMENTED);
    });
  });
});

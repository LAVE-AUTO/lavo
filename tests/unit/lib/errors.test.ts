import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from '@/lib/errors';

describe('errors', () => {
  it('AppError has statusCode and message', () => {
    const err = new AppError('test', 500);
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('AppError');
  });

  it('ValidationError has 400 status', () => {
    const err = new ValidationError('invalid');
    expect(err.statusCode).toBe(400);
  });

  it('NotFoundError has 404 status', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it('UnauthorizedError has 401 status', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });
});

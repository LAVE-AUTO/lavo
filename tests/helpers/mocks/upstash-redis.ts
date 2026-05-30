// Jest mock for @upstash/redis (ESM package incompatible with Jest's CJS transform).
// Tests that need Redis behavior should mock src/lib/redis.ts directly.
export class Redis {
  async get() { return null; }
  async set() { return 'OK'; }
  async del() { return 1; }
  async incr() { return 1; }
  async pexpire() { return 1; }
  static fromEnv() { return new Redis(); }
}

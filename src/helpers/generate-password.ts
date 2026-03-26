/**
 * Generates a cryptographically random password that satisfies the platform policy:
 * at least one uppercase letter, one lowercase letter, one digit, one special character,
 * and a minimum length of 12 characters.
 */
export function generatePassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '!@#$%&*';
  const all     = upper + lower + digits + special;

  const rand = (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };

  const pick = (src: string) => src[rand(src.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  const raw  = [...base, ...rest];

  for (let i = raw.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw.join('');
}

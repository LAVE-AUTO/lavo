import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// jsdom n'expose pas toujours TextEncoder pour les modules Node (ex. pg) chargés dans les tests.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

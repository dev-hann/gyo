import type { HttpResponse } from './types';

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Decodes a body with the page's own decoder. Malformed bytes become U+FFFD. */
export function decodeText(response: HttpResponse, encoding = 'utf-8'): string {
  return new TextDecoder(encoding).decode(base64ToBytes(response.bodyBase64));
}

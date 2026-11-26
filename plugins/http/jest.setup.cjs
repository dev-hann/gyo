// jsdom does not expose Node's TextDecoder, which the plugin decodes bodies with.
const { TextDecoder } = require('node:util');

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

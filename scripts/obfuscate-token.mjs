// Generate the obfuscated value to store in VITE_AUTH_TOKEN /
// VITE_SPECIAL_AUTH_TOKEN so the token is not a plain, grep-able string in the
// built bundle.
//
//   npm run obfuscate-token -- <plain-directus-token>
//   node scripts/obfuscate-token.mjs <plain-directus-token>
//
// Reminder: this is obfuscation, not encryption -- deterrence only. See
// src/assets/js/obfuscation.js for why it does not make the token secret.

import { obfuscateToken } from '../src/assets/js/obfuscation.js';

// pnpm forwards the "--" separator to the script while npm strips it, so drop
// any stray "--" and take the first remaining argument.
const plain = process.argv.slice(2).find((arg) => arg !== '--');
if (!plain) {
    console.error('Usage: npm run obfuscate-token -- <plain-token>');
    process.exit(1);
}

console.log(obfuscateToken(plain));

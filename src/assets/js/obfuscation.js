// --- Token obfuscation ---------------------------------------------------
// IMPORTANT: this is deterrence only, NOT security. A token shipped to the
// browser can always be recovered: the de-obfuscation key lives in this same
// bundle, and the decoded token still travels in the Authorization header
// (plainly visible in the browser's network tab). The only thing this buys is
// that the token is not a plain, grep-able string in the built JS. Anything
// that must stay genuinely secret cannot live in the frontend at all -- it
// needs a server-side proxy that injects the header.
//
// Obfuscated env values carry an "obf:" prefix. Un-prefixed values (the
// CHANGE_THIS_AFTER_DIRECTUS_STARTED placeholder, or any legacy plain-text
// token) are returned verbatim, so this stays fully backward compatible.
//
// Generate an obfuscated value with: npm run obfuscate-token -- <plain-token>

const OBF_PREFIX = 'obf:';
const OBF_KEY = 'gb-dashboard-static-token';

// Isomorphic base64 so the same module works in the browser (btoa/atob) and in
// the Node CLI (Buffer). Operates on "binary strings" (one byte per char).
function encodeBase64(binary) {
    if (typeof btoa === 'function') return btoa(binary);
    return Buffer.from(binary, 'binary').toString('base64');
}

function decodeBase64(b64) {
    if (typeof atob === 'function') return atob(b64);
    return Buffer.from(b64, 'base64').toString('binary');
}

function xor(bytes) {
    const out = new Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        out[i] = bytes[i] ^ OBF_KEY.charCodeAt(i % OBF_KEY.length);
    }
    return out;
}

export function obfuscateToken(plain) {
    if (!plain) return plain;
    const bytes = [];
    for (let i = 0; i < plain.length; i++) bytes.push(plain.charCodeAt(i) & 0xff);
    const binary = String.fromCharCode(...xor(bytes));
    return OBF_PREFIX + encodeBase64(binary);
}

export function deobfuscateToken(value) {
    if (!value || !value.startsWith(OBF_PREFIX)) return value;
    const binary = decodeBase64(value.slice(OBF_PREFIX.length));
    const bytes = [];
    for (let i = 0; i < binary.length; i++) bytes.push(binary.charCodeAt(i));
    return String.fromCharCode(...xor(bytes));
}

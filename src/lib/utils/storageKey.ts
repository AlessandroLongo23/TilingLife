/**
 * Sanitize strings for use in Supabase Storage object keys (paths).
 * Uses _XX_ hex encoding (underscore is allowed by Supabase) - deterministic and reversible.
 *
 * Unsafe chars: / \ ^ | ? # [ ] { } " ' < > : % ~ and control chars
 * Safe chars: a-zA-Z0-9 _ - . , ( ) ! * & $ @ = ; + space
 */

const ESCAPE_PREFIX = '_';

/** Characters that must be encoded for Supabase storage keys */
const UNSAFE_PATTERN = /[\/\\^|?#\[\]{}"'<>:%~\x00-\x1f\x7f]/g;

/**
 * Sanitize a string for use in storage paths.
 * Reversibly encodes unsafe characters as _XX_ (hex of char code).
 * Underscore itself is encoded as _5F_ to avoid collision.
 */
export function sanitizeForStorage(str: string): string {
    if (!str) return str;
    return str
        .replace(/_/g, '_5F_')
        .replace(UNSAFE_PATTERN, (char) => {
            const hex = char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
            return `${ESCAPE_PREFIX}${hex}_`;
        });
}

/**
 * Restore a string from sanitized storage format.
 * Decodes _XX_ sequences back to original characters.
 */
export function restoreFromStorage(sanitized: string): string {
    if (!sanitized) return sanitized;
    return sanitized.replace(/_([0-9A-Fa-f]{2})_/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );
}

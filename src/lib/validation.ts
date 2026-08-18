/**
 * Egyptian mobile number rule — exactly 11 digits starting with one of the
 * supported prefixes (010 / 011 / 012 / 015).
 */
export const EGYPTIAN_MOBILE_REGEX = /^01[0125]\d{8}$/;

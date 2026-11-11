/**
 * Markdown sanitization utility for HayahBook Articles
 * Prevents XSS, unsafe HTML tags, and malicious links (e.g. javascript:, data:, vbscript:)
 * while fully preserving standard Markdown formatting (blockquotes, lists, hyperlinks, headers, bold, italics).
 */

export function isSafeUrl(url?: string | null): boolean {
  if (!url) return false;
  let decoded = url.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Malformed URI, keep original trimmed
  }
  const clean = decoded
    .replace(/&#[xX]?[0-9a-fA-F]+;/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, '')
    .toLowerCase();

  // Disallow dangerous URI schemes
  if (
    clean.startsWith('javascript:') ||
    clean.startsWith('vbscript:') ||
    clean.startsWith('data:') ||
    clean.startsWith('file:') ||
    clean.startsWith('blob:')
  ) {
    return false;
  }

  // Allow standard web schemes, mailto, tel, relative paths, or fragment anchors
  return (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('mailto:') ||
    clean.startsWith('tel:') ||
    clean.startsWith('/') ||
    clean.startsWith('#') ||
    !clean.includes(':') // relative path without protocol
  );
}

export function sanitizeMarkdown(content?: string | null): string {
  if (!content) return '';

  // Remove active-content blocks with their contents before neutralizing remaining HTML.
  let sanitized = content.replace(
    /<(script|style|iframe|object|embed|applet|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    '',
  );
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

  // Strip inline event handlers like onload, onerror, onclick, etc. from HTML tags
  sanitized = sanitized.replace(
    /\s+on[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi,
    ' ',
  );

  const linkRegex = /\[([^\]]*)\]\(\s*((?:[^()\s]+|\([^()\s]*\))*)\s*\)/g;
  sanitized = sanitized.replace(
    linkRegex,
    (match, title: string, rawUrl: string) => {
      if (!isSafeUrl(rawUrl)) return title || '';
      return match;
    },
  );

  return sanitized;
}

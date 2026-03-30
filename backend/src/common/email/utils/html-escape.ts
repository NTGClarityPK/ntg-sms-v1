/** Safe for HTML text nodes. */
export function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

/** Safe inside double-quoted HTML attributes (e.g. href). */
export function escapeAttr(v: string): string {
  return v.replace(/"/g, '&quot;');
}

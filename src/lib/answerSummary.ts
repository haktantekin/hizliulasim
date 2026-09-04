const PARAGRAPH_PATTERN = /<p\b[^>]*>[\s\S]*?<\/p>/gi;

function paragraphText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_match, hex: string, decimal: string) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutParagraph(contentHtml: string, index: number, paragraph: string): string {
  return contentHtml.slice(0, index) + contentHtml.slice(index + paragraph.length);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanExcerpt(excerpt: string): string {
  return excerpt
    .replace(/\s*\[(?:&hellip;|&#8230;|…|\.\.\.)\]\s*$/i, '')
    .trim();
}

export function extractAnswerSummary(contentHtml: string, excerpt: string) {
  const paragraphs = [...contentHtml.matchAll(PARAGRAPH_PATTERN)];
  const explicit = paragraphs.find((match) =>
    /^kısa cevap\s*[:\-–—]/i.test(paragraphText(match[0])),
  );
  const selected = explicit ?? paragraphs.find((match) => paragraphText(match[0]).length >= 40);

  if (selected && selected.index !== undefined) {
    return {
      summaryHtml: selected[0],
      contentHtml: withoutParagraph(contentHtml, selected.index, selected[0]),
    };
  }

  const fallback = cleanExcerpt(excerpt);
  return {
    summaryHtml: fallback === '' ? '' : `<p>${escapeHtml(fallback)}</p>`,
    contentHtml,
  };
}

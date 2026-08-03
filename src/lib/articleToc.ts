import { slugify } from './slugify';

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCharCode(Number(value)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, value: string) => String.fromCharCode(parseInt(value, 16)));
}

function extractHeadingText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function buildArticleContent(html: string): { html: string; headings: TocHeading[] } {
  const headings: TocHeading[] = [];
  const usedIds = new Map<string, number>();

  const transformedHtml = html.replace(/<h([2-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, innerHtml) => {
    const text = extractHeadingText(innerHtml);
    if (!text) return match;

    const baseId = slugify(text) || `heading-${headings.length + 1}`;
    const currentCount = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, currentCount + 1);
    const id = currentCount === 0 ? baseId : `${baseId}-${currentCount + 1}`;

    headings.push({ id, text, level: Number(level) });

    const cleanedAttrs = attrs.replace(/\s*id=(['"])[^'"]*\1/i, '').trim();
    const nextAttrs = cleanedAttrs ? ` ${cleanedAttrs}` : '';

    return `<h${level}${nextAttrs} id="${id}">${innerHtml}</h${level}>`;
  });

  return { html: transformedHtml, headings };
}
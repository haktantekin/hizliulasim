import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_LOW_INCOMING_THRESHOLD = 3;

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (match, hex, decimal) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    });
}

function siteKey(url) {
  const parsed = new URL(url);
  return `${parsed.hostname.replace(/^www\./i, '').toLowerCase()}:${parsed.port}`;
}

function isSameSite(first, second) {
  return siteKey(first) === siteKey(second);
}

function normalizedUrl(value) {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
}

function attributeValue(attributes, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = attributes.match(new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\u0060]+))`,
    'i',
  ));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function textContent(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function collectSchemaTypes(value, types) {
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaTypes(item, types);
    return;
  }
  if (!value || typeof value !== 'object') return;

  const schemaType = value['@type'];
  if (typeof schemaType === 'string') types.add(schemaType);
  else if (Array.isArray(schemaType)) {
    for (const item of schemaType) {
      if (typeof item === 'string') types.add(item);
    }
  }

  for (const nested of Object.values(value)) collectSchemaTypes(nested, types);
}

export function extractPageSignals(html, pageUrl, headers = new Headers()) {
  const canonicalUrls = [];
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const rel = attributeValue(match[1], 'rel')?.toLowerCase().split(/\s+/) || [];
    const href = attributeValue(match[1], 'href');
    if (!rel.includes('canonical') || !href) continue;
    try {
      canonicalUrls.push(normalizedUrl(new URL(href, pageUrl)));
    } catch {
      canonicalUrls.push(href);
    }
  }

  const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
    .map((match) => textContent(match[1]));
  const metaDescriptions = [];
  const robotsDirectives = [];
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const name = attributeValue(match[1], 'name')?.toLowerCase();
    const content = attributeValue(match[1], 'content')?.trim() || '';
    if (name === 'description') metaDescriptions.push(content);
    if (name === 'robots' || name === 'googlebot') {
      robotsDirectives.push(...content.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
    }
  }
  const headerRobots = headers.get('x-robots-tag') || '';
  robotsDirectives.push(...headerRobots.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));

  const h1Texts = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => textContent(match[1]));
  const schemaTypes = new Set();
  let jsonLdErrors = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attributeValue(match[1], 'type')?.toLowerCase() !== 'application/ld+json') continue;
    try {
      collectSchemaTypes(JSON.parse(match[2].trim()), schemaTypes);
    } catch {
      jsonLdErrors += 1;
    }
  }

  const directives = [...new Set(robotsDirectives)].sort();
  return {
    canonicalUrls,
    robotsDirectives: directives,
    noindex: directives.some((directive) => /\bnoindex\b/.test(directive)),
    title: titles[0] || null,
    titleCount: titles.length,
    metaDescriptions,
    h1Texts,
    links: extractInternalLinks(html, pageUrl, pageUrl),
    schemaTypes: [...schemaTypes].sort(),
    jsonLdErrors,
  };
}

function extractCanonical(html, pageUrl) {
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const rel = attributeValue(match[1], 'rel')?.toLowerCase().split(/\s+/) || [];
    const href = attributeValue(match[1], 'href');
    if (rel.includes('canonical') && href) {
      try {
        return normalizedUrl(new URL(href, pageUrl));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function hasNoindex(html, headers) {
  if (/\bnoindex\b/i.test(headers.get('x-robots-tag') || '')) return true;
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const name = attributeValue(match[1], 'name')?.toLowerCase();
    const content = attributeValue(match[1], 'content') || '';
    if ((name === 'robots' || name === 'googlebot') && /\bnoindex\b/i.test(content)) return true;
  }
  return false;
}

function extractInternalLinks(html, pageUrl, baseUrl) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const href = attributeValue(match[1], 'href')?.trim();
    if (!href || href.startsWith('#') || /^(?:mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const target = new URL(href, pageUrl);
      if (!/^https?:$/.test(target.protocol) || !isSameSite(target, baseUrl)) continue;
      links.add(normalizedUrl(target));
    } catch {
      // Invalid hrefs are not crawlable URLs and are ignored.
    }
  }
  return [...links];
}

async function fetchWithTimeout(url, { fetchImpl, timeoutMs, accept }, consume) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept,
        'user-agent': 'HizliUlasim-Orphan-Audit/1.0',
      },
    });
    return await consume(response);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTextWithTimeout(url, {
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  accept = '*/*',
} = {}) {
  return fetchWithTimeout(url, { fetchImpl, timeoutMs, accept }, async (response) => ({
    response,
    text: await response.text(),
  }));
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function parseSitemap(xml) {
  const locations = [...xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeEntities(match[1].trim()))
    .filter(Boolean);
  return {
    type: /<sitemapindex\b/i.test(xml) ? 'index' : 'urlset',
    locations,
  };
}

async function collectSitemapUrls({ sitemapUrl, baseUrl, fetchImpl, timeoutMs }) {
  const pending = [normalizedUrl(sitemapUrl)];
  const visitedSitemaps = new Set();
  const urls = new Set();

  while (pending.length > 0) {
    const current = pending.shift();
    if (visitedSitemaps.has(current)) continue;
    visitedSitemaps.add(current);
    if (visitedSitemaps.size > 100) throw new Error('Sitemap index exceeds the 100-file safety limit');

    const { response, text } = await fetchTextWithTimeout(current, {
      fetchImpl,
      timeoutMs,
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
    });
    if (!response.ok) throw new Error(`Sitemap request failed: ${response.status} ${current}`);
    const sitemap = parseSitemap(text);

    for (const location of sitemap.locations) {
      const resolved = normalizedUrl(new URL(location, current));
      if (!isSameSite(resolved, baseUrl)) continue;
      if (sitemap.type === 'index') pending.push(resolved);
      else urls.add(resolved);
    }
  }
  return [...urls].sort();
}

async function inspectUrl(url, options, parseLinks) {
  try {
    return await fetchWithTimeout(url, {
      ...options,
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
    }, async (response) => {
      const contentType = response.headers.get('content-type') || '';
      const isHtml = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);
      const html = isHtml && response.status === 200 ? await response.text() : '';
      const locationHeader = response.headers.get('location');
      let location = null;
      if (locationHeader) {
        try {
          location = normalizedUrl(new URL(locationHeader, url));
        } catch {
          location = null;
        }
      }
      const signals = html ? extractPageSignals(html, url, response.headers) : {
        canonicalUrls: [],
        robotsDirectives: [],
        noindex: false,
        title: null,
        titleCount: 0,
        metaDescriptions: [],
        h1Texts: [],
        links: [],
        schemaTypes: [],
        jsonLdErrors: 0,
      };
      return {
        url,
        status: response.status,
        contentType,
        location,
        ...signals,
        canonical: html ? extractCanonical(html, url) : null,
        links: parseLinks ? signals.links : [],
      };
    });
  } catch (error) {
    return {
      url,
      status: 0,
      contentType: '',
      location: null,
      canonical: null,
      canonicalUrls: [],
      robotsDirectives: [],
      noindex: false,
      title: null,
      titleCount: 0,
      metaDescriptions: [],
      h1Texts: [],
      links: [],
      schemaTypes: [],
      jsonLdErrors: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function exclusionReason(page, baseUrl) {
  if (page.status >= 300 && page.status < 400) return 'redirect';
  if (page.status !== 200) return page.status === 0 ? 'request-error' : `http-${page.status}`;
  if (!/(?:text\/html|application\/xhtml\+xml)/i.test(page.contentType)) return 'non-html';
  if (page.noindex) return 'noindex';
  if (page.canonical && (!isSameSite(page.canonical, baseUrl) || page.canonical !== page.url)) {
    return 'canonicalized';
  }
  return null;
}

export async function crawlSite({
  baseUrl,
  sitemapUrl = new URL('/sitemap.xml', baseUrl).toString(),
  fetchImpl = fetch,
  concurrency = DEFAULT_CONCURRENCY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  lowIncomingThreshold = DEFAULT_LOW_INCOMING_THRESHOLD,
}) {
  const normalizedBaseUrl = normalizedUrl(baseUrl);
  const normalizedSitemapUrl = normalizedUrl(sitemapUrl);
  if (!isSameSite(normalizedBaseUrl, normalizedSitemapUrl)) {
    throw new Error('Sitemap URL must belong to the audited site');
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error('Concurrency must be an integer between 1 and 32');
  }

  const sitemapUrls = await collectSitemapUrls({
    sitemapUrl: normalizedSitemapUrl,
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    timeoutMs,
  });
  const inspectedPages = await mapConcurrent(sitemapUrls, concurrency, (url) => inspectUrl(url, {
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    timeoutMs,
  }, true));

  const indexablePages = [];
  const exclusionReasons = new Map();
  for (const page of inspectedPages) {
    const reason = exclusionReason(page, normalizedBaseUrl);
    exclusionReasons.set(page.url, reason);
    if (!reason) indexablePages.push(page);
  }

  const indexableUrlSet = new Set(indexablePages.map((page) => page.url));
  const linkSources = new Map();
  for (const page of indexablePages) {
    for (const targetUrl of page.links) {
      if (!linkSources.has(targetUrl)) linkSources.set(targetUrl, new Set());
      linkSources.get(targetUrl).add(page.url);
    }
  }

  const inspectedByUrl = new Map(inspectedPages.map((page) => [page.url, page]));
  const referencedTargets = new Set(linkSources.keys());
  for (const page of inspectedPages) {
    for (const canonicalUrl of page.canonicalUrls) {
      try {
        if (isSameSite(canonicalUrl, normalizedBaseUrl)) referencedTargets.add(canonicalUrl);
      } catch {
        // Invalid canonical values stay on the page for the SEO evaluator.
      }
    }
  }
  const undiscoveredTargets = [...referencedTargets].filter((url) => !inspectedByUrl.has(url));
  const targetChecks = await mapConcurrent(undiscoveredTargets, concurrency, (url) => inspectUrl(url, {
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    timeoutMs,
  }, false));
  for (const check of targetChecks) inspectedByUrl.set(check.url, check);

  const brokenInternalLinks = [];
  const redirectingInternalLinks = [];
  for (const [targetUrl, sources] of linkSources) {
    const target = inspectedByUrl.get(targetUrl);
    for (const sourceUrl of [...sources].sort()) {
      if (!target || target.status === 0 || target.status >= 400) {
        brokenInternalLinks.push({
          sourceUrl,
          targetUrl,
          status: target?.status || 0,
          ...(target?.error ? { error: target.error } : {}),
        });
      } else if (target.status >= 300 && target.status < 400) {
        redirectingInternalLinks.push({
          sourceUrl,
          targetUrl,
          status: target.status,
          location: target.location,
        });
      }
    }
  }

  const pages = inspectedPages.map((page) => {
    const incomingFrom = [...(linkSources.get(page.url) || [])]
      .filter((sourceUrl) => sourceUrl !== page.url && indexableUrlSet.has(sourceUrl))
      .sort();
    const incomingLinks = incomingFrom.length;
    const classification = incomingLinks === 0
      ? 'orphan'
      : incomingLinks === 1
        ? 'single'
        : incomingLinks <= lowIncomingThreshold
          ? 'low'
          : 'healthy';
    return {
      ...page,
      inSitemap: true,
      indexable: !exclusionReasons.get(page.url),
      exclusionReason: exclusionReasons.get(page.url),
      incomingLinks,
      incomingFrom,
      orphan: incomingLinks === 0,
      classification,
    };
  }).sort((a, b) => a.url.localeCompare(b.url));

  brokenInternalLinks.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl) || a.targetUrl.localeCompare(b.targetUrl));
  redirectingInternalLinks.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl) || a.targetUrl.localeCompare(b.targetUrl));

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: normalizedBaseUrl,
    sitemapUrl: normalizedSitemapUrl,
    lowIncomingThreshold,
    sitemapUrls,
    pages,
    resources: [...inspectedByUrl.values()].sort((a, b) => a.url.localeCompare(b.url)),
    brokenInternalLinks,
    redirectingInternalLinks,
  };
}

export function buildOrphanReport(crawlResult) {
  const indexablePages = crawlResult.pages.filter((page) => page.indexable);
  const excludedPages = crawlResult.pages
    .filter((page) => !page.indexable)
    .map((page) => ({
      url: page.url,
      status: page.status,
      reason: page.exclusionReason,
      ...(page.canonical ? { canonical: page.canonical } : {}),
      ...(page.error ? { error: page.error } : {}),
    }));
  const pages = indexablePages.map((page) => ({
    url: page.url,
    incomingLinks: page.incomingLinks,
    incomingFrom: page.incomingFrom,
    orphan: page.orphan,
    classification: page.classification,
    status: page.status,
    canonical: page.canonical || page.url,
  }));

  return {
    generatedAt: crawlResult.generatedAt,
    baseUrl: crawlResult.baseUrl,
    sitemapUrl: crawlResult.sitemapUrl,
    lowIncomingThreshold: crawlResult.lowIncomingThreshold,
    summary: {
      sitemapUrls: crawlResult.sitemapUrls.length,
      indexableUrls: pages.length,
      orphanPages: pages.filter((page) => page.classification === 'orphan').length,
      singleIncomingPages: pages.filter((page) => page.classification === 'single').length,
      lowIncomingPages: pages.filter((page) => page.classification === 'low').length,
      brokenInternalLinks: crawlResult.brokenInternalLinks.length,
      redirectingInternalLinks: crawlResult.redirectingInternalLinks.length,
    },
    pages,
    excludedPages,
    brokenInternalLinks: crawlResult.brokenInternalLinks,
    redirectingInternalLinks: crawlResult.redirectingInternalLinks,
  };
}

export async function auditSite(options) {
  return buildOrphanReport(await crawlSite(options));
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function buildCsvReport(report) {
  const header = ['url', 'incomingLinks', 'orphan', 'classification', 'status', 'canonical'];
  const rows = report.pages.map((page) => [
    new URL(page.url).pathname + new URL(page.url).search,
    page.incomingLinks,
    page.orphan,
    page.classification,
    page.status,
    page.canonical,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

export async function writeAuditReports(report, outputDirectory) {
  const resolvedDirectory = path.resolve(outputDirectory);
  await mkdir(resolvedDirectory, { recursive: true });
  const jsonPath = path.join(resolvedDirectory, 'orphan-pages.json');
  const csvPath = path.join(resolvedDirectory, 'orphan-pages.csv');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(csvPath, buildCsvReport(report), 'utf8'),
  ]);
  return { jsonPath, csvPath };
}

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { crawlSite, fetchTextWithTimeout } from './orphan-audit.mjs';
import { buildSeoAudit } from './seo-engine.mjs';

const DEFAULT_BASE_URL = 'https://hizliulasim.com';
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_TIMEOUT_MS = 15_000;
const AUDIT_USER_AGENT = 'HizliUlasim-SEO-Audit';

function httpUrl(value, variableName) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    url.hash = '';
    return url;
  } catch {
    throw new Error(`${variableName} must be a valid HTTP or HTTPS URL`);
  }
}

export function parseAuditConfig(env = process.env) {
  const inputBaseUrl = httpUrl(env.SEO_BASE_URL || DEFAULT_BASE_URL, 'SEO_BASE_URL');
  const baseUrl = new URL('/', inputBaseUrl).toString();
  const sitemapUrl = httpUrl(
    env.SEO_SITEMAP_URL || new URL('/sitemap.xml', baseUrl).toString(),
    'SEO_SITEMAP_URL',
  ).toString();
  const concurrencyInput = env.SEO_CRAWL_CONCURRENCY || String(DEFAULT_CONCURRENCY);
  const timeoutInput = env.SEO_CRAWL_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS);
  const concurrency = /^\d+$/.test(concurrencyInput) ? Number(concurrencyInput) : Number.NaN;
  const timeoutMs = /^\d+$/.test(timeoutInput) ? Number(timeoutInput) : Number.NaN;

  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error('Concurrency must be an integer between 1 and 32');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error('Timeout must be a positive integer');
  }

  return {
    baseUrl,
    sitemapUrl,
    outputDirectory: env.SEO_REPORT_DIR || 'reports/seo',
    concurrency,
    timeoutMs,
    strict: env.SEO_AUDIT_STRICT === 'true',
  };
}

function robotsGroups(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  let hasRules = false;
  const flush = () => {
    if (agents.length > 0) groups.push({ agents, rules });
    agents = [];
    rules = [];
    hasRules = false;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (hasRules) flush();
      agents.push(value.toLowerCase());
    } else if ((field === 'allow' || field === 'disallow') && agents.length > 0) {
      rules.push({ type: field, path: value });
      hasRules = true;
    }
  }
  flush();
  return groups;
}

function robotsBlocksPath(text, pathname) {
  const groups = robotsGroups(text);
  const exact = groups.filter(({ agents }) => agents.includes(AUDIT_USER_AGENT.toLowerCase()));
  const applicable = exact.length > 0 ? exact : groups.filter(({ agents }) => agents.includes('*'));
  const matches = applicable
    .flatMap(({ rules }) => rules)
    .filter((rule) => rule.path && pathname.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length || (a.type === 'allow' ? -1 : 1));
  return matches[0]?.type === 'disallow';
}

async function fetchStatusWithTimeout(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'text/plain,*/*;q=0.1',
        'user-agent': `${AUDIT_USER_AGENT}/1.0`,
      },
    });
    const result = {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
    };
    await response.body?.cancel();
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export async function collectSiteChecks({ baseUrl, sitemapUrl, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const robotsUrl = new URL('/robots.txt', baseUrl).toString();
  const indexNowKeyUrl = new URL('/indexnow-key.txt', baseUrl).toString();
  const [{ response: robotsResponse, text: robotsText }, indexNowResponse] = await Promise.all([
    fetchTextWithTimeout(robotsUrl, {
      fetchImpl,
      timeoutMs,
      accept: 'text/plain,*/*;q=0.1',
    }).catch(() => ({ response: { status: 0, headers: new Headers() }, text: '' })),
    fetchStatusWithTimeout(indexNowKeyUrl, { fetchImpl, timeoutMs })
      .catch(() => ({ status: 0, contentType: '' })),
  ]);

  const declaredSitemaps = [...robotsText.matchAll(/^\s*sitemap\s*:\s*(\S+)\s*$/gim)]
    .map((match) => {
      try {
        return new URL(match[1], robotsUrl).toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const sitemapPath = new URL(sitemapUrl).pathname;

  return {
    robots: {
      status: robotsResponse.status,
      contentType: robotsResponse.headers.get('content-type') || '',
      declaresSitemap: declaredSitemaps.includes(new URL(sitemapUrl).toString()),
      blocksRoot: robotsBlocksPath(robotsText, '/'),
      blocksSitemap: robotsBlocksPath(robotsText, sitemapPath),
    },
    indexNowKeyStatus: indexNowResponse.status,
  };
}

function findingCodeSummary(findings) {
  const counts = new Map();
  for (const finding of findings) counts.set(finding.code, (counts.get(finding.code) || 0) + 1);
  return [...counts.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([code, count]) => `${code}=${count}`)
    .join(', ') || 'none';
}

export async function runSeoAudit({
  env = process.env,
  fetchImpl = fetch,
  outputDirectory,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  void stderr;
  const config = parseAuditConfig(env);
  const [crawl, siteChecks] = await Promise.all([
    crawlSite({
      baseUrl: config.baseUrl,
      sitemapUrl: config.sitemapUrl,
      fetchImpl,
      concurrency: config.concurrency,
      timeoutMs: config.timeoutMs,
    }),
    collectSiteChecks({
      baseUrl: config.baseUrl,
      sitemapUrl: config.sitemapUrl,
      fetchImpl,
      timeoutMs: config.timeoutMs,
    }),
  ]);
  const report = buildSeoAudit({ crawl, siteChecks, strict: config.strict });
  const resolvedDirectory = path.resolve(outputDirectory || config.outputDirectory);
  await mkdir(resolvedDirectory, { recursive: true });
  const reportPath = path.join(resolvedDirectory, 'seo-audit.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  stdout.write(`SEO audit completed: ${report.baseUrl}\n`);
  stdout.write(`Audited URLs: ${report.summary.auditedUrls}, indexable: ${report.summary.indexableUrls}\n`);
  stdout.write(`Critical: ${report.summary.criticalErrors}, warnings: ${report.summary.warnings}, recommendations: ${report.summary.recommendations}\n`);
  stdout.write(`Critical codes: ${findingCodeSummary(report.findings.criticalErrors)}\n`);
  stdout.write(`Warning codes: ${findingCodeSummary(report.findings.warnings)}\n`);
  stdout.write(`Recommendation codes: ${findingCodeSummary(report.findings.recommendations)}\n`);
  stdout.write(`Report: ${reportPath}\n`);

  return {
    report,
    reportPath,
    exitCode: config.strict && report.summary.criticalErrors > 0 ? 1 : 0,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  try {
    const result = await runSeoAudit();
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`SEO audit failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

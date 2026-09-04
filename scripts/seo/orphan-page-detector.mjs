import { auditSite, writeAuditReports } from './orphan-audit.mjs';

const baseUrl = process.env.SEO_BASE_URL || 'https://hizliulasim.com';
const sitemapUrl = process.env.SEO_SITEMAP_URL || new URL('/sitemap.xml', baseUrl).toString();
const outputDirectory = process.env.SEO_REPORT_DIR || 'reports/seo';
const concurrency = Number.parseInt(process.env.SEO_CRAWL_CONCURRENCY || '8', 10);
const timeoutMs = Number.parseInt(process.env.SEO_CRAWL_TIMEOUT_MS || '15000', 10);

try {
  console.log(`SEO orphan audit started: ${sitemapUrl}`);
  const report = await auditSite({ baseUrl, sitemapUrl, concurrency, timeoutMs });
  const paths = await writeAuditReports(report, outputDirectory);
  const { summary } = report;

  console.log(`Indexable URLs: ${summary.indexableUrls}/${summary.sitemapUrls}`);
  console.log(`Orphan: ${summary.orphanPages}, single incoming: ${summary.singleIncomingPages}, low incoming: ${summary.lowIncomingPages}`);
  console.log(`Broken links: ${summary.brokenInternalLinks}, redirect links: ${summary.redirectingInternalLinks}`);
  console.log(`JSON report: ${paths.jsonPath}`);
  console.log(`CSV report: ${paths.csvPath}`);
} catch (error) {
  console.error(`SEO orphan audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

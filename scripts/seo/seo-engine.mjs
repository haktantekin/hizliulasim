function sameSite(first, second) {
  try {
    const firstUrl = new URL(first);
    const secondUrl = new URL(second);
    const firstHost = firstUrl.hostname.replace(/^www\./i, '').toLowerCase();
    const secondHost = secondUrl.hostname.replace(/^www\./i, '').toLowerCase();
    return firstHost === secondHost && firstUrl.port === secondUrl.port;
  } catch {
    return false;
  }
}

function sortFindings(findings) {
  return findings.sort((a, b) => a.url.localeCompare(b.url) || a.code.localeCompare(b.code));
}

function publicPageDiagnostics(page) {
  return {
    url: page.url,
    status: page.status,
    contentType: page.contentType,
    redirectLocation: page.location || null,
    indexable: page.indexable,
    exclusionReason: page.exclusionReason || null,
    robotsDirectives: [...(page.robotsDirectives || [])],
    canonicalUrls: [...(page.canonicalUrls || [])],
    title: page.title || null,
    titleCount: page.titleCount || 0,
    metaDescriptions: [...(page.metaDescriptions || [])],
    h1Texts: [...(page.h1Texts || [])],
    internalLinks: [...(page.links || [])],
    incomingLinks: page.incomingLinks || 0,
    incomingFrom: [...(page.incomingFrom || [])],
    orphan: Boolean(page.orphan),
    classification: page.classification,
    schemaTypes: [...(page.schemaTypes || [])],
    jsonLdErrors: page.jsonLdErrors || 0,
    ...(page.error ? { error: page.error } : {}),
  };
}

function publicSiteChecks(siteChecks) {
  const robots = siteChecks?.robots || {};
  return {
    robots: {
      status: robots.status || 0,
      contentType: robots.contentType || '',
      declaresSitemap: Boolean(robots.declaresSitemap),
      blocksRoot: Boolean(robots.blocksRoot),
      blocksSitemap: Boolean(robots.blocksSitemap),
    },
    indexNowKeyStatus: siteChecks?.indexNowKeyStatus || 0,
  };
}

export function buildSeoAudit({ crawl, siteChecks, strict = false }) {
  const criticalErrors = [];
  const warnings = [];
  const recommendations = [];
  const resourcesByUrl = new Map((crawl.resources || []).map((resource) => [resource.url, resource]));

  const add = (bucket, code, severity, url, message, evidence = {}) => {
    bucket.push({ code, severity, url, message, evidence });
  };

  for (const page of crawl.pages) {
    const isHtml = /(?:text\/html|application\/xhtml\+xml)/i.test(page.contentType || '');
    if (page.status !== 200) {
      add(criticalErrors, 'NON_200_SITEMAP_URL', 'critical', page.url,
        'Sitemap URL’si HTTP 200 döndürmüyor.', { status: page.status, location: page.location || null });
      continue;
    }
    if (!isHtml) {
      add(criticalErrors, 'NON_HTML_SITEMAP_URL', 'critical', page.url,
        'Sitemap URL’si HTML içerik döndürmüyor.', { contentType: page.contentType });
      continue;
    }

    if (page.noindex) {
      add(criticalErrors, 'NOINDEX_IN_SITEMAP', 'critical', page.url,
        'Sitemap URL’si noindex direktifi içeriyor.', { robotsDirectives: page.robotsDirectives || [] });
    }

    const canonicalUrls = page.canonicalUrls || [];
    if (canonicalUrls.length === 0) {
      add(criticalErrors, 'MISSING_CANONICAL', 'critical', page.url,
        'Indexlenebilir sitemap URL’sinde canonical bulunamadı.');
    } else if (canonicalUrls.length > 1) {
      add(criticalErrors, 'MULTIPLE_CANONICALS', 'critical', page.url,
        'Sayfada birden fazla canonical bulundu.', { canonicalUrls });
    } else {
      const canonical = canonicalUrls[0];
      let parsedCanonical = null;
      try {
        parsedCanonical = new URL(canonical).toString();
      } catch {
        add(criticalErrors, 'INVALID_CANONICAL', 'critical', page.url,
          'Canonical URL geçerli değil.', { canonical });
      }

      if (parsedCanonical) {
        if (!sameSite(parsedCanonical, crawl.baseUrl)) {
          add(criticalErrors, 'EXTERNAL_CANONICAL', 'critical', page.url,
            'Canonical farklı bir siteyi gösteriyor.', { canonical: parsedCanonical });
        } else {
          if (parsedCanonical !== page.url) {
            add(criticalErrors, 'NON_SELF_CANONICAL', 'critical', page.url,
              'Sitemap URL’si kendisinden farklı bir canonical gösteriyor.', { canonical: parsedCanonical });
          }
          const target = resourcesByUrl.get(parsedCanonical);
          if (!target || target.status !== 200) {
            add(criticalErrors, 'CANONICAL_TARGET_NOT_200', 'critical', page.url,
              'Canonical hedefi doğrudan HTTP 200 döndürmüyor.', {
                canonical: parsedCanonical,
                status: target?.status || 0,
                location: target?.location || null,
              });
          }
        }
      }
    }

    if ((page.titleCount || 0) === 0) {
      add(warnings, 'MISSING_TITLE', 'warning', page.url, 'Sayfada title bulunamadı.');
    } else if (page.titleCount > 1) {
      add(warnings, 'MULTIPLE_TITLES', 'warning', page.url, 'Sayfada birden fazla title bulundu.', { count: page.titleCount });
    }
    if ((page.metaDescriptions || []).length === 0) {
      add(warnings, 'MISSING_META_DESCRIPTION', 'warning', page.url, 'Sayfada meta description bulunamadı.');
    } else if (page.metaDescriptions.length > 1) {
      add(warnings, 'MULTIPLE_META_DESCRIPTIONS', 'warning', page.url,
        'Sayfada birden fazla meta description bulundu.', { count: page.metaDescriptions.length });
    }
    if ((page.h1Texts || []).length === 0) {
      add(warnings, 'MISSING_H1', 'warning', page.url, 'Sayfada H1 bulunamadı.');
    } else if (page.h1Texts.length > 1) {
      add(warnings, 'MULTIPLE_H1', 'warning', page.url, 'Sayfada birden fazla H1 bulundu.', { count: page.h1Texts.length });
    }
    if ((page.jsonLdErrors || 0) > 0) {
      add(warnings, 'INVALID_JSON_LD', 'warning', page.url, 'Geçersiz JSON-LD bulundu.', { count: page.jsonLdErrors });
    }
    if (page.indexable && page.classification === 'orphan') {
      add(warnings, 'ORPHAN_PAGE', 'warning', page.url, 'Sayfa başka bir indexlenebilir sayfadan internal link almıyor.');
    }

    if (page.indexable && page.classification === 'single') {
      add(recommendations, 'SINGLE_INCOMING_LINK', 'recommendation', page.url,
        'Sayfa yalnız bir indexlenebilir sayfadan internal link alıyor.', { incomingLinks: page.incomingLinks });
    } else if (page.indexable && page.classification === 'low') {
      add(recommendations, 'LOW_INCOMING_LINKS', 'recommendation', page.url,
        'Sayfanın incoming internal link sayısı düşük.', { incomingLinks: page.incomingLinks });
    }
    if (page.indexable && (page.schemaTypes || []).length === 0) {
      add(recommendations, 'MISSING_STRUCTURED_DATA', 'recommendation', page.url,
        'Sayfada structured data bulunamadı.');
    }
    if (page.indexable && (page.links || []).length < 2) {
      add(recommendations, 'LOW_OUTGOING_INTERNAL_LINKS', 'recommendation', page.url,
        'Sayfada çok az crawl edilebilir outgoing internal link bulunuyor.', { internalLinks: (page.links || []).length });
    }
  }

  for (const link of crawl.brokenInternalLinks || []) {
    add(warnings, 'BROKEN_INTERNAL_LINK', 'warning', link.sourceUrl,
      'Internal link hata döndüren bir hedefe gidiyor.', { targetUrl: link.targetUrl, status: link.status });
  }
  for (const link of crawl.redirectingInternalLinks || []) {
    add(warnings, 'REDIRECTING_INTERNAL_LINK', 'warning', link.sourceUrl,
      'Internal link redirect olan bir hedefe gidiyor.', {
        targetUrl: link.targetUrl,
        status: link.status,
        location: link.location || null,
      });
  }

  const safeSiteChecks = publicSiteChecks(siteChecks);
  if (safeSiteChecks.robots.status !== 200) {
    add(warnings, 'ROBOTS_UNAVAILABLE', 'warning', new URL('/robots.txt', crawl.baseUrl).toString(),
      'robots.txt HTTP 200 döndürmüyor.', { status: safeSiteChecks.robots.status });
  } else {
    if (!safeSiteChecks.robots.declaresSitemap) {
      add(warnings, 'SITEMAP_NOT_DECLARED_IN_ROBOTS', 'warning', new URL('/robots.txt', crawl.baseUrl).toString(),
        'robots.txt audit edilen sitemap URL’sini bildirmiyor.');
    }
    if (safeSiteChecks.robots.blocksRoot || safeSiteChecks.robots.blocksSitemap) {
      add(criticalErrors, 'CRAWL_BLOCKED_BY_ROBOTS', 'critical', new URL('/robots.txt', crawl.baseUrl).toString(),
        'robots.txt ana içeriği veya sitemap yolunu engelliyor.', {
          blocksRoot: safeSiteChecks.robots.blocksRoot,
          blocksSitemap: safeSiteChecks.robots.blocksSitemap,
        });
    }
  }
  if (safeSiteChecks.indexNowKeyStatus !== 200) {
    add(warnings, 'INDEXNOW_KEY_UNAVAILABLE', 'warning', new URL('/indexnow-key.txt', crawl.baseUrl).toString(),
      'IndexNow key endpoint HTTP 200 döndürmüyor.', { status: safeSiteChecks.indexNowKeyStatus });
  }

  sortFindings(criticalErrors);
  sortFindings(warnings);
  sortFindings(recommendations);
  const pages = crawl.pages.map(publicPageDiagnostics).sort((a, b) => a.url.localeCompare(b.url));

  return {
    generatedAt: crawl.generatedAt,
    baseUrl: crawl.baseUrl,
    sitemapUrl: crawl.sitemapUrl,
    strict: Boolean(strict),
    summary: {
      auditedUrls: pages.length,
      indexableUrls: pages.filter((page) => page.indexable).length,
      criticalErrors: criticalErrors.length,
      warnings: warnings.length,
      recommendations: recommendations.length,
    },
    siteChecks: safeSiteChecks,
    pages,
    findings: {
      criticalErrors,
      warnings,
      recommendations,
    },
  };
}

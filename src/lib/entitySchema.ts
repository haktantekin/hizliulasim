import type { BlogCategory, BlogPost } from '../types/WordPress';

export type JsonLdObject = Record<string, unknown>;

const DEFAULT_SITE_URL = 'https://hizliulasim.com';

const PLACE_TYPES_BY_CATEGORY: Record<string, string | string[]> = {
  askeriye: 'Place',
  avmler: 'ShoppingCenter',
  camiler: 'Mosque',
  'eglence-merkezleri': 'CivicStructure',
  'etkinlik-dugun-balo-salonlari': 'EventVenue',
  goller: 'LakeBodyOfWater',
  hastaneler: 'Hospital',
  havalimanlari: 'Airport',
  ilceler: 'AdministrativeArea',
  konaklama: 'LodgingBusiness',
  korular: 'Park',
  kutuphaneler: 'Library',
  mekanlar: 'Place',
  muzeler: ['Museum', 'TouristAttraction'],
  okullar: 'School',
  otogarlar: 'BusStation',
  parklar: 'Park',
  plajlar: 'Beach',
  'resmi-daireler': 'GovernmentBuilding',
  'sinema-tiyatrolar': 'CivicStructure',
  'sosyal-tesisler': 'CivicStructure',
  turbeler: 'LandmarksOrHistoricalBuildings',
  'turistik-yerler': 'TouristAttraction',
  'ulasim-yapilari': 'TransitStation',
  universiteler: 'CollegeOrUniversity',
};

function normalizeSiteUrl(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, '');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(x?)([0-9a-f]+);/gi, (match, hex: string, code: string) => {
      const parsed = Number.parseInt(code, hex ? 16 : 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#039;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTableValue(content: string, label: string): string | undefined {
  const pattern = new RegExp(
    `<t[dh][^>]*>\\s*${escapeRegExp(label)}\\s*</t[dh]>\\s*<t[dh][^>]*>([\\s\\S]*?)</t[dh]>`,
    'iu',
  );
  const match = content.match(pattern);
  const value = match?.[1] ? stripHtml(match[1]) : '';
  return value || undefined;
}

function extractPlaceName(title: string): string {
  return title
    .replace(/\s*(?:['’](?:a|e|ya|ye|na|ne))?\s*(?:nasıl gidilir\??|yol tarifi)\s*$/iu, '')
    .trim() || title;
}

function extractAddress(post: BlogPost): JsonLdObject | undefined {
  const streetAddress = extractTableValue(post.content, 'Açık adres');
  const addressLocality = extractTableValue(post.content, 'Bulunduğu ilçe');
  const postalCode = extractTableValue(post.content, 'Posta kodu');

  if (!streetAddress && !addressLocality && !postalCode) return undefined;

  const regionMatch = streetAddress?.match(/\/\s*([^,/]+)\s*$/u);
  const regionCandidate = regionMatch?.[1]?.trim();
  const addressRegion = regionCandidate && regionCandidate.length >= 3
    ? regionCandidate
    : undefined;

  return {
    '@type': 'PostalAddress',
    streetAddress,
    addressLocality,
    addressRegion,
    postalCode,
    addressCountry: 'TR',
  };
}

function isJsonLdObject(value: unknown): value is JsonLdObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getCustomPlaceSchema(schema: BlogPost['schema']): JsonLdObject | undefined {
  if (!isJsonLdObject(schema)) return undefined;

  if (isJsonLdObject(schema.about)) return schema.about;

  const schemaType = schema['@type'];
  const nonPlaceTypes = new Set(['Article', 'BlogPosting', 'NewsArticle', 'FAQPage', 'BreadcrumbList']);
  if (typeof schemaType === 'string' && !nonPlaceTypes.has(schemaType)) return schema;
  if (Array.isArray(schemaType)) return schema;

  return undefined;
}

export function buildSiteEntitySchema(siteUrl = DEFAULT_SITE_URL): JsonLdObject {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const organizationId = `${normalizedSiteUrl}/#organization`;
  const websiteId = `${normalizedSiteUrl}/#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'Hızlı Ulaşım',
        url: normalizedSiteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${normalizedSiteUrl}/android-chrome-512x512.png`,
          width: 512,
          height: 512,
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: normalizedSiteUrl,
        name: 'Hızlı Ulaşım',
        alternateName: 'Hizli Ulasim',
        inLanguage: 'tr-TR',
        publisher: { '@id': organizationId },
      },
    ],
  };
}

export function buildPlaceEntity(
  post: BlogPost,
  category: BlogCategory | null,
  canonicalUrl: string,
): JsonLdObject | undefined {
  const customPlace = getCustomPlaceSchema(post.schema);
  const mappedType = category ? PLACE_TYPES_BY_CATEGORY[category.slug] : undefined;

  if (!mappedType && !post.location && !customPlace) return undefined;

  const customAddress = isJsonLdObject(customPlace?.address) ? customPlace.address : undefined;
  const generatedAddress = extractAddress(post);

  return {
    '@type': mappedType || 'Place',
    '@id': `${canonicalUrl}#place`,
    name: extractPlaceName(post.title),
    ...(post.location && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: post.location.latitude,
        longitude: post.location.longitude,
      },
    }),
    ...(generatedAddress && { address: generatedAddress }),
    ...customPlace,
    ...(customAddress && { address: { ...generatedAddress, ...customAddress } }),
  };
}

export function buildArticleEntitySchema({
  post,
  category,
  mainCategory,
  canonicalUrl,
  siteUrl = DEFAULT_SITE_URL,
}: {
  post: BlogPost;
  category: BlogCategory | null;
  mainCategory?: BlogCategory | null;
  canonicalUrl: string;
  siteUrl?: string;
}): JsonLdObject {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const place = buildPlaceEntity(post, category, canonicalUrl);
  const articleId = `${canonicalUrl}#article`;
  const webPageId = `${canonicalUrl}#webpage`;
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const description = post.excerpt || post.title;
  const categories = [mainCategory, category].filter(
    (item, index, items): item is BlogCategory =>
      Boolean(item) && items.findIndex((candidate) => candidate?.id === item?.id) === index,
  );
  const breadcrumbItems: JsonLdObject[] = [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: normalizedSiteUrl },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Kategoriler',
      item: `${normalizedSiteUrl}/kategoriler`,
    },
  ];

  for (const item of categories) {
    const parent = mainCategory && item.id !== mainCategory.id ? mainCategory : null;
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: breadcrumbItems.length + 1,
      name: item.name,
      item: parent
        ? `${normalizedSiteUrl}/${parent.slug}/${item.slug}`
        : `${normalizedSiteUrl}/${item.slug}`,
    });
  }

  breadcrumbItems.push({
    '@type': 'ListItem',
    position: breadcrumbItems.length + 1,
    name: post.title,
    item: canonicalUrl,
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': articleId,
        url: canonicalUrl,
        headline: post.title,
        description,
        datePublished: post.publishedAt,
        dateModified: post.modifiedAt || post.publishedAt,
        inLanguage: 'tr-TR',
        author: post.author?.name
          ? { '@type': 'Person', name: post.author.name }
          : { '@id': `${normalizedSiteUrl}/#organization` },
        publisher: {
          '@type': 'Organization',
          '@id': `${normalizedSiteUrl}/#organization`,
          name: 'Hızlı Ulaşım',
          url: normalizedSiteUrl,
          logo: {
            '@type': 'ImageObject',
            url: `${normalizedSiteUrl}/android-chrome-512x512.png`,
            width: 512,
            height: 512,
          },
        },
        image: post.featuredImage?.url,
        mainEntityOfPage: { '@id': webPageId },
        about: place,
      },
      {
        '@type': 'WebPage',
        '@id': webPageId,
        url: canonicalUrl,
        name: post.title,
        description,
        datePublished: post.publishedAt,
        dateModified: post.modifiedAt || post.publishedAt,
        inLanguage: 'tr-TR',
        isPartOf: { '@id': `${normalizedSiteUrl}/#website` },
        mainEntity: { '@id': articleId },
        breadcrumb: { '@id': breadcrumbId },
        ...(post.featuredImage?.url && {
          primaryImageOfPage: {
            '@type': 'ImageObject',
            url: post.featuredImage.url,
          },
        }),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': breadcrumbId,
        itemListElement: breadcrumbItems,
      },
    ],
  };
}

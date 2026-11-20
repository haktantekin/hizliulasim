import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';

const MAX_BODY_LENGTH = 12_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const CONTACT_COOLDOWN_SECONDS = 5 * 60;
const CONTACT_COOKIE = 'hu_contact_sent';

const ALLOWED_SUBJECTS = new Set([
  'Genel Bilgi',
  'Öneri',
  'Hata Bildirimi',
  'İş Birliği',
  'Reklam',
  'Diğer',
]);

interface ContactConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  contactTo: string;
  siteUrl: string;
  requireOrigin: boolean;
}

interface ContactMail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}

interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface ContactDependencies {
  config?: ContactConfig;
  sendMail?: (mail: ContactMail) => Promise<unknown>;
  takeRateLimit?: (key: string, now: number) => RateLimitDecision;
  now?: () => number;
  getClientKey?: (request: Request) => string;
}

interface ContactBody {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
}

type RateLimitBucket = { timestamps: number[] };

const globalRateLimits = globalThis as typeof globalThis & {
  __huContactRateLimits?: Map<string, RateLimitBucket>;
};

const rateLimitBuckets = globalRateLimits.__huContactRateLimits
  ?? new Map<string, RateLimitBucket>();
globalRateLimits.__huContactRateLimits = rateLimitBuckets;

function getConfig(): ContactConfig {
  return {
    smtpHost: process.env.SMTP_HOST?.trim() || 'mail.haktantekin.com',
    smtpPort: Number(process.env.SMTP_PORT || '465'),
    smtpUser: process.env.SMTP_USER?.trim() || 'info@haktantekin.com',
    smtpPass: process.env.SMTP_PASS || '',
    contactTo: process.env.CONTACT_TO?.trim() || 'webhaktan@gmail.com',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://hizliulasim.com',
    requireOrigin: process.env.NODE_ENV === 'production',
  };
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      ...headers,
    },
  });
}

function isValidConfig(config: ContactConfig): boolean {
  return Boolean(
    config.smtpHost
    && Number.isInteger(config.smtpPort)
    && config.smtpPort > 0
    && config.smtpPort <= 65_535
    && config.smtpUser
    && config.smtpPass
    && config.contactTo,
  );
}

function isAllowedOrigin(request: Request, config: ContactConfig): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return !config.requireOrigin;

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;

  try {
    const requestOrigin = new URL(request.url).origin;
    const configuredOrigin = new URL(config.siteUrl).origin;
    return origin === requestOrigin || origin === configuredOrigin;
  } catch {
    return false;
  }
}

function getCookie(request: Request, name: string): string {
  const cookieHeader = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) || '';
}

function getDefaultClientKey(request: Request): string {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown';
  const address = forwarded.split(',', 1)[0].trim().slice(0, 128);
  return createHash('sha256').update(address || 'unknown').digest('base64url');
}

function takeDefaultRateLimit(key: string, now: number): RateLimitDecision {
  if (rateLimitBuckets.size > 5_000) {
    for (const [bucketKey, bucket] of rateLimitBuckets) {
      if (!bucket.timestamps.some((timestamp) => timestamp > now - RATE_LIMIT_WINDOW_MS)) {
        rateLimitBuckets.delete(bucketKey);
      }
    }
  }

  if (!rateLimitBuckets.has(key) && rateLimitBuckets.size >= 5_000) {
    const oldestKey = rateLimitBuckets.keys().next().value;
    if (typeof oldestKey === 'string') rateLimitBuckets.delete(oldestKey);
  }

  const bucket = rateLimitBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter(
    (timestamp) => timestamp > now - RATE_LIMIT_WINDOW_MS,
  );

  if (bucket.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAt = bucket.timestamps[0] + RATE_LIMIT_WINDOW_MS;
    rateLimitBuckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  rateLimitBuckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}

async function readContactBody(request: Request): Promise<ContactBody> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error('invalid content type');
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_LENGTH) {
    throw new Error('oversized body');
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_LENGTH) throw new Error('oversized body');

  const body: unknown = JSON.parse(rawBody);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('invalid body');
  }

  const candidate = body as Record<string, unknown>;
  for (const field of ['name', 'email', 'subject', 'message'] as const) {
    if (typeof candidate[field] !== 'string') throw new Error('invalid field');
  }
  if (candidate.website !== undefined && typeof candidate.website !== 'string') {
    throw new Error('invalid honeypot');
  }

  return {
    name: (candidate.name as string).trim(),
    email: (candidate.email as string).trim(),
    subject: (candidate.subject as string).trim(),
    message: (candidate.message as string).trim(),
    website: typeof candidate.website === 'string' ? candidate.website.trim() : '',
  };
}

function validationMessage(body: ContactBody): string | null {
  if (body.name.length < 2 || body.email.length < 5 || !body.subject || body.message.length < 10) {
    return 'Lütfen tüm alanları eksiksiz doldurun';
  }
  if (/\r|\n/u.test(body.name) || body.name.length > 100) {
    return 'Ad soyad alanı geçersiz';
  }
  if (body.email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(body.email)) {
    return 'Geçerli bir e-posta adresi girin';
  }
  if (!ALLOWED_SUBJECTS.has(body.subject)) {
    return 'Geçerli bir konu seçin';
  }
  if (body.message.length > 5_000) {
    return 'Mesaj 5000 karakterden uzun olamaz';
  }
  return null;
}

function tooManyRequests(retryAfterSeconds: number) {
  return json({
    message: `Yeni bir mesaj göndermek için ${Math.ceil(retryAfterSeconds / 60)} dakika bekleyin.`,
    retryAfterSeconds,
  }, 429, { 'Retry-After': String(retryAfterSeconds) });
}

function cooldownCookie(): string {
  const parts = [
    `${CONTACT_COOKIE}=1`,
    'Path=/api/contact',
    `Max-Age=${CONTACT_COOLDOWN_SECONDS}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function createContactPost(dependencies: ContactDependencies = {}) {
  const config = dependencies.config ?? getConfig();
  const now = dependencies.now ?? Date.now;
  const takeRateLimit = dependencies.takeRateLimit ?? takeDefaultRateLimit;
  const getClientKey = dependencies.getClientKey ?? getDefaultClientKey;
  let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;
  const sendMail = dependencies.sendMail ?? (async (mail: ContactMail) => {
    transporter ??= nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
    return transporter.sendMail(mail);
  });

  return async function post(request: Request) {
    if (!isValidConfig(config)) {
      return json({ message: 'İletişim formu şu anda kullanılamıyor' }, 503);
    }

    if (!isAllowedOrigin(request, config)) {
      return json({ message: 'Geçersiz gönderim isteği' }, 403);
    }

    let body: ContactBody;
    try {
      body = await readContactBody(request);
    } catch {
      return json({ message: 'Form verileri geçersiz' }, 400);
    }

    // Bots commonly fill this visually hidden field. Return a normal-looking response
    // without sending mail so the trap is not advertised to automated clients.
    if (body.website) {
      return json({
        message: 'Mesajınız başarıyla gönderildi',
        retryAfterSeconds: CONTACT_COOLDOWN_SECONDS,
      });
    }

    const invalidMessage = validationMessage(body);
    if (invalidMessage) return json({ message: invalidMessage }, 400);

    if (getCookie(request, CONTACT_COOKIE)) {
      return tooManyRequests(CONTACT_COOLDOWN_SECONDS);
    }

    const rateLimit = takeRateLimit(getClientKey(request), now());
    if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfterSeconds);

    try {
      await sendMail({
        from: `"Hızlı Ulaşım İletişim" <${config.smtpUser}>`,
        to: config.contactTo,
        replyTo: `"${body.name}" <${body.email}>`,
        subject: `[Hızlı Ulaşım İletişim] ${body.subject}`,
        text: `Ad Soyad: ${body.name}\nE-posta: ${body.email}\nKonu: ${body.subject}\n\nMesaj:\n${body.message}`,
      });
    } catch (error) {
      console.error('Contact form error:', error);
      return json({ message: 'E-posta gönderilemedi' }, 502);
    }

    return json({
      message: 'Mesajınız başarıyla gönderildi',
      retryAfterSeconds: CONTACT_COOLDOWN_SECONDS,
    }, 200, { 'Set-Cookie': cooldownCookie() });
  };
}


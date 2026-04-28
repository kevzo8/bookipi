function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTimestamp(value: string | undefined): number | null {
  if (!value) return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DEFAULT_PRODUCT_ID = 'limited-edition-product';
const DEFAULT_STOCK = 100;
const DEFAULT_DURATION_MS = 60 * 60 * 1000;
const DEFAULT_START_OFFSET_MINUTES = -5;
const DEFAULT_PURCHASE_RATE_LIMIT = 10;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;

const configuredStart = parseTimestamp(process.env.FLASH_SALE_START);
const configuredEnd = parseTimestamp(process.env.FLASH_SALE_END);
const configuredDurationMs = parseNumber(
  process.env.FLASH_SALE_DURATION_MS,
  DEFAULT_DURATION_MS,
);

const fallbackStart = Date.now() +
  parseNumber(
    process.env.FLASH_SALE_START_OFFSET_MINUTES,
    DEFAULT_START_OFFSET_MINUTES,
  ) *
    60 *
    1000;

const saleStart = configuredStart ?? fallbackStart;
const saleEnd = configuredEnd ?? saleStart + configuredDurationMs;

export const config = {
  api: {
    port: parseNumber(process.env.PORT, 3000),
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: process.env.CORS_ORIGIN || true,
    apiKey: process.env.API_KEY || '',
  },
  sale: {
    productId: process.env.PRODUCT_ID || DEFAULT_PRODUCT_ID,
    initialStock: parseNumber(process.env.INITIAL_STOCK, DEFAULT_STOCK),
    saleStart,
    saleEnd,
  },
  protection: {
    purchaseRateLimit: parseNumber(
      process.env.PURCHASE_RATE_LIMIT,
      DEFAULT_PURCHASE_RATE_LIMIT,
    ),
    rateLimitWindowSeconds: parseNumber(
      process.env.RATE_LIMIT_WINDOW_SECONDS,
      DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    ),
  },
};

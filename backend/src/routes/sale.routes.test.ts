import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { saleRoutes } from './sale.routes.js';
import * as purchaseService from '../services/purchase.service.js';
import * as redisUtils from '../utils/redis.js';

vi.mock('../services/purchase.service.js', () => ({
  processPurchase: vi.fn(),
  getSaleStatusResponse: vi.fn(),
  checkUserPurchaseStatus: vi.fn(),
}));

vi.mock('../utils/redis.js', () => ({
  consumeRateLimit: vi.fn(),
}));

const mockProcessPurchase = vi.mocked(purchaseService.processPurchase);
const mockGetSaleStatusResponse = vi.mocked(purchaseService.getSaleStatusResponse);
const mockCheckUserPurchaseStatus = vi.mocked(purchaseService.checkUserPurchaseStatus);
const mockConsumeRateLimit = vi.mocked(redisUtils.consumeRateLimit);

describe('Sale Routes Integration', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsumeRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 5,
      retryAfterSeconds: 60,
    });

    app = Fastify();
    await app.register(saleRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns sale status payload', async () => {
    mockGetSaleStatusResponse.mockResolvedValue({
      status: 'active',
      remainingStock: 42,
      message: '42 items remaining',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sale-status',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'active',
      remainingStock: 42,
      message: '42 items remaining',
    });
  });

  it('rejects purchase when userId is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('userId is required');
  });

  it('rejects purchase when rate limit exceeded', async () => {
    mockConsumeRateLimit.mockResolvedValue({
      allowed: false,
      remaining: -1,
      retryAfterSeconds: 30,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: {
        userId: 'u1',
      },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('30');
    expect(response.json().message).toContain('Too many');
  });

  it('accepts purchase request and returns service response', async () => {
    mockProcessPurchase.mockResolvedValue({
      success: true,
      message: 'Purchase successful!',
      timestamp: 123,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/purchase',
      payload: {
        userId: 'user-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockProcessPurchase).toHaveBeenCalledTimes(1);
    expect(response.json()).toEqual({
      success: true,
      message: 'Purchase successful!',
      timestamp: 123,
    });
  });

  it('returns purchase status for a user', async () => {
    mockCheckUserPurchaseStatus.mockResolvedValue({
      hasPurchased: true,
      userId: 'user-1',
      productId: 'limited-edition-product',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/purchase-status?userId=user-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      hasPurchased: true,
      userId: 'user-1',
      productId: 'limited-edition-product',
    });
  });

  it('requires userId query param for purchase status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/purchase-status',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('userId query parameter is required');
  });

  it('returns healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });
});

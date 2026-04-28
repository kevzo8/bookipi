import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  processPurchase,
  getSaleStatusResponse,
  checkUserPurchaseStatus,
} from './purchase.service.js';
import * as redisUtils from '../utils/redis.js';

// Mock Redis utilities
vi.mock('../utils/redis.js', () => ({
  atomicPurchase: vi.fn(),
  getSaleStatus: vi.fn(),
  getUserPurchaseStatus: vi.fn(),
  getStock: vi.fn(),
}));

const mockAtomicPurchase = vi.mocked(redisUtils.atomicPurchase);
const mockGetSaleStatus = vi.mocked(redisUtils.getSaleStatus);
const mockGetUserPurchaseStatus = vi.mocked(redisUtils.getUserPurchaseStatus);
const mockGetStock = vi.mocked(redisUtils.getStock);

describe('Purchase Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processPurchase', () => {
    const now = Date.now();
    const saleStart = now - 60000; // Started 1 minute ago
    const saleEnd = now + 3600000; // Ends in 1 hour

    it('should successfully process a purchase', async () => {
      mockAtomicPurchase.mockResolvedValue({
        success: true,
        message: 'SUCCESS',
      });

      const result = await processPurchase(
        { userId: 'user1', productId: 'product1' },
        saleStart,
        saleEnd,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Purchase successful!');
    });

    it('should reject duplicate purchase', async () => {
      mockAtomicPurchase.mockResolvedValue({
        success: false,
        message: 'ALREADY_PURCHASED',
      });

      const result = await processPurchase(
        { userId: 'user1', productId: 'product1' },
        saleStart,
        saleEnd,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('You have already purchased this item');
    });

    it('should handle sold out scenario', async () => {
      mockAtomicPurchase.mockResolvedValue({
        success: false,
        message: 'SOLD_OUT',
      });

      const result = await processPurchase(
        { userId: 'user2', productId: 'product1' },
        saleStart,
        saleEnd,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Item sold out');
    });

    it('should reject purchase before sale starts', async () => {
      const futureStart = now + 3600000;
      const futureEnd = futureStart + 3600000;

      const result = await processPurchase(
        { userId: 'user1', productId: 'product1' },
        futureStart,
        futureEnd,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Sale has not started yet');
    });

    it('should reject purchase after sale ends', async () => {
      const pastStart = now - 7200000;
      const pastEnd = now - 3600000;

      const result = await processPurchase(
        { userId: 'user1', productId: 'product1' },
        pastStart,
        pastEnd,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Sale has ended');
    });

    it('should validate required fields', async () => {
      const result = await processPurchase(
        { userId: '', productId: 'product1' },
        saleStart,
        saleEnd,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing');
    });
  });

  describe('getSaleStatusResponse', () => {
    it('should return upcoming status', async () => {
      const now = Date.now();
      const futureStart = now + 3600000;
      const futureEnd = futureStart + 3600000;

      mockGetSaleStatus.mockResolvedValue('upcoming');
      mockGetStock.mockResolvedValue(100);

      const result = await getSaleStatusResponse(
        'product1',
        futureStart,
        futureEnd,
      );

      expect(result.status).toBe('upcoming');
      expect(result.remainingStock).toBe(100);
    });

    it('should return active status', async () => {
      const now = Date.now();
      const start = now - 60000;
      const end = now + 3600000;

      mockGetSaleStatus.mockResolvedValue('active');
      mockGetStock.mockResolvedValue(50);

      const result = await getSaleStatusResponse('product1', start, end);

      expect(result.status).toBe('active');
      expect(result.remainingStock).toBe(50);
    });

    it('should return sold out status', async () => {
      const now = Date.now();
      const start = now - 60000;
      const end = now + 3600000;

      mockGetSaleStatus.mockResolvedValue('sold_out');
      mockGetStock.mockResolvedValue(0);

      const result = await getSaleStatusResponse('product1', start, end);

      expect(result.status).toBe('sold_out');
      expect(result.remainingStock).toBe(0);
    });

    it('should return ended status', async () => {
      const now = Date.now();
      const start = now - 7200000;
      const end = now - 3600000;

      mockGetSaleStatus.mockResolvedValue('ended');
      mockGetStock.mockResolvedValue(25);

      const result = await getSaleStatusResponse('product1', start, end);

      expect(result.status).toBe('ended');
    });
  });

  describe('checkUserPurchaseStatus', () => {
    it('should return true for user who purchased', async () => {
      mockGetUserPurchaseStatus.mockResolvedValue(true);

      const result = await checkUserPurchaseStatus('product1', 'user1');

      expect(result.hasPurchased).toBe(true);
      expect(result.userId).toBe('user1');
      expect(result.productId).toBe('product1');
    });

    it('should return false for user who did not purchase', async () => {
      mockGetUserPurchaseStatus.mockResolvedValue(false);

      const result = await checkUserPurchaseStatus('product1', 'user2');

      expect(result.hasPurchased).toBe(false);
    });
  });
});

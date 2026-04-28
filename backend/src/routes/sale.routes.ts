import { FastifyInstance } from 'fastify';
import {
  processPurchase,
  getSaleStatusResponse,
  checkUserPurchaseStatus,
  PurchaseRequest,
} from '../services/purchase.service.js';
import { config } from '../config.js';
import { consumeRateLimit } from '../utils/redis.js';

export const PRODUCT_ID = config.sale.productId;
export const INITIAL_STOCK = config.sale.initialStock;
const SALE_START = config.sale.saleStart;
const SALE_END = config.sale.saleEnd;

export async function saleRoutes(fastify: FastifyInstance) {
  // GET /sale-status
  fastify.get('/sale-status', async (request, reply) => {
    const saleStatus = await getSaleStatusResponse(
      PRODUCT_ID,
      SALE_START,
      SALE_END,
    );
    return saleStatus;
  });

  // POST /purchase
  fastify.post<{ Body: PurchaseRequest }>('/purchase', async (request, reply) => {
    const { userId, productId } = request.body;

    if (config.api.apiKey) {
      const requestApiKey = request.headers['x-api-key'];
      if (requestApiKey !== config.api.apiKey) {
        return reply.status(401).send({
          success: false,
          message: 'Unauthorized',
          timestamp: Date.now(),
        });
      }
    }

    if (!userId) {
      return reply.status(400).send({
        success: false,
        message: 'userId is required',
        timestamp: Date.now(),
      });
    }

    const rateLimitKey = `rate_limit:purchase:${userId || request.ip}`;
    const limitResult = await consumeRateLimit(
      rateLimitKey,
      config.protection.purchaseRateLimit,
      config.protection.rateLimitWindowSeconds,
    );

    if (!limitResult.allowed) {
      reply.header('Retry-After', String(limitResult.retryAfterSeconds));
      return reply.status(429).send({
        success: false,
        message: 'Too many purchase attempts. Please retry later.',
        timestamp: Date.now(),
      });
    }

    const purchaseRequest: PurchaseRequest = {
      userId,
      productId: productId || PRODUCT_ID,
    };

    const result = await processPurchase(
      purchaseRequest,
      SALE_START,
      SALE_END,
    );

    const statusCode = result.success ? 200 : 400;
    return reply.status(statusCode).send(result);
  });

  // GET /purchase-status
  fastify.get<{ Querystring: { userId?: string } }>(
    '/purchase-status',
    async (request, reply) => {
      const { userId } = request.query;

      if (!userId) {
        return reply.status(400).send({
          success: false,
          message: 'userId query parameter is required',
        });
      }

      const userStatus = await checkUserPurchaseStatus(
        PRODUCT_ID,
        userId,
      );

      return userStatus;
    },
  );

  // GET /health
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: Date.now() };
  });
}

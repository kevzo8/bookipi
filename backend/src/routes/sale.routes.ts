import { FastifyInstance } from 'fastify';
import {
  processPurchase,
  getSaleStatusResponse,
  checkUserPurchaseStatus,
  PurchaseRequest,
} from '../services/purchase.service.js';

export const PRODUCT_ID = 'limited-edition-product';
export const INITIAL_STOCK = 100;

// Sale window: 1 hour from now for testing
const SALE_START = Date.now() - 5 * 60 * 1000; // Started 5 minutes ago
const SALE_END = SALE_START + 60 * 60 * 1000; // 1 hour duration

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

    if (!userId) {
      return reply.status(400).send({
        success: false,
        message: 'userId is required',
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

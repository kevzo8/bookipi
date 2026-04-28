import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connectRedis, disconnectRedis, initializeStock } from './utils/redis.js';
import { saleRoutes, PRODUCT_ID, INITIAL_STOCK } from './routes/sale.routes.js';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
  });

  // Connect to Redis
  try {
    await connectRedis();
    console.log('[Server] Redis connected successfully');

    // Initialize stock
    await initializeStock(PRODUCT_ID, INITIAL_STOCK);
    console.log(`[Server] Stock initialized: ${INITIAL_STOCK} items`);
  } catch (error) {
    console.error('[Server] Failed to connect to Redis:', error);
    process.exit(1);
  }

  // Register routes
  await fastify.register(saleRoutes, { prefix: '/api' });

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`[Server] Running on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
    try {
      await fastify.close();
      await disconnectRedis();
      console.log('[Server] Closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('[Server] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});

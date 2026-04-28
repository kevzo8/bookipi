import { createClient } from 'redis';

const client = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

client.on('error', (err) => {
  console.error('[Redis Error]', err);
});

client.on('connect', () => {
  console.log('[Redis Connected]');
});

export async function connectRedis() {
  await client.connect();
}

export async function disconnectRedis() {
  await client.quit();
}

export function getRedisClient() {
  return client;
}

/**
 * Atomic purchase operation using Redis Lua script
 * Prevents race conditions and overselling
 */
export async function atomicPurchase(
  productId: string,
  userId: string,
  maxStock: number,
) {
  const script = `
    local productKey = KEYS[1]
    local userSetKey = KEYS[2]
    local userId = ARGV[1]
    
    -- Check if user already purchased
    if redis.call('SISMEMBER', userSetKey, userId) == 1 then
      return {0, "ALREADY_PURCHASED"}
    end
    
    -- Get current stock
    local stock = redis.call('GET', productKey)
    if not stock then
      stock = 0
    else
      stock = tonumber(stock)
    end
    
    -- Check if stock available
    if stock <= 0 then
      return {0, "SOLD_OUT"}
    end
    
    -- Atomically decrement stock and add user to purchased set
    redis.call('DECR', productKey)
    redis.call('SADD', userSetKey, userId)
    
    return {1, "SUCCESS"}
  `;

  try {
    const result = await client.eval(script, {
      keys: [`stock:${productId}`, `purchased_users:${productId}`],
      arguments: [userId],
    });

    const [success, message] = result as [number, string];
    return {
      success: success === 1,
      message: message as 'SUCCESS' | 'ALREADY_PURCHASED' | 'SOLD_OUT',
    };
  } catch (error) {
    console.error('[Redis Script Error]', error);
    throw error;
  }
}

export async function getSaleStatus(
  saleStartTime: number,
  saleEndTime: number,
  productId: string,
) {
  const now = Date.now();
  const stock = await client.get(`stock:${productId}`);
  const currentStock = stock ? parseInt(stock) : 0;

  if (now < saleStartTime) {
    return 'upcoming';
  } else if (now > saleEndTime) {
    return 'ended';
  } else if (currentStock <= 0) {
    return 'sold_out';
  } else {
    return 'active';
  }
}

export async function getUserPurchaseStatus(
  productId: string,
  userId: string,
) {
  const isPurchased = await client.sIsMember(
    `purchased_users:${productId}`,
    userId,
  );
  return isPurchased;
}

export async function initializeStock(
  productId: string,
  quantity: number,
) {
  await client.set(`stock:${productId}`, quantity.toString());
  await client.del(`purchased_users:${productId}`);
}

export async function getStock(productId: string) {
  const stock = await client.get(`stock:${productId}`);
  return stock ? parseInt(stock) : 0;
}

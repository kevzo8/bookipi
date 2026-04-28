import { createClient } from 'redis';

const USE_IN_MEMORY_REDIS = process.env.USE_IN_MEMORY_REDIS === 'true';

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

const memoryStock = new Map<string, number>();
const memoryPurchasedUsers = new Map<string, Set<string>>();
const memoryRateLimit = new Map<string, { count: number; expiresAt: number }>();

client.on('error', (err) => {
  console.error('[Redis Error]', err);
});

client.on('connect', () => {
  console.log('[Redis Connected]');
});

export async function connectRedis() {
  if (USE_IN_MEMORY_REDIS) {
    console.log('[Redis] Running in in-memory fallback mode');
    return;
  }

  await client.connect();
}

export async function disconnectRedis() {
  if (USE_IN_MEMORY_REDIS) {
    return;
  }

  await client.quit();
}

/**
 * Atomic purchase operation using Redis Lua script
 * Prevents race conditions and overselling
 */
export async function atomicPurchase(
  productId: string,
  userId: string,
) {
  if (USE_IN_MEMORY_REDIS) {
    const productKey = `stock:${productId}`;
    const userKey = `purchased_users:${productId}`;
    const users = memoryPurchasedUsers.get(userKey) || new Set<string>();
    const stock = memoryStock.get(productKey) || 0;

    if (users.has(userId)) {
      return {
        success: false,
        message: 'ALREADY_PURCHASED' as const,
      };
    }

    if (stock <= 0) {
      return {
        success: false,
        message: 'SOLD_OUT' as const,
      };
    }

    memoryStock.set(productKey, stock - 1);
    users.add(userId);
    memoryPurchasedUsers.set(userKey, users);

    return {
      success: true,
      message: 'SUCCESS' as const,
    };
  }

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
  let currentStock = 0;

  if (USE_IN_MEMORY_REDIS) {
    currentStock = memoryStock.get(`stock:${productId}`) || 0;
  } else {
    const stock = await client.get(`stock:${productId}`);
    currentStock = stock ? parseInt(stock) : 0;
  }

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
  if (USE_IN_MEMORY_REDIS) {
    const users = memoryPurchasedUsers.get(`purchased_users:${productId}`);
    return users ? users.has(userId) : false;
  }

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
  if (USE_IN_MEMORY_REDIS) {
    memoryStock.set(`stock:${productId}`, quantity);
    memoryPurchasedUsers.set(`purchased_users:${productId}`, new Set());
    return;
  }

  await client.set(`stock:${productId}`, quantity.toString());
  await client.del(`purchased_users:${productId}`);
}

export async function getStock(productId: string) {
  if (USE_IN_MEMORY_REDIS) {
    return memoryStock.get(`stock:${productId}`) || 0;
  }

  const stock = await client.get(`stock:${productId}`);
  return stock ? parseInt(stock) : 0;
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  if (USE_IN_MEMORY_REDIS) {
    const now = Date.now();
    const existing = memoryRateLimit.get(key);
    const expiresAt = now + windowSeconds * 1000;

    if (!existing || existing.expiresAt <= now) {
      memoryRateLimit.set(key, { count: 1, expiresAt });
      return {
        allowed: true,
        remaining: limit - 1,
        retryAfterSeconds: windowSeconds,
      };
    }

    const nextCount = existing.count + 1;
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((existing.expiresAt - now) / 1000),
    );
    memoryRateLimit.set(key, {
      count: nextCount,
      expiresAt: existing.expiresAt,
    });

    return {
      allowed: nextCount <= limit,
      remaining: limit - nextCount,
      retryAfterSeconds,
    };
  }

  const script = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])

    local current = redis.call('INCR', key)
    if current == 1 then
      redis.call('EXPIRE', key, window)
    end

    local ttl = redis.call('TTL', key)
    local remaining = limit - current

    if current > limit then
      return {0, remaining, ttl}
    end

    return {1, remaining, ttl}
  `;

  const [allowed, remaining, retryAfterSeconds] = await client.eval(script, {
    keys: [key],
    arguments: [String(limit), String(windowSeconds)],
  }) as [number, number, number];

  return {
    allowed: allowed === 1,
    remaining,
    retryAfterSeconds,
  };
}

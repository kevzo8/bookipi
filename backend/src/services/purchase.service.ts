import {
  atomicPurchase,
  getSaleStatus,
  getUserPurchaseStatus,
  getStock,
} from '../utils/redis.js';

export interface PurchaseRequest {
  userId: string;
  productId: string;
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  timestamp: number;
}

export interface SaleStatusResponse {
  status: 'upcoming' | 'active' | 'ended' | 'sold_out';
  remainingStock: number;
  message: string;
}

export interface UserStatusResponse {
  hasPurchased: boolean;
  userId: string;
  productId: string;
}

/**
 * Validate sale window
 */
function validateSaleWindow(
  saleStartTime: number,
  saleEndTime: number,
): { valid: boolean; message?: string } {
  const now = Date.now();

  if (now < saleStartTime) {
    return {
      valid: false,
      message: 'Sale has not started yet',
    };
  }

  if (now > saleEndTime) {
    return {
      valid: false,
      message: 'Sale has ended',
    };
  }

  return { valid: true };
}

/**
 * Process purchase attempt with concurrency control
 */
export async function processPurchase(
  request: PurchaseRequest,
  saleStartTime: number,
  saleEndTime: number,
): Promise<PurchaseResponse> {
  const { userId, productId } = request;

  // Validate inputs
  if (!userId || !productId) {
    return {
      success: false,
      message: 'Missing userId or productId',
      timestamp: Date.now(),
    };
  }

  // Validate sale window
  const windowValidation = validateSaleWindow(saleStartTime, saleEndTime);
  if (!windowValidation.valid) {
    return {
      success: false,
      message: windowValidation.message || 'Sale window validation failed',
      timestamp: Date.now(),
    };
  }

  // Attempt atomic purchase
  try {
    const result = await atomicPurchase(productId, userId);

    switch (result.message) {
      case 'SUCCESS':
        return {
          success: true,
          message: 'Purchase successful!',
          timestamp: Date.now(),
        };
      case 'ALREADY_PURCHASED':
        return {
          success: false,
          message: 'You have already purchased this item',
          timestamp: Date.now(),
        };
      case 'SOLD_OUT':
        return {
          success: false,
          message: 'Item sold out',
          timestamp: Date.now(),
        };
      default:
        return {
          success: false,
          message: 'Unknown error occurred',
          timestamp: Date.now(),
        };
    }
  } catch (error) {
    console.error('[Purchase Error]', error);
    return {
      success: false,
      message: 'Internal server error',
      timestamp: Date.now(),
    };
  }
}

/**
 * Get sale status
 */
export async function getSaleStatusResponse(
  productId: string,
  saleStartTime: number,
  saleEndTime: number,
): Promise<SaleStatusResponse> {
  try {
    const status = await getSaleStatus(saleStartTime, saleEndTime, productId);
    const remainingStock = await getStock(productId);

    let message = '';
    switch (status) {
      case 'upcoming':
        message = `Sale starts at ${new Date(saleStartTime).toISOString()}`;
        break;
      case 'active':
        message = `${remainingStock} items remaining`;
        break;
      case 'ended':
        message = 'Sale has ended';
        break;
      case 'sold_out':
        message = 'All items sold out';
        break;
    }

    return {
      status,
      remainingStock,
      message,
    };
  } catch (error) {
    console.error('[Sale Status Error]', error);
    return {
      status: 'ended',
      remainingStock: 0,
      message: 'Error retrieving sale status',
    };
  }
}

/**
 * Check if user has purchased
 */
export async function checkUserPurchaseStatus(
  productId: string,
  userId: string,
): Promise<UserStatusResponse> {
  try {
    const hasPurchased = await getUserPurchaseStatus(productId, userId);

    return {
      hasPurchased,
      userId,
      productId,
    };
  } catch (error) {
    console.error('[User Status Error]', error);
    return {
      hasPurchased: false,
      userId,
      productId,
    };
  }
}

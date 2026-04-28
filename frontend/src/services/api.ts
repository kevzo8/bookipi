const getAPIBaseUrl = () => {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv && typeof fromEnv === 'string') {
    return fromEnv;
  }

  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:3000/api';
    }

    // In production, default to same-origin API route.
    return '/api';
  }

  return 'http://localhost:3000/api';
};

const API_BASE_URL = getAPIBaseUrl();

export interface SaleStatusResponse {
  status: 'upcoming' | 'active' | 'ended' | 'sold_out';
  remainingStock: number;
  message: string;
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  timestamp: number;
}

export interface UserStatusResponse {
  hasPurchased: boolean;
  userId: string;
  productId: string;
}

export const apiService = {
  async getSaleStatus(): Promise<SaleStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/sale-status`);
    if (!response.ok) {
      throw new Error('Failed to fetch sale status');
    }
    return response.json();
  },

  async purchaseItem(userId: string): Promise<PurchaseResponse> {
    const response = await fetch(`${API_BASE_URL}/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        productId: 'limited-edition-product',
      }),
    });

    const data = await response.json();
    return data;
  },

  async checkPurchaseStatus(userId: string): Promise<UserStatusResponse> {
    const response = await fetch(
      `${API_BASE_URL}/purchase-status?userId=${encodeURIComponent(userId)}`,
    );
    if (!response.ok) {
      throw new Error('Failed to fetch purchase status');
    }
    return response.json();
  },
};

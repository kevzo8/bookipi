// For Vercel deployment: Use the backend API URL (needs to be set in environment or configured separately)
// For local development: Default to localhost:3000
const getAPIBaseUrl = () => {
  // In production, this should point to your deployed backend
  // You can set this via environment variables in Vercel dashboard
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Use relative path or your backend API domain
    return process.env.VITE_API_URL || 'http://localhost:3000/api';
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

import { useState, useEffect } from 'react';
import { apiService, SaleStatusResponse, PurchaseResponse } from './services/api';
import './App.css';

type PurchaseStatus = 'idle' | 'loading' | 'success' | 'error' | 'already_purchased' | 'sold_out' | 'inactive';

export function App() {
  const [userId, setUserId] = useState('');
  const [saleStatus, setSaleStatus] = useState<SaleStatusResponse | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>('idle');
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasPurchased, setHasPurchased] = useState(false);

  // Fetch sale status on mount and poll periodically
  useEffect(() => {
    fetchSaleStatus();
    const interval = setInterval(fetchSaleStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Check user's purchase status when userId changes
  useEffect(() => {
    if (userId) {
      checkUserPurchaseStatus(userId);
    } else {
      setHasPurchased(false);
    }
  }, [userId]);

  async function fetchSaleStatus() {
    try {
      const status = await apiService.getSaleStatus();
      setSaleStatus(status);
      setLoading(false);
      setError('');
    } catch (err) {
      setError('Failed to fetch sale status');
      setLoading(false);
    }
  }

  async function checkUserPurchaseStatus(uid: string) {
    try {
      const status = await apiService.checkPurchaseStatus(uid);
      setHasPurchased(status.hasPurchased);
    } catch (err) {
      // Silently fail, it's just a check
    }
  }

  async function handlePurchase() {
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setPurchaseStatus('loading');
    setError('');

    try {
      const result = await apiService.purchaseItem(userId);
      setPurchaseResult(result);

      if (result.success) {
        setPurchaseStatus('success');
        setHasPurchased(true);
      } else {
        if (result.message.includes('already purchased')) {
          setPurchaseStatus('already_purchased');
        } else if (result.message.includes('sold out')) {
          setPurchaseStatus('sold_out');
        } else if (result.message.includes('not')) {
          setPurchaseStatus('inactive');
        } else {
          setPurchaseStatus('error');
        }
      }
    } catch (err) {
      setPurchaseStatus('error');
      setError('An error occurred during purchase');
      setPurchaseResult(null);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'upcoming':
        return '#f59e0b';
      case 'sold_out':
      case 'ended':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return '🔴';
      case 'upcoming':
        return '⏱️';
      case 'sold_out':
        return '❌';
      case 'ended':
        return '⏹️';
      default:
        return '❓';
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <header className="header">
          <h1>⚡ Flash Sale</h1>
          <p className="subtitle">Limited Edition Product</p>
        </header>

        {/* Sale Status Card */}
        <div className="status-card" style={{ borderLeftColor: getStatusColor(saleStatus?.status || '') }}>
          <div className="status-header">
            <span className="status-icon">{getStatusIcon(saleStatus?.status || '')}</span>
            <h2 className="status-title">{saleStatus?.status.toUpperCase() || 'UNKNOWN'}</h2>
          </div>
          <p className="status-message">{saleStatus?.message || 'Unable to fetch status'}</p>
          {saleStatus?.remainingStock !== undefined && (
            <p className="remaining-stock">
              📦 {saleStatus.remainingStock} items remaining
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {/* Purchase Result */}
        {purchaseResult && (
          <div className={`result-message ${purchaseResult.success ? 'success' : 'error'}`}>
            {purchaseResult.message}
          </div>
        )}

        {/* User Input Section */}
        <div className="input-section">
          <label htmlFor="userId">User ID (Email or Username):</label>
          <input
            id="userId"
            type="text"
            placeholder="Enter your email or username"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={purchaseStatus === 'loading'}
            className="input"
          />

          {hasPurchased && (
            <div className="already-purchased-badge">
              ✅ You have already purchased this item
            </div>
          )}
        </div>

        {/* Purchase Button */}
        <button
          onClick={handlePurchase}
          disabled={
            purchaseStatus === 'loading' ||
            !saleStatus ||
            saleStatus.status !== 'active' ||
            !userId.trim() ||
            hasPurchased
          }
          className={`purchase-button ${purchaseStatus === 'loading' ? 'loading' : ''} ${
            purchaseStatus === 'success' ? 'success' : ''
          }`}
        >
          {purchaseStatus === 'loading' && <span className="spinner"></span>}
          {purchaseStatus === 'success' ? '✓ Purchase Complete' : 'BUY NOW'}
        </button>

        {/* Info Section */}
        <div className="info-section">
          <h3>How it works:</h3>
          <ul>
            <li>Enter your unique user identifier</li>
            <li>Click "BUY NOW" to attempt a purchase</li>
            <li>Each user can only purchase 1 item</li>
            <li>Limited stock - first come, first served</li>
          </ul>
        </div>

        {/* Footer */}
        <footer className="footer">
          <p>Sale System Status: <span className="status-indicator">●</span> Online</p>
          <p className="timestamp">Last updated: {new Date().toLocaleTimeString()}</p>
        </footer>
      </div>
    </div>
  );
}

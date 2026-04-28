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
  const [lastUpdated, setLastUpdated] = useState(new Date());

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
      setLastUpdated(new Date());
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
      } else if (result.message.toLowerCase().includes('already')) {
        setPurchaseStatus('already_purchased');
      } else if (result.message.toLowerCase().includes('sold out')) {
        setPurchaseStatus('sold_out');
      } else if (result.message.toLowerCase().includes('not')) {
        setPurchaseStatus('inactive');
      } else {
        setPurchaseStatus('error');
      }
    } catch (err) {
      setPurchaseStatus('error');
      setError('An error occurred during purchase');
      setPurchaseResult(null);
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Live';
      case 'upcoming':
        return 'Starting Soon';
      case 'sold_out':
        return 'Sold Out';
      case 'ended':
        return 'Closed';
      default:
        return 'Unknown';
    }
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case 'active':
        return 'is-active';
      case 'upcoming':
        return 'is-upcoming';
      case 'sold_out':
      case 'ended':
        return 'is-closed';
      default:
        return 'is-unknown';
    }
  };

  const getResultTone = (result: PurchaseResponse | null) => {
    if (!result) {
      return '';
    }

    if (result.success) {
      return 'success';
    }

    if (result.message.toLowerCase().includes('already')) {
      return 'info';
    }

    if (result.message.toLowerCase().includes('sold out')) {
      return 'warning';
    }

    return 'error';
  };

  const saleState = saleStatus?.status || 'unknown';
  const statusTone = getStatusTone(saleState);

  if (loading) {
    return (
      <div className="page-shell">
        <main className="loading-panel">
          <img className="brand-logo" src="/bookipi_logo.png" alt="Bookipi" />
          <p className="loading-copy">Loading flash sale status...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="ambient ambient-top" />
      <div className="ambient ambient-bottom" />

      <main className="sale-app">
        <header className="brand-header">
          <img className="brand-logo" src="/bookipi_logo.png" alt="Bookipi" />
          <p className="brand-kicker">Flash Sale Monitor</p>
        </header>

        <section className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">Limited Release</p>
            <h1>Bookipi Premium Toolkit</h1>
            <p>
              <span className="hero-description">
                High-demand release with one purchase per user. Inventory updates in
                {' real\u00A0time.'}
              </span>
            </p>
          </div>
          <div className={`status-pill ${statusTone}`}>
            <span className="status-dot" />
            <span>{getStatusLabel(saleState)}</span>
          </div>
        </section>

        <section className="grid-panel">
          <article className="inventory-card">
            <p className="panel-label">Remaining Inventory</p>
            <p className="inventory-value">{saleStatus?.remainingStock ?? 0}</p>
            <p className="inventory-message">
              {saleStatus?.message || 'Unable to fetch status'}
            </p>
            <p className="updated-at">Updated {lastUpdated.toLocaleTimeString()}</p>
          </article>

          <article className="purchase-card">
            <label htmlFor="userId" className="field-label">
              Customer Identifier
            </label>
            <input
              id="userId"
              type="text"
              placeholder="name@company.com"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={purchaseStatus === 'loading'}
              className="input"
            />

            {hasPurchased && (
              <div className="hint-banner success">This account already secured an item.</div>
            )}

            {error && (
              <div className="hint-banner error" role="alert">
                {error}
              </div>
            )}

            {purchaseResult && (
              <div className={`hint-banner ${getResultTone(purchaseResult)}`}>
                {purchaseResult.message}
              </div>
            )}

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
              {purchaseStatus === 'loading' && <span className="spinner" />}
              {purchaseStatus === 'success' ? 'Purchase Complete' : 'Buy Now'}
            </button>

            <ul className="rules-list">
              <li>One unit per user identity</li>
              <li>Purchases only while sale is active</li>
              <li>Orders are served first-come, first-served</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}

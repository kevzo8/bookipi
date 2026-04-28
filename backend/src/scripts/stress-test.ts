import { performance } from 'perf_hooks';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '500');
const REQUEST_TIMEOUT = 10000; // 10 seconds

interface StressTestResult {
  totalRequests: number;
  successfulPurchases: number;
  duplicatePurchases: number;
  soldOut: number;
  errors: number;
  totalTime: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  details: {
    message: string;
    count: number;
  }[];
}

async function runStressTest(): Promise<void> {
  console.log('\n🔥 Flash Sale Stress Test');
  console.log('━'.repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`Request Timeout: ${REQUEST_TIMEOUT}ms`);
  console.log('━'.repeat(60));

  // First, check sale status
  try {
    const statusResponse = await fetch(`${API_URL}/sale-status`);
    const saleStatus = await statusResponse.json();
    console.log(`\n📊 Sale Status Before Test:`);
    console.log(`   Status: ${saleStatus.status}`);
    console.log(`   Remaining Stock: ${saleStatus.remainingStock}`);
  } catch (error) {
    console.error('Failed to fetch sale status:', error);
    return;
  }

  const startTime = performance.now();
  const results: Map<string, number> = new Map();
  const responseTimes: number[] = [];

  console.log(`\n⏳ Sending ${CONCURRENT_USERS} concurrent purchase requests...`);

  // Create user IDs and purchase promises
  const promises = Array.from({ length: CONCURRENT_USERS }).map((_, i) => {
    const userId = `stress-test-user-${i}`;

    return fetch(`${API_URL}/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        productId: 'limited-edition-product',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
      .then(async (response) => {
        const reqStart = performance.now();
        const data = await response.json();
        const reqEnd = performance.now();
        responseTimes.push(reqEnd - reqStart);

        const message = data.message || 'Unknown';
        results.set(message, (results.get(message) || 0) + 1);
      })
      .catch((error) => {
        results.set('ERROR', (results.get('ERROR') || 0) + 1);
      });
  });

  // Wait for all requests to complete
  await Promise.all(promises);

  const endTime = performance.now();
  const totalTime = endTime - startTime;

  // Calculate statistics
  const result: StressTestResult = {
    totalRequests: CONCURRENT_USERS,
    successfulPurchases: results.get('Purchase successful!') || 0,
    duplicatePurchases: results.get(
      'You have already purchased this item',
    ) || 0,
    soldOut: results.get('Item sold out') || 0,
    errors: results.get('ERROR') || 0,
    totalTime: totalTime / 1000, // Convert to seconds
    requestsPerSecond: CONCURRENT_USERS / (totalTime / 1000),
    avgResponseTime:
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b) / responseTimes.length
        : 0,
    details: Array.from(results.entries()).map(([message, count]) => ({
      message,
      count,
    })),
  };

  // Print results
  console.log('\n✅ Test Complete!');
  console.log('━'.repeat(60));
  console.log(`📈 Results:`);
  console.log(`   Total Requests: ${result.totalRequests}`);
  console.log(`   Successful Purchases: ${result.successfulPurchases}`);
  console.log(`   Already Purchased: ${result.duplicatePurchases}`);
  console.log(`   Sold Out Errors: ${result.soldOut}`);
  console.log(`   Network Errors: ${result.errors}`);
  console.log('');
  console.log(`⏱️  Performance:`);
  console.log(`   Total Time: ${result.totalTime.toFixed(2)}s`);
  console.log(
    `   Requests/sec: ${result.requestsPerSecond.toFixed(2)} req/s`,
  );
  console.log(
    `   Avg Response Time: ${result.avgResponseTime.toFixed(2)}ms`,
  );
  console.log('');
  console.log(`📋 Detailed Results:`);
  result.details.forEach(({ message, count }) => {
    const percentage = ((count / result.totalRequests) * 100).toFixed(2);
    console.log(`   ${message}: ${count} (${percentage}%)`);
  });

  // Check sale status after test
  try {
    const statusResponse = await fetch(`${API_URL}/sale-status`);
    const saleStatus = await statusResponse.json();
    console.log('');
    console.log(`📊 Sale Status After Test:`);
    console.log(`   Status: ${saleStatus.status}`);
    console.log(`   Remaining Stock: ${saleStatus.remainingStock}`);
  } catch (error) {
    console.error('Failed to fetch final sale status:', error);
  }

  console.log('');
  console.log('━'.repeat(60));

  // Verify concurrency control
  const totalProcessed =
    result.successfulPurchases +
    result.duplicatePurchases +
    result.soldOut;
  console.log('\n🔒 Concurrency Control Verification:');
  console.log(`   Total Processed: ${totalProcessed}`);
  console.log(
    `   No Overselling: ${result.successfulPurchases <= 100 ? '✅ PASSED' : '❌ FAILED'}`,
  );
  console.log(
    `   No Duplicate Charges: ${result.duplicatePurchases === 0 ? '✅ PASSED' : '❌ FAILED'}`,
  );
  console.log('');

  // Save results to file
  const fs = await import('fs').then((m) => m.promises);
  const reportPath = './stress-test-results.json';
  await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
  console.log(`📄 Full results saved to: ${reportPath}`);
  console.log('');
}

// Run the test
runStressTest().catch((error) => {
  console.error('Stress test failed:', error);
  process.exit(1);
});

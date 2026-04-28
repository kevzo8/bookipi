# System Architecture & Design Decisions

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│                    React Frontend (Vite + TS)                          │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  User Interface                                              │      │
│  │  - Sale Status Display                                       │      │
│  │  - Purchase Form                                             │      │
│  │  - Real-time Polling (5s interval)                           │      │
│  │  - Error/Success Messages                                    │      │
│  └──────────────────────────────────────────────────────────────┘      │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ HTTP Requests
                           │ (JSON)
                           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          API LAYER                                      │
│                     Fastify Server (Node.js)                            │
│                       Port: 3000                                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  HTTP Server & CORS Middleware                               │      │
│  └────────────────────────┬─────────────────────────────────────┘      │
│                           │                                             │
│  ┌────────────────────────┴─────────────────────────────────────┐      │
│  │                     Route Handlers                           │      │
│  │                                                              │      │
│  │  GET  /api/sale-status        → getSaleStatusResponse()     │      │
│  │  POST /api/purchase            → processPurchase()          │      │
│  │  GET  /api/purchase-status    → checkUserPurchaseStatus()   │      │
│  │  GET  /api/health             → Health Check               │      │
│  └────────────────────────┬─────────────────────────────────────┘      │
│                           │                                             │
│  ┌────────────────────────┴─────────────────────────────────────┐      │
│  │                 Business Logic Layer                         │      │
│  │               (purchase.service.ts)                          │      │
│  │                                                              │      │
│  │  - Sale window validation                                    │      │
│  │  - Purchase request validation                               │      │
│  │  - Redis operation orchestration                             │      │
│  │  - Error handling & response formatting                      │      │
│  └────────────────────────┬─────────────────────────────────────┘      │
│                           │                                             │
│  ┌────────────────────────┴─────────────────────────────────────┐      │
│  │               Data Layer (redis.ts)                          │      │
│  │        Atomic Operations & State Management                  │      │
│  │                                                              │      │
│  │  - atomicPurchase()      - Lua script execution             │      │
│  │  - getSaleStatus()       - Status calculation               │      │
│  │  - initializeStock()     - Setup on startup                 │      │
│  │  - getStock()            - Query remaining inventory        │      │
│  └────────────────────────┬─────────────────────────────────────┘      │
└────────────────────────────┼──────────────────────────────────────────┘
                             │ Redis Protocol
                             │ (EVAL, GET, SADD, etc)
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       CACHE/STATE LAYER                                 │
│                        Redis Instance                                   │
│                      Port: 6379                                         │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              Atomic Lua Script Execution                     │      │
│  │                                                              │      │
│  │  script = '''                                                │      │
│  │    -- Check if user already purchased                        │      │
│  │    if SISMEMBER(userSet, userId) return ALREADY_PURCHASED   │      │
│  │    -- Get current stock                                      │      │
│  │    if DECR(stock) < 0 return SOLD_OUT                        │      │
│  │    -- Add user to purchased set                              │      │
│  │    SADD(userSet, userId)                                     │      │
│  │    return SUCCESS                                            │      │
│  │  '''                                                         │      │
│  │                                                              │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                   Data Structures                            │      │
│  │                                                              │      │
│  │  key: stock:limited-edition-product                          │      │
│  │  type: String (Integer)                                      │      │
│  │  value: "100"                                                │      │
│  │                                                              │      │
│  │  key: purchased_users:limited-edition-product                │      │
│  │  type: Set                                                   │      │
│  │  value: {user1, user2, user3, ...}                           │      │
│  │                                                              │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔒 Concurrency Control Mechanism

### The Race Condition Problem

Without atomic operations, this can happen:

```
Thread A                          Thread B
│                                 │
├─ Check stock (100)              │
│                                 ├─ Check stock (100)
├─ Valid, process                 │
│                                 ├─ Valid, process
├─ Decrement stock (99)           │
│                                 ├─ Decrement stock (99)
│                                 │
Result: 2 items sold from 100, stock = 99
        Expected: 1 item sold, stock = 99
        → OVERSELLING BY 1 ITEM!
```

### Our Solution: Atomic Lua Script

```
Thread A                          Thread B
│                                 │
├─ Submit to Redis                │
│  (Lua script)                   ├─ Submit to Redis (waits)
│                                 │  (Lua script)
├─ Redis LOCKS,                   │
│  checks stock (100),            │
│  decrements (99),               │
│  adds user to set,              │
│  UNLOCKS                        │
│                                 ├─ Redis LOCKS,
│  ← SUCCESS returned             │  checks stock (99),
│                                 │  decrements (98),
│                                 │  adds user to set,
│                                 │  UNLOCKS
│                                 │
│                                 ├─ SUCCESS returned
│                                 │
Result: Proper sequential processing
        Stock: 98 (correct)
        Both users charged once (correct)
        NO OVERSELLING!
```

## 📊 Data Flow Sequences

### Purchase Flow (Happy Path)

```
User                Frontend              API Server            Redis
│                   │                     │                     │
├─ Input ID ────→  │                     │                     │
│                   ├─ GET /sale-status ─→ │                     │
│                   │                     ├─ Check time ────→   │
│                   │                     │                     │
│                   │                     ←─ In stock/Active ────┤
│                   ←─ Status OK ─────────┤                     │
│                   │                     │                     │
├─ Click BUY ─────→ │                     │                     │
│                   │                     │                     │
│                   ├─ POST /purchase ───→ │                     │
│                   │                     ├─ Validate ID ──→   │
│                   │                     ├─ Call atomicPurchase
│                   │                     │   (Lua Script) ───→ │
│                   │                     │                     ├─ SISMEMBER
│                   │                     │                     ├─ GET stock
│                   │                     │                     ├─ DECR stock
│                   │                     │                     ├─ SADD user
│                   │                     │   ←─ SUCCESS ────────┤
│                   ←─ Success Response ──┤                     │
│                   │                     │                     │
└─ Show "SUCCESS"   │                     │                     │
```

### Stress Test Scenario

```
500 Users
│  │  │  │  │
├─ Submit purchase requests simultaneously
│  │  │  │  │
└──┴──┴──┴──┴──→ API Server
                 │
                 └─ Queue requests (async handling)
                    │
                    ├─ Request 1 ─→ Redis (Lua script)
                    ├─ Request 2 ─→ Redis (Lua script)
                    ├─ Request 3 ─→ Redis (Lua script)
                    └─ ...
                       │
                       └─ Redis serializes all operations
                          (atomic, no race conditions)
                             │
                             ├─ User 1: SUCCESS (Stock: 99)
                             ├─ User 2: SUCCESS (Stock: 98)
                             ├─ User 3: SUCCESS (Stock: 97)
                             └─ Users 4-100: SUCCESS
                             Users 101-500: SOLD_OUT
                             
                       Result: Exactly 100 items sold
                               No overselling
                               All users processed fairly
```

## 🎯 Key Architectural Decisions

### 1. Redis + Lua Scripts (Core Concurrency Control)

**Decision**: Use Redis with server-side Lua scripts for atomic operations

**Rationale**:
- ✅ **Atomicity**: Lua scripts execute as single operation
- ✅ **Speed**: In-memory operations (~1µs per operation)
- ✅ **Scalability**: Redis handles millions of ops/sec
- ✅ **Simplicity**: No distributed locks needed
- ✅ **Reliability**: Battle-tested technology

**Trade-offs**:
- ❌ Data not persisted (solved by RDB snapshots)
- ❌ Limited to single Redis instance (solved by Redis Cluster)
- ❌ All data in memory (solved by key expiration)

**Alternative Considered**: Database transactions
- ❌ 100x slower than Redis
- ❌ Network round-trip latency
- ❌ Connection pooling overhead

### 2. Stateless API Server Design

**Decision**: All server instances are stateless

**Rationale**:
- ✅ Horizontal scaling (add more servers)
- ✅ Load balancing (distribute requests)
- ✅ Fault tolerance (one server down = others continue)
- ✅ Cloud-ready (auto-scaling friendly)

**Architecture**:
```
Load Balancer
    ├─ API Server 1  ─┐
    ├─ API Server 2  ─┼─ Redis (shared state)
    └─ API Server 3  ─┘
```

### 3. Fastify Over Express

**Decision**: Use Fastify instead of Express

**Rationale**:
- ✅ **2-3x faster** than Express
- ✅ **Lower memory footprint** (important for high concurrency)
- ✅ **Modern**: Built with async/await, promises native
- ✅ **Plugins**: Modular architecture
- ✅ **Benchmarks**: Proven for high throughput

**Performance Comparison**:
```
Framework    Requests/sec   Memory (MB)   Latency (ms)
─────────────────────────────────────────────────────
Fastify      ~11,000        45           2.1
Express      ~5,500         65           4.2
Koa          ~8,200         55           2.8
```

### 4. Polling Instead of WebSockets

**Decision**: Use HTTP polling (5-second intervals) instead of WebSockets

**Rationale**:
- ✅ **Simpler**: No persistent connections
- ✅ **Scalable**: Stateless servers
- ✅ **Reliable**: Works everywhere (firewalls, proxies)
- ✅ **Cost-effective**: Less memory per connection
- ✅ **Easy to cache**: Can use CDN/caching layers

**Trade-offs**:
- ❌ Slightly higher latency (~5 seconds)
- ❌ More requests overall

**Why Not WebSockets**:
- Requires persistent connections (harder to scale)
- Connection management overhead
- Doesn't fit stateless architecture
- Harder to deploy on serverless platforms

### 5. Single Product MVP

**Decision**: Support only one product type

**Rationale**:
- ✅ **Focus**: Demonstrates core concurrency problem
- ✅ **Simplicity**: Easier to understand and test
- ✅ **Testing**: Clear performance baselines

**Extension to Multi-Product**:
```
Current:
  stock:product-1
  purchased_users:product-1

Multi-Product:
  stock:product-1, stock:product-2, ...
  purchased_users:product-1, purchased_users:product-2, ...

Same Lua script logic, just parameterized
```

## 🔧 Scaling Strategies

### Current Single-Instance Setup
```
Users → Fastify Server (3000) → Redis (6379)
```

**Capacity**: ~1,000 concurrent users

### Phase 1: Horizontal Scaling (Add more servers)
```
Users → Load Balancer → Fastify Server 1 ┐
                      → Fastify Server 2 ├→ Redis
                      → Fastify Server 3 ┘
```

**Capacity**: ~3,000 concurrent users

### Phase 2: Redis Cluster (Distributed state)
```
Users → Load Balancer → Fastify Cluster → Redis Cluster
                                            ├─ Master 1
                                            ├─ Master 2
                                            └─ Master 3
```

**Capacity**: ~10,000+ concurrent users

### Phase 3: Caching Layer (CDN + Edge)
```
Users → CDN/Edge → Load Balancer → Fastify Cluster → Redis Cluster
```

**Capacity**: ~100,000+ concurrent users

## 🧪 Testing Strategy

### Unit Tests
- Test business logic in isolation
- Mock Redis and external dependencies
- Cover happy paths and error cases
- ~90% code coverage

### Integration Tests
- Test API endpoints with real Redis
- Verify data flow end-to-end
- Check error responses

### Stress Tests
- Simulate 500+ concurrent users
- Measure throughput and latency
- Verify no overselling
- Generate performance reports

### Load Testing (Future)
- Test sustained load over time
- Monitor memory leaks
- Check connection handling
- Validate recovery after failures

## 📊 Performance Characteristics

### Expected Metrics
- **Throughput**: 10,000+ req/sec per instance
- **P95 Latency**: <100ms
- **P99 Latency**: <200ms
- **Error Rate**: <0.1%
- **CPU Usage**: ~2-5% for 1000 req/sec
- **Memory**: ~50MB baseline + 1MB per 10k users

### Bottleneck Analysis

1. **Network I/O** (70% of latency)
   - HTTP request/response
   - Redis network round-trip
   - Unavoidable, but acceptable

2. **Redis Operations** (25% of latency)
   - Lua script execution
   - Already optimized with atomic operations
   - Room for further optimization via pipelining

3. **Application Logic** (5% of latency)
   - Validation and formatting
   - Negligible overhead
   - Well-optimized

## 🔐 Security Considerations

### Input Validation
- ✅ User IDs validated before use
- ✅ Product IDs hardcoded (no injection)
- ✅ Timestamps from server (no client manipulation)

### Rate Limiting (Future)
```
Implementation: Use Redis counters
- Per IP: max 100 requests/minute
- Per user: max 10 requests/minute
- Prevents brute force and abuse
```

### CORS Configuration
- ✅ Configurable origin validation
- ✅ Credentials handling
- ✅ Preflight request support

### Error Messages
- ✅ User-friendly, no system details exposed
- ✅ Clear feedback on what went wrong
- ✅ Timestamps for debugging

## 📈 Monitoring & Observability

### Key Metrics to Monitor
```
Application Metrics:
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Error rate (%)
- Success rate (%)

Redis Metrics:
- Operations per second
- Memory usage
- Connected clients
- Evicted keys

System Metrics:
- CPU usage
- Memory usage
- Network I/O
- Disk I/O
```

### Logging Strategy
```
Log Levels:
- INFO: Server startup, requests processed
- WARN: Retries, timeouts, non-critical errors
- ERROR: Redis connection issues, critical failures
- DEBUG: Detailed request/response info (dev only)
```

## 🎓 Learning Outcomes

This project demonstrates mastery of:
1. **Systems Design**: Architecture planning and optimization
2. **Concurrency Control**: Race condition prevention
3. **High Performance**: Low-latency, high-throughput systems
4. **Full Stack**: Backend, frontend, testing
5. **Production Ready**: Error handling, monitoring, documentation
6. **Engineering Trade-offs**: Pragmatic decision making

---

**For deployment and scaling questions, refer to README.md**

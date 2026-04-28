# Flash Sale System - Setup Guide

## 📋 Requirements

- **Node.js**: 18.0.0 or higher
- **pnpm**: 8.0.0 or higher (or npm/yarn)
- **Redis**: 6.0.0 or higher
- **Docker** (optional, for Redis)

## 🚀 Quick Start (5 minutes)

### Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd bookipi
```

### Step 2: Install Dependencies
```bash
pnpm install
```

### Step 3: Start Redis
Choose one:

**Option A: Using Docker** (Recommended)
```bash
docker run -d -p 6379:6379 --name flash-sale-redis redis:7-alpine
```

**Option B: Using Homebrew (macOS)**
```bash
brew install redis
redis-server
```

**Option C: Using apt (Ubuntu/Debian)**
```bash
sudo apt-get install redis-server
redis-server
```

**Option D: Using Windows**
Download from: https://github.com/microsoftarchive/redis/releases

**Option E: In-memory mode (no Redis required for local demo)**
```bash
cd backend
USE_IN_MEMORY_REDIS=true pnpm dev
```

### Step 4: Start the Backend

In a new terminal:
```bash
cd backend
pnpm dev
```

Expected output:
```
[Server] Redis connected successfully
[Server] Stock initialized: 100 items
[Server] Running on http://0.0.0.0:3000
```

### Step 5: Start the Frontend

In another new terminal:
```bash
cd frontend
pnpm dev
```

Expected output:
```
VITE v5.0.8  ready in 123 ms

➜  Local:   http://localhost:5173/
```

### Step 6: Open in Browser

Navigate to: **http://localhost:5173**

🎉 You're ready! Enter a user ID and click "BUY NOW"

## 🧪 Testing

### Run Unit Tests
```bash
cd backend
pnpm test
```

### Run Unit Tests in Watch Mode
```bash
cd backend
pnpm test:watch
```

### Run Stress Tests
```bash
pnpm stress-test
```

This will:
1. Send 500 concurrent purchase requests
2. Measure response times and throughput
3. Validate concurrency controls
4. Generate a report: `backend/stress-test-results.json`

Expected result:
```
✓ Successful Purchases: ~100
✓ Already Purchased: ~400
✓ No Overselling
✓ Throughput: 200+ req/sec
```

## 📝 Environment Variables

Create `.env` files if you need custom configuration:

**backend/.env**
```
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:5173
```

**frontend/.env**
```
VITE_API_URL=http://localhost:3000/api
```

## ☁️ Production Integration (Vercel + Render)

This repository is currently integrated as:
- Frontend: https://bookipi.kevinguadalupevega.com (Vercel)
- Backend: https://bookipi.onrender.com (Render)

### Render (backend service)

Service settings:
- Root Directory: backend
- Build Command: pnpm install && pnpm build
- Start Command: pnpm start

Environment variables:
```
HOST=0.0.0.0
CORS_ORIGIN=https://bookipi.kevinguadalupevega.com
USE_IN_MEMORY_REDIS=true
```

Notes:
- Do not set PORT manually on Render.
- If you later switch to real Redis, set USE_IN_MEMORY_REDIS=false and provide REDIS_HOST and REDIS_PORT.

### Vercel (frontend project)

Set this environment variable in Project Settings > Environment Variables:
```
VITE_API_URL=https://bookipi.onrender.com/api
```

Redeploy Vercel after saving the variable.

### Verify integration

- Backend health: https://bookipi.onrender.com/api/health
- Backend sale status: https://bookipi.onrender.com/api/sale-status
- Frontend: https://bookipi.kevinguadalupevega.com

## 🏗️ Project Structure

```
flash-sale-system/
├── backend/                 # Node.js/Fastify API
│   ├── src/
│   │   ├── server.ts       # Main entry point
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Redis client
│   │   └── scripts/        # Stress test
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/               # React/Vite UI
│   ├── src/
│   │   ├── main.tsx        # Entry point
│   │   ├── App.tsx         # Main component
│   │   ├── services/       # API client
│   │   └── App.css         # Styles
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── README.md               # Main documentation
├── ARCHITECTURE.md         # System design details
├── SETUP.md               # This file
└── package.json           # Monorepo root
```

## 🔍 Testing the System Manually

### Test 1: Check Sale Status
```bash
curl http://localhost:3000/api/sale-status
```

Response:
```json
{
  "status": "active",
  "remainingStock": 100,
  "message": "100 items remaining"
}
```

### Test 2: Make a Purchase
```bash
curl -X POST http://localhost:3000/api/purchase \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-1"}'
```

Response (Success):
```json
{
  "success": true,
  "message": "Purchase successful!",
  "timestamp": 1699564800000
}
```

Response (Already Purchased):
```json
{
  "success": false,
  "message": "You have already purchased this item",
  "timestamp": 1699564800000
}
```

### Test 3: Check Purchase Status
```bash
curl "http://localhost:3000/api/purchase-status?userId=test-user-1"
```

Response:
```json
{
  "hasPurchased": true,
  "userId": "test-user-1",
  "productId": "limited-edition-product"
}
```

## 🧠 Understanding the Flow

### Normal Purchase Flow
1. User opens browser → Frontend loads
2. Frontend polls `/api/sale-status` (every 5 seconds)
3. User enters ID and clicks "BUY NOW"
4. Frontend sends POST `/api/purchase`
5. Backend validates request and time window
6. Backend executes Redis Lua script (atomic operation)
7. Redis returns success/failure
8. Frontend shows result
9. Frontend checks `/api/purchase-status` to confirm

### Under the Hood
```
Frontend HTTP Request
        ↓
Fastify validates request
        ↓
Business logic checks time window
        ↓
Redis Lua script executes atomically:
  - Check if user already purchased
  - Check if stock available
  - Decrement stock
  - Add user to purchased set
  - Return result
        ↓
Response sent to frontend
        ↓
Frontend displays result
```

## 🐛 Troubleshooting

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution**: Make sure Redis is running
```bash
redis-cli ping  # Should respond "PONG"
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**: Change the port in backend/.env
```
PORT=3001
```

Then update frontend/.env:
```
VITE_API_URL=http://localhost:3001/api
```

### Frontend Can't Connect to API
```
Error: Failed to fetch sale status
```

**Solution**: Check CORS configuration in `backend/src/server.ts`
```
CORS_ORIGIN should match your frontend URL
```

### Dependencies Not Installing
```bash
# Clear cache and reinstall
pnpm install --force
```

## 📊 Performance Expectations

### Single Instance (No Load)
- Response Time: ~10-20ms
- Throughput: Can handle 1000+ concurrent users

### Stress Test (500 concurrent)
- Total Time: ~2-3 seconds
- Requests/sec: 200+ req/sec
- Success Rate: 100% (for first 100 users)
- Remaining: SOLD_OUT (correctly)

### Memory Usage
- Baseline: ~50MB
- Per 1000 users: +5MB
- Total (100k users): ~600MB

## 🔄 Rebuilding the Project

### Development Build
```bash
pnpm build  # Builds backend and frontend
```

### Clean Build
```bash
# Remove all build artifacts
rm -rf backend/dist frontend/dist

# Rebuild
pnpm build
```

## 📦 Production Deployment

### Build for Production
```bash
pnpm build
```

### Run Backend in Production
```bash
cd backend
pnpm start  # Runs compiled JavaScript
```

### Run Frontend in Production
```bash
# Static hosting (Vercel, Netlify, AWS S3, etc.)
# Upload contents of: frontend/dist/
```

### Docker Deployment
```dockerfile
# backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend .
RUN pnpm install && pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

```bash
docker build -f backend/Dockerfile -t flash-sale-api .
docker run -p 3000:3000 -e REDIS_HOST=redis flash-sale-api
```

## 📚 Documentation

- **README.md**: Full feature documentation and API reference
- **ARCHITECTURE.md**: System design, decisions, and diagrams
- **SETUP.md**: This file - setup and troubleshooting

## ✅ Verification Checklist

Before submitting/deploying:

- [ ] Git repository initialized with commits
- [ ] README.md exists and is comprehensive
- [ ] All dependencies install without errors
- [ ] Backend starts without errors
- [ ] Frontend loads without errors
- [ ] Can make successful purchases
- [ ] Concurrency control prevents overselling
- [ ] Unit tests pass
- [ ] Stress tests complete successfully
- [ ] Error handling works (e.g., out of stock)
- [ ] Project builds for production
- [ ] Code is clean and well-formatted

## 🤝 Getting Help

### Check Logs
```bash
# Backend logs
cd backend && pnpm dev

# Frontend logs (browser console)
Open http://localhost:5173 → F12 → Console
```

### Common Issues

1. **"Cannot find module 'redis'"**
   - Solution: `cd backend && pnpm install redis`

2. **"Port 3000 already in use"**
   - Solution: `lsof -i :3000` then `kill -9 <PID>`

3. **"CORS error in browser"**
   - Check CORS_ORIGIN in backend/.env
   - Should be `http://localhost:5173` for dev

4. **"Redis connection timeout"**
   - Check Redis is running: `redis-cli ping`
   - Check host/port in backend/.env

## 🎓 Next Steps

1. **Understand the Architecture**
   - Read ARCHITECTURE.md
   - Review the system diagrams

2. **Explore the Code**
   - Backend: `backend/src/utils/redis.ts` (core logic)
   - Frontend: `frontend/src/App.tsx` (UI)

3. **Run Tests**
   - `pnpm test` - Unit tests
   - `pnpm stress-test` - Load testing

4. **Modify and Extend**
   - Add new features
   - Test concurrency edge cases
   - Try different load levels

---

**Happy testing! 🚀**

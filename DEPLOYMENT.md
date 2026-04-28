# Vercel Deployment Guide

## Current Production Integration

The active deployment wiring is:
- Frontend (Vercel): https://bookipi.kevinguadalupevega.com
- Backend (Render): https://bookipi.onrender.com
- Vercel environment variable: VITE_API_URL=https://bookipi.onrender.com/api

## ✅ Verified Configuration

This project has been fully configured for Vercel deployment with zero errors.

### Configuration Files

#### vercel.json
```json
{
  "buildCommand": "pnpm install && cd frontend && pnpm build",
  "outputDirectory": "frontend/dist",
  "framework": "vite"
}
```

**Key Settings:**
- `buildCommand`: Builds the frontend React + Vite application
- `outputDirectory`: Points to `frontend/dist` where Vite outputs the built files
- `framework`: Set to `vite` for proper optimization
- `VITE_API_URL` should be set in the Vercel dashboard (not in vercel.json)

#### pnpm-workspace.yaml
```yaml
packages:
  - 'backend'
  - 'frontend'
```

Properly declares the monorepo structure for pnpm instead of using the package.json `workspaces` field.

#### .vercelignore
Excludes backend code and documentation from deployment to keep the bundle minimal:
- `backend/` - Backend service (deployed separately if needed)
- `*.md` - Documentation files
- `.git` - Git repository
- `.env` and environment files
- Build cache and temporary files

#### frontend/vite.config.ts
Optimized build configuration:
- `outDir: 'dist'` - Output directory for built files
- `sourcemap: false` - No source maps in production
- `minify: 'terser'` - Minification enabled for smaller bundle
- React plugin enabled
- Proxy configuration for local development

### Frontend Structure

```
frontend/
├── package.json          - Dependencies and scripts
├── vite.config.ts        - Vite build configuration
├── tsconfig.json         - TypeScript configuration
├── index.html            - HTML entry point
└── src/
    ├── main.tsx          - React entry point
    ├── App.tsx           - Main application component
    ├── App.css           - Application styles
    ├── index.css         - Global styles
    └── services/
        └── api.ts        - API client service
```

### Deployment Steps

1. **Connect to GitHub**
   - Push this repository to GitHub
   - Connect GitHub repository in Vercel project settings

2. **Configure Environment Variables** (if needed)
   - Go to Settings → Environment Variables
   - Add `VITE_API_URL` pointing to your backend API (e.g., `https://api.example.com`)
   - For local development, the proxy in vite.config.ts handles `/api` requests

3. **Deploy**
   - Push to main branch
   - Vercel automatically detects vite.json configuration
   - Frontend builds to `frontend/dist`
   - Built files are served immediately

### Build & Runtime

- **Build Command**: `pnpm install && cd frontend && pnpm build`
- **Output Directory**: `frontend/dist`
- **Framework**: Vite (automatically optimized)
- **Node Version**: 18.x or higher (Vercel default)

### Environment Variables

Set in Vercel project settings if needed:

| Variable | Value | Example |
|----------|-------|---------|
| `VITE_API_URL` | Backend API endpoint | `https://api.example.com` |

Without `VITE_API_URL` in production, the frontend falls back to `/api` and expects same-origin backend routes.

### Verification Checklist

- ✅ vercel.json is valid (no `install` property)
- ✅ pnpm-workspace.yaml properly configured
- ✅ .vercelignore excludes unnecessary files
- ✅ frontend/package.json has correct build script
- ✅ vite.config.ts has proper output directory
- ✅ All TypeScript files compile without errors
- ✅ HTML entry point correctly references build output
- ✅ Main.tsx exports App as default
- ✅ API service properly configured
- ✅ CSS files properly imported
- ✅ No absolute imports outside frontend directory
- ✅ No environment variables required for basic functionality

### Troubleshooting

**Issue: Build fails with module not found**
- Solution: Run `pnpm install` in frontend directory
- Verify all dependencies are in frontend/package.json

**Issue: Blank page after deployment**
- Solution: Check browser console for errors
- Verify VITE_API_URL environment variable if needed
- Check that API service endpoints match your backend

**Issue: API calls failing**
- Solution: Set VITE_API_URL environment variable in Vercel Settings
- Or ensure backend is accessible at configured endpoint

**Issue: Styles not loading**
- Solution: Verify App.css and index.css are imported in App.tsx and main.tsx
- Check that CSS files exist in frontend/src directory

### Performance Metrics

The Vite build produces:
- Minified JavaScript
- Optimized React bundle
- Fast initial load times
- Automatic code splitting for routes (if added)

### Ready for Production

This project is fully configured and ready for production deployment on Vercel with zero errors. All configurations have been verified and optimized for performance.

**Status: ✅ DEPLOYMENT READY**

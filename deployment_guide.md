# Easy Deployment Guide - Vault Recovery Navigator

## 🚀 Super Simple Deployment Options (Supabase-Level Easy)

### Option 1: Railway (Recommended - Most Supabase-like)

**Why Railway?** One-click deployment, automatic HTTPS, environment variables, persistent storage.

#### Step 1: Prepare Your Repo
```bash
# Add these files to your project root:
```

**Create `railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npm run start:production",
    "healthcheckPath": "/api/health"
  }
}
```

**Add to `package.json` scripts:**
```json
{
  "scripts": {
    "start:production": "npm run build && npm run server:production",
    "server:production": "cd server && npm start",
    "build:production": "vite build"
  }
}
```

#### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "Deploy from GitHub repo"
4. Select your vault-recovery-navigator repo
5. Railway automatically detects Node.js and deploys!

**Environment Variables (set in Railway dashboard):**
- `NODE_ENV=production`
- `PORT=3000`

#### Step 3: Access Your App
- Railway gives you a URL like `https://vault-recovery-navigator-production.up.railway.app`
- Login with: `admin@vault.local` / `Kelyn2025!`

---

### Option 2: Render (Free Tier Available)

**Why Render?** Free tier, automatic deploys, simple setup.

#### Step 1: Prepare Deployment
**Create `render.yaml`:**
```yaml
services:
  - type: web
    name: vault-recovery-navigator
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start:production
    envVars:
      - key: NODE_ENV
        value: production
```

#### Step 2: Deploy
1. Go to [render.com](https://render.com)
2. Connect GitHub account
3. Create "New Web Service"
4. Select your repo
5. Render auto-deploys on every push!

---

### Option 3: Vercel + Backend (Hybrid)

**Frontend on Vercel + Backend on Railway**

#### Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variable:
   - `VITE_API_URL=https://your-railway-backend.railway.app`

#### Backend (Railway)
Deploy just the server folder using Railway as described above.

---

### Option 4: Digital Ocean App Platform

**Why DO App Platform?** $5/month, very simple, great for production.

#### Step 1: Create App Spec
**Create `.do/app.yaml`:**
```yaml
name: vault-recovery-navigator
services:
- name: web
  source_dir: /
  github:
    repo: your-username/vault-recovery-navigator
    branch: main
  run_command: npm run start:production
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  routes:
  - path: /
```

#### Step 2: Deploy
1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Create App → GitHub
3. Select repo and upload the app.yaml
4. Deploy!

---

## 🔧 Required File Changes for Production

### 1. Update `server/index.js`
Add this at the top to handle production builds:

```javascript
// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    }
  });
}
```

### 2. Update `vite.config.ts`
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' 
          ? 'http://localhost:3000' 
          : 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
```

### 3. Environment Variables
Add these to your hosting platform:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
```

---

## 🎯 Recommended: Railway (Easiest)

**Why Railway wins:**
- ✅ One-click GitHub deployment
- ✅ Automatic HTTPS
- ✅ Persistent file storage
- ✅ Environment variables GUI
- ✅ Automatic deploys on git push
- ✅ $5/month for production use
- ✅ Built-in metrics and logs

**Deploy in 2 minutes:**
1. Push your code to GitHub
2. Connect GitHub to Railway
3. Click deploy
4. Done! 

Your app is live at a Railway URL with automatic SSL and persistent storage.

---

## 🗂️ File Storage in Production

All platforms above support file-based storage. Your `data/` directory will persist between deploys on:
- ✅ Railway (automatic persistent volumes)
- ✅ Render (persistent disk)
- ✅ Digital Ocean (persistent storage)

No database setup required - everything just works!

---

## 🚨 Quick Troubleshooting

**Build fails?**
- Check Node.js version in platform settings (use Node 18+)
- Ensure all dependencies are in `package.json`

**App won't start?**
- Check environment variables are set
- Verify `start:production` script exists
- Check logs in platform dashboard

**Can't access app?**
- Ensure health check endpoint `/api/health` works
- Check if port is correctly set to platform's PORT env var

**Need help?** Each platform has excellent docs and support! 
# Vault Recovery Navigator

A runbook management system designed for disaster recovery and incident response procedures. This application helps organizations manage, execute, and track cybersecurity recovery operations through structured, step-by-step runbooks.

## Getting Started

After cloning this repository, follow these steps to get the app running:

### One-Time Setup (Do Once)

1. **Install Prerequisites**
   ```bash
   brew install mkcert caddy
   ```

2. **Setup Local HTTPS Certificates**
   ```bash
   mkcert -install
   mkcert runbooks.local
   ```

3. **Install Dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

4. **Initialize File Storage**
   ```bash
   npm run setup
   ```

### Launch App (Every Time)

**Option A: Automatic (Recommended)**
```bash
npm run start:local
```

**Option B: Manual (If automatic fails)**
```bash
# Terminal 1: Start frontend
npm run dev

# Terminal 2: Start backend  
cd server && npm run dev

# Terminal 3: Start HTTPS proxy
caddy run --config Caddyfile
```

### Access the App
- **URL**: https://runbooks.local
- **Login**: `admin@vault.local` / `Kelyn2025!`
- **First Run**: Click "Initialize Local Database" when prompted

## Troubleshooting

### "Network error - error signing in"

This usually means the backend server isn't running or responding. Here's how to fix it:

1. **Check if backend is running:**
   ```bash
   curl -s http://localhost:3001/api/health
   ```
   Should return `[]` if working.

2. **If backend isn't responding, restart it:**
   ```bash
   # Kill any stale backend processes
   pkill -f nodemon
   
   # Start backend manually
   cd server && npm run dev
   ```

3. **Check for port conflicts:**
   ```bash
   lsof -i :3001
   ```
   If port 3001 is in use by another process, kill it or change the port.

### "EADDRINUSE: address already in use :::3001"

The backend port is already in use:

```bash
# Find and kill the process using port 3001
lsof -i :3001
kill <PID_FROM_ABOVE>

# Or kill all nodemon processes
pkill -f nodemon

# Then restart
cd server && npm run dev
```

### Automatic startup (`npm run start:local`) fails

If the automatic script fails, start services manually:

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend  
cd server && npm run dev

# Terminal 3: HTTPS Proxy
caddy run --config Caddyfile
```

### Verify All Services Are Running

```bash
# Check frontend (should show Vite dev server)
lsof -i :8080

# Check backend (should return [])
curl -s http://localhost:3001/api/health

# Check HTTPS proxy (should return 200)
curl -k -s -o /dev/null -w "%{http_code}\n" https://runbooks.local
```

### Clean Restart

If you're having persistent issues:

```bash
# Kill all related processes
pkill -f vite
pkill -f nodemon  
pkill -f caddy

# Wait a moment, then restart manually
sleep 3
npm run dev &
cd server && npm run dev &
caddy run --config Caddyfile &
```

---

## About

A cybersecurity runbook management system for disaster recovery and incident response. Create, execute, and track step-by-step recovery procedures with team assignments and audit trails.

**Key Features**: Multi-tenant client management • Advanced runbook system • Real-time execution tracking • Local-first architecture (100% offline) • Role-based access control

## Quick Setup

```bash
# Install and setup
npm install && cd server && npm install && cd ..
npm run setup
npm run start:local

# Access at https://runbooks.local
# Login: admin@vault.local / Kelyn2025!
```

## Project Structure

### 5. Initialize Sample Data
On first launch, you'll see a migration dialog:
1. Click **"Initialize Local Database"** to set up with sample data
2. The system will create example clients, runbooks, and users
3. Start exploring the application!

### Local Development URLs
- **Main Application**: `https://runbooks.local`
- **API Endpoints**: `https://runbooks.local/api/*`
- **Direct Frontend** (dev only): `http://localhost:8080`
- **Direct Backend** (dev only): `http://localhost:3001`

## Development Setup

### Available Scripts
```bash
npm run start:local  # Start all services (recommended for development)
npm run dev          # Start frontend development server only
npm run build        # Build for production  
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run server       # Start Express server only
npm run server:dev   # Start Express server in dev mode only
npm run setup        # Initialize file storage system
```
src/
├── components/           # React components
├── lib/                 # Core utilities (database, auth)
├── pages/               # Route components
└── data/                # Sample data

server/                  # Express backend
```

## User Roles

| Role | Permissions |
|------|-------------|
| **Kelyn Admin** | Full system access, manage all clients |
| **Kelyn Rep** | Manage assigned clients, create runbooks |
| **Client Admin** | Manage org users, create org runbooks |
| **Client User** | Execute runbooks, read-only access |

## Development

```bash
npm run start:local     # Start all services (recommended)
npm run dev            # Frontend only
npm run server:dev     # Backend only
```

**Tech Stack**: React 18 + TypeScript • Express.js • IndexedDB • Tailwind CSS + shadcn-ui

```
vault-recovery-navigator/
├── src/
│   ├── components/           # React components
│   │   ├── auth/            # Authentication components
│   │   ├── clients/         # Client management
│   │   ├── runbooks/        # Runbook creation & execution
│   │   ├── users/           # User management
│   │   └── ui/              # shadcn-ui components
│   ├── pages/               # Route components
│   ├── lib/                 # Core utilities
│   │   ├── database.ts      # IndexedDB schema & client
│   │   ├── auth.ts          # Authentication logic
│   │   └── fileClient.ts    # Database operations
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   └── data/                # Sample data files
├── data/                    # JSON data files
├── server/                  # Express server (optional)
├── public/                  # Static assets
└── docs/                    # Documentation
```

## User Roles & Permissions

### **Kelyn Admin**
- Full system access
- Manage all clients and users
- Create and modify any runbooks
- System configuration

### **Kelyn Rep**
- Manage assigned client accounts
- Create runbooks for clients  
- Execute runbooks
- User management for assigned clients

### **Client Admin**
- Manage their organization's users
- Create and modify org runbooks
- Execute runbooks
- View org-specific data

### **Client User**
- Execute assigned runbooks
- View org runbooks
- Update step progress
- Read-only access to most features

## Core Concepts

### **Clients (Organizations)**
Separate workspaces for different organizations, each with:
- User management
- Custom branding
- Isolated runbooks and data
- Contact information and settings

### **Runbooks**
Structured procedures containing:
- **Steps**: Individual actions in sequence
- **Tasks**: Checklist items within steps
- **Assignments**: User responsibilities
- **Dependencies**: Step prerequisites
- **Documentation**: Photos, notes, attachments

### **Executions**
Tracked instances of runbook runs:
- Real-time progress monitoring
- User assignments and status
- Time tracking and duration
- Completion verification
- Audit trail maintenance

## Technology Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 18 + TypeScript |
| **Backend** | Express.js + Node.js |
| **Build Tool** | Vite |
| **UI Framework** | Tailwind CSS + shadcn-ui |
| **Database** | IndexedDB (via Dexie) + File-based JSON |
| **Routing** | React Router |
| **State Management** | React Query + Context |
| **Authentication** | Custom JWT + bcrypt |
| **Local Development** | Caddy + mkcert for HTTPS |
| **Icons** | Lucide React |
| **PDF Generation** | jsPDF |
| **File Handling** | Base64 encoding + Multer |

## Development Architecture

The application uses a modern local development setup with SSL and clean URLs:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  Frontend       │    │  Caddy Proxy    │    │  Backend        │
│  (React/Vite)   │◄───┤  (Reverse       │◄───┤  (Express.js)   │
│  Port: 8080     │    │   Proxy)        │    │  Port: 3001     │
│                 │    │  Port: 443      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       https://runbooks.local
                       ├── / → Frontend
                       └── /api/* → Backend
```

### Benefits of This Setup:
- **Clean URLs**: `https://runbooks.local` instead of `localhost:8080`
- **HTTPS in Development**: Trusted SSL certificates via mkcert
- **API Routing**: Clean separation between frontend and API calls
- **Production-like**: Mimics production reverse proxy setup
- **Hot Reload**: All services support live reloading during development

## Browser Support

| Browser | Version | Status |
|---------|---------|---------|
| Chrome | 60+ | ✅ Fully Supported |
| Firefox | 55+ | ✅ Fully Supported |
| Safari | 12+ | ✅ Fully Supported |
| Edge | 79+ | ✅ Fully Supported |

## Data Management

### Local Storage Structure
- **IndexedDB**: Structured data (users, runbooks, executions)
- **localStorage**: Session data, preferences, cached files
- **File System API**: Document and image storage (when available)

### Storage Limits
- **Database**: ~50% of available disk space
- **Files**: ~5-10MB per client in localStorage
- **Recommended**: <10,000 records for optimal performance

### Backup & Export
1. Navigate to Settings → Data Management
2. Click "Export All Data" to download JSON backup
3. Store backup files securely (contains sensitive data)
4. Use "Import Data" to restore from backup

## Configuration

### Environment Variables
Create a `.env` file for customization:
```env
VITE_APP_NAME="Your Organization Name"
VITE_DEFAULT_ADMIN_EMAIL="admin@yourorg.com"
VITE_SESSION_TIMEOUT="86400000"  # 24 hours in ms
```

### Branding Customization
- Upload custom logos in Settings → Branding
- Modify color schemes in `tailwind.config.ts`  
- Update application name in `vite.config.ts`

## Troubleshooting

### Common Issues

**App won't start**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run start:local
```

**Port already in use errors**
```bash
# Kill processes using the ports
lsof -ti:3001 | xargs kill -9  # Kill backend
lsof -ti:8080 | xargs kill -9  # Kill frontend
lsof -ti:443 | xargs kill -9   # Kill Caddy (if needed)

# Then restart
npm run start:local
```

**SSL certificate issues**
```bash
# Regenerate certificates
mkcert runbooks.local

# Ensure runbooks.local is in hosts file
echo "127.0.0.1 runbooks.local" | sudo tee -a /etc/hosts
```

**Database initialization fails**
```bash
# Run setup script
npm run setup

# Clear browser data and refresh
# Chrome: DevTools → Application → Storage → Clear Storage
```

**Login issues**
- Default admin: `admin@vault.local` / `Kelyn2025!`
- Other users (after setup): password is `changeMe123!`
- Clear browser localStorage if persistent issues

**Performance issues**
- Check browser storage usage in DevTools
- Export and reimport data to optimize database
- Limit file uploads to <1MB per file

### Getting Help

1. Check browser console for error messages
2. Review the troubleshooting section above
3. Clear browser data and re-initialize if needed
4. Check GitHub issues for known problems

## Security Considerations

- **Local Data**: All data stored locally in browser
- **No External Calls**: No data transmitted to external servers
- **Password Security**: Passwords hashed with bcrypt
- **Session Management**: Sessions expire after 24 hours
- **Access Control**: Role-based permissions enforced
- **Audit Trail**: All actions logged for compliance

⚠️ **Important**: This is a local-only application. Data is not backed up automatically. Regular exports are recommended.

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Follow the existing code style
4. Add tests for new features
5. Submit a pull request

### Development Guidelines
- Use TypeScript for all new code
- Follow React best practices
- Maintain responsive design principles
- Add proper error handling
- Document complex functions

**Data Management**: Local IndexedDB + localStorage. Export backups via Settings → Data Management.

## Security

Local-only application with no external data transmission. Passwords hashed with bcrypt, 24-hour sessions, role-based permissions. **Important**: Regular data exports recommended as no automatic backup.

---

Built for internal organizational use. Ensure proper security practices in production.

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const WebSocket = require('ws');
const { createServer } = require('http');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, '../data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Multer configuration for client logo uploads
const clientLogoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(UPLOADS_DIR, 'client-logos');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const fileName = `${req.params.clientId}-${Date.now()}${fileExt}`;
    cb(null, fileName);
  }
});

// Multer configuration for step photo uploads
const stepPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(UPLOADS_DIR, 'step-photos');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const fileName = `${req.params.stepId}-${Date.now()}${fileExt}`;
    cb(null, fileName);
  }
});

// Multer configuration for task photo uploads
const taskPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(UPLOADS_DIR, 'step-photos');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const fileName = `${req.params.taskId}-${Date.now()}${fileExt}`;
    cb(null, fileName);
  }
});

const uploadClientLogo = multer({ 
  storage: clientLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

const uploadStepPhoto = multer({ 
  storage: stepPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
    }
  }
});

const uploadTaskPhoto = multer({ 
  storage: taskPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
    }
  }
});

// Generic upload endpoint
const genericUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const directory = req.body.directory || 'general';
      const uploadPath = path.join(UPLOADS_DIR, directory);
      
      // Ensure directory exists
      fs.mkdir(uploadPath, { recursive: true }).then(() => {
        cb(null, uploadPath);
      }).catch(err => {
        cb(err);
      });
    },
    filename: function (req, file, cb) {
      const fileExt = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`;
      cb(null, fileName);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
    }
  }
});

// Middleware
app.use(cors({
  origin: [
    'https://runbooks.local',
    'http://runbooks.local',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:5173', // Vite dev server default port
    'http://localhost:3000',
    'http://127.0.0.1:8080'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Total-Count'],
  maxAge: 86400 // 24 hours
}));
app.use(express.json({ limit: '50mb' }));
// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from uploads directory
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Authentication middleware
const authenticate = async (req, res, next) => {
  console.log('🔐 Authentication middleware called for:', req.method, req.path);
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🔐 No Bearer token found');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    console.log('🔐 Token length:', token.length);
    let sessionData;
    
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      sessionData = JSON.parse(decoded);
      console.log('🔐 Decoded session data:', {
        email: sessionData.email,
        timestamp: sessionData.timestamp,
        sessionId: sessionData.sessionId ? 'present' : 'missing'
      });
    } catch (error) {
      console.log('🔐 Token decode error:', error.message);
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    if (!sessionData.email || !sessionData.timestamp || !sessionData.sessionId) {
      console.log('🔐 Missing required session data fields');
      return res.status(401).json({ error: 'Invalid token structure' });
    }

    // Validate token expiration (24 hours)
    const tokenAge = Date.now() - sessionData.timestamp;
    console.log('🔐 Token age (hours):', tokenAge / (60 * 60 * 1000));
    if (tokenAge > 24 * 60 * 60 * 1000) {
      console.log('🔐 Token expired');
      return res.status(401).json({ error: 'Token expired' });
    }

    // Verify user exists
    const profiles = await readTable('profiles');
    const user = profiles.find(p => p.email === sessionData.email);
    console.log('🔐 User found:', !!user, user ? user.email : 'none');
    
    if (!user) {
      console.log('🔐 User not found in profiles');
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    console.log('🔐 Authentication successful for:', user.email);
    next();
  } catch (error) {
    console.error('🔐 Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Apply authentication to all API routes except auth endpoints
app.use('/api', (req, res, next) => {
  // Skip authentication for login endpoint
  if (req.path === '/auth/login' || req.path === '/auth/logout') {
    return next();
  }
  return authenticate(req, res, next);
});

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('Created data directory:', DATA_DIR);
  }
  
  // Ensure uploads directory exists
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    console.log('Created uploads directory:', UPLOADS_DIR);
  }
  
  // Ensure client-logos directory exists
  const clientLogosDir = path.join(UPLOADS_DIR, 'client-logos');
  try {
    await fs.access(clientLogosDir);
  } catch {
    await fs.mkdir(clientLogosDir, { recursive: true });
    console.log('Created client-logos directory:', clientLogosDir);
  }
  
  // Ensure step-photos directory exists
  const stepPhotosDir = path.join(UPLOADS_DIR, 'step-photos');
  try {
    await fs.access(stepPhotosDir);
  } catch {
    await fs.mkdir(stepPhotosDir, { recursive: true });
    console.log('Created step-photos directory:', stepPhotosDir);
  }
  
  // Ensure app-branding directory exists
  const appBrandingDir = path.join(UPLOADS_DIR, 'app-branding');
  try {
    await fs.access(appBrandingDir);
  } catch {
    await fs.mkdir(appBrandingDir, { recursive: true });
    console.log('Created app-branding directory:', appBrandingDir);
  }
}

// Helper functions
function getFilePath(tableName) {
  return path.join(DATA_DIR, `${tableName}.json`);
}

async function readTable(tableName) {
  try {
    const filePath = getFilePath(tableName);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function writeTable(tableName, data) {
  await ensureDataDir();
  const filePath = getFilePath(tableName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const profiles = await readTable('profiles');
    const user = profiles.find(p => p.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const passwordFilePath = path.join(DATA_DIR, `pwd_${Buffer.from(email).toString('base64')}.txt`);
    try {
      const hashedPassword = await fs.readFile(passwordFilePath, 'utf-8');
      const isValid = await bcrypt.compare(password, hashedPassword);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate secure session token
    const sessionData = {
      email,
      timestamp: Date.now(),
      sessionId: crypto.randomUUID(),
      userId: user.id
    };
    const sessionJson = JSON.stringify(sessionData);
    const sessionToken = Buffer.from(sessionJson).toString('base64');
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      },
      session: { access_token: sessionToken }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    // Use the existing authentication middleware to validate current token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    let sessionData;
    
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      sessionData = JSON.parse(decoded);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    if (!sessionData.email || !sessionData.timestamp || !sessionData.sessionId) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }

    // Check if token is still valid (not expired)
    const tokenAge = Date.now() - sessionData.timestamp;
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return res.status(401).json({ error: 'Token expired' });
    }

    // Verify user still exists
    const profiles = await readTable('profiles');
    const user = profiles.find(p => p.email === sessionData.email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Generate new token with updated timestamp but same session ID
    const newSessionData = {
      email: sessionData.email,
      timestamp: Date.now(),
      sessionId: sessionData.sessionId, // Keep same session ID
      userId: sessionData.userId
    };
    const newSessionJson = JSON.stringify(newSessionData);
    const newSessionToken = Buffer.from(newSessionJson).toString('base64');
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      },
      session: { access_token: newSessionToken }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const userEmail = req.user.email;
    
    // Check current password
    const passwordFilePath = path.join(DATA_DIR, `pwd_${Buffer.from(userEmail).toString('base64')}.txt`);
    try {
      const storedHash = await fs.readFile(passwordFilePath, 'utf-8');
      const isValid = await bcrypt.compare(currentPassword, storedHash);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Current password verification failed' });
    }
    
    // Hash and save new password
    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await fs.writeFile(passwordFilePath, newHashedPassword);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// File upload endpoints
app.post('/api/clients/:clientId/logo', uploadClientLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { clientId } = req.params;
    const logoUrl = `/uploads/client-logos/${req.file.filename}`;

    // Update client record with new logo URL
    const clients = await readTable('clients');
    const clientIndex = clients.findIndex(client => client.id === clientId);
    
    if (clientIndex === -1) {
      // Clean up uploaded file if client doesn't exist
      await fs.unlink(req.file.path);
      return res.status(404).json({ error: 'Client not found' });
    }

    // Remove old logo file if it exists
    const oldLogoUrl = clients[clientIndex].logo_url;
    if (oldLogoUrl && oldLogoUrl.startsWith('/uploads/')) {
      const oldFilePath = path.join(DATA_DIR, oldLogoUrl);
      try {
        await fs.unlink(oldFilePath);
      } catch (error) {
        console.log('Could not delete old logo file:', error.message);
      }
    }

    // Update client with new logo URL
    clients[clientIndex].logo_url = logoUrl;
    clients[clientIndex].updated_at = new Date().toISOString();
    await writeTable('clients', clients);

    res.json({ 
      success: true, 
      logo_url: logoUrl,
      client: clients[clientIndex]
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

app.delete('/api/clients/:clientId/logo', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const clients = await readTable('clients');
    const clientIndex = clients.findIndex(client => client.id === clientId);
    
    if (clientIndex === -1) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const logoUrl = clients[clientIndex].logo_url;
    
    // Remove logo file if it exists
    if (logoUrl && logoUrl.startsWith('/uploads/')) {
      const filePath = path.join(DATA_DIR, logoUrl);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.log('Could not delete logo file:', error.message);
      }
    }

    // Update client record
    clients[clientIndex].logo_url = null;
    clients[clientIndex].updated_at = new Date().toISOString();
    await writeTable('clients', clients);

    res.json({ 
      success: true,
      client: clients[clientIndex]
    });
  } catch (error) {
    console.error('Logo removal error:', error);
    res.status(500).json({ error: 'Failed to remove logo' });
  }
});

// Task photo upload endpoints
app.post('/api/tasks/:taskId/photo', uploadTaskPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { taskId } = req.params;
    const photoUrl = `/uploads/step-photos/${req.file.filename}`;

    // Find the step that contains this task
    const steps = await readTable('runbook_steps');
    let targetStep = null;
    let taskIndex = -1;

    for (const step of steps) {
      if (step.tasks && Array.isArray(step.tasks)) {
        const foundTaskIndex = step.tasks.findIndex(task => task.id === taskId);
        if (foundTaskIndex !== -1) {
          targetStep = step;
          taskIndex = foundTaskIndex;
          break;
        }
      }
    }

    if (!targetStep || taskIndex === -1) {
      // Clean up uploaded file if task doesn't exist
      await fs.unlink(req.file.path);
      return res.status(404).json({ error: 'Task not found' });
    }

    // Remove old photo file if it exists
    const oldPhotoUrl = targetStep.tasks[taskIndex].photoUrl;
    if (oldPhotoUrl && oldPhotoUrl.startsWith('/uploads/')) {
      const oldFilePath = path.join(DATA_DIR, oldPhotoUrl);
      try {
        await fs.unlink(oldFilePath);
      } catch (error) {
        console.log('Could not delete old task photo file:', error.message);
      }
    }

    // Update task with new photo URL
    targetStep.tasks[taskIndex].photoUrl = photoUrl;
    targetStep.updated_at = new Date().toISOString();
    
    // Update the step in the steps array
    const stepIndex = steps.findIndex(s => s.id === targetStep.id);
    steps[stepIndex] = targetStep;
    await writeTable('runbook_steps', steps);

    res.json({ 
      success: true, 
      photo_url: photoUrl,
      task: targetStep.tasks[taskIndex]
    });
  } catch (error) {
    console.error('Task photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

app.delete('/api/tasks/:taskId/photo', authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    // Find the step that contains this task
    const steps = await readTable('runbook_steps');
    let targetStep = null;
    let taskIndex = -1;

    for (const step of steps) {
      if (step.tasks && Array.isArray(step.tasks)) {
        const foundTaskIndex = step.tasks.findIndex(task => task.id === taskId);
        if (foundTaskIndex !== -1) {
          targetStep = step;
          taskIndex = foundTaskIndex;
          break;
        }
      }
    }

    if (!targetStep || taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check authorization - need to find the runbook and check client permissions
    const runbooks = await readTable('runbooks');
    const runbook = runbooks.find(r => r.id === targetStep.runbook_id);
    
    if (!runbook) {
      return res.status(404).json({ error: 'Runbook not found' });
    }

    // Check if user has permission to delete photos
    // Kelyn Admin and Kelyn Rep can delete any photo
    // Client Admin can only delete photos from their own client's runbooks
    if (req.user.role === 'kelyn_admin' || req.user.role === 'kelyn_rep') {
      // Full access
    } else if (req.user.role === 'client_admin' && req.user.client_id === runbook.client_id) {
      // Client admin can delete from their own client's runbooks
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to delete photo' });
    }

    const photoUrl = targetStep.tasks[taskIndex].photoUrl;
    
    // Remove photo file if it exists
    if (photoUrl && photoUrl.startsWith('/uploads/')) {
      const filePath = path.join(DATA_DIR, photoUrl);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.log('Could not delete task photo file:', error.message);
      }
    }

    // Update task record
    targetStep.tasks[taskIndex].photoUrl = null;
    targetStep.updated_at = new Date().toISOString();
    
    // Update the step in the steps array
    const stepIndex = steps.findIndex(s => s.id === targetStep.id);
    steps[stepIndex] = targetStep;
    await writeTable('runbook_steps', steps);

    res.json({ 
      success: true,
      task: targetStep.tasks[taskIndex]
    });
  } catch (error) {
    console.error('Task photo removal error:', error);
    res.status(500).json({ error: 'Failed to remove photo' });
  }
});

// Step photo upload endpoints
app.post('/api/steps/:stepId/photo', uploadStepPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { stepId } = req.params;
    const photoUrl = `/uploads/step-photos/${req.file.filename}`;

    // Update step record with new photo URL
    const steps = await readTable('runbook_steps');
    const stepIndex = steps.findIndex(step => step.id === stepId);
    
    if (stepIndex === -1) {
      // Clean up uploaded file if step doesn't exist
      await fs.unlink(req.file.path);
      return res.status(404).json({ error: 'Step not found' });
    }

    // Remove old photo file if it exists
    const oldPhotoUrl = steps[stepIndex].photo_url;
    if (oldPhotoUrl && oldPhotoUrl.startsWith('/uploads/')) {
      const oldFilePath = path.join(DATA_DIR, oldPhotoUrl);
      try {
        await fs.unlink(oldFilePath);
      } catch (error) {
        console.log('Could not delete old step photo file:', error.message);
      }
    }

    // Update step with new photo URL
    steps[stepIndex].photo_url = photoUrl;
    steps[stepIndex].updated_at = new Date().toISOString();
    await writeTable('runbook_steps', steps);

    // Also add to the photos table for future extensibility
    try {
      const photos = await readTable('runbook_step_photos');
      const newPhoto = {
        id: crypto.randomUUID(),
        step_id: stepId,
        photo_url: photoUrl,
        caption: `Photo for step ${stepId}`,
        uploaded_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      photos.push(newPhoto);
      await writeTable('runbook_step_photos', photos);
    } catch (error) {
      console.warn('Warning: Could not add to photos table:', error.message);
    }

    res.json({ 
      success: true, 
      photo_url: photoUrl,
      step: steps[stepIndex]
    });
  } catch (error) {
    console.error('Step photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

app.delete('/api/steps/:stepId/photo', authenticate, async (req, res) => {
  try {
    const { stepId } = req.params;
    
    const steps = await readTable('runbook_steps');
    const stepIndex = steps.findIndex(step => step.id === stepId);
    
    if (stepIndex === -1) {
      return res.status(404).json({ error: 'Step not found' });
    }

    // Check authorization - need to find the runbook and check client permissions
    const runbooks = await readTable('runbooks');
    const runbook = runbooks.find(r => r.id === steps[stepIndex].runbook_id);
    
    if (!runbook) {
      return res.status(404).json({ error: 'Runbook not found' });
    }

    // Check if user has permission to delete photos
    // Kelyn Admin and Kelyn Rep can delete any photo
    // Client Admin can only delete photos from their own client's runbooks
    if (req.user.role === 'kelyn_admin' || req.user.role === 'kelyn_rep') {
      // Full access
    } else if (req.user.role === 'client_admin' && req.user.client_id === runbook.client_id) {
      // Client admin can delete from their own client's runbooks
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to delete photo' });
    }

    const photoUrl = steps[stepIndex].photo_url;
    
    // Remove photo file if it exists
    if (photoUrl && photoUrl.startsWith('/uploads/')) {
      const filePath = path.join(DATA_DIR, photoUrl);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.log('Could not delete step photo file:', error.message);
      }
    }

    // Update step record
    steps[stepIndex].photo_url = null;
    steps[stepIndex].updated_at = new Date().toISOString();
    await writeTable('runbook_steps', steps);

    // Remove from photos table
    try {
      const photos = await readTable('runbook_step_photos');
      const updatedPhotos = photos.filter(photo => photo.step_id !== stepId || photo.photo_url !== photoUrl);
      await writeTable('runbook_step_photos', updatedPhotos);
    } catch (error) {
      console.warn('Warning: Could not remove from photos table:', error.message);
    }

    res.json({ 
      success: true,
      step: steps[stepIndex]
    });
  } catch (error) {
    console.error('Step photo removal error:', error);
    res.status(500).json({ error: 'Failed to remove photo' });
  }
});

// Generic upload endpoint
app.post('/api/upload', genericUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const directory = req.body.directory || 'general';
    const fileUrl = `/uploads/${directory}/${req.file.filename}`;

    // Debug logging
    console.log('Upload request received:');
    console.log('- Directory parameter:', directory);
    console.log('- File uploaded to:', req.file.path);
    console.log('- Generated URL:', fileUrl);

    res.json({ 
      success: true, 
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Generic upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get users for mention suggestions
app.get('/api/chat/users', authenticate, async (req, res) => {
  console.log('🔍 GET /api/chat/users called');
  console.log('🔍 Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔍 User from auth:', req.user ? {
    id: req.user.id,
    email: req.user.email, 
    role: req.user.role,
    client_id: req.user.client_id
  } : 'NO USER');
  
  try {
    const { channel_id, for_private_channel } = req.query;
    console.log('🔍 Query params:', { channel_id, for_private_channel });
    
    const profiles = await readTable('profiles');
    console.log('🔍 Total profiles loaded:', profiles.length);
    
    let users = profiles;
    
    // For private channel creation, show ALL users in the organization
    if (for_private_channel === 'true') {
      users = profiles;
      console.log('🔍 Private channel creation - showing ALL users in organization:', users.length);
    }
    // Filter based on user role and client isolation for regular mentions
    else if (req.user.role === 'kelyn_admin') {
      // Kelyn admins can see all users
      users = profiles;
      console.log('🔍 User is kelyn_admin, showing all users');
    } else if (req.user.client_id) {
      // Users with a client can see:
      // 1. Other users from their own client
      // 2. Kelyn reps assigned to their client (if applicable)
      users = profiles.filter(p => 
        p.client_id === req.user.client_id || 
        p.role === 'kelyn_rep'
      );
      console.log('🔍 User has client_id, filtered to:', users.length, 'users');
    } else {
      // Kelyn reps and users without clients can see all users
      // This ensures mentions work in all scenarios
      users = profiles;
      console.log('🔍 User has no client_id, showing all users');
    }
    
    // Remove the current user from the suggestions
    users = users.filter(u => u.id !== req.user.id);
    console.log('🔍 After removing current user:', users.length, 'users');
    
    // If channel_id is provided, could add channel-specific filtering here
    // For now, return all accessible users
    
    const userList = users.map(user => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    }));
    
    console.log(`✅ Returning ${userList.length} users for mentions to ${req.user.email}:`);
    console.log('✅ Users:', JSON.stringify(userList, null, 2));
    
    res.json(userList);
  } catch (error) {
    console.error('❌ Error fetching users for mentions:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Backup API endpoints (must be before generic CRUD endpoints)
// Get backup history endpoint
app.get('/api/backup/history', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'kelyn_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const history = await getBackupHistory();
    res.json(history);
  } catch (error) {
    console.error('Error getting backup history:', error);
    res.status(500).json({ error: 'Failed to get backup history' });
  }
});

// Get stored Google credentials endpoint
app.get('/api/backup/google-credentials', authenticate, async (req, res) => {
  try {
    const credentials = await getGoogleCredentials();
    console.log('Raw credentials from storage:', credentials);
    
    // Don't send the actual refresh tokens, just metadata
    const safeCredentials = Object.entries(credentials).map(([email, data]) => ({
      email,
      lastUsed: data.lastUsed,
      hasRefreshToken: !!data.refreshToken
    }));
    
    console.log('Formatted credentials for frontend:', safeCredentials);
    res.json(safeCredentials);
  } catch (error) {
    console.error('Error getting Google credentials:', error);
    res.status(500).json({ error: 'Failed to get Google credentials' });
  }
});

// Save Google credentials endpoint
app.post('/api/backup/save-google-credentials', authenticate, async (req, res) => {
  try {
    const { email, refreshToken } = req.body;
    
    if (!email || !refreshToken) {
      return res.status(400).json({ error: 'Email and refresh token are required' });
    }

    await saveGoogleCredentials(email, {
      refreshToken,
      email,
      lastUsed: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Google credentials saved' });
  } catch (error) {
    console.error('Error saving Google credentials:', error);
    res.status(500).json({ error: 'Failed to save Google credentials' });
  }
});

// Delete stored Google credentials endpoint
app.delete('/api/backup/google-credentials/:email', authenticate, async (req, res) => {
  try {
    const { email } = req.params;
    await deleteGoogleCredentials(email);
    res.json({ success: true, message: 'Credentials deleted' });
  } catch (error) {
    console.error('Error deleting Google credentials:', error);
    res.status(500).json({ error: 'Failed to delete credentials' });
  }
});

// Get available files for backup
app.get('/api/backup/available-files', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'kelyn_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const availableFiles = [];
    
    // Get JSON files from data directory
    const dataDir = path.join(__dirname, '..', 'data');
    
    try {
      await fs.access(dataDir);
      const files = await fs.readdir(dataDir);
      
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'backup_history.json' && file !== 'google_credentials.json') {
          const filePath = path.join(dataDir, file);
          const stats = await fs.stat(filePath);
          availableFiles.push({
            name: file,
            type: 'json',
            size: stats.size,
            path: file
          });
        }
      }
    } catch (error) {
      console.error('Error reading data directory:', error);
    }

    // Get image files from uploads directory
    const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
    
    try {
      await fs.access(uploadsDir);
      
      const getImageFiles = async (dir, relativePath = '') => {
        try {
          const items = await fs.readdir(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stats = await fs.stat(fullPath);
            
            if (stats.isDirectory()) {
              await getImageFiles(fullPath, path.join(relativePath, item));
            } else if (stats.isFile()) {
              const ext = path.extname(item).toLowerCase();
              if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
                const relativeFilePath = path.join(relativePath, item);
                availableFiles.push({
                  name: item,
                  type: 'image',
                  size: stats.size,
                  path: `uploads/${relativeFilePath.replace(/\\/g, '/')}`
                });
              }
            }
          }
        } catch (error) {
          console.error('Error reading directory:', dir, error);
        }
      };
      
      await getImageFiles(uploadsDir);
    } catch (error) {
      console.error('Error accessing uploads directory:', error);
    }

    // Sort files by type and name
    availableFiles.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'json' ? -1 : 1; // JSON files first
      }
      return a.name.localeCompare(b.name);
    });

    // Sort files by type and name
    availableFiles.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'json' ? -1 : 1; // JSON files first
      }
      return a.name.localeCompare(b.name);
    });

    res.json(availableFiles);
  } catch (error) {
    console.error('Error getting available files:', error);
    res.status(500).json({ error: 'Failed to get available files' });
  }
});

// Generic CRUD endpoints
app.get('/api/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const data = await readTable(table);
    res.json(data);
  } catch (error) {
    console.error(`Error reading ${req.params.table}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get individual item by ID
app.get('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const data = await readTable(table);
    const item = data.find(item => item.id === id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error(`Error reading ${req.params.table}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const newItem = req.body;
    
    const data = await readTable(table);
    data.push(newItem);
    await writeTable(table, data);
    
    res.json(newItem);
  } catch (error) {
    console.error(`Error creating ${req.params.table}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const updates = req.body;
    
    const data = await readTable(table);
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    data[index] = { ...data[index], ...updates };
    await writeTable(table, data);
    
    res.json(data[index]);
  } catch (error) {
    console.error(`Error updating ${req.params.table}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    
    const data = await readTable(table);
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    data.splice(index, 1);
    await writeTable(table, data);
    
    res.json({ success: true });
  } catch (error) {
    console.error(`Error deleting ${req.params.table}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Migration endpoints have been removed - data files now persist changes directly

// Chat API endpoints
// Get user's channels
app.get('/api/chat/channels', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const channels = await readTable('chat_channels');
    const memberships = await readTable('channel_memberships');
    
    // Filter channels based on user access
    const userChannels = channels.filter(channel => {
      if (channel.archived) return false;
      
      // Admin can see all channels
      if (req.user.role === 'kelyn_admin') return true;
      
      // Public channels are visible to ALL users across ALL clients
      if (channel.type === 'public') return true;
      
      // Client isolation only applies to private channels
      if (channel.client_id && req.user.client_id !== channel.client_id) return false;
      
      // Private channels require membership
      if (channel.type === 'private') {
        return memberships.some(m => m.channel_id === channel.id && m.user_id === userId);
      }
      
      return true;
    });

    // Add membership info
    const channelsWithMembership = userChannels.map(channel => {
      const membership = memberships.find(m => m.channel_id === channel.id && m.user_id === userId);
      return {
        ...channel,
        membership: membership || null
      };
    });

    res.json(channelsWithMembership);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Create new channel
app.post('/api/chat/channels', authenticate, async (req, res) => {
  try {
    const { name, description, type, icon, client_id, members } = req.body;
    
    console.log('Creating channel with data:', { name, description, type, icon, client_id, members });
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const channel = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      type,
      icon: icon || 'hash',
      client_id: client_id || req.user.client_id,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      archived: false
    };
    
    console.log('Created channel object:', channel);

    // Add channel to database
    const channels = await readTable('chat_channels');
    channels.push(channel);
    await writeTable('chat_channels', channels);

    const memberships = await readTable('channel_memberships');

    // Add creator as admin member
    const creatorMembership = {
      id: crypto.randomUUID(),
      channel_id: channel.id,
      user_id: req.user.id,
      role: 'admin',
      joined_at: new Date().toISOString()
    };
    memberships.push(creatorMembership);

    // For private channels, add selected members
    if (type === 'private' && members && members.length > 0) {
      console.log('Adding members to private channel:', members);
      
      // Validate that all member IDs exist and the user has permission to add them
      const profiles = await readTable('profiles');
      const validMembers = members.filter(memberId => {
        const memberProfile = profiles.find(p => p.id === memberId);
        if (!memberProfile) return false;
        
        // Check if user can add this member (same client or admin permissions)
        if (req.user.role === 'kelyn_admin') return true;
        if (req.user.client_id && memberProfile.client_id === req.user.client_id) return true;
        if (memberProfile.role === 'kelyn_rep') return true; // Kelyn reps can be added to any client channel
        
        return false;
      });

      // Create memberships for valid members
      for (const memberId of validMembers) {
        // Skip if member is already the creator
        if (memberId === req.user.id) continue;

        const memberMembership = {
          id: crypto.randomUUID(),
          channel_id: channel.id,
          user_id: memberId,
          role: 'member',
          joined_at: new Date().toISOString()
        };
        memberships.push(memberMembership);
      }
    }

    await writeTable('channel_memberships', memberships);

    res.status(201).json({ ...channel, membership: creatorMembership });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Update channel
app.patch('/api/chat/channels/:channelId', authenticate, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { name, description, icon } = req.body;
    
    console.log('Updating channel', channelId, 'with data:', { name, description, icon });
    
    // Check if user has permission to update channel
    const memberships = await readTable('channel_memberships');
    const membership = memberships.find(m => m.channel_id === channelId && m.user_id === req.user.id);
    
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only channel admins can update channel settings' });
    }

    // Get current channel
    const channels = await readTable('chat_channels');
    const channelIndex = channels.findIndex(c => c.id === channelId);
    
    if (channelIndex === -1) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Update channel
    const channel = channels[channelIndex];
    if (name !== undefined) channel.name = name;
    if (description !== undefined) channel.description = description;
    if (icon !== undefined) channel.icon = icon;
    
    channels[channelIndex] = channel;
    await writeTable('chat_channels', channels);

    console.log('Updated channel:', channel);

    // Broadcast channel update to all members
    await broadcastToChannel(channelId, {
      type: 'channel_updated',
      channel: { ...channel, membership }
    });

    res.json({ ...channel, membership });
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Get channel messages
app.get('/api/chat/channels/:channelId/messages', authenticate, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, before } = req.query;
    
    // Check channel access
    const hasAccess = await checkChannelAccess(req.user.id, channelId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to channel' });
    }

    const messages = await readTable('chat_messages');
    const profiles = await readTable('profiles');
    
    let channelMessages = messages.filter(m => m.channel_id === channelId && !m.deleted);
    
    // Sort by created_at descending
    channelMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Apply pagination
    if (before) {
      const beforeIndex = channelMessages.findIndex(m => m.id === before);
      if (beforeIndex > -1) {
        channelMessages = channelMessages.slice(beforeIndex + 1);
      }
    }
    
    channelMessages = channelMessages.slice(0, parseInt(limit));
    
    // Add user info to messages
    const messagesWithUsers = channelMessages.map(message => {
      const user = profiles.find(p => p.id === message.user_id);
      return {
        ...message,
        user: user ? {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        } : null
      };
    });

    res.json(messagesWithUsers.reverse()); // Return in chronological order
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message via HTTP (fallback for non-WebSocket clients)
app.post('/api/chat/channels/:channelId/messages', authenticate, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { content, message_type = 'text', reply_to_id, mentions } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check channel access
    const hasAccess = await checkChannelAccess(req.user.id, channelId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to channel' });
    }

    const message = {
      id: crypto.randomUUID(),
      channel_id,
      user_id: req.user.id,
      content,
      message_type,
      reply_to_id: reply_to_id || undefined,
      mentions: mentions && mentions.length > 0 ? mentions : undefined,
      created_at: new Date().toISOString(),
      deleted: false,
      edited: false
    };

    // Save message
    const messages = await readTable('chat_messages');
    messages.push(message);
    await writeTable('chat_messages', messages);

    // Update channel last message
    await updateChannelLastMessage(channelId);

    // Broadcast via WebSocket
    await broadcastToChannel(channelId, {
      type: 'new_message',
      message: {
        ...message,
        user: {
          id: req.user.id,
          email: req.user.email,
          first_name: req.user.first_name,
          last_name: req.user.last_name
        }
      }
    });

    res.status(201).json({
      ...message,
      user: {
        id: req.user.id,
        email: req.user.email,
        first_name: req.user.first_name,
        last_name: req.user.last_name
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Join channel (for private channels)
app.post('/api/chat/channels/:channelId/join', authenticate, async (req, res) => {
  try {
    const { channelId } = req.params;
    
    const channels = await readTable('chat_channels');
    const channel = channels.find(c => c.id === channelId);
    
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if already a member
    const memberships = await readTable('channel_memberships');
    const existingMembership = memberships.find(m => m.channel_id === channelId && m.user_id === req.user.id);
    
    if (existingMembership) {
      return res.status(400).json({ error: 'Already a member of this channel' });
    }

    // Create membership
    const membership = {
      id: crypto.randomUUID(),
      channel_id: channelId,
      user_id: req.user.id,
      role: 'member',
      joined_at: new Date().toISOString()
    };

    memberships.push(membership);
    await writeTable('channel_memberships', memberships);

    res.status(201).json(membership);
  } catch (error) {
    console.error('Error joining channel:', error);
    res.status(500).json({ error: 'Failed to join channel' });
  }
});

// Get channel members
app.get('/api/chat/channels/:channelId/members', authenticate, async (req, res) => {
  try {
    const { channelId } = req.params;
    
    // Check if user has access to this channel
    const hasAccess = await checkChannelAccess(req.user.id, channelId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const memberships = await readTable('channel_memberships');
    const profiles = await readTable('profiles');
    
    // Get all memberships for this channel
    const channelMemberships = memberships.filter(m => m.channel_id === channelId);
    
    // Combine membership data with user profiles
    const members = channelMemberships.map(membership => {
      const profile = profiles.find(p => p.id === membership.user_id);
      if (!profile) return null;
      
      return {
        ...profile,
        membership
      };
    }).filter(Boolean);

    res.json(members);
  } catch (error) {
    console.error('Error fetching channel members:', error);
    res.status(500).json({ error: 'Failed to fetch channel members' });
  }
});

// Add members to channel
app.post('/api/chat/channels/:channelId/members', authenticate, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { user_ids } = req.body;
    
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'user_ids array is required' });
    }

    // Check if user is admin of this channel
    const memberships = await readTable('channel_memberships');
    const userMembership = memberships.find(m => m.channel_id === channelId && m.user_id === req.user.id);
    
    if (!userMembership || userMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only channel admins can add members' });
    }

    // Validate the channel exists
    const channels = await readTable('chat_channels');
    const channel = channels.find(c => c.id === channelId);
    
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Validate users and check permissions
    const profiles = await readTable('profiles');
    const validUserIds = [];
    
    for (const userId of user_ids) {
      const userProfile = profiles.find(p => p.id === userId);
      if (!userProfile) continue;
      
      // Check if user can be added (same client or admin permissions)
      if (req.user.role === 'kelyn_admin') {
        validUserIds.push(userId);
        continue;
      }
      
      if (req.user.client_id && userProfile.client_id === req.user.client_id) {
        validUserIds.push(userId);
        continue;
      }
      
      if (userProfile.role === 'kelyn_rep') {
        validUserIds.push(userId);
        continue;
      }
    }

    // Add new memberships
    const newMemberships = [];
    for (const userId of validUserIds) {
      // Skip if already a member
      const existingMembership = memberships.find(m => m.channel_id === channelId && m.user_id === userId);
      if (existingMembership) continue;

      const newMembership = {
        id: crypto.randomUUID(),
        channel_id: channelId,
        user_id: userId,
        role: 'member',
        joined_at: new Date().toISOString()
      };
      
      memberships.push(newMembership);
      newMemberships.push(newMembership);
    }

    await writeTable('channel_memberships', memberships);

    // Broadcast to all channel members about new members
    await broadcastToChannel(channelId, {
      type: 'members_added',
      channel_id: channelId,
      new_members: newMemberships
    });

    res.status(201).json({ added: newMemberships.length });
  } catch (error) {
    console.error('Error adding channel members:', error);
    res.status(500).json({ error: 'Failed to add channel members' });
  }
});

// Remove member from channel
app.delete('/api/chat/channels/:channelId/members/:userId', authenticate, async (req, res) => {
  try {
    const { channelId, userId } = req.params;

    // Check if user is admin of this channel
    const memberships = await readTable('channel_memberships');
    const userMembership = memberships.find(m => m.channel_id === channelId && m.user_id === req.user.id);
    
    if (!userMembership || userMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only channel admins can remove members' });
    }

    // Get the channel to check if it's the creator
    const channels = await readTable('chat_channels');
    const channel = channels.find(c => c.id === channelId);
    
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Cannot remove the channel creator
    if (userId === channel.created_by) {
      return res.status(400).json({ error: 'Cannot remove the channel creator' });
    }

    // Find and remove the membership
    const membershipIndex = memberships.findIndex(m => m.channel_id === channelId && m.user_id === userId);
    
    if (membershipIndex === -1) {
      return res.status(404).json({ error: 'Member not found in this channel' });
    }

    const removedMembership = memberships[membershipIndex];
    memberships.splice(membershipIndex, 1);
    await writeTable('channel_memberships', memberships);

    // Broadcast to all channel members about member removal
    await broadcastToChannel(channelId, {
      type: 'member_removed',
      channel_id: channelId,
      removed_user_id: userId
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing channel member:', error);
    res.status(500).json({ error: 'Failed to remove channel member' });
  }
});

// Change member role
app.patch('/api/chat/channels/:channelId/members/:userId/role', authenticate, async (req, res) => {
  try {
    const { channelId, userId } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Valid role (admin or member) is required' });
    }

    // Check if user is admin of this channel
    const memberships = await readTable('channel_memberships');
    const userMembership = memberships.find(m => m.channel_id === channelId && m.user_id === req.user.id);
    
    if (!userMembership || userMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only channel admins can change member roles' });
    }

    // Get the channel to check if it's the creator
    const channels = await readTable('chat_channels');
    const channel = channels.find(c => c.id === channelId);
    
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Cannot change the role of the channel creator
    if (userId === channel.created_by) {
      return res.status(400).json({ error: 'Cannot change the role of the channel creator' });
    }

    // Find and update the membership
    const membershipIndex = memberships.findIndex(m => m.channel_id === channelId && m.user_id === userId);
    
    if (membershipIndex === -1) {
      return res.status(404).json({ error: 'Member not found in this channel' });
    }

    memberships[membershipIndex].role = role;
    await writeTable('channel_memberships', memberships);

    // Broadcast to all channel members about role change
    await broadcastToChannel(channelId, {
      type: 'member_role_changed',
      channel_id: channelId,
      user_id: userId,
      new_role: role
    });

    res.json({ message: 'Member role updated successfully', membership: memberships[membershipIndex] });
  } catch (error) {
    console.error('Error changing member role:', error);
    res.status(500).json({ error: 'Failed to change member role' });
  }
});

// Update read status
app.post('/api/chat/channels/:channelId/read', authenticate, async (req, res) => {
  try {
    const { channelId } = req.params;
    
    const memberships = await readTable('channel_memberships');
    const membershipIndex = memberships.findIndex(m => m.channel_id === channelId && m.user_id === req.user.id);
    
    if (membershipIndex !== -1) {
      memberships[membershipIndex].last_read_at = new Date().toISOString();
      await writeTable('channel_memberships', memberships);
    }

    res.status(200).json({ message: 'Read status updated' });
  } catch (error) {
    console.error('Error updating read status:', error);
    res.status(500).json({ error: 'Failed to update read status' });
  }
});

// Create HTTP server for WebSocket
const server = createServer(app);

// WebSocket server for real-time chat
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  verifyClient: (info) => {
    // Basic verification - can be enhanced with token validation
    return true;
  }
});

// Store active WebSocket connections with user info
const activeConnections = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  // Send ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'authenticate':
          await handleWebSocketAuth(ws, message);
          break;
        case 'join_channel':
          await handleJoinChannel(ws, message);
          break;
        case 'leave_channel':
          await handleLeaveChannel(ws, message);
          break;
        case 'send_message':
          await handleSendMessage(ws, message);
          break;
        case 'typing_start':
          await handleTypingStart(ws, message);
          break;
        case 'typing_stop':
          await handleTypingStop(ws, message);
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    // Clear ping interval
    clearInterval(pingInterval);
    
    // Remove connection from active connections
    for (const [userId, connection] of activeConnections.entries()) {
      if (connection.ws === ws) {
        activeConnections.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// WebSocket message handlers
async function handleWebSocketAuth(ws, message) {
  try {
    const { token } = message;
    
    if (!token) {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Token required' }));
      return;
    }

    // Validate token (same logic as HTTP authentication)
    const decoded = Buffer.from(token, 'base64').toString();
    const sessionData = JSON.parse(decoded);
    
    // Validate token expiration
    if (Date.now() - sessionData.timestamp > 24 * 60 * 60 * 1000) {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Token expired' }));
      return;
    }

    // Verify user exists
    const profiles = await readTable('profiles');
    const user = profiles.find(p => p.email === sessionData.email);
    
    if (!user) {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
      return;
    }

    // Store connection with user info
    activeConnections.set(user.id, {
      ws,
      user,
      channels: new Set(),
      lastSeen: Date.now()
    });

    ws.send(JSON.stringify({ 
      type: 'authenticated', 
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name }
    }));

    // Automatically join user to their accessible channels
    try {
      const channels = await readTable('chat_channels');
      const memberships = await readTable('channel_memberships');
      
      const userChannels = channels.filter(channel => {
        if (channel.archived) return false;
        
        // Admin can see all channels
        if (user.role === 'kelyn_admin') return true;
        
        // Public channels are visible to ALL users across ALL clients
        if (channel.type === 'public') return true;
        
        // Client isolation only applies to private channels
        if (channel.client_id && user.client_id !== channel.client_id) return false;
        
        // Private channels require membership
        if (channel.type === 'private') {
          return memberships.some(m => m.channel_id === channel.id && m.user_id === user.id);
        }
        
        return true;
      });

      // Join all accessible channels
      userChannels.forEach(channel => {
        activeConnections.get(user.id).channels.add(channel.id);
      });

      // Send channels list
      ws.send(JSON.stringify({
        type: 'channels_updated',
        channels: userChannels.map(channel => {
          const membership = memberships.find(m => m.channel_id === channel.id && m.user_id === user.id);
          return {
            ...channel,
            membership: membership || null
          };
        })
      }));
    } catch (error) {
      console.error('Error loading user channels on auth:', error);
    }

    console.log(`User ${user.email} authenticated via WebSocket`);
  } catch (error) {
    console.error('WebSocket auth error:', error);
    ws.send(JSON.stringify({ type: 'auth_error', message: 'Authentication failed' }));
  }
}

async function handleJoinChannel(ws, message) {
  const { channel_id } = message;
  const connection = findConnectionByWs(ws);
  
  if (!connection) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
    return;
  }

  // Check if user has access to channel
  const hasAccess = await checkChannelAccess(connection.user.id, channel_id);
  if (!hasAccess) {
    ws.send(JSON.stringify({ type: 'error', message: 'Access denied to channel' }));
    return;
  }

  connection.channels.add(channel_id);
  ws.send(JSON.stringify({ type: 'joined_channel', channel_id }));
}

async function handleLeaveChannel(ws, message) {
  const { channel_id } = message;
  const connection = findConnectionByWs(ws);
  
  if (!connection) return;
  
  connection.channels.delete(channel_id);
  ws.send(JSON.stringify({ type: 'left_channel', channel_id }));
}

async function handleSendMessage(ws, message) {
  const { channel_id, content, message_type = 'text', reply_to_id, mentions } = message;
  const connection = findConnectionByWs(ws);
  
  if (!connection) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
    return;
  }

  // Check channel access
  const hasAccess = await checkChannelAccess(connection.user.id, channel_id);
  if (!hasAccess) {
    ws.send(JSON.stringify({ type: 'error', message: 'Access denied to channel' }));
    return;
  }

  // Create message
  const chatMessage = {
    id: crypto.randomUUID(),
    channel_id,
    user_id: connection.user.id,
    content,
    message_type,
    reply_to_id: reply_to_id || undefined,
    mentions: mentions && mentions.length > 0 ? mentions : undefined,
    created_at: new Date().toISOString(),
    deleted: false,
    edited: false
  };

  // Save message to database
  const messages = await readTable('chat_messages');
  messages.push(chatMessage);
  await writeTable('chat_messages', messages);

  // Update channel's last message timestamp
  await updateChannelLastMessage(channel_id);

  // Broadcast message to all users in the channel (excluding sender to prevent duplicates)
  await broadcastToChannel(channel_id, {
    type: 'new_message',
    message: {
      ...chatMessage,
      user: {
        id: connection.user.id,
        email: connection.user.email,
        first_name: connection.user.first_name,
        last_name: connection.user.last_name
      }
    }
  }, connection.user.id);
}

async function handleTypingStart(ws, message) {
  const { channel_id } = message;
  const connection = findConnectionByWs(ws);
  
  if (!connection) return;

  await broadcastToChannel(channel_id, {
    type: 'user_typing',
    channel_id,
    user_id: connection.user.id,
    typing: true
  }, connection.user.id); // Exclude sender
}

async function handleTypingStop(ws, message) {
  const { channel_id } = message;
  const connection = findConnectionByWs(ws);
  
  if (!connection) return;

  await broadcastToChannel(channel_id, {
    type: 'user_typing',
    channel_id,
    user_id: connection.user.id,
    typing: false
  }, connection.user.id); // Exclude sender
}

// Helper functions
function findConnectionByWs(ws) {
  for (const connection of activeConnections.values()) {
    if (connection.ws === ws) {
      return connection;
    }
  }
  return null;
}

async function checkChannelAccess(userId, channelId) {
  try {
    const channels = await readTable('chat_channels');
    const channel = channels.find(c => c.id === channelId);
    
    if (!channel || channel.archived) return false;

    const profiles = await readTable('profiles');
    const user = profiles.find(p => p.id === userId);
    
    if (!user) return false;

    // Admin access to all channels
    if (user.role === 'kelyn_admin') return true;

    // For public channels, automatically create membership if it doesn't exist
    // Public channels are accessible to ALL users across ALL clients
    if (channel.type === 'public') {
      const memberships = await readTable('channel_memberships');
      const existingMembership = memberships.find(m => m.channel_id === channelId && m.user_id === userId);
      
      if (!existingMembership) {
        // Auto-join user to public channel
        const newMembership = {
          id: crypto.randomUUID(),
          channel_id: channelId,
          user_id: userId,
          role: 'member',
          joined_at: new Date().toISOString()
        };
        memberships.push(newMembership);
        await writeTable('channel_memberships', memberships);
        console.log(`Auto-joined user ${user.email} to public channel ${channel.name}`);
      }
      
      return true;
    }

    // Check private channel membership
    if (channel.type === 'private') {
      // Client isolation applies to private channels
      if (channel.client_id && user.client_id !== channel.client_id) return false;
      
      const memberships = await readTable('channel_memberships');
      return memberships.some(m => m.channel_id === channelId && m.user_id === userId);
    }

    return true;
  } catch (error) {
    console.error('Error checking channel access:', error);
    return false;
  }
}

async function broadcastToChannel(channelId, message, excludeUserId = null) {
  const usersInChannel = [];
  
  for (const [userId, connection] of activeConnections.entries()) {
    if (userId === excludeUserId) continue;
    if (connection.channels.has(channelId)) {
      usersInChannel.push(connection);
    }
  }

  usersInChannel.forEach(connection => {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  });
}

async function updateChannelLastMessage(channelId) {
  try {
    const channels = await readTable('chat_channels');
    const channelIndex = channels.findIndex(c => c.id === channelId);
    
    if (channelIndex !== -1) {
      channels[channelIndex].last_message_at = new Date().toISOString();
      await writeTable('chat_channels', channels);
    }
  } catch (error) {
    console.error('Error updating channel last message:', error);
  }
}

// Initialize server
async function initialize() {
  await ensureDataDir();
  
  // Initialize auto backup scheduler
  scheduleAutoBackup();
  
  console.log('Server initialized - using existing data files');
  console.log('Migration data loading has been disabled - data files will persist changes');
  
  // Create default admin if no profiles exist
  const profiles = await readTable('profiles');
    if (profiles.length === 0) {
      console.log('Creating default admin user...');
      
      const adminId = crypto.randomUUID();
      const adminProfile = {
        id: adminId,
        email: 'admin@vault.local',
        first_name: 'Admin',
        last_name: 'User',
        role: 'kelyn_admin',
        created_at: new Date().toISOString()
      };
      
      await writeTable('profiles', [adminProfile]);
      
      // Set admin password
      const passwordFile = path.join(DATA_DIR, `pwd_${Buffer.from('admin@vault.local').toString('base64')}.txt`);
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await fs.writeFile(passwordFile, hashedPassword);
      
      // Create default apps
      const defaultApps = [
        { id: crypto.randomUUID(), name: 'Windows Server', logo_url: '/icons/windows.png', created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'Active Directory', logo_url: '/icons/ad.png', created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'Exchange Server', logo_url: '/icons/exchange.png', created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'SQL Server', logo_url: '/icons/sql.png', created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'VMware', logo_url: '/icons/vmware.png', created_at: new Date().toISOString() }
      ];
      
      await writeTable('apps', defaultApps);
      
      // Create default chat channels
      const defaultChannels = [
        {
          id: crypto.randomUUID(),
          name: 'general',
          description: 'General team discussion',
          type: 'public',
          icon: 'hash',
          created_by: adminId,
          created_at: new Date().toISOString(),
          archived: false
        },
        {
          id: crypto.randomUUID(),
          name: 'incident-response',
          description: 'Emergency incident coordination',
          type: 'public',
          icon: 'shield',
          created_by: adminId,
          created_at: new Date().toISOString(),
          archived: false
        },
        {
          id: crypto.randomUUID(),
          name: 'runbook-updates',
          description: 'Notifications about runbook changes',
          type: 'public',
          icon: 'book',
          created_by: adminId,
          created_at: new Date().toISOString(),
          archived: false
        }
      ];
      
      await writeTable('chat_channels', defaultChannels);
      
      // Create admin memberships for all channels
      const adminMemberships = defaultChannels.map(channel => ({
        id: crypto.randomUUID(),
        channel_id: channel.id,
        user_id: adminId,
        role: 'admin',
        joined_at: new Date().toISOString()
      }));
      
      await writeTable('channel_memberships', adminMemberships);
      
      console.log('Default data created');
    }
  
  console.log(`Data directory: ${DATA_DIR}`);
}

// Catch-all handler for React Router (must be last)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    }
  });
}

server.listen(PORT, async () => {
  await initialize();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
  console.log('API endpoints:');
  console.log('  POST /api/auth/login');
  console.log('  POST /api/auth/logout');
  console.log('  POST /api/auth/change-password');
  console.log('  POST /api/clients/:clientId/logo');
  console.log('  DELETE /api/clients/:clientId/logo');
  console.log('  POST /api/tasks/:taskId/photo');
  console.log('  DELETE /api/tasks/:taskId/photo');
  console.log('  POST /api/steps/:stepId/photo');
  console.log('  DELETE /api/steps/:stepId/photo');
  console.log('  GET  /api/:table');
  console.log('  GET  /api/:table/:id');
  console.log('  POST /api/:table');
  console.log('  PUT  /api/:table/:id');
  console.log('  DELETE /api/:table/:id');

  console.log('  POST /api/upload');
  console.log('  GET  /api/chat/channels');
  console.log('  POST /api/chat/channels');
  console.log('  PATCH /api/chat/channels/:channelId');
  console.log('  GET  /api/chat/channels/:channelId/messages');
  console.log('  POST /api/chat/channels/:channelId/messages');
  console.log('  POST /api/chat/channels/:channelId/join');
  console.log('  POST /api/chat/channels/:channelId/read');
  console.log('  GET  /api/chat/users');
  console.log('  POST /api/backup/google-drive');
  console.log('  Static files: /uploads/*');
});

// Add this endpoint after your existing auth endpoints (around line 342)
app.post('/api/backup/google-drive', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'kelyn_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { googleAccessToken, googleUserEmail, googleRefreshToken, selectedFiles } = req.body;
    
    if (!googleAccessToken) {
      return res.status(400).json({ error: 'Google access token required' });
    }

    // Set up Server-Sent Events for real-time progress
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Generate backup ID for tracking
    const backupId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const dateString = timestamp.split('T')[0];
    
    try {
      // Initialize Google Drive API with user's access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ 
        access_token: googleAccessToken,
        refresh_token: googleRefreshToken 
      });

      const drive = google.drive({ version: 'v3', auth });
      
      // Create backup folder with timestamp and user info
      const userInfo = googleUserEmail ? ` (${googleUserEmail})` : '';
      const folderName = `Vault Recovery Navigator Backup ${dateString}${userInfo}`;
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };
      
      sendProgress({ type: 'status', message: 'Creating backup folder...' });
      
      const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });
      
      const folderId = folder.data.id;
      const backupResults = [];
      
      // Initialize backup history entry
      const backupEntry = {
        id: backupId,
        timestamp,
        date: dateString,
        initiatedBy: req.user.email,
        googleUserEmail,
        folderId,
        folderName,
        status: 'in_progress',
        totalFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        files: [],
        error: null
      };
      
      // Filter files based on selectedFiles if provided
      let jsonFiles = [];
      let allImageFiles = [];
      
      if (selectedFiles && Array.isArray(selectedFiles)) {
        // Process only selected files
        for (const selectedFile of selectedFiles) {
          if (selectedFile.endsWith('.json')) {
            // JSON file in data directory
            const filePath = path.join(DATA_DIR, selectedFile);
            if (await fs.access(filePath).then(() => true).catch(() => false)) {
              jsonFiles.push(selectedFile);
            }
          } else if (selectedFile.startsWith('uploads/')) {
            // Image file in uploads directory
            const relativePath = selectedFile.replace('uploads/', '');
            const fullPath = path.join(DATA_DIR, 'uploads', relativePath);
            if (await fs.access(fullPath).then(() => true).catch(() => false)) {
              const stat = await fs.stat(fullPath);
              if (stat.isFile()) {
                const pathParts = relativePath.split('/');
                const fileName = pathParts.pop();
                const dirPath = pathParts.join('/');
                allImageFiles.push({
                  fullPath,
                  relativeItemPath: relativePath,
                  name: fileName,
                  relativePath: dirPath
                });
              }
            }
          }
        }
      } else {
        // Fallback to all files if no selection provided
        const dataFiles = await fs.readdir(DATA_DIR);
        jsonFiles = dataFiles.filter(file => file.endsWith('.json'));
        
        const uploadsDir = path.join(DATA_DIR, 'uploads');
        if (await fs.access(uploadsDir).then(() => true).catch(() => false)) {
          const getImageFiles = async (dir, relativePath = '') => {
            const items = await fs.readdir(dir, { withFileTypes: true });
            const files = [];
            
            for (const item of items) {
              const fullPath = path.join(dir, item.name);
              const relativeItemPath = path.join(relativePath, item.name);
              
              if (item.isDirectory()) {
                const subFiles = await getImageFiles(fullPath, relativeItemPath);
                files.push(...subFiles);
              } else if (item.isFile() && !item.name.startsWith('.')) {
                files.push({ fullPath, relativeItemPath, name: item.name, relativePath });
              }
            }
            return files;
          };
          
          allImageFiles = await getImageFiles(uploadsDir);
        }
      }
      
      const totalFiles = jsonFiles.length + allImageFiles.length;
      backupEntry.totalFiles = totalFiles;
      let processedFiles = 0;
      
      sendProgress({ 
        type: 'init', 
        totalFiles,
        files: [
          ...jsonFiles.map(name => ({ name, type: 'json', status: 'pending' })),
          ...allImageFiles.map(f => ({ name: f.relativeItemPath, type: 'image', status: 'pending' }))
        ]
      });
      
      // Backup JSON files
      console.log('📁 Backing up JSON files...');
      sendProgress({ type: 'status', message: 'Backing up JSON files...' });
      
      for (const file of jsonFiles) {
        try {
          sendProgress({ type: 'file_start', fileName: file, fileType: 'json' });
          
          const filePath = path.join(DATA_DIR, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          
          const fileMetadata = {
            name: file,
            parents: [folderId]
          };
          
          const media = {
            mimeType: 'application/json',
            body: fileContent
          };
          
          const uploadedFile = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id,name'
          });
          
          const result = {
            name: file,
            type: 'json',
            fileId: uploadedFile.data.id,
            status: 'success'
          };
          
          backupResults.push(result);
          backupEntry.files.push(result);
          backupEntry.successfulFiles++;
          processedFiles++;
          
          sendProgress({ 
            type: 'file_complete', 
            fileName: file, 
            fileType: 'json',
            status: 'success',
            progress: Math.round((processedFiles / totalFiles) * 100)
          });
          
          console.log(`✅ Backed up JSON: ${file}`);
        } catch (error) {
          console.error(`❌ Failed to backup JSON ${file}:`, error.message);
          const result = {
            name: file,
            type: 'json',
            status: 'failed',
            error: error.message
          };
          backupResults.push(result);
          backupEntry.files.push(result);
          backupEntry.failedFiles++;
          processedFiles++;
          
          sendProgress({ 
            type: 'file_complete', 
            fileName: file, 
            fileType: 'json',
            status: 'failed',
            error: error.message,
            progress: Math.round((processedFiles / totalFiles) * 100)
          });
        }
      }
      
      // Backup image files from uploads directory
      console.log('📁 Backing up image files...');
      sendProgress({ type: 'status', message: 'Backing up image files...' });
      
      if (allImageFiles.length > 0) {
        for (const fileInfo of allImageFiles) {
          try {
            sendProgress({ type: 'file_start', fileName: fileInfo.relativeItemPath, fileType: 'image' });
            
            // Create folder structure in Google Drive if needed
            let currentFolderId = folderId;
            if (fileInfo.relativePath) {
              const pathParts = fileInfo.relativePath.split(path.sep);
              for (const part of pathParts) {
                // Check if folder exists
                const existingFolders = await drive.files.list({
                  q: `'${currentFolderId}' in parents and name='${part}' and mimeType='application/vnd.google-apps.folder'`,
                  fields: 'files(id, name)'
                });
                
                if (existingFolders.data.files.length > 0) {
                  currentFolderId = existingFolders.data.files[0].id;
                } else {
                  const subFolder = await drive.files.create({
                    resource: {
                      name: part,
                      parents: [currentFolderId],
                      mimeType: 'application/vnd.google-apps.folder'
                    },
                    fields: 'id'
                  });
                  currentFolderId = subFolder.data.id;
                }
              }
            }
            
            const fileStream = require('fs').createReadStream(fileInfo.fullPath);
            const stat = await fs.stat(fileInfo.fullPath);
            
            const fileMetadata = {
              name: fileInfo.name,
              parents: [currentFolderId]
            };
            
            const media = {
              body: fileStream
            };
            
            const uploadedFile = await drive.files.create({
              resource: fileMetadata,
              media: media,
              fields: 'id,name'
            });
            
            const result = {
              name: fileInfo.relativeItemPath,
              type: 'image',
              size: stat.size,
              fileId: uploadedFile.data.id,
              status: 'success'
            };
            
            backupResults.push(result);
            backupEntry.files.push(result);
            backupEntry.successfulFiles++;
            processedFiles++;
            
            sendProgress({ 
              type: 'file_complete', 
              fileName: fileInfo.relativeItemPath, 
              fileType: 'image',
              status: 'success',
              size: stat.size,
              progress: Math.round((processedFiles / totalFiles) * 100)
            });
            
            console.log(`✅ Backed up image: ${fileInfo.relativeItemPath}`);
          } catch (error) {
            console.error(`❌ Failed to backup image ${fileInfo.relativeItemPath}:`, error.message);
            const result = {
              name: fileInfo.relativeItemPath,
              type: 'image',
              status: 'failed',
              error: error.message
            };
            backupResults.push(result);
            backupEntry.files.push(result);
            backupEntry.failedFiles++;
            processedFiles++;
            
            sendProgress({ 
              type: 'file_complete', 
              fileName: fileInfo.relativeItemPath, 
              fileType: 'image',
              status: 'failed',
              error: error.message,
              progress: Math.round((processedFiles / totalFiles) * 100)
            });
          }
        }
      }
      
      // Update backup status to completed
      backupEntry.status = 'completed';
      backupEntry.completedAt = new Date().toISOString();
      
      // Save backup history
      await saveBackupHistory(backupEntry);
      
      // Store Google credentials securely if refresh token provided
      if (googleRefreshToken && googleUserEmail) {
        await saveGoogleCredentials(googleUserEmail, {
          refreshToken: googleRefreshToken,
          email: googleUserEmail,
          lastUsed: new Date().toISOString()
        });
      }
      
      const successCount = backupResults.filter(r => r.status === 'success').length;
      const failCount = backupResults.filter(r => r.status === 'failed').length;
      
      sendProgress({
        type: 'complete',
        success: true,
        backupId,
        folderId,
        folderName,
        summary: {
          total: backupResults.length,
          successful: successCount,
          failed: failCount
        },
        files: backupResults,
        message: `Backup completed: ${successCount} files successful, ${failCount} failed to ${googleUserEmail || 'Google Drive'}`
      });
      
    } catch (error) {
      console.error('Google Drive backup error:', error);
      
      // Save failed backup to history
      try {
        const failedEntry = {
          id: backupId,
          timestamp: new Date().toISOString(),
          date: dateString,
          initiatedBy: req.user.email,
          googleUserEmail,
          status: 'failed',
          error: error.message,
          totalFiles: 0,
          successfulFiles: 0,
          failedFiles: 0,
          files: []
        };
        await saveBackupHistory(failedEntry);
      } catch (historyError) {
        console.error('Failed to save backup history:', historyError);
      }
      
      sendProgress({
        type: 'error',
        error: 'Backup failed',
        details: error.message
      });
    }
    
    res.end();
    
  } catch (error) {
    console.error('Google Drive backup error:', error);
    res.status(500).json({ 
      error: 'Backup failed', 
      details: error.message 
    });
  }
});

// Restore from Google Drive backup
app.post('/api/backup/restore', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'kelyn_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { backupId, selectedFiles, googleAccessToken } = req.body;

    if (!backupId || !selectedFiles || !googleAccessToken) {
      return res.status(400).json({ error: 'Backup ID, selected files, and Google access token are required' });
    }

    // Get backup history to find the backup details
    const backupHistory = await getBackupHistory();
    const backup = backupHistory.find(b => b.id === backupId);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    if (backup.status !== 'completed') {
      return res.status(400).json({ error: 'Can only restore from completed backups' });
    }

    // Set up Server-Sent Events for real-time progress
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    console.log(`🔄 Starting restore from backup: ${backupId}`);
    console.log(`📁 Restoring ${selectedFiles.length} files`);

    // Initialize Google Drive API
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: googleAccessToken });
    const drive = google.drive({ version: 'v3', auth });

    const restoreId = crypto.randomUUID();
    const restoreResults = [];
    let processedFiles = 0;

    sendProgress({
      type: 'init',
      restoreId,
      totalFiles: selectedFiles.length,
      message: `Starting restore of ${selectedFiles.length} files from backup ${backup.date}`
    });

    // Process each selected file
    for (const filePath of selectedFiles) {
      try {
        sendProgress({
          type: 'file_start',
          file: filePath,
          progress: Math.round((processedFiles / selectedFiles.length) * 100)
        });

        // Find the file in the backup
        const backupFile = backup.files.find(f => f.name === filePath);
        if (!backupFile || backupFile.status !== 'success') {
          throw new Error('File not found in backup or backup failed');
        }

        if (!backupFile.fileId) {
          throw new Error('File ID not found in backup data');
        }

        // Download file from Google Drive
        const response = await drive.files.get({
          fileId: backupFile.fileId,
          alt: 'media'
        }, { responseType: 'stream' });

        // Determine local file path
        let localPath;
        if (backupFile.type === 'image') {
          // Image files are stored with their relative path in uploads
          localPath = path.join(DATA_DIR, 'uploads', filePath);
        } else {
          // JSON files are stored directly in data directory
          localPath = path.join(DATA_DIR, filePath);
        }

        // Ensure directory exists
        await fs.mkdir(path.dirname(localPath), { recursive: true });

        // Write file to local system
        const writeStream = createWriteStream(localPath);
        
        await new Promise((resolve, reject) => {
          response.data.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          response.data.on('error', reject);
        });

        restoreResults.push({
          name: filePath,
          type: backupFile.type,
          status: 'success',
          size: backupFile.size
        });

        sendProgress({
          type: 'file_complete',
          file: filePath,
          status: 'success',
          progress: Math.round(((processedFiles + 1) / selectedFiles.length) * 100)
        });

        console.log(`✅ Restored: ${filePath}`);

      } catch (error) {
        console.error(`❌ Failed to restore ${filePath}:`, error);
        
        restoreResults.push({
          name: filePath,
          type: 'unknown',
          status: 'failed',
          error: error.message
        });

        sendProgress({
          type: 'file_complete',
          file: filePath,
          status: 'failed',
          error: error.message,
          progress: Math.round(((processedFiles + 1) / selectedFiles.length) * 100)
        });
      }

      processedFiles++;
    }

    // Save restore history
    const restoreEntry = {
      id: restoreId,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      initiatedBy: req.user.email,
      backupId: backup.id,
      backupDate: backup.date,
      status: 'completed',
      totalFiles: selectedFiles.length,
      successfulFiles: restoreResults.filter(r => r.status === 'success').length,
      failedFiles: restoreResults.filter(r => r.status === 'failed').length,
      files: restoreResults
    };

    await saveRestoreHistory(restoreEntry);

    const successCount = restoreResults.filter(r => r.status === 'success').length;
    const failCount = restoreResults.filter(r => r.status === 'failed').length;

    sendProgress({
      type: 'complete',
      success: true,
      restoreId,
      summary: {
        total: restoreResults.length,
        successful: successCount,
        failed: failCount
      },
      files: restoreResults,
      message: `Restore completed: ${successCount} files successful, ${failCount} failed`
    });

    res.end();

  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ 
      error: 'Restore failed', 
      details: error.message 
    });
  }
});

// Get restore history
app.get('/api/backup/restore-history', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'kelyn_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const history = await getRestoreHistory();
    res.json(history);
  } catch (error) {
    console.error('Error getting restore history:', error);
    res.status(500).json({ error: 'Failed to get restore history' });
  }
});

// Auto backup configuration endpoints
app.get('/api/backup/auto-config', authenticate, async (req, res) => {
  try {
    const config = await getAutoBackupConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting auto backup config:', error);
    res.status(500).json({ error: 'Failed to get auto backup configuration' });
  }
});

app.post('/api/backup/auto-config', authenticate, async (req, res) => {
  try {
    const { enabled, schedule, time, selectedFiles, fileSelection, googleUserEmail } = req.body;
    
    // Validate input
    if (!['daily', 'weekly', 'monthly'].includes(schedule)) {
      return res.status(400).json({ error: 'Invalid schedule. Must be daily, weekly, or monthly.' });
    }
    
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({ error: 'Invalid time format. Must be HH:MM.' });
    }
    
    if (!['all', 'selected'].includes(selectedFiles)) {
      return res.status(400).json({ error: 'selectedFiles must be "all" or "selected".' });
    }
    
    if (enabled && !googleUserEmail) {
      return res.status(400).json({ error: 'Google user email is required when auto backup is enabled.' });
    }

    // Calculate next backup time
    const nextBackup = enabled ? calculateNextBackupTime(schedule, time) : null;
    
    const config = {
      enabled,
      schedule,
      time,
      selectedFiles,
      fileSelection: selectedFiles === 'selected' ? fileSelection : [],
      googleUserEmail: enabled ? googleUserEmail : null,
      lastBackup: null, // Keep existing lastBackup if updating
      nextBackup
    };

    // If updating existing config, preserve lastBackup
    try {
      const existingConfig = await getAutoBackupConfig();
      if (existingConfig.lastBackup) {
        config.lastBackup = existingConfig.lastBackup;
      }
    } catch (error) {
      // Ignore error if config doesn't exist yet
    }
    
    await saveAutoBackupConfig(config);
    
    res.json({ 
      success: true, 
      message: 'Auto backup configuration saved successfully',
      config 
    });
  } catch (error) {
    console.error('Error saving auto backup config:', error);
    res.status(500).json({ error: 'Failed to save auto backup configuration' });
  }
});

app.post('/api/backup/auto-test', authenticate, async (req, res) => {
  try {
    console.log('🧪 Testing auto backup manually...');
    await performAutoBackup();
    
    res.json({ 
      success: true, 
      message: 'Test auto backup completed successfully' 
    });
  } catch (error) {
    console.error('Error testing auto backup:', error);
    res.status(500).json({ 
      error: 'Test auto backup failed', 
      details: error.message 
    });
  }
});



// Helper functions for backup history and credential management
async function saveBackupHistory(backupEntry) {
  const historyFile = path.join(DATA_DIR, 'backup_history.json');
  
  try {
    let history = [];
    
    // Try to read existing history
    try {
      const existingData = await fs.readFile(historyFile, 'utf8');
      history = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      console.log('No existing backup history found, creating new file');
    }
    
    // Add new entry at the beginning
    history.unshift(backupEntry);
    
    // Keep only the last 50 backups to prevent file from growing too large
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    
    // Save updated history
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    console.log(`Saved backup history entry: ${backupEntry.id}`);
    
  } catch (error) {
    console.error('Error saving backup history:', error);
    throw error;
  }
}

async function getBackupHistory() {
  const historyFile = path.join(DATA_DIR, 'backup_history.json');
  
  try {
    const data = await fs.readFile(historyFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, return empty array
    return [];
  }
}

async function saveGoogleCredentials(email, credentials) {
  const credentialsFile = path.join(DATA_DIR, 'google_credentials.json');
  
  try {
    let allCredentials = {};
    
    // Try to read existing credentials
    try {
      const existingData = await fs.readFile(credentialsFile, 'utf8');
      allCredentials = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist, start with empty object
      console.log('No existing Google credentials found, creating new file');
    }
    
    // Update credentials for this email
    allCredentials[email] = credentials;
    
    // Save updated credentials
    await fs.writeFile(credentialsFile, JSON.stringify(allCredentials, null, 2));
    console.log(`Saved Google credentials for: ${email}`);
    
  } catch (error) {
    console.error('Error saving Google credentials:', error);
    throw error;
  }
}

async function getGoogleCredentials() {
  const credentialsFile = path.join(DATA_DIR, 'google_credentials.json');
  
  try {
    const data = await fs.readFile(credentialsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, return empty object
    return {};
  }
}

async function deleteGoogleCredentials(email) {
  const credentialsFile = path.join(DATA_DIR, 'google_credentials.json');
  
  try {
    let allCredentials = {};
    
    // Try to read existing credentials
    try {
      const existingData = await fs.readFile(credentialsFile, 'utf8');
      allCredentials = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist, nothing to delete
      return;
    }
    
    // Remove credentials for this email
    delete allCredentials[email];
    
    // Save updated credentials
    await fs.writeFile(credentialsFile, JSON.stringify(allCredentials, null, 2));
    console.log(`Deleted Google credentials for: ${email}`);
    
  } catch (error) {
    console.error('Error deleting Google credentials:', error);
    throw error;
  }
}

async function saveRestoreHistory(restoreEntry) {
  const historyFile = path.join(DATA_DIR, 'restore_history.json');
  
  try {
    let history = [];
    
    // Try to read existing history
    try {
      const existingData = await fs.readFile(historyFile, 'utf8');
      history = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      console.log('No existing restore history found, creating new file');
    }
    
    // Add new entry at the beginning
    history.unshift(restoreEntry);
    
    // Keep only the last 50 restores to prevent file from growing too large
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    
    // Save updated history
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    console.log(`Saved restore history entry: ${restoreEntry.id}`);
    
  } catch (error) {
    console.error('Error saving restore history:', error);
    throw error;
  }
}

async function getRestoreHistory() {
  const historyFile = path.join(DATA_DIR, 'restore_history.json');
  
  try {
    const data = await fs.readFile(historyFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, return empty array
    return [];
  }
}

// Auto Backup functionality
let autoBackupSchedule = null;

async function saveAutoBackupConfig(config) {
  const configFile = path.join(DATA_DIR, 'auto_backup_config.json');
  
  try {
    await fs.writeFile(configFile, JSON.stringify(config, null, 2));
    console.log('✅ Auto backup config saved');
  } catch (error) {
    console.error('❌ Error saving auto backup config:', error);
    throw error;
  }
}

async function getAutoBackupConfig() {
  const configFile = path.join(DATA_DIR, 'auto_backup_config.json');
  
  try {
    const data = await fs.readFile(configFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, return default config
    return {
      enabled: false,
      schedule: 'daily',
      time: '02:00',
      selectedFiles: 'all',
      fileSelection: [],
      googleUserEmail: null,
      lastBackup: null,
      nextBackup: null
    };
  }
}

async function performAutoBackup() {
  console.log('🤖 Starting automatic backup...');
  
  try {
    const config = await getAutoBackupConfig();
    
    if (!config.enabled) {
      console.log('🤖 Auto backup is disabled, skipping');
      return;
    }

    // Get Google credentials for the configured user
    const credentials = await getGoogleCredentials();
    console.log('🔑 Available Google credentials:', Object.keys(credentials));
    console.log('🔑 Looking for credentials for:', config.googleUserEmail);
    
    const userCredentials = credentials[config.googleUserEmail];
    
    if (!userCredentials) {
      console.error('❌ No Google credentials found for auto backup user:', config.googleUserEmail);
      console.error('❌ Available users:', Object.keys(credentials));
      console.error('❌ Please sign in with Google and enable auto backup to save credentials');
      return;
    }
    
    console.log('✅ Found Google credentials for auto backup user:', config.googleUserEmail);

    // Get available files
    const availableFiles = [];
    
    // Get JSON files from data directory
    const dataDir = path.join(__dirname, '..', 'data');
    
    try {
      await fs.access(dataDir);
      const files = await fs.readdir(dataDir);
      
      for (const file of files) {
        if (file.endsWith('.json') && 
            file !== 'backup_history.json' && 
            file !== 'google_credentials.json' && 
            file !== 'auto_backup_config.json') {
          availableFiles.push(file);
        }
      }
    } catch (error) {
      console.error('Error reading data directory:', error);
    }

    // Get image files from uploads directory
    const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
    const getImageFiles = async (dir, relativePath = '') => {
      try {
        await fs.access(dir);
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory()) {
            await getImageFiles(fullPath, path.join(relativePath, item));
          } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(path.extname(item).toLowerCase())) {
            availableFiles.push(path.join(relativePath, item));
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
    };
    
    await getImageFiles(uploadsDir);

    // Filter files based on configuration
    let selectedFiles;
    if (config.selectedFiles === 'all') {
      selectedFiles = availableFiles;
    } else {
      selectedFiles = config.fileSelection.filter(file => availableFiles.includes(file));
    }

    console.log(`🤖 Auto backup will process ${selectedFiles.length} files`);

    // Perform the backup using existing backup logic
    const backupResult = await performBackupToGoogleDrive({
      googleAccessToken: userCredentials.accessToken,
      googleUserEmail: config.googleUserEmail,
      googleRefreshToken: userCredentials.refreshToken,
      selectedFiles,
      isAutoBackup: true
    });

    // Update the last backup time
    config.lastBackup = new Date().toISOString();
    config.nextBackup = calculateNextBackupTime(config.schedule, config.time);
    await saveAutoBackupConfig(config);

    console.log('✅ Auto backup completed successfully');
    
  } catch (error) {
    console.error('❌ Auto backup failed:', error);
  }
}

function calculateNextBackupTime(schedule, time) {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  
  console.log(`🕐 Calculating next backup time:`, {
    currentTime: now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
    currentUTC: now.toISOString(),
    scheduledTime: time,
    schedule
  });
  
  let nextBackup = new Date();
  nextBackup.setHours(hours, minutes, 0, 0);
  
  console.log(`🕐 Initial next backup time: ${nextBackup.toLocaleString('en-US', { timeZone: 'America/New_York' })} (${nextBackup.toISOString()})`);
  
  // If the time has already passed today, schedule for the next occurrence
  if (nextBackup <= now) {
    console.log(`🕐 Time has passed, scheduling for next occurrence...`);
    switch (schedule) {
      case 'daily':
        nextBackup.setDate(nextBackup.getDate() + 1);
        break;
      case 'weekly':
        nextBackup.setDate(nextBackup.getDate() + 7);
        break;
      case 'monthly':
        nextBackup.setMonth(nextBackup.getMonth() + 1);
        break;
    }
  }
  
  console.log(`🕐 Final next backup time: ${nextBackup.toLocaleString('en-US', { timeZone: 'America/New_York' })} (${nextBackup.toISOString()})`);
  
  return nextBackup.toISOString();
}

function scheduleAutoBackup() {
  console.log('🤖 Setting up auto backup scheduler...');
  
  // Schedule to check for auto backup every minute
  autoBackupSchedule = cron.schedule('* * * * *', async () => {
    try {
      const config = await getAutoBackupConfig();
      
      if (!config.enabled || !config.nextBackup) {
        return;
      }
      
      const now = new Date();
      const nextBackup = new Date(config.nextBackup);
      const timeDiff = now - nextBackup;
      
      console.log(`🤖 Auto backup check:`, {
        currentTime: now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
        nextBackupTime: nextBackup.toLocaleString('en-US', { timeZone: 'America/New_York' }),
        timeDiffMinutes: Math.round(timeDiff / 60000),
        shouldRun: now >= nextBackup && timeDiff < 60000
      });
      
      // Check if it's time for the next backup (within 1 minute window)
      if (now >= nextBackup && timeDiff < 60000) {
        console.log('🚀 Triggering auto backup now!');
        await performAutoBackup();
      }
    } catch (error) {
      console.error('❌ Error in auto backup scheduler:', error);
    }
  }, {
    scheduled: false
  });
  
  autoBackupSchedule.start();
  console.log('✅ Auto backup scheduler started');
}

async function performBackupToGoogleDrive({ googleAccessToken, googleUserEmail, googleRefreshToken, selectedFiles, isAutoBackup = false }) {
  const backupId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const dateString = timestamp.split('T')[0];
  
  try {
    // Initialize Google Drive API with user's access token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ 
      access_token: googleAccessToken,
      refresh_token: googleRefreshToken 
    });

    const drive = google.drive({ version: 'v3', auth });
    
    // Create backup folder with timestamp and user info
    const userInfo = googleUserEmail ? ` (${googleUserEmail})` : '';
    const autoPrefix = isAutoBackup ? 'Auto ' : '';
    const folderName = `${autoPrefix}Vault Recovery Navigator Backup ${dateString}${userInfo}`;
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    console.log(`📁 Creating ${isAutoBackup ? 'auto ' : ''}backup folder: ${folderName}`);
    
    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });
    
    const folderId = folder.data.id;
    const backupResults = [];
    
    // Initialize backup history entry
    const backupEntry = {
      id: backupId,
      timestamp,
      date: dateString,
      initiatedBy: isAutoBackup ? 'auto-backup' : googleUserEmail,
      googleUserEmail,
      folderId,
      folderName,
      status: 'in_progress',
      totalFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      files: [],
      error: null,
      isAutoBackup
    };
    
    // Filter and process files
    let jsonFiles = [];
    let allImageFiles = [];
    
    if (selectedFiles && selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        if (file.endsWith('.json')) {
          jsonFiles.push(file);
        } else {
          allImageFiles.push(file);
        }
      }
    }
    
    const totalFiles = jsonFiles.length + allImageFiles.length;
    backupEntry.totalFiles = totalFiles;
    let processedFiles = 0;
    
    console.log(`📊 Auto backup processing: ${jsonFiles.length} JSON files, ${allImageFiles.length} image files`);
    
    // Backup JSON files
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(DATA_DIR, file);
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        const fileMetadata = {
          name: file,
          parents: [folderId]
        };
        
        const media = {
          mimeType: 'application/json',
          body: fileContent
        };
        
        const uploadedFile = await drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: 'id,name'
        });
        
        const result = {
          name: file,
          type: 'json',
          fileId: uploadedFile.data.id,
          status: 'success'
        };
        
        backupResults.push(result);
        backupEntry.files.push(result);
        backupEntry.successfulFiles++;
        processedFiles++;
        
        console.log(`✅ Auto backup - JSON: ${file}`);
      } catch (error) {
        console.error(`❌ Auto backup failed - JSON ${file}:`, error.message);
        const result = {
          name: file,
          type: 'json',
          status: 'failed',
          error: error.message
        };
        backupResults.push(result);
        backupEntry.files.push(result);
        backupEntry.failedFiles++;
        processedFiles++;
      }
    }
    
    // Backup image files
    for (const relativePath of allImageFiles) {
      try {
        const fullPath = path.join(UPLOADS_DIR, relativePath);
        const stat = await fs.stat(fullPath);
        
        const fileMetadata = {
          name: path.basename(relativePath),
          parents: [folderId]
        };
        
        const media = {
          mimeType: 'application/octet-stream',
          body: require('fs').createReadStream(fullPath)
        };
        
        const uploadedFile = await drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: 'id,name'
        });
        
        const result = {
          name: relativePath,
          type: 'image',
          size: stat.size,
          fileId: uploadedFile.data.id,
          status: 'success'
        };
        
        backupResults.push(result);
        backupEntry.files.push(result);
        backupEntry.successfulFiles++;
        processedFiles++;
        
        console.log(`✅ Auto backup - Image: ${relativePath}`);
      } catch (error) {
        console.error(`❌ Auto backup failed - Image ${relativePath}:`, error.message);
        const result = {
          name: relativePath,
          type: 'image',
          status: 'failed',
          error: error.message
        };
        backupResults.push(result);
        backupEntry.files.push(result);
        backupEntry.failedFiles++;
        processedFiles++;
      }
    }
    
    // Update backup status to completed
    backupEntry.status = 'completed';
    backupEntry.completedAt = new Date().toISOString();
    
    // Save backup history
    await saveBackupHistory(backupEntry);
    
    const successCount = backupResults.filter(r => r.status === 'success').length;
    const failCount = backupResults.filter(r => r.status === 'failed').length;
    
    console.log(`✅ Auto backup completed: ${successCount} files successful, ${failCount} failed`);
    
    return {
      success: true,
      backupId,
      folderId,
      folderName,
      summary: {
        total: backupResults.length,
        successful: successCount,
        failed: failCount
      },
      files: backupResults
    };
    
  } catch (error) {
    console.error('❌ Auto backup error:', error);
    
    // Save failed backup to history
    try {
      const failedEntry = {
        id: backupId,
        timestamp: new Date().toISOString(),
        date: dateString,
        initiatedBy: isAutoBackup ? 'auto-backup' : googleUserEmail,
        googleUserEmail,
        status: 'failed',
        error: error.message,
        totalFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        files: [],
        isAutoBackup
      };
      await saveBackupHistory(failedEntry);
    } catch (historyError) {
      console.error('Failed to save backup history:', historyError);
    }
    
    throw error;
  }
}

// ... existing code ... 
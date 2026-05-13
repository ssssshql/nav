require('dotenv').config();
const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const cors = require('koa-cors');
const serve = require('koa-static');
const path = require('path');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const fs = require('fs');
const fetch = require('node-fetch');
const axios = require('axios');
const cheerio = require('cheerio');
const { initDB, getDB } = require('./models');

const app = new Koa();
const router = new Router();
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-me';
const isDocker = fs.existsSync('/.dockerenv');
const DATA_DIR = process.env.DATA_DIR || (isDocker ? '/app/data' : path.join(__dirname, 'data'));
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const ICONS_DIR = path.join(DATA_DIR, 'icons');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Try to load config and init DB (with retry for container startup timing)
let isDBInitialized = false;
let dbInitPromise = null;

async function tryInitDB(retries = 10, delay = 3000) {
  if (!fs.existsSync(CONFIG_FILE)) return;
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  for (let i = 0; i < retries; i++) {
    try {
      await initDB(config);
      await getDB().sequelize.sync({ alter: true });
      console.log('Database connected and synced');
      isDBInitialized = true;
      return;
    } catch (e) {
      console.error(`DB init attempt ${i + 1}/${retries} failed: ${e.message}`);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.error('All DB init attempts failed. App will stay in setup mode.');
}

dbInitPromise = tryInitDB();

app.use(cors());
app.use(bodyParser({
  jsonLimit: '50mb',
  onerror: (err, ctx) => {
    console.error('[bodyParser] Error:', err.message)
    ctx.throw(400, 'invalid json')
  }
}));

// Serve icons statically at /data/icons
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/data/icons/')) {
    const filename = ctx.path.replace('/data/icons/', '');
    const filepath = path.join(ICONS_DIR, filename);
    if (fs.existsSync(filepath)) {
      ctx.type = path.extname(filepath);
      ctx.body = fs.createReadStream(filepath);
      return;
    }
  }
  await next();
});

// Middleware to check auth
const authMiddleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '')
  console.log('[auth] Token:', token ? 'present' : 'missing')
  if (!token) {
    ctx.status = 401;
    ctx.body = { error: 'Unauthorized' };
    return;
  }
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    // Simple role check (just existence)
    if (decoded.role !== 'admin') {
        throw new Error('Invalid role');
    }
    await next();
  } catch (err) {
    console.log('[auth] Error:', err.message)
    ctx.status = 401;
    ctx.body = { error: 'Invalid token' };
  }
};

// Helper to fetch favicon from website URL
async function getFaviconFromWebsite(websiteUrl, ctx) {
  try {
    // Fetch the website
    const response = await axios.get(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000,
      validateStatus: () => true
    });

    if (response.status !== 200) {
      return null;
    }

    const html = response.data;
    const $ = cheerio.load(html);
    
    const iconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]', 
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]'
    ];
    
    let iconUrl = null;
    for (const selector of iconSelectors) {
      const href = $(selector).first().attr('href');
      if (href) {
        iconUrl = href;
        break;
      }
    }

    // Handle relative URLs
    if (iconUrl && !iconUrl.startsWith('http')) {
      const u = new URL(websiteUrl);
      if (iconUrl.startsWith('/')) {
        iconUrl = `${u.origin}${iconUrl}`;
      } else {
        iconUrl = new URL(iconUrl, u.origin).href;
      }
    }

    // If no icon found, try default favicon.ico
    if (!iconUrl) {
      const u = new URL(websiteUrl);
      iconUrl = `${u.origin}/favicon.ico`;
    }

    console.log(`[getFavicon] ${websiteUrl} -> ${iconUrl}`);

    // Download icon
    const iconResponse = await axios.get(iconUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      validateStatus: () => true
    });

    if (iconResponse.status !== 200) {
      return null;
    }

    const contentType = iconResponse.headers['content-type'] || 'image/png';
    // Extract extension, handle special cases like svg+xml
    let ext = contentType.split('/')[1]?.split(';')[0] || 'png';
    if (ext.includes('+')) {
      ext = ext.split('+')[0]; // svg+xml -> svg
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filepath = path.join(ICONS_DIR, filename);

    fs.writeFileSync(filepath, iconResponse.data);
    
    // Return relative path
    return `/data/icons/${filename}`;
  } catch (e) {
    console.error(`[getFavicon] Error: ${e.message}, URL: ${websiteUrl}`);
    return null;
  }
}

// Public: Fetch Favicon from website URL
router.post('/api/fetch-favicon', async (ctx) => {
  const { url } = ctx.request.body;
  if (!url) {
    ctx.status = 400;
    ctx.body = { error: 'URL required' };
    return;
  }
  try {
    const icon = await getFaviconFromWebsite(url, ctx);
    ctx.body = { icon };
  } catch (e) {
    console.error('[fetch-favicon] Error:', e.message)
    ctx.status = 500
    ctx.body = { error: e.message }
  }
});

// Check if setup is required
router.get('/api/setup-status', async (ctx) => {
  // 等待 DB 初始化完成（如有）
  if (dbInitPromise) {
    await dbInitPromise;
  }
  if (!isDBInitialized) {
    ctx.body = { setupRequired: true, reason: 'db_not_configured' };
    return;
  }
  const { SystemConfig } = getDB();
  try {
    const configCount = await SystemConfig.count();
    ctx.body = { setupRequired: configCount === 0 };
  } catch (e) {
    ctx.body = { setupRequired: true, reason: 'db_error' };
  }
});

// Initial Setup (DB + 2FA Generation)
router.post('/api/setup', async (ctx) => {
  if (isDBInitialized) {
    const { SystemConfig } = getDB();
    const configCount = await SystemConfig.count();
    if (configCount > 0) {
      ctx.status = 403;
      ctx.body = { error: 'Setup already completed' };
      return;
    }
  }
  
  const { dbHost, dbPort, dbName, dbUser, dbPassword } = ctx.request.body;
  
  if (!dbHost) {
    ctx.status = 400;
    ctx.body = { error: 'Missing required fields' };
    return;
  }

  const dbConfig = {
    host: dbHost,
    port: dbPort || 3306,
    database: dbName || 'nav',
    username: dbUser || 'root',
    password: dbPassword || ''
  };

  try {
    const { sequelize, SystemConfig } = await initDB(dbConfig);
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    
    // Check if SystemConfig already exists
    const existingConfig = await SystemConfig.findOne();
    let secret;
    
    if (existingConfig && existingConfig.twoFactorSecret) {
      // Use existing secret
      secret = existingConfig.twoFactorSecret;
    } else {
      // Generate new 2FA secret
      secret = authenticator.generateSecret();
      await SystemConfig.create({
        twoFactorSecret: secret
      });
    }

    // Save config
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(dbConfig, null, 2));
    isDBInitialized = true;

    const otpauth = authenticator.keyuri('admin', 'Nexus', secret);
    const qrImageUrl = await qrcode.toDataURL(otpauth);

    ctx.body = { qrCode: qrImageUrl, secret };
  } catch (e) {
    console.error(e);
    ctx.status = 400;
    ctx.body = { error: 'Setup failed: ' + e.message };
    if (!fs.existsSync(CONFIG_FILE)) {
      isDBInitialized = false;
    }
  }
});

// Login (Verify 2FA Code only)
router.post('/api/login', async (ctx) => {
  if (!isDBInitialized) {
    ctx.status = 503;
    ctx.body = { error: 'Database not configured' };
    return;
  }
  const { SystemConfig } = getDB();
  const { token } = ctx.request.body; // 2FA code
  
  const config = await SystemConfig.findOne();

  if (!config) {
    ctx.status = 500;
    ctx.body = { error: 'System not initialized' };
    return;
  }

  try {
    const verified = authenticator.check(token, config.twoFactorSecret);
    if (!verified) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid 2FA code' };
      return;
    }
  } catch (err) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid 2FA code' };
    return;
  }

  const jwtToken = jwt.sign({ role: 'admin' }, SECRET_KEY, { expiresIn: '7d' });
  ctx.body = { token: jwtToken };
});

// Protected: Get current user info (validates token)
router.get('/api/user-info', authMiddleware, async (ctx) => {
  ctx.body = { role: 'admin' };
});

// Public: Cache external icon URL to local
router.post('/api/cache-icon', async (ctx) => {
  const { iconUrl } = ctx.request.body;
  if (!iconUrl) {
    ctx.status = 400;
    ctx.body = { error: 'Icon URL required' };
    return;
  }
  
  // Skip if already a local path
  if (iconUrl.startsWith('/data/')) {
    ctx.body = { icon: iconUrl };
    return;
  }
  
  try {
    // Download the icon
    const iconResponse = await axios.get(iconUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      validateStatus: () => true
    });

    if (iconResponse.status !== 200) {
      ctx.status = 400;
      ctx.body = { error: 'Failed to download icon' };
      return;
    }

    const contentType = iconResponse.headers['content-type'] || 'image/png';
    // Extract extension, handle special cases like svg+xml
    let ext = contentType.split('/')[1]?.split(';')[0] || 'png';
    if (ext.includes('+')) {
      ext = ext.split('+')[0]; // svg+xml -> svg
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filepath = path.join(ICONS_DIR, filename);

    fs.writeFileSync(filepath, iconResponse.data);
    
    ctx.body = { icon: `/data/icons/${filename}` };
  } catch (e) {
    console.error('[cache-icon] Error:', e.message);
    ctx.status = 500;
    ctx.body = { error: 'Failed to cache icon: ' + e.message };
  }
});

// Protected: Upload Icon
const multer = require('koa-multer');
const storage = multer.diskStorage({
  destination: ICONS_DIR,
  filename: (ctx, file, cb) => {
    const ext = file.originalname.split('.').pop() || 'png';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  }
});
const upload = multer({ storage });

router.post('/api/upload-icon', authMiddleware, upload.single('icon'), async (ctx) => {
  if (!ctx.file) {
    ctx.status = 400;
    ctx.body = { error: 'No file uploaded' };
    return;
  }
  const iconUrl = `/data/icons/${ctx.file.filename}`;
  ctx.body = { icon: iconUrl };
});

// Migrate base64 icon to file
async function migrateIcon(site) {
  if (!site.icon || !site.icon.startsWith('data:')) return site.icon;
  
  try {
    const base64Data = site.icon.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = site.icon.includes('image/svg') ? 'svg' : 'png';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filepath = path.join(ICONS_DIR, filename);
    
    fs.writeFileSync(filepath, buffer);
    
    await site.update({ icon: `/data/icons/${filename}` });
    console.log(`[migrate] Migrated icon for site: ${site.title}`);
    return `/data/icons/${filename}`;
  } catch (e) {
    console.error(`[migrate] Error: ${e.message}`);
    return site.icon;
  }
}

// Public: Get Sites
router.get('/api/sites', async (ctx) => {
  if (!isDBInitialized) {
    ctx.body = [];
    return;
  }
  const { Site } = getDB();
  try {
    const sites = await Site.findAll();
    // Migrate base64 icons to files
    for (const site of sites) {
      if (site.icon && site.icon.startsWith('data:')) {
        site.icon = await migrateIcon(site);
      }
    }
    ctx.body = sites;
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: 'Database error' };
  }
});

// Protected: Add Site
router.post('/api/sites', authMiddleware, async (ctx) => {
  console.log('[sites] Body:', ctx.request.body)
  const { Site } = getDB();
  const { title, url, icon, category } = ctx.request.body;
  if (!title || !url) {
      ctx.status = 400;
      ctx.body = { error: 'Title and URL required' };
      return;
  }
  const site = await Site.create({ 
      title, 
      url, 
      icon: icon || '', 
      category: category || '其他' 
  });
  ctx.body = site;
});

// Protected: Delete Site
router.delete('/api/sites/:id', authMiddleware, async (ctx) => {
  const { Site } = getDB();
  const { id } = ctx.params;
  const site = await Site.findByPk(id);
  if (site) {
    await site.destroy();
  }
  ctx.body = { success: true };
});

// Protected: Update Site
router.put('/api/sites/:id', authMiddleware, async (ctx) => {
  const { Site } = getDB();
  const { id } = ctx.params;
  const { title, url, icon, category } = ctx.request.body;
  
  const site = await Site.findByPk(id);
  if (!site) {
    ctx.status = 404;
    ctx.body = { error: 'Site not found' };
    return;
  }
  
  await site.update({
    title,
    url,
    icon: icon || '',
    category: category || '其他'
  });
  
  ctx.body = site;
});

app.use(router.routes()).use(router.allowedMethods());

const staticPath = path.join(__dirname, '../client/dist');
app.use(serve(staticPath));

app.use(async (ctx) => {
  if (ctx.status === 404 && ctx.method === 'GET' && !ctx.path.startsWith('/api')) {
    ctx.type = 'html';
    const fs = require('fs');
    try {
      ctx.body = fs.createReadStream(path.join(staticPath, 'index.html'));
    } catch (e) {
      ctx.body = "Frontend not built or not found.";
    }
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:3000');
});

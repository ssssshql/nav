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
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');

// Ensure data dir exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Try to load config and init DB
let isDBInitialized = false;
if (fs.existsSync(CONFIG_FILE)) {
  (async () => {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      await initDB(config);
      await getDB().sequelize.sync({ alter: true }); // Sync schema
      console.log('Database connected and synced');
      isDBInitialized = true;
    } catch (e) {
      console.error('Failed to load config or connect DB:', e);
    }
  })();
}

app.use(cors());
app.use(bodyParser());

// Middleware to check auth
const authMiddleware = async (ctx, next) => {
  if (!isDBInitialized) {
    ctx.status = 503;
    ctx.body = { error: 'Service unavailable: Database not configured' };
    return;
  }
  
  const token = ctx.headers.authorization?.split(' ')[1];
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
    ctx.status = 401;
    ctx.body = { error: 'Invalid token' };
  }
};

// Helper to fetch favicon
async function getFavicon(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Check for all icon link types
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
      const u = new URL(url);
      if (iconUrl.startsWith('/')) {
        // Absolute path like /assets/img/favicon.svg
        iconUrl = `${u.origin}${iconUrl}`;
      } else {
        // Relative path
        iconUrl = new URL(iconUrl, u.origin).href;
      }
    }

    console.log(`[getFavicon] ${url} -> ${iconUrl}`);
    
    // Return null if no icon found (let frontend handle fallback)
    if (!iconUrl) {
      return null;
    }
    
    return iconUrl;
  } catch (e) {
    console.error(`[getFavicon] Error: ${e.message}`);
    return null;
  }
}

// Check if setup is required
router.get('/api/setup-status', async (ctx) => {
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
    
    // Generate 2FA secret
    const secret = authenticator.generateSecret();
    await SystemConfig.create({
      twoFactorSecret: secret
    });

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

// Public: Fetch Favicon
router.post('/api/fetch-favicon', async (ctx) => {
  const { url } = ctx.request.body;
  if (!url) {
    ctx.status = 400;
    ctx.body = { error: 'URL required' };
    return;
  }
  const icon = await getFavicon(url);
  ctx.body = { icon };
});

// Public: Get Sites
router.get('/api/sites', async (ctx) => {
  if (!isDBInitialized) {
    ctx.body = [];
    return;
  }
  const { Site } = getDB();
  try {
    const sites = await Site.findAll();
    ctx.body = sites;
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: 'Database error' };
  }
});

// Protected: Add Site
router.post('/api/sites', authMiddleware, async (ctx) => {
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

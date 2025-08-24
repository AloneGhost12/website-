// In-memory OTP and chat history store (for demo; use Redis/DB in production)
const otpStore = {};
const otpExpiry = 10 * 60 * 1000; // 10 minutes
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';

// CORS configuration
const defaultOrigins = 'http://127.0.0.1:5500,http://localhost:5500,https://website-0c1h.onrender.com';
const allowedOrigins = (process.env.CORS_ORIGINS || defaultOrigins)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, cb){
    if(!origin) return cb(null, true); // non-browser or same-origin
    if(allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','X-Admin-Key','Authorization'],
  credentials: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
// Static uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if(!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer storage for avatars
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `avatar_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// Mongo connection
const uri = process.env.MONGODB_URI;
if(!uri){
  console.error('Missing MONGODB_URI in .env');
}
mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'tidex' })
  .then(()=> console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// Models
const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true },
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  line1: { type: String, trim: true },
  line2: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  zip: { type: String, trim: true },
  country: { type: String, trim: true },
  isDefault: { type: Boolean, default: false }
}, { _id: true, timestamps: false });

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, trim: true, unique: true, sparse: true },
  banned: { type: Boolean, default: false },
  banUntil: { type: Date, default: null },
  addresses: { type: [addressSchema], default: [] },
  profilePicUrl: { type: String, default: '' },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const newsletterSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
}, { timestamps: true });
const Newsletter = mongoose.model('Newsletter', newsletterSchema);

// Product model
const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  cat: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  img: { type: String, trim: true },
  stock: { type: Number, default: 0, min: 0 },
  description: { type: String, trim: true },
}, { timestamps: true });
const Product = mongoose.model('Product', productSchema);

// Order model (basic)
const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  title: String,
  price: Number,
  qty: Number,
});
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  status: { type: String, enum: ['pending','paid','shipped','cancelled'], default: 'pending' },
}, { timestamps: true });
const Order = mongoose.model('Order', orderSchema);

// Reviews
const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, trim: true },
  replies: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
const Review = mongoose.model('Review', reviewSchema);

// Announcements (admin broadcast)
const announcementSchema = new mongoose.Schema({
  subject: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', announcementSchema);

// Admin auth middleware
function requireAdmin(req, res, next){
  const key = req.get('X-Admin-Key');
  if(!ADMIN_KEY){
    console.warn('ADMIN_KEY not set. Admin routes are disabled.');
    return res.status(503).json({ error: 'Admin not configured' });
  }
  if(!key || key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Routes
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function issueToken(user){
  return jwt.sign({ sub: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}
async function auth(req, res, next){
  const hdr = req.get('Authorization')||'';
  const [,token] = hdr.split(' ');
  if(!token) return res.status(401).json({ error: 'Missing token' });
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  }catch(e){ return res.status(401).json({ error: 'Invalid token' }); }
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/signup', async (req, res) => {
  try{
    let { name, email, password, username, phone } = req.body || {};
    if(!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    if(password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if(username) username = String(username).toLowerCase().trim();
    if(email) email = String(email).toLowerCase().trim();
    if(phone) phone = String(phone).trim();
    const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, username, phone, passwordHash });
  // Welcome flag so frontend can show notice once
  res.status(201).json({ id: user._id, name: user.name, email: user.email, token: issueToken(user), welcome: true });
  }catch(err){
    if(err.code === 11000) return res.status(409).json({ error: 'Email already in use.' });
    console.error(err); res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try{
    let { identifier, email, password } = req.body || {};
    if(!password) return res.status(400).json({ error: 'Password is required.' });
    identifier = identifier || email; // backward compat
    if(!identifier) return res.status(400).json({ error: 'Identifier is required.' });
    const ident = String(identifier).trim();
    const query = {
      $or: [
        { email: ident.toLowerCase() },
        { username: ident.toLowerCase() },
        { phone: ident }
      ]
    };
    const user = await User.findOne(query);
    if(!user) return res.status(401).json({ error: 'Invalid credentials.' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(401).json({ error: 'Invalid credentials.' });
  res.json({ id: user._id, name: user.name, email: user.email, token: issueToken(user) });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Admin credential login -> returns Admin Key to use with admin UI
app.post('/api/admin/login', async (req, res) => {
  try{
    const { username, password } = req.body || {};
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;
    if(!ADMIN_KEY || !adminUser || !adminPass){
      return res.status(503).json({ error: 'Admin login not configured' });
    }
    if(username === adminUser && password === adminPass){
      return res.json({ key: ADMIN_KEY });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Authenticated user endpoints
app.get('/api/me', auth, async (req, res) => {
  const u = await User.findById(req.userId);
  if(!u) return res.status(404).json({ error: 'User not found' });
  res.json({ id: u._id, name: u.name, email: u.email, profilePicUrl: u.profilePicUrl || '' });
});

app.patch('/api/user', auth, async (req, res) => {
  try{
  const { name } = req.body || {};
  const u = await User.findByIdAndUpdate(req.userId, { name: name || undefined }, { new: true });
    if(!u) return res.status(404).json({ error: 'User not found' });
  res.json({ id: u._id, name: u.name, email: u.email, profilePicUrl: u.profilePicUrl || '' });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

app.post('/api/user/password', auth, async (req, res) => {
  try{
  const { current, next } = req.body || {};
  if(!current || !next) return res.status(400).json({ error: 'Missing fields' });
  const u = await User.findById(req.userId);
    if(!u) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(current, u.passwordHash);
    if(!ok) return res.status(401).json({ error: 'Invalid current password' });
    u.passwordHash = await bcrypt.hash(next, 10);
    await u.save();
    res.json({ ok: true });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Upload profile picture
app.post('/api/user/profile-pic', auth, upload.single('file'), async (req, res) => {
  try{
    if(!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const u = await User.findById(req.userId);
    if(!u) return res.status(404).json({ error: 'User not found' });
    // Remove old file if exists
    if(u.profilePicUrl){
      const oldPath = path.join(__dirname, u.profilePicUrl.replace('/uploads/','uploads/'));
      if(fs.existsSync(oldPath)){
        try{ fs.unlinkSync(oldPath); }catch{}
      }
    }
    const publicUrl = `/uploads/${req.file.filename}`;
    u.profilePicUrl = publicUrl;
    await u.save();
    res.json({ ok: true, profilePicUrl: publicUrl });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Delete profile picture
app.delete('/api/user/profile-pic', auth, async (req, res) => {
  try{
    const u = await User.findById(req.userId);
    if(!u) return res.status(404).json({ error: 'User not found' });
    if(u.profilePicUrl){
      const oldPath = path.join(__dirname, u.profilePicUrl.replace('/uploads/','uploads/'));
      if(fs.existsSync(oldPath)){
        try{ fs.unlinkSync(oldPath); }catch{}
      }
    }
    u.profilePicUrl = '';
    await u.save();
    res.json({ ok: true });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// User addresses
app.get('/api/user/addresses', auth, async (req, res) => {
  const u = await User.findById(req.userId).lean();
  if(!u) return res.status(404).json({ error: 'User not found' });
  res.json(u.addresses || []);
});

app.post('/api/user/addresses', auth, async (req, res) => {
  try{
    const addr = req.body || {};
    const u = await User.findById(req.userId);
    if(!u) return res.status(404).json({ error: 'User not found' });
    if(addr.isDefault){
      // clear existing defaults
      u.addresses.forEach(a => a.isDefault = false);
    }
    u.addresses.push(addr);
    await u.save();
    const saved = u.addresses[u.addresses.length - 1];
    res.status(201).json(saved);
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

app.delete('/api/user/addresses/:addrId', auth, async (req, res) => {
  try{
    const { addrId } = req.params;
    const u = await User.findById(req.userId);
    if(!u) return res.status(404).json({ error: 'User not found' });
    const before = u.addresses.length;
    u.addresses = u.addresses.filter(a => a._id.toString() !== addrId);
    if(u.addresses.length === before) return res.status(404).json({ error: 'Address not found' });
    await u.save();
    res.json({ ok: true });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

app.patch('/api/user/addresses/:addrId/default', auth, async (req, res) => {
  try{
    const { addrId } = req.params;
    const u = await User.findById(req.userId);
    if(!u) return res.status(404).json({ error: 'User not found' });
    let found = false;
    u.addresses.forEach(a => {
      if(a._id.toString() === addrId){ a.isDefault = true; found = true; }
      else { a.isDefault = false; }
    });
    if(!found) return res.status(404).json({ error: 'Address not found' });
    await u.save();
    res.json(u.addresses);
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Delete own account
app.delete('/api/user', auth, async (req, res) => {
  try{
    await User.findByIdAndDelete(req.userId);
    // Optionally also delete user's orders
    await Order.deleteMany({ userId: req.userId });
    res.json({ ok: true });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

app.post('/api/newsletter', async (req, res) => {
  try{
    const { email } = req.body || {};
    if(!email) return res.status(400).json({ error: 'Email is required.' });
    const doc = await Newsletter.findOneAndUpdate({ email }, { email }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.status(201).json({ ok: true, id: doc._id });
  }catch(err){
    console.error(err); res.status(500).json({ error: 'Internal error' });
  }
});

// Public products list
app.get('/api/products', async (req, res) => {
  const list = await Product.find().sort({ createdAt: -1 }).limit(200);
  res.json(list);
});

app.get('/api/products/:id', async (req, res) => {
  try{
    const p = await Product.findById(req.params.id);
    if(!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  }catch(err){ res.status(404).json({ error: 'Not found' }); }
});

// Create order (checkout)
app.post('/api/orders', auth, async (req, res) => {
  try{
    const { items } = req.body || {};
    if(!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items' });
    // Compute subtotal server-side
    const subtotal = items.reduce((s, it) => s + (Number(it.price)||0) * (Number(it.qty)||0), 0);
    const orderItems = items.map(it => ({
      productId: it.productId || undefined,
      title: it.title,
      price: Number(it.price)||0,
      qty: Number(it.qty)||0,
    }));
    const order = await Order.create({ userId: req.userId, items: orderItems, subtotal, status: 'pending' });
    res.status(201).json(order);
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Current user's orders
app.get('/api/my/orders', auth, async (req, res) => {
  try{
    const list = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(list);
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Reviews endpoints
// List reviews for a product
app.get('/api/products/:id/reviews', async (req, res) => {
  const list = await Review.find({ productId: req.params.id }).sort({ createdAt: -1 }).limit(200);
  res.json(list);
});
// Add a review (user)
app.post('/api/products/:id/reviews', auth, async (req, res) => {
  try{
    const { rating, text } = req.body || {};
    if(!rating) return res.status(400).json({ error: 'Rating required' });
    const u = await User.findById(req.userId);
    if(!u) return res.status(401).json({ error: 'Unauthorized' });
    const doc = await Review.create({ productId: req.params.id, userId: u._id, userName: u.name || u.email, rating, text });
    res.status(201).json(doc);
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});
// Reply to a review (user or admin)
app.post('/api/reviews/:rid/replies', auth, async (req, res) => {
  try{
    const { text } = req.body || {};
    if(!text) return res.status(400).json({ error: 'Text required' });
    const u = await User.findById(req.userId);
    const rv = await Review.findById(req.params.rid);
    if(!rv) return res.status(404).json({ error: 'Not found' });
    rv.replies.push({ userId: u?._id, userName: u?.name || u?.email || 'Admin', text });
    await rv.save();
    res.json(rv);
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});
// Admin delete review
app.delete('/api/admin/reviews/:rid', requireAdmin, async (req, res) => {
  try{ await Review.findByIdAndDelete(req.params.rid); res.json({ ok: true }); }
  catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Announcements
// Create announcement and optionally email all newsletter subscribers
app.post('/api/admin/announce', requireAdmin, async (req, res) => {
  const { subject, message, emailAll } = req.body || {};
  if(!subject || !message) return res.status(400).json({ error: 'Missing subject/message' });
  const doc = await Announcement.create({ subject, message });
  if(emailAll){
    try{
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT||587),
        secure: false,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });
      const subs = await Newsletter.find().limit(1000);
      const toList = subs.map(s=>s.email).filter(Boolean);
      if(toList.length){
        await transporter.sendMail({ from: process.env.MAIL_FROM || 'no-reply@tidex.local', bcc: toList, subject, text: message });
      }
    }catch(e){ console.warn('Email send failed:', e.message); }
  }
  res.status(201).json(doc);
});
// List announcements
app.get('/api/announcements', async (req, res) => {
  const list = await Announcement.find().sort({ createdAt: -1 }).limit(20);
  res.json(list);
});

// Forgot-password OTP: send code
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if(!email) return res.status(400).json({ error: 'Email required' });
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if(!user) return res.status(404).json({ error: 'No user with that email' });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore[email] = { otp, expires: Date.now() + otpExpiry };
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT||587),
        secure: false,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'no-reply@tidex.local',
        to: email,
        subject: 'Tidex Password Reset OTP',
        text: `Your Tidex password reset OTP is: ${otp}\nThis code is valid for 10 minutes.`
      });
    } catch(e) {
      console.warn('OTP email send failed:', e.message);
      return res.status(500).json({ error: 'Failed to send email' });
    }
    res.json({ ok: true });
  } catch(err) {
    console.error(err); res.status(500).json({ error: 'Internal error' });
  }
});

// Reset password with OTP
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if(!email || !otp || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    const entry = otpStore[email];
    if(!entry || entry.otp !== otp || Date.now() > entry.expires) return res.status(400).json({ error: 'Invalid or expired OTP' });
    if(newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if(!user) return res.status(404).json({ error: 'User not found' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    delete otpStore[email];
    res.json({ ok: true });
  } catch(err) {
    console.error(err); res.status(500).json({ error: 'Internal error' });
  }
});

// Simple rule-based chatbot endpoint
app.post('/api/chat', async (req, res) => {
  try{
    const { message, history } = req.body || {};
    const qRaw = String(message || '');
    const q = qRaw.toLowerCase();

    // Optional personalization if user is authenticated
    let me = null;
    const hdr = req.get('Authorization')||'';
    const [,token] = hdr.split(' ');
    if(token){
      try{ const p = jwt.verify(token, JWT_SECRET); me = await User.findById(p.sub).lean(); }catch{}
    }

    // Simple follow-up context using last user question
    const lastUser = Array.isArray(history) ? history.slice().reverse().find(m=>m.role==='user') : null;

    const links = {
      orders: `${req.protocol}://${req.get('host')}/account.html`,
      home: `${req.protocol}://${req.get('host')}/index.html`,
      login: `${req.protocol}://${req.get('host')}/login.html`,
      forgot: `${req.protocol}://${req.get('host')}/forgot-password.html`,
      account: `${req.protocol}://${req.get('host')}/account.html`,
    };

    // Personalized order status hint if asked
    if(/order.*(status|track|tracking)|track.*order/.test(q)){
      let prefix = 'You can check your order status in Account → Orders';
      if(me){
        const recent = await Order.findOne({ userId: me._id }).sort({ createdAt: -1 }).lean();
        if(recent){
          prefix = `Your latest order (${String(recent._id).slice(-6)}) is currently “${recent.status}”.`;
        }
      }
      return res.json({ answer: `${prefix}. Open: ${links.orders}` });
    }

    const replies = [
      { re: /(shipping|delivery|ship|arrive|when)/, ans: `Shipping typically takes 3-7 days depending on your location. You'll receive tracking after dispatch. See products on ${links.home}` },
      { re: /(return|refund|exchange)/, ans: `Returns are accepted within 7 days of delivery if unused and in original packaging. Start from Account → Orders (${links.account}).` },
      { re: /(payment|pay|card|upi|cod|cash on delivery)/, ans: 'We accept cards, UPI, and wallets. Cash on delivery isn\'t available right now.' },
      { re: /(account|profile|password|login|signup|sign up|sign-in)/, ans: `Manage your profile and password in Account (${links.account}). Use “Forgot password” to reset via OTP email (${links.forgot}).` },
      { re: /(contact|support|help|admin)/, ans: 'Reach support via the announcements mailbox or email. Admin tasks are in the Admin panel (requires admin key).' },
      { re: /(products?|item|price|stock|available)/, ans: `Browse products on the home page (${links.home}). Each product page shows price, rating, and availability.` },
    ];
    const found = replies.find(r => r.re.test(q));
    if(found) return res.json({ answer: found.ans });

    // Follow-up nudges
    if(lastUser && /that|it|this/.test(q) && /order|return|shipping/.test(lastUser.text||'')){
      return res.json({ answer: 'If you meant your previous question, you can find details under Account → Orders.' });
    }

    const fallback = 'I can help with shipping, returns, orders, account, and products. Try “What is your return policy?”';
    res.json({ answer: fallback });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Admin products
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try{
    const { title, cat, price, rating, img, stock, description } = req.body || {};
    if(!title || !cat || typeof price !== 'number') return res.status(400).json({ error: 'Missing fields: title, cat, price' });
    const doc = await Product.create({ title, cat, price, rating, img, stock, description });
    res.status(201).json(doc);
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try{
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    res.json({ ok: true });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Admin users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(500);
  res.json(users.map(u => ({ id: u._id, name: u.name, email: u.email, banned: u.banned, banUntil: u.banUntil, createdAt: u.createdAt })));
});

app.patch('/api/admin/users/:id/ban', requireAdmin, async (req, res) => {
  try{
    const { id } = req.params; const { action, until } = req.body || {};
    let update = {};
    if(action === 'ban') update = { banned: true, banUntil: null };
    else if(action === 'unban') update = { banned: false, banUntil: null };
    else if(action === 'temp') update = { banned: true, banUntil: until ? new Date(until) : new Date(Date.now()+7*24*3600*1000) };
    else return res.status(400).json({ error: 'Invalid action' });
    const u = await User.findByIdAndUpdate(id, update, { new: true });
    res.json({ id: u._id, banned: u.banned, banUntil: u.banUntil });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try{ await User.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

// Admin orders
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(500);
  res.json(orders);
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try{
    const { status } = req.body || {};
    const allowed = ['pending','paid','shipped','cancelled'];
    if(!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const o = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(o);
  }catch(err){ console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

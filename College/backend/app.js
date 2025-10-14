import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
//import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import winston from 'winston';
import { body, validationResult } from 'express-validator';
import adminRoutes from './routes/admin/adminRoutes.js';
import authRoutes from './routes/auth/authRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import staffRoutes from './routes/staff/staffRoutes.js';
import attendanceRoutes from './routes/staff/staffattendanceroutes.js';
import adminattendance from './routes/admin/adminattendanceroutes.js';

dotenv.config({ path: './config.env' });

const app = express();

// Structured logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// HTTPS redirection
app.use((req, res, next) => {
  if (req.protocol === 'http' && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173'],
      imgSrc: ["'self'", 'data:']
    }
  }
}));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, try again later.' }
});
app.use(limiter);

// Stricter rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { status: 'error', message: 'Too many login attempts, try again later.' }
});

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token']
}));

// Cookie parser and CSRF protection
app.use(cookieParser());
//app.use(csurf({ cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'strict' } }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization
const sanitizeInput = [
  body('*').trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }
    next();
  }
];

// Routes
app.use('/api/auth', authLimiter, sanitizeInput, authRoutes);
app.use('/api/admin', sanitizeInput, adminRoutes);
app.use('/api/departments', sanitizeInput, departmentRoutes);
app.use('/api/staff', sanitizeInput, staffRoutes);
app.use('/api/staff/attendance', sanitizeInput, attendanceRoutes);
app.use('/api/admin/attendance', sanitizeInput, adminattendance);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'success', message: 'Server running' });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ status: 'error', message: 'Invalid CSRF token' });
  }
  res.status(500).json({ status: 'error', message: err.message || 'Something went wrong!' });
});

export default app;
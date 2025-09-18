import jwt from 'jsonwebtoken';
import pool from '../../db.js'; // Adjusted path to match staffCourseController.js
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const RESET_TOKEN_EXPIRES_IN = process.env.RESET_TOKEN_EXPIRES_IN || '10m';
const FRONTEND_URL = process.env.FRONTEND_URL;

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Helper to generate JWT token
const generateToken = (userId, role) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Helper to send reset email
const sendResetEmail = async (email, resetToken) => {
  const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;
  const mailOptions = {
    from: EMAIL_USER,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password.</p>
      <p>This link expires in ${RESET_TOKEN_EXPIRES_IN}.</p>
      <p>If you did not request this, ignore this email.</p>
    `,
  };
  await transporter.sendMail(mailOptions);
};

export const register = async (req, res) => {
  let connection;
  try {
    const { name, email, password, role, departmentId, staffId } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ status: 'failure', message: 'Name, email, password, and role are required' });
    }

    if (role !== 'ADMIN' && role !== 'STAFF') {
      return res.status(400).json({ status: 'failure', message: 'Role must be ADMIN or STAFF' });
    }

    if (role === 'STAFF' && !departmentId) {
      return res.status(400).json({ status: 'failure', message: 'Department is required for STAFF role' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check if user exists
    const [existingUser] = await connection.execute(
      'SELECT userId FROM Users WHERE email = ?',
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ status: 'failure', message: 'User already exists' });
    }

    // Validate departmentId if provided
    if (departmentId) {
      const [dept] = await connection.execute(
        'SELECT departmentId FROM Department WHERE departmentId = ? AND isActive = "YES"',
        [departmentId]
      );
      if (dept.length === 0) {
        return res.status(400).json({ status: 'failure', message: 'Invalid department' });
      }
    }

    // Validate staffId format if provided
    if (staffId && !/^[A-Z]{3}[0-9]{3}$/.test(staffId)) {
      return res.status(400).json({ status: 'failure', message: 'Staff ID must be in format ABC123' });
    }

    // Check if staffId is unique within department
    if (staffId && departmentId) {
      const [existingStaff] = await connection.execute(
        'SELECT userId FROM Users WHERE staffId = ? AND departmentId = ?',
        [staffId, departmentId]
      );
      if (existingStaff.length > 0) {
        return res.status(400).json({ status: 'failure', message: 'Staff ID already exists in this department' });
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const [result] = await connection.execute(
      `INSERT INTO Users (staffId, name, email, passwordHash, role, departmentId, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staffId || null, name, email, passwordHash, role, departmentId || null, req.user?.email || email]
    );

    const userId = result.insertId;
    const [userRows] = await connection.execute(
      'SELECT userId, name, email, role, departmentId, staffId FROM Users WHERE userId = ?',
      [userId]
    );
    const user = userRows[0];

    await connection.commit();

    // Generate token
    const token = generateToken(user.userId, user.role);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: { ...user, role: user.role.toLowerCase() },
        token,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Register error:', error.message);
    res.status(500).json({ status: 'failure', message: 'Registration failed' });
  } finally {
    if (connection) connection.release();
  }
};

export const login = async (req, res) => {
  let connection;
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'failure', message: 'Email and password are required' });
    }

    connection = await pool.getConnection();

    // Find user by email
    const [users] = await connection.execute(
      `SELECT userId, name, email, passwordHash, role, departmentId, staffId, isActive
       FROM Users WHERE email = ? AND isActive = 'YES'`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ status: 'failure', message: 'Invalid credentials' });
    }

    const user = users[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ status: 'failure', message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.userId, user.role);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: { 
          userId: user.userId, 
          name: user.name, 
          email: user.email, 
          role: user.role.toLowerCase(), 
          departmentId: user.departmentId,
          staffId: user.staffId 
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ status: 'failure', message: 'Login failed' });
  } finally {
    if (connection) connection.release();
  }
};

export const forgotPassword = async (req, res) => {
  let connection;
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ status: 'failure', message: 'Email is required' });
    }

    connection = await pool.getConnection();

    const [users] = await connection.execute(
      'SELECT userId, email FROM Users WHERE email = ? AND isActive = "YES"',
      [email]
    );

    if (users.length === 0) {
      return res.status(200).json({ status: 'success', message: 'If user exists, reset email sent' });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresInMs = 10 * 60 * 1000; // 10 minutes
    const resetTokenExpiry = new Date(Date.now() + expiresInMs);

    // Update user with reset token
    await connection.execute(
      'UPDATE Users SET resetToken = ?, resetTokenExpiry = ? WHERE userId = ?',
      [resetToken, resetTokenExpiry, user.userId]
    );

    // Send email
    await sendResetEmail(user.email, resetToken);

    res.status(200).json({
      status: 'success',
      message: 'Password reset email sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ status: 'failure', message: 'Failed to send reset email' });
  } finally {
    if (connection) connection.release();
  }
};

export const resetPassword = async (req, res) => {
  let connection;
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ status: 'failure', message: 'New password is required (min 6 chars)' });
    }

    connection = await pool.getConnection();

    // Find user with valid reset token
    const [users] = await connection.execute(
      `SELECT userId FROM Users 
       WHERE resetToken = ? AND resetTokenExpiry > NOW() AND isActive = 'YES'`,
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ status: 'failure', message: 'Invalid or expired reset token' });
    }

    const user = users[0];

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    await connection.execute(
      'UPDATE Users SET passwordHash = ?, resetToken = NULL, resetTokenExpiry = NULL, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE userId = ?',
      [passwordHash, 'system', user.userId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful',
    });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ status: 'failure', message: 'Password reset failed' });
  } finally {
    if (connection) connection.release();
  }
};

export const logout = async (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
};

// Middleware to protect routes
export const protect = async (req, res, next) => {
  let connection;
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ status: 'failure', message: 'Not authorized, token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    connection = await pool.getConnection();
    const [users] = await connection.execute(
      'SELECT userId, name, role, email, staffId, departmentId FROM Users WHERE userId = ? AND isActive = "YES"',
      [decoded.userId]
    );
    if (users.length === 0) {
      return res.status(401).json({ status: 'failure', message: 'Invalid token or user not found' });
    }
    req.user = users[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ status: 'failure', message: 'Invalid token' });
  } finally {
    if (connection) connection.release();
  }
};
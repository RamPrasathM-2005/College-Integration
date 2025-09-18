import axios from 'axios';

const API_BASE = 'http://localhost:4000/api'; // Backend URL (change if PORT=4000)

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

// Request interceptor for token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  if (response.data.status === 'success') {
    const { user, token } = response.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } else {
    throw new Error(response.data.message || 'Login failed');
  }
};

// Register
export const register = async (name, email, password, role, departmentId, staffId) => {
  const response = await api.post('/auth/register', {
    name,
    email,
    password,
    role: role.toUpperCase(),
    departmentId,
    staffId
  });
  if (response.data.status === 'success') {
    const { user, token } = response.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } else {
    throw new Error(response.data.message || 'Registration failed');
  }
};

// Forgot Password
export const forgotPassword = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  if (response.data.status !== 'success') {
    throw new Error(response.data.message || 'Failed to send email');
  }
  return response.data.message;
};

// Reset Password
export const resetPassword = async (token, newPassword) => {
  const response = await api.post(`/auth/reset-password/${token}`, { password: newPassword });
  if (response.data.status !== 'success') {
    throw new Error(response.data.message || 'Reset failed');
  }
  // Clear localStorage after reset
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  return response.data.message;
};

// Logout
export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } catch (err) {
    console.error('Logout API error:', err);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
  }
};

// Get current user
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Get departments
export const getDepartments = async () => {
  const response = await api.get('/departments');
  if (response.data.status === 'success') {
    return response.data.data;
  } else {
    throw new Error(response.data.message || 'Failed to fetch departments');
  }
};
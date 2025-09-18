import { getCurrentUser } from "../services/authService";

export const isAuthenticated = () => {
  const user = getCurrentUser();
  const token = localStorage.getItem('token');
  return user !== null && token !== null;
};

export const getUserRole = () => {
  const user = getCurrentUser();
  return user ? user.role : null;
};
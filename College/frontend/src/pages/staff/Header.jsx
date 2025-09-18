
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService'; // Adjust path as needed
import { getCurrentUser } from '../../services/authService';

const user=getCurrentUser();

const Header = () => {
  const navigate = useNavigate();

  const handleHome = () => {
    navigate('/staff/dashboard');
  };

  const handleAttendance = () => {
    navigate('/staff/attendance');
  };

  const handleLogout = async () => {
    try {
      await logout(); // Clear auth token
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      navigate('/login'); // Navigate to login even on error
    }
  };

  return (
    <header className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md">
      <h1 className="text-xl font-bold">HI, {user.name.toUpperCase()} 👋</h1>
      <nav className="flex space-x-4">
        <button
          onClick={handleHome}
          className="px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Home
        </button>
        <button
          onClick={handleAttendance}
          className="px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Attendance
        </button>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </nav>
    </header>
  );
};

export default Header;
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getCurrentUser } from '../../services/authService';

const Header = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleHome = () => {
    navigate('/staff/dashboard');
  };

  const handleAttendance = () => {
    navigate('/staff/attendance');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      navigate('/login');
    }
  };

  const displayName = user?.username ? user.username.toUpperCase() : 'GUEST';

  return (
    <header className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md">
      <h1 className="text-xl font-bold">HI, {displayName} 👋</h1>
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
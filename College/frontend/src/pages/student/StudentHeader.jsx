import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getCurrentUser } from '../../services/authService';

const StudentHeader = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleHome = () => {
    navigate('/student/dashboard');
  };

  const handleChooseCourses = () => {
    navigate('/student/choose-course');
  };

  const handleNptelSelection = () => {
    navigate('/student/nptel-selection');
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
          Dashboard
        </button>
        <button
          onClick={handleChooseCourses}
          className="px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Choose Courses
        </button>
        <button
          onClick={handleNptelSelection}
          className="px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Choose NPTEL
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

export default StudentHeader;
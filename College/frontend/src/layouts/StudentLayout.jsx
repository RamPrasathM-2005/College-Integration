import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';
import { getUserRole } from '../utils/auth';

const StudentLayout = () => {
  const navigate = useNavigate();
  const role = getUserRole();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (role !== 'student') {
    navigate('/login');
    return null;
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white p-4">
        <h2 className="text-2xl font-bold mb-6">Student Portal</h2>
        <nav>
          <ul>
            <li className="mb-2">
              <Link to="/student/dashboard" className="hover:text-gray-300">Dashboard</Link>
            </li>
            <li className="mb-2">
              <Link to="/student/choose-course" className="hover:text-gray-300">Choose Courses</Link>
            </li>
            <li className="mb-2">
              <button onClick={handleLogout} className="hover:text-gray-300 w-full text-left">
                Logout
              </button>
            </li>
          </ul>
        </nav>
      </div>
      {/* Main Content */}
      <div className="flex-1 p-6 bg-gray-100 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default StudentLayout;
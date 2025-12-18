import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { getUserRole } from '../utils/auth';
import StudentHeader from '../pages/student/StudentHeader';

const StudentLayout = () => {
  const navigate = useNavigate();
  const role = getUserRole();

  if (role !== 'student') {
    navigate('/login');
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <StudentHeader />
      <main className="flex-grow container mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
};

export default StudentLayout;
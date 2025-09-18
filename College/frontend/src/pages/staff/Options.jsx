import React from 'react';
import { ChevronLeft, Users, FileText, BarChart3, Calculator } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const Options = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams();

  // Fallback course if state not passed
  const course = location.state?.course ?? {
    id: courseId,
    title: 'Course Details',
    semester: '2025 - 2026 ODD SEMESTER',
  };

  const options = [
    {
      id: 'marks',
      title: 'Mark Allocation',
      description: 'Manage course outcomes, tools, and student marks',
      icon: BarChart3,
      color: 'bg-blue-500 hover:bg-blue-600',
      path: `/staff/marks-allocation/${course.id}/${course.sectionId}`, // Updated to include sectionId
    },
    {
      id: 'internal',
      title: 'Internal Marks',
      description: 'View consolidated internal marks and averages',
      icon: Calculator,
      color: 'bg-indigo-500 hover:bg-indigo-600',
      path: `/staff/internal-marks/${course.id}`,
    },
    // {
    //   id: 'attendance',
    //   title: 'Attendance',
    //   description: 'Track and manage student attendance',
    //   icon: Users,
    //   color: 'bg-purple-500 hover:bg-purple-600',
    //   path: `/staff/attendance/${course.id}`,
    // },
  ];

  const handleBack = () => navigate('/staff/dashboard');

  const handleOptionClick = (path) => navigate(path, { state: { course } });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b mt-10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="mr-4 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {course.title}
                </h1>
                <p className="text-sm text-gray-500">{course.semester}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Options Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.path)}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6 text-left border border-gray-200 hover:border-gray-300"
              >
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-lg ${option.color} text-white mr-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">{option.title}</h3>
                </div>
                <p className="text-gray-600 text-sm">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Options;
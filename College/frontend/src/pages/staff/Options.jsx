import React from 'react';
import { ChevronLeft, BarChart3, Calculator } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

const Options = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams(); // This might be "CSE233_IT32" now

  // Retrieve course object from state
  const course = location.state?.course;

  // Safety check: if state is lost (e.g. refresh), we might need to fetch or redirect
  // For now, we assume simple fallback based on URL param
  const displayTitle = course ? course.title : 'Course Details';
  const displayCode = course ? (course.displayCode || course.id) : courseId;
  const displaySemester = course ? course.semester : '';

  // GENERATE URL PARAMETERS
  // If merged, course.id is "CSE233_IT32" and sectionId is "5_8"
  // If single, course.id is "CSE233" and sectionId is "5"
  const targetCourseId = course?.id || courseId;
  
  // Handle section ID: use compositeSectionId if available (from our new backend), else fallback
  const targetSectionId = course?.compositeSectionId || course?.sectionId || 'unknown';

  const options = [
    {
      id: 'marks',
      title: 'Mark Allocation',
      description: 'Manage course outcomes, tools, and student marks',
      icon: BarChart3,
      color: 'bg-blue-500 hover:bg-blue-600',
      // Pass the composite IDs in the URL
      path: `/staff/marks-allocation/${targetCourseId}/${targetSectionId}`, 
    },
    {
      id: 'internal',
      title: 'Internal Marks',
      description: 'View consolidated internal marks and averages',
      icon: Calculator,
      color: 'bg-indigo-500 hover:bg-indigo-600',
      path: `/staff/internal-marks/${targetCourseId}`,
    },
    // {
    //   id: 'attendance',
    //   title: 'Attendance',
    //   description: 'Track and manage student attendance',
    //   icon: Users,
    //   color: 'bg-purple-500 hover:bg-purple-600',
    //   path: `/staff/attendance/${targetCourseId}`,
    // },
  ];

  const handleBack = () => navigate('/staff/dashboard');

  const handleOptionClick = (path) => {
    // We pass the entire merged course object to the next page
    // So the next page knows if it needs to split the IDs to fetch data
    navigate(path, { state: { course } }); 
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b mt-10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="mr-4 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  <span className="text-blue-600 mr-2">{displayCode}:</span>
                  {displayTitle}
                </h1>
                <p className="text-sm text-gray-500 font-medium">{displaySemester}</p>
                
                {/* Optional: Show badges for merged departments */}
                {course?.departments && course.departments.length > 1 && (
                  <div className="flex gap-2 mt-2">
                    {course.departments.map(dept => (
                      <span key={dept} className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        {dept} Dept
                      </span>
                    ))}
                  </div>
                )}
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
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 text-left border border-gray-200 hover:border-blue-300 group"
              >
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-lg ${option.color} text-white mr-4 shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{option.title}</h3>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Options;
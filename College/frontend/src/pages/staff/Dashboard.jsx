import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/authService';
import { getMyCourses } from '../../services/staffService';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center text-red-500">
          <h2 className="text-2xl font-bold mb-4">Something went wrong.</h2>
          <p className="mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('In progress');
  const [sortBy, setSortBy] = useState('Sort by name');
  const [viewMode, setViewMode] = useState('Summary');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = getCurrentUser();

  const colors = [
    'bg-purple-500',
    'bg-gray-400',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-red-500',
  ];

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        if (!user?.staffId) {
          throw new Error('Staff ID not found. Please log in again.');
        }
        const courseList = await getMyCourses(user.staffId);

        const validCourses = Array.isArray(courseList)
          ? courseList
              .filter((course) => course && typeof course === 'object')
              .map((course, index) => ({
                ...course,
                id: course.id || `course-${index}`,
                title: course.title || 'Untitled Course',
                bgColor: colors[index % colors.length],
                semester: course.semester || 'Unknown Semester',
                degree: course.degree || 'Unknown Degree',
                branch: course.branch || 'Unknown Branch',
                batch: course.batch || 'Unknown Batch',
                sectionName: course.sectionName || '',
              }))
          : [];

        setCourses(validCourses);
      } catch (err) {
        setError(err.message || 'Failed to load courses');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [user]);

  let filteredCourses = courses.filter((course) => {
    if (!course) return false;
    const title = (course.title || '').toLowerCase();
    const id = (course.id || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return title.includes(query) || id.includes(query);
  });

  if (sortBy === 'Sort by name') {
    filteredCourses.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }

  const handleCourseClick = (course) => {
    if (course?.id) {
      navigate(`/staff/options/${course.id}`, { state: { course } });
    }
  };

  const handleRequestCourses = () => {
    navigate('/staff/request-courses'); 
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-600">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
        <p className="mt-4 text-lg">Loading your courses...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-100 min-h-screen">

        {/* Course Overview Header with Request Button */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-blue-700">Course Overview</h2>
          <button
            onClick={handleRequestCourses}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            Request Courses
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-8 flex flex-col lg:flex-row gap-4 items-center">
          <select
            className="px-none border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>In progress</option>
            <option>All courses</option>
            <option>Completed</option>
            <option>Not started</option>
          </select>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by course code or name..."
              className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option>Sort by name</option>
          </select>

          <select
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option>Summary</option>
            <option>Card</option>
            <option>List</option>
          </select>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-center text-red-600 bg-red-50 py-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Courses Grid / List */}
        <div className={viewMode === 'Card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}>
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              onClick={() => handleCourseClick(course)}
              className="bg-white rounded-xl shadow hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1"
            >
              <div className={`h-32 ${course.bgColor} opacity-90`}></div>
              <div className="p-6 -mt-12">
                <div className={`w-20 h-20 ${course.bgColor} rounded-xl shadow-lg`}></div>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-blue-700 line-clamp-2">
                    {course.id} - {course.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {course.branch} {course.degree} • {course.batch} Batch
                    {course.sectionName ? ` • ${course.sectionName}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{course.semester}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State – Clean Illustration Only */}
        {filteredCourses.length === 0 && (
          <div className="flex justify-center items-center min-h-screen -mt-32">
            <img
              src="/no-courses-illustration.png"
              alt="No courses"
              className="w-80 h-auto object-contain drop-shadow-2xl"
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;

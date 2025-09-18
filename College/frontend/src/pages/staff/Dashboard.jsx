import React, { useState, useEffect, Component } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/authService';
import { getMyCourses } from '../../services/staffService';

// Error Boundary Component
class ErrorBoundary extends Component {
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
          <h2>Something went wrong.</h2>
          <p>{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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

  const colors = ['bg-purple-500', 'bg-gray-400', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500'];

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        if (!user?.staffId) {
          throw new Error('Staff ID not found in user data');
        }
        const courseList = await getMyCourses(user.staffId);
        // Filter out invalid courses and map with fallbacks
        const validCourses = Array.isArray(courseList)
          ? courseList
              .filter(course => course && typeof course === 'object')
              .map((course, index) => ({
                ...course,
                id: course.id || `course-${index}`,
                title: course.title || 'Untitled Course',
                bgColor: colors[index % colors.length],
                semester:  course.semester || 'Unknown Semester',
                degree: course.degree || 'Unknown Degree',
                branch: course.branch || 'Unknown Branch',
                batch: course.batch || 'Unknown Batch',
              }))
          : [];
        setCourses(validCourses);
      } catch (err) {
        setError(err.message || 'Failed to load courses');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  let filteredCourses = courses.filter(course => {
    if (!course || typeof course !== 'object') return false;
    const title = course.title || '';
    const id = course.id || '';
    return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           id.toLowerCase().includes(searchQuery.toLowerCase());
  });

  filteredCourses.sort((a, b) => {
    if (!a?.title || !b?.title) return 0;
    if (sortBy === 'Sort by name') return a.title.localeCompare(b.title);
    return 0;
  });

  const handleCourseClick = (course) => {
    if (course && course.id) {
      navigate(`/staff/options/${course.id}`, { state: { course } });
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading courses...</div>;
  }

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-100 min-h-screen">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
          {/* <h1 className="text-2xl font-bold text-gray-900">Hi, {user?.name.toUpperCase()}! 👋</h1> */}
        </header>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-blue-700">Course Overview</h2>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="In progress">In progress</option>
            <option value="All">All courses</option>
            <option value="Completed">Completed</option>
            <option value="Not started">Not started</option>
          </select>

          <div className="flex-1 relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="Sort by name">Sort by name</option>
          </select>

          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="Summary">Summary</option>
            <option value="Card">Card</option>
            <option value="List">List</option>
          </select>
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <div className={viewMode === 'Card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              onClick={() => handleCourseClick(course)}
              className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer ${
                viewMode === 'Card' ? 'flex flex-col items-start' : ''
              }`}
            >
              <div className={`w-16 h-16 ${course.bgColor} rounded-lg flex-shrink-0 mb-4`}></div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-blue-600 hover:text-blue-700 mb-1">
                      {course.id} - {course.title} ({course.branch} {course.degree} {course.batch} Batch - {course.sectionName})
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">{course.semester}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredCourses.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
            <p className="text-gray-600">Try adjusting your search criteria.</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
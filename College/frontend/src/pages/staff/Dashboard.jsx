import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  GraduationCap, 
  Users, 
  Calendar, 
  BookOpen,
  ArrowRight,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/authService';
import { getMyCourses } from '../../services/staffService';

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('Boundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-red-50 rounded-xl border border-red-100 m-6">
          <p className="text-red-600 font-medium">Something went wrong loading courses.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="mt-2 text-sm text-red-500 underline">Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Professional Theme Generator ---
// Returns elegant gradients instead of flat colors for a "unique" look
const getCourseTheme = (index) => {
  const themes = [
    { 
      gradient: 'from-blue-600 to-indigo-700', 
      shadow: 'shadow-blue-200',
      badge: 'bg-blue-500/30' 
    },
    { 
      gradient: 'from-emerald-500 to-teal-700', 
      shadow: 'shadow-emerald-200',
      badge: 'bg-emerald-500/30' 
    },
    { 
      gradient: 'from-violet-600 to-purple-800', 
      shadow: 'shadow-violet-200',
      badge: 'bg-violet-500/30' 
    },
    { 
      gradient: 'from-slate-700 to-slate-900', 
      shadow: 'shadow-slate-200',
      badge: 'bg-slate-600/50' 
    },
    { 
      gradient: 'from-rose-500 to-pink-700', 
      shadow: 'shadow-rose-200',
      badge: 'bg-rose-500/30' 
    },
    { 
      gradient: 'from-amber-500 to-orange-700', 
      shadow: 'shadow-amber-200',
      badge: 'bg-amber-500/30' 
    },
  ];
  return themes[index % themes.length];
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('Card'); // 'Card' or 'List'
  const [statusFilter, setStatusFilter] = useState('Active');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = getCurrentUser();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        if (!user?.staffId) { setLoading(false); return; }
        
        const courseList = await getMyCourses(user.staffId);
        
        const validCourses = Array.isArray(courseList)
          ? courseList.filter(c => c && typeof c === 'object').map((course, index) => ({
              ...course,
              id: course.id || `course-${index}`,
              displayId: course.displayCode || course.id,
              title: course.title || 'Untitled Course',
              semester: course.semester || 'N/A',
              degree: course.degree || '',
              branch: course.branch || (course.departments ? course.departments.join(' / ') : 'General'),
              batch: course.batch || 'N/A',
              sectionName: course.sectionName || '',
              theme: getCourseTheme(index), // Assign theme
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
  }, [user?.staffId]);

  const filteredCourses = courses.filter((course) => {
    const query = searchQuery.toLowerCase();
    return (
      (course.title || '').toLowerCase().includes(query) || 
      (course.displayId || '').toLowerCase().includes(query)
    );
  }).sort((a, b) => a.title.localeCompare(b.title));

  const handleCourseClick = (course) => {
    if (course?.id) navigate(`/staff/options/${course.id}`, { state: { course } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
        
        {/* --- Top Header Area --- */}
        <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">My Curriculum</h1>
              <p className="text-sm text-slate-500">Manage your active courses and assessments</p>
            </div>
            
            <button
              onClick={() => navigate('/staff/request-courses')}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>Request Course</span>
            </button>
          </div>
        </div>

        {/* --- Toolbar (Search & Filter) --- */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            {/* Search Bar */}
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm"
                placeholder="Search course name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-3 border border-gray-200 rounded-xl bg-white text-gray-700 font-medium hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer shadow-sm"
                >
                  <option>Active</option>
                  <option>Archived</option>
                  <option>All</option>
                </select>
                <Filter className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm">
                <button
                  onClick={() => setViewMode('Card')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'Card' ? 'bg-gray-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('List')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'List' ? 'bg-gray-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* --- Error Message --- */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-sm font-bold hover:underline">Dismiss</button>
            </div>
          )}

          {/* --- Content Grid --- */}
          {filteredCourses.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No courses found</h3>
              <p className="text-gray-500 mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className={viewMode === 'Card' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
              {filteredCourses.map((course) => (
                viewMode === 'Card' ? (
                  // === CARD VIEW ===
                  <div
                    key={course.id}
                    onClick={() => handleCourseClick(course)}
                    className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 relative flex flex-col h-full hover:-translate-y-1"
                  >
                    {/* Unique Professional Banner */}
                    <div className={`relative h-36 bg-gradient-to-br ${course.theme.gradient} p-5 flex flex-col justify-between overflow-hidden`}>
                      {/* Abstract Decoration */}
                      <div className="absolute -right-4 -top-8 w-24 h-24 rounded-full bg-white opacity-10 blur-xl"></div>
                      <div className="absolute left-10 -bottom-10 w-32 h-32 rounded-full bg-white opacity-5 blur-2xl"></div>
                      
                      {/* Glass Badge for ID */}
                      <div className="flex justify-between items-start z-10">
                        <span className={`px-3 py-1 rounded-lg backdrop-blur-md ${course.theme.badge} border border-white/20 text-white text-xs font-bold tracking-wide shadow-sm`}>
                          {course.displayId}
                        </span>
                        {course.sectionName && (
                          <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-white text-[10px] font-bold border border-white/10">
                            SEC {course.sectionName}
                          </span>
                        )}
                      </div>

                      {/* Info Overlap Hint */}
                      <div className="z-10 text-white/80 text-xs font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                         View Details <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-lg font-bold text-slate-800 mb-1 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
                        {course.title}
                      </h3>
                      
                      <p className="text-xs text-slate-500 font-medium mb-4 uppercase tracking-wide">
                        {course.degree} • {course.semester}
                      </p>

                      <div className="mt-auto space-y-2 border-t border-gray-50 pt-3">
                        <div className="flex items-center text-sm text-slate-600">
                           <Users className="w-4 h-4 mr-2 text-slate-400" />
                           <span className="truncate">{course.branch}</span>
                        </div>
                        <div className="flex items-center text-sm text-slate-600">
                           <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                           <span>Batch {course.batch}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // === LIST VIEW (Clean & Linear) ===
                  <div
                    key={course.id}
                    onClick={() => handleCourseClick(course)}
                    className="group bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row items-center gap-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                  >
                    {/* Small Colored Box */}
                    <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${course.theme.gradient} flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0`}>
                      {course.displayId.split('_')[0]}
                    </div>

                    <div className="flex-1 min-w-0 text-center md:text-left">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                        {course.title}
                      </h3>
                      <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {course.degree}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {course.branch}</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {course.semester}</span>
                        {course.sectionName && <span className="text-blue-600 font-medium">Sec {course.sectionName}</span>}
                      </div>
                    </div>

                    <div className="hidden md:block">
                      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
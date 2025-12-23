// pages/staff/StaffRequestPage.jsx
import React, { useState, useEffect } from 'react';
import { Search, Send, X, ArrowLeft, Clock, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api, getCurrentUser } from '../../services/authService'; // Adjust path as needed
import Filters from '../admin/ManageCourses/Filters'; // Adjust path as needed

const RequestCoursesStaff = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]); // From available-courses
  const [myRequests, setMyRequests] = useState([]); // For overlay status/actionId
  const [recentHistory, setRecentHistory] = useState([]); // Top 5 recent requests
  const [semesters, setSemesters] = useState([]); // Add for filter population
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ dept: '', branch: '', semester: '', batch: '', name: '', type: '' });
  const [branches, setBranches] = useState([]);
  const [depts, setDepts] = useState([]);
  const user = getCurrentUser();

  const courseTypes = ['THEORY', 'PRACTICAL', 'INTEGRATED', 'EXPERIENTIAL LEARNING']; // Define for type filter

  useEffect(() => {
    const initData = async () => {
      try {
        await Promise.all([
          fetchBranchesAndDepts(),
          fetchSemestersForFilters(), // Fetch semesters to populate filters (similar to ManageCourses)
          fetchAvailableCourses(), // Use available for base list (works)
          fetchMyRequests(), // Overlay for status/actionId
          fetchRecentHistory()
        ]);
      } catch (err) {
        console.error('Initial load error:', err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    fetchAvailableCourses(); // Refetch on filter change
  }, [filters]);

  const fetchBranchesAndDepts = async () => {
    try {
      // Hardcoded branches matching DB inserts
      const branchKeys = ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AIDS'];
      setBranches(branchKeys);

      // Fetch depts from /departments (assume exists; fallback hardcoded)
      const deptRes = await api.get('/departments');
      setDepts(deptRes.data.data || []);
    } catch (err) {
      console.error('Error fetching branches/depts:', err);
      // Fallback hardcoded depts
      setDepts([
        { id: 1, name: 'Computer Science Engineering' },
        { id: 2, name: 'Electronics & Communication' },
        { id: 3, name: 'Mechanical Engineering' },
        { id: 4, name: 'Information Technology' },
        { id: 5, name: 'Electrical Engineering' },
        { id: 6, name: 'Artificial Intelligence and Data Science' },
        { id: 7, name: 'Civil Engineering' }
      ]);
      setBranches(['CSE', 'IT', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AIDS']);
    }
  };

  const fetchSemestersForFilters = async () => {
    try {
      // Fetch semesters similar to ManageCourses to populate dept/branch/sem/batch
      const semRes = await api.get('/admin/semesters'); // Fixed: Relative path, no hardcoded localhost
      const semestersData = semRes.data.data || [];
      setSemesters(semestersData);
      console.log('Fetched semesters for filters:', semestersData); // Debug: Check console for data
    } catch (err) {
      console.error('Error fetching semesters for filters:', err);
      toast.warn('Failed to load filter options; using fallback data.');
      // Fallback sample data to populate filters
      setSemesters([
        { branch: 'CSE', semesterNumber: 1, batch: '2023' },
        { branch: 'CSE', semesterNumber: 2, batch: '2023' },
        { branch: 'IT', semesterNumber: 1, batch: '2024' },
        { branch: 'ECE', semesterNumber: 3, batch: '2022' },
        { branch: 'MECH', semesterNumber: 4, batch: '2023' },
        { branch: 'CIVIL', semesterNumber: 1, batch: '2024' },
        { branch: 'EEE', semesterNumber: 2, batch: '2023' },
        { branch: 'AIDS', semesterNumber: 5, batch: '2022' }
      ]);
    }
  };

  const fetchAvailableCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dept: filters.dept || user?.Deptid, // Numeric ID
        branch: filters.branch, // String
        semester: filters.semester, // Number
        batch: filters.batch, // String
        type: filters.type // Add for backend filtering if implemented
      });
      const res = await api.get(`/staff/available-courses?${params}`);
      setCourses(res.data.data || []);
      console.log('Fetched courses with params:', params.toString(), res.data.data); // Debug: Check console
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch available courses');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const res = await api.get('/staff/my-requests');
      setMyRequests(res.data.data || []);
    } catch (err) {
      console.error('Error fetching my requests:', err);
    }
  };

  const fetchRecentHistory = async () => {
    try {
      const res = await api.get('/staff/recent-history'); // New endpoint for top 5 recent requests
      setRecentHistory(res.data.data.slice(0, 5) || []); // Limit to top 5
    } catch (err) {
      console.error('Error fetching recent history:', err);
    }
  };

  const handleSendRequest = async (courseId) => {
    try {
      await api.post(`/staff/request/${courseId}`);
      toast.success('Request sent successfully!');
      fetchAvailableCourses();
      fetchMyRequests();
      fetchRecentHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      await api.delete(`/staff/request/${requestId}`);
      toast.success('Request cancelled successfully!');
      fetchAvailableCourses();
      fetchMyRequests();
      fetchRecentHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  const handleLeaveCourse = async (staffCourseId) => {
    try {
      await api.delete(`/staff/leave/${staffCourseId}`);
      toast.success('Left course successfully!');
      fetchAvailableCourses();
      fetchMyRequests();
      fetchRecentHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave course');
    }
  };

  const handleResendRequest = async (requestId) => {
    try {
      await api.post(`/staff/resend/${requestId}`); // New endpoint for resend rejected request
      toast.success('Request resent successfully!');
      fetchAvailableCourses();
      fetchMyRequests();
      fetchRecentHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend request');
    }
  };

  const isRequested = (courseId) => myRequests.some(r => r.courseId === courseId && r.status === 'PENDING');

  const getRequestId = (courseId) => myRequests.find(r => r.courseId === courseId && r.status === 'PENDING')?.requestId;

  const filteredCourses = courses.filter(course => 
    (!filters.name || course.courseTitle.toLowerCase().includes(filters.name.toLowerCase())) &&
    (!filters.type || course.type === filters.type)
  );

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="mr-4 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Request Courses</h2>
      </div>

      <Filters
        filters={filters}
        setFilters={setFilters}
        semesters={semesters} // Passed populated semesters
        courseTypes={courseTypes} // Passed types
      />

      {/* Recent History Section */}
      {recentHistory.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3">Recent Request History (Top 5)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentHistory.map((historyItem) => (
              <div key={historyItem.requestId} className="bg-white p-4 rounded-lg shadow-md">
                <p className="font-medium">{historyItem.courseTitle}</p>
                <p className="text-sm text-gray-600">Status: {historyItem.status}</p>
                <p className="text-sm text-gray-500">Date: {new Date(historyItem.requestedAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted Courses Section with Cancel Acceptance */}
      {myRequests.filter(r => r.status === 'ACCEPTED').length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3">Accepted Courses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myRequests.filter(r => r.status === 'ACCEPTED').map(accepted => (
              <div 
                key={accepted.requestId} 
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all duration-300 border border-green-200"
              >
                <h3 className="font-semibold text-lg mb-2 text-gray-800">
                  {accepted.courseCode} - {accepted.courseTitle}
                </h3>
                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <p><span className="font-medium">Branch:</span> {accepted.branch}</p>
                  <p><span className="font-medium">Semester:</span> {accepted.semesterNumber}</p>
                  <p><span className="font-medium">Batch:</span> {accepted.batch}</p>
                  <p><span className="font-medium">Status:</span> <span className="text-green-600">Allocated</span></p>
                </div>
                <button
                  onClick={() => handleLeaveCourse(accepted.staffCourseId || accepted.requestId)} // Use staffCourseId if added in backend, fallback to requestId
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                >
                  <X size={16} /> Cancel Acceptance
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-gray-600">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-lg">Loading available courses...</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map(course => {
            const isPending = isRequested(course.courseId);
            const requestId = getRequestId(course.courseId);
            return (
              <div 
                key={course.courseId} 
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-200"
              >
                <h3 className="font-semibold text-lg mb-2 text-gray-800">
                  {course.courseCode} - {course.courseTitle}
                </h3>
                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <p><span className="font-medium">Branch:</span> {course.branch}</p>
                  <p><span className="font-medium">Semester:</span> {course.semesterNumber}</p>
                  <p><span className="font-medium">Batch:</span> {course.batch}</p>
                  <p><span className="font-medium">Credits:</span> {course.credits}</p>
                  <p><span className="font-medium">Type:</span> {course.type}</p>
                  {isPending && (
                    <p className="text-sm"><span className="font-medium">Status:</span> 
                      <span className="ml-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </p>
                  )}
                </div>
                {isPending ? (
                  <button
                    onClick={() => handleCancelRequest(requestId)}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                  >
                    <Clock size={16} /> Cancel Request
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendRequest(course.courseId)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                  >
                    <Send size={16} /> Send Request
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredCourses.length === 0 && (
        <div className="text-center py-12 mt-8">
          <Search size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No available courses match your filters</h3>
          <p className="text-gray-500">Try adjusting your filters or check back later for new courses.</p>
        </div>
      )}

      {/* Rejected Requests Section with Resend Option */}
      {myRequests.filter(r => r.status === 'REJECTED').length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-3">Rejected Requests (Resend Option)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myRequests.filter(r => r.status === 'REJECTED').map(rejected => (
              <div 
                key={rejected.requestId} 
                className="bg-white rounded-xl shadow-md p-6 border border-red-200"
              >
                <h4 className="font-semibold mb-2">{rejected.courseCode} - {rejected.courseTitle}</h4>
                <p className="text-sm text-red-600 mb-2">Status: Rejected on {new Date(rejected.rejectedAt).toLocaleDateString()}</p>
                <button
                  onClick={() => handleResendRequest(rejected.requestId)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                >
                  <RefreshCw size={16} /> Resend Request
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestCoursesStaff;
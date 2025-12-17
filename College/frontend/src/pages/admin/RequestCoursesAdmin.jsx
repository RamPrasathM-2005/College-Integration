// pages/admin/RequestCoursesAdmin.jsx
import React, { useState, useEffect } from 'react';
import { Search, Check, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // Import toast styles
import { api, getCurrentUser } from '../../services/authService'; // Adjust path as needed
import Filters from '../admin/ManageCourses/Filters'; // Adjust path as needed, assuming same Filters component

const RequestCoursesAdmin = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ dept: '', branch: '', semester: '', batch: '', name: '' });
  const [branches, setBranches] = useState([]);
  const [depts, setDepts] = useState([]);
  const user = getCurrentUser(); // For admin

  const courseTypes = ['THEORY', 'PRACTICAL', 'INTEGRATED', 'EXPERIENTIAL LEARNING']; // Define for type filter to avoid undefined error

  useEffect(() => {
    const initData = async () => {
      try {
        await Promise.all([
          fetchBranchesAndDepts(),
          fetchSemestersForFilters(),
          fetchPendingRequests()
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
    fetchPendingRequests(); // Refetch on filter change
  }, [filters]);

  const fetchBranchesAndDepts = async () => {
    try {
      const branchKeys = ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AIDS'];
      setBranches(branchKeys);

      const deptRes = await api.get('/departments');
      setDepts(deptRes.data.data || []);
    } catch (err) {
      console.error('Error fetching branches/depts:', err);
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
      const semRes = await api.get('/admin/semesters'); // Adjust if full URL needed
      const semestersData = semRes.data.data || [];
      setSemesters(semestersData);
    } catch (err) {
      console.error('Error fetching semesters for filters:', err);
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

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dept: filters.dept,
        branch: filters.branch,
        semester: filters.semester,
        batch: filters.batch
      });
      const res = await api.get(`/staff/pending-requests?${params}`);
      setRequests(res.data.data || []);
      console.log('Fetched pending requests:', res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch pending requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.post(`/staff/accept/${requestId}`);
      toast.success('Request accepted successfully!');
      fetchPendingRequests();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to accept request';
      if (errorMessage.includes('Slot or batch not available') || errorMessage.includes('No sections configured') || errorMessage.includes('No available sections') || errorMessage.includes('slots') || errorMessage.includes('section')) {
        toast.error('Slot or batch not available. Cannot be allocated because slots are filled. Please press cancel request.');
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.post(`/staff/reject/${requestId}`);
      toast.success('Request rejected successfully!');
      fetchPendingRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject request');
    }
  };

  const filteredRequests = requests.filter(request => 
    !filters.name || request.courseTitle.toLowerCase().includes(filters.name.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="mr-4 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Manage Course Requests</h2>
      </div>

      <Filters
        filters={filters}
        setFilters={setFilters}
        semesters={semesters}
        courseTypes={courseTypes} // Pass courseTypes to avoid undefined error in Filters
      />

      {loading ? (
        <div className="p-6 text-center text-gray-600">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-lg">Loading pending requests...</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map(request => (
            <div 
              key={request.requestId} 
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all duration-300 border border-gray-200"
            >
              <h3 className="font-semibold text-lg mb-2 text-gray-800">
                {request.courseCode} - {request.courseTitle}
              </h3>
              <div className="space-y-1 text-sm text-gray-600 mb-4">
                <p><span className="font-medium">Requested by:</span> {request.staffName} ({request.email})</p>
                <p><span className="font-medium">Branch:</span> {request.branch}</p>
                <p><span className="font-medium">Semester:</span> {request.semesterNumber}</p>
                <p><span className="font-medium">Batch:</span> {request.batch}</p>
                <p><span className="font-medium">Credits:</span> {request.credits}</p>
                <p><span className="font-medium">Department:</span> {request.deptName}</p>
                <p><span className="font-medium">Requested on:</span> {new Date(request.requestedAt).toLocaleDateString()}</p>
                <p><span className="font-medium">Assigned Slots:</span> {request.assignedCount}/{request.sectionCount}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptRequest(request.requestId)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                >
                  <Check size={16} /> Accept
                </button>
                <button
                  onClick={() => handleRejectRequest(request.requestId)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                >
                  <X size={16} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredRequests.length === 0 && (
        <div className="text-center py-12 mt-8">
          <Search size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending requests match your filters</h3>
          <p className="text-gray-500">Try adjusting your filters or check back later for new requests.</p>
        </div>
      )}
    </div>
  );
};

export default RequestCoursesAdmin;
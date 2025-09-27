import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/authService';
import { branchMap, degrees } from '../admin/ManageSemesters/branchMap';
import { MySwal, showErrorToast, showSuccessToast, showInfoToast, showConfirmToast } from '../../utils/swalConfig';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-100 border border-red-400 text-red-700 rounded-xl shadow-lg max-w-7xl mx-auto">
          <h2 className="text-xl font-bold mb-2">Something went wrong!</h2>
          <p classNa8me="mb-4">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const CourseRecommendation = () => {
  const [depts, setDepts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [courses, setCourses] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [electives, setElectives] = useState([]);
  const [pccCourses, setPccCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedBuckets, setExpandedBuckets] = useState({});
  const selectRefs = useRef({});
  const inputRefs = useRef({});

  useEffect(() => {
    fetchDepts();
    fetchBatches();
  }, []);

  const fetchDepts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/departments');
      if (res.data.status === 'success' && Array.isArray(res.data.data)) {
        setDepts(res.data.data);
      } else {
        throw new Error('Unexpected response structure from departments API');
      }
    } catch (err) {
      const errorMessage = err.response?.status === 401
        ? 'Authentication failed. Please log in again.'
        : err.message.includes('HTML instead of JSON')
        ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
        : `Failed to fetch departments: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
      setError(errorMessage);
      showErrorToast('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/batches');
      if (res.data.status === 'success' && Array.isArray(res.data.data)) {
        const uniqueBatches = [...new Set(res.data.data.map(b => b.batch))];
        setBatches(uniqueBatches);
      } else {
        throw new Error('Unexpected response structure from batches API');
      }
    } catch (err) {
      const errorMessage = err.response?.status === 401
        ? 'Authentication failed. Please log in again.'
        : err.message.includes('HTML instead of JSON')
        ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
        : `Failed to fetch batches: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
      setError(errorMessage);
      showErrorToast('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchSemesters = async () => {
      if (!selectedDegree || !selectedDept || !selectedBatch) return;
      setLoading(true);
      setError(null);
      try {
        const branchCode = Object.keys(branchMap).find(key => branchMap[key] === selectedDept) || selectedDept;
        const params = { degree: selectedDegree, branch: branchCode, batch: selectedBatch };
        const res = await api.get('/admin/semesters/by-batch-branch', { params });
        if (res.data.status === 'success' && Array.isArray(res.data.data)) {
          setSemesters(res.data.data);
        } else if (res.data.status === 'failure' && res.data.message.includes('No semesters found')) {
          setSemesters([]);
          setError(`No semesters found for ${selectedBatch} - ${selectedDept} (Degree: ${selectedDegree}). Please create a semester in Manage Semesters.`);
          showInfoToast('No Semesters', `No semesters found for ${selectedBatch} - ${selectedDept}`);
        } else {
          throw new Error('Unexpected response structure from semesters API');
        }
      } catch (err) {
        const errorMessage = err.response?.status === 404
          ? `No semesters found for ${selectedBatch} - ${selectedDept} (Degree: ${selectedDegree}). Please create a semester in Manage Semesters.`
          : err.response?.status === 401
          ? 'Authentication failed. Please log in again.'
          : err.message.includes('HTML instead of JSON')
          ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
          : `Failed to fetch semesters: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
        setError(errorMessage);
        if (err.response?.status === 404) {
          showInfoToast('No Semesters', errorMessage);
        } else {
          showErrorToast('Error', errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSemesters();
  }, [selectedDegree, selectedDept, selectedBatch]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSemester) return;
      setLoading(true);
      setError(null);
      try {
        const resCourses = await api.get(`/admin/semesters/${selectedSemester}/courses`);
        if (resCourses.data.status === 'success' && Array.isArray(resCourses.data.data)) {
          const allCourses = resCourses.data.data;
          const pcc = allCourses.filter(c => c.category === 'PCC');
          const ele = allCourses.filter(c => ['PEC', 'OEC'].includes(c.category));
          setPccCourses(pcc);
          setElectives(ele);
          setCourses(allCourses);
        } else {
          throw new Error('Unexpected response structure from courses API');
        }

        const resBuckets = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
        if (resBuckets.data.status === 'success' && Array.isArray(resBuckets.data.data)) {
          setBuckets(resBuckets.data.data);
          // Initialize expanded state for each bucket (default to collapsed)
          setExpandedBuckets(
            resBuckets.data.data.reduce((acc, bucket) => ({
              ...acc,
              [bucket.bucketId]: false,
            }), {})
          );
        } else {
          throw new Error('Unexpected response structure from buckets API');
        }
      } catch (err) {
        const errorMessage = err.response?.status === 401
          ? 'Authentication failed. Please log in again.'
          : err.message.includes('HTML instead of JSON')
          ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
          : `Failed to fetch courses or buckets: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
        setError(errorMessage);
        showErrorToast('Error', errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedSemester]);

  const toggleBucket = (bucketId) => {
    setExpandedBuckets(prev => ({
      ...prev,
      [bucketId]: !prev[bucketId],
    }));
  };

  const handleAddBucket = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/admin/semesters/${selectedSemester}/buckets`);
      if (res.data.status === 'success') {
        const resBuckets = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
        if (resBuckets.data.status === 'success' && Array.isArray(resBuckets.data.data)) {
          setBuckets(resBuckets.data.data);
          setExpandedBuckets(
            resBuckets.data.data.reduce((acc, bucket) => ({
              ...acc,
              [bucket.bucketId]: false,
            }), {})
          );
          showSuccessToast(`Bucket ${res.data.bucketNumber} created successfully`);
        } else {
          throw new Error('Unexpected response structure from buckets API');
        }
      } else {
        throw new Error('Unexpected response structure from add bucket API');
      }
    } catch (err) {
      const errorMessage = err.response?.status === 401
        ? 'Authentication failed. Please log in again.'
        : err.message.includes('HTML instead of JSON')
        ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
        : `Failed to add bucket: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
      setError(errorMessage);
      showErrorToast('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBucketName = async (bucketId, bucketNumber, newName) => {
    if (!newName.trim()) {
      setError('Bucket name cannot be empty');
      showErrorToast('Error', 'Bucket name cannot be empty');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.put(`/admin/buckets/${bucketId}`, { bucketName: newName });
      if (res.data.status === 'success') {
        const resBuckets = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
        if (resBuckets.data.status === 'success' && Array.isArray(resBuckets.data.data)) {
          setBuckets(resBuckets.data.data);
          showSuccessToast(`Bucket ${bucketNumber} name updated to "${newName}"`);
        } else {
          throw new Error('Unexpected response structure from buckets API');
        }
      } else {
        throw new Error('Unexpected response from update bucket API');
      }
    } catch (err) {
      const errorMessage = err.response?.status === 401
        ? 'Authentication failed. Please log in again.'
        : err.message.includes('HTML instead of JSON')
        ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
        : `Failed to update bucket name: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
      setError(errorMessage);
      showErrorToast('Error', errorMessage);
      if (inputRefs.current[bucketId]) {
        inputRefs.current[bucketId].value = buckets.find(b => b.bucketId === bucketId)?.bucketName || `Bucket ${bucketNumber}`;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBucket = async (bucketId, bucketNumber) => {
    const result = await showConfirmToast(
      'Delete Bucket',
      `Are you sure you want to delete Bucket ${bucketNumber}?`,
      'warning',
      'Delete',
      'Cancel'
    );
    if (!result.isConfirmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.delete(`/admin/buckets/${bucketId}`);
      if (res.data.status === 'success') {
        setBuckets(buckets.filter(bucket => bucket.bucketId !== bucketId));
        setExpandedBuckets(prev => {
          const newState = { ...prev };
          delete newState[bucketId];
          return newState;
        });
        showSuccessToast(`Bucket ${bucketNumber} deleted successfully`);
      } else {
        throw new Error('Unexpected response from delete bucket API');
      }
    } catch (err) {
      const errorMessage = err.response?.status === 401
        ? 'Authentication failed. Please log in again.'
        : err.response?.status === 404
        ? `Bucket with ID ${bucketId} not found`
        : err.message.includes('HTML instead of JSON')
        ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
        : `Failed to delete bucket: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
      setError(errorMessage);
      showErrorToast('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoursesToBucket = async (bucketId) => {
    const select = selectRefs.current[bucketId];
    if (!select) {
      setError('No select element found for this bucket.');
      showErrorToast('Error', 'No select element found for this bucket.');
      return;
    }
    const selectedOptions = Array.from(select.selectedOptions).map(option => option.value);
    if (selectedOptions.length === 0) {
      setError('Please select at least one course to add to the bucket.');
      showErrorToast('Error', 'Please select at least one course to add to the bucket.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/admin/buckets/${bucketId}/courses`, { courseCodes: selectedOptions });
      if (res.data.status === 'success') {
        const resBuckets = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
        if (resBuckets.data.status === 'success' && Array.isArray(resBuckets.data.data)) {
          setBuckets(resBuckets.data.data);
          const successMsg = res.data.addedCourses?.length
            ? `Successfully added ${res.data.addedCourses.length} course(s) to bucket`
            : 'Courses added to bucket successfully';
          showSuccessToast(successMsg);
          if (res.data.errors?.length) {
            setError(`Some courses could not be added: ${res.data.errors.join(', ')}`);
            showInfoToast('Warning', `Some courses could not be added: ${res.data.errors.join(', ')}`);
          }
          select.selectedIndex = -1;
        } else {
          throw new Error('Unexpected response structure from buckets API');
        }
      } else {
        throw new Error(`Unexpected response from add courses API: ${res.data.message || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMessage = err.response?.status === 401
        ? 'Authentication failed. Please log in again.'
        : err.response?.status === 400
        ? `Failed to add courses: ${err.response?.data?.message || err.message}${err.response?.data?.errors ? ` - ${err.response.data.errors.join(', ')}` : ''}`
        : err.message.includes('HTML instead of JSON')
        ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
        : `Failed to add courses to bucket: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
      setError(errorMessage);
      showErrorToast('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCourseFromBucket = async (bucketId, courseCode) => {
    const result = await showConfirmToast(
      'Remove Course',
      `Are you sure you want to remove course ${courseCode} from the bucket?`,
      'warning',
      'Remove',
      'Cancel'
    );
    if (!result.isConfirmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.delete(`/admin/buckets/${bucketId}/courses/${courseCode}`);
      if (res.data.status === 'success') {
        const resBuckets = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
        if (resBuckets.data.status === 'success' && Array.isArray(resBuckets.data.data)) {
          setBuckets(resBuckets.data.data);
          showSuccessToast(`Course ${courseCode} removed from bucket successfully`);
        } else {
          throw new Error('Unexpected response structure from buckets API');
        }
      } else {
        throw new Error(`Unexpected response from remove course API: ${res.data.message || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMessage = err.response?.status === 401
        ? 'Authentication failed. Please log in again.'
        : err.response?.status === 404
        ? `Course ${courseCode} or bucket ${bucketId} not found`
        : err.message.includes('HTML instead of JSON')
        ? 'Failed to reach backend server. Please ensure the backend is running at http://localhost:4000.'
        : `Failed to remove course: ${err.message}${err.response?.data?.message ? ` - ${err.response.data.message}` : ''}`;
      setError(errorMessage);
      showErrorToast('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const assignedCourses = buckets.flatMap(bucket => bucket.courses.map(c => c.courseCode));

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center">
        <div className="w-full max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold text-gray-900">Course Recommendation</h1>
              <p className="text-gray-600 mt-1">Manage course buckets for elective recommendations</p>
            </div>
          </div>
          {error && (
            <div className="flex items-center text-red-600 mb-4 bg-red-50 p-4 rounded-lg">
              <p>{error}</p>
              {error.includes('Authentication failed') && (
                <button
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => window.location.href = '/login'}
                >
                  Log In
                </button>
              )}
              {error.includes('Failed to reach backend server') && (
                <button
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              )}
              {error.includes('No semesters found') && (
                <button
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => window.location.href = '/manage-semesters'}
                >
                  Go to Manage Semesters
                </button>
              )}
            </div>
          )}
          {loading && <p className="text-gray-600 mb-4 text-center">Loading...</p>}
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
            <div className="flex flex-wrap gap-4 items-end justify-center">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Degree</label>
                <select
                  value={selectedDegree}
                  onChange={e => setSelectedDegree(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select Degree</option>
                  {degrees.map(deg => (
                    <option key={deg} value={deg}>
                      {deg}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  disabled={loading || !selectedDegree}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select Department</option>
                  {Array.isArray(depts) && depts.length > 0 ? (
                    depts.map(d => (
                      <option key={d.Deptid} value={d.Deptname}>
                        {d.Deptname}
                      </option>
                    ))
                  ) : (
                    <option disabled>No departments available</option>
                  )}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                <select
                  value={selectedBatch}
                  onChange={e => setSelectedBatch(e.target.value)}
                  disabled={loading || !selectedDegree}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select Batch</option>
                  {Array.isArray(batches) && batches.length > 0 ? (
                    batches.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))
                  ) : (
                    <option disabled>No batches available</option>
                  )}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                <select
                  value={selectedSemester}
                  onChange={e => setSelectedSemester(e.target.value)}
                  disabled={loading || !selectedDegree || !selectedDept || !selectedBatch}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select Semester</option>
                  {Array.isArray(semesters) && semesters.length > 0 ? (
                    semesters.map(s => (
                      <option key={s.semesterId} value={s.semesterId}>
                        Semester {s.semesterNumber}
                      </option>
                    ))
                  ) : (
                    <option disabled>No semesters available</option>
                  )}
                </select>
              </div>
            </div>
          </div>
          {!loading && selectedSemester && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Core Courses</h2>
                {Array.isArray(pccCourses) && pccCourses.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <ul className="list-disc pl-5">
                      {pccCourses.map(c => (
                        <li key={c.courseCode} className="text-gray-700 py-1">
                          {c.courseCode} - {c.courseTitle}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-gray-600 mb-6 text-center">No Core courses available.</p>
                )}
              </div>
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Elective Buckets</h2>
                  <button
                    onClick={handleAddBucket}
                    disabled={loading || !selectedSemester}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Elective Bucket
                  </button>
                </div>
                {Array.isArray(buckets) && buckets.length > 0 ? (
                  buckets.map(bucket => (
                    <div key={bucket.bucketId} className="mb-8 bg-white rounded-xl shadow-lg p-6">
                      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            onClick={() => toggleBucket(bucket.bucketId)}
                            className="text-gray-600 hover:text-gray-800 transition-colors"
                          >
                            <svg
                              className={`w-5 h-5 transform transition-transform ${expandedBuckets[bucket.bucketId] ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <input
                            type="text"
                            defaultValue={bucket.bucketName || `Bucket ${bucket.bucketNumber}`}
                            className="text-xl font-semibold text-gray-900 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 flex-1"
                            ref={el => (inputRefs.current[bucket.bucketId] = el)}
                          />
                          <button
                            onClick={() => handleUpdateBucketName(bucket.bucketId, bucket.bucketNumber, inputRefs.current[bucket.bucketId]?.value)}
                            className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Update
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteBucket(bucket.bucketId, bucket.bucketNumber)}
                          disabled={loading}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Delete Bucket
                        </button>
                      </div>
                      {expandedBuckets[bucket.bucketId] && (
                        <div className="transition-all duration-300">
                          {Array.isArray(bucket.courses) && bucket.courses.length > 0 ? (
                            <ul className="space-y-2 mb-4">
                              {bucket.courses.map(c => (
                                <li key={c.courseCode} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center hover:bg-gray-100">
                                  <span className="text-gray-700">{c.courseCode} - {c.courseTitle}</span>
                                  <button
                                    onClick={() => handleRemoveCourseFromBucket(bucket.bucketId, c.courseCode)}
                                    disabled={loading}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-600 mb-4">No courses in this bucket.</p>
                          )}
                          <select
                            multiple
                            ref={el => (selectRefs.current[bucket.bucketId] = el)}
                            className="w-full max-w-md h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 mb-4"
                            disabled={loading || electives.length === 0}
                          >
                            {Array.isArray(electives) && electives.length > 0 ? (
                              electives
                                .filter(e => !assignedCourses.includes(e.courseCode))
                                .map(e => (
                                  <option key={e.courseCode} value={e.courseCode}>
                                    {e.courseCode} - {e.courseTitle}
                                  </option>
                                ))
                            ) : (
                              <option disabled>No electives available</option>
                            )}
                          </select>
                          <button
                            onClick={() => handleAddCoursesToBucket(bucket.bucketId)}
                            disabled={loading || electives.length === 0}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Selected Courses
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-center">No buckets created yet. Click "Add Elective Bucket" to get started.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CourseRecommendation;
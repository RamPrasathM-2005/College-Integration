// New AddBucketModal.js
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../services/authService';

const AddBucketModal = ({ semesterId, regulationId, semesterNumber, assignedCourses, onBucketAdded, setShowAddBucketModal }) => {
  const [verticals, setVerticals] = useState([]);
  const [expandedVerticals, setExpandedVerticals] = useState({});
  const [coursesByVertical, setCoursesByVertical] = useState({});
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchVerticals();
  }, [regulationId]);

  const fetchVerticals = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/regulations/${regulationId}/verticals`);
      if (res.data.status === 'success') {
        setVerticals(res.data.data);
        const initialExpanded = {};
        res.data.data.forEach(v => {
          initialExpanded[v.verticalId] = false;
        });
        setExpandedVerticals(initialExpanded);
      }
    } catch (err) {
      toast.error('Failed to fetch verticals: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleVertical = async (verticalId) => {
    if (!expandedVerticals[verticalId] && !coursesByVertical[verticalId]) {
      await fetchCoursesForVertical(verticalId);
    }
    setExpandedVerticals(prev => ({
      ...prev,
      [verticalId]: !prev[verticalId],
    }));
  };

const fetchCoursesForVertical = async (verticalId) => {
  setLoading(true);
  try {
    const res = await api.get(`/admin/regulations/verticals/${verticalId}/courses?semesterNumber=${semesterNumber}`);
    if (res.data.status === 'success') {
      setCoursesByVertical(prev => ({
        ...prev,
        [verticalId]: res.data.data.filter(c => !assignedCourses.includes(c.courseCode)),
      }));
    }
  } catch (err) {
    toast.error('Failed to fetch courses for vertical: ' + (err.response?.data?.message || err.message));
  } finally {
    setLoading(false);
  }
};

  const handleCourseSelect = (courseCode) => {
    setSelectedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseCode)) {
        newSet.delete(courseCode);
      } else {
        newSet.add(courseCode);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (selectedCourses.size === 0) {
      toast.error('Please select at least one course');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create new bucket
      const bucketRes = await api.post(`/admin/semesters/${semesterId}/buckets`);
      if (bucketRes.data.status !== 'success') {
        throw new Error('Failed to create bucket');
      }
      const bucketId = bucketRes.data.bucketId;

      // Add selected courses to the new bucket
      const addRes = await api.post(`/admin/buckets/${bucketId}/courses`, {
        courseCodes: Array.from(selectedCourses),
      });
      if (addRes.data.status === 'success') {
        toast.success('Added to elective bucket successfully');
        setShowAddBucketModal(false);
        onBucketAdded();
      } else {
        throw new Error(addRes.data.message || 'Failed to add courses to bucket');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating bucket with courses');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Add New Elective Bucket</h2>
            <button
              onClick={() => setShowAddBucketModal(false)}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting || loading}
            >
              <X size={24} />
            </button>
          </div>
          {loading && <p>Loading...</p>}
          <div className="space-y-4">
            {verticals.map(vertical => (
              <div key={vertical.verticalId} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleVertical(vertical.verticalId)}
                  className="w-full px-4 py-3 flex justify-between items-center text-left font-medium text-gray-900 hover:bg-gray-50"
                >
                  {vertical.verticalName}
                  <svg
                    className={`w-5 h-5 transform transition-transform ${expandedVerticals[vertical.verticalId] ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedVerticals[vertical.verticalId] && (
                  <div className="px-4 py-2 space-y-2">
                    {coursesByVertical[vertical.verticalId]?.length > 0 ? (
                      coursesByVertical[vertical.verticalId].map(course => (
                        <div key={course.courseCode} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${vertical.verticalId}-${course.courseCode}`}
                            checked={selectedCourses.has(course.courseCode)}
                            onChange={() => handleCourseSelect(course.courseCode)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor={`${vertical.verticalId}-${course.courseCode}`} className="text-gray-700">
                            {course.courseCode} - {course.courseTitle}
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No courses available for this vertical in the selected semester.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setShowAddBucketModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={isSubmitting || loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              disabled={isSubmitting || loading || selectedCourses.size === 0}
            >
              {isSubmitting ? 'Creating...' : 'Create Bucket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddBucketModal;
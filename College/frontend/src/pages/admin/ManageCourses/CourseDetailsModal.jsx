import React from 'react';
import { X, Edit3, Plus, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../../services/authService'; // Adjust path if needed

const API_BASE = 'http://localhost:4000/api/admin';

const CourseDetailsModal = ({
  selectedCourse,
  sections,
  fetchingSections,
  setShowCourseDetailsModal,
  setSections,
  openEditModal,
  setShowAddBatchModal,
  handleDeleteBatch,
  handleEditStaff,
  handleDeleteStaff,
  setSelectedBatch,
  setShowAllocateStaffModal,
}) => {
  const onDeleteBatch = async (courseCode, sectionName) => {
    if (!confirm(`Delete batch ${sectionName}? This action cannot be undone.`)) return;
    try {
      await api.delete(`${API_BASE}/courses/${courseCode}/sections/${sectionName}`);
      toast.success('Batch deleted successfully');
      handleDeleteBatch(courseCode, sectionName);
    } catch (err) {
      const message = err.response?.data?.message || 'Error deleting batch';
      toast.error(message);
      if (message.includes('Unknown column')) {
        toast.warn('Database configuration issue detected. Please check server settings.');
      }
    }
  };

  const onDeleteStaff = async (staffCourseId) => {
    if (!confirm('Remove this staff from the batch?')) return;
    try {
      await api.delete(`${API_BASE}/staff-courses/${staffCourseId}`);
      toast.success('Staff removed successfully');
      handleDeleteStaff(staffCourseId);
    } catch (err) {
      const message = err.response?.data?.message || 'Error removing staff';
      toast.error(message);
      if (message.includes('Unknown column')) {
        toast.warn('Database configuration issue detected. Please check server settings.');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{selectedCourse.courseCode} - {selectedCourse.courseTitle}</h2>
            <button
              onClick={() => {
                setShowCourseDetailsModal(false);
                setSections(prev => ({ ...prev, [selectedCourse.courseId]: {} }));
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => {
                openEditModal(selectedCourse);
                setShowCourseDetailsModal(false);
              }}
              className="bg-orange-50 hover:bg-orange-100 text-orange-600 px-4 py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <Edit3 size={16} />
              Edit Course
            </button>
            <button
              onClick={() => {
                setShowAddBatchModal(true);
                setShowCourseDetailsModal(false);
              }}
              className="bg-purple-50 hover:bg-purple-100 text-purple-600 px-4 py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Batch
            </button>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Batches ({sections[selectedCourse.courseId] ? Object.keys(sections[selectedCourse.courseId]).length : 0})
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {fetchingSections ? (
              <p className="text-gray-500 italic">Loading batches...</p>
            ) : !sections[selectedCourse.courseId] || Object.keys(sections[selectedCourse.courseId]).length === 0 ? (
              <p className="text-gray-500 italic">No batches available. Add batches to get started.</p>
            ) : (
              Object.entries(sections[selectedCourse.courseId]).map(([sectionName, staffs]) => (
                <div key={sectionName} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">{sectionName}</h4>
                      <span className="text-sm text-gray-500">{staffs ? staffs.length : 0} Staff Assigned</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {staffs && staffs.length > 0 ? (
                        staffs.map(staff => (
                          <span key={staff.staffId} className="text-xs bg-white px-2 py-1 rounded-full border text-gray-700">
                            {staff.staffName || staff.name || 'Unknown'}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">No staff assigned</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {staffs && staffs.length > 0 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStaff(staffs[0].staffCourseId);
                          }}
                          className="bg-yellow-50 hover:bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteStaff(staffs[0].staffCourseId);
                          }}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </>
                    )}
                    {(!staffs || staffs.length === 0) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBatch(sectionName);
                          setShowAllocateStaffModal(true);
                          setShowCourseDetailsModal(false);
                        }}
                        className="bg-green-50 hover:bg-green-100 text-green-600 px-2 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                      >
                        <UserPlus size={14} />
                        Allocate Staff
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteBatch(selectedCourse.courseCode, sectionName)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      Delete Batch
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailsModal;
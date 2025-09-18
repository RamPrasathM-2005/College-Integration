import React from 'react';
import { X, UserPlus } from 'lucide-react';

const AllocateStaffModal = ({
  selectedCourse,
  selectedBatch,
  staffSearch,
  setStaffSearch,
  getFilteredStaff,
  handleAllocateStaff,
  setShowAllocateStaffModal,
  setShowCourseDetailsModal,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Allocate Staff to {selectedBatch} ({selectedCourse.courseCode})</h2>
            <button
              onClick={() => {
                setShowAllocateStaffModal(false);
                setStaffSearch('');
                setShowCourseDetailsModal(true);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by name, ID, or department..."
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto mb-4">
            {getFilteredStaff().length > 0 ? (
              getFilteredStaff().map(staff => (
                <div
                  key={staff.id}
                  onClick={() => handleAllocateStaff(staff.id)}
                  className="cursor-pointer bg-gray-50 p-2 rounded-lg mb-2 hover:bg-gray-100 flex justify-between items-center"
                >
                  <span>{staff.name} (ID: {staff.id}, Dept: {staff.departmentName})</span>
                  <UserPlus size={16} className="text-green-600" />
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic">No staff found matching the search.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowAllocateStaffModal(false);
                setStaffSearch('');
                setShowCourseDetailsModal(true);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllocateStaffModal;
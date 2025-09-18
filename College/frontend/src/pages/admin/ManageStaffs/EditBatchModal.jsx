import React from 'react';
import { X } from 'lucide-react';

const EditBatchModal = ({
  selectedStaffCourse,
  selectedStaff,
  setShowEditBatchModal,
  setSelectedStaffCourse,
  setSelectedSectionId,
  selectedSectionId,
  handleEditBatch,
  setShowStaffDetailsModal,
  operationFromModal,
  courses,
  operationLoading,
}) => {
  const course = courses.find(c => c.code === selectedStaffCourse.courseCode);

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Edit Section for {selectedStaffCourse.courseCode}</h2>
            <button
              onClick={() => {
                setShowEditBatchModal(false);
                setSelectedStaffCourse(null);
                setSelectedSectionId('');
                if (operationFromModal) setShowStaffDetailsModal(true);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              disabled={operationLoading}
            >
              <X size={24} />
            </button>
          </div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select New Section</h3>
            <div className="flex flex-wrap gap-2">
              {course && course.sections.length > 0 ? (
                course.sections.map(section => (
                  <button
                    key={section.sectionId}
                    onClick={() => setSelectedSectionId(section.sectionId)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      selectedSectionId === section.sectionId ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    disabled={operationLoading}
                  >
                    {section.sectionName}
                  </button>
                ))
              ) : (
                <p className="text-gray-500 italic">No sections available for this course.</p>
              )}
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setShowEditBatchModal(false);
                setSelectedStaffCourse(null);
                setSelectedSectionId('');
                if (operationFromModal) setShowStaffDetailsModal(true);
              }}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-semibold transition-all duration-200"
              disabled={operationLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleEditBatch}
              disabled={!selectedSectionId || operationLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
            >
              {operationLoading ? 'Processing...' : 'Update Section'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditBatchModal;
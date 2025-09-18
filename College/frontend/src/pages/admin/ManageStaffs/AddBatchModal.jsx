import React from 'react';
import { X } from 'lucide-react';

const AddBatchModal = ({
  selectedCourse,
  setShowAddBatchModal,
  newBatchForm,
  setNewBatchForm,
  handleAddBatch,
  setShowAllocateCourseModal,
  operationLoading,
}) => {
  return (
    <div className="fixed inset-0 backdrop-blur-md bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Add New Section for {selectedCourse.code}</h2>
            <button
              onClick={() => {
                setShowAddBatchModal(false);
                setShowAllocateCourseModal(true);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              disabled={operationLoading}
            >
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleAddBatch}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Sections</label>
              <input
                type="number"
                value={newBatchForm.numberOfBatches}
                onChange={e => setNewBatchForm({ numberOfBatches: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                min="1"
                required
                disabled={operationLoading}
              />
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddBatchModal(false);
                  setShowAllocateCourseModal(true);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-semibold transition-all duration-200"
                disabled={operationLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                disabled={operationLoading}
              >
                {operationLoading ? 'Processing...' : 'Add Section'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddBatchModal;
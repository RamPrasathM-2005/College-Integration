import React from 'react';
import { X } from 'lucide-react';

const AddBatchModal = ({
  selectedCourse,
  newBatchForm,
  setNewBatchForm,
  handleAddBatch,
  setShowAddBatchModal,
  setShowCourseDetailsModal,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Add Batches to {selectedCourse.courseCode}</h2>
            <button
              onClick={() => {
                setShowAddBatchModal(false);
                setShowCourseDetailsModal(true);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleAddBatch}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Batches *</label>
              <input
                type="number"
                min="1"
                value={newBatchForm.numberOfBatches}
                onChange={(e) => setNewBatchForm({ numberOfBatches: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Batches will be auto-generated as Batch1, Batch2, etc.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddBatchModal(false);
                  setShowCourseDetailsModal(true);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Add Batches
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddBatchModal;
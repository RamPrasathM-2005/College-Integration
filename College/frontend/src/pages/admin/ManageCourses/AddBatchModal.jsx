import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../../services/authService';

const API_BASE = 'http://localhost:4000/api/admin';

const AddBatchModal = ({
  selectedCourse,
  newBatchForm,
  setNewBatchForm,
  handleAddBatch,
  setShowAddBatchModal,
  setShowCourseDetailsModal,
  setSections,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCourse?.courseId) {
      toast.error('No course selected');
      return;
    }
    const numberOfBatches = parseInt(newBatchForm.numberOfBatches);
    if (isNaN(numberOfBatches) || numberOfBatches < 1) {
      toast.error('Number of batches must be a positive integer');
      return;
    }

    setIsSubmitting(true);

    // Optimistic update
    const optimisticBatches = {};
    for (let i = 1; i <= numberOfBatches; i++) {
      optimisticBatches[`Batch ${i}`] = [];
    }
    setSections(prev => {
      const newState = {
        ...prev,
        [String(selectedCourse.courseId)]: {
          ...(prev[String(selectedCourse.courseId)] || {}),
          ...optimisticBatches,
        },
      };
      console.log('AddBatchModal: Optimistically updated sections:', newState);
      return newState;
    });

    try {
      const response = await Promise.race([
        api.post(`${API_BASE}/courses/${selectedCourse.courseId}/sections`, {
          numberOfSections: numberOfBatches,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 5000))
      ]);

      console.log('AddBatchModal: API response for adding sections:', response.data);

      if (response.data.status !== 'success' || !Array.isArray(response.data.data)) {
        throw new Error('Invalid response format from server');
      }

      const newSections = response.data.data;
      if (newSections.length === 0) {
        console.warn('AddBatchModal: No sections returned in response');
        toast.warn('No new batches were added by the server');
      }

      const updatedBatches = newSections.reduce((acc, section) => {
        if (section.sectionName) {
          const normalizedName = section.sectionName.replace('BatchBatch', 'Batch');
          acc[normalizedName] = [];
        }
        return acc;
      }, {});

      setSections(prev => {
        const newState = {
          ...prev,
          [String(selectedCourse.courseId)]: {
            ...(prev[String(selectedCourse.courseId)] || {}),
            ...updatedBatches,
          },
        };
        console.log('AddBatchModal: Updated sections state:', newState);
        return newState;
      });

      toast.success(`Added ${newSections.length} batch${newSections.length > 1 ? 'es' : ''} successfully`);
      setNewBatchForm({ numberOfBatches: 1 });
      setShowAddBatchModal(false);
      setShowCourseDetailsModal(true);
      await handleAddBatch(); // Trigger refetch
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Error adding batches';
      console.error('AddBatchModal: Error adding batches:', err.response?.data || err);
      toast.error(message);
      if (err.response?.status === 404) {
        toast.error(`Course with ID ${selectedCourse.courseId} not found`);
      } else if (message.includes('duplicate entry')) {
        toast.error('Some batch names already exist for this course');
      } else if (err.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
      } else if (message.includes('Unknown column')) {
        toast.warn('Database configuration issue detected. Please check server settings.');
      }
      // Revert optimistic update
      setSections(prev => {
        const newState = { ...prev };
        const currentBatches = newState[String(selectedCourse.courseId)] || {};
        for (let i = 1; i <= numberOfBatches; i++) {
          delete currentBatches[`Batch ${i}`];
        }
        newState[String(selectedCourse.courseId)] = currentBatches;
        console.log('AddBatchModal: Reverted sections state:', newState);
        return newState;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Add Batches to {selectedCourse?.courseCode || 'Course'}
            </h2>
            <button
              onClick={() => {
                setShowAddBatchModal(false);
                setShowCourseDetailsModal(true);
                setNewBatchForm({ numberOfBatches: 1 });
              }}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Batches *
              </label>
              <input
                type="number"
                min="1"
                value={newBatchForm.numberOfBatches}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewBatchForm({ numberOfBatches: value === '' ? '' : parseInt(value) || 1 });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
                placeholder="Enter number of batches"
              />
              <p className="text-xs text-gray-500 mt-1">
                Batches will be auto-generated as Batch 1, Batch 2, etc.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddBatchModal(false);
                  setShowCourseDetailsModal(true);
                  setNewBatchForm({ numberOfBatches: 1 });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add Batches'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddBatchModal;
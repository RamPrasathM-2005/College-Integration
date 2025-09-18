import React from "react";

const PartitionModal = ({ show, newPartition, setNewPartition, isEdit, handleSavePartitions, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-4">{isEdit ? "Edit" : "Set"} Partitions</h2>
        <div className="space-y-4">
          <label>
            Theory COs:
            <input
              type="number"
              value={newPartition.theoryCount}
              onChange={(e) => setNewPartition({ ...newPartition, theoryCount: parseInt(e.target.value) })}
              className="ml-2 border p-1"
            />
          </label>
          <label>
            Practical COs:
            <input
              type="number"
              value={newPartition.practicalCount}
              onChange={(e) => setNewPartition({ ...newPartition, practicalCount: parseInt(e.target.value) })}
              className="ml-2 border p-1"
            />
          </label>
          <label>
            Experiential COs:
            <input
              type="number"
              value={newPartition.experientialCount}
              onChange={(e) => setNewPartition({ ...newPartition, experientialCount: parseInt(e.target.value) })}
              className="ml-2 border p-1"
            />
          </label>
        </div>
        <div className="flex justify-end mt-4 space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancel
          </button>
          <button onClick={() => handleSavePartitions(isEdit)} className="px-4 py-2 bg-blue-600 text-white rounded">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartitionModal;
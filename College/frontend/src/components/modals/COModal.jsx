import React from "react";

const COModal = ({ show, newCO, setNewCO, editingCO, partitions, handleSaveCO, onClose }) => {
  if (!show) return null;

  const nextCoNumber = editingCO ? newCO.coNumber : `CO${partitions.theoryCount + partitions.practicalCount + partitions.experientialCount + 1}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-4">{editingCO ? "Edit" : "Add"} Course Outcome</h2>
        <div className="space-y-4">
          <label>
            CO Number:
            <input
              type="text"
              value={newCO.coNumber}
              onChange={(e) => setNewCO({ ...newCO, coNumber: e.target.value })}
              className="ml-2 border p-1"
              placeholder={nextCoNumber}
            />
          </label>
          <label>
            Weightage:
            <input
              type="number"
              value={newCO.weightage}
              onChange={(e) => setNewCO({ ...newCO, weightage: parseInt(e.target.value) })}
              className="ml-2 border p-1"
            />
          </label>
          <label>
            Type:
            <select
              value={newCO.coType}
              onChange={(e) => setNewCO({ ...newCO, coType: e.target.value })}
              className="ml-2 border p-1"
            >
              <option value="THEORY">Theory</option>
              <option value="PRACTICAL">Practical</option>
              <option value="EXPERIENTIAL">Experiential</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end mt-4 space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancel
          </button>
          <button onClick={handleSaveCO} className="px-4 py-2 bg-blue-600 text-white rounded">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default COModal;
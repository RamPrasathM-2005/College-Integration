import React from "react";

const ToolModal = ({ show, newTool, setNewTool, editingTool, selectedCO, handleSaveTool, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-4">{editingTool ? "Edit" : "Add"} Tool for {selectedCO.coNumber}</h2>
        <div className="space-y-4">
          <label>
            Tool Name:
            <input
              type="text"
              value={newTool.toolName}
              onChange={(e) => setNewTool({ ...newTool, toolName: e.target.value })}
              className="ml-2 border p-1"
            />
          </label>
          <label>
            Weightage:
            <input
              type="number"
              value={newTool.weightage}
              onChange={(e) => setNewTool({ ...newTool, weightage: parseInt(e.target.value) })}
              className="ml-2 border p-1"
            />
          </label>
          <label>
            Max Marks:
            <input
              type="number"
              value={newTool.maxMarks}
              onChange={(e) => setNewTool({ ...newTool, maxMarks: parseInt(e.target.value) })}
              className="ml-2 border p-1"
            />
          </label>
        </div>
        <div className="flex justify-end mt-4 space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancel
          </button>
          <button onClick={handleSaveTool} className="px-4 py-2 bg-blue-600 text-white rounded">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToolModal;
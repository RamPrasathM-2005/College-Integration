import React, { useState } from "react";

const ImportMarksModal = ({ show, onClose, handleImportMarks, toolId }) => {
  const [file, setFile] = useState(null);

  if (!show) return null;

  const handleSubmit = () => {
    handleImportMarks(toolId, file);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-4">Import Marks</h2>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} accept=".csv" />
        <div className="flex justify-end mt-4 space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportMarksModal;
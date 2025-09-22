import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { toast } from 'react-toastify';

const ImportModal = ({
  semesters,
  setShowImportModal,
  onImport,
}) => {
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = () => {
    if (!selectedSemesterId) {
      toast.error('Please select a semester');
      return;
    }
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    onImport(file, selectedSemesterId);
    setShowImportModal(false);
    setFile(null);
    setSelectedSemesterId('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Import Courses from Excel</h2>
            <button
              onClick={() => {
                setShowImportModal(false);
                setFile(null);
                setSelectedSemesterId('');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Semester *</label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Semester</option>
              {semesters.map(sem => (
                <option key={sem.semesterId} value={sem.semesterId}>
                  Semester {sem.semesterNumber} - {sem.branch} {sem.batch || ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Excel File *</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload size={24} className="text-gray-500 mb-2" />
                  <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-gray-500">XLS or XLSX</p>
                </div>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {file && <p className="mt-2 text-sm text-green-600">Selected file: {file.name}</p>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowImportModal(false);
                setFile(null);
                setSelectedSemesterId('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedSemesterId || !file}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
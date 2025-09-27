
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../services/authService.js';

const BatchRegulationAllocation = () => {
  const [batches, setBatches] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedRegulation, setSelectedRegulation] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);

  useEffect(() => {
    fetchBatches();
    fetchRegulations();
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/batches');
      setBatches(res.data.data || []);
    } catch (err) {
      console.error('Fetch batches error:', err); // Log full error for debugging
      toast.error(err.response?.data?.message || 'Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegulations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/regulations');
      setRegulations(res.data.data || []);
    } catch (err) {
      console.error('Fetch regulations error:', err); // Log full error
      toast.error(err.response?.data?.message || 'Failed to fetch regulations');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async () => {
    if (!selectedBatch || !selectedRegulation) {
      toast.error('Please select a batch and regulation');
      return;
    }

    setIsAllocating(true);
    try {
      const response = await api.post('/admin/regulations/allocate-to-batch', {
        batchId: selectedBatch,
        regulationId: selectedRegulation,
      });
      toast.success(response.data.message);
    } catch (err) {
      console.error('Allocation error:', err); // Log full error
      toast.error(err.response?.data?.message || 'Error allocating regulation to batch');
    } finally {
      setIsAllocating(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center">
      <div className="w-full max-w-7xl mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Allocate Regulation to Batch</h1>
        <p className="text-gray-600 mt-1">Select a batch and regulation to allocate courses</p>
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6 mt-4">
          <div className="flex flex-wrap gap-4 items-end justify-center">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select Batch</option>
                {batches.map(batch => (
                  <option key={batch.batchId} value={batch.batchId}>
                    {batch.degree} - {batch.branch} ({batch.batchYears})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Regulation</label>
              <select
                value={selectedRegulation}
                onChange={(e) => setSelectedRegulation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select Regulation</option>
                {regulations.map(reg => (
                  <option key={reg.regulationId} value={reg.regulationId}>
                    {reg.Deptacronym} - {reg.regulationYear}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAllocate}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg font-semibold"
              disabled={isAllocating}
            >
              {isAllocating ? 'Allocating...' : 'Allocate to Batch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchRegulationAllocation;

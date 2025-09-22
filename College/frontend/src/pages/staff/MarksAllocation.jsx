// Fixed React Component: MarksAllocation.jsx
// Changes:
// - Added sectionId to useParams assuming route is now /marks/:courseId/:sectionId
// - Passed sectionId to useMarkAllocation hook
// - Fixed import handling to use state and button click (not direct onChange import)
// - Removed conflicting handleImportClick definitions; used the version with importFile state

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Download, ChevronDown, ChevronUp } from 'lucide-react';
import useMarkAllocation from '../../hooks/useMarkAllocation';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const MarksAllocation = () => {
  const { courseId, sectionId } = useParams(); // Added sectionId assuming updated route
  const navigate = useNavigate();
  console.log('courseId from useParams:', courseId, 'sectionId:', sectionId);
  const {
    partitions,
    setNewPartition,
    showPartitionModal,
    setShowPartitionModal,
    handleSavePartitions,
    handlePartitionsConfirmation,
    courseOutcomes,
    students,
    selectedCO,
    setSelectedCO,
    selectedTool,
    setSelectedTool,
    showToolModal,
    setShowToolModal,
    showImportModal,
    setShowImportModal,
    editingTool,
    setEditingTool,
    newTool,
    setNewTool,
    newPartition,
    coCollapsed,
    toggleCoCollapse,
    tempTools,
    setTempTools,
    addTempTool,
    handleSaveToolsForCO,
    handleDeleteTool,
    updateStudentMark,
    handleSaveToolMarks,
    handleImportMarks,
    exportCoWiseCsv,
    error,
    setError,
  } = useMarkAllocation(courseId, sectionId); // Passed sectionId to hook

  const [importFile, setImportFile] = useState(null);

  const calculateToolWeightageSum = (tools) => {
    return tools.reduce((sum, tool) => sum + (tool.weightage || 0), 0);
  };

  // const handleSavePartitionsClick = async () => {
  //   const result = await handleSavePartitions(partitions.partitionId);
  //   if (result.success) {
  //     await handlePartitionsConfirmation();
  //   } else {
  //     MySwal.fire('Error', result.error, 'error');
  //   }
  // };

  const handleSavePartitionsClick = async () => {
  if (
    newPartition.theoryCount < 0 ||
    newPartition.practicalCount < 0 ||
    newPartition.experientialCount < 0
  ) {
    MySwal.fire('Error', 'Partition counts cannot be negative', 'error');
    return;
  }
  // Trigger confirmation dialog
  await handlePartitionsConfirmation();
};

  const handleAddTempToolClick = () => {
    if (!newTool.toolName || newTool.weightage <= 0 || newTool.maxMarks <= 0) {
      MySwal.fire('Error', 'Tool name, weightage, and max marks are required', 'error');
      return;
    }
    const isEdit = !!editingTool;
    const selfUniqueId = isEdit ? editingTool.uniqueId : null;
    // Check for duplicate tool name, excluding self if editing
    const duplicate = tempTools.some(
      (t) =>
        t.toolName.toLowerCase() === newTool.toolName.toLowerCase() &&
        t.uniqueId !== selfUniqueId
    );
    if (duplicate) {
      MySwal.fire('Error', 'Tool with this name already exists for this CO', 'error');
      return;
    }
    if (isEdit) {
      // Update existing/temp tool in tempTools
      setTempTools((prev) =>
        prev.map((t) =>
          t.uniqueId === selfUniqueId ? { ...newTool, uniqueId: t.uniqueId } : t
        )
      );
    } else {
      // Add new tool to tempTools
      addTempTool(newTool);
    }
    setNewTool({ toolName: '', weightage: 0, maxMarks: 100 });
    setShowToolModal(false);
    setEditingTool(null);
  };

  const handleSaveToolsForCOClick = async (coId) => {
    const result = await handleSaveToolsForCO(coId);
    if (result.success) {
      MySwal.fire('Success', result.message, 'success');
    } else {
      MySwal.fire('Error', result.error, 'error');
    }
  };

  const handleDeleteToolClick = async (tool) => {
    // Remove from tempTools (no backend call needed, as save will handle deletions)
    setTempTools((prev) => prev.filter((t) => t.uniqueId !== tool.uniqueId));
    MySwal.fire('Success', 'Tool removed from draft', 'success');
  };

  const handleSaveToolMarksClick = async () => {
    const result = await handleSaveToolMarks();
    if (result.success) {
      MySwal.fire('Success', result.message, 'success');
    } else {
      MySwal.fire('Error', result.error, 'error');
    }
  };

  const handleImportClick = async () => {
    if (!importFile) {
      MySwal.fire('Error', 'Please select a file to import', 'error');
      return;
    }
    const result = await handleImportMarks(importFile);
    if (result.success) {
      MySwal.fire('Success', result.message, 'success');
    } else {
      MySwal.fire('Error', result.error, 'error');
    }
    setImportFile(null);
    setShowImportModal(false);
  };




  
  const handleFileChange = (e) => {
    setImportFile(e.target.files[0]);
  };

  const handleSelectCO = (e) => {
    const co = courseOutcomes.find(co => co.coId === parseInt(e.target.value)) || null;
    setSelectedCO(co);
    setSelectedTool(null);
    // Load existing tools into tempTools for drafting/editing
    setTempTools(co?.tools ? co.tools.map((t) => ({ ...t, uniqueId: t.toolId })) : []);
  };

  if (error) {
    MySwal.fire('Error', error, 'error');
    setError('');
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Marks Allocation</h1>
                <p className="text-sm text-gray-500">{courseId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Partitions Modal */}
        {showPartitionModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Set Course Partitions</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-sm font-semibold">Theory COs</label>
                  <input
                    type="number"
                    value={newPartition.theoryCount}
                    onChange={(e) => setNewPartition({ ...newPartition, theoryCount: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 border rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Practical COs</label>
                  <input
                    type="number"
                    value={newPartition.practicalCount}
                    onChange={(e) => setNewPartition({ ...newPartition, practicalCount: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 border rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Experiential COs</label>
                  <input
                    type="number"
                    value={newPartition.experientialCount}
                    onChange={(e) => setNewPartition({ ...newPartition, experientialCount: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 border rounded-lg"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowPartitionModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePartitionsClick}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Course Partitions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Course Partitions</h3>
            <button
              onClick={() => setShowPartitionModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Edit Partitions
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Theory COs</p>
              <p className="text-lg font-medium">{partitions.theoryCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Practical COs</p>
              <p className="text-lg font-medium">{partitions.practicalCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Experiential COs</p>
              <p className="text-lg font-medium">{partitions.experientialCount}</p>
            </div>
          </div>
        </div>

        {/* Course Outcomes (Overview Only) */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Course Outcomes (COs)</h3>
          {courseOutcomes.map((co, index) => (
            <div key={co.coId} className="mb-4 border-b pb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleCoCollapse(co.coId)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {coCollapsed[co.coId] ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  </button>
                  <span className="font-medium">{co.coNumber} ({co.coType})</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportCoWiseCsv(co.coId)}
                    className="px-3 py-1 bg-purple-600 text-white rounded-lg flex items-center"
                  >
                    <Download className="w-4 h-4 mr-1" /> Export
                  </button>
                </div>
              </div>
              {!coCollapsed[co.coId] && (
                <div className="mt-4 pl-8">
                  <h4 className="text-sm font-semibold">Tools for {co.coNumber}</h4>
                  {co.tools?.map((tool) => (
                    <div key={tool.toolId} className="ml-4 mb-2">
                      {tool.toolName} (Weightage: {tool.weightage}%, Max Marks: {tool.maxMarks})
                    </div>
                  ))}
                  <p className="text-sm mt-2">
                    Total Weightage: {calculateToolWeightageSum(co.tools || [])}%
                    {calculateToolWeightageSum(co.tools || []) !== 100 && co.tools?.length > 0 && (
                      <span className="text-red-500"> (Must be 100% to save)</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tool Modal */}
        {showToolModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">{editingTool ? 'Edit Tool' : 'Add Tool'}</h3>
              <div className="mb-4">
                <label className="text-sm font-semibold">Tool Name</label>
                <input
                  type="text"
                  value={newTool.toolName}
                  onChange={(e) => setNewTool({ ...newTool, toolName: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div className="mb-4">
                <label className="text-sm font-semibold">Weightage (%)</label>
                <input
                  type="number"
                  value={newTool.weightage}
                  onChange={(e) => setNewTool({ ...newTool, weightage: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border rounded-lg"
                  min="0"
                  max="100"
                />
              </div>
              <div className="mb-4">
                <label className="text-sm font-semibold">Max Marks</label>
                <input
                  type="number"
                  value={newTool.maxMarks}
                  onChange={(e) => setNewTool({ ...newTool, maxMarks: parseInt(e.target.value) || 100 })}
                  className="w-full p-2 border rounded-lg"
                  min="1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowToolModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTempToolClick}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  {editingTool ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Import Marks for {selectedTool?.toolName}</h3>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportClick}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mark Entry Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Mark Entry</h3>
          <div className="mb-4">
            <label className="text-sm font-semibold">Select CO</label>
            <select
              value={selectedCO?.coId || ''}
              onChange={handleSelectCO}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">Select a CO</option>
              {courseOutcomes.map(co => (
                <option key={co.coId} value={co.coId}>{co.coNumber} ({co.coType})</option>
              ))}
            </select>
          </div>
          {selectedCO && (
            <>
              <div className="mt-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold">Tools for {selectedCO.coNumber}</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTool(null);
                        setNewTool({ toolName: '', weightage: 0, maxMarks: 100 });
                        setShowToolModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg"
                    >
                      Add Tool
                    </button>
                    <button
                      onClick={() => handleSaveToolsForCOClick(selectedCO.coId)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </div>
                {/* Display draft tools from tempTools */}
                {tempTools.map((tool) => (
                  <div key={tool.uniqueId} className="ml-4 mb-2">
                    <div className="flex justify-between items-center">
                      <span>{tool.toolName} (Weightage: {tool.weightage}%, Max Marks: {tool.maxMarks})</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingTool(tool);
                            setNewTool({
                              toolName: tool.toolName,
                              weightage: tool.weightage,
                              maxMarks: tool.maxMarks,
                              toolId: tool.toolId, // Preserve if existing
                              uniqueId: tool.uniqueId, // Preserve for draft identification
                            });
                            setShowToolModal(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteToolClick(tool)}
                          className="px-3 py-1 bg-red-600 text-white rounded-lg" // Fixed typo 'lue-600' to 'red-600'
                        >
                          Delete
                        </button>
                        {tool.toolId && ( // Only show import for existing (saved) tools
                          <button
                            onClick={() => {
                              setSelectedTool(tool);
                              setShowImportModal(true);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg flex items-center"
                          >
                            <Upload className="w-4 h-4 mr-1" /> Import
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-sm mt-2">
                  Total Weightage: {calculateToolWeightageSum(tempTools)}%
                  {calculateToolWeightageSum(tempTools) !== 100 && (
                    <span className="text-red-500"> (Must be 100% to save)</span>
                  )}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Name</th>
                      <th className="border p-2 text-left">Reg No</th>
                      {selectedCO.tools?.map(tool => (
                        <th key={tool.toolId} className="border p-2">{tool.toolName} ({tool.maxMarks})</th>
                      ))}
                      <th className="border p-2">Consolidated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.regno}>
                        <td className="border p-2">{student.name}</td>
                        <td className="border p-2">{student.regno}</td>
                        {selectedCO.tools?.map(tool => (
                          <td key={tool.toolId} className="border p-2">
                            <input
                              type="number"
                              value={student.marks?.[tool.toolId] || ''}
                              onChange={(e) => updateStudentMark(tool.toolId, student.regno, parseInt(e.target.value) || 0)}
                              className="w-full p-1 border rounded-lg"
                              min="0"
                              max={tool.maxMarks}
                            />
                          </td>
                        ))}
                        <td className="border p-2">
                        {(
                          selectedCO.tools?.reduce((sum, tool) => {
                            const mark = student.marks?.[tool.toolId] || 0;
                            return sum + (mark / tool.maxMarks) * (tool.weightage / 100);
                          }, 0) * 100
                        ).toFixed(2)}
                      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={handleSaveToolMarksClick}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Save Marks
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarksAllocation;
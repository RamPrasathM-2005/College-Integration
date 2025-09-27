import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Download, ChevronDown, ChevronUp, Plus, Edit2, Trash2, Save } from 'lucide-react';
import useMarkAllocation from '../../hooks/useMarkAllocation';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const MarksAllocation = () => {
  const { courseId, sectionId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('courseId from useParams:', courseId, 'sectionId:', sectionId);
  }, [courseId, sectionId]);

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
  } = useMarkAllocation(courseId, sectionId);

  const [importFile, setImportFile] = useState(null);

  const calculateToolWeightageSum = (tools) => {
    return tools.reduce((sum, tool) => sum + (tool.weightage || 0), 0);
  };

  const handleSavePartitionsClick = async () => {
    if (
      newPartition.theoryCount < 0 ||
      newPartition.practicalCount < 0 ||
      newPartition.experientialCount < 0
    ) {
      MySwal.fire('Error', 'Partition counts cannot be negative', 'error');
      return;
    }
    await handlePartitionsConfirmation();
  };

  const handleAddTempToolClick = () => {
    if (!newTool.toolName || newTool.weightage <= 0 || newTool.maxMarks <= 0) {
      MySwal.fire('Error', 'Tool name, weightage, and max marks are required', 'error');
      return;
    }
    const isEdit = !!editingTool;
    const selfUniqueId = isEdit ? editingTool.uniqueId : null;
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
      setTempTools((prev) =>
        prev.map((t) =>
          t.uniqueId === selfUniqueId ? { ...newTool, uniqueId: t.uniqueId } : t
        )
      );
    } else {
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
    setTempTools((prev) => prev.filter((t) => t.uniqueId !== tool.uniqueId));
    MySwal.fire('Success', 'Tool removed from draft', 'success');
  };

const handleSaveToolMarksClick = async () => {
  if (!selectedCO || !selectedCO.tools || selectedCO.tools.length === 0) {
    MySwal.fire('Error', 'No tools selected for this CO', 'error');
    return;
  }

  let allSuccess = true;
  let errorMessage = '';

  for (const tool of selectedCO.tools) {
    const marks = students.map((student) => ({
      regno: student.regno,
      marksObtained: student.marks?.[tool.toolId] || 0,
    }));

    const result = await handleSaveToolMarks(tool.toolId, marks);
    if (!result.success) {
      allSuccess = false;
      errorMessage = result.error;
      break;
    }
  }

  if (allSuccess) {
    MySwal.fire('Success', 'Marks saved successfully for all tools', 'success');
  } else {
    MySwal.fire('Error', errorMessage || 'Failed to save marks for some tools', 'error');
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
    setTempTools(co?.tools ? co.tools.map((t) => ({ ...t, uniqueId: t.toolId })) : []);
  };

  if (error) {
    MySwal.fire('Error', error, 'error');
    setError('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Marks Allocation</h1>
                <p className="text-sm text-slate-500 mt-1">{courseId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Partitions Modal */}
        {showPartitionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Set Course Partitions</h3>
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Theory COs</label>
                  <input
                    type="number"
                    value={newPartition.theoryCount}
                    onChange={(e) => setNewPartition({ ...newPartition, theoryCount: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Practical COs</label>
                  <input
                    type="number"
                    value={newPartition.practicalCount}
                    onChange={(e) => setNewPartition({ ...newPartition, practicalCount: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Experiential COs</label>
                  <input
                    type="number"
                    value={newPartition.experientialCount}
                    onChange={(e) => setNewPartition({ ...newPartition, experientialCount: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPartitionModal(false)}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePartitionsClick}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Course Partitions */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">Course Partitions</h3>
            <button
              onClick={() => setShowPartitionModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium shadow-md"
            >
              Edit Partitions
            </button>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
              <p className="text-sm font-medium text-blue-600 mb-2">Theory COs</p>
              <p className="text-3xl font-bold text-blue-800">{partitions.theoryCount}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
              <p className="text-sm font-medium text-green-600 mb-2">Practical COs</p>
              <p className="text-3xl font-bold text-green-800">{partitions.practicalCount}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
              <p className="text-sm font-medium text-purple-600 mb-2">Experiential COs</p>
              <p className="text-3xl font-bold text-purple-800">{partitions.experientialCount}</p>
            </div>
          </div>
        </div>

        {/* Course Outcomes */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Course Outcomes (COs)</h3>
          <div className="space-y-4">
            {courseOutcomes.map((co, index) => (
              <div key={co.coId} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex justify-between items-center p-6 bg-slate-50">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleCoCollapse(co.coId)}
                      className="p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                    >
                      {coCollapsed[co.coId] ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>
                    <div>
                      <span className="font-semibold text-slate-900">{co.coNumber}</span>
                      <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">({co.coType})</span>
                    </div>
                  </div>
                  <button
                    onClick={() => exportCoWiseCsv(co.coId)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all duration-200 flex items-center gap-2 font-medium shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
                {!coCollapsed[co.coId] && (
                  <div className="p-6 border-t border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-4">Tools for {co.coNumber}</h4>
                    <div className="space-y-3">
                      {co.tools?.map((tool) => (
                        <div key={tool.toolId} className="bg-slate-50 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-700">{tool.toolName}</span>
                            <div className="flex gap-4 text-sm text-slate-600">
                              <span>Weightage: <strong className="text-blue-600">{tool.weightage}%</strong></span>
                              <span>Max Marks: <strong className="text-green-600">{tool.maxMarks}</strong></span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium">
                        Total Weightage: <span className="text-blue-700 font-bold">{calculateToolWeightageSum(co.tools || [])}%</span>
                        {calculateToolWeightageSum(co.tools || []) !== 100 && co.tools?.length > 0 && (
                          <span className="text-red-500 ml-2 font-semibold">(Must be 100% to save)</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tool Modal */}
        {showToolModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">{editingTool ? 'Edit Tool' : 'Add Tool'}</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tool Name</label>
                  <input
                    type="text"
                    value={newTool.toolName}
                    onChange={(e) => setNewTool({ ...newTool, toolName: e.target.value })}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                    placeholder="Enter tool name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Weightage (%)</label>
                  <input
                    type="number"
                    value={newTool.weightage}
                    onChange={(e) => setNewTool({ ...newTool, weightage: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                    min="0"
                    max="100"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Max Marks</label>
                  <input
                    type="number"
                    value={newTool.maxMarks}
                    onChange={(e) => setNewTool({ ...newTool, maxMarks: parseInt(e.target.value) || 100 })}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                    min="1"
                    placeholder="100"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setShowToolModal(false)}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTempToolClick}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg"
                >
                  {editingTool ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Import Marks for {selectedTool?.toolName}</h3>
              <div className="mb-6">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full p-3 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 transition-all duration-200"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportClick}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mark Entry Table */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Mark Entry</h3>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Select CO</label>
            <select
              value={selectedCO?.coId || ''}
              onChange={handleSelectCO}
              className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-white"
            >
              <option value="">Select a CO</option>
              {courseOutcomes.map(co => (
                <option key={co.coId} value={co.coId}>{co.coNumber} ({co.coType})</option>
              ))}
            </select>
          </div>

          {selectedCO && (
            <>
              {/* Tools Management */}
              <div className="mb-8 p-6 bg-slate-50 rounded-xl">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-semibold text-slate-900">Tools for {selectedCO.coNumber}</h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditingTool(null);
                        setNewTool({ toolName: '', weightage: 0, maxMarks: 100 });
                        setShowToolModal(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 font-medium shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      Add Tool
                    </button>
                    <button
                      onClick={() => handleSaveToolsForCOClick(selectedCO.coId)}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 flex items-center gap-2 font-medium shadow-md"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {tempTools.map((tool) => (
                    <div key={tool.uniqueId} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium text-slate-900">{tool.toolName}</span>
                          <div className="flex gap-4 text-sm text-slate-600 mt-1">
                            <span>Weightage: <strong className="text-blue-600">{tool.weightage}%</strong></span>
                            <span>Max Marks: <strong className="text-green-600">{tool.maxMarks}</strong></span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTool(tool);
                              setNewTool({
                                toolName: tool.toolName,
                                weightage: tool.weightage,
                                maxMarks: tool.maxMarks,
                                toolId: tool.toolId,
                                uniqueId: tool.uniqueId,
                              });
                              setShowToolModal(true);
                            }}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all duration-200"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteToolClick(tool)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all duration-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {tool.toolId && (
                            <button
                              onClick={() => {
                                setSelectedTool(tool);
                                setShowImportModal(true);
                              }}
                              className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-all duration-200"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium">
                    Total Weightage: <span className="text-blue-700 font-bold">{calculateToolWeightageSum(tempTools)}%</span>
                    {calculateToolWeightageSum(tempTools) !== 100 && (
                      <span className="text-red-500 ml-2 font-semibold">(Must be 100% to save)</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Marks Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border-b border-slate-200 p-4 text-left font-semibold text-slate-900">Name</th>
                      <th className="border-b border-slate-200 p-4 text-left font-semibold text-slate-900">Reg No</th>
                      {selectedCO.tools?.map(tool => (
                        <th key={tool.toolId} className="border-b border-slate-200 p-4 text-center font-semibold text-slate-900">
                          {tool.toolName}
                          <div className="text-xs text-slate-500 mt-1">({tool.maxMarks})</div>
                        </th>
                      ))}
                      <th className="border-b border-slate-200 p-4 text-center font-semibold text-slate-900">Consolidated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr key={student.regno} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border-b border-slate-200 p-4 font-medium text-slate-900">{student.name}</td>
                        <td className="border-b border-slate-200 p-4 text-slate-600">{student.regno}</td>
                        {selectedCO.tools?.map(tool => (
                          <td key={tool.toolId} className="border-b border-slate-200 p-4">
                            <input
                              type="number"
                              value={student.marks?.[tool.toolId] || ''}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (isNaN(value) || value < 0 || value > tool.maxMarks) return;
                                updateStudentMark(tool.toolId, student.regno, value);
                              }}
                              className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 text-center"
                              min="0"
                              max={tool.maxMarks}
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="border-b border-slate-200 p-4 text-center">
                          <div className="inline-flex px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
                            {(
                              selectedCO.tools?.reduce((sum, tool) => {
                                const mark = student.marks?.[tool.toolId] || 0;
                                return sum + (mark / tool.maxMarks) * (tool.weightage / 100);
                              }, 0) * 100
                            ).toFixed(2)}%
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveToolMarksClick}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 font-medium shadow-lg flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
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
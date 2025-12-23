import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom'; // Import createPortal
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Upload, Download, ChevronDown, ChevronUp, 
  Plus, Edit2, Trash2, Save, X, FileText 
} from 'lucide-react';
import useMarkAllocation from '../../hooks/useMarkAllocation';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getStudentCOMarks } from '../../services/staffService';

const MySwal = withReactContent(Swal);

// --- UPDATED Modal Component using Portal ---
const ModalWrapper = ({ 
  title, 
  children, 
  onClose, 
  onSave, 
  saveText = "Save changes", 
  showFooter = true, 
  saveDisabled = false,
  width = "max-w-lg"
}) => {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Use createPortal to render outside the parent container context
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
      {/* Modal Container */}
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${width} relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {showFooter && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between rounded-b-2xl">
            <button className="text-sm text-slate-500 hover:text-slate-700 font-medium hover:underline">
              Need help?
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 focus:ring-4 focus:ring-slate-100 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saveDisabled}
                className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl focus:ring-4 focus:ring-blue-100 transition-all shadow-md flex items-center gap-2
                  ${saveDisabled ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'}`}
              >
                {saveText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body // This renders the modal directly into the <body> tag
  );
};

const MarksAllocation = () => {
  const { courseId, sectionId } = useParams();
  const navigate = useNavigate();

  // --- Hooks & Logic ---
  const {
    partitions,
    setNewPartition,
    showPartitionModal,
    setShowPartitionModal,
    handleSavePartitions,
    handlePartitionsConfirmation,
    courseOutcomes,
    students,
    setStudents,
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
    handleExportCoWiseCsv,
    error,
    setError,
    loading,
  } = useMarkAllocation(courseId, sectionId);

  const [importFile, setImportFile] = useState(null);

  // --- Helpers ---
  const calculateToolWeightageSum = (tools) => {
    return tools.reduce((sum, tool) => sum + (tool.weightage || 0), 0);
  };

  const calculateConsolidated = useCallback((student, co) => {
    if (!co || !co.tools || co.tools.length === 0) return 0;
    let consolidated = 0;
    let totalWeight = 0;
    co.tools.forEach(tool => {
      const marksObtained = student.marks?.[tool.toolId] ?? 0;
      const weight = tool.weightage / 100;
      consolidated += (marksObtained / tool.maxMarks) * weight;
      totalWeight += weight;
    });
    return totalWeight > 0 ? Math.round((consolidated / totalWeight) * 100 * 100) / 100 : 0;
  }, []);

  // --- Handlers ---
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
      const updatedCO = courseOutcomes.find(c => c.coId === coId);
      if (updatedCO) {
        setSelectedCO(updatedCO);
        setTempTools(updatedCO.tools ? updatedCO.tools.map((t) => ({ ...t, uniqueId: t.toolId })) : []);
      }
      MySwal.fire('Success', result.message, 'success');
    } else {
      MySwal.fire('Error', result.error, 'error');
    }
  };

  const handleDeleteToolClick = async (tool) => {
    const result = await handleDeleteTool(tool);
    if (result.success) {
      setTempTools((prev) => prev.filter(t => t.uniqueId !== tool.uniqueId));
      if (selectedCO && selectedCO.coId === tool.coId) {
        const updatedCO = courseOutcomes.find(c => c.coId === selectedCO.coId);
        if (updatedCO) {
          setSelectedCO(updatedCO);
          setTempTools(updatedCO.tools ? updatedCO.tools.map((t) => ({ ...t, uniqueId: t.toolId })) : []);
        }
      }
      MySwal.fire('Success', result.message, 'success');
    } else {
      MySwal.fire('Error', result.error, 'error');
    }
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
        marksObtained: student.marks?.[tool.toolId] ?? 0,
      }));

      const result = await handleSaveToolMarks(tool.toolId, marks);
      if (!result.success) {
        allSuccess = false;
        errorMessage = result.error;
        break;
      }
    }

    if (allSuccess) {
      try {
        const updatedCoMarks = await getStudentCOMarks(courseId);
        setStudents((prev) =>
          prev.map((student) => {
            const coMark = updatedCoMarks.data.students.find((m) => m.regno === student.regno);
            if (coMark) {
              const newConsolidatedMarks = { ...student.consolidatedMarks };
              courseOutcomes.forEach((co) => {
                const markData = coMark.marks[co.coNumber];
                newConsolidatedMarks[co.coId] = markData ? Number(markData.consolidatedMark) : 0;
              });
              return { ...student, consolidatedMarks: newConsolidatedMarks };
            }
            return student;
          })
        );
      } catch (refetchErr) {
        console.error('Error refetching CO marks:', refetchErr);
      }
      MySwal.fire('Success', 'Tool marks and consolidated CO marks saved successfully', 'success');
    } else {
      MySwal.fire('Error', errorMessage || 'Failed to save marks for some tools', 'error');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        MySwal.fire('Error', 'Please select a CSV file', 'error');
        setImportFile(null);
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        MySwal.fire('Error', 'File size must be less than 5MB', 'error');
        setImportFile(null);
        e.target.value = '';
        return;
      }
      setImportFile(file);
    } else {
      setImportFile(null);
    }
  };

  const handleImportClick = async () => {
    if (!importFile) {
      MySwal.fire('Error', 'Please select a file to import', 'error');
      return;
    }
    const result = await handleImportMarks(importFile);
    if (result.success) {
      MySwal.fire('Success', 'Marks imported and consolidated CO marks saved successfully', 'success');
      setImportFile(null);
    } else {
      MySwal.fire('Error', result.error, 'error');
    }
    setShowImportModal(false);
  };

  const handleSelectCO = (e) => {
    const co = courseOutcomes.find(co => co.coId === parseInt(e.target.value)) || null;
    setSelectedCO(co);
    setSelectedTool(null);
    setTempTools(co?.tools ? co.tools.map((t) => ({ ...t, uniqueId: t.toolId })) : []);
  };

  if (loading) return <div>Loading...</div>;
  if (error) MySwal.fire('Error', error, 'error').then(() => setError(''));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800">
      
      {/* --- HEADER --- */}
      <div className="bg-white shadow-lg border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Marks Allocation</h1>
                <p className="text-sm text-slate-500 font-medium">{courseId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* ================= MODALS ================= */}

        {/* 1. Partitions Modal */}
        {showPartitionModal && (
          <ModalWrapper
            title="Set Course Partitions"
            onClose={() => setShowPartitionModal(false)}
            onSave={handleSavePartitionsClick}
            saveText="Save Partition"
          >
            <p className="text-sm text-slate-500 mb-6">
              Define the number of Course Outcomes (COs) allocated to each category.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 hover:border-blue-300 transition-colors group">
                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Theory</label>
                <input
                  type="number"
                  value={newPartition.theoryCount}
                  onChange={(e) => setNewPartition({ ...newPartition, theoryCount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white p-2.5 border border-blue-200 rounded-lg text-lg font-bold text-slate-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                  min="0"
                />
              </div>
              <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 hover:border-green-300 transition-colors group">
                <label className="block text-xs font-bold text-green-600 uppercase tracking-wide mb-2">Practical</label>
                <input
                  type="number"
                  value={newPartition.practicalCount}
                  onChange={(e) => setNewPartition({ ...newPartition, practicalCount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white p-2.5 border border-green-200 rounded-lg text-lg font-bold text-slate-900 focus:ring-4 focus:ring-green-100 focus:border-green-500 outline-none transition-all"
                  min="0"
                />
              </div>
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 hover:border-purple-300 transition-colors group">
                <label className="block text-xs font-bold text-purple-600 uppercase tracking-wide mb-2">Experiential</label>
                <input
                  type="number"
                  value={newPartition.experientialCount}
                  onChange={(e) => setNewPartition({ ...newPartition, experientialCount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white p-2.5 border border-purple-200 rounded-lg text-lg font-bold text-slate-900 focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all"
                  min="0"
                />
              </div>
            </div>
          </ModalWrapper>
        )}

        {/* 2. Tool Modal */}
        {showToolModal && (
          <ModalWrapper
            title={editingTool ? 'Edit Assessment Tool' : 'Add Assessment Tool'}
            onClose={() => setShowToolModal(false)}
            onSave={handleAddTempToolClick}
            saveText={editingTool ? 'Update Tool' : 'Add Tool'}
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tool Name</label>
                <input
                  type="text"
                  value={newTool.toolName}
                  onChange={(e) => setNewTool({ ...newTool, toolName: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                  placeholder="e.g. Assignment 1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Weightage (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={newTool.weightage}
                      onChange={(e) => setNewTool({ ...newTool, weightage: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
                      placeholder="0"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-gray-400 font-medium">%</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Max Marks</label>
                  <input
                    type="number"
                    value={newTool.maxMarks}
                    onChange={(e) => setNewTool({ ...newTool, maxMarks: parseInt(e.target.value) || 100 })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
                    placeholder="100"
                  />
                </div>
              </div>
            </div>
          </ModalWrapper>
        )}

        {/* 3. Import Modal */}
        {showImportModal && (
          <ModalWrapper
            title={`Import Marks`}
            onClose={() => {
              setShowImportModal(false);
              setImportFile(null);
            }}
            onSave={handleImportClick}
            saveText="Import Marks"
            saveDisabled={!importFile}
          >
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900 font-medium">Target Tool: {selectedTool?.toolName}</p>
                  <p className="text-xs text-blue-700">Ensure your CSV matches the student list for this section.</p>
                </div>
              </div>

              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${importFile ? 'border-blue-500 bg-blue-50/30' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                <div className="flex flex-col items-center justify-center">
                  <div className={`p-4 rounded-full mb-3 ${importFile ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Upload className="w-8 h-8" />
                  </div>
                  
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-blue-600 font-bold hover:underline">Click to upload</span>
                    <span className="text-slate-500 font-medium"> or drag and drop</span>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv, text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-400 mt-2 font-medium">CSV files only (Max 5MB)</p>
                </div>
              </div>

              {importFile && (
                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                   <div className="flex items-center overflow-hidden">
                     <div className="bg-green-100 p-2 rounded-lg text-green-700 mr-3 shrink-0">
                       <span className="text-xs font-bold">CSV</span>
                     </div>
                     <div className="min-w-0">
                       <p className="text-sm font-semibold text-slate-900 truncate">{importFile.name}</p>
                       <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                     </div>
                   </div>
                   <button 
                    onClick={() => {setImportFile(null); document.querySelector('#file-upload').value=''}} 
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                   >
                      <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              )}
              
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <h5 className="text-amber-800 text-xs font-bold uppercase mb-2">Required CSV Format</h5>
                <code className="block bg-white border border-amber-100 rounded p-2 text-xs text-slate-600 font-mono">
                  regno, marksObtained<br/>
                  REG101, 85
                </code>
              </div>
            </div>
          </ModalWrapper>
        )}

        {/* ================= MAIN CONTENT ================= */}

        {/* 1. Course Partitions Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Course Partitions</h3>
              <p className="text-sm text-slate-500 mt-1">Overview of CO distribution</p>
            </div>
            <button
              onClick={() => setShowPartitionModal(true)}
              className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all font-semibold shadow-sm text-sm"
            >
              Edit Partitions
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-6 rounded-2xl shadow-sm">
              <p className="text-sm font-semibold text-blue-600 mb-1 uppercase tracking-wider">Theory COs</p>
              <p className="text-4xl font-extrabold text-blue-900">{partitions.theoryCount}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 p-6 rounded-2xl shadow-sm">
              <p className="text-sm font-semibold text-green-600 mb-1 uppercase tracking-wider">Practical COs</p>
              <p className="text-4xl font-extrabold text-green-900">{partitions.practicalCount}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 p-6 rounded-2xl shadow-sm">
              <p className="text-sm font-semibold text-purple-600 mb-1 uppercase tracking-wider">Experiential COs</p>
              <p className="text-4xl font-extrabold text-purple-900">{partitions.experientialCount}</p>
            </div>
          </div>
        </div>

        {/* 2. Course Outcomes List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Course Outcomes (COs)</h3>
          <div className="space-y-4">
            {courseOutcomes.map((co) => (
              <div key={co.coId} className="border border-slate-200 rounded-2xl overflow-hidden transition-all hover:border-blue-300">
                <div className="flex justify-between items-center p-5 bg-slate-50/50 cursor-pointer" onClick={() => toggleCoCollapse(co.coId)}>
                  <div className="flex items-center gap-4">
                    <button className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                      {coCollapsed[co.coId] ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>
                    <div>
                      <span className="font-bold text-slate-900 text-lg">{co.coNumber}</span>
                      <span className="ml-3 px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full shadow-sm">
                        {co.coType}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExportCoWiseCsv(co.coId); }}
                    className="px-4 py-2 text-sm bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 font-semibold shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
                {!coCollapsed[co.coId] && (
                  <div className="p-6 border-t border-slate-200 bg-white animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-slate-800">Tools configured</h4>
                      <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">Read-only view</span>
                    </div>
                    {(!co.tools || co.tools.length === 0) ? (
                      <p className="text-slate-400 text-sm italic">No tools configured yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {co.tools.map((tool) => (
                          <div key={tool.toolId} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-900 block mb-2">{tool.toolName}</span>
                            <div className="flex justify-between text-sm text-slate-600">
                              <span>Weight: <span className="font-semibold text-blue-600">{tool.weightage}%</span></span>
                              <span>Max: <span className="font-semibold text-green-600">{tool.maxMarks}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-600">Total Weightage:</p> 
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${calculateToolWeightageSum(co.tools || []) === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {calculateToolWeightageSum(co.tools || [])}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3. Mark Entry Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Mark Entry & Configuration</h3>
          
          <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Select Course Outcome to Manage</label>
            <div className="relative">
              <select
                value={selectedCO?.coId || ''}
                onChange={handleSelectCO}
                className="w-full appearance-none p-4 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all bg-white font-medium text-slate-700"
              >
                <option value="">-- Choose a CO --</option>
                {courseOutcomes.map(co => (
                  <option key={co.coId} value={co.coId}>{co.coNumber} - {co.coType}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none w-5 h-5" />
            </div>
          </div>

          {selectedCO && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Tools Management */}
              <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Tools for {selectedCO.coNumber}</h4>
                    <p className="text-sm text-slate-500">Manage assessment tools and weightage</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        setEditingTool(null);
                        setNewTool({ toolName: '', weightage: 0, maxMarks: 100 });
                        setShowToolModal(true);
                      }}
                      className="flex-1 sm:flex-none justify-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 font-semibold shadow-md shadow-blue-200"
                    >
                      <Plus className="w-4 h-4" />
                      Add Tool
                    </button>
                    <button
                      onClick={() => handleSaveToolsForCOClick(selectedCO.coId)}
                      className="flex-1 sm:flex-none justify-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center gap-2 font-semibold shadow-md shadow-green-200"
                    >
                      <Save className="w-4 h-4" />
                      Save Config
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {tempTools.length === 0 && (
                    <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                      No tools added yet. Click "Add Tool" to start.
                    </div>
                  )}
                  {tempTools.map((tool) => (
                    <div key={tool.uniqueId} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors group">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-900">{tool.toolName}</span>
                          <div className="flex gap-4 text-sm text-slate-500 mt-1 font-medium">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {tool.weightage}% Weight</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> {tool.maxMarks} Marks</span>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {tool.toolId && (
                            <button
                              onClick={() => {
                                setSelectedTool(tool);
                                setShowImportModal(true);
                              }}
                              className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-purple-100 hover:text-purple-600 transition-all"
                              title="Import Marks"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteToolClick(tool)}
                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-red-100 hover:text-red-600 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-end">
                   <div className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${calculateToolWeightageSum(tempTools) === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      Total Weightage: {calculateToolWeightageSum(tempTools)}%
                      {calculateToolWeightageSum(tempTools) !== 100 && <span className="font-normal opacity-80">(Must be 100%)</span>}
                   </div>
                </div>
              </div>

              {/* Marks Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="p-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wide">Student Name</th>
                        <th className="p-4 text-left font-bold text-slate-700 text-sm uppercase tracking-wide">Reg No</th>
                        {selectedCO.tools?.map(tool => (
                          <th key={tool.toolId} className="p-4 text-center font-bold text-slate-700 text-sm uppercase tracking-wide">
                            <div className="flex flex-col items-center">
                              {tool.toolName}
                              <span className="text-[10px] bg-white border px-1.5 py-0.5 rounded mt-1 normal-case text-slate-500">Max: {tool.maxMarks}</span>
                            </div>
                          </th>
                        ))}
                        <th className="p-4 text-center font-bold text-slate-700 text-sm uppercase tracking-wide">Consolidated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((student) => (
                        <tr key={student.regno} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-semibold text-slate-900">{student.name}</td>
                          <td className="p-4 text-slate-500 font-mono text-sm">{student.regno}</td>
                          {selectedCO.tools?.map(tool => (
                            <td key={tool.toolId} className="p-4">
                              <input
                                type="number"
                                value={student.marks?.[tool.toolId] ?? ''}
                                onChange={(e) => {
                                  const rawValue = e.target.value;
                                  let value = null;
                                  if (rawValue !== '') {
                                    const num = parseInt(rawValue);
                                    if (!isNaN(num) && num >= 0 && num <= tool.maxMarks) {
                                      value = num;
                                    } else {
                                      return;
                                    }
                                  }
                                  updateStudentMark(tool.toolId, student.regno, value);
                                }}
                                className="w-full sm:w-24 mx-auto block p-2 border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center font-medium text-slate-900"
                                min="0"
                                max={tool.maxMarks}
                                placeholder="-"
                              />
                            </td>
                          ))}
                          <td className="p-4 text-center">
                            <div className="inline-flex px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm border border-slate-200">
                              {calculateConsolidated(student, selectedCO).toFixed(2)}%
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSaveToolMarksClick}
                  className="px-8 py-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-bold shadow-xl flex items-center gap-3 transform active:scale-95"
                >
                  <Save className="w-5 h-5" />
                  Save All Marks
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarksAllocation;
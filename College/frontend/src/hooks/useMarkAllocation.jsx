import { useState, useEffect } from 'react';
import {
  getCoursePartitions,
  saveCoursePartitions,
  updateCoursePartitions,
  getCOsForCourse,
  getToolsForCO,
  updateTool,
  deleteTool,
  saveToolsForCO,
  getStudentMarksForTool,
  saveStudentMarksForTool,
  importMarksForTool,
  exportCoWiseCsv,
  exportCourseWiseCsv,
  getStudentsForSection,
} from '../services/staffService';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const useMarkAllocation = (courseCode, sectionId) => {
  const [partitions, setPartitions] = useState({ theoryCount: 0, practicalCount: 0, experientialCount: 0, partitionId: null });
  const [courseOutcomes, setCourseOutcomes] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCO, setSelectedCO] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showPartitionModal, setShowPartitionModal] = useState(false);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [newPartition, setNewPartition] = useState({ theoryCount: 0, practicalCount: 0, experientialCount: 0 });
  const [newTool, setNewTool] = useState({ toolName: '', weightage: 0, maxMarks: 100 });
  const [coCollapsed, setCoCollapsed] = useState({});
  const [error, setError] = useState('');
  const [tempTools, setTempTools] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!courseCode || !sectionId) {
        console.error('Error: Invalid courseCode or sectionId:', courseCode, sectionId);
        setError('Invalid course or section selected. Please select a valid course and section.');
        return;
      }
      try {
        setError('');
        const parts = await getCoursePartitions(courseCode);
        setPartitions(parts);
        setNewPartition(parts);
        setShowPartitionModal(!parts.partitionId);
        const cos = await getCOsForCourse(courseCode);
        console.log('getCOsForCourse response:', cos);
        if (!Array.isArray(cos)) {
          console.error('Error: getCOsForCourse did not return an array:', cos);
          setError('No course outcomes found for this course');
          setCourseOutcomes([]);
          return;
        }
        const cosWithTools = await Promise.all(
          cos.map(async (co) => {
            const tools = await getToolsForCO(co.coId);
            return { ...co, tools };
          })
        );
        setCourseOutcomes(cosWithTools);
        const studentsData = await getStudentsForSection(courseCode, sectionId);
        console.log('getStudentsForSection response:', studentsData);
        if (!Array.isArray(studentsData)) {
          console.error('Error: getStudentsForSection did not return an array:', studentsData);
          setError('No students found for this course section');
          setStudents([]);
          return;
        }
        const studentsWithMarks = await Promise.all(
          studentsData.map(async (student) => {
            const marks = {};
            for (const co of cosWithTools) {
              for (const tool of co.tools || []) {
                try {
                  const marksData = await getStudentMarksForTool(tool.toolId);
                  const studentMark = marksData.find((m) => m.regno === student.regno);
                  marks[tool.toolId] = studentMark ? studentMark.marksObtained : 0;
                } catch (markErr) {
                  console.warn('Error fetching marks for tool:', tool.toolId, markErr);
                  marks[tool.toolId] = 0;
                }
              }
            }
            return { ...student, marks };
          })
        );
        setStudents(studentsWithMarks);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch data');
      }
    };
    fetchData();
  }, [courseCode, sectionId]);

  const toggleCoCollapse = (coId) => {
    setCoCollapsed((prev) => ({ ...prev, [coId]: !prev[coId] }));
  };

  const handlePartitionsConfirmation = async () => {
    const result = await MySwal.fire({
      title: 'Confirm Partitions',
      text: 'Are you sure about the partition counts? This will create or update COs.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, confirm',
      cancelButtonText: 'No, edit',
    });

    if (result.isConfirmed) {
      try {
        const currentPartitions = await getCoursePartitions(courseCode);
        setPartitions(currentPartitions);
        const saveResult = await handleSavePartitions(currentPartitions.partitionId);
        if (saveResult.success) {
          MySwal.fire('Success', saveResult.message, 'success');
        } else {
          MySwal.fire('Error', saveResult.error, 'error');
        }
      } catch (err) {
        console.error('Error during confirmation:', err);
        MySwal.fire('Error', err.response?.data?.message || err.message || 'Failed to confirm partitions', 'error');
      }
    } else {
      setShowPartitionModal(true);
    }
  };

  const handleSavePartitions = async (partitionId) => {
    if (!courseCode) {
      const errMsg = 'Invalid course selected';
      console.error(errMsg);
      setError(errMsg);
      return { success: false, error: errMsg };
    }
    if (
      newPartition.theoryCount < 0 ||
      newPartition.practicalCount < 0 ||
      newPartition.experientialCount < 0
    ) {
      const errMsg = 'Partition counts cannot be negative';
      console.error(errMsg);
      setError(errMsg);
      return { success: false, error: errMsg };
    }
    try {
      setError('');
      console.log('Saving partitions for courseCode:', courseCode, 'Data:', newPartition, 'partitionId:', partitionId);
      const currentPartitions = await getCoursePartitions(courseCode);
      const exists = !!currentPartitions.partitionId;
      let response;
      if (exists) {
        response = await updateCoursePartitions(courseCode, newPartition);
      } else {
        response = await saveCoursePartitions(courseCode, newPartition);
      }
      setPartitions({ ...newPartition, partitionId: response.data?.partitionId || currentPartitions.partitionId });
      setShowPartitionModal(false);
      const cos = await getCOsForCourse(courseCode);
      console.log('getCOsForCourse after save partitions:', cos);
      if (!Array.isArray(cos)) {
        console.error('Error: getCOsForCourse did not return an array after saving partitions:', cos);
        setError('Failed to load course outcomes after saving partitions');
        return { success: false, error: 'Failed to load course outcomes' };
      }
      const cosWithTools = await Promise.all(
        cos.map(async (co) => {
          const tools = await getToolsForCO(co.coId);
          return { ...co, tools };
        })
      );
      setCourseOutcomes(cosWithTools);
      return { success: true, message: 'Partitions and COs saved successfully' };
    } catch (err) {
      console.error('Error saving partitions:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save partitions';
      if (err.response?.status === 409) {
        MySwal.fire({
          title: 'Partitions Already Exist',
          text: 'Partitions already exist for this course. Would you like to update them instead?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, update',
          cancelButtonText: 'No, cancel',
        }).then(async (result) => {
          if (result.isConfirmed) {
            try {
              const updateResponse = await updateCoursePartitions(courseCode, newPartition);
              setPartitions({ ...newPartition, partitionId: updateResponse.data?.partitionId });
              setShowPartitionModal(false);
              const cos = await getCOsForCourse(courseCode);
              const cosWithTools = await Promise.all(
                cos.map(async (co) => {
                  const tools = await getToolsForCO(co.coId);
                  return { ...co, tools };
                })
              );
              setCourseOutcomes(cosWithTools);
              MySwal.fire('Success', 'Partitions updated successfully', 'success');
            } catch (updateErr) {
              MySwal.fire('Error', updateErr.response?.data?.message || updateErr.message || 'Failed to update partitions', 'error');
            }
          }
        });
        return { success: false, error: 'Partitions already exist' };
      }
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const addTempTool = (tool) => {
    setTempTools((prev) => [...prev, { ...tool, uniqueId: Date.now() }]);
  };

  const handleSaveToolsForCO = async (coId) => {
    const co = courseOutcomes.find((c) => c.coId === coId);
    if (!co) {
      const errMsg = 'CO not found';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
    const totalWeightage = tempTools.reduce((sum, tool) => sum + (tool.weightage || 0), 0);
    if (totalWeightage !== 100) {
      const errMsg = 'Total tool weightage for this CO must be exactly 100%';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
    try {
      setError('');
      const toolsToSave = tempTools.map(({ uniqueId, ...tool }) => tool);
      await saveToolsForCO(coId, { tools: toolsToSave });
      const updatedTools = await getToolsForCO(coId);
      setCourseOutcomes((prev) =>
        prev.map((c) => (c.coId === coId ? { ...c, tools: updatedTools } : c))
      );
      setSelectedCO({ ...selectedCO, tools: updatedTools });
      setTempTools([]);
      return { success: true, message: 'Tools saved successfully' };
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to save tools';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const handleDeleteTool = async (tool) => {
    try {
      setError('');
      if (tool.toolId) {
        await deleteTool(tool.toolId);
      }
      setTempTools((prev) => prev.filter((t) => t.uniqueId !== tool.uniqueId));
      const updatedTools = await getToolsForCO(selectedCO.coId);
      setCourseOutcomes((prev) =>
        prev.map((co) => (co.coId === selectedCO.coId ? { ...co, tools: updatedTools } : co))
      );
      setSelectedCO({ ...selectedCO, tools: updatedTools });
      return { success: true, message: 'Tool deleted successfully' };
    } catch (err) {
      console.error('Error deleting tool:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to delete tool';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const updateStudentMark = async (toolId, regno, marks) => {
  // Optimistically update the local state
  const previousStudents = [...students]; // Store previous state for rollback
  setStudents((prev) =>
    prev.map((s) =>
      s.regno === regno ? { ...s, marks: { ...s.marks, [toolId]: marks } } : s
    )
  );

  try {
    setError('');
    // Call the backend API to validate and save the mark
    const response = await saveStudentMarksForTool(toolId, {
      marks: [{ regno, marksObtained: marks }],
    });
    return { success: true, message: response.message || 'Mark updated successfully' };
  } catch (err) {
    console.error('Error updating mark:', err);
    // Roll back the optimistic update
    setStudents(previousStudents);
    const errMsg =
      err.response?.data?.message ||
      err.message ||
      'Failed to update mark';
    setError(errMsg);
    return { success: false, error: errMsg };
  }
};

  const handleSaveToolMarks = async (toolId, marks) => {
    try {
      setError('');
      await saveStudentMarksForTool(toolId, { marks });
      const updatedMarks = await getStudentMarksForTool(toolId);
      setStudents((prev) =>
        prev.map((student) => {
          const studentMark = updatedMarks.find((m) => m.regno === student.regno);
          return {
            ...student,
            marks: {
              ...student.marks,
              [toolId]: studentMark ? studentMark.marksObtained : student.marks[toolId] || 0,
            },
          };
        })
      );
      return { success: true, message: 'Marks saved successfully' };
    } catch (err) {
      console.error('Error saving tool marks:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save marks';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const handleImportMarks = async (toolId, file) => {
    try {
      setError('');
      const formData = new FormData();
      formData.append('file', file);
      await importMarksForTool(toolId, formData);
      const updatedMarks = await getStudentMarksForTool(toolId);
      setStudents((prev) =>
        prev.map((student) => {
          const studentMark = updatedMarks.find((m) => m.regno === student.regno);
          return {
            ...student,
            marks: {
              ...student.marks,
              [toolId]: studentMark ? studentMark.marksObtained : student.marks[toolId] || 0,
            },
          };
        })
      );
      setShowImportModal(false);
      return { success: true, message: 'Marks imported successfully' };
    } catch (err) {
      console.error('Error importing marks:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to import marks';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const handleExportCoWiseCsv = async (coId) => {
    try {
      setError('');
      await exportCoWiseCsv(coId);
      return { success: true, message: 'CSV exported successfully' };
    } catch (err) {
      console.error('Error exporting CO-wise CSV:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to export CSV';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const handleExportCourseWiseCsv = async () => {
    try {
      setError('');
      await exportCourseWiseCsv(courseCode);
      return { success: true, message: 'Course-wise CSV exported successfully' };
    } catch (err) {
      console.error('Error exporting course-wise CSV:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to export CSV';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  return {
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
    handleExportCoWiseCsv,
    exportCourseWiseCsv: handleExportCourseWiseCsv,
    error,
    setError,
  };
};

export default useMarkAllocation;
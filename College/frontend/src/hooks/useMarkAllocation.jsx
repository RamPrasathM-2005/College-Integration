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
import { calculateCOMarks } from '../utils/calculations';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const useMarkAllocation = (courseId, sectionId) => {
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
      if (!courseId || courseId.startsWith('course-') || !sectionId) {
        console.error('Error: Invalid courseId or sectionId:', courseId, sectionId);
        setError('Invalid course or section selected. Please select a valid course and section.');
        return;
      }
      try {
        setError('');
        // Fetch partitions
        const parts = await getCoursePartitions(courseId);
        setPartitions(parts);
        setNewPartition(parts);
        setShowPartitionModal(!parts.partitionId); // Show modal only if no partitions exist
        // Fetch course outcomes
        const cos = await getCOsForCourse(courseId);
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
        // Fetch students
        const studentsData = await getStudentsForSection(courseId, sectionId);
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
                  const studentMark = marksData.find((m) => m.rollnumber === student.rollnumber);
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
  }, [courseId, sectionId]);

  const toggleCoCollapse = (coId) => {
    setCoCollapsed((prev) => ({ ...prev, [coId]: !prev[coId] }));
  };

  const handlePartitionsConfirmation = async () => {
    // Show confirmation dialog
    const result = await MySwal.fire({
      title: 'Confirm Partitions',
      text: 'Are you sure about the partition counts? This will create or update COs.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, confirm',
      cancelButtonText: 'No, edit',
    });

    if (result.isConfirmed) {
      // Refresh partitions to check if they exist
      try {
        const currentPartitions = await getCoursePartitions(courseId);
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
      setShowPartitionModal(true); // Reopen modal for editing
    }
  };

  const handleSavePartitions = async (partitionId) => {
    if (!courseId || courseId.startsWith('course-')) {
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
      console.log('Saving partitions for courseId:', courseId, 'Data:', newPartition, 'partitionId:', partitionId);
      // Double-check if partitions exist
      const currentPartitions = await getCoursePartitions(courseId);
      const exists = !!currentPartitions.partitionId;
      let response;
      if (exists) {
        // Update existing partitions
        response = await updateCoursePartitions(courseId, newPartition);
      } else {
        // Create new partitions
        response = await saveCoursePartitions(courseId, newPartition);
      }
      // Update partitions state with the latest data
      setPartitions({ ...newPartition, partitionId: response.data?.partitionId || currentPartitions.partitionId });
      setShowPartitionModal(false);
      // Refresh course outcomes
      const cos = await getCOsForCourse(courseId);
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
        // Handle case where partitions already exist
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
              const updateResponse = await updateCoursePartitions(courseId, newPartition);
              setPartitions({ ...newPartition, partitionId: updateResponse.data?.partitionId });
              setShowPartitionModal(false);
              const cos = await getCOsForCourse(courseId);
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
        // Only call deleteTool for saved tools (with toolId)
        await deleteTool(tool.toolId);
      }
      // Remove from tempTools
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

  const updateStudentMark = (toolId, rollnumber, marks) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.rollnumber === rollnumber ? { ...s, marks: { ...s.marks, [toolId]: marks } } : s
      )
    );
  };

  const handleSaveToolMarks = async () => {
    if (!selectedCO) {
      const errMsg = 'No CO selected';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
    if (!selectedCO.tools || selectedCO.tools.length === 0) {
      const errMsg = 'No tools defined for the selected CO';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
    if (!students || students.length === 0) {
      const errMsg = 'No students enrolled in this course section';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
    try {
      setError('');
      console.log('Saving marks for CO:', selectedCO.coId, 'Tools:', selectedCO.tools, 'Students:', students);
      for (const tool of selectedCO.tools) {
        const marks = students.map((s) => ({
          rollnumber: s.rollnumber,
          marksObtained: s.marks?.[tool.toolId] || 0,
        }));
        console.log(`Sending marks for tool ${tool.toolId}:`, marks);
        await saveStudentMarksForTool(tool.toolId, { marks });
      }
      return { success: true, message: 'Marks saved successfully' };
    } catch (err) {
      console.error('Error saving marks:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save marks';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const handleImportMarks = async (file) => {
    if (!selectedTool) return { success: false, error: 'No tool selected for import' };
    try {
      setError('');
      await importMarksForTool(selectedTool.toolId, file);
      // Re-fetch marks for the entire CO to refresh UI
      const updatedTools = await getToolsForCO(selectedCO.coId);
      const updatedStudents = await Promise.all(
        students.map(async (s) => {
          const newMarks = {};
          for (const tool of updatedTools) {
            const marksData = await getStudentMarksForTool(tool.toolId);
            const studentMark = marksData.find((m) => m.rollnumber === s.rollnumber);
            newMarks[tool.toolId] = studentMark ? studentMark.marksObtained : 0;
          }
          return { ...s, marks: newMarks };
        })
      );
      setStudents(updatedStudents);
      setCourseOutcomes((prev) =>
        prev.map((co) => (co.coId === selectedCO.coId ? { ...co, tools: updatedTools } : co))
      );
      setSelectedCO({ ...selectedCO, tools: updatedTools });
      return { success: true, message: 'Marks imported successfully' };
    } catch (err) {
      console.error('Error importing marks:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to import marks';
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
    exportCoWiseCsv,
    exportCourseWiseCsv,
    calculateCOMarks,
    error,
    setError,
  };
};

export default useMarkAllocation;
import { useState, useEffect } from 'react';
import { getCOsForCourse, getStudentsForCourse, getToolsForCO, getStudentMarksForTool, exportCourseWiseCsv } from '../services/staffService';
import { calculateInternalMarks as calcInternalMarks } from '../utils/calculations';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const useInternalMarks = (courseCode) => {
  const [students, setStudents] = useState([]);
  const [courseOutcomes, setCourseOutcomes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!courseCode || courseCode.startsWith('course-') || !courseCode.match(/^[A-Za-z0-9]+$/)) {
        console.error('Invalid courseCode:', courseCode);
        setError('Invalid course code provided');
        setLoading(false);
        return;
      }
      try {
        setError('');
        setLoading(true);
        console.log('useInternalMarks - Fetching data for courseCode:', courseCode);

        // 1. Fetch course outcomes
        const cos = await getCOsForCourse(courseCode);
        console.log('getCOsForCourse response in useInternalMarks:', cos);
        if (!Array.isArray(cos)) {
          console.error('Error: getCOsForCourse did not return an array:', cos);
          setError(
            cos?.debug
              ? `Course '${courseCode}' ${cos.debug.courseOnly.length > 0 ? 'exists' : 'not found'}. User assignment: ${cos.debug.staffCourseCheck.length > 0 ? 'found' : 'not found'}.`
              : 'No course outcomes found for this course'
          );
          setCourseOutcomes([]);
          setLoading(false);
          return;
        }

        // 2. Fetch tools for each CO
        const cosWithTools = await Promise.all(
          cos.map(async (co) => {
            try {
              const tools = await getToolsForCO(co.coId);
              console.log(`getToolsForCO response for coId ${co.coId}:`, tools);
              return { ...co, tools: tools || [] };
            } catch (err) {
              console.warn(`Error fetching tools for coId ${co.coId}:`, err);
              return { ...co, tools: [] };
            }
          })
        );
        setCourseOutcomes(cosWithTools);

        // 3. Fetch all students for the course
        const studentsData = await getStudentsForCourse(courseCode);
        console.log('getStudentsForCourse response:', studentsData);
        if (!Array.isArray(studentsData) || studentsData.length === 0) {
          console.warn('No students found for course:', courseCode);
          setError(
            studentsData?.debug
              ? `Course not found or not assigned to you. Debug: ${JSON.stringify(studentsData.debug)}`
              : 'No students enrolled in this course or course not found'
          );
          setStudents([]);
          setLoading(false);
          return;
        }

        // 4. BATCH FETCH ALL MARKS DATA - OPTIMIZED APPROACH
        // Create a map of all tool IDs to fetch marks for
        const allToolIds = new Set();
        cosWithTools.forEach(co => {
          co.tools.forEach(tool => allToolIds.add(tool.toolId));
        });
        const toolIdsArray = Array.from(allToolIds);
        console.log('All unique tool IDs to fetch:', toolIdsArray);

        // Fetch marks for ALL tools in parallel (1 call per tool, not per student)
        const allMarksData = await Promise.all(
          toolIdsArray.map(async (toolId) => {
            try {
              const marksData = await getStudentMarksForTool(toolId);
              console.log(`Marks for tool ${toolId}:`, marksData.length, 'records');
              return { toolId, marks: marksData };
            } catch (err) {
              console.warn(`Error fetching marks for tool ${toolId}:`, err);
              return { toolId, marks: [] };
            }
          })
        );

        // Create a lookup map: toolId -> [ { regno, marksObtained } ]
        const marksLookup = new Map();
        allMarksData.forEach(({ toolId, marks }) => {
          marksLookup.set(toolId, marks);
        });
        console.log('Marks lookup created for', marksLookup.size, 'tools');

        // 5. Process students with marks locally (NO API CALLS)
        const studentsWithMarks = studentsData.map((student) => {
          const marks = {};
          // For each tool, look up the student's marks from the batch data
          toolIdsArray.forEach(toolId => {
            const toolMarks = marksLookup.get(toolId) || [];
            const studentMark = toolMarks.find((m) => m.regno === student.regno);
            marks[toolId] = studentMark ? Number(studentMark.marksObtained) : 0;
          });
          console.log(`Processed marks for student ${student.regno}:`, marks);
          return { ...student, marks };
        });

        console.log('Final students with marks:', studentsWithMarks.length, 'students');
        setStudents(studentsWithMarks);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data in useInternalMarks:', err);
        setError(
          err.response?.data?.message +
            (err.response?.data?.debug
              ? `. Debug: Course '${courseCode}' ${err.response.data.debug.courseOnly.length > 0 ? 'exists' : 'not found'}. User assignment: ${err.response.data.debug.staffCourseCheck.length > 0 ? 'found' : 'not found'}.`
              : '') || 'Failed to fetch course data'
        );
        setLoading(false);
      }
    };
    fetchData();
  }, [courseCode]);

  const calculateInternalMarks = (rollnumber) => {
    return calcInternalMarks(rollnumber, courseOutcomes, students);
  };

  const handleExportCourseWiseCsv = async (courseCode) => {
    try {
      setError('');
      await exportCourseWiseCsv(courseCode);
      MySwal.fire('Success', 'Course-wise CSV exported successfully', 'success');
    } catch (err) {
      console.error('Error exporting course-wise CSV:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to export course-wise CSV';
      setError(errMsg);
      MySwal.fire('Error', errMsg, 'error');
    }
  };

  return {
    students,
    courseOutcomes,
    calculateInternalMarks,
    exportCourseWiseCsv: handleExportCourseWiseCsv,
    error,
    loading,
  };
};

export default useInternalMarks;

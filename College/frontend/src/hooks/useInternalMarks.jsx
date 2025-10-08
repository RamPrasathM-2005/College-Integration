import { useState, useEffect } from 'react';
import { getCOsForCourse, getStudentsForCourse, getToolsForCO, getStudentMarksForTool, exportCourseWiseCsv } from '../services/staffService';
import { calculateInternalMarks as calcInternalMarks } from '../utils/calculations';

const useInternalMarks = (courseCode) => {
  const [students, setStudents] = useState([]);
  const [courseOutcomes, setCourseOutcomes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!courseCode || courseCode.startsWith('course-') || !courseCode.match(/^[A-Za-z0-9]+$/)) {
        console.error('Invalid courseCode:', courseCode);
        setError('Invalid course code provided');
        return;
      }
      try {
        setError('');
        const cos = await getCOsForCourse(courseCode);
        console.log('getCOsForCourse response in useInternalMarks:', cos);
        if (!Array.isArray(cos)) {
          console.error('Error: getCOsForCourse did not return an array:', cos);
          setError('No course outcomes found for this course');
          setCourseOutcomes([]);
          return;
        }
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
        const studentsData = await getStudentsForCourse(courseCode);
        console.log('getStudentsForCourse response:', studentsData);
        if (!Array.isArray(studentsData) || studentsData.length === 0) {
          console.warn('No students found for course:', courseCode);
          setError(studentsData?.debug ? `Course not found or not assigned to you. Debug: ${JSON.stringify(studentsData.debug)}` : 'No students enrolled in this course or course not found');
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
                } catch (err) {
                  console.warn('Error fetching marks for tool:', tool.toolId, err);
                  marks[tool.toolId] = 0;
                }
              }
            }
            return { ...student, marks };
          })
        );
        console.log('Processed students with marks:', studentsWithMarks);
        setStudents(studentsWithMarks);
      } catch (err) {
        console.error('Error fetching data in useInternalMarks:', err);
        setError(err.response?.data?.message || 'Failed to fetch course data');
      }
    };
    fetchData();
  }, [courseCode]);

  const calculateInternalMarks = (rollnumber) => {
    return calcInternalMarks(rollnumber, courseOutcomes, students);
  };

  return {
    students,
    courseOutcomes,
    calculateInternalMarks,
    exportCourseWiseCsv,
    error,
  };
};

export default useInternalMarks;
import { useState, useEffect } from 'react';
import { getCOsForCourse, getStudentCOMarks, exportCourseWiseCsv } from '../services/staffService';
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

        setCourseOutcomes(cos);

        // Fetch consolidated marks which include students and their CO marks
        const comarksResponse = await getStudentCOMarks(courseCode);
        console.log('getStudentCOMarks response:', comarksResponse);

        if (!comarksResponse || !Array.isArray(comarksResponse.data.students) || comarksResponse.data.students.length === 0) {
          console.warn('No consolidated marks or students found for course:', courseCode);
          setError('No students or marks found for this course');
          setStudents([]);
          setLoading(false);
          return;
        }

        // Map the data to the expected format: students with marks { coId: consolidatedMark }
        const processedStudents = comarksResponse.data.students.map(student => {
          const marksByCoId = {};
          Object.entries(student.marks).forEach(([coNumber, markData]) => {
            marksByCoId[markData.coId] = Number(markData.consolidatedMark);
          });
          return {
            ...student,
            marks: marksByCoId,  // Now marks is { coId: number }
          };
        });

        console.log('Processed students with CO marks:', processedStudents.length, 'students');
        setStudents(processedStudents);
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
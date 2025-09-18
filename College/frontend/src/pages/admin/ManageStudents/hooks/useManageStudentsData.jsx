import { useState, useEffect } from 'react';
import { branchMap } from '../../ManageSemesters/branchMap.js';
import manageStudentsService from '../../../../services/manageStudentService.js';

const useManageStudentsData = (filters) => {
  const [students, setStudents] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [degrees] = useState(['BE', 'BTech', 'ME', 'MTech']);
  const [branches, setBranches] = useState(Object.keys(branchMap));
  const [semesters, setSemesters] = useState([
    'Semester 1',
    'Semester 2',
    'Semester 3',
    'Semester 4',
    'Semester 5',
    'Semester 6',
    'Semester 7',
    'Semester 8',
  ]);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      setError(null);
      try {
        const data = await manageStudentsService.fetchFilterOptions(filters.branch);
        setBranches(data.branches || Object.keys(branchMap));
        setSemesters(data.semesters || semesters);
        setBatches(data.batches || []);
      } catch (err) {
        setError(err.message || 'Network error: Unable to fetch filter options.');
      }
    };
    fetchFilterOptions();
  }, [filters.branch]);

  useEffect(() => {
    const fetchData = async () => {
      if (!filters.branch || !filters.semester || !filters.batch) {
        setStudents([]);
        setAvailableCourses([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { studentsData, coursesData } = await manageStudentsService.fetchStudentsAndCourses(
          filters,
          batches
        );
        setStudents(studentsData || []);
        setAvailableCourses(coursesData || []);
      } catch (err) {
        setError(err.message || 'Unable to load data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [filters.degree, filters.branch, filters.semester, filters.batch, batches]);

  return {
    students,
    setStudents,
    availableCourses,
    setAvailableCourses,
    degrees,
    branches,
    semesters,
    batches,
    isLoading,
    error,
    setError,
  };
};

export default useManageStudentsData;
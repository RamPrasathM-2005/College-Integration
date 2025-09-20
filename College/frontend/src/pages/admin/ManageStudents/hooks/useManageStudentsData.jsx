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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      setError(null);
      try {
        const [branchesRes, semestersRes, batchesRes] = await Promise.all([
          manageStudentsService.fetchFilterOptions(''),
          manageStudentsService.fetchFilterOptions(''),
          manageStudentsService.fetchFilterOptions(filters.branch || ''),
        ]);
        console.log('Filter Options:', { branches: branchesRes.branches, semesters: semestersRes.semesters, batches: batchesRes.batches });
        setBranches(branchesRes.branches || Object.keys(branchMap));
        setSemesters(semestersRes.semesters || semesters);
        setBatches(batchesRes.batches || []);
      } catch (err) {
        console.error('Error fetching filter options:', err);
        setError(err.message || 'Network error: Unable to fetch filter options.');
      }
    };
    fetchFilterOptions();
  }, [filters.branch]);

  useEffect(() => {
    const areRequiredFiltersSelected = filters.branch !== '' && filters.semester !== '' && filters.batch !== '';
    if (!areRequiredFiltersSelected) {
      console.log('Required filters (branch, semester, batch) not all selected, skipping data fetch:', filters);
      setStudents([]);
      setAvailableCourses([]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log('Fetching with filters:', filters);
        const { studentsData, coursesData } = await manageStudentsService.fetchStudentsAndCourses(
          filters,
          batches
        );
        console.log('Received studentsData:', studentsData);
        console.log('Received coursesData:', coursesData);
        setStudents(studentsData || []);
        setAvailableCourses(coursesData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Unable to load data.');
        setStudents([]);
        setAvailableCourses([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [filters.degree, filters.branch, filters.semester, filters.batch]);

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
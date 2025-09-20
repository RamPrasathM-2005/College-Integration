import { useMemo } from 'react';

const useManageStudentsFilters = (students, searchTerm) => {
  const filteredStudents = useMemo(() => {
    console.log('Filtering students:', { students, searchTerm }); // Debugging log
    if (!students || !Array.isArray(students)) {
      console.warn('Students is not an array:', students);
      return [];
    }
    // Normalize searchTerm: trim and check for empty
    const normalizedSearchTerm = searchTerm && typeof searchTerm === 'string' ? searchTerm.trim().toLowerCase() : '';
    if (!normalizedSearchTerm) {
      console.log('No search term, returning all students:', students);
      return students;
    }
    const result = students.filter((student) => {
      const nameMatch =
        student.name &&
        typeof student.name === 'string' &&
        student.name.toLowerCase().includes(normalizedSearchTerm);
      const rollnumberMatch =
        student.rollnumber &&
        typeof student.rollnumber === 'string' &&
        student.rollnumber.toLowerCase().includes(normalizedSearchTerm);
      return nameMatch || rollnumberMatch;
    });
    console.log('Filtered Students:', result, 'Search Term:', normalizedSearchTerm); // Debugging log
    return result;
  }, [students, searchTerm]);

  return { filteredStudents };
};

export default useManageStudentsFilters;
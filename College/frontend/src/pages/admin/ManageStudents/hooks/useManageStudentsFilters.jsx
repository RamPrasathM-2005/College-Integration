import { useMemo } from 'react';

const useManageStudentsFilters = (students, searchTerm) => {
  const filteredStudents = useMemo(() => {
    return students.filter((student) =>
      searchTerm
        ? student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.rollnumber.toLowerCase().includes(searchTerm.toLowerCase())
        : true
    );
  }, [students, searchTerm]);

  return { filteredStudents };
};

export default useManageStudentsFilters;
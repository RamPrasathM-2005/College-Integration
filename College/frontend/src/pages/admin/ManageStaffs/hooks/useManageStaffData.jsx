import { useState, useEffect } from 'react';
import manageStaffService from '../../../../services/manageStaffService';

const useManageStaffData = () => {
  const [staffList, setStaffList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedStaffCourse, setSelectedStaffCourse] = useState(null);
  const [selectedCourseStudents, setSelectedCourseStudents] = useState([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const departmentsData = await manageStaffService.getDepartments();
      setDepartments(departmentsData.filter(d => d.isActive === 'YES'));

      const [semestersData, batchesData, usersData, coursesData] = await Promise.all([
        manageStaffService.getSemesters(),
        manageStaffService.getBatches(),
        manageStaffService.getUsers(),
        manageStaffService.getCourses(),
      ]);

      setSemesters(semestersData);
      setBatches(batchesData);

      const staffData = Array.isArray(usersData)
        ? usersData.filter(user => user.staffId).map(user => {
            const department = departmentsData.find(d => d.departmentId === user.departmentId);
            const allocatedCourses = Array.isArray(user.allocatedCourses)
              ? user.allocatedCourses.map(course => ({
                  id: course.staffCourseId || 0,
                  courseCode: course.courseCode || 'N/A',
                  name: course.courseTitle || 'Unknown',
                  sectionId: course.sectionId || '',
                  batch: course.sectionName ? course.sectionName.replace(/^BatchBatch/, 'Batch') : 'N/A',
                  semester: semestersData.find(s => s.semesterId === course.semesterId)?.semesterNumber
                    ? String(semestersData.find(s => s.semesterId === course.semesterId).semesterNumber)
                    : 'N/A',
                  year: semestersData.find(s => s.semesterId === course.semesterId)?.batchYears || 'N/A',
                }))
              : [];
            return {
              id: user.id || 0,
              staffId: user.staffId || 'Unknown',
              name: user.name || 'Unknown',
              email: user.email || '',
              departmentId: user.departmentId || 0,
              departmentName: department ? department.departmentName : user.departmentName || 'Unknown',
              allocatedCourses,
            };
          })
        : [];
      setStaffList(staffData.filter((staff, index, self) => index === self.findIndex(s => s.staffId === staff.staffId)));

      const coursesWithDetails = await Promise.all(
        Array.isArray(coursesData) ? coursesData.map(async course => {
          const semester = semestersData.find(s => s.semesterId === course.semesterId) || {};
          const batch = batchesData.find(b => b.batchId === semester.batchId) || {};
          const sections = await manageStaffService.getCourseSections(course.courseCode);
          return {
            ...course,
            courseId: course.courseId || 0,
            name: course.courseTitle || '',
            code: course.courseCode || '',
            department: batch.branch || '',
            semester: semester.semesterNumber ? String(semester.semesterNumber) : '',
            batchYears: semester.batchYears || '',
            batch: batch.batch || '',
            sections: sections.map(section => ({
              sectionId: section.sectionId || 0,
              sectionName: section.sectionName ? (section.sectionName.startsWith('Batch') ? section.sectionName : `Batch${section.sectionName}`) : 'N/A',
            })),
          };
        }) : []
      );
      setCourses(coursesWithDetails);
    } catch (err) {
      setError(`Failed to fetch data: ${err.message}`);
      console.error('Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedStaff && staffList.length > 0) {
      const updatedStaff = staffList.find(s => s.staffId === selectedStaff.staffId);
      if (updatedStaff) {
        const oldCoursesMap = new Map(selectedStaff.allocatedCourses.map(c => [c.id, c]));
        const newCoursesMap = new Map(updatedStaff.allocatedCourses.map(c => [c.id, c]));
        let hasDifference = oldCoursesMap.size !== newCoursesMap.size;
        if (!hasDifference) {
          hasDifference = Array.from(newCoursesMap.values()).some(newC => {
            const oldC = oldCoursesMap.get(newC.id);
            return !oldC || oldC.sectionId !== newC.sectionId;
          });
        }
        if (hasDifference) {
          setSelectedStaff({ ...updatedStaff });
        }
      }
    }
  }, [staffList, selectedStaff]);

  return {
    staffList,
    courses,
    semesters,
    batches,
    departments,
    loading,
    error,
    selectedStaff,
    setSelectedStaff,
    selectedCourse,
    setSelectedCourse,
    selectedSectionId,
    setSelectedSectionId,
    selectedStaffCourse,
    setSelectedStaffCourse,
    selectedCourseStudents,
    setSelectedCourseStudents,
    selectedCourseCode,
    setSelectedCourseCode,
    fetchData,
  };
};

export default useManageStaffData;
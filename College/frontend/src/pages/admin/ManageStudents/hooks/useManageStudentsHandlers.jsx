// src/components/hooks/useManageStudentsHandlers.js
import { showErrorToast, showSuccessToast, showInfoToast } from '../../../../utils/swalConfig.js';
import manageStudentsService from '../../../../services/manageStudentService.js';

const useManageStudentsHandlers = (
  students,
  availableCourses,
  setStudents,
  pendingAssignments, // Added
  setPendingAssignments,
  setError
) => {
  const assignStaff = (student, courseCode, sectionId, staffId) => {
    try {
      const course = availableCourses.find((c) => c.courseCode === courseCode);
      const section = course?.batches.find((b) => b.sectionId === sectionId);
      if (!section) {
        setError(`No section found for course ${courseCode}`);
        showErrorToast('Error', `No section found for course ${courseCode}`);
        return false;
      }

      setPendingAssignments((prev) => ({
        ...prev,
        [`${student.rollnumber}-${courseCode}`]: {
          sectionId,
          sectionName: section.sectionName,
          staffId,
          staffName: section.staffName,
        },
      }));

      setStudents((prev) =>
        prev.map((s) =>
          s.rollnumber === student.rollnumber
            ? {
                ...s,
                enrolledCourses: s.enrolledCourses.some((c) => c.courseCode === courseCode)
                  ? s.enrolledCourses.map((c) =>
                      c.courseCode === courseCode
                        ? {
                            ...c,
                            sectionId,
                            sectionName: section.sectionName,
                            staffId,
                            staffName: section.staffName,
                          }
                        : c
                    )
                  : [
                      ...s.enrolledCourses,
                      {
                        courseId: course.courseId,
                        courseCode,
                        courseTitle: course.courseTitle,
                        sectionId,
                        sectionName: section.sectionName,
                        staffId,
                        staffName: section.staffName,
                      },
                    ],
              }
            : s
        )
      );
      return true;
    } catch (err) {
      setError('Failed to assign staff.');
      showErrorToast('Error', 'Failed to assign staff.');
      return false;
    }
  };

  const unenroll = async (student, courseCode) => {
    try {
      setPendingAssignments((prev) => {
        const newAssignments = { ...prev };
        delete newAssignments[`${student.rollnumber}-${courseCode}`];
        return newAssignments;
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.rollnumber === student.rollnumber
            ? { ...s, enrolledCourses: s.enrolledCourses.filter((c) => c.courseCode !== courseCode) }
            : s
        )
      );

      const success = await manageStudentsService.unenroll(student.rollnumber, courseCode);
      if (!success) {
        setError('Failed to unenroll.');
        showErrorToast('Error', 'Failed to unenroll.');
        return false;
      }
      return true;
    } catch (err) {
      setError('Failed to unenroll: ' + err.message);
      showErrorToast('Error', 'Failed to unenroll: ' + err.message);
      return false;
    }
  };

  const applyToAll = (course) => {
    const batch1 = course.batches.find((b) => b.sectionName === 'Batch 1') || course.batches[0];
    if (!batch1) {
      setError('No default section found for this course.');
      showErrorToast('Error', 'No default section found for this course.');
      return;
    }
    students.forEach((student) => {
      assignStaff(student, course.courseCode, batch1.sectionId, batch1.staffId);
    });
  };

  const saveAllAssignments = async () => {
    try {
      const assignments = Object.entries(pendingAssignments).map(([key, assignment]) => ({
        rollnumber: key.split('-')[0],
        courseCode: key.split('-')[1],
        sectionName: assignment.sectionName,
        staffId: assignment.staffId,
      }));

      if (assignments.length === 0) {
        showInfoToast('No Changes', 'No assignments to save.');
        return;
      }

      const success = await manageStudentsService.saveAssignments(assignments);
      if (success) {
        showSuccessToast('All student assignments have been saved successfully!');
        setPendingAssignments({});
      } else {
        setError('Failed to save some assignments.');
        showErrorToast('Error', 'Failed to save some assignments.');
      }
    } catch (err) {
      setError('Failed to save assignments: ' + err.message);
      showErrorToast('Error', 'Failed to save assignments: ' + err.message);
    }
  };

  return { assignStaff, unenroll, applyToAll, saveAllAssignments };
};

export default useManageStudentsHandlers;
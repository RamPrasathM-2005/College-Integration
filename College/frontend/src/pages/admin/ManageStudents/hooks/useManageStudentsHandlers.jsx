import { showErrorToast, showSuccessToast, showInfoToast } from '../../../../utils/swalConfig.js';
import manageStudentsService from '../../../../services/manageStudentService.js';

const useManageStudentsHandlers = (
  students,
  availableCourses,
  setStudents,
  pendingAssignments,
  setPendingAssignments,
  setError
) => {
  const assignStaff = (student, courseCode, sectionId, staffId) => {
    try {
      const course = availableCourses.find((c) => c.courseCode === courseCode);
      if (!course) {
        setError(`No course found for code ${courseCode}`);
        showErrorToast('Error', `No course found for code ${courseCode}`);
        return false;
      }
      const section = course.batches.find((b) => String(b.sectionId) === String(sectionId) && String(b.staffId) === String(staffId));
      if (!section) {
        setError(`No section found for course ${courseCode} with sectionId ${sectionId} and staffId ${staffId}`);
        showErrorToast('Error', `No section found for course ${courseCode}`);
        return false;
      }

      console.log('Assigning:', { student: student.rollnumber, courseCode, sectionId, staffId, sectionName: section.sectionName }); // Debugging log

      setPendingAssignments((prev) => ({
        ...prev,
        [`${student.rollnumber}-${courseCode}`]: {
          rollnumber: student.rollnumber,
          courseCode,
          sectionId: String(section.sectionId),
          sectionName: section.sectionName,
          staffId: String(staffId),
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
                            sectionId: String(section.sectionId),
                            sectionName: section.sectionName,
                            staffId: String(staffId),
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
                        sectionId: String(section.sectionId),
                        sectionName: section.sectionName,
                        staffId: String(staffId),
                        staffName: section.staffName,
                      },
                    ],
              }
            : s
        )
      );
      return true;
    } catch (err) {
      console.error('Error in assignStaff:', err);
      setError('Failed to assign staff: ' + err.message);
      showErrorToast('Error', 'Failed to assign staff.');
      return false;
    }
  };

  const unenroll = async (student, courseCode) => {
    try {
      console.log('Unenrolling:', { rollnumber: student.rollnumber, courseCode }); // Debugging log

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
        throw new Error('Failed to unenroll.');
      }
      return true;
    } catch (err) {
      console.error('Error in unenroll:', err);
      setError('Failed to unenroll: ' + err.message);
      showErrorToast('Error', 'Failed to unenroll: ' + err.message);
      return false;
    }
  };

  const applyToAll = (course) => {
    console.log('Applying to all for course:', course.courseCode, 'Batches:', course.batches); // Debugging log
    const batch1 = course.batches.find(
      (b) =>
        b.sectionName &&
        typeof b.sectionName === 'string' &&
        (b.sectionName.toLowerCase() === 'batch 1' ||
          b.sectionName.toLowerCase().includes('section1') ||
          b.sectionName === '1')
    ) || course.batches[0];

    if (!batch1 || !batch1.sectionId || !batch1.staffId) {
      setError('No valid batch or staff found for this course.');
      showErrorToast('Error', 'No valid batch or staff found for this course.');
      return;
    }

    students.forEach((student) => {
      assignStaff(student, course.courseCode, batch1.sectionId, batch1.staffId);
    });
  };

  const saveAllAssignments = async () => {
    try {
      const assignments = Object.values(pendingAssignments).map((assignment) => ({
        rollnumber: assignment.rollnumber,
        courseCode: assignment.courseCode,
        sectionName: assignment.sectionName,
        staffId: String(assignment.staffId),
      }));

      console.log('Saving assignments:', assignments); // Debugging log

      if (assignments.length === 0) {
        showInfoToast('No Changes', 'No assignments to save.');
        return;
      }

      const success = await manageStudentsService.saveAssignments(assignments);
      if (success) {
        showSuccessToast('Success', 'All student assignments have been saved successfully!');
        setPendingAssignments({});
      } else {
        throw new Error('Failed to save some assignments.');
      }
    } catch (err) {
      console.error('Error in saveAllAssignments:', err);
      setError('Failed to save assignments: ' + err.message);
      showErrorToast('Error', 'Failed to save assignments: ' + err.message);
    }
  };

  return { assignStaff, unenroll, applyToAll, saveAllAssignments };
};

export default useManageStudentsHandlers;
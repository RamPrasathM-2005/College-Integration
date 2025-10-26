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
  const assignStaff = (student, courseId, sectionId, staffId) => {
    try {
      const course = availableCourses.find((c) => String(c.courseId) === String(courseId));
      if (!course) {
        setError(`No course found for ID ${courseId}`);
        showErrorToast('Error', `No course found for ID ${courseId}`);
        return false;
      }
      const isElective = ['PEC', 'OEC'].includes(course.category);
      if (isElective && !student.selectedElectiveIds?.includes(String(courseId))) {
        setError(`Student ${student.rollnumber} did not select elective course ${course.courseCode}`);
        showErrorToast('Error', `Student ${student.rollnumber} did not select elective course ${course.courseCode}`);
        return false;
      }
      const section = course.batches.find((b) => String(b.sectionId) === String(sectionId) && String(b.staffId) === String(staffId));
      if (!section) {
        setError(`No section found for course ${course.courseCode} with sectionId ${sectionId} and staffId ${staffId}`);
        showErrorToast('Error', `No section found for course ${course.courseCode}`);
        return false;
      }

      console.log('Assigning:', {
        student: student.rollnumber,
        courseId,
        courseCode: course.courseCode,
        sectionId,
        staffId,
        sectionName: section.sectionName,
        isElective,
        selectedElectiveIds: student.selectedElectiveIds,
      });

      setPendingAssignments((prev) => ({
        ...prev,
        [`${student.rollnumber}-${courseId}`]: {
          rollnumber: student.rollnumber,
          courseId: String(courseId),
          courseCode: course.courseCode,
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
                enrolledCourses: s.enrolledCourses.some((c) => String(c.courseId) === String(courseId))
                  ? s.enrolledCourses.map((c) =>
                      String(c.courseId) === String(courseId)
                        ? {
                            ...c,
                            courseId: String(courseId),
                            courseCode: course.courseCode,
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
                        courseId: String(courseId),
                        courseCode: course.courseCode,
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

  const unenroll = async (student, courseId) => {
    try {
      console.log('Unenrolling:', { rollnumber: student.rollnumber, courseId });

      setPendingAssignments((prev) => {
        const newAssignments = { ...prev };
        delete newAssignments[`${student.rollnumber}-${courseId}`];
        return newAssignments;
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.rollnumber === student.rollnumber
            ? { ...s, enrolledCourses: s.enrolledCourses.filter((c) => String(c.courseId) !== String(courseId)) }
            : s
        )
      );

      const success = await manageStudentsService.unenroll(student.rollnumber, courseId);
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
    console.log('Applying to all for course:', course.courseId, 'Batches:', course.batches);
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
      const isElective = ['PEC', 'OEC'].includes(course.category);
      if (!isElective || (student.selectedElectiveIds || []).includes(String(course.courseId))) {
        assignStaff(student, course.courseId, batch1.sectionId, batch1.staffId);
      }
    });
  };

  const saveAllAssignments = async () => {
    try {
      const assignments = Object.values(pendingAssignments).map((assignment) => ({
        rollnumber: assignment.rollnumber,
        courseId: assignment.courseId,
        sectionName: assignment.sectionName,
        staffId: String(assignment.staffId),
      }));

      console.log('Saving assignments:', assignments);

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
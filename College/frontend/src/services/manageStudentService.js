import { showErrorToast } from '../utils/swalConfig';

const API_BASE = 'http://localhost:4000/api/admin';

const manageStudentsService = {
  fetchFilterOptions: async (branch) => {
    try {
      const [branchesRes, semestersRes, batchesRes] = await Promise.all([
        fetch(`${API_BASE}/students/branches`),
        fetch(`${API_BASE}/students/semesters`),
        fetch(`${API_BASE}/students/batches${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
      ]);

      if (!branchesRes.ok) throw new Error('Failed to load branches.');
      if (!semestersRes.ok) throw new Error('Failed to load semesters.');
      if (!batchesRes.ok) throw new Error('Failed to load batches.');

      const branchesData = await branchesRes.json();
      const semestersData = await semestersRes.json();
      const batchesData = await batchesRes.json();

      return {
        branches: branchesData.data,
        semesters: semestersData.data,
        batches: batchesData.data,
      };
    } catch (err) {
      throw new Error(err.message);
    }
  },

  fetchStudentsAndCourses: async (filters, batches) => {
    try {
      const studentsRes = await fetch(
        `${API_BASE}/students/search?degree=${filters.degree}&branch=${filters.branch}&batch=${filters.batch}&semesterNumber=${filters.semester.slice(9)}`
      );
      if (!studentsRes.ok) {
        const errorData = await studentsRes.json();
        throw new Error(errorData.message || 'Failed to fetch students');
      }
      const studentsData = await studentsRes.json();
      const cleanedStudents = studentsData.data.map((student) => ({
        ...student,
        enrolledCourses: student.enrolledCourses.map((course) => ({
          ...course,
          staffId: course.staffId.replace(/"/g, ''),
          staffName: course.staffName.replace(/"/g, ''),
          courseCode: course.courseCode.replace(/"/g, ''),
          sectionName: course.sectionName.replace(/"/g, ''),
        })),
      }));

      const batchId = batches.find((b) => b.batch === filters.batch)?.batchId;
      let coursesData = [];
      if (batchId) {
        const coursesRes = await fetch(
          `${API_BASE}/courses/available/${batchId}/${filters.semester.slice(9)}`
        );
        if (!coursesRes.ok) {
          const errorData = await coursesRes.json();
          throw new Error(errorData.message || 'Failed to fetch courses');
        }
        const rawCoursesData = await coursesRes.json();
        coursesData = rawCoursesData.data.map((course) => ({
          ...course,
          courseTitle: course.courseName,
          batches: course.batches.map((batch) => ({
            ...batch,
            sectionId: batch.batchId,
            sectionName: batch.batchId,
            staffName: batch.staff,
          })),
        }));
      }

      return { studentsData: cleanedStudents, coursesData };
    } catch (err) {
      throw new Error(err.message);
    }
  },

  unenroll: async (rollnumber, courseCode) => {
    try {
      const res = await fetch(`${API_BASE}/students/unenroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollnumber, courseCode }),
      });
      const result = await res.json();
      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to unenroll.');
      }
      return true;
    } catch (err) {
      throw new Error(err.message);
    }
  },

  saveAssignments: async (assignments) => {
    try {
      const responses = await Promise.all(
        assignments.map((assignment) =>
          fetch(`${API_BASE}/students/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assignment),
          }).then((res) =>
            res.json().then((data) => ({
              status: res.status,
              data,
              assignment,
            }))
          )
        )
      );

      const failed = responses.filter((res) => res.data.status !== 'success');
      if (failed.length > 0) {
        const errorMessages = failed
          .map(
            (res) =>
              `${res.data.message || 'Unknown error'} (Student: ${res.assignment.rollnumber}, Course: ${res.assignment.courseCode})`
          )
          .join('; ');
        throw new Error(`Failed to save ${failed.length} assignment(s): ${errorMessages}`);
      }
      return true;
    } catch (err) {
      throw new Error(err.message);
    }
  },
};

export default manageStudentsService;
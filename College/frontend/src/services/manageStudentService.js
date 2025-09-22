import { showErrorToast } from '../utils/swalConfig';
import { api } from '../services/authService';

const API_BASE = 'http://localhost:4000/api/admin';

const manageStudentsService = {
  fetchFilterOptions: async (branch) => {
    try {
      const [branchesRes, semestersRes, batchesRes] = await Promise.all([
        api.get(`${API_BASE}/students/branches`),
        api.get(`${API_BASE}/students/semesters`),
        api.get(`${API_BASE}/students/batches${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
      ]);

      if (branchesRes.status !== 200) throw new Error('Failed to load branches.');
      if (semestersRes.status !== 200) throw new Error('Failed to load semesters.');
      if (batchesRes.status !== 200) throw new Error('Failed to load batches.');

      console.log('Fetched filter options:', { branches: branchesRes.data.data, semesters: semestersRes.data.data, batches: batchesRes.data.data });

      return {
        branches: branchesRes.data.data || [],
        semesters: semestersRes.data.data || [],
        batches: batchesRes.data.data || [],
      };
    } catch (err) {
      console.error('Error in fetchFilterOptions:', err);
      throw new Error(err.message);
    }
  },

  fetchStudentsAndCourses: async (filters, batches) => {
    try {
      const { degree, branch, batch, semester } = filters;
      const semesterNumber = semester && typeof semester === 'string' && semester.startsWith('Semester ')
        ? semester.replace('Semester ', '')
        : '';

      console.log('fetchStudentsAndCourses - Filters:', { degree, branch, batch, semester, semesterNumber });

      const studentsRes = await api.get(`${API_BASE}/students/search`, {
        params: {
          degree,
          branch,
          batch,
          semesterNumber,
        },
      });

      if (studentsRes.status !== 200 || studentsRes.data.status !== 'success') {
        throw new Error(studentsRes.data.message || 'Failed to fetch students');
      }

      let studentsData = [];
      let coursesData = [];

      // Handle different response formats
      if (studentsRes.data.studentsData || studentsRes.data.coursesData) {
        studentsData = studentsRes.data.studentsData || [];
        coursesData = studentsRes.data.coursesData || [];
      } else if (Array.isArray(studentsRes.data.data)) {
        // Handle provided response format (only courses)
        coursesData = studentsRes.data.data.map((course) => ({
          courseId: course.courseId,
          courseCode: course.courseCode,
          courseTitle: course.courseName,
          batches: course.batches.map((batch) => ({
            sectionId: batch.sectionId,
            sectionName: batch.batchId,
            staffId: String(batch.Userid || ''),
            staffName: batch.staff || 'Not Assigned',
            enrolled: batch.enrolled || 0,
            capacity: batch.capacity || 'N/A',
          })),
        }));
      } else {
        throw new Error('Unexpected response format');
      }

      console.log('Raw studentsData:', studentsData);
      console.log('Raw coursesData:', coursesData);

      const cleanedStudents = Array.isArray(studentsData)
        ? studentsData.map((student) => ({
            ...student,
            enrolledCourses: Array.isArray(student.enrolledCourses)
              ? student.enrolledCourses.map((course) => ({
                  ...course,
                  staffId: course.staffId ? String(course.staffId).replace(/"/g, '') : '',
                  staffName: course.staffName && typeof course.staffName === 'string' ? course.staffName.replace(/"/g, '') : 'Not Assigned',
                  courseCode: course.courseCode && typeof course.courseCode === 'string' ? course.courseCode.replace(/"/g, '') : '',
                  sectionName: course.sectionName && typeof course.sectionName === 'string' ? course.sectionName.replace(/"/g, '') : '',
                }))
              : [],
          }))
        : [];

      coursesData = Array.isArray(coursesData)
        ? coursesData.map((course) => ({
            ...course,
            courseTitle: course.courseTitle || course.courseName || 'Unknown Course',
            batches: Array.isArray(course.batches)
              ? course.batches.map((batch, index) => ({
                  ...batch,
                  sectionId: batch.sectionId || batch.batchId || index + 1,
                  sectionName: batch.sectionName || `Batch ${index + 1}`,
                  staffId: batch.staffId ? String(batch.staffId) : '',
                  staffName: batch.staffName || batch.staff || 'Not Assigned',
                  enrolled: batch.enrolled || 0,
                  capacity: batch.capacity || 'N/A',
                }))
              : [],
          }))
        : [];

      const batchId = batches.find((b) => String(b.batch) === String(filters.batch))?.batchId;
      if (batchId && semesterNumber) {
        try {
          const coursesRes = await api.get(`${API_BASE}/courses/available/${batchId}/${semesterNumber}`);
          if (coursesRes.status === 200 && coursesRes.data.status === 'success') {
            const rawCoursesData = coursesRes.data.data || coursesRes.data;
            coursesData = Array.isArray(rawCoursesData)
              ? rawCoursesData.map((course) => ({
                  ...course,
                  courseTitle: course.courseName || course.courseTitle || 'Unknown Course',
                  batches: Array.isArray(course.batches)
                    ? course.batches.map((batch, index) => ({
                        ...batch,
                        sectionId: batch.batchId || batch.sectionId || index + 1,
                        sectionName: batch.sectionName || `Batch ${index + 1}`,
                        staffId: batch.Userid ? String(batch.Userid) : String(batch.staffId || ''),
                        staffName: batch.staff || batch.staffName || 'Not Assigned',
                        enrolled: batch.enrolled || 0,
                        capacity: batch.capacity || 'N/A',
                      }))
                    : [],
                }))
              : coursesData;
          }
        } catch (courseError) {
          console.warn('Error fetching additional courses:', courseError.message);
        }
      }

      console.log('Cleaned Students Data:', cleanedStudents);
      console.log('Courses Data:', coursesData);

      return { studentsData: cleanedStudents, coursesData };
    } catch (err) {
      console.error('Error in fetchStudentsAndCourses:', err);
      throw new Error(err.message);
    }
  },

  unenroll: async (rollnumber, courseCode) => {
    try {
      const res = await api.delete(`${API_BASE}/students/unenroll`, {
        data: { rollnumber, courseCode },
      });
      if (res.status !== 200 || res.data.status !== 'success') {
        throw new Error(res.data.message || 'Failed to unenroll.');
      }
      return true;
    } catch (err) {
      console.error('Error in unenroll:', err);
      throw new Error(err.message);
    }
  },

  saveAssignments: async (assignments) => {
    try {
      const responses = await Promise.all(
        assignments.map((assignment) =>
          api.post(`${API_BASE}/students/enroll`, {
            ...assignment,
            staffId: String(assignment.staffId),
          }).then((res) => ({
            status: res.status,
            data: res.data,
            assignment,
          }))
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
      console.error('Error in saveAssignments:', err);
      throw new Error(err.message);
    }
  },
};

export default manageStudentsService;
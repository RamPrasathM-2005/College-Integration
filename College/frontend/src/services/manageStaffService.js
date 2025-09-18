import axios from 'axios';

const API_BASE = 'http://localhost:4000/api';

const manageStaffService = {
  getDepartments: async () => {
    try {
      const res = await axios.get(`${API_BASE}/departments`);
      return res.data.data || [];
    } catch (err) {
      console.error('Error fetching departments:', err.response?.data || err.message);
      return [];
    }
  },

  getSemesters: async () => {
    const res = await axios.get(`${API_BASE}/admin/semesters`);
    return res.data.data || [];
  },

  getBatches: async () => {
    const res = await axios.get(`${API_BASE}/admin/batches`);
    return res.data.data || [];
  },

  getUsers: async () => {
    const res = await axios.get(`${API_BASE}/admin/users`);
    return res.data.data || [];
  },

  getCourses: async () => {
    const res = await axios.get(`${API_BASE}/admin/courses`);
    return res.data.data || [];
  },

  getCourseSections: async (courseCode) => {
    try {
      const res = await axios.get(`${API_BASE}/admin/courses/${courseCode}/sections`);
      return res.data.status === 'success' ? res.data.data : [];
    } catch (err) {
      console.error(`Error fetching sections for course ${courseCode}:`, err.message);
      return [];
    }
  },

  addSections: async (courseCode, numberOfSections) => {
    const res = await axios.post(`${API_BASE}/admin/courses/${courseCode}/sections`, { numberOfSections });
    return res;
  },

  allocateCourse: async (staffId, courseCode, sectionId, departmentId) => {
    const res = await axios.post(`${API_BASE}/admin/staff/${staffId}/courses`, {
      staffId,
      courseCode,
      sectionId,
      departmentId,
    });
    return res;
  },

  updateCourseAllocation: async (staffCourseId, payload) => {
    const res = await axios.patch(`${API_BASE}/admin/staff-courses/${staffCourseId}`, payload);
    return res;
  },

  removeCourseAllocation: async (staffCourseId) => {
    const res = await axios.delete(`${API_BASE}/admin/staff-courses/${staffCourseId}`);
    return res;
  },

  getEnrolledStudents: async (courseCode, sectionId) => {
    const res = await axios.get(`${API_BASE}/admin/students/enrolled-courses`, { params: { courseCode, sectionId } });
    return res.data.status === 'success' ? res.data.data : [];
  },
};

export default manageStaffService;
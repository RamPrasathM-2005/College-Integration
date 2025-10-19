import axios from 'axios';

const API_URL = 'http://localhost:4000/api/staff';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const getStudentCOMarks = async (courseCode) => {
  try {
    const response = await api.get(`/marks/co/${courseCode}`);
    console.log(`getStudentCOMarks response for courseCode ${courseCode}:`, response.data);
    return response.data || { students: [], partitions: {} };
  } catch (error) {
    console.error('Error in getStudentCOMarks:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch CO marks');
  }
};

export const updateStudentCOMark = async (courseCode, regno, coId, consolidatedMark) => {
  try {
    // Use the endpoint without courseCode
    const response = await api.put(`/marks/co/${regno}/${coId}`, { consolidatedMark });
    console.log(`updateStudentCOMark response for regno ${regno}, coId ${coId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('Error in updateStudentCOMark:', error);
    throw new Error(error.response?.data?.message || 'Failed to update CO mark');
  }
};

export const importMarksForTool = async (toolId, file) => {
  try {
    if (!file || !(file instanceof File)) {
      console.error('No valid file provided for upload:', file);
      throw new Error('No file selected');
    }
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('Sending import request for toolId:', toolId);
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });
    for (let [key, value] of formData.entries()) {
      console.log(`FormData entry: ${key}=`, value);
    }

    const response = await api.post(`/marks/${toolId}/import`, formData);
    console.log('Import response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in importMarksForTool:', error);
    console.error('Response data:', error.response?.data);
    console.error('Response status:', error.response?.status);
    throw new Error(error.response?.data?.message || 'Failed to import marks');
  }
};

export const getCoursePartitions = async (courseCode) => {
  const response = await api.get(`/partitions/${courseCode}`);
  return response.data.data;
};

export const saveCoursePartitions = async (courseCode, partitions) => {
  const response = await api.post(`/partitions/${courseCode}`, partitions);
  return response.data;
};

export const updateCoursePartitions = async (courseCode, partitions) => {
  const response = await api.put(`/partitions/${courseCode}`, partitions);
  return response.data;
};

export const getCOsForCourse = async (courseCode) => {
  const response = await api.get(`/cos/${courseCode}`);
  return response.data.data || [];
};

export const getToolsForCO = async (coId) => {
  const response = await api.get(`/tools/${coId}`);
  return response.data.data || [];
};

export const saveToolsForCO = async (coId, tools) => {
  const response = await api.post(`/tools/${coId}/save`, tools);
  return response.data;
};

export const createTool = async (coId, tool) => {
  try {
    console.log('createTool called with:', { coId, tool });
    const response = await api.post(`/tools/${coId}`, tool);
    return response.data;
  } catch (error) {
    console.error('Error in createTool:', error);
    throw error;
  }
};

export const updateTool = async (toolId, tool) => {
  const response = await api.put(`/tools/${toolId}`, tool);
  return response.data;
};

export const deleteTool = async (toolId) => {
  const response = await api.delete(`/tools/${toolId}`);
  return response.data;
};

export const getStudentMarksForTool = async (toolId) => {
  try {
    const response = await api.get(`/marks/${toolId}`);
    console.log(`getStudentMarksForTool response for toolId ${toolId}:`, response.data);
    if (response.data.debug) {
      console.log('Debug info:', response.data.debug);
    }
    return response.data.data || [];
  } catch (error) {
    console.error('Error in getStudentMarksForTool:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch marks');
  }
};

export const saveStudentMarksForTool = async (toolId, marks) => {
  try {
    console.log('saveStudentMarksForTool called with:', { toolId, marks });
    const response = await api.post(`/marks/${toolId}`, marks);
    return response.data;
  } catch (error) {
    console.error('Error in saveStudentMarksForTool:', error);
    throw error;
  }
};

export const exportCoWiseCsv = async (coId) => {
  try {
    const response = await api.get(`/export/co/${coId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `co_${coId}_marks.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error in exportCoWiseCsv:', err);
    throw new Error(err.response?.data?.message || 'Failed to export CO-wise CSV');
  }
};

export const exportCourseWiseCsv = async (courseCode) => {
  try {
    const response = await api.get(`/export/course/${courseCode}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${courseCode}_marks.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error in exportCourseWiseCsv:', err);
    throw new Error(err.response?.data?.message || 'Failed to export course-wise CSV');
  }
};

export const getStudentsForCourse = async (courseCode) => {
  const response = await api.get(`/students/${courseCode}`);
  return response.data.data || [];
};

export const getMyCourses = async () => {
  const response = await api.get(`/courses`);
  return response.data.data || [];
};

export const getStudentsForSection = async (courseCode, sectionId) => {
  try {
    const response = await api.get(`/students/${courseCode}/section/${sectionId}`);
    return response.data.data || [];
  } catch (error) {
    console.error('Error in getStudentsForSection:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch students for section');
  }
};
import React, { useState, useEffect } from 'react';
import { Plus, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import { api, getDepartments } from '../../services/authService.js';
import * as XLSX from 'xlsx';
import AddVerticalModal from './AddVerticalModal.jsx';

const API_BASE = 'http://localhost:4000/api/admin';

const ManageRegulations = () => {
  const [departments, setDepartments] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedRegulation, setSelectedRegulation] = useState('');
  const [selectedVertical, setSelectedVertical] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [file, setFile] = useState(null);
  const [showAddVerticalModal, setShowAddVerticalModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const depts = await getDepartments();
      setDepartments(depts || []);
    } catch (err) {
      const message = err.message || 'Failed to fetch departments';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegulations = async (deptId) => {
    setLoading(true);
    try {
      const res = await api.get(`${API_BASE}/regulations`);
      const filteredRegulations = res.data.data.filter(reg => reg.Deptid === parseInt(deptId));
      setRegulations(filteredRegulations);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch regulations';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerticals = async (regulationId) => {
    setLoading(true);
    try {
      const res = await api.get(`${API_BASE}/regulations/${regulationId}/verticals`);
      setVerticals(res.data.data || []);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch verticals';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCourses = async (regulationId) => {
    setLoading(true);
    try {
      const res = await api.get(`${API_BASE}/regulations/${regulationId}/courses/available`);
      setAvailableCourses(res.data.data || []);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch available courses';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeptChange = (e) => {
    const deptId = e.target.value;
    setSelectedDept(deptId);
    setSelectedRegulation('');
    setSelectedVertical('');
    setAvailableCourses([]);
    setSelectedCourses([]);
    setError(null);
    if (deptId) {
      fetchRegulations(deptId);
    } else {
      setRegulations([]);
    }
  };

  const handleRegulationChange = (e) => {
    const regulationId = e.target.value;
    setSelectedRegulation(regulationId);
    setSelectedVertical('');
    setAvailableCourses([]);
    setSelectedCourses([]);
    setError(null);
    if (regulationId) {
      fetchVerticals(regulationId);
      fetchAvailableCourses(regulationId);
    } else {
      setVerticals([]);
    }
  };

  const handleVerticalChange = (e) => {
    const value = e.target.value;
    setSelectedVertical(value);
    setSelectedCourses([]);
    setError(null);
    if (value === 'add') {
      setShowAddVerticalModal(true);
    } else {
      setShowAddVerticalModal(false);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleImport = async () => {
    if (!selectedRegulation) {
      toast.error('Please select a regulation');
      return;
    }
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid Excel file (.xls or .xlsx)');
      return;
    }

    toast.info('Processing Excel file...');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const expectedHeaders = [
            'S. No',
            'Course Code',
            'Course Title',
            'Category',
            'L',
            'T',
            'P',
            'E',
            'Total Contact Periods',
            'Credits',
            'Min Marks',
            'Max Marks',
            'Semester',
          ];
          const headers = jsonData[0].map(h => h.toString().trim());
          if (!headers.every((header, index) => header === expectedHeaders[index])) {
            toast.error('Invalid Excel format. Please use the correct column headers.');
            return;
          }

          const coursesData = jsonData.slice(1).filter(row => row && row.length >= 13).map(row => ({
            courseCode: row[1]?.toString().trim(),
            courseTitle: row[2]?.toString().trim(),
            category: row[3]?.toString().trim(),
            lectureHours: parseInt(row[4]) || 0,
            tutorialHours: parseInt(row[5]) || 0,
            practicalHours: parseInt(row[6]) || 0,
            experientialHours: parseInt(row[7]) || 0,
            totalContactPeriods: parseInt(row[8]),
            credits: parseInt(row[9]),
            minMark: parseInt(row[10]),
            maxMark: parseInt(row[11]),
            semesterNumber: parseInt(row[12]),
          }));

          const validTypes = ['THEORY', 'INTEGRATED', 'PRACTICAL', 'EXPERIENTIAL LEARNING'];
          const validCategories = ['HSMC', 'BSC', 'ESC', 'PEC', 'OEC', 'EEC', 'PCC'];

          for (const course of coursesData) {
            const type = determineCourseType(
              course.lectureHours,
              course.tutorialHours,
              course.practicalHours,
              course.experientialHours
            );
            if (
              !course.courseCode ||
              !course.courseTitle ||
              !course.category ||
              !validCategories.includes(course.category.toUpperCase()) ||
              !validTypes.includes(type) ||
              isNaN(course.minMark) ||
              isNaN(course.maxMark) ||
              isNaN(course.totalContactPeriods) ||
              isNaN(course.credits) ||
              isNaN(course.semesterNumber) ||
              course.minMark > course.maxMark ||
              course.minMark < 0 ||
              course.maxMark < 0 ||
              course.semesterNumber < 1 ||
              course.semesterNumber > 8
            ) {
              toast.error(`Invalid data in row for course ${course.courseCode || 'unknown'}`);
              return;
            }
          }

          const response = await api.post(`${API_BASE}/regulations/courses`, {
            courses: coursesData,
            regulationId: selectedRegulation,
          });
          toast.success(response.data.message);
          setFile(null);
          if (selectedVertical && selectedVertical !== 'add') {
            fetchAvailableCourses(selectedRegulation);
          }
        } catch (err) {
          toast.error(err.response?.data?.message || 'Error processing Excel file');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast.error('Error reading Excel file: ' + err.message);
    }
  };

  const determineCourseType = (lectureHours, tutorialHours, practicalHours, experientialHours) => {
    if (experientialHours > 0) return 'EXPERIENTIAL LEARNING';
    if (practicalHours > 0) {
      if (lectureHours > 0 || tutorialHours > 0) return 'INTEGRATED';
      return 'PRACTICAL';
    }
    return 'THEORY';
  };

  const handleCourseSelection = (courseId) => {
    setSelectedCourses(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleAllocateCourses = async () => {
    if (!selectedVertical || selectedVertical === 'add') {
      toast.error('Please select a valid vertical');
      return;
    }
    if (selectedCourses.length === 0) {
      toast.error('Please select at least one course');
      return;
    }

    try {
      const response = await api.post(`${API_BASE}/regulations/verticals/courses`, {
        verticalId: selectedVertical,
        courseIds: selectedCourses,
      });
      toast.success(response.data.message);
      setSelectedCourses([]);
      fetchAvailableCourses(selectedRegulation);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error allocating courses');
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (error) return <div className="p-6 text-red-500 text-center">{error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center">
      <div className="w-full max-w-7xl mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold text-gray-900">Manage Regulations</h1>
            <p className="text-gray-600 mt-1">Import courses and manage verticals for regulations</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="flex flex-wrap gap-4 items-end justify-center">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={selectedDept}
                onChange={handleDeptChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept.Deptid} value={dept.Deptid}>
                    {dept.Deptname} ({dept.deptCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Regulation</label>
              <select
                value={selectedRegulation}
                onChange={handleRegulationChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={!selectedDept}
              >
                <option value="">Select Regulation</option>
                {regulations.map(reg => (
                  <option key={reg.regulationId} value={reg.regulationId}>
                    {reg.Deptacronym} - {reg.regulationYear}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Excel File</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload size={24} className="text-gray-500 mb-2" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">XLS or XLSX</p>
                  </div>
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              {file && <p className="mt-2 text-sm text-green-600">Selected file: {file.name}</p>}
            </div>
            <button
              onClick={handleImport}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg font-semibold"
              disabled={!selectedRegulation || !file}
            >
              <Upload size={20} />
              Import Courses
            </button>
          </div>
        </div>
        {selectedRegulation && (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex flex-wrap gap-4 items-end justify-center">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Vertical</label>
                <select
                  value={selectedVertical}
                  onChange={handleVerticalChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Vertical</option>
                  {verticals.map(vertical => (
                    <option key={vertical.verticalId} value={vertical.verticalId}>
                      {vertical.verticalName}
                    </option>
                  ))}
                  <option value="add">Add New Vertical</option>
                </select>
              </div>
              <button
                onClick={handleAllocateCourses}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg font-semibold"
                disabled={!selectedVertical || selectedCourses.length === 0 || selectedVertical === 'add'}
              >
                <Plus size={20} />
                Allocate Courses
              </button>
            </div>
            {selectedVertical && selectedVertical !== 'add' && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Available PEC/OEC Courses
                </h3>
                {availableCourses.length === 0 ? (
                  <p className="text-gray-500 italic">No available PEC/OEC courses for this regulation.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    {availableCourses.map(course => (
                      <div
                        key={course.courseId}
                        className="flex items-center p-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(course.courseId)}
                          onChange={() => handleCourseSelection(course.courseId)}
                          className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-800">
                          {course.courseCode} - {course.courseTitle} (Semester {course.semesterNumber}, {course.category})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {(showAddVerticalModal || selectedVertical === 'add') && (
        <AddVerticalModal
          regulationId={selectedRegulation}
          setShowAddVerticalModal={setShowAddVerticalModal}
          onVerticalAdded={() => {
            fetchVerticals(selectedRegulation);
            setSelectedVertical('');
          }}
        />
      )}
    </div>
  );
};

export default ManageRegulations;
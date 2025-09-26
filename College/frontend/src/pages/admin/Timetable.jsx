import React, { useState, useEffect } from 'react';
import { Filter, Save, Edit, X, Clock, Coffee, UtensilsCrossed } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000';

const Timetable = () => {
  const [degrees, setDegrees] = useState([]);
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [timetableData, setTimetableData] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [allocationMode, setAllocationMode] = useState('');
  const [customCourseInput, setCustomCourseInput] = useState('');
  const [error, setError] = useState(null);

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const periods = [
    { id: 1, name: 'Period 1', time: '9:15-10:05', type: 'class' },
    { id: 2, name: 'Period 2', time: '10:05-10:55', type: 'class' },
    { id: 3, name: 'Short Break', time: '10:55-11:10', type: 'break' },
    { id: 4, name: 'Period 3', time: '11:10-12:00', type: 'class' },
    { id: 5, name: 'Period 4', time: '12:00-12:50', type: 'class' },
    { id: 6, name: 'Lunch Break', time: '12:50-1:50', type: 'lunch' },
    { id: 7, name: 'Period 5', time: '1:50-2:40', type: 'class' },
    { id: 8, name: 'Period 6', time: '2:40-3:30', type: 'class' },
    { id: 9, name: 'Short Break', time: '3:30-3:45', type: 'break' },
    { id: 10, name: 'Period 7', time: '3:45-4:30', type: 'class' },
    { id: 11, name: 'Period 8', time: '4:30-5:15', type: 'class' },
  ];

  const getBackendPeriod = (frontendId) => {
    const mapping = { 1: 1, 2: 2, 4: 3, 5: 4, 7: 5, 8: 6, 10: 7, 11: 8 };
    return mapping[frontendId] || null;
  };

  const getFrontendId = (backendPeriod) => {
    const mapping = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 7, 6: 8, 7: 10, 8: 11 };
    return mapping[backendPeriod] || null;
  };

  const getPeriodName = (backendPeriod) => {
    const periodNames = {
      1: 'Period 1', 2: 'Period 2', 3: 'Period 3', 4: 'Period 4',
      5: 'Period 5', 6: 'Period 6', 7: 'Period 7', 8: 'Period 8'
    };
    return periodNames[backendPeriod] || `Period ${backendPeriod || 'Unknown'}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      setError('No authentication token found. Please log in.');
    }
  }, []);

  useEffect(() => {
    const fetchDegrees = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/admin/timetable/batches`);
        console.log('Batches API response:', response.data);
        if (response.data?.status === 'success' && Array.isArray(response.data.data)) {
          const uniqueDegrees = [...new Set(response.data.data.map(batch => batch.degree))];
          setDegrees(uniqueDegrees);
          setBatches(response.data.data);
          setError(null);
        } else {
          throw new Error('Invalid response structure: data is not an array');
        }
      } catch (error) {
        console.error('Error fetching degrees:', error);
        setError(error.response?.data?.message || 'Failed to load degrees. Please check the server.');
        setDegrees([]);
        setBatches([]);
      }
    };
    fetchDegrees();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/admin/timetable/departments`);
        console.log('Departments API response:', response.data);
        if (response.data?.status === 'success' && Array.isArray(response.data.data)) {
          const mappedDepartments = response.data.data.map(dept => ({
            departmentId: dept.Deptid,
            departmentCode: dept.deptCode,
            departmentName: dept.Deptname,
          }));
          setDepartments(mappedDepartments);
          setError(null);
        } else {
          throw new Error('Invalid response structure: data is not an array');
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        setError(error.response?.data?.message || 'Failed to load departments. Please check the server.');
        setDepartments([]);
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDegree && selectedBatch && selectedDept) {
      const fetchSemesters = async () => {
        try {
          const selectedBatchData = batches.find(batch => batch.batchId === parseInt(selectedBatch));
          if (!selectedBatchData) {
            throw new Error('Selected batch not found');
          }
          const response = await axios.get(`${API_BASE_URL}/api/admin/semesters/by-batch-branch`, {
            params: { degree: selectedDegree, batch: selectedBatchData.batch, branch: selectedBatchData.branch },
          });
          console.log('Semesters API response:', response.data);
          if (response.data?.status === 'success' && Array.isArray(response.data.data)) {
            setSemesters(response.data.data);
            setError(null);
          } else {
            throw new Error('Invalid response structure: data is not an array');
          }
        } catch (error) {
          console.error('Error fetching semesters:', error);
          setError(error.response?.data?.message || 'Failed to load semesters. Please try again later.');
          setSemesters([]);
        }
      };
      fetchSemesters();
    } else {
      setSemesters([]);
    }
  }, [selectedDegree, selectedBatch, selectedDept, batches]);

  useEffect(() => {
    if (selectedSem) {
      const fetchCourses = async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/api/admin/semesters/${selectedSem}/courses`);
          console.log('Courses API response:', response.data);
          if (response.data?.status === 'success' && Array.isArray(response.data.data)) {
            setCourses(response.data.data); // Expects courseId, courseCode, courseTitle
            setError(null);
          } else {
            throw new Error('Invalid response structure: data is not an array');
          }
        } catch (error) {
          console.error('Error fetching courses:', error);
          setError(error.response?.data?.message || 'Failed to load courses. Please try again later.');
          setCourses([]);
        }
      };
      fetchCourses();
    } else {
      setCourses([]);
    }
  }, [selectedSem]);

  useEffect(() => {
    if (selectedSem) {
      const fetchTimetable = async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/api/admin/timetable/semester/${selectedSem}`);
          console.log('Timetable API response:', response.data);
          if (response.data?.status === 'success' && Array.isArray(response.data.data)) {
            response.data.data.forEach((entry, index) => {
              if (!entry.dayOfWeek || entry.periodNumber === undefined) {
                console.warn(`Invalid timetable entry at index ${index}:`, entry);
              }
            });
            setTimetableData(response.data.data);
            setError(null);
          } else {
            throw new Error('Invalid response structure: data is not an array');
          }
        } catch (error) {
          console.error('Error fetching timetable:', error);
          setError(error.response?.data?.message || 'Failed to load timetable. Please check the server logs.');
          setTimetableData([]);
        }
      };
      fetchTimetable();
    } else {
      setTimetableData([]);
    }
  }, [selectedSem]);

  const handleCellClick = (day, periodId, periodType) => {
    if (periodType !== 'class' || !editMode || !selectedSem) return;
    setSelectedCell({ day, periodId });
    setAllocationMode('');
    setCustomCourseInput('');
    setShowCourseModal(true);
  };

  const handleCourseAssign = async (courseValue) => {
    if (!selectedCell || !selectedSem || !courseValue) {
      setShowCourseModal(false);
      setSelectedCell(null);
      return;
    }

    try {
      const backendPeriodNumber = getBackendPeriod(selectedCell.periodId);
      if (!backendPeriodNumber) {
        throw new Error('Invalid period number');
      }
      const selectedCourse = allocationMode === 'select' ? courses.find(c => c.courseCode === courseValue) : null;
      await axios.post(`${API_BASE_URL}/api/admin/timetable/entry`, {
        courseId: allocationMode === 'select' ? selectedCourse.courseId : courseValue,
        courseTitle: allocationMode === 'manual' ? courseValue : undefined,
        dayOfWeek: selectedCell.day,
        periodNumber: backendPeriodNumber,
        Deptid: parseInt(selectedDept),
        semesterId: parseInt(selectedSem),
      });

      const response = await axios.get(`${API_BASE_URL}/api/admin/timetable/semester/${selectedSem}`);
      if (response.data?.status === 'success' && Array.isArray(response.data.data)) {
        setTimetableData(response.data.data);
      }
      setShowCourseModal(false);
      setSelectedCell(null);
      setAllocationMode('');
      setCustomCourseInput('');
      setError(null);
    } catch (error) {
      console.error('Error assigning course:', error);
      setError(error.response?.data?.message || 'Failed to assign course');
    }
  };

  const handleRemoveCourse = async (timetableId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/timetable/entry/${timetableId}`);
      const response = await axios.get(`${API_BASE_URL}/api/admin/timetable/semester/${selectedSem}`);
      if (response.data?.status === 'success' && Array.isArray(response.data.data)) {
        setTimetableData(response.data.data);
      }
      setError(null);
    } catch (error) {
      console.error('Error removing course:', error);
      setError(error.response?.data?.message || 'Failed to remove course');
    }
  };

  const renderPeriodHeader = (period) => {
    const icons = {
      break: <Coffee className="w-4 h-4" />,
      lunch: <UtensilsCrossed className="w-4 h-4" />,
      class: <Clock className="w-4 h-4" />,
    };

    return (
      <div className="p-2 text-center font-medium border-r bg-gray-50 text-gray-500 min-h-[96px] flex flex-col justify-center truncate">
        <div className="flex items-center justify-center gap-1 mb-1">
          {icons[period.type]}
          <span className="text-xs">{period.name}</span>
        </div>
        <div className="text-xs">{period.time}</div>
      </div>
    );
  };

  const renderTimetableCell = (day, period) => {
    if (period.type !== 'class') {
      return (
        <div className="p-2 h-24 bg-gray-100 text-center text-gray-500 border-r flex items-center justify-center">
          {period.type === 'break' ? '☕' : '🍽️'}
        </div>
      );
    }

    const cellData = timetableData.find((entry) => {
      if (!entry || !entry.dayOfWeek || entry.periodNumber === undefined) {
        console.warn('Invalid timetable entry:', entry);
        return false;
      }
      return entry.dayOfWeek === day && getFrontendId(entry.periodNumber) === period.id;
    });

    const isSelected = selectedCell?.day === day && selectedCell?.periodId === period.id;

    return (
      <div
        className={`relative p-2 h-24 border-r transition-all duration-200 ${
          editMode ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'
        } ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500 z-10' : ''} ${
          cellData ? 'bg-white' : 'bg-gray-50'
        }`}
        onClick={() => handleCellClick(day, period.id, period.type)}
      >
        {cellData ? (
          <div className="h-full flex flex-col justify-between text-left">
            <div>
              <div className="font-semibold text-xs text-gray-900 mb-1 truncate">
                {cellData.courseCode || 'N/A'}
              </div>
              <div className="text-xs text-gray-600 truncate" title={cellData.courseTitle || cellData.courseCode || 'N/A'}>
                {cellData.courseTitle || cellData.courseCode || 'N/A'}
                {cellData.sectionName ? ` (${cellData.sectionName})` : ''}
              </div>
            </div>
            {editMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveCourse(cellData.timetableId);
                }}
                className="absolute top-1 right-1 p-1 rounded-full bg-red-100 text-red-500 hover:bg-red-200 hover:text-red-700 opacity-50 hover:opacity-100 transition-opacity"
                title="Remove course"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          editMode && (
            <div className="h-full flex items-center justify-center text-gray-400 text-xs">
              Click to assign
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Timetable Management</h1>
          <div className="flex items-center gap-3">
            {selectedSem && (
              <button
                onClick={() => setEditMode(!editMode)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                {editMode ? (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    Edit Timetable
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="degree-select" className="block text-sm font-medium text-gray-700 mb-2">
              Degree
            </label>
            <select
              id="degree-select"
              value={selectedDegree}
              onChange={(e) => {
                setSelectedDegree(e.target.value);
                setSelectedBatch('');
                setSelectedDept('');
                setSelectedSem('');
                setEditMode(false);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Degree</option>
              {degrees.length > 0 ? (
                degrees.map(degree => (
                  <option key={degree} value={degree}>
                    {degree}
                  </option>
                ))
              ) : (
                <option value="" disabled>No degrees available</option>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="batch-select" className="block text-sm font-medium text-gray-700 mb-2">
              Batch
            </label>
            <select
              id="batch-select"
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setSelectedDept('');
                setSelectedSem('');
                setEditMode(false);
                setError(null);
              }}
              disabled={!selectedDegree}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select Batch</option>
              {batches
                .filter(batch => batch.degree === selectedDegree)
                .map(batch => (
                  <option key={batch.batchId} value={batch.batchId}>
                    {batch.branch} ({batch.batchYears})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="dept-select" className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <select
              id="dept-select"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setSelectedSem('');
                setEditMode(false);
                setError(null);
              }}
              disabled={!selectedBatch}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select Department</option>
              {departments
                .filter(dept =>
                  batches.some(batch =>
                    batch.degree === selectedDegree &&
                    batch.batchId === parseInt(selectedBatch) &&
                    batch.branch.toUpperCase() === dept.departmentCode.toUpperCase()
                  )
                )
                .map(dept => (
                  <option key={dept.departmentId} value={dept.departmentId}>
                    {dept.departmentName} ({dept.departmentCode})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="sem-select" className="block text-sm font-medium text-gray-700 mb-2">
              Semester
            </label>
            <select
              id="sem-select"
              value={selectedSem}
              onChange={(e) => {
                setSelectedSem(e.target.value);
                setEditMode(false);
                setError(null);
              }}
              disabled={!selectedDept}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select Semester</option>
              {semesters.length > 0 ? (
                semesters.map(sem => (
                  <option key={sem.semesterId} value={sem.semesterId}>
                    Semester {sem.semesterNumber} - {sem.batchYears}
                  </option>
                ))
              ) : (
                <option value="" disabled>No semesters available</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {selectedSem ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {departments.find(d => d.departmentId === parseInt(selectedDept))?.departmentName || 'Department'} -{' '}
              Semester {semesters.find(s => s.semesterId === parseInt(selectedSem))?.semesterNumber || 'N/A'}
            </h2>
            <p className="text-sm text-gray-500">
              Degree: {selectedDegree || 'N/A'} | Batch: {batches.find(b => b.batchId === parseInt(selectedBatch))?.batchYears || 'N/A'} | Department Code: {departments.find(d => d.departmentId === parseInt(selectedDept))?.departmentCode || 'N/A'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-[140px_repeat(11,minmax(120px,120px))] min-w-[1400px]">
              <div className="sticky top-0 left-0 bg-gray-100 z-30 p-2 font-semibold text-gray-700 border-r border-b text-left whitespace-nowrap">
                Day/Period
              </div>
              {periods.map(period => (
                <div key={period.id} className="sticky top-0 bg-gray-50 z-10 border-b border-r">
                  {renderPeriodHeader(period)}
                </div>
              ))}

              {days.map(day => (
                <React.Fragment key={day}>
                  <div className="sticky left-0 bg-gray-100 z-20 p-2 font-semibold text-gray-700 border-r border-b whitespace-nowrap">
                    {day}
                  </div>
                  {periods.map(period => (
                    <div key={`${day}-${period.id}`} className="border-b border-r">
                      {renderTimetableCell(day, period)}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select Degree, Batch, Department & Semester</h3>
          <p className="text-gray-500">Choose a degree, batch, department, and semester to view or create a timetable.</p>
        </div>
      )}

      {showCourseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-sm p-6 w-full max-w-md m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Course or Activity</h3>
              <button
                onClick={() => {
                  setShowCourseModal(false);
                  setAllocationMode('');
                  setCustomCourseInput('');
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2 font-medium">
                Assigning for: <span className="font-semibold text-blue-600">{selectedCell?.day}, {periods.find(p => p.id === selectedCell?.periodId)?.name}</span>
              </p>
              <select
                id="allocation-mode"
                value={allocationMode}
                onChange={(e) => {
                  setAllocationMode(e.target.value);
                  setCustomCourseInput('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
              >
                <option value="" disabled>Select allocation method...</option>
                <option value="select">Select Course</option>
                <option value="manual">Manual Entry</option>
              </select>

              {allocationMode === 'select' && (
                <select
                  id="course-select"
                  value={customCourseInput}
                  onChange={(e) => setCustomCourseInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                >
                  <option value="" disabled>Select a course...</option>
                  {courses.length > 0 ? (
                    courses.map(course => (
                      <option key={course.courseId} value={course.courseCode}>
                        {course.courseCode} - {course.courseTitle}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No courses available</option>
                  )}
                </select>
              )}

              {allocationMode === 'manual' && (
                <input
                  type="text"
                  placeholder="Enter activity (e.g., Guest Lecture)"
                  value={customCourseInput}
                  onChange={(e) => setCustomCourseInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                />
              )}

              <button
                onClick={() => handleCourseAssign(customCourseInput)}
                disabled={!customCourseInput || !allocationMode}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Assign
              </button>
              {(!customCourseInput || !allocationMode) && (
                <p className="text-sm text-red-600 mt-2">
                  {allocationMode ? 'Please enter or select a course/activity.' : 'Please select an allocation method.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedSem && (
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Courses for this Semester</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.length > 0 ? (
              courses.map(course => {
                const scheduleCount = timetableData.filter(entry => entry.courseId === course.courseId).length;
                return (
                  <div key={course.courseId} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white">
                    <div className="font-semibold text-gray-900">{course.courseCode}</div>
                    <div className="text-sm text-gray-600 mb-1">{course.courseTitle}</div>
                    <div className={`flex items-center gap-2 text-xs font-medium p-2 rounded-md ${scheduleCount > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{scheduleCount > 0 ? `${scheduleCount} periods scheduled` : 'Not scheduled'}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 col-span-full">No courses available for this semester.</p>
            )}
          </div>
          <h3 className="text-lg font-semibold mt-6 mb-4 text-gray-900">Scheduled Activities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timetableData
              .filter(entry => !courses.some(course => course.courseId === entry.courseId))
              .map(entry => (
                <div key={entry.timetableId} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white">
                  <div className="font-semibold text-gray-900">{entry.courseCode}</div>
                  <div className="text-sm text-gray-600 mb-1">{entry.courseTitle || entry.courseCode}</div>
                  <div className="text-xs text-gray-600">
                    {entry.dayOfWeek}, {getPeriodName(entry.periodNumber)}
                    {entry.sectionName ? ` (${entry.sectionName})` : ''}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetable;
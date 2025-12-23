import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole } from '../../utils/auth';
import {
  fetchStudentDetails,
  fetchSemesters,
  fetchEnrolledCourses,
  fetchAttendanceSummary,
  fetchOecPecProgress, // ← Added for progress
} from '../../services/studentService';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [courses, setCourses] = useState([]);
  const [studentDetails, setStudentDetails] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [progress, setProgress] = useState(null); // ← New state for OEC/PEC progress
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load student details, semesters, and OEC/PEC progress
  useEffect(() => {
    const loadDashboard = async () => {
      if (!getUserRole() || getUserRole() !== 'student') {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 1. Get student details
        const student = await fetchStudentDetails();
        setStudentDetails(student);

        // 2. Get all semesters
        const semList = await fetchSemesters(student.batchYear?.toString());
        if (!semList || semList.length === 0) {
          setError('No semesters found');
          setLoading(false);
          return;
        }

        setSemesters(semList);

        // 3. Set current/active semester
        const activeSems = semList.filter(s => s.isActive === 'YES');
        const currentSem = activeSems.length > 0
          ? activeSems.sort((a, b) => b.semesterNumber - a.semesterNumber)[0]
          : semList[semList.length - 1];

        const correctId = currentSem.semesterId.toString();
        setSelectedSemester(correctId);

        // 4. Fetch OEC/PEC progress (regulation-based)
        try {
          const prog = await fetchOecPecProgress();
          setProgress(prog);
        } catch (err) {
          console.warn('Could not fetch OEC/PEC progress:', err);
          setProgress(null);
        }

      } catch (err) {
        console.error('Dashboard failed:', err);
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate]);

  // Load enrolled courses & attendance when semester changes
  useEffect(() => {
    if (!selectedSemester || semesters.length === 0) return;

    const loadSemesterData = async () => {
      try {
        setLoading(true);

        const [coursesRes, attendanceRes] = await Promise.all([
          fetchEnrolledCourses(selectedSemester),
          fetchAttendanceSummary(selectedSemester).catch(() => ({}))
        ]);

        setCourses(coursesRes || []);
        setAttendanceSummary(attendanceRes || {});
      } catch (err) {
        console.error('Failed to load courses/attendance:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSemesterData();
  }, [selectedSemester]);

  const handleSemesterChange = (e) => {
    setSelectedSemester(e.target.value);
  };

  const handleChooseCourses = () => {
    navigate('/student/choose-course');
  };

  // Loading & Error States
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-3xl font-bold text-indigo-600 animate-pulse">
          Loading Dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-20">
        <p className="text-red-600 text-2xl mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl bg-gray-50 min-h-screen">
      {/* Welcome Header */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-indigo-700 mb-3">
          Welcome, {studentDetails?.regno}!
        </h1>
        <p className="text-xl text-gray-600">
          {studentDetails?.username} • {studentDetails?.branch} • Batch {studentDetails?.batchYear}
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-3xl shadow-2xl p-10 mb-10 border border-gray-200">
        <h2 className="text-4xl font-bold text-gray-800 mb-8">Student Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-lg">
          <div><strong>Name:</strong> {studentDetails?.username}</div>
          <div><strong>Reg No:</strong> {studentDetails?.regno}</div>
          <div><strong>Department:</strong> {studentDetails?.Deptname}</div>
          <div><strong>Section:</strong> {studentDetails?.section || '—'}</div>
          <div><strong>Email:</strong> {studentDetails?.email}</div>
          <div><strong>Phone:</strong> {studentDetails?.personal_phone || '—'}</div>
          <div><strong>Blood Group:</strong> {studentDetails?.blood_group}</div>
          <div><strong>Gender:</strong> {studentDetails?.gender}</div>
        </div>
      </div>

      {/* Semester Selector + Choose Courses */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-8">
        <div className="flex items-center gap-6">
          <label className="text-2xl font-bold text-gray-800">Semester:</label>
          <select
            value={selectedSemester}
            onChange={handleSemesterChange}
            className="text-xl px-8 py-4 border-4 border-indigo-300 rounded-2xl bg-white shadow-xl focus:outline-none focus:border-indigo-600 min-w-96 font-medium"
          >
            {semesters.map(sem => (
              <option key={sem.semesterId} value={sem.semesterId.toString()}>
                Semester {sem.semesterNumber} ({sem.startDate} → {sem.endDate})
                {sem.isActive === 'YES' ? ' [CURRENT]' : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleChooseCourses}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:from-purple-700 hover:to-indigo-700 transform hover:scale-105 transition-all shadow-2xl"
        >
          Choose Courses
        </button>
      </div>

      {/* Enrolled Courses */}
      <div className="bg-white rounded-3xl shadow-2xl p-10 mb-10 border border-gray-200">
        <h2 className="text-4xl font-bold text-gray-800 mb-8">Enrolled Courses</h2>
        {courses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <tr>
                  <th className="px-8 py-5 text-left text-lg font-bold">Code</th>
                  <th className="px-8 py-5 text-left text-lg font-bold">Course Name</th>
                  <th className="px-8 py-5 text-center text-lg font-bold">Section</th>
                  <th className="px-8 py-5 text-left text-lg font-bold">Instructor</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => (
                  <tr key={c.courseId} className={`${i % 2 === 0 ? 'bg-indigo-50' : 'bg-white'} hover:bg-purple-50 transition`}>
                    <td className="px-8 py-6 font-mono font-bold text-indigo-700">{c.courseCode}</td>
                    <td className="px-8 py-6 font-semibold">{c.courseName}</td>
                    <td className="px-8 py-6 text-center font-medium">{c.section}</td>
                    <td className="px-8 py-6 italic text-gray-700">{c.staff || 'Not Assigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 text-2xl py-16 italic">
            No courses enrolled for this semester.
          </p>
        )}
      </div>

      {/* Attendance Summary */}
      <div className="bg-white rounded-3xl shadow-2xl p-10 mb-10 border border-gray-200">
        <h2 className="text-4xl font-bold text-gray-800 mb-10">Attendance Summary</h2>
        {attendanceSummary.totalDays ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="text-center p-10 bg-blue-50 rounded-3xl border-4 border-blue-300">
              <p className="text-6xl font-bold text-blue-700">{attendanceSummary.totalDays}</p>
              <p className="text-2xl text-gray-700 mt-4">Total Days</p>
            </div>
            <div className="text-center p-10 bg-green-50 rounded-3xl border-4 border-green-300">
              <p className="text-6xl font-bold text-green-700">{attendanceSummary.daysPresent}</p>
              <p className="text-2xl text-gray-700 mt-4">Days Present</p>
            </div>
            <div className={`text-center p-10 rounded-3xl border-4 ${attendanceSummary.percentage >= 75 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <p className={`text-6xl font-bold ${attendanceSummary.percentage >= 75 ? 'text-green-700' : 'text-red-700'}`}>
                {attendanceSummary.percentage}%
              </p>
              <p className="text-2xl text-gray-700 mt-4">Attendance</p>
              {attendanceSummary.percentage < 75 && (
                <p className="text-red-600 font-black mt-6 text-3xl animate-pulse">
                  WARNING: Below 75%
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 text-2xl py-16 italic">
            No attendance data yet.
          </p>
        )}
      </div>

      {/* OEC/PEC Progress Card */}
      <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-200">
        <h2 className="text-4xl font-bold text-gray-800 mb-10">OEC/PEC Progress (Regulation Requirement)</h2>
        {progress ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="p-10 bg-indigo-50 rounded-3xl border-4 border-indigo-300 text-center">
              <p className="text-5xl font-bold text-indigo-700">
                {progress.completed.OEC} / {progress.required.OEC}
              </p>
              <p className="text-2xl mt-4">OEC Completed</p>
              <p className="text-lg mt-2 text-gray-600">
                Remaining: <strong>{progress.remaining.OEC}</strong>
              </p>
              <p className="text-sm mt-4">
                From NPTEL: {progress.fromNptel.OEC} | From College: {progress.fromCollege.OEC}
              </p>
              {progress.remaining.OEC === 0 && (
                <p className="text-green-600 font-bold mt-4">✓ Fully Completed!</p>
              )}
              {progress.remaining.OEC > 0 && (
                <p className="text-red-600 mt-4">Need {progress.remaining.OEC} more OEC</p>
              )}
            </div>

            <div className="p-10 bg-purple-50 rounded-3xl border-4 border-purple-300 text-center">
              <p className="text-5xl font-bold text-purple-700">
                {progress.completed.PEC} / {progress.required.PEC}
              </p>
              <p className="text-2xl mt-4">PEC Completed</p>
              <p className="text-lg mt-2 text-gray-600">
                Remaining: <strong>{progress.remaining.PEC}</strong>
              </p>
              <p className="text-sm mt-4">
                From NPTEL: {progress.fromNptel.PEC} | From College: {progress.fromCollege.PEC}
              </p>
              {progress.remaining.PEC === 0 && (
                <p className="text-green-600 font-bold mt-4">✓ Fully Completed!</p>
              )}
              {progress.remaining.PEC > 0 && (
                <p className="text-red-600 mt-4">Need {progress.remaining.PEC} more PEC</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 text-2xl py-16 italic">
            No regulation assigned or OEC/PEC data not available.
          </p>
        )}
      </div>

      <footer className="text-center mt-16 text-gray-500 text-lg">
        © 2025 NEC Student Portal • All rights reserved
      </footer>
    </div>
  );
};

export default StudentDashboard;
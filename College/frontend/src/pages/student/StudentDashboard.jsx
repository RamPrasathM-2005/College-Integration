// src/pages/student/StudentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getUserRole } from '../../utils/auth';
import {
  fetchStudentDetails,
  fetchSemesters,
  fetchEnrolledCourses,
  fetchAttendanceSummary,
  fetchOecPecProgress,
} from '../../services/studentService';
import { api } from '../../services/authService';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [gpaSelectedSem, setGpaSelectedSem] = useState('');
  const [courses, setCourses] = useState([]);
  const [studentDetails, setStudentDetails] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [progress, setProgress] = useState(null); // OEC/PEC progress
  const [gpaHistory, setGpaHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [academicIds, setAcademicIds] = useState({
    regno: '',
    batchId: '',
    deptId: '',
    semesterId: ''
  });
  const [idsLoading, setIdsLoading] = useState(true);

  const fetchGpaHistory = async () => {
    try {
      const res = await api.get('/student/gpa-history');
      if (res.data.status === 'success') {
        const history = res.data.data || [];
        const sorted = history.sort((a, b) => a.semesterNumber - b.semesterNumber);

        const chartData = sorted.map(item => ({
          semester: `Sem ${item.semesterNumber}`,
          semesterNumber: item.semesterNumber,
          gpa: item.gpa ? parseFloat(item.gpa).toFixed(2) : null,
          cgpa: item.cgpa ? parseFloat(item.cgpa).toFixed(2) : null,
          gpaValue: item.gpa ? parseFloat(item.gpa) : 0,
          cgpaValue: item.cgpa ? parseFloat(item.cgpa) : 0,
        }));

        setGpaHistory(chartData);
        if (chartData.length > 0) {
          setGpaSelectedSem(chartData[chartData.length - 1].semesterNumber.toString());
        }
      }
    } catch (err) {
      console.warn('GPA history load failed');
      setGpaHistory([]);
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!getUserRole() || getUserRole() !== 'student') {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const student = await fetchStudentDetails();
        setStudentDetails(student);

        const semList = await fetchSemesters(student.batchYear?.toString());
        if (!semList || semList.length === 0) {
          setError('No semesters found');
          setLoading(false);
          return;
        }

        setSemesters(semList);

        const activeSems = semList.filter(s => s.isActive === 'YES');
        const currentSem = activeSems.length > 0
          ? activeSems.sort((a, b) => b.semesterNumber - a.semesterNumber)[0]
          : semList[semList.length - 1];

        setSelectedSemester(currentSem.semesterId.toString());

        await fetchGpaHistory();

        // Fetch OEC/PEC progress
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

  useEffect(() => {
    const loadAcademicIds = async () => {
      if (!studentDetails?.regno) return;

      try {
        setIdsLoading(true);
        const ids = await fetchStudentAcademicIds();
        if (ids) {
          setAcademicIds({
            regno: ids.regno || studentDetails.regno || '',
            batchId: ids.batchId || '',
            deptId: ids.deptId || '',
            semesterId: ids.semesterId || selectedSemester
          });
          console.log(ids);
        }
      } catch (err) {
        console.error('Failed to fetch academic IDs:', err);
      } finally {
        setIdsLoading(false);
      }
    };
    loadAcademicIds();
  }, [studentDetails?.regno, selectedSemester]);

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

  const handleGpaSemesterChange = (e) => {
    setGpaSelectedSem(e.target.value);
  };

  const handleChooseCourses = () => {
    navigate('/student/choose-course');
  };

   const handleViewCBCS = () => {
    if (!academicIds.batchId || !academicIds.deptId || !academicIds.semesterId) {
      alert('Academic details are still loading. Please wait.');
      return;
    }
    navigate(`/student/stu/${academicIds.regno}/${academicIds.batchId}/${academicIds.deptId}/${academicIds.semesterId}`);
  };


  const selectedGpaData = gpaHistory.find(h => h.semesterNumber.toString() === gpaSelectedSem) || gpaHistory[gpaHistory.length - 1] || null;
  const filteredHistory = gpaHistory.filter(h => h.semesterNumber <= parseInt(gpaSelectedSem || 0));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-slate-700">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Oops! Something went wrong</h3>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const attendancePercentage = attendanceSummary?.percentage || 0;
  const totalDays = attendanceSummary?.totalDays || 0;
  const daysPresent = attendanceSummary?.daysPresent || 0;
  const isLowAttendance = attendancePercentage > 0 && attendancePercentage < 75;

  const attendanceTrendData = [
    { month: 'Sep', percentage: 85 },
    { month: 'Oct', percentage: 78 },
    { month: 'Nov', percentage: 82 },
    { month: 'Dec', percentage: attendancePercentage },
  ];

  const currentGpa = selectedGpaData?.gpa || null;
  const showCgpa = gpaSelectedSem && parseInt(gpaSelectedSem) > 1;
  const currentCgpa = showCgpa ? selectedGpaData?.cgpa : null;

  const averageGpa = filteredHistory.length > 0
    ? (filteredHistory.reduce((sum, s) => sum + s.gpaValue, 0) / filteredHistory.length).toFixed(2)
    : null;

  const highestGpa = filteredHistory.length > 0
    ? Math.max(...filteredHistory.map(s => s.gpaValue)).toFixed(2)
    : null;

  const getGpaColor = (gpa) => {
    const value = parseFloat(gpa);
    if (value >= 9.0) return '#10b981';
    if (value >= 8.0) return '#3b82f6';
    if (value >= 7.0) return '#f59e0b';
    return '#ef4444';
  };

  const getAcademicRecommendation = (value) => {
    const cgpa = parseFloat(value || 0);
    if (cgpa >= 9.0) {
      return {
        title: "Outstanding Excellence",
        message: "Your CGPA reflects top-tier performance! Maintain this trajectory to secure prestigious honors and opportunities.",
        icon: "🏆",
        color: "from-emerald-50 to-green-50",
        textColor: "text-emerald-700"
      };
    } else if (cgpa >= 8.0) {
      return {
        title: "Excellent Achievement",
        message: "Strong academic standing! Consider advanced courses or research to elevate further and explore scholarships.",
        icon: "⭐",
        color: "from-blue-50 to-indigo-50",
        textColor: "text-blue-700"
      };
    } else if (cgpa >= 7.0) {
      return {
        title: "Solid Performance",
        message: "You're on a good path. Target weaker subjects with focused study sessions to push towards first-class honors.",
        icon: "📈",
        color: "from-amber-50 to-yellow-50",
        textColor: "text-amber-700"
      };
    } else {
      return {
        title: "Opportunity for Growth",
        message: "There's room to improve. Create a structured study plan, seek tutoring, and track progress weekly for better results.",
        icon: "💡",
        color: "from-orange-50 to-red-50",
        textColor: "text-red-700"
      };
    }
  };

  const recommendation = getAcademicRecommendation(currentCgpa || currentGpa);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">{studentDetails?.username?.charAt(0) || 'S'}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Welcome back, {studentDetails?.username?.split(' ')[0] || 'Student'}
              </h1>
              <p className="text-slate-600 mt-1">
                {studentDetails?.regno} • {studentDetails?.branch} • Batch {studentDetails?.batchYear}
              </p>
            </div>
          </div>
        </div>

        {/* GPA Analytics Section */}
        {gpaHistory.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Academic Performance</h2>
                  <p className="text-slate-500 text-sm mt-1">Monitor your academic progress</p>
                </div>
                <select
                  value={gpaSelectedSem}
                  onChange={handleGpaSemesterChange}
                  className="px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  {gpaHistory.map(h => (
                    <option key={h.semesterNumber} value={h.semesterNumber.toString()}>
                      Semester {h.semesterNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6">
              <div className={`grid ${showCgpa ? 'grid-cols-2' : 'grid-cols-1'} gap-6 mb-6`}>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-1">Current GPA</p>
                      <p className="text-xs text-slate-500">Semester {gpaSelectedSem}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-slate-800">{currentGpa || '—'}</span>
                    <span className="text-lg text-slate-500">/ 10</span>
                  </div>
                  <div className="mt-4 h-2 bg-white rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(parseFloat(currentGpa || 0) / 10) * 100}%`, backgroundColor: getGpaColor(currentGpa) }} />
                  </div>
                </div>

                {showCgpa && (
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-slate-600 mb-1">Cumulative CGPA</p>
                        <p className="text-xs text-slate-500">Till Semester {gpaSelectedSem}</p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-slate-800">{currentCgpa || '—'}</span>
                      <span className="text-lg text-slate-500">/ 10</span>
                    </div>
                    <div className="mt-4 h-2 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(parseFloat(currentCgpa || 0) / 10) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-medium text-slate-500 mb-2">Average GPA</p>
                  <p className="text-2xl font-bold text-slate-800">{averageGpa || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-medium text-slate-500 mb-2">Highest GPA</p>
                  <p className="text-2xl font-bold text-emerald-600">{highestGpa || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-medium text-slate-500 mb-2">Semesters</p>
                  <p className="text-2xl font-bold text-slate-800">{filteredHistory.length}</p>
                </div>
              </div>

              {(currentCgpa || currentGpa) && (
                <div className={`bg-gradient-to-r ${recommendation.color} rounded-xl p-5 border border-slate-200 mb-6`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{recommendation.icon}</span>
                    <div>
                      <h4 className={`text-base font-bold ${recommendation.textColor} mb-1`}>{recommendation.title}</h4>
                      <p className="text-sm text-slate-700">{recommendation.message}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-800">Performance Trend</h3>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-slate-600">GPA</span>
                    </div>
                    {showCgpa && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-slate-600">CGPA</span>
                      </div>
                    )}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={filteredHistory}>
                    <defs>
                      <linearGradient id="colorGpa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCgpa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semester" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip formatter={(value) => parseFloat(value).toFixed(2)} />
                    <Area type="monotone" dataKey="gpaValue" stroke="#3b82f6" strokeWidth={2} fill="url(#colorGpa)" dot={{ fill: '#3b82f6', r: 4 }} />
                    {showCgpa && <Area type="monotone" dataKey="cgpaValue" stroke="#10b981" strokeWidth={2} fill="url(#colorCgpa)" dot={{ fill: '#10b981', r: 4 }} />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {studentDetails?.Deptname && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-600 mb-1">Department</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{studentDetails.Deptname}</p>
                </div>
              )}
              {studentDetails?.section && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-600 mb-1">Section</p>
                  <p className="text-sm font-semibold text-slate-800">{studentDetails.section}</p>
                </div>
              )}
              {studentDetails?.blood_group && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-600 mb-1">Blood Group</p>
                  <p className="text-sm font-semibold text-slate-800">{studentDetails.blood_group}</p>
                </div>
              )}
              {studentDetails?.gender && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-600 mb-1">Gender</p>
                  <p className="text-sm font-semibold text-slate-800">{studentDetails.gender}</p>
                </div>
              )}
            </div>

            {/* Semester Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Select Semester</label>
                  <select
                    value={selectedSemester}
                    onChange={handleSemesterChange}
                    className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
                  >
                    {semesters.map(sem => (
                      <option key={sem.semesterId} value={sem.semesterId.toString()}>
                        Semester {sem.semesterNumber} {sem.isActive === 'YES' ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleChooseCourses}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Choose Courses
                </button>

                <button
                  onClick={handleViewCBCS}
                  className="w-full sm:w-auto px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5     1.253"/>
                  </svg>
                  CBCS Selection
                </button>

              </div>
            </div>

            {/* Enrolled Courses */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h2 className="text-lg font-bold text-slate-800">Enrolled Courses</h2>
                {courses.length > 0 && <p className="text-sm text-slate-600 mt-1">{courses.length} courses this semester</p>}
              </div>
              {courses.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Course Name</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Section</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Instructor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {courses.map((c) => (
                        <tr key={c.courseId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800">
                              {c.courseCode}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-800 text-sm">{c.courseName}</td>
                          <td className="px-5 py-3 text-center text-slate-700 text-sm">{c.section}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center">
                                <span className="text-xs font-semibold text-slate-700">
                                  {c.staff ? c.staff.charAt(0).toUpperCase() : '?'}
                                </span>
                              </div>
                              <span className="text-slate-700 text-sm">{c.staff || 'Not Assigned'}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-2">No courses enrolled</h3>
                  <p className="text-slate-600 text-sm mb-4">Start by choosing your courses for this semester</p>
                  <button onClick={handleChooseCourses} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm">
                    Choose Courses
                  </button>
                </div>
              )}
            </div>

            {/* OEC/PEC Progress */}
            {progress && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-5">OEC/PEC Progress (Regulation Requirement)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200 text-center">
                    <p className="text-4xl font-bold text-indigo-700">
                      {progress.completed.OEC} / {progress.required.OEC}
                    </p>
                    <p className="text-lg font-medium text-slate-700 mt-3">Open Elective (OEC)</p>
                    <p className="text-sm text-slate-600 mt-2">
                      Remaining: <strong>{progress.remaining.OEC}</strong>
                    </p>
                    {progress.remaining.OEC === 0 ? (
                      <p className="text-green-600 font-bold mt-3">✓ Fully Completed!</p>
                    ) : (
                      <p className="text-orange-600 font-medium mt-3">Need {progress.remaining.OEC} more</p>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 text-center">
                    <p className="text-4xl font-bold text-purple-700">
                      {progress.completed.PEC} / {progress.required.PEC}
                    </p>
                    <p className="text-lg font-medium text-slate-700 mt-3">Program Elective (PEC)</p>
                    <p className="text-sm text-slate-600 mt-2">
                      Remaining: <strong>{progress.remaining.PEC}</strong>
                    </p>
                    {progress.remaining.PEC === 0 ? (
                      <p className="text-green-600 font-bold mt-3">✓ Fully Completed!</p>
                    ) : (
                      <p className="text-orange-600 font-medium mt-3">Need {progress.remaining.PEC} more</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Attendance */}
            <div className={`rounded-xl shadow-sm border-2 overflow-hidden ${
              totalDays === 0 ? 'bg-white border-slate-200' :
              isLowAttendance ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200' :
              'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
            }`}>
              <div className="p-5 border-b border-slate-200 bg-white/50">
                <h3 className="text-lg font-bold text-slate-800">Attendance Summary</h3>
              </div>
              {totalDays > 0 ? (
                <div className="p-5">
                  <div className="flex justify-center mb-5">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center ${isLowAttendance ? 'bg-red-100' : 'bg-green-100'}`}>
                      <div className="text-center">
                        <p className={`text-3xl font-bold ${isLowAttendance ? 'text-red-700' : 'text-green-700'}`}>
                          {attendancePercentage}%
                        </p>
                        <p className="text-xs text-slate-600 mt-1">Attendance</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between p-3 bg-white rounded-lg">
                      <span className="text-sm text-slate-600">Total Days</span>
                      <span className="font-bold text-slate-800">{totalDays}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white rounded-lg">
                      <span className="text-sm text-slate-600">Days Present</span>
                      <span className="font-bold text-green-600">{daysPresent}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white rounded-lg">
                      <span className="text-sm text-slate-600">Days Absent</span>
                      <span className="font-bold text-red-600">{totalDays - daysPresent}</span>
                    </div>
                  </div>

                  {isLowAttendance && (
                    <div className="p-3 bg-red-100 border border-red-200 rounded-lg flex items-start gap-2 mb-4">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-semibold text-red-800 text-sm">Low Attendance Alert</p>
                        <p className="text-xs text-red-700">Below 75%. Improve to avoid issues.</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Monthly Trend</h4>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={attendanceTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" fontSize={12} stroke="#94a3b8" />
                        <YAxis domain={[0, 100]} fontSize={12} stroke="#94a3b8" tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Bar dataKey="percentage" fill={isLowAttendance ? '#ef4444' : '#10b981'} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-600">
                  No attendance data available yet.
                </div>
              )}
            </div>

            {/* Contact Info */}
            {(studentDetails?.email || studentDetails?.personal_phone) && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <h3 className="text-lg font-bold text-slate-800">Contact Information</h3>
                </div>
                <div className="p-5 space-y-4">
                  {studentDetails?.email && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Email</p>
                        <p className="text-sm font-medium text-slate-800 break-all">{studentDetails.email}</p>
                      </div>
                    </div>
                  )}
                  {studentDetails?.personal_phone && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Phone</p>
                        <p className="text-sm font-medium text-slate-800">{studentDetails.personal_phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
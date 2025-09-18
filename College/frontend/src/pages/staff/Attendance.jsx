import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Download,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

// Custom hook for toastr alerts
const useToastr = () => {
  const showToast = (title, text, icon = "success") => {
    MySwal.fire({
      icon,
      title,
      text,
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener("mouseenter", MySwal.stopTimer);
        toast.addEventListener("mouseleave", MySwal.resumeTimer);
      },
    });
  };
  return showToast;
};

const AttendancePage = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const showToast = useToastr();

  const [selectedDate, setSelectedDate] = useState("2025-01-15");
  const [bulkAction, setBulkAction] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  // Sample students data
  const [students, setStudents] = useState([
    { id: 1, rollNo: "2312063", name: "Ram Prasath M", attendance: "Present", avatar: "RP" },
    { id: 2, rollNo: "2312053", name: "Joel A", attendance: "Present", avatar: "JA" },
    { id: 3, rollNo: "2312061", name: "Saravankumar", attendance: "Absent", avatar: "SK" },
    { id: 4, rollNo: "2312077", name: "Praveen kumar S", attendance: "Present", avatar: "PK" },
    { id: 5, rollNo: "2312078", name: "Balakrishna T", attendance: "OD", avatar: "BT" },
    { id: 6, rollNo: "2312080", name: "Mydeen Haan H", attendance: "Present", avatar: "MH" },
    { id: 7, rollNo: "2312085", name: "Aisha Patel", attendance: "Present", avatar: "AP" },
    { id: 8, rollNo: "2312090", name: "Ravi Shankar", attendance: "Absent", avatar: "RS" },
  ]);

  // Sample timetable dates for the subject
  const timetableDates = [
    { value: "2025-01-06", label: "Monday, January 6, 2025" },
    { value: "2025-01-08", label: "Wednesday, January 8, 2025" },
    { value: "2025-01-10", label: "Friday, January 10, 2025" },
    { value: "2025-01-13", label: "Monday, January 13, 2025" },
    { value: "2025-01-15", label: "Wednesday, January 15, 2025" },
    { value: "2025-01-17", label: "Friday, January 17, 2025" },
    { value: "2025-01-20", label: "Monday, January 20, 2025" },
    { value: "2025-01-22", label: "Wednesday, January 22, 2025" },
  ];

  const handleBulkAction = (action) => {
    if (action && action !== "") {
      setStudents(students.map((s) => ({ ...s, attendance: action })));
      setBulkAction("");
    }
  };

  const updateStudentAttendance = (id, attendance) => {
    setStudents(students.map((s) => (s.id === id ? { ...s, attendance } : s)));
  };

  const calculateAttendancePercentage = () => {
    const presentCount = Math.floor(Math.random() * 15) + 10;
    const totalClasses = 25;
    return Math.round((presentCount / totalClasses) * 100);
  };

  const downloadAttendanceReport = () => {
    const report = students.map((s) => ({
      "Roll No": s.rollNo,
      "Student Name": s.name,
      "Attendance Percentage": `${calculateAttendancePercentage(s)}%`,
      "Current Status": s.attendance,
      Date: selectedDate,
    }));

    const csvContent = [
      Object.keys(report[0]).join(","),
      ...report.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${selectedDate}.csv`;
    link.click();
    showToast("Report Exported!", "The attendance report has been downloaded successfully.");
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Present":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "Absent":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "OD":
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Present":
        return "bg-green-50 text-green-700 border-green-200";
      case "Absent":
        return "bg-red-50 text-red-700 border-red-200";
      case "OD":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const presentCount = students.filter((s) => s.attendance === "Present").length;
  const absentCount = students.filter((s) => s.attendance === "Absent").length;
  const odCount = students.filter((s) => s.attendance === "OD").length;
  const attendanceRate = Math.round(((presentCount + odCount) / students.length) * 100);

  const saveAttendance = () => {
    showToast("Attendance Saved!", "The attendance data has been successfully saved to the database.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <button
                onClick={() => navigate(`/staff/options/${courseId}`)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
                  <p className="text-sm text-gray-500">Web Framework using Python - DVK Batch</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-2 w-full sm:w-auto">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-0 bg-transparent text-sm font-medium focus:outline-none text-gray-700 w-full"
                />
              </div>
              <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-2 w-full sm:w-auto">
                <CheckCircle className="w-4 h-4 text-gray-500" />
                <select
                  value={bulkAction}
                  onChange={(e) => {
                    setBulkAction(e.target.value);
                    handleBulkAction(e.target.value);
                  }}
                  className="border-0 bg-transparent text-sm font-medium focus:outline-none text-gray-700 w-full"
                >
                  <option value="">Mark All As</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="OD">On Duty</option>
                </select>
              </div>
              <button
                onClick={downloadAttendanceReport}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center sm:justify-start space-x-2 shadow-lg hover:shadow-xl w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span>Download Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/70 rounded-2xl border border-gray-200/50 p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Present</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{presentCount}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white/70 rounded-2xl border border-gray-200/50 p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Absent</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{absentCount}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
          <div className="bg-white/70 rounded-2xl border border-gray-200/50 p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">On Duty</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">{odCount}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-white/70 rounded-2xl border border-gray-200/50 p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{attendanceRate}%</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/70 rounded-2xl border border-gray-200/50 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4">
                  <h2 className="text-2xl font-bold">Daily Attendance</h2>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/20"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex items-center space-x-6 mt-3 text-blue-100">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Course Code: CS101</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">
                      {new Date(selectedDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="p-6">
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="bg-gray-50/80">
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 px-6 py-4 text-sm font-semibold text-gray-700">
                    <div>Student</div>
                    <div>Roll Number</div>
                    <div className="text-center hidden sm:block">Attendance %</div>
                    <div className="text-center">Current Status</div>
                    <div className="text-center hidden sm:block">Action</div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {students.map((s, index) => (
                    <div
                      key={s.id}
                      className={`grid grid-cols-3 sm:grid-cols-5 gap-4 px-6 py-4 hover:bg-blue-50/50 transition-colors ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                          {s.avatar}
                        </div>
                        <p className="font-medium text-gray-900 truncate">{s.name}</p>
                      </div>
                      <span className="text-gray-600 font-mono text-sm">{s.rollNo}</span>
                      <div className="hidden sm:flex justify-center items-center">
                        <div className="flex items-center space-x-2">
                          <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                              style={{ width: `${calculateAttendancePercentage(s)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {calculateAttendancePercentage(s)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-center items-center">
                        <div
                          className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${getStatusBadge(
                            s.attendance
                          )}`}
                        >
                          {getStatusIcon(s.attendance)}
                          <span>{s.attendance}</span>
                        </div>
                      </div>
                      <div className="hidden sm:flex justify-center items-center">
                        <div className="relative">
                          <select
                            value={s.attendance}
                            onChange={(e) => updateStudentAttendance(s.id, e.target.value)}
                            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                            <option value="OD">On Duty</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={saveAttendance}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3 rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Save Attendance for{" "}
                  {new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
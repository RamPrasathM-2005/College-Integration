import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE_URL = "http://localhost:4000";

export default function AdminAttendanceGenerator() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [timetable, setTimetable] = useState({});
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [degrees, setDegrees] = useState([]);
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");

  // Auth + Admin Check + Default Dates
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to continue.");
      return;
    }
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      setUserProfile(userData);
      if (userData.role !== "admin") {
        setError("Access Denied: Admins only.");
        toast.error("Unauthorized Access");
      }
    } catch (err) {
      setError("Failed to load user profile");
    }

    // Default date range: today to +6 days
    if (!fromDate) {
      const today = new Date();
      setFromDate(today.toISOString().split("T")[0]);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6);
      setToDate(nextWeek.toISOString().split("T")[0]);
    }
  }, [fromDate]);

  // Fetch degrees & batches
  useEffect(() => {
    const fetchDegreesAndBatches = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/admin/timetable/batches`
        );
        if (res.data?.status === "success" && Array.isArray(res.data.data)) {
          const uniqueDegrees = [
            ...new Set(res.data.data.map((b) => b.degree)),
          ];
          setDegrees(uniqueDegrees);
          setBatches(res.data.data);
        }
      } catch (err) {
        setError("Failed to load degrees/batches");
      }
    };
    fetchDegreesAndBatches();
  }, []);

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/admin/timetable/departments`
        );
        if (res.data?.status === "success" && Array.isArray(res.data.data)) {
          setDepartments(
            res.data.data.map((d) => ({
              departmentId: d.Deptid,
              departmentCode: d.deptCode,
              departmentName: d.Deptname,
            }))
          );
        }
      } catch (err) {
        setError("Failed to load departments");
      }
    };
    fetchDepartments();
  }, []);

  // Fetch semesters
  useEffect(() => {
    if (selectedDegree && selectedBatch && selectedDepartment) {
      const fetchSemesters = async () => {
        const batchData = batches.find(
          (b) => b.batchId === parseInt(selectedBatch)
        );
        if (!batchData) return;

        try {
          const res = await axios.get(
            `${API_BASE_URL}/api/admin/semesters/by-batch-branch`,
            {
              params: {
                degree: selectedDegree,
                batch: batchData.batch,
                branch: batchData.branch,
              },
            }
          );
          if (res.data?.status === "success") setSemesters(res.data.data);
        } catch (err) {
          setError("Failed to load semesters");
        }
      };
      fetchSemesters();
    } else {
      setSemesters([]);
    }
  }, [selectedDegree, selectedBatch, selectedDepartment, batches]);

  // Helper functions
  const generateDates = () => {
    if (!fromDate || !toDate) return [];
    const dates = [];
    let current = new Date(fromDate);
    const end = new Date(toDate);
    end.setDate(end.getDate() + 1);
    while (current < end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const timeSlots = [
    { periodNumber: 1, time: "9:00–10:00" },
    { periodNumber: 2, time: "10:00–11:00" },
    { periodNumber: 3, time: "11:00–12:00" },
    { periodNumber: 4, time: "12:00–1:00" },
    { periodNumber: 5, time: "1:30–2:30" },
    { periodNumber: 6, time: "2:30–3:30" },
    { periodNumber: 7, time: "3:30–4:30" },
    { periodNumber: 8, time: "4:30–5:30" },
  ];

  const dates = generateDates();

  // Generate timetable
  const handleGenerate = async () => {
    setError(null);
    setTimetable({});
    setSelectedCourse(null);

    if (
      !selectedDegree ||
      !selectedBatch ||
      !selectedDepartment ||
      !selectedSemester
    ) {
      toast.error("Please select all filters");
      return;
    }

    setLoading(true);
    try {
      const batchData = batches.find(
        (b) => b.batchId === parseInt(selectedBatch)
      );
      const res = await axios.get(
        `${API_BASE_URL}/api/admin/attendance/timetable`,
        {
          params: {
            startDate: fromDate,
            endDate: toDate,
            degree: selectedDegree,
            batch: batchData.batch,
            branch: batchData.branch,
            Deptid: selectedDepartment,
            semesterId: selectedSemester,
          },
        }
      );

      if (res.data.data?.timetable) {
        setTimetable(res.data.data.timetable);
        toast.success("Timetable loaded successfully!");
      } else {
        setError("No timetable found");
      }
    } catch (err) {
      toast.error("Failed to load timetable");
    } finally {
      setLoading(false);
    }
  };

  // Load students when course clicked
  const handleCourseClick = async (
    courseId,
    sectionId,
    date,
    periodNumber,
    courseTitle
  ) => {
    setError(null);
    setStudents([]);
    setSelectedCourse(null);

    try {
      const dayOfWeek = new Date(date)
        .toLocaleDateString("en-US", { weekday: "short" })
        .toUpperCase();
      const res = await axios.get(
        `${API_BASE_URL}/api/admin/attendance/students/${courseId}/all/${dayOfWeek}/${periodNumber}`,
        { params: { date } }
      );

      if (res.data.data) {
        const updatedStudents = res.data.data.map((s) => ({
          ...s,
          status: s.status === "OD" ? "OD" : "", // Only preserve existing OD
        }));
        setStudents(updatedStudents);
        setSelectedCourse({
          courseId,
          courseTitle,
          sectionId: "all",
          date,
          periodNumber,
          dayOfWeek,
        });
        toast.success("Students loaded – Mark On Duty only");
      }
    } catch (err) {
      toast.error("Failed to load students");
    }
  };

  // Toggle OD status
  const toggleOD = (rollnumber) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.rollnumber === rollnumber
          ? { ...s, status: s.status === "OD" ? "" : "OD" }
          : s
      )
    );
  };

  // Mark all as OD
  const markAllOD = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: "OD" })));
    toast.success("All students marked as On Duty");
  };

  // Save only OD students
  const handleSave = async () => {
    if (!selectedCourse) return;

    const odStudents = students
      .filter((s) => s.status === "OD")
      .map((s) => ({
        rollnumber: s.rollnumber,
        name: s.name,
        sectionName: s.sectionName || "N/A",
        status: "OD",
      }));

    if (odStudents.length === 0) {
      toast.info("No students marked as On Duty");
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/admin/attendance/mark/${selectedCourse.courseId}/${selectedCourse.sectionId}/${selectedCourse.dayOfWeek}/${selectedCourse.periodNumber}`,
        { date: selectedCourse.date, attendances: odStudents }
      );
      toast.success(`On Duty saved for ${odStudents.length} student(s)!`);
    } catch (err) {
      toast.error("Failed to save On Duty status");
    } finally {
      setSaving(false);
    }
  };

  const odCount = students.filter((s) => s.status === "OD").length;

  // Block non-admins
  if (userProfile && userProfile.role !== "admin") {
    return (
      <div className="p-10 text-center text-3xl font-bold text-red-600">
        Unauthorized – Admin Access Only
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg">
      <h1 className="text-4xl font-bold mb-2 text-center text-blue-900">
        Admin On-Duty Attendance Manager
      </h1>
      <p className="text-center text-blue-700 mb-8">
        Only On Duty (OD) can be marked. Regular attendance is handled by
        faculty.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters - Full Original Layout */}
      <div className="flex flex-wrap gap-4 justify-center mb-8">
        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Degree</label>
          <select
            value={selectedDegree}
            onChange={(e) => {
              setSelectedDegree(e.target.value);
              setSelectedBatch("");
              setSelectedDepartment("");
              setSelectedSemester("");
            }}
            className="border-2 border-blue-300 p-3 rounded-lg"
          >
            <option value="">Select Degree</option>
            {degrees.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Batch</label>
          <select
            value={selectedBatch}
            onChange={(e) => {
              setSelectedBatch(e.target.value);
              setSelectedDepartment("");
              setSelectedSemester("");
            }}
            disabled={!selectedDegree}
            className="border-2 border-blue-300 p-3 rounded-lg disabled:bg-gray-100"
          >
            <option value="">Select Batch</option>
            {batches
              .filter((b) => b.degree === selectedDegree)
              .map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.batch}
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Department</label>
          <select
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              setSelectedSemester("");
            }}
            disabled={!selectedBatch}
            className="border-2 border-blue-300 p-3 rounded-lg disabled:bg-gray-100"
          >
            <option value="">Select Department</option>
            {departments
              .filter((d) =>
                batches.some(
                  (b) =>
                    b.batchId === parseInt(selectedBatch) &&
                    b.branch.toUpperCase() === d.departmentCode.toUpperCase()
                )
              )
              .map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.departmentName}
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Semester</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            disabled={!selectedDepartment}
            className="border-2 border-blue-300 p-3 rounded-lg disabled:bg-gray-100"
          >
            <option value="">Select Semester</option>
            {semesters.map((s) => (
              <option key={s.semesterId} value={s.semesterId}>
                Semester {s.semesterNumber}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border-2 border-blue-300 p-3 rounded-lg"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            min={fromDate}
            className="border-2 border-blue-300 p-3 rounded-lg"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? "Loading..." : "View Timetable"}
          </button>
        </div>
      </div>

      {/* Timetable - Full Original Table */}
      {dates.length > 0 && Object.keys(timetable).length > 0 && (
        <div className="mb-10 overflow-x-auto rounded-lg shadow-md">
          <table className="w-full border-collapse">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
              <tr>
                <th className="p-3 border border-blue-300">Date</th>
                <th className="p-3 border border-blue-300">Day</th>
                {timeSlots.map((slot) => (
                  <th
                    key={slot.periodNumber}
                    className="p-3 border border-blue-300 text-center"
                  >
                    Period {slot.periodNumber}
                    <br />
                    <small>{slot.time}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const dayName = new Date(date).toLocaleDateString("en-US", {
                  weekday: "long",
                });
                const periods = (timetable[date] || []).reduce((acc, p) => {
                  acc[p.periodNumber] = p;
                  return acc;
                }, {});
                return (
                  <tr key={date} className="hover:bg-blue-50">
                    <td className="p-3 border border-blue-200 font-medium">
                      {date}
                    </td>
                    <td className="p-3 border border-blue-200">{dayName}</td>
                    {timeSlots.map((slot) => {
                      const p = periods[slot.periodNumber];
                      return (
                        <td
                          key={slot.periodNumber}
                          className="p-3 border border-blue-200 text-center"
                        >
                          {p ? (
                            <button
                              onClick={() =>
                                handleCourseClick(
                                  p.courseId,
                                  p.sectionId,
                                  date,
                                  p.periodNumber,
                                  p.courseTitle
                                )
                              }
                              className="text-blue-700 font-semibold hover:underline"
                            >
                              {p.courseTitle}
                              <br />
                              {/* <small>Sec: {p.sectionName || "All"}</small> */}
                            </button>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* On-Duty Marking Section */}
      {selectedCourse && (
        <div className="mt-10 bg-white p-8 rounded-xl shadow-xl border-2 border-blue-200">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Mark On Duty — {selectedCourse.courseTitle}
          </h2>
          <div className="text-sm text-blue-600 mb-6">
            <p>
              Date: {selectedCourse.date} | Period:{" "}
              {selectedCourse.periodNumber}
            </p>
          </div>

          {/* <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
           
            <strong>On Duty (OD)</strong>.
          </div> */}

          <button
            onClick={markAllOD}
            className="mb-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Mark All as On Duty
          </button>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-blue-700 text-white">
                <tr>
                  <th className="p-4">Roll No</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Section</th>
                  <th className="p-4">On Duty?</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={i} className="even:bg-blue-50 hover:bg-blue-100">
                    <td className="p-4 text-center">{s.rollnumber}</td>
                    <td className="p-4">{s.name}</td>
                    <td className="p-4 text-center">
                      {s.sectionName || "N/A"}
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={s.status === "OD"}
                        onChange={() => toggleOD(s.rollnumber)}
                        className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-100 font-bold">
                  <td colSpan="3" className="p-4 text-right">
                    Total On Duty:
                  </td>
                  <td className="p-4 text-center text-blue-900">{odCount}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={handleSave}
              disabled={saving || odCount === 0}
              className="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-lg text-lg font-bold disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save On Duty (${odCount} students)`}
            </button>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" theme="light" />
    </div>
  );
}

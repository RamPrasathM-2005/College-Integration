import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE_URL = "http://localhost:4000";

export default function AdminAttendanceGenerator() {
  // State variables
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
  const [bulkStatus, setBulkStatus] = useState("");

  // Set authentication token and default dates
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      setError("No authentication token found. Please log in.");
    }

    if (!fromDate) {
      const today = new Date();
      const formattedToday = today.toISOString().split("T")[0];
      setFromDate(formattedToday);

      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6);
      setToDate(nextWeek.toISOString().split("T")[0]);
    }

    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      setUserProfile(userData);
    } catch (err) {
      console.error("Failed to load user profile", err);
      setError("Failed to load user profile");
    }
  }, [fromDate]);

  // Fetch degrees and batches
  useEffect(() => {
    const fetchDegreesAndBatches = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/admin/timetable/batches`
        );
        console.log("Batches API response:", response.data);
        if (
          response.data?.status === "success" &&
          Array.isArray(response.data.data)
        ) {
          const uniqueDegrees = [
            ...new Set(response.data.data.map((batch) => batch.degree)),
          ];
          setDegrees(uniqueDegrees);
          setBatches(response.data.data);
          setError(null);
        } else {
          throw new Error("Invalid response structure: data is not an array");
        }
      } catch (error) {
        console.error("Error fetching degrees and batches:", error);
        setError(
          error.response?.data?.message || "Failed to load degrees and batches."
        );
        setDegrees([]);
        setBatches([]);
      }
    };
    fetchDegreesAndBatches();
  }, []);

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/admin/timetable/departments`
        );
        console.log("Departments API response:", response.data);
        if (
          response.data?.status === "success" &&
          Array.isArray(response.data.data)
        ) {
          const mappedDepartments = response.data.data.map((dept) => ({
            departmentId: dept.Deptid,
            departmentCode: dept.deptCode,
            departmentName: dept.Deptname,
          }));
          setDepartments(mappedDepartments);
          setError(null);
        } else {
          throw new Error("Invalid response structure: data is not an array");
        }
      } catch (error) {
        console.error("Error fetching departments:", error);
        setError(
          error.response?.data?.message || "Failed to load departments."
        );
        setDepartments([]);
      }
    };
    fetchDepartments();
  }, []);

  // Fetch semesters based on degree, batch, and branch
  useEffect(() => {
    if (selectedDegree && selectedBatch && selectedDepartment) {
      const fetchSemesters = async () => {
        try {
          const selectedBatchData = batches.find(
            (batch) => batch.batchId === parseInt(selectedBatch)
          );
          if (!selectedBatchData) {
            throw new Error("Selected batch not found");
          }
          const response = await axios.get(
            `${API_BASE_URL}/api/admin/semesters/by-batch-branch`,
            {
              params: {
                degree: selectedDegree,
                batch: selectedBatchData.batch,
                branch: selectedBatchData.branch,
              },
            }
          );
          console.log("Semesters API response:", response.data);
          if (
            response.data?.status === "success" &&
            Array.isArray(response.data.data)
          ) {
            setSemesters(response.data.data);
            setError(null);
          } else {
            throw new Error("Invalid response structure: data is not an array");
          }
        } catch (error) {
          console.error("Error fetching semesters:", error);
          setError(
            error.response?.data?.message || "Failed to load semesters."
          );
          setSemesters([]);
        }
      };
      fetchSemesters();
    } else {
      setSemesters([]);
    }
  }, [selectedDegree, selectedBatch, selectedDepartment, batches]);

  // Helper function to generate array of dates between fromDate and toDate
  const generateDates = () => {
    if (!fromDate || !toDate) return [];
    const dates = [];
    let currentDate = new Date(fromDate);
    const endDate = new Date(toDate);

    endDate.setDate(endDate.getDate() + 1);
    while (currentDate < endDate) {
      dates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  // Helper function to generate time slots for periods
  const generateTimeSlots = () => {
    const slots = [
      { periodNumber: 1, time: "9:00–10:00" },
      { periodNumber: 2, time: "10:00–11:00" },
      { periodNumber: 3, time: "11:00–12:00" },
      { periodNumber: 4, time: "12:00–1:00" },
      { periodNumber: 5, time: "1:30–2:30" },
      { periodNumber: 6, time: "2:30–3:30" },
      { periodNumber: 7, time: "3:30–4:30" },
      { periodNumber: 8, time: "4:30–5:30" },
    ];
    return slots;
  };

  // Fetch timetable data from API
  const handleGenerate = async () => {
    setError(null);
    setSelectedCourse(null);
    setStudents([]);
    setTimetable({}); // Clear previous timetable

    if (!fromDate || !toDate) {
      setError("Please select both dates");
      toast.error("Please select both dates", { position: "top-right" });
      return;
    }
    if (
      !selectedDegree ||
      !selectedBatch ||
      !selectedDepartment ||
      !selectedSemester
    ) {
      setError("Please select degree, batch, department, and semester");
      toast.error("Please select degree, batch, department, and semester", {
        position: "top-right",
      });
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setError("From date must be before or equal to to date");
      toast.error("From date must be before or equal to to date", {
        position: "top-right",
      });
      return;
    }

    setLoading(true);
    try {
      const selectedBatchData = batches.find(
        (batch) => batch.batchId === parseInt(selectedBatch)
      );
      if (!selectedBatchData) {
        throw new Error("Selected batch not found");
      }
      const res = await axios.get(
        `${API_BASE_URL}/api/admin/attendance/timetable`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          params: {
            startDate: fromDate,
            endDate: toDate,
            degree: selectedDegree,
            batch: selectedBatchData.batch,
            branch: selectedBatchData.branch,
            Deptid: selectedDepartment,
            semesterId: selectedSemester,
          },
        }
      );
      console.log("Timetable Response:", res.data);
      if (!res.data.data?.timetable) {
        setError("No timetable data received for the selected filters.");
        toast.error("No timetable data received for the selected filters.", {
          position: "top-right",
        });
      } else {
        setTimetable(res.data.data.timetable);
        toast.success("Timetable generated successfully!", {
          position: "top-right",
        });
      }
    } catch (err) {
      console.error("API Error:", err.response?.data || err);
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Error generating timetable: ${errorMessage}`);
      toast.error(`Error generating timetable: ${errorMessage}`, {
        position: "top-right",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle when user clicks on a course in the timetable
  const handleCourseClick = async (
    courseCode,
    sectionId,
    date,
    periodNumber
  ) => {
    setError(null);
    setStudents([]);
    setSelectedCourse(null);
    setBulkStatus(""); // Reset bulk status dropdown

    const safeSectionId = "all";

    try {
      const dayOfWeek = new Date(date)
        .toLocaleDateString("en-US", { weekday: "short" })
        .toUpperCase();

      console.log("Calling getStudentsForPeriod with:", {
        courseCode,
        sectionId: safeSectionId,
        dayOfWeek,
        periodNumber,
        date,
      });

      const res = await axios.get(
        `${API_BASE_URL}/api/admin/attendance/students/${courseCode}/${safeSectionId}/${dayOfWeek}/${periodNumber}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          params: { date },
        }
      );

      console.log("Students Response:", res.data);

      if (!res.data.data) {
        setError("No student data received.");
        toast.error("No student data received.", { position: "top-right" });
      } else {
        // FIXED: Do not override fetched status; use the status from DB (COALESCE(pa.status, '') in backend)
        const updatedStudents = res.data.data.map((student) => ({
          ...student,
          // status is already fetched from backend; no need to set to ""
        }));
        setStudents(updatedStudents);
        setSelectedCourse({
          courseCode,
          sectionId: safeSectionId,
          date,
          periodNumber,
          dayOfWeek,
        });
        toast.success("Students loaded successfully!", {
          position: "top-right",
        });
      }
    } catch (err) {
      console.error("Error in handleCourseClick:", err);
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Error fetching students: ${errorMessage}`);
      toast.error(`Error fetching students: ${errorMessage}`, {
        position: "top-right",
      });
    }
  };

  // Update student attendance status
  const handleAttendanceChange = (rollnumber, status) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.rollnumber === rollnumber ? { ...student, status } : student
      )
    );
  };

  // Handle bulk status change for all students
  const handleBulkStatusChange = (status) => {
    setBulkStatus(status);
    if (status) {
      setStudents((prev) =>
        prev.map((student) => ({
          ...student,
          status,
        }))
      );
      toast.success(
        `All students marked as ${
          status === "P" ? "Present" : status === "A" ? "Absent" : "On Duty"
        }!`,
        {
          position: "top-right",
        }
      );
    }
  };

  // Save attendance to the database
  const handleSave = async () => {
    if (!students.length) {
      setError("No students to save.");
      toast.error("No students to save.", { position: "top-right" });
      return;
    }

    if (!selectedCourse) {
      setError("Course data missing.");
      toast.error("Course data missing.", { position: "top-right" });
      return;
    }

    // Filter students with valid status
    const validStatuses = ["P", "A", "OD"];
    const payload = students
      .filter((student) => validStatuses.includes(student.status))
      .map((student) => ({
        rollnumber: student.rollnumber,
        name: student.name,
        sectionName: student.sectionName || "N/A",
        status: student.status,
      }));

    if (payload.length === 0) {
      setError("No students with valid attendance status to save.");
      toast.error("No students with valid attendance status to save.", {
        position: "top-right",
      });
      return;
    }

    setSaving(true);
    try {
      console.log("Sending attendance payload:", {
        courseCode: selectedCourse.courseCode,
        sectionId: selectedCourse.sectionId,
        dayOfWeek: selectedCourse.dayOfWeek,
        periodNumber: selectedCourse.periodNumber,
        date: selectedCourse.date,
        attendances: payload,
      });

      const res = await axios.post(
        `${API_BASE_URL}/api/admin/attendance/mark/${selectedCourse.courseCode}/${selectedCourse.sectionId}/${selectedCourse.dayOfWeek}/${selectedCourse.periodNumber}`,
        { date: selectedCourse.date, attendances: payload },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      console.log("Save Attendance Response:", res.data);

      if (res.data.status === "success") {
        toast.success(res.data.message || "Attendance saved successfully!", {
          position: "top-right",
          autoClose: 3000,
        });
        setError(null);
        // FIXED: Reload students after save to show updated statuses (or keep as-is since select will reflect on reload)
        // For now, reset to "" only if you want to clear; but to show saved, reload via handleCourseClick
        setStudents(
          (prev) =>
            prev.map((student) => ({ ...student, status: student.status })) // Keep the saved status
        );
        // Optionally reload to fetch fresh data:
        // handleCourseClick(selectedCourse.courseCode, selectedCourse.sectionId, selectedCourse.date, selectedCourse.periodNumber);
      } else {
        throw new Error(res.data.message || "Save failed");
      }
    } catch (err) {
      console.error("Error in handleSave:", err);
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Error saving attendance: ${errorMessage}`);
      toast.error(`Failed to save attendance: ${errorMessage}`, {
        position: "top-right",
      });
    } finally {
      setSaving(false);
    }
  };

  // Calculate attendance summary
  const attendanceSummary = students.reduce(
    (acc, student) => {
      if (student.status === "P") acc.present += 1;
      else if (student.status === "A") acc.absent += 1;
      else if (student.status === "OD") acc.onDuty += 1;
      return acc;
    },
    { present: 0, absent: 0, onDuty: 0 }
  );

  const dates = generateDates();
  const timeSlots = generateTimeSlots();
  const hasDatesSelected = fromDate && toDate && dates.length > 0;

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-900">
        Admin Attendance Management
      </h1>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded-lg shadow">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Dismiss
          </button>
        </div>
      )}

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
              setError(null);
            }}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select Degree</option>
            {degrees.length > 0 ? (
              degrees.map((degree) => (
                <option key={degree} value={degree}>
                  {degree}
                </option>
              ))
            ) : (
              <option value="" disabled>
                No degrees available
              </option>
            )}
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
              setError(null);
            }}
            disabled={!selectedDegree}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-blue-50"
          >
            <option value="">Select Batch</option>
            {batches
              .filter((batch) => batch.degree === selectedDegree)
              .map((batch) => (
                <option key={batch.batchId} value={batch.batchId}>
                  {batch.branch} ({batch.batch})
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
              setError(null);
            }}
            disabled={!selectedBatch}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-blue-50"
          >
            <option value="">Select Department</option>
            {departments
              .filter((dept) =>
                batches.some(
                  (batch) =>
                    batch.degree === selectedDegree &&
                    batch.batchId === parseInt(selectedBatch) &&
                    batch.branch.toUpperCase() ===
                      dept.departmentCode.toUpperCase()
                )
              )
              .map((dept) => (
                <option key={dept.departmentId} value={dept.departmentId}>
                  {dept.departmentName} ({dept.departmentCode})
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Semester</label>
          <select
            value={selectedSemester}
            onChange={(e) => {
              setSelectedSemester(e.target.value);
              setError(null);
            }}
            disabled={!selectedDepartment}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-blue-50"
          >
            <option value="">Select Semester</option>
            {semesters.length > 0 ? (
              semesters.map((sem) => (
                <option key={sem.semesterId} value={sem.semesterId}>
                  Semester {sem.semesterNumber}
                </option>
              ))
            ) : (
              <option value="" disabled>
                No semesters available
              </option>
            )}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">From Date</label>
          <input
            type="date"
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">To Date</label>
          <input
            type="date"
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            min={fromDate}
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Generating...
              </span>
            ) : (
              "View TimeTable"
            )}
          </button>
        </div>
      </div>

      {hasDatesSelected && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-blue-800">
            Class Timetable
            {userProfile && (
              <span className="text-base font-normal ml-2 text-blue-600">
                (Admin: {userProfile.username})
              </span>
            )}
          </h2>

          {Object.keys(timetable).length === 0 && !loading && (
            <div className="text-center text-blue-500 italic">
              No timetable data available for the selected filters.
            </div>
          )}

          {Object.keys(timetable).length > 0 && (
            <div className="overflow-x-auto rounded-lg shadow-md">
              <table className="w-full border-collapse">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
                  <tr>
                    <th className="border border-blue-300 p-3 text-left">
                      Date
                    </th>
                    <th className="border border-blue-300 p-3 text-left">
                      Day
                    </th>
                    {timeSlots.map(({ periodNumber, time }) => (
                      <th
                        key={periodNumber}
                        className="border border-blue-300 p-3 text-center"
                      >
                        Period {periodNumber}
                        <br />
                        <span className="text-xs font-normal">{time}</span>
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
                      <tr
                        key={date}
                        className="hover:bg-blue-50 transition-colors duration-150"
                      >
                        <td className="border border-blue-200 p-3 font-medium text-blue-900">
                          {date}
                        </td>
                        <td className="border border-blue-200 p-3 text-blue-900">
                          {dayName}
                        </td>
                        {timeSlots.map(({ periodNumber }) => {
                          const period = periods[periodNumber];
                          return (
                            <td
                              key={`${date}-${periodNumber}`}
                              className={`border border-blue-200 p-3 text-center ${
                                period ? "bg-blue-50" : "bg-blue-100"
                              }`}
                            >
                              {period ? (
                                <button
                                  onClick={() =>
                                    handleCourseClick(
                                      period.courseCode,
                                      period.sectionId,
                                      date,
                                      period.periodNumber
                                    )
                                  }
                                  className="text-md font-semibold text-blue-700 hover:text-blue-900 hover:underline transition-colors duration-150 py-1 px-2 rounded"
                                >
                                  {period.courseTitle || period.courseCode}
                                  <br />
                                  <span className="text-xs font-normal">
                                    Sec: {period.sectionName || "N/A"}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-sm text-blue-400 italic">
                                  No period
                                </span>
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
        </div>
      )}

      {selectedCourse && (
        <div className="mt-8 bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-blue-800">
              Attendance for {selectedCourse.courseCode}
            </h2>
            <div className="text-sm text-blue-600">
              <p>Date: {selectedCourse.date}</p>
              <p>Period: {selectedCourse.periodNumber}</p>
              <p>Section: All</p>
            </div>
          </div>

          <div className="mb-4">
            <select
              value={bulkStatus}
              onChange={(e) => handleBulkStatusChange(e.target.value)}
              className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Status for All</option>
              <option value="P">Mark as Present</option>
              <option value="A">Mark as Absent</option>
              <option value="OD">Mark as On Duty</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg shadow-md">
            <table className="w-full border-collapse">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
                <tr>
                  <th className="border border-blue-300 p-3 text-center">
                    Roll No
                  </th>
                  <th className="border border-blue-300 p-3 text-center">
                    Name
                  </th>
                  <th className="border border-blue-300 p-3 text-center">
                    Section
                  </th>
                  <th className="border border-blue-300 p-3 text-center">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.length > 0 ? (
                  students.map((student, idx) => (
                    <tr
                      key={idx}
                      className="even:bg-blue-50 odd:bg-white hover:bg-blue-100 transition-colors duration-150"
                    >
                      <td className="border border-blue-200 p-3 text-center text-blue-900">
                        {student.rollnumber}
                      </td>
                      <td className="border border-blue-200 p-3 text-center text-blue-900">
                        {student.name}
                      </td>
                      <td className="border border-blue-200 p-3 text-center text-blue-900">
                        {student.sectionName || "N/A"}
                      </td>
                      <td className="border border-blue-200 p-3 text-center">
                        <select
                          value={student.status || ""} // Use fetched status or empty
                          onChange={(e) =>
                            handleAttendanceChange(
                              student.rollnumber,
                              e.target.value
                            )
                          }
                          className={`border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-800 ${
                            student.status === "P"
                              ? "bg-green-100 border-green-300"
                              : student.status === "A"
                              ? "bg-red-100 border-red-300"
                              : student.status === "OD"
                              ? "bg-yellow-100 border-yellow-300"
                              : "bg-gray-100 border-gray-300"
                          }`}
                          aria-label={`Attendance status for ${student.name}`}
                          disabled={saving}
                        >
                          <option value="">Status</option>
                          <option value="P">P</option>
                          <option value="A">A</option>
                          <option value="OD">OD</option>
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="border border-blue-200 p-5 text-center text-blue-500"
                    >
                      No students found for this course.
                    </td>
                  </tr>
                )}
              </tbody>
              {students.length > 0 && (
                <tfoot>
                  <tr className="bg-blue-100">
                    <td
                      colSpan="4"
                      className="border border-blue-200 p-3 text-center text-blue-900 font-semibold"
                    >
                      Total: {students.length} students | Present:{" "}
                      {attendanceSummary.present} | Absent:{" "}
                      {attendanceSummary.absent} | On Duty:{" "}
                      {attendanceSummary.onDuty}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={handleSave}
              disabled={saving || !students.length}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg shadow-md disabled:opacity-50 transition-colors duration-200"
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save Attendance"
              )}
            </button>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
}
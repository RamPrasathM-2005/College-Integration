import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API_BASE_URL = "http://localhost:4000";

export default function AttendanceReport() {
  const [filters, setFilters] = useState({
    degree: "Select Degree",
    batch: "Select Batch",
    department: "Select Department",
    semester: "Select Semester",
    fromDate: "2025-10-20",
    toDate: "2025-10-26",
  });
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [report, setReport] = useState([]);
  const [courses, setCourses] = useState([]);
  const [unmarkedReport, setUnmarkedReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem("token");
  const [minPercentage, setMinPercentage] = useState(""); // stores the input value

  const fetchWithAuth = async (url) => {
    if (!token)
      throw new Error("No authentication token found. Please log in.");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    const data = await res.json();
    return data;
  };

  useEffect(() => {
    const loadBatches = async () => {
      try {
        setLoading(true);
        const data = await fetchWithAuth(
          `${API_BASE_URL}/api/admin/attendanceReports/batches`
        );
        if (data.success) setBatches(data.batches || []);
        else throw new Error(data.error || "Failed to fetch batches");
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadBatches();
  }, [token]);

  useEffect(() => {
    const loadDepartments = async () => {
      if (!filters.batch || filters.batch === "Select Batch") {
        setDepartments([]);
        return;
      }
      try {
        setLoading(true);
        const data = await fetchWithAuth(
          `${API_BASE_URL}/api/admin/attendanceReports/departments/${filters.batch}`
        );
        if (data.success) setDepartments(data.departments || []);
        else throw new Error(data.error || "Failed to fetch departments");
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadDepartments();
  }, [filters.batch, token]);

  useEffect(() => {
    const loadSemesters = async () => {
      if (
        !filters.batch ||
        !filters.department ||
        filters.department === "Select Department"
      ) {
        setSemesters([]);
        return;
      }
      try {
        setLoading(true);
        const data = await fetchWithAuth(
          `${API_BASE_URL}/api/admin/attendanceReports/semesters/${filters.batch}/${filters.department}`
        );
        if (data.success) setSemesters(data.semesters || []);
        else throw new Error(data.error || "Failed to fetch semesters");
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadSemesters();
  }, [filters.batch, filters.department, token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleDownloadExcel = () => {
    if (report.length === 0) {
      alert("No report data to export!");
      return;
    }

    // Convert report JSON to worksheet
    const worksheet = XLSX.utils.json_to_sheet(report);

    // Create a new workbook and append the sheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");

    // Generate Excel file and trigger download
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(
      data,
      `Attendance_Report_${filters.fromDate}_to_${filters.toDate}.xlsx`
    );
  };
  const handleGenerateReport = async () => {
    if (!token) {
      setError("No authentication token found. Please log in.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const url = `${API_BASE_URL}/api/admin/attendanceReports/subject-wise/${filters.degree}/${filters.batch}/${filters.department}/${filters.semester}?fromDate=${filters.fromDate}&toDate=${filters.toDate}`;
      const data = await fetchWithAuth(url);
      if (data.success) {
        setReport(data.report || []);
        setCourses(data.courses || []);
        console.log(data.courses);
      } else throw new Error(data.error || "Failed to generate report");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBlackBoxReport = async () => {
    if (
      !token ||
      !filters.batch ||
      filters.batch === "Select Batch" ||
      !filters.semester ||
      filters.semester === "Select Semester" ||
      !filters.fromDate ||
      !filters.toDate
    ) {
      setError("Please select all required filters and log in.");
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Clear previous report
      setReport([]);
      setCourses([]);

      const url = `${API_BASE_URL}/api/admin/attendanceReports/unmarked/${filters.batch}/${filters.semester}?fromDate=${filters.fromDate}&toDate=${filters.toDate}`;
      const data = await fetchWithAuth(url);
      if (data.success) {
        setUnmarkedReport(data.report || []);
      } else
        throw new Error(data.error || "Failed to generate black box report");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-900">
        Admin Attendance Management
      </h1>

      <div className="flex flex-wrap gap-4 justify-center mb-8">
        {/* Degree */}
        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Degree</label>
          <select
            name="degree"
            value={filters.degree}
            onChange={handleInputChange}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="Select Degree">Select Degree</option>
            <option value="BE">BE</option>
            <option value="B.Tech">B.Tech</option>
            <option value="ME">ME</option>
            <option value="M.Tech">M.Tech</option>
          </select>
        </div>

        {/* Batch */}
        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Batch</label>
          <select
            name="batch"
            value={filters.batch}
            onChange={handleInputChange}
            disabled={!filters.degree || filters.degree === "Select Degree"}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-blue-50"
          >
            <option value="Select Batch">Select Batch</option>
            {batches.map((batch) => (
              <option key={batch.batchId} value={batch.batchId}>
                {batch.batch}
              </option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Department</label>
          <select
            name="department"
            value={filters.department}
            onChange={handleInputChange}
            disabled={!filters.batch || filters.batch === "Select Batch"}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-blue-50"
          >
            <option value="Select Department">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.departmentId} value={dept.departmentId}>
                {dept.departmentName} ({dept.departmentCode})
              </option>
            ))}
          </select>
        </div>

        {/* Semester */}
        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">Semester</label>
          <select
            name="semester"
            value={filters.semester}
            onChange={handleInputChange}
            disabled={
              !filters.department || filters.department === "Select Department"
            }
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-blue-50"
          >
            <option value="Select Semester">Select Semester</option>
            {semesters.map((sem) => (
              <option key={sem.semesterId} value={sem.semesterId}>
                Semester {sem.semesterNumber}
              </option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">From Date</label>
          <input
            type="date"
            name="fromDate"
            value={filters.fromDate}
            onChange={handleInputChange}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* To Date */}
        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">To Date</label>
          <input
            type="date"
            name="toDate"
            value={filters.toDate}
            min={filters.fromDate}
            onChange={handleInputChange}
            className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-blue-700 mb-1">
            Show students below %
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Enter %"
              value={minPercentage}
              onChange={(e) => setMinPercentage(e.target.value)}
              className="border-2 border-blue-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
            />
            {/* <button
              onClick={() => {}}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg shadow-md"
            >
              Filter
            </button> */}
          </div>
        </div>
        {/* Generate Report Button */}
        <div className="flex items-end">
          <button
            onClick={handleGenerateReport}
            disabled={
              loading ||
              !filters.fromDate ||
              !filters.toDate ||
              filters.degree === "Select Degree" ||
              filters.batch === "Select Batch" ||
              filters.department === "Select Department" ||
              filters.semester === "Select Semester"
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>
          <button
            onClick={handleBlackBoxReport}
            disabled={
              loading ||
              !filters.fromDate ||
              !filters.toDate ||
              !filters.batch ||
              !filters.semester
            }
            className="ml-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-md disabled:opacity-50 transition-colors duration-200"
          >
            Black Box Report
          </button>
          <button
            onClick={handleDownloadExcel}
            disabled={report.length === 0 || loading}
            className="ml-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-md disabled:opacity-50 transition-colors duration-200"
          >
            Download Excel
          </button>
        </div>
      </div>

      {error && <div className="text-center text-red-500 mb-4">{error}</div>}
      {report.length === 0 && !loading && !error && (
        <div className="text-center text-blue-500 italic">
          {/* No attendance data available for the selected filters. */}
        </div>
      )}

      {report.length > 0 && (
        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="w-full border-collapse">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
              <tr>
                <th className="border border-blue-300 p-3 text-center">
                  Register Number
                </th>
                <th className="border border-blue-300 p-3 text-center">
                  Student Name
                </th>
                {courses.map((courseCode) => (
                  <React.Fragment key={courseCode}>
                    <th className="border border-blue-300 p-3 text-center">{`${courseCode} Conducted Periods`}</th>
                    <th className="border border-blue-300 p-3 text-center">{`${courseCode} Attended Periods`}</th>
                    <th className="border border-blue-300 p-3 text-center">{`${courseCode} Att%`}</th>
                  </React.Fragment>
                ))}
                <th className="border border-blue-300 p-3 text-center">
                  Total Conducted Periods
                </th>
                <th className="border border-blue-300 p-3 text-center">
                  Total Attended Periods
                </th>
                <th className="border border-blue-300 p-3 text-center">
                  Total Percentage %
                </th>
              </tr>
            </thead>
            <tbody>
              {report
                .filter((student) => {
                  if (!minPercentage) return true; // if input empty, show all
                  return (
                    parseFloat(student["Total Percentage %"]) <
                    parseFloat(minPercentage)
                  );
                })
                .map((student, idx) => (
                  <tr
                    key={idx}
                    className="even:bg-blue-50 odd:bg-white hover:bg-blue-100 transition-colors duration-150"
                  >
                    <td className="border border-blue-200 p-3 text-center text-blue-900">
                      {student.RegisterNumber}
                    </td>
                    <td className="border border-blue-200 p-3 text-center text-blue-900">
                      {student.StudentName}
                    </td>
                    {courses.map((courseCode) => [
                      <td
                        key={`${student.RegisterNumber}-conducted-${courseCode}`}
                        className="border border-blue-200 p-3 text-center"
                      >
                        {student[`${courseCode} Conducted Periods`] || 0}
                      </td>,
                      <td
                        key={`${student.RegisterNumber}-attended-${courseCode}`}
                        className="border border-blue-200 p-3 text-center"
                      >
                        {student[`${courseCode} Attended Periods`] || 0}
                      </td>,
                      <td
                        key={`${student.RegisterNumber}-percentage-${courseCode}`}
                        className="border border-blue-200 p-3 text-center"
                      >
                        {student[`${courseCode} Att%`] || "0.00"}
                      </td>,
                    ])}
                    <td className="border border-blue-200 p-3 text-center">
                      {student["Total Conducted Periods"]}
                    </td>
                    <td className="border border-blue-200 p-3 text-center">
                      {student["Total Attended Periods"]}
                    </td>
                    <td className="border border-blue-200 p-3 text-center">
                      {student["Total Percentage %"]}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {unmarkedReport.length > 0 && (
        <div className="mt-8 overflow-x-auto rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-blue-800">
            Black Box Report - Unmarked Attendance
          </h2>
          <table className="w-full border-collapse">
            <thead className="bg-gradient-to-r from-gray-600 to-gray-800 text-white">
              <tr>
                <th className="border border-gray-300 p-3 text-center">
                  Register Number
                </th>
                <th className="border border-gray-300 p-3 text-center">
                  Student Name
                </th>
                <th className="border border-gray-300 p-3 text-center">Date</th>
                <th className="border border-gray-300 p-3 text-center">
                  Period Number
                </th>
                <th className="border border-gray-300 p-3 text-center">
                  Course
                </th>
              </tr>
            </thead>
            <tbody>
              {unmarkedReport.map((entry, idx) => (
                <tr
                  key={idx}
                  className="even:bg-gray-50 odd:bg-white hover:bg-gray-100 transition-colors duration-150"
                >
                  <td className="border border-gray-200 p-3 text-center text-gray-900">
                    {entry.RegisterNumber}
                  </td>
                  <td className="border border-gray-200 p-3 text-center text-gray-900">
                    {entry.StudentName}
                  </td>
                  <td className="border border-gray-200 p-3 text-center">
                    {entry.Date}
                  </td>
                  <td className="border border-gray-200 p-3 text-center">
                    {entry.PeriodNumber}
                  </td>
                  <td className="border border-gray-200 p-3 text-center">
                    {entry.Course}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {unmarkedReport.length === 0 && !loading && !error && (
        <div className="text-center text-gray-500 italic mt-4">
          No unmarked attendance found for the selected date range.
        </div>
      )}
    </div>
  );
}

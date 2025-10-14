import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE_URL = "http://localhost:4000";

export default function AttendanceGenerator() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [timetable, setTimetable] = useState({});
  const [students, setStudents] = useState([]);
  const [nextPeriodStudents, setNextPeriodStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [bulkStatus, setBulkStatus] = useState("");
  const [skippedStudents, setSkippedStudents] = useState([]);
  const [nextPeriodSkippedStudents, setNextPeriodSkippedStudents] = useState(
    []
  );
  const [appendPeriods, setAppendPeriods] = useState({});
  const [isAppendMode, setIsAppendMode] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      setError("No authentication token found. Please log in.");
    }

    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      setUserProfile(userData);
    } catch (err) {
      console.error("Failed to load user profile", err);
      setError("Failed to load user profile");
    }
  }, []);

  useEffect(() => {
    if (!fromDate) {
      const today = new Date();
      const formattedToday = today.toISOString().split("T")[0];
      setFromDate(formattedToday);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6);
      setToDate(nextWeek.toISOString().split("T")[0]);
    }
  }, []);

  useEffect(() => {
    if (fromDate && toDate && new Date(fromDate) <= new Date(toDate) && !loading) {
      handleGenerate();
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    const identifyConsecutivePeriods = () => {
      const append = {};
      Object.keys(timetable).forEach((date) => {
        const periods = timetable[date] || [];
        periods.sort((a, b) => a.periodNumber - b.periodNumber);
        for (let i = 0; i < periods.length - 1; i++) {
          const current = periods[i];
          const next = periods[i + 1];
          if (
            next.periodNumber === current.periodNumber + 1 &&
            current.courseId === next.courseId &&
            current.sectionId === next.sectionId
          ) {
            const key = `${date}-${current.periodNumber}-${current.courseId}-${
              current.sectionId || "null"
            }`;
            append[key] = {
              nextPeriodNumber: next.periodNumber,
              nextDayOfWeek: new Date(date)
                .toLocaleDateString("en-US", { weekday: "short" })
                .toUpperCase(),
              nextCourseId: next.courseId,
              nextSectionId: next.sectionId,
            };
          }
        }
      });
      console.log("Append Periods:", JSON.stringify(append, null, 2));
      setAppendPeriods(append);
    };

    if (Object.keys(timetable).length > 0) {
      identifyConsecutivePeriods();
    }
  }, [timetable]);

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

  const generateTimeSlots = () => {
    return [
      { periodNumber: 1, time: "9:00–10:00" },
      { periodNumber: 2, time: "10:00–11:00" },
      { periodNumber: 3, time: "11:00–12:00" },
      { periodNumber: 4, time: "12:00–1:00" },
      { periodNumber: 5, time: "1:30–2:30" },
      { periodNumber: 6, time: "2:30–3:30" },
      { periodNumber: 7, time: "3:30–4:30" },
      { periodNumber: 8, time: "4:30–5:30" },
    ];
  };

  const handleGenerate = async () => {
    setError(null);
    setSelectedCourse(null);
    setStudents([]);
    setNextPeriodStudents([]);
    setTimetable({});
    setSkippedStudents([]);
    setNextPeriodSkippedStudents([]);
    setAppendPeriods({});
    setIsAppendMode(false);

    if (!fromDate || !toDate) {
      setError("Please select both dates");
      toast.error("Please select both dates", { position: "top-right" });
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
      const res = await axios.get(
        `${API_BASE_URL}/api/staff/attendance/timetable`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          params: {
            startDate: fromDate,
            endDate: toDate,
          },
        }
      );
      console.log("Timetable Response:", res.data);
      if (!res.data.data?.timetable) {
        setError("No timetable data received for the selected dates.");
        toast.error("No timetable data received for the selected dates.", {
          position: "top-right",
        });
      } else {
        setTimetable(res.data.data.timetable);
        toast.success("Timetable generated successfully!", {
          position: "top-right",
        });
      }
    } catch (err) {
      console.error("API Error in handleGenerate:", err.response?.data || err);
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Error generating timetable: ${errorMessage}`);
      toast.error(`Error generating timetable: ${errorMessage}`, {
        position: "top-right",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCourseClick = async (courseId, sectionId, date, periodNumber) => {
    setError(null);
    setStudents([]);
    setNextPeriodStudents([]);
    setSelectedCourse(null);
    setBulkStatus("");
    setSkippedStudents([]);
    setNextPeriodSkippedStudents([]);
    setIsAppendMode(false);

    const safeSectionId =
      sectionId && !isNaN(parseInt(sectionId)) ? parseInt(sectionId) : null;

    try {
      const dayOfWeek = new Date(date)
        .toLocaleDateString("en-US", { weekday: "short" })
        .toUpperCase();

      console.log("Calling getStudentsForPeriod with:", {
        courseId,
        sectionId: safeSectionId,
        dayOfWeek,
        periodNumber,
        date,
      });

      const res = await axios.get(
        `${API_BASE_URL}/api/staff/attendance/students/${courseId}/${safeSectionId}/${dayOfWeek}/${periodNumber}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          params: { date },
        }
      );

      console.log("Students Response:", JSON.stringify(res.data, null, 2));

      if (!res.data.data) {
        setError("No student data received.");
        toast.error("No student data received.", { position: "top-right" });
        return;
      }

      const updatedStudents = res.data.data.map((student) => ({
        ...student,
        status: student.status || "",
      }));
      setStudents(updatedStudents);
      setSelectedCourse({
        courseId,
        courseCode: (timetable[date] || []).find((p) => p.courseId === courseId)
          ?.courseCode,
        sectionId: safeSectionId,
        date,
        periodNumber,
        dayOfWeek,
      });

      try {
        const skippedRes = await axios.get(
          `${API_BASE_URL}/api/staff/attendance/skipped/${courseId}/${safeSectionId}/${dayOfWeek}/${periodNumber}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            params: { date },
          }
        );
        console.log(
          "Skipped Students Response:",
          JSON.stringify(skippedRes.data, null, 2)
        );
        if (
          skippedRes.data.status === "success" &&
          Array.isArray(skippedRes.data.data)
        ) {
          setSkippedStudents(skippedRes.data.data);
          if (skippedRes.data.data.length > 0) {
            toast.warn(
              `Found ${skippedRes.data.data.length} skipped student(s) for period ${periodNumber}`,
              { position: "top-right", autoClose: 5000 }
            );
          }
        }
      } catch (skipErr) {
        console.error("Error fetching skipped students:", skipErr);
      }

      const key = `${date}-${periodNumber}-${courseId}-${
        safeSectionId || "null"
      }`;
      const appendData = appendPeriods[key];
      console.log(
        "Checking for append period with key:",
        key,
        "appendData:",
        appendData
      );
      if (appendData) {
        setIsAppendMode(true);
        try {
          const nextRes = await axios.get(
            `${API_BASE_URL}/api/staff/attendance/students/${appendData.nextCourseId}/${appendData.nextSectionId}/${appendData.nextDayOfWeek}/${appendData.nextPeriodNumber}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
              params: { date },
            }
          );
          console.log(
            "Next Period Students Response:",
            JSON.stringify(nextRes.data, null, 2)
          );
          if (
            nextRes.data.status === "success" &&
            Array.isArray(nextRes.data.data)
          ) {
            setNextPeriodStudents(
              nextRes.data.data.map((student) => ({
                ...student,
                status: student.status || "",
              }))
            );
            const nextSkippedRes = await axios.get(
              `${API_BASE_URL}/api/staff/attendance/skipped/${appendData.nextCourseId}/${appendData.nextSectionId}/${appendData.nextDayOfWeek}/${appendData.nextPeriodNumber}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                params: { date },
              }
            );
            console.log(
              "Next Period Skipped Students Response:",
              JSON.stringify(nextSkippedRes.data, null, 2)
            );
            if (
              nextSkippedRes.data.status === "success" &&
              Array.isArray(nextSkippedRes.data.data)
            ) {
              setNextPeriodSkippedStudents(nextSkippedRes.data.data);
              if (nextSkippedRes.data.data.length > 0) {
                toast.warn(
                  `Found ${nextSkippedRes.data.data.length} skipped student(s) for period ${appendData.nextPeriodNumber}`,
                  { position: "top-right", autoClose: 5000 }
                );
              }
            }
          } else {
            console.warn("No students found for next period:", appendData);
          }
        } catch (nextErr) {
          console.error("Error fetching next period students:", nextErr);
          setError(
            `Failed to load students for period ${
              appendData.nextPeriodNumber
            }: ${nextErr.response?.data?.message || nextErr.message}`
          );
          toast.error(
            `Failed to load students for period ${appendData.nextPeriodNumber}`,
            { position: "top-right" }
          );
        }
      } else {
        console.log("No consecutive period found for key:", key);
      }

      toast.success("Students loaded successfully!", { position: "top-right" });
    } catch (err) {
      console.error("Error in handleCourseClick:", err);
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Error fetching students: ${errorMessage}`);
      toast.error(`Error fetching students: ${errorMessage}`, {
        position: "top-right",
      });
    }
  };

  const handleAttendanceChange = (rollnumber, status) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.rollnumber === rollnumber ? { ...student, status } : student
      )
    );
    if (isAppendMode) {
      setNextPeriodStudents((prev) =>
        prev.map((student) =>
          student.rollnumber === rollnumber ? { ...student, status } : student
        )
      );
    }
  };

  const handleNextPeriodAttendanceChange = (rollnumber, status) => {
    setNextPeriodStudents((prev) =>
      prev.map((student) =>
        student.rollnumber === rollnumber ? { ...student, status } : student
      )
    );
  };

  const handleBulkStatusChange = (status) => {
    console.log("handleBulkStatusChange called with status:", status);
    setBulkStatus(status);
    if (status && status !== "") {
      setStudents((prev) =>
        prev.map((student) => {
          const isSkipped = skippedStudents.some(
            (skipped) => skipped.rollnumber === student.rollnumber
          );
          return isSkipped ? student : { ...student, status };
        })
      );
      setNextPeriodStudents((prev) =>
        prev.map((student) => {
          const isSkipped = nextPeriodSkippedStudents.some(
            (skipped) => skipped.rollnumber === student.rollnumber
          );
          return isSkipped ? student : { ...student, status };
        })
      );
      toast.success(
        `Non-skipped students marked as ${
          status === "P" ? "Present" : status === "A" ? "Absent" : "On Duty"
        }!`,
        { position: "top-right" }
      );
    }
    console.log("Bulk mode applied");
  };

  const handleSave = async () => {
    console.log("handleSave called with state:", {
      studentsCount: students.length,
      selectedCourse,
      isAppendMode,
      appendPeriodsKeys: Object.keys(appendPeriods),
      nextPeriodStudentsCount: nextPeriodStudents.length,
      skippedStudentsCount: skippedStudents.length,
      nextPeriodSkippedStudentsCount: nextPeriodSkippedStudents.length,
    });

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

    const validStatuses = ["P", "A", "OD"];
    const invalidStudents = students.filter(
      (student) =>
        !skippedStudents.some(
          (skipped) => skipped.rollnumber === student.rollnumber
        ) && !validStatuses.includes(student.status)
    );
    if (invalidStudents.length > 0) {
      console.log("Invalid students for first period:", invalidStudents);
      setError(
        "All non-skipped students must have a valid attendance status (Present, Absent, or On Duty)."
      );
      toast.error(
        "All non-skipped students must have a valid attendance status.",
        {
          position: "top-right",
        }
      );
      return;
    }

    const key = `${selectedCourse.date}-${selectedCourse.periodNumber}-${
      selectedCourse.courseId
    }-${selectedCourse.sectionId || "null"}`;
    const appendData = appendPeriods[key];
    console.log("appendData for key", key, ":", appendData);

    if (isAppendMode && appendData && nextPeriodStudents.length > 0) {
      const invalidNextStudents = nextPeriodStudents.filter(
        (student) =>
          !nextPeriodSkippedStudents.some(
            (skipped) => skipped.rollnumber === student.rollnumber
          ) && !validStatuses.includes(student.status)
      );
      if (invalidNextStudents.length > 0) {
        console.log("Invalid students for next period:", invalidNextStudents);
        setError(
          "All non-skipped students in the next period must have a valid attendance status."
        );
        toast.error(
          "All non-skipped students in the next period must have a valid attendance status.",
          {
            position: "top-right",
          }
        );
        return;
      }
    } else if (
      isAppendMode &&
      (!appendData || nextPeriodStudents.length === 0)
    ) {
      console.warn(
        "Append mode is active but no appendData or nextPeriodStudents:",
        {
          isAppendMode,
          appendData,
          nextPeriodStudentsCount: nextPeriodStudents.length,
        }
      );
      setError("Cannot append: No consecutive period or students found.");
      toast.error("Cannot append: No consecutive period or students found.", {
        position: "top-right",
      });
      setIsAppendMode(false);
      // Proceed with saving only the first period
    }

    setSaving(true);
    try {
      const payload = students
        .filter(
          (student) =>
            !skippedStudents.some(
              (skipped) => skipped.rollnumber === student.rollnumber
            )
        )
        .map((student) => ({
          rollnumber: student.rollnumber,
          status: student.status,
        }));

      const requests = [];
      requests.push({
        period: `P${selectedCourse.periodNumber}`,
        promise: axios.post(
          `${API_BASE_URL}/api/staff/attendance/mark/${selectedCourse.courseId}/${selectedCourse.sectionId}/${selectedCourse.dayOfWeek}/${selectedCourse.periodNumber}`,
          { date: selectedCourse.date, attendances: payload },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        ),
      });

      let nextPayload;
      if (isAppendMode && appendData && nextPeriodStudents.length > 0) {
        nextPayload = nextPeriodStudents
          .filter(
            (student) =>
              !nextPeriodSkippedStudents.some(
                (skipped) => skipped.rollnumber === student.rollnumber
              )
          )
          .map((student) => ({
            rollnumber: student.rollnumber,
            status: student.status,
          }));
        console.log("Adding request for appended period:", {
          period: `P${appendData.nextPeriodNumber}`,
          nextPayload,
        });
        requests.push({
          period: `P${appendData.nextPeriodNumber}`,
          promise: axios.post(
            `${API_BASE_URL}/api/staff/attendance/mark/${appendData.nextCourseId}/${appendData.nextSectionId}/${appendData.nextDayOfWeek}/${appendData.nextPeriodNumber}`,
            { date: selectedCourse.date, attendances: nextPayload },
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          ),
        });
      } else {
        console.log("Not adding appended period request:", {
          isAppendMode,
          hasAppendData: !!appendData,
          nextPeriodStudentsCount: nextPeriodStudents.length,
        });
      }

      console.log("Sending attendance payloads:", {
        firstPeriod: {
          courseId: selectedCourse.courseId,
          sectionId: selectedCourse.sectionId,
          dayOfWeek: selectedCourse.dayOfWeek,
          periodNumber: selectedCourse.periodNumber,
          date: selectedCourse.date,
          attendances: payload,
        },
        nextPeriod:
          isAppendMode && appendData && nextPeriodStudents.length > 0
            ? {
                courseId: appendData.nextCourseId,
                sectionId: appendData.nextSectionId,
                dayOfWeek: appendData.nextDayOfWeek,
                periodNumber: appendData.nextPeriodNumber,
                date: selectedCourse.date,
                attendances: nextPayload,
              }
            : null,
      });

      const responses = await Promise.allSettled(
        requests.map((req) => req.promise)
      );
      const results = responses.map((result, index) => ({
        period: requests[index].period,
        status: result.status,
        data: result.status === "fulfilled" ? result.value.data : null,
        error: result.status === "rejected" ? result.reason : null,
      }));

      console.log(
        "Save Attendance Responses:",
        JSON.stringify(results, null, 2)
      );

      const errors = results.filter((r) => r.status === "rejected");
      if (errors.length > 0) {
        const errorMessages = errors
          .map(
            (err) =>
              `Failed to save attendance for ${err.period}: ${
                err.error.response?.data?.message || err.error.message
              }`
          )
          .join("; ");
        throw new Error(errorMessages);
      }

      const processedPeriods = results.map((r) => r.period).join(" and ");
      toast.success(`Attendance saved successfully for ${processedPeriods}`, {
        position: "top-right",
        autoClose: 3000,
      });
      setError(null);
      setStudents((prev) =>
        prev.map((student) => ({ ...student, status: "" }))
      );
      setNextPeriodStudents((prev) =>
        prev.map((student) => ({ ...student, status: "" }))
      );
      setBulkStatus("");
      setIsAppendMode(false);

      results.forEach((result, index) => {
        if (result.data?.data?.skippedStudents?.length > 0) {
          const adminSkipped = result.data.data.skippedStudents.filter(
            (s) => s.reason === "Attendance marked by admin"
          );
          if (adminSkipped.length > 0) {
            toast.warn(
              `Skipped ${adminSkipped.length} student(s) marked by admin for ${result.period} on ${selectedCourse.date}`,
              { position: "top-right", autoClose: 5000 }
            );
          }
          if (index === 0) {
            setSkippedStudents(result.data.data.skippedStudents);
          } else {
            setNextPeriodSkippedStudents(result.data.data.skippedStudents);
          }
        }
      });
    } catch (err) {
      console.error("Error in handleSave:", err);
      const errorMessage = err.message || "Failed to save attendance";
      setError(`Error saving attendance: ${errorMessage}`);
      toast.error(`Error saving attendance: ${errorMessage}`, {
        position: "top-right",
      });
    } finally {
      setSaving(false);
    }
  };

  const attendanceSummary = students.reduce(
    (acc, student) => {
      if (student.status === "P") acc.present += 1;
      else if (student.status === "A") acc.absent += 1;
      else if (student.status === "OD") acc.onDuty += 1;
      return acc;
    },
    { present: 0, absent: 0, onDuty: 0 }
  );

  const nextPeriodAttendanceSummary = nextPeriodStudents.reduce(
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
    <div className="p-6 max-w-7xl mx-auto bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-900">
        Attendance Management
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
              "View Timetable"
            )}
          </button>
        </div>
      </div>
      {hasDatesSelected && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-blue-800">
            Staff Timetable
            {userProfile && (
              <span className="text-base font-normal ml-2 text-blue-600">
                ({userProfile.username} - {userProfile.staffId})
              </span>
            )}
          </h2>

          {Object.keys(timetable).length === 0 && !loading && (
            <div className="text-center text-blue-500 italic">
              No timetable data available for the selected dates.
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
                          if (!period) {
                            return (
                              <td
                                key={`${date}-${periodNumber}`}
                                className="border border-blue-200 p-3 text-center bg-blue-100"
                              >
                                <span className="text-sm text-blue-400 italic">
                                  No period
                                </span>
                              </td>
                            );
                          }

                          const prevPeriodNum = periodNumber - 1;
                          const prevPeriod = periods[prevPeriodNum];
                          const isContinuation =
                            prevPeriod &&
                            prevPeriod.courseId === period.courseId &&
                            (prevPeriod.sectionId || null) ===
                              (period.sectionId || null);

                          if (isContinuation) {
                            return (
                              <td
                                key={`${date}-${periodNumber}`}
                                className="border border-blue-200 p-3 text-center bg-blue-50"
                              >
                                <span className="text-sm text-gray-500 italic">
                                  Continued from P{prevPeriodNum}
                                </span>
                              </td>
                            );
                          }

                          const nextPeriodNum = periodNumber + 1;
                          const nextPeriod = periods[nextPeriodNum];
                          const canAppend =
                            nextPeriod &&
                            nextPeriod.courseId === period.courseId &&
                            (nextPeriod.sectionId || null) ===
                              (period.sectionId || null);
                          const key = `${date}-${periodNumber}-${
                            period.courseId
                          }-${period.sectionId || "null"}`;

                          return (
                            <td
                              key={`${date}-${periodNumber}`}
                              className="border border-blue-200 p-3 text-center bg-blue-50"
                            >
                              <button
                                onClick={() =>
                                  handleCourseClick(
                                    period.courseId,
                                    period.sectionId,
                                    date,
                                    period.periodNumber
                                  )
                                }
                                className="text-md font-semibold text-blue-700 hover:text-blue-900 hover:underline transition-colors duration-150 py-1 px-2 rounded"
                              >
                                {period.courseTitle || period.courseCode}
                                {canAppend && (
                                  <span className="text-xs font-normal ml-1 text-green-600">
                                    (Spans P{nextPeriodNum})
                                  </span>
                                )}
                                <br />
                                <span className="text-xs font-normal">
                                  Sec: {period.sectionName || "N/A"}
                                </span>
                              </button>
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
              <p>
                Period: {selectedCourse.periodNumber}
                {isAppendMode &&
                  ` - ${
                    appendPeriods[
                      `${selectedCourse.date}-${selectedCourse.periodNumber}-${
                        selectedCourse.courseId
                      }-${selectedCourse.sectionId || "null"}`
                    ]?.nextPeriodNumber
                  }`}
              </p>
              <p>
                Section:{" "}
                {(timetable[selectedCourse.date] || []).find(
                  (p) =>
                    p.courseId === selectedCourse.courseId &&
                    p.sectionId === selectedCourse.sectionId
                )?.sectionName || "N/A"}
              </p>
              {isAppendMode && (
                <p className="text-green-600 font-semibold">
                  Marking for consecutive periods
                </p>
              )}
            </div>
          </div>

          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <select
                value={bulkStatus}
                onChange={(e) => handleBulkStatusChange(e.target.value)}
                className="border-2 border-blue-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              >
                <option value="">Select Status for All</option>
                <option value="P">Mark as Present</option>
                <option value="A">Mark as Absent</option>
                <option value="OD">Mark as On Duty</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-blue-800">
              Period {selectedCourse.periodNumber}
              {isAppendMode &&
                ` - ${
                  appendPeriods[
                    `${selectedCourse.date}-${selectedCourse.periodNumber}-${
                      selectedCourse.courseId
                    }-${selectedCourse.sectionId || "null"}`
                  ]?.nextPeriodNumber
                }`}
            </h3>
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
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.length > 0 ? (
                  students.map((student, idx) => {
                    const isSkipped = skippedStudents.some(
                      (skipped) => skipped.rollnumber === student.rollnumber
                    );
                    const isNextSkipped =
                      isAppendMode &&
                      nextPeriodSkippedStudents.some(
                        (skipped) => skipped.rollnumber === student.rollnumber
                      );
                    return (
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
                        <td className="border border-blue-200 p-3 text-center">
                          {isSkipped || isNextSkipped ? (
                            <span className="text-blue-800 font-semibold">
                              {student.status === "P"
                                ? "Present"
                                : student.status === "A"
                                ? "Absent"
                                : "On Duty"}
                              {isSkipped && isNextSkipped
                                ? " (Both Periods Skipped)"
                                : isSkipped
                                ? " (P" +
                                  selectedCourse.periodNumber +
                                  " Skipped)"
                                : " (P" +
                                  appendPeriods[
                                    `${selectedCourse.date}-${
                                      selectedCourse.periodNumber
                                    }-${selectedCourse.courseId}-${
                                      selectedCourse.sectionId || "null"
                                    }`
                                  ]?.nextPeriodNumber +
                                  " Skipped)"}
                            </span>
                          ) : (
                            <select
                              value={student.status}
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
                              <option value="P">Present</option>
                              <option value="A">Absent</option>
                              <option value="OD">On Duty</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="3"
                      className="border border-blue-200 p-5 text-center text-blue-500"
                    >
                      No students found for this course section.
                    </td>
                  </tr>
                )}
              </tbody>
              {students.length > 0 && (
                <tfoot>
                  <tr className="bg-blue-100">
                    <td
                      colSpan="3"
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

          {(skippedStudents.length > 0 ||
            (isAppendMode && nextPeriodSkippedStudents.length > 0)) && (
            <div className="mt-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">
                Skipped Students for Period {selectedCourse.periodNumber}
                {isAppendMode &&
                  ` - ${
                    appendPeriods[
                      `${selectedCourse.date}-${selectedCourse.periodNumber}-${
                        selectedCourse.courseId
                      }-${selectedCourse.sectionId || "null"}`
                    ]?.nextPeriodNumber
                  }`}{" "}
                ({skippedStudents.length + nextPeriodSkippedStudents.length})
              </h3>
              <ul className="list-disc pl-5">
                {skippedStudents.map((student, idx) => (
                  <li key={`first-${idx}`}>
                    Roll No: {student.rollnumber} - {student.reason} (P
                    {selectedCourse.periodNumber})
                  </li>
                ))}
                {isAppendMode &&
                  nextPeriodSkippedStudents.map((student, idx) => (
                    <li key={`next-${idx}`}>
                      Roll No: {student.rollnumber} - {student.reason} (P
                      {
                        appendPeriods[
                          `${selectedCourse.date}-${
                            selectedCourse.periodNumber
                          }-${selectedCourse.courseId}-${
                            selectedCourse.sectionId || "null"
                          }`
                        ]?.nextPeriodNumber
                      }
                      )
                    </li>
                  ))}
              </ul>
            </div>
          )}

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
                `Save Attendance${isAppendMode ? " (with Next Period)" : ""}`
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
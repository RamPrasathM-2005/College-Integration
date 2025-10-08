import pool from "../db.js";

// Helper to generate dates between two dates (inclusive)
function generateDates(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]); // YYYY-MM-DD
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Helper to get dayOfWeek (1 = Monday, 7 = Sunday)
function getDayOfWeek(dateStr) {
  const day = new Date(dateStr).getDay(); // 0 = Sunday
  return day === 0 ? 7 : day; // Convert Sunday to 7
}

// Fetch all degrees
export async function getDegrees(req, res, next) {
  try {
    const [degrees] = await pool.query(
      `SELECT DISTINCT degree FROM Batch ORDER BY degree`
    );
    res.json({ status: "success", data: degrees });
  } catch (err) {
    console.error("Error in getDegrees:", err);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch degrees" });
  }
}

// Fetch all branches
export async function getBranches(req, res, next) {
  try {
    const [branches] = await pool.query(
      `SELECT DISTINCT branch FROM Batch ORDER BY branch`
    );
    res.json({ status: "success", data: branches });
  } catch (err) {
    console.error("Error in getBranches:", err);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch branches" });
  }
}

// Fetch all departments
export async function getDepartments(req, res, next) {
  try {
    const [departments] = await pool.query(
      `SELECT Deptid, Deptacronym, Deptname FROM department ORDER BY Deptacronym`
    );
    res.json({ status: "success", data: departments });
  } catch (err) {
    console.error("Error in getDepartments:", err);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch departments" });
  }
}

// Fetch all semesters
export async function getSemesters(req, res, next) {
  try {
    const [semesters] = await pool.query(
      `SELECT semesterId, semesterNumber FROM Semester ORDER BY semesterNumber`
    );
    res.json({ status: "success", data: semesters });
  } catch (err) {
    console.error("Error in getSemesters:", err);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch semesters" });
  }
}

// Fetch batches
export async function getBatches(req, res, next) {
  try {
    const [batches] = await pool.query(
      `
      SELECT 
        b.batchId, 
        b.batch, 
        b.branch, 
        b.degree, 
        b.batchYears 
      FROM Batch b
      ORDER BY b.batchYears DESC, b.branch
      `
    );
    res.json({ status: "success", data: batches });
  } catch (err) {
    console.error("Error in getBatches:", err);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch batches" });
  }
}

// Fetch semesters by batch and branch
export async function getSemestersByBatchBranch(req, res, next) {
  try {
    const { degree, batch, branch } = req.query;

    if (!degree || !batch || !branch) {
      return res.status(400).json({
        status: "error",
        message: "Degree, batch, and branch are required",
      });
    }

    const [semesters] = await pool.query(
      `
      SELECT 
        s.semesterId, 
        s.semesterNumber, 
        b.batchYears
      FROM Semester s
      JOIN Batch b ON s.batchId = b.batchId
      WHERE b.degree = ? AND b.batch = ? AND b.branch = ?
      ORDER BY s.semesterNumber
      `,
      [degree, batch, branch]
    );

    res.json({ status: "success", data: semesters });
  } catch (err) {
    console.error("Error in getSemestersByBatchBranch:", err);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch semesters" });
  }
}

// Fetch timetable for staff
export async function getTimetable(req, res, next) {
  try {
    const { startDate, endDate, degree, batch, branch, Deptid, semesterId } =
      req.query;
    const staffId = req.user.staffId;

    if (!staffId) {
      return res
        .status(400)
        .json({ status: "error", message: "Staff ID not found" });
    }
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ status: "error", message: "Start and end dates required" });
    }
    if (!degree || !batch || !branch || !Deptid || !semesterId) {
      return res.status(400).json({
        status: "error",
        message: "Degree, batch, branch, Deptid, and semesterId are required",
      });
    }

    const [periods] = await pool.query(
      `
      SELECT 
        t.timetableId, 
        t.courseCode, 
        COALESCE(t.sectionId, NULL) as sectionId, 
        t.dayOfWeek, 
        t.periodNumber, 
        c.courseTitle, 
        s.sectionName, 
        t.semesterId, 
        t.Deptid,
        d.Deptacronym as departmentCode,
        sc.staffId
      FROM Timetable t
      JOIN Course c ON t.courseCode = c.courseCode
      JOIN StaffCourse sc ON t.courseCode = sc.courseCode AND (t.sectionId = sc.sectionId OR t.sectionId IS NULL)
      LEFT JOIN Section s ON t.sectionId = s.sectionId
      JOIN department d ON t.Deptid = d.Deptid
      JOIN users u ON sc.staffId = u.staffId
      JOIN Semester sm ON t.semesterId = sm.semesterId
      JOIN Batch b ON sm.batchId = b.batchId
      WHERE sc.staffId = ? 
        AND u.role = 'Staff'
        AND t.isActive = 'YES'
        AND c.isActive = 'YES'
        AND sc.Deptid = t.Deptid
        AND b.degree = ?
        AND b.batch = ?
        AND b.branch = ?
        AND t.Deptid = ?
        AND t.semesterId = ?
      ORDER BY FIELD(t.dayOfWeek, 'MON','TUE','WED','THU','FRI','SAT'), t.periodNumber;
      `,
      [staffId, degree, batch, branch, Deptid, semesterId]
    );

    console.log("Fetched Timetable for Staff ID:", staffId);
    console.log("Filters:", {
      startDate,
      endDate,
      degree,
      batch,
      branch,
      Deptid,
      semesterId,
    });
    console.log("Periods:", JSON.stringify(periods, null, 2));

    const dates = generateDates(startDate, endDate);
    const dayMap = {
      1: "MON",
      2: "TUE",
      3: "WED",
      4: "THU",
      5: "FRI",
      6: "SAT",
    };

    const timetable = {};
    dates.forEach((date) => {
      const dayOfWeekNum = getDayOfWeek(date);
      const dayOfWeekStr = dayMap[dayOfWeekNum];
      let periodsForDay = [];
      if (dayOfWeekStr) {
        periodsForDay = periods
          .filter((row) => row.dayOfWeek === dayOfWeekStr)
          .map((period) => ({
            ...period,
            sectionId: period.sectionId ? parseInt(period.sectionId) : null,
            isStaffCourse: true,
          }));
      }
      timetable[date] = periodsForDay;
    });

    console.log("Structured Timetable:", JSON.stringify(timetable, null, 2));
    res.status(200).json({ status: "success", data: { timetable } });
  } catch (err) {
    console.error("Error in getTimetable:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Failed to fetch timetable",
    });
  }
}

// Fetch students for a specific period
export async function getStudentsForPeriod(req, res, next) {
  try {
    const { courseCode, sectionId, dayOfWeek, periodNumber } = req.params;
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const staffId = req.user.staffId;
    const deptId = req.user.Deptid || null;

    console.log("Input Parameters:", {
      courseCode,
      sectionId,
      dayOfWeek,
      periodNumber,
      date,
      staffId,
      deptId,
    });

    if (!courseCode || !dayOfWeek || !periodNumber) {
      return res.status(400).json({
        status: "error",
        message:
          "Missing required parameters: courseCode, dayOfWeek, periodNumber",
      });
    }

    const safeSectionId =
      sectionId && !isNaN(parseInt(sectionId)) ? parseInt(sectionId) : null;

    // Check staff assignment to course (any section if safeSectionId null, or specific)
    const assignmentQuery = safeSectionId
      ? `
        SELECT COUNT(*) as count
        FROM StaffCourse 
        WHERE staffId = ? AND courseCode = ? AND sectionId = ?
        `
      : `
        SELECT COUNT(*) as count
        FROM StaffCourse 
        WHERE staffId = ? AND courseCode = ?
        `;
    const assignmentParams = safeSectionId
      ? [staffId, courseCode, safeSectionId]
      : [staffId, courseCode];
    const [courseAssignment] = await pool.query(
      assignmentQuery,
      assignmentParams
    );

    if (courseAssignment[0].count === 0) {
      return res.status(403).json({
        status: "error",
        message:
          "You are not authorized to access attendance for this course section",
      });
    }

    const baseQuery = `
      SELECT 
        sd.regno AS rollnumber, 
        u.username AS name, 
        COALESCE(pa.status, '') AS status,
        sc.sectionId
      FROM StudentCourse sc
      JOIN student_details sd ON sc.regno = sd.regno
      JOIN users u ON sd.Userid = u.Userid
      JOIN Course c ON sc.courseCode = c.courseCode
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch bat ON sem.batchId = bat.batchId
      LEFT JOIN PeriodAttendance pa ON sc.regno = pa.regno 
        AND pa.courseCode = sc.courseCode 
        AND pa.sectionId = sc.sectionId
        AND pa.dayOfWeek = ? 
        AND pa.periodNumber = ? 
        AND pa.attendanceDate = ?
      WHERE sc.courseCode = ? 
        AND sc.sectionId IN (SELECT sectionId FROM StaffCourse WHERE staffId = ? AND courseCode = ?)
        ${safeSectionId ? "AND sc.sectionId = ?" : ""}
        AND sd.batch = CAST(bat.batch AS UNSIGNED)
        ${deptId ? "AND sd.Deptid = ?" : ""}
      ORDER BY sd.regno
    `;

    const params = [
      dayOfWeek,
      periodNumber,
      date,
      courseCode,
      staffId,
      courseCode,
    ];
    if (safeSectionId) params.push(safeSectionId);
    if (deptId) params.push(deptId);

    const [students] = await pool.query(baseQuery, params);

    console.log("Fetched Students for Period:", {
      courseCode,
      sectionId: safeSectionId,
      date,
      dayOfWeek,
      periodNumber,
      totalStudents: students.length,
    });

    res.json({ status: "success", data: students || [] });
  } catch (err) {
    console.error("Error in getStudentsForPeriod:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      status: "error",
      message: err.message || "Internal server error",
    });
  }
}

// Fetch skipped students for a specific period
export async function getSkippedStudents(req, res, next) {
  try {
    const { courseCode, sectionId, dayOfWeek, periodNumber } = req.params;
    const { date } = req.query;
    const staffId = req.user.staffId;

    console.log("Input Parameters for getSkippedStudents:", {
      courseCode,
      sectionId,
      dayOfWeek,
      periodNumber,
      date,
      staffId,
    });

    if (!courseCode || !dayOfWeek || !periodNumber || !date) {
      return res.status(400).json({
        status: "error",
        message:
          "Missing required parameters: courseCode, dayOfWeek, periodNumber, or date",
      });
    }

    const safeSectionId =
      sectionId && !isNaN(parseInt(sectionId)) ? parseInt(sectionId) : null;

    // Check staff assignment (similar to above)
    const assignmentQuery = safeSectionId
      ? `
        SELECT COUNT(*) as count
        FROM StaffCourse 
        WHERE staffId = ? AND courseCode = ? AND sectionId = ?
        `
      : `
        SELECT COUNT(*) as count
        FROM StaffCourse 
        WHERE staffId = ? AND courseCode = ?
        `;
    const assignmentParams = safeSectionId
      ? [staffId, courseCode, safeSectionId]
      : [staffId, courseCode];
    const [courseAssignment] = await pool.query(
      assignmentQuery,
      assignmentParams
    );

    if (courseAssignment[0].count === 0) {
      return res.status(403).json({
        status: "error",
        message:
          "You are not authorized to access attendance for this course section",
      });
    }

    const baseQuery = `
      SELECT 
        pa.regno AS rollnumber, 
        pa.status,
        u.username AS name,
        'Attendance marked by admin' AS reason
      FROM PeriodAttendance pa
      JOIN student_details sd ON pa.regno = sd.regno
      JOIN users u ON sd.Userid = u.Userid
      JOIN Course c ON pa.courseCode = c.courseCode
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch bat ON sem.batchId = bat.batchId
      WHERE pa.courseCode = ?
        AND pa.sectionId IN (SELECT sectionId FROM StaffCourse WHERE staffId = ? AND courseCode = ?)
        ${safeSectionId ? "AND pa.sectionId = ?" : ""}
        AND pa.dayOfWeek = ?
        AND pa.periodNumber = ?
        AND pa.attendanceDate = ?
        AND pa.updatedBy = 'admin'
        AND sd.batch = CAST(bat.batch AS UNSIGNED)
      ORDER BY pa.regno
    `;

    const params = [courseCode, staffId, courseCode];
    if (safeSectionId) params.push(safeSectionId);
    params.push(dayOfWeek, periodNumber, date);

    const [skippedStudents] = await pool.query(baseQuery, params);

    console.log("Fetched Skipped Students:", {
      courseCode,
      sectionId: safeSectionId,
      dayOfWeek,
      periodNumber,
      date,
      totalSkipped: skippedStudents.length,
    });

    res.json({ status: "success", data: skippedStudents || [] });
  } catch (err) {
    console.error("Error in getSkippedStudents:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      status: "error",
      message: err.message || "Failed to fetch skipped students",
    });
  }
}

// Mark attendance for a period
export async function markAttendance(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const { courseCode, sectionId, dayOfWeek, periodNumber } = req.params;
    const { date, attendances } = req.body;
    const staffId = req.user.staffId;
    const deptId = req.user.Deptid || 1;

    console.log("markAttendance Input:", {
      courseCode,
      sectionId,
      dayOfWeek,
      periodNumber,
      date,
      staffId,
      deptId,
      attendances,
    });

    let safeSectionId =
      sectionId && !isNaN(parseInt(sectionId)) ? parseInt(sectionId) : null;

    if (!Array.isArray(attendances) || attendances.length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "No attendance data provided" });
    }

    if (!date) {
      return res
        .status(400)
        .json({ status: "error", message: "Date is required" });
    }

    if (!courseCode || !dayOfWeek || !periodNumber) {
      return res.status(400).json({
        status: "error",
        message:
          "Missing required parameters: courseCode, dayOfWeek, periodNumber",
      });
    }

    // Check staff assignment to course (any section if safeSectionId null, or specific)
    const assignmentQuery = safeSectionId
      ? `
        SELECT COUNT(*) as count
        FROM StaffCourse 
        WHERE staffId = ? AND courseCode = ? AND sectionId = ?
        `
      : `
        SELECT COUNT(*) as count
        FROM StaffCourse 
        WHERE staffId = ? AND courseCode = ?
        `;
    const assignmentParams = safeSectionId
      ? [staffId, courseCode, safeSectionId]
      : [staffId, courseCode];
    const [courseAssignment] = await connection.query(
      assignmentQuery,
      assignmentParams
    );

    if (courseAssignment[0].count === 0) {
      return res.status(403).json({
        status: "error",
        message: `You are not authorized to mark attendance for course ${courseCode}${
          safeSectionId ? ` section ${safeSectionId}` : ""
        }`,
      });
    }

    const [timetableCheck] = await connection.query(
      `
      SELECT COUNT(*) as count
      FROM Timetable
      WHERE courseCode = ? AND dayOfWeek = ? AND periodNumber = ?
      `,
      [courseCode, dayOfWeek, periodNumber]
    );

    if (timetableCheck[0].count === 0) {
      return res.status(400).json({
        status: "error",
        message: `Invalid period: courseCode ${courseCode}, dayOfWeek ${dayOfWeek}, periodNumber ${periodNumber} not found in Timetable`,
      });
    }

    await connection.beginTransaction();

    const [courseInfo] = await connection.query(
      `SELECT c.semesterId, s.semesterNumber 
       FROM Course c 
       JOIN Semester s ON c.semesterId = s.semesterId
       WHERE c.courseCode = ?`,
      [courseCode]
    );

    if (!courseInfo[0]) {
      throw new Error(
        `Course ${courseCode} not found or invalid semester information`
      );
    }
    const semesterNumber = courseInfo[0].semesterNumber;

    const processedStudents = [];
    const skippedStudents = [];

    for (const att of attendances) {
      if (!att.rollnumber || !["P", "A", "OD"].includes(att.status)) {
        console.log("Skipping invalid attendance record:", att);
        skippedStudents.push({
          rollnumber: att.rollnumber || "unknown",
          reason: "Invalid rollnumber or status",
        });
        continue;
      }

      // Fetch student's sectionId from StudentCourse (required, even if param null)
      const [studentCourse] = await connection.query(
        `SELECT sectionId, COUNT(*) as count 
         FROM StudentCourse 
         WHERE regno = ? AND courseCode = ?
         GROUP BY sectionId
         HAVING count = 1`, // Ensure enrolled in exactly one section for course
        [att.rollnumber, courseCode]
      );

      if (studentCourse.length === 0 || studentCourse[0].count !== 1) {
        console.log("Student not enrolled or multi-section:", att.rollnumber);
        skippedStudents.push({
          rollnumber: att.rollnumber,
          reason: `Not enrolled in course ${courseCode} (or enrolled in multiple sections)`,
        });
        continue;
      }

      const thisStudentSectionId = parseInt(studentCourse[0].sectionId);

      // If param sectionId specific, ensure matches student's
      if (safeSectionId && safeSectionId !== thisStudentSectionId) {
        skippedStudents.push({
          rollnumber: att.rollnumber,
          reason: `Student in section ${thisStudentSectionId}, but period is for section ${safeSectionId}`,
        });
        continue;
      }

      // Check if student's section is assigned to this staff
      const [staffSectionCheck] = await connection.query(
        `SELECT COUNT(*) as count 
         FROM StaffCourse 
         WHERE staffId = ? AND courseCode = ? AND sectionId = ?`,
        [staffId, courseCode, thisStudentSectionId]
      );

      if (staffSectionCheck[0].count === 0) {
        skippedStudents.push({
          rollnumber: att.rollnumber,
          reason: `Student's section ${thisStudentSectionId} not assigned to you`,
        });
        continue;
      }

      const [existingRecord] = await connection.query(
        `
        SELECT updatedBy 
        FROM PeriodAttendance 
        WHERE regno = ? AND courseCode = ? AND sectionId = ? 
          AND attendanceDate = ? AND periodNumber = ?
        `,
        [att.rollnumber, courseCode, thisStudentSectionId, date, periodNumber]
      );

      if (existingRecord[0]?.updatedBy === "admin") {
        console.log("Skipping admin-marked record:", att.rollnumber);
        skippedStudents.push({
          rollnumber: att.rollnumber,
          reason: "Attendance marked by admin",
        });
        continue;
      }

      const statusToSave = att.status;
      await connection.query(
        `
        INSERT INTO PeriodAttendance 
        (regno, staffId, courseCode, sectionId, semesterNumber, dayOfWeek, periodNumber, attendanceDate, status, Deptid, updatedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          status = ?,
          updatedBy = ?
        `,
        [
          att.rollnumber,
          staffId,
          courseCode,
          thisStudentSectionId,
          semesterNumber,
          dayOfWeek,
          periodNumber,
          date,
          statusToSave,
          deptId,
          "staff",
          statusToSave,
          "staff",
        ]
      );

      processedStudents.push({
        rollnumber: att.rollnumber,
        status: statusToSave,
        sectionId: thisStudentSectionId, // Optional: log section used
      });
    }

    await connection.commit();

    console.log("Attendance Marked Successfully:", {
      courseCode,
      sectionId: safeSectionId,
      date,
      periodNumber,
      processedStudents,
      skippedStudents,
    });

    res.json({
      status: "success",
      message: `Attendance marked for ${processedStudents.length} students, skipped ${skippedStudents.length} students`,
      data: { processedStudents, skippedStudents },
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error in markAttendance:", {
      message: err.message,
      stack: err.stack,
      courseCode: req.params.courseCode,
      sectionId: req.params.sectionId,
      periodNumber: req.params.periodNumber,
      date: req.body.date,
    });
    res.status(500).json({
      status: "error",
      message:
        err.message ||
        `Failed to mark attendance for course ${req.params.courseCode} period ${req.params.periodNumber}`,
    });
  } finally {
    connection.release();
  }
}

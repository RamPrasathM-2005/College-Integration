import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

export const getNptelCourses = catchAsync(async (req, res) => {
  const { semesterId } = req.query;
  if (!semesterId) {
    return res.status(400).json({ status: "failure", message: "semesterId is required" });
  }

  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }

  const connection = await pool.getConnection();
  try {
    // Get regno from Userid
    const [studentRows] = await connection.execute(
      `SELECT sd.regno FROM student_details sd WHERE sd.Userid = ?`,
      [req.user.Userid]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ status: "failure", message: "Student not found" });
    }
    const regno = studentRows[0].regno;

    // Fetch available NPTEL courses
    const [courses] = await connection.execute(`
      SELECT nc.nptelCourseId, nc.courseTitle, nc.courseCode, nc.type, nc.credits
      FROM NptelCourse nc
      WHERE nc.semesterId = ? AND nc.isActive = 'YES'
      ORDER BY nc.courseTitle
    `, [semesterId]);

    // Fetch enrolled ones for this student
    const enrolledIds = new Set();
    if (courses.length > 0) {
      const ids = courses.map(c => c.nptelCourseId);
      const placeholders = ids.map(() => '?').join(',');
      const [enrolled] = await connection.execute(`
        SELECT nptelCourseId 
        FROM StudentNptelEnrollment 
        WHERE regno = ? AND nptelCourseId IN (${placeholders})
      `, [regno, ...ids]);

      enrolled.forEach(row => enrolledIds.add(row.nptelCourseId));
    }

    const enriched = courses.map(c => ({
      ...c,
      isEnrolled: enrolledIds.has(c.nptelCourseId)
    }));

    res.status(200).json({
      status: "success",
      data: enriched
    });
  } catch (err) {
    console.error("Error in getNptelCourses:", err);
    res.status(500).json({ status: "failure", message: "Server error" });
  } finally {
    connection.release();
  }
});

export const enrollNptel = catchAsync(async (req, res) => {
  const { semesterId, nptelCourseIds } = req.body;

  if (!semesterId || !nptelCourseIds || !Array.isArray(nptelCourseIds) || nptelCourseIds.length === 0) {
    return res.status(400).json({ 
      status: "failure", 
      message: "semesterId and non-empty nptelCourseIds array are required" 
    });
  }

  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Fetch regno
    const [studentRows] = await connection.execute(
      `SELECT sd.regno FROM student_details sd WHERE sd.Userid = ?`,
      [req.user.Userid]
    );

    if (studentRows.length === 0) {
      throw new Error("Student not found");
    }
    const regno = studentRows[0].regno;

    // Validate semester
    const [semCheck] = await connection.execute(
      `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
      [semesterId]
    );
    if (semCheck.length === 0) {
      throw new Error("Invalid or inactive semester");
    }

    // Validate courses exist in this semester
    const placeholders = nptelCourseIds.map(() => '?').join(',');
    const [validCourses] = await connection.execute(
      `SELECT nptelCourseId FROM NptelCourse 
       WHERE nptelCourseId IN (${placeholders}) 
         AND semesterId = ? AND isActive = 'YES'`,
      [...nptelCourseIds, semesterId]
    );

    if (validCourses.length !== nptelCourseIds.length) {
      throw new Error("One or more courses are invalid or not available");
    }

    // Insert each enrollment individually with INSERT IGNORE
    let enrolledCount = 0;
    for (const courseId of nptelCourseIds) {
      const [result] = await connection.execute(
        `INSERT IGNORE INTO StudentNptelEnrollment 
         (regno, nptelCourseId, semesterId) 
         VALUES (?, ?, ?)`,
        [regno, courseId, semesterId]
      );
      if (result.affectedRows > 0) enrolledCount++;
    }

    await connection.commit();

    res.status(200).json({
      status: "success",
      message: `Successfully enrolled in ${enrolledCount} new NPTEL course(s)`,
      enrolledCount
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error in enrollNptel:", err);
    res.status(400).json({ 
      status: "failure", 
      message: err.message || "Failed to enroll in NPTEL courses" 
    });
  } finally {
    connection.release();
  }
});

export const getStudentNptelEnrollments = catchAsync(async (req, res) => {
  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }

  const connection = await pool.getConnection();
  try {
    // Fetch regno using Userid
    const [studentRows] = await connection.execute(
      `SELECT sd.regno FROM student_details sd WHERE sd.Userid = ?`,
      [req.user.Userid]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ status: "failure", message: "Student not found" });
    }

    const regno = studentRows[0].regno;

    // Fetch enrolled NPTEL courses with transfer status
    const [rows] = await connection.execute(`
      SELECT 
        sne.enrollmentId, 
        sne.nptelCourseId, 
        nc.courseTitle, 
        nc.courseCode, 
        nc.type, 
        nc.credits,
        s.semesterNumber, 
        s.startDate, 
        s.endDate,
        nct.transferId, 
        nct.status AS transferStatus, 
        nct.grade AS transferredGrade
      FROM StudentNptelEnrollment sne
      JOIN NptelCourse nc ON sne.nptelCourseId = nc.nptelCourseId
      JOIN Semester s ON sne.semesterId = s.semesterId
      LEFT JOIN NptelCreditTransfer nct ON sne.enrollmentId = nct.enrollmentId
      WHERE sne.regno = ? AND sne.isActive = 'YES'
      ORDER BY s.semesterNumber DESC, nc.courseTitle
    `, [regno]);

    res.status(200).json({
      status: "success",
      data: rows
    });
  } catch (err) {
    console.error("Error in getStudentNptelEnrollments:", err);
    res.status(500).json({ status: "failure", message: "Server error" });
  } finally {
    connection.release();
  }
});

export const requestCreditTransfer = catchAsync(async (req, res) => {
  const { enrollmentId } = req.body;
  const regno = req.user.regno;
  const connection = await pool.getConnection();

  try {
    // Check enrollment belongs to student
    const [enroll] = await connection.execute(`
      SELECT sne.enrollmentId, nc.courseCode, nc.type
      FROM StudentNptelEnrollment sne
      JOIN NptelCourse nc ON sne.nptelCourseId = nc.nptelCourseId
      WHERE sne.enrollmentId = ? AND sne.regno = ?
    `, [enrollmentId, regno]);

    if (enroll.length === 0) {
      return res.status(404).json({ status: 'failure', message: 'Enrollment not found' });
    }

    // Check if grade exists in StudentGrade
    const [gradeRow] = await connection.execute(`
      SELECT grade FROM StudentGrade WHERE regno = ? AND courseCode = ?
    `, [regno, enroll[0].courseCode]);

    if (gradeRow.length === 0 || gradeRow[0].grade === 'U') {
      return res.status(400).json({
        status: 'failure',
        message: 'Grade not found or failed (U). Cannot request transfer.'
      });
    }

    // Create transfer request
    await connection.execute(`
      INSERT INTO NptelCreditTransfer (enrollmentId, regno, nptelCourseId, grade)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE grade = VALUES(grade)
    `, [enrollmentId, regno, enroll[0].nptelCourseId, gradeRow[0].grade]);

    res.status(200).json({
      status: 'success',
      message: 'Credit transfer request submitted'
    });
  } finally {
    connection.release();
  }
});

export const getOecPecProgress = catchAsync(async (req, res) => {
  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }

  const connection = await pool.getConnection();
  try {
    const userId = req.user.Userid;

    // Get regno and regulationId
    const [studentRows] = await connection.execute(
      `SELECT sd.regno, b.regulationId
       FROM student_details sd
       JOIN Batch b ON sd.batch = b.batch AND b.isActive = 'YES'
       WHERE sd.Userid = ?`,
      [userId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ status: "failure", message: "Student or batch not found" });
    }

    const { regno, regulationId } = studentRows[0];

    if (!regno || !regulationId) {
      return res.status(404).json({
        status: "failure",
        message: !regno ? "Registration number missing" : "No regulation assigned to batch"
      });
    }

    // Required from regulation
    const [required] = await connection.execute(
      `SELECT category, COUNT(*) as count
       FROM RegulationCourse
       WHERE regulationId = ? AND category IN ('OEC', 'PEC') AND isActive = 'YES'
       GROUP BY category`,
      [regulationId]
    );

    const requiredMap = { OEC: 0, PEC: 0 };
    required.forEach(r => requiredMap[r.category] = parseInt(r.count) || 0);

    // Approved NPTEL
    const [nptel] = await connection.execute(`
      SELECT nc.type, COUNT(*) as count
      FROM NptelCreditTransfer nct
      JOIN StudentNptelEnrollment sne ON nct.enrollmentId = sne.enrollmentId
      JOIN NptelCourse nc ON sne.nptelCourseId = nc.nptelCourseId
      WHERE nct.regno = ? AND nct.status = 'approved'
      GROUP BY nc.type
    `, [regno]);

    const nptelMap = { OEC: 0, PEC: 0 };
    nptel.forEach(r => nptelMap[r.type] = parseInt(r.count) || 0);

    // College electives
    const [college] = await connection.execute(`
      SELECT c.category, COUNT(*) as count
      FROM StudentElectiveSelection ses
      JOIN Course c ON ses.selectedCourseId = c.courseId
      WHERE ses.regno = ? AND ses.status = 'allocated' AND c.category IN ('OEC', 'PEC')
      GROUP BY c.category
    `, [regno]);

    const collegeMap = { OEC: 0, PEC: 0 };
    college.forEach(r => collegeMap[r.category] = parseInt(r.count) || 0);

    const totalOec = nptelMap.OEC + collegeMap.OEC;
    const totalPec = nptelMap.PEC + collegeMap.PEC;

    res.status(200).json({
      status: "success",
      data: {
        required: requiredMap,
        completed: { OEC: totalOec, PEC: totalPec },
        remaining: {
          OEC: Math.max(0, requiredMap.OEC - totalOec),
          PEC: Math.max(0, requiredMap.PEC - totalPec)
        },
        fromNptel: nptelMap,
        fromCollege: collegeMap
      }
    });
  } catch (err) {
    console.error("Error in getOecPecProgress:", err);
    res.status(500).json({ status: "failure", message: "Server error" });
  } finally {
    connection.release();
  }
});

import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

export const getStudentDetails = catchAsync(async (req, res) => {
  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }

  const userId = req.user.Userid;

  const [rows] = await pool.execute(
    `SELECT 
      u.Userid,
      u.username,
      u.email,
      sd.regno,
      sd.batch,
      sd.student_type,
      sd.date_of_birth,
      sd.blood_group,
      sd.personal_email,
      sd.first_graduate,
      sd.aadhar_card_no,
      sd.mother_tongue,
      sd.identification_mark,
      sd.religion,
      sd.caste,
      sd.community,
      sd.gender,
      sd.seat_type,
      sd.section,
      sd.door_no,
      sd.street,
      sd.cityID,
      sd.districtID,
      sd.stateID,
      sd.countryID,
      sd.pincode,
      sd.personal_phone,
      d.Deptname,
      d.Deptacronym AS branch,
      b.degree,
      b.batch AS batchYear,
      b.batchYears
     FROM users u
     JOIN student_details sd ON u.Userid = sd.Userid
     JOIN department d ON sd.Deptid = d.Deptid
     LEFT JOIN Batch b ON sd.batch = b.batch AND b.IsActive = 'YES'
     WHERE u.Userid = ? AND u.status = 'active'`,
    [userId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ status: "failure", message: "Student profile not found" });
  }

  res.status(200).json({ status: "success", data: rows[0] });
});

export const getSemesters = catchAsync(async (req, res) => {
  // Get student's batch from their profile
  const [studentRows] = await pool.execute(
    `SELECT sd.batch 
     FROM student_details sd 
     JOIN users u ON sd.Userid = u.Userid 
     WHERE u.Userid = ? AND u.status = 'active'`,
    [req.user.Userid]
  );

  if (studentRows.length === 0) {
    return res.status(404).json({ status: "failure", message: "Student not found" });
  }

  const batch = studentRows[0].batch;

  const [rows] = await pool.execute(
    `SELECT 
      s.semesterId,
      s.semesterNumber,
      s.startDate,
      s.endDate,
      s.isActive
     FROM Semester s
     JOIN Batch b ON s.batchId = b.batchId
     WHERE b.batch = ? AND b.IsActive = 'YES'
     ORDER BY s.semesterNumber`,
    [batch]
  );

  if (rows.length === 0) {
    return res.status(404).json({ status: "failure", message: "No semesters found for this batch" });
  }

  res.status(200).json({ status: "success", data: rows });
});

export const getMandatoryCourses = catchAsync(async (req, res) => {
  const { semesterId } = req.query;
  if (!semesterId) {
    return res.status(400).json({ status: "failure", message: "semesterId is required" });
  }

  const [rows] = await pool.execute(
    `SELECT 
      c.courseId,
      c.courseCode,
      c.courseTitle,
      c.category,
      c.credits
     FROM Course c
     WHERE c.semesterId = ? AND c.isActive = 'YES' AND c.category NOT IN ('PEC', 'OEC')`,
    [semesterId]
  );

  const core = rows.filter((course) => course.category === 'PCC');
  const other = rows.filter((course) => course.category !== 'PCC');

  res.status(200).json({
    status: "success",
    data: { core, other },
  });
});

export const getElectiveBuckets = catchAsync(async (req, res) => {
  const { semesterId } = req.query;
  if (!semesterId) {
    return res.status(400).json({ status: "failure", message: "semesterId is required" });
  }

  const [buckets] = await pool.execute(
    `SELECT 
      eb.bucketId,
      eb.bucketNumber,
      eb.bucketName
     FROM ElectiveBucket eb
     WHERE eb.semesterId = ?`,
    [semesterId]
  );

  const bucketsWithCourses = await Promise.all(
    buckets.map(async (bucket) => {
      const [courses] = await pool.execute(
        `SELECT 
          c.courseId,
          c.courseCode,
          c.courseTitle,
          c.category,
          c.credits
         FROM ElectiveBucketCourse ebc
         JOIN Course c ON ebc.courseId = c.courseId
         WHERE ebc.bucketId = ? AND c.isActive = 'YES'`,
        [bucket.bucketId]
      );
      return { ...bucket, courses };
    })
  );

  res.status(200).json({
    status: "success",
    data: bucketsWithCourses,
  });
});

export const allocateElectives = catchAsync(async (req, res) => {
  const { semesterId, selections } = req.body;
  if (!semesterId || !selections || !Array.isArray(selections)) {
    return res.status(400).json({ status: "failure", message: "semesterId and selections are required" });
  }

  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }

  // Fetch student details to get regno
  const [studentRows] = await pool.execute(
    `SELECT sd.regno 
     FROM student_details sd 
     JOIN users u ON sd.Userid = u.Userid 
     WHERE u.Userid = ? AND u.status = 'active'`,
    [req.user.Userid]
  );
  if (studentRows.length === 0) {
    return res.status(404).json({ status: "failure", message: "Student not found" });
  }
  const regno = studentRows[0].regno;

  // Validate selections
  for (const { bucketId, courseId } of selections) {
    const [bucketCheck] = await pool.execute(
      `SELECT 1 FROM ElectiveBucketCourse WHERE bucketId = ? AND courseId = ?`,
      [bucketId, courseId]
    );
    if (bucketCheck.length === 0) {
      return res.status(400).json({ status: "failure", message: `Invalid course ${courseId} for bucket ${bucketId}` });
    }
  }

  // Start transaction
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Insert mandatory courses
    const [mandatoryCourses] = await connection.execute(
      `SELECT courseId FROM Course WHERE semesterId = ? AND category NOT IN ('PEC', 'OEC') AND isActive = 'YES'`,
      [semesterId]
    );
    for (const { courseId } of mandatoryCourses) {
      const [section] = await connection.execute(
        `SELECT sectionId FROM Section WHERE courseId = ? AND isActive = 'YES' LIMIT 1`,
        [courseId]
      );
      if (section.length === 0) {
        throw new Error(`No active section found for mandatory course ${courseId}`);
      }
      await connection.execute(
        `INSERT IGNORE INTO StudentCourse (regno, courseId, sectionId, createdBy, updatedBy)
         VALUES (?, ?, ?, ?, ?)`,
        [regno, courseId, section[0].sectionId, req.user.email || 'admin', req.user.email || 'admin']
      );
    }

    // ⭐ NEW ELECTIVE SECTION (THIS IS THE ONLY CHANGE!)
    for (const { bucketId, courseId } of selections) {
      // FIRST: Record student's CHOICE
      await connection.execute(
        `INSERT INTO StudentElectiveSelection (regno, bucketId, selectedCourseId, status, createdBy)
         VALUES (?, ?, ?, 'allocated', ?)`,
        [regno, bucketId, courseId, req.user.Userid]
      );

      // THEN: Enroll in StudentCourse
      const [section] = await connection.execute(
        `SELECT sectionId FROM Section WHERE courseId = ? AND isActive = 'YES' LIMIT 1`,
        [courseId]
      );
      if (section.length === 0) {
        throw new Error(`No active section found for elective course ${courseId}`);
      }
      await connection.execute(
        `INSERT IGNORE INTO StudentCourse (regno, courseId, sectionId, createdBy, updatedBy)
         VALUES (?, ?, ?, ?, ?)`,
        [regno, courseId, section[0].sectionId, req.user.email || 'admin', req.user.email || 'admin']
      );
    }

    await connection.commit();
    res.status(200).json({ status: "success", message: "Courses allocated successfully" });
  } catch (err) {
    await connection.rollback();
    console.error("Error allocating electives:", err);
    res.status(500).json({ status: "error", message: err.message || "Failed to allocate courses" });
  } finally {
    connection.release();
  }
});

export const getStudentEnrolledCourses = catchAsync(async (req, res) => {
  const { semesterId } = req.query;

  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }

  // Get student's regno
  const [studentRows] = await pool.execute(
    `SELECT sd.regno 
     FROM student_details sd 
     JOIN users u ON sd.Userid = u.Userid 
     WHERE u.Userid = ? AND u.status = 'active'`,
    [req.user.Userid]
  );

  if (studentRows.length === 0) {
    return res.status(404).json({ status: "failure", message: "Student not found" });
  }
  const regno = studentRows[0].regno;

  let query = `
    SELECT 
      sc.courseId,
      c.courseCode, 
      c.courseTitle AS courseName, 
      sec.sectionName AS section,
      u.username AS staff,
      c.credits,
      c.category
     FROM StudentCourse sc
     JOIN Course c ON sc.courseId = c.courseId
     JOIN Section sec ON sc.sectionId = sec.sectionId
     LEFT JOIN StaffCourse stc ON sc.courseId = stc.courseId AND sc.sectionId = stc.sectionId
     LEFT JOIN users u ON stc.Userid = u.Userid
     WHERE sc.regno = ? AND c.isActive = 'YES' AND sec.isActive = 'YES'
  `;
  const params = [regno];

  if (semesterId) {
    query += ` AND c.semesterId = ?`;
    params.push(semesterId);
  }

  query += ` ORDER BY c.courseCode`;

  const [rows] = await pool.execute(query, params);
  res.status(200).json({
    status: "success",
    data: rows,
  });
});

export const getAttendanceSummary = catchAsync(async (req, res) => {
  const { semesterId } = req.query;

  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }

  if (!semesterId) {
    return res.status(400).json({ status: "failure", message: "semesterId is required" });
  }

  // Get student's regno
  const [studentRows] = await pool.execute(
    `SELECT sd.regno 
     FROM student_details sd 
     JOIN users u ON sd.Userid = u.Userid 
     WHERE u.Userid = ? AND u.status = 'active'`,
    [req.user.Userid]
  );

  if (studentRows.length === 0) {
    return res.status(404).json({ status: "failure", message: "Student not found" });
  }
  const regno = studentRows[0].regno;

  // Get semesterNumber
  const [semesterRows] = await pool.execute(
    `SELECT semesterNumber FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
    [semesterId]
  );

  if (semesterRows.length === 0) {
    return res.status(404).json({ status: "failure", message: "Semester not found" });
  }
  const semesterNumber = semesterRows[0].semesterNumber;

  // Get attendance data
  const [attendanceRows] = await pool.execute(
    `SELECT 
      COUNT(*) AS totalDays,
      SUM(CASE WHEN status = 'P' THEN 1 ELSE 0 END) AS daysPresent
     FROM DayAttendance 
     WHERE regno = ? AND semesterNumber = ?`,
    [regno, semesterNumber]
  );

  const totalDays = parseInt(attendanceRows[0].totalDays) || 0;
  const daysPresent = parseInt(attendanceRows[0].daysPresent) || 0;
  const percentage = totalDays > 0 ? ((daysPresent / totalDays) * 100).toFixed(2) : 0;

  res.status(200).json({
    status: "success",
    data: { totalDays, daysPresent, percentage },
  });
});

export const getUserId = catchAsync(async (req, res) => {
  if (!req.user || !req.user.Userid) {
    return res.status(401).json({ status: "failure", message: "User not authenticated" });
  }
  res.status(200).json({
    status: "success",
    data: { Userid: req.user.Userid },
  });
});
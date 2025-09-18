import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

export const searchStudents = catchAsync(async (req, res) => {
  const { degree, branch, batch, semesterNumber } = req.query;

  // Validate required query parameters
  if (!degree || !branch || !batch || !semesterNumber) {
    return res.status(400).json({
      status: "failure",
      message: "degree, branch, batch, and semesterNumber are required",
    });
  }

  // Increase GROUP_CONCAT length to prevent truncation
  await pool.execute(`SET SESSION group_concat_max_len = 1000000`);

  // Fetch students with their enrolled courses and staff assignments for the specific semester
  const [students] = await pool.execute(
    `
    SELECT 
      s.rollnumber, 
      s.name, 
      s.batchId, 
      s.semesterNumber, 
      s.isActive,
      GROUP_CONCAT(
        JSON_OBJECT(
          'courseId', c.courseId,
          'courseCode', COALESCE(c.courseCode, ''),
          'courseTitle', COALESCE(c.courseTitle, ''),
          'sectionId', sc.sectionId,
          'sectionName', COALESCE(sec.sectionName, ''),
          'staffId', COALESCE(u.staffId, ''),
          'staffName', COALESCE(u.name, 'Not Assigned')
        )
        ORDER BY c.courseCode
      ) as enrolledCourses
    FROM Student s
    JOIN Batch b ON s.batchId = b.batchId
    LEFT JOIN StudentCourse sc ON s.rollnumber = sc.rollnumber
    LEFT JOIN Course c ON sc.courseCode = c.courseCode
    LEFT JOIN Semester sem ON c.semesterId = sem.semesterId
    LEFT JOIN Section sec ON sc.sectionId = sec.sectionId
    LEFT JOIN StaffCourse stc 
      ON sc.courseCode = stc.courseCode 
      AND sc.sectionId = stc.sectionId
    LEFT JOIN Users u 
      ON stc.staffId = u.staffId 
      AND stc.departmentId = u.departmentId
    WHERE 
      b.degree = ? 
      AND b.branch = ? 
      AND b.batch = ? 
      AND s.semesterNumber = ? 
      AND s.isActive = 'YES'
      AND (sem.semesterNumber = ? OR sem.semesterNumber IS NULL)
    GROUP BY s.rollnumber, s.name, s.batchId, s.semesterNumber, s.isActive
    ORDER BY s.rollnumber
    `,
    [degree, branch, batch, semesterNumber, semesterNumber]
  );

  // Parse enrolledCourses JSON strings with error handling
  const parsedStudents = students.map((student) => {
    try {
      return {
        ...student,
        enrolledCourses: student.enrolledCourses
          ? JSON.parse(`[${student.enrolledCourses}]`)
          : [],
      };
    } catch (err) {
      console.error(
        `Failed to parse enrolledCourses for student ${student.rollnumber}:`,
        err.message
      );
      return {
        ...student,
        enrolledCourses: [],
      };
    }
  });

  // Final response
  return res.status(200).json({
    status: "success",
    results: parsedStudents.length,
    data: parsedStudents,
  });
});


export const getAvailableCourses = catchAsync(async (req, res) => {
  const { semesterNumber } = req.params;

  if (!semesterNumber || isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
    return res.status(400).json({
      status: "failure",
      message: "Valid semesterNumber (1-8) is required",
    });
  }

  const [rows] = await pool.execute(
    `SELECT c.courseId, c.courseCode, c.courseTitle, c.semesterId, s.sectionId, s.sectionName
     FROM Course c
     JOIN Semester sem ON c.semesterId = sem.semesterId
     JOIN Section s ON c.courseCode = s.courseCode
     WHERE sem.semesterNumber = ? AND c.isActive = 'YES' AND s.isActive = 'YES'`,
    [semesterNumber]
  );

  res.status(200).json({
    status: "success",
    data: rows,
  });
});

export const enrollStudentInCourse = catchAsync(async (req, res) => {
  const { rollnumber, courseCode, sectionName, staffId } = req.body;

  if (!rollnumber || !courseCode || !sectionName) {
    return res.status(400).json({
      status: "failure",
      message: "rollnumber, courseCode, and sectionName are required",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Validate student
    const [studentRows] = await connection.execute(
      `SELECT batchId, semesterNumber FROM Student WHERE rollnumber = ? AND isActive = 'YES'`,
      [rollnumber]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active student found with rollnumber ${rollnumber}`,
      });
    }
    const { batchId, semesterNumber } = studentRows[0];

    // Validate course and semester
    const [courseRows] = await connection.execute(
      `SELECT courseId FROM Course c
       JOIN Semester s ON c.semesterId = s.semesterId
       WHERE c.courseCode = ? AND s.batchId = ? AND s.semesterNumber = ? AND c.isActive = 'YES'`,
      [courseCode, batchId, semesterNumber]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active course ${courseCode} found for semester ${semesterNumber}`,
      });
    }

    // Get sectionId
    const [sectionRows] = await connection.execute(
      `SELECT sectionId FROM Section WHERE courseCode = ? AND sectionName = ? AND isActive = 'YES'`,
      [courseCode, sectionName]
    );
    if (sectionRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active section ${sectionName} found for course ${courseCode}`,
      });
    }
    const { sectionId } = sectionRows[0];

    // Check for existing enrollment
    const [existingEnrollment] = await connection.execute(
      `SELECT studentCourseId, sectionId FROM StudentCourse WHERE rollnumber = ? AND courseCode = ?`,
      [rollnumber, courseCode]
    );

    if (existingEnrollment.length > 0) {
      // Update existing enrollment if section is different
      const existingSectionId = existingEnrollment[0].sectionId;
      if (existingSectionId !== sectionId) {
        await connection.execute(
          `UPDATE StudentCourse SET sectionId = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE studentCourseId = ?`,
          [sectionId, req.user?.email || 'admin', existingEnrollment[0].studentCourseId]
        );
        // Update StaffCourse if staffId is provided
        if (staffId) {
          const [staffCourse] = await connection.execute(
            `SELECT staffCourseId FROM StaffCourse WHERE courseCode = ? AND sectionId = ? AND staffId = ?`,
            [courseCode, sectionId, staffId]
          );
          if (staffCourse.length === 0) {
            await connection.execute(
              `INSERT INTO StaffCourse (staffId, courseCode, sectionId, departmentId)
               VALUES (?, ?, ?, (SELECT departmentId FROM Users WHERE staffId = ?))`,
              [staffId, courseCode, sectionId, staffId]
            );
          }
        }
        await connection.commit();
        return res.status(200).json({
          status: "success",
          message: `Student ${rollnumber} section updated to ${sectionName} for course ${courseCode}`,
        });
      }
      return res.status(200).json({
        status: "success",
        message: `Student ${rollnumber} already enrolled in course ${courseCode} with section ${sectionName}`,
      });
    }

    // New enrollment
    const [result] = await connection.execute(
      `INSERT INTO StudentCourse (rollnumber, courseCode, sectionId, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?)`,
      [rollnumber, courseCode, sectionId, req.user?.email || 'admin', req.user?.email || 'admin']
    );

    // Allocate staff if provided
    if (staffId) {
      const [staffCourse] = await connection.execute(
        `SELECT staffCourseId FROM StaffCourse WHERE courseCode = ? AND sectionId = ? AND staffId = ?`,
        [courseCode, sectionId, staffId]
      );
      if (staffCourse.length === 0) {
        await connection.execute(
          `INSERT INTO StaffCourse (staffId, courseCode, sectionId, departmentId)
           VALUES (?, ?, ?, (SELECT departmentId FROM Users WHERE staffId = ?))`,
          [staffId, courseCode, sectionId, staffId]
        );
      }
    }

    await connection.commit();
    res.status(201).json({
      status: "success",
      message: "Student enrolled in course successfully",
      studentCourseId: result.insertId,
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

export const updateStudentBatch = catchAsync(async (req, res) => {
  const { rollnumber } = req.params;
  const { batchId, semesterNumber } = req.body;

  if (!batchId || !semesterNumber || isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
    return res.status(400).json({
      status: "failure",
      message: "batchId and valid semesterNumber (1-8) are required",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Validate student
    const [studentRows] = await connection.execute(
      `SELECT rollnumber FROM Student WHERE rollnumber = ? AND isActive = 'YES'`,
      [rollnumber]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active student found with rollnumber ${rollnumber}`,
      });
    }

    // Validate batch
    const [batchRows] = await connection.execute(
      `SELECT batchId FROM Batch WHERE batchId = ? AND isActive = 'YES'`,
      [batchId]
    );
    if (batchRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active batch found with batchId ${batchId}`,
      });
    }

    // Update student batch and semester
    const [result] = await connection.execute(
      `UPDATE Student
       SET batchId = ?, semesterNumber = ?, updatedDate = CURRENT_TIMESTAMP
       WHERE rollnumber = ?`,
      [batchId, semesterNumber, rollnumber]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        status: "failure",
        message: "No changes made to the student batch",
      });
    }

    await connection.commit();
    res.status(200).json({
      status: "success",
      message: "Student batch updated successfully",
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

export const getAvailableCoursesForBatch = catchAsync(async (req, res) => {
  const { batchId, semesterNumber } = req.params;

  // Validate parameters
  if (!batchId || isNaN(batchId) || !semesterNumber || isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
    return res.status(400).json({
      status: "error",
      message: "Valid batchId and semesterNumber (1-8) are required",
    });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT 
        c.courseId, c.courseCode, c.courseTitle,
        sem.semesterNumber,
        sec.sectionId, sec.sectionName,
        u.staffId, u.name as staffName,
        b.branch as department,
        (SELECT COUNT(DISTINCT sc2.rollnumber) 
         FROM StudentCourse sc2 
         WHERE sc2.courseCode = c.courseCode AND sc2.sectionId = sec.sectionId) as enrolled
       FROM Course c
       JOIN Semester sem ON c.semesterId = sem.semesterId
       JOIN Batch b ON sem.batchId = b.batchId
       JOIN Section sec ON c.courseCode = sec.courseCode
       LEFT JOIN StaffCourse sc ON sc.courseCode = c.courseCode AND sc.sectionId = sec.sectionId
       LEFT JOIN Users u ON sc.staffId = u.staffId AND sc.departmentId = u.departmentId
       WHERE sem.batchId = ? AND sem.semesterNumber = ? AND c.isActive = 'YES' AND sec.isActive = 'YES'`,
      [batchId, semesterNumber]
    );

    // Group by course
    const grouped = rows.reduce((acc, row) => {
      if (!acc[row.courseCode]) {
        acc[row.courseCode] = {
          courseId: row.courseId,
          courseCode: row.courseCode,
          courseName: row.courseTitle,
          semester: `S${row.semesterNumber}`,
          department: row.department,
          batches: [],
        };
      }
      acc[row.courseCode].batches.push({
        batchId: row.sectionName,
        staffId: row.staffId,
        staff: row.staffName || "Not Assigned",
        enrolled: parseInt(row.enrolled) || 0,
        capacity: 40,
      });
      return acc;
    }, {});

    res.status(200).json({
      status: "success",
      data: Object.values(grouped),
    });
  } catch (error) {
    console.error(`Error fetching available courses for batchId ${batchId}, semester ${semesterNumber}:`, error);
    res.status(500).json({
      status: "error",
      message: "Internal server error while fetching available courses",
    });
  }
});

export const unenrollStudentFromCourse = catchAsync(async (req, res) => {
  const { rollnumber, courseCode } = req.body;

  if (!rollnumber || !courseCode) {
    return res.status(400).json({
      status: "failure",
      message: "rollnumber and courseCode are required",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Validate student
    const [studentRows] = await connection.execute(
      `SELECT rollnumber FROM Student WHERE rollnumber = ? AND isActive = 'YES'`,
      [rollnumber]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active student found with rollnumber ${rollnumber}`,
      });
    }

    // Validate enrollment
    const [enrollmentRows] = await connection.execute(
      `SELECT studentCourseId FROM StudentCourse WHERE rollnumber = ? AND courseCode = ?`,
      [rollnumber, courseCode]
    );
    if (enrollmentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `Student ${rollnumber} is not enrolled in course ${courseCode}`,
      });
    }

    // Delete enrollment
    const [result] = await connection.execute(
      `DELETE FROM StudentCourse WHERE rollnumber = ? AND courseCode = ?`,
      [rollnumber, courseCode]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        status: "failure",
        message: "No changes made. Student may not be enrolled in the course",
      });
    }

    await connection.commit();
    res.status(200).json({
      status: "success",
      message: `Student ${rollnumber} unenrolled from course ${courseCode} successfully`,
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});
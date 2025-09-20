import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

export const searchStudents = catchAsync(async (req, res) => {
  const { degree, branch, batch, semesterNumber } = req.query;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    // Validate required query parameters
    if (!degree || !branch || !batch || !semesterNumber) {
      return res.status(400).json({
        status: "failure",
        message: "degree, branch, batch, and semesterNumber are required",
      });
    }

    // Validate user
    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    // Increase GROUP_CONCAT length to prevent truncation
    await connection.execute(`SET SESSION group_concat_max_len = 1000000`);

    // Fetch students with their enrolled courses and staff assignments
    const [students] = await connection.execute(
      `
      SELECT 
        s.rollnumber, 
        s.name, 
        s.batchId, 
        s.semesterNumber, 
        s.IsActive,
        GROUP_CONCAT(
          JSON_OBJECT(
            'courseId', c.courseId,
            'courseCode', COALESCE(c.courseCode, ''),
            'courseTitle', COALESCE(c.courseTitle, ''),
            'sectionId', sc.sectionId,
            'sectionName', COALESCE(sec.sectionName, ''),
            'Userid', COALESCE(u.Userid, ''),
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
      LEFT JOIN users u 
        ON stc.Userid = u.Userid 
        AND stc.Deptid = u.Deptid
      WHERE 
        b.degree = ? 
        AND b.branch = ? 
        AND b.batch = ? 
        AND s.semesterNumber = ? 
        AND s.IsActive = 'YES'
        AND (sem.semesterNumber = ? OR sem.semesterNumber IS NULL)
      GROUP BY s.rollnumber, s.name, s.batchId, s.semesterNumber, s.IsActive
      ORDER BY s.rollnumber
      `,
      [degree, branch, batch, semesterNumber, semesterNumber]
    );

    // Parse enrolledCourses JSON strings
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

    return res.status(200).json({
      status: "success",
      results: parsedStudents.length,
      data: parsedStudents,
    });
  } catch (err) {
    console.error('Error searching students:', err);
    return res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

export const getAvailableCourses = catchAsync(async (req, res) => {
  const { semesterNumber } = req.params;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    if (!semesterNumber || isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
      return res.status(400).json({
        status: "failure",
        message: "Valid semesterNumber (1-8) is required",
      });
    }

    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [rows] = await connection.execute(
      `SELECT c.courseId, c.courseCode, c.courseTitle, c.semesterId, s.sectionId, s.sectionName
       FROM Course c
       JOIN Semester sem ON c.semesterId = sem.semesterId
       JOIN Section s ON c.courseCode = s.courseCode
       WHERE sem.semesterNumber = ? AND c.isActive = 'YES' AND s.IsActive = 'YES'`,
      [semesterNumber]
    );

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (err) {
    console.error('Error fetching available courses:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

export const enrollStudentInCourse = catchAsync(async (req, res) => {
  const { rollnumber, courseCode, sectionName, Userid } = req.body;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!rollnumber || !courseCode || !sectionName) {
      return res.status(400).json({
        status: "failure",
        message: "rollnumber, courseCode, and sectionName are required",
      });
    }

    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    // Validate student
    const [studentRows] = await connection.execute(
      `SELECT batchId, semesterNumber FROM Student WHERE rollnumber = ? AND IsActive = 'YES'`,
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
      `SELECT sectionId FROM Section WHERE courseCode = ? AND sectionName = ? AND IsActive = 'YES'`,
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
      `SELECT studentCourseId, sectionId FROM StudentCourse WHERE rollnumber = ? AND courseCode = ? AND IsActive = 'YES'`,
      [rollnumber, courseCode]
    );

    if (existingEnrollment.length > 0) {
      // Update existing enrollment if section is different
      const existingSectionId = existingEnrollment[0].sectionId;
      if (existingSectionId !== sectionId) {
        await connection.execute(
          `UPDATE StudentCourse SET sectionId = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE studentCourseId = ?`,
          [sectionId, userEmail, existingEnrollment[0].studentCourseId]
        );
        // Update StaffCourse if Userid is provided
        if (Userid) {
          const [staffRows] = await connection.execute(
            `SELECT Userid, Deptid FROM users WHERE Userid = ? AND Role = 'STAFF' AND IsActive = 'YES'`,
            [Userid]
          );
          if (staffRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
              status: 'failure',
              message: `No active staff found with Userid ${Userid}`,
            });
          }
          const { Deptid } = staffRows[0];
          const [staffCourse] = await connection.execute(
            `SELECT staffCourseId FROM StaffCourse WHERE courseCode = ? AND sectionId = ? AND Userid = ? AND IsActive = 'YES'`,
            [courseCode, sectionId, Userid]
          );
          if (staffCourse.length === 0) {
            await connection.execute(
              `INSERT INTO StaffCourse (Userid, courseCode, sectionId, Deptid, IsActive, createdBy, updatedBy)
               VALUES (?, ?, ?, ?, 'YES', ?, ?)`,
              [Userid, courseCode, sectionId, Deptid, userEmail, userEmail]
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
      `INSERT INTO StudentCourse (rollnumber, courseCode, sectionId, IsActive, createdBy, updatedBy)
       VALUES (?, ?, ?, 'YES', ?, ?)`,
      [rollnumber, courseCode, sectionId, userEmail, userEmail]
    );

    // Allocate staff if provided
    if (Userid) {
      const [staffRows] = await connection.execute(
        `SELECT Userid, Deptid FROM users WHERE Userid = ? AND Role = 'STAFF' AND IsActive = 'YES'`,
        [Userid]
      );
      if (staffRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'failure',
          message: `No active staff found with Userid ${Userid}`,
        });
      }
      const { Deptid } = staffRows[0];
      const [staffCourse] = await connection.execute(
        `SELECT staffCourseId FROM StaffCourse WHERE courseCode = ? AND sectionId = ? AND Userid = ? AND IsActive = 'YES'`,
        [courseCode, sectionId, Userid]
      );
      if (staffCourse.length === 0) {
        await connection.execute(
          `INSERT INTO StaffCourse (Userid, courseCode, sectionId, Deptid, IsActive, createdBy, updatedBy)
           VALUES (?, ?, ?, ?, 'YES', ?, ?)`,
          [Userid, courseCode, sectionId, Deptid, userEmail, userEmail]
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
    console.error('Error enrolling student:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

export const updateStudentBatch = catchAsync(async (req, res) => {
  const { rollnumber } = req.params;
  const { batchId, semesterNumber } = req.body;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!batchId || !semesterNumber || isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
      return res.status(400).json({
        status: "failure",
        message: "batchId and valid semesterNumber (1-8) are required",
      });
    }

    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    // Validate student
    const [studentRows] = await connection.execute(
      `SELECT rollnumber FROM Student WHERE rollnumber = ? AND IsActive = 'YES'`,
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
      `SELECT batchId FROM Batch WHERE batchId = ? AND IsActive = 'YES'`,
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
       SET batchId = ?, semesterNumber = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP
       WHERE rollnumber = ?`,
      [batchId, semesterNumber, userEmail, rollnumber]
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
    console.error('Error updating student batch:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

export const getAvailableCoursesForBatch = catchAsync(async (req, res) => {
  const { batchId, semesterNumber } = req.params;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    // Validate parameters
    if (!batchId || isNaN(batchId) || !semesterNumber || isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
      return res.status(400).json({
        status: "error",
        message: "Valid batchId and semesterNumber (1-8) are required",
      });
    }

    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [rows] = await connection.execute(
      `SELECT 
        c.courseId, c.courseCode, c.courseTitle,
        sem.semesterNumber,
        sec.sectionId, sec.sectionName,
        u.Userid, u.name as staffName,
        b.branch as department,
        (SELECT COUNT(DISTINCT sc2.rollnumber) 
         FROM StudentCourse sc2 
         WHERE sc2.courseCode = c.courseCode AND sc2.sectionId = sec.sectionId AND sc2.IsActive = 'YES') as enrolled
       FROM Course c
       JOIN Semester sem ON c.semesterId = sem.semesterId
       JOIN Batch b ON sem.batchId = b.batchId
       JOIN Section sec ON c.courseCode = sec.courseCode
       LEFT JOIN StaffCourse sc ON sc.courseCode = c.courseCode AND sc.sectionId = sec.sectionId
       LEFT JOIN users u ON sc.Userid = u.Userid AND sc.Deptid = u.Deptid
       WHERE sem.batchId = ? AND sem.semesterNumber = ? AND c.isActive = 'YES' AND sec.IsActive = 'YES'`,
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
        Userid: row.Userid,
        staff: row.staffName || "Not Assigned",
        enrolled: parseInt(row.enrolled) || 0,
        capacity: 40, // Consider making this configurable
      });
      return acc;
    }, {});

    res.status(200).json({
      status: "success",
      data: Object.values(grouped),
    });
  } catch (err) {
    console.error(`Error fetching available courses for batchId ${batchId}, semester ${semesterNumber}:`, err);
    res.status(500).json({
      status: "error",
      message: "Internal server error while fetching available courses",
    });
  } finally {
    connection.release();
  }
});

export const unenrollStudentFromCourse = catchAsync(async (req, res) => {
  const { rollnumber, courseCode } = req.body;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!rollnumber || !courseCode) {
      return res.status(400).json({
        status: "failure",
        message: "rollnumber and courseCode are required",
      });
    }

    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    // Validate student
    const [studentRows] = await connection.execute(
      `SELECT rollnumber FROM Student WHERE rollnumber = ? AND IsActive = 'YES'`,
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
      `SELECT studentCourseId FROM StudentCourse WHERE rollnumber = ? AND courseCode = ? AND IsActive = 'YES'`,
      [rollnumber, courseCode]
    );
    if (enrollmentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `Student ${rollnumber} is not enrolled in course ${courseCode}`,
      });
    }

    // Soft delete enrollment
    const [result] = await connection.execute(
      `UPDATE StudentCourse SET IsActive = 'NO', updatedBy = ?, updatedDate = CURRENT_TIMESTAMP
       WHERE rollnumber = ? AND courseCode = ?`,
      [userEmail, rollnumber, courseCode]
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
    console.error('Error unenrolling student:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});
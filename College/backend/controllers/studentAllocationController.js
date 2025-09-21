import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";


export const searchStudents = catchAsync(async (req, res) => {
  const { degree, branch, batch, semesterNumber } = req.query; // Use req.query for GET request

  try {
    const connection = await pool.getConnection();
    let query = `
      SELECT 
        u.Userid, 
        u.username AS name, 
        sd.regno AS rollnumber,
        sd.batch AS studentBatch,
        sd.Semester AS semesterNumber,
        b.batchId,
        b.degree,
        b.branch,
        d.Deptacronym,
        sc.courseCode,
        sc.sectionId,
        s.sectionName,
        scf.staffId,
        us.username AS staffName
      FROM student_details sd
      JOIN users u ON sd.Userid = u.Userid
      JOIN department d ON sd.Deptid = d.Deptid
      JOIN Batch b ON sd.batch = b.batch
      LEFT JOIN StudentCourse sc ON sd.regno = sc.regno
      LEFT JOIN Section s ON sc.sectionId = s.sectionId AND sc.courseCode = s.courseCode
      LEFT JOIN StaffCourse scf ON sc.courseCode = scf.courseCode AND sc.sectionId = scf.sectionId
      LEFT JOIN users us ON scf.staffId = us.Userid AND us.role = 'Staff' AND us.status = 'active'
      WHERE u.status = 'active'
    `;
    const queryParams = [];

    if (degree) {
      query += ' AND b.degree = ?';
      queryParams.push(degree);
    }
    if (branch) {
      query += ' AND d.Deptacronym = ?';
      queryParams.push(branch);
    }
    if (batch) {
      query += ' AND b.batch = ?';
      queryParams.push(batch);
    }
    if (semesterNumber) {
      query += ' AND sd.Semester = ?';
      queryParams.push(semesterNumber);
    }

    query += ' ORDER BY sd.regno, sc.courseCode';

    const [rows] = await connection.execute(query, queryParams);

    // Aggregate student data with deduplication
    const studentsMap = new Map();
    rows.forEach(row => {
      const studentKey = row.rollnumber;
      if (!studentsMap.has(studentKey)) {
        studentsMap.set(studentKey, {
          rollnumber: row.rollnumber,
          name: row.name,
          batch: row.studentBatch,
          semester: `Semester ${row.semesterNumber}`,
          enrolledCourses: []
        });
      }
      if (row.courseCode) {
        const existingCourse = studentsMap.get(studentKey).enrolledCourses.find(
          c => c.courseCode === row.courseCode && c.sectionId === row.sectionId
        );
        if (!existingCourse) {
          studentsMap.get(studentKey).enrolledCourses.push({
            courseCode: row.courseCode,
            sectionId: row.sectionId,
            sectionName: row.sectionName || 'Unknown',
            staffId: row.staffId ? String(row.staffId) : null,
            staffName: row.staffName || 'Not Assigned'
          });
        }
      }
    });

    const students = Array.from(studentsMap.values());

    // Fetch available courses and their sections/staff
    const coursesQuery = `
      SELECT 
        c.courseId,
        c.courseCode,
        c.courseTitle,
        s.sectionId,
        s.sectionName,
        scf.staffId,
        us.username AS staffName
      FROM Course c
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      LEFT JOIN Section s ON c.courseCode = s.courseCode
      LEFT JOIN StaffCourse scf ON c.courseCode = scf.courseCode AND s.sectionId = scf.sectionId
      LEFT JOIN users us ON scf.staffId = us.Userid AND us.role = 'Staff' AND us.status = 'active'
      WHERE c.isActive = 'YES'
        AND sem.isActive = 'YES'
        ${degree ? 'AND b.degree = ?' : ''}
        ${branch ? 'AND b.branch = ?' : ''}
        ${batch ? 'AND b.batch = ?' : ''}
        ${semesterNumber ? 'AND sem.semesterNumber = ?' : ''}
      ORDER BY c.courseCode, s.sectionName
    `;
    const coursesParams = [degree, branch, batch, semesterNumber].filter(Boolean);
    const [courseRows] = await connection.execute(coursesQuery, coursesParams);

    // Aggregate course data with deduplication
    const coursesMap = new Map();
    courseRows.forEach(row => {
      if (!coursesMap.has(row.courseCode)) {
        coursesMap.set(row.courseCode, {
          courseId: row.courseId,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          batches: []
        });
      }
      if (row.sectionId) {
        const existingBatch = coursesMap.get(row.courseCode).batches.find(
          b => b.sectionId === row.sectionId
        );
        if (!existingBatch) {
          coursesMap.get(row.courseCode).batches.push({
            sectionId: row.sectionId,
            sectionName: row.sectionName || 'Unknown',
            staffId: row.staffId ? String(row.staffId) : null,
            staffName: row.staffName || 'Not Assigned'
          });
        }
      }
    });

    const availableCourses = Array.from(coursesMap.values());

    connection.release();

    res.status(200).json({
      status: 'success',
      studentsData: students,
      coursesData: availableCourses
    });
  } catch (err) {
    console.error('Error in searchStudents:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message
    });
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

    console.log('Enroll Request:', { rollnumber, courseCode, sectionName, Userid, userEmail }); // Debugging log

    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE email = ? AND status = "active"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    // Validate student using student_details table
    const [studentRows] = await connection.execute(
      `SELECT sd.batch, sd.Semester AS semesterNumber, sd.Deptid, d.Deptacronym
       FROM student_details sd
       JOIN department d ON sd.Deptid = d.Deptid
       WHERE sd.regno = ?`,
      [rollnumber]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No student found with rollnumber ${rollnumber}`,
      });
    }
    const { batch, semesterNumber, Deptid, Deptacronym } = studentRows[0];

    console.log('Student Data:', { batch, semesterNumber, Deptid, Deptacronym }); // Debugging log

    // Get batchId from Batch table, ensuring branch matches department
    const [batchRows] = await connection.execute(
      `SELECT batchId FROM Batch WHERE batch = ? AND branch = ? AND isActive = 'YES'`,
      [batch, Deptacronym]
    );
    if (batchRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active batch found for batch ${batch} and branch ${Deptacronym}`,
      });
    }
    const { batchId } = batchRows[0];

    // Validate course and semester
    const [courseRows] = await connection.execute(
      `SELECT c.courseId FROM Course c
       JOIN Semester s ON c.semesterId = s.semesterId
       JOIN Batch b ON s.batchId = b.batchId
       WHERE c.courseCode = ? AND s.batchId = ? AND s.semesterNumber = ? AND c.isActive = 'YES' AND b.branch = ?`,
      [courseCode, batchId, semesterNumber, Deptacronym]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active course ${courseCode} found for semester ${semesterNumber} and branch ${Deptacronym}`,
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

    console.log('Section Data:', { sectionId, sectionName }); // Debugging log

    // Check for existing enrollment
    const [existingEnrollment] = await connection.execute(
      `SELECT studentCourseId, sectionId FROM StudentCourse WHERE regno = ? AND courseCode = ?`,
      [rollnumber, courseCode]
    );
    console.log('Existing Enrollment:', existingEnrollment); // Debugging log

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
            `SELECT Userid, Deptid FROM users WHERE Userid = ? AND role = 'Staff' AND status = 'active'`,
            [Userid]
          );
          if (staffRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
              status: 'failure',
              message: `No active staff found with Userid ${Userid}`,
            });
          }
          const { Deptid: staffDeptid } = staffRows[0];
          const [staffCourse] = await connection.execute(
            `SELECT staffCourseId FROM StaffCourse WHERE courseCode = ? AND sectionId = ? AND staffId = ?`,
            [courseCode, sectionId, Userid]
          );
          if (staffCourse.length === 0) {
            await connection.execute(
              `INSERT INTO StaffCourse (staffId, courseCode, sectionId, Deptid, createdBy, updatedBy)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [Userid, courseCode, sectionId, staffDeptid, userEmail, userEmail]
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
      `INSERT INTO StudentCourse (regno, courseCode, sectionId, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?)`,
      [rollnumber, courseCode, sectionId, userEmail, userEmail]
    );

    // Allocate staff if provided
    if (Userid) {
      const [staffRows] = await connection.execute(
        `SELECT Userid, Deptid FROM users WHERE Userid = ? AND role = 'Staff' AND status = 'active'`,
        [Userid]
      );
      if (staffRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'failure',
          message: `No active staff found with Userid ${Userid}`,
        });
      }
      const { Deptid: staffDeptid } = staffRows[0];
      const [staffCourse] = await connection.execute(
        `SELECT staffCourseId FROM StaffCourse WHERE courseCode = ? AND sectionId = ? AND staffId = ?`,
        [courseCode, sectionId, Userid]
      );
      if (staffCourse.length === 0) {
        await connection.execute(
          `INSERT INTO StaffCourse (staffId, courseCode, sectionId, Deptid, createdBy, updatedBy)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [Userid, courseCode, sectionId, staffDeptid, userEmail, userEmail]
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
  const { batch, semesterNumber } = req.body;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!batch || !semesterNumber || isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
      return res.status(400).json({
        status: "failure",
        message: "batch and valid semesterNumber (1-8) are required",
      });
    }

    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE email = ? AND status = "active"',
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
      `SELECT regno FROM student_details WHERE regno = ? AND pending = FALSE`,
      [rollnumber]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No approved student found with rollnumber ${rollnumber}`,
      });
    }

    // Validate batch
    const [batchRows] = await connection.execute(
      `SELECT batchId FROM Batch WHERE batch = ? AND isActive = 'YES'`,
      [batch]
    );
    if (batchRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active batch found with batch ${batch}`,
      });
    }

    // Update student batch and semester
    const [result] = await connection.execute(
      `UPDATE student_details
       SET batch = ?, Semester = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP
       WHERE regno = ?`,
      [batch, semesterNumber, userEmail, rollnumber]
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

    // Validate user
    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE email = ? AND status = "active"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    // Fetch available courses
    const [rows] = await connection.execute(
      `
      SELECT 
        c.courseId, 
        c.courseCode, 
        c.courseTitle AS courseName,
        sem.semesterNumber,
        sec.sectionId, 
        sec.sectionName AS batchId,
        u.Userid, 
        u.username AS staff,
        b.branch AS department,
        (SELECT COUNT(DISTINCT sc2.regno) 
         FROM StudentCourse sc2 
         WHERE sc2.courseCode = c.courseCode 
         AND sc2.sectionId = sec.sectionId) AS enrolled
      FROM Course c
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      JOIN Section sec ON c.courseCode = sec.courseCode
      LEFT JOIN StaffCourse sc ON sc.courseCode = c.courseCode 
        AND sc.sectionId = sec.sectionId
      LEFT JOIN users u ON sc.staffId = u.staffId 
        AND sc.Deptid = u.Deptid
      WHERE sem.batchId = ? 
        AND sem.semesterNumber = ? 
        AND c.isActive = 'YES' 
        AND sec.isActive = 'YES'
      `,
      [batchId, semesterNumber]
    );

    // Group by course
    const grouped = rows.reduce((acc, row) => {
      if (!acc[row.courseCode]) {
        acc[row.courseCode] = {
          courseId: row.courseId,
          courseCode: row.courseCode,
          courseName: row.courseName,
          semester: `S${row.semesterNumber}`,
          department: row.department,
          batches: [],
        };
      }
      acc[row.courseCode].batches.push({
        batchId: row.batchId,
        sectionId: row.sectionId,
        Userid: row.Userid,
        staff: row.staff || "Not Assigned",
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
      'SELECT Userid FROM users WHERE email = ? AND status = "active"',
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
      `SELECT regno FROM student_details WHERE regno = ?`,
      [rollnumber]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No student found with rollnumber ${rollnumber}`,
      });
    }

    // Validate enrollment
    const [enrollmentRows] = await connection.execute(
      `SELECT studentCourseId FROM StudentCourse WHERE regno = ? AND courseCode = ?`,
      [rollnumber, courseCode]
    );
    if (enrollmentRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `Student ${rollnumber} is not enrolled in course ${courseCode}`,
      });
    }

    // Delete enrollment (since no isActive column exists)
    const [result] = await connection.execute(
      `DELETE FROM StudentCourse WHERE regno = ? AND courseCode = ?`,
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
    console.error('Error unenrolling student:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});
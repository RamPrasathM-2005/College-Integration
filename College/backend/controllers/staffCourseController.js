import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

export const getUsers = catchAsync(async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        u.staffId, 
        u.userId AS id, 
        u.name, 
        u.email, 
        u.departmentId,  
        d.departmentName, 
        sc.staffCourseId, 
        sc.courseCode, 
        c.courseTitle, 
        sc.sectionId, 
        s.sectionName, 
        c.semesterId
      FROM Users u
      INNER JOIN Department d ON u.departmentId = d.departmentId
      LEFT JOIN StaffCourse sc ON u.staffId = sc.staffId
      LEFT JOIN Course c ON sc.courseCode = c.courseCode AND c.isActive = 'YES'
      LEFT JOIN Section s ON sc.sectionId = s.sectionId AND s.isActive = 'YES'
      WHERE u.role = 'STAFF' AND u.isActive = 'YES' AND d.isActive = 'YES'
    `);

    const staffData = rows.reduce((acc, row) => {
      let staff = acc.find(s => s.staffId === row.staffId);
      if (!staff) {
        staff = {
          id: row.id,
          staffId: row.staffId,
          name: row.name || 'Unknown',
          email: row.email || '',
          phone: row.phone || '',
          departmentId: row.departmentId,
          departmentName: row.departmentName || 'Unknown',
          designation: row.designation || '',
          experience: row.experience || '',
          allocatedCourses: [],
        };
        acc.push(staff);
      }
      if (row.staffCourseId && row.courseCode && row.sectionId) {
        staff.allocatedCourses.push({
          staffCourseId: row.staffCourseId,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle || 'Unknown',
          sectionId: row.sectionId,
          sectionName: row.sectionName ? `Batch${row.sectionName}` : 'N/A', // Align with ManageStudents.jsx
          semesterId: row.semesterId || null,
        });
      }
      return acc;
    }, []);

    //console.log('Staff data with allocations:', JSON.stringify(staffData, null, 2));
    res.status(200).json({
      status: 'success',
      data: staffData,
    });
  } catch (err) {
    console.error('getUsers error:', err.message, err.stack);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch users: ' + err.message,
    });
  }
});

export const allocateStaffToCourse = catchAsync(async (req, res) => {
  const { staffId, courseCode, sectionId, departmentId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!staffId || !courseCode || !sectionId || !departmentId) {
      await connection.rollback();
      console.error('Missing required fields:', { staffId, courseCode, sectionId, departmentId });
      return res.status(400).json({ status: 'failure', message: 'staffId, courseCode, sectionId, and departmentId are required' });
    }

    const [staffRows] = await connection.execute(
      `SELECT userId FROM Users WHERE staffId = ? AND departmentId = ? AND role = 'STAFF' AND isActive = 'YES'`,
      [staffId, departmentId]
    );
    if (staffRows.length === 0) {
      await connection.rollback();
      console.error('Staff validation failed:', { staffId, departmentId });
      return res.status(404).json({ status: 'failure', message: `No active staff found with staffId ${staffId} in departmentId ${departmentId}` });
    }

    const [courseRows] = await connection.execute(
      `SELECT courseId FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
      [courseCode]
    );
    if (courseRows.length === 0) {
      await connection.rollback();
      console.error('Course validation failed:', { courseCode });
      return res.status(404).json({ status: 'failure', message: `No active course found with courseCode ${courseCode}` });
    }

    const [sectionRows] = await connection.execute(
      `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND isActive = 'YES'`,
      [sectionId, courseCode]
    );
    if (sectionRows.length === 0) {
      await connection.rollback();
      console.error('Section validation failed:', { sectionId, courseCode });
      return res.status(404).json({ status: 'failure', message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}` });
    }

    const [existing] = await connection.execute(
      `SELECT staffCourseId FROM StaffCourse WHERE staffId = ? AND courseCode = ? AND sectionId = ?`,
      [staffId, courseCode, sectionId]
    );
    if (existing.length > 0) {
      await connection.rollback();
      console.error('Duplicate allocation detected:', { staffId, courseCode, sectionId });
      return res.status(400).json({ status: 'failure', message: 'Staff is already allocated to this course section' });
    }

    const [result] = await connection.execute(
      `INSERT INTO StaffCourse (staffId, courseCode, sectionId, departmentId) VALUES (?, ?, ?, ?)`,
      [staffId, courseCode, sectionId, departmentId]
    );

    await connection.commit();
    res.status(201).json({ status: 'success', message: 'Staff allocated successfully', staffCourseId: result.insertId });
  } catch (err) {
    await connection.rollback();
    console.error('Error allocating staff:', err, 'Payload:', req.body);
    res.status(500).json({ status: 'failure', message: 'Server error: ' + err.message });
  } finally {
    connection.release();
  }
});

export const allocateCourseToStaff = catchAsync(async (req, res) => {
  const { staffId } = req.params;
  const { courseCode, sectionId, departmentId } = req.body;

  if (!courseCode || !sectionId || !departmentId) {
    return res.status(400).json({
      status: "failure",
      message: "courseCode, sectionId, and departmentId are required",
    });
  }

  const [staffRows] = await pool.execute(
    `SELECT userId FROM Users WHERE staffId = ? AND departmentId = ? AND role = 'STAFF' AND isActive = 'YES'`,
    [staffId, departmentId]
  );
  if (staffRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active staff found with staffId ${staffId} in departmentId ${departmentId}`,
    });
  }

  const [courseRows] = await pool.execute(
    `SELECT courseCode FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
    [courseCode]
  );
  if (courseRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active course found with courseCode ${courseCode}`,
    });
  }

  const [sectionRows] = await pool.execute(
    `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND isActive = 'YES'`,
    [sectionId, courseCode]
  );
  if (sectionRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
    });
  }

  const [existingAllocation] = await pool.execute(
    `SELECT staffCourseId FROM StaffCourse WHERE staffId = ? AND courseCode = ? AND sectionId = ? AND departmentId = ?`,
    [staffId, courseCode, sectionId, departmentId]
  );
  if (existingAllocation.length > 0) {
    return res.status(400).json({
      status: "failure",
      message: `Staff ${staffId} is already allocated to course ${courseCode} in section ${sectionId}`,
    });
  }

  const [result] = await pool.execute(
    `INSERT INTO StaffCourse (staffId, courseCode, sectionId, departmentId) VALUES (?, ?, ?, ?)`,
    [staffId, courseCode, sectionId, departmentId]
  );

  res.status(201).json({
    status: "success",
    message: "Course allocated to staff successfully",
    staffCourseId: result.insertId,
  });
});

export const updateStaffCourseBatch = catchAsync(async (req, res) => {
  const { staffCourseId } = req.params;
  const { sectionId } = req.body;

  if (!sectionId) {
    return res.status(400).json({
      status: "failure",
      message: "sectionId is required",
    });
  }

  const [allocationRows] = await pool.execute(
    `SELECT staffCourseId, courseCode FROM StaffCourse WHERE staffCourseId = ?`,
    [staffCourseId]
  );
  if (allocationRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No allocation found with staffCourseId ${staffCourseId}`,
    });
  }

  const { courseCode } = allocationRows[0];

  const [sectionRows] = await pool.execute(
    `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND isActive = 'YES'`,
    [sectionId, courseCode]
  );
  if (sectionRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
    });
  }

  const [result] = await pool.execute(
    `UPDATE StaffCourse SET sectionId = ? WHERE staffCourseId = ?`,
    [sectionId, staffCourseId]
  );

  if (result.affectedRows === 0) {
    return res.status(400).json({
      status: "failure",
      message: "No changes made to the allocation",
    });
  }

  res.status(200).json({
    status: "success",
    message: "Staff course batch updated successfully",
  });
});

export const updateStaffAllocation = catchAsync(async (req, res) => {
  const { staffCourseId } = req.params;
  const { staffId, courseCode, sectionId, departmentId } = req.body;

  if (!staffId || !courseCode || !sectionId || !departmentId) {
    return res.status(400).json({
      status: "failure",
      message: "staffId, courseCode, sectionId, and departmentId are required",
    });
  }

  const [allocationRows] = await pool.execute(
    `SELECT staffCourseId FROM StaffCourse WHERE staffCourseId = ?`,
    [staffCourseId]
  );
  if (allocationRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No allocation found with staffCourseId ${staffCourseId}`,
    });
  }

  const [staffRows] = await pool.execute(
    `SELECT userId FROM Users WHERE staffId = ? AND departmentId = ? AND role = 'STAFF' AND isActive = 'YES'`,
    [staffId, departmentId]
  );
  if (staffRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active staff found with staffId ${staffId} in departmentId ${departmentId}`,
    });
  }

  const [courseRows] = await pool.execute(
    `SELECT courseCode FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
    [courseCode]
  );
  if (courseRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active course found with courseCode ${courseCode}`,
    });
  }

  const [sectionRows] = await pool.execute(
    `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND isActive = 'YES'`,
    [sectionId, courseCode]
  );
  if (sectionRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
    });
  }

  const [existingAllocation] = await pool.execute(
    `SELECT staffCourseId FROM StaffCourse 
     WHERE staffId = ? AND courseCode = ? AND sectionId = ? AND departmentId = ? AND staffCourseId != ?`,
    [staffId, courseCode, sectionId, departmentId, staffCourseId]
  );
  if (existingAllocation.length > 0) {
    return res.status(400).json({
      status: "failure",
      message: `Staff ${staffId} is already allocated to course ${courseCode} in section ${sectionId}`,
    });
  }

  const [result] = await pool.execute(
    `UPDATE StaffCourse 
     SET staffId = ?, courseCode = ?, sectionId = ?, departmentId = ?
     WHERE staffCourseId = ?`,
    [staffId, courseCode, sectionId, departmentId, staffCourseId]
  );

  if (result.affectedRows === 0) {
    return res.status(400).json({
      status: "failure",
      message: "No changes made to the allocation",
    });
  }

  res.status(200).json({
    status: "success",
    message: "Staff-course allocation updated successfully",
  });
});

export const getStaffAllocationsByCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;

  const [courseRows] = await pool.execute(
    `SELECT courseCode FROM Course WHERE courseId = ? AND isActive = 'YES'`,
    [courseId]
  );
  if (courseRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active course found with courseId ${courseId}`,
    });
  }
  const { courseCode } = courseRows[0];

  const [rows] = await pool.execute(
    `SELECT sc.staffCourseId, sc.staffId, u.name AS staffName, sc.courseCode, sc.sectionId, s.sectionName, sc.departmentId, d.departmentName
     FROM StaffCourse sc
     JOIN Users u ON sc.staffId = u.staffId AND sc.departmentId = u.departmentId
     JOIN Section s ON sc.sectionId = s.sectionId
     JOIN Department d ON sc.departmentId = d.departmentId
     WHERE sc.courseCode = ? AND u.isActive = 'YES' AND s.isActive = 'YES' AND d.isActive = 'YES'`,
    [courseCode]
  );

  res.status(200).json({
    status: "success",
    data: rows,
  });
});

export const getCourseAllocationsByStaff = catchAsync(async (req, res) => {
  const { staffId } = req.params;

  const [staffRows] = await pool.execute(
    `SELECT userId, departmentId FROM Users WHERE staffId = ? AND role = 'STAFF' AND isActive = 'YES'`,
    [staffId]
  );
  if (staffRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active staff found with staffId ${staffId}`,
    });
  }
  const { departmentId } = staffRows[0];

  const [rows] = await pool.execute(
    `SELECT 
       sc.staffCourseId, 
       sc.staffId, 
       sc.courseCode AS id, 
       c.courseTitle AS title, 
       sc.sectionId, 
       s.sectionName,
       sc.departmentId, 
       d.departmentName,
       CONCAT(b.batchYears, ' ', CASE WHEN sem.semesterNumber % 2 = 1 THEN 'ODD' ELSE 'EVEN' END, ' SEMESTER') AS semester,
       b.degree,
       b.branch,
       b.batch
     FROM StaffCourse sc
     JOIN Course c ON sc.courseCode = c.courseCode
     JOIN Section s ON sc.sectionId = s.sectionId
     JOIN Department d ON sc.departmentId = d.departmentId
     JOIN Semester sem ON c.semesterId = sem.semesterId
     JOIN Batch b ON sem.batchId = b.batchId
     WHERE sc.staffId = ? AND sc.departmentId = ? 
       AND c.isActive = 'YES' AND s.isActive = 'YES' AND d.isActive = 'YES'`,
    [staffId, departmentId]
  );

  res.status(200).json({
    status: "success",
    data: rows,
  });
});

export const getCourseAllocationsByStaffEnhanced = catchAsync(async (req, res) => {
  const { staffId } = req.params;

  if (!req.user || !req.user.staffId || !req.user.departmentId) {
    return res.status(401).json({
      status: 'failure',
      message: 'User authentication data missing. Please log in again.',
    });
  }

  const { staffId: authenticatedStaffId, departmentId } = req.user;

  if (staffId !== authenticatedStaffId) {
    return res.status(403).json({
      status: 'failure',
      message: 'Unauthorized to access courses for another staff',
    });
  }

  const [staffRows] = await pool.execute(
    `SELECT userId, departmentId FROM Users WHERE staffId = ? AND role = 'STAFF' AND isActive = 'YES'`,
    [staffId]
  );
  if (staffRows.length === 0) {
    return res.status(404).json({
      status: 'failure',
      message: `No active staff found with staffId ${staffId}`,
    });
  }
  const { departmentId: fetchedDepartmentId } = staffRows[0];

  if (departmentId !== fetchedDepartmentId) {
    return res.status(403).json({
      status: 'failure',
      message: 'Department mismatch for the authenticated staff',
    });
  }

  const [rows] = await pool.execute(
    `SELECT 
       sc.staffCourseId, 
       sc.staffId, 
       sc.courseCode AS id, 
       c.courseTitle AS title, 
       sc.sectionId, 
       s.sectionName,
       sc.departmentId, 
       d.departmentName,
       CONCAT(b.batchYears, ' ', CASE WHEN sem.semesterNumber % 2 = 1 THEN 'ODD' ELSE 'EVEN' END, ' SEMESTER') AS semester,
       b.degree,
       b.branch,
       b.batch,
       c.createdAt AS lastAccessed
     FROM StaffCourse sc
     JOIN Course c ON sc.courseCode = c.courseCode
     JOIN Section s ON sc.sectionId = s.sectionId
     JOIN Department d ON sc.departmentId = d.departmentId
     JOIN Semester sem ON c.semesterId = sem.semesterId
     JOIN Batch b ON sem.batchId = b.batchId
     WHERE sc.staffId = ? AND sc.departmentId = ? 
       AND c.isActive = 'YES' AND s.isActive = 'YES' AND d.isActive = 'YES'
       AND sem.startDate <= CURDATE() AND sem.endDate >= CURDATE()`,
    [staffId, departmentId]
  );

  res.status(200).json({
    status: 'success',
    data: rows,
  });
});

export const deleteStaffAllocation = catchAsync(async (req, res) => {
  const { staffCourseId } = req.params;

  const [allocationRows] = await pool.execute(
    `SELECT staffCourseId, sectionId, courseCode FROM StaffCourse WHERE staffCourseId = ?`,
    [staffCourseId]
  );
  if (allocationRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No allocation found with staffCourseId ${staffCourseId}`,
    });
  }

  const [result] = await pool.execute(`DELETE FROM StaffCourse WHERE staffCourseId = ?`, [staffCourseId]);
  if (result.affectedRows === 0) {
    return res.status(400).json({
      status: "failure",
      message: "No changes made to the allocation",
    });
  }

  res.status(200).json({
    status: "success",
    message: "Staff-course allocation deleted successfully",
  });
});
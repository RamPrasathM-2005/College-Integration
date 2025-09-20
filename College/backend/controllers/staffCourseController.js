import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

export const getUsers = catchAsync(async (req, res) => {
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: "failure",
      message: "Authentication required: No user email provided",
    });
  }
  const userEmail = req.user.email;
  const connection = await pool.getConnection();

  try {
    const [userCheck] = await connection.execute(
      "SELECT Userid FROM users WHERE email = ? AND status = 'active'",
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [rows] = await connection.execute(`
      SELECT 
        u.staffId, 
        u.Userid AS id, 
        u.username AS name, 
        u.email, 
        u.Deptid AS departmentId,  
        d.Deptname AS departmentName, 
        sc.staffCourseId, 
        sc.courseCode, 
        c.courseTitle, 
        sc.sectionId, 
        s.sectionName, 
        c.semesterId
      FROM users u
      INNER JOIN department d ON u.Deptid = d.Deptid
      LEFT JOIN StaffCourse sc ON u.Userid = sc.staffId
      LEFT JOIN Course c ON sc.courseCode = c.courseCode AND c.isActive = 'YES'
      LEFT JOIN Section s ON sc.sectionId = s.sectionId AND s.isActive = 'YES'
      WHERE u.role = 'Staff' AND u.status = 'active'
    `);

    const staffData = rows.reduce((acc, row) => {
      let staff = acc.find((s) => s.id === row.id);
      if (!staff) {
        staff = {
          id: row.id,
          staffId: row.staffId || row.id.toString(),
          name: row.name || "Unknown",
          email: row.email || "",
          phone: "",
          departmentId: row.departmentId,
          departmentName: row.departmentName || "Unknown",
          designation: "",
          experience: "",
          allocatedCourses: [],
        };
        acc.push(staff);
      }
      if (row.staffCourseId && row.courseCode && row.sectionId) {
        staff.allocatedCourses.push({
          staffCourseId: row.staffCourseId,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle || "Unknown",
          sectionId: row.sectionId,
          sectionName: row.sectionName ? `Batch ${row.sectionName}` : "N/A",
          semesterId: row.semesterId || null,
        });
      }
      return acc;
    }, []);

    res.status(200).json({
      status: "success",
      data: staffData,
    });
  } catch (err) {
    console.error("getUsers error:", {
      message: err.message,
      stack: err.stack,
      userEmail,
    });
    res.status(500).json({
      status: "failure",
      message: "Failed to fetch users: " + err.message,
    });
  } finally {
    connection.release();
  }
});

export const allocateStaffToCourse = catchAsync(async (req, res) => {
  const { staffId, courseCode, sectionId, departmentId } = req.body;
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: "failure",
      message: "Authentication required: No user email provided",
    });
  }
  const userEmail = req.user.email;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!staffId || !courseCode || !sectionId || !departmentId) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: "staffId, courseCode, sectionId, and departmentId are required",
      });
    }

    const [userCheck] = await connection.execute(
      "SELECT Userid FROM users WHERE email = ? AND status = 'active'",
      [userEmail]
    );
    if (userCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [staffRows] = await connection.execute(
      `SELECT Userid FROM users WHERE staffId = ? AND Deptid = ? AND role = 'Staff' AND status = 'active'`,
      [staffId, departmentId]
    );
    if (staffRows.length === 0) {
      await connection.rollback();
      console.error("Staff validation failed:", { staffId, departmentId });
      return res.status(404).json({
        status: "failure",
        message: `No active staff found with staffId ${staffId} in departmentId ${departmentId}`,
      });
    }

    const [courseRows] = await connection.execute(
      `SELECT courseCode FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
      [courseCode]
    );
    if (courseRows.length === 0) {
      await connection.rollback();
      console.error("Course validation failed:", { courseCode });
      return res.status(404).json({
        status: "failure",
        message: `No active course found with courseCode ${courseCode}`,
      });
    }

    const [sectionRows] = await connection.execute(
      `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND isActive = 'YES'`,
      [sectionId, courseCode]
    );
    if (sectionRows.length === 0) {
      await connection.rollback();
      console.error("Section validation failed:", { sectionId, courseCode });
      return res.status(404).json({
        status: "failure",
        message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
      });
    }

    // Check for existing allocation for the same course and staff (prevent multiple sections)
    const [existingCourseAllocation] = await connection.execute(
      `SELECT staffCourseId, sectionId FROM StaffCourse WHERE staffId = ? AND courseCode = ?`,
      [staffId, courseCode]
    );
    if (existingCourseAllocation.length > 0) {
      await connection.rollback();
      console.error("Duplicate course allocation detected:", {
        staffId,
        courseCode,
        existingSectionId: existingCourseAllocation[0].sectionId,
      });
      return res.status(400).json({
        status: "failure",
        message: `Staff ${staffId} is already allocated to course ${courseCode} in section ${existingCourseAllocation[0].sectionId}`,
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO StaffCourse (staffId, courseCode, sectionId, Deptid, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [staffId, courseCode, sectionId, departmentId, userEmail, userEmail]
    );

    await connection.commit();
    res.status(201).json({
      status: "success",
      message: "Staff allocated successfully",
      staffCourseId: result.insertId,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error allocating staff:", {
      message: err.message,
      stack: err.stack,
      payload: req.body,
    });
    res.status(500).json({
      status: "failure",
      message: "Server error: " + err.message,
    });
  } finally {
    connection.release();
  }
});

export const allocateCourseToStaff = catchAsync(async (req, res) => {
  const { staffId } = req.params;
  const { courseCode, sectionId, departmentId } = req.body;
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: "failure",
      message: "Authentication required: No user email provided",
    });
  }
  const userEmail = req.user.email;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!courseCode || !sectionId || !departmentId) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: "courseCode, sectionId, and departmentId are required",
      });
    }

    const parsedStaffId = parseInt(staffId, 10);
    if (isNaN(parsedStaffId)) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: "Invalid staffId: must be a valid integer",
      });
    }

    const [userCheck] = await connection.execute(
      "SELECT Userid FROM users WHERE email = ? AND status = 'active'",
      [userEmail]
    );
    if (userCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [staffRows] = await connection.execute(
      `SELECT Userid FROM users WHERE staffId = ? AND Deptid = ? AND role = 'Staff' AND status = 'active'`,
      [parsedStaffId, departmentId]
    );
    if (staffRows.length === 0) {
      await connection.rollback();
      console.error("Staff validation failed:", { staffId: parsedStaffId, departmentId });
      return res.status(404).json({
        status: "failure",
        message: `No active staff found with staffId ${parsedStaffId} in departmentId ${departmentId}`,
      });
    }

    const [courseRows] = await connection.execute(
      `SELECT courseCode FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
      [courseCode]
    );
    if (courseRows.length === 0) {
      await connection.rollback();
      console.error("Course validation failed:", { courseCode });
      return res.status(404).json({
        status: "failure",
        message: `No active course found with courseCode ${courseCode}`,
      });
    }

    const [sectionRows] = await connection.execute(
      `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND isActive = 'YES'`,
      [sectionId, courseCode]
    );
    if (sectionRows.length === 0) {
      await connection.rollback();
      console.error("Section validation failed:", { sectionId, courseCode });
      return res.status(404).json({
        status: "failure",
        message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
      });
    }

    // Check for existing allocation for the same course and staff (prevent multiple sections)
    const [existingCourseAllocation] = await connection.execute(
      `SELECT staffCourseId, sectionId FROM StaffCourse WHERE staffId = ? AND courseCode = ?`,
      [parsedStaffId, courseCode]
    );
    if (existingCourseAllocation.length > 0) {
      await connection.rollback();
      console.error("Duplicate course allocation detected:", {
        staffId: parsedStaffId,
        courseCode,
        existingSectionId: existingCourseAllocation[0].sectionId,
      });
      return res.status(400).json({
        status: "failure",
        message: `Staff ${parsedStaffId} is already allocated to course ${courseCode} in section ${existingCourseAllocation[0].sectionId}`,
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO StaffCourse (staffId, courseCode, sectionId, Deptid, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [parsedStaffId, courseCode, sectionId, departmentId, userEmail, userEmail]
    );

    await connection.commit();
    res.status(201).json({
      status: "success",
      message: "Course allocated to staff successfully",
      staffCourseId: result.insertId,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error allocating course:", {
      message: err.message,
      stack: err.stack,
      params: req.params,
      body: req.body,
    });
    res.status(500).json({
      status: "failure",
      message: "Server error: " + err.message,
    });
  } finally {
    connection.release();
  }
});

export const updateStaffCourseBatch = catchAsync(async (req, res) => {
  const { staffCourseId } = req.params;
  const { sectionId } = req.body;
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: "failure",
      message: "Authentication required: No user email provided",
    });
  }
  const userEmail = req.user.email;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!sectionId) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: "sectionId is required",
      });
    }

    const [userCheck] = await connection.execute(
      "SELECT Userid FROM users WHERE email = ? AND status = 'active'",
      [userEmail]
    );
    if (userCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [allocationRows] = await connection.execute(
      `SELECT staffCourseId, courseCode, staffId, Deptid FROM StaffCourse WHERE staffCourseId = ?`,
      [staffCourseId]
    );
    if (allocationRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "failure",
        message: `No allocation found with staffCourseId ${staffCourseId}`,
      });
    }

    const { courseCode, staffId, Deptid } = allocationRows[0];

    const [sectionRows] = await connection.execute(
      `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND isActive = 'YES'`,
      [sectionId, courseCode]
    );
    if (sectionRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "failure",
        message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
      });
    }

    const [result] = await connection.execute(
      `UPDATE StaffCourse SET sectionId = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE staffCourseId = ?`,
      [sectionId, userEmail, staffCourseId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: "No changes made to the allocation",
      });
    }

    await connection.commit();
    res.status(200).json({
      status: "success",
      message: "Staff course batch updated successfully",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error updating staff course batch:", {
      message: err.message,
      stack: err.stack,
      params: req.params,
      body: req.body,
    });
    res.status(500).json({
      status: "failure",
      message: "Server error: " + err.message,
    });
  } finally {
    connection.release();
  }
});

export const updateStaffAllocation = catchAsync(async (req, res) => {
  const { staffCourseId } = req.params;
  const { staffId, courseCode, sectionId, departmentId } = req.body;
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: "failure",
      message: "Authentication required: No user email provided",
    });
  }
  const userEmail = req.user.email;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!staffId || !courseCode || !sectionId || !departmentId) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: "staffId, courseCode, sectionId, and departmentId are required",
      });
    }

    const [userCheck] = await connection.execute(
      "SELECT Userid FROM users WHERE email = ? AND status = 'active'",
      [userEmail]
    );
    if (userCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [allocationRows] = await connection.execute(
      `SELECT staffCourseId FROM StaffCourse WHERE staffCourseId = ?`,
      [staffCourseId]
    );
    if (allocationRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "failure",
        message: `No allocation found with staffCourseId ${staffCourseId}`,
      });
    }

    const [staffRows] = await connection.execute(
      `SELECT Userid FROM users WHERE staffId = ? AND Deptid = ? AND role = 'Staff' AND status = 'active'`,
      [staffId, departmentId]
    );
    if (staffRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "failure",
        message: `No active staff found with staffId ${staffId} in departmentId ${departmentId}`,
      });
    }

    const [courseRows] = await connection.execute(
      `SELECT courseCode FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
      [courseCode]
    );
    if (courseRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "failure",
        message: `No active course found with courseCode ${courseCode}`,
      });
    }

    const [sectionRows] = await connection.execute(
      `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND isActive = 'YES'`,
      [sectionId, courseCode]
    );
    if (sectionRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "failure",
        message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
      });
    }

    // Check for existing allocation for the same course and staff (prevent multiple sections)
    const [existingCourseAllocation] = await connection.execute(
      `SELECT staffCourseId, sectionId FROM StaffCourse WHERE staffId = ? AND courseCode = ? AND staffCourseId != ?`,
      [staffId, courseCode, staffCourseId]
    );
    if (existingCourseAllocation.length > 0) {
      await connection.rollback();
      console.error("Duplicate course allocation detected:", {
        staffId,
        courseCode,
        existingSectionId: existingCourseAllocation[0].sectionId,
      });
      return res.status(400).json({
        status: "failure",
        message: `Staff ${staffId} is already allocated to course ${courseCode} in section ${existingCourseAllocation[0].sectionId}`,
      });
    }

    const [result] = await connection.execute(
      `UPDATE StaffCourse 
       SET staffId = ?, courseCode = ?, sectionId = ?, Deptid = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP
       WHERE staffCourseId = ?`,
      [staffId, courseCode, sectionId, departmentId, userEmail, staffCourseId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: "No changes made to the allocation",
      });
    }

    await connection.commit();
    res.status(200).json({
      status: "success",
      message: "Staff-course allocation updated successfully",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error updating staff allocation:", {
      message: err.message,
      stack: err.stack,
      params: req.params,
      body: req.body,
    });
    res.status(500).json({
      status: "failure",
      message: "Server error: " + err.message,
    });
  } finally {
    connection.release();
  }
});

export const getStaffAllocationsByCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: "failure",
      message: "Authentication required: No user email provided",
    });
  }
  const userEmail = req.user.email;
  const connection = await pool.getConnection();

  try {
    const [userCheck] = await connection.execute(
      "SELECT Userid FROM users WHERE email = ? AND status = 'active'",
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [courseRows] = await connection.execute(
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

    const [rows] = await connection.execute(
      `SELECT sc.staffCourseId, sc.staffId, u.username AS staffName, sc.courseCode, sc.sectionId, s.sectionName, sc.Deptid AS departmentId, d.Deptname AS departmentName
       FROM StaffCourse sc
       JOIN users u ON sc.staffId = u.Userid AND sc.Deptid = u.Deptid
       JOIN Section s ON sc.sectionId = s.sectionId
       JOIN department d ON sc.Deptid = d.Deptid
       WHERE sc.courseCode = ? AND u.status = 'active' AND s.isActive = 'YES'`,
      [courseCode]
    );

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (err) {
    console.error("Error fetching staff allocations:", {
      message: err.message,
      stack: err.stack,
      params: req.params,
    });
    res.status(500).json({
      status: "failure",
      message: "Server error: " + err.message,
    });
  } finally {
    connection.release();
  }
});

export const getCourseAllocationsByStaff = catchAsync(async (req, res) => {
  const { staffId } = req.params;
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: "failure",
      message: "Authentication required: No user email provided",
    });
  }
  const userEmail = req.user.email;
  const connection = await pool.getConnection();

  try {
    const [userCheck] = await connection.execute(
      "SELECT Userid FROM users WHERE email = ? AND status = 'active'",
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [staffRows] = await connection.execute(
      `SELECT Userid, Deptid AS departmentId FROM users WHERE staffId = ? AND role = 'Staff' AND status = 'active'`,
      [staffId]
    );
    if (staffRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active staff found with staffId ${staffId}`,
      });
    }
    const { departmentId } = staffRows[0];

    const [rows] = await connection.execute(
      `SELECT 
         sc.staffCourseId, 
         sc.staffId, 
         sc.courseCode AS id, 
         c.courseTitle AS title, 
         sc.sectionId, 
         s.sectionName,
         sc.Deptid AS departmentId, 
         d.Deptname AS departmentName,
         CONCAT(b.batchYears, ' ', CASE WHEN sem.semesterNumber % 2 = 1 THEN 'ODD' ELSE 'EVEN' END, ' SEMESTER') AS semester,
         b.degree,
         b.branch,
         b.batch
       FROM StaffCourse sc
       JOIN Course c ON sc.courseCode = c.courseCode
       JOIN Section s ON sc.sectionId = s.sectionId
       JOIN department d ON sc.Deptid = d.Deptid
       JOIN Semester sem ON c.semesterId = sem.semesterId
       JOIN Batch b ON sem.batchId = b.batchId
       WHERE sc.staffId = ? AND sc.Deptid = ? 
         AND c.isActive = 'YES' AND s.isActive = 'YES'`,
      [staffId, departmentId]
    );

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (err) {
    console.error("Error fetching course allocations:", {
      message: err.message,
      stack: err.stack,
      params: req.params,
    });
    res.status(500).json({
      status: "failure",
      message: "Server error: " + err.message,
    });
  } finally {
    connection.release();
  }
});

export const getCourseAllocationsByStaffEnhanced = catchAsync(async (req, res) => {
  const { staffId } = req.params;
  if (!req.user || !req.user.email || !req.user.staffId || !req.user.Deptid) {
    return res.status(401).json({
      status: "failure",
      message: "User authentication data missing. Please log in again.",
    });
  }
  const userEmail = req.user.email;
  const { staffId: authenticatedStaffId, Deptid: departmentId } = req.user;
  const connection = await pool.getConnection();

  try {
    if (staffId !== authenticatedStaffId) {
      return res.status(403).json({
        status: "failure",
        message: "Unauthorized to access courses for another staff",
      });
    }

    const [staffRows] = await connection.execute(
      `SELECT Userid, Deptid AS departmentId FROM users WHERE staffId = ? AND role = 'Staff' AND status = 'active'`,
      [staffId]
    );
    if (staffRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active staff found with staffId ${staffId}`,
      });
    }
    const { departmentId: fetchedDepartmentId } = staffRows[0];

    if (departmentId !== fetchedDepartmentId) {
      return res.status(403).json({
        status: "failure",
        message: "Department mismatch for the authenticated staff",
      });
    }

    const [rows] = await connection.execute(
      `SELECT 
         sc.staffCourseId, 
         sc.staffId, 
         sc.courseCode AS id, 
         c.courseTitle AS title, 
         sc.sectionId, 
         s.sectionName,
         sc.Deptid AS departmentId, 
         d.Deptname AS departmentName,
         CONCAT(b.batchYears, ' ', CASE WHEN sem.semesterNumber % 2 = 1 THEN 'ODD' ELSE 'EVEN' END, ' SEMESTER') AS semester,
         b.degree,
         b.branch,
         b.batch,
         c.createdAt AS lastAccessed
       FROM StaffCourse sc
       JOIN Course c ON sc.courseCode = c.courseCode
       JOIN Section s ON sc.sectionId = s.sectionId
       JOIN department d ON sc.Deptid = d.Deptid
       JOIN Semester sem ON c.semesterId = sem.semesterId
       JOIN Batch b ON sem.batchId = b.batchId
       WHERE sc.staffId = ? AND sc.Deptid = ? 
         AND c.isActive = 'YES' AND s.isActive = 'YES'
         AND sem.startDate <= CURDATE() AND sem.endDate >= CURDATE()`,
      [staffId, departmentId]
    );

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (err) {
    console.error("Error fetching enhanced course allocations:", {
      message: err.message,
      stack: err.stack,
      params: req.params,
    });
    res.status(500).json({
      status: "failure",
      message: "Server error: " + err.message,
    });
  } finally {
    connection.release();
  }
});

export const deleteStaffAllocation = catchAsync(async (req, res) => {
  const { staffCourseId } = req.params;
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: "failure",
      message: "Authentication required: No user email provided",
    });
  }
  const userEmail = req.user.email;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userCheck] = await connection.execute(
      "SELECT Userid FROM users WHERE email = ? AND status = 'active'",
      [userEmail]
    );
    if (userCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: `No active user found with email ${userEmail}`,
      });
    }

    const [allocationRows] = await connection.execute(
      `SELECT staffCourseId, sectionId, courseCode FROM StaffCourse WHERE staffCourseId = ?`,
      [staffCourseId]
    );
    if (allocationRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "failure",
        message: `No allocation found with staffCourseId ${staffCourseId}`,
      });
    }

    const [result] = await connection.execute(
      `DELETE FROM StaffCourse WHERE staffCourseId = ?`,
      [staffCourseId]
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: "failure",
        message: "No changes made to the allocation",
      });
    }

    await connection.commit();
    res.status(200).json({
      status: "success",
      message: "Staff-course allocation deleted successfully",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error deleting staff allocation:", {
      message: err.message,
      stack: err.stack,
      params: req.params,
    });
    res.status(500).json({
      status: "failure",
      message: "Server error: " + err.message,
    });
  } finally {
    connection.release();
  }
});
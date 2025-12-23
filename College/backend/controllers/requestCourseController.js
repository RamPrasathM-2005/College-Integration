// controllers/requestCourseController.js (fixed params count for getAllCoursesForStaff, added type to admin pending)
import { pool, branchMap } from '../db.js'; // Assuming db.js is at config/database.js

export const getAvailableCoursesForStaff = async (req, res) => {
  try {
    const { semester, branch, dept, batch, type } = req.query;
    const userId = req.user.Userid;
    const staffDeptId = req.user.Deptid;

    let whereClause = `
      WHERE c.isActive = 'YES' 
      AND c.courseId NOT IN (
        SELECT sc.courseId FROM StaffCourse sc WHERE sc.Userid = ?
      )
    `;
    const params = [userId];

    // Dept filter via join to Regulation (since Batch links to Regulation which has Deptid)
    whereClause += ` AND r.Deptid = ?`;
    params.push(staffDeptId);

    if (branch) {
      const branchDept = branchMap[branch]?.Deptid;
      if (branchDept && branchDept !== staffDeptId) {
        console.log('Branch mismatch in available; ignoring filter:', { branch, branchDept, staffDeptId });
        // Don't 403; just skip branch filter to show dept courses
      } else {
        whereClause += ` AND b.branch = ?`;
        params.push(branch);
      }
    }
    if (semester) {
      whereClause += ` AND sem.semesterNumber = ?`;
      params.push(parseInt(semester));
    }
    if (batch) {
      whereClause += ` AND b.batch = ?`;
      params.push(batch);
    }
    if (type && ['THEORY', 'PRACTICAL', 'INTEGRATED', 'EXPERIENTIAL LEARNING'].includes(type)) {
      whereClause += ` AND c.type = ?`;
      params.push(type);
    }

    const [courses] = await pool.execute(`
      SELECT 
        c.courseId, c.courseCode, c.courseTitle, c.category, c.type, c.credits,
        sem.semesterNumber, b.batch, b.branch, b.degree
      FROM Course c
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      LEFT JOIN Regulation r ON b.regulationId = r.regulationId
      ${whereClause}
      ORDER BY c.courseCode
    `, params);

    res.json({ status: 'success', data: courses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};


// controllers/requestCourseController.js (only getAllCoursesForStaff updated for logs; rest unchanged)
export const getAllCoursesForStaff = async (req, res) => {
  try {
    const { semester, branch, dept, batch, type } = req.query;
    console.log('Backend received query for all-courses:', { semester, branch, dept, batch, type }); // Enhanced debug
    const userId = req.user.Userid;
    const staffDeptId = req.user.Deptid;

    let whereClause = `WHERE c.isActive = 'YES'`;
    const params = [];

    // Dept filter (always apply via staffDeptId; ignore query.dept as unused)
    whereClause += ` AND r.Deptid = ?`;
    params.push(staffDeptId);

    if (branch && branch !== '') {  // Explicit empty check
      console.log('Applying branch filter:', branch);
      const branchDept = branchMap[branch]?.Deptid;
      if (branchDept && branchDept !== staffDeptId) {
        console.log('Branch mismatch; ignoring filter for all-courses');
        // Skip to avoid empty results
      } else {
        whereClause += ` AND b.branch = ?`;
        params.push(branch);
      }
    } else {
      console.log('No branch filter applied (empty)');
    }
    if (semester) {
      whereClause += ` AND sem.semesterNumber = ?`;
      params.push(parseInt(semester));
    }
    if (batch) {
      whereClause += ` AND b.batch = ?`;
      params.push(batch);
    }
    if (type && ['THEORY', 'PRACTICAL', 'INTEGRATED', 'EXPERIENTIAL LEARNING'].includes(type)) {
      whereClause += ` AND c.type = ?`;
      params.push(type);
    }

    // 9 userId placeholders
    const caseParams = new Array(9).fill(userId);
    const allParams = [...params, ...caseParams];
    console.log('All params count:', allParams.length, 'First few:', allParams.slice(0, 3)); // Debug params

    const [courses] = await pool.execute(`
      SELECT 
        c.courseId, c.courseCode, c.courseTitle, c.category, c.type, c.credits,
        sem.semesterNumber, b.batch, b.branch, b.degree,
        CASE 
          WHEN EXISTS (SELECT 1 FROM StaffCourse sc WHERE sc.courseId = c.courseId AND sc.Userid = ?) THEN 'ALLOCATED'
          WHEN EXISTS (SELECT 1 FROM CourseRequest cr WHERE cr.courseId = c.courseId AND cr.staffId = ? AND cr.status = 'PENDING') THEN 'PENDING'
          WHEN EXISTS (SELECT 1 FROM CourseRequest cr WHERE cr.courseId = c.courseId AND cr.staffId = ? AND cr.status = 'REJECTED') THEN 'REJECTED'
          ELSE 'AVAILABLE'
        END AS status,
        CASE 
          WHEN EXISTS (SELECT 1 FROM StaffCourse sc WHERE sc.courseId = c.courseId AND sc.Userid = ?) THEN 
            (SELECT sc2.staffCourseId FROM StaffCourse sc2 WHERE sc2.courseId = c.courseId AND sc2.Userid = ? LIMIT 1)
          WHEN EXISTS (SELECT 1 FROM CourseRequest cr WHERE cr.courseId = c.courseId AND cr.staffId = ? AND cr.status = 'PENDING') THEN 
            (SELECT cr2.requestId FROM CourseRequest cr2 WHERE cr2.courseId = c.courseId AND cr2.staffId = ? AND cr2.status = 'PENDING' LIMIT 1)
          WHEN EXISTS (SELECT 1 FROM CourseRequest cr WHERE cr.courseId = c.courseId AND cr.staffId = ? AND cr.status = 'REJECTED') THEN 
            (SELECT cr2.requestId FROM CourseRequest cr2 WHERE cr2.courseId = c.courseId AND cr2.staffId = ? AND cr2.status = 'REJECTED' LIMIT 1)
          ELSE NULL 
        END AS actionId
      FROM Course c
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      LEFT JOIN Regulation r ON b.regulationId = r.regulationId
      ${whereClause}
      ORDER BY c.courseCode
    `, allParams);

    console.log('All-courses results count:', courses.length);
    res.json({ status: 'success', data: courses });
  } catch (err) {
    console.error('All-courses error:', err.message); // Specific log
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const sendCourseRequest = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.Userid;
    const staffDeptId = req.user.Deptid;

    // Check if staff dept matches course dept via join to Regulation
    const [course] = await pool.execute(`
      SELECT r.Deptid FROM Course c
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      LEFT JOIN Regulation r ON b.regulationId = r.regulationId
      WHERE c.courseId = ?
    `, [courseId]);
    if (course.length === 0 || course[0].Deptid !== staffDeptId) {
      return res.status(403).json({ status: 'error', message: 'Cannot request course outside your department' });
    }

    const [existing] = await pool.execute(
      'SELECT * FROM CourseRequest WHERE staffId = ? AND courseId = ?',
      [userId, courseId]
    );
    if (existing.length > 0) {
      if (existing[0].status === 'PENDING') {
        return res.status(400).json({ status: 'error', message: 'Request already pending' });
      } else if (existing[0].status === 'ACCEPTED') {
        return res.status(400).json({ status: 'error', message: 'Already assigned to this course' });
      }
      // For REJECTED, allow new request or resend via separate endpoint
    }

    await pool.execute(
      'INSERT INTO CourseRequest (staffId, courseId, createdBy) VALUES (?, ?, ?)',
      [userId, courseId, req.user.username]
    );

    res.json({ status: 'success', message: 'Request sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const cancelCourseRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.Userid;

    const [request] = await pool.execute(
      'SELECT * FROM CourseRequest WHERE requestId = ? AND staffId = ? AND status = "PENDING"',
      [requestId, userId]
    );
    if (request.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Pending request not found' });
    }

    await pool.execute(
      'DELETE FROM CourseRequest WHERE requestId = ?',
      [requestId]
    );

    res.json({ status: 'success', message: 'Request cancelled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// New function: Get top 5 recent request history
export const getRecentRequestHistory = async (req, res) => {
  try {
    const userId = req.user.Userid;

    const [history] = await pool.execute(`
      SELECT cr.*, c.courseCode, c.courseTitle, sem.semesterNumber, b.batch, b.branch
      FROM CourseRequest cr
      JOIN Course c ON cr.courseId = c.courseId
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      WHERE cr.staffId = ?
      ORDER BY cr.requestedAt DESC
      LIMIT 5
    `, [userId]);

    res.json({ status: 'success', data: history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// New function: Resend a rejected request (set status back to PENDING)
export const resendRejectedRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.Userid;

    const [request] = await pool.execute(
      'SELECT * FROM CourseRequest WHERE requestId = ? AND staffId = ? AND status = "REJECTED"',
      [requestId, userId]
    );
    if (request.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Rejected request not found' });
    }

    await pool.execute(
      `UPDATE CourseRequest 
       SET status = "PENDING", rejectedAt = NULL, updatedBy = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE requestId = ?`,
      [req.user.username, requestId]
    );

    res.json({ status: 'success', message: 'Request resent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getPendingRequestsForAdmin = async (req, res) => {
  try {
    const { semester, branch, dept, batch, type } = req.query; // Added type

    let whereClause = 'WHERE cr.status = "PENDING"';
    const params = [];

    if (branch) {
      whereClause += ' AND b.branch = ?';
      params.push(branch);
    }
    if (semester) {
      whereClause += ' AND sem.semesterNumber = ?';
      params.push(parseInt(semester));
    }
    if (dept) {
      whereClause += ' AND r.Deptid = ?';
      params.push(parseInt(dept));
    }
    if (batch) {
      whereClause += ' AND b.batch = ?';
      params.push(batch);
    }
    if (type && ['THEORY', 'PRACTICAL', 'INTEGRATED', 'EXPERIENTIAL LEARNING'].includes(type)) {
      whereClause += ' AND c.type = ?';
      params.push(type);
    }

    const [requests] = await pool.execute(`
      SELECT 
        cr.requestId, cr.status, cr.requestedAt,
        u.Userid AS staffId, u.username AS staffName, u.email,
        c.courseId, c.courseCode, c.courseTitle, c.credits,
        sem.semesterNumber, b.batch, b.branch, b.degree,
        d.Deptname AS deptName,
        (SELECT COUNT(*) FROM StaffCourse sc WHERE sc.courseId = c.courseId) AS assignedCount,
        (SELECT COUNT(*) FROM Section s WHERE s.courseId = c.courseId AND s.isActive = 'YES') AS sectionCount
      FROM CourseRequest cr
      JOIN users u ON cr.staffId = u.Userid
      JOIN Course c ON cr.courseId = c.courseId
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      LEFT JOIN Regulation r ON b.regulationId = r.regulationId
      LEFT JOIN department d ON r.Deptid = d.Deptid
      ${whereClause}
      ORDER BY cr.requestedAt DESC
    `, params);

    res.json({ status: 'success', data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const acceptCourseRequest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { requestId } = req.params;
    const [request] = await connection.execute(
      'SELECT * FROM CourseRequest WHERE requestId = ? AND status = "PENDING"',
      [requestId]
    );
    if (request.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'Pending request not found' });
    }

    const { courseId, staffId } = request[0];

    // Check if sections exist for the course; if none, error (no auto-create)
    const [existingSections] = await connection.execute(
      'SELECT COUNT(*) as count FROM Section WHERE courseId = ? AND isActive = "YES"',
      [courseId]
    );
    if (existingSections[0].count === 0) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'Slot or batch not available. No sections configured for this course.' });
    }

    // Find an available section (unassigned)
    const [availableSection] = await connection.execute(`
      SELECT s.sectionId 
      FROM Section s
      LEFT JOIN StaffCourse sc ON s.sectionId = sc.sectionId AND sc.courseId = ?
      WHERE s.courseId = ? AND s.isActive = "YES" AND sc.sectionId IS NULL
      LIMIT 1
    `, [courseId, courseId]);
    const sectionId = availableSection[0]?.sectionId;

    if (!sectionId) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'Slot or batch not available. All sections are filled.' });
    }

    // Accept request
    await connection.execute(
      `UPDATE CourseRequest 
       SET status = "ACCEPTED", approvedAt = CURRENT_TIMESTAMP, updatedBy = ?
       WHERE requestId = ?`,
      [req.user.username, requestId]
    );

    // Assign to StaffCourse
    const [staffDept] = await connection.execute('SELECT Deptid FROM users WHERE Userid = ?', [staffId]);
    await connection.execute(
      `INSERT INTO StaffCourse (Userid, courseId, sectionId, Deptid, createdBy)
       VALUES (?, ?, ?, ?, ?)`,
      [staffId, courseId, sectionId, staffDept[0].Deptid, req.user.username]
    );

    // Auto-reject other pending requests for this course if no more available sections
    const [remainingSections] = await connection.execute(
      `SELECT COUNT(*) as count FROM Section s
       LEFT JOIN StaffCourse sc ON s.sectionId = sc.sectionId AND sc.courseId = ?
       WHERE s.courseId = ? AND s.isActive = "YES" AND sc.sectionId IS NULL`,
      [courseId, courseId]
    );
    if (remainingSections[0].count === 0) {
      await connection.execute(
        `UPDATE CourseRequest 
         SET status = "REJECTED", rejectedAt = CURRENT_TIMESTAMP, updatedBy = ?
         WHERE courseId = ? AND status = "PENDING" AND requestId != ?`,
        [req.user.username, courseId, requestId]
      );
    }

    await connection.commit();
    res.json({ status: 'success', message: 'Request accepted and staff assigned to batch/section' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

export const rejectCourseRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const [request] = await pool.execute(
      'SELECT * FROM CourseRequest WHERE requestId = ? AND status = "PENDING"',
      [requestId]
    );
    if (request.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Pending request not found' });
    }

    await pool.execute(
      `UPDATE CourseRequest 
       SET status = "REJECTED", rejectedAt = CURRENT_TIMESTAMP, updatedBy = ?
       WHERE requestId = ?`,
      [req.user.username, requestId]
    );

    res.json({ status: 'success', message: 'Request rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const leaveCourse = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { staffCourseId } = req.params;
    const userId = req.user.Userid;

    const [assignment] = await connection.execute(
      'SELECT courseId FROM StaffCourse WHERE staffCourseId = ? AND Userid = ?',
      [staffCourseId, userId]
    );
    if (assignment.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'Assignment not found' });
    }

    const courseId = assignment[0].courseId;

    // Update CourseRequest status to WITHDRAWN to reflect cancellation
    const [updatedRequest] = await connection.execute(
      `UPDATE CourseRequest 
       SET status = "WITHDRAWN", withdrawnAt = CURRENT_TIMESTAMP, updatedBy = ?
       WHERE staffId = ? AND courseId = ? AND status = "ACCEPTED"`,
      [req.user.username, userId, courseId]
    );

    if (updatedRequest.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'Accepted request not found for this assignment' });
    }

    // Delete from StaffCourse
    await connection.execute(
      'DELETE FROM StaffCourse WHERE staffCourseId = ?',
      [staffCourseId]
    );

    await connection.commit();
    res.json({ status: 'success', message: 'Left course successfully (slot freed for new assignment)' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

export const getMyRequests = async (req, res) => {
  try {
    const userId = req.user.Userid;

    const [requests] = await pool.execute(`
      SELECT cr.*, c.courseCode, c.courseTitle, sem.semesterNumber, b.batch, b.branch,
        CASE 
          WHEN cr.status = 'ACCEPTED' THEN (SELECT sc.staffCourseId FROM StaffCourse sc WHERE sc.courseId = c.courseId AND sc.Userid = ? LIMIT 1)
          ELSE cr.requestId 
        END AS actionId
      FROM CourseRequest cr
      JOIN Course c ON cr.courseId = c.courseId
      JOIN Semester sem ON c.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      WHERE cr.staffId = ? AND cr.status IN ('PENDING', 'ACCEPTED', 'REJECTED')
      ORDER BY cr.requestedAt DESC
    `, [userId, userId]);

    res.json({ status: 'success', data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};
import pool from '../db.js';
import catchAsync from '../utils/catchAsync.js';

export const getAllTimetableBatches = catchAsync(async (req, res) => {
  const userEmail = req.user?.email || 'admin';
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Validate user
    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
        data: [],
      });
    }

    const [rows] = await connection.execute(
      'SELECT batchId, degree, branch, batch, batchYears FROM Batch WHERE IsActive = "YES"'
    );

    await connection.commit();
    res.status(200).json({
      status: 'success',
      data: rows || [],
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error fetching timetable batches:', error);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch batches for timetable: ' + error.message,
      data: [],
    });
  } finally {
    if (connection) connection.release();
  }
});

export const getAllTimetableDepartments = catchAsync(async (req, res) => {
  const userEmail = req.user?.email || 'admin';
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Validate user
    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
        data: [],
      });
    }

    const [rows] = await connection.execute(
      'SELECT Deptid, deptCode, Deptname FROM Department'
    );

    await connection.commit();
    res.status(200).json({
      status: 'success',
      data: rows || [],
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error fetching timetable departments:', error);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch departments for timetable: ' + error.message,
      data: [],
    });
  } finally {
    if (connection) connection.release();
  }
});

export const getTimetable = catchAsync(async (req, res) => {
  const { semesterId } = req.params;
  const userEmail = req.user?.email || 'admin';
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Validate user
    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
        data: [],
      });
    }

    // Validate semesterId
    if (!semesterId || isNaN(semesterId)) {
      return res.status(400).json({
        status: 'failure',
        message: 'Invalid semesterId',
        data: [],
      });
    }

    const [semesterRows] = await connection.execute(
      `SELECT semesterId FROM Semester WHERE semesterId = ? AND IsActive = 'YES'`,
      [semesterId]
    );
    if (semesterRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active semester found with semesterId ${semesterId}`,
        data: [],
      });
    }

    const [rows] = await connection.execute(
      `
      SELECT t.timetableId, t.courseCode, t.sectionId, t.dayOfWeek, t.periodNumber, 
             c.courseTitle, s.sectionName
      FROM Timetable t
      LEFT JOIN Course c ON t.courseCode = c.courseCode
      LEFT JOIN Section s ON t.sectionId = s.sectionId
      WHERE t.semesterId = ? AND t.IsActive = 'YES' AND c.IsActive = 'YES' AND s.IsActive = 'YES'
      `,
      [semesterId]
    );

    await connection.commit();
    res.status(200).json({
      status: 'success',
      data: rows || [],
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error fetching timetable:', error);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch timetable: ' + error.message,
      data: [],
    });
  } finally {
    if (connection) connection.release();
  }
});

export const getTimetableByFilters = catchAsync(async (req, res) => {
  const { degree, Deptid, semesterNumber } = req.query;
  const userEmail = req.user?.email || 'admin';
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Validate user
    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND IsActive = "YES"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
        data: [],
      });
    }

    // Validate inputs
    if (!degree || !Deptid || !semesterNumber) {
      return res.status(400).json({
        status: 'failure',
        message: 'degree, Deptid, and semesterNumber are required',
        data: [],
      });
    }

    // Validate Deptid
    const [deptRows] = await connection.execute(
      'SELECT Deptid FROM Department WHERE Deptid = ?',
      [Deptid]
    );
    if (deptRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No department found with Deptid ${Deptid}`,
        data: [],
      });
    }

    const query = `
      SELECT t.timetableId, t.courseCode, t.sectionId, t.dayOfWeek, t.periodNumber, 
             c.courseTitle, s.sectionName
      FROM Timetable t
      LEFT JOIN Course c ON t.courseCode = c.courseCode
      LEFT JOIN Section s ON t.sectionId = s.sectionId
      JOIN Semester sem ON t.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      WHERE b.degree = ? AND t.Deptid = ? AND sem.semesterNumber = ? 
            AND t.IsActive = 'YES' AND c.IsActive = 'YES' AND s.IsActive = 'YES' AND b.IsActive = 'YES'
    `;
    const [rows] = await connection.execute(query, [degree, Deptid, semesterNumber]);

    await connection.commit();
    res.status(200).json({
      status: 'success',
      data: rows || [],
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error fetching timetable by filters:', error);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch timetable by filters: ' + error.message,
      data: [],
    });
  } finally {
    if (connection) connection.release();
  }
});

export const createTimetableEntry = catchAsync(async (req, res) => {
  const { courseCode, sectionId, dayOfWeek, periodNumber, Deptid, semesterId } = req.body;
  const userEmail = req.user?.email || 'admin';
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

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

    // Validate required fields
    if (!courseCode || !dayOfWeek || !periodNumber || !Deptid || !semesterId) {
      return res.status(400).json({
        status: 'failure',
        message: 'courseCode, dayOfWeek, periodNumber, Deptid, and semesterId are required',
      });
    }

    // Validate courseCode
    const [courseRows] = await connection.execute(
      'SELECT courseId FROM Course WHERE courseCode = ? AND IsActive = "YES"',
      [courseCode]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active course found with courseCode ${courseCode}`,
      });
    }

    // Validate semesterId
    const [semesterRows] = await connection.execute(
      'SELECT semesterId FROM Semester WHERE semesterId = ? AND IsActive = "YES"',
      [semesterId]
    );
    if (semesterRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active semester found with semesterId ${semesterId}`,
      });
    }

    // Validate Deptid
    const [deptRows] = await connection.execute(
      'SELECT Deptid FROM Department WHERE Deptid = ?',
      [Deptid]
    );
    if (deptRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No department found with Deptid ${Deptid}`,
      });
    }

    // Define valid teaching periods (1-8, excluding breaks)
    const validTeachingPeriods = [1, 2, 3, 4, 5, 6, 7, 8];
    if (!validTeachingPeriods.includes(Number(periodNumber))) {
      return res.status(400).json({
        status: 'failure',
        message: 'Invalid period number: must be a valid teaching period (1-8)',
      });
    }

    // Check for conflicts
    const [conflictCheck] = await connection.execute(
      'SELECT timetableId FROM Timetable WHERE semesterId = ? AND dayOfWeek = ? AND periodNumber = ? AND IsActive = "YES"',
      [semesterId, dayOfWeek, periodNumber]
    );
    if (conflictCheck.length > 0) {
      return res.status(400).json({
        status: 'failure',
        message: 'Time slot already assigned',
      });
    }

    // Validate sectionId if provided
    if (sectionId) {
      const [sectionCheck] = await connection.execute(
        'SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND IsActive = "YES"',
        [sectionId, courseCode]
      );
      if (sectionCheck.length === 0) {
        return res.status(404).json({
          status: 'failure',
          message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
        });
      }
    }

    const [result] = await connection.execute(
      `
      INSERT INTO Timetable (courseCode, sectionId, dayOfWeek, periodNumber, Deptid, semesterId, IsActive, createdBy, updatedBy)
      VALUES (?, ?, ?, ?, ?, ?, 'YES', ?, ?)
      `,
      [courseCode, sectionId || null, dayOfWeek, periodNumber, Deptid, semesterId, userEmail, userEmail]
    );

    await connection.commit();
    res.status(201).json({
      status: 'success',
      timetableId: result.insertId,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating timetable entry:', error);
    res.status(400).json({
      status: 'failure',
      message: 'Failed to create timetable entry: ' + error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

export const updateTimetableEntry = catchAsync(async (req, res) => {
  const { timetableId } = req.params;
  const { courseCode, sectionId, dayOfWeek, periodNumber, Deptid, semesterId } = req.body;
  const userEmail = req.user?.email || 'admin';
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

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

    // Validate required fields
    if (!courseCode || !dayOfWeek || !periodNumber || !Deptid || !semesterId) {
      return res.status(400).json({
        status: 'failure',
        message: 'courseCode, dayOfWeek, periodNumber, Deptid, and semesterId are required',
      });
    }

    // Validate timetableId
    const [timetableRows] = await connection.execute(
      'SELECT timetableId FROM Timetable WHERE timetableId = ? AND IsActive = "YES"',
      [timetableId]
    );
    if (timetableRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active timetable entry found with timetableId ${timetableId}`,
      });
    }

    // Validate courseCode
    const [courseRows] = await connection.execute(
      'SELECT courseId FROM Course WHERE courseCode = ? AND IsActive = "YES"',
      [courseCode]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active course found with courseCode ${courseCode}`,
      });
    }

    // Validate semesterId
    const [semesterRows] = await connection.execute(
      'SELECT semesterId FROM Semester WHERE semesterId = ? AND IsActive = "YES"',
      [semesterId]
    );
    if (semesterRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active semester found with semesterId ${semesterId}`,
      });
    }

    // Validate Deptid
    const [deptRows] = await connection.execute(
      'SELECT Deptid FROM Department WHERE Deptid = ?',
      [Deptid]
    );
    if (deptRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No department found with Deptid ${Deptid}`,
      });
    }

    // Validate periodNumber
    const validTeachingPeriods = [1, 2, 3, 4, 5, 6, 7, 8];
    if (!validTeachingPeriods.includes(Number(periodNumber))) {
      return res.status(400).json({
        status: 'failure',
        message: 'Invalid period number: must be a valid teaching period (1-8)',
      });
    }

    // Check for conflicts
    const [conflictCheck] = await connection.execute(
      'SELECT timetableId FROM Timetable WHERE semesterId = ? AND dayOfWeek = ? AND periodNumber = ? AND timetableId != ? AND IsActive = "YES"',
      [semesterId, dayOfWeek, periodNumber, timetableId]
    );
    if (conflictCheck.length > 0) {
      return res.status(400).json({
        status: 'failure',
        message: 'Time slot already assigned',
      });
    }

    // Validate sectionId if provided
    if (sectionId) {
      const [sectionCheck] = await connection.execute(
        'SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND IsActive = "YES"',
        [sectionId, courseCode]
      );
      if (sectionCheck.length === 0) {
        return res.status(404).json({
          status: 'failure',
          message: `No active section found with sectionId ${sectionId} for courseCode ${courseCode}`,
        });
      }
    }

    const [result] = await connection.execute(
      `
      UPDATE Timetable
      SET courseCode = ?, sectionId = ?, dayOfWeek = ?, periodNumber = ?, Deptid = ?, semesterId = ?, updatedBy = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE timetableId = ?
      `,
      [courseCode, sectionId || null, dayOfWeek, periodNumber, Deptid, semesterId, userEmail, timetableId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'failure',
        message: 'Timetable entry not found',
      });
    }

    await connection.commit();
    res.status(200).json({
      status: 'success',
      message: 'Timetable entry updated',
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error updating timetable entry:', error);
    res.status(400).json({
      status: 'failure',
      message: 'Failed to update timetable entry: ' + error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

export const deleteTimetableEntry = catchAsync(async (req, res) => {
  const { timetableId } = req.params;
  const userEmail = req.user?.email || 'admin';
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

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

    // Validate timetableId
    const [timetableRows] = await connection.execute(
      'SELECT timetableId FROM Timetable WHERE timetableId = ? AND IsActive = "YES"',
      [timetableId]
    );
    if (timetableRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active timetable entry found with timetableId ${timetableId}`,
      });
    }

    // Soft delete
    const [result] = await connection.execute(
      'UPDATE Timetable SET IsActive = "NO", updatedBy = ?, updatedAt = CURRENT_TIMESTAMP WHERE timetableId = ?',
      [userEmail, timetableId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'failure',
        message: 'Timetable entry not found',
      });
    }

    await connection.commit();
    res.status(200).json({
      status: 'success',
      message: 'Timetable entry deleted',
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error deleting timetable entry:', error);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to delete timetable entry: ' + error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});
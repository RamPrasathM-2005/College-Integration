import pool from '../db.js';

export const getAllTimetableBatches = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT batchId, degree, branch, batch, batchYears FROM Batch WHERE isActive = "YES"'
    );
    res.status(200).json({
      status: 'success',
      data: rows || [],
    });
  } catch (error) {
    console.error('Error fetching timetable batches:', error);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch batches for timetable',
      data: [],
    });
  } finally {
    if (connection) connection.release();
  }
};

export const getAllTimetableDepartments = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT departmentId, departmentCode, departmentName FROM Department WHERE isActive = "YES"'
    );
    res.status(200).json({
      status: 'success',
      data: rows || [],
    });
  } catch (error) {
    console.error('Error fetching timetable departments:', error);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch departments for timetable',
      data: [],
    });
  } finally {
    if (connection) connection.release();
  }
};

export const getTimetable = async (req, res) => {
  const { semesterId } = req.params;
  let connection;

  try {
    if (!semesterId || isNaN(semesterId)) {
      return res.status(400).json({ status: 'failure', message: 'Invalid semesterId', data: [] });
    }

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `
      SELECT t.timetableId, t.courseCode, t.sectionId, t.dayOfWeek, t.periodNumber, 
             c.courseTitle, s.sectionName
      FROM Timetable t
      LEFT JOIN Course c ON t.courseCode = c.courseCode
      LEFT JOIN Section s ON t.sectionId = s.sectionId
      WHERE t.semesterId = ? AND t.isActive = 'YES'
      `,
      [semesterId]
    );

    res.status(200).json({ status: 'success', data: rows || [] });
  } catch (error) {
    console.error('Error fetching timetable:', error, error.stack);
    res.status(500).json({ status: 'failure', message: `Failed to fetch timetable: ${error.message}`, data: [] });
  } finally {
    if (connection) connection.release();
  }
};

export const getTimetableByFilters = async (req, res) => {
  const { degree, departmentId, semesterNumber } = req.query;
  let connection;

  try {
    connection = await pool.getConnection();
    const query = `
      SELECT t.timetableId, t.courseCode, t.sectionId, t.dayOfWeek, t.periodNumber, 
             c.courseTitle, s.sectionName
      FROM Timetable t
      LEFT JOIN Course c ON t.courseCode = c.courseCode
      LEFT JOIN Section s ON t.sectionId = s.sectionId
      JOIN Semester sem ON t.semesterId = sem.semesterId
      JOIN Batch b ON sem.batchId = b.batchId
      WHERE b.degree = ? AND t.departmentId = ? AND sem.semesterNumber = ?
    `;
    const [rows] = await connection.execute(query, [degree, departmentId, semesterNumber]);

    res.status(200).json({ status: 'success', data: rows || [] });
  } catch (error) {
    console.error('Error fetching timetable by filters:', error);
    res.status(500).json({ status: 'failure', message: 'Failed to fetch timetable by filters', data: [] });
  } finally {
    if (connection) connection.release();
  }
};

export const createTimetableEntry = async (req, res) => {
  const { courseCode, sectionId, dayOfWeek, periodNumber, departmentId, semesterId } = req.body;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Validate required fields
    if (!courseCode || !dayOfWeek || !periodNumber || !departmentId || !semesterId) {
      throw new Error('Missing required fields');
    }

    // Define valid teaching periods (1-8, excluding breaks)
    const validTeachingPeriods = [1, 2, 3, 4, 5, 6, 7, 8];
    if (!validTeachingPeriods.includes(Number(periodNumber))) {
      throw new Error('Invalid period number: must be a valid teaching period (1-8)');
    }

    // Check for conflicts (same semester, day, period)
    const [conflictCheck] = await connection.execute(
      'SELECT timetableId FROM Timetable WHERE semesterId = ? AND dayOfWeek = ? AND periodNumber = ? AND isActive = "YES"',
      [semesterId, dayOfWeek, periodNumber]
    );
    if (conflictCheck.length > 0) {
      throw new Error('Time slot already assigned');
    }

    // Validate sectionId if provided
    if (sectionId) {
      const [sectionCheck] = await connection.execute(
        'SELECT sectionId FROM Section WHERE sectionId = ? AND isActive = "YES"',
        [sectionId]
      );
      if (sectionCheck.length === 0) {
        throw new Error('Invalid section');
      }
    }

    const [result] = await connection.execute(
      `
      INSERT INTO Timetable (courseCode, sectionId, dayOfWeek, periodNumber, departmentId, semesterId, isActive, createdBy, updatedBy)
      VALUES (?, ?, ?, ?, ?, ?, 'YES', ?, ?)
      `,
      [courseCode, sectionId || null, dayOfWeek, periodNumber, departmentId, semesterId, 'admin', 'admin']
    );

    await connection.commit();
    res.status(201).json({ status: 'success', timetableId: result.insertId });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating timetable entry:', error, error.stack);
    res.status(400).json({ status: 'failure', message: error.message || 'Failed to create timetable entry' });
  } finally {
    if (connection) connection.release();
  }
};

export const updateTimetableEntry = async (req, res) => {
  const { timetableId } = req.params;
  const { courseCode, sectionId, dayOfWeek, periodNumber, departmentId, semesterId } = req.body;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Validate required fields
    if (!courseCode || !dayOfWeek || !periodNumber || !departmentId || !semesterId) {
      throw new Error('Missing required fields');
    }

    // Define valid teaching periods (1-8, excluding breaks)
    const validTeachingPeriods = [1, 2, 3, 4, 5, 6, 7, 8];
    if (!validTeachingPeriods.includes(Number(periodNumber))) {
      throw new Error('Invalid period number: must be a valid teaching period (1-8)');
    }

    // Check for conflicts (same semester, day, period, excluding current entry)
    const [conflictCheck] = await connection.execute(
      'SELECT timetableId FROM Timetable WHERE semesterId = ? AND dayOfWeek = ? AND periodNumber = ? AND timetableId != ? AND isActive = "YES"',
      [semesterId, dayOfWeek, periodNumber, timetableId]
    );
    if (conflictCheck.length > 0) {
      throw new Error('Time slot already assigned');
    }

    // Validate sectionId if provided
    if (sectionId) {
      const [sectionCheck] = await connection.execute(
        'SELECT sectionId FROM Section WHERE sectionId = ? AND isActive = "YES"',
        [sectionId]
      );
      if (sectionCheck.length === 0) {
        throw new Error('Invalid section');
      }
    }

    const [result] = await connection.execute(
      `
      UPDATE Timetable
      SET courseCode = ?, sectionId = ?, dayOfWeek = ?, periodNumber = ?, departmentId = ?, semesterId = ?, updatedBy = ?
      WHERE timetableId = ?
      `,
      [courseCode, sectionId || null, dayOfWeek, periodNumber, departmentId, semesterId, 'admin', timetableId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Timetable entry not found');
    }

    await connection.commit();
    res.status(200).json({ status: 'success', message: 'Timetable entry updated' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error updating timetable entry:', error, error.stack);
    res.status(400).json({ status: 'failure', message: error.message || 'Failed to update timetable entry' });
  } finally {
    if (connection) connection.release();
  }
};

export const deleteTimetableEntry = async (req, res) => {
  const { timetableId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();
    const [result] = await connection.execute('DELETE FROM Timetable WHERE timetableId = ?', [timetableId]);

    if (result.affectedRows === 0) {
      throw new Error('Timetable entry not found');
    }

    res.status(200).json({ status: 'success', message: 'Timetable entry deleted' });
  } catch (error) {
    console.error('Error deleting timetable entry:', error);
    res.status(500).json({ status: 'failure', message: error.message || 'Failed to delete timetable entry' });
  } finally {
    if (connection) connection.release();
  }
};
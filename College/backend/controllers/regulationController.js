import pool from '../db.js';

export const getAllRegulations = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT r.regulationId, r.Deptid, r.regulationYear, d.Deptacronym
      FROM Regulation r
      JOIN department d ON r.Deptid = d.Deptid
      WHERE r.isActive = 'YES'
    `);
    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error fetching regulations:', err);
    res.status(500).json({ status: 'failure', message: 'Server error: ' + err.message });
  }
};

export const getVerticalsByRegulation = async (req, res) => {
  const { regulationId } = req.params;
  try {
    const [rows] = await pool.execute(
      'SELECT verticalId, verticalName FROM Vertical WHERE regulationId = ? AND isActive = "YES"',
      [regulationId]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error fetching verticals:', err);
    res.status(500).json({ status: 'failure', message: 'Server error: ' + err.message });
  }
};

export const createVertical = async (req, res) => {
  const { regulationId, verticalName } = req.body;
  const createdBy = req.user?.username || 'admin';
  const updatedBy = createdBy;

  if (!regulationId || !verticalName) {
    return res.status(400).json({ status: 'failure', message: 'Regulation ID and vertical name are required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO Vertical (regulationId, verticalName, createdBy, updatedBy)
       VALUES (?, ?, ?, ?)`,
      [regulationId, verticalName, createdBy, updatedBy]
    );
    res.json({ status: 'success', message: 'Vertical added successfully', data: { verticalId: result.insertId } });
  } catch (err) {
    console.error('Error adding vertical:', err);
    res.status(500).json({ status: 'failure', message: 'Server error: ' + err.message });
  }
};

export const importRegulationCourses = async (req, res) => {
  const { regulationId, courses } = req.body;
  const createdBy = req.user?.username || 'admin';
  const updatedBy = createdBy;

  if (!regulationId || !Array.isArray(courses) || courses.length === 0) {
    return res.status(400).json({ status: 'failure', message: 'Regulation ID and courses array are required' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get semesters for the regulation
    const [semesters] = await connection.execute(
      `SELECT s.semesterId, s.semesterNumber
       FROM Semester s
       WHERE s.batchId IN (
         SELECT b.batchId 
         FROM Batch b
         WHERE b.isActive = 'YES'
       )`,
      []
    );

    const semesterMap = semesters.reduce((map, sem) => {
      map[sem.semesterNumber] = sem.semesterId;
      return map;
    }, {});

    const courseInserts = courses.map(async (course) => {
      const {
        courseCode, courseTitle, category, lectureHours, tutorialHours,
        practicalHours, experientialHours, totalContactPeriods, credits,
        minMark, maxMark, semesterNumber
      } = course;

      if (!semesterMap[semesterNumber]) {
        throw new Error(`Invalid semester number ${semesterNumber} for regulation ${regulationId}`);
      }

      const [result] = await connection.execute(
        `INSERT INTO Course (
          courseCode, semesterId, courseTitle, category, type,
          lectureHours, tutorialHours, practicalHours, experientialHours,
          totalContactPeriods, credits, minMark, maxMark, createdBy, updatedBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          courseCode,
          semesterMap[semesterNumber],
          courseTitle,
          category.toUpperCase(),
          determineCourseType(lectureHours, tutorialHours, practicalHours, experientialHours),
          lectureHours,
          tutorialHours,
          practicalHours,
          experientialHours,
          totalContactPeriods,
          credits,
          minMark,
          maxMark,
          createdBy,
          updatedBy
        ]
      );
      return result.insertId;
    });

    await Promise.all(courseInserts);
    await connection.commit();
    res.json({ status: 'success', message: 'Courses added successfully' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Error adding courses:', err);
    res.status(500).json({ status: 'failure', message: 'Server error: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
};

export const allocateCoursesToVertical = async (req, res) => {
  const { verticalId, courseIds } = req.body;
  const createdBy = req.user?.username || 'admin';
  const updatedBy = createdBy;

  if (!verticalId || !Array.isArray(courseIds) || courseIds.length === 0) {
    return res.status(400).json({ status: 'failure', message: 'Vertical ID and course IDs are required' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const inserts = courseIds.map(courseId =>
      connection.execute(
        `INSERT INTO VerticalCourse (verticalId, courseId, createdBy, updatedBy)
         VALUES (?, ?, ?, ?)`,
        [verticalId, courseId, createdBy, updatedBy]
      )
    );

    await Promise.all(inserts);
    await connection.commit();
    res.json({ status: 'success', message: 'Courses allocated to vertical successfully' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Error allocating courses:', err);
    res.status(500).json({ status: 'failure', message: 'Server error: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
};

export const getAvailableCoursesForVertical = async (req, res) => {
  const { regulationId } = req.params;
  try {
    const [rows] = await pool.execute(`
      SELECT c.courseId, c.courseCode, c.courseTitle, c.category, c.semesterId, s.semesterNumber
      FROM Course c
      JOIN Semester s ON c.semesterId = s.semesterId
      LEFT JOIN VerticalCourse vc ON c.courseId = vc.courseId
      WHERE c.category IN ('PEC', 'OEC') AND vc.courseId IS NULL
      AND c.isActive = 'YES'
      AND s.batchId IN (
        SELECT b.batchId 
        FROM Batch b
        WHERE b.isActive = 'YES'
      )
    `, []);
    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error fetching available courses:', err);
    res.status(500).json({ status: 'failure', message: 'Server error: ' + err.message });
  }
};

const determineCourseType = (lectureHours, tutorialHours, practicalHours, experientialHours) => {
  if (experientialHours > 0) return 'EXPERIENTIAL LEARNING';
  if (practicalHours > 0) {
    if (lectureHours > 0 || tutorialHours > 0) return 'INTEGRATED';
    return 'PRACTICAL';
  }
  return 'THEORY';
};
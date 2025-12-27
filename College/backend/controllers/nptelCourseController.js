import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";
import Joi from 'joi';

const validNptelTypes = ['OEC', 'PEC'];

const nptelCourseSchema = Joi.object({
  courseTitle: Joi.string().trim().max(255).required(),
  courseCode: Joi.string().trim().max(50).required(),
  type: Joi.string().valid(...validNptelTypes).required(),
  credits: Joi.number().integer().min(1).max(10).required(),
  semesterId: Joi.number().integer().positive().required(),
});

export const addNptelCourse = catchAsync(async (req, res) => {
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { error, value } = nptelCourseSchema.validate(req.body, {
      abortEarly: false,
      convert: true,
    });

    if (error) {
      return res.status(400).json({
        status: 'failure',
        message: 'Validation error: ' + error.details.map(d => d.message).join('; '),
      });
    }

    const { courseTitle, courseCode, type, credits, semesterId } = value;

    // Validate semester exists and is active
    const [semesterRows] = await connection.execute(
      `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
      [semesterId]
    );
    if (semesterRows.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active semester found with ID ${semesterId}`,
      });
    }

    // Check for duplicate courseCode in same semester
    const [existing] = await connection.execute(
      `SELECT nptelCourseId FROM NptelCourse WHERE courseCode = ? AND semesterId = ? AND isActive = 'YES'`,
      [courseCode, semesterId]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        status: 'failure',
        message: `NPTEL course with code ${courseCode} already exists in this semester`,
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO NptelCourse 
         (courseTitle, courseCode, type, credits, semesterId, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [courseTitle, courseCode, type, credits, semesterId, userEmail, userEmail]
    );

    await connection.commit();

    res.status(201).json({
      status: 'success',
      message: 'NPTEL course added successfully',
      nptelCourseId: result.insertId,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error adding NPTEL course:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

export const bulkAddNptelCourses = catchAsync(async (req, res) => {
  const { courses } = req.body;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  if (!Array.isArray(courses) || courses.length === 0) {
    return res.status(400).json({
      status: 'failure',
      message: 'No courses provided for bulk import',
    });
  }

  try {
    await connection.beginTransaction();
    let importedCount = 0;
    const errors = [];

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      const { error, value } = nptelCourseSchema.validate(course, { convert: true });

      if (error) {
        errors.push(`Row ${i + 2}: Validation failed - ${error.details.map(d => d.message).join(', ')}`);
        continue;
      }

      const { courseTitle, courseCode, type, credits, semesterId } = value;

      // Validate semester
      const [semesterRows] = await connection.execute(
        `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
        [semesterId]
      );
      if (semesterRows.length === 0) {
        errors.push(`Row ${i + 2}: Invalid or inactive semesterId ${semesterId}`);
        continue;
      }

      // Check duplicate
      const [existing] = await connection.execute(
        `SELECT nptelCourseId FROM NptelCourse WHERE courseCode = ? AND semesterId = ? AND isActive = 'YES'`,
        [courseCode, semesterId]
      );
      if (existing.length > 0) {
        errors.push(`Row ${i + 2}: Duplicate courseCode ${courseCode} in semester ${semesterId}`);
        continue;
      }

      await connection.execute(
        `INSERT INTO NptelCourse 
           (courseTitle, courseCode, type, credits, semesterId, createdBy, updatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [courseTitle, courseCode, type, credits, semesterId, userEmail, userEmail]
      );
      importedCount++;
    }

    await connection.commit();

    res.status(200).json({
      status: 'success',
      message: `Successfully imported ${importedCount} NPTEL courses`,
      importedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Bulk NPTEL import error:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error during bulk import: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

export const getAllNptelCourses = catchAsync(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(`
  SELECT nc.*, s.semesterNumber, b.branch, b.batch
  FROM NptelCourse nc
  JOIN Semester s ON nc.semesterId = s.semesterId
  JOIN Batch b ON s.batchId = b.batchId
  WHERE nc.isActive = 'YES'
  ORDER BY nc.nptelCourseId DESC
`);

    res.status(200).json({
      status: 'success',
      data: rows,
      results: rows.length,
    });
  } catch (err) {
    console.error('Error fetching NPTEL courses:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Failed to fetch NPTEL courses',
    });
  } finally {
    connection.release();
  }
});

export const updateNptelCourse = catchAsync(async (req, res) => {
  const { nptelCourseId } = req.params;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { error, value } = nptelCourseSchema.validate(req.body, {
      abortEarly: false,
      convert: true,
      allowUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        status: 'failure',
        message: 'Validation error: ' + error.details.map(d => d.message).join('; '),
      });
    }

    const { courseTitle, courseCode, type, credits, semesterId } = value;

    // Check if course exists
    const [existing] = await connection.execute(
      `SELECT nptelCourseId FROM NptelCourse WHERE nptelCourseId = ? AND isActive = 'YES'`,
      [nptelCourseId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: 'NPTEL course not found',
      });
    }

    // Validate semester if changed
    if (semesterId) {
      const [sem] = await connection.execute(
        `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
        [semesterId]
      );
      if (sem.length === 0) {
        return res.status(400).json({
          status: 'failure',
          message: 'Invalid semester',
        });
      }
    }

    // Prevent duplicate code in same semester
    if (courseCode && semesterId) {
      const [dup] = await connection.execute(
        `SELECT nptelCourseId FROM NptelCourse 
         WHERE courseCode = ? AND semesterId = ? AND nptelCourseId != ? AND isActive = 'YES'`,
        [courseCode, semesterId, nptelCourseId]
      );
      if (dup.length > 0) {
        return res.status(400).json({
          status: 'failure',
          message: `Course code ${courseCode} already exists in this semester`,
        });
      }
    }

    await connection.execute(
      `UPDATE NptelCourse 
       SET courseTitle = ?, courseCode = ?, type = ?, credits = ?, semesterId = ?, updatedBy = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE nptelCourseId = ?`,
      [courseTitle, courseCode, type, credits, semesterId, userEmail, nptelCourseId]
    );

    await connection.commit();

    res.status(200).json({
      status: 'success',
      message: 'NPTEL course updated successfully',
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error updating NPTEL course:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error',
    });
  } finally {
    connection.release();
  }
});

export const deleteNptelCourse = catchAsync(async (req, res) => {
  const { nptelCourseId } = req.params;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT nptelCourseId FROM NptelCourse WHERE nptelCourseId = ? AND isActive = 'YES'`,
      [nptelCourseId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: 'NPTEL course not found',
      });
    }

    await connection.execute(
      `UPDATE NptelCourse SET isActive = 'NO', updatedBy = ?, updatedAt = CURRENT_TIMESTAMP WHERE nptelCourseId = ?`,
      [userEmail, nptelCourseId]
    );

    await connection.commit();

    res.status(200).json({
      status: 'success',
      message: 'NPTEL course deleted successfully',
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error deleting NPTEL course:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error',
    });
  } finally {
    connection.release();
  }
});

export const getPendingNptelTransfers = catchAsync(async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT 
      nct.transferId,
      nct.regno,
      u.username AS studentName,
      nc.courseTitle,
      nc.courseCode,
      nc.type,
      nc.credits,
      nct.grade,
      nct.status,
      nct.requestedAt,
      nct.remarks
    FROM NptelCreditTransfer nct
    JOIN StudentNptelEnrollment sne ON nct.enrollmentId = sne.enrollmentId
    JOIN NptelCourse nc ON nct.nptelCourseId = nc.nptelCourseId
    JOIN users u ON (SELECT Userid FROM student_details WHERE regno = nct.regno) = u.Userid
    ORDER BY nct.requestedAt DESC
  `);

  res.status(200).json({
    status: "success",
    data: rows
  });
});

export const approveRejectTransfer = catchAsync(async (req, res) => {
  const { transferId, action, remarks } = req.body;

  if (!['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ status: "failure", message: "Invalid action" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `UPDATE NptelCreditTransfer 
       SET status = ?, reviewedAt = NOW(), reviewedBy = ?, remarks = ?
       WHERE transferId = ?`,
      [action, req.user.email || 'admin', remarks || null, transferId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Request not found");
    }

    await connection.commit();

    res.status(200).json({
      status: "success",
      message: `Request ${action} successfully`
    });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ status: "failure", message: err.message });
  } finally {
    connection.release();
  }
});
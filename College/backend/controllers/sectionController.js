import pool from '../db.js';
import catchAsync from '../utils/catchAsync.js';

export const addSectionsToCourse = catchAsync(async (req, res) => {
  const { courseCode } = req.params;
  const { numberOfSections } = req.body;
  const userEmail = req.user?.email || 'admin';

  if (!courseCode || !numberOfSections || isNaN(numberOfSections) || numberOfSections < 1) {
    return res.status(400).json({
      status: 'failure',
      message: 'courseCode and a valid numberOfSections (minimum 1) are required',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Validate user email
    const [userCheck] = await connection.execute(
      'SELECT Userid FROM users WHERE Email = ? AND status = "active"',
      [userEmail]
    );
    if (userCheck.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active user found with email ${userEmail}`,
      });
    }

    // Validate course
    const [courseRows] = await connection.execute(
      `SELECT courseId FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
      [courseCode]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active course found with courseCode ${courseCode}`,
      });
    }



    // Find the current maximum Batch number among active sections
    const [maxRows] = await connection.execute(
      `SELECT MAX(CAST(SUBSTRING(sectionName, 6) AS UNSIGNED)) as maxNum 
       FROM Section 
       WHERE courseCode = ? AND sectionName LIKE 'Batch%' AND IsActive = 'YES'`,
      [courseCode]
    );
    const currentMax = maxRows[0].maxNum || 0;
    

    console.log(currentMax);

    const sectionsToAdd = [];
    let newSectionsAdded = 0;
    for (let i = 1; i <= numberOfSections; i++) {
      const sectionNum = currentMax + i;
      const sectionName = `Batch ${sectionNum}`;
      sectionsToAdd.push([courseCode, sectionName, userEmail, userEmail]);
      newSectionsAdded++;
    }

    // Insert new sections
    if (sectionsToAdd.length > 0) {
      const placeholders = sectionsToAdd.map(() => "(?, ?, ?, ?)").join(",");
      const query = `
        INSERT INTO Section (courseCode, sectionName, createdBy, updatedBy)
        VALUES ${placeholders}
      `;
      const values = sectionsToAdd.flat();
      await connection.execute(query, values);
    }

    console.log('inserting......');

    await connection.commit();
    res.status(201).json({
      status: 'success',
      message: `${newSectionsAdded} new section(s) added to course ${courseCode} successfully`,
      data: sectionsToAdd.map(([_, sectionName]) => ({ sectionName })),
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error adding sections:', err);
    res.status(500).json({ status: 'failure', message: 'Failed to add sections' });
  } finally {
    connection.release();
  }
});

export const getSectionsForCourse = catchAsync(async (req, res) => {
  const { courseCode } = req.params;

  const connection = await pool.getConnection();
  try {
    const [sectionRows] = await connection.execute(
      `SELECT sectionId, sectionName FROM Section WHERE courseCode = ? AND IsActive = 'YES'`,
      [courseCode]
    );
    res.status(200).json({
      status: 'success',
      data: sectionRows.map(row => ({ sectionId: row.sectionId, sectionName: row.sectionName })),
    });
  } catch (err) {
    console.error('Error fetching sections:', err);
    res.status(500).json({ status: 'failure', message: 'Failed to fetch sections' });
  } finally {
    connection.release();
  }
});

export const updateSectionsForCourse = catchAsync(async (req, res) => {
  const { courseCode } = req.params;
  const { sections } = req.body;
  const userEmail = req.user?.email || 'admin';

  if (!courseCode || !sections || !Array.isArray(sections)) {
    return res.status(400).json({
      status: 'failure',
      message: 'courseCode and an array of sections are required',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Validate user email
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

    // Validate course
    const [courseRows] = await connection.execute(
      `SELECT courseId FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
      [courseCode]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active course found with courseCode ${courseCode}`,
      });
    }

    for (const section of sections) {
      const { sectionId, sectionName, IsActive } = section;
      if (!sectionId || (sectionName && typeof sectionName !== 'string') || (IsActive && IsActive !== 'YES' && IsActive !== 'NO')) {
        return res.status(400).json({
          status: 'failure',
          message: 'Each section must have a valid sectionId, optional sectionName, and optional IsActive (YES/NO)',
        });
      }

      // Validate existing section
      const [sectionRows] = await connection.execute(
        `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND IsActive = 'YES'`,
        [sectionId, courseCode]
      );
      if (sectionRows.length === 0) {
        return res.status(404).json({
          status: 'failure',
          message: `No active section found with sectionId ${sectionId} for course ${courseCode}`,
        });
      }

      // Update section
      const updateFields = [];
      const values = [];
      if (sectionName) {
        updateFields.push('sectionName = ?');
        values.push(sectionName);
      }
      if (IsActive) {
        updateFields.push('IsActive = ?');
        values.push(IsActive);
      }
      updateFields.push('updatedBy = ?', 'updatedDate = CURRENT_TIMESTAMP');
      values.push(userEmail);

      if (updateFields.length > 0) {
        const query = `
          UPDATE Section
          SET ${updateFields.join(', ')}
          WHERE sectionId = ?
        `;
        values.push(sectionId);
        await connection.execute(query, values);
      }
    }

    await connection.commit();
    res.status(200).json({
      status: 'success',
      message: `Sections updated successfully for course ${courseCode}`,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error updating sections:', err);
    res.status(500).json({ status: 'failure', message: 'Failed to update sections' });
  } finally {
    connection.release();
  }
});

export const deleteSection = catchAsync(async (req, res) => {
  const { courseCode, sectionName } = req.params;
  const userEmail = req.user?.email || 'admin';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Validate user email
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

    // Validate section
    const [sectionRows] = await connection.execute(
      `SELECT sectionId FROM Section WHERE courseCode = ? AND sectionName = ? AND IsActive = 'YES'`,
      [courseCode, sectionName]
    );
    if (sectionRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active section found with sectionName ${sectionName} for course ${courseCode}`,
      });
    }
    const sectionId = sectionRows[0].sectionId;

    // Delete associated staff allocations
    await connection.execute(
      `DELETE FROM StaffCourse WHERE courseCode = ? AND sectionId = ?`,
      [courseCode, sectionId]
    );

    // Soft delete the section
    await connection.execute(
      `UPDATE Section SET IsActive = 'NO', updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE sectionId = ?`,
      [userEmail, sectionId]
    );

    await connection.commit();
    res.status(200).json({
      status: 'success',
      message: `Section ${sectionName} deleted successfully`,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error deleting section:', err);
    res.status(500).json({ status: 'failure', message: 'Failed to delete section' });
  } finally {
    connection.release();
  }
});

export const allocateStaffToCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const { Userid, courseCode, sectionId, Deptid } = req.body;
  const userEmail = req.user?.email || 'admin';

  if (!courseId || !Userid || !courseCode || !sectionId || !Deptid) {
    return res.status(400).json({
      status: 'failure',
      message: 'Missing required fields: courseId, Userid, courseCode, sectionId, Deptid',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Validate user email
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

    // Validate course
    const [courseRows] = await connection.execute(
      `SELECT courseId FROM Course WHERE courseId = ? AND courseCode = ? AND isActive = 'YES'`,
      [courseId, courseCode]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active course found with courseId ${courseId} and courseCode ${courseCode}`,
      });
    }

    // Validate section
    const [sectionRows] = await connection.execute(
      `SELECT sectionId FROM Section WHERE sectionId = ? AND courseCode = ? AND IsActive = 'YES'`,
      [sectionId, courseCode]
    );
    if (sectionRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active section found with sectionId ${sectionId} for course ${courseCode}`,
      });
    }

    // Validate Userid and Deptid
    const [staffRows] = await connection.execute(
      `SELECT Userid FROM users WHERE Userid = ? AND Deptid = ? AND IsActive = 'YES'`,
      [Userid, Deptid]
    );
    if (staffRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active staff found with Userid ${Userid} in department ${Deptid}`,
      });
    }

    // Check if staff is already allocated to another section for this course
    const [existingAllocation] = await connection.execute(
      `SELECT staffCourseId, sectionId FROM StaffCourse 
       WHERE Userid = ? AND courseCode = ? AND sectionId != ?`,
      [Userid, courseCode, sectionId]
    );
    if (existingAllocation.length > 0) {
      return res.status(400).json({
        status: 'failure',
        message: `Staff ${Userid} is already allocated to another section for course ${courseCode}`,
      });
    }

    // Insert new allocation
    const [result] = await connection.execute(
      `INSERT INTO StaffCourse (Userid, courseCode, sectionId, Deptid, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Userid, courseCode, sectionId, Deptid, userEmail, userEmail]
    );

    await connection.commit();
    res.status(201).json({
      status: 'success',
      message: 'Staff allocated successfully',
      data: {
        staffCourseId: result.insertId,
        Userid,
        courseCode,
        sectionId,
        Deptid,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error allocating staff:', err);
    res.status(500).json({ status: 'failure', message: 'Failed to allocate staff' });
  } finally {
    connection.release();
  }
});

export const getSections = catchAsync(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `
      SELECT s.sectionId, s.sectionName, s.courseCode, c.semesterId, sem.batchId
      FROM Section s
      JOIN Course c ON s.courseCode = c.courseCode
      JOIN Semester sem ON c.semesterId = sem.semesterId
      WHERE s.IsActive = 'YES' AND c.isActive = 'YES' AND sem.IsActive = 'YES'
      `
    );
    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error fetching sections:', err);
    res.status(500).json({ status: 'failure', message: 'Failed to fetch sections' });
  } finally {
    connection.release();
  }
});
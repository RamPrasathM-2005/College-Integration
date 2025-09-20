import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

// Valid enum values
const validTypes = ['THEORY', 'PRACTICAL', 'INTEGRATED', 'EXPERIENTIAL LEARNING'];
const validCategories = ['BSC', 'ESC', 'PEC', 'OEC', 'EEC', 'HSMC'];
const validIsActive = ['YES', 'NO'];

// Add Course
export const addCourse = catchAsync(async (req, res) => {
  const {
    courseCode,
    semesterId,
    courseTitle,
    type,
    category,
    minMark,
    maxMark,
    isActive, // Changed to match database column case
    lectureHours,
    tutorialHours,
    practicalHours,
    experientialHours,
    totalContactPeriods,
    credits
  } = req.body;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();


    // Validate required fields
    if (
      !courseCode ||
      !semesterId ||
      !courseTitle ||
      !type ||
      !category ||
      minMark === undefined ||
      maxMark === undefined ||
      lectureHours === undefined ||
      tutorialHours === undefined ||
      practicalHours === undefined ||
      experientialHours === undefined ||
      totalContactPeriods === undefined ||
      credits === undefined
    ) {
      return res.status(400).json({
        status: 'failure',
        message: 'All required fields must be provided',
      });
    }

    // Validate enum fields
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: 'failure',
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        status: 'failure',
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }
    if (isActive && !validIsActive.includes(isActive)) {
      return res.status(400).json({
        status: 'failure',
        message: `Invalid isActive. Must be one of: ${validIsActive.join(', ')}`,
      });
    }

    // Validate numeric fields
    const numericFields = { minMark, maxMark, lectureHours, tutorialHours, practicalHours, experientialHours, totalContactPeriods, credits };
    for (const [field, value] of Object.entries(numericFields)) {
      if (!Number.isInteger(value) || value < 0) {
        return res.status(400).json({
          status: 'failure',
          message: `${field} must be a non-negative integer`,
        });
      }
    }
    if (minMark > maxMark) {
      return res.status(400).json({
        status: 'failure',
        message: 'minMark must be less than or equal to maxMark',
      });
    }

    // Validate semesterId
    const [semesterRows] = await connection.execute(
      `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
      [semesterId]
    );
    if (semesterRows.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: `No active semester found with semesterId ${semesterId}`,
      });
    }

    // Check for existing courseCode
    const [existingCourse] = await connection.execute(
      `SELECT courseId FROM Course WHERE courseCode = ? AND isActive = 'YES'`,
      [courseCode]
    );
    if (existingCourse.length > 0) {
      return res.status(400).json({
        status: 'failure',
        message: `Course code ${courseCode} already exists`,
      });
    }

    // Insert course
    const [result] = await connection.execute(
      `INSERT INTO Course 
        (courseCode, semesterId, courseTitle, type, category, 
         minMark, maxMark, isActive, createdBy, updatedBy, lectureHours, 
         tutorialHours, practicalHours, experientialHours, totalContactPeriods, credits)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseCode,
        semesterId,
        courseTitle,
        type,
        category,
        minMark,
        maxMark,
        isActive || 'YES', // Use database default if not provided
        userEmail,
        userEmail,
        lectureHours,
        tutorialHours,
        practicalHours,
        experientialHours,
        totalContactPeriods,
        credits,
      ]
    );

    await connection.commit();
    res.status(201).json({
      status: 'success',
      message: 'Course added successfully',
      courseId: result.insertId,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error adding course:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

// Get All Courses


export const getAllCourse = catchAsync(async (req, res) => {


  // Ensure req.user exists and has email
  if (!req.user || !req.user.email) {

    return res.status(401).json({
      status: 'failure',
      message: 'Authentication required: No user or email provided',
      data: [],
    });
  }

  // Verify role (optional, if endpoint is admin-only)
  if (req.user.role !== 'Admin') {

    return res.status(403).json({
      status: 'failure',
      message: 'Admin access required',
      data: [],
    });
  }

  const connection = await pool.getConnection();
  try {
    //console.log('getAllCourse: Querying all courses');
    const [courses] = await connection.execute(
      `SELECT * FROM Course WHERE isActive = 'YES'`
    );


    res.status(200).json({
      status: 'success',
      results: courses.length,
      data: courses,
    });
  } catch (error) {

    res.status(500).json({
      status: 'failure',
      message: `Failed to fetch courses: ${error.message}`,
      data: [],
    });
  } finally {
    connection.release();
  }
});


// Get Course By Semester
export const getCourseBySemester = catchAsync(async (req, res) => {
  const { semesterId } = req.params;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {


    // Validate semesterId
    const [semesterRows] = await connection.execute(
      `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
      [semesterId]
    );
    if (semesterRows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active semester found with semesterId ${semesterId}`
      });
    }

    // Fetch courses for the semester
    const [rows] = await connection.execute(
      `SELECT * FROM Course WHERE semesterId = ? AND isActive = 'YES'`,
      [semesterId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "failure",
        message: `No active courses found for semesterId ${semesterId}`
      });
    }

    res.status(200).json({
      status: "success",
      data: rows
    });
  } catch (err) {
    console.error('Error fetching courses by semester:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

// Update Course

export const updateCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const {
    courseCode,
    semesterId,
    courseTitle,
    type,
    category,
    minMark,
    maxMark,
    isActive, // Changed to match schema
    lectureHours,
    tutorialHours,
    practicalHours,
    experientialHours,
    totalContactPeriods,
    credits,
  } = req.body;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Validate user
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

    // Validate course existence
    const [courseRows] = await connection.execute(
      `SELECT courseId FROM Course WHERE courseId = ? AND isActive = 'YES'`,
      [courseId]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active course found with courseId ${courseId}`,
      });
    }

    // Validate required fields
    if (
      !courseTitle ||
      (minMark !== undefined && maxMark === undefined) ||
      (maxMark !== undefined && minMark === undefined) ||
      (lectureHours !== undefined &&
        (tutorialHours === undefined || practicalHours === undefined || experientialHours === undefined)) ||
      totalContactPeriods === undefined ||
      credits === undefined
    ) {
      return res.status(400).json({
        status: 'failure',
        message:
          'Invalid input: courseTitle is required, and minMark/maxMark/lectureHours must be provided together if updated',
      });
    }

    // Validate enum fields
    const validTypes = ['THEORY', 'INTEGRATED', 'PRACTICAL', 'EXPERIENTIAL LEARNING'];
    const validCategories = ['HSMC', 'BSC', 'ESC', 'PEC', 'OEC', 'EEC'];
    const validIsActive = ['YES', 'NO'];

    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        status: 'failure',
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        status: 'failure',
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }
    if (isActive && !validIsActive.includes(isActive)) {
      return res.status(400).json({
        status: 'failure',
        message: `Invalid isActive. Must be one of: ${validIsActive.join(', ')}`,
      });
    }

    // Validate minMark and maxMark
    if (
      (minMark !== undefined || maxMark !== undefined) &&
      (!Number.isInteger(minMark) || !Number.isInteger(maxMark) || minMark < 0 || maxMark < 0 || minMark > maxMark)
    ) {
      return res.status(400).json({
        status: 'failure',
        message: 'minMark and maxMark must be non-negative integers with minMark <= maxMark',
      });
    }

    // Validate semesterId
    if (semesterId) {
      const [semesterRows] = await connection.execute(
        `SELECT semesterId FROM Semester WHERE semesterId = ?`, // Adjust if Semester has a status column
        [semesterId]
      );
      if (semesterRows.length === 0) {
        return res.status(400).json({
          status: 'failure',
          message: `No semester found with semesterId ${semesterId}`,
        });
      }
    }

    // Validate courseCode uniqueness
    if (courseCode) {
      const [existingCourse] = await connection.execute(
        `SELECT courseId FROM Course WHERE courseCode = ? AND courseId != ? AND isActive = 'YES'`,
        [courseCode, courseId]
      );
      if (existingCourse.length > 0) {
        return res.status(400).json({
          status: 'failure',
          message: `Course code ${courseCode} already exists`,
        });
      }
    }

    // Build update fields
    const updateFields = [];
    const values = [];
    if (courseCode) updateFields.push('courseCode = ?'), values.push(courseCode);
    if (semesterId) updateFields.push('semesterId = ?'), values.push(semesterId);
    if (courseTitle) updateFields.push('courseTitle = ?'), values.push(courseTitle);
    if (type) updateFields.push('type = ?'), values.push(type);
    if (category) updateFields.push('category = ?'), values.push(category);
    if (minMark !== undefined) updateFields.push('minMark = ?'), values.push(minMark);
    if (maxMark !== undefined) updateFields.push('maxMark = ?'), values.push(maxMark);
    if (isActive) updateFields.push('isActive = ?'), values.push(isActive);
    if (lectureHours !== undefined) updateFields.push('lectureHours = ?'), values.push(lectureHours);
    if (tutorialHours !== undefined) updateFields.push('tutorialHours = ?'), values.push(tutorialHours);
    if (practicalHours !== undefined) updateFields.push('practicalHours = ?'), values.push(practicalHours);
    if (experientialHours !== undefined) updateFields.push('experientialHours = ?'), values.push(experientialHours);
    if (totalContactPeriods) updateFields.push('totalContactPeriods = ?'), values.push(totalContactPeriods);
    if (credits) updateFields.push('credits = ?'), values.push(credits);
    updateFields.push('updatedBy = ?'), values.push(userEmail);
    updateFields.push('updatedAt = CURRENT_TIMESTAMP');

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: 'No fields provided for update',
      });
    }

    const query = `UPDATE Course SET ${updateFields.join(', ')} WHERE courseId = ?`;
    values.push(courseId);

    const [result] = await connection.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No course found with courseId ${courseId}`,
      });
    }

    await connection.commit();
    res.status(200).json({
      status: 'success',
      message: 'Course updated successfully',
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error updating course:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});

export const deleteCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Validate user
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

    // Check if course exists
    const [courseRows] = await connection.execute(
      `SELECT courseId FROM Course WHERE courseId = ? AND isActive = 'YES'`,
      [courseId]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No active course found with courseId ${courseId}`,
      });
    }

    // Soft delete
    const [result] = await connection.execute(
      `UPDATE Course SET isActive = 'NO', updatedBy = ?, updatedAt = CURRENT_TIMESTAMP WHERE courseId = ?`,
      [userEmail, courseId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'failure',
        message: `No course found with courseId ${courseId}`,
      });
    }

    await connection.commit();
    res.status(200).json({
      status: 'success',
      message: 'Course deleted successfully',
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error deleting course:', err);
    res.status(500).json({
      status: 'failure',
      message: 'Server error: ' + err.message,
    });
  } finally {
    connection.release();
  }
});
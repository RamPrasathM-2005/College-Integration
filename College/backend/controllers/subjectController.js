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
    isActive,
    createdBy,
    lectureHours,
    tutorialHours,
    practicalHours,
    experientialHours,
    totalContactPeriods,
    credits
  } = req.body;

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
    !totalContactPeriods ||
    !credits
  ) {
    return res.status(400).json({
      status: "failure",
      message: "All required fields must be provided"
    });
  }

  // Validate enum fields
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      status: "failure",
      message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
    });
  }
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      status: "failure",
      message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
    });
  }
  if (isActive && !validIsActive.includes(isActive)) {
    return res.status(400).json({
      status: "failure",
      message: `Invalid isActive. Must be one of: ${validIsActive.join(', ')}`
    });
  }

  // Validate minMark and maxMark
  if (!Number.isInteger(minMark) || !Number.isInteger(maxMark) || minMark < 0 || maxMark < 0 || minMark > maxMark) {
    return res.status(400).json({
      status: "failure",
      message: "minMark and maxMark must be non-negative integers with minMark <= maxMark"
    });
  }

  // Validate semesterId
  const [semesterRows] = await pool.execute(
    `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
    [semesterId]
  );
  if (semesterRows.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: `No active semester found with semesterId ${semesterId}`
    });
  }

  // Insert course into the database
  const [result] = await pool.execute(
    `INSERT INTO Course 
      (courseCode, semesterId, courseTitle, type, category, 
       minMark, maxMark, isActive, createdBy, lectureHours, 
       tutorialHours, practicalHours, experientialHours, totalContactPeriods, credits)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      courseCode,
      semesterId,
      courseTitle,
      type,
      category,
      minMark,
      maxMark,
      isActive || "YES",
      createdBy || "admin",
      lectureHours,
      tutorialHours,
      practicalHours,
      experientialHours,
      totalContactPeriods,
      credits
    ]
  );

  res.status(201).json({
    status: "success",
    message: "Course added successfully",
    courseId: result.insertId
  });
});

// Get All Courses
export const getAllCourse = catchAsync(async (req, res) => {
  const [rows] = await pool.execute(`SELECT * FROM Course WHERE isActive = 'YES'`);
  res.status(200).json({
    status: "success",
    data: rows
  });
});

// Get Course By Semester
export const getCourseBySemester = catchAsync(async (req, res) => {
  const { semesterId } = req.params;

  // Validate semesterId
  const [semesterRows] = await pool.execute(
    `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
    [semesterId]
  );
  if (semesterRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No active semester found with semesterId ${semesterId}`
    });
  }

  const [rows] = await pool.execute(
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
});

// Update Course
export const updateCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params; // Get courseId from URL parameter
  const {
    courseCode,
    semesterId,
    courseTitle,
    type,
    category,
    minMark,
    maxMark,
    isActive,
    updatedBy,
    lectureHours,
    tutorialHours,
    practicalHours,
    experientialHours,
    totalContactPeriods,
    credits
  } = req.body;

  // Validate required fields (allow partial updates by making some optional)
  if (
    !courseTitle || // courseTitle is the only strictly required field for update
    (minMark !== undefined && maxMark === undefined) ||
    (maxMark !== undefined && minMark === undefined) ||
    (lectureHours !== undefined && (tutorialHours === undefined || practicalHours === undefined || experientialHours === undefined)) ||
    totalContactPeriods === undefined ||
    credits === undefined
  ) {
    return res.status(400).json({
      status: "failure",
      message: "Invalid input: courseTitle is required, and minMark/maxMark/lectureHours must be provided together if updated"
    });
  }

  // Validate enum fields if provided
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({
      status: "failure",
      message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
    });
  }
  if (category && !validCategories.includes(category)) {
    return res.status(400).json({
      status: "failure",
      message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
    });
  }
  if (isActive && !validIsActive.includes(isActive)) {
    return res.status(400).json({
      status: "failure",
      message: `Invalid isActive. Must be one of: ${validIsActive.join(', ')}`
    });
  }

  // Validate minMark and maxMark if provided
  if ((minMark !== undefined || maxMark !== undefined) && 
      (!Number.isInteger(minMark) || !Number.isInteger(maxMark) || minMark < 0 || maxMark < 0 || minMark > maxMark)) {
    return res.status(400).json({
      status: "failure",
      message: "minMark and maxMark must be non-negative integers with minMark <= maxMark"
    });
  }

  // Validate semesterId if provided
  if (semesterId) {
    const [semesterRows] = await pool.execute(
      `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
      [semesterId]
    );
    if (semesterRows.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: `No active semester found with semesterId ${semesterId}`
      });
    }
  }

  // Validate courseCode uniqueness if changed
  if (courseCode) {
    const [existingCourse] = await pool.execute(
      `SELECT courseId FROM Course WHERE courseCode = ? AND courseId != ? AND isActive = 'YES'`,
      [courseCode, courseId]
    );
    if (existingCourse.length > 0) {
      return res.status(400).json({
        status: "failure",
        message: `Course code ${courseCode} already exists`
      });
    }
  }

  // Build update fields dynamically
  const updateFields = [];
  const values = [];
  if (courseCode) updateFields.push("courseCode = ?"), values.push(courseCode);
  if (semesterId) updateFields.push("semesterId = ?"), values.push(semesterId);
  if (courseTitle) updateFields.push("courseTitle = ?"), values.push(courseTitle);
  if (type) updateFields.push("type = ?"), values.push(type);
  if (category) updateFields.push("category = ?"), values.push(category);
  if (minMark !== undefined) updateFields.push("minMark = ?"), values.push(minMark);
  if (maxMark !== undefined) updateFields.push("maxMark = ?"), values.push(maxMark);
  if (isActive) updateFields.push("isActive = ?"), values.push(isActive);
  if (updatedBy) updateFields.push("updatedBy = ?"), values.push(updatedBy);
  if (lectureHours !== undefined) updateFields.push("lectureHours = ?"), values.push(lectureHours);
  if (tutorialHours !== undefined) updateFields.push("tutorialHours = ?"), values.push(tutorialHours);
  if (practicalHours !== undefined) updateFields.push("practicalHours = ?"), values.push(practicalHours);
  if (experientialHours !== undefined) updateFields.push("experientialHours = ?"), values.push(experientialHours);
  if (totalContactPeriods) updateFields.push("totalContactPeriods = ?"), values.push(totalContactPeriods);
  if (credits) updateFields.push("credits = ?"), values.push(credits);
  updateFields.push("updatedAt = CURRENT_TIMESTAMP");

  if (updateFields.length === 0) {
    return res.status(400).json({
      status: "failure",
      message: "No fields provided for update"
    });
  }

  const query = `UPDATE Course SET ${updateFields.join(', ')} WHERE courseId = ?`;
  values.push(courseId);

  const [result] = await pool.execute(query, values);

  if (result.affectedRows === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No course found with courseId ${courseId}`
    });
  }

  res.status(200).json({
    status: "success",
    message: "Course updated successfully"
  });
});

// Delete Course
export const deleteCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;

  // Check if course exists
  const [courseRows] = await pool.execute(
    `SELECT courseId FROM Course WHERE courseId = ?`,
    [courseId]
  );
  if (courseRows.length === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No course found with courseId ${courseId}`
    });
  }

  // Soft delete by setting isActive to NO
  const [result] = await pool.execute(
    `UPDATE Course SET isActive = 'NO', updatedAt = CURRENT_TIMESTAMP WHERE courseId = ?`,
    [courseId]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      status: "failure",
      message: `No course found with courseId ${courseId}`
    });
  }

  res.status(200).json({
    status: "success",
    message: "Course deleted successfully"
  });
});
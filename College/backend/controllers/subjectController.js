import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

// Valid enum values
const validTypes = ['THEORY', 'PRACTICAL', 'INTEGRATED', 'EXPERIENTIAL LEARNING'];
const validCategories = ['HSMC', 'BSC', 'ESC', 'PEC', 'OEC', 'EEC', 'PCC'];
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

    // Check for existing courseCode (active or inactive)
    const [existingCourse] = await connection.execute(
      `SELECT courseId, isActive FROM Course WHERE courseCode = ?`,
      [courseCode]
    );

    let courseId;
    if (existingCourse.length > 0) {
      if (existingCourse[0].isActive === 'YES') {
        return res.status(400).json({
          status: 'failure',
          message: `Course code ${courseCode} already exists`,
        });
      } else {
        const [updateResult] = await connection.execute(
          `UPDATE Course 
           SET semesterId = ?, courseTitle = ?, type = ?, category = ?, 
               minMark = ?, maxMark = ?, isActive = 'YES', updatedBy = ?, 
               lectureHours = ?, tutorialHours = ?, practicalHours = ?, 
               experientialHours = ?, totalContactPeriods = ?, credits = ?
           WHERE courseId = ?`,
          [
            semesterId,
            courseTitle,
            type,
            category,
            minMark,
            maxMark,
            userEmail,
            lectureHours,
            tutorialHours,
            practicalHours,
            experientialHours,
            totalContactPeriods,
            credits,
            existingCourse[0].courseId
          ]
        );

        if (updateResult.affectedRows === 0) {
          return res.status(500).json({
            status: 'failure',
            message: 'Failed to update existing course',
          });
        }
        courseId = existingCourse[0].courseId;
      }
    } else {
      const [insertResult] = await connection.execute(
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
          isActive || 'YES',
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
      courseId = insertResult.insertId;
    }

    await connection.commit();
    res.status(201).json({
      status: 'success',
      message: 'Course added successfully',
      courseId: courseId,
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

// Import Courses
export const importCourses = catchAsync(async (req, res) => {
  const { courses } = req.body;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Log the entire payload
    console.log('Received payload:', JSON.stringify(courses, null, 2));

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

    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        status: 'failure',
        message: 'No courses provided for import',
      });
    }

    let importedCount = 0;
    const errors = [];

    for (const course of courses) {
      const {
        courseCode,
        semesterId,
        courseTitle,
        type,
        category,
        minMark,
        maxMark,
        lectureHours,
        tutorialHours,
        practicalHours,
        experientialHours,
        totalContactPeriods,
        credits,
        isActive = 'YES',
      } = course;

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
        errors.push(`Missing required fields for course ${courseCode || 'unknown'}`);
        continue;
      }

      // Normalize and validate category
      const normalizedCategory = typeof category === 'string' ? category.trim().toUpperCase() : '';
      console.log(
        `Processing course: ${courseCode}, raw category: "${category}", normalized category: "${normalizedCategory}", length: ${category.length}, bytes: [${Buffer.from(category || '').toString('hex')}]`
      );

      // Check for invalid category
      if (typeof category !== 'string' || category.trim() === '') {
        errors.push(`Category for ${courseCode} is not a valid string: "${category}"`);
        continue;
      }
      if (normalizedCategory !== category.trim()) {
        errors.push(`Category for ${courseCode} contains unexpected spaces or case: "${category}"`);
        continue;
      }
      if (!validCategories.includes(normalizedCategory)) {
        errors.push(`Invalid category for ${courseCode}: "${normalizedCategory}" (raw: "${category}"). Must be one of ${validCategories.join(', ')}`);
        continue;
      }
      if (category.length > 4) {
        errors.push(`Category for ${courseCode} is too long: "${category}" (length: ${category.length})`);
        continue;
      }

      // Test category insertion
      try {
        console.log(`Testing category for ${courseCode}: "${normalizedCategory}"`);
        await connection.execute(
          `INSERT INTO Course (courseCode, semesterId, courseTitle, type, category, minMark, maxMark, isActive, createdBy, updatedBy, lectureHours, tutorialHours, practicalHours, experientialHours, totalContactPeriods, credits)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${courseCode}-test`,
            semesterId,
            courseTitle,
            type,
            normalizedCategory,
            minMark,
            maxMark,
            isActive,
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
        await connection.execute(`DELETE FROM Course WHERE courseCode = ?`, [`${courseCode}-test`]);
      } catch (testErr) {
        errors.push(`Test insertion failed for ${courseCode} with category "${normalizedCategory}": ${testErr.message} (SQL: ${testErr.sqlMessage || 'No SQL message'})`);
        continue; // Skip this course
      }

      // Validate enum fields
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type for ${courseCode}: Must be one of ${validTypes.join(', ')}`);
        continue;
      }
      if (!validIsActive.includes(isActive)) {
        errors.push(`Invalid isActive for ${courseCode}: Must be one of ${validIsActive.join(', ')}`);
        continue;
      }

      // Validate numeric fields
      const numericFields = { minMark, maxMark, lectureHours, tutorialHours, practicalHours, experientialHours, totalContactPeriods, credits };
      for (const [field, value] of Object.entries(numericFields)) {
        if (!Number.isInteger(value) || value < 0) {
          errors.push(`${field} must be a non-negative integer for ${courseCode}`);
          continue;
        }
      }
      if (minMark > maxMark) {
        errors.push(`minMark must be less than or equal to maxMark for ${courseCode}`);
        continue;
      }

      // Validate semesterId
      const [semesterRows] = await connection.execute(
        `SELECT semesterId FROM Semester WHERE semesterId = ? AND isActive = 'YES'`,
        [semesterId]
      );
      if (semesterRows.length === 0) {
        errors.push(`No active semester found with semesterId ${semesterId} for ${courseCode}`);
        continue;
      }

      // Check for existing courseCode
      const [existingCourse] = await connection.execute(
        `SELECT courseId, isActive FROM Course WHERE courseCode = ?`,
        [courseCode]
      );

      if (existingCourse.length > 0) {
        if (existingCourse[0].isActive === 'YES') {
          errors.push(`Course code ${courseCode} already exists`);
          continue;
        } else {
          // Update existing inactive course
          console.log(`Executing UPDATE for ${courseCode} with category: ${normalizedCategory}`);
          const updateQuery = `
            UPDATE Course 
            SET semesterId = ?, courseTitle = ?, type = ?, category = ?, 
                minMark = ?, maxMark = ?, isActive = ?, updatedBy = ?, 
                lectureHours = ?, tutorialHours = ?, practicalHours = ?, 
                experientialHours = ?, totalContactPeriods = ?, credits = ?
            WHERE courseId = ?
          `;
          console.log('Update query:', updateQuery);
          console.log('Update params:', [
            semesterId,
            courseTitle,
            type,
            normalizedCategory,
            minMark,
            maxMark,
            isActive,
            userEmail,
            lectureHours,
            tutorialHours,
            practicalHours,
            experientialHours,
            totalContactPeriods,
            credits,
            existingCourse[0].courseId
          ]);
          const [updateResult] = await connection.execute(updateQuery, [
            semesterId,
            courseTitle,
            type,
            normalizedCategory,
            minMark,
            maxMark,
            isActive,
            userEmail,
            lectureHours,
            tutorialHours,
            practicalHours,
            experientialHours,
            totalContactPeriods,
            credits,
            existingCourse[0].courseId
          ]);

          if (updateResult.affectedRows === 0) {
            errors.push(`Failed to update course ${courseCode}`);
            continue;
          }
          importedCount++;
        }
      } else {
        // Insert new course
        console.log(`Executing INSERT for ${courseCode} with category: ${normalizedCategory}`);
        const insertQuery = `
          INSERT INTO Course 
            (courseCode, semesterId, courseTitle, type, category, 
             minMark, maxMark, isActive, createdBy, updatedBy, lectureHours, 
             tutorialHours, practicalHours, experientialHours, totalContactPeriods, credits)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        console.log('Insert query:', insertQuery);
        console.log('Insert params:', [
          courseCode,
          semesterId,
          courseTitle,
          type,
          normalizedCategory,
          minMark,
          maxMark,
          isActive,
          userEmail,
          userEmail,
          lectureHours,
          tutorialHours,
          practicalHours,
          experientialHours,
          totalContactPeriods,
          credits,
        ]);
        const [insertResult] = await connection.execute(insertQuery, [
          courseCode,
          semesterId,
          courseTitle,
          type,
          normalizedCategory,
          minMark,
          maxMark,
          isActive,
          userEmail,
          userEmail,
          lectureHours,
          tutorialHours,
          practicalHours,
          experientialHours,
          totalContactPeriods,
          credits,
        ]);

        if (insertResult.affectedRows === 0) {
          errors.push(`Failed to insert course ${courseCode}`);
          continue;
        }
        importedCount++;
      }
    }

    if (errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'failure',
        message: 'Errors occurred during import',
        errors,
      });
    }

    await connection.commit();
    res.status(201).json({
      status: 'success',
      message: 'Courses imported successfully',
      importedCount,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error importing courses:', err);
    res.status(500).json({
      status: 'failure',
      message: `Server error: ${err.message}`,
      sqlMessage: err.sqlMessage || 'No SQL message available',
    });
  } finally {
    connection.release();
  }
});

// Get All Courses
export const getAllCourse = catchAsync(async (req, res) => {
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      status: 'failure',
      message: 'Authentication required: No user or email provided',
      data: [],
    });
  }

  if (req.user.role !== 'Admin') {
    return res.status(403).json({
      status: 'failure',
      message: 'Admin access required',
      data: [],
    });
  }

  const connection = await pool.getConnection();
  try {
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
    isActive,
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

    const normalizedCategory = category ? category.trim().toUpperCase() : undefined;
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        status: 'failure',
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }
    if (normalizedCategory && !validCategories.includes(normalizedCategory)) {
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

    if (
      (minMark !== undefined || maxMark !== undefined) &&
      (!Number.isInteger(minMark) || !Number.isInteger(maxMark) || minMark < 0 || maxMark < 0 || minMark > maxMark)
    ) {
      return res.status(400).json({
        status: 'failure',
        message: 'minMark and maxMark must be non-negative integers with minMark <= maxMark',
      });
    }

    if (semesterId) {
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
    }

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

    const updateFields = [];
    const values = [];
    if (courseCode) updateFields.push('courseCode = ?'), values.push(courseCode);
    if (semesterId) updateFields.push('semesterId = ?'), values.push(semesterId);
    if (courseTitle) updateFields.push('courseTitle = ?'), values.push(courseTitle);
    if (type) updateFields.push('type = ?'), values.push(type);
    if (normalizedCategory) updateFields.push('category = ?'), values.push(normalizedCategory);
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

// Delete Course
export const deleteCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const userEmail = req.user?.email || 'admin';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

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
// controllers/gradeController.js
import pool from '../db.js';
import catchAsync from '../utils/catchAsync.js';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';

const upload = multer({ dest: 'tmp/' });

const getStudentGPA = async (regno, semesterId) => {
  const [rows] = await pool.execute(`
    SELECT c.credits, gp.point
    FROM StudentGrade sg
    JOIN Course c ON sg.courseCode = c.courseCode AND c.semesterId = ?
    JOIN GradePoint gp ON sg.grade = gp.grade
    WHERE sg.regno = ?
      AND sg.grade != 'U'
      AND c.credits > 0
  `, [semesterId, regno]);

  if (rows.length === 0) return null;

  let totalPoints = 0;
  let totalCredits = 0;

  rows.forEach(row => {
    totalPoints += row.credits * row.point;
    totalCredits += row.credits;
  });

  return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : null;
};


const getStudentCGPA = async (regno, upToSemesterId) => {
  const [rows] = await pool.execute(`
    SELECT c.credits, gp.point
    FROM StudentGrade sg
    JOIN Course c ON sg.courseCode = c.courseCode
    JOIN Semester s ON c.semesterId = s.semesterId
    JOIN GradePoint gp ON sg.grade = gp.grade
    WHERE sg.regno = ?
      AND s.semesterNumber <= (SELECT semesterNumber FROM Semester WHERE semesterId = ?)
      AND sg.grade != 'U'
      AND c.credits > 0
    ORDER BY s.semesterNumber
  `, [regno, upToSemesterId]);

  if (rows.length === 0) return null;

  let totalPoints = 0;
  let totalCredits = 0;

  rows.forEach(row => {
    totalPoints += row.credits * row.point;
    totalCredits += row.credits;
  });

  return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : null;
};


export const uploadGrades = catchAsync(async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ status: 'error', message: 'No file uploaded' });
  }

  const records = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (row) => {
        const regno = row.regno?.trim();
        if (!regno) return;

        Object.keys(row).forEach(key => {
          const rawGrade = row[key]?.trim();

          // SKIP: regno column itself
          if (key === 'regno') return;

          // SKIP: empty, dash (-), or whitespace
          if (!rawGrade || rawGrade === '-' || rawGrade === '') return;

          const grade = rawGrade.toUpperCase();

          // Only accept valid grades
          if (!['O', 'A+', 'A', 'B+', 'B', 'U'].includes(grade)) {
            console.warn(`Invalid grade skipped: ${regno} → ${key} = "${rawGrade}"`);
            return;
          }

          records.push({
            regno,
            courseCode: key.trim(),
            grade
          });
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  // Clean up uploaded file
  fs.unlinkSync(file.path);

  if (records.length === 0) {
    return res.json({
      status: 'success',
      message: 'No valid grades found in file',
      inserted: 0,
      updated: 0
    });
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const stmt = `
      INSERT INTO StudentGrade (regno, courseCode, grade)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        grade = VALUES(grade),
        updatedAt = CURRENT_TIMESTAMP
    `;

    let inserted = 0;
    let updated = 0;
    let skippedCourses = 0;

    for (const r of records) {
      // Validate course exists
      const [courseRows] = await conn.execute(
        'SELECT courseId FROM Course WHERE courseCode = ?',
        [r.courseCode]
      );

      if (courseRows.length === 0) {
        console.warn(`Course not found (skipped): ${r.courseCode}`);
        skippedCourses++;
        continue;
      }

      const [result] = await conn.execute(stmt, [r.regno, r.courseCode, r.grade]);

      if (result.affectedRows === 1) inserted++;
      if (result.affectedRows === 2) updated++;
    }

    await conn.commit();

    res.json({
      status: 'success',
      message: `${records.length} valid grades processed`,
      inserted,
      updated,
      skippedCourses,
      totalProcessed: inserted + updated
    });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});


export const viewGPA = catchAsync(async (req, res) => {
  const { regno, semesterId } = req.query;

  if (!regno || !semesterId) {
    return res.status(400).json({ status: 'error', message: 'regno and semesterId required' });
  }

  const gpa = await getStudentGPA(regno, semesterId);
  res.json({ gpa: gpa || '-' });
});


export const viewCGPA = catchAsync(async (req, res) => {
  const { regno, upToSemesterId } = req.query;

  if (!regno || !upToSemesterId) {
    return res.status(400).json({ status: 'error', message: 'regno and upToSemesterId required' });
  }

  const cgpa = await getStudentCGPA(regno, upToSemesterId);
  res.json({ cgpa: cgpa || '-' });
});


export const getStudentsForGrade = catchAsync(async (req, res) => {
  const { branch, batch, degree } = req.query;

  if (!branch || !batch) {
    return res.status(400).json({
      status: 'error',
      message: 'branch and batch are required'
    });
  }

  const [rows] = await pool.execute(`
    SELECT 
      sd.regno,
      u.username AS name
    FROM student_details sd
    JOIN users u ON sd.Userid = u.Userid
    JOIN department d ON sd.Deptid = d.Deptid
    WHERE d.Deptacronym = ?
      AND sd.batch = ?
      AND u.role = 'Student'
      AND u.status = 'active'
    ORDER BY sd.regno
  `, [branch, batch]);

  res.json({
    status: 'success',
    data: rows
  });
});

export default upload;
// controllers/gradeController.js
import pool from '../db.js';
import catchAsync from '../utils/catchAsync.js';
import multer from 'multer';
import csv from 'csv-parser';
import XLSX from 'xlsx';
import fs from 'fs';

const upload = multer({ dest: 'tmp/' });

// GPA — Current Semester Only
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

// CGPA — Up to current semesterNumber
const getStudentCGPA = async (regno, upToSemesterId) => {
  const [semResult] = await pool.execute(
    'SELECT semesterNumber FROM Semester WHERE semesterId = ?',
    [upToSemesterId]
  );

  if (semResult.length === 0) return null;
  const targetSemesterNumber = semResult[0].semesterNumber;

  const [rows] = await pool.execute(`
    SELECT c.credits, gp.point
    FROM StudentGrade sg
    JOIN Course c ON sg.courseCode = c.courseCode
    JOIN Semester s ON c.semesterId = s.semesterId
    JOIN GradePoint gp ON sg.grade = gp.grade
    WHERE sg.regno = ?
      AND s.semesterNumber <= ?
      AND sg.grade != 'U'
      AND c.credits > 0
    ORDER BY s.semesterNumber
  `, [regno, targetSemesterNumber]);

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
  const semesterId = req.body.semesterId;
  const isNptel = req.body.isNptel === 'true'; // ← NEW: NPTEL mode

  if (!file) {
    return res.status(400).json({ status: 'error', message: 'No file uploaded' });
  }
  if (!semesterId) {
    return res.status(400).json({ status: 'error', message: 'Semester ID is required' });
  }

  const records = [];

  const isXLSX = 
    file.originalname.toLowerCase().endsWith('.xlsx') || 
    file.originalname.toLowerCase().endsWith('.xls') ||
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
     'application/vnd.ms-excel'].includes(file.mimetype);

  // Parse XLSX
  if (isXLSX) {
    const wb = XLSX.readFile(file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (data.length < 2) {
      fs.unlinkSync(file.path);
      return res.json({ status: 'success', message: 'Empty file', processed: 0 });
    }

    const headers = data[0].map(h => h?.toString().trim());

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const regno = row[0]?.toString().trim();
      if (!regno) continue;

      for (let j = 1; j < headers.length; j++) {
        const courseCode = headers[j];
        if (!courseCode || courseCode.toLowerCase() === 'regno') continue;

        const rawGrade = row[j]?.toString().trim();
        if (!rawGrade || ['-', '', 'AB', 'ABSENT'].map(g => g.toUpperCase()).includes(rawGrade.toUpperCase())) {
          continue;
        }

        const grade = rawGrade.toUpperCase();
        if (!['O', 'A+', 'A', 'B+', 'B', 'U'].includes(grade)) {
          console.warn(`Invalid grade ignored: ${regno} → ${courseCode} = "${rawGrade}"`);
          continue;
        }

        records.push({ regno, courseCode: courseCode.trim(), grade });
      }
    }
  } 
  // Parse CSV
  else {
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.path)
        .pipe(csv())
        .on('data', (row) => {
          const regno = row.regno?.trim();
          if (!regno) return;

          Object.keys(row).forEach(key => {
            if (key.toLowerCase() === 'regno') return;
            const courseCode = key.trim();
            const rawGrade = row[key]?.trim();

            if (!rawGrade || ['-', '', 'AB', 'ABSENT'].map(g => g.toUpperCase()).includes(rawGrade.toUpperCase())) return;

            const grade = rawGrade.toUpperCase();
            if (!['O', 'A+', 'A', 'B+', 'B', 'U'].includes(grade)) {
              console.warn(`Invalid grade ignored: ${regno} → ${courseCode} = "${rawGrade}"`);
              return;
            }

            records.push({ regno, courseCode, grade });
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  fs.unlinkSync(file.path);

  if (records.length === 0) {
    return res.json({ status: 'success', message: 'No valid grades found', processed: 0 });
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    let processedRecords = records.length;

    // ← NEW: NPTEL-specific validation
    if (isNptel) {
      const validNptelCodes = new Set();
      const [nptelCourses] = await conn.execute(
        `SELECT courseCode FROM NptelCourse WHERE isActive = 'YES'`
      );
      nptelCourses.forEach(r => validNptelCodes.add(r.courseCode));

      const filtered = [];
      for (const r of records) {
        if (!validNptelCodes.has(r.courseCode)) {
          console.warn(`Skipped invalid NPTEL courseCode: ${r.courseCode}`);
          processedRecords--;
          continue;
        }

        const [enrolled] = await conn.execute(
          `SELECT 1 FROM StudentNptelEnrollment sne
           JOIN NptelCourse nc ON sne.nptelCourseId = nc.nptelCourseId
           WHERE sne.regno = ? AND nc.courseCode = ? AND sne.isActive = 'YES'`,
          [r.regno, r.courseCode]
        );

        if (enrolled.length === 0) {
          console.warn(`Student ${r.regno} not enrolled in NPTEL course ${r.courseCode} → skipped`);
          processedRecords--;
          continue;
        }

        filtered.push(r);
      }

      records.length = 0;
      records.push(...filtered);

      if (records.length === 0) {
        await conn.commit();
        return res.json({
          status: 'success',
          message: 'No valid NPTEL grades imported (check enrollment & course codes)',
          processed: 0
        });
      }
    }

    const insertStmt = `
      INSERT INTO StudentGrade (regno, courseCode, grade)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE grade = VALUES(grade), updatedAt = CURRENT_TIMESTAMP
    `;

    let inserted = 0;
    let updated = 0;
    let skippedStudents = 0;
    let skippedCourses = 0;

    const successfullyProcessedRegnos = new Set();

    for (const r of records) {
      const [student] = await conn.execute('SELECT 1 FROM student_details WHERE regno = ?', [r.regno]);
      if (student.length === 0) {
        console.warn(`Student not found → skipped: ${r.regno}`);
        skippedStudents++;
        continue;
      }

      // For regular courses: check Course table
      // For NPTEL: we already validated above, so skip this check if isNptel
      if (!isNptel) {
        const [course] = await conn.execute('SELECT 1 FROM Course WHERE courseCode = ?', [r.courseCode]);
        if (course.length === 0) {
          console.warn(`Course not found → skipped: ${r.courseCode}`);
          skippedCourses++;
          continue;
        }
      }

      const [result] = await conn.execute(insertStmt, [r.regno, r.courseCode, r.grade]);
      if (result.affectedRows > 0) {
        successfullyProcessedRegnos.add(r.regno);
        if (result.affectedRows === 1) inserted++;
        if (result.affectedRows === 2) updated++;
      }
    }

    // SAVE CORRECT GPA & CGPA
    for (const regno of successfullyProcessedRegnos) {
      const gpa = await getStudentGPA(regno, semesterId);
      const cgpa = await getStudentCGPA(regno, semesterId);

      const gpaValue = gpa ? parseFloat(gpa) : null;
      const cgpaValue = cgpa ? parseFloat(cgpa) : null;

      await conn.execute(`
        INSERT INTO StudentSemesterGPA (regno, semesterId, gpa, cgpa)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          gpa = VALUES(gpa),
          cgpa = VALUES(cgpa),
          updatedAt = CURRENT_TIMESTAMP
      `, [regno, semesterId, gpaValue, cgpaValue]);
    }

    await conn.commit();

    return res.json({
      status: 'success',
      message: isNptel 
        ? 'NPTEL grades imported successfully! Students can now request credit transfer.'
        : 'Grades imported & GPA/CGPA saved perfectly!',
      inserted,
      updated,
      skippedStudents,
      skippedCourses,
      totalValidRecords: processedRecords,
      studentsWithGPA: successfullyProcessedRegnos.size
    });

  } catch (error) {
    await conn.rollback();
    console.error('UploadGrades Error:', error.message);
    throw error;
  } finally {
    conn.release();
  }
});



// View GPA
export const viewGPA = catchAsync(async (req, res) => {
  const { regno, semesterId } = req.query;
  if (!regno || !semesterId) return res.status(400).json({ status: 'error', message: 'regno and semesterId required' });
  const gpa = await getStudentGPA(regno, semesterId);
  res.json({ gpa: gpa || '-' });
});

// View CGPA
export const viewCGPA = catchAsync(async (req, res) => {
  const { regno, upToSemesterId } = req.query;
  if (!regno || !upToSemesterId) return res.status(400).json({ status: 'error', message: 'regno and upToSemesterId required' });
  const cgpa = await getStudentCGPA(regno, upToSemesterId);
  res.json({ cgpa: cgpa || '-' });
});

// Get Students List
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


export const getStudentGpaHistory = catchAsync(async (req, res) => {
  // req.user comes from your auth middleware (passport/jwt)
  const userId = req.user.Userid || req.user.id; // supports both Userid and id

  if (!userId) {
    return res.status(401).json({
      status: 'fail',
      message: 'User not authenticated or Userid missing',
    });
  }

  // Step 1: Get the student's regno using Userid → student_details
  const [studentRows] = await pool.execute(
    `SELECT regno FROM student_details WHERE Userid = ? LIMIT 1`,
    [userId]
  );

  if (studentRows.length === 0) {
    return res.status(404).json({
      status: 'fail',
      message: 'Student profile not found',
    });
  }

  const regno = studentRows[0].regno;

  // Step 2: Fetch GPA/CGPA history using the correct regno
  const [rows] = await pool.execute(
    `SELECT 
       s.semesterNumber,
       ss.gpa,
       ss.cgpa
     FROM StudentSemesterGPA ss
     JOIN Semester s ON ss.semesterId = s.semesterId
     WHERE ss.regno = ?
     ORDER BY s.semesterNumber ASC`,
    [regno]
  );

  // Step 3: Safely format the response (convert NULL → null and ensure number type)
  const safeData = rows.map(row => ({
    semesterNumber: row.semesterNumber,
    gpa: row.gpa === null ? null : parseFloat(row.gpa),
    cgpa: row.cgpa === null ? null : parseFloat(row.cgpa),
  }));

  res.status(200).json({
    status: 'success',
    data: safeData,
  });
});

export default upload;
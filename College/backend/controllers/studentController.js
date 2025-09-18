import pool from "../db.js";
import catchAsync from "../utils/catchAsync.js";

// Existing controllers (unchanged, included for reference)
export const addStudent = catchAsync(async (req, res) => {
  const { rollnumber, name, degree, branch, batch, semesterNumber, createdBy } = req.body;
  if (!rollnumber || !name || !degree || !branch || !batch || !semesterNumber || !createdBy) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const [existingStudent] = await pool.execute(`SELECT rollnumber FROM Student WHERE rollnumber = ?`, [rollnumber]);
  if (existingStudent.length > 0) {
    return res.status(400).json({ message: "Student with this roll number already exists" });
  }
  const [batchRows] = await pool.execute(
    `SELECT batchId FROM Batch WHERE degree = ? AND branch = ? AND batch = ?`,
    [degree, branch, batch]
  );
  if (batchRows.length === 0) {
    return res.status(404).json({ message: `Batch ${batch} - ${branch} not found` });
  }
  const batchId = batchRows[0].batchId;
  const [result] = await pool.execute(
    `INSERT INTO Student (rollnumber, name, batchId, semesterNumber, createdBy, updatedBy)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rollnumber, name, batchId, semesterNumber, createdBy, createdBy]
  );
  res.status(201).json({
    status: "success",
    message: "Student added successfully",
    rollnumber: rollnumber,
  });
});

export const getAllStudents = catchAsync(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT s.*, b.degree, b.branch, b.batch, b.batchYears
     FROM Student s
     INNER JOIN Batch b ON s.batchId = b.batchId
     ORDER BY s.rollnumber ASC`
  );
  res.status(200).json({ status: "success", data: rows });
});

export const getStudentByRollNumber = catchAsync(async (req, res) => {
  const { rollnumber } = req.params;
  const [rows] = await pool.execute(
    `SELECT s.*, b.degree, b.branch, b.batch, b.batchYears
     FROM Student s
     INNER JOIN Batch b ON s.batchId = b.batchId
     WHERE s.rollnumber = ?`,
    [rollnumber]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: "Student not found" });
  }
  res.status(200).json({ status: "success", data: rows[0] });
});

export const updateStudent = catchAsync(async (req, res) => {
  const { rollnumber } = req.params;
  const { name, degree, branch, batch, semesterNumber, updatedBy } = req.body;
  const [existingStudent] = await pool.execute(`SELECT batchId FROM Student WHERE rollnumber = ?`, [rollnumber]);
  if (existingStudent.length === 0) {
    return res.status(404).json({ message: "Student not found" });
  }
  let batchId = existingStudent[0].batchId;
  if (batch || branch || degree) {
    const [batchRows] = await pool.execute(
      `SELECT batchId FROM Batch WHERE degree = ? AND branch = ? AND batch = ?`,
      [degree, branch, batch]
    );
    if (batchRows.length === 0) {
      return res.status(404).json({ message: `Batch ${batch} - ${branch} not found` });
    }
    batchId = batchRows[0].batchId;
  }
  const updateFields = {};
  if (name !== undefined) updateFields.name = name;
  if (semesterNumber !== undefined) updateFields.semesterNumber = semesterNumber;
  if (batchId !== undefined) updateFields.batchId = batchId;
  if (updatedBy !== undefined) updateFields.updatedBy = updatedBy;
  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }
  const keys = Object.keys(updateFields).map((key) => `${key} = ?`).join(", ");
  const values = Object.values(updateFields);
  const [result] = await pool.execute(`UPDATE Student SET ${keys}, updatedDate = NOW() WHERE rollnumber = ?`, [
    ...values,
    rollnumber,
  ]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Student not found or no changes made" });
  }
  res.status(200).json({
    status: "success",
    message: "Student updated successfully",
    rollnumber: rollnumber,
  });
});

export const deleteStudent = catchAsync(async (req, res) => {
  const { rollnumber } = req.params;
  const [result] = await pool.execute(`DELETE FROM Student WHERE rollnumber = ?`, [rollnumber]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Student not found" });
  }
  res.status(200).json({
    status: "success",
    message: `Student with roll number ${rollnumber} deleted successfully`,
  });
});

export const getStudentEnrolledCourses = catchAsync(async (req, res) => {
  const { rollnumber } = req.params;
  const [rows] = await pool.execute(
    `SELECT 
      c.courseId,
      sc.courseCode, 
      c.courseTitle as courseName, 
      sec.sectionName as batch, 
      u.name as staff
     FROM StudentCourse sc
     JOIN Course c ON sc.courseCode = c.courseCode
     JOIN Section sec ON sc.sectionId = sec.sectionId
     LEFT JOIN StaffCourse stc ON stc.courseCode = sc.courseCode AND stc.sectionId = sc.sectionId
     LEFT JOIN Users u ON stc.staffId = u.staffId AND stc.departmentId = u.departmentId
     WHERE sc.rollnumber = ?`,
    [rollnumber]
  );
  res.status(200).json({
    status: "success",
    data: rows,
  });
});


export const getStudentsByCourseAndSection = catchAsync(async (req, res) => {
  const { courseCode, sectionId } = req.query;
  if (!courseCode || !sectionId) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing courseCode or sectionId',
    });
  }

  const [rows] = await pool.execute(
    `SELECT 
      s.rollnumber,
      s.name,
      sec.sectionName as batch
     FROM StudentCourse sc
     JOIN Student s ON sc.rollnumber = s.rollnumber
     JOIN Section sec ON sc.sectionId = sec.sectionId
     WHERE sc.courseCode = ? AND sc.sectionId = ?`,
    [courseCode, sectionId]
  );

  res.status(200).json({
    status: 'success',
    data: rows,
  });
});

// New endpoint: Get distinct branches for department filter
export const getBranches = catchAsync(async (req, res) => {
  const [rows] = await pool.execute(`SELECT DISTINCT branch FROM Batch WHERE isActive = 'YES'`);
  if (!rows.length) {
    return res.status(404).json({
      status: "error",
      message: "No active branches found",
    });
  }
  res.status(200).json({
    status: "success",
    data: rows.map((row) => row.branch),
  });
});

export const getSemesters = catchAsync(async (req, res) => {
  const [rows] = await pool.execute(`SELECT DISTINCT semesterNumber FROM Semester WHERE isActive = 'YES'`);
  if (!rows.length) {
    return res.status(404).json({
      status: "error",
      message: "No active semesters found",
    });
  }
  res.status(200).json({
    status: "success",
    data: rows.map((row) => `Semester  ${row.semesterNumber}`),
  });
});

export const getBatches = catchAsync(async (req, res) => {
  const { branch } = req.query;
  let query = `SELECT batchId, degree, branch, batch, batchYears FROM Batch WHERE isActive = 'YES'`;
  let params = [];
  if (branch) {
    query += ` AND branch = ?`;
    params.push(branch);
  }
  const [rows] = await pool.execute(query, params);
  if (!rows.length) {
    return res.status(404).json({
      status: "error",
      message: "No active batches found",
    });
  }
  res.status(200).json({
    status: "success",
    data: rows,
  });
});
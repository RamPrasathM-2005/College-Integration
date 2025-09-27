import pool from '../db.js';
import csv from 'csv-parser';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import catchAsync from '../utils/catchAsync.js';

const getStaffId = (req) => {
  if (!req.user || !req.user.Userid) {
    console.error('No user or Userid found in req.user:', req.user);
    throw new Error('Authentication required: No user or Userid provided');
  }
  console.log('getStaffId - req.user:', req.user, 'Userid:', req.user.Userid, 'Userid type:', typeof req.user.Userid);
  return String(req.user.Userid); // Return Userid (e.g., '2') as string
};

export const getCoursePartitions = catchAsync(async (req, res) => {
  const { courseCode } = req.params;
  const userId = getStaffId(req); // Returns Userid (e.g., '2')
  console.log('getCoursePartitions - courseCode:', courseCode, 'userId:', userId, 'userId type:', typeof userId);

  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'Course code is required' });
  }
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'User not authenticated or Userid missing' });
  }

  const [courseRows] = await pool.query(
    `SELECT c.courseId 
     FROM Course c
     JOIN StaffCourse sc ON c.courseId = sc.courseId
     WHERE LOWER(c.courseCode) = LOWER(?) AND sc.Userid = ?`,
    [courseCode, userId]
  );
  console.log('getCoursePartitions - courseRows:', courseRows);

  if (courseRows.length === 0) {
    return res.status(404).json({ 
      status: 'error', 
      message: `Course with code '${courseCode}' not found or not assigned to user ID ${userId}`
    });
  }
  const courseId = courseRows[0].courseId;

  const [rows] = await pool.query('SELECT * FROM CoursePartitions WHERE courseId = ?', [courseId]);
  console.log('getCoursePartitions - partitions:', rows);
  res.json({ 
    status: 'success', 
    data: rows[0] || { theoryCount: 0, practicalCount: 0, experientialCount: 0, courseId } 
  });
});

export const saveCoursePartitions = catchAsync(async (req, res) => {
  const { courseCode } = req.params;
  const { theoryCount, practicalCount, experientialCount } = req.body;
  const staffId = getStaffId(req);
  console.log('saveCoursePartitions - courseCode:', courseCode, 'staffId:', staffId, 'body:', req.body);

  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'Course code is required' });
  }
  if (theoryCount === undefined || practicalCount === undefined || experientialCount === undefined) {
    return res.status(400).json({ status: 'error', message: 'Theory, practical, and experiential counts are required' });
  }
  if (theoryCount < 0 || practicalCount < 0 || experientialCount < 0) {
    return res.status(400).json({ status: 'error', message: 'Counts cannot be negative' });
  }
  if (!staffId) {
    return res.status(401).json({ status: 'error', message: 'User not authenticated or staffId missing' });
  }

  const [courseCheck] = await pool.query(
    `SELECT c.courseId 
     FROM Course c
     JOIN StaffCourse sc ON c.courseId = sc.courseId
     WHERE LOWER(c.courseCode) = LOWER(?) AND sc.Userid = ?`,
    [courseCode, staffId]
  );
  console.log('saveCoursePartitions - courseCheck:', courseCheck);

  if (courseCheck.length === 0) {
    return res.status(404).json({ 
      status: 'error', 
      message: `Course with code '${courseCode}' does not exist or not assigned to staff with Userid ${staffId}`
    });
  }
  const courseId = courseCheck[0].courseId;

  const [existing] = await pool.query('SELECT partitionId FROM CoursePartitions WHERE courseId = ?', [courseId]);
  console.log('saveCoursePartitions - existing partitions:', existing);
  if (existing.length > 0) {
    return res.status(409).json({
      status: 'error',
      message: 'Partitions already exist for this course. Use PUT to update.',
    });
  }

  const [result] = await pool.query(
    'INSERT INTO CoursePartitions (courseId, theoryCount, practicalCount, experientialCount, createdBy, updatedBy) VALUES (?, ?, ?, ?, ?, ?)',
    [courseId, theoryCount, practicalCount, experientialCount, staffId || 'admin', staffId || 'admin']
  );

  let coNumber = 1;
  const coIds = [];

  for (let i = 0; i < theoryCount; i++) {
    const [result] = await pool.query(
      'INSERT INTO CourseOutcome (courseId, coNumber) VALUES (?, ?)', // Removed createdBy, updatedBy
      [courseId, `CO${coNumber}`]
    );
    const coId = result.insertId;
    await pool.query(
      'INSERT INTO COType (coId, coType, createdBy, updatedBy) VALUES (?, ?, ?, ?)',
      [coId, 'THEORY', staffId || 'admin', staffId || 'admin']
    );
    coIds.push(coId);
    coNumber++;
  }

  for (let i = 0; i < practicalCount; i++) {
    const [result] = await pool.query(
      'INSERT INTO CourseOutcome (courseId, coNumber) VALUES (?, ?)', // Removed createdBy, updatedBy
      [courseId, `CO${coNumber}`]
    );
    const coId = result.insertId;
    await pool.query(
      'INSERT INTO COType (coId, coType, createdBy, updatedBy) VALUES (?, ?, ?, ?)',
      [coId, 'PRACTICAL', staffId || 'admin', staffId || 'admin']
    );
    coIds.push(coId);
    coNumber++;
  }

  for (let i = 0; i < experientialCount; i++) {
    const [result] = await pool.query(
      'INSERT INTO CourseOutcome (courseId, coNumber) VALUES (?, ?)', // Removed createdBy, updatedBy
      [courseId, `CO${coNumber}`]
    );
    const coId = result.insertId;
    await pool.query(
      'INSERT INTO COType (coId, coType, createdBy, updatedBy) VALUES (?, ?, ?, ?)',
      [coId, 'EXPERIENTIAL', staffId || 'admin', staffId || 'admin']
    );
    coIds.push(coId);
    coNumber++;
  }

  res.json({
    status: 'success',
    message: 'Partitions and COs saved successfully',
    data: { partitionId: result.insertId, coIds },
  });
});

export const updateCoursePartitions = catchAsync(async (req, res) => {
  const { courseCode } = req.params;
  const { theoryCount, practicalCount, experientialCount } = req.body;
  const staffId = getStaffId(req);
  console.log('updateCoursePartitions - courseCode:', courseCode, 'staffId:', staffId, 'body:', req.body);

  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'Course code is required' });
  }
  if (theoryCount === undefined || practicalCount === undefined || experientialCount === undefined) {
    return res.status(400).json({ status: 'error', message: 'Theory, practical, and experiential counts are required' });
  }
  if (theoryCount < 0 || practicalCount < 0 || experientialCount < 0) {
    return res.status(400).json({ status: 'error', message: 'Counts cannot be negative' });
  }
  if (!staffId) {
    return res.status(401).json({ status: 'error', message: 'User not authenticated or staffId missing' });
  }

  const [courseCheck] = await pool.query(
    `SELECT c.courseId 
     FROM Course c
     JOIN StaffCourse sc ON c.courseId = sc.courseId
     JOIN users u ON sc.Userid = u.Userid
     WHERE LOWER(c.courseCode) = LOWER(?) AND u.staffId = ?`,
    [courseCode, staffId]
  );
  console.log('updateCoursePartitions - courseCheck:', courseCheck);

  if (courseCheck.length === 0) {
    return res.status(404).json({ 
      status: 'error', 
      message: `Course with code '${courseCode}' does not exist or not assigned to staff with ID ${staffId}`
    });
  }
  const courseId = courseCheck[0].courseId;

  const [existing] = await pool.query('SELECT partitionId FROM CoursePartitions WHERE courseId = ?', [courseId]);
  console.log('updateCoursePartitions - existing partitions:', existing);
  if (existing.length === 0) {
    return res.status(404).json({ 
      status: 'error', 
      message: 'No partitions found for this course. Use POST to create.' 
    });
  }

  await pool.query(
    'UPDATE CoursePartitions SET theoryCount = ?, practicalCount = ?, experientialCount = ?, updatedBy = ? WHERE courseId = ?',
    [theoryCount, practicalCount, experientialCount, staffId || 'admin', courseId]
  );

  const [existingCOs] = await pool.query(
    `SELECT co.coId, co.coNumber, ct.coType 
     FROM CourseOutcome co
     LEFT JOIN COType ct ON co.coId = ct.coId
     WHERE co.courseId = ?
     ORDER BY CAST(SUBSTRING(co.coNumber, 3) AS UNSIGNED)`,
    [courseId]
  );

  let theoryCOs = existingCOs.filter(co => co.coType === 'THEORY');
  let practicalCOs = existingCOs.filter(co => co.coType === 'PRACTICAL');
  let experientialCOs = existingCOs.filter(co => co.coType === 'EXPERIENTIAL');

  while (theoryCOs.length > theoryCount) {
    const toDelete = theoryCOs.pop();
    await pool.query('DELETE FROM COType WHERE coId = ?', [toDelete.coId]);
    await pool.query('DELETE FROM COTool WHERE coId = ?', [toDelete.coId]);
    await pool.query('DELETE FROM CourseOutcome WHERE coId = ?', [toDelete.coId]);
  }
  for (let i = 0; i < theoryCount - theoryCOs.length; i++) {
    const tempCoNumber = `CO1000${i}`;
    const [result] = await pool.query(
      'INSERT INTO CourseOutcome (courseId, coNumber) VALUES (?, ?)',
      [courseId, tempCoNumber]
    );
    const coId = result.insertId;
    await pool.query(
      'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
      [coId, 'THEORY', staffId || 'admin']
    );
    theoryCOs.push({ coId, coNumber: tempCoNumber, coType: 'THEORY' });
  }

  while (practicalCOs.length > practicalCount) {
    const toDelete = practicalCOs.pop();
    await pool.query('DELETE FROM COType WHERE coId = ?', [toDelete.coId]);
    await pool.query('DELETE FROM COTool WHERE coId = ?', [toDelete.coId]);
    await pool.query('DELETE FROM CourseOutcome WHERE coId = ?', [toDelete.coId]);
  }
  for (let i = 0; i < practicalCount - practicalCOs.length; i++) {
    const tempCoNumber = `CO1000${theoryCount + i}`;
    const [result] = await pool.query(
      'INSERT INTO CourseOutcome (courseId, coNumber) VALUES (?, ?)',
      [courseId, tempCoNumber]
    );
    const coId = result.insertId;
    await pool.query(
      'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
      [coId, 'PRACTICAL', staffId || 'admin']
    );
    practicalCOs.push({ coId, coNumber: tempCoNumber, coType: 'PRACTICAL' });
  }

  while (experientialCOs.length > experientialCount) {
    const toDelete = experientialCOs.pop();
    await pool.query('DELETE FROM COType WHERE coId = ?', [toDelete.coId]);
    await pool.query('DELETE FROM COTool WHERE coId = ?', [toDelete.coId]);
    await pool.query('DELETE FROM CourseOutcome WHERE coId = ?', [toDelete.coId]);
  }
  for (let i = 0; i < experientialCount - experientialCOs.length; i++) {
    const tempCoNumber = `CO1000${theoryCount + practicalCount + i}`;
    const [result] = await pool.query(
      'INSERT INTO CourseOutcome (courseId, coNumber) VALUES (?, ?)',
      [courseId, tempCoNumber]
    );
    const coId = result.insertId;
    await pool.query(
      'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
      [coId, 'EXPERIENTIAL', staffId || 'admin']
    );
    experientialCOs.push({ coId, coNumber: tempCoNumber, coType: 'EXPERIENTIAL' });
  }

  const allCOs = [...theoryCOs, ...practicalCOs, ...experientialCOs];
  let coNumber = 1;
  const coIds = [];
  for (const co of allCOs) {
    await pool.query(
      'UPDATE CourseOutcome SET coNumber = ? WHERE coId = ?',
      [`CO${coNumber}`, co.coId]
    );
    await pool.query(
      'UPDATE COType SET updatedBy = ? WHERE coId = ?',
      [staffId || 'admin', co.coId]
    );
    coIds.push(co.coId);
    coNumber++;
  }

  res.json({ 
    status: 'success', 
    message: 'Partitions and COs updated successfully', 
    data: { coIds } 
  });
});


export const getCOsForCourse = catchAsync(async (req, res) => {
  const { courseCode } = req.params;
  const userId = getStaffId(req);
  console.log('getCOsForCourse - courseCode:', courseCode, 'userId:', userId);

  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'Course code is required' });
  }
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'User not authenticated or Userid missing' });
  }

  const [courseRows] = await pool.query(
    `SELECT c.courseId 
     FROM Course c
     JOIN StaffCourse sc ON c.courseId = sc.courseId
     WHERE UPPER(c.courseCode) = UPPER(?) 
     AND sc.Userid = ?`,
    [courseCode, userId]
  );
  console.log('getCOsForCourse - courseRows:', courseRows);

  if (courseRows.length === 0) {
    const [courseOnly] = await pool.query(
      `SELECT courseId, courseCode FROM Course WHERE UPPER(courseCode) = UPPER(?)`,
      [courseCode]
    );
    const [staffCourseCheck] = await pool.query(
      `SELECT courseId, Userid, sectionId, Deptid 
       FROM StaffCourse 
       WHERE courseId = (SELECT courseId FROM Course WHERE UPPER(courseCode) = UPPER(?)) 
       AND Userid = ?`,
      [courseCode, userId]
    );
    return res.status(404).json({
      status: 'error',
      message: `Course with code '${courseCode}' does not exist or not assigned to staff with Userid ${userId}`,
      debug: { courseOnly, staffCourseCheck }
    });
  }

  const courseId = courseRows[0].courseId;

  const [cos] = await pool.query(
    `SELECT co.coId, co.courseId, co.coNumber, ct.coType 
     FROM CourseOutcome co
     LEFT JOIN COType ct ON co.coId = ct.coId
     WHERE co.courseId = ?
     ORDER BY co.coNumber`,
    [courseId]
  );
  console.log('getCOsForCourse - Course outcomes:', cos);

  res.json({ status: 'success', data: cos });
});

export const getToolsForCO = catchAsync(async (req, res) => {
  const { coId } = req.params;
  const staffId = getStaffId(req);
  console.log('getToolsForCO - coId:', coId, 'staffId:', staffId);

  if (!coId) {
    return res.status(400).json({ status: 'error', message: 'Course outcome ID is required' });
  }
  if (!staffId) {
    return res.status(401).json({ status: 'error', message: 'User not authenticated or staffId missing' });
  }

  const [coCheck] = await pool.query(
    `SELECT co.coId 
     FROM CourseOutcome co
     JOIN Course c ON co.courseId = c.courseId
     JOIN StaffCourse sc ON c.courseId = sc.courseId
     WHERE co.coId = ? AND sc.Userid = ?`,
    [coId, staffId]
  );
  console.log('getToolsForCO - coCheck:', coCheck);

  if (coCheck.length === 0) {
    return res.status(404).json({ 
      status: 'error', 
      message: `Course outcome with ID ${coId} does not exist or not assigned to staff with Userid ${staffId}`
    });
  }

  const [tools] = await pool.query(
    `SELECT t.toolId, t.coId, t.toolName, t.weightage, td.maxMarks
     FROM COTool t
     JOIN ToolDetails td ON t.toolId = td.toolId
     WHERE t.coId = ?`,
    [coId]
  );
  console.log('getToolsForCO - Tools:', tools);

  res.json({ status: 'success', data: tools });
});

export const createTool = async (req, res) => {
  const { coId } = req.params;
  const { toolName, weightage, maxMarks } = req.body;
  try {
    if (!toolName || !weightage || !maxMarks) {
      return res.status(400).json({ status: 'error', message: 'Tool name, weightage, and max marks are required' });
    }
    const [result] = await db.query(
      'INSERT INTO COTool (coId, toolName, weightage) VALUES (?, ?, ?)',
      [coId, toolName, weightage]
    );
    const toolId = result.insertId;
    await db.query(
      'INSERT INTO ToolDetails (toolId, maxMarks, createdBy) VALUES (?, ?, ?)',
      [toolId, maxMarks, req.user.email]
    );
    res.status(201).json({ toolId, toolName, weightage, maxMarks });
  } catch (err) {
    console.error('Error creating tool:', err);
    res.status(500).json({ status: 'error', message: 'Failed to create tool' });
  }
};

export const saveToolsForCO = async (req, res) => {
  const { coId } = req.params;
  const { tools } = req.body;
  const staffId = getStaffId(req);
  if (!tools || !Array.isArray(tools)) {
    return res.status(400).json({ status: 'error', message: 'tools array is required' });
  }
  try {
    const [coCheck] = await pool.query('SELECT courseId FROM CourseOutcome WHERE coId = ?', [coId]);
    if (coCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: 'CO not found' });
    }
    const toolNames = tools.map(t => t.toolName.toLowerCase());
    if (new Set(toolNames).size !== toolNames.length) {
      return res.status(400).json({ status: 'error', message: 'Duplicate tool names not allowed in the same CO' });
    }
    const totalWeightage = tools.reduce((sum, tool) => sum + (tool.weightage || 0), 0);
    if (totalWeightage !== 100) {
      return res.status(400).json({ status: 'error', message: 'Total tool weightage for this CO must equal 100%' });
    }

    const [existingTools] = await pool.query('SELECT toolId FROM COTool WHERE coId = ?', [coId]);
    const existingToolIds = existingTools.map(t => t.toolId);
    const inputToolIds = tools.filter(t => t.toolId).map(t => t.toolId);

    const toolIdsToDelete = existingToolIds.filter(id => !inputToolIds.includes(id));
    if (toolIdsToDelete.length > 0) {
      const placeholders = toolIdsToDelete.map(() => '?').join(',');
      await pool.query(`DELETE FROM StudentCOTool WHERE toolId IN (${placeholders})`, toolIdsToDelete);
      await pool.query(`DELETE FROM ToolDetails WHERE toolId IN (${placeholders})`, toolIdsToDelete);
      await pool.query(`DELETE FROM COTool WHERE toolId IN (${placeholders})`, toolIdsToDelete);
    }

    for (const tool of tools) {
      if (tool.toolId && existingToolIds.includes(tool.toolId)) {
        await pool.query(
          'UPDATE COTool SET toolName = ?, weightage = ? WHERE toolId = ?',
          [tool.toolName, tool.weightage, tool.toolId]
        );
        await pool.query(
          'UPDATE ToolDetails SET maxMarks = ?, updatedBy = ? WHERE toolId = ?',
          [tool.maxMarks, staffId || 'admin', tool.toolId]
        );
      } else {
        const [result] = await pool.query(
          'INSERT INTO COTool (coId, toolName, weightage) VALUES (?, ?, ?)',
          [coId, tool.toolName, tool.weightage]
        );
        const toolId = result.insertId;
        await pool.query(
          'INSERT INTO ToolDetails (toolId, maxMarks, createdBy) VALUES (?, ?, ?)',
          [toolId, tool.maxMarks, staffId || 'admin']
        );
      }
    }
    res.json({ status: 'success', message: 'Tools saved successfully' });
  } catch (err) {
    console.error('Error in saveToolsForCO:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const updateTool = async (req, res) => {
  const { toolId } = req.params;
  const { toolName, weightage, maxMarks } = req.body;
  const staffId = getStaffId(req);
  if (!toolName || weightage === undefined || maxMarks === undefined) {
    return res.status(400).json({ status: 'error', message: 'toolName, weightage, and maxMarks are required' });
  }
  try {
    const [toolCheck] = await pool.query('SELECT coId FROM COTool WHERE toolId = ?', [toolId]);
    if (toolCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Tool not found' });
    }
    await pool.query(
      'UPDATE COTool SET toolName = ?, weightage = ? WHERE toolId = ?',
      [toolName, weightage, toolId]
    );
    await pool.query(
      'UPDATE ToolDetails SET maxMarks = ?, updatedBy = ? WHERE toolId = ?',
      [maxMarks, staffId || 'admin', toolId]
    );
    res.json({ status: 'success', message: 'Tool updated successfully' });
  } catch (err) {
    console.error('Error in updateTool:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const deleteTool = async (req, res) => {
  const { toolId } = req.params;
  try {
    const [toolCheck] = await pool.query('SELECT coId FROM COTool WHERE toolId = ?', [toolId]);
    if (toolCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Tool not found' });
    }
    await pool.query('DELETE FROM ToolDetails WHERE toolId = ?', [toolId]);
    await pool.query('DELETE FROM COTool WHERE toolId = ?', [toolId]);
    res.json({ status: 'success', message: 'Tool deleted successfully' });
  } catch (err) {
    console.error('Error in deleteTool:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getStudentMarksForTool = async (req, res) => {
  const { toolId } = req.params; // Extract toolId from req.params for the API route
  try {
    console.log('getStudentMarksForTool - toolId:', toolId);

    // Validate toolId
    if (!toolId || isNaN(parseInt(toolId))) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid toolId: ${toolId}. Tool ID must be a valid number.`,
      });
    }

    // Check if tool exists
    const [toolCheck] = await pool.query(
      `SELECT toolId FROM COTool WHERE toolId = ?`,
      [parseInt(toolId)]
    );
    if (toolCheck.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Tool with ID ${toolId} not found`,
      });
    }

    // Step 1: Check raw marks in StudentCOTool
    const [rawMarks] = await pool.query(
      `SELECT regno, toolId, marksObtained 
       FROM StudentCOTool 
       WHERE toolId = ?`,
      [parseInt(toolId)]
    );
    console.log('Raw marks from StudentCOTool:', rawMarks);

    // Step 2: Simplified query to retrieve marks
    const [marks] = await pool.query(
      `SELECT sc.regno, u.username AS name, sc.marksObtained
       FROM StudentCOTool sc
       JOIN student_details sd ON sc.regno = sd.regno
       JOIN users u ON sd.Userid = u.Userid
       WHERE sc.toolId = ?`,
      [parseInt(toolId)]
    );
    console.log('Simplified query result:', marks);

    res.json({ status: 'success', data: marks, debug: { rawMarks } });
  } catch (error) {
    console.error('Error in getStudentMarksForTool:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch marks for tool',
    });
  }
};


export const saveStudentMarksForTool = catchAsync(async (req, res) => {
  const { toolId } = req.params;
  const { marks } = req.body; // Expecting { marks: [...] }
  const userId = getStaffId(req); // Returns Userid (e.g., '2')
  console.log('saveStudentMarksForTool - toolId:', toolId, 'marks:', marks, 'userId:', userId, 'userId type:', typeof userId);

  // Validate input
  if (!toolId || toolId === 'undefined') {
    return res.status(400).json({ status: 'error', message: 'Tool ID is required and cannot be undefined' });
  }
  if (!Array.isArray(marks) || marks.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Marks array is required and cannot be empty' });
  }
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'User not authenticated or Userid missing' });
  }

  // Check if tool exists and get maxMarks, courseId
  const [tool] = await pool.query(
    `SELECT td.maxMarks, co.courseId 
     FROM ToolDetails td 
     JOIN COTool t ON td.toolId = t.toolId 
     JOIN CourseOutcome co ON t.coId = co.coId 
     WHERE td.toolId = ?`,
    [toolId]
  );
  console.log('saveStudentMarksForTool - tool:', tool);
  if (!tool.length) {
    return res.status(404).json({ status: 'error', message: `Tool with ID ${toolId} not found` });
  }
  const { maxMarks, courseId } = tool[0];

  // Debug: Check course details
  const [courseDetails] = await pool.query(
    `SELECT courseCode FROM Course WHERE courseId = ?`,
    [courseId]
  );
  console.log('saveStudentMarksForTool - courseDetails:', courseDetails);

  // Validate regnos against student_details, StudentCourse, and StaffCourse
  const regnos = marks.map(m => m.regno);
  const [validStudents] = await pool.query(
    `SELECT sd.regno 
     FROM student_details sd 
     JOIN StudentCourse sc ON sd.regno = sc.regno 
     JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseId = stc.courseId
     WHERE sd.regno IN (?) AND sc.courseId = ? AND stc.Userid = ?`,
    [regnos, courseId, userId]
  );
  console.log('saveStudentMarksForTool - validStudents:', validStudents);

  const validRegnos = new Set(validStudents.map(s => s.regno));
  const invalidRegnos = regnos.filter(r => !validRegnos.has(r));
  if (invalidRegnos.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: `Invalid regnos for staff Userid ${userId}'s section in course ${courseDetails[0]?.courseCode || courseId}: ${invalidRegnos.join(', ')}`,
      debug: { regnos, validStudents }
    });
  }
  if (validRegnos.size === 0) {
    return res.status(400).json({
      status: 'error',
      message: `No valid students found for staff Userid ${userId}'s section in course ${courseDetails[0]?.courseCode || courseId}`,
      debug: { regnos, validStudents }
    });
  }

  // Process marks
  for (const mark of marks) {
    const { regno, marksObtained } = mark;
    // Validate marks
    if (typeof marksObtained !== 'number' || isNaN(marksObtained) || marksObtained < 0) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid marks for ${regno}: marks must be a non-negative number`,
      });
    }
    if (marksObtained > maxMarks) {
      return res.status(400).json({
        status: 'error',
        message: `Marks for ${regno} (${marksObtained}) exceed max (${maxMarks})`,
      });
    }

    // Check for existing entry
    const [existing] = await pool.query(
      'SELECT * FROM StudentCOTool WHERE regno = ? AND toolId = ?',
      [regno, toolId]
    );
    console.log('saveStudentMarksForTool - existing entry for', regno, ':', existing);
    try {
      if (existing.length) {
        await pool.query(
          'UPDATE StudentCOTool SET marksObtained = ? WHERE regno = ? AND toolId = ?',
          [marksObtained, regno, toolId]
        );
      } else {
        await pool.query(
          'INSERT INTO StudentCOTool (regno, toolId, marksObtained) VALUES (?, ?, ?)',
          [regno, toolId, marksObtained]
        );
      }
    } catch (queryErr) {
      console.error('saveStudentMarksForTool - query error:', queryErr);
      if (queryErr.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
          status: 'error',
          message: `Foreign key violation: regno ${regno} or toolId ${toolId} is invalid for staff Userid ${userId}'s section`,
        });
      }
      throw queryErr;
    }
  }

  res.json({ status: 'success', message: 'Marks saved successfully' });
});

export const importMarksForTool = async (req, res) => {
  const { toolId } = req.params;
  const staffId = getStaffId(req);

  // Log incoming request details
  console.log('Import request received:', { toolId, staffId, file: req.file });

  // Check if file is present
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ status: 'error', message: 'No file uploaded or invalid file upload' });
  }

  try {
    // Check tool existence
    const [tool] = await pool.query(
      `SELECT td.maxMarks, co.courseId 
       FROM ToolDetails td 
       JOIN COTool t ON td.toolId = t.toolId 
       JOIN CourseOutcome co ON t.coId = co.coId 
       WHERE td.toolId = ?`,
      [toolId]
    );
    if (!tool.length) {
      return res.status(404).json({ status: 'error', message: `Tool with ID ${toolId} not found` });
    }
    const { maxMarks, courseId } = tool[0];

    // Parse CSV from buffer
    const results = [];
    const stream = Readable.from(req.file.buffer);
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          console.log('CSV parsed successfully, rows:', results.length);
          resolve();
        })
        .on('error', (err) => {
          console.error('CSV parsing error:', err);
          reject(err);
        });
    });

    if (results.length === 0) {
      return res.status(400).json({ status: 'error', message: 'CSV file is empty' });
    }

    // Validate regnos
    const regnos = results.map(row => row.regNo || row.regno).filter(r => r);
    if (regnos.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid regnos found in CSV' });
    }

    const [validStudents] = await pool.query(
      `SELECT sd.regno 
       FROM student_details sd 
       JOIN StudentCourse sc ON sd.regno = sc.regno 
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseId = stc.courseId
       WHERE sd.regno IN (?) AND sc.courseId = ? AND stc.Userid = ?`,
      [regnos, courseId, staffId]
    );
    const validRegnos = new Set(validStudents.map(s => s.regno));
    const invalidRegnos = regnos.filter(r => !validRegnos.has(r));
    if (invalidRegnos.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid regnos for staff ${staffId}'s section in course: ${invalidRegnos.join(', ')}`,
      });
    }

    // Process marks
    for (const row of results) {
      const regno = row.regNo || row.regno;
      const marksObtained = parseFloat(row.marks);
      if (!regno || isNaN(marksObtained)) {
        console.warn('Skipping invalid row:', row);
        continue; // Skip invalid rows
      }
      if (marksObtained < 0) {
        return res.status(400).json({ status: 'error', message: `Negative marks for ${regno}` });
      }
      if (marksObtained > maxMarks) {
        return res.status(400).json({
          status: 'error',
          message: `Marks for ${regno} (${marksObtained}) exceed max (${maxMarks})`,
        });
      }

      const [existing] = await pool.query(
        'SELECT * FROM StudentCOTool WHERE regno = ? AND toolId = ?',
        [regno, toolId]
      );
      if (existing.length) {
        await pool.query(
          'UPDATE StudentCOTool SET marksObtained = ? WHERE regno = ? AND toolId = ?',
          [marksObtained, regno, toolId]
        );
      } else {
        await pool.query(
          'INSERT INTO StudentCOTool (regno, toolId, marksObtained) VALUES (?, ?, ?)',
          [regno, toolId, marksObtained]
        );
      }
      console.log(`Processed marks for ${regno}: ${marksObtained}`);
    }

    res.json({ status: 'success', message: 'Marks imported successfully' });
  } catch (err) {
    console.error('Error in importMarksForTool:', err);
    res.status(500).json({ status: 'error', message: `Import failed: ${err.message}` });
  }
};

export const exportCoWiseCsv = async (req, res) => {
  const { coId } = req.params;
  const staffId = getStaffId(req);
  try {
    // Fetch tools for the CO
    const [tools] = await pool.query(
      'SELECT t.*, td.maxMarks FROM COTool t JOIN ToolDetails td ON t.toolId = td.toolId WHERE t.coId = ?',
      [coId]
    );
    if (tools.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No tools found for this CO' });
    }

    // Fetch students from staff's section for the CO's course
    const [courseInfo] = await pool.query(
      'SELECT courseId FROM CourseOutcome WHERE coId = ?',
      [coId]
    );
    if (courseInfo.length === 0) {
      return res.status(404).json({ status: 'error', message: 'CO not found' });
    }
    const courseId = courseInfo[0].courseId;

    const [students] = await pool.query(
      `SELECT DISTINCT sd.regno, u.username AS name 
       FROM student_details sd
       JOIN users u ON sd.Userid = u.Userid
       JOIN StudentCourse sc ON sd.regno = sc.regno
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseId = stc.courseId
       JOIN CourseOutcome co ON sc.courseId = co.courseId
       WHERE co.coId = ? AND stc.Userid = ?`,
      [coId, staffId]
    );
    if (students.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No students found in your section for this CO' });
    }

    // Build CSV header
    const header = [{ id: 'regNo', title: 'Reg No' }, { id: 'name', title: 'Name' }];
    tools.forEach((tool) => {
      header.push({ id: tool.toolName, title: `${tool.toolName} (${tool.maxMarks})` });
    });
    header.push({ id: 'consolidated', title: 'Consolidated' });

    // Build CSV data
    const data = await Promise.all(
      students.map(async (student) => {
        const row = { regNo: student.regno, name: student.name };
        let consolidated = 0;
        for (const tool of tools) {
          const [mark] = await pool.query(
            'SELECT marksObtained FROM StudentCOTool WHERE regno = ? AND toolId = ?',
            [student.regno, tool.toolId]
          );
          const marks = mark[0]?.marksObtained || 0;
          row[tool.toolName] = marks;
          consolidated += (marks / tool.maxMarks) * (tool.weightage / 100);
        }
        row.consolidated = Math.round(consolidated * 100 * 100) / 100; // Round to 2 decimals
        return row;
      })
    );

    // Generate dynamic filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `co_${coId}_marks_${timestamp}.csv`;
    const filePath = path.join(os.tmpdir(), filename);

    // Write CSV
    const csvWriter = createCsvWriter({
      path: filePath,
      header,
    });
    await csvWriter.writeRecords(data);

    // Send file for download
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
      });
    });
  } catch (err) {
    console.error('Error in exportCoWiseCsv:', err);
    res.status(500).json({ 
      status: 'error', 
      message: `Export failed: ${err.message}. Check if tools/students exist for CO ${coId} and staff ${staffId}.` 
    });
  }
};


export const getStudentsForCourse = catchAsync(async (req, res) => {
  const { courseCode } = req.params;
  const userId = getStaffId(req); // Returns Userid (e.g., '2')
  try {
    console.log('getStudentsForCourse - courseCode:', courseCode, 'userId:', userId, 'userId type:', typeof userId);

    // Debug: Log req.user
    console.log('req.user:', req.user);

    // Debug: Check Course table
    const [courseOnly] = await pool.query(
      `SELECT courseId, courseCode FROM Course WHERE UPPER(courseCode) = UPPER(?)`,
      [courseCode]
    );
    console.log('Course table check:', courseOnly);

    // Debug: Check StaffCourse table
    const [staffCourseCheck] = await pool.query(
      `SELECT courseId, Userid, sectionId, Deptid FROM StaffCourse WHERE courseId = (SELECT courseId FROM Course WHERE UPPER(courseCode) = UPPER(?)) AND Userid = ?`,
      [courseCode, userId]
    );
    console.log('StaffCourse check:', staffCourseCheck);

    // Main query
    const [courseCheck] = await pool.query(
      `SELECT c.courseId 
       FROM Course c
       JOIN StaffCourse sc ON c.courseId = sc.courseId
       WHERE UPPER(c.courseCode) = UPPER(?) AND sc.Userid = ?`,
      [courseCode, userId]
    );
    console.log('Course check result:', courseCheck);

    if (courseCheck.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Course with code '${courseCode}' not found or not assigned to user ID ${userId}`,
        debug: { courseOnly, staffCourseCheck }
      });
    }
    const courseId = courseCheck[0].courseId;

    const [students] = await pool.query(
      `SELECT sd.regno, u.username AS name 
       FROM student_details sd
       JOIN users u ON sd.Userid = u.Userid
       JOIN StudentCourse sc ON sd.regno = sc.regno
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseId = stc.courseId
       WHERE sc.courseId = ? AND stc.Userid = ?`,
      [courseId, userId]
    );
    console.log('Students retrieved:', students);

    res.json({ status: 'success', data: students });
  } catch (err) {
    console.error('Error in getStudentsForCourse:', err);
    res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch students' });
  }
});


export const getStudentsForSection = catchAsync(async (req, res) => {
  const { courseCode, sectionId } = req.params;
  const userId = getStaffId(req); // Returns Userid (e.g., '2')
  console.log('getStudentsForSection - courseCode:', courseCode, 'sectionId:', sectionId, 'userId:', userId, 'userId type:', typeof userId);

  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'Course code is required' });
  }
  if (!sectionId || sectionId === 'undefined') {
    return res.status(400).json({ status: 'error', message: 'Section ID is required and cannot be undefined' });
  }
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'User not authenticated or Userid missing' });
  }

  // Debug: Check Course table
  const [courseOnly] = await pool.query(
    `SELECT courseId, courseCode FROM Course WHERE UPPER(courseCode) = UPPER(?)`,
    [courseCode]
  );
  console.log('getStudentsForSection - Course table check:', courseOnly);

  // Debug: Check StaffCourse table
  const [staffCourseCheck] = await pool.query(
    `SELECT courseId, Userid, sectionId, Deptid 
     FROM StaffCourse 
     WHERE courseId = (SELECT courseId FROM Course WHERE UPPER(courseCode) = UPPER(?)) 
     AND sectionId = ? 
     AND Userid = ?`,
    [courseCode, sectionId, userId]
  );
  console.log('getStudentsForSection - StaffCourse check:', staffCourseCheck);

  // Main query
  const [courseCheck] = await pool.query(
    `SELECT c.courseId 
     FROM Course c
     JOIN StaffCourse sc ON c.courseId = sc.courseId
     WHERE UPPER(c.courseCode) = UPPER(?) 
     AND sc.sectionId = ? 
     AND sc.Userid = ?`,
    [courseCode, sectionId, userId]
  );
  console.log('getStudentsForSection - courseCheck:', courseCheck);

  if (courseCheck.length === 0) {
    return res.status(404).json({
      status: 'error',
      message: `Course with code '${courseCode}' not found or not assigned to staff with Userid ${userId} for section ${sectionId}`,
      debug: { courseOnly, staffCourseCheck }
    });
  }
  const courseId = courseCheck[0].courseId;

  const [rows] = await pool.query(
    `SELECT sd.regno, u.username AS name
     FROM student_details sd
     JOIN users u ON sd.Userid = u.Userid
     JOIN StudentCourse sc ON sd.regno = sc.regno
     JOIN StaffCourse stc ON sc.courseId = stc.courseId AND sc.sectionId = stc.sectionId
     WHERE sc.courseId = ? AND sc.sectionId = ? AND stc.Userid = ?`,
    [courseId, sectionId, userId]
  );
  console.log('getStudentsForSection - students:', rows);

  res.json({
    status: 'success',
    results: rows.length,
    data: rows
  });
});

export const exportCourseWiseCsv = catchAsync(async (req, res) => {
  const { courseCode } = req.params;
  const staffId = getStaffId(req);
  try {
    const [courseCheck] = await pool.query(
      `SELECT c.courseId 
       FROM Course c
       JOIN StaffCourse sc ON c.courseId = sc.courseId
       WHERE c.courseCode = ? AND sc.Userid = ?`,
      [courseCode, staffId]
    );
    if (courseCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: `Course ${courseCode} not found or not assigned to staff` });
    }
    const courseId = courseCheck[0].courseId;

    const [cos] = await pool.query(
      'SELECT co.*, ct.coType FROM CourseOutcome co JOIN COType ct ON co.coId = ct.coId WHERE courseId = ? ORDER BY co.coNumber',
      [courseId]
    );
    if (cos.length === 0) {
      return res.status(404).json({ status: 'error', message: `No course outcomes found for course ${courseCode}` });
    }

    const [students] = await pool.query(
      `SELECT DISTINCT sd.regno, u.username AS name 
       FROM student_details sd
       JOIN users u ON sd.Userid = u.Userid
       JOIN StudentCourse sc ON sd.regno = sc.regno
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseId = stc.courseId
       WHERE sc.courseId = ? AND stc.Userid = ?`,
      [courseId, staffId]
    );
    if (students.length === 0) {
      return res.status(404).json({ status: 'error', message: `No students found in your section for course ${courseCode}` });
    }

    const header = [
      { id: 'regNo', title: 'Reg No' },
      { id: 'name', title: 'Name' },
      ...cos.map(co => ({ id: co.coNumber, title: co.coNumber })),
      { id: 'avgTheory', title: 'Avg Theory' },
      { id: 'avgPractical', title: 'Avg Practical' },
      { id: 'avgExperiential', title: 'Avg Experiential' },
      { id: 'finalAvg', title: 'Final Average' },
    ];

    const data = await Promise.all(
      students.map(async (student) => {
        const row = { regNo: student.regno, name: student.name };
        let theorySum = 0, theoryCount = 0, pracSum = 0, pracCount = 0, expSum = 0, expCount = 0;
        for (const co of cos) {
          const [tools] = await pool.query(
            'SELECT t.*, td.maxMarks FROM COTool t JOIN ToolDetails td ON t.toolId = td.toolId WHERE t.coId = ?',
            [co.coId]
          );
          let coMark = 0;
          let totalToolWeight = 0;
          for (const tool of tools) {
            const [mark] = await pool.query(
              'SELECT marksObtained FROM StudentCOTool WHERE regno = ? AND toolId = ?',
              [student.regno, tool.toolId]
            );
            const marks = mark[0]?.marksObtained || 0;
            const weight = Number(tool.weightage) || 100;
            coMark += (marks / tool.maxMarks) * (weight / 100);
            totalToolWeight += weight / 100;
          }
          coMark = totalToolWeight > 0 ? (coMark / totalToolWeight) * 100 : 0;
          row[co.coNumber] = coMark.toFixed(2);
          if (co.coType === 'THEORY') { theorySum += coMark; theoryCount++; }
          else if (co.coType === 'PRACTICAL') { pracSum += coMark; pracCount++; }
          else if (co.coType === 'EXPERIENTIAL') { expSum += coMark; expCount++; }
        }
        row.avgTheory = theoryCount ? (theorySum / theoryCount).toFixed(2) : '0.00';
        row.avgPractical = pracCount ? (pracSum / pracCount).toFixed(2) : '0.00';
        row.avgExperiential = expCount ? (expSum / expCount).toFixed(2) : '0.00';

        const activePartitions = [
          { count: theoryCount, type: 'THEORY' },
          { count: pracCount, type: 'PRACTICAL' },
          { count: expCount, type: 'EXPERIENTIAL' },
        ].filter(p => p.count > 0);
        let finalAvg = 0;
        if (activePartitions.length > 0) {
          const totalCOWeight = cos.length; // Equal weight for COs
          finalAvg = cos
            .filter(co => activePartitions.some(p => p.type === co.coType))
            .reduce((sum, co) => sum + parseFloat(row[co.coNumber]) / totalCOWeight, 0);
        }
        row.finalAvg = finalAvg.toFixed(2);

        return row;
      })
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${courseCode}_marks_${timestamp}.csv`;
    const filePath = path.join(os.tmpdir(), filename);

    const csvWriter = createCsvWriter({
      path: filePath,
      header,
    });
    await csvWriter.writeRecords(data);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ status: 'error', message: `Failed to send CSV: ${err.message}` });
      }
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
      });
    });
  } catch (err) {
    console.error('Error in exportCourseWiseCsv:', err);
    res.status(500).json({ 
      status: 'error', 
      message: `Export failed: ${err.message}. Check if students/COs exist for course ${courseCode} and staff ${staffId}.` 
    });
  }
});

export const getMyCourses = catchAsync(async (req, res) => {
  const userId = getStaffId(req); // Returns Userid (e.g., '2')
  console.log('getMyCourses - userId:', userId, 'userId type:', typeof userId);

  if (!userId) {
    console.log('getMyCourses - Invalid user ID');
    return res.status(401).json({ 
      status: 'error', 
      message: 'User not authenticated or Userid missing', 
      data: [] 
    });
  }

  const [courses] = await pool.query(
    `SELECT 
       sc.staffCourseId,
       sc.Userid AS staffUserId,
       u.staffId,
       c.courseCode AS id,
       c.courseTitle AS title,
       sc.sectionId,
       s.sectionName,
       sc.Deptid,
       d.Deptname AS departmentName,
       CONCAT(
         b.batchYears, ' ',
         CASE WHEN sem.semesterNumber % 2 = 1 THEN 'ODD' ELSE 'EVEN' END,
         ' SEMESTER'
       ) AS semester,
       sem.semesterNumber,
       b.degree,
       b.branch,
       b.batch
     FROM StaffCourse sc
     JOIN Course c ON sc.courseId = c.courseId
     JOIN Section s ON sc.sectionId = s.sectionId
     JOIN department d ON sc.Deptid = d.Deptid
     JOIN Semester sem ON c.semesterId = sem.semesterId
     JOIN Batch b ON sem.batchId = b.batchId
     JOIN users u ON sc.Userid = u.Userid
     WHERE sc.Userid = ?
       AND c.isActive = 'YES'
       AND s.isActive = 'YES'
       AND sem.isActive = 'YES'
       AND b.isActive = 'YES'
     ORDER BY c.courseTitle`,
    [userId]
  );
  console.log('getMyCourses - Fetched courses:', courses);

  res.json({ 
    status: 'success', 
    results: courses.length, 
    data: courses 
  });
});

export const getConsolidatedMarks = catchAsync(async (req, res) => {
  const { batch, dept, sem, batchId, deptId } = req.query;
  const batchParam = batch || batchId;
  const deptParam = dept || deptId;
  const semParam = sem;

  console.log('Received query params:', { batchParam, deptParam, semParam });

  if (!batchParam || !deptParam || !semParam) {
    return res.status(400).json({ status: 'failure', message: 'Missing required parameters' });
  }

  // Get Deptid
  let deptIdValue = deptParam;
  const [deptRows] = await pool.query(
    `SELECT Deptid FROM department WHERE Deptacronym = ? OR Deptid = ?`,
    [deptParam, deptParam]
  );
  if (deptRows.length === 0) {
    return res.status(404).json({ status: 'failure', message: 'Department not found' });
  }
  deptIdValue = deptRows[0].Deptid;

  // Get batchId
  const [batchRows] = await pool.query(
    `SELECT batchId FROM Batch 
     WHERE batch = ? 
       AND branch = (SELECT Deptacronym FROM department WHERE Deptid = ?) 
       AND isActive = 'YES'`,
    [batchParam, deptIdValue]
  );
  if (batchRows.length === 0) {
    console.log('Batch query failed for:', { batch: batchParam, deptId: deptIdValue });
    return res.status(404).json({ status: 'failure', message: 'Batch not found' });
  }
  const batchIdValue = batchRows[0].batchId;

  // Get semesterId
  const [semRows] = await pool.query(
    `SELECT semesterId FROM Semester 
     WHERE batchId = ? AND semesterNumber = ? AND isActive = 'YES'`,
    [batchIdValue, semParam]
  );
  if (semRows.length === 0) {
    return res.status(404).json({ status: 'failure', message: 'Semester not found' });
  }
  const semesterId = semRows[0].semesterId;

  // Get students
  const [students] = await pool.query(
    `SELECT sd.regno, u.username AS name 
     FROM student_details sd 
     JOIN users u ON sd.Userid = u.Userid 
     WHERE sd.Deptid = ? 
       AND sd.batch = ? 
       AND sd.Semester = ? 
       AND u.status = 'active'`,
    [deptIdValue, batchParam, semParam]
  );

  // Get courses
  const [courses] = await pool.query(
    `SELECT c.courseId, c.courseCode, c.courseTitle, 
            COALESCE(cp.theoryCount, 0) AS theoryCount, 
            COALESCE(cp.practicalCount, 0) AS practicalCount, 
            COALESCE(cp.experientialCount, 0) AS experientialCount 
     FROM Course c 
     LEFT JOIN CoursePartitions cp ON c.courseId = cp.courseId 
     WHERE c.semesterId = ? AND c.isActive = 'YES'`,
    [semesterId]
  );
  console.log('Courses fetched:', courses);

  if (courses.length === 0) {
    return res.status(200).json({
      status: 'success',
      data: { students, courses: [], marks: {} },
      message: 'No courses found for the selected semester',
    });
  }

  // Get COs with types
  const courseIds = courses.map(c => c.courseId);
  console.log('Course IDs:', courseIds);
  let cosMap = {};
  let cos = [];
  if (courseIds.length > 0) {
    try {
      [cos] = await pool.query(
        `SELECT co.coId, co.courseId, co.coNumber, ct.coType 
         FROM CourseOutcome co 
         LEFT JOIN COType ct ON co.coId = ct.coId 
         WHERE co.courseId IN (?)`,
        [courseIds]
      );
      console.log('Course outcomes fetched:', cos);
      if (cos.length > 0) {
        cosMap = cos.reduce((acc, co) => {
          if (!acc[co.courseId]) acc[co.courseId] = [];
          acc[co.courseId].push(co);
          return acc;
        }, {});
      } else {
        console.warn('No course outcomes found for courseIds:', courseIds);
      }
    } catch (err) {
      console.error('Error fetching course outcomes:', err.message, err.sql);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch course outcomes',
      });
    }
  }

  // Get tools
  const coIds = cos.map(co => co.coId).filter(id => id != null);
  console.log('Course outcome IDs:', coIds);
  let toolsMap = {};
  let tools = [];
  if (coIds.length > 0) {
    try {
      [tools] = await pool.query(
        `SELECT t.toolId, t.coId, t.toolName, t.weightage, td.maxMarks 
         FROM COTool t 
         JOIN ToolDetails td ON t.toolId = td.toolId 
         WHERE t.coId IN (?)`,
        [coIds]
      );
      console.log('Tools fetched:', tools);
      toolsMap = tools.reduce((acc, tool) => {
        if (!acc[tool.coId]) acc[tool.coId] = [];
        acc[tool.coId].push(tool);
        return acc;
      }, {});
    } catch (err) {
      console.error('Error fetching tools:', err.message, err.sql);
      return res.status(200).json({
        status: 'success',
        data: { students, courses, marks: {} },
        message: 'No evaluation tools found for the selected courses',
      });
    }
  }

  // Get marks
  const regnos = students.map(s => s.regno);
  const toolIds = tools.map(t => t.toolId);
  console.log('Student regnos:', regnos, 'Tool IDs:', toolIds);
  let marksByStudentTool = {};
  if (regnos.length > 0 && toolIds.length > 0) {
    try {
      const [marksRows] = await pool.query(
        `SELECT regno, toolId, marksObtained 
         FROM StudentCOTool 
         WHERE regno IN (?) AND toolId IN (?)`,
        [regnos, toolIds]
      );
      console.log('Marks fetched:', marksRows);
      marksByStudentTool = marksRows.reduce((acc, m) => {
        if (!acc[m.regno]) acc[m.regno] = {};
        acc[m.regno][m.toolId] = m.marksObtained;
        return acc;
      }, {});
    } catch (err) {
      console.error('Error fetching marks:', err.message, err.sql);
      return res.status(200).json({
        status: 'success',
        data: { students, courses, marks: {} },
        message: 'No marks found for the selected students and tools',
      });
    }
  }

  // Compute consolidated marks
  const marksMap = {};
  students.forEach(student => {
    const regno = student.regno;
    marksMap[regno] = {};
    courses.forEach(course => {
      const courseId = course.courseId;
      const courseCos = cosMap[courseId] || [];

      const computeAvg = (type) => {
        const typeCos = courseCos.filter(co => co.coType && co.coType.toUpperCase() === type);
        const typeCount = typeCos.length;
        if (typeCount === 0) return null;

        let sumCoMark = 0;
        typeCos.forEach(co => {
          let coMark = 0;
          (toolsMap[co.coId] || []).forEach(tool => {
            const marksObtained = marksByStudentTool[regno]?.[tool.toolId] || 0;
            coMark += (marksObtained / (tool.maxMarks || 1)) * (tool.weightage / 100);
          });
          sumCoMark += coMark * 100;
        });

        const avg = sumCoMark / typeCount;
        return isNaN(avg) ? null : avg.toFixed(2);
      };

      marksMap[regno][course.courseCode] = {
        theory: course.theoryCount > 0 ? computeAvg('THEORY') : null,
        practical: course.practicalCount > 0 ? computeAvg('PRACTICAL') : null,
        experiential: course.experientialCount > 0 ? computeAvg('EXPERIENTIAL') : null,
      };
    });
  });

  console.log('Final marks map:', marksMap);
  res.status(200).json({
    status: 'success',
    data: { students, courses, marks: marksMap },
    message: cos.length === 0 ? 'No course outcomes found for the selected courses' : undefined,
  });
});
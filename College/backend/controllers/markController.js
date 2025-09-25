import pool from '../db.js';
import csv from 'csv-parser';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import  catchAsync from '../utils/catchAsync.js';

const getStaffId = (req) => req.user.staffId || null;

export const getCoursePartitions = async (req, res) => {
  const { courseCode } = req.params;
  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'courseCode is required' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM CoursePartitions WHERE courseCode = ?', [courseCode]);
    res.json({ status: 'success', data: rows[0] || { theoryCount: 0, practicalCount: 0, experientialCount: 0 } });
  } catch (err) {
    console.error('Error in getCoursePartitions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const saveCoursePartitions = async (req, res) => {
  const { courseCode } = req.params;
  const { theoryCount, practicalCount, experientialCount } = req.body;
  const staffId = getStaffId(req);

  // Validate inputs
  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'Course code is required' });
  }
  if (theoryCount === undefined || practicalCount === undefined || experientialCount === undefined) {
    return res.status(400).json({ status: 'error', message: 'Theory, practical, and experiential counts are required' });
  }
  if (theoryCount < 0 || practicalCount < 0 || experientialCount < 0) {
    return res.status(400).json({ status: 'error', message: 'Counts cannot be negative' });
  }

  try {
    // Check if course exists
    const [courseCheck] = await pool.query('SELECT courseCode FROM Course WHERE courseCode = ?', [courseCode]);
    if (courseCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: `Course with code '${courseCode}' does not exist` });
    }

    // Check if partitions already exist
    const [existing] = await pool.query('SELECT partitionId FROM CoursePartitions WHERE courseCode = ?', [courseCode]);
    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Partitions already exist for this course. Use PUT to update.',
      });
    }

    // Save partitions
    const [result] = await pool.query(
      'INSERT INTO CoursePartitions (courseCode, theoryCount, practicalCount, experientialCount, createdBy) VALUES (?, ?, ?, ?, ?)',
      [courseCode, theoryCount, practicalCount, experientialCount, staffId || 'admin']
    );

    // Auto-create COs
    const totalCOs = theoryCount + practicalCount + experientialCount;
    let coNumber = 1;
    const coIds = [];

    // Theory COs
    for (let i = 0; i < theoryCount; i++) {
      const [result] = await pool.query(
        'INSERT INTO CourseOutcome (courseCode, coNumber) VALUES (?, ?)',
        [courseCode, `CO${coNumber}`]
      );
      const coId = result.insertId;
      await pool.query(
        'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
        [coId, 'THEORY', staffId || 'admin']
      );
      coIds.push(coId);
      coNumber++;
    }

    // Practical COs
    for (let i = 0; i < practicalCount; i++) {
      const [result] = await pool.query(
        'INSERT INTO CourseOutcome (courseCode, coNumber) VALUES (?, ?)',
        [courseCode, `CO${coNumber}`]
      );
      const coId = result.insertId;
      await pool.query(
        'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
        [coId, 'PRACTICAL', staffId || 'admin']
      );
      coIds.push(coId);
      coNumber++;
    }

    // Experiential COs
    for (let i = 0; i < experientialCount; i++) {
      const [result] = await pool.query(
        'INSERT INTO CourseOutcome (courseCode, coNumber) VALUES (?, ?)',
        [courseCode, `CO${coNumber}`]
      );
      const coId = result.insertId;
      await pool.query(
        'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
        [coId, 'EXPERIENTIAL', staffId || 'admin']
      );
      coIds.push(coId);
      coNumber++;
    }

    res.json({
      status: 'success',
      message: 'Partitions and COs saved successfully',
      data: { partitionId: result.insertId, coIds },
    });
  } catch (err) {
    console.error('Error in saveCoursePartitions:', err);
    res.status(500).json({ status: 'error', message: `Failed to save partitions: ${err.message}` });
  }
};

export const updateCoursePartitions = async (req, res) => {
  const { courseCode } = req.params;
  const { theoryCount, practicalCount, experientialCount } = req.body;
  const staffId = getStaffId(req);
  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'courseCode is required' });
  }
  if (theoryCount === undefined || practicalCount === undefined || experientialCount === undefined) {
    return res.status(400).json({ status: 'error', message: 'theoryCount, practicalCount, and experientialCount are required' });
  }
  try {
    const [courseCheck] = await pool.query('SELECT courseCode FROM Course WHERE courseCode = ?', [courseCode]);
    if (courseCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: `Course with code '${courseCode}' does not exist` });
    }
    const [existing] = await pool.query('SELECT partitionId FROM CoursePartitions WHERE courseCode = ?', [courseCode]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No partitions found for this course. Use POST to create.' });
    }
    // Update partitions
    await pool.query(
      'UPDATE CoursePartitions SET theoryCount = ?, practicalCount = ?, experientialCount = ?, updatedBy = ? WHERE courseCode = ?',
      [theoryCount, practicalCount, experientialCount, staffId || 'admin', courseCode]
    );
    
    // Fetch existing COs with types, sorted by coNumber
    const [existingCOs] = await pool.query(
      `SELECT co.coId, co.coNumber, ct.coType 
       FROM CourseOutcome co
       LEFT JOIN COType ct ON co.coId = ct.coId
       WHERE co.courseCode = ?
       ORDER BY CAST(SUBSTRING(co.coNumber, 3) AS UNSIGNED)`,
      [courseCode]
    );
    
    // Group by type
    let theoryCOs = existingCOs.filter(co => co.coType === 'THEORY');
    let practicalCOs = existingCOs.filter(co => co.coType === 'PRACTICAL');
    let experientialCOs = existingCOs.filter(co => co.coType === 'EXPERIENTIAL');
    
    // Adjust theory group
    while (theoryCOs.length > theoryCount) {
      const toDelete = theoryCOs.pop();
      await pool.query('DELETE FROM COType WHERE coId = ?', [toDelete.coId]);
      await pool.query('DELETE FROM COTool WHERE coId = ?', [toDelete.coId]);
      await pool.query('DELETE FROM CourseOutcome WHERE coId = ?', [toDelete.coId]);
    }
    for (let i = 0; i < theoryCount - theoryCOs.length; i++) {
      const tempCoNumber = `CO1000${i}`;
      const [result] = await pool.query(
        'INSERT INTO CourseOutcome (courseCode, coNumber) VALUES (?, ?)',
        [courseCode, tempCoNumber]
      );
      const coId = result.insertId;
      await pool.query(
        'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
        [coId, 'THEORY', staffId || 'admin']
      );
      theoryCOs.push({ coId, coNumber: tempCoNumber, coType: 'THEORY' });
    }
    
    // Adjust practical group
    while (practicalCOs.length > practicalCount) {
      const toDelete = practicalCOs.pop();
      await pool.query('DELETE FROM COType WHERE coId = ?', [toDelete.coId]);
      await pool.query('DELETE FROM COTool WHERE coId = ?', [toDelete.coId]);
      await pool.query('DELETE FROM CourseOutcome WHERE coId = ?', [toDelete.coId]);
    }
    for (let i = 0; i < practicalCount - practicalCOs.length; i++) {
      const tempCoNumber = `CO1000${ theoryCount + i}`;
      const [result] = await pool.query(
        'INSERT INTO CourseOutcome (courseCode, coNumber) VALUES (?, ?)',
        [courseCode, tempCoNumber]
      );
      const coId = result.insertId;
      await pool.query(
        'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
        [coId, 'PRACTICAL', staffId || 'admin']
      );
      practicalCOs.push({ coId, coNumber: tempCoNumber, coType: 'PRACTICAL' });
    }
    
    // Adjust experiential group
    while (experientialCOs.length > experientialCount) {
      const toDelete = experientialCOs.pop();
      await pool.query('DELETE FROM COType WHERE coId = ?', [toDelete.coId]);
      await pool.query('DELETE FROM COTool WHERE coId = ?', [toDelete.coId]);
      await pool.query('DELETE FROM CourseOutcome WHERE coId = ?', [toDelete.coId]);
    }
    for (let i = 0; i < experientialCount - experientialCOs.length; i++) {
      const tempCoNumber = `CO1000${ theoryCount + practicalCount + i}`;
      const [result] = await pool.query(
        'INSERT INTO CourseOutcome (courseCode, coNumber) VALUES (?, ?)',
        [courseCode, tempCoNumber]
      );
      const coId = result.insertId;
      await pool.query(
        'INSERT INTO COType (coId, coType, createdBy) VALUES (?, ?, ?)',
        [coId, 'EXPERIENTIAL', staffId || 'admin']
      );
      experientialCOs.push({ coId, coNumber: tempCoNumber, coType: 'EXPERIENTIAL' });
    }
    
    // Recombine and renumber all COs sequentially
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
    
    res.json({ status: 'success', message: 'Partitions and COs updated successfully', data: { coIds } });
  } catch (err) {
    console.error('Error in updateCoursePartitions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getCOsForCourse = async (req, res) => {
  const { courseCode } = req.params;
  if (!courseCode) {
    return res.status(400).json({ status: 'error', message: 'courseCode is required' });
  }
  try {
    const [courseCheck] = await pool.query('SELECT courseCode FROM Course WHERE courseCode = ?', [courseCode]);
    if (courseCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: `Course with code '${courseCode}' does not exist` });
    }
    const [cos] = await pool.query(
      `SELECT co.*, ct.coType FROM CourseOutcome co
       LEFT JOIN COType ct ON co.coId = ct.coId
       WHERE co.courseCode = ?
       ORDER BY co.coNumber`,
      [courseCode]
    );
    res.json({ status: 'success', data: cos });
  } catch (err) {
    console.error('Error in getCOsForCourse:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getToolsForCO = async (req, res) => {
  const { coId } = req.params;
  try {
    const [coCheck] = await pool.query('SELECT courseCode FROM CourseOutcome WHERE coId = ?', [coId]);
    if (coCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: 'CO not found' });
    }
    const [tools] = await pool.query(
      `SELECT t.*, td.maxMarks FROM COTool t
       LEFT JOIN ToolDetails td ON t.toolId = td.toolId
       WHERE t.coId = ?`,
      [coId]
    );
    res.json({ status: 'success', data: tools });
  } catch (err) {
    console.error('Error in getToolsForCO:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const createTool = async (req, res) => {
  const { coId } = req.params;
  const { toolName, weightage, maxMarks } = req.body;
  const staffId = getStaffId(req);
  if (!toolName || weightage === undefined || maxMarks === undefined) {
    return res.status(400).json({ status: 'error', message: 'toolName, weightage, and maxMarks are required' });
  }
  try {
    const [coCheck] = await pool.query('SELECT courseCode FROM CourseOutcome WHERE coId = ?', [coId]);
    if (coCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: 'CO not found' });
    }
    const [result] = await pool.query(
      'INSERT INTO COTool (coId, toolName, weightage) VALUES (?, ?, ?)',
      [coId, toolName, weightage]
    );
    const toolId = result.insertId;
    await pool.query(
      'INSERT INTO ToolDetails (toolId, maxMarks, createdBy) VALUES (?, ?, ?)',
      [toolId, maxMarks, staffId || 'admin']
    );
    res.json({ status: 'success', data: { toolId } });
  } catch (err) {
    console.error('Error in createTool:', err);
    res.status(500).json({ status: 'error', message: err.message });
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
    const [coCheck] = await pool.query('SELECT courseCode FROM CourseOutcome WHERE coId = ?', [coId]);
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
  const { toolId } = req.params;
  const staffId = getStaffId(req);
  try {
    const [marks] = await pool.query(
      `SELECT sd.regno, u.username AS name, sc.marksObtained 
       FROM StudentCOTool sc 
       JOIN student_details sd ON sc.regno = sd.regno 
       JOIN users u ON sd.Userid = u.Userid
       JOIN StudentCourse studentc ON sd.regno = studentc.regno
       JOIN StaffCourse stc ON studentc.sectionId = stc.sectionId AND studentc.courseCode = stc.courseCode
       JOIN COTool t ON sc.toolId = t.toolId
       JOIN CourseOutcome co ON t.coId = co.coId
       WHERE sc.toolId = ? AND stc.staffId = ? AND studentc.courseCode = co.courseCode`,
      [toolId, staffId]
    );
    res.json({ status: 'success', data: marks });
  } catch (err) {
    console.error('Error in getStudentMarksForTool:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch marks for tool' });
  }
};

export const saveStudentMarksForTool = async (req, res) => {
  const { toolId } = req.params;
  const marks = req.body; // Expecting { marks: [...] }
  const staffId = getStaffId(req);
  try {
    // Validate input
    if (!Array.isArray(marks.marks) || marks.marks.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Marks array is required and cannot be empty' });
    }

    // Check if tool exists and get maxMarks, courseCode
    const [tool] = await pool.query(
      `SELECT td.maxMarks, co.courseCode FROM ToolDetails td 
       JOIN COTool t ON td.toolId = t.toolId 
       JOIN CourseOutcome co ON t.coId = co.coId 
       WHERE td.toolId = ?`,
      [toolId]
    );
    if (!tool.length) {
      return res.status(404).json({ status: 'error', message: `Tool with ID ${toolId} not found` });
    }
    const { maxMarks, courseCode } = tool[0];

    // Validate regnos against student_details, StudentCourse, and StaffCourse (staff's section)
    const regnos = marks.marks.map(m => m.regno);
    const [validStudents] = await pool.query(
      `SELECT sd.regno 
       FROM student_details sd 
       JOIN StudentCourse sc ON sd.regno = sc.regno 
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseCode = stc.courseCode
       WHERE sd.regno IN (?) AND sc.courseCode = ? AND stc.staffId = ?`,
      [regnos, courseCode, staffId]
    );
    const validRegnos = new Set(validStudents.map(s => s.regno));
    const invalidRegnos = regnos.filter(r => !validRegnos.has(r));
    if (invalidRegnos.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid regnos for staff ${staffId}'s section in course ${courseCode}: ${invalidRegnos.join(', ')}`,
      });
    }
    if (validRegnos.size === 0) {
      return res.status(400).json({
        status: 'error',
        message: `No valid students found for staff ${staffId}'s section in course ${courseCode}`,
      });
    }

    // Process marks
    for (const mark of marks.marks) {
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
        if (queryErr.code === 'ER_NO_REFERENCED_ROW_2') {
          return res.status(400).json({
            status: 'error',
            message: `Foreign key violation: regno ${regno} or toolId ${toolId} is invalid for staff ${staffId}'s section`,
          });
        }
        throw queryErr;
      }
    }

    res.json({ status: 'success', message: 'Marks saved successfully' });
  } catch (err) {
    console.error('Error in saveStudentMarksForTool:', err);
    res.status(500).json({ status: 'error', message: `Failed to save marks: ${err.message}` });
  }
};

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
      `SELECT td.maxMarks, co.courseCode 
       FROM ToolDetails td 
       JOIN COTool t ON td.toolId = t.toolId 
       JOIN CourseOutcome co ON t.coId = co.coId 
       WHERE td.toolId = ?`,
      [toolId]
    );
    if (!tool.length) {
      return res.status(404).json({ status: 'error', message: `Tool with ID ${toolId} not found` });
    }
    const { maxMarks, courseCode } = tool[0];

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
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseCode = stc.courseCode
       WHERE sd.regno IN (?) AND sc.courseCode = ? AND stc.staffId = ?`,
      [regnos, courseCode, staffId]
    );
    const validRegnos = new Set(validStudents.map(s => s.regno));
    const invalidRegnos = regnos.filter(r => !validRegnos.has(r));
    if (invalidRegnos.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid regnos for staff ${staffId}'s section in course ${courseCode}: ${invalidRegnos.join(', ')}`,
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
      'SELECT courseCode FROM CourseOutcome WHERE coId = ?',
      [coId]
    );
    if (courseInfo.length === 0) {
      return res.status(404).json({ status: 'error', message: 'CO not found' });
    }
    const courseCode = courseInfo[0].courseCode;

    const [students] = await pool.query(
      `SELECT DISTINCT sd.regno, u.username AS name 
       FROM student_details sd
       JOIN users u ON sd.Userid = u.Userid
       JOIN StudentCourse sc ON sd.regno = sc.regno
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseCode = stc.courseCode
       JOIN CourseOutcome co ON sc.courseCode = co.courseCode
       WHERE co.coId = ? AND stc.staffId = ?`,
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

export const getStudentsForCourse = async (req, res) => {
  const { courseCode } = req.params;
  const staffId = getStaffId(req);
  try {
    const [students] = await pool.query(
      `SELECT sd.regno, u.username AS name FROM student_details sd
       JOIN users u ON sd.Userid = u.Userid
       JOIN StudentCourse sc ON sd.regno = sc.regno
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseCode = stc.courseCode
       WHERE sc.courseCode = ? AND stc.staffId = ?`,
      [courseCode, staffId]
    );
    res.json({ status: 'success', data: students });
  } catch (err) {
    console.error('Error in getStudentsForCourse:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getMyCourses = async (req, res) => {
  const staffId = getStaffId(req);
  if (!staffId) {
    return res.status(401).json({ status: 'error', message: 'Invalid staff ID' });
  }

  try {
    const [courses] = await pool.query(
      `SELECT 
         sc.staffCourseId,
         sc.staffId,
         sc.courseCode AS id,
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
       JOIN Course c ON sc.courseCode = c.courseCode
       JOIN Section s ON sc.sectionId = s.sectionId
       JOIN department d ON sc.Deptid = d.Deptid
       JOIN Semester sem ON c.semesterId = sem.semesterId
       JOIN Batch b ON sem.batchId = b.batchId
       WHERE sc.staffId = ?
         AND c.isActive = 'YES'
         AND s.isActive = 'YES'
         AND sem.isActive = 'YES'
         AND b.isActive = 'YES'
       ORDER BY c.courseTitle`,
      [staffId]
    );

    res.json({ status: 'success', data: courses });
  } catch (err) {
    console.error('Error in getMyCourses:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

export const getStudentsForSection = async (req, res) => {
  const { courseCode, sectionId } = req.params;
  const staffId = getStaffId(req);
  try {
    const [rows] = await pool.query(
      `SELECT sd.regno, u.username AS name
       FROM student_details sd
       JOIN users u ON sd.Userid = u.Userid
       JOIN StudentCourse sc ON sd.regno = sc.regno
       JOIN StaffCourse stc ON sc.courseCode = stc.courseCode AND sc.sectionId = stc.sectionId
       WHERE sc.courseCode = ? AND sc.sectionId = ? AND stc.staffId = ?`,
      [courseCode, sectionId, staffId]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error in getStudentsForSection:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch students for section' });
  }
};

export const exportCourseWiseCsv = async (req, res) => {
  const { courseCode } = req.params;
  const staffId = getStaffId(req);
  try {
    // Validate course
    const [courseCheck] = await pool.query('SELECT courseCode FROM Course WHERE courseCode = ?', [courseCode]);
    if (courseCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: `Course ${courseCode} not found` });
    }

    // Fetch COs
    const [cos] = await pool.query(
      'SELECT co.*, ct.coType FROM CourseOutcome co JOIN COType ct ON co.coId = ct.coId WHERE courseCode = ? ORDER BY co.coNumber',
      [courseCode]
    );
    if (cos.length === 0) {
      return res.status(404).json({ status: 'error', message: `No course outcomes found for course ${courseCode}` });
    }

    // Fetch students
    const [students] = await pool.query(
      `SELECT DISTINCT sd.regno, u.username AS name 
       FROM student_details sd
       JOIN users u ON sd.Userid = u.Userid
       JOIN StudentCourse sc ON sd.regno = sc.regno
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseCode = stc.courseCode
       WHERE sc.courseCode = ? AND stc.staffId = ?`,
      [courseCode, staffId]
    );
    if (students.length === 0) {
      return res.status(404).json({ status: 'error', message: `No students found in your section for course ${courseCode}` });
    }

    // Build CSV header
    const header = [
      { id: 'regNo', title: 'Reg No' },
      { id: 'name', title: 'Name' },
      ...cos.map(co => ({ id: co.coNumber, title: co.coNumber })),
      { id: 'avgTheory', title: 'Avg Theory' },
      { id: 'avgPractical', title: 'Avg Practical' },
      { id: 'avgExperiential', title: 'Avg Experiential' },
      { id: 'finalAvg', title: 'Final Average' },
    ];

    // Build CSV data
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
          for (const tool of tools) {
            const [mark] = await pool.query(
              'SELECT marksObtained FROM StudentCOTool WHERE regno = ? AND toolId = ?',
              [student.regno, tool.toolId]
            );
            const marks = mark[0]?.marksObtained || 0;
            coMark += (marks / tool.maxMarks) * (tool.weightage / 100);
          }
          coMark *= 100;
          row[co.coNumber] = coMark.toFixed(2);
          if (co.coType === 'THEORY') { theorySum += coMark; theoryCount++; }
          else if (co.coType === 'PRACTICAL') { pracSum += coMark; pracCount++; }
          else if (co.coType === 'EXPERIENTIAL') { expSum += coMark; expCount++; }
        }
        row.avgTheory = theoryCount ? (theorySum / theoryCount).toFixed(2) : '0.00';
        row.avgPractical = pracCount ? (pracSum / pracCount).toFixed(2) : '0.00';
        row.avgExperiential = expCount ? (expSum / expCount).toFixed(2) : '0.00';

        // Calculate finalAvg using only non-zero partitions
        const activePartitions = [
          { count: theoryCount, type: 'THEORY' },
          { count: pracCount, type: 'PRACTICAL' },
          { count: expCount, type: 'EXPERIENTIAL' },
        ].filter(p => p.count > 0);
        let final = 0;
        if (activePartitions.length > 0) {
          const totalWeight = cos
            .filter(co => activePartitions.some(p => p.type === co.coType))
            .reduce((sum, co) => sum + 1, 0); // Equal weight per CO
          final = cos
            .filter(co => activePartitions.some(p => p.type === co.coType))
            .reduce((sum, co) => sum + (parseFloat(row[co.coNumber]) / totalWeight), 0);
        }
        row.finalAvg = final.toFixed(2);

        return row;
      })
    );

    // Generate dynamic filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${courseCode}_marks_${timestamp}.csv`;
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
        res.status(500).json({ status: 'error', message: `Failed to send CSV: ${err.message}` });
      }
      // Clean up file
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
};

export const getConsolidatedMarks = catchAsync(async (req, res) => {
  const { batchId, deptId, sem } = req.query;

  console.log('getConsolidatedMarks called with:', { batchId, deptId, sem });

  if (!batchId || !deptId || !sem) {
    return res.status(400).json({ status: 'error', message: 'batchId, deptId, and sem are required' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    console.log('Fetching batch...');
    const [batchRows] = await connection.query(
      'SELECT batch FROM Batch WHERE batchId = ? AND isActive = "YES"',
      [batchId]
    );
    if (!batchRows.length) {
      return res.status(404).json({ status: 'error', message: `Batch with ID ${batchId} not found` });
    }
    const batch = batchRows[0].batch;
    console.log('Batch fetched:', batch);

    console.log('Fetching semester...');
    const [semester] = await connection.query(
      'SELECT semesterId FROM Semester WHERE batchId = ? AND semesterNumber = ? AND isActive = "YES"',
      [batchId, sem]
    );
    if (!semester.length) {
      return res.status(404).json({ status: 'error', message: `Semester ${sem} not found for batch ${batchId}` });
    }
    const semesterId = semester[0].semesterId;
    console.log('Semester fetched:', semesterId);

    console.log('Fetching students...');
    const [students] = await connection.query(
      `SELECT sd.regno, u.username AS name, u.Userid AS userId
       FROM student_details sd
       JOIN users u ON sd.Userid = u.Userid
       WHERE sd.batch = ? AND sd.Deptid = ? AND sd.Semester = CAST(? AS CHAR) AND sd.pending = FALSE`,
      [batch, deptId, sem]
    );
    console.log('Students fetched:', students.length);

    if (students.length === 0) {
      console.warn('No students found for:', { batchId, batch, deptId, sem });
      return res.status(200).json({
        status: 'success',
        data: { students: [], courses: [], marks: [] },
        message: 'No students found for the selected batch, department, and semester'
      });
    }

    console.log('Fetching courses...');
    const [courses] = await connection.query(
      `SELECT c.courseId, c.courseCode, c.courseTitle, cp.theoryCount, cp.practicalCount, cp.experientialCount
       FROM Course c
       LEFT JOIN CoursePartitions cp ON c.courseCode = cp.courseCode
       WHERE c.semesterId = ? AND c.isActive = 'YES'`,
      [semesterId]
    );
    console.log('Courses fetched:', courses.length);

    const marks = [];
    for (const student of students) {
      for (const course of courses) {
        console.log('Fetching COs for course:', course.courseCode);
        const [cos] = await connection.query(
          `SELECT co.coId, ct.coType
           FROM CourseOutcome co
           JOIN COType ct ON co.coId = ct.coId
           WHERE co.courseCode = ?`,
          [course.courseCode]
        );
        console.log('COs fetched:', cos.length);

        let theorySum = 0, theoryCount = 0, practicalSum = 0, practicalCount = 0, experientialSum = 0, experientialCount = 0;

        for (const co of cos) {
          console.log('Fetching tools for CO:', co.coId);
          const [tools] = await connection.query(
            `SELECT t.toolId, t.weightage, td.maxMarks
             FROM COTool t
             JOIN ToolDetails td ON t.toolId = td.toolId
             WHERE t.coId = ?`,
            [co.coId]
          );
          console.log('Tools fetched:', tools.length);

          let coMark = 0;
          for (const tool of tools) {
            console.log('Fetching marks for student:', student.regno, 'tool:', tool.toolId);
            const [mark] = await connection.query(
              `SELECT marksObtained
               FROM StudentCOTool
               WHERE regno = ? AND toolId = ?`,
              [student.regno, tool.toolId]
            );
            const marksObtained = mark[0]?.marksObtained || 0;
            coMark += (marksObtained / tool.maxMarks) * (tool.weightage / 100);
          }
          coMark *= 100;

          if (co.coType === 'THEORY') {
            theorySum += coMark;
            theoryCount++;
          } else if (co.coType === 'PRACTICAL') {
            practicalSum += coMark;
            practicalCount++;
          } else if (co.coType === 'EXPERIENTIAL') {
            experientialSum += coMark;
            experientialCount++;
          }
        }

        marks.push({
          studentId: student.userId,
          courseId: course.courseId,
          theory: theoryCount ? (theorySum / theoryCount).toFixed(2) : '0.00',
          practical: practicalCount ? (practicalSum / practicalCount).toFixed(2) : '0.00',
          experiential: experientialCount ? (experientialSum / experientialCount).toFixed(2) : '0.00',
        });
      }
    }

    res.json({
      status: 'success',
      data: { students, courses, marks },
    });
  } catch (err) {
    console.error('Error in getConsolidatedMarks:', err);
    res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch consolidated marks' });
  } finally {
    if (connection) connection.release();
  }
});
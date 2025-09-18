import pool from '../db.js';
import csv from 'csv-parser';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import os from 'os'; 
import { Readable } from 'stream'; // Add this import
import { v4 as uuidv4 } from 'uuid';


const getStaffId = (req) => req.user.staffId || 'unknown';

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
    if (existing.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Partitions already exist for this course. Use PUT to update.' });
    }
    // Save partitions
    await pool.query(
      'INSERT INTO CoursePartitions (courseCode, theoryCount, practicalCount, experientialCount, createdBy) VALUES (?, ?, ?, ?, ?)',
      [courseCode, theoryCount, practicalCount, experientialCount, staffId]
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
        [coId, 'THEORY', staffId]
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
        [coId, 'PRACTICAL', staffId]
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
        [coId, 'EXPERIENTIAL', staffId]
      );
      coIds.push(coId);
      coNumber++;
    }
    res.json({ status: 'success', message: 'Partitions and COs saved successfully', data: { coIds } });
  } catch (err) {
    console.error('Error in saveCoursePartitions:', err);
    res.status(500).json({ status: 'error', message: err.message });
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
      [theoryCount, practicalCount, experientialCount, staffId, courseCode]
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
        [coId, 'THEORY', staffId]
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
        [coId, 'PRACTICAL', staffId]
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
        [coId, 'EXPERIENTIAL', staffId]
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
        [staffId, co.coId]
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
      [toolId, maxMarks, staffId]
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
      if (tool.toolId && existingToolIds.includes(tool.toolId) ) {
        await pool.query(
          'UPDATE COTool SET toolName = ?, weightage = ? WHERE toolId = ?',
          [tool.toolName, tool.weightage, tool.toolId]
        );
        await pool.query(
          'UPDATE ToolDetails SET maxMarks = ?, updatedBy = ? WHERE toolId = ?',
          [tool.maxMarks, staffId, tool.toolId]
        );
      } else {
        const [result] = await pool.query(
          'INSERT INTO COTool (coId, toolName, weightage) VALUES (?, ?, ?)',
          [coId, tool.toolName, tool.weightage]
        );
        const toolId = result.insertId;
        await pool.query(
          'INSERT INTO ToolDetails (toolId, maxMarks, createdBy) VALUES (?, ?, ?)',
          [toolId, tool.maxMarks, staffId]
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
      [maxMarks, staffId, toolId]
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
      `SELECT s.rollnumber, s.name, sc.marksObtained 
       FROM StudentCOTool sc 
       JOIN Student s ON sc.rollnumber = s.rollnumber 
       JOIN StudentCourse studentc ON s.rollnumber = studentc.rollnumber
       JOIN StaffCourse stc ON studentc.sectionId = stc.sectionId AND studentc.courseCode = stc.courseCode
       JOIN COTool t ON sc.toolId = t.toolId
       JOIN CourseOutcome co ON t.coId = co.coId
       WHERE sc.toolId = ? AND stc.staffId = ? AND studentc.courseCode = co.courseCode`,
      [toolId, staffId]
    );
    res.json({ status: 'success', data: marks });
  } catch (err) {
    console.error('Error in getStudentMarksForTool:', err);
    res.status(500).json({ status: 'error', message: err.message });
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

    // Validate roll numbers against Student, StudentCourse, and StaffCourse (staff's section)
    const rollNumbers = marks.marks.map(m => m.rollnumber);
    const [validStudents] = await pool.query(
      `SELECT s.rollnumber 
       FROM Student s 
       JOIN StudentCourse sc ON s.rollnumber = sc.rollnumber 
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseCode = stc.courseCode
       WHERE s.rollnumber IN (?) AND sc.courseCode = ? AND stc.staffId = ?`,
      [rollNumbers, courseCode, staffId]
    );
    const validRollNumbers = new Set(validStudents.map(s => s.rollnumber));
    const invalidRollNumbers = rollNumbers.filter(r => !validRollNumbers.has(r));
    if (invalidRollNumbers.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid roll numbers for staff ${staffId}'s section in course ${courseCode}: ${invalidRollNumbers.join(', ')}`,
      });
    }
    if (validRollNumbers.size === 0) {
      return res.status(400).json({
        status: 'error',
        message: `No valid students found for staff ${staffId}'s section in course ${courseCode}`,
      });
    }

    // Process marks
    for (const mark of marks.marks) {
      const { rollnumber, marksObtained } = mark;
      // Validate marks
      if (typeof marksObtained !== 'number' || isNaN(marksObtained) || marksObtained < 0) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid marks for ${rollnumber}: marks must be a non-negative number`,
        });
      }
      if (marksObtained > maxMarks) {
        return res.status(400).json({
          status: 'error',
          message: `Marks for ${rollnumber} (${marksObtained}) exceed max (${maxMarks})`,
        });
      }

      // Check for existing entry
      const [existing] = await pool.query(
        'SELECT * FROM StudentCOTool WHERE rollnumber = ? AND toolId = ?',
        [rollnumber, toolId]
      );
      try {
        if (existing.length) {
          await pool.query(
            'UPDATE StudentCOTool SET marksObtained = ? WHERE rollnumber = ? AND toolId = ?',
            [marksObtained, rollnumber, toolId]
          );
        } else {
          await pool.query(
            'INSERT INTO StudentCOTool (rollnumber, toolId, marksObtained) VALUES (?, ?, ?)',
            [rollnumber, toolId, marksObtained]
          );
        }
      } catch (queryErr) {
        if (queryErr.code === 'ER_NO_REFERENCED_ROW_2') {
          return res.status(400).json({
            status: 'error',
            message: `Foreign key violation: rollnumber ${rollnumber} or toolId ${toolId} is invalid for staff ${staffId}'s section`,
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

    // Validate roll numbers
    const rollNumbers = results.map(row => row.regNo || row.rollnumber).filter(r => r);
    if (rollNumbers.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid roll numbers found in CSV' });
    }

    const [validStudents] = await pool.query(
      `SELECT s.rollnumber 
       FROM Student s 
       JOIN StudentCourse sc ON s.rollnumber = sc.rollnumber 
       JOIN StaffCourse stc ON sc.sectionId = stc.sectionId AND sc.courseCode = stc.courseCode
       WHERE s.rollnumber IN (?) AND sc.courseCode = ? AND stc.staffId = ?`,
      [rollNumbers, courseCode, staffId]
    );
    const validRollNumbers = new Set(validStudents.map(s => s.rollnumber));
    const invalidRollNumbers = rollNumbers.filter(r => !validRollNumbers.has(r));
    if (invalidRollNumbers.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid roll numbers for staff ${staffId}'s section in course ${courseCode}: ${invalidRollNumbers.join(', ')}`,
      });
    }

    // Process marks
    for (const row of results) {
      const rollnumber = row.regNo || row.rollnumber;
      const marksObtained = parseFloat(row.marks);
      if (!rollnumber || isNaN(marksObtained)) {
        console.warn('Skipping invalid row:', row);
        continue; // Skip invalid rows
      }
      if (marksObtained < 0) {
        return res.status(400).json({ status: 'error', message: `Negative marks for ${rollnumber}` });
      }
      if (marksObtained > maxMarks) {
        return res.status(400).json({
          status: 'error',
          message: `Marks for ${rollnumber} (${marksObtained}) exceed max (${maxMarks})`,
        });
      }

      const [existing] = await pool.query(
        'SELECT * FROM StudentCOTool WHERE rollnumber = ? AND toolId = ?',
        [rollnumber, toolId]
      );
      if (existing.length) {
        await pool.query(
          'UPDATE StudentCOTool SET marksObtained = ? WHERE rollnumber = ? AND toolId = ?',
          [marksObtained, rollnumber, toolId]
        );
      } else {
        await pool.query(
          'INSERT INTO StudentCOTool (rollnumber, toolId, marksObtained) VALUES (?, ?, ?)',
          [rollnumber, toolId, marksObtained]
        );
      }
      console.log(`Processed marks for ${rollnumber}: ${marksObtained}`);
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
      `SELECT DISTINCT s.rollnumber, s.name 
       FROM Student s
       JOIN StudentCourse sc ON s.rollnumber = sc.rollnumber
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
        const row = { regNo: student.rollnumber, name: student.name };
        let consolidated = 0;
        for (const tool of tools) {
          const [mark] = await pool.query(
            'SELECT marksObtained FROM StudentCOTool WHERE rollnumber = ? AND toolId = ?',
            [student.rollnumber, tool.toolId]
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
    const filePath = path.join(os.tmpdir() || __dirname, filename); // Use temp dir for safety

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
      `SELECT s.rollnumber, s.name FROM Student s
       JOIN StudentCourse sc ON s.rollnumber = sc.rollnumber
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
  if (!staffId || staffId === 'unknown') {
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
         sc.departmentId,
         d.departmentName,
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
       JOIN Department d ON sc.departmentId = d.departmentId
       JOIN Semester sem ON c.semesterId = sem.semesterId
       JOIN Batch b ON sem.batchId = b.batchId
       WHERE sc.staffId = ?
         AND c.isActive = 'YES'
         AND s.isActive = 'YES'
         AND d.isActive = 'YES'
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
  const staffId = req.user.staffId;
  try {
    const [rows] = await pool.execute(
      `SELECT s.rollnumber, s.name
       FROM Student s
       JOIN StudentCourse sc ON s.rollnumber = sc.rollnumber
       JOIN StaffCourse stc ON sc.courseCode = stc.courseCode AND sc.sectionId = stc.sectionId
       WHERE sc.courseCode = ? AND sc.sectionId = ? AND stc.staffId = ?`,
      [courseCode, sectionId, staffId]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
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
      `SELECT DISTINCT s.rollnumber, s.name 
       FROM Student s
       JOIN StudentCourse sc ON s.rollnumber = sc.rollnumber
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
        const row = { regNo: student.rollnumber, name: student.name };
        let theorySum = 0, theoryCount = 0, pracSum = 0, pracCount = 0, expSum = 0, expCount = 0;
        const coMarks = []; // Store CO marks and weights for finalAvg calculation
        for (const co of cos) {
          const [tools] = await pool.query(
            'SELECT t.*, td.maxMarks FROM COTool t JOIN ToolDetails td ON t.toolId = td.toolId WHERE t.coId = ?',
            [co.coId]
          );
          let coMark = 0;
          for (const tool of tools) {
            const [mark] = await pool.query(
              'SELECT marksObtained FROM StudentCOTool WHERE rollnumber = ? AND toolId = ?',
              [student.rollnumber, tool.toolId]
            );
            const marks = mark[0]?.marksObtained || 0;
            coMark += (marks / tool.maxMarks) * (tool.weightage / 100);
          }
          coMark *= 100;
          row[co.coNumber] = coMark.toFixed(2);
          coMarks.push({ mark: coMark, weight: co.weightage || 100, type: co.coType });
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
          // Sum weights of COs in active partitions
          const totalWeight = coMarks
            .filter(cm => activePartitions.some(p => p.type === cm.type))
            .reduce((sum, cm) => sum + (cm.weight / 100), 0);
          // Calculate weighted average
          final = coMarks
            .filter(cm => activePartitions.some(p => p.type === cm.type))
            .reduce((sum, cm) => sum + cm.mark * (cm.weight / 100) / totalWeight, 0);
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
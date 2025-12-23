// controllers/cbcsController.js
import { pool } from '../db.js';
import { stringify } from 'csv-stringify/sync'; 
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

export const getCoursesByBatchDeptSemester = async (req, res) => {
  try {
    const { Deptid, batchId, semesterId } = req.query;

    // Validate required params
    if (!Deptid || !batchId || !semesterId) {
      return res
        .status(400)
        .json({ error: "Deptid, batchId and semesterId are required" });
    }

    const conn = await pool.getConnection(); 
    try {
      // STEP 1: Fetch all active courses for the semester
      const [allCourses] = await conn.execute(
        `
        SELECT 
          c.courseId, c.courseCode, c.courseTitle, c.category, c.type,
          c.lectureHours, c.tutorialHours, c.practicalHours, 
          c.experientialHours, c.totalContactPeriods, 
          c.credits, c.minMark, c.maxMark
        FROM Course c
        WHERE c.semesterId = ? AND c.isActive = 'YES'
        `,
        [semesterId]
      );

      // STEP 2: Fetch elective bucket mapping for the semester
      const [ebcRows] = await conn.execute(
        `
        SELECT 
          ebc.courseId, eb.bucketId, eb.bucketNumber, eb.bucketName
        FROM ElectiveBucketCourse ebc
        JOIN ElectiveBucket eb ON ebc.bucketId = eb.bucketId
        WHERE eb.semesterId = ?
        `,
        [semesterId]
      );

      // STEP 3: Map courseId → bucket details
      const courseToBucket = new Map();
      ebcRows.forEach((row) => {
        courseToBucket.set(row.courseId, {
          bucketId: row.bucketId,
          bucketNumber: row.bucketNumber,
          bucketName: row.bucketName,
        });
      });

      // STEP 4: Fetch section & staff details
      const [sectionStaffRows] = await conn.execute(
        `
        SELECT 
          s.sectionId, s.sectionName, s.courseId, 
          u.Userid, u.userName, u.email, u.role
        FROM Section s
        LEFT JOIN StaffCourse sc ON s.sectionId = sc.sectionId
        LEFT JOIN users u ON sc.Userid = u.Userid
        WHERE s.isActive = 'YES'
        `
      );

      // STEP 5: Organize section → staff mapping
      const courseSectionsMap = {};
      sectionStaffRows.forEach((row) => {
        if (!courseSectionsMap[row.courseId]) courseSectionsMap[row.courseId] = [];

        let section = courseSectionsMap[row.courseId].find(
          (sec) => sec.sectionId === row.sectionId
        );

        if (!section) {
          section = {
            sectionId: row.sectionId,
            sectionName: row.sectionName,
            staff: [],
          };
          courseSectionsMap[row.courseId].push(section);
        }

        if (row.Userid) {
          section.staff.push({
            Userid: row.Userid,
            userName: row.userName,
            email: row.email,
            role: row.role,
          });
        }
      });

      // ✅ STEP 6: Get elective student counts
      const [electiveCounts] = await conn.execute(
        `
        SELECT selectedCourseId AS courseId, COUNT(*) AS studentCount
        FROM StudentElectiveSelection
        WHERE status IN ('pending','allocated')
        GROUP BY selectedCourseId
        `
      );

      const courseToStudentCount = new Map();
      electiveCounts.forEach((row) => {
        courseToStudentCount.set(row.courseId, row.studentCount);
      });

      // STEP 7: Group courses (Core / Elective) + attach sections & total_students
      const groupedCourses = {};

      allCourses.forEach((course) => {
        const bucket = courseToBucket.get(course.courseId);
        const key = bucket
          ? `Elective Bucket ${bucket.bucketNumber} - ${bucket.bucketName}`
          : "Core";

        if (!groupedCourses[key]) groupedCourses[key] = [];

        const total_students = bucket
          ? courseToStudentCount.get(course.courseId) || 0 // elective
          : 120; // core

        groupedCourses[key].push({
          ...course,
          total_students,
          sections: courseSectionsMap[course.courseId] || [],
        });
      });

      // STEP 8: Return structured data
      return res.json({ success: true, courses: groupedCourses });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("getCoursesByBatchDeptSemester error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message });
  }
};

export const createCbcs = async (req, res) => {
  try {
    const { Deptid, batchId, semesterId, createdBy, subjects, total_students,type } = req.body;

    if (!Deptid || !batchId || !semesterId || !subjects || subjects.length === 0) {
      return res.status(400).json({ error: 'Deptid, batchId, semesterId, and subjects are required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ✅ Step 1: Insert CBCS master record
      const [cbcsResult] = await conn.execute(
        `INSERT INTO CBCS (batchId, Deptid, semesterId, total_students,type,createdBy) VALUES (?, ?, ?, ?, ?,?)`,
        [batchId, Deptid, semesterId, total_students || 0, type ,createdBy]
      );
      const cbcsId = cbcsResult.insertId;

      // ✅ Step 2: Insert subjects and their sections + staff
      for (const subj of subjects) {
        const [subjRes] = await conn.execute(
          `INSERT INTO CBCS_Subject (cbcs_id, courseId, courseCode, courseTitle, category, type, credits, bucketName)
           SELECT ?, c.courseId, c.courseCode, c.courseTitle, c.category, c.type, c.credits, ?
           FROM Course c WHERE c.courseId = ?`,
          [cbcsId, subj.bucketName, subj.subject_id]
        );
        const cbcsSubjectId = subjRes.insertId;

        // Insert section-staff mapping
        for (const st of subj.staffs) {
          await conn.execute(
            `INSERT INTO CBCS_Section_Staff (cbcs_subject_id, sectionId, staffId)
             VALUES (?, ?, ?)`,
            [cbcsSubjectId, st.sectionId, st.staff_id]
          );
        }
      }

      // ✅ Step 3: Generate Excel file
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CBCS Management System';
      workbook.created = new Date();
      workbook.modified = new Date();

      const colors = {
        subjectHeader: 'FFFFFF00',
        columnHeader: 'FFFF7F66',
        staffHeader: 'FFDDEBF7',
        lightGray: 'FFF2F2F2',
        borderGray: 'FFD9D9D9',
        textDark: 'FF000000'
      };

      for (const subject of subjects) {
        const sheet = workbook.addWorksheet(`${subject.subject_id}`);

        // Subject header
        const subjectHeaderRow = sheet.addRow([`Subject: ${subject.subject_id} - ${subject.name}`]);
        const totalColumns = subject.staffs.length * 2;
        sheet.mergeCells(1, 1, 1, totalColumns);

        subjectHeaderRow.eachCell((cell) => {
          cell.font = { bold: true, size: 14, color: { argb: colors.textDark } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.subjectHeader } };
        });

        // Staff headers
        const staffHeaders = [];
        subject.staffs.forEach((st) => {
          staffHeaders.push(`staffId:${st.staff_id} | ${st.staff_name}`);
          staffHeaders.push('');
        });
        const staffHeaderRow = sheet.addRow(staffHeaders);

        let col = 1;
        subject.staffs.forEach(() => {
          sheet.mergeCells(2, col, 2, col + 1);
          col += 2;
        });

        staffHeaderRow.eachCell((cell) => {
          cell.font = { bold: true, size: 12, color: { argb: colors.textDark } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.staffHeader } };
        });

        // Column headers
        const columnHeaders = [];
        subject.staffs.forEach(() => columnHeaders.push('Regno', "Student's Name"));
        const columnHeaderRow = sheet.addRow(columnHeaders);

        columnHeaderRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: colors.textDark }, size: 11 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.columnHeader } };
        });

        // Add 10 empty rows
        for (let i = 0; i < 10; i++) {
          const emptyRow = [];
          subject.staffs.forEach(() => emptyRow.push('', ''));
          sheet.addRow(emptyRow);
        }

        subject.staffs.forEach((_, i) => {
          sheet.getColumn(i * 2 + 1).width = 15;
          sheet.getColumn(i * 2 + 2).width = 30;
        });

        sheet.views = [{ state: 'frozen', ySplit: 3 }];
      }

      const folderPath = path.join(process.cwd(), 'uploads', 'cbcs_excels');
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
      const excelName = `cbcs_allocation_${cbcsId}.xlsx`;
      const excelPath = path.join(folderPath, excelName);

      await workbook.xlsx.writeFile(excelPath);

      // ✅ Step 4: Update CBCS record with Excel path
      await conn.execute(`UPDATE CBCS SET allocation_excel_path = ? WHERE cbcs_id = ?`, [excelPath, cbcsId]);

      await conn.commit();

      return res.json({ success: true, message: 'CBCS created and Excel generated', cbcs_id: cbcsId, excelPath });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('createCbcs error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getAllCbcs = async (req, res) => {
  try {
    const conn = await pool.getConnection();

    try {
      const [rows] = await conn.execute(`
        SELECT 
          c.cbcs_id,
          c.batchId,
          b.batch,
          c.Deptid,
          d.DeptName,
          c.semesterId,
          s.semesterNumber,
          c.total_students,
          c.complete,
          c.isActive,
          c.allocation_excel_path,
          c.createdBy,
          u.userName AS createdByName,
          c.createdDate,
          c.updatedBy,
          c.updatedDate
        FROM CBCS c
        LEFT JOIN department d ON c.Deptid = d.Deptid
        LEFT JOIN batch b ON c.batchId = b.batchId
        LEFT JOIN semester s ON c.semesterId = s.semesterId
        LEFT JOIN users u ON c.createdBy = u.Userid
        ORDER BY c.cbcs_id DESC
      `);

      return res.json({
        success: true,
        total: rows.length,
        data: rows
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("getAllCbcs error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get particular CBCS by ID
export const getCbcsById = async (req, res) => {
  try {
    const { id } = req.params; // cbcs_id from URL
    const conn = await pool.getConnection();

    // Query CBCS details
    const [cbcsRows] = await conn.query(
      `SELECT c.*, 
              d.DeptName, 
              b.batch, 
              c.semesterId,
              s.semesterNumber
       FROM CBCS c
       JOIN department d ON c.Deptid = d.Deptid
       JOIN batch b ON c.batchId = b.batchId
       JOIN semester s ON s.semesterId = c.semesterId
       WHERE c.cbcs_id = ?`,
      [id]
    );
    if (cbcsRows.length === 0) {
      return res.status(404).json({ message: "CBCS not found" });
    }
    const cbcs = cbcsRows[0];

    // Query subjects under this CBCS
    const [subjectRows] = await conn.query(
      `SELECT cs.*, 
              c.courseTitle, 
              c.courseCode 
       FROM CBCS_Subject cs
       LEFT JOIN course c ON cs.courseId = c.courseId
       WHERE cs.cbcs_id = ?`,
      [id]
    );

    // Query section-staff mapping
    // const [sectionStaffRows] = await conn.query(
    //   `SELECT css.*, 
    //           sec.sectionName, 
    //           u.username AS staffName 
    //    FROM CBCS_Section_Staff css
    //    LEFT JOIN Section sec ON css.sectionId = sec.sectionId
    //    LEFT JOIN users u ON css.staffId = u.Userid
    //    WHERE css.cbcs_subject_id IN (
    //       SELECT cbcs_subject_id FROM CBCS_Subject WHERE cbcs_id = ?
    //    )`,
    //   [id]
    // );

    cbcs.subjects = subjectRows;
    //cbcs.sectionStaff = sectionStaffRows;

    res.json({ success: true,cbcs });

    conn.release();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving CBCS", error });
  }
};

//fetch courses
export const getStudentCbcsSelection = async (req, res) => {
  try {
    const { regno, batchId, deptId, semesterId } = req.query;

    if (!regno || !batchId || !deptId || !semesterId) {
      return res.status(400).json({ error: "Missing required params" });
    }

    const conn = await pool.getConnection();
    try {
      /* 1️⃣ Get active CBCS */
      const [cbcsRows] = await conn.execute(
        `SELECT c.*, d.DeptName, b.batch, s.semesterNumber
         FROM CBCS c
         JOIN department d ON d.Deptid = c.Deptid
         JOIN batch b ON b.batchId = c.batchId
         JOIN semester s ON s.semesterId = c.semesterId
         WHERE c.batchId=? AND c.Deptid=? AND c.semesterId=?
           AND c.isActive='YES'`,
        [batchId, deptId, semesterId]
      );

      if (cbcsRows.length === 0) {
        return res.status(404).json({ error: "CBCS not found" });
      }

      const cbcs = cbcsRows[0];
      const cbcsId = cbcs.cbcs_id;

      /* 2️⃣ Get student-allowed courses */
      const [subjects] = await conn.execute(
  `SELECT cs.cbcs_subject_id, cs.cbcs_id,
          cs.courseId, cs.courseCode, cs.courseTitle,
          cs.category, cs.type, cs.credits,
          cs.bucketName
   FROM cbcs_subject cs
   LEFT JOIN StudentElectiveSelection ses
     ON ses.selectedCourseId = cs.courseId
     AND ses.regno = ?
   WHERE cs.cbcs_id = ?
     AND (
       cs.bucketName = 'Core'
       OR ses.selectionId IS NOT NULL
     )`,
  [regno, cbcsId]
);

      /* 3️⃣ Get staff + section for these courses */
      const [staffRows] = await conn.execute(
        `SELECT 
            sc.courseId,
            sc.sectionId,
            sec.sectionName,
            u.Userid AS staffId,
            u.userName AS staffName
         FROM StaffCourse sc
         JOIN Section sec ON sec.sectionId = sc.sectionId
         JOIN users u ON u.Userid = sc.Userid
         WHERE sc.courseId IN (
           SELECT cs.courseId FROM CBCS_Subject cs WHERE cs.cbcs_id = ?
         )`,
        [cbcsId]
      );

      /* 4️⃣ Map staffs to courses */
      const courseStaffMap = {};

      staffRows.forEach(row => {
        if (!courseStaffMap[row.courseId]) {
          courseStaffMap[row.courseId] = [];
        }

        courseStaffMap[row.courseId].push({
          sectionId: row.sectionId,
          sectionName: row.sectionName,
          staffId: row.staffId,
          staffName: row.staffName
        });
      });

      /* 5️⃣ Attach staff list to each subject */
      const finalSubjects = subjects.map(sub => ({
        ...sub,
        staffs: courseStaffMap[sub.courseId] || []
      }));

      /* 6️⃣ Final response */
      return res.json({
        cbcs: {
          ...cbcs,
          subjects: finalSubjects
        }
      });

    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("getStudentCbcsSelection error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const submitStudentCourseSelection = async (req, res) => {
  try {
    const { regno, cbcs_id, selections, createdBy } = req.body;

    if (!regno || !cbcs_id || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      /* 1️⃣ Get CBCS type + excel path */
      const [cbcsRows] = await conn.execute(
        `SELECT type, allocation_excel_path FROM cbcs WHERE cbcs_id = ?`,
        [cbcs_id]
      );

      if (!cbcsRows.length) {
        return res.status(404).json({ error: "CBCS not found" });
      }

      const { type, allocation_excel_path } = cbcsRows[0];


      /* ❌ Not FCFS → just log */
      if (type !== 'FCFS') {
        for (let i = 0; i < selections.length; i++) {
          const sel = selections[i];
          await conn.execute(
            `INSERT INTO studentcourse_choices
            (regno, courseId, staffId, sectionId, preference_order, cbcs_id, createdBy)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [regno, sel.courseId, sel.staffId, sel.sectionId, i + 1, cbcs_id, createdBy]
          );
        }
         await conn.commit();
         return res.json({
          success: true,
          message: "Choices stored successfully (OPT)"
        });
      }
      /* 2️⃣ Get student name */
      const [[student]] = await conn.execute(
        `SELECT u.username
        FROM student_details sd
        JOIN users u ON u.Userid = sd.Userid
        WHERE sd.regno = ?`,
        [regno]
      );
      const studentName = student?.username || '';

      /* 3️⃣ Insert into DB (prevent duplicates) */
      for (const sel of selections) {
        const [exists] = await conn.execute(
          `SELECT 1 FROM studentcourse
           WHERE regno=? AND courseId=?`,
          [regno,sel.courseId]
        );

        if (exists.length) {
          throw new Error(`Duplicate selection for course ${sel.courseId}`);
        }

        await conn.execute(
  `INSERT INTO studentcourse
   (regno, courseId, sectionId, createdBy)
   VALUES (?, ?, ?, ?)`,
  [regno, sel.courseId, sel.sectionId, createdBy]
);
      }

      /* 4️⃣ Write to Excel */
      if (allocation_excel_path && fs.existsSync(allocation_excel_path)) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(allocation_excel_path);

        for (const sel of selections) {
          const sheet = workbook.getWorksheet(String(sel.courseId));
          if (!sheet) continue;

          let staffCol = -1;

          sheet.getRow(2).eachCell((cell, col) => {
            if (
              cell.value &&
              cell.value.toString().startsWith(`staffId:${sel.staffId}`)
            ) {
              staffCol = col;
            }
          });

          if (staffCol === -1) continue;

          let row = 4;
          while (sheet.getCell(row, staffCol).value) row++;

          sheet.getCell(row, staffCol + 1).value = regno;
          sheet.getCell(row, staffCol + 2).value = studentName;
        }

        await workbook.xlsx.writeFile(allocation_excel_path);
      }

      await conn.commit();

      return res.json({
        success: true,
        message: "FCFS selection stored and Excel updated"
      });

    } catch (err) {
      await conn.rollback();
      return res.status(400).json({ error: err.message });
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Download CBCS Excel
export const downloadCbcsExcel = async (req, res) => {
  try {
    const { cbcs_id } = req.params;

    if (!cbcs_id) {
      return res.status(400).json({ error: "cbcs_id is required" });
    }

    /* 1️⃣ Get excel path from DB */
    const [[cbcs]] = await pool.execute(
      `SELECT allocation_excel_path FROM CBCS WHERE cbcs_id = ?`,
      [cbcs_id]
    );

    if (!cbcs || !cbcs.allocation_excel_path) {
      return res.status(404).json({ error: "Excel not found" });
    }

    const excelPath = cbcs.allocation_excel_path;

    /* 2️⃣ Check file exists */
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ error: "Excel file missing on server" });
    }

    /* 3️⃣ Download */
    return res.download(
      excelPath,
      `cbcs_${cbcs_id}.xlsx`
    );

  } catch (err) {
    console.error("downloadCbcsExcel error:", err);
    res.status(500).json({ error: "Failed to download Excel" });
  }
};


export const runOptAllocation = async (req, res) => {
  const { cbcs_id, createdBy } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    /* 1️⃣ Get all students */
    const [students] = await conn.execute(
      `SELECT DISTINCT regno
       FROM studentcourse_choices
       WHERE cbcs_id = ?`,
      [cbcs_id]
    );

    for (const { regno } of students) {

      /* 2️⃣ Allocate top 3 preferences */
      const [prefs] = await conn.execute(
        `SELECT *
         FROM studentcourse_choices
         WHERE regno = ?
         ORDER BY preference_order
         LIMIT 3`,
        [regno]
      );

      const allocated = [];

      for (const p of prefs) {
        await conn.execute(
          `INSERT INTO studentcourse
           (regno, courseId, staffId, sectionId, createdBy)
           VALUES (?, ?, ?, ?, ?)`,
          [regno, p.courseId, p.staffId, p.sectionId, createdBy]
        );
        allocated.push(p.courseId);
      }

      /* 3️⃣ Allocate remaining subjects (any way) */
      const remaining = 6 - allocated.length;

      if (remaining > 0) {
        const [others] = await conn.execute(
          `SELECT courseId, staffId, sectionId
           FROM cbcs_subjects
           WHERE courseId NOT IN (?)
           LIMIT ?`,
          [allocated, remaining]
        );

        for (const o of others) {
          await conn.execute(
            `INSERT INTO studentcourse
             (regno, courseId, staffId, sectionId, createdBy)
             VALUES (?, ?, ?, ?, ?)`,
            [regno, o.courseId, o.staffId, o.sectionId, createdBy]
          );
        }
      }
    }

    await conn.commit();
    res.json({ success: true, message: "OPT allocation completed" });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

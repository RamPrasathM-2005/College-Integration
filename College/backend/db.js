import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: './config.env' });

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
});

const initDatabase = async () => {
    let connection;
    try {
        // Ensure database exists
        const admin = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });
        await admin.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
        await admin.end();

        // Get a connection from the pool and start a transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1) Department - Stores departments with unique codes (e.g., CSE, ECE)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Department (
                departmentId INT PRIMARY KEY AUTO_INCREMENT,
                departmentName VARCHAR(100) NOT NULL UNIQUE,
                departmentCode VARCHAR(10) NOT NULL UNIQUE,
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 2) Users - Stores admin and staff with department-specific staffId (e.g., CSE001 for Kalaiselvi)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Users (
                userId INT PRIMARY KEY AUTO_INCREMENT,
                staffId VARCHAR(10),
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                passwordHash VARCHAR(255) NOT NULL,
                role ENUM('ADMIN','STAFF') NOT NULL,
                departmentId INT,
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_user_dept FOREIGN KEY (departmentId) REFERENCES Department(departmentId)
                    ON UPDATE CASCADE ON DELETE SET NULL,
                CONSTRAINT uk_staffId_dept UNIQUE (staffId, departmentId),
                CONSTRAINT chk_staffId CHECK (staffId IS NULL OR staffId REGEXP '^[A-Z]{3}[0-9]{3}$')
            )
        `);

        // 3) Batch - Stores degree programs (e.g., B.E CSE 2023-2027)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Batch (
                batchId INT PRIMARY KEY AUTO_INCREMENT,
                degree VARCHAR(50) NOT NULL,
                branch VARCHAR(100) NOT NULL,
                batch VARCHAR(4) NOT NULL,
                batchYears VARCHAR(20) NOT NULL,
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_batch (degree, branch, batch)
            )
        `);

        // 4) Semester - Stores semesters for each batch
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Semester (
                semesterId INT PRIMARY KEY AUTO_INCREMENT,
                batchId INT NOT NULL,
                semesterNumber INT NOT NULL CHECK (semesterNumber BETWEEN 1 AND 8),
                startDate DATE NOT NULL,
                endDate DATE NOT NULL,
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_sem_batch FOREIGN KEY (batchId) REFERENCES Batch(batchId)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
                UNIQUE (batchId, semesterNumber)
            )
        `);

        // 5) Course - Stores course details for each semester (e.g., Java course)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Course (
                courseId INT PRIMARY KEY AUTO_INCREMENT,
                courseCode VARCHAR(20) NOT NULL UNIQUE,
                semesterId INT NOT NULL,
                courseTitle VARCHAR(255) NOT NULL,
                category ENUM('HSMC','BSC','ESC','PEC','OEC','EEC') NOT NULL,
                type ENUM('THEORY','INTEGRATED','PRACTICAL','EXPERIENTIAL LEARNING') NOT NULL,
                lectureHours INT DEFAULT 0,
                tutorialHours INT DEFAULT 0,
                practicalHours INT DEFAULT 0,
                experientialHours INT DEFAULT 0,
                totalContactPeriods INT NOT NULL,
                credits INT NOT NULL,
                minMark INT NOT NULL,
                maxMark INT NOT NULL,
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(100),
                updatedBy VARCHAR(100),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_course_sem FOREIGN KEY (semesterId) REFERENCES Semester(semesterId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 6) Section - Stores sections (e.g., A, B, C) for each course
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Section (
                sectionId INT PRIMARY KEY AUTO_INCREMENT,
                courseCode VARCHAR(20) NOT NULL,
                sectionName VARCHAR(10) NOT NULL,
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_section_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
                UNIQUE (courseCode, sectionName)
            )
        `);

        // 7) Student - Stores student details with batch (section assigned per course in StudentCourse)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Student (
                rollnumber VARCHAR(20) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                batchId INT NOT NULL,
                semesterNumber INT NOT NULL CHECK (semesterNumber BETWEEN 1 AND 8),
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_student_batch FOREIGN KEY (batchId) REFERENCES Batch(batchId)
                    ON UPDATE CASCADE ON DELETE RESTRICT
            )
        `);

        // 8) StudentCourse - Enrolls students in courses with section (e.g., Ram in Java, section A)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS StudentCourse (
                studentCourseId INT PRIMARY KEY AUTO_INCREMENT,
                rollnumber VARCHAR(20) NOT NULL,
                courseCode VARCHAR(20) NOT NULL,
                sectionId INT NOT NULL,
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE (rollnumber, courseCode, sectionId),
                CONSTRAINT fk_sc_student FOREIGN KEY (rollnumber) REFERENCES Student(rollnumber)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_sc_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_sc_section FOREIGN KEY (sectionId) REFERENCES Section(sectionId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 9) StaffCourse - Allocates staff to courses and sections (e.g., Kalaiselvi to Java, section A)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS StaffCourse (
                staffCourseId INT PRIMARY KEY AUTO_INCREMENT,
                staffId VARCHAR(10) NOT NULL,
                courseCode VARCHAR(20) NOT NULL,
                sectionId INT NOT NULL,
                departmentId INT NOT NULL,
                UNIQUE (staffId, courseCode, sectionId, departmentId),
                CONSTRAINT fk_stc_staff_dept FOREIGN KEY (staffId, departmentId) REFERENCES Users(staffId, departmentId)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_stc_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_stc_section FOREIGN KEY (sectionId) REFERENCES Section(sectionId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 10) CourseOutcome - Stores course outcomes with weightage
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS CourseOutcome (
                coId INT PRIMARY KEY AUTO_INCREMENT,
                courseCode VARCHAR(20) NOT NULL,
                coNumber VARCHAR(10) NOT NULL,
                UNIQUE (courseCode, coNumber),
                CONSTRAINT fk_co_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 11) COTool - Stores evaluation tools for course outcomes
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS COTool (
                toolId INT PRIMARY KEY AUTO_INCREMENT,
                coId INT NOT NULL,
                toolName VARCHAR(100) NOT NULL,
                weightage INT NOT NULL CHECK (weightage BETWEEN 0 AND 100),
                UNIQUE (coId, toolName),
                CONSTRAINT fk_tool_co FOREIGN KEY (coId) REFERENCES CourseOutcome(coId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 12) StudentCOTool - Stores student marks for each tool
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS StudentCOTool (
                studentToolId INT PRIMARY KEY AUTO_INCREMENT,
                rollnumber VARCHAR(20) NOT NULL,
                toolId INT NOT NULL,
                marksObtained INT NOT NULL CHECK (marksObtained >= 0),
                UNIQUE (rollnumber, toolId),
                CONSTRAINT fk_sct_student FOREIGN KEY (rollnumber) REFERENCES Student(rollnumber)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_sct_tool FOREIGN KEY (toolId) REFERENCES COTool(toolId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 13) Timetable - Stores timetable with 6 days, 8 periods (including breaks; breaks managed in app logic)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Timetable (
                timetableId INT PRIMARY KEY AUTO_INCREMENT,
                courseCode VARCHAR(20) NOT NULL, -- No foreign key to allow manual entries
                sectionId INT NULL, -- Nullable to make sections optional
                dayOfWeek ENUM('MON','TUE','WED','THU','FRI','SAT') NOT NULL,
                periodNumber INT NOT NULL CHECK (periodNumber BETWEEN 1 AND 8),
                departmentId INT NOT NULL,
                semesterId INT NOT NULL,
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_tt_dept FOREIGN KEY (departmentId) REFERENCES Department(departmentId)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
                CONSTRAINT fk_tt_sem FOREIGN KEY (semesterId) REFERENCES Semester(semesterId)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_tt_section FOREIGN KEY (sectionId) REFERENCES Section(sectionId)
                    ON UPDATE CASCADE ON DELETE SET NULL,
                UNIQUE (semesterId, dayOfWeek, periodNumber) -- Prevent duplicate time slots
            );
        `);

        

        // 14) DayAttendance - Stores daily attendance for students
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS DayAttendance (
                dayAttendanceId INT PRIMARY KEY AUTO_INCREMENT,
                rollnumber VARCHAR(20) NOT NULL,
                semesterNumber INT NOT NULL CHECK (semesterNumber BETWEEN 1 AND 8),
                attendanceDate DATE NOT NULL,
                status ENUM('P','A') NOT NULL,
                UNIQUE (rollnumber, attendanceDate),
                CONSTRAINT fk_da_student FOREIGN KEY (rollnumber) REFERENCES Student(rollnumber)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 15) PeriodAttendance - Stores period-wise attendance (linked to timetable and section)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS PeriodAttendance (
                periodAttendanceId INT PRIMARY KEY AUTO_INCREMENT,
                rollnumber VARCHAR(20) NOT NULL,
                staffId VARCHAR(10) NOT NULL,
                courseCode VARCHAR(20) NOT NULL,
                sectionId INT NOT NULL,
                semesterNumber INT NOT NULL CHECK (semesterNumber BETWEEN 1 AND 8),
                dayOfWeek ENUM('MON','TUE','WED','THU','FRI','SAT') NOT NULL,
                periodNumber INT NOT NULL CHECK (periodNumber BETWEEN 1 AND 8),
                attendanceDate DATE NOT NULL,
                status ENUM('P','A') NOT NULL,
                departmentId INT NOT NULL,
                UNIQUE (rollnumber, courseCode, sectionId, attendanceDate, periodNumber),
                CONSTRAINT fk_pa_student FOREIGN KEY (rollnumber) REFERENCES Student(rollnumber)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_pa_staff_dept FOREIGN KEY (staffId, departmentId) REFERENCES Users(staffId, departmentId)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_pa_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_pa_section FOREIGN KEY (sectionId) REFERENCES Section(sectionId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // NEW: 16) CoursePartitions - Stores CO counts per partition for each course
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS CoursePartitions (
                partitionId INT PRIMARY KEY AUTO_INCREMENT,
                courseCode VARCHAR(20) NOT NULL UNIQUE,
                theoryCount INT DEFAULT 0,
                practicalCount INT DEFAULT 0,
                experientialCount INT DEFAULT 0,
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_partition_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // NEW: 17) COType - Associates type to each CO (extends CourseOutcome without altering it)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS COType (
                coTypeId INT PRIMARY KEY AUTO_INCREMENT,
                coId INT NOT NULL UNIQUE,
                coType ENUM('THEORY', 'PRACTICAL', 'EXPERIENTIAL') NOT NULL,
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_cotype_co FOREIGN KEY (coId) REFERENCES CourseOutcome(coId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // NEW: 18) ToolDetails - Adds maxMarks to each tool (extends COTool without altering it)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS ToolDetails (
                toolDetailId INT PRIMARY KEY AUTO_INCREMENT,
                toolId INT NOT NULL UNIQUE,
                maxMarks INT NOT NULL CHECK (maxMarks > 0),
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_tooldetail_tool FOREIGN KEY (toolId) REFERENCES COTool(toolId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // Initial data for Department (unchanged)
        await connection.execute(`
            INSERT IGNORE INTO Department (departmentId, departmentName, departmentCode, createdBy, updatedBy)
            VALUES
            (1, 'Computer Science Engineering', 'CSE', 'admin', 'admin'),
            (2, 'Electronics and Communication Engineering', 'ECE', 'admin', 'admin'),
            (3, 'Mechanical Engineering', 'MECH', 'admin', 'admin'),
            (4, 'Information Technology', 'IT', 'admin', 'admin'),
            (5, 'Electrical and Electronics Engineering', 'EEE', 'admin', 'admin'),
            (6, 'Artificial Intelligence and Data Science', 'AIDS', 'admin', 'admin')
        `);

        // Commit the transaction
        await connection.commit();
        console.log("✅ Database initialized with updated academic schema");

    } catch (err) {
        // Rollback on error
        if (connection) {
            await connection.rollback();
            console.error("❌ DB Initialization Error - Transaction rolled back:", err);
        } else {
            console.error("❌ DB Initialization Error:", err);
        }
    } finally {
        // Release the connection
        if (connection) {
            connection.release();
        }
    }
};

initDatabase();
export default pool;
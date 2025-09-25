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
    dateStrings: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci', 
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

        // 1) Department - Stores departments with unique codes
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS department (
                Deptid INT PRIMARY KEY,
                Deptname VARCHAR(100) NOT NULL,
                Deptacronym VARCHAR(10) NOT NULL
            )
        `);

        // 2) Users - Stores admin, staff, and students
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                Userid INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('Student', 'Staff', 'Admin') NOT NULL,
                status ENUM('active', 'inactive') DEFAULT 'active',
                staffId INT UNIQUE,
                Deptid INT NOT NULL,
                image VARCHAR(500) DEFAULT '/Uploads/default.jpg',
                resetPasswordToken VARCHAR(255),
                resetPasswordExpires DATETIME,
                skillrackProfile VARCHAR(255),
                Created_by INT,
                Updated_by INT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_user_department FOREIGN KEY (Deptid) REFERENCES department(Deptid) ON DELETE RESTRICT,
                CONSTRAINT fk_user_createdby FOREIGN KEY (Created_by) REFERENCES users(Userid) ON DELETE SET NULL,
                CONSTRAINT fk_user_updatedby FOREIGN KEY (Updated_by) REFERENCES users(Userid) ON DELETE SET NULL
            )
        `);

        // 3) Student Details - Stores detailed student information
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS student_details (
                id INT PRIMARY KEY AUTO_INCREMENT,
                Userid INT NOT NULL,
                regno VARCHAR(50) UNIQUE NOT NULL,
                Deptid INT NOT NULL,
                batch INT,
                Semester VARCHAR(255),
                staffId INT,
                Created_by INT,
                Updated_by INT,
                date_of_joining DATE,
                date_of_birth DATE,
                blood_group ENUM('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'),
                tutorEmail VARCHAR(255),
                personal_email VARCHAR(255),
                first_graduate ENUM('Yes', 'No'),
                aadhar_card_no VARCHAR(12) UNIQUE,
                student_type ENUM('Day-Scholar', 'Hosteller'),
                mother_tongue VARCHAR(255),
                identification_mark VARCHAR(255),
                extracurricularID INT,
                religion ENUM('Hindu', 'Muslim', 'Christian', 'Others'),
                caste VARCHAR(255),
                community ENUM('General', 'OBC', 'SC', 'ST', 'Others'),
                gender ENUM('Male', 'Female', 'Transgender'),
                seat_type ENUM('Counselling', 'Management'),
                section VARCHAR(255),
                door_no VARCHAR(255),
                street VARCHAR(255),
                cityID INT,
                districtID INT,
                stateID INT,
                countryID INT,
                pincode VARCHAR(6),
                personal_phone VARCHAR(10),
                pending BOOLEAN DEFAULT TRUE,
                tutor_approval_status BOOLEAN DEFAULT FALSE,
                Approved_by INT,
                approved_at DATETIME,
                messages JSON,
                skillrackProfile VARCHAR(255),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_student_details_user FOREIGN KEY (Userid) REFERENCES users(Userid)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_student_details_dept FOREIGN KEY (Deptid) REFERENCES department(Deptid)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
                CONSTRAINT fk_student_details_tutor FOREIGN KEY (staffId) REFERENCES users(Userid)
                    ON UPDATE CASCADE ON DELETE SET NULL,
                CONSTRAINT fk_student_details_created FOREIGN KEY (Created_by) REFERENCES users(Userid)
                    ON UPDATE CASCADE ON DELETE SET NULL,
                CONSTRAINT fk_student_details_updated FOREIGN KEY (Updated_by) REFERENCES users(Userid)
                    ON UPDATE CASCADE ON DELETE SET NULL,
                CONSTRAINT fk_student_details_approved FOREIGN KEY (Approved_by) REFERENCES users(Userid)
                    ON UPDATE CASCADE ON DELETE SET NULL
            )
        `);

        // 4) Batch - Stores degree programs
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

        // 5) Semester - Stores semesters for each batch
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

        // 6) Course - Stores course details for each semester
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Course (
                courseId INT PRIMARY KEY AUTO_INCREMENT,
                courseCode VARCHAR(20) NOT NULL UNIQUE,
                semesterId INT NOT NULL,
                courseTitle VARCHAR(255) NOT NULL,
                category ENUM('HSMC','BSC','ESC','PEC','OEC','EEC','PCC') NOT NULL,
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

        // 7) Section - Stores sections for each course
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

        // 8) StudentCourse - Enrolls students in courses with sections
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS StudentCourse (
                studentCourseId INT PRIMARY KEY AUTO_INCREMENT,
                regno VARCHAR(50) NOT NULL,
                courseCode VARCHAR(20) NOT NULL,
                sectionId INT NOT NULL,
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE (regno, courseCode, sectionId),
                CONSTRAINT fk_sc_student FOREIGN KEY (regno) REFERENCES student_details(regno)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_sc_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_sc_section FOREIGN KEY (sectionId) REFERENCES Section(sectionId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 9) StaffCourse - Assigns staff to courses and sections
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS StaffCourse (
                staffCourseId INT PRIMARY KEY AUTO_INCREMENT,
                staffId INT NOT NULL,
                courseCode VARCHAR(20) NOT NULL,
                sectionId INT NOT NULL,
                Deptid INT NOT NULL,
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE (staffId, courseCode, sectionId, Deptid),
                CONSTRAINT fk_stc_staff FOREIGN KEY (staffId) REFERENCES users(staffId)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_stc_dept FOREIGN KEY (Deptid) REFERENCES department(Deptid)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_stc_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_stc_section FOREIGN KEY (sectionId) REFERENCES Section(sectionId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 10) CourseOutcome - Stores course outcomes
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

        // 12) StudentCOTool - Stores student marks for each evaluation tool
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS StudentCOTool (
                studentToolId INT PRIMARY KEY AUTO_INCREMENT,
                regno VARCHAR(50) NOT NULL,
                toolId INT NOT NULL,
                marksObtained INT NOT NULL CHECK (marksObtained >= 0),
                UNIQUE (regno, toolId),
                CONSTRAINT fk_sct_student FOREIGN KEY (regno) REFERENCES student_details(regno)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_sct_tool FOREIGN KEY (toolId) REFERENCES COTool(toolId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 13) Timetable - Stores class schedules
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Timetable (
                timetableId INT PRIMARY KEY AUTO_INCREMENT,
                courseCode VARCHAR(20) NOT NULL,
                sectionId INT NULL,
                dayOfWeek ENUM('MON','TUE','WED','THU','FRI','SAT') NOT NULL,
                periodNumber INT NOT NULL CHECK (periodNumber BETWEEN 1 AND 8),
                Deptid INT NOT NULL,
                semesterId INT NOT NULL,
                isActive ENUM('YES','NO') DEFAULT 'YES',
                createdBy VARCHAR(150),
                updatedBy VARCHAR(150),
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_tt_dept FOREIGN KEY (Deptid) REFERENCES department(Deptid)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
                CONSTRAINT fk_tt_sem FOREIGN KEY (semesterId) REFERENCES Semester(semesterId)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_tt_section FOREIGN KEY (sectionId) REFERENCES Section(sectionId)
                    ON UPDATE CASCADE ON DELETE SET NULL,
                UNIQUE (semesterId, dayOfWeek, periodNumber)
            )
        `);

        // 14) DayAttendance - Stores daily attendance for students
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS DayAttendance (
                dayAttendanceId INT PRIMARY KEY AUTO_INCREMENT,
                regno VARCHAR(50) NOT NULL,
                semesterNumber INT NOT NULL CHECK (semesterNumber BETWEEN 1 AND 8),
                attendanceDate DATE NOT NULL,
                status ENUM('P','A') NOT NULL,
                UNIQUE (regno, attendanceDate),
                CONSTRAINT fk_da_student FOREIGN KEY (regno) REFERENCES student_details(regno)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 15) PeriodAttendance - Stores period-wise attendance
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS PeriodAttendance (
                periodAttendanceId INT PRIMARY KEY AUTO_INCREMENT,
                regno VARCHAR(50) NOT NULL,
                staffId INT NOT NULL,
                courseCode VARCHAR(20) NOT NULL,
                sectionId INT NOT NULL,
                semesterNumber INT NOT NULL CHECK (semesterNumber BETWEEN 1 AND 8),
                dayOfWeek ENUM('MON','TUE','WED','THU','FRI','SAT') NOT NULL,
                periodNumber INT NOT NULL CHECK (periodNumber BETWEEN 1 AND 8),
                attendanceDate DATE NOT NULL,
                status ENUM('P','A') NOT NULL,
                Deptid INT NOT NULL,
                UNIQUE (regno, courseCode, sectionId, attendanceDate, periodNumber),
                CONSTRAINT fk_pa_student FOREIGN KEY (regno) REFERENCES student_details(regno)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_pa_staff FOREIGN KEY (staffId) REFERENCES users(staffId)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_pa_dept FOREIGN KEY (Deptid) REFERENCES department(Deptid)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_pa_course FOREIGN KEY (courseCode) REFERENCES Course(courseCode)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_pa_section FOREIGN KEY (sectionId) REFERENCES Section(sectionId)
                    ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        // 16) CoursePartitions - Stores CO counts per partition for each course
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

        // 17) COType - Associates type to each CO
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

        // 18) ToolDetails - Adds maxMarks to each evaluation tool
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

        // Insert initial department data
        await connection.execute(`
            INSERT IGNORE INTO department (Deptid, Deptname, Deptacronym)
            VALUES
            (1, 'Computer Science Engineering', 'CSE'),
            (2, 'Electronics and Communication Engineering', 'ECE'),
            (3, 'Mechanical Engineering', 'MECH'),
            (4, 'Information Technology', 'IT'),
            (5, 'Electrical and Electronics Engineering', 'EEE'),
            (6, 'Artificial Intelligence and Data Science', 'AIDS')
        `);

        // Commit the transaction
        await connection.commit();
        console.log("✅ Database initialized with new academic schema");

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
import express from "express";
import {
  addSemester,
  deleteSemester,
  getAllSemesters,
  getSemester,
  updateSemester,
  getSemestersByBatchBranch,
} from "../../controllers/semesterController.js";
import {
  addCourse,
  getAllCourse,
  getCourseBySemester,
  updateCourse,
  deleteCourse,
  importCourses
} from "../../controllers/subjectController.js";
import {
  allocateStaffToCourse,
  allocateCourseToStaff,
  updateStaffAllocation,
  getStaffAllocationsByCourse,
  getCourseAllocationsByStaff,
  deleteStaffAllocation,
  getUsers,
  getCourseAllocationsByStaffEnhanced,
  updateStaffCourseBatch,
} from "../../controllers/staffCourseController.js";
import {
  searchStudents,
  getAvailableCourses,
  enrollStudentInCourse,
  updateStudentBatch,
  getAvailableCoursesForBatch,
  unenrollStudentFromCourse,
} from "../../controllers/studentAllocationController.js";
import {
  getSectionsForCourse,
  addSectionsToCourse,
  updateSectionsForCourse,
  deleteSection,
  getSections,
} from "../../controllers/sectionController.js";
import {
  addStudent,
  getAllStudents,
  getStudentByRollNumber,
  updateStudent,
  deleteStudent,
  getStudentEnrolledCourses,
  getBranches,
  getSemesters,
  getBatches,
  getStudentsByCourseAndSection,
} from "../../controllers/studentController.js";
import {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchByDetails,
} from "../../controllers/batchController.js";
import {
  getAllTimetableBatches,
  getAllTimetableDepartments,
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getTimetableByFilters,
} from '../../controllers/timetableController.js';
import { 
  getConsolidatedMarks 
} from "../../controllers/markController.js";
import {
  getDepartments
}from "../../controllers/departmentController.js";
import { protect } from "../../controllers/auth/authController.js";

const router = express.Router();

// Base API: http://localhost:4000/api/admin

/* =========================
   📌 Semester Routes
   ========================= */
router.route("/semesters").post(addSemester).get(getAllSemesters);
router.get("/semesters/search", getSemester);
router.get("/semesters/by-batch-branch", getSemestersByBatchBranch);
router.route("/semesters/:semesterId").put(updateSemester).delete(deleteSemester);

/* =========================
   📌 Course Routes
   ========================= */
router.route("/semesters/:semesterId/courses")
  .post(protect, addCourse)
  .get(protect, getCourseBySemester);

router.route("/courses")
  .get(protect, getAllCourse)
  .post(protect, importCourses); // Add new import endpoint

router.route("/courses/:courseId")
  .put(protect, updateCourse)
  .delete(protect, deleteCourse);

/* =========================
   📌 Staff-Course Allocation Routes
   ========================= */
router.get("/users", protect, getUsers);
router.post("/courses/:courseId/staff",protect, allocateStaffToCourse);
router.post("/staff/:staffId/courses", protect, allocateCourseToStaff);
router.put("/staff-courses/:staffCourseId", updateStaffAllocation);
router.patch("/staff-courses/:staffCourseId", protect, updateStaffCourseBatch);
router.get("/courses/:courseId/staff",protect,  getStaffAllocationsByCourse);
router.get("/staff/:Userid/courses", getCourseAllocationsByStaff);
router.delete("/staff-courses/:staffCourseId", protect,  deleteStaffAllocation);
router.get("/staff/:Userid/courses-enhanced", getCourseAllocationsByStaffEnhanced);

/* =========================
   📌 Student Allocation Routes
   ========================= */
router.get("/students/search", protect, searchStudents);
router.get("/courses/available/:semesterNumber", getAvailableCourses);
router.post("/students/enroll", protect, enrollStudentInCourse);
router.put("/students/:rollNumber/batch", updateStudentBatch);
router.get("/courses/available/:batchId/:semesterNumber", protect, getAvailableCoursesForBatch);
router.delete("/students/unenroll", protect,unenrollStudentFromCourse);


/* =========================
   📌 Section Routes
   ========================= */
router.get("/sections", getSections);
router.get("/courses/:courseCode/sections", getSectionsForCourse);
router.post("/courses/:courseCode/sections", protect,addSectionsToCourse);
router.put("/courses/:courseCode/sections", updateSectionsForCourse);
router.delete("/courses/:courseCode/sections/:sectionName", protect, deleteSection);

/* =========================
   📌 Student Routes
   ========================= */
router.route("/students").post(addStudent).get(getAllStudents);
router.get("/students/branches", getBranches);
router.get("/students/semesters", getSemesters);
router.get("/students/batches", getBatches);
router.get("/students/enrolled-courses", getStudentsByCourseAndSection);
router.route("/students/:rollNumber").get(getStudentByRollNumber).put(updateStudent).delete(deleteStudent);
router.get("/students/:rollNumber/enrolled-courses", getStudentEnrolledCourses);

/* =========================
   📌 Batch Routes
   ========================= */
router.get("/batches/find", getBatchByDetails);
router.route("/batches").get(getAllBatches).post(createBatch);
router.route("/batches/:batchId").get(getBatchById).put(updateBatch).delete(deleteBatch);

/* =========================
   📌 Timetable Routes
   ========================= */
router.get('/timetable/batches', protect,getAllTimetableBatches);
router.get('/timetable/departments',protect, getAllTimetableDepartments);
router.get('/timetable/by-filters', protect, getTimetableByFilters);
router.get('/timetable/semester/:semesterId',protect, getTimetable);
router.post('/timetable/entry',protect, createTimetableEntry);
router.put('/timetable/entry/:timetableId',protect, updateTimetableEntry);
router.delete('/timetable/entry/:timetableId',protect, deleteTimetableEntry);

router.get('/consolidated-marks', protect, getConsolidatedMarks);

/* =========================
   📌 Department Routes
   ========================= */
router.get('/departments', protect, getDepartments);

export default router;
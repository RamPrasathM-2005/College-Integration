import express from "express";
import {
  getTimetable,
  getStudentsForPeriod,
  markAttendance,
  getSkippedStudents,
} from "../../controllers/attendanceController.js";
import { protect } from "../../controllers/auth/authController.js";

const router = express.Router();

// Protect all routes - require authentication
router.use(protect);

router.get("/timetable", getTimetable);
router.get(
  "/students/:courseCode/:sectionId/:dayOfWeek/:periodNumber",
  getStudentsForPeriod
);
router.get(
  "/skipped/:courseCode/:sectionId/:dayOfWeek/:periodNumber",
  getSkippedStudents
);
router.post(
  "/mark/:courseCode/:sectionId/:dayOfWeek/:periodNumber",
  markAttendance
);

export default router;

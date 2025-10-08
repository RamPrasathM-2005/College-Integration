// adminAttendanceRoutes.js
import express from "express";
import {
  getTimetableAdmin,
  getStudentsForPeriodAdmin,
  markAttendanceAdmin,
} from "../../controllers/adminattendancecontroller.js"; // Assume new controller file
import { protect } from "../../controllers/auth/authController.js";

const router = express.Router();

// Protect all routes - require authentication
router.use(protect);

// Admin-specific routes
router.get("/timetable", getTimetableAdmin);
router.get(
  "/students/:courseCode/:sectionId/:dayOfWeek/:periodNumber",
  getStudentsForPeriodAdmin
);
router.post(
  "/mark/:courseCode/:sectionId/:dayOfWeek/:periodNumber",
  markAttendanceAdmin
);

export default router;

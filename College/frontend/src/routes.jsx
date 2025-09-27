import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, getUserRole } from "./utils/auth";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import StaffLayout from "./layouts/StaffLayout";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import ManageSemesters from "./pages/admin/ManageSemesters/ManageSemsters";
import ManageCourses from "./pages/admin/ManageCourses/ManageCourses";
import ManageStaff from "./pages/admin/ManageStaffs/ManageStaff";
import ManageStudents from "./pages/admin/ManageStudents/ManageStudents";
import Timetable from "./pages/admin/Timetable";
import ManageRegulations from "./pages/admin/ManageRegulations"
import OverallConsolidatedMarks from "./pages/admin/OverallConsolidatedMarks";
import SubjectWiseMarks from "./pages/admin/SubjectWiseMarks";
import CourseRecommendation from './pages/admin/CourseRecommendation';
import BatchRegulationAllocation from "./pages/admin/BatchRegulationAllocation";

// Staff Pages
import StaffDashboard from "./pages/staff/Dashboard";
import Attendance from "./pages/staff/Attendance";
import MarksAllocation from "./pages/staff/MarksAllocation";
import Options from "./pages/staff/Options";
import InternalMarks from "./pages/staff/InternalMarks";

// NotFound
import NotFound from "./pages/NotFound";

// ProtectedRoute
const ProtectedRoute = ({ children, role }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (role && getUserRole() !== role.toLowerCase()) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const routes = [
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password/:token", element: <ResetPassword /> },
  {
    path: "/admin",
    element: (
      <ProtectedRoute role="admin">
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: "dashboard", element: <AdminDashboard /> },
      { path: "manage-semesters", element: <ManageSemesters /> },
      { path: "manage-regulations", element: <ManageRegulations/> },
      { path: "manage-batches", element: <BatchRegulationAllocation/> },
      { path: "manage-courses", element: <ManageCourses /> },
      { path: "manage-staff", element: <ManageStaff /> },
      { path: "manage-students", element: <ManageStudents /> },
      { path: "timetable", element: <Timetable /> },
      { path: "consolidated-marks", element: <OverallConsolidatedMarks /> },
      { path: "subjectWise-marks", element: <SubjectWiseMarks /> },
      { path: "course-recommendation", element: <CourseRecommendation/>},
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "/staff",
    element: (
      <ProtectedRoute role="staff">
        <StaffLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <StaffDashboard /> },
      { path: "dashboard", element: <StaffDashboard /> },
      { path: "marks-allocation", element: <MarksAllocation /> },
      { path: "options/:courseId", element: <Options /> },
      { path: "marks-allocation/:courseId/:sectionId", element: <MarksAllocation /> },
      { path: "attendance", element: <Attendance /> },
      { path: "internal-marks/:courseId", element: <InternalMarks /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "*", element: <NotFound /> },
];

export default routes;
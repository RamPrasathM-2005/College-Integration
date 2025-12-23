import express from 'express';
import { downloadCbcsExcel,getCoursesByBatchDeptSemester,createCbcs, getAllCbcs,getCbcsById,getStudentCbcsSelection,submitStudentCourseSelection } from '../controllers/cbcsController.js';

const router = express.Router();
router.get('/course', getCoursesByBatchDeptSemester);
router.post('/create',createCbcs);
router.get('/getcbcs', getAllCbcs);
router.get("/cbcs/:id", getCbcsById);
router.get("/student",getStudentCbcsSelection);
router.post("/submission",submitStudentCourseSelection);
router.get("/:cbcs_id/download-excel", downloadCbcsExcel);

export default router;

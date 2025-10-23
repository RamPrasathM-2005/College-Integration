import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button, Select, Form, Spin, Card, Badge, Space, Typography, Table, Input, Row, Col } from 'antd';
import { DownloadOutlined, SearchOutlined, BookOutlined, CalendarOutlined, FilterOutlined, UserOutlined, IdcardOutlined, RiseOutlined } from '@ant-design/icons';
import { Users } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);
const { Option } = Select;
const { Title, Text } = Typography;

const Report = () => {
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedSem, setSelectedSem] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [reportType, setReportType] = useState(null);
  const [fullData, setFullData] = useState({ students: [], courses: [], marks: {}, courseOutcomes: [] });
  const [displayedData, setDisplayedData] = useState({ students: [], courses: [], marks: {}, courseOutcomes: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataReady, setDataReady] = useState(false);
  const [form] = Form.useForm();

  // Filter states (common for all report types)
  const [regNoTerm, setRegNoTerm] = useState('');
  const [nameTerm, setNameTerm] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterValue, setFilterValue] = useState('');

  // CO-wise specific states
  const [courseOutcomes, setCourseOutcomes] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // { regno, coId }
  const [editValue, setEditValue] = useState('');

  const api = axios.create({
    baseURL: 'http://localhost:4000/api',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  const adminMarksApi = axios.create({
    baseURL: 'http://localhost:4000/api/admin',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [batchRes, deptRes] = await Promise.all([
          api.get('/admin/batches'),
          api.get('/departments'),
        ]);
        const batchData = batchRes.data.data || [];
        const deptData = deptRes.data.data || [];
        setBatches(batchData);
        setDepartments(deptData);
        if (batchData.length === 0 || deptData.length === 0) {
          setError('No batches or departments available. Please contact the administrator.');
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'No batches or departments available',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        }
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'Failed to fetch initial data';
        setError(errorMsg);
        MySwal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: errorMsg,
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchSemesters = async () => {
      if (selectedBatch && selectedDept) {
        setLoading(true);
        try {
          const selectedBatchData = batches.find((b) => String(b.batchId) === String(selectedBatch));
          if (!selectedBatchData) {
            setError('Selected batch not found.');
            MySwal.fire({
              toast: true,
              position: 'top-end',
              icon: 'error',
              title: 'Selected batch not found',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
            return;
          }
          const res = await api.get(
            `/admin/semesters/by-batch-branch?batch=${encodeURIComponent(selectedBatchData.batch)}&branch=${encodeURIComponent(selectedBatchData.branch)}&degree=${encodeURIComponent(selectedBatchData.degree)}`
          );
          const semesterData = res.data.data || [];
          setSemesters(semesterData);
          if (semesterData.length === 0) {
            setError(`No semesters found for batch ${selectedBatchData.batch} - ${selectedBatchData.branch}`);
            MySwal.fire({
              toast: true,
              position: 'top-end',
              icon: 'warning',
              title: `No semesters found for batch ${selectedBatchData.batch} - ${selectedBatchData.branch}`,
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
          }
        } catch (err) {
          const errorMsg = err.response?.data?.message || 'Failed to fetch semesters';
          setError(errorMsg);
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: errorMsg,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        } finally {
          setLoading(false);
        }
      } else {
        setSemesters([]);
        setSelectedSem(null);
        form.setFieldsValue({ sem: null });
      }
    };
    fetchSemesters();
  }, [selectedBatch, selectedDept, batches, form]);

  // New function to fetch courses when semester is selected
  const fetchCourses = async () => {
    if (!selectedBatch || !selectedDept || !selectedSem) return;
    try {
      const selectedBatchData = batches.find((b) => String(b.batchId) === String(selectedBatch));
      const selectedDeptData = departments.find((d) => String(d.Deptid) === String(selectedDept));
      const params = {
        batch: selectedBatchData?.batch || selectedBatch,
        dept: selectedDeptData?.Deptacronym || selectedDept,
        sem: selectedSem,
      };
      const res = await api.get('/admin/consolidated-marks', { params });
      const { courses: apiCourses } = res.data.data;
      setCourses(apiCourses || []);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      setCourses([]);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [selectedSem]);

  const fetchData = async () => {
    if (!selectedBatch || !selectedDept || !selectedSem) {
      setError('Please select Batch, Department, and Semester');
      MySwal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Please select Batch, Department, and Semester',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }
    if ((reportType === 'subjectwise' || reportType === 'cowise') && !selectedCourse) {
      setError('Please select a Subject for the selected report type');
      MySwal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Please select a Subject',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }
    setLoading(true);
    setError(null);
    setFullData({ students: [], courses: [], marks: {}, courseOutcomes: [] });
    setDisplayedData({ students: [], courses: [], marks: {}, courseOutcomes: [] });
    setDataReady(false);
    setCourseOutcomes([]);
    try {
      const selectedBatchData = batches.find((b) => String(b.batchId) === String(selectedBatch));
      const selectedDeptData = departments.find((d) => String(d.Deptid) === String(selectedDept));
      const params = {
        batch: selectedBatchData?.batch || selectedBatch,
        dept: selectedDeptData?.Deptacronym || selectedDept,
        sem: selectedSem,
      };
      console.log('Sending request with params:', params);
      const res = await api.get('/admin/consolidated-marks', { params });
      console.log('Consolidated marks API response:', JSON.stringify(res.data, null, 2));
      const { students, courses: apiCourses, marks, message } = res.data.data;
      if (message || apiCourses.length === 0 || students.length === 0 || Object.keys(marks).length === 0) {
        setError(message || 'No data available for the selected criteria.');
        MySwal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: message || 'No data available for the selected criteria.',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
        setLoading(false);
        return;
      }

      if (reportType === 'cowise') {
        const selCourseObj = apiCourses.find(c => c.courseCode === selectedCourse);
        if (!selCourseObj) {
          setError('Selected course not found.');
          setLoading(false);
          return;
        }
        const coRes = await adminMarksApi.get(`/admin-marks/cos/${selectedCourse}`);
        const coData = coRes.data.data || [];
        console.log('Course outcomes:', JSON.stringify(coData, null, 2));
        const marksRes = await adminMarksApi.get(`/admin-marks/marks/co/${selectedCourse}`);
        console.log('CO marks response:', JSON.stringify(marksRes.data, null, 2));
        const rawStudents = marksRes.data.data.students || [];  // Fixed: added .data
        const processedStudents = rawStudents.map(s => {
          const marksByCo = {};
          Object.entries(s.marks || {}).forEach(([coNum, data]) => {
            marksByCo[data.coId] = parseFloat(data.consolidatedMark) || 0;
          });
          return { ...s, marks: marksByCo };
        });
        console.log('Processed students:', JSON.stringify(processedStudents, null, 2));

        setFullData({ students: processedStudents, courses: [selCourseObj], marks: {}, courseOutcomes: coData });
        setCourseOutcomes(coData);
        setDataReady(true);
        setLoading(false);
        return;
      }

      setFullData({ students, courses: apiCourses, marks });
      setDataReady(true);
      console.log('Marks data:', marks);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to fetch consolidated marks';
      setError(errorMsg);
      MySwal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: errorMsg,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataReady && fullData.courses.length > 0) {
      console.log('Updating displayedData:', JSON.stringify(fullData, null, 2));
      if ((reportType === 'subjectwise' || reportType === 'cowise') && selectedCourse) {
        const selCourseObj = fullData.courses.find(c => c.courseCode === selectedCourse);
        if (selCourseObj) {
          const dispCourses = [selCourseObj];
          let dispMarks = {};
          if (reportType !== 'cowise') {
            fullData.students.forEach(student => {
              dispMarks[student.regno] = {
                [selectedCourse]: fullData.marks[student.regno]?.[selectedCourse] || {}
              };
            });
          }
          setDisplayedData({
            students: fullData.students,
            courses: dispCourses,
            marks: dispMarks,
            courseOutcomes: fullData.courseOutcomes || []
          });
          console.log('Displayed data set:', JSON.stringify({
            students: fullData.students,
            courses: dispCourses,
            marks: dispMarks,
            courseOutcomes: fullData.courseOutcomes
          }, null, 2));
        } else {
          setError('Selected course not found in data.');
          setDisplayedData({ students: [], courses: [], marks: {}, courseOutcomes: [] });
        }
      } else {
        setDisplayedData(fullData);
      }
    } else {
      setDisplayedData({ students: [], courses: [], marks: {}, courseOutcomes: [] });
    }
  }, [reportType, selectedCourse, dataReady, fullData]);

  // CO-wise functions
  const startEdit = (regno, coId, value) => {
    setEditingCell({ regno, coId });
    setEditValue(value?.toString() || '0');
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value) && (value === '' || (Number(value) >= 0 && Number(value) <= 100))) {
      setEditValue(value);
    }
  };

  const handleBlur = async (regno, coId) => {
    const newMark = parseFloat(editValue);
    if (isNaN(newMark) || newMark < 0 || newMark > 100) {
      MySwal.fire('Error', 'Please enter a valid mark between 0 and 100', 'error');
      setEditingCell(null);
      return;
    }
    try {
      await adminMarksApi.put(`/admin-marks/marks/co/${regno}/${coId}`, { consolidatedMark: newMark });
      MySwal.fire('Success', 'Mark updated successfully', 'success');
      await fetchData();
    } catch (err) {
      MySwal.fire('Error', `Failed to update mark: ${err.response?.data?.message || err.message}`, 'error');
    }
    setEditingCell(null);
  };

  const handlePressEnter = (e, regno, coId) => {
    if (e.key === 'Enter') handleBlur(regno, coId);
    if (e.key === 'Escape') setEditingCell(null);
  };

  const computeFinalAvg = (student) => {
    let totalSum = 0;
    const totalCount = courseOutcomes.length;
    courseOutcomes.forEach((co) => {
      totalSum += parseFloat(student.marks?.[co.coId]) || 0;
    });
    return totalCount > 0 ? totalSum / totalCount : 0;
  };

  const filteredStudents = useMemo(() => {
    const filtered = displayedData.students.filter((student) => {
      const matchesRegNo = !regNoTerm ||
        (student.regno?.toLowerCase().includes(regNoTerm.toLowerCase()) ||
         student.rollnumber?.toLowerCase().includes(regNoTerm.toLowerCase()));
      const matchesName = !nameTerm || student.name?.toLowerCase().includes(nameTerm.toLowerCase());
      let matchesFilter = true;

      if (filterOperator && filterValue !== '') {
        const numValue = parseFloat(filterValue);
        if (!isNaN(numValue)) {
          let avgToCompare;
          if (reportType === 'cowise') {
            avgToCompare = computeFinalAvg(student);
          } else {
            const studentMarks = displayedData.marks[student.regno] || {};
            const courseAverages = Object.keys(studentMarks).map(courseCode => {
              const marks = studentMarks[courseCode];
              const partitions = [];
              if (marks.theory && !isNaN(parseFloat(marks.theory))) partitions.push(parseFloat(marks.theory));
              if (marks.practical && !isNaN(parseFloat(marks.practical))) partitions.push(parseFloat(marks.practical));
              if (marks.experiential && !isNaN(parseFloat(marks.experiential))) partitions.push(parseFloat(marks.experiential));
              return partitions.length > 0 ? partitions.reduce((sum, val) => sum + val, 0) / partitions.length : 0;
            });
            avgToCompare = courseAverages.length > 0 ? courseAverages.reduce((sum, val) => sum + val, 0) / courseAverages.length : 0;
          }
          switch (filterOperator) {
            case '>': matchesFilter = avgToCompare > numValue; break;
            case '<': matchesFilter = avgToCompare < numValue; break;
            case '=': matchesFilter = Math.abs(avgToCompare - numValue) < 0.01; break;
            case '>=': matchesFilter = avgToCompare >= numValue; break;
            case '<=': matchesFilter = avgToCompare <= numValue; break;
            default: matchesFilter = true; // Added default to handle empty operator
          }
        }
      }
      return matchesRegNo && matchesName && matchesFilter;
    });
    console.log('Filtered students:', JSON.stringify(filtered, null, 2));
    return filtered;
  }, [displayedData.students, regNoTerm, nameTerm, filterOperator, filterValue, courseOutcomes, displayedData.marks, reportType]);

  const clearFilters = () => {
    setRegNoTerm('');
    setNameTerm('');
    setFilterOperator('');
    setFilterValue('');
  };

  const computeCowiseColumns = () => {
    if (!courseOutcomes.length || !filteredStudents.length) {
      console.log('computeCowiseColumns: No course outcomes or filtered students', { courseOutcomes, filteredStudents });
      return [];
    }

    const partitionCounts = {
      theory: courseOutcomes.filter((co) => co.coType === 'THEORY').length,
      practical: courseOutcomes.filter((co) => co.coType === 'PRACTICAL').length,
      experiential: courseOutcomes.filter((co) => co.coType === 'EXPERIENTIAL').length,
    };

    const columns = [
      {
        title: (
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Register No.
          </div>
        ),
        dataIndex: 'regno',
        key: 'regno',
        width: 140,
        fixed: 'left',
        render: (text, record, index) => (
          <div className="flex items-center">
            <div className="w-8 h-8 text-blue-600 rounded-lg flex items-center justify-center mr-3 text-xs font-semibold">
              {index + 1}
            </div>
            <span className="font-mono text-gray-700 font-medium">{text}</span>
          </div>
        ),
      },
      {
        title: (
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-2 text-gray-500" />
            Student Name
          </div>
        ),
        dataIndex: 'name',
        key: 'name',
        width: 220,
        fixed: 'left',
        render: (text) => <span className="text-sm font-medium text-gray-900">{text}</span>,
      },
    ];

    courseOutcomes.forEach((co) => {
      columns.push({
        title: (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 text-blue-600 rounded-lg flex items-center justify-center mb-2 text-xs font-bold">
              {co.coNumber}
            </div>
            <span className="text-xs text-gray-500">{co.coType || ''}</span>
          </div>
        ),
        dataIndex: co.coId,
        key: co.coId,
        width: 110,
        align: 'center',
        render: (text, record) => {
          const regno = record.regno;
          const coMark = parseFloat(record.marks?.[co.coId]) || 0;
          const isEditing = editingCell?.regno === regno && editingCell?.coId === co.coId;
          return isEditing ? (
            <Input
              value={editValue}
              onChange={handleInputChange}
              onBlur={() => handleBlur(regno, co.coId)}
              onKeyDown={(e) => handlePressEnter(e, regno, co.coId)}
              style={{ width: 60, textAlign: 'center', fontSize: '14px' }}
              autoFocus
            />
          ) : (
            <span
              onClick={() => startEdit(regno, co.coId, coMark)}
              className={`inline-flex items-center justify-center w-14 h-8 text-sm font-semibold cursor-pointer hover:bg-blue-50 ${
                coMark >= 80 ? 'text-emerald-700' :
                coMark >= 70 ? 'text-blue-700' :
                coMark >= 60 ? 'text-amber-700' :
                coMark >= 50 ? 'text-orange-700' : 'text-red-700'
              }`}
            >
              {coMark.toFixed(1)}
            </span>
          );
        },
      });
    });

    if (partitionCounts.theory > 0) {
      columns.push({
        title: (
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
              T
            </div>
            <span className="text-xs text-gray-500">Theory Average</span>
          </div>
        ),
        key: 'theory_avg',
        width: 130,
        align: 'center',
        render: (_, record) => {
          const theorySum = courseOutcomes
            .filter((co) => co.coType === 'THEORY')
            .reduce((sum, co) => sum + (parseFloat(record.marks?.[co.coId]) || 0), 0);
          const avg = partitionCounts.theory > 0 ? (theorySum / partitionCounts.theory).toFixed(2) : '0.00';
          return <span className="inline-flex items-center justify-center w-16 h-8 text-emerald-700 text-sm font-semibold">{avg}</span>;
        },
      });
    }
    if (partitionCounts.practical > 0) {
      columns.push({
        title: (
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
              P
            </div>
            <span className="text-xs text-gray-500">Practical Average</span>
          </div>
        ),
        key: 'practical_avg',
        width: 130,
        align: 'center',
        render: (_, record) => {
          const practicalSum = courseOutcomes
            .filter((co) => co.coType === 'PRACTICAL')
            .reduce((sum, co) => sum + (parseFloat(record.marks?.[co.coId]) || 0), 0);
          const avg = partitionCounts.practical > 0 ? (practicalSum / partitionCounts.practical).toFixed(2) : '0.00';
          return <span className="inline-flex items-center justify-center w-16 h-8 text-violet-700 text-sm font-semibold">{avg}</span>;
        },
      });
    }
    if (partitionCounts.experiential > 0) {
      columns.push({
        title: (
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
              E
            </div>
            <span className="text-xs text-gray-500">Experiential Avg</span>
          </div>
        ),
        key: 'experiential_avg',
        width: 130,
        align: 'center',
        render: (_, record) => {
          const experientialSum = courseOutcomes
            .filter((co) => co.coType === 'EXPERIENTIAL')
            .reduce((sum, co) => sum + (parseFloat(record.marks?.[co.coId]) || 0), 0);
          const avg = partitionCounts.experiential > 0 ? (experientialSum / partitionCounts.experiential).toFixed(2) : '0.00';
          return <span className="inline-flex items-center justify-center w-16 h-8 text-amber-700 text-sm font-semibold">{avg}</span>;
        },
      });
    }
    columns.push({
      title: (
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 bg-blue-600 bg-opacity-20 rounded-lg flex items-center justify-center mb-1">
            <RiseOutlined className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-medium">Final Average</span>
        </div>
      ),
      key: 'final_avg',
      width: 140,
      align: 'center',
      render: (_, record) => {
        const finalAvg = computeFinalAvg(record);
        return <span className="inline-flex items-center justify-center w-20 h-10 text-blue-600 text-sm font-bold">{finalAvg.toFixed(2)}</span>;
      },
    });

    return columns;
  };

  const exportCourseWiseCsv = async (courseCode) => {
    try {
      const response = await adminMarksApi.get(`/export/course/${courseCode}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${courseCode}_marks.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      MySwal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'CSV exported successfully',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (err) {
      MySwal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: err.response?.data?.message || 'Failed to export CSV',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }
  };

  const computeTableData = () => {
    const { students, courses, marks } = displayedData;
    if (!students.length || !courses.length) return { columns: [], dataSource: [] };

    const columns = [
      {
        title: (
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Register No.
          </div>
        ),
        dataIndex: 'regno',
        key: 'regno',
        width: 140,
        fixed: 'left',
        render: (text, record, index) => (
          <div className="flex items-center">
            <div className="w-8 h-8 text-blue-600 rounded-lg flex items-center justify-center mr-3 text-xs font-semibold">
              {index + 1}
            </div>
            <span className="font-mono text-gray-700 font-medium">{text}</span>
          </div>
        ),
      },
      {
        title: (
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-2 text-gray-500" />
            Student Name
          </div>
        ),
        dataIndex: 'name',
        key: 'name',
        width: 220,
        fixed: 'left',
        render: (text) => <span className="text-sm font-medium text-gray-900">{text}</span>,
      },
    ];

    courses.forEach((course) => {
      const courseCode = course.courseCode;
      const courseGroup = {
        title: course.courseTitle,
        key: courseCode,
        children: [],
      };

      if (course.theoryCount > 0) {
        courseGroup.children.push({
          title: (
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
                T
              </div>
              <span className="text-xs text-gray-500">Theory</span>
            </div>
          ),
          dataIndex: `${courseCode}_theory`,
          key: `${courseCode}_theory`,
          width: 120,
          align: 'center',
          render: (text) => text != null && !isNaN(text) ? <span className="font-semibold text-emerald-700">{Number(text).toFixed(2)}</span> : '-',
        });
      }
      if (course.practicalCount > 0) {
        courseGroup.children.push({
          title: (
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
                P
              </div>
              <span className="text-xs text-gray-500">Practical</span>
            </div>
          ),
          dataIndex: `${courseCode}_practical`,
          key: `${courseCode}_practical`,
          width: 120,
          align: 'center',
          render: (text) => text != null && !isNaN(text) ? <span className="font-semibold text-violet-700">{Number(text).toFixed(2)}</span> : '-',
        });
      }
      if (course.experientialCount > 0) {
        courseGroup.children.push({
          title: (
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
                E
              </div>
              <span className="text-xs text-gray-500">Experiential</span>
            </div>
          ),
          dataIndex: `${courseCode}_experiential`,
          key: `${courseCode}_experiential`,
          width: 120,
          align: 'center',
          render: (text) => text != null && !isNaN(text) ? <span className="font-semibold text-amber-700">{Number(text).toFixed(2)}</span> : '-',
        });
      }
      courseGroup.children.push({
        title: (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 bg-blue-600 bg-opacity-20 rounded-lg flex items-center justify-center mb-1">
              <RiseOutlined className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium">Final Average</span>
          </div>
        ),
        key: `${courseCode}_final_avg`,
        dataIndex: `${courseCode}_final_avg`,
        width: 140,
        align: 'center',
        render: (text) => text != null && !isNaN(text) ? <span className="font-bold text-blue-600">{Number(text).toFixed(2)}</span> : '-',
      });

      columns.push(courseGroup);
    });

    const dataSource = filteredStudents.map((student) => {
      const row = {
        key: student.regno,
        regno: student.regno,
        name: student.name,
      };

      courses.forEach((course) => {
        const courseCode = course.courseCode;
        const studentMarks = marks[student.regno]?.[courseCode] || {};
        const theory = parseFloat(studentMarks.theory);
        const practical = parseFloat(studentMarks.practical);
        const experiential = parseFloat(studentMarks.experiential);

        if (course.theoryCount > 0) {
          row[`${courseCode}_theory`] = isNaN(theory) ? null : theory;
        }
        if (course.practicalCount > 0) {
          row[`${courseCode}_practical`] = isNaN(practical) ? null : practical;
        }
        if (course.experientialCount > 0) {
          row[`${courseCode}_experiential`] = isNaN(experiential) ? null : experiential;
        }

        const coursePartitions = [];
        if (course.theoryCount > 0 && !isNaN(theory)) coursePartitions.push(theory);
        if (course.practicalCount > 0 && !isNaN(practical)) coursePartitions.push(practical);
        if (course.experientialCount > 0 && !isNaN(experiential)) coursePartitions.push(experiential);
        const courseFinalAvg = coursePartitions.length > 0 ? coursePartitions.reduce((sum, val) => sum + val, 0) / coursePartitions.length : null;
        row[`${courseCode}_final_avg`] = courseFinalAvg;
      });

      return row;
    });

    return { columns, dataSource };
  };

  const exportToExcel = () => {
    const { students, courses, marks } = displayedData;
    if (!students.length || !courses.length) {
      MySwal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'No data to export',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    const header1 = ['Roll No', 'Name'];
    const header2 = ['', ''];
    const merges = [];
    let currentCol = 2;

    courses.forEach(course => {
      const numPartitions = (course.theoryCount > 0 ? 1 : 0) +
                           (course.practicalCount > 0 ? 1 : 0) +
                           (course.experientialCount > 0 ? 1 : 0) + 1;
      merges.push({ s: { r: 0, c: currentCol }, e: { r: 0, c: currentCol + numPartitions - 1 } });
      header1.push(...Array(numPartitions).fill(course.courseTitle));
      if (course.theoryCount > 0) header2.push('Theory');
      if (course.practicalCount > 0) header2.push('Practical');
      if (course.experientialCount > 0) header2.push('Experiential');
      header2.push('Final Avg');
      currentCol += numPartitions;
    });

    const rows = [header1, header2];
    filteredStudents.forEach(student => {
      const row = [student.regno, student.name];
      courses.forEach(course => {
        const studentMarks = marks[student.regno]?.[course.courseCode] || {};
        const theory = parseFloat(studentMarks.theory);
        const practical = parseFloat(studentMarks.practical);
        const experiential = parseFloat(studentMarks.experiential);
        const coursePartitions = [];
        if (course.theoryCount > 0) {
          row.push(isNaN(theory) ? '' : theory.toFixed(2));
          if (!isNaN(theory)) coursePartitions.push(theory);
        }
        if (course.practicalCount > 0) {
          row.push(isNaN(practical) ? '' : practical.toFixed(2));
          if (!isNaN(practical)) coursePartitions.push(practical);
        }
        if (course.experientialCount > 0) {
          row.push(isNaN(experiential) ? '' : experiential.toFixed(2));
          if (!isNaN(experiential)) coursePartitions.push(experiential);
        }
        const courseFinalAvg = coursePartitions.length > 0 ? coursePartitions.reduce((sum, val) => sum + val, 0) / coursePartitions.length : '';
        row.push(courseFinalAvg ? courseFinalAvg.toFixed(2) : '');
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType === 'subjectwise' ? 'Subject Wise Marks' : 'Consolidated Marks');
    const filename = reportType === 'subjectwise'
      ? `subject_wise_marks_${selectedBatch}_${selectedDept}_${selectedSem}_${selectedCourse || 'all'}.xlsx`
      : `consolidated_marks_${selectedBatch}_${selectedDept}_${selectedSem}.xlsx`;
    XLSX.writeFile(wb, filename);
    MySwal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Excel exported successfully',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  };

  const exportToPDF = () => {
    const { students, courses, marks } = displayedData;
    if (!students.length || !courses.length) {
      MySwal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'No data to export',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const title = reportType === 'subjectwise' ? 'Subject Wise Marks Report' : 'Consolidated Marks Report';
    doc.setFontSize(16);
    doc.text(title, 14, 20);

    const headRow0 = ['Roll No', 'Name'];
    const headRow1 = ['', ''];
    let totalCols = 2;
    courses.forEach(course => {
      const numPartitions = (course.theoryCount > 0 ? 1 : 0) + (course.practicalCount > 0 ? 1 : 0) + (course.experientialCount > 0 ? 1 : 0) + 1;
      headRow0.push(...Array(numPartitions).fill(course.courseTitle));
      if (course.theoryCount > 0) headRow1.push('Theory');
      if (course.practicalCount > 0) headRow1.push('Practical');
      if (course.experientialCount > 0) headRow1.push('Experiential');
      headRow1.push('Final Avg');
      totalCols += numPartitions;
    });
    const head = [headRow0, headRow1];

    const tableData = filteredStudents.map(student => {
      const row = [student.regno, student.name];
      courses.forEach(course => {
        const studentMarks = marks[student.regno]?.[course.courseCode] || {};
        const theory = parseFloat(studentMarks.theory);
        const practical = parseFloat(studentMarks.practical);
        const experiential = parseFloat(studentMarks.experiential);
        const coursePartitions = [];
        if (course.theoryCount > 0) {
          row.push(isNaN(theory) ? '-' : theory.toFixed(2));
          if (!isNaN(theory)) coursePartitions.push(theory);
        }
        if (course.practicalCount > 0) {
          row.push(isNaN(practical) ? '-' : practical.toFixed(2));
          if (!isNaN(practical)) coursePartitions.push(practical);
        }
        if (course.experientialCount > 0) {
          row.push(isNaN(experiential) ? '-' : experiential.toFixed(2));
          if (!isNaN(experiential)) coursePartitions.push(experiential);
        }
        const courseFinalAvg = coursePartitions.length > 0 ? coursePartitions.reduce((sum, val) => sum + val, 0) / coursePartitions.length : '-';
        row.push(courseFinalAvg !== '-' ? courseFinalAvg.toFixed(2) : '-');
      });
      return row;
    });

    doc.autoTable({
      head: head,
      body: tableData,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 40 } },
      headStyles: { fillColor: [200, 200, 200], halign: 'center', valign: 'middle' },
    });

    const filename = reportType === 'subjectwise'
      ? `subject_wise_marks_${selectedBatch}_${selectedDept}_${selectedSem}_${selectedCourse || 'all'}.pdf`
      : `consolidated_marks_${selectedBatch}_${selectedDept}_${selectedSem}.pdf`;
    doc.save(filename);
    MySwal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'PDF exported successfully',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  };

  const handleDownload = () => {
    if (reportType === 'cowise') {
      exportCourseWiseCsv(selectedCourse);
      return;
    }
    if (filteredStudents.length === 0) {
      MySwal.fire({
        title: 'No Data to Export',
        text: 'No students match the current filters. Clear filters to export full data.',
        icon: 'warning',
        confirmButtonText: 'OK',
      });
      return;
    }
    MySwal.fire({
      title: 'Choose Format',
      text: 'Select the format to download the report',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Excel',
      // cancelButtonText: 'PDF',
      confirmButtonColor: '#52c41a',
      // cancelButtonColor: '#1890ff',
    }).then((result) => {
      if (result.isConfirmed) {
        exportToExcel();
      // } else if (result.dismiss === Swal.DismissReason.cancel) {
      //   exportToPDF();
      }
    });
  };

  const getSelectedBatchInfo = () => {
    if (!selectedBatch) return null;
    const batch = batches.find(b => String(b.batchId) === String(selectedBatch));
    return batch;
  };

  const getSelectedDeptInfo = () => {
    if (!selectedDept) return null;
    const dept = departments.find(d => String(d.Deptid) === String(selectedDept));
    return dept;
  };

  const getSelectedCourseInfo = () => {
    if (!selectedCourse) return null;
    const course = courses.find(c => c.courseCode === selectedCourse);
    return course;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Filter Section */}
        <Card className="mb-6 shadow-lg border-0 bg-white" bodyStyle={{ padding: '32px' }}>
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
              <Text className="text-red-700">{error}</Text>
            </div>
          )}

          <Title level={3} className="text-blue-800 mb-2">
            Generate Report
          </Title>

          <Spin spinning={loading}>
            <Form form={form} layout="vertical">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <Form.Item label={<span className="text-gray-700 font-semibold flex items-center"><BookOutlined className="mr-2 text-blue-600" />Report Type</span>}>
                  <Select
                    value={reportType}
                    onChange={(value) => {
                      setReportType(value);
                      setSelectedCourse(null);
                      form.setFieldsValue({ course: null });
                      setDataReady(false);
                      setCourseOutcomes([]);
                      clearFilters();
                    }}
                    placeholder="Choose report type"
                    allowClear
                    size="large"
                    className="w-full"
                  >
                    <Option value="overall">Overall Consolidated Marks</Option>
                    <Option value="subjectwise">Subject Wise Marks</Option>
                    <Option value="cowise">CO Wise Marks</Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="text-gray-700 font-semibold flex items-center"><CalendarOutlined className="mr-2 text-blue-600" />Academic Batch</span>}>
                  <Select
                    value={selectedBatch}
                    onChange={(value) => {
                      setSelectedBatch(value);
                      setSelectedDept(null);
                      setSelectedSem(null);
                      setSelectedCourse(null);
                      form.setFieldsValue({ dept: null, sem: null, course: null });
                      setDataReady(false);
                      clearFilters();
                    }}
                    placeholder="Choose academic batch"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    className="w-full"
                  >
                    {batches.map(batch => (
                      <Option key={batch.batchId} value={batch.batchId}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{batch.batchYears}</span>
                          <span className="text-blue-600 text-sm">{batch.degree} - {batch.branch}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="text-gray-700 font-semibold flex items-center"><BookOutlined className="mr-2 text-blue-600" />Department</span>} name="dept">
                  <Select
                    value={selectedDept}
                    onChange={(value) => {
                      setSelectedDept(value);
                      setSelectedSem(null);
                      setSelectedCourse(null);
                      form.setFieldsValue({ sem: null, course: null });
                      setDataReady(false);
                      clearFilters();
                    }}
                    placeholder="Choose department"
                    disabled={!selectedBatch}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    className="w-full"
                  >
                    {departments.map(dept => (
                      <Option key={dept.Deptid} value={dept.Deptid}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{dept.Deptname}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="text-gray-700 font-semibold flex items-center"><CalendarOutlined className="mr-2 text-blue-600" />Semester</span>} name="sem">
                  <Select
                    value={selectedSem}
                    onChange={(value) => {
                      setSelectedSem(value);
                      setSelectedCourse(null);
                      form.setFieldsValue({ course: null });
                      setDataReady(false);
                      clearFilters();
                    }}
                    placeholder="Choose semester"
                    disabled={!selectedDept}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    className="w-full"
                  >
                    {semesters.map(sem => (
                      <Option key={sem.semesterId} value={sem.semesterNumber}>
                        <div className="flex items-center">
                          <span className="font-medium">Semester {sem.semesterNumber}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              {(reportType === 'subjectwise' || reportType === 'cowise') && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                  <Form.Item label={<span className="text-gray-700 font-semibold flex items-center"><BookOutlined className="mr-2 text-blue-600" />Subject</span>} name="course">
                    <Select
                      value={selectedCourse}
                      onChange={(value) => {
                        setSelectedCourse(value);
                        setDataReady(false);
                        clearFilters();
                      }}
                      placeholder="Choose subject"
                      disabled={!selectedSem || courses.length === 0}
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      size="large"
                      className="w-full"
                    >
                      {courses.map(course => (
                        <Option key={course.courseCode} value={course.courseCode}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{course.courseTitle}</span>
                            <span className="text-blue-600 text-sm">{course.courseCode}</span>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
              )}

              {(reportType || selectedBatch || selectedDept || selectedSem || selectedCourse) && (
                <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
                  <Title level={5} className="text-blue-800 mb-3">Current Selection:</Title>
                  <Space wrap>
                    {reportType && (
                      <Badge
                        color="purple"
                        text={`Type: ${reportType === 'overall' ? 'Overall Consolidated' : reportType === 'subjectwise' ? 'Subject Wise' : 'CO Wise'}`}
                      />
                    )}
                    {selectedBatch && (
                      <Badge
                        color="blue"
                        text={`Batch: ${getSelectedBatchInfo()?.batchYears || selectedBatch}`}
                      />
                    )}
                    {selectedDept && (
                      <Badge
                        color="green"
                        text={`Dept: ${getSelectedDeptInfo()?.Deptname || selectedDept}`}
                      />
                    )}
                    {selectedSem && (
                      <Badge
                        color="orange"
                        text={`Semester: ${selectedSem}`}
                      />
                    )}
                    {selectedCourse && (
                      <Badge
                        color="cyan"
                        text={`Subject: ${getSelectedCourseInfo()?.courseTitle || selectedCourse}`}
                      />
                    )}
                  </Space>
                </div>
              )}

              <Space>
                <Button
                  type="primary"
                  onClick={fetchData}
                  disabled={!reportType || !selectedBatch || !selectedDept || !selectedSem || ((reportType === 'subjectwise' || reportType === 'cowise') && !selectedCourse)}
                  loading={loading}
                  size="large"
                  icon={<SearchOutlined />}
                  className="px-8"
                >
                  Prepare Report Data
                </Button>
                {dataReady && displayedData.students.length > 0 && (
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownload}
                    size="large"
                    className="bg-green-600 hover:bg-green-700 border-0"
                  >
                    {reportType === 'cowise' ? 'Export CSV' : 'Download Report'}
                  </Button>
                )}
              </Space>
            </Form>
          </Spin>
        </Card>

        {!dataReady && !loading && !error && (
          <Card className="text-center shadow-lg bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="py-12">
              <BookOutlined className="text-6xl text-gray-300 mb-4" />
              <Title level={3} className="text-gray-500 mb-2">No Report Prepared</Title>
              <Text className="text-gray-400 text-lg">
                Please select options and prepare the report data
              </Text>
            </div>
          </Card>
        )}

        {dataReady && (
          <>
            <Card className="shadow-lg mb-6">
              <Title level={4} className="text-green-700">Report Data Ready!</Title>
              <Text>
                Data for {displayedData.students.length} students and {displayedData.courses.length} courses is prepared. 
                Showing {filteredStudents.length} after filters.
              </Text>
            </Card>

            <Card className="shadow-md mb-4 bg-white rounded-lg p-4 border border-gray-200">
              <Row gutter={16} align="middle">
                <Col span={6}>
                  <div className="flex items-center gap-2">
                    <IdcardOutlined className="text-gray-400" />
                    <Input
                      placeholder="Filter by Reg No..."
                      value={regNoTerm}
                      onChange={(e) => setRegNoTerm(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </Col>
                <Col span={6}>
                  <div className="flex items-center gap-2">
                    <UserOutlined className="text-gray-400" />
                    <Input
                      placeholder="Filter by Student Name..."
                      value={nameTerm}
                      onChange={(e) => setNameTerm(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </Col>
                <Col span={6}>
                  <div className="flex items-center gap-2">
                    <FilterOutlined className="text-gray-400" />
                    <Select
                      value={filterOperator}
                      onChange={setFilterOperator}
                      className="w-20 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <Option value="">All</Option>
                      <Option value=">">&gt;</Option>
                      <Option value="<">&lt;</Option>
                      <Option value="=">=</Option>
                      <Option value=">=">&ge;</Option>
                      <Option value="<=">&le;</Option>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Mark"
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      min="0"
                      max="100"
                      disabled={!filterOperator}
                      className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </Col>
                <Col span={6}>
                  {(regNoTerm || nameTerm || filterOperator || filterValue) && (
                    <Button
                      onClick={clearFilters}
                      className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Text style={{ marginLeft: 8 }}>
                    Showing {filteredStudents.length} of {displayedData.students.length} students
                    {regNoTerm && ` | Reg No: "${regNoTerm}"`}
                    {nameTerm && ` | Name: "${nameTerm}"`}
                    {filterOperator && filterValue && ` | Filter: ${filterOperator} ${filterValue}`}
                  </Text>
                </Col>
              </Row>
            </Card>

            {filteredStudents.length > 0 ? (
              <>
                {reportType === 'cowise' ? (
                  <Card className="shadow-lg bg-white rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                          <RiseOutlined className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <Title level={4} className="text-gray-800 mb-0">
                            CO Wise Marks - {getSelectedCourseInfo()?.courseTitle || selectedCourse}
                          </Title>
                          <Text className="text-sm text-gray-600">Click on marks to edit</Text>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{filteredStudents.length}</span> students enrolled
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table
                        columns={computeCowiseColumns()}
                        dataSource={filteredStudents}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        size="small"
                        bordered
                        rowClassName={(record, index) => index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}
                      />
                    </div>
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 mt-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-600">
                          <Users className="w-4 h-4 mr-2" />
                          <span>Total Students: </span>
                          <span className="font-semibold text-gray-900 ml-1">{filteredStudents.length}</span>
                        </div>
                        <div className="flex items-center space-x-6 text-xs text-gray-500">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded mr-2"></div>
                            <span>Excellent (≥80)</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded mr-2"></div>
                            <span>Good (70-79)</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded mr-2"></div>
                            <span>Average (60-69)</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded mr-2"></div>
                            <span>Below Average (50-59)</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded mr-2"></div>
                            <span>Needs Improvement (&lt;50)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="shadow-lg bg-white rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                          <RiseOutlined className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <Title level={4} className="text-gray-800 mb-0">
                            {reportType === 'subjectwise' ? 'Subject Wise Marks' : 'Consolidated Marks'} - {getSelectedCourseInfo()?.courseTitle || 'All Courses'}
                          </Title>
                          <Text className="text-sm text-gray-600">Scroll horizontally if needed</Text>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{filteredStudents.length}</span> students enrolled
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table
                        columns={computeTableData().columns}
                        dataSource={computeTableData().dataSource}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        size="small"
                        bordered
                        rowClassName={(record, index) => index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}
                      />
                    </div>
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 mt-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-600">
                          <Users className="w-4 h-4 mr-2" />
                          <span>Total Students: </span>
                          <span className="font-semibold text-gray-900 ml-1">{filteredStudents.length}</span>
                        </div>
                        <div className="flex items-center space-x-6 text-xs text-gray-500">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded mr-2"></div>
                            <span>Excellent (≥80)</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded mr-2"></div>
                            <span>Good (70-79)</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded mr-2"></div>
                            <span>Average (60-69)</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded mr-2"></div>
                            <span>Below Average (50-59)</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded mr-2"></div>
                            <span>Needs Improvement (&lt;50)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card className="text-center shadow-lg bg-gradient-to-br from-gray-50 to-gray-100 mb-6">
                <div className="py-12">
                  <BookOutlined className="text-6xl text-gray-300 mb-4" />
                  <Title level={3} className="text-gray-500 mb-2">No Matching Students</Title>
                  <Text className="text-gray-400 text-lg mb-4">
                    No students match the current filter criteria. Adjust the filters above or clear them to view all data.
                  </Text>
                  <Button type="primary" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Report;
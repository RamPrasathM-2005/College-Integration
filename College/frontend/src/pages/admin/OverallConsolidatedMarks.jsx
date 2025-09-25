import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { createObjectCsvWriter } from 'csv-writer';
import { saveAs } from 'file-saver';

const MySwal = withReactContent(Swal);

const OverallConsolidatedMarks = () => {
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [marks, setMarks] = useState([]);
  const [error, setError] = useState('');
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(false);

  const api = axios.create({
    baseURL: 'http://localhost:4000/api',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [batchRes, deptRes] = await Promise.all([
          api.get('/admin/batches'),
          api.get('/departments'),
        ]);
        console.log('Batches response:', batchRes.data);
        console.log('Departments response:', deptRes.data);
        const batchData = batchRes.data.data || [];
        setBatches(batchData);
        setDepartments(deptRes.data.data || []);
        if (batchData.length === 0) {
          setError('No batches available. Please contact the administrator.');
          MySwal.fire('Error', 'No batches available. Please contact the administrator.', 'error');
        }
      } catch (err) {
        console.error('Initial data fetch error:', err.response?.data || err.message);
        setError(err.response?.data?.message || 'Failed to fetch initial data');
        MySwal.fire('Error', err.response?.data?.message || 'Failed to fetch initial data', 'error');
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (batches.length === 0) {
      setSelectedBatch('');
      setSelectedDept('');
      setSelectedSem('');
      setSemesters([]);
    }
  }, [batches]);

  useEffect(() => {
    if (selectedBatch && selectedDept) {
      const fetchSemesters = async () => {
        setIsLoadingSemesters(true);
        try {
          console.log('Fetching semesters with:', { batches, selectedBatch });
          const selectedBatchData = batches.find((b) => String(b.batchId) === String(selectedBatch));
          if (!selectedBatchData) {
            console.error('Batch not found in batches:', { selectedBatch, batches });
            setError('Selected batch not found. Please try another batch.');
            MySwal.fire('Error', 'Selected batch not found. Please try another batch.', 'error');
            return;
          }
          const res = await api.get(
            `/admin/semesters/by-batch-branch?batch=${encodeURIComponent(selectedBatchData.batch)}&branch=${encodeURIComponent(selectedBatchData.branch)}&degree=${encodeURIComponent(selectedBatchData.degree)}`
          );
          console.log('Semesters response:', res.data);
          setSemesters(res.data.data || []);
          if (res.data.data.length === 0) {
            setError(`No semesters found for batch ${selectedBatchData.batch} - ${selectedBatchData.branch}`);
            MySwal.fire('Error', `No semesters found for batch ${selectedBatchData.batch} - ${selectedBatchData.branch}`, 'error');
          }
        } catch (err) {
          console.error('Semesters fetch error:', err.response?.data || err.message);
          setError(err.response?.data?.message || err.message || 'Failed to fetch semesters');
          MySwal.fire('Error', err.response?.data?.message || err.message || 'Failed to fetch semesters', 'error');
        } finally {
          setIsLoadingSemesters(false);
        }
      };
      fetchSemesters();
    }
  }, [selectedBatch, selectedDept, batches]);

  useEffect(() => {
    console.log('Selected values:', { selectedBatch, selectedDept, selectedSem });
  }, [selectedBatch, selectedDept, selectedSem]);

  const handleSubmit = async () => {
    console.log('handleSubmit called with:', { batchId: selectedBatch, deptId: selectedDept, sem: selectedSem });
    if (!selectedBatch || !selectedDept || !selectedSem) {
      MySwal.fire('Error', 'Please select Batch, Department, and Semester', 'error');
      return;
    }
    try {
      setError('');
      const res = await api.get(
        `/admin/consolidated-marks?batchId=${encodeURIComponent(selectedBatch)}&deptId=${encodeURIComponent(selectedDept)}&sem=${encodeURIComponent(selectedSem)}`
      );
      console.log('Consolidated marks response:', res.data);
      const { students, courses, marks } = res.data.data;
      if (students.length === 0) {
        setError('No students found for the selected batch, department, and semester.');
        MySwal.fire('Warning', 'No students found for the selected batch, department, and semester.', 'warning');
      }
      setStudents(students || []);
      setCourses(courses || []);
      setMarks(marks || []);
    } catch (err) {
      console.error('Consolidated marks fetch error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to fetch consolidated marks');
      MySwal.fire('Error', err.response?.data?.message || 'Failed to fetch consolidated marks', 'error');
    }
  };

  const handleExport = async () => {
    if (!students.length || !courses.length) {
      MySwal.fire('Error', 'No data to export', 'error');
      return;
    }
    try {
      const header = [
        { id: 'regno', title: 'Roll No' },
        { id: 'name', title: 'Name' },
      ];
      courses.forEach((course) => {
        if (course.theoryCount > 0) header.push({ id: `${course.courseCode}_T`, title: `${course.courseTitle} (Theory)` });
        if (course.practicalCount > 0) header.push({ id: `${course.courseCode}_P`, title: `${course.courseTitle} (Practical)` });
        if (course.experientialCount > 0) header.push({ id: `${course.courseCode}_E`, title: `${course.courseTitle} (Experiential)` });
      });

      const data = students.map((student) => {
        const row = { regno: student.regno, name: student.name };
        courses.forEach((course) => {
          const studentMarks = marks.find((m) => m.studentId === student.userId && m.courseId === course.courseId);
          if (course.theoryCount > 0) row[`${course.courseCode}_T`] = studentMarks?.theory || '0.00';
          if (course.practicalCount > 0) row[`${course.courseCode}_P`] = studentMarks?.practical || '0.00';
          if (course.experientialCount > 0) row[`${course.courseCode}_E`] = studentMarks?.experiential || '0.00';
        });
        return row;
      });

      const csvWriter = createObjectCsvWriter({
        path: undefined,
        header,
      });

      const csvString = await csvWriter.writeRecords(data).then(() => csvWriter.getStream().toString());
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `consolidated_marks_${selectedBatch}_${selectedDept}_${selectedSem}.csv`);
      MySwal.fire('Success', 'Data exported successfully', 'success');
    } catch (err) {
      console.error('Export error:', err);
      MySwal.fire('Error', 'Failed to export data', 'error');
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Overall Consolidated Marks</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Batch</label>
            <select
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setSelectedDept('');
                setSelectedSem('');
                setSemesters([]);
              }}
              className="mt-1 block w-full p-2 border rounded-md"
            >
              <option value="">Select Batch</option>
              {Array.isArray(batches) && batches.length > 0 ? (
                batches.map((batch) => (
                  <option key={batch.batchId} value={batch.batchId}>
                    {batch.batchYears} ({batch.degree} - {batch.branch})
                  </option>
                ))
              ) : (
                <option value="">No batches available</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setSelectedSem('');
                setSemesters([]);
              }}
              className="mt-1 block w-full p-2 border rounded-md"
              disabled={batches.length === 0}
            >
              <option value="">Select Department</option>
              {Array.isArray(departments) && departments.length > 0 ? (
                departments.map((dept) => (
                  <option key={dept.Deptid} value={dept.Deptid}>
                    {dept.Deptname}
                  </option>
                ))
              ) : (
                <option value="">No departments available</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Semester</label>
            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              className="mt-1 block w-full p-2 border rounded-md"
              disabled={isLoadingSemesters || batches.length === 0 || !selectedDept}
            >
              <option value="">Select Semester</option>
              {Array.isArray(semesters) && semesters.length > 0 ? (
                semesters.map((sem) => (
                  <option key={sem.semesterId} value={sem.semesterNumber}>
                    Semester {sem.semesterNumber}
                  </option>
                ))
              ) : (
                <option value="">No semesters available</option>
              )}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700"
              disabled={batches.length === 0 || !selectedBatch || !selectedDept || !selectedSem}
            >
              Submit
            </button>
          </div>
        </div>
      </div>

      {students.length > 0 && courses.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow overflow-x-auto">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleExport}
              className="flex items-center bg-green-600 text-white p-2 rounded-md hover:bg-green-700"
            >
              <Download className="w-5 h-5 mr-2" />
              Export to CSV
            </button>
          </div>
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border p-2 text-left" rowSpan={2}>Roll No</th>
                <th className="border p-2 text-left" rowSpan={2}>Name</th>
                {courses.map((course) => (
                  <th
                    key={course.courseId}
                    className="border p-2 text-center"
                    colSpan={
                      (course.theoryCount > 0 ? 1 : 0) +
                      (course.practicalCount > 0 ? 1 : 0) +
                      (course.experientialCount > 0 ? 1 : 0)
                    }
                  >
                    {course.courseTitle}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-100">
                {courses.map((course) => (
                  <React.Fragment key={course.courseId}>
                    {course.theoryCount > 0 && (
                      <th className="border p-2 text-center">T</th>
                    )}
                    {course.practicalCount > 0 && (
                      <th className="border p-2 text-center">P</th>
                    )}
                    {course.experientialCount > 0 && (
                      <th className="border p-2 text-center">E</th>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.userId} className="hover:bg-gray-50">
                  <td className="border p-2">{student.regno}</td>
                  <td className="border p-2">{student.name}</td>
                  {courses.map((course) => {
                    const studentMarks = marks.find(
                      (m) => m.studentId === student.userId && m.courseId === course.courseId
                    );
                    return (
                      <React.Fragment key={course.courseId}>
                        {course.theoryCount > 0 && (
                          <td className="border p-2 text-center">{studentMarks?.theory || '-'}</td>
                        )}
                        {course.practicalCount > 0 && (
                          <td className="border p-2 text-center">{studentMarks?.practical || '-'}</td>
                        )}
                        {course.experientialCount > 0 && (
                          <td className="border p-2 text-center">{studentMarks?.experiential || '-'}</td>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OverallConsolidatedMarks;
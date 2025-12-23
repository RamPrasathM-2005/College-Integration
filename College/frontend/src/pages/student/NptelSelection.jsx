import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole } from '../../utils/auth';
import {
  fetchSemesters,
  fetchNptelCourses,
  enrollNptelCourses,
  fetchStudentNptelEnrollments,
  requestNptelCreditTransfer,
  fetchOecPecProgress,
} from '../../services/studentService';

const NptelSelection = () => {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [availableNptel, setAvailableNptel] = useState([]);
  const [enrolledNptel, setEnrolledNptel] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (getUserRole() !== 'student') {
      navigate('/login');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const sems = await fetchSemesters();
        setSemesters(sems);

        const active = sems.find(s => s.isActive === 'YES') || sems[0];
        setSelectedSemester(active?.semesterId || '');

        const prog = await fetchOecPecProgress();
        setProgress(prog);

        const enrolls = await fetchStudentNptelEnrollments();
        setEnrolledNptel(enrolls);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  useEffect(() => {
    if (!selectedSemester) return;

    const loadNptel = async () => {
      try {
        const courses = await fetchNptelCourses(selectedSemester);
        setAvailableNptel(courses);
      } catch (err) {
        setError('Failed to fetch NPTEL courses');
      }
    };

    loadNptel();
  }, [selectedSemester]);

  const handleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleEnroll = async () => {
    try {
      await enrollNptelCourses(selectedSemester, selectedIds);
      setSuccess('Enrolled successfully');
      setSelectedIds([]);
      const enrolls = await fetchStudentNptelEnrollments();
      setEnrolledNptel(enrolls);
      const prog = await fetchOecPecProgress();
      setProgress(prog);
    } catch (err) {
      setError('Enrollment failed');
    }
  };

  const handleRequestTransfer = async (enrollmentId) => {
    try {
      await requestNptelCreditTransfer(enrollmentId);
      setSuccess('Transfer requested');
      const enrolls = await fetchStudentNptelEnrollments();
      setEnrolledNptel(enrolls);
      const prog = await fetchOecPecProgress();
      setProgress(prog);
    } catch (err) {
      setError('Request failed');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">NPTEL Course Selection</h1>

      {progress && (
        <div className="bg-yellow-100 p-4 rounded-lg mb-6">
          <h3 className="font-bold">OEC/PEC Requirements (per regulation)</h3>
          <p>OEC: {progress.completed.OEC}/{progress.required.OEC} ({progress.remaining.OEC} remaining)</p>
          <p>PEC: {progress.completed.PEC}/{progress.required.PEC} ({progress.remaining.PEC} remaining)</p>
          {(progress.remaining.OEC === 0 || progress.remaining.PEC === 0) && <p className="text-green-600">Some requirements fulfilled!</p>}
        </div>
      )}

      <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="border p-2 mb-6">
        <option value="">Select Semester</option>
        {semesters.map(sem => (
          <option key={sem.semesterId} value={sem.semesterId}>
            Semester {sem.semesterNumber}
          </option>
        ))}
      </select>

      {selectedSemester && (
        <>
          <h2 className="text-2xl mb-4">Available NPTEL Courses</h2>
          {availableNptel.map(course => (
            <div key={course.nptelCourseId} className="mb-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(course.nptelCourseId) || course.isEnrolled}
                onChange={() => handleSelect(course.nptelCourseId)}
                disabled={course.isEnrolled}
              />
              {course.courseTitle} ({course.type}, {course.credits} credits)
              {course.isEnrolled && <span className="text-green-600"> (Enrolled)</span>}
            </div>
          ))}

          <button onClick={handleEnroll} disabled={selectedIds.length === 0} className="bg-blue-500 text-white p-2 mt-4">
            Enroll Selected
          </button>

          <h2 className="text-2xl mt-8 mb-4">Enrolled NPTEL Courses</h2>
          {enrolledNptel.map(enroll => (
            <div key={enroll.enrollmentId} className="mb-2">
              {enroll.courseTitle} ({enroll.type})
              {enroll.transferStatus ? (
                <span> Transfer: {enroll.transferStatus}</span>
              ) : enroll.transferredGrade ? (
                <button onClick={() => handleRequestTransfer(enroll.enrollmentId)} className="bg-green-500 text-white p-1 ml-2">
                  Request Transfer
                </button>
              ) : (
                <span className="text-gray-500"> (Grade pending)</span>
              )}
            </div>
          ))}
        </>
      )}

      {success && <p className="text-green-600 mt-4">{success}</p>}
      {error && <p className="text-red-600 mt-4">{error}</p>}
    </div>
  );
};

export default NptelSelection;
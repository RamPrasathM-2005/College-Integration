import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole, getUserId } from '../../utils/auth';
import {
  fetchStudentDetails,
  fetchSemesters,
  fetchMandatoryCourses,
  fetchElectiveBuckets,
  allocateElectives,
} from '../../services/studentService';

const ChooseCourse = () => {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [mandatoryCourses, setMandatoryCourses] = useState({ core: [], other: [] });
  const [electiveBuckets, setElectiveBuckets] = useState([]);
  const [selections, setSelections] = useState({});
  const [studentDetails, setStudentDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (getUserRole() !== 'student') {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        const userId = getUserId();

        const studentData = await fetchStudentDetails(userId);
        setStudentDetails(studentData);

        const semesterData = await fetchSemesters(String(studentData.batchYear));
        setSemesters(semesterData);

        const activeSemester = semesterData.find((sem) => sem.isActive === 'YES') || semesterData[0];
        if (activeSemester) {
          setSelectedSemester(activeSemester.semesterId);
        }
      } catch (err) {
        setError('Failed to fetch student data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [navigate]);

  useEffect(() => {
    const fetchCoursesAndBuckets = async () => {
      if (!selectedSemester) return;

      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setSelections({});

        const mandatoryData = await fetchMandatoryCourses(selectedSemester);
        setMandatoryCourses(mandatoryData);

        const bucketsData = await fetchElectiveBuckets(selectedSemester);
        setElectiveBuckets(bucketsData);

        const initialSelections = {};
        bucketsData.forEach((bucket) => {
          initialSelections[bucket.bucketId] = '';
        });
        setSelections(initialSelections);
      } catch (err) {
        setError('Failed to fetch courses or buckets');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCoursesAndBuckets();
  }, [selectedSemester]);

  const handleSemesterChange = (e) => {
    setSelectedSemester(e.target.value);
  };

  const handleSelectionChange = (bucketId, courseId) => {
    setSelections((prev) => ({ ...prev, [bucketId]: courseId }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // ✅ Pass 2 arguments: semesterId, selections
      const validSelections = Object.entries(selections)
        .filter(([_, courseId]) => courseId)  // Only include selected courses
        .map(([bucketId, courseId]) => ({
          bucketId: parseInt(bucketId),
          courseId: parseInt(courseId),
        }));

      // ✅ Call with 2 parameters
      await allocateElectives(selectedSemester, validSelections);
      
      setSuccess('Courses allocated successfully!');
      setTimeout(() => navigate('/student/dashboard'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to allocate courses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = () => {
    return Object.values(selections).some((val) => !val);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Choose Courses</h1>

      <div className="mb-6">
        <label htmlFor="semester" className="mr-2 font-medium">Select Semester:</label>
        <select
          id="semester"
          value={selectedSemester}
          onChange={handleSemesterChange}
          className="border rounded-md p-2"
        >
          <option value="">-- Select --</option>
          {semesters.map((sem) => (
            <option key={sem.semesterId} value={sem.semesterId}>
              Semester {sem.semesterNumber} ({sem.startDate} - {sem.endDate})
            </option>
          ))}
        </select>
      </div>

      {selectedSemester && (
        <>
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Core Courses (PCC)</h2>
            {mandatoryCourses.core.length > 0 ? (
              <ul className="list-disc pl-5">
                {mandatoryCourses.core.map((course) => (
                  <li key={course.courseId}>
                    {course.courseCode} - {course.courseTitle} ({course.credits} credits)
                  </li>
                ))}
              </ul>
            ) : (
              <p>No core courses for this semester.</p>
            )}

            <h2 className="text-xl font-semibold mt-6 mb-4">Other Mandatory Courses</h2>
            {mandatoryCourses.other.length > 0 ? (
              <ul className="list-disc pl-5">
                {mandatoryCourses.other.map((course) => (
                  <li key={course.courseId}>
                    {course.courseCode} - {course.courseTitle} ({course.category}, {course.credits} credits)
                  </li>
                ))}
              </ul>
            ) : (
              <p>No other mandatory courses for this semester.</p>
            )}
          </div>

          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Elective Buckets (Select one from each)</h2>
            {electiveBuckets.map((bucket) => (
              <div key={bucket.bucketId} className="mb-4">
                <h3 className="text-lg font-medium">
                  {bucket.bucketName} (Bucket {bucket.bucketNumber})
                </h3>
                <select
                  value={selections[bucket.bucketId] || ''}
                  onChange={(e) => handleSelectionChange(bucket.bucketId, e.target.value)}
                  className="border rounded-md p-2 w-full"
                >
                  <option value="">-- Select Course --</option>
                  {bucket.courses.map((course) => (
                    <option key={course.courseId} value={course.courseId}>
                      {course.courseCode} - {course.courseTitle} ({course.category}, {course.credits} credits)
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled() || loading}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400"
          >
            Submit Selections
          </button>

          {success && <div className="text-green-500 mt-4">{success}</div>}
        </>
      )}
    </div>
  );
};

export default ChooseCourse;
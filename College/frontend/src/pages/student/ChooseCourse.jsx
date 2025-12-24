import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole, getUserId } from '../../utils/auth';
import {
  fetchStudentDetails,
  fetchSemesters,
  fetchElectiveBuckets,
  allocateElectives,
  fetchOecPecProgress, // NEW
} from '../../services/studentService';

const ChooseCourse = () => {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [electiveBuckets, setElectiveBuckets] = useState([]);
  const [selections, setSelections] = useState({});
  const [studentDetails, setStudentDetails] = useState({});
  const [progress, setProgress] = useState(null); // NEW: OEC/PEC progress
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

        // NEW: Fetch global progress
        const prog = await fetchOecPecProgress();
        setProgress(prog);
      } catch (err) {
        setError('Failed to fetch student data. Please try again.');
        console.error('Error fetching student data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [navigate]);

  useEffect(() => {
    const fetchBuckets = async () => {
      if (!selectedSemester) return;

      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setSelections({});

        const bucketsData = await fetchElectiveBuckets(selectedSemester);
        setElectiveBuckets(bucketsData);

        const initialSelections = {};
        bucketsData.forEach((bucket) => {
          initialSelections[bucket.bucketId] = '';
        });
        setSelections(initialSelections);
      } catch (err) {
        setError('Failed to fetch elective buckets. Please try again.');
        console.error('Error fetching buckets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBuckets();
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

      const validSelections = Object.entries(selections)
        .filter(([_, courseId]) => courseId)
        .map(([bucketId, courseId]) => ({
          bucketId: parseInt(bucketId),
          courseId: parseInt(courseId),
        }));

      if (validSelections.length !== electiveBuckets.length) {
        throw new Error('Please select one course from each elective bucket.');
      }

      // NEW: Validate against remaining
      let oecSelected = 0, pecSelected = 0;
      validSelections.forEach(sel => {
        const bucket = electiveBuckets.find(b => b.bucketId === sel.bucketId);
        if (bucket.bucketName.includes('OEC')) oecSelected++;
        if (bucket.bucketName.includes('PEC')) pecSelected++;
      });

      if (oecSelected > progress.remaining.OEC || pecSelected > progress.remaining.PEC) {
        throw new Error('Selection exceeds remaining requirements (check NPTEL fulfillments)');
      }

      await allocateElectives(selectedSemester, validSelections);
      setSuccess('Elective courses allocated successfully!');
      setTimeout(() => navigate('/student/dashboard'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to allocate elective courses. Please try again.');
      console.error('Error allocating electives:', err);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = () => {
    return electiveBuckets.length === 0 || Object.values(selections).some((val) => !val);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-red-500 text-center p-4 bg-red-100 rounded-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Choose Elective Courses</h1>

      {/* NEW: Progress Summary */}
      {progress && (
        <div className="bg-yellow-100 p-4 rounded-lg mb-6">
          <h3 className="font-bold">OEC/PEC Requirements (per your regulation)</h3>
          <p>OEC: {progress.completed.OEC}/{progress.required.OEC} completed ({progress.remaining.OEC} remaining)</p>
          <p>PEC: {progress.completed.PEC}/{progress.required.PEC} completed ({progress.remaining.PEC} remaining)</p>
          {progress.remaining.OEC === 0 && <p className="text-green-600">All OEC fulfilled (possibly by NPTEL)</p>}
          {progress.remaining.PEC === 0 && <p className="text-green-600">All PEC fulfilled (possibly by NPTEL)</p>}
          {(progress.remaining.OEC > 0 || progress.remaining.PEC > 0) && <p className="text-red-600">Select to meet remaining requirements</p>}
        </div>
      )}

      <div className="mb-6">
        <label htmlFor="semester" className="mr-2 font-medium">Select Semester:</label>
        <select
          id="semester"
          value={selectedSemester}
          onChange={handleSemesterChange}
          className="border rounded-md p-2"
        >
          <option value="">-- Select Semester --</option>
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
            <h2 className="text-xl font-semibold mb-4">Elective Buckets (Select one course from each)</h2>
            {electiveBuckets.length > 0 ? (
              electiveBuckets.map((bucket) => (
                <div key={bucket.bucketId} className="mb-4">
                  <h3 className="text-lg font-medium">
                    {bucket.bucketName} (Bucket {bucket.bucketNumber})
                  </h3>
                  {/* NEW: Show alert if slot reduced */}
                  {bucket.alert && <p className="text-red-500">{bucket.alert}</p>}
                  {bucket.requiredSelections > 0 ? (
                    <select
                      value={selections[bucket.bucketId] || ''}
                      onChange={(e) => handleSelectionChange(bucket.bucketId, e.target.value)}
                      className="border rounded-md p-2 w-full mt-2"
                    >
                      <option value="">-- Select Course --</option>
                      {bucket.courses.map((course) => (
                        <option key={course.courseId} value={course.courseId}>
                          {course.courseCode} - {course.courseTitle} ({course.category}, {course.credits} credits)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-500">No selection needed for this bucket</p>
                  )}
                </div>
              ))
            ) : (
              <p>No elective buckets available for this semester.</p>
            )}
          </div>

          {electiveBuckets.length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitDisabled() || loading}
              className={`px-4 py-2 rounded-md text-white ${
                isSubmitDisabled() || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              Submit Elective Selections
            </button>
          )}

          {success && (
            <div className="text-green-500 mt-4 p-4 bg-green-100 rounded-lg">
              {success}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChooseCourse;
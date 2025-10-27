import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole, getUserId } from '../../utils/auth';
import {
  fetchStudentDetails,
  fetchSemesters,
  fetchEnrolledCourses,
  fetchAttendanceSummary,
} from '../../services/studentService';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [courses, setCourses] = useState([]);
  const [studentDetails, setStudentDetails] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!getUserRole() || getUserRole() !== 'student') {
        console.warn('Unauthorized access, redirecting to login');
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        const userId = getUserId();
        if (!userId) {
          throw new Error('User ID not found');
        }

        const studentData = await fetchStudentDetails(userId);
        if (!studentData) {
          throw new Error('No student data returned');
        }
        console.log('Student data:', studentData);
        setStudentDetails(studentData);

        const semesterData = await fetchSemesters(String(studentData.batchYear || ''));
        console.log('Fetched semesters:', semesterData);
        if (!semesterData || semesterData.length === 0) {
          console.warn('No semesters found for batch:', studentData.batchYear);
          setSemesters([]);
          setSelectedSemester('');
        } else {
          setSemesters(semesterData);
          // Only set selectedSemester if not already set
          if (!selectedSemester) {
            const activeSemester = semesterData.find((sem) => sem.isActive === 'YES') || semesterData[0];
            console.log('Active semester:', activeSemester);
            if (activeSemester) {
              setSelectedSemester(activeSemester.semesterId.toString());
              console.log('Set initial selectedSemester:', activeSemester.semesterId);
            } else {
              console.warn('No active semester found');
            }
          }
        }
      } catch (err) {
        console.error('Error in fetchStudentData:', err);
        if (err.response?.status === 401) {
          navigate('/login');
        }
        setError(`Failed to fetch student data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [navigate]); // Removed selectedSemester from dependencies

  useEffect(() => {
    const fetchCoursesAndAttendance = async () => {
      if (!selectedSemester) {
        console.warn('No semester selected, setting courses to empty');
        setCourses([]);
        setAttendanceSummary({});
        return;
      }

      try {
        setLoading(true);
        const userId = getUserId();
        console.log('Fetching courses for userId:', userId, 'semesterId:', selectedSemester);
        if (!userId) {
          throw new Error('User ID not found');
        }

        const coursesData = await fetchEnrolledCourses(userId, selectedSemester);
        console.log('Fetched courses:', coursesData);
        setCourses(coursesData || []);

        const attendanceData = await fetchAttendanceSummary(userId, selectedSemester);
        setAttendanceSummary(attendanceData || {});
      } catch (err) {
        console.error('Error in fetchCoursesAndAttendance:', err);
        if (err.response?.status === 401) {
          navigate('/login');
        }
        setError(
          err.response?.status === 404
            ? 'No courses found for this semester.'
            : `Failed to fetch courses or attendance: ${err.message}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCoursesAndAttendance();
  }, [selectedSemester, navigate]);

  const handleSemesterChange = (e) => {
    const newSemesterId = e.target.value;
    console.log('Dropdown changed, new semesterId:', newSemesterId);
    setSelectedSemester(newSemesterId);
  };

  const handleChooseCourses = () => {
    navigate('/student/choose-course');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  if (!studentDetails) {
    return <div className="text-red-500 text-center">No student data available</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8 text-center">
        Welcome, {studentDetails.regno || 'Student'}!
      </h1>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Student Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Name:</strong> {studentDetails.username || 'N/A'}</p>
          <p><strong>Register Number:</strong> {studentDetails.regno || 'N/A'}</p>
          <p><strong>Department:</strong> {studentDetails.Deptname || 'N/A'}</p>
          <p><strong>Degree:</strong> {studentDetails.degree || 'N/A'}</p>
          <p><strong>Branch:</strong> {studentDetails.branch || 'N/A'}</p>
          <p><strong>Batch:</strong> {studentDetails.batchYear || 'N/A'}</p>
          <p><strong>Email:</strong> {studentDetails.email || 'N/A'}</p>
          <p><strong>Personal Email:</strong> {studentDetails.personal_email || 'N/A'}</p>
          <p><strong>Student Type:</strong> {studentDetails.student_type || 'N/A'}</p>
          <p><strong>Date of Birth:</strong> {studentDetails.date_of_birth || 'N/A'}</p>
          <p><strong>Blood Group:</strong> {studentDetails.blood_group || 'N/A'}</p>
          <p><strong>Gender:</strong> {studentDetails.gender || 'N/A'}</p>
          <p><strong>First Graduate:</strong> {studentDetails.first_graduate || 'N/A'}</p>
          <p><strong>Aadhar Number:</strong> {studentDetails.aadhar_card_no || 'N/A'}</p>
          <p><strong>Mother Tongue:</strong> {studentDetails.mother_tongue || 'N/A'}</p>
          <p><strong>Religion:</strong> {studentDetails.religion || 'N/A'}</p>
          <p><strong>Caste:</strong> {studentDetails.caste || 'N/A'}</p>
          <p><strong>Community:</strong> {studentDetails.community || 'N/A'}</p>
          <p><strong>Seat Type:</strong> {studentDetails.seat_type || 'N/A'}</p>
          <p><strong>Section:</strong> {studentDetails.section || 'N/A'}</p>
          <p><strong>Address:</strong> {`${studentDetails.door_no || ''} ${studentDetails.street || ''}, ${studentDetails.cityID || 'N/A'}, ${studentDetails.districtID || 'N/A'}, ${studentDetails.stateID || 'N/A'}, ${studentDetails.countryID || 'N/A'}, ${studentDetails.pincode || 'N/A'}`}</p>
          <p><strong>Phone:</strong> {studentDetails.personal_phone || 'N/A'}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <label htmlFor="semester" className="mr-2 font-medium">Select Semester:</label>
          <select
            id="semester"
            value={selectedSemester}
            onChange={handleSemesterChange}
            className="border rounded-md p-2"
            disabled={semesters.length === 0}
          >
            {semesters.length === 0 ? (
              <option value="">No semesters available</option>
            ) : (
              semesters.map((sem) => (
                <option key={sem.semesterId} value={sem.semesterId.toString()}>
                  Semester {sem.semesterNumber} ({sem.startDate} - {sem.endDate})
                </option>
              ))
            )}
          </select>
        </div>
        <button
          onClick={handleChooseCourses}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Choose Courses
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Enrolled Courses</h2>
        {courses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Course Code</th>
                  <th className="px-4 py-2 text-left">Course Title</th>
                  <th className="px-4 py-2 text-left">Section</th>
                  <th className="px-4 py-2 text-left">Instructor</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.courseId} className="border-t">
                    <td className="px-4 py-2">{course.courseCode || 'N/A'}</td>
                    <td className="px-4 py-2">{course.courseName || 'N/A'}</td>
                    <td className="px-4 py-2">{course.section || 'N/A'}</td>
                    <td className="px-4 py-2">{course.staff || 'Not Assigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No courses enrolled for this semester.</p>
        )}
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Attendance Summary</h2>
        {attendanceSummary.totalDays ? (
          <div>
            <p><strong>Total Days:</strong> {attendanceSummary.totalDays}</p>
            <p><strong>Days Present:</strong> {attendanceSummary.daysPresent}</p>
            <p><strong>Attendance Percentage:</strong> {attendanceSummary.percentage}%</p>
          </div>
        ) : (
          <p>No attendance data available for this semester.</p>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
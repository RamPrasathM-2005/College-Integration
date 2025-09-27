import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import useInternalMarks from '../../hooks/useInternalMarks';
import InternalMarksTable from '../../components/tables/InternalMarksTable';

const InternalMarks = () => {
  const { courseId: courseCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const course = location.state?.course ?? { name: courseCode };
  const { students, courseOutcomes, calculateInternalMarks, exportCourseWiseCsv, error, loading } = useInternalMarks(courseCode);

  console.log('InternalMarks - courseCode:', courseCode, 'students:', students, 'courseOutcomes:', courseOutcomes); // Debug log

  const handleExport = async () => {
    try {
      await exportCourseWiseCsv(courseCode);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header Section */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-full text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Internal Marks Overview</h1>
                <p className="text-sm text-gray-600">{course.name}</p>
              </div>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-colors shadow-sm"
              disabled={loading || error}
            >
              <Download className="h-5 w-5 mr-2" /> Export to CSV
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
            Loading marks...
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 rounded-lg shadow-md">
            <strong className="font-semibold">Error: </strong>
            <span>{error}</span>
            <button
              onClick={handleRetry}
              className="ml-4 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
            No students enrolled in this course section.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <InternalMarksTable
              students={students}
              courseOutcomes={courseOutcomes}
              calculateInternalMarks={calculateInternalMarks}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default InternalMarks;
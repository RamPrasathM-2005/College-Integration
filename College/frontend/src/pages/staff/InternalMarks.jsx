import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Search, Filter, User, Hash } from 'lucide-react';
import { ClipLoader } from 'react-spinners';
import useInternalMarks from '../../hooks/useInternalMarks';
import InternalMarksTable from '../../components/tables/InternalMarksTable';

const InternalMarks = () => {
  const { courseId: courseCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const course = location.state?.course ?? { name: courseCode };
  const { students, courseOutcomes, calculateInternalMarks, exportCourseWiseCsv, error, loading } = useInternalMarks(courseCode);
  const [minLoading, setMinLoading] = useState(true);

  // Filter states
  const [regNoTerm, setRegNoTerm] = useState('');
  const [nameTerm, setNameTerm] = useState('');
  const [filterOperator, setFilterOperator] = useState(''); // '', '>', '<', '=', '>=', '<='
  const [filterValue, setFilterValue] = useState('');

  console.log('InternalMarks - courseCode:', courseCode, 'students:', students, 'courseOutcomes:', courseOutcomes, 'loading:', loading);

  // Ensure minimum loading duration of 1.5 seconds for UX
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setMinLoading(false);
      }, 1500); // 1.5 seconds minimum loading
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Compute finalAvg for a student (overall average of all CO marks)
  const computeFinalAvg = (student) => {
    let totalSum = 0;
    let totalCount = courseOutcomes.length;
    courseOutcomes.forEach((co) => {
      const coMark = parseFloat(student.marks?.[co.coId]) || 0;
      totalSum += coMark;
    });
    return totalCount > 0 ? totalSum / totalCount : 0;
  };

  // Compute filtered students
  const filteredStudents = students.filter((student) => {
    const matchesRegNo = !regNoTerm || 
      (student.regno?.toLowerCase().includes(regNoTerm.toLowerCase()) ||
       student.rollnumber?.toLowerCase().includes(regNoTerm.toLowerCase()));

    const matchesName = !nameTerm || 
      student.name?.toLowerCase().includes(nameTerm.toLowerCase());

    const finalAvg = computeFinalAvg(student);
    let matchesFilter = true;

    if (filterOperator && filterValue !== '') {
      const numValue = parseFloat(filterValue);
      if (!isNaN(numValue)) {
        switch (filterOperator) {
          case '>':
            matchesFilter = finalAvg > numValue;
            break;
          case '<':
            matchesFilter = finalAvg < numValue;
            break;
          case '=':
            matchesFilter = Math.abs(finalAvg - numValue) < 0.01; // Approximate equality for floats
            break;
          case '>=':
            matchesFilter = finalAvg >= numValue;
            break;
          case '<=':
            matchesFilter = finalAvg <= numValue;
            break;
          default:
            matchesFilter = true;
        }
      }
    }

    return matchesRegNo && matchesName && matchesFilter;
  });

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

  const clearFilters = () => {
    setRegNoTerm('');
    setNameTerm('');
    setFilterOperator('');
    setFilterValue('');
  };

  if (loading || minLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <ClipLoader
            color="#2563eb"
            loading={true}
            size={50}
            aria-label="Loading Spinner"
            data-testid="loader"
          />
          <p className="mt-4 text-gray-600 text-lg">Loading marks...</p>
        </div>
      </div>
    );
  }

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
              disabled={loading || minLoading || error}
            >
              <Download className="h-5 w-5 mr-2" /> Export to CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Reg No Filter */}
            <div className="flex-1 flex items-center gap-2">
              <Hash className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by Reg No..."
                value={regNoTerm}
                onChange={(e) => setRegNoTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Name Filter */}
            <div className="flex-1 flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by Student Name..."
                value={nameTerm}
                onChange={(e) => setNameTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Marks Filter */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filterOperator}
                onChange={(e) => setFilterOperator(e.target.value)}
                className="px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="=">=</option>
                <option value=">=">&ge;</option>
                <option value="<=">&le;</option>
              </select>
              <input
                type="number"
                placeholder="Mark"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                min="0"
                max="100"
                className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!filterOperator}
              />
            </div>

            {/* Clear Filters Button */}
            {(regNoTerm || nameTerm || filterOperator || filterValue) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Filter Results */}
          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredStudents.length} of {students.length} students
            {regNoTerm && ` | Reg No: "${regNoTerm}"`}
            {nameTerm && ` | Name: "${nameTerm}"`}
            {filterOperator && filterValue && ` | Filter: ${filterOperator} ${filterValue}`}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error ? (
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
        ) : filteredStudents.length === 0 ? (
          <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
            {regNoTerm || nameTerm || filterOperator || filterValue
              ? 'No students match the current filters.'
              : 'No students enrolled in this course section.'}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <InternalMarksTable
              students={filteredStudents}
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
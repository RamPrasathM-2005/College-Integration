import React, { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import StudentFilters from './StudentFilters';
import useManageStudentsData from './hooks/useManageStudentsData';
import useManageStudentsFilters from './hooks/useManageStudentsFilters';
import useManageStudentsHandlers from './hooks/useManageStudentsHandlers';

const ManageStudents = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    degree: '',
    branch: '',
    semester: '',
    batch: '',
  });
  const [pendingAssignments, setPendingAssignments] = useState({});
  const searchInputRef = useRef(null);

  const { students, setStudents, availableCourses, degrees, branches, semesters, batches, isLoading, error, setError } =
    useManageStudentsData(filters);

  const { filteredStudents } = useManageStudentsFilters(students, searchTerm);

  const { assignStaff, unenroll, applyToAll, saveAllAssignments } = useManageStudentsHandlers(
    students,
    availableCourses,
    setStudents,
    pendingAssignments,
    setPendingAssignments,
    setError
  );

  useEffect(() => {
    console.log('Initial searchTerm on mount:', searchTerm);
    setSearchTerm('');
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      console.log('Search input cleared via ref:', searchInputRef.current.value);
    }
    if (localStorage.getItem('searchTerm')) {
      console.warn('Found searchTerm in localStorage:', localStorage.getItem('searchTerm'));
      localStorage.removeItem('searchTerm');
    }
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('search')) {
      console.warn('Found search query parameter:', urlParams.get('search'));
      setSearchTerm('');
    }
  }, []);

  useEffect(() => {
    console.log('searchTerm updated:', searchTerm);
    if (searchInputRef.current && searchInputRef.current.value !== searchTerm) {
      searchInputRef.current.value = searchTerm;
      console.log('Sync input value with searchTerm:', searchTerm);
    }
  }, [searchTerm]);

  useEffect(() => {
    console.log('Filters updated:', filters);
    console.log('Available Courses:', availableCourses);
    console.log('Students with Electives:', students.map(s => ({
      rollnumber: s.rollnumber,
      selectedElectiveIds: s.selectedElectiveIds,
    })));
  }, [filters, availableCourses, students]);

  const areRequiredFiltersSelected = filters.branch !== '' && filters.semester !== '' && filters.batch !== '';

  if (!areRequiredFiltersSelected) {
    return (
      <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Students</h1>
          <p className="text-gray-600">Search, filter, and manage student enrollments</p>
        </div>
        <StudentFilters
          filters={filters}
          setFilters={setFilters}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          degrees={degrees}
          branches={branches}
          semesters={semesters}
          batches={batches}
          searchInputRef={searchInputRef}
        />
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-sm">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Please select all required filters (Branch, Semester, Batch) to view students or courses.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Students</h1>
          <p className="text-gray-600">Search, filter, and manage student enrollments</p>
        </div>
        <StudentFilters
          filters={filters}
          setFilters={setFilters}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          degrees={degrees}
          branches={branches}
          semesters={semesters}
          batches={batches}
          searchInputRef={searchInputRef}
        />
        <div className="p-6 text-center">Loading data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Students</h1>
        <p className="text-gray-600">Search, filter, and manage student enrollments</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <StudentFilters
        filters={filters}
        setFilters={setFilters}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        degrees={degrees}
        branches={branches}
        semesters={semesters}
        batches={batches}
        searchInputRef={searchInputRef}
      />

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {(filteredStudents.length > 0 || availableCourses.length > 0) ? (
          <>
            {filteredStudents.length > 0 && (
              <>
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Students ({filteredStudents.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          style={{ width: '140px', minWidth: '140px', position: 'sticky', left: 0, zIndex: 30, background: '#f9fafb' }}
                        >
                          Reg. No
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          style={{ width: '260px', minWidth: '260px', position: 'sticky', left: '140px', zIndex: 30, background: '#f9fafb' }}
                        >
                          Name of the Student
                        </th>
                        {availableCourses.length > 0 ? (
                          availableCourses.map((course) => (
                            <th
                              key={course.courseId}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              style={{ width: '300px', minWidth: '300px' }}
                            >
                              <div className="space-y-2">
                                <div className="truncate" title={course.courseTitle}>
                                  <span className="block font-bold text-gray-900">
                                    {course.courseCode} {['PEC', 'OEC'].includes(course.category) ? '(Elective)' : ''}
                                  </span>
                                  <span className="block text-gray-400 text-xs">{course.courseTitle}</span>
                                </div>
                                <button
                                  onClick={() => applyToAll(course)}
                                  className="w-full py-1.5 px-3 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                                  title="Apply Batch 1 to All"
                                >
                                  Apply to All
                                </button>
                              </div>
                            </th>
                          ))
                        ) : (
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            style={{ width: '300px', minWidth: '300px' }}
                          >
                            No Courses
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                      {filteredStudents.map((student, index) => (
                        <tr key={student.rollnumber} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '70px' }}>
                          <td
                            className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                            style={{ width: '140px', minWidth: '140px', position: 'sticky', left: 0, zIndex: 20, background: index % 2 === 0 ? '#fff' : '#f9fafb' }}
                          >
                            {student.rollnumber}
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                            style={{ width: '260px', minWidth: '260px', position: 'sticky', left: '140px', zIndex: 20, background: index % 2 === 0 ? '#fff' : '#f9fafb' }}
                          >
                            <div className="truncate" title={student.name}>
                              {student.name}
                            </div>
                          </td>
                          {availableCourses.length > 0 ? (
                            availableCourses.map((course) => {
                              const enrolled = student.enrolledCourses.find((c) => c.courseId === course.courseId);
                              const selectedStaffId = enrolled ? String(enrolled.staffId) : '';
                              const isElective = ['PEC', 'OEC'].includes(course.category);
                              const canAllocate = !isElective || (student.selectedElectiveIds || []).includes(String(course.courseId));
                              return (
                                <td
                                  key={course.courseId}
                                  className={`px-6 py-4 whitespace-nowrap text-sm ${canAllocate ? 'text-gray-500' : 'text-gray-400 italic'}`}
                                  style={{ width: '300px', minWidth: '300px' }}
                                >
                                  {canAllocate ? (
                                    <select
                                      value={selectedStaffId}
                                      onChange={(e) => {
                                        const staffId = e.target.value;
                                        console.log('Dropdown change:', { rollnumber: student.rollnumber, courseId: course.courseId, staffId });
                                        if (!staffId) {
                                          unenroll(student, course.courseId);
                                        } else {
                                          const section = course.batches.find((b) => String(b.staffId) === String(staffId));
                                          if (section) {
                                            assignStaff(student, course.courseId, section.sectionId, staffId);
                                          } else {
                                            console.warn('Section not found for staffId:', staffId);
                                          }
                                        }
                                      }}
                                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white hover:bg-gray-100 ${isElective ? 'bg-blue-50' : ''}`}
                                    >
                                      <option value="">Not Assigned</option>
                                      {course.batches.map((batch) => (
                                        <option key={batch.sectionId} value={String(batch.staffId)}>
                                          {`${batch.staffName} (${batch.sectionName})`}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="px-6 py-4 text-sm text-gray-400 italic">Not Selected</div>
                                  )}
                                </td>
                              );
                            })
                          ) : (
                            <td
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                              style={{ width: '300px', minWidth: '300px' }}
                            >
                              No courses assigned
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {availableCourses.length > 0 && filteredStudents.length === 0 && (
              <div className="p-4 border-t border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Courses ({availableCourses.length})
                </h2>
                <div className="mt-4">
                  {availableCourses.map((course) => (
                    <div key={course.courseId} className="p-4 border-b border-gray-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-900">
                            {course.courseCode} {['PEC', 'OEC'].includes(course.category) ? '(Elective)' : ''}
                          </span>
                          <span className="block text-gray-400 text-sm">{course.courseTitle}</span>
                        </div>
                        <div>
                          {course.batches.map((batch) => (
                            <div key={batch.sectionId} className="text-sm text-gray-500">
                              {batch.sectionName}: {batch.staffName} (Enrolled: {batch.enrolled || 0}/{batch.capacity || 'N/A'})
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(pendingAssignments).length > 0 && filteredStudents.length > 0 && (
              <div className="p-6 text-center border-t border-gray-200 bg-gray-50">
                <button
                  onClick={saveAllAssignments}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Save All Assignments ({Object.keys(pendingAssignments).length})
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No students or courses found for the selected criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageStudents;
// src/components/ManageStudents.jsx
import React, { useState } from 'react';
import { Users } from 'lucide-react';
import StudentFilters from './StudentFilters';
import useManageStudentsData from './hooks/useManageStudentsData';
import useManageStudentsFilters from './hooks/useManageStudentsFilters';
import useManageStudentsHandlers from './hooks/useManageStudentsHandlers';

const ManageStudents = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    degree: 'BE',
    branch: '',
    semester: '',
    batch: '',
  });
  const [pendingAssignments, setPendingAssignments] = useState({});

  const { students, setStudents, availableCourses, degrees, branches, semesters, batches, isLoading, error, setError } =
    useManageStudentsData(filters);

  const { filteredStudents } = useManageStudentsFilters(students, searchTerm);

  // Pass pendingAssignments along with setPendingAssignments
  const { assignStaff, unenroll, applyToAll, saveAllAssignments } = useManageStudentsHandlers(
    students,
    availableCourses,
    setStudents,
    pendingAssignments, // Added
    setPendingAssignments,
    setError
  );

  if (isLoading) {
    return <div className="p-6 text-center">Loading students...</div>;
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
      />

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Students ({filteredStudents.length})
          </h2>
          {(!filters.branch || !filters.semester || !filters.batch) && (
            <p className="text-sm text-gray-500 mt-1">
              Select a branch, semester, and batch to view the course assignment table.
            </p>
          )}
        </div>
        {filters.branch && filters.semester && filters.batch ? (
          students.length === 0 && availableCourses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No students or courses found for the selected criteria.</p>
            </div>
          ) : (
            <>
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
                      {availableCourses.map((course) => (
                        <th
                          key={course.courseCode}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          style={{ width: '300px', minWidth: '300px' }}
                        >
                          <div className="space-y-2">
                            <div className="truncate" title={course.courseTitle}>
                              <span className="block font-bold text-gray-900">{course.courseCode}</span>
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
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                    {students.length > 0 ? (
                      filteredStudents.map((student, index) => (
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
                          {availableCourses.map((course) => {
                            const enrolled = student.enrolledCourses.find((c) => c.courseCode === course.courseCode);
                            const selectedStaffId = enrolled
                              ? course.batches.find((b) => b.staffId === enrolled.staffId && b.sectionName === enrolled.sectionName)?.staffId || ''
                              : '';
                            return (
                              <td
                                key={course.courseCode}
                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                style={{ width: '300px', minWidth: '300px' }}
                              >
                                <select
                                  value={selectedStaffId}
                                  onChange={(e) => {
                                    const staffId = e.target.value;
                                    if (!staffId) {
                                      unenroll(student, course.courseCode);
                                    } else {
                                      const section = course.batches.find((b) => b.staffId === staffId);
                                      if (section) {
                                        assignStaff(student, course.courseCode, section.sectionId, section.staffId);
                                      }
                                    }
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white hover:bg-gray-100"
                                >
                                  <option value="">Not Assigned</option>
                                  {course.batches.map((batch) => (
                                    <option key={batch.sectionId} value={batch.staffId}>
                                      {`${batch.staffName} (${batch.sectionName})`}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : availableCourses.length > 0 ? (
                      <tr style={{ height: '70px' }}>
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          style={{ width: '140px', minWidth: '140px', position: 'sticky', left: 0, zIndex: 20, background: '#fff' }}
                        ></td>
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          style={{ width: '260px', minWidth: '260px', position: 'sticky', left: '140px', zIndex: 20, background: '#fff' }}
                        ></td>
                        {availableCourses.map((course) => (
                          <td
                            key={course.courseCode}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            style={{ width: '300px', minWidth: '300px' }}
                          >
                            <select
                              value=""
                              onChange={(e) => {
                                const staffId = e.target.value;
                                if (staffId) {
                                  const section = course.batches.find((b) => b.staffId === staffId);
                                  if (section) {
                                    // No student to assign to, so this is a no-op
                                  }
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white hover:bg-gray-100"
                            >
                              <option value="">Not Assigned</option>
                              {course.batches.map((batch) => (
                                <option key={batch.sectionId} value={batch.staffId}>
                                  {`${batch.staffName} (${batch.sectionName})`}
                                </option>
                              ))}
                            </select>
                          </td>
                        ))}
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {students.length === 0 && availableCourses.length > 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No students found for the selected criteria.</p>
                </div>
              )}
              {Object.keys(pendingAssignments).length > 0 && (
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
          )
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>Please select a branch, semester, and batch to display the assignment table.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageStudents;
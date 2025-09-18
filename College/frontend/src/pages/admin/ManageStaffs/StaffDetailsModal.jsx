import React from 'react';
import { X, BookOpen, Users, Edit2, Trash2, UserPlus } from 'lucide-react';

const StaffDetailsModal = ({
  selectedStaff,
  setShowStaffDetailsModal,
  handleViewStudents,
  setSelectedStaffCourse,
  setSelectedSectionId,
  setShowEditBatchModal,
  setOperationFromModal,
  handleRemoveCourse,
  setShowAllocateCourseModal,
}) => {
  return (
    <div className="fixed inset-0 backdrop-blur-md bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{selectedStaff.name}</h2>
            <button
              onClick={() => setShowStaffDetailsModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <X size={24} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm font-semibold text-gray-700">Staff ID</p>
              <p className="text-sm text-gray-600">{selectedStaff.staffId}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Email</p>
              <p className="text-sm text-gray-600">{selectedStaff.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Department</p>
              <p className="text-sm text-gray-600">{selectedStaff.departmentName}</p>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Allocated Courses ({selectedStaff.allocatedCourses.length})
          </h3>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {selectedStaff.allocatedCourses.length > 0 ? (
              selectedStaff.allocatedCourses.map(course => (
                <div
                  key={course.id}
                  className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm">{course.courseCode} - {course.name}</h4>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">
                          Section: {course.batch}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700">
                          Semester: {course.semester}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-purple-700">
                          Batch: {course.year}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleViewStudents(course.courseCode, course.sectionId)}
                        className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border border-indigo-100"
                        title="View Students"
                      >
                        <Users size={12} />
                        View Students
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStaffCourse(course);
                          setSelectedSectionId(course.sectionId);
                          setShowEditBatchModal(true);
                          setOperationFromModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border border-amber-100"
                        title="Edit Section"
                      >
                        <Edit2 size={12} />
                        Edit Section
                      </button>
                      <button
                        onClick={() => handleRemoveCourse(selectedStaff, course.id)}
                        className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border border-red-100"
                        title="Remove Course"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl py-8">
                <div className="text-center">
                  <BookOpen size={32} className="text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-semibold">No courses allocated</p>
                  <p className="text-sm text-gray-500 mt-1">Assign courses to this staff member</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-6">
            <button
              onClick={() => {
                setShowStaffDetailsModal(false);
                setShowAllocateCourseModal(true);
                setOperationFromModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1 w-full justify-center"
            >
              <UserPlus size={16} />
              Allocate Course
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDetailsModal;
import React, { useEffect, useMemo } from 'react';
import { X, BookOpen, Plus, Trash2 } from 'lucide-react';

const AllocateCourseModal = React.memo(({
  selectedStaff,
  setSelectedStaff,
  setShowAllocateCourseModal,
  setSelectedCourse,
  setSelectedSectionId,
  courseSearch,
  setCourseSearch,
  courseFilters,
  setCourseFilters,
  selectedCourse,
  selectedSectionId,
  handleAllocateCourse,
  setShowAddBatchModal,
  setShowStaffDetailsModal,
  operationFromModal,
  getFilteredCourses,
  semesters,
  batches,
  operationLoading,
  handleRemoveCourse,
}) => {
  const semesterOptions = [...new Set(semesters.map(sem => String(sem.semesterNumber)))].filter(sem => sem).sort((a, b) => a - b);
  const batchOptions = [...new Set(semesters.map(sem => sem.batchYears))].filter(batch => batch).sort();

  // Update selectedCourse and selectedSectionId when allocatedCourses or courses change
  useEffect(() => {
    if (selectedCourse) {
      const updatedCourse = getFilteredCourses.find(c => c.courseId === selectedCourse.courseId);
      if (updatedCourse) {
        setSelectedCourse(updatedCourse);
        setSelectedSectionId(updatedCourse.isAllocated ? selectedStaff.allocatedCourses.find(c => c.courseCode === updatedCourse.code)?.sectionId || '' : '');
      } else {
        setSelectedCourse(null);
        setSelectedSectionId('');
      }
    }
  }, [selectedStaff.allocatedCourses, getFilteredCourses, selectedCourse, setSelectedCourse, setSelectedSectionId]);

  // Generate a key for the course list to force re-render when allocatedCourses or courses change
  const courseListKey = useMemo(() => {
    return `${selectedStaff.staffId}-${selectedStaff.allocatedCourses.map(c => `${c.courseCode}-${c.sectionId}`).join('-')}-${getFilteredCourses.map(c => c.courseId).join('-')}`;
  }, [selectedStaff, getFilteredCourses]);

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Allocate Course to {selectedStaff.name}</h2>
            <button
              onClick={() => {
                setShowAllocateCourseModal(false);
                setSelectedCourse(null);
                setSelectedSectionId('');
                setCourseSearch('');
                setCourseFilters({ dept: '', semester: '', batch: '' });
                if (operationFromModal) setShowStaffDetailsModal(true);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              disabled={operationLoading}
            >
              <X size={24} />
            </button>
          </div>
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by course name or code..."
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
              disabled={operationLoading}
            />
          </div>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
              <select
                value={courseFilters.dept}
                onChange={e => setCourseFilters({ ...courseFilters, dept: e.target.value, batch: '' })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                disabled={operationLoading}
              >
                <option value="">All Departments</option>
                {[...new Set(batches.map(batch => batch.branch))].filter(d => d).sort().map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Semester</label>
              <select
                value={courseFilters.semester}
                onChange={e => setCourseFilters({ ...courseFilters, semester: e.target.value, batch: '' })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                disabled={operationLoading}
              >
                <option value="">All Semesters</option>
                {semesterOptions.map(sem => <option key={sem} value={sem}>Semester {sem}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Batch</label>
              <select
                value={courseFilters.batch}
                onChange={e => setCourseFilters({ ...courseFilters, batch: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                disabled={operationLoading}
              >
                <option value="">All Batches</option>
                {batchOptions.map(batch => <option key={batch} value={batch}>{batch}</option>)}
              </select>
            </div>
          </div>
          {selectedCourse && (
            <div className="mb-6">
              <button
                onClick={() => {
                  setShowAllocateCourseModal(false);
                  setShowAddBatchModal(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1 w-full justify-center"
                disabled={operationLoading}
              >
                <Plus size={16} />
                Add New Section
              </button>
            </div>
          )}
          <div key={courseListKey} className="space-y-4 max-h-64 overflow-y-auto mb-6">
            {getFilteredCourses.length > 0 ? (
              getFilteredCourses.map(course => (
                <div
                  key={course.courseId}
                  className={`relative bg-gray-50 p-4 rounded-xl transition-all duration-200 ${
                    selectedCourse?.courseId === course.courseId ? 'border-2 border-indigo-500' : 'border border-gray-100'
                  } ${operationLoading ? 'opacity-50' : 'cursor-pointer hover:bg-gray-100'}`}
                  onClick={() => {
                    if (!operationLoading) {
                      setSelectedCourse(course);
                      setSelectedSectionId(course.isAllocated ? selectedStaff.allocatedCourses.find(c => c.courseCode === course.code)?.sectionId || '' : '');
                    }
                  }}
                >
                  <p className="font-semibold text-gray-900">{course.code || 'N/A'} {course.isAllocated && <BookOpen size={16} className="inline text-green-600" />}</p>
                  <p className="text-sm text-gray-600">{course.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">Semester {course.semester || 'N/A'} • Batch {course.batchYears || 'N/A'} • {course.department || 'N/A'}</p>
                  <p className="text-sm text-gray-500">Available Sections: {course.sections.length > 0 ? course.sections.map(s => s.sectionName).join(', ') : 'None'}</p>
                  {course.isAllocated && (
                    <>
                      <p className="text-sm text-indigo-600">Current Section: {course.currentBatch || 'N/A'}</p>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const staffCourseId = selectedStaff.allocatedCourses.find(c => c.courseCode === course.code)?.id;
                          handleRemoveCourse(selectedStaff, staffCourseId);
                        }}
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                        disabled={operationLoading}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic">No courses available for allocation.</p>
            )}
          </div>
          {selectedCourse && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Select Section for {selectedCourse.code || 'N/A'} {selectedCourse.isAllocated && '(Already Allocated)'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedCourse.sections.length > 0 ? (
                  selectedCourse.sections.map(section => (
                    <button
                      key={section.sectionId}
                      onClick={() => setSelectedSectionId(section.sectionId)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        selectedSectionId === section.sectionId ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                      disabled={operationLoading}
                    >
                      {section.sectionName}
                    </button>
                  ))
                ) : (
                  <p className="text-gray-500 italic">No sections available for this course.</p>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setShowAllocateCourseModal(false);
                setSelectedCourse(null);
                setSelectedSectionId('');
                setCourseSearch('');
                setCourseFilters({ dept: '', semester: '', batch: '' });
                if (operationFromModal) setShowStaffDetailsModal(true);
              }}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-semibold transition-all duration-200"
              disabled={operationLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleAllocateCourse}
              disabled={!selectedCourse || !selectedSectionId || operationLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
            >
              {operationLoading ? 'Processing...' : (selectedCourse?.isAllocated ? 'Update Section' : 'Allocate Course')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AllocateCourseModal;
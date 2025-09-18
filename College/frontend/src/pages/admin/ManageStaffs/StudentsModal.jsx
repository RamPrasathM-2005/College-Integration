import React from 'react';
import { X } from 'lucide-react';

const StudentsModal = ({ selectedCourseCode, selectedCourseStudents, setShowStudentsModal }) => {
  return (
    <div className="fixed inset-0 backdrop-blur-md bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Students Enrolled in {selectedCourseCode}</h2>
          <button
            onClick={() => setShowStudentsModal(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X size={24} />
          </button>
        </div>
        <div className="space-y-4">
          {selectedCourseStudents.length > 0 ? (
            selectedCourseStudents.map(student => (
              <div key={student.rollnumber} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="font-semibold text-gray-900">{student.name || 'Unknown'}</p>
                <p className="text-sm text-gray-600">Roll Number: {student.rollnumber || 'N/A'}</p>
                <p className="text-sm text-gray-500">Batch: {student.batch || 'N/A'}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic">No students enrolled in this course section.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentsModal;
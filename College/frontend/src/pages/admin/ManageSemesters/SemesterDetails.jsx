import React, { useState, useEffect } from 'react';
import { ChevronRight, Plus, BookOpen, Trash2 } from 'lucide-react';
import { branchMap } from './branchMap';
import { toast } from 'react-toastify';
import axios from 'axios';
import CourseCard from './CourseCard';
import CourseForm from './CourseForm';

const API_BASE = 'http://localhost:4000/api/admin';

const SemesterDetails = ({ semester, onBack, onDelete }) => {
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, [semester.semesterId]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/semesters/${semester.semesterId}/courses`);
      setCourses(data.data || []);
    } catch (err) {
      if (err.response?.status !== 404) { // Only toast on non-404 errors (404 means no courses)
        toast.error('Failed to fetch courses');
      }
      setCourses([]); // Treat 404 as empty
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (course) => setEditingCourse(course);
  const handleDelete = async (courseId) => {
    if (window.confirm('Delete this course?')) {
      try {
        await axios.delete(`${API_BASE}/courses/${courseId}`);
        toast.success('Course deleted');
        fetchCourses();
      } catch (err) {
        toast.error('Failed to delete course');
      }
    }
  };

  const displayBranch = branchMap[semester.branch] || semester.branch;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 relative">
        <button onClick={onBack} className="p-2 hover:bg-white rounded-lg">
          <ChevronRight className="w-5 h-5 text-gray-600 transform rotate-180" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-800">{displayBranch} - Semester {semester.semesterNumber}</h2>
          <p className="text-gray-600">Degree: {semester.degree} | Batch: {semester.batch} ({semester.batchYears})</p>
        </div>
        <button onClick={() => onDelete(semester.semesterId)} className="p-2 hover:bg-red-100 rounded">
          <Trash2 className="w-5 h-5 text-red-600" />
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-800">Courses ({courses.length})</h3>
          <button onClick={() => { setShowForm(true); setEditingCourse(null); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Course
          </button>
        </div>
        {loading ? (
          <p>Loading courses...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <CourseCard key={c.courseId} course={c} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
            {courses.length === 0 && (
              <div className="text-center py-8 col-span-full">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No courses added yet</p>
              </div>
            )}
          </div>
        )}
      </div>
      <CourseForm
        isOpen={showForm || !!editingCourse}
        onClose={() => { setShowForm(false); setEditingCourse(null); }}
        semesterId={semester.semesterId}
        course={editingCourse}
        onRefresh={fetchCourses}
      />
    </div>
  );
};

export default SemesterDetails;
import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, Trash2, Edit } from 'lucide-react';
import { branchMap } from './branchMap';
import SemesterUpdateForm from './SemesterUpdateForm';
import axios from 'axios';

// Define the API base URL
const API_BASE = 'http://localhost:4000/api/admin';

const SemesterCard = ({ semester, onClick, onDelete, onEdit, index }) => {
  // State for courses, loading, and error
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  // Fetch courses when component mounts or semester.semesterId changes
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        console.log('Fetching courses for semesterId:', semester.semesterId);
        const response = await axios.get(`${API_BASE}/semesters/${semester.semesterId}/courses`);
        console.log('API response:', response.data);

        // Handle response data
        const fetchedCourses = Array.isArray(response.data.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        setCourses(fetchedCourses);
        setError(null); // Clear any previous errors
        console.log('Courses set to:', fetchedCourses, 'Length:', fetchedCourses.length);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching courses:', err.message, err.response?.status, err.response?.data);
        // Handle 404 with "No active courses found" as a valid case
        if (
          err.response?.status === 404 &&
          err.response?.data?.message.includes('No active courses found')
        ) {
          setCourses([]); // Treat as empty course list
          setError(null); // Clear error
        } else {
          setError('Failed to load courses');
          setCourses([]); // Ensure courses is an empty array on other errors
        }
        setLoading(false);
      }
    };

    if (semester.semesterId) {
      fetchCourses();
    } else {
      console.warn('Invalid semesterId:', semester.semesterId);
      setError('Invalid semester ID');
      setCourses([]);
      setLoading(false);
    }
  }, [semester.semesterId]);

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(semester.semesterId);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    setShowUpdateForm(true);
  };

  const displayBranch = branchMap[semester.branch] || semester.branch;
  const displayDate = semester.startDate;

  return (
    <>
      <div
        onClick={() => onClick(semester)}
        className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group relative"
        style={{ animation: `slideIn 0.6s ease-out ${index * 0.1}s both` }}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">Sem {semester.semesterNumber}</div>
              <div className="text-sm text-blue-600 font-medium">{semester.batch}</div>
            </div>
          </div>

          <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">{displayBranch}</h3>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Degree</span>
              <span className="font-medium text-gray-800">{semester.degree}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Courses</span>
              {loading ? (
                <span className="font-medium text-gray-800">Loading...</span>
              ) : error ? (
                <span className="font-medium text-red-600">{error}</span>
              ) : (
                <span className="font-medium text-gray-800">{courses.length}</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-500">Starts {displayDate}</span>
            <div className="flex gap-2">
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              <button onClick={handleEditClick} className="p-1 hover:bg-blue-100 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit className="w-4 h-4 text-blue-600" />
              </button>
              <button onClick={handleDelete} className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {showUpdateForm && (
        <SemesterUpdateForm
          isOpen={showUpdateForm}
          onClose={() => setShowUpdateForm(false)}
          semester={semester}
          onRefresh={onEdit}
        />
      )}
    </>
  );
};

export default SemesterCard;
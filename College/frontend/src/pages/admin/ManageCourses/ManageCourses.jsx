import React, { useState, useEffect } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../../services/authService.js'; // Adjust path if needed
import Filters from './Filters.jsx';
import CourseCard from './CourseCard.jsx';
import CourseForm from '../ManageSemesters/CourseForm.jsx';
import CourseDetailsModal from './CourseDetailsModal.jsx';
import AddBatchModal from './AddBatchModal.jsx';
import AllocateStaffModal from './AllocateStaffModal.jsx';
import SelectSemesterModal from './SelectSemesterModal.jsx';

const API_BASE = 'http://localhost:4000/api/admin';

const deptNameMap = {
  1: 'Computer Science Engineering',
  2: 'Electronics and Communication Engineering',
  3: 'Mechanical Engineering',
};

const ManageCourses = () => {
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [sections, setSections] = useState({});
  const [fetchingSections, setFetchingSections] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ dept: '', semester: '', name: '', type: '' });
  const [staffSearch, setStaffSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showAllocateStaffModal, setShowAllocateStaffModal] = useState(false);
  const [showCourseDetailsModal, setShowCourseDetailsModal] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [newBatchForm, setNewBatchForm] = useState({ numberOfBatches: 1 });

  const courseTypes = ['THEORY', 'PRACTICAL', 'INTEGRATED', 'EXPERIENTIAL LEARNING'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch semesters
      const semRes = await api.get(`${API_BASE}/semesters`);
      const semestersData = semRes.data.data || [];
      setSemesters(semestersData);

      // Fetch courses for each semester
      let allCourses = [];
      for (const semester of semestersData) {
        try {
          const courseRes = await api.get(`${API_BASE}/semesters/${semester.semesterId}/courses`);
          if (courseRes.data.status === 'success' && Array.isArray(courseRes.data.data)) {
            const semesterCourses = courseRes.data.data.map(course => ({
              ...course,
              semesterDetails: semester,
            }));
            allCourses = [...allCourses, ...semesterCourses];
          }
        } catch (err) {
          const message = err.response?.data?.message || `Failed to fetch courses for semester ${semester.semesterId}`;
          toast.warn(message);
          if (message.includes('Unknown column')) {
            toast.warn('Database configuration issue detected. Please check server settings.');
          }
        }
      }
      allCourses.sort((a, b) => b.courseId - a.courseId);
      setCourses(allCourses);

      // Fetch sections for all courses
      const sectionsData = {};
      for (const course of allCourses) {
        try {
          const sectionRes = await api.get(`${API_BASE}/courses/${course.courseCode}/sections`);
          if (sectionRes.data?.status === 'success' && Array.isArray(sectionRes.data.data)) {
            const batches = sectionRes.data.data.reduce((acc, section) => {
              if (section.sectionName) {
                const normalizedName = section.sectionName.replace('BatchBatch', 'Batch');
                acc[normalizedName] = [];
              }
              return acc;
            }, {});
            sectionsData[String(course.courseId)] = batches;

            const staffRes = await api.get(`${API_BASE}/courses/${course.courseId}/staff`);
            if (staffRes.data?.status === 'success' && Array.isArray(staffRes.data.data)) {
              staffRes.data.data.forEach(alloc => {
                const normalizedName = alloc.sectionName.replace('BatchBatch', 'Batch');
                if (batches[normalizedName]) {
                  batches[normalizedName].push({
                    staffId: alloc.staffId,
                    staffName: alloc.staffName,
                    staffCourseId: alloc.staffCourseId,
                    sectionId: alloc.sectionId,
                    sectionName: normalizedName,
                    departmentId: alloc.departmentId,
                    departmentName: alloc.departmentName || deptNameMap[alloc.departmentId] || 'Unknown',
                  });
                }
              });
            }
          } else {
            sectionsData[String(course.courseId)] = {};
          }
        } catch (err) {
          sectionsData[String(course.courseId)] = {};
          toast.warn(`Failed to fetch sections for course ${course.courseCode}: ${err.response?.data?.message || err.message}`);
        }
      }
      setSections(sectionsData);

      // Fetch staff list
      const usersRes = await api.get(`${API_BASE}/users`);
      let staffData = usersRes.data.data.filter(user => user.departmentId);
      staffData = staffData.map(user => ({
        id: user.staffId || user.userId || user.id,
        name: user.name || user.fullName,
        departmentId: user.departmentId,
        departmentName: deptNameMap[user.departmentId] || user.departmentName || 'Unknown',
      }));
      const uniqueStaff = staffData.filter((staff, index, self) =>
        index === self.findIndex(s => s.id === staff.id)
      );
      setStaffList(uniqueStaff);
      toast.success('Fetched all data successfully');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch data';
      setError(message);
      toast.error(message);
      if (message.includes('Unknown column')) {
        toast.warn('Database configuration issue detected. Please check server settings.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getFilteredStaff = () => {
    return staffList.filter(staff =>
      (staff.name || '').toLowerCase().includes(staffSearch.toLowerCase()) ||
      String(staff.id || '').toLowerCase().includes(staffSearch.toLowerCase()) ||
      (staff.departmentName || '').toLowerCase().includes(staffSearch.toLowerCase())
      );
    };
  const fetchCourseStaff = async (courseId) => {
    setFetchingSections(true);
    try {
      const course = courses.find(c => c.courseId === courseId);
      if (!course) {
        toast.error('Course not found');
        return;
      }

      const sectionRes = await api.get(`${API_BASE}/courses/${course.courseCode}/sections`);
      if (sectionRes.data?.status !== 'success' || !Array.isArray(sectionRes.data.data)) {
        setSections(prev => ({ ...prev, [String(courseId)]: {} }));
        toast.warn('No sections found for this course');
        return;
      }

      const batches = sectionRes.data.data.reduce((acc, section) => {
        if (section.sectionName) {
          const normalizedName = section.sectionName.replace('BatchBatch', 'Batch');
          acc[normalizedName] = [];
        }
        return acc;
      }, {});

      const staffRes = await api.get(`${API_BASE}/courses/${course.courseId}/staff`);
      if (staffRes.data?.status === 'success' && Array.isArray(staffRes.data.data)) {
        staffRes.data.data.forEach(alloc => {
          const normalizedName = alloc.sectionName.replace('BatchBatch', 'Batch');
          if (batches[normalizedName]) {
            batches[normalizedName].push({
              staffId: alloc.staffId,
              staffName: alloc.staffName,
              staffCourseId: alloc.staffCourseId,
              sectionId: alloc.sectionId,
              sectionName: normalizedName,
              departmentId: alloc.departmentId,
              departmentName: alloc.departmentName || deptNameMap[alloc.departmentId] || 'Unknown',
            });
          }
        });
      }

      setSections(prev => ({ ...prev, [String(courseId)]: batches }));
      setSelectedCourse(prev => ({
        ...prev,
        courseId,
        courseCode: course.courseCode,
        allocations: staffRes.data.data || [],
      }));
      toast.success('Fetched course staff successfully');
    } catch (err) {
      const message = err.response?.data?.message || 'Error fetching course staff';
      toast.error(message);
      if (message.includes('Unknown column')) {
        toast.warn('Database configuration issue detected. Please check server settings.');
      }
      setSections(prev => ({ ...prev, [String(courseId)]: {} }));
    } finally {
      setFetchingSections(false);
    }
  };

  const handleAllocateStaff = async (staffId) => {
    await fetchCourseStaff(selectedCourse.courseId);
  };

  const handleDeleteBatch = async (courseCode, sectionName) => {
    await fetchCourseStaff(selectedCourse.courseId);
  };

  const handleDeleteStaff = async (staffCourseId) => {
    await fetchCourseStaff(selectedCourse.courseId);
  };

  const handleEditStaff = (staffCourseId) => {
    const allocation = selectedCourse.allocations.find(a => a.staffCourseId === staffCourseId);
    if (allocation) {
      setSelectedBatch(allocation.sectionName.replace('BatchBatch', 'Batch'));
      setStaffSearch(allocation.staffName);
      setShowAllocateStaffModal(true);
      setShowCourseDetailsModal(false);
    }
  };

  const handleCourseClick = (course) => {
    setSelectedCourse(course);
    setShowCourseDetailsModal(true);
    fetchCourseStaff(course.courseId);
  };

  const handleDeleteCourse = async (courseId) => {
    setCourses(courses.filter(course => course.courseId !== courseId));
  };

  const getCourseTypeColor = (type) => {
    const colors = {
      'THEORY': 'bg-blue-100 text-blue-800',
      'PRACTICAL': 'bg-green-100 text-green-800',
      'INTEGRATED': 'bg-purple-100 text-purple-800',
      'EXPERIENTIAL LEARNING': 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const openCreateModal = () => {
    setSelectedSemesterId('');
    setShowCreateModal(true);
  };

  const handleNextToForm = () => {
    if (!selectedSemesterId) {
      toast.error('Please select a semester');
      return;
    }
    setShowCreateModal(false);
    setShowCourseForm(true);
  };

  const handleAddBatch = async () => {
    await fetchCourseStaff(selectedCourse.courseId);
  };

  const openEditModal = (course) => {
    setSelectedCourse(course);
    setShowEditModal(true);
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  const filteredCourses = courses.filter(course => {
    const { dept, semester, name, type } = filters;
    const semDetails = course.semesterDetails;
    return (
      (!dept || semDetails?.branch === dept) &&
      (!semester || semDetails?.semesterNumber.toString() === semester) &&
      (!name || course.courseTitle.toLowerCase().includes(name.toLowerCase())) &&
      (!type || course.type === type)
    );
  });

  const displayCourses = Object.keys(filters).some(key => filters[key]) ? filteredCourses : courses;

  return (
    <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center">
      <div className="w-full max-w-7xl mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold text-gray-900">Manage Courses</h1>
            <p className="text-gray-600 mt-1">Create, edit, and manage academic courses with batches and staff</p>
          </div>
          <button
            onClick={openCreateModal}
            className="mt-4 sm:mt-0 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg font-semibold"
          >
            <Plus size={20} />
            Add Course
          </button>
        </div>
        <Filters
          filters={filters}
          setFilters={setFilters}
          semesters={semesters}
          courseTypes={courseTypes}
        />
      </div>
      <div className="w-full max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayCourses.map(course => (
          <CourseCard
            key={course.courseId}
            course={course}
            sections={sections}
            getCourseTypeColor={getCourseTypeColor}
            handleCourseClick={handleCourseClick}
            handleDeleteCourse={handleDeleteCourse}
            openEditModal={openEditModal}
          />
        ))}
      </div>
      {displayCourses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-500">Try adjusting your filters or create a new course.</p>
        </div>
      )}
      {showCreateModal && (
        <SelectSemesterModal
          semesters={semesters}
          selectedSemesterId={selectedSemesterId}
          setSelectedSemesterId={setSelectedSemesterId}
          setShowCreateModal={setShowCreateModal}
          handleNextToForm={handleNextToForm}
        />
      )}
      {showCourseForm && (
        <CourseForm
          isOpen={showCourseForm}
          onClose={() => {
            setShowCourseForm(false);
            setSelectedSemesterId('');
            fetchData();
          }}
          semesterId={selectedSemesterId}
          course={null}
          onRefresh={fetchData}
        />
      )}
      {showEditModal && selectedCourse && (
        <CourseForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            fetchData();
          }}
          semesterId={selectedCourse.semesterId}
          course={selectedCourse}
          onRefresh={fetchData}
        />
      )}
      {showAddBatchModal && selectedCourse && (
        <AddBatchModal
          selectedCourse={selectedCourse}
          newBatchForm={newBatchForm}
          setNewBatchForm={setNewBatchForm}
          handleAddBatch={handleAddBatch}
          setShowAddBatchModal={setShowAddBatchModal}
          setShowCourseDetailsModal={setShowCourseDetailsModal}
        />
      )}
      {showCourseDetailsModal && selectedCourse && (
        <CourseDetailsModal
          selectedCourse={selectedCourse}
          sections={sections}
          fetchingSections={fetchingSections}
          setShowCourseDetailsModal={setShowCourseDetailsModal}
          openEditModal={openEditModal}
          setShowAddBatchModal={setShowAddBatchModal}
          handleDeleteBatch={handleDeleteBatch}
          handleEditStaff={handleEditStaff}
          handleDeleteStaff={handleDeleteStaff}
          setSelectedBatch={setSelectedBatch}
          setShowAllocateStaffModal={setShowAllocateStaffModal}
        />
      )}
      {showAllocateStaffModal && selectedCourse && selectedBatch && (
        <AllocateStaffModal
          selectedCourse={selectedCourse}
          selectedBatch={selectedBatch}
          staffSearch={staffSearch}
          setStaffSearch={setStaffSearch}
          getFilteredStaff={getFilteredStaff}
          handleAllocateStaff={handleAllocateStaff}
          setShowAllocateStaffModal={setShowAllocateStaffModal}
          setShowCourseDetailsModal={setShowCourseDetailsModal}
        />
      )}
    </div>
  );
};

export default ManageCourses;
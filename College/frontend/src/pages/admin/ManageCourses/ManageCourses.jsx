import React, { useState, useEffect } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import CourseForm from '../ManageSemesters/CourseForm.jsx';
import Filters from './Filters.jsx';
import CourseCard from './CourseCard';
import CourseDetailsModal from './CourseDetailsModal';
import AddBatchModal from './AddBatchModal';
import AllocateStaffModal from './AllocateStaffModal';
import SelectSemesterModal from './SelectSemesterModal';

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

  const courseTypes = ['THEORY', 'PRACTICAL', 'INTEGRATED', 'PROJECT'];

  useEffect(() => {
    console.log('Courses state:', courses);
    console.log('Sections state:', sections);
  }, [courses, sections]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch semesters
      const semRes = await axios.get(`${API_BASE}/semesters`);
      setSemesters(semRes.data.data || []);

      // Fetch courses
      const courseRes = await axios.get(`${API_BASE}/courses`);
      let allCourses = courseRes.data.data || [];

      // Map semester details to courses
      allCourses = allCourses.map(course => {
        const semester = semRes.data.data.find(s => s.semesterId === course.semesterId);
        return { ...course, semesterDetails: semester };
      });
      allCourses.sort((a, b) => b.courseId - a.courseId);
      setCourses(allCourses);

      // Fetch sections for all courses
      const sectionsData = {};
      for (const course of allCourses) {
        try {
          const sectionRes = await axios.get(`${API_BASE}/courses/${course.courseCode}/sections`);
          console.log(`Section API response for course ${course.courseCode}:`, sectionRes.data);
          if (sectionRes.data?.status === 'success' && Array.isArray(sectionRes.data.data)) {
            const batches = sectionRes.data.data.reduce((acc, section) => {
              if (section.sectionName) {
                const normalizedName = section.sectionName.replace('BatchBatch', 'Batch');
                acc[normalizedName] = [];
              }
              return acc;
            }, {});
            sectionsData[String(course.courseId)] = batches;

            // Fetch staff allocations for each section
            const staffRes = await axios.get(`${API_BASE}/courses/${course.courseId}/staff`);
            console.log(`Staff API response for course ${course.courseId}:`, staffRes.data);
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
                    departmentName: alloc.departmentName,
                  });
                }
              });
            }
          } else {
            sectionsData[String(course.courseId)] = {};
          }
        } catch (err) {
          console.error(`Error fetching sections for course ${course.courseCode}:`, err);
          sectionsData[String(course.courseId)] = {};
        }
      }
      setSections(sectionsData);
      console.log('Initial sections state:', sectionsData);

      // Fetch staff list
      const usersRes = await axios.get(`${API_BASE}/users`);
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
      setError('Failed to fetch data');
      console.error(err);
      toast.error('Error fetching data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredStaff = () => {
    return staffList.filter(staff =>
      staff.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      staff.id.toLowerCase().includes(staffSearch.toLowerCase()) ||
      staff.departmentName.toLowerCase().includes(staffSearch.toLowerCase())
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

      const sectionRes = await axios.get(`${API_BASE}/courses/${course.courseCode}/sections`);
      console.log(`Section API response for course ${course.courseCode}:`, sectionRes.data);
      if (sectionRes.data?.status !== 'success' || !Array.isArray(sectionRes.data.data)) {
        toast.error('Failed to fetch sections or invalid response');
        console.error('Invalid section response:', sectionRes.data);
        setSections(prev => ({ ...prev, [String(courseId)]: {} }));
        return;
      }

      const batches = sectionRes.data.data.reduce((acc, section) => {
        if (section.sectionName) {
          const normalizedName = section.sectionName.replace('BatchBatch', 'Batch');
          acc[normalizedName] = [];
        }
        return acc;
      }, {});
      console.log(`Processed batches for course ${courseId}:`, batches);

      const staffRes = await axios.get(`${API_BASE}/courses/${courseId}/staff`);
      console.log(`Staff API response for course ${courseId}:`, staffRes.data);
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
              departmentName: alloc.departmentName,
            });
          }
        });
      } else {
        toast.error('Failed to fetch staff allocations or invalid response');
        console.error('Invalid staff response:', staffRes.data);
      }

      setSections(prev => {
        const updatedSections = { ...prev, [String(courseId)]: batches };
        console.log('Updated sections state:', updatedSections);
        return updatedSections;
      });
      setSelectedCourse(prev => ({
        ...prev,
        courseId,
        courseCode: course.courseCode,
        allocations: staffRes.data.data || [],
      }));
      toast.success('Fetched course staff successfully');
    } catch (err) {
      console.error('Error fetching course staff or sections:', err.response || err);
      toast.error('Error fetching course staff: ' + (err.response?.data?.message || err.message));
      setSections(prev => ({ ...prev, [String(courseId)]: {} }));
    } finally {
      setFetchingSections(false);
    }
  };

  const handleAllocateStaff = async (staffId) => {
    if (!selectedCourse || !selectedBatch || !staffId) {
      toast.error('Missing course, batch, or staff information');
      console.error('Missing required inputs:', { selectedCourse, selectedBatch, staffId });
      return;
    }

    const staff = staffList.find(s => s.id === staffId);
    if (!staff || !staff.id || !staff.departmentId) {
      toast.error('Staff not found or missing required fields');
      console.error('Staff lookup failed:', { staffId, staffList });
      return;
    }

    const currentSections = sections[String(selectedCourse.courseId)] || {};
    const isStaffAlreadyAllocated = Object.entries(currentSections).some(([sectionName, staffs]) =>
      sectionName !== selectedBatch && staffs.some(s => s.staffId === staffId)
    );
    if (isStaffAlreadyAllocated) {
      toast.error(`Staff ${staff.name} is already allocated to another batch for course ${selectedCourse.courseCode}`);
      return;
    }

    let sectionId = null;
    try {
      const sectionRes = await axios.get(`${API_BASE}/courses/${selectedCourse.courseCode}/sections`);
      if (sectionRes.data?.status !== 'success' || !Array.isArray(sectionRes.data.data)) {
        toast.error('Failed to fetch sections');
        console.error('Section API response:', sectionRes.data);
        return;
      }
      const matchingSection = sectionRes.data.data.find(s => s.sectionName.replace('BatchBatch', 'Batch') === selectedBatch);
      if (!matchingSection || !matchingSection.sectionId) {
        toast.error(`Section ${selectedBatch} not found for course ${selectedCourse.courseCode}`);
        console.error('Section not found:', { selectedBatch, sections: sectionRes.data.data });
        return;
      }
      sectionId = matchingSection.sectionId;
    } catch (err) {
      console.error('Error fetching sections:', err.response || err);
      toast.error('Error fetching section ID: ' + (err.response?.data?.message || err.message));
      return;
    }

    const payload = {
      staffId: staff.id,
      courseCode: selectedCourse.courseCode,
      sectionId,
      departmentId: staff.departmentId,
    };

    try {
      const res = await axios.post(`${API_BASE}/courses/${selectedCourse.courseId}/staff`, payload);
      if (res.status === 201) {
        setShowAllocateStaffModal(false);
        setStaffSearch('');
        await fetchCourseStaff(selectedCourse.courseId);
        setShowCourseDetailsModal(true);
        toast.success('Staff allocated successfully');
      } else {
        toast.error('Failed to allocate staff: ' + (res.data?.message || 'Unknown error'));
        console.error('Allocation failed:', res.data);
      }
    } catch (err) {
      console.error('Error allocating staff:', err.response || err);
      toast.error('Error allocating staff: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteBatch = async (courseCode, sectionName) => {
    if (!courseCode || !sectionName) {
      toast.error('Missing course or section info');
      return;
    }
    if (!confirm(`Delete batch ${sectionName}? This action cannot be undone.`)) return;

    try {
      const res = await axios.delete(`${API_BASE}/courses/${courseCode}/sections/${sectionName}`);
      if (res.status === 200) {
        console.log(`Deleted batch ${sectionName} for course ${courseCode}`);
        await fetchCourseStaff(selectedCourse.courseId);
        toast.success('Batch deleted successfully');
      } else {
        toast.error('Failed to delete batch: ' + (res.data?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error deleting batch:', err.response || err);
      toast.error('Error deleting batch: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteStaff = async (staffCourseId) => {
    if (!confirm('Remove this staff from the batch?')) return;

    try {
      const res = await axios.delete(`${API_BASE}/staff-courses/${staffCourseId}`);
      if (res.status === 200) {
        await fetchCourseStaff(selectedCourse.courseId);
        setShowCourseDetailsModal(true);
        toast.success('Staff removed successfully');
      } else {
        toast.error('Failed to remove staff');
      }
    } catch (err) {
      toast.error('Error removing staff: ' + (err.response?.data?.message || err.message));
    }
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
    if (!confirm('Delete this course?')) return;
    try {
      const res = await axios.delete(`${API_BASE}/courses/${courseId}`);
      if (res.status === 200) {
        await fetchData();
        toast.success('Course deleted successfully');
      } else {
        toast.error('Failed to delete course');
      }
    } catch (err) {
      toast.error('Error deleting course: ' + (err.response?.data?.message || err.message));
    }
  };

  const getCourseTypeColor = (type) => {
    const colors = {
      'THEORY': 'bg-blue-100 text-blue-800',
      'PRACTICAL': 'bg-green-100 text-green-800',
      'INTEGRATED': 'bg-purple-100 text-purple-800',
      'PROJECT': 'bg-orange-100 text-orange-800',
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

  const handleAddBatch = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !newBatchForm.numberOfBatches) {
      toast.error('Missing course or number of batches');
      return;
    }
    const numberOfBatches = parseInt(newBatchForm.numberOfBatches) || 1;
    try {
      const res = await axios.post(`${API_BASE}/courses/${selectedCourse.courseCode}/sections`, {
        numberOfSections: numberOfBatches,
      });
      if (res.status === 201) {
        setShowAddBatchModal(false);
        setNewBatchForm({ numberOfBatches: 1 });
        await fetchCourseStaff(selectedCourse.courseId);
        setShowCourseDetailsModal(true);
        toast.success(`Added ${numberOfBatches} batch${numberOfBatches > 1 ? 'es' : ''} successfully`);
      } else {
        toast.error('Failed to add batches: ' + (res.data?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error adding batches:', err.response || err);
      toast.error('Error adding batches: ' + (err.response?.data?.message || err.message));
    }
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
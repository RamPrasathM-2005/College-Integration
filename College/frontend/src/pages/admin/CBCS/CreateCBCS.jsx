import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Minus,
  GraduationCap,
  Calendar,
  Building,
  Save,
  Zap, 
  Brain,
  Shield // Icon for Degree
} from 'lucide-react';

import { api, getCurrentUser } from '../../../services/authService';

const CreateCBCS = () => {
  // Get current user to use real ID instead of hardcoded 101
  const currentUser = getCurrentUser();

  // State management
  const [filters, setFilters] = useState({
    batchId: '',
    semesterId: '',
    deptId: '',
    degree: '' // Added Degree to filters
  });
  const [courses, setCourses] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [cbcsType, setCbcsType] = useState('FCFS'); // Default to FCFS
  
  // API data states
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingSemesters, setLoadingSemesters] = useState(false);

  // CBCS Type options
  const cbcsTypes = [
    { id: 'FCFS', name: 'First Come First Serve (FCFS)', icon: Zap, description: 'Students select courses on first-come-first-serve basis' },
    { id: 'OPTIMAL', name: 'Optimal Allocation', icon: Brain, description: 'AI-optimized allocation based on preferences and capacity' }
  ];

  // Degree Options (Matching your requirement: Be, BTech)
  const degreeOptions = ["BE", "BTech", "ME", "MTech", "MBA", "MCA"];

  // Fetch batches on component mount
  useEffect(() => {
    const fetchBatches = async () => {
      setLoadingBatches(true);
      try {
        const response = await api.get('/admin/batches');
        const data = response.data;
        if (data.success || data.status === 'success') {
          setBatches(data.batches || data.data || []);
        } else {
          setError('Failed to fetch batches');
          setBatches([]);
        }
      } catch (err) {
        setError('Error fetching batches');
        setBatches([]);
      } finally {
        setLoadingBatches(false);
      }
    };
    
    fetchBatches();
  }, []);

  // Fetch departments on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      setLoadingDepts(true);
      try {
        const response = await api.get('/departments');
        const data = response.data;
        if (data.success || data.status === 'success') {
          const deptList = (data.departments || data.data || []).map(d => ({
            id: d.Deptid || d.id,
            name: d.Deptname || d.name,
            acronym: d.Deptacronym // Backend needs acronym (e.g. "CSE") for branch
          }));
          setDepartments(deptList);
        } else {
          setError('Failed to fetch departments');
          setDepartments([]);
        }
      } catch (err) {
        setError('Error fetching departments');
        setDepartments([]);
      } finally {
        setLoadingDepts(false);
      }
    };
    
    fetchDepartments();
  }, []);

  // Fetch semesters when batch, department, AND degree are selected
  useEffect(() => {
    const fetchSemesters = async () => {
      if (!filters.batchId || !filters.deptId || !filters.degree) {
        setSemesters([]);
        return;
      }
      
      setLoadingSemesters(true);
      try {
        // Map IDs back to string names for the backend logic
        const selectedBatchObj = batches.find(b => (b.batchId || b.id).toString() === filters.batchId.toString());
        const selectedDeptObj = departments.find(d => d.id.toString() === filters.deptId.toString());

        // Using api instance with the specific string parameters the backend requires
        const response = await api.get('/admin/semesters/by-batch-branch', {
          params: {
            batch: selectedBatchObj?.batch,   // e.g. "2021"
            branch: selectedDeptObj?.acronym, // e.g. "CSE"
            degree: filters.degree            // e.g. "BE"
          }
        });

        const data = response.data;
        if (data.success || data.status === 'success') {
          setSemesters(data.semesters || data.data || []);
          setError(''); // Clear error if successful
        } else {
          setError(data.message || 'Failed to fetch semesters');
          setSemesters([]);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching semesters');
        setSemesters([]);
      } finally {
        setLoadingSemesters(false);
      }
    };
    
    fetchSemesters();
  }, [filters.batchId, filters.deptId, filters.degree, batches, departments]);

  // Fetch courses based on filters
  const fetchCourses = async () => {
    if (!filters.batchId || !filters.semesterId || !filters.deptId) {
      setError('Please select all filters');
      return;
    }

    setFetching(true);
    setError('');
    setSuccess('');
    setSelectedCourses({});
    try {
      const response = await api.get('/cbcs/course', {
        params: {
          Deptid: filters.deptId,
          batchId: filters.batchId,
          semesterId: filters.semesterId
        }
      });
      const data = response.data;
      
      if (data.success || data.status === 'success') {
        const courseData = data.courses || data.data;
        setCourses(courseData);
        const initialExpanded = {};
        Object.keys(courseData).forEach(group => {
          initialExpanded[group] = true;
        });
        setExpandedGroups(initialExpanded);
      } else {
        setError('Failed to fetch courses');
        setCourses(null);
      }
    } catch (err) {
      setError('Error fetching courses');
      setCourses(null);
    } finally {
      setFetching(false);
    }
  };

  // Toggle course selection
  const toggleCourseSelection = (bucketName, course) => {
    setSelectedCourses(prev => {
      const key = `${bucketName}-${course.courseId}`;
      const newSelected = { ...prev };
      
      if (newSelected[key]) {
        delete newSelected[key];
      } else {
        newSelected[key] = {
          subject_id: course.courseId,
          name: course.courseTitle,
          bucketName: bucketName,
          staffs: course.sections.flatMap(section => 
            section.staff.map(staff => ({
              sectionId: section.sectionId,
              staff_id: staff.Userid,
              staff_name: staff.userName
            }))
          )
        };
      }
      
      return newSelected;
    });
  };

  // Select all courses in a group
  const selectAllInGroup = (groupName, groupCourses) => {
    setSelectedCourses(prev => {
      const newSelected = { ...prev };
      groupCourses.forEach(course => {
        const key = `${groupName}-${course.courseId}`;
        if (!newSelected[key]) {
          newSelected[key] = {
            subject_id: course.courseId,
            name: course.courseTitle,
            bucketName: groupName,
            staffs: course.sections.flatMap(section => 
              section.staff.map(staff => ({
                sectionId: section.sectionId,
                staff_id: staff.Userid,
                staff_name: staff.userName
              }))
            )
          };
        }
      });
      return newSelected;
    });
  };

  // Deselect all courses in a group
  const deselectAllInGroup = (groupName, groupCourses) => {
    setSelectedCourses(prev => {
      const newSelected = { ...prev };
      groupCourses.forEach(course => {
        const key = `${groupName}-${course.courseId}`;
        delete newSelected[key];
      });
      return newSelected;
    });
  };

  // Check if all courses in group are selected
  const isAllSelectedInGroup = (groupName, groupCourses) => {
    return groupCourses.every(course => 
      selectedCourses[`${groupName}-${course.courseId}`]
    );
  };

  // Toggle group expansion
  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Calculate total students from all selected courses
  const calculateTotalStudents = () => {
    if (!courses || Object.keys(selectedCourses).length === 0) return 0;
    
    let maxStudents = 0;
    Object.keys(selectedCourses).forEach(key => {
      const [bucketName, courseId] = key.split('-');
      const course = courses[bucketName]?.find(c => c.courseId === parseInt(courseId));
      if (course && course.total_students > maxStudents) {
        maxStudents = course.total_students;
      }
    });
    
    return maxStudents > 0 ? maxStudents : 120;
  };

  // Submit CBCS creation
  const submitCBCS = async () => {
    if (Object.keys(selectedCourses).length === 0) {
      setError('Please select at least one course');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        Deptid: parseInt(filters.deptId),
        batchId: parseInt(filters.batchId),
        semesterId: parseInt(filters.semesterId),
        createdBy: currentUser?.Userid || 101, 
        total_students: calculateTotalStudents(),
        type: cbcsType,
        subjects: Object.values(selectedCourses)
      };

      const response = await api.post('/cbcs/create', payload);
      const data = response.data;

      if (data.success || data.status === 'success') {
        setSuccess(`CBCS created successfully with ${cbcsType === 'FCFS' ? 'FCFS' : 'Optimal'} allocation!`);
        setSelectedCourses({});
        setCourses(null);
      } else {
        setError(data.message || 'Failed to create CBCS');
      }
    } catch (err) {
      setError('Error creating CBCS: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Check if course is selected
  const isCourseSelected = (bucketName, courseId) => {
    return !!selectedCourses[`${bucketName}-${courseId}`];
  };

  // Get category badge color
  const getCategoryColor = (category) => {
    const colors = {
      PCC: 'bg-blue-100 text-blue-800 border border-blue-200',
      ESC: 'bg-green-100 text-green-800 border border-green-200',
      EEC: 'bg-purple-100 text-purple-800 border border-purple-200',
      HSMC: 'bg-orange-100 text-orange-800 border border-orange-200',
      OEC: 'bg-pink-100 text-pink-800 border border-pink-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  // Get type badge color
  const getTypeColor = (type) => {
    const colors = {
      THEORY: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
      PRACTICAL: 'bg-red-100 text-red-800 border border-red-200',
      INTEGRATED: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      'EXPERIENTIAL LEARNING': 'bg-teal-100 text-teal-800 border border-teal-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  // Calculate total credits from selected courses
  const calculateTotalCredits = () => {
    if (!courses || Object.keys(selectedCourses).length === 0) return 0;
    
    return Object.keys(selectedCourses).reduce((total, key) => {
      const [bucketName, courseId] = key.split('-');
      const course = courses[bucketName]?.find(c => c.courseId === parseInt(courseId));
      return total + (course?.credits || 0);
    }, 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-indigo-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Create CBCS</h1>
          </div>
          <p className="text-lg text-gray-600">
            Configure Choice Based Credit System for your department
          </p>
        </motion.div>

        {/* Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4"> {/* Increased cols for Degree */}
            
            {/* Degree Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Shield className="inline w-4 h-4 mr-1" />
                Degree
              </label>
              <select
                value={filters.degree}
                onChange={(e) => setFilters({ ...filters, degree: e.target.value, semesterId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <option value="">Select Degree</option>
                {degreeOptions.map(deg => (
                  <option key={deg} value={deg}>{deg}</option>
                ))}
              </select>
            </div>

            {/* Batch Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Batch
              </label>
              <select
                value={filters.batchId}
                onChange={(e) => setFilters({ ...filters, batchId: e.target.value, semesterId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                disabled={loadingBatches}
              >
                <option value="">{loadingBatches ? 'Loading...' : 'Select Batch'}</option>
                {batches.map(batch => (
                  <option key={batch.batchId || batch.id} value={batch.batchId || batch.id}>
                    {batch.batch || batch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="inline w-4 h-4 mr-1" />
                Department
              </label>
              <select
                value={filters.deptId}
                onChange={(e) => setFilters({ ...filters, deptId: e.target.value, semesterId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                disabled={loadingDepts}
              >
                <option value="">{loadingDepts ? 'Loading...' : 'Select Department'}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Semester Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <BookOpen className="inline w-4 h-4 mr-1" />
                Semester
              </label>
              <select
                value={filters.semesterId}
                onChange={(e) => setFilters({ ...filters, semesterId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                disabled={loadingSemesters || !filters.batchId || !filters.deptId || !filters.degree}
              >
                <option value="">
                  {loadingSemesters ? 'Loading...' : 
                   !filters.degree ? 'Select degree first' : 
                   semesters.length === 0 ? 'No Semesters Found' : 'Select Semester'}
                </option>
                {semesters.map(sem => (
                  <option key={sem.semesterId || sem.id} value={sem.semesterId || sem.id}>
                    Semester {sem.semesterNumber || sem.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Get Courses Button */}
            <div className="flex items-end">
              <button
                onClick={fetchCourses}
                disabled={fetching || !filters.semesterId}
                className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors font-medium flex items-center justify-center"
              >
                {fetching ? 'Loading...' : 'Get Courses'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* CBCS Type Selection - Only shown when courses are fetched */}
        {courses && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Select CBCS Allocation Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cbcsTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setCbcsType(type.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      cbcsType === type.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`p-2 rounded-lg mr-3 ${
                        cbcsType === type.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-semibold text-gray-900 mb-1">{type.name}</h4>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                      {cbcsType === type.id && (
                        <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center"
            >
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-800">{error}</span>
            </motion.div>
          )}
          
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center"
            >
              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
              <span className="text-green-800">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button - Only shown when courses are fetched */}
        {courses && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between">
              <div className="flex items-center mb-4 sm:mb-0">
                <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg mr-3">
                  <Save className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Ready to Create CBCS ({cbcsType})
                  </h3>
                  <p className="text-sm text-gray-600">
                    {Object.keys(selectedCourses).length} course(s) selected • 
                    Total Credits: {calculateTotalCredits()} •
                    Total Students: {calculateTotalStudents()}
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setSelectedCourses({})}
                  disabled={Object.keys(selectedCourses).length === 0}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
                >
                  Clear All
                </button>
                <button
                  onClick={submitCBCS}
                  disabled={loading || Object.keys(selectedCourses).length === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors font-medium flex items-center"
                >
                  {loading ? 'Creating...' : <><CheckCircle className="h-4 w-4 mr-2" /> Create CBCS</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Courses Display */}
        <AnimatePresence>
          {courses && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {Object.entries(courses).map(([groupName, groupCourses]) => (
                <motion.div
                  key={groupName}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* Group Header */}
                  <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <div className="flex items-center mb-3 sm:mb-0">
                        <h3 className="text-xl font-semibold text-gray-900 mr-3">
                          {groupName}
                        </h3>
                        <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                          {groupCourses.length} courses
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => isAllSelectedInGroup(groupName, groupCourses) 
                            ? deselectAllInGroup(groupName, groupCourses)
                            : selectAllInGroup(groupName, groupCourses)
                          }
                          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                            isAllSelectedInGroup(groupName, groupCourses)
                              ? 'bg-red-100 text-red-700 border-red-300'
                              : 'bg-green-100 text-green-700 border-green-300'
                          }`}
                        >
                          {isAllSelectedInGroup(groupName, groupCourses) ? 'Deselect All' : 'Select All'}
                        </button>
                        <button
                          onClick={() => toggleGroup(groupName)}
                          className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          {expandedGroups[groupName] ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Group Courses List */}
                  <AnimatePresence>
                    {expandedGroups[groupName] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="divide-y divide-gray-100"
                      >
                        {groupCourses.map((course) => (
                          <div
                            key={course.courseId}
                            className={`p-6 transition-all ${
                              isCourseSelected(groupName, course.courseId)
                                ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                  {course.courseCode} - {course.courseTitle}
                                </h4>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(course.category)}`}>
                                    {course.category}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(course.type)}`}>
                                    {course.type}
                                  </span>
                                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium border border-amber-200">
                                    {course.credits} Credits
                                  </span>
                                </div>

                                {/* Course Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm text-gray-600 mb-3">
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 mr-1" />
                                    {course.totalContactPeriods} hrs/week
                                  </div>
                                  <div className="flex items-center">
                                    <Users className="h-4 w-4 mr-1" />
                                    {course.total_students} students
                                  </div>
                                  <div>
                                    L: {course.lectureHours} | T: {course.tutorialHours} | P: {course.practicalHours}
                                  </div>
                                  <div>
                                    Min: {course.minMark} | Max: {course.maxMark}
                                  </div>
                                  <div>
                                    {course.sections.length} sections
                                  </div>
                                </div>

                                {/* Sections Details */}
                                {course.sections.length > 0 && (
                                  <div className="mt-3">
                                    <h5 className="text-sm font-medium text-gray-700 mb-2">Sections:</h5>
                                    <div className="flex flex-wrap gap-2">
                                      {course.sections.map((section) => (
                                        <div
                                          key={section.sectionId}
                                          className="px-3 py-1 bg-gray-100 rounded-lg text-sm text-gray-700 border border-gray-200"
                                        >
                                          Section {section.sectionName} 
                                          {section.staff.length > 0 && (
                                            <span className="ml-1 text-xs">{section.staff.map((s,index)=>s.userName)}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => toggleCourseSelection(groupName, course)}
                                className={`ml-4 px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                                  isCourseSelected(groupName, course.courseId)
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300'
                                }`}
                              >
                                {isCourseSelected(groupName, course.courseId) ? (
                                  <><Minus className="h-4 w-4 mr-1" /> Remove</>
                                ) : (
                                  <><Plus className="h-4 w-4 mr-1" /> Add</>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!courses && !fetching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses loaded</h3>
            <p className="text-gray-500">Select Degree, Batch, and Department to view available courses</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CreateCBCS;
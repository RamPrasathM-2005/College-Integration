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
  Zap, // For FCFS icon
  Brain // For Optimal icon
} from 'lucide-react';

const CreateCBCS = () => {
  // State management
  const [filters, setFilters] = useState({
    batchId: '',
    semesterId: '',
    deptId: ''
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

  // Fetch batches on component mount
  useEffect(() => {
    const fetchBatches = async () => {
      setLoadingBatches(true);
      try {
        const response = await fetch('http://localhost:4000/api/admin/batches');
        const data = await response.json();
        if (data.success) {
          setBatches(data.batches || []);
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
        const response = await fetch('http://localhost:4000/api/departments');
        const data = await response.json();
        if (data.success) {
          setDepartments(data.departments || []);
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

  // Fetch semesters when batch and department are selected
  useEffect(() => {
    const fetchSemesters = async () => {
      if (!filters.batchId || !filters.deptId) {
        setSemesters([]);
        return;
      }
      
      setLoadingSemesters(true);
      try {
        const response = await fetch(
          `http://localhost:4000/api/admin/semester/by-batch-branch?batchId=${filters.batchId}&branchId=${filters.deptId}`
        );
        const data = await response.json();
        if (data.success) {
          setSemesters(data.semesters || []);
        } else {
          setError('Failed to fetch semesters');
          setSemesters([]);
        }
      } catch (err) {
        setError('Error fetching semesters');
        setSemesters([]);
      } finally {
        setLoadingSemesters(false);
      }
    };
    
    fetchSemesters();
  }, [filters.batchId, filters.deptId]);

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
      const response = await fetch(
        `http://localhost:4000/api/cbcs/course?Deptid=${filters.deptId}&batchId=${filters.batchId}&semesterId=${filters.semesterId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setCourses(data.courses);
        // Initialize expanded state for all groups
        const initialExpanded = {};
        Object.keys(data.courses).forEach(group => {
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
        // Create the subject object with correct structure
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
    
    // Get the maximum total_students from selected courses
    let maxStudents = 0;
    Object.keys(selectedCourses).forEach(key => {
      const [bucketName, courseId] = key.split('-');
      const course = courses[bucketName]?.find(c => c.courseId === parseInt(courseId));
      if (course && course.total_students > maxStudents) {
        maxStudents = course.total_students;
      }
    });
    
    return maxStudents > 0 ? maxStudents : 120; // Fallback to 120 if no student count
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
      // Prepare the payload with correct structure including type
      const payload = {
        Deptid: parseInt(filters.deptId),
        batchId: parseInt(filters.batchId),
        semesterId: parseInt(filters.semesterId),
        createdBy: 101, // This should come from auth context
        total_students: calculateTotalStudents(),
        type: cbcsType, // Add the CBCS type here
        subjects: Object.values(selectedCourses)
      };

      console.log('Submitting CBCS with payload:', payload); // For debugging

      const response = await fetch('http://localhost:4000/api/cbcs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`CBCS created successfully with ${cbcsType === 'FCFS' ? 'FCFS' : 'Optimal'} allocation!`);
        setSelectedCourses({});
        setCourses(null);
      } else {
        setError(data.message || 'Failed to create CBCS');
      }
    } catch (err) {
      setError('Error creating CBCS: ' + err.message);
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Batch Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Batch
              </label>
              <select
                value={filters.batchId}
                onChange={(e) => setFilters({ ...filters, batchId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                disabled={loadingBatches}
              >
                <option value="">{loadingBatches ? 'Loading batches...' : 'Select Batch'}</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
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
                onChange={(e) => setFilters({ ...filters, deptId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                disabled={loadingDepts}
              >
                <option value="">{loadingDepts ? 'Loading departments...' : 'Select Department'}</option>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                disabled={loadingSemesters || !filters.batchId || !filters.deptId}
              >
                <option value="">
                  {loadingSemesters ? 'Loading semesters...' : 
                   !filters.batchId || !filters.deptId ? 'Select batch and dept first' : 
                   'Select Semester'}
                </option>
                {semesters.map(sem => (
                  <option key={sem.id} value={sem.id}>
                    {sem.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Get Courses Button */}
            <div className="flex items-end">
              <button
                onClick={fetchCourses}
                disabled={fetching || !filters.batchId || !filters.semesterId || !filters.deptId}
                className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
              >
                {fetching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  'Get Courses'
                )}
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
                    Ready to Create CBCS ({cbcsType === 'FCFS' ? 'First Come First Serve' : 'Optimal Allocation'})
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
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Clear All
                </button>
                <button
                  onClick={submitCBCS}
                  disabled={loading || Object.keys(selectedCourses).length === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Create CBCS ({cbcsType})
                    </>
                  )}
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
              {/* Course Groups */}
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
                              ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
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

                  {/* Group Courses */}
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
                                <div className="flex items-start justify-between mb-3">
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
                                      <>
                                        <Minus className="h-4 w-4 mr-1" />
                                        Remove
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add
                                      </>
                                    )}
                                  </button>
                                </div>

                                {/* Course Details */}
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

                                {/* Sections */}
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
                                            <span className="ml-1 text-xs">
                                              ({section.staff.length} staff)
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No courses loaded
            </h3>
            <p className="text-gray-500">
              Select batch, semester, and department to view available courses
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CreateCBCS;
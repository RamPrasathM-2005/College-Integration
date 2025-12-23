import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  Users,
  Calendar,
  Building,
  GraduationCap,
  CheckCircle,
  FileSpreadsheet,
  User,
  AlertCircle,
  BookOpen,
  CreditCard,
  Tag,
  BarChart,
  FileText,
  Edit,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
} from 'lucide-react';

const CBCSDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cbcs, setCbcs] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch CBCS details
  const fetchCBCSDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:4000/api/cbcs/cbcs/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setCbcs(data.cbcs);
        // Initialize expanded state for all subjects
        const initialExpanded = {};
        data.cbcs.subjects?.forEach(subject => {
          initialExpanded[subject.cbcs_subject_id] = false;
        });
        setExpandedSubjects(initialExpanded);
      } else {
        setError('Failed to fetch CBCS details');
      }
    } catch (err) {
      setError('Error fetching CBCS details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCBCSDetails();
  }, [id]);

  // Toggle subject expansion
  const toggleSubjectExpansion = (subjectId) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }));
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      INTEGRATED: 'bg-amber-100 text-amber-800 border border-amber-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  // Download Excel file
  const downloadExcel = (cbcs_id) => {
      if(!cbcs_id)
      {
          alert("cbcs id missing");
          return;
      }
      window.location.href = `http://localhost:4000/api/cbcs/${cbcs_id}/download-excel`;
  };

  // Group staff by subject
  const getStaffForSubject = (subjectId) => {
    if (!cbcs?.sectionStaff) return [];
    return cbcs.sectionStaff.filter(staff => staff.cbcs_subject_id === subjectId);
  };

  // Calculate total credits
  const calculateTotalCredits = () => {
    if (!cbcs?.subjects) return 0;
    return cbcs.subjects.reduce((total, subject) => total + (subject.credits || 0), 0);
  };

  // Count subjects by type
  const countSubjectsByType = () => {
    if (!cbcs?.subjects) return {};
    return cbcs.subjects.reduce((acc, subject) => {
      acc[subject.type] = (acc[subject.type] || 0) + 1;
      return acc;
    }, {});
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading CBCS details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !cbcs) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading CBCS</h3>
          <p className="text-gray-600 mb-4">{error || 'CBCS not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center mx-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const subjectTypeCounts = countSubjectsByType();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="flex items-center mb-4 sm:mb-0">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CBCS Details</h1>
                <p className="text-gray-600">ID: #{cbcs.cbcs_id} • {cbcs.DeptName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => downloadExcel(cbcs.cbcs_id)}
                disabled={!cbcs.allocation_excel_path}
                className={`px-4 py-2 rounded-lg font-medium flex items-center ${
                  cbcs.allocation_excel_path
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                } transition-colors`}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Excel
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } transition-colors`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('subjects')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'subjects'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } transition-colors`}
              >
                Subjects ({cbcs.subjects?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('staff')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'staff'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } transition-colors`}
              >
                Staff Allocation
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'students'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } transition-colors`}
              >
                Students ({cbcs.total_students || 0})
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <GraduationCap className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Subjects</p>
                <p className="text-2xl font-bold text-gray-900">{cbcs.subjects?.length || 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Credits</p>
                <p className="text-2xl font-bold text-gray-900">{calculateTotalCredits()}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center">
              <div className="bg-purple-100 p-3 rounded-lg mr-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{cbcs.total_students || 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-lg mr-4 ${
                cbcs.type === 'FCFS' ? 'bg-amber-100' : 'bg-indigo-100'
              }`}>
                <Tag className={`h-6 w-6 ${
                  cbcs.type === 'FCFS' ? 'text-amber-600' : 'text-indigo-600'
                }`} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Allocation Type</p>
                <p className="text-lg font-bold text-gray-900">{cbcs.type}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Building className="inline w-4 h-4 mr-1" />
                        Department
                      </label>
                      <p className="text-gray-900 font-medium">{cbcs.DeptName}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="inline w-4 h-4 mr-1" />
                        Batch
                      </label>
                      <p className="text-gray-900 font-medium">{cbcs.batch}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <GraduationCap className="inline w-4 h-4 mr-1" />
                        Semester
                      </label>
                      <p className="text-gray-900 font-medium">Semester {cbcs.semesterNumber}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          cbcs.complete === 'YES' 
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {cbcs.complete === 'YES' ? 'Complete' : 'In Progress'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          cbcs.isActive === 'YES'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {cbcs.isActive === 'YES' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Allocation Type
                      </label>
                      <p className={`px-3 py-1 rounded-lg inline-block text-sm font-medium ${
                        cbcs.type === 'FCFS'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}>
                        {cbcs.type}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <FileSpreadsheet className="inline w-4 h-4 mr-1" />
                        Allocation File
                      </label>
                      <div className="flex items-center">
                        {cbcs.allocation_excel_path ? (
                          <>
                            <FileText className="h-5 w-5 text-green-600 mr-2" />
                            <span className="text-sm text-gray-600">Available</span>
                            <button
                              onClick={downloadExcel}
                              className="ml-2 text-sm text-blue-600 hover:text-blue-800"
                            >
                              Download
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-gray-500">No file uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-green-100 p-2 rounded-lg mr-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Created</p>
                        <p className="text-sm text-gray-600">{formatDate(cbcs.createdDate)}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-600">
                      By: {cbcs.createdByName || `User ${cbcs.createdBy}`}
                    </span>
                  </div>
                  {cbcs.updatedDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="bg-blue-100 p-2 rounded-lg mr-3">
                          <Edit className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Last Updated</p>
                          <p className="text-sm text-gray-600">{formatDate(cbcs.updatedDate)}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-600">
                        By: {cbcs.updatedByName || `User ${cbcs.updatedBy}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subject Type Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Subject Distribution</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(subjectTypeCounts).map(([type, count]) => (
                    <div key={type} className="text-center p-4 border border-gray-200 rounded-lg">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
                        getTypeColor(type).split(' ')[0]
                      }`}>
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                      <p className="text-sm text-gray-600">{type}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Subjects List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Subjects ({cbcs.subjects?.length || 0})
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {calculateTotalCredits()} Total Credits
                    </span>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {cbcs.subjects?.map((subject) => {
                  const staffAllocations = getStaffForSubject(subject.cbcs_subject_id);
                  const isExpanded = expandedSubjects[subject.cbcs_subject_id];
                  
                  return (
                    <div key={subject.cbcs_subject_id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                {subject.courseCode} - {subject.courseTitle}
                              </h4>
                              <div className="flex flex-wrap gap-2 mb-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(subject.category)}`}>
                                  {subject.category}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(subject.type)}`}>
                                  {subject.type}
                                </span>
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium border border-amber-200">
                                  {subject.credits} Credits
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium border border-gray-200">
                                  {subject.bucketName}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleSubjectExpansion(subject.cbcs_subject_id)}
                              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5" />
                              ) : (
                                <ChevronDown className="h-5 w-5" />
                              )}
                            </button>
                          </div>

                          {/* Staff Allocation Preview */}
                          {staffAllocations.length > 0 && (
                            <div className="mb-3">
                              <p className="text-sm text-gray-600 mb-2">
                                <Users className="inline h-4 w-4 mr-1" />
                                Staff Allocated: {staffAllocations.length} sections
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {staffAllocations.slice(0, 3).map((staff, index) => (
                                  <span
                                    key={index}
                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs border border-gray-200"
                                  >
                                    {staff.sectionName}: {staff.staffName}
                                  </span>
                                ))}
                                {staffAllocations.length > 3 && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                    +{staffAllocations.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 pt-4 border-t border-gray-200"
                              >
                                <h5 className="font-medium text-gray-900 mb-3">Section-wise Staff Allocation</h5>
                                {staffAllocations.length > 0 ? (
                                  <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {staffAllocations.map((staff) => (
                                        <div key={staff.id} className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
                                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                                            <User className="h-4 w-4 text-blue-600" />
                                          </div>
                                          <div className="flex-1">
                                            <p className="font-medium text-gray-900">{staff.staffName}</p>
                                            <p className="text-sm text-gray-600">Section {staff.sectionName}</p>
                                          </div>
                                          <span className="text-xs text-gray-500">ID: {staff.staffId}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 text-sm">No staff allocated for this subject</p>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Staff Allocation Tab */}
        {activeTab === 'staff' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Staff List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">
                  Staff Allocation ({cbcs.sectionStaff?.length || 0} allocations)
                </h3>
              </div>
              <div className="p-6">
                {cbcs.sectionStaff?.length > 0 ? (
                  <div className="space-y-4">
                    {cbcs.sectionStaff.map((allocation) => {
                      const subject = cbcs.subjects?.find(s => s.cbcs_subject_id === allocation.cbcs_subject_id);
                      return (
                        <div key={allocation.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                                  <User className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900">{allocation.staffName}</h4>
                                  <p className="text-sm text-gray-600">Staff ID: {allocation.staffId}</p>
                                </div>
                              </div>
                              <div className="ml-13">
                                <div className="mb-2">
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Subject:</span>{' '}
                                    {subject ? `${subject.courseCode} - ${subject.courseTitle}` : 'Unknown Subject'}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                    Section: {allocation.sectionName}
                                  </span>
                                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                                    Subject ID: {allocation.cbcs_subject_id}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No staff allocations found</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Student Management */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Students ({cbcs.total_students || 0})
                  </h3>
                  <div className="flex items-center space-x-3">
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center">
                      <Download className="h-4 w-4 mr-2" />
                      Export List
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center">
                      <UserCheck className="h-4 w-4 mr-2" />
                      Pending Student Download
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {/* Student Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-blue-100 p-3 rounded-lg mr-4">
                        <UserCheck className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Registered Students</p>
                        <p className="text-2xl font-bold text-gray-900">0</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-amber-100 p-3 rounded-lg mr-4">
                        <UserX className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Pending Allocation</p>
                        <p className="text-2xl font-bold text-gray-900">{cbcs.total_students || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-gray-100 p-3 rounded-lg mr-4">
                        <BarChart className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Average Subjects/Student</p>
                        <p className="text-2xl font-bold text-gray-900">0</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Student List Placeholder */}
                
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CBCSDetails;
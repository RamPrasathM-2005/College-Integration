import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  Building,
  GraduationCap,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Clock,
  User,
  AlertCircle,
  MoreVertical,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

const CBCSList = () => {
  const [cbcsList, setCbcsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    department: 'all',
    status: 'all',
    batch: 'all'
  });
  const [selectedCBCS, setSelectedCBCS] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  // Mock departments (you can fetch these from API)
  const departments = [
    { id: 1, name: 'Computer Science Engineering' },
    { id: 2, name: 'Electronics Engineering' },
    { id: 3, name: 'Mechanical Engineering' },
    { id: 4, name: 'Civil Engineering' }
  ];

  // Mock batches (you can fetch these from API)
  const batches = [
    { id: 1, name: '2023-2027' },
    { id: 2, name: '2022-2026' },
    { id: 3, name: '2021-2025' }
  ];

  // Fetch CBCS list
  const fetchCBCSList = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:4000/api/cbcs/getcbcs');
      const data = await response.json();
      
      if (data.success) {
        setCbcsList(data.data);
      } else {
        setError('Failed to fetch CBCS data');
      }
    } catch (err) {
      setError('Error fetching CBCS data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCBCSList();
  }, []);

  // Filter and search function
  const filteredCBCS = cbcsList.filter(cbcs => {
    const matchesSearch = 
      cbcs.DeptName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cbcs.batch?.toString().includes(searchTerm) ||
      cbcs.cbcs_id?.toString().includes(searchTerm);

    const matchesDepartment = filters.department === 'all' || 
      cbcs.Deptid?.toString() === filters.department;

    const matchesStatus = filters.status === 'all' || 
      cbcs.complete?.toLowerCase() === filters.status.toLowerCase();

    const matchesBatch = filters.batch === 'all' || 
      cbcs.batchId?.toString() === filters.batch;

    return matchesSearch && matchesDepartment && matchesStatus && matchesBatch;
  });

  // Toggle row expansion
  const toggleRowExpansion = (cbcsId) => {
    setExpandedRows(prev => ({
      ...prev,
      [cbcsId]: !prev[cbcsId]
    }));
  };

  // View CBCS details
  const viewCBCSDetails = (cbcs) => {
    setSelectedCBCS(cbcs);
    setShowDetails(true);
  };

  // Download allocation excel
  const downloadExcel = (cbcs_id) => {
    if (!cbcs_id) 
    {
        alert("CBCS ID missing");
        return;
    }
    window.location.href = `http://localhost:4000/api/cbcs/${cbcs_id}/download-excel`;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Status badge component
  const StatusBadge = ({ status, isActive }) => (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status === 'YES' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
        {status === 'YES' ? 'Complete' : 'In Progress'}
      </span>
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${isActive === 'YES' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
        {isActive === 'YES' ? 'Active' : 'Inactive'}
      </span>
    </div>
  );

  // Stats cards
  const stats = [
    {
      title: 'Total CBCS',
      value: cbcsList.length,
      icon: GraduationCap,
      color: 'bg-blue-500'
    },
    {
      title: 'Active',
      value: cbcsList.filter(c => c.isActive === 'YES').length,
      icon: CheckCircle,
      color: 'bg-green-500'
    },
    {
      title: 'Complete',
      value: cbcsList.filter(c => c.complete === 'YES').length,
      icon: FileSpreadsheet,
      color: 'bg-purple-500'
    },
    {
      title: 'Students',
      value: cbcsList.reduce((sum, cbcs) => sum + (cbcs.total_students || 0), 0),
      icon: Users,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">CBCS Management</h1>
              <p className="text-gray-600">Manage and monitor Choice Based Credit System allocations</p>
            </div>
            <button
              onClick={fetchCBCSList}
              className="mt-4 sm:mt-0 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors font-medium flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-center">
                    <div className={`${stat.color} p-3 rounded-lg mr-4`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="inline w-4 h-4 mr-1" />
                Search CBCS
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by department, batch, or ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="inline w-4 h-4 mr-1" />
                Department
              </label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="YES">Complete</option>
                <option value="NO">In Progress</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Error Message */}
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
        </AnimatePresence>

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          /* CBCS List Table */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  CBCS List ({filteredCBCS.length})
                </h3>
                <div className="text-sm text-gray-600">
                  Showing {filteredCBCS.length} of {cbcsList.length} entries
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CBCS ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch & Semester
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCBCS.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <GraduationCap className="mx-auto h-12 w-12 mb-4 text-gray-400" />
                          <p className="text-lg font-medium mb-2">No CBCS found</p>
                          <p className="text-sm">Try adjusting your search or filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCBCS.map((cbcs) => (
                      <React.Fragment key={cbcs.cbcs_id}>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              #{cbcs.cbcs_id}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <Building className="h-4 w-4 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {cbcs.DeptName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-900">
                                  {cbcs.batch}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <GraduationCap className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-600">
                                  Semester {cbcs.semesterNumber}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <StatusBadge 
                                status={cbcs.complete} 
                                isActive={cbcs.isActive} 
                              />
                              <div className="flex items-center text-sm text-gray-600">
                                <Users className="h-4 w-4 mr-1" />
                                {cbcs.total_students} students
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {formatDate(cbcs.createdDate)}
                            </div>
                            <div className="text-sm text-gray-500">
                              By: {cbcs.createdByName || `User ${cbcs.createdBy}`}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => viewCBCSDetails(cbcs)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => downloadExcel(cbcs.cbcs_id)}
                                disabled={!cbcs.allocation_excel_path}
                                className={`p-2 rounded-lg transition-colors ${
                                  cbcs.allocation_excel_path
                                    ? 'text-green-600 hover:bg-green-50'
                                    : 'text-gray-400 cursor-not-allowed'
                                }`}
                                title="Download Excel"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => toggleRowExpansion(cbcs.cbcs_id)}
                                className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                title="More Details"
                              >
                                {expandedRows[cbcs.cbcs_id] ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded Row */}
                        <AnimatePresence>
                          {expandedRows[cbcs.cbcs_id] && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <td colSpan="6" className="px-6 py-4 bg-gray-50">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900 flex items-center">
                                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                                      Allocation File
                                    </h4>
                                    <div className="text-sm text-gray-600">
                                      {cbcs.allocation_excel_path ? (
                                        <button
                                          onClick={() => downloadExcel(cbcs.allocation_excel_path)}
                                          className="text-blue-600 hover:text-blue-800 flex items-center"
                                        >
                                          <Download className="h-4 w-4 mr-1" />
                                          Download Excel
                                        </button>
                                      ) : (
                                        <span className="text-gray-500">No file uploaded</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900 flex items-center">
                                      <Clock className="h-4 w-4 mr-2" />
                                      Last Updated
                                    </h4>
                                    <div className="text-sm text-gray-600">
                                      {cbcs.updatedDate 
                                        ? formatDate(cbcs.updatedDate)
                                        : 'Never updated'}
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900 flex items-center">
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Quick Actions
                                    </h4>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => viewCBCSDetails(cbcs)}
                                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                      >
                                        View Full Details
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* CBCS Details Modal */}
      <AnimatePresence>
        {showDetails && selectedCBCS && (
          <CBCSDetails 
            cbcs={selectedCBCS} 
            onClose={() => setShowDetails(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// CBCS Details Component
const CBCSDetails = ({ cbcs, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        // Fetch detailed CBCS information
        // You'll need to implement this API endpoint
        const response = await fetch(`http://localhost:4000/api/cbcs/getcbcs/${cbcs.cbcs_id}`);
        const data = await response.json();
        if (data.success) {
          setDetails(data.data);
        } else {
          setError('Failed to fetch details');
        }
      } catch (err) {
        setError('Error fetching details: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [cbcs.cbcs_id]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <GraduationCap className="h-6 w-6 text-white mr-2" />
                <h3 className="text-lg font-semibold text-white">
                  CBCS #{cbcs.cbcs_id} - Detailed View
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
                <p className="text-red-600">{error}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Building className="h-5 w-5 mr-2" />
                      Department Information
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-600">Department:</span>
                        <p className="font-medium">{cbcs.DeptName}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Department ID:</span>
                        <p className="font-medium">{cbcs.Deptid}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Calendar className="h-5 w-5 mr-2" />
                      Academic Information
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-600">Batch:</span>
                        <p className="font-medium">{cbcs.batch}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Semester:</span>
                        <p className="font-medium">Semester {cbcs.semesterNumber}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status & Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Status</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${cbcs.complete === 'YES' ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <span className="text-sm">
                          {cbcs.complete === 'YES' ? 'Complete' : 'In Progress'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${cbcs.isActive === 'YES' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                        <span className="text-sm">
                          {cbcs.isActive === 'YES' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">Students</h4>
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-green-600 mr-3" />
                      <div>
                        <p className="text-2xl font-bold text-green-900">{cbcs.total_students}</p>
                        <p className="text-sm text-green-700">Total Students</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-2">Allocation File</h4>
                    {cbcs.allocation_excel_path ? (
                      <div className="flex items-center">
                        <FileSpreadsheet className="h-8 w-8 text-purple-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-purple-900">Excel File Available</p>
                          <button
                            onClick={() => {
                              // Download logic here
                            }}
                            className="text-sm text-purple-600 hover:text-purple-800"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No allocation file</p>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Timeline</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Created On</span>
                      <span className="text-sm font-medium">{formatDate(cbcs.createdDate)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Created By</span>
                      <span className="text-sm font-medium">{cbcs.createdByName || `User ${cbcs.createdBy}`}</span>
                    </div>
                    {cbcs.updatedDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Last Updated</span>
                        <span className="text-sm font-medium">{formatDate(cbcs.updatedDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Details from API */}
                {details && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Additional Information</h4>
                    <pre className="text-sm bg-gray-50 p-3 rounded overflow-x-auto">
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
            <button
              onClick={() => {
                // Download Excel logic
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CBCSList;
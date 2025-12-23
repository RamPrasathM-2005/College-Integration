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
import { api } from '../../../services/authService';

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

  // Fetch CBCS list using api instance
  const fetchCBCSList = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/cbcs/getcbcs');
      const data = response.data;
      
      if (data.success || data.status === 'success') {
        // Handle both data.data or data.data depending on your API structure
        setCbcsList(data.data || []);
      } else {
        setError('Failed to fetch CBCS data');
      }
    } catch (err) {
      setError('Error fetching CBCS data: ' + (err.response?.data?.message || err.message));
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

  // Download allocation excel using the api instance base URL
  const downloadExcel = (cbcs_id) => {
    if (!cbcs_id) {
        alert("CBCS ID missing");
        return;
    }
    // Note: window.location.href won't send auth headers. 
    // If your backend requires a token for downloads, you usually need a specialized endpoint 
    // or a temporary signed URL. Here we use the direct URL based on the API base.
    const downloadUrl = `${api.defaults.baseURL}/cbcs/${cbcs_id}/download-excel`;
    window.open(downloadUrl, '_blank');
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

  // Status badge component
  const StatusBadge = ({ status, isActive }) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status === 'YES' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
        {status === 'YES' ? 'Complete' : 'In Progress'}
      </span>
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isActive === 'YES' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-gray-100 text-gray-800 border border-gray-200'}`}>
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
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">CBCS Management</h1>
              <p className="text-gray-600">Manage and monitor Choice Based Credit System allocations</p>
            </div>
            <button
              onClick={fetchCBCSList}
              className="mt-4 sm:mt-0 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all font-medium flex items-center justify-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
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
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center">
                    <div className={`${stat.color} p-3 rounded-xl mr-4 shadow-inner`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Search and Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Search className="inline w-4 h-4 mr-2 text-indigo-500" />
                Quick Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by department, batch, or ID..."
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                />
                <Search className="absolute left-4 top-3 h-5 w-5 text-gray-400" />
              </div>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Building className="inline w-4 h-4 mr-2 text-indigo-500" />
                Department
              </label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-2 text-indigo-500" />
                Process Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              >
                <option value="all">All Status</option>
                <option value="YES">Complete</option>
                <option value="NO">In Progress</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Global Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-center shadow-sm"
            >
              <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
              <span className="text-red-800 font-medium">{error}</span>
              <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
                <XCircle className="h-5 w-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-indigo-600"></div>
            <p className="text-gray-500 font-medium animate-pulse">Syncing CBCS Data...</p>
          </div>
        ) : (
          /* Table Container */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* Table Meta Info */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center">
                Allocation Registry
                <span className="ml-3 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-xs font-bold">
                  {filteredCBCS.length} records
                </span>
              </h3>
            </div>

            {/* Scrollable Table Content */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Department</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Acad. Context</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Audit Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Metadata</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredCBCS.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center">
                          <div className="bg-gray-100 p-4 rounded-full mb-4">
                            <GraduationCap className="h-10 w-10 text-gray-400" />
                          </div>
                          <p className="text-lg font-bold text-gray-900">No Registry Found</p>
                          <p className="text-gray-500 text-sm">No CBCS records match your current search criteria.</p>
                          <button 
                            onClick={() => {setSearchTerm(''); setFilters({department:'all', status:'all', batch:'all'})}}
                            className="mt-4 text-indigo-600 font-bold hover:underline"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCBCS.map((cbcs) => (
                      <React.Fragment key={cbcs.cbcs_id}>
                        <tr className={`hover:bg-indigo-50/30 transition-colors ${expandedRows[cbcs.cbcs_id] ? 'bg-indigo-50/20' : ''}`}>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                              #{cbcs.cbcs_id}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center">
                              <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                                <Building className="h-4 w-4 text-gray-500" />
                              </div>
                              <div className="text-sm font-bold text-gray-900 leading-tight">
                                {cbcs.DeptName}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="space-y-1">
                              <div className="flex items-center text-sm font-semibold text-gray-700">
                                <Calendar className="h-3.5 w-3.5 text-gray-400 mr-2" />
                                {cbcs.batch}
                              </div>
                              <div className="flex items-center text-xs text-gray-500">
                                <GraduationCap className="h-3.5 w-3.5 text-gray-400 mr-2" />
                                Semester {cbcs.semesterNumber}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="space-y-2">
                              <StatusBadge status={cbcs.complete} isActive={cbcs.isActive} />
                              <div className="flex items-center text-xs font-medium text-gray-500">
                                <Users className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
                                {cbcs.total_students} Candidates
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-xs font-bold text-gray-800">
                              {formatDate(cbcs.createdDate)}
                            </div>
                            <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center mt-1">
                              <User className="h-3 w-3 mr-1" />
                              {cbcs.createdByName || `UID: ${cbcs.createdBy}`}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => viewCBCSDetails(cbcs)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                title="System Logs & Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => downloadExcel(cbcs.cbcs_id)}
                                disabled={!cbcs.allocation_excel_path}
                                className={`p-2 rounded-lg transition-all ${
                                  cbcs.allocation_excel_path
                                    ? 'text-green-600 hover:bg-green-100 shadow-sm'
                                    : 'text-gray-300 cursor-not-allowed'
                                }`}
                                title="Download Allocation Report"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => toggleRowExpansion(cbcs.cbcs_id)}
                                className={`p-2 rounded-lg transition-all ${expandedRows[cbcs.cbcs_id] ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                              >
                                {expandedRows[cbcs.cbcs_id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expandable Meta Panel */}
                        <AnimatePresence>
                          {expandedRows[cbcs.cbcs_id] && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-indigo-50/30"
                            >
                              <td colSpan="6" className="px-8 py-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                  <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                                      <FileSpreadsheet className="h-4 w-4 mr-2 text-indigo-500" />
                                      Artifact Integrity
                                    </h4>
                                    <div className="text-sm">
                                      {cbcs.allocation_excel_path ? (
                                        <div className="space-y-2">
                                          <p className="text-gray-600 italic truncate text-xs">{cbcs.allocation_excel_path}</p>
                                          <button
                                            onClick={() => downloadExcel(cbcs.cbcs_id)}
                                            className="text-indigo-600 font-bold flex items-center hover:text-indigo-800 transition-colors"
                                          >
                                            <Download className="h-3.5 w-3.5 mr-1.5" />
                                            Fetch Document
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center text-amber-600 font-medium italic">
                                          <AlertCircle className="h-4 w-4 mr-2" />
                                          No document artifact found
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                                      <Clock className="h-4 w-4 mr-2 text-indigo-500" />
                                      Activity Log
                                    </h4>
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-bold uppercase">Last Sync:</span>
                                        <span className="text-gray-800 font-bold">{cbcs.updatedDate ? formatDate(cbcs.updatedDate) : 'Initial Entry'}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 font-bold uppercase">Status:</span>
                                        <span className={`font-bold ${cbcs.complete === 'YES' ? 'text-green-600' : 'text-amber-600'}`}>
                                          {cbcs.complete === 'YES' ? 'Finalized' : 'Draft Mode'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                                      <ExternalLink className="h-4 w-4 mr-2 text-indigo-500" />
                                      Extended Ops
                                    </h4>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => viewCBCSDetails(cbcs)}
                                        className="flex-1 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                                      >
                                        Full Audit Trail
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

      {/* CBCS Details Modal Component */}
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

/* -------------------------------------------------------------------------- */
/*                          CBCS Details Sub-Component                        */
/* -------------------------------------------------------------------------- */
const CBCSDetails = ({ cbcs, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch detailed information using api instance
        const response = await api.get(`/cbcs/getcbcs/${cbcs.cbcs_id}`);
        const data = response.data;
        if (data.success || data.status === 'success') {
          setDetails(data.data);
        } else {
          setError('Failed to fetch entry-level details');
        }
      } catch (err) {
        setError('Error establishing connection: ' + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [cbcs.cbcs_id]);

  const formatDateLong = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Animated Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Surface */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden"
        >
          {/* Top Decorative Header */}
          <div className="bg-indigo-600 px-8 py-6 relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <GraduationCap className="h-32 w-32 text-white" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center">
                <div className="bg-white/20 p-3 rounded-2xl mr-4 backdrop-blur-md">
                  <GraduationCap className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    CBCS Master Record #{cbcs.cbcs_id}
                  </h3>
                  <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest mt-1 opacity-80">
                    System Audit Trail & Logic Detail
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Modal Main Body */}
          <div className="px-8 py-8 max-h-[70vh] overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="flex flex-col justify-center items-center h-80 space-y-4">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600"></div>
                <p className="font-black text-gray-400 uppercase tracking-widest text-sm">Parsing Object Data...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100">
                <AlertCircle className="mx-auto h-16 w-16 text-red-400 mb-4" />
                <h4 className="text-lg font-black text-red-900 mb-2 uppercase">Data Fetch Conflict</h4>
                <p className="text-red-600 max-w-xs mx-auto text-sm">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  Reconnect
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Core Registry Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                    <h4 className="font-black text-gray-900 mb-5 flex items-center uppercase tracking-widest text-xs">
                      <Building className="h-5 w-5 mr-3 text-indigo-500" />
                      Organizational Entity
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-white p-3 rounded-xl shadow-sm">
                        <span className="text-[10px] text-gray-400 font-black uppercase block mb-1">Affiliated Department</span>
                        <p className="font-bold text-gray-900">{cbcs.DeptName}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl shadow-sm">
                        <span className="text-[10px] text-gray-400 font-black uppercase block mb-1">Entity Identifier</span>
                        <p className="font-mono text-sm font-bold text-indigo-600">DEPT_ID: {cbcs.Deptid}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                    <h4 className="font-black text-gray-900 mb-5 flex items-center uppercase tracking-widest text-xs">
                      <Calendar className="h-5 w-5 mr-3 text-indigo-500" />
                      Academic Context
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-white p-3 rounded-xl shadow-sm">
                        <span className="text-[10px] text-gray-400 font-black uppercase block mb-1">Batch Cohort</span>
                        <p className="font-bold text-gray-900">{cbcs.batch}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl shadow-sm">
                        <span className="text-[10px] text-gray-400 font-black uppercase block mb-1">Semester Cycle</span>
                        <p className="font-bold text-gray-900">Academic Semester {cbcs.semesterNumber}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Performance & Status Indicators */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100">
                    <h4 className="font-black text-indigo-900 mb-4 text-[10px] uppercase tracking-widest">Process Logic</h4>
                    <div className="space-y-3">
                      <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow-sm">
                        <div className={`w-2.5 h-2.5 rounded-full mr-3 ${cbcs.complete === 'YES' ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <span className="text-xs font-black uppercase text-gray-700">
                          {cbcs.complete === 'YES' ? 'Allocation Finalized' : 'Allocation Pending'}
                        </span>
                      </div>
                      <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow-sm">
                        <div className={`w-2.5 h-2.5 rounded-full mr-3 ${cbcs.isActive === 'YES' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                        <span className="text-xs font-black uppercase text-gray-700">
                          {cbcs.isActive === 'YES' ? 'Live on Portal' : 'Offline/Archived'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100">
                    <h4 className="font-black text-emerald-900 mb-4 text-[10px] uppercase tracking-widest">Student Census</h4>
                    <div className="flex items-center">
                      <div className="bg-white p-3 rounded-xl shadow-sm mr-4">
                        <Users className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-3xl font-black text-emerald-900 leading-none">{cbcs.total_students}</p>
                        <p className="text-[10px] font-black uppercase text-emerald-600 mt-1">Total Enrollment</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-100">
                    <h4 className="font-black text-purple-900 mb-4 text-[10px] uppercase tracking-widest">Export Artifacts</h4>
                    {cbcs.allocation_excel_path ? (
                      <div className="flex items-center">
                        <div className="bg-white p-3 rounded-xl shadow-sm mr-4">
                          <FileSpreadsheet className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-purple-900 uppercase">Excel Ready</p>
                          <button
                            onClick={() => {
                                const downloadUrl = `${api.defaults.baseURL}/cbcs/${cbcs.cbcs_id}/download-excel`;
                                window.open(downloadUrl, '_blank');
                            }}
                            className="text-[10px] font-bold text-purple-600 hover:underline flex items-center mt-1"
                          >
                            <Download className="h-3 w-3 mr-1" /> Download
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center opacity-50">
                        <FileSpreadsheet className="h-6 w-6 text-gray-400 mr-3" />
                        <p className="text-[10px] font-black text-gray-500 uppercase">Not Generated</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Event Metadata Timeline */}
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <h4 className="font-black text-gray-900 mb-5 text-[10px] uppercase tracking-widest">Record Timeline</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Initialized</span>
                      <span className="text-xs font-bold text-gray-800">{formatDateLong(cbcs.createdDate)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Created By</span>
                      <span className="text-xs font-bold text-indigo-600">{cbcs.createdByName || `Internal System (${cbcs.createdBy})`}</span>
                    </div>
                    {cbcs.updatedDate && (
                      <div className="flex justify-between items-center bg-white p-3 rounded-xl col-span-1 sm:col-span-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Last System Modification</span>
                        <span className="text-xs font-bold text-gray-800">{formatDateLong(cbcs.updatedDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comprehensive API Raw Debug Data */}
                {details && (
                  <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-4 right-4 text-white/10 font-black text-4xl select-none">DEBUG</div>
                    <h4 className="font-black text-indigo-400 mb-4 text-[10px] uppercase tracking-widest">Master Object Raw Output</h4>
                    <div className="max-h-64 overflow-y-auto no-scrollbar custom-scroll">
                      <pre className="text-[10px] font-mono text-indigo-100 leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(details, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="bg-gray-50 px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Generated by CBCS Management System
            </div>
            <div className="flex space-x-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white transition-all font-black text-xs uppercase tracking-widest shadow-sm"
              >
                Close
              </button>
              <button
                onClick={() => {
                    const downloadUrl = `${api.defaults.baseURL}/cbcs/${cbcs.cbcs_id}/download-excel`;
                    window.open(downloadUrl, '_blank');
                }}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center shadow-lg shadow-indigo-100"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Logic
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default CBCSList;
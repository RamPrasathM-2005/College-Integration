import React, { useState, useEffect } from 'react';
import { api } from '../../services/authService'; // Adjust path as needed
import { Search, Download, Users, BookOpen, Filter } from 'lucide-react';
import { branchMap } from "../../pages/admin/ManageSemesters/branchMap";

// Simple CSV string generator (no external deps)
const generateCSV = (data, fields) => {
  if (!data || data.length === 0) return '';
  const header = fields.map(field => `"${field}"`).join(',');
  const rows = data.map(row => 
    fields.map(field => {
      let value = row[field] ?? '';
      value = String(value).replace(/"/g, '""');
      if (/[,\n"]/.test(value)) {
        value = `"${value}"`;
      }
      return value;
    }).join(',')
  );
  return [header, ...rows].join('\n');
};

const StudentEnrollmentsView = () => {
  const [filters, setFilters] = useState({ batch: '', dept: '', sem: '' });
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('short'); // 'short' or 'expanded'
  const [searchField, setSearchField] = useState('regno'); // Default search field
  const [searchQuery, setSearchQuery] = useState(''); // Search input

  const branches = Object.keys(branchMap);

  const searchOptions = [
    { value: 'regno', label: 'Register No' },
    { value: 'name', label: 'Student Name' },
    { value: 'courseCode', label: 'Course Code' },
    { value: 'courseTitle', label: 'Course Title' },
    { value: 'staffId', label: 'Staff ID' },
    { value: 'staffName', label: 'Staff Name' },
  ];

  const fetchData = async () => {
    if (!filters.batch || !filters.dept || !filters.sem) {
      setData([]);
      setFilteredData([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/admin/enrollments/view', { params: filters });
      const fetchedData = res.data.data || [];
      setData(fetchedData);
      setFilteredData(fetchedData);
    } catch (err) {
      console.error('Fetch error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Unknown error';
      alert('Error fetching data: ' + errMsg);
      setData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
  }, [filters.batch, filters.dept, filters.sem]);

  // Client-side filtering based on selected field and query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(data);
      return;
    }
    const query = searchQuery.toLowerCase().trim();
    const filtered = data.filter(row => {
      let value = row[searchField] || '';
      value = String(value).toLowerCase();
      return value.includes(query);
    });
    setFilteredData(filtered);
  }, [searchQuery, searchField, data]);

  const exportCSV = () => {
    if (!filteredData.length) {
      alert('No data to export');
      return;
    }
    const fields = viewMode === 'short' 
      ? ['regno', 'courseCode', 'staffId']
      : ['regno', 'name', 'courseCode', 'courseTitle', 'staffId', 'staffName'];
    
    const csvContent = generateCSV(filteredData, fields);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrollments_${filters.batch}_${filters.dept}_sem${filters.sem}_filtered.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const showTable = data.length > 0;

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Search className="w-5 h-5 text-gray-500" />
          <h2 className="text-xl font-bold text-gray-800">Student Enrollments View</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Batch Year</label>
            <input
              type="text"
              placeholder="e.g., 2023"
              value={filters.batch}
              onChange={(e) => setFilters({ ...filters, batch: e.target.value.trim() })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={filters.dept}
              onChange={(e) => setFilters({ ...filters, dept: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">Select Dept</option>
              {branches.map((code) => (
                <option key={code} value={code}>{branchMap[code]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={filters.sem}
              onChange={(e) => setFilters({ ...filters, sem: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">Select Sem</option>
              {[1,2,3,4,5,6,7,8].map((s) => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setViewMode('short')}
            className={`px-4 py-2 rounded transition-colors ${viewMode === 'short' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Short Details
          </button>
          <button
            onClick={() => setViewMode('expanded')}
            className={`px-4 py-2 rounded transition-colors ${viewMode === 'expanded' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Expanded Details
          </button>
        </div>
      </div>

      {/* Loading & Data Table */}
      {loading && <p className="text-center text-gray-500">Loading data...</p>}
      
      {showTable && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Enrollment Details</h2>
                  <p className="text-sm text-gray-600">Filter and view student enrollments</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Advanced Search: Dropdown + Input */}
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-500" />
                  <select
                    value={searchField}
                    onChange={(e) => {
                      setSearchField(e.target.value);
                      setSearchQuery(''); // Clear query on field change
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  >
                    {searchOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder={`Search by ${searchOptions.find(o => o.value === searchField)?.label || ''}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all w-64"
                  />
                </div>
                <button 
                  onClick={exportCSV} 
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors shadow-sm"
                  disabled={loading}
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-20 min-w-[140px] border-r border-gray-200">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      Register No.
                    </div>
                  </th>
                  {viewMode === 'expanded' && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 sticky left-[140px] bg-gray-50 z-20 min-w-[220px] border-r border-gray-200">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2 text-gray-500" />
                        Student Name
                      </div>
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 min-w-[150px] border-r border-gray-200">
                    Course Code
                  </th>
                  {viewMode === 'expanded' && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 min-w-[250px] border-r border-gray-200">
                      Course Title
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 min-w-[120px] border-r border-gray-200">
                    Staff ID
                  </th>
                  {viewMode === 'expanded' && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 min-w-[220px]">
                      Staff Name
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((row, index) => {
                  const isEvenRow = index % 2 === 0;
                  return (
                    <tr
                      key={index}
                      className={`transition-colors duration-200 hover:bg-gray-50 ${
                        isEvenRow ? 'bg-white' : 'bg-gray-25'
                      }`}
                    >
                      <td className={`px-6 py-4 text-sm text-gray-900 border-r border-gray-100 sticky left-0 z-10 ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="flex items-center">
                          <div className="w-8 h-8 text-blue-600 rounded-lg flex items-center justify-center mr-3 text-xs font-semibold">
                            {index + 1}
                          </div>
                          <span className="font-mono text-gray-700 font-medium">{row.regno}</span>
                        </div>
                      </td>
                      {viewMode === 'expanded' && (
                        <td className={`px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-100 sticky left-[140px] z-10 ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`}>
                          {row.name}
                        </td>
                      )}
                      <td className={`px-6 py-4 text-sm text-gray-700 border-r border-gray-100`}>
                        {row.courseCode}
                      </td>
                      {viewMode === 'expanded' && (
                        <td className={`px-6 py-4 text-sm text-gray-700 border-r border-gray-100`}>
                          {row.courseTitle}
                        </td>
                      )}
                      <td className={`px-6 py-4 text-sm text-gray-700 border-r border-gray-100`}>
                        {row.staffId}
                      </td>
                      {viewMode === 'expanded' && (
                        <td className={`px-6 py-4 text-sm text-gray-700`}>
                          {row.staffName}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center text-gray-600">
                <Users className="w-4 h-4 mr-2" />
                <span>Total Records: </span>
                <span className="font-semibold text-gray-900 ml-1">{filteredData.length}</span>
              </div>
              <div className="text-xs text-gray-500">
                Showing {filteredData.length} of {data.length} enrollments
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!showTable && !loading && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 text-center">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Enrollments Found</h3>
            <p className="text-sm text-gray-500 max-w-md">
              Please select Batch, Department, and Semester to view enrollment data.
            </p>
          </div>
        </div>
      )}

      {showTable && filteredData.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 text-center mt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Matching Records</h3>
            <p className="text-sm text-gray-500 max-w-md">
              No enrollments match your search criteria. Try adjusting the search field or query.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentEnrollmentsView;
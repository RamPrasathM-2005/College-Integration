import React, { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import axios from 'axios';
import SearchBar from './SearchBar';
import SemesterList from './SemesterList';
import CreateSemesterForm from './CreateSemesterForm';
import SemesterDetails from './SemesterDetails';
import Swal from 'sweetalert2';
import { branchMap } from './branchMap';

const API_BASE = 'http://localhost:4000/api/admin';

const ManageSemesters = () => {
  const [allSemesters, setAllSemesters] = useState([]);
  const [filteredSemesters, setFilteredSemesters] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [searchQuery, setSearchQuery] = useState({ degree: '', batch: '', branch: '', semesterNumber: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSemesters();
  }, []);

  const fetchSemesters = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/semesters`);
      setAllSemesters(data.data || []);
      setFilteredSemesters(data.data || []);
    } catch (err) {
      toast.error('Failed to fetch semesters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = allSemesters;
    if (searchQuery.degree) filtered = filtered.filter(s => s.degree === searchQuery.degree);
    if (searchQuery.batch) filtered = filtered.filter(s => s.batch.includes(searchQuery.batch));
    if (searchQuery.branch) filtered = filtered.filter(s => s.branch === searchQuery.branch);
    if (searchQuery.semesterNumber) filtered = filtered.filter(s => s.semesterNumber === parseInt(searchQuery.semesterNumber));

    filtered.sort((a, b) => b.semesterId - a.semesterId);
    setFilteredSemesters(filtered.slice(0, 5));
  }, [searchQuery, allSemesters]);

  const handleDeleteSemester = (semesterId) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This action will permanently delete the semester and its associated data!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        axios.delete(`${API_BASE}/semesters/${semesterId}`)
          .then((response) => {
            if (response.data.status === 'success') {
              setAllSemesters(prev => prev.filter(s => s.semesterId !== semesterId));
              setFilteredSemesters(prev => prev.filter(s => s.semesterId !== semesterId));
              if (selectedSemester?.semesterId === semesterId) {
                setSelectedSemester(null);
              }
              Swal.fire({
                title: 'Success',
                text: 'Semester deleted successfully',
                icon: 'success',
                confirmButtonText: 'OK'
              });
            } else {
              Swal.fire({
                title: 'Error',
                text: response.data.message || 'Failed to delete semester',
                icon: 'error',
                confirmButtonText: 'OK'
              });
            }
          })
          .catch((err) => {
            const errorMsg = err.response?.data?.message || err.message;
            if (errorMsg.includes('foreign key constraint fails')) {
              Swal.fire({
                title: 'Cannot Delete',
                text: 'This semester cannot be deleted because it has associated courses. Please remove or reassign the courses first.',
                icon: 'error',
                confirmButtonText: 'OK'
              });
            } else {
              Swal.fire({
                title: 'Error',
                text: 'Failed to delete semester',
                icon: 'error',
                confirmButtonText: 'OK'
              });
            }
          });
      }
    });
  };

  const handleEditSemester = () => {
    fetchSemesters();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">Manage Semesters</h1>
          </div>
          <p className="text-gray-600">Create and manage semesters for different batches and departments</p>
        </div>

        {!selectedSemester ? (
          <>
            <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            <SemesterList 
              semesters={filteredSemesters} 
              onSemesterClick={setSelectedSemester} 
              onDelete={handleDeleteSemester} 
              onEdit={handleEditSemester} 
            />
            <CreateSemesterForm
              showCreateForm={showCreateForm}
              setShowCreateForm={setShowCreateForm}
              onRefresh={fetchSemesters}
              branchMap={branchMap}
            />
          </>
        ) : (
          <SemesterDetails 
            semester={selectedSemester} 
            onBack={() => setSelectedSemester(null)} 
            onDelete={handleDeleteSemester} 
          />
        )}
      </div>
    </div>
  );
};

export default ManageSemesters;
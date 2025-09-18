import { useState } from 'react';
import { showErrorToast, showSuccessToast, showConfirmToast } from '../../../../utils/swalConfig';
import manageStaffService from '../../../../services/manageStaffService';

const useManageStaffHandlers = ({
  selectedStaff,
  setSelectedStaff,
  selectedCourse,
  setSelectedCourse,
  selectedSectionId,
  setSelectedSectionId,
  selectedStaffCourse,
  setSelectedStaffCourse,
  selectedCourseCode,
  setSelectedCourseCode,
  selectedCourseStudents,
  setSelectedCourseStudents,
  courses,
  fetchData,
}) => {
  const [operationLoading, setOperationLoading] = useState(false);
  const [showStaffDetailsModal, setShowStaffDetailsModal] = useState(false);
  const [showAllocateCourseModal, setShowAllocateCourseModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState([]);
  const [operationFromModal, setOperationFromModal] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({ numberOfBatches: 1 });

  const handleStaffClick = (staff) => {
    setSelectedStaff(staff);
    setShowStaffDetailsModal(true);
    setOperationFromModal(false);
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !newBatchForm.numberOfBatches) {
      showErrorToast('Validation Error', 'Missing course or number of batches');
      return;
    }
    setOperationLoading(true);
    try {
      const numberOfBatches = parseInt(newBatchForm.numberOfBatches) || 1;
      const res = await manageStaffService.addSections(selectedCourse.code, numberOfBatches);
      if (res.status === 201) {
        setShowAddBatchModal(false);
        setNewBatchForm({ numberOfBatches: 1 });
        await fetchData();
        setShowAllocateCourseModal(true);
        showSuccessToast(`Added ${numberOfBatches} batch${numberOfBatches > 1 ? 'es' : ''} successfully`);
      } else {
        showErrorToast('Error', `Failed to add batches: ${res.data?.message || 'Unknown error'}`);
      }
    } catch (err) {
      showErrorToast('Error', `Error adding batches: ${err.response?.data?.message || err.message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleAllocateCourse = async () => {
    if (!selectedStaff || !selectedCourse || !selectedSectionId) {
      showErrorToast('Validation Error', 'Missing staff, course, or section information');
      return;
    }
    setOperationLoading(true);
    try {
      const isUpdate = selectedCourse?.isAllocated ?? false;
      const staffCourseId = isUpdate && selectedStaff?.allocatedCourses
        ? selectedStaff.allocatedCourses.find(c => c.courseCode === selectedCourse.code)?.id
        : Date.now(); // Temporary ID for optimistic update
      const optimisticCourse = {
        id: staffCourseId,
        courseCode: selectedCourse.code,
        name: selectedCourse.name,
        sectionId: selectedSectionId,
        batch: selectedCourse.sections?.find(s => s.sectionId === selectedSectionId)?.sectionName || 'N/A',
        semester: selectedCourse.semester || 'N/A',
        year: selectedCourse.batchYears || 'N/A',
      };
      setSelectedStaff(prev => {
        if (!prev) {
          showErrorToast('Error', 'No staff selected for course allocation');
          return prev;
        }
        return {
          ...prev,
          allocatedCourses: isUpdate
            ? prev.allocatedCourses.map(c => c.courseCode === selectedCourse.code ? optimisticCourse : c)
            : [...(prev.allocatedCourses || []), optimisticCourse],
        };
      });
      const res = isUpdate
        ? await manageStaffService.updateCourseAllocation(staffCourseId, {
            staffId: selectedStaff.staffId,
            courseCode: selectedCourse.code,
            sectionId: selectedSectionId,
            departmentId: selectedStaff.departmentId,
          })
        : await manageStaffService.allocateCourse(
            selectedStaff.staffId,
            selectedCourse.code,
            selectedSectionId,
            selectedStaff.departmentId
          );
      if (res.status === 201 || res.status === 200) {
        await fetchData();
        setSelectedCourse(null);
        setSelectedSectionId('');
        setExpandedCourses(prev => prev.includes(selectedStaff.staffId) ? prev : [...prev, selectedStaff.staffId]);
        showSuccessToast(`Course ${selectedCourse.code} ${isUpdate ? 'updated' : 'allocated'} successfully`);
      } else {
        setSelectedStaff(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            allocatedCourses: isUpdate
              ? prev.allocatedCourses.map(c => c.courseCode === selectedCourse.code ? selectedStaff.allocatedCourses.find(sc => sc.courseCode === selectedCourse.code) : c)
              : prev.allocatedCourses.filter(c => c.courseCode !== selectedCourse.code),
          };
        });
        showErrorToast('Error', `Failed to ${isUpdate ? 'update' : 'allocate'} course`);
      }
    } catch (err) {
      setSelectedStaff(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          allocatedCourses: isUpdate
            ? prev.allocatedCourses.map(c => c.courseCode === selectedCourse.code ? selectedStaff.allocatedCourses.find(sc => sc.courseCode === selectedCourse.code) : c)
            : prev.allocatedCourses.filter(c => c.courseCode !== selectedCourse.code),
        };
      });
      showErrorToast('Error', `Error ${isUpdate ? 'updating' : 'allocating'} course: ${err.response?.data?.message || err.message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleRemoveCourse = async (staff, staffCourseId) => {
    if (!staff || !staffCourseId) {
      showErrorToast('Validation Error', 'Missing staff or course information');
      return;
    }
    const courseToRemove = staff.allocatedCourses?.find(c => c.id === staffCourseId);
    if (!courseToRemove) {
      showErrorToast('Validation Error', 'Course not found in staff allocations');
      return;
    }

    showConfirmToast(
      'Confirm Removal',
      `Are you sure you want to remove the course ${courseToRemove.courseCode}?`,
      'warning',
      'Yes, remove it!',
      'No, cancel'
    ).then(async (result) => {
      if (!result.isConfirmed) return;

      setOperationLoading(true);
      setSelectedStaff(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          allocatedCourses: prev.allocatedCourses.filter(c => c.id !== staffCourseId),
        };
      });

      try {
        const res = await manageStaffService.removeCourseAllocation(staffCourseId);
        if (res.status === 200) {
          await fetchData();
          setSelectedCourse(null);
          setSelectedSectionId('');
          setExpandedCourses(prev => prev.includes(staff.staffId) ? prev : [...prev, staff.staffId]);
          showSuccessToast(`Course ${courseToRemove.courseCode} removed successfully`);
        } else {
          setSelectedStaff(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              allocatedCourses: [...prev.allocatedCourses, courseToRemove],
            };
          });
          showErrorToast('Error', 'Failed to remove course allocation');
        }
      } catch (err) {
        setSelectedStaff(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            allocatedCourses: [...prev.allocatedCourses, courseToRemove],
          };
        });
        showErrorToast('Error', `Error removing course: ${err.response?.data?.message || err.message}`);
      } finally {
        setOperationLoading(false);
      }
    });
  };

  const handleEditBatch = async () => {
    if (!selectedStaff || !selectedStaffCourse || !selectedSectionId) {
      showErrorToast('Validation Error', 'Missing staff, course, or section information');
      return;
    }

    const course = courses.find(c => c.code === selectedStaffCourse.courseCode);
    if (!course) {
      showErrorToast('Validation Error', `Course ${selectedStaffCourse.courseCode} not found`);
      return;
    }
    const section = course.sections.find(s => s.sectionId === selectedSectionId);
    if (!section) {
      showErrorToast('Validation Error', `Section ID ${selectedSectionId} not found for course ${selectedStaffCourse.courseCode}`);
      return;
    }

    setOperationLoading(true);
    const payload = {
      staffId: selectedStaff.staffId,
      courseCode: selectedStaffCourse.courseCode,
      sectionId: selectedSectionId,
      departmentId: selectedStaff.departmentId,
    };

    try {
      const optimisticCourse = {
        ...selectedStaffCourse,
        sectionId: selectedSectionId,
        batch: section.sectionName || 'N/A',
      };
      setSelectedStaff(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          allocatedCourses: prev.allocatedCourses.map(c => c.id === selectedStaffCourse.id ? optimisticCourse : c),
        };
      });
      const res = await manageStaffService.updateCourseAllocation(selectedStaffCourse.id, payload);
      if (res.status === 200) {
        setShowEditBatchModal(false);
        setSelectedStaffCourse(null);
        setSelectedSectionId('');
        await fetchData();
        setSelectedCourse(null);
        if (!operationFromModal) {
          setExpandedCourses(prev => prev.includes(selectedStaff.staffId) ? prev : [...prev, selectedStaff.staffId]);
        }
        showSuccessToast(`Section updated for course ${selectedStaffCourse.courseCode}`);
      } else {
        setSelectedStaff(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            allocatedCourses: prev.allocatedCourses.map(c => c.id === selectedStaffCourse.id ? selectedStaffCourse : c),
          };
        });
        showErrorToast('Error', `Failed to update section: ${res.data?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error updating section:', err.response || err.message);
      setSelectedStaff(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          allocatedCourses: prev.allocatedCourses.map(c => c.id === selectedStaffCourse.id ? selectedStaffCourse : c),
        };
      });
      const errorMessage = err.response?.data?.message || err.message;
      if (errorMessage.includes('not found')) {
        showErrorToast('Error', `Section update failed: Staff course ID ${selectedStaffCourse.id} not found or invalid data`);
        await fetchData();
      } else {
        showErrorToast('Error', `Error updating section: ${errorMessage}`);
      }
    } finally {
      setOperationLoading(false);
    }
  };

  const handleViewStudents = async (courseCode, sectionId) => {
    setOperationLoading(true);
    try {
      const students = await manageStaffService.getEnrolledStudents(courseCode, sectionId);
      setSelectedCourseStudents(students);
      setSelectedCourseCode(courseCode);
      setShowStudentsModal(true);
    } catch (err) {
      showErrorToast('Error', `Error fetching students: ${err.response?.data?.message || err.message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  return {
    handleStaffClick,
    handleAddBatch,
    handleAllocateCourse,
    handleRemoveCourse,
    handleEditBatch,
    handleViewStudents,
    showStaffDetailsModal,
    setShowStaffDetailsModal,
    showAllocateCourseModal,
    setShowAllocateCourseModal,
    showAddBatchModal,
    setShowAddBatchModal,
    showEditBatchModal,
    setShowEditBatchModal,
    showStudentsModal,
    setShowStudentsModal,
    expandedCourses,
    setExpandedCourses,
    operationLoading,
    operationFromModal,
    setOperationFromModal,
    newBatchForm,
    setNewBatchForm,
  };
};

export default useManageStaffHandlers;
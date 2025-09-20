import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../../services/authService'; // Adjust path to your api.js file
import { courseTypes, categories } from './branchMap';

const API_BASE = 'http://localhost:4000/api/admin';

const CourseForm = ({ isOpen, onClose, semesterId, course = null, onRefresh }) => {
  const [formData, setFormData] = useState({
    courseCode: '',
    courseTitle: '',
    type: 'THEORY',
    category: 'BSC',
    minMark: 40,
    maxMark: 100,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    experientialHours: 0,
    totalContactPeriods: 4,
    credits: 4,
    isActive: 'YES',
    createdBy: 'admin', // or updatedBy for edit
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({}); // For validation styling

  useEffect(() => {
    if (course) {
      setFormData({
        ...course,
        updatedBy: 'admin',
      });
    } else {
      setFormData({
        courseCode: '',
        courseTitle: '',
        type: 'THEORY',
        category: 'BSC',
        minMark: 40,
        maxMark: 100,
        lectureHours: 3,
        tutorialHours: 1,
        practicalHours: 0,
        experientialHours: 0,
        totalContactPeriods: 4,
        credits: 4,
        isActive: 'YES',
        createdBy: 'admin',
      });
    }
    setErrors({});
  }, [course]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.courseTitle) newErrors.courseTitle = 'Title is required';
    if (formData.minMark > formData.maxMark) newErrors.minMark = 'Min mark must be <= max mark';
    const totalHours =
      parseInt(formData.lectureHours) +
      parseInt(formData.tutorialHours) +
      parseInt(formData.practicalHours) +
      parseInt(formData.experientialHours);
    if (formData.totalContactPeriods !== totalHours)
      newErrors.totalContactPeriods = 'Must equal sum of hours';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      if (course) {
        // Update
        await api.put(`${API_BASE}/courses/${course.courseId}`, formData);
        toast.success('Course updated successfully');
      } else {
        // Add
        const response = await api.post(`${API_BASE}/semesters/${semesterId}/courses`, {
          ...formData,
          semesterId,
        });
        if (response.data && response.data.error) {
          if (response.data.error.includes('Duplicate entry')) {
            toast.error('Unique key violated');
          } else {
            toast.error(response.data.error || 'Failed to save course');
          }
          return;
        }
        toast.success('Course added successfully');
      }
      onClose();
      onRefresh();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save course';
      if (msg.includes('Duplicate entry')) {
        toast.error('Unique key violated');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-auto border border-gray-100">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800">{course ? 'Edit Course' : 'Add Course'}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Course Code</label>
            <input
              type="text"
              placeholder="e.g., 23CSE101"
              value={formData.courseCode}
              onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
              className={`w-full p-3 border-2 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 ${
                errors.courseCode ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Course Title</label>
            <input
              type="text"
              placeholder="Course Title"
              value={formData.courseTitle}
              onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
              className={`w-full p-3 border-2 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 ${
                errors.courseTitle ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              required
            />
            {errors.courseTitle && (
              <p className="text-sm text-red-500 mt-2 flex items-center gap-1">{errors.courseTitle}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full p-3 border-2 border-gray-200 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 bg-white"
              >
                {courseTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-3 border-2 border-gray-200 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 bg-white"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Active Status</label>
            <select
              value={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value })}
              className="w-full p-3 border-2 border-gray-200 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 bg-white"
            >
              <option value="YES">YES</option>
              <option value="NO">NO</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Min Mark</label>
              <input
                type="number"
                placeholder="Min Mark"
                value={formData.minMark}
                onChange={(e) => setFormData({ ...formData, minMark: parseInt(e.target.value) || 0 })}
                className={`w-full p-3 border-2 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 ${
                  errors.minMark ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                min="0"
              />
              {errors.minMark && <p className="text-sm text-red-500 mt-2">{errors.minMark}</p>}
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Max Mark</label>
              <input
                type="number"
                placeholder="Max Mark"
                value={formData.maxMark}
                onChange={(e) => setFormData({ ...formData, maxMark: parseInt(e.target.value) || 0 })}
                className="w-full p-3 border-2 border-gray-200 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300"
                min="0"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Hours</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Lecture Hrs</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.lectureHours}
                  onChange={(e) => setFormData({ ...formData, lectureHours: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300"
                  min="0"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tutorial Hrs</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.tutorialHours}
                  onChange={(e) => setFormData({ ...formData, tutorialHours: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300"
                  min="0"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Practical Hrs</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.practicalHours}
                  onChange={(e) => setFormData({ ...formData, practicalHours: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300"
                  min="0"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Experiential Hrs</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.experientialHours}
                  onChange={(e) => setFormData({ ...formData, experientialHours: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300"
                  min="0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Total Contact Periods</label>
            <input
              type="number"
              placeholder="Total Contact Periods"
              value={formData.totalContactPeriods}
              onChange={(e) => setFormData({ ...formData, totalContactPeriods: parseInt(e.target.value) || 0 })}
              className={`w-full p-3 border-2 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 ${
                errors.totalContactPeriods ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              min="0"
            />
            {errors.totalContactPeriods && (
              <p className="text-sm text-red-500 mt-2">{errors.totalContactPeriods}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Credits</label>
            <input
              type="number"
              placeholder="Credits"
              value={formData.credits}
              onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
              className="w-full p-3 border-2 border-gray-200 rounded-lg transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300"
              min="0"
            />
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Saving...' : 'Save Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseForm;
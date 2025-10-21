import React, { useState } from 'react';
import { BookOpen, TrendingUp, Users } from 'lucide-react';
import { updateStudentCOMark } from '../../services/staffService';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const InternalMarksTable = ({ students, courseOutcomes, calculateInternalMarks, refreshData }) => {
  const [editingCell, setEditingCell] = useState(null); // Track editing cell: { regno, coId }
  const [editValue, setEditValue] = useState(''); // Track input value during editing
  const [localMarks, setLocalMarks] = useState({}); // Store local marks for immediate UI updates

  if (!students?.length || !courseOutcomes?.length || !calculateInternalMarks) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 text-center">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Assessment Data</h3>
          <p className="text-sm text-gray-500 max-w-md">
            No students or course outcomes available for this course. Please ensure data has been properly configured.
          </p>
        </div>
      </div>
    );
  }

  console.log('InternalMarksTable - students:', students);
  console.log('InternalMarksTable - courseOutcomes:', courseOutcomes);

  const handleClick = (regno, coId, currentMark) => {
    setEditingCell({ regno, coId });
    setEditValue(currentMark?.toString() || '0');
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    // Allow numbers and decimal points, within 0-100
    if (/^\d*\.?\d*$/.test(value) && (value === '' || (Number(value) >= 0 && Number(value) <= 100))) {
      setEditValue(value);
    }
  };

  const handleInputBlur = async (regno, coId) => {
    const newMark = parseFloat(editValue);
    if (isNaN(newMark) || newMark < 0 || newMark > 100) {
      MySwal.fire('Error', 'Please enter a valid mark between 0 and 100', 'error');
      setEditingCell(null);
      return;
    }

    try {
      // Update the backend
      await updateStudentCOMark(null, regno, coId, newMark);
      console.log(`Updated mark for regno ${regno}, coId ${coId}: ${newMark}`);

      // Update local marks state
      setLocalMarks((prev) => ({
        ...prev,
        [`${regno}_${coId}`]: newMark,
      }));

      // Trigger parent component to refresh data
      if (refreshData) {
        await refreshData();
      }

      setEditingCell(null);
      MySwal.fire('Success', 'Mark updated successfully', 'success');
    } catch (error) {
      console.error('Error updating CO mark:', error);
      MySwal.fire('Error', `Failed to update mark: ${error.message}`, 'error');
      setEditingCell(null);
    }
  };

  const handleKeyPress = (e, regno, coId) => {
    if (e.key === 'Enter') {
      handleInputBlur(regno, coId);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Modified getAverages to prioritize consolidated marks from students.marks
  const getAverages = (regno) => {
    const student = students.find((s) => (s.regno || s.rollnumber) === regno);
    const averages = {};

    // Use consolidated marks from students.marks or localMarks
    courseOutcomes.forEach((co) => {
      const key = `${regno}_${co.coId}`;
      averages[co.coId] = localMarks[key] ?? student?.marks?.[co.coId] ?? 0;
    });

    // Calculate partition averages
    let theorySum = 0, theoryCount = 0, practicalSum = 0, practicalCount = 0, experientialSum = 0, experientialCount = 0;
    courseOutcomes.forEach((co) => {
      const coMark = parseFloat(averages[co.coId]) || 0;
      if (co.coType === 'THEORY') {
        theorySum += coMark;
        theoryCount++;
      } else if (co.coType === 'PRACTICAL') {
        practicalSum += coMark;
        practicalCount++;
      } else if (co.coType === 'EXPERIENTIAL') {
        experientialSum += coMark;
        experientialCount++;
      }
    });

    averages.avgTheory = theoryCount ? (theorySum / theoryCount).toFixed(2) : '0.00';
    averages.avgPractical = practicalCount ? (practicalSum / practicalCount).toFixed(2) : '0.00';
    averages.avgExperiential = experientialCount ? (experientialSum / experientialCount).toFixed(2) : '0.00';

    // Calculate overall final average as total sum of all CO marks / total COs
    let totalSum = 0;
    const totalCount = courseOutcomes.length;
    courseOutcomes.forEach((co) => {
      totalSum += parseFloat(averages[co.coId]) || 0;
    });
    averages.finalAvg = totalCount > 0 ? (totalSum / totalCount).toFixed(2) : '0.00';

    return averages;
  };

  // Determine partition counts for dynamic headers
  const partitionCounts = {
    theory: courseOutcomes.filter((co) => co.coType === 'THEORY').length,
    practical: courseOutcomes.filter((co) => co.coType === 'PRACTICAL').length,
    experiential: courseOutcomes.filter((co) => co.coType === 'EXPERIENTIAL').length,
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Assessment Overview</h2>
              <p className="text-sm text-gray-600">Internal marks and performance analysis</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{students.length}</span> students enrolled
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
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 sticky left-[140px] bg-gray-50 z-20 min-w-[220px] border-r border-gray-200">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2 text-gray-500" />
                  Student Name
                </div>
              </th>
              {courseOutcomes.map((co) => (
                <th key={co.coId} className="px-4 py-4 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 min-w-[110px]">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 text-blue-600 rounded-lg flex items-center justify-center mb-2 text-xs font-bold">
                      {co.coNumber}
                    </div>
                    <span className="text-xs text-gray-500">{co.coType || ''}</span>
                  </div>
                </th>
              ))}
              {partitionCounts.theory > 0 && (
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 bg-gray-50 border-r border-gray-200 min-w-[130px]">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
                      T
                    </div>
                    <span className="text-xs text-gray-500">Theory Average</span>
                  </div>
                </th>
              )}
              {partitionCounts.practical > 0 && (
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 bg-gray-50 border-r border-gray-200 min-w-[130px]">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
                      P
                    </div>
                    <span className="text-xs text-gray-500">Practical Average</span>
                  </div>
                </th>
              )}
              {partitionCounts.experiential > 0 && (
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 bg-gray-50 border-r border-gray-200 min-w-[130px]">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center mb-1 text-xs font-bold">
                      E
                    </div>
                    <span className="text-xs text-gray-500">Experiential Avg</span>
                  </div>
                </th>
              )}
              <th className="px-4 py-4 text-center text-sm font-semibold text-blue-600 min-w-[140px]">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-blue-600 bg-opacity-20 rounded-lg flex items-center justify-center mb-1">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium">Final Average</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student, index) => {
              const averages = getAverages(student.regno || student.rollnumber);
              console.log(`Averages for student ${student.regno || student.rollnumber}:`, averages);
              const isEvenRow = index % 2 === 0;

              return (
                <tr
                  key={student.regno || student.rollnumber}
                  className={`transition-colors duration-200 hover:bg-gray-50 ${
                    isEvenRow ? 'bg-white' : 'bg-gray-25'
                  }`}
                >
                  <td className={`px-6 py-4 text-sm text-gray-900 border-r border-gray-100 sticky left-0 z-10 ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`}>
                    <div className="flex items-center">
                      <div className="w-8 h-8 text-blue-600 rounded-lg flex items-center justify-center mr-3 text-xs font-semibold">
                        {index + 1}
                      </div>
                      <span className="font-mono text-gray-700 font-medium">{student.regno || student.rollnumber}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-100 sticky left-[140px] z-10 ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`}>
                    {student.name}
                  </td>
                  {courseOutcomes.map((co) => {
                    const coMark = averages[co.coId] || 0;
                    const isEditing = editingCell?.regno === (student.regno || student.rollnumber) && editingCell?.coId === co.coId;
                    console.log(`CO mark for ${co.coNumber} (coId: ${co.coId}): ${coMark}`);
                    return (
                      <td key={co.coId} className="px-4 py-4 text-center border-r border-gray-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={handleInputChange}
                            onBlur={() => handleInputBlur(student.regno || student.rollnumber, co.coId)}
                            onKeyDown={(e) => handleKeyPress(e, student.regno || student.rollnumber, co.coId)}
                            className="w-14 h-8 text-center text-sm font-semibold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => handleClick(student.regno || student.rollnumber, co.coId, coMark)}
                            className={`inline-flex items-center justify-center w-14 h-8 text-sm font-semibold cursor-pointer hover:bg-blue-50 ${
                              coMark >= 80
                                ? 'text-emerald-700'
                                : coMark >= 70
                                ? 'text-blue-700'
                                : coMark >= 60
                                ? 'text-amber-700'
                                : coMark >= 50
                                ? 'text-orange-700'
                                : 'text-red-700'
                            }`}
                          >
                            {coMark.toFixed(1)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {partitionCounts.theory > 0 && (
                    <td className="px-4 py-4 text-center border-r border-gray-100">
                      <span className="inline-flex items-center justify-center w-16 h-8 text-emerald-700 text-sm font-semibold">
                        {averages.avgTheory || '0.00'}
                      </span>
                    </td>
                  )}
                  {partitionCounts.practical > 0 && (
                    <td className="px-4 py-4 text-center border-r border-gray-100">
                      <span className="inline-flex items-center justify-center w-16 h-8 text-violet-700 text-sm font-semibold">
                        {averages.avgPractical || '0.00'}
                      </span>
                    </td>
                  )}
                  {partitionCounts.experiential > 0 && (
                    <td className="px-4 py-4 text-center border-r border-gray-100">
                      <span className="inline-flex items-center justify-center w-16 h-8 text-amber-700 text-sm font-semibold">
                        {averages.avgExperiential || '0.00'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-20 h-10 text-blue-600 text-sm font-bold">
                      {averages.finalAvg || '0.00'}
                    </span>
                  </td>
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
            <span>Total Students: </span>
            <span className="font-semibold text-gray-900 ml-1">{students.length}</span>
          </div>
          <div className="flex items-center space-x-6 text-xs text-gray-500">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded mr-2"></div>
              <span>Excellent (≥80)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded mr-2"></div>
              <span>Good (70-79)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded mr-2"></div>
              <span>Average (60-69)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded mr-2"></div>
              <span>Below Average (50-59)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-100 border border-red-200 rounded mr-2"></div>
              <span>Needs Improvement (&lt;50)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalMarksTable;
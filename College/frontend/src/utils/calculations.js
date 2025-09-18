export const calculateCOMarks = (student, co, students) => {
  if (!co?.tools || !Array.isArray(co.tools)) {
    console.warn(`No valid tools for coId ${co?.coId}:`, co?.tools);
    return 0;
  }
  const studentData = students.find(s => s.rollnumber === student.rollnumber);
  if (!studentData) {
    console.warn(`Student not found: ${student.rollnumber}`);
    return 0;
  }
  let mark = 0;
  co.tools.forEach((tool) => {
    const studentMark = studentData?.marks?.[tool.toolId] || 0;
    const maxMarks = Number(tool.maxMarks) || 100; // Ensure number, fallback to 100
    const weightage = Number(tool.weightage) || 100; // Ensure number, fallback to 100
    if (maxMarks === 0) {
      console.warn(`Invalid maxMarks for toolId ${tool.toolId}:`, maxMarks);
      return;
    }
    mark += (studentMark / maxMarks) * (weightage / 100);
  });
  const coMark = mark * 100;
  return isNaN(coMark) ? 0 : coMark; // Prevent NaN
};

export const calculateInternalMarks = (rollnumber, courseOutcomes, students) => {
  let theorySum = 0,
    theoryCount = 0,
    pracSum = 0,
    pracCount = 0,
    expSum = 0,
    expCount = 0;
  const marks = {};
  const coMarks = [];

  // Validate inputs
  if (!rollnumber || !Array.isArray(courseOutcomes) || !students) {
    console.error('Invalid inputs:', { rollnumber, courseOutcomes, students });
    return {
      ...marks,
      avgTheory: '0.00',
      avgPractical: '0.00',
      avgExperiential: '0.00',
      finalAvg: '0.00',
    };
  }

  // Calculate CO marks and partition sums
  courseOutcomes.forEach((co) => {
    const coMark = calculateCOMarks({ rollnumber }, co, students);
    marks[co.coId] = isNaN(coMark) ? 0 : coMark; // Prevent NaN
    coMarks.push({ mark: coMark, weight: Number(co.weightage) || 100, type: co.coType || 'THEORY' });
    if (co.coType === 'THEORY') {
      theorySum += coMark;
      theoryCount++;
    } else if (co.coType === 'PRACTICAL') {
      pracSum += coMark;
      pracCount++;
    } else if (co.coType === 'EXPERIENTIAL') {
      expSum += coMark;
      expCount++;
    }
  });

  // Calculate averages for each partition
  const avgTheory = theoryCount ? theorySum / theoryCount : 0;
  const avgPractical = pracCount ? pracSum / pracCount : 0;
  const avgExperiential = expCount ? expSum / expCount : 0;

  // Calculate finalAvg using only active partitions
  const activePartitions = [
    { count: theoryCount, type: 'THEORY' },
    { count: pracCount, type: 'PRACTICAL' },
    { count: expCount, type: 'EXPERIENTIAL' },
  ].filter((p) => p.count > 0);

  let finalAvg = 0;
  if (activePartitions.length > 0) {
    const totalWeight = coMarks
      .filter((cm) => activePartitions.some((p) => p.type === cm.type))
      .reduce((sum, cm) => sum + (cm.weight / 100), 0);
    finalAvg = coMarks
      .filter((cm) => activePartitions.some((p) => p.type === cm.type))
      .reduce((sum, cm) => sum + cm.mark * (cm.weight / 100) / (totalWeight || 1), 0);
  }

  return {
    ...marks,
    avgTheory: (isNaN(avgTheory) ? 0 : avgTheory).toFixed(2),
    avgPractical: (isNaN(avgPractical) ? 0 : avgPractical).toFixed(2),
    avgExperiential: (isNaN(avgExperiential) ? 0 : avgExperiential).toFixed(2),
    finalAvg: (isNaN(finalAvg) ? 0 : finalAvg).toFixed(2),
  };
};
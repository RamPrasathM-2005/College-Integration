import React from "react";

const MarksSummary = ({ courseOutcomes, students, calculateCOMarks, calculateInternalMarks }) => {
  return (
    <table className="w-full mt-8">
      <thead>
        <tr>
          <th>Reg No</th>
          <th>Name</th>
          {courseOutcomes.map((co) => <th key={co.coId}>{co.coNumber}</th>)}
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.rollnumber}>
            <td>{student.rollnumber}</td>
            <td>{student.name}</td>
            {courseOutcomes.map((co) => <td key={co.coId}>{calculateCOMarks(student.rollnumber, co.coId)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default MarksSummary;
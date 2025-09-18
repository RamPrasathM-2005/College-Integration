import React from "react";

const StudentMarksTable = ({ coId, tool, students, updateStudentMark }) => {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Reg No</th>
          <th>Name</th>
          <th>{tool.toolName}</th>
          {/* Add other tools if showing all for CO */}
          <th>Consolidated</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.rollnumber}>
            <td>{student.rollnumber}</td>
            <td>{student.name}</td>
            <td>
              <input
                type="number"
                defaultValue={0} // Fetch from API
                onChange={(e) => updateStudentMark(tool.toolId, student.rollnumber, parseInt(e.target.value))}
              />
            </td>
            <td>{/* Calculate consolidated */}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default StudentMarksTable;
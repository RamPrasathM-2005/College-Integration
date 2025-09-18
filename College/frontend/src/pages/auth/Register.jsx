import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { register, getDepartments } from "../../services/authService";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffId, setStaffId] = useState("");
  const [role, setRole] = useState("staff");
  const [departmentName, setDepartmentName] = useState("");
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch departments on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const departmentList = await getDepartments();
        setDepartments(departmentList);
      } catch (err) {
        setError("Failed to load departments");
      }
    };
    fetchDepartments();
  }, []);

  const validateStaffId = (id) => {
    const regex = /^[A-Z]{3}[0-9]{3}$/;
    return id === "" || regex.test(id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validate inputs
    if (!name || !email || !password || !role) {
      setError("Name, email, password, and role are required");
      setIsLoading(false);
      return;
    }

    if (!validateStaffId(staffId)) {
      setError("Staff ID must be in format ABC123 (3 letters followed by 3 digits) or empty");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    if (role === "staff" && !departmentName) {
      setError("Department is required for staff role");
      setIsLoading(false);
      return;
    }

    // Find departmentId based on selected departmentName
    const selectedDepartment = departments.find(
      (dept) => dept.departmentName === departmentName
    );
    const departmentId = selectedDepartment ? selectedDepartment.departmentId : null;

    try {
      const user = await register(name, email, password, role, departmentId, staffId);

      // Role-based redirect
      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else if (user.role === "staff") {
        navigate("/staff/dashboard");
      }
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4 text-center">Register</h2>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
          required
          minLength={6}
        />
        <input
          type="text"
          placeholder="Staff ID (e.g., ABC123)"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value.toUpperCase())}
          className="w-full mb-4 p-2 border rounded"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        {role === "staff" && (
          <select
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            className="w-full mb-4 p-2 border rounded"
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.departmentId} value={dept.departmentName}>
                {dept.departmentName}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={isLoading}
          onClick={handleSubmit}
          className="w-full bg-green-500 text-white py-2 rounded disabled:opacity-50"
        >
          {isLoading ? "Registering..." : "Register"}
        </button>
        <p className="mt-4 text-sm text-center">
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            className="text-blue-600 cursor-pointer hover:underline"
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
};

export default Register;
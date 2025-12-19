import React, { useState, useEffect } from "react";
import { ChevronDownIcon, CheckIcon } from "@heroicons/react/24/solid";
import { useParams } from "react-router-dom";
// import collegeImg from "./assets/maxresdefault.jpg";


const CourseStaffSelection = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStaffs, setSelectedStaffs] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);

  const { regno, batchId, deptId, semesterId } = useParams();
  const API_URL = `http://localhost:4000/api/cbcs/student?regno=${regno}&batchId=${batchId}&deptId=${deptId}&semesterId=${semesterId}`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();

      if (result?.cbcs?.subjects) {
        setData(result.cbcs);

        const initialSelections = {};
        result.cbcs.subjects.forEach((sub) => {
          if (sub.staffs?.length) {
            initialSelections[sub.cbcs_subject_id] = sub.staffs[0];
          }
        });
        setSelectedStaffs(initialSelections);
      } else {
        throw new Error("Invalid API response");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = (id, e) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === id ? null : id);
  };

  const handleStaffSelect = (subjectId, staff) => {
    setSelectedStaffs((prev) => ({
      ...prev,
      [subjectId]: staff
    }));
    setOpenDropdown(null);
  };

  const handleSubmit = async () => {
    try {
      if (!data?.cbcs_id) return alert("CBCS not loaded");
      if (!regno) return alert("Regno missing");

      const selections = data.subjects.map((subject) => {
        const staff = selectedStaffs[subject.cbcs_subject_id];
        if (!staff) {
          throw new Error(`Staff not selected for ${subject.courseCode}`);
        }
        return {
          courseId: subject.courseId,
          sectionId: staff.sectionId,
          staffId: staff.staffId
        };
      });

      const payload = {
        regno,
        cbcs_id: data.cbcs_id,
        createdBy: 101,
        selections
      };

      const response = await fetch(
        "http://localhost:4000/api/cbcs/submission",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Submission failed");

      alert(result.message || "Selection submitted successfully");
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    const close = () => setOpenDropdown(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">

        {/* 🔹 COLLEGE IMAGE */}
        {/* <div className="mb-6">
          <img
            src={collegeImg}
            alt="College"
            className="w-full h-64 object-cover rounded shadow"
          />
        </div> */}

        {/* 🔹 TITLE + REGNO */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold">
            CBCS Course Selection
          </h2>
          <p className="mt-2 text-gray-700">
            Register Number :
            <span className="font-semibold ml-2 text-blue-700">
              {regno}
            </span>
          </p>
        </div>

        <div className="bg-white border rounded shadow">
          {/* HEADER */}
          <div className="grid grid-cols-3 bg-blue-800 text-white font-semibold">
            <div className="px-4 py-3">Course Code</div>
            <div className="px-4 py-3">Course Name</div>
            <div className="px-4 py-3">Staff Name</div>
          </div>

          {/* BODY */}
          {data.subjects.map((subject) => (
            <div
              key={subject.cbcs_subject_id}
              className="grid grid-cols-3 border-t"
            >
              <div className="px-4 py-4 font-medium">
                {subject.courseCode}
              </div>

              <div className="px-4 py-4">
                <div className="font-medium">
                  {subject.courseTitle}
                </div>
                <div className="text-sm text-gray-500">
                  {subject.category} • {subject.credits} Credits
                </div>
              </div>

              <div className="px-4 py-4">
                <div className="relative max-w-xs">
                  <div
                    className="flex justify-between items-center border rounded px-3 py-2 cursor-pointer bg-white"
                    onClick={(e) =>
                      toggleDropdown(subject.cbcs_subject_id, e)
                    }
                  >
                    <div>
                      <div className="font-medium">
                        {selectedStaffs[subject.cbcs_subject_id]?.staffName}
                      </div>
                      <div className="text-sm text-gray-500">
                        Section {selectedStaffs[subject.cbcs_subject_id]?.sectionName}
                      </div>
                    </div>
                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                  </div>

                  {openDropdown === subject.cbcs_subject_id && (
                    <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow">
                      {subject.staffs.map((staff) => (
                        <div
                          key={staff.staffId}
                          onClick={() =>
                            handleStaffSelect(subject.cbcs_subject_id, staff)
                          }
                          className="px-3 py-2 cursor-pointer hover:bg-blue-50 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium">{staff.staffName}</div>
                            <div className="text-sm text-gray-500">
                              Section {staff.sectionName}
                            </div>
                          </div>
                          {selectedStaffs[subject.cbcs_subject_id]?.staffId === staff.staffId && (
                            <CheckIcon className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-6">
          <button
            onClick={handleSubmit}
            className="px-8 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
          >
            Submit
          </button>
        </div>

      </div>
    </div>
  );
};

export default CourseStaffSelection;

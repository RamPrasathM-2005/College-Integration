import { api } from "./authService.js";

export const fetchStudentDetails = async () => {
  try {
    const response = await api.get("/student/details");
    console.log(response);
    if (response.data.status === "success") {
      return response.data.data;
    } else {
      throw new Error(
        response.data.message || "Failed to fetch student details"
      );
    }
  } catch (error) {
    console.error("fetchStudentDetails error:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch student details"
    );
  }
};

export const fetchSemesters = async () => {
  try {
    const response = await api.get("/student/semesters");
    if (response.data.status === "success") {
      return response.data.data;
    } else {
      throw new Error(response.data.message || "Failed to fetch semesters");
    }
  } catch (error) {
    console.error("fetchSemesters error:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch semesters"
    );
  }
};

export const fetchMandatoryCourses = async (semesterId) => {
  try {
    const response = await api.get("/student/courses/mandatory", {
      params: { semesterId },
    });
    if (response.data.status === "success") {
      return response.data.data;
    } else {
      throw new Error(
        response.data.message || "Failed to fetch mandatory courses"
      );
    }
  } catch (error) {
    console.error("fetchMandatoryCourses error:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch mandatory courses"
    );
  }
};

export const fetchElectiveBuckets = async (semesterId) => {
  try {
    const response = await api.get("/student/elective-buckets", {
      params: { semesterId },
    });
    if (response.data.status === "success") {
      return response.data.data;
    } else {
      throw new Error(
        response.data.message || "Failed to fetch elective buckets"
      );
    }
  } catch (error) {
    console.error("fetchElectiveBuckets error:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch elective buckets"
    );
  }
};

export const allocateElectives = async (semesterId, selections) => {
  try {
    const response = await api.post("/student/allocate-electives", {
      semesterId,
      selections,
    });

    if (response.data.status === "success") {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to allocate electives");
    }
  } catch (error) {
    console.error("allocateElectives error:", error);
    throw new Error(
      error.response?.data?.message || "Failed to allocate electives"
    );
  }
};

export const fetchEnrolledCourses = async (semesterId) => {
  try {
    const response = await api.get("/student/enrolled-courses", {
      params: { semesterId },
    });
    if (response.data.status === "success") {
      return response.data.data;
    } else {
      throw new Error(
        response.data.message || "Failed to fetch enrolled courses"
      );
    }
  } catch (error) {
    console.error("fetchEnrolledCourses error:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch enrolled courses"
    );
  }
};

export const fetchAttendanceSummary = async (semesterId) => {
  try {
    const response = await api.get("/student/attendance-summary", {
      params: { semesterId },
    });
    if (response.data.status === "success") {
      return response.data.data;
    } else {
      throw new Error(
        response.data.message || "Failed to fetch attendance summary"
      );
    }
  } catch (error) {
    console.error("fetchAttendanceSummary error:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch attendance summary"
    );
  }
};

export const fetchUserId = async () => {
  try {
    const response = await api.get("/student/userid");
    if (response.data.status === "success") {
      return response.data.data.Userid;
    } else {
      throw new Error(response.data.message || "Failed to fetch Userid");
    }
  } catch (error) {
    console.error("fetchUserId error:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch Userid");
  }
};

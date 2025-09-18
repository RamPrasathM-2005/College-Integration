import React from "react";
// import StaffSidebar from "../components/Sidebar/StaffSidebar";
import { Outlet } from "react-router-dom";
import Header from "../pages/staff/Header";

const StaffLayout = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
};

export default StaffLayout;

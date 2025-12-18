import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService';

// 1. Importing Unique Icons for better visuals
import { 
  LayoutDashboard, 
  CalendarRange, 
  BookOpenCheck, 
  Settings2, 
  LibraryBig, 
  UserCog, 
  GraduationCap, 
  Table2, 
  FileSpreadsheet, 
  BarChart4, 
  Sparkles, 
  ClipboardCheck, 
  FileText, 
  Network, 
  Award, 
  MessageSquarePlus, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck
} from 'lucide-react';

const AdminSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // 2. Sidebar Data with Unique Icons
  const sidebarItems = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin/manage-semesters", icon: CalendarRange, label: "Manage Semesters" },
    { to: "/admin/manage-regulations", icon: BookOpenCheck, label: "Manage Regulations" },
    { to: "/admin/manage-batches", icon: Settings2, label: "Allocate Regulation to Batch" },
    { to: "/admin/manage-courses", icon: LibraryBig, label: "Manage Courses" },
    { to: "/admin/manage-staff", icon: UserCog, label: "Allocate Staff to Course" },
    { to: "/admin/manage-students", icon: GraduationCap, label: "Allocate Students to Staff" },
    { to: "/admin/timetable", icon: Table2, label: "Timetable" },
    { to: '/admin/consolidated-marks', icon: FileSpreadsheet, label: 'Consolidated Marks' },
    { to: "/admin/subjectwise-marks", icon: BarChart4, label: "Subjectwise Marks" },
    { to: "/admin/course-recommendation", icon: Sparkles, label: "Course Recommendation" },
    { to: "/admin/adminattendance", icon: ClipboardCheck, label: "Attendance" },
    { to: "/admin/attendance-report", icon: FileText, label: "Attendance Report" },
    { to: "/admin/report", icon: FileText, label: "General Report" },
    { to: "/admin/student-staff-mapping", icon: Network, label: "Staff Course Mapping" },
    { to: "/admin/cgpa-allocation", icon: Award, label: "CGPA Allocation" },
    { to: "/admin/request-courses", icon: MessageSquarePlus, label: "Request Courses" },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* CSS to hide scrollbar but keep functionality (Cleaner Look) */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 backdrop-blur-sm z-40 lg:hidden bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50
        w-64 bg-[#11101d] text-white
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col shadow-2xl font-sans
      `}>
        
        {/* Header - Removed Branding, kept it Generic */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-[#1d1b31] shrink-0">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-500" />
            <span className="text-xl font-bold tracking-wide">Admin Panel</span>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation - Scrollable Area */}
        <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3">
          <ul className="space-y-1.5">
            {sidebarItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={index}>
                  <NavLink
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200
                      text-sm font-medium leading-relaxed
                      ${isActive 
                        ? 'bg-white text-[#11101d] shadow-md transform scale-[1.02]' // Active: White BG, Dark Text
                        : 'text-gray-400 hover:bg-white/10 hover:text-white' // Inactive: Gray Text
                      }
                    `}
                  >
                    {/* Icon - shrank slightly to ensure alignment */}
                    <Icon className={`w-5 h-5 shrink-0`} />
                    
                    {/* Label - Allowed to wrap naturally */}
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
            
            {/* Logout Button (Kept at bottom of list like your old code) */}
            <li className="pt-4 mt-2 border-t border-[#1d1b31]">
              <button
                onClick={handleLogout}
                className="flex items-center gap-4 px-4 py-3 rounded-xl w-full text-left 
                           text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="font-medium text-sm">Logout</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Hamburger button (Mobile) */}
      {!isOpen && (
        <button
          className="fixed top-4 left-4 z-50 lg:hidden p-2.5 rounded-lg bg-[#11101d] text-white shadow-lg"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>
      )}
    </>
  );
};

export default AdminSidebar;
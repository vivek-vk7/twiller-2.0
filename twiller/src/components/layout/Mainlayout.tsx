"use client";
import { useAuth, getClientDetails } from "@/context/AuthContext";
import React, { useState, useEffect } from "react";
import LoadingSpinner from "../loading-spinner";
import Sidebar from "./Sidebar";
import RightSidebar from "./Rightsidebar";
import ProfilePage from "../ProfilePage";

const Mainlayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState("home");
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    const checkRestriction = () => {
      const details = getClientDetails();
      if (details.device === "Mobile") {
        const now = new Date();
        const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const hour = istDate.getHours();
        if (hour < 10 || hour >= 13) {
          setRestricted(true);
          return;
        }
      }
      setRestricted(false);
    };

    checkRestriction();
    const interval = setInterval(checkRestriction, 30000);
    return () => clearInterval(interval);
  }, []);

  if (restricted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-red-950/20 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="bg-black/60 backdrop-blur-md border border-red-500/20 p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-6">
          <div className="h-16 w-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500 animate-pulse">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Access Restricted</h1>
          <p className="text-gray-400 leading-relaxed text-sm">
            Mobile access to Twiller is restricted. You can only access this platform between <strong>10:00 AM and 1:00 PM IST</strong> on mobile devices. Please switch to a Desktop/Laptop or try again later.
          </p>
          <div className="text-xs text-red-400 bg-red-950/20 py-2 px-4 rounded-lg inline-block font-mono border border-red-900/30">
            Current IST Hour: {new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {

    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-4xl font-bold mb-4">X</div>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // If user is not logged in → show children (like login/signup pages)
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-20 sm:w-24 md:w-64 border-r border-gray-800">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      </div>
      <main className="flex-1 max-w-2xl border-x border-gray-800">
        {currentPage ==="profile" ? <ProfilePage/> :children}
      </main>
      <div className="hidden lg:block w-80 p-4">
        <RightSidebar />
      </div>
    </div>
  );
};

export default Mainlayout;

"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "./firebase";
import axiosInstance from "../lib/axiosInstance";

export function getClientDetails() {
  if (typeof window === "undefined") {
    return { browser: "Other", os: "Other", device: "Desktop/Laptop" };
  }
  const ua = navigator.userAgent;
  let browser = "Other";
  let os = "Other";
  let device = "Desktop/Laptop";

  if (ua.includes("Edg") || ua.includes("Edge")) {
    browser = "Microsoft Edge";
  } else if (ua.includes("Chrome") && !ua.includes("Chromium")) {
    browser = "Google Chrome";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    browser = "Safari";
  } else if (ua.includes("Firefox")) {
    browser = "Firefox";
  }

  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Macintosh") || ua.includes("Mac OS")) {
    os = "macOS";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (ua.includes("iPhone") || ua.includes("iPad")) {
    os = "iOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  }

  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
    device = "Mobile";
  }

  return { browser, os, device };
}

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
  email: string;
  website: string;
  location: string;
  plan?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  loginHistory?: any[];
  notificationsEnabled?: boolean;
  language?: string;
  mobileNumber?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<void>;
  updateProfile: (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
  }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  googlesignin: () => void;
  edgeLogin: (email: string) => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<any>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const unsubcribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const res = await axiosInstance.get("/loggedinuser", {
            params: { email: firebaseUser.email },
          });

          if (res.data) {
            setUser(res.data);
            localStorage.setItem("twitter-user", JSON.stringify(res.data));
          }
        } catch (err) {
          console.log("Failed to fetch user:", err);
        }
      } else {
        // Fallback for Microsoft browser passwordless flow which uses localStorage only
        const localUser = localStorage.getItem("twitter-user");
        if (localUser) {
          setUser(JSON.parse(localUser));
        } else {
          setUser(null);
        }
      }
      setIsLoading(false);
    });
    return () => unsubcribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const usercred = await signInWithEmailAndPassword(auth, email, password);
    const firebaseuser = usercred.user;
    const res = await axiosInstance.get("/loggedinuser", {
      params: { email: firebaseuser.email },
    });
    if (res.data) {
      setUser(res.data);
      localStorage.setItem("twitter-user", JSON.stringify(res.data));

      try {
        const details = getClientDetails();
        await axiosInstance.post("/login-history", {
          email: firebaseuser.email,
          ...details
        });
      } catch (err) {
        console.error("Failed to log history during email login:", err);
      }
    }
    setIsLoading(false);
  };

  const edgeLogin = async (email: string) => {
    setIsLoading(true);
    try {
      let res = await axiosInstance.get("/loggedinuser", {
        params: { email },
      });
      if (!res.data) {
        const username = email.split("@")[0];
        const newuser = {
          username,
          displayName: username.charAt(0).toUpperCase() + username.slice(1),
          avatar: "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
          email,
        };
        const regRes = await axiosInstance.post("/register", newuser);
        res = regRes;
      }
      
      if (res.data) {
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
        
        try {
          const details = getClientDetails();
          await axiosInstance.post("/login-history", {
            email,
            ...details
          });
        } catch (historyErr) {
          console.error("Failed to log history during edge login:", historyErr);
        }
      }
    } catch (err) {
      console.error("Edge fast-track login failed:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => {
    setIsLoading(true);
    const usercred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = usercred.user;
    const newuser: any = {
      username,
      displayName,
      avatar: user.photoURL || "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
      email: user.email,
    };
    const res = await axiosInstance.post("/register", newuser);
    if (res.data) {
      setUser(res.data);
      localStorage.setItem("twitter-user", JSON.stringify(res.data));

      try {
        const details = getClientDetails();
        await axiosInstance.post("/login-history", {
          email: user.email,
          ...details
        });
      } catch (err) {
        console.error("Failed to log history during signup:", err);
      }
    }
    setIsLoading(false);
  };

  const logout = async () => {
    setUser(null);
    await signOut(auth);
    localStorage.removeItem("twitter-user");
  };

  const updateProfile = async (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
  }) => {
    if (!user) return;

    setIsLoading(true);
    const updatedUser: User = {
      ...user,
      ...profileData,
    };
    const res = await axiosInstance.patch(
      `/userupdate/${user.email}`,
      updatedUser
    );
    if (res.data) {
      setUser(updatedUser);
      localStorage.setItem("twitter-user", JSON.stringify(updatedUser));
    }

    setIsLoading(false);
  };

  const googlesignin = async () => {
    setIsLoading(true);

    try {
      const googleauthprovider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleauthprovider);
      const firebaseuser = result.user;

      if (!firebaseuser?.email) {
        throw new Error("No email found in Google account");
      }

      let userData;

      try {
        const res = await axiosInstance.get("/loggedinuser", {
          params: { email: firebaseuser.email },
        });
        if (!res.data) {
          throw new Error("User not found in MongoDB");
        }
        userData = res.data;
      } catch (err: any) {
        const newuser: any = {
          username: firebaseuser.email.split("@")[0],
          displayName: firebaseuser.displayName || "User",
          avatar: firebaseuser.photoURL || "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
          email: firebaseuser.email,
        };

        const registerRes = await axiosInstance.post("/register", newuser);
        userData = registerRes.data;
      }

      if (userData) {
        setUser(userData);
        localStorage.setItem("twitter-user", JSON.stringify(userData));

        try {
          const details = getClientDetails();
          await axiosInstance.post("/login-history", {
            email: firebaseuser.email,
            ...details
          });
        } catch (err) {
          console.error("Failed to log history during Google sign-in:", err);
        }
      } else {
        throw new Error("Login/Register failed: No user data returned");
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      alert(error.response?.data?.message || error.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        updateProfile,
        logout,
        isLoading,
        googlesignin,
        edgeLogin,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


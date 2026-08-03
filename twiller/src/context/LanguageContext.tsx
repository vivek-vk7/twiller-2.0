"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, LanguageType } from "../lib/translations";
import { useAuth } from "./AuthContext";
import axiosInstance from "../lib/axiosInstance";

interface LanguageContextType {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  t: (key: keyof typeof translations.English) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateProfile } = useAuth();
  const [language, setLanguageState] = useState<LanguageType>("English");

  useEffect(() => {
    // Read from localStorage
    const savedLang = localStorage.getItem("twiller-lang") as LanguageType;
    if (savedLang && translations[savedLang]) {
      setLanguageState(savedLang);
    } else if (user?.language && translations[user.language as LanguageType]) {
      setLanguageState(user.language as LanguageType);
    }
  }, [user]);

  const setLanguage = async (lang: LanguageType) => {
    setLanguageState(lang);
    localStorage.setItem("twiller-lang", lang);
    if (user) {
      try {
        await axiosInstance.patch(`/userupdate/${user.email}`, { language: lang });
      } catch (err) {
        console.error("Failed to sync language selection with backend:", err);
      }
    }
  };

  const t = (key: keyof typeof translations.English): string => {
    const dict = translations[language] || translations.English;
    return (dict as any)[key] || (translations.English as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

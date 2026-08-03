"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  MoreHorizontal,
  Camera,
  CheckCircle,
  CreditCard,
  Globe,
  Bell,
  ShieldAlert,
  FileText,
  Check,
  Lock,
  Smartphone,
  Mail,
  RefreshCw,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageType } from "@/lib/translations";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import TweetCard from "./TweetCard";
import { Card, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import Editprofile from "./Editprofile";
import axiosInstance from "@/lib/axiosInstance";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState("posts");
  const [showEditModal, setShowEditModal] = useState(false);
  const [tweets, setTweets] = useState<any>([]);
  const [loading, setLoading] = useState(false);

  // Subscription states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    number: "4111 2222 3333 4444",
    expiry: "12/29",
    cvv: "123",
    name: user?.displayName || "",
  });

  // Login History states
  const [history, setHistory] = useState<any[]>(user?.loginHistory || []);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Settings & Language OTP states
  const [showLanguageOtpModal, setShowLanguageOtpModal] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<LanguageType | null>(null);
  const [langOtpCode, setLangOtpCode] = useState("");
  const [langOtpError, setLangOtpError] = useState("");
  const [userPhoneNumber, setUserPhoneNumber] = useState(user?.mobileNumber || "");
  const [simulatedSmsOtp, setSimulatedSmsOtp] = useState("");
  const [loadingOtp, setLoadingOtp] = useState(false);

  if (!user) return null;

  const fetchTweets = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/post");
      setTweets(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await axiosInstance.get("/loggedinuser", {
        params: { email: user.email },
      });
      if (res.data) {
        setHistory(res.data.loginHistory || []);
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
      }
    } catch (error) {
      console.error("Failed to load user history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchTweets();
    fetchUserHistory();
  }, []);

  // Filter tweets by current user
  const userTweets = tweets.filter((tweet: any) => tweet.author?._id === user._id || tweet.author === user._id);

  // Subscription Plans configuration
  const plans = [
    { name: "Free", price: 0, limit: 1, limitDesc: "1 tweet limit total" },
    { name: "Bronze", price: 100, limit: 3, limitDesc: "3 tweets/month" },
    { name: "Silver", price: 300, limit: 5, limitDesc: "5 tweets/month" },
    { name: "Gold", price: 1000, limit: Infinity, limitDesc: "Unlimited tweets" },
  ];

  // Timing check for payments: 10:00 AM to 11:00 AM IST
  const getPaymentTimeStatus = () => {
    const now = new Date();
    const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const hour = istDate.getHours();
    return hour === 10; // active between 10:00 - 10:59 IST
  };

  const handleSubscribeClick = (plan: any) => {
    const isWithinTime = getPaymentTimeStatus();
    if (!isWithinTime) {
      alert(t("payingRestricted") + " Current IST time: " + new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      return;
    }
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingPayment(true);
    try {
      // API call to update subscription
      const res = await axiosInstance.post("/subscribe", {
        email: user.email,
        plan: selectedPlan.name,
        price: selectedPlan.price,
      });

      if (res.data) {
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
        setPaymentSuccess(true);
        setTimeout(() => {
          setShowPaymentModal(false);
          setPaymentSuccess(false);
          setSelectedPlan(null);
        }, 3000);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Subscription failed.");
      setShowPaymentModal(false);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Notification toggle helper
  const handleNotificationToggle = async () => {
    // Request permission if not granted
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    
    try {
      const newVal = !user.notificationsEnabled;
      const res = await axiosInstance.patch(`/userupdate/${user.email}`, {
        notificationsEnabled: newVal,
      });
      if (res.data) {
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Language selector verification trigger
  const handleLanguageChangeClick = async (targetLang: LanguageType) => {
    if (targetLang === language) return;
    setPendingLanguage(targetLang);
    setLangOtpError("");
    setLangOtpCode("");
    setSimulatedSmsOtp("");
    
    setLoadingOtp(true);
    try {
      if (targetLang === "French") {
        // Send email OTP
        await axiosInstance.post("/send-otp", { email: user.email });
        setShowLanguageOtpModal(true);
      } else {
        // Require mobile authentication
        const phone = userPhoneNumber || user.mobileNumber;
        if (!phone) {
          const promptPhone = prompt("Enter your mobile number for verification:");
          if (!promptPhone) {
            setLoadingOtp(false);
            return;
          }
          setUserPhoneNumber(promptPhone);
          // Sync phone first
          await axiosInstance.patch(`/userupdate/${user.email}`, { mobileNumber: promptPhone });
          await axiosInstance.post("/send-sms-otp", { phone: promptPhone });
        } else {
          const res = await axiosInstance.post("/send-sms-otp", { phone });
          if (res.data?.code) {
            setSimulatedSmsOtp(res.data.code);
          }
        }
        setShowLanguageOtpModal(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "OTP delivery failed.");
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleVerifyLanguageOtp = async () => {
    if (!pendingLanguage) return;
    setLoadingOtp(true);
    setLangOtpError("");
    try {
      if (pendingLanguage === "French") {
        await axiosInstance.post("/verify-otp", {
          email: user.email,
          code: langOtpCode,
        });
      } else {
        const phone = userPhoneNumber || user.mobileNumber;
        await axiosInstance.post("/verify-sms-otp", {
          phone,
          code: langOtpCode,
        });
      }
      
      // Update local and backend language settings
      await setLanguage(pendingLanguage);
      setShowLanguageOtpModal(false);
      setPendingLanguage(null);
      setLangOtpCode("");
      alert("Language changed successfully to " + pendingLanguage);
    } catch (err: any) {
      setLangOtpError(err.response?.data?.error || "Invalid OTP code.");
    } finally {
      setLoadingOtp(false);
    }
  };

  return (
    <div className="min-h-screen text-white bg-black">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="flex items-center px-4 py-3 space-x-8">
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{user.displayName}</h1>
            <p className="text-sm text-gray-400">{userTweets.length} {t("posts")}</p>
          </div>
        </div>
      </div>

      {/* Profile Cover & Header */}
      <div className="relative">
        <div className="h-48 bg-gradient-to-r from-blue-600 to-purple-600 relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70"
          >
            <Camera className="h-5 w-5 text-white" />
          </Button>
        </div>

        {/* Profile Picture */}
        <div className="absolute -bottom-16 left-4">
          <Avatar className="h-32 w-32 border-4 border-black">
            <AvatarImage src={user.avatar} alt={user.displayName} />
            <AvatarFallback className="text-2xl">{user.displayName[0]}</AvatarFallback>
          </Avatar>
        </div>

        {/* Edit Profile Button */}
        <div className="flex justify-end p-4">
          <Button
            variant="outline"
            className="border-gray-600 text-white bg-gray-950 font-semibold rounded-full px-6 hover:bg-gray-900"
            onClick={() => setShowEditModal(true)}
          >
            {t("editProfile")}
          </Button>
        </div>
      </div>

      {/* Profile Details */}
      <div className="px-4 pb-4 mt-12">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {user.displayName}
              {user.plan === "Gold" && (
                <CheckCircle className="h-5 w-5 text-yellow-400 fill-current" />
              )}
              {user.plan && user.plan !== "Free" && user.plan !== "Gold" && (
                <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold py-0.5 px-2 rounded-full">
                  {user.plan}
                </span>
              )}
            </h1>
            <p className="text-gray-400">@{user.username}</p>
          </div>
        </div>

        {user.bio && <p className="text-white mb-3 leading-relaxed">{user.bio}</p>}

        <div className="flex flex-wrap gap-4 text-gray-400 text-sm mb-3">
          <div className="flex items-center space-x-1">
            <MapPin className="h-4 w-4" />
            <span>{user.location || "Earth"}</span>
          </div>
          <div className="flex items-center space-x-1">
            <LinkIcon className="h-4 w-4" />
            <span className="text-blue-400">{user.website || "example.com"}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>
              Joined{" "}
              {user.joinedDate &&
                new Date(user.joinedDate).toLocaleDateString("en-us", {
                  month: "long",
                  year: "numeric",
                })}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-transparent border-b border-gray-800 rounded-none h-auto">
          <TabsTrigger
            value="posts"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {t("posts")}
          </TabsTrigger>
          <TabsTrigger
            value="premium"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {t("upgrade")} (Premium)
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {t("loginHistory")}
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {t("settings")}
          </TabsTrigger>
        </TabsList>

        {/* POSTS TAB */}
        <TabsContent value="posts" className="mt-0">
          <div className="divide-y divide-gray-800">
            {loading ? (
              <div className="py-12 text-center text-gray-400">Loading posts...</div>
            ) : userTweets.length === 0 ? (
              <Card className="bg-black border-none">
                <CardContent className="py-12 text-center">
                  <div className="text-gray-400">
                    <h3 className="text-2xl font-bold mb-2">You haven't posted yet</h3>
                    <p>When you post, it will show up here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              userTweets.map((tweet: any) => <TweetCard key={tweet._id} tweet={tweet} />)
            )}
          </div>
        </TabsContent>

        {/* PREMIUM SUBSCRIPTIONS TAB */}
        <TabsContent value="premium" className="mt-0 p-4">
          <div className="space-y-6">
            <div className="text-center py-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Twiller Premium Subscription Portal
              </h2>
              <p className="text-gray-400 mt-2 text-sm">
                Apply for tweeting privileges. Limits are verified instantly.
              </p>
              <div className="mt-2 inline-flex items-center text-xs py-1 px-3 rounded-full border border-gray-700 bg-gray-950 font-mono">
                Payment Allowed Time: <span className="text-green-400 font-bold ml-1">10:00 AM - 11:00 AM IST</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((p) => (
                <Card key={p.name} className="bg-gray-950 border-gray-800 text-white relative overflow-hidden">
                  {user.plan === p.name && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                      {t("currentPlan")}
                    </div>
                  )}
                  <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{p.name} Plan</h3>
                      <p className="text-2xl font-black text-blue-400 mt-2">
                        ₹{p.price} <span className="text-sm text-gray-500 font-normal">/ month</span>
                      </p>
                      <ul className="text-sm text-gray-400 space-y-2 mt-4">
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          {p.limitDesc}
                        </li>
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          Simulated invoice email
                        </li>
                      </ul>
                    </div>

                    <Button
                      disabled={user.plan === p.name || p.name === "Free"}
                      onClick={() => handleSubscribeClick(p)}
                      className={`w-full font-bold rounded-full mt-4 ${
                        user.plan === p.name
                          ? "bg-gray-800 text-gray-400 cursor-default"
                          : "bg-blue-500 hover:bg-blue-600 text-white"
                      }`}
                    >
                      {user.plan === p.name ? t("currentPlan") : p.name === "Free" ? "Default" : t("upgrade")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* LOGIN HISTORY TAB */}
        <TabsContent value="history" className="mt-0 p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Your Login Sessions</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUserHistory}
                disabled={loadingHistory}
                className="border-gray-800 hover:bg-gray-900"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingHistory ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-950">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-gray-900 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Browser</th>
                    <th className="px-6 py-3">OS</th>
                    <th className="px-6 py-3">Device</th>
                    <th className="px-6 py-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No login history found.
                      </td>
                    </tr>
                  ) : (
                    [...history].reverse().map((h, i) => (
                      <tr key={i} className="hover:bg-gray-900/50">
                        <td className="px-6 py-4 font-medium text-white">
                          {new Date(h.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-gray-300">{h.browser}</td>
                        <td className="px-6 py-4 text-gray-300">{h.os}</td>
                        <td className="px-6 py-4 text-gray-300">{h.device}</td>
                        <td className="px-6 py-4 font-mono text-xs text-blue-400">{h.ip}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* SETTINGS / PREFERENCES TAB */}
        <TabsContent value="settings" className="mt-0 p-4">
          <div className="space-y-6">
            <h2 className="text-xl font-bold">{t("settings")}</h2>

            {/* Notifications Toggle */}
            <div className="p-4 border border-gray-800 rounded-xl bg-gray-950 flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-bold text-white flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-400" />
                  Browser notifications
                </Label>
                <p className="text-sm text-gray-400">
                  Pop up desktop notifications for tweets with keywords "cricket" and "science".
                </p>
              </div>
              <input
                type="checkbox"
                checked={!!user.notificationsEnabled}
                onChange={handleNotificationToggle}
                className="h-6 w-6 rounded border-gray-700 bg-black text-blue-500 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Language Selector */}
            <div className="p-4 border border-gray-800 rounded-xl bg-gray-950 space-y-4">
              <div className="space-y-1">
                <Label className="text-base font-bold text-white flex items-center gap-2">
                  <Globe className="h-5 w-5 text-purple-400" />
                  {t("chooseLanguage")}
                </Label>
                <p className="text-sm text-gray-400">
                  Translate the entire layout. Switching languages triggers verification.
                </p>
              </div>

              <div className="flex gap-2">
                <select
                  value={language}
                  onChange={(e) => handleLanguageChangeClick(e.target.value as LanguageType)}
                  className="bg-black border border-gray-800 text-white rounded-lg p-2 flex-1 focus:border-blue-500 focus:outline-none"
                  disabled={loadingOtp}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish (Español)</option>
                  <option value="Hindi">Hindi (हिन्दी)</option>
                  <option value="Portuguese">Portuguese (Português)</option>
                  <option value="Chinese">Chinese (中文)</option>
                  <option value="French">French (Français)</option>
                </select>
              </div>
              
              <div className="space-y-2 mt-2">
                <Label className="text-gray-400 text-xs">Verification Phone Number (For other languages)</Label>
                <div className="flex gap-2">
                  <Smartphone className="text-gray-500 h-5 w-5 mt-2" />
                  <Input
                    type="text"
                    placeholder="Enter phone for SMS simulation"
                    value={userPhoneNumber}
                    onChange={(e) => {
                      setUserPhoneNumber(e.target.value);
                      axiosInstance.patch(`/userupdate/${user.email}`, { mobileNumber: e.target.value });
                    }}
                    className="bg-transparent border-gray-800 text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Editprofile isopen={showEditModal} onclose={() => setShowEditModal(false)} />

      {/* SIMULATED CARD PAYMENT CHECKOUT MODAL */}
      {showPaymentModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-800 text-white max-w-md w-full rounded-2xl p-6 shadow-2xl relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 text-white hover:bg-gray-900"
              onClick={() => {
                if (!isProcessingPayment) setShowPaymentModal(false);
              }}
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="h-7 w-7 text-blue-500" />
              <h3 className="text-2xl font-black">Razorpay Checkout</h3>
            </div>

            {paymentSuccess ? (
              <div className="py-8 text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto animate-bounce" />
                <h4 className="text-xl font-bold">Payment Successful!</h4>
                <p className="text-sm text-gray-400">
                  Your plan has been updated to <strong>{selectedPlan.name}</strong>. An invoice email was triggered.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Plan:</span>
                    <span className="text-white font-bold">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 mt-1">
                    <span>Amount:</span>
                    <span className="text-blue-400 font-bold">₹{selectedPlan.price}.00</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Cardholder Name</Label>
                  <Input
                    required
                    type="text"
                    value={cardDetails.name}
                    onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                    className="bg-transparent border-gray-800"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Card Number</Label>
                  <Input
                    required
                    type="text"
                    value={cardDetails.number}
                    onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                    className="bg-transparent border-gray-800 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Expiry Date</Label>
                    <Input
                      required
                      type="text"
                      value={cardDetails.expiry}
                      onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                      className="bg-transparent border-gray-800 text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">CVV</Label>
                    <Input
                      required
                      type="password"
                      maxLength={3}
                      value={cardDetails.cvv}
                      onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                      className="bg-transparent border-gray-800 text-center font-mono"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="w-full bg-green-500 hover:bg-green-600 text-black font-bold h-12 rounded-full mt-4 flex items-center justify-center gap-2"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing securely...
                    </>
                  ) : (
                    `Pay ₹${selectedPlan.price}.00 Now`
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LANGUAGE SWITCH SECURITY VERIFICATION MODAL */}
      {showLanguageOtpModal && pendingLanguage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-800 text-white max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-purple-400" />
              <h3 className="text-xl font-bold">Security OTP Authentication</h3>
            </div>

            <p className="text-sm text-gray-400">
              {pendingLanguage === "French"
                ? `Enter the 6-digit OTP code sent to your email (${user.email}) to switch to French.`
                : `Enter the 6-digit OTP code sent via SMS to ${userPhoneNumber || user.mobileNumber || "your mobile"} to switch to ${pendingLanguage}.`}
            </p>

            {simulatedSmsOtp && (
              <div className="bg-yellow-950/20 border border-yellow-800/40 p-3 rounded-lg text-xs text-yellow-400 font-mono space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Smartphone className="h-4 w-4" />
                  [SIMULATED MOBILE SMS SENDER]
                </p>
                <p>Verification Code: <span className="font-black text-white bg-black px-2 py-0.5 rounded text-sm">{simulatedSmsOtp}</span></p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">One-Time Verification OTP Code</Label>
              <Input
                type="text"
                placeholder="6-digit code"
                value={langOtpCode}
                onChange={(e) => setLangOtpCode(e.target.value)}
                className="bg-transparent border-gray-800 font-mono tracking-widest text-center text-lg h-12"
              />
              {langOtpError && <p className="text-red-400 text-xs font-semibold">{langOtpError}</p>}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-800 text-white"
                onClick={() => {
                  setShowLanguageOtpModal(false);
                  setPendingLanguage(null);
                  setLangOtpCode("");
                  setSimulatedSmsOtp("");
                }}
                disabled={loadingOtp}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                onClick={handleVerifyLanguageOtp}
                disabled={loadingOtp || !langOtpCode}
              >
                Verify & Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple loader helper inline
const Loader2 = ({ className }: { className?: string }) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

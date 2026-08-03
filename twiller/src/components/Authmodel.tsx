"use client";

import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Key, ShieldAlert } from 'lucide-react';
import LoadingSpinner from './loading-spinner';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { useAuth, getClientDetails } from '@/context/AuthContext';
import TwitterLogo from './Twitterlogo';
import axiosInstance from '@/lib/axiosInstance';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { login, signup, isLoading, edgeLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: ''
  });
  
  // Custom states for Chrome OTP & Forgot Password
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resetTarget, setResetTarget] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const details = getClientDetails();
  const isChrome = details.browser === "Google Chrome";
  const isEdge = details.browser === "Microsoft Edge";

  const generateLetterOnlyPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(result);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (mode === 'signup') {
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        newErrors.username = 'Username can only contain letters, numbers, and underscores';
      }

      if (!formData.displayName.trim()) {
        newErrors.displayName = 'Display name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Forgot Password Flow
    if (mode === 'forgot-password') {
      if (!resetTarget.trim()) {
        setErrors({ resetTarget: "Email or Phone is required" });
        return;
      }
      if (!generatedPassword) {
        setErrors({ resetTarget: "Please generate a password first" });
        return;
      }
      try {
        // 1. Authorization & daily limit check on backend
        await axiosInstance.post("/forgot-password", { email: resetTarget });
        // 2. Perform reset
        await axiosInstance.post("/reset-password", { email: resetTarget, password: generatedPassword });
        setResetSuccessMessage(`Password updated successfully! Copy your new password: ${generatedPassword}`);
        setFormData(prev => ({ ...prev, email: resetTarget, password: generatedPassword }));
      } catch (err: any) {
        const errMsg = err.response?.data?.error || "Reset failed. You can only request reset once a day.";
        setErrors({ resetTarget: errMsg });
      }
      return;
    }

    // Login flow
    if (mode === 'login') {
      // Microsoft Edge direct password bypass
      if (isEdge) {
        if (!formData.email.trim()) {
          setErrors({ email: "Email is required" });
          return;
        }
        try {
          await edgeLogin(formData.email);
          onClose();
          setFormData({ email: '', password: '', username: '', displayName: '' });
          setErrors({});
        } catch (error: any) {
          setErrors({ general: error.response?.data?.error || "Microsoft direct login failed." });
        }
        return;
      }

      // Chrome Email OTP logic
      if (isChrome) {
        if (!validateForm() || isLoading) return;
        if (!otpStep) {
          try {
            await axiosInstance.post("/send-otp", { email: formData.email });
            setOtpStep(true);
            setErrors({});
          } catch (error: any) {
            setErrors({ general: "Failed to send verification code. Check email." });
          }
        } else {
          try {
            await axiosInstance.post("/verify-otp", { email: formData.email, code: otpCode });
            await login(formData.email, formData.password);
            onClose();
            setFormData({ email: '', password: '', username: '', displayName: '' });
            setOtpStep(false);
            setOtpCode("");
            setErrors({});
          } catch (error: any) {
            setErrors({ otpCode: "Invalid or expired verification code." });
          }
        }
        return;
      }

      // Regular flow for other browsers
      if (!validateForm() || isLoading) return;
      try {
        await login(formData.email, formData.password);
        onClose();
        setFormData({ email: '', password: '', username: '', displayName: '' });
        setErrors({});
      } catch (error) {
        setErrors({ general: 'Authentication failed. Please check credentials.' });
      }
    } else {
      // Signup flow
      if (!validateForm() || isLoading) return;
      try {
        await signup(formData.email, formData.password, formData.username, formData.displayName);
        onClose();
        setFormData({ email: '', password: '', username: '', displayName: '' });
        setErrors({});
      } catch (error) {
        setErrors({ general: 'Authentication failed. Please try again.' });
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const switchMode = () => {
    if (mode === 'login') {
      setMode('signup');
    } else {
      setMode('login');
    }
    setErrors({});
    setOtpStep(false);
    setOtpCode("");
    setFormData({ email: '', password: '', username: '', displayName: '' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-black border-gray-800 text-white">
        <CardHeader className="relative pb-6">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-gray-900"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <TwitterLogo size="xl" className="text-white" />
            </div>
            
            {/* Browser Tags */}
            <div className="mb-2 inline-flex items-center text-xs py-1 px-3 rounded-full border border-gray-700 font-mono bg-gray-950">
              Browser: <span className="text-blue-400 font-bold ml-1">{details.browser}</span>
            </div>

            <CardTitle className="text-2xl font-bold mt-2">
              {mode === 'login' 
                ? (isEdge ? 'Edge Direct Access' : 'Sign in to X') 
                : mode === 'signup' 
                  ? 'Create your account' 
                  : 'Forgot Password'}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {errors.general && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* FORGOT PASSWORD PANEL */}
            {mode === 'forgot-password' && (
              <div className="space-y-4">
                {resetSuccessMessage ? (
                  <div className="bg-green-950/20 border border-green-800 rounded-lg p-4 text-green-400 text-sm space-y-2">
                    <p className="font-semibold">{resetSuccessMessage}</p>
                    <p className="text-xs text-gray-400">Copy this password and click 'Back to Sign In' to log in.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="resetTarget" className="text-white">Email or Phone Number</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <Input
                          id="resetTarget"
                          type="text"
                          placeholder="your.email@domain.com or phone"
                          value={resetTarget}
                          onChange={(e) => setResetTarget(e.target.value)}
                          className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                        />
                      </div>
                      {errors.resetTarget && (
                        <p className="text-red-400 text-sm font-semibold flex items-center gap-1">
                          <ShieldAlert className="h-4 w-4" />
                          {errors.resetTarget}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white">Password Generator</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          placeholder="Generated letters-only password"
                          value={generatedPassword}
                          className="bg-gray-950 border-gray-600 text-white focus:border-blue-500 font-mono"
                        />
                        <Button 
                          type="button" 
                          onClick={generateLetterOnlyPassword}
                          className="bg-gray-800 hover:bg-gray-700 text-white"
                        >
                          <Key className="h-4 w-4 mr-1" />
                          Generate
                        </Button>
                      </div>
                    </div>
                  </>
                )}
                
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-gray-600 text-white"
                    onClick={() => {
                      setMode('login');
                      setErrors({});
                      setResetSuccessMessage("");
                      setGeneratedPassword("");
                    }}
                  >
                    Back to Sign In
                  </Button>
                  {!resetSuccessMessage && (
                    <Button
                      type="submit"
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold"
                    >
                      Reset Password
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* SIGN UP PANEL */}
            {mode === 'signup' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-white">Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Your display name"
                      value={formData.displayName}
                      onChange={(e) => handleInputChange('displayName', e.target.value)}
                      className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.displayName && (
                    <p className="text-red-400 text-sm">{errors.displayName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white">Username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">@</span>
                    <Input
                      id="username"
                      type="text"
                      placeholder="username"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      className="pl-8 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-red-400 text-sm">{errors.username}</p>
                  )}
                </div>
              </>
            )}

            {/* LOGIN PANEL OR REGULAR SIGN UP / PASSWORD */}
            {mode !== 'forgot-password' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                      disabled={isLoading || otpStep}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-sm">{errors.email}</p>
                  )}
                </div>

                {/* Password field - Bypassed for Microsoft Edge in Login mode */}
                {!(mode === 'login' && isEdge) && (
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="pl-10 pr-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                        disabled={isLoading || otpStep}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-red-400 text-sm">{errors.password}</p>
                    )}
                  </div>
                )}

                {/* Chrome OTP Verification Step */}
                {mode === 'login' && isChrome && otpStep && (
                  <div className="space-y-2 p-3 border border-blue-500/20 bg-blue-950/20 rounded-xl">
                    <Label htmlFor="otpCode" className="text-blue-300 font-bold">Verification Code (Sent to Email)</Label>
                    <Input
                      id="otpCode"
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="bg-transparent border-blue-500/40 text-white placeholder-blue-300 focus:border-blue-400 font-mono tracking-widest text-center"
                    />
                    {errors.otpCode && (
                      <p className="text-red-400 text-sm font-semibold">{errors.otpCode}</p>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-lg mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                    </div>
                  ) : (
                    mode === 'login' 
                      ? (isEdge 
                          ? 'Fast-track Access (Bypassed)' 
                          : isChrome && !otpStep 
                            ? 'Get OTP Code' 
                            : isChrome 
                              ? 'Verify & Sign In' 
                              : 'Sign in') 
                      : 'Create account'
                  )}
                </Button>
              </>
            )}
          </form>

          {mode !== 'forgot-password' && (
            <>
              {mode === 'login' && (
                <div className="text-right">
                  <Button
                    variant="link"
                    className="text-xs text-blue-400 hover:text-blue-300 p-0 h-auto"
                    onClick={() => {
                      setMode('forgot-password');
                      setErrors({});
                    }}
                  >
                    Forgot Password?
                  </Button>
                </div>
              )}

              <div className="relative">
                <Separator className="bg-gray-700" />
                <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black px-2 text-gray-400 text-sm">
                  OR
                </span>
              </div>

              <div className="text-center">
                <p className="text-gray-400">
                  {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                  <Button
                    variant="link"
                    className="text-blue-400 hover:text-blue-300 font-semibold pl-1"
                    onClick={switchMode}
                    disabled={isLoading}
                  >
                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                  </Button>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
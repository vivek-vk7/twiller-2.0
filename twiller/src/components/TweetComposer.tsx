"use client";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { 
  Image as ImageIcon, 
  Smile, 
  Calendar, 
  MapPin, 
  BarChart3, 
  Globe, 
  Mic, 
  Volume2, 
  Trash2, 
  Music, 
  Lock, 
  X,
  Loader2
} from "lucide-react";
import { Separator } from "./ui/separator";
import axios from "axios";
import axiosInstance from "@/lib/axiosInstance";

const TweetComposer = ({ onTweetPosted }: any) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageurl, setimageurl] = useState("");
  
  // Audio upload & recording states
  const [audioUrl, setAudioUrl] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  
  // Audio OTP verification states
  const [showAudioOtpModal, setShowAudioOtpModal] = useState(false);
  const [audioOtpCode, setAudioOtpCode] = useState("");
  const [isAudioOtpVerified, setIsAudioOtpVerified] = useState(false);
  const [audioOtpError, setAudioOtpError] = useState("");
  const [pendingAction, setPendingAction] = useState<"record" | "file" | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  
  const recordIntervalRef = useRef<any>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const maxLength = 200;

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!user || (!content.trim() && !audioUrl)) return;
    setIsLoading(true);
    try {
      const tweetdata = {
        author: user?._id,
        content,
        image: imageurl,
        audio: audioUrl || null,
        audioDuration: audioUrl ? audioDuration : null,
      };
      
      const res = await axiosInstance.post('/post', tweetdata);
      onTweetPosted(res.data);
      setContent("");
      setimageurl("");
      setAudioUrl("");
      setAudioDuration(0);
      setIsAudioOtpVerified(false); // reset verification for security
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to post tweet.");
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAudioTimeStatus = () => {
    const now = new Date();
    const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const hour = istDate.getHours();
    return hour >= 14 && hour < 19; // Between 2:00 PM and 7:00 PM IST (14:00 - 18:59 IST)
  };

  const checkAudioPreconditions = (action: "record" | "file"): boolean => {
    const isWithinTime = getAudioTimeStatus();
    if (!isWithinTime) {
      alert(t("audioRecordingRestricted") + " Current IST time: " + new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      return false;
    }

    if (!isAudioOtpVerified) {
      setPendingAction(action);
      triggerAudioOTP();
      return false;
    }

    return true;
  };

  const triggerAudioOTP = async () => {
    setIsLoading(true);
    try {
      await axiosInstance.post("/send-otp", { email: user?.email });
      setShowAudioOtpModal(true);
    } catch (err) {
      alert("Failed to send OTP to email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAudioOtp = async () => {
    setIsLoading(true);
    setAudioOtpError("");
    try {
      await axiosInstance.post("/verify-otp", {
        email: user?.email,
        code: audioOtpCode,
      });
      setIsAudioOtpVerified(true);
      setShowAudioOtpModal(false);
      setAudioOtpCode("");
      
      // Proceed with action
      if (pendingAction === "record") {
        startRecording();
      } else if (pendingAction === "file" && pendingFile) {
        uploadAudioFile(pendingFile);
      }
      setPendingAction(null);
      setPendingFile(null);
    } catch (err: any) {
      setAudioOtpError(err.response?.data?.error || "OTP verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      setRecordSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 300) { // Limit to 5 mins
            recorder.stop();
            clearInterval(recordIntervalRef.current);
            return 300;
          }
          return s + 1;
        });
      }, 1000);

      recorder.onstop = async () => {
        if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
        const finalDuration = recordSeconds || 1;
        
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        if (audioBlob.size > 100 * 1024 * 1024) {
          alert("Audio file size exceeds the 100MB limit.");
          return;
        }

        // Upload webm blob to server
        await uploadAudioBlob(audioBlob, finalDuration);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access failed:", err);
      alert("Microphone access is required to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const uploadAudioBlob = async (blob: Blob, durationSec: number) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    try {
      const res = await axiosInstance.post("/upload-audio", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data?.url) {
        setAudioUrl(res.data.url);
        setAudioDuration(durationSec);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Audio upload failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioFileUploadClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.size > 100 * 1024 * 1024) {
      alert("Audio file size exceeds the 100MB limit.");
      return;
    }

    if (!checkAudioPreconditions("file")) {
      setPendingFile(file);
      return;
    }

    uploadAudioFile(file);
  };

  const uploadAudioFile = async (file: File) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("audio", file, file.name);
    
    // Attempt to calculate audio duration using client side Audio object
    const objectUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(objectUrl);
    
    tempAudio.addEventListener("loadedmetadata", async () => {
      const durationSec = Math.round(tempAudio.duration);
      if (durationSec > 300) {
        alert("Audio length exceeds 5 minutes (300 seconds).");
        setIsLoading(false);
        return;
      }

      try {
        const res = await axiosInstance.post("/upload-audio", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        if (res.data?.url) {
          setAudioUrl(res.data.url);
          setAudioDuration(durationSec);
        }
      } catch (err: any) {
        alert(err.response?.data?.error || "Audio file upload failed.");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;
  
  if (!user) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsLoading(true);
    const image = e.target.files[0];
    const formdataimg = new FormData();
    formdataimg.set("image", image);
    try {
      const res = await axios.post(
        "https://api.imgbb.com/1/upload?key=97f3fb960c3520d6a88d7e29679cf96f",
        formdataimg
      );
      const url = res.data.data.display_url;
      if (url) {
        setimageurl(url);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-black border-gray-800 border-x-0 border-t-0 rounded-none">
      <CardContent className="p-4">
        <div className="flex space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar} alt={user.displayName} />
            <AvatarFallback>{user.displayName[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <form onSubmit={handleSubmit}>
              <Textarea
                placeholder={t("whatsHappening")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="bg-transparent border-none text-xl text-white placeholder-gray-500 resize-none min-h-[100px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />

              {/* Image Preview */}
              {imageurl && (
                <div className="relative mt-2 rounded-xl overflow-hidden max-h-60 border border-gray-800">
                  <img src={imageurl} alt="Uploaded preview" className="w-full h-full object-cover" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-black/60 rounded-full text-white hover:bg-black/80"
                    onClick={() => setimageurl("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Audio Preview */}
              {audioUrl && (
                <div className="mt-2 p-3 bg-gray-950 border border-gray-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400">
                      <Volume2 className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider font-mono">Voice Tweet Record</p>
                      <audio src={audioUrl} controls className="h-8 max-w-xs" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono font-bold bg-gray-900 border border-gray-800 px-2 py-1 rounded">
                      {Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, '0')} mins
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAudioUrl("");
                        setAudioDuration(0);
                      }}
                      className="text-red-500 hover:text-red-400 hover:bg-gray-900 rounded-full"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Recording Dashboard overlay inline */}
              {isRecording && (
                <div className="mt-2 p-3 bg-red-950/20 border border-red-500/30 rounded-xl flex items-center justify-between text-white animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 bg-red-500 rounded-full inline-block animate-ping" />
                    <span className="font-semibold text-red-400 font-mono">
                      Recording: {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={stopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-full font-bold px-4 text-xs h-8"
                  >
                    Stop & Upload
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-4 text-blue-400">
                  
                  {/* Photo upload */}
                  <label
                    htmlFor="tweetImage"
                    className="p-2 rounded-full hover:bg-blue-900/20 cursor-pointer"
                  >
                    <ImageIcon className="h-5 w-5" />
                    <input
                      type="file"
                      accept="image/*"
                      id="tweetImage"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isLoading || isRecording}
                    />
                  </label>

                  {/* Micro recording triggers */}
                  <button
                    type="button"
                    onClick={() => {
                      if (checkAudioPreconditions("record")) {
                        startRecording();
                      }
                    }}
                    disabled={isRecording}
                    className="p-2 rounded-full hover:bg-blue-900/20 text-blue-400 border-none bg-transparent cursor-pointer disabled:opacity-40"
                  >
                    <Mic className="h-5 w-5" />
                  </button>

                  {/* Audio file upload trigger */}
                  <label
                    htmlFor="tweetAudioFile"
                    className="p-2 rounded-full hover:bg-blue-900/20 cursor-pointer"
                  >
                    <Music className="h-5 w-5 text-blue-400" />
                    <input
                      type="file"
                      accept="audio/*"
                      id="tweetAudioFile"
                      className="hidden"
                      onChange={handleAudioFileUploadClick}
                      disabled={isLoading || isRecording}
                    />
                  </label>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20"
                    disabled={isRecording}
                  >
                    <BarChart3 className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20"
                    disabled={isRecording}
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20"
                    disabled={isRecording}
                  >
                    <Calendar className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20"
                    disabled={isRecording}
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-blue-400 font-semibold">
                      Everyone can reply
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {characterCount > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className="relative w-8 h-8">
                          <svg className="w-8 h-8 transform -rotate-90">
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              className="text-gray-700"
                            />
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 14}`}
                              strokeDashoffset={`${
                                2 *
                                Math.PI *
                                14 *
                                (1 - characterCount / maxLength)
                              }`}
                              className={
                                isOverLimit
                                  ? "text-red-500"
                                  : isNearLimit
                                  ? "text-yellow-500"
                                  : "text-blue-500"
                              }
                            />
                          </svg>
                        </div>
                        {isNearLimit && (
                          <span
                            className={`text-sm ${
                              isOverLimit ? "text-red-500" : "text-yellow-500"
                            }`}
                          >
                            {maxLength - characterCount}
                          </span>
                        )}
                      </div>
                    )}
                    <Separator
                      orientation="vertical"
                      className="h-6 bg-gray-700"
                    />

                    <Button
                      type="submit"
                      disabled={(!content.trim() && !audioUrl) || isOverLimit || isLoading || isRecording}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-full px-6"
                    >
                      {isLoading ? "Posting..." : t("post")}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </CardContent>

      {/* AUDIO OTP AUTHENTICATION DIALOG */}
      {showAudioOtpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-800 text-white max-w-sm w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-blue-400" />
              <h3 className="text-xl font-bold">Audio Upload Security</h3>
            </div>
            
            <p className="text-sm text-gray-400">
              An OTP has been sent to your email <strong>{user?.email}</strong>. Enter it to authorize recording/uploading audio tweets.
            </p>

            <div className="space-y-1">
              <Label className="text-xs">One-Time OTP Code</Label>
              <Input
                type="text"
                placeholder="6-digit code"
                value={audioOtpCode}
                onChange={(e) => setAudioOtpCode(e.target.value)}
                className="bg-transparent border-gray-800 font-mono tracking-widest text-center text-lg h-12"
              />
              {audioOtpError && <p className="text-red-400 text-xs font-semibold">{audioOtpError}</p>}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-800 text-white"
                onClick={() => {
                  setShowAudioOtpModal(false);
                  setAudioOtpCode("");
                  setAudioOtpError("");
                  setPendingAction(null);
                  setPendingFile(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold"
                onClick={handleVerifyAudioOtp}
                disabled={isLoading || !audioOtpCode}
              >
                Verify
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default TweetComposer;

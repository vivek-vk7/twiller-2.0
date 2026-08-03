import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import multer from "multer";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import User from "./models/user.js";
import Tweet from "./models/tweet.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const audioUploadDir = path.join(uploadDir, "audio");
if (!fs.existsSync(audioUploadDir)) {
  fs.mkdirSync(audioUploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

const emailsDir = path.join(__dirname, "sent_emails");
if (!fs.existsSync(emailsDir)) {
  fs.mkdirSync(emailsDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Nodemailer Config
let transporter;
try {
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: "ethereal.user@ethereal.email",
      pass: "ethereal.pass"
    }
  });
} catch (e) {
  console.log("Transporter creation failed, using mock mode:", e.message);
}

// In-memory OTP storage
const otps = new Map();
const smsOtps = new Map();

async function sendInvoiceEmail(email, planName, amount, invoiceId) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #fcfcfc;">
      <div style="text-align: center; border-bottom: 2px solid #1da1f2; padding-bottom: 10px;">
        <h1 style="color: #1da1f2; margin: 0;">TWILLER PREMIUM INVOICE</h1>
        <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">Thank you for your subscription!</p>
      </div>
      <div style="padding: 20px 0; line-height: 1.6; color: #333;">
        <p><strong>Hi there,</strong></p>
        <p>Your subscription to the <strong>${planName} Plan</strong> was successful. Here are your transaction details:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Twiller ${planName} Plan (Monthly Subscription)</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${amount}.00</td>
          </tr>
          <tr style="font-weight: bold; background-color: #e6f4fe;">
            <td style="padding: 10px; border: 1px solid #ddd;">Total Paid</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${amount}.00</td>
          </tr>
        </table>
        <div style="margin-top: 20px; font-size: 13px; color: #555;">
          <p><strong>Invoice ID:</strong> ${invoiceId}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Payment Status:</strong> Paid (via Simulated Gateway)</p>
        </div>
      </div>
      <div style="text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px;">
        <p>If you have any questions, contact billing@twiller.app</p>
        <p>&copy; ${new Date().getFullYear()} Twiller, Inc.</p>
      </div>
    </div>
  `;

  const emailFilename = `invoice-${email.replace(/[@.]/g, "_")}-${Date.now()}.html`;
  fs.writeFileSync(path.join(emailsDir, emailFilename), htmlContent, "utf8");
  console.log(`✉️ Local invoice backup saved to: ${path.join(emailsDir, emailFilename)}`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: '"Twiller Billing" <billing@twiller.app>',
        to: email,
        subject: `Your Twiller Invoice - ${planName} Plan`,
        html: htmlContent
      });
      console.log(`✉️ Invoice email sent successfully to ${email}`);
    } catch (err) {
      console.error("Could not send mail via Ethereal SMTP, but saved local copy:", err.message);
    }
  }
}

async function sendOTPEmail(email, code) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #1da1f2;">Twiller Security Verification</h2>
      <p>Hello,</p>
      <p>Your one-time verification code is:</p>
      <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; border-radius: 5px; margin: 20px 0;">
        ${code}
      </div>
      <p>This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin-top: 25px;">
      <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Twiller Security Team</p>
    </div>
  `;

  const emailFilename = `otp-${email.replace(/[@.]/g, "_")}-${Date.now()}.html`;
  fs.writeFileSync(path.join(emailsDir, emailFilename), htmlContent, "utf8");
  console.log(`✉️ Local OTP backup saved to: ${path.join(emailsDir, emailFilename)}`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: '"Twiller Security" <security@twiller.app>',
        to: email,
        subject: "Your Twiller OTP Code",
        html: htmlContent
      });
    } catch (err) {
      console.error("Could not send SMTP OTP:", err.message);
    }
  }
}

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL;

mongoose
  .connect(url)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

//Register
app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    const newUser = new User(req.body);
    await newUser.save();
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// loggedinuser
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ error: "Email required" });
    }
    const user = await User.findOne({ email: email });
    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// update Profile
app.patch("/userupdate/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: req.body },
      { new: true, upsert: false }
    );
    return res.status(200).send(updated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// Tweet API

// POST
app.post("/post", async (req, res) => {
  try {
    const { author } = req.body;
    if (!author) {
      return res.status(400).send({ error: "Author required" });
    }
    const user = await User.findById(author);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Verify limits
    const tweetCount = await Tweet.countDocuments({ author: author });
    let limit = 1; // default Free
    if (user.plan === "Bronze") limit = 3;
    else if (user.plan === "Silver") limit = 5;
    else if (user.plan === "Gold") limit = Infinity;

    if (tweetCount >= limit) {
      return res.status(403).send({
        error: `Tweet limit reached for your ${user.plan} plan (${limit} tweet${limit > 1 ? "s" : ""}). Please upgrade your subscription.`
      });
    }

    const tweet = new Tweet(req.body);
    await tweet.save();
    return res.status(201).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Timing check helper
function getISTTimeInfo() {
  const now = new Date();
  const istDateString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istDateString);
  return {
    hour: istDate.getHours(),
    minute: istDate.getMinutes(),
    timeString: istDate.toLocaleTimeString("en-US", { hour12: false })
  };
}

// Subscribe API
app.post("/subscribe", async (req, res) => {
  try {
    const { email, plan, price } = req.body;
    
    // Time constraint check (10:00 AM to 11:00 AM IST)
    const { hour } = getISTTimeInfo();
    if (hour !== 10) {
      return res.status(400).send({
        error: "Subscription payments are only allowed between 10:00 AM and 11:00 AM IST."
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      {
        plan,
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send({ error: "User not found" });
    }

    // Send invoice email
    const invoiceId = "INV-" + Math.floor(100000 + Math.random() * 900000);
    await sendInvoiceEmail(email, plan, price, invoiceId);

    return res.status(200).send(updatedUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Login History Logging
app.post("/login-history", async (req, res) => {
  try {
    const { email, browser, os, device } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    
    const user = await User.findOneAndUpdate(
      { email },
      {
        $push: {
          loginHistory: {
            ip,
            browser,
            os,
            device,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );
    
    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Forgot Password API
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Check request limits (1 time a day)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentRequests = user.forgotPasswordRequests.filter(d => new Date(d) > oneDayAgo);
    
    if (recentRequests.length >= 1) {
      return res.status(429).send({ error: "use only one time" });
    }

    // Save request timestamp
    await User.findOneAndUpdate(
      { email },
      { $push: { forgotPasswordRequests: now } }
    );

    return res.status(200).send({ success: true, message: "Password reset authorized. Use the password generator to complete." });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔐 Password reset requested for ${email}. New Password (simulated): ${password}`);
    return res.status(200).send({ success: true, message: "Password updated successfully." });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// OTP Operations
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send({ error: "Email is required" });
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(email, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
    
    await sendOTPEmail(email, code);
    return res.status(200).send({ success: true, message: "Verification code sent to your email." });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = otps.get(email);
    
    if (!record || record.code !== code || record.expiresAt < Date.now()) {
      return res.status(400).send({ error: "Invalid or expired OTP" });
    }
    
    otps.delete(email);
    return res.status(200).send({ success: true });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Mobile Verification SMS Simulation
app.post("/send-sms-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).send({ error: "Phone number is required" });
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    smsOtps.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
    
    console.log(`📱 [SIMULATED SMS] Sent OTP ${code} to mobile ${phone}`);
    return res.status(200).send({ success: true, code, message: `Simulated SMS sent. Code: ${code}` });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/verify-sms-otp", async (req, res) => {
  try {
    const { phone, code } = req.body;
    const record = smsOtps.get(phone);
    
    if (!record || record.code !== code || record.expiresAt < Date.now()) {
      return res.status(400).send({ error: "Invalid or expired mobile OTP" });
    }
    
    smsOtps.delete(phone);
    return res.status(200).send({ success: true });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Audio Upload Route
app.post("/upload-audio", (req, res) => {
  // Check timing limits (2 PM to 7 PM IST)
  const { hour } = getISTTimeInfo();
  if (hour < 14 || hour >= 19) {
    return res.status(400).send({ error: "Audio uploads are only allowed between 2:00 PM and 7:00 PM IST." });
  }

  upload.single("audio")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).send({ error: "Audio file size cannot exceed 100MB." });
      }
      return res.status(400).send({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).send({ error: "No audio file uploaded." });
    }
    
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/audio/${req.file.filename}`;
    res.send({ url: fileUrl });
  });
});
// get all tweet
app.get("/post", async (req, res) => {
  try {
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
//  LIKE TWEET
app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.likedBy.includes(userId)) {
      tweet.likes += 1;
      tweet.likedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// retweet 
app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.retweetedBy.includes(userId)) {
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
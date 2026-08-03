import mongoose from "mongoose";
const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  joinedDate: { type: Date, default: Date.now() },
  plan: { type: String, default: "Free", enum: ["Free", "Bronze", "Silver", "Gold"] },
  subscriptionStartDate: { type: Date, default: Date.now },
  subscriptionEndDate: { type: Date },
  loginHistory: [{
    ip: String,
    browser: String,
    os: String,
    device: String,
    timestamp: { type: Date, default: Date.now }
  }],
  notificationsEnabled: { type: Boolean, default: true },
  language: { type: String, default: "English" },
  mobileNumber: { type: String, default: "" },
  forgotPasswordRequests: [{ type: Date }]
});

export default mongoose.model("User", UserSchema);


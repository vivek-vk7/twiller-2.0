
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// keep your credentials 
const firebaseConfig = {
  apiKey: "AIzaSyBY-9PxZ3AFlYYmIwYR5JTP0dyMpks69us",
  authDomain: "twiller-3beca.firebaseapp.com",
  projectId: "twiller-3beca",
  storageBucket: "twiller-3beca.firebasestorage.app",
  messagingSenderId: "977029499165",
  appId: "1:977029499165:web:18af503411bd9eed6739f4",
  measurementId: "G-FBVJM3GRFR"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;

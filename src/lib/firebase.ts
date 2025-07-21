import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA-T5ol6OAsE86Un76Hd57RW7yxH-2kcNs",
  authDomain: "mundimaxai.firebaseapp.com",
  projectId: "mundimaxai",
  storageBucket: "mundimaxai.firebasestorage.app",
  messagingSenderId: "107105351606",
  appId: "1:107105351606:web:ad77bcf9dac7d860803317"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
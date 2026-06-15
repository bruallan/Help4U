import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testMaxDate() {
  const salesQuery = await getDocs(collection(db, "sales"));
  
  let maxDate = new Date();
  maxDate.setUTCDate(maxDate.getUTCDate() - 60);
  maxDate.setUTCHours(0, 0, 0, 0);
  
  salesQuery.forEach((docSnapshot) => {
    const d = new Date(docSnapshot.data().dayDate);
    if (d > maxDate) maxDate = d;
  });

  console.log("Found " + salesQuery.size + " docs.");
  console.log("Max date in DB is: " + maxDate.toISOString());
}

testMaxDate().catch(console.error);

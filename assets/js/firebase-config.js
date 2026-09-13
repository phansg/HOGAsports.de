import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAcxbhB8g1sdoa65gRf1-XLIN8kEuUc_BI',
  authDomain: 'hogasports.firebaseapp.com',
  projectId: 'hogasports',
  storageBucket: 'hogasports.firebasestorage.app',
  messagingSenderId: '459195863801',
  appId: '1:459195863801:web:9ab693911af47149520828',
  measurementId: 'G-4LV26R1E4F'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

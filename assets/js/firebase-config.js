import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
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

const app = getApps().some(a=>a.name==='[DEFAULT]') ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function isolatedFirebase(name){
  const isolatedApp=getApps().some(a=>a.name===name) ? getApp(name) : initializeApp(firebaseConfig,name);
  return {app:isolatedApp,auth:getAuth(isolatedApp),db:getFirestore(isolatedApp)};
}
const vereinsmanagerFirebase=isolatedFirebase('hogasports-vereinsmanager');
const mitgliederportalFirebase=isolatedFirebase('hogasports-mitgliederportal');

export { app, auth, db, vereinsmanagerFirebase, mitgliederportalFirebase };

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

// Identity-Platform-Mandant des HOGAsports-Kundenportals. Die Administration
// und die Produktanwendungen verwenden weiterhin ihre bisherigen Auth-Bereiche.
const HOGA_CUSTOMER_TENANT_ID = 'HOGAsports-Kunden-l44xy';
// Mit der tatsächlichen Mandanten-ID aus Identity Platform ersetzen.
const HOGA_VEREINSMANAGER_TENANT_ID = 'Vereinsmanager-Web-lz622';

function isolatedFirebase(name){
  const isolatedApp=getApps().some(a=>a.name===name) ? getApp(name) : initializeApp(firebaseConfig,name);
  return {app:isolatedApp,auth:getAuth(isolatedApp),db:getFirestore(isolatedApp)};
}
const vereinsmanagerFirebase=isolatedFirebase('hogasports-vereinsmanager');
const mitgliederportalFirebase=isolatedFirebase('hogasports-mitgliederportal');
const kundenportalFirebase=isolatedFirebase('hogasports-kundenportal');
kundenportalFirebase.auth.tenantId=HOGA_CUSTOMER_TENANT_ID;
vereinsmanagerFirebase.auth.tenantId=HOGA_VEREINSMANAGER_TENANT_ID;

export { app, auth, db, kundenportalFirebase, vereinsmanagerFirebase, mitgliederportalFirebase, HOGA_CUSTOMER_TENANT_ID, HOGA_VEREINSMANAGER_TENANT_ID };

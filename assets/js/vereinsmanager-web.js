import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const loading=document.querySelector('#vmwLoading');
const app=document.querySelector('#vmwApp');
const errorBox=document.querySelector('#vmwError');
function fail(text){loading.hidden=true;app.hidden=true;errorBox.hidden=false;errorBox.innerHTML=`<strong>Zugriff nicht möglich.</strong><br>${text}<br><br><a class="btn btn-secondary btn-small" href="kunde.html">Zurück zum Kundenportal</a>`;}
function setAll(selector,value){document.querySelectorAll(selector).forEach(el=>el.textContent=value||'–');}
function activeLicense(l){return ['active','aktiv'].includes(String(l.status||'').toLowerCase());}
function isManagerWeb(l){return /vereinsmanager\s*web/i.test(String(l.productName||l.product||''));}

document.querySelector('[data-vmw-logout]')?.addEventListener('click',async()=>{await signOut(auth);window.location.replace('login.html');});

onAuthStateChanged(auth,async user=>{
  if(!user){window.location.replace('login.html');return;}
  try{
    const profileSnap=await getDoc(doc(db,'users',user.uid));
    if(!profileSnap.exists()) return fail('Für diesen Firebase-Zugang ist kein HOGAsports-Benutzerprofil hinterlegt.');
    const profile=profileSnap.data();
    if(profile.active===false) return fail('Dieser HOGAsports-Zugang ist deaktiviert.');
    const role=String(profile.role||'').toLowerCase();
    if(!['customer_admin','customer','tournament_manager'].includes(role)) return fail('Dieser Zugang ist keinem Kundenbereich zugeordnet.');
    const customerId=String(profile.customerId||'');
    if(!customerId) return fail('Dem Benutzer ist noch kein Kunde/Verein zugeordnet.');
    const [customerSnap,licenseSnap]=await Promise.all([
      getDoc(doc(db,'customers',customerId)),
      getDocs(query(collection(db,'licenses'),where('customerId','==',customerId)))
    ]);
    if(!customerSnap.exists()) return fail('Der zugeordnete Verein wurde nicht gefunden.');
    const licenses=licenseSnap.docs.map(d=>({id:d.id,...d.data()}));
    if(!licenses.some(l=>activeLicense(l)&&isManagerWeb(l))) return fail('Für diesen Verein ist keine aktive Lizenz „Vereinsmanager Web“ freigeschaltet.');
    const customer=customerSnap.data();
    setAll('[data-vmw-user]',profile.displayName||user.displayName||'Benutzer');
    setAll('[data-vmw-email]',profile.email||user.email||'');
    setAll('[data-vmw-club]',customer.name||customer.clubName||'Ihr Verein');
    loading.hidden=true;errorBox.hidden=true;app.hidden=false;
  }catch(err){console.error(err);fail('Die Daten konnten nicht geladen werden. Bitte prüfen Sie Verbindung und Firestore-Regeln.');}
});

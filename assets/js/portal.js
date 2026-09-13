import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const pageRole = document.body.dataset.portalRole;
const loading = document.querySelector('#portalLoading');
const content = document.querySelector('#portalContent');
const nameEl = document.querySelector('[data-user-name]');
const emailEl = document.querySelector('[data-user-email]');
const roleEl = document.querySelector('[data-user-role]');
const logoutButtons = document.querySelectorAll('[data-logout]');

function roleAllowed(role) {
  if (pageRole === 'admin') return role === 'admin';
  if (pageRole === 'customer') return ['customer', 'customer_admin', 'tournament_manager'].includes(role);
  return false;
}

logoutButtons.forEach(btn => btn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.replace('login.html');
}));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace('login.html');
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) throw new Error('Kein Benutzerprofil');
    const data = snap.data();
    const role = String(data.role || '').toLowerCase();
    if (data.active === false || !roleAllowed(role)) {
      await signOut(auth);
      window.location.replace('login.html');
      return;
    }

    if (nameEl) nameEl.textContent = data.displayName || data.name || user.email?.split('@')[0] || 'Benutzer';
    if (emailEl) emailEl.textContent = user.email || '';
    if (roleEl) roleEl.textContent = role === 'admin' ? 'Administrator' : role === 'customer_admin' ? 'Kunden-Administrator' : role === 'tournament_manager' ? 'Turnierleiter' : 'Kunde';
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  } catch (error) {
    console.error(error);
    await signOut(auth);
    window.location.replace('login.html');
  }
});

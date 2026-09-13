import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const form = document.querySelector('#loginForm');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const message = document.querySelector('#authMessage');
const submitBtn = document.querySelector('#loginSubmit');
const resetBtn = document.querySelector('#resetPassword');

function showMessage(text, type = 'error') {
  if (!message) return;
  message.hidden = false;
  message.className = `auth-message ${type}`;
  message.textContent = text;
}

function setBusy(busy) {
  if (!submitBtn) return;
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? 'Anmeldung läuft …' : 'Anmelden';
}

async function routeUser(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await signOut(auth);
    showMessage(`Für diesen Zugang ist noch keine HOGAsports-Rolle hinterlegt. UID: ${user.uid}`);
    return;
  }

  const data = snap.data();
  if (data.active === false) {
    await signOut(auth);
    showMessage('Dieser Zugang ist derzeit deaktiviert. Bitte wenden Sie sich an HOGAsports.');
    return;
  }

  const role = String(data.role || '').toLowerCase();
  if (role === 'admin') {
    window.location.replace('admin.html');
    return;
  }
  if (role === 'customer_admin' || role === 'tournament_manager' || role === 'customer') {
    window.location.replace('kunde.html');
    return;
  }

  await signOut(auth);
  showMessage('Für diesen Zugang ist keine gültige Rolle hinterlegt.');
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.hidden = true;
    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
      await routeUser(credential.user);
    } catch (error) {
      console.error(error);
      const code = error?.code || '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        showMessage('E-Mail-Adresse oder Passwort ist nicht korrekt.');
      } else if (code.includes('too-many-requests')) {
        showMessage('Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.');
      } else {
        showMessage('Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.');
      }
      setBusy(false);
    }
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', async () => {
    const email = emailInput?.value.trim();
    if (!email) {
      showMessage('Bitte tragen Sie zuerst Ihre E-Mail-Adresse ein.');
      emailInput?.focus();
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showMessage('Die E-Mail zum Zurücksetzen des Passworts wurde versendet.', 'success');
    } catch (error) {
      console.error(error);
      showMessage('Die E-Mail zum Zurücksetzen konnte nicht versendet werden.');
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user && !form?.dataset.submitting) {
    try { await routeUser(user); } catch (error) { console.error(error); }
  }
});

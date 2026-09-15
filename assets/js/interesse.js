import { app } from './firebase-config.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

const functions = getFunctions(app, 'europe-west1');
const submitHogaInterest = httpsCallable(functions, 'submitHogaInterest');
const form = document.querySelector('#interestForm');
const messageBox = document.querySelector('#interestFormMessage');
const RECAPTCHA_SITE_KEY = '6LdfibstAAAAAPDgqdnThbFlBke2A5mGzy02OKE-';

function showMessage(text, type = 'info') {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.hidden = false;
  messageBox.classList.toggle('error', type === 'error');
  messageBox.classList.toggle('success', type === 'success');
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const fd = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  const originalText = submit?.textContent || 'Interesse unverbindlich senden';
  let recaptchaToken = '';
  try {
    await new Promise((resolve) => grecaptcha.ready(resolve));
    recaptchaToken = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'interest_submit' });
  } catch (error) {
    console.error('reCAPTCHA konnte nicht gestartet werden', error);
    showMessage('Die Sicherheitsprüfung konnte nicht gestartet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.', 'error');
    return;
  }

  const payload = {
    organization: String(fd.get('verein') || '').trim(),
    contactName: String(fd.get('ansprechpartner') || '').trim(),
    email: String(fd.get('email') || '').trim(),
    phone: String(fd.get('telefon') || '').trim(),
    product: String(fd.get('produkt') || '').trim(),
    sport: String(fd.get('sportart') || '').trim(),
    message: String(fd.get('nachricht') || '').trim(),
    website: String(fd.get('website') || '').trim(),
    privacyAccepted: fd.get('datenschutz') === '1',
    newsletterAccepted: fd.get('newsletter') === '1',
    recaptchaToken,
  };

  if (submit) { submit.disabled = true; submit.textContent = 'Anfrage wird gesendet …'; }
  showMessage('Ihre Anfrage wird sicher übermittelt …');

  try {
    await submitHogaInterest(payload);
    form.reset();
    showMessage('Vielen Dank! Ihre unverbindliche Interessenvormerkung wurde an HOGAsports gesendet. Eine Bestätigung wurde an Ihre E-Mail-Adresse verschickt.', 'success');
    messageBox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    console.error(error);
    const code = String(error?.code || '');
    const text = String(error?.message || '');
    if (code.includes('permission-denied') || code.includes('failed-precondition')) {
      showMessage('Die Sicherheitsprüfung war nicht erfolgreich. Bitte laden Sie die Seite neu und versuchen Sie es erneut.', 'error');
    } else if (code.includes('resource-exhausted')) {
      showMessage('Diese Anfrage wurde gerade bereits übermittelt. Bitte prüfen Sie auch Ihren E-Mail-Posteingang.', 'error');
    } else if (code.includes('invalid-argument')) {
      showMessage(text.replace(/^FirebaseError:\s*/,'') || 'Bitte prüfen Sie Ihre Eingaben.', 'error');
    } else {
      showMessage('Die Anfrage konnte nicht vollständig versendet werden. Bitte versuchen Sie es später erneut oder schreiben Sie an service@hogasports.de.', 'error');
    }
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = originalText; }
  }
});

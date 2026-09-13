import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const pageRole = document.body.dataset.portalRole;
const loading = document.querySelector('#portalLoading');
const content = document.querySelector('#portalContent');
const nameEls = document.querySelectorAll('[data-user-name]');
const emailEls = document.querySelectorAll('[data-user-email]');
const roleEls = document.querySelectorAll('[data-user-role]');
const logoutButtons = document.querySelectorAll('[data-logout]');

function roleAllowed(role) {
  if (pageRole === 'admin') return role === 'admin';
  if (pageRole === 'customer') return ['customer', 'customer_admin', 'tournament_manager'].includes(role);
  return false;
}
function roleLabel(role) {
  return role === 'admin' ? 'Administrator' : role === 'customer_admin' ? 'Kunden-Administrator' : role === 'tournament_manager' ? 'Turnierleiter' : 'Kunde';
}
function escapeHtml(value='') { const d=document.createElement('div'); d.textContent=String(value); return d.innerHTML; }
function dateText(value) {
  if (!value) return '–';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : new Intl.DateTimeFormat('de-DE').format(date);
}
function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(number) : '–';
}
function statusClass(status='') {
  const s=String(status).toLowerCase();
  if (['active','aktiv','paid','bezahlt'].includes(s)) return 'status-available';
  if (['expired','abgelaufen','cancelled','gekündigt','overdue','offen'].includes(s)) return 'status-dev';
  return 'status-date';
}
function showPortalMessage(text) { const el=document.querySelector('#portalMessage'); if(el){el.textContent=text;el.hidden=false;} }

logoutButtons.forEach(btn => btn.addEventListener('click', async () => { await signOut(auth); window.location.replace('login.html'); }));

document.querySelectorAll('[data-portal-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-portal-tab]').forEach(b => b.classList.toggle('active', b === button));
  document.querySelectorAll('[data-portal-panel]').forEach(panel => { panel.hidden = panel.dataset.portalPanel !== button.dataset.portalTab; });
}));

async function loadCustomerPortal(user, profile, role) {
  const customerId = profile.customerId;
  if (!customerId) { showPortalMessage('Dieser Zugang ist noch keinem Kunden zugeordnet. Bitte wenden Sie sich an HOGAsports.'); return; }
  const customerSnap = await getDoc(doc(db,'customers',customerId));
  const customer = customerSnap.exists() ? customerSnap.data() : {};
  document.querySelectorAll('[data-customer-name]').forEach(el => el.textContent = customer.name || customer.clubName || 'Ihr Verein');

  const [licenseSnap, memberSnap, invoiceSnap] = await Promise.all([
    getDocs(query(collection(db,'licenses'), where('customerId','==',customerId))),
    getDocs(query(collection(db,'users'), where('customerId','==',customerId))),
    getDocs(query(collection(db,'invoices'), where('customerId','==',customerId)))
  ]);
  const licenses = licenseSnap.docs.map(d=>({id:d.id,...d.data()}));
  const members = memberSnap.docs.map(d=>({id:d.id,...d.data()}));
  const invoices = invoiceSnap.docs.map(d=>({id:d.id,...d.data()}));
  const activeCount = licenses.filter(x => ['active','aktiv'].includes(String(x.status||'').toLowerCase())).length;
  const setText=(sel,val)=>{const el=document.querySelector(sel);if(el)el.textContent=val;};
  setText('[data-license-count]',activeCount); setText('[data-member-count]',members.length); setText('[data-invoice-count]',invoices.length);

  const licenseList=document.querySelector('#licenseList');
  if (licenseList) licenseList.innerHTML = licenses.length ? licenses.sort((a,b)=>String(a.productName||'').localeCompare(String(b.productName||''))).map(l=>`<article class="license-card"><div><span class="status ${statusClass(l.status)}">${escapeHtml(l.statusLabel||l.status||'Geplant')}</span><h3>${escapeHtml(l.productName||l.product||'HOGAsports Lizenz')}</h3><p>${escapeHtml(l.sport||'Sportart noch nicht hinterlegt')}</p></div><dl><div><dt>Lizenznummer</dt><dd>${escapeHtml(l.licenseNumber||'–')}</dd></div><div><dt>Beginn</dt><dd>${dateText(l.startDate)}</dd></div><div><dt>Ende</dt><dd>${dateText(l.endDate)}</dd></div></dl></article>`).join('') : '<div class="empty-state"><strong>Noch keine Lizenz hinterlegt.</strong><span>Gebuchte HOGAsports-Produkte erscheinen später automatisch hier.</span></div>';

  const memberList=document.querySelector('#memberList');
  if (memberList) memberList.innerHTML = members.length ? `<table class="portal-table"><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th></tr></thead><tbody>${members.map(m=>`<tr><td>${escapeHtml(m.displayName||m.name||'–')}</td><td>${escapeHtml(m.email||'–')}</td><td>${escapeHtml(roleLabel(String(m.role||'customer').toLowerCase()))}</td><td><span class="status ${m.active===false?'status-dev':'status-available'}">${m.active===false?'Gesperrt':'Aktiv'}</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Keine Benutzer gefunden.</div>';
  const hint=document.querySelector('[data-user-admin-hint]'); if(hint) hint.textContent = role==='customer_admin' ? 'Verwaltung wird vorbereitet' : 'Nur Ansicht';

  const invoiceList=document.querySelector('#invoiceList');
  invoices.sort((a,b)=>String(b.invoiceDate||'').localeCompare(String(a.invoiceDate||'')));
  if (invoiceList) invoiceList.innerHTML = invoices.length ? `<table class="portal-table"><thead><tr><th>Rechnung</th><th>Datum</th><th>Betrag</th><th>Status</th><th></th></tr></thead><tbody>${invoices.map(i=>`<tr><td>${escapeHtml(i.invoiceNumber||i.id)}</td><td>${dateText(i.invoiceDate)}</td><td>${money(i.totalAmount??i.amount)}</td><td><span class="status ${statusClass(i.paymentStatus||i.status)}">${escapeHtml(i.paymentStatusLabel||i.paymentStatus||i.status||'Offen')}</span></td><td>${i.pdfUrl?`<a class="text-link" href="${escapeHtml(i.pdfUrl)}" target="_blank" rel="noopener">PDF öffnen</a>`:'<span class="muted-text">PDF folgt</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><strong>Noch keine Rechnung vorhanden.</strong><span>Rechnungen werden nach einer Buchung hier bereitgestellt.</span></div>';
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace('login.html'); return; }
  try {
    const snap=await getDoc(doc(db,'users',user.uid)); if(!snap.exists()) throw new Error('Kein Benutzerprofil');
    const data=snap.data(); const role=String(data.role||'').toLowerCase();
    if(data.active===false || !roleAllowed(role)){ await signOut(auth); window.location.replace('login.html'); return; }
    const displayName=data.displayName||data.name||user.email?.split('@')[0]||'Benutzer';
    nameEls.forEach(el=>el.textContent=displayName); emailEls.forEach(el=>el.textContent=user.email||data.email||''); roleEls.forEach(el=>el.textContent=roleLabel(role));
    if(pageRole==='customer') await loadCustomerPortal(user,data,role);
    if(loading) loading.hidden=true; if(content) content.hidden=false;
  } catch(error){ console.error(error); await signOut(auth); window.location.replace('login.html'); }
});

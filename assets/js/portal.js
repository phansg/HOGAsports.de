import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where, addDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const pageRole = document.body.dataset.portalRole;
const loading = document.querySelector('#portalLoading');
const content = document.querySelector('#portalContent');
const nameEls = document.querySelectorAll('[data-user-name]');
const emailEls = document.querySelectorAll('[data-user-email]');
const roleEls = document.querySelectorAll('[data-user-role]');
const logoutButtons = document.querySelectorAll('[data-logout]');
let adminData = { customers: [], licenses: [], users: [], invoices: [] };

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
function statusLabel(status='') {
  const labels={active:'Aktiv',testing:'Testphase',planned:'Geplant',expired:'Abgelaufen',cancelled:'Gekündigt',paid:'Bezahlt',open:'Offen'};
  return labels[String(status).toLowerCase()] || status || '–';
}
function showPortalMessage(text, type='info') {
  const el=document.querySelector('#portalMessage');
  if(!el) return;
  el.textContent=text; el.hidden=false;
  el.classList.toggle('error', type==='error');
  clearTimeout(showPortalMessage.timer);
  showPortalMessage.timer=setTimeout(()=>{el.hidden=true;},5000);
}
function setText(sel,val){const el=document.querySelector(sel);if(el)el.textContent=val;}

logoutButtons.forEach(btn => btn.addEventListener('click', async () => { await signOut(auth); window.location.replace('login.html'); }));

function activateTab(tabName){
  document.querySelectorAll('[data-portal-tab]').forEach(b=>b.classList.toggle('active',b.dataset.portalTab===tabName));
  document.querySelectorAll('[data-portal-panel]').forEach(panel=>{panel.hidden=panel.dataset.portalPanel!==tabName;});
}
document.querySelectorAll('[data-portal-tab]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.portalTab)));
document.querySelectorAll('[data-jump-tab]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.jumpTab)));

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
  setText('[data-license-count]',activeCount); setText('[data-member-count]',members.length); setText('[data-invoice-count]',invoices.length);

  const licenseList=document.querySelector('#licenseList');
  if (licenseList) licenseList.innerHTML = licenses.length ? licenses.sort((a,b)=>String(a.productName||'').localeCompare(String(b.productName||''))).map(l=>`<article class="license-card"><div><span class="status ${statusClass(l.status)}">${escapeHtml(l.statusLabel||statusLabel(l.status))}</span><h3>${escapeHtml(l.productName||l.product||'HOGAsports Lizenz')}</h3><p>${escapeHtml(l.sport||'Sportart noch nicht hinterlegt')}</p></div><dl><div><dt>Lizenznummer</dt><dd>${escapeHtml(l.licenseNumber||'–')}</dd></div><div><dt>Beginn</dt><dd>${dateText(l.startDate)}</dd></div><div><dt>Ende</dt><dd>${dateText(l.endDate)}</dd></div></dl></article>`).join('') : '<div class="empty-state"><strong>Noch keine Lizenz hinterlegt.</strong><span>Gebuchte HOGAsports-Produkte erscheinen später automatisch hier.</span></div>';

  const memberList=document.querySelector('#memberList');
  if (memberList) memberList.innerHTML = members.length ? `<table class="portal-table"><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th></tr></thead><tbody>${members.map(m=>`<tr><td>${escapeHtml(m.displayName||m.name||'–')}</td><td>${escapeHtml(m.email||'–')}</td><td>${escapeHtml(roleLabel(String(m.role||'customer').toLowerCase()))}</td><td><span class="status ${m.active===false?'status-dev':'status-available'}">${m.active===false?'Gesperrt':'Aktiv'}</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Keine Benutzer gefunden.</div>';
  const hint=document.querySelector('[data-user-admin-hint]'); if(hint) hint.textContent = role==='customer_admin' ? 'Verwaltung wird vorbereitet' : 'Nur Ansicht';

  const invoiceList=document.querySelector('#invoiceList');
  invoices.sort((a,b)=>String(b.invoiceDate||'').localeCompare(String(a.invoiceDate||'')));
  if (invoiceList) invoiceList.innerHTML = invoices.length ? `<table class="portal-table"><thead><tr><th>Rechnung</th><th>Datum</th><th>Betrag</th><th>Status</th><th></th></tr></thead><tbody>${invoices.map(i=>`<tr><td>${escapeHtml(i.invoiceNumber||i.id)}</td><td>${dateText(i.invoiceDate)}</td><td>${money(i.totalAmount??i.amount)}</td><td><span class="status ${statusClass(i.paymentStatus||i.status)}">${escapeHtml(i.paymentStatusLabel||i.paymentStatus||i.status||'Offen')}</span></td><td>${i.pdfUrl?`<a class="text-link" href="${escapeHtml(i.pdfUrl)}" target="_blank" rel="noopener">PDF öffnen</a>`:'<span class="muted-text">PDF folgt</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><strong>Noch keine Rechnung vorhanden.</strong><span>Rechnungen werden nach einer Buchung hier bereitgestellt.</span></div>';
}

function customerName(customerId){ return adminData.customers.find(c=>c.id===customerId)?.name || 'Unbekannter Kunde'; }
function renderAdminCustomers(){
  const target=document.querySelector('#customerList'); if(!target) return;
  const rows=[...adminData.customers].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));
  target.innerHTML=rows.length?`<table class="portal-table"><thead><tr><th>Kunde</th><th>Ansprechpartner</th><th>Kontakt</th><th>Typ</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td><span class="admin-customer-name">${escapeHtml(c.name||'–')}</span><span class="admin-subline">${escapeHtml([c.postalCode,c.city].filter(Boolean).join(' ')||'')}</span></td><td>${escapeHtml(c.contactName||'–')}</td><td>${escapeHtml(c.email||'–')}<span class="admin-subline">${escapeHtml(c.phone||'')}</span></td><td>${escapeHtml({club:'Sportverein',organizer:'Turnierveranstalter',facility:'Sportanlage',other:'Sonstiges'}[c.customerType]||c.customerType||'–')}</td><td><span class="status ${c.active===false?'status-dev':'status-available'}">${c.active===false?'Inaktiv':'Aktiv'}</span></td><td class="table-actions"><button class="table-action" type="button" data-edit-customer="${c.id}">Bearbeiten</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state"><strong>Noch kein Kunde vorhanden.</strong><span>Lege den ersten Verein direkt hier an.</span></div>';
  target.querySelectorAll('[data-edit-customer]').forEach(btn=>btn.addEventListener('click',()=>fillCustomerForm(btn.dataset.editCustomer)));
}
function renderAdminLicenses(){
  const target=document.querySelector('#adminLicenseList'); if(!target) return;
  const rows=[...adminData.licenses].sort((a,b)=>customerName(a.customerId).localeCompare(customerName(b.customerId),'de'));
  target.innerHTML=rows.length?`<table class="portal-table"><thead><tr><th>Kunde</th><th>Produkt</th><th>Sportart</th><th>Lizenz</th><th>Laufzeit</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(l=>`<tr><td>${escapeHtml(customerName(l.customerId))}</td><td>${escapeHtml(l.productName||l.product||'–')}</td><td>${escapeHtml(l.sport||'–')}</td><td>${escapeHtml(l.licenseNumber||'–')}</td><td>${dateText(l.startDate)} – ${dateText(l.endDate)}</td><td><span class="status ${statusClass(l.status)}">${escapeHtml(statusLabel(l.status))}</span></td><td class="table-actions"><button class="table-action" type="button" data-edit-license="${l.id}">Bearbeiten</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state"><strong>Noch keine Lizenz vorhanden.</strong><span>Lege die erste Lizenz für einen Kunden an.</span></div>';
  target.querySelectorAll('[data-edit-license]').forEach(btn=>btn.addEventListener('click',()=>fillLicenseForm(btn.dataset.editLicense)));
}
function renderAdminUsers(){
  const target=document.querySelector('#adminUserList'); if(!target) return;
  const rows=[...adminData.users].sort((a,b)=>String(a.displayName||a.email||'').localeCompare(String(b.displayName||b.email||''),'de'));
  target.innerHTML=rows.length?`<table class="portal-table"><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Kunde</th><th>Status</th></tr></thead><tbody>${rows.map(u=>`<tr><td>${escapeHtml(u.displayName||u.name||'–')}</td><td>${escapeHtml(u.email||'–')}</td><td>${escapeHtml(roleLabel(String(u.role||'customer').toLowerCase()))}</td><td>${escapeHtml(u.customerId?customerName(u.customerId):'HOGAsports')}</td><td><span class="status ${u.active===false?'status-dev':'status-available'}">${u.active===false?'Gesperrt':'Aktiv'}</span></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">Keine Benutzerprofile gefunden.</div>';
}
function updateLicenseCustomerSelect(){
  const select=document.querySelector('#licenseCustomer'); if(!select) return;
  select.innerHTML='<option value="">Bitte auswählen</option>'+[...adminData.customers].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de')).map(c=>`<option value="${c.id}">${escapeHtml(c.name||c.id)}</option>`).join('');
}
function isoDateInput(value){ if(!value) return ''; const d=typeof value.toDate==='function'?value.toDate():new Date(value); return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10); }
function openForm(id){const f=document.getElementById(id);if(f){f.hidden=false;f.scrollIntoView({behavior:'smooth',block:'nearest'});}}
function resetForm(id){const f=document.getElementById(id);if(f){f.reset();const hidden=f.querySelector('[name="docId"]');if(hidden)hidden.value='';f.hidden=true;}}
function fillCustomerForm(id){const c=adminData.customers.find(x=>x.id===id);const f=document.querySelector('#customerForm');if(!c||!f)return;f.elements.docId.value=id;['name','contactName','email','phone','street','postalCode','city','customerType'].forEach(k=>{if(f.elements[k])f.elements[k].value=c[k]??'';});f.elements.active.value=String(c.active!==false);openForm('customerForm');}
function fillLicenseForm(id){const l=adminData.licenses.find(x=>x.id===id);const f=document.querySelector('#licenseForm');if(!l||!f)return;f.elements.docId.value=id;['customerId','productName','sport','licenseNumber','status'].forEach(k=>{if(f.elements[k])f.elements[k].value=l[k]??'';});f.elements.startDate.value=isoDateInput(l.startDate);f.elements.endDate.value=isoDateInput(l.endDate);openForm('licenseForm');}

async function loadAdminPortal(){
  const [customersSnap, licensesSnap, usersSnap, invoicesSnap]=await Promise.all([
    getDocs(collection(db,'customers')), getDocs(collection(db,'licenses')), getDocs(collection(db,'users')), getDocs(collection(db,'invoices'))
  ]);
  adminData.customers=customersSnap.docs.map(d=>({id:d.id,...d.data()}));
  adminData.licenses=licensesSnap.docs.map(d=>({id:d.id,...d.data()}));
  adminData.users=usersSnap.docs.map(d=>({id:d.id,...d.data()}));
  adminData.invoices=invoicesSnap.docs.map(d=>({id:d.id,...d.data()}));
  setText('[data-admin-customers]',adminData.customers.length);setText('[data-admin-licenses]',adminData.licenses.length);setText('[data-admin-users]',adminData.users.length);setText('[data-admin-invoices]',adminData.invoices.length);
  renderAdminCustomers();renderAdminLicenses();renderAdminUsers();updateLicenseCustomerSelect();
}

function initAdminForms(){
  document.querySelectorAll('[data-toggle-form]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.toggleForm;const f=document.getElementById(id);if(f.hidden){f.reset();const h=f.querySelector('[name="docId"]');if(h)h.value='';openForm(id);}else resetForm(id);}));
  document.querySelectorAll('[data-cancel-form]').forEach(btn=>btn.addEventListener('click',()=>resetForm(btn.dataset.cancelForm)));

  const customerForm=document.querySelector('#customerForm');
  customerForm?.addEventListener('submit',async e=>{
    e.preventDefault(); const fd=new FormData(customerForm); const id=fd.get('docId');
    const data={name:String(fd.get('name')||'').trim(),contactName:String(fd.get('contactName')||'').trim(),email:String(fd.get('email')||'').trim(),phone:String(fd.get('phone')||'').trim(),street:String(fd.get('street')||'').trim(),postalCode:String(fd.get('postalCode')||'').trim(),city:String(fd.get('city')||'').trim(),customerType:String(fd.get('customerType')||'club'),active:String(fd.get('active'))==='true',updatedAt:serverTimestamp()};
    try{if(id){await updateDoc(doc(db,'customers',String(id)),data);}else{data.createdAt=serverTimestamp();await addDoc(collection(db,'customers'),data);}resetForm('customerForm');await loadAdminPortal();showPortalMessage(id?'Kunde wurde aktualisiert.':'Kunde wurde angelegt.');}catch(err){console.error(err);showPortalMessage('Kunde konnte nicht gespeichert werden. Bitte Firestore-Regeln prüfen.','error');}
  });

  const licenseForm=document.querySelector('#licenseForm');
  licenseForm?.addEventListener('submit',async e=>{
    e.preventDefault(); const fd=new FormData(licenseForm); const id=fd.get('docId');
    const data={customerId:String(fd.get('customerId')||''),productName:String(fd.get('productName')||''),sport:String(fd.get('sport')||''),licenseNumber:String(fd.get('licenseNumber')||'').trim(),startDate:String(fd.get('startDate')||''),endDate:String(fd.get('endDate')||''),status:String(fd.get('status')||'planned'),updatedAt:serverTimestamp()};
    try{if(id){await updateDoc(doc(db,'licenses',String(id)),data);}else{data.createdAt=serverTimestamp();await addDoc(collection(db,'licenses'),data);}resetForm('licenseForm');await loadAdminPortal();showPortalMessage(id?'Lizenz wurde aktualisiert.':'Lizenz wurde angelegt.');}catch(err){console.error(err);showPortalMessage('Lizenz konnte nicht gespeichert werden. Bitte Firestore-Regeln prüfen.','error');}
  });
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
    if(pageRole==='admin'){initAdminForms();await loadAdminPortal();}
    if(loading) loading.hidden=true; if(content) content.hidden=false;
  } catch(error){ console.error(error); await signOut(auth); window.location.replace('login.html'); }
});

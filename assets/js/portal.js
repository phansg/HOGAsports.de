import { app, auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

const pageRole = document.body.dataset.portalRole;
const loading = document.querySelector('#portalLoading');
const content = document.querySelector('#portalContent');
const nameEls = document.querySelectorAll('[data-user-name]');
const emailEls = document.querySelectorAll('[data-user-email]');
const roleEls = document.querySelectorAll('[data-user-role]');
const logoutButtons = document.querySelectorAll('[data-logout]');
const functions = getFunctions(app, 'europe-west1');
const createHogaUser = httpsCallable(functions, 'createHogaUser');
const updateHogaUser = httpsCallable(functions, 'updateHogaUser');
const createHogaInvoice = httpsCallable(functions, 'createHogaInvoice');
let adminData = { customers: [], licenses: [], users: [], invoices: [], invoiceSettings: null };
let currentUserUid = null;

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

function invoiceProduct(invoice){return invoice?.licenseSnapshot?.productName || 'Sonstige Leistung';}
function invoiceSport(invoice){return invoice?.licenseSnapshot?.sport || 'Ohne Sportart';}
function numeric(value){const n=Number(value);return Number.isFinite(n)?n:0;}
function accountingYears(){
  const years=new Set([String(new Date().getFullYear())]);
  adminData.invoices.forEach(i=>{if(/^\d{4}-/.test(String(i.invoiceDate||'')))years.add(String(i.invoiceDate).slice(0,4));if(/^\d{4}-/.test(String(i.paymentDate||'')))years.add(String(i.paymentDate).slice(0,4));});
  return [...years].sort((a,b)=>Number(b)-Number(a));
}
function currentAccountingYear(){return document.querySelector('#accountingYear')?.value || String(new Date().getFullYear());}
function isCancelledInvoice(invoice){return ['cancelled','storniert','storno'].includes(String(invoice.paymentStatus||invoice.status||'').toLowerCase());}
function csvCell(value){const text=String(value??'').replace(/\r?\n/g,' ').trim();return `"${text.replace(/"/g,'""')}"`;}
function deNumber(value){return numeric(value).toFixed(2).replace('.',',');}
function downloadCsv(filename,rows){
  const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderBreakdown(targetSelector,items){
  const target=document.querySelector(targetSelector);if(!target)return;
  const entries=Object.entries(items).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((sum,[,v])=>sum+v,0);
  target.innerHTML=entries.length?entries.map(([label,value])=>`<div class="accounting-breakdown-row"><div><strong>${escapeHtml(label)}</strong><small>${total>0?new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1}).format(value/total):'0 %'}</small></div><span>${money(value)}</span></div>`).join(''):'<div class="empty-state">Keine Zahlungseingänge in diesem Jahr.</div>';
}
function renderAccounting(){
  const select=document.querySelector('#accountingYear');if(!select)return;
  const years=accountingYears();const previous=select.value;select.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');select.value=years.includes(previous)?previous:years[0];
  const year=select.value;
  const yearInvoices=adminData.invoices.filter(i=>String(i.invoiceDate||'').slice(0,4)===year&&!isCancelledInvoice(i));
  const paidInYear=adminData.invoices.filter(i=>String(i.paymentStatus||'').toLowerCase()==='paid'&&String(i.paymentDate||'').slice(0,4)===year&&!isCancelledInvoice(i));
  const openYear=yearInvoices.filter(i=>String(i.paymentStatus||'open').toLowerCase()!=='paid');
  const invoiced=yearInvoices.reduce((s,i)=>s+numeric(i.totalAmount),0);const received=paidInYear.reduce((s,i)=>s+numeric(i.totalAmount),0);const open=openYear.reduce((s,i)=>s+numeric(i.totalAmount),0);
  setText('[data-accounting-invoiced]',money(invoiced));setText('[data-accounting-received]',money(received));setText('[data-accounting-open]',money(open));setText('[data-accounting-paid-count]',String(paidInYear.length));
  const incomeTarget=document.querySelector('#accountingIncomeList');
  const income=[...paidInYear].sort((a,b)=>String(b.paymentDate||'').localeCompare(String(a.paymentDate||''))||String(b.invoiceNumber||'').localeCompare(String(a.invoiceNumber||'')));
  if(incomeTarget) incomeTarget.innerHTML=income.length?`<table class="portal-table"><thead><tr><th>Zahlung</th><th>Rechnung</th><th>Kunde</th><th>Produkt</th><th>Betrag</th></tr></thead><tbody>${income.map(i=>`<tr><td>${dateText(i.paymentDate)}</td><td><a class="table-action" href="rechnung.html?id=${encodeURIComponent(i.id)}" target="_blank" rel="noopener">${escapeHtml(i.invoiceNumber||i.id)}</a></td><td>${escapeHtml(i.customerSnapshot?.name||customerName(i.customerId))}</td><td>${escapeHtml(invoiceProduct(i))}<span class="admin-subline">${escapeHtml(invoiceSport(i))}</span></td><td><strong>${money(i.totalAmount)}</strong></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state"><strong>Noch keine Zahlungseingänge.</strong><span>Als bezahlt markierte Rechnungen erscheinen hier anhand des Zahlungsdatums.</span></div>';
  const productTotals={};const sportTotals={};income.forEach(i=>{productTotals[invoiceProduct(i)]=(productTotals[invoiceProduct(i)]||0)+numeric(i.totalAmount);sportTotals[invoiceSport(i)]=(sportTotals[invoiceSport(i)]||0)+numeric(i.totalAmount);});
  renderBreakdown('#accountingProductBreakdown',productTotals);renderBreakdown('#accountingSportBreakdown',sportTotals);
  const openTarget=document.querySelector('#accountingOpenList');
  if(openTarget) openTarget.innerHTML=openYear.length?`<table class="portal-table"><thead><tr><th>Rechnung</th><th>Kunde</th><th>Fällig</th><th>Betrag</th></tr></thead><tbody>${[...openYear].sort((a,b)=>String(a.dueDate||a.invoiceDate||'').localeCompare(String(b.dueDate||b.invoiceDate||''))).map(i=>`<tr><td><a class="table-action" href="rechnung.html?id=${encodeURIComponent(i.id)}" target="_blank" rel="noopener">${escapeHtml(i.invoiceNumber||i.id)}</a></td><td>${escapeHtml(i.customerSnapshot?.name||customerName(i.customerId))}</td><td>${dateText(i.dueDate)}</td><td><strong>${money(i.totalAmount)}</strong></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state"><strong>Keine offenen Rechnungen.</strong><span>Für dieses Rechnungsjahr sind alle erfassten Rechnungen bezahlt.</span></div>';
}
function exportIncomeCsv(){
  const year=currentAccountingYear();const rows=[['Zahlungseingang','Rechnungsnummer','Rechnungsdatum','Kunde','Produkt','Sportart','Zahlungsart','Nettobetrag','USt','Bruttobetrag','Status']];
  adminData.invoices.filter(i=>String(i.paymentStatus||'').toLowerCase()==='paid'&&String(i.paymentDate||'').slice(0,4)===year&&!isCancelledInvoice(i)).sort((a,b)=>String(a.paymentDate||'').localeCompare(String(b.paymentDate||''))).forEach(i=>rows.push([i.paymentDate||'',i.invoiceNumber||'',i.invoiceDate||'',i.customerSnapshot?.name||customerName(i.customerId),invoiceProduct(i),invoiceSport(i),paymentMethodLabel(i.paymentMethod),deNumber(i.amountNet),deNumber(i.vatAmount),deNumber(i.totalAmount),'Bezahlt']));
  downloadCsv(`HOGAsports_Zahlungseingaenge_${year}.csv`,rows);
}
function exportInvoicesCsv(){
  const year=currentAccountingYear();const rows=[['Rechnungsnummer','Rechnungsdatum','Fällig am','Kunde','Produkt','Sportart','Zahlungsart','Nettobetrag','USt','Bruttobetrag','Zahlungsstatus','Zahlungseingang']];
  adminData.invoices.filter(i=>String(i.invoiceDate||'').slice(0,4)===year).sort((a,b)=>String(a.invoiceDate||'').localeCompare(String(b.invoiceDate||''))).forEach(i=>rows.push([i.invoiceNumber||'',i.invoiceDate||'',i.dueDate||'',i.customerSnapshot?.name||customerName(i.customerId),invoiceProduct(i),invoiceSport(i),paymentMethodLabel(i.paymentMethod),deNumber(i.amountNet),deNumber(i.vatAmount),deNumber(i.totalAmount),paymentStatusLabel(i.paymentStatus),i.paymentDate||'']));
  downloadCsv(`HOGAsports_Rechnungen_${year}.csv`,rows);
}

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
  if (invoiceList) invoiceList.innerHTML = invoices.length ? `<table class="portal-table"><thead><tr><th>Rechnung</th><th>Datum</th><th>Betrag</th><th>Status</th><th></th></tr></thead><tbody>${invoices.map(i=>`<tr><td>${escapeHtml(i.invoiceNumber||i.id)}</td><td>${dateText(i.invoiceDate)}</td><td>${money(i.totalAmount??i.amount)}</td><td><span class="status ${statusClass(i.paymentStatus||i.status)}">${escapeHtml(i.paymentStatusLabel||i.paymentStatus||i.status||'Offen')}</span></td><td><a class="text-link" href="rechnung.html?id=${encodeURIComponent(i.id)}" target="_blank" rel="noopener">Rechnung öffnen</a></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><strong>Noch keine Rechnung vorhanden.</strong><span>Rechnungen werden nach einer Buchung hier bereitgestellt.</span></div>';
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
  target.innerHTML=rows.length?`<table class="portal-table"><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Kunde</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(u=>`<tr><td>${escapeHtml(u.displayName||u.name||'–')}${u.id===currentUserUid?'<span class="admin-subline">Aktuell angemeldet</span>':''}</td><td>${escapeHtml(u.email||'–')}</td><td>${escapeHtml(roleLabel(String(u.role||'customer').toLowerCase()))}</td><td>${escapeHtml(u.customerId?customerName(u.customerId):'HOGAsports')}</td><td><span class="status ${u.active===false?'status-dev':'status-available'}">${u.active===false?'Gesperrt':'Aktiv'}</span></td><td class="table-actions"><button class="table-action" type="button" data-edit-user="${u.id}">Bearbeiten</button><button class="table-action secondary" type="button" data-reset-user="${u.id}">Passwort-Mail</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">Keine Benutzerprofile gefunden.</div>';
  target.querySelectorAll('[data-edit-user]').forEach(btn=>btn.addEventListener('click',()=>fillUserForm(btn.dataset.editUser)));
  target.querySelectorAll('[data-reset-user]').forEach(btn=>btn.addEventListener('click',()=>sendResetForUser(btn.dataset.resetUser)));
}
function customerOptions(){
  return '<option value="">Bitte auswählen</option>'+[...adminData.customers].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de')).map(c=>`<option value="${c.id}">${escapeHtml(c.name||c.id)}</option>`).join('');
}
function updateLicenseCustomerSelect(){
  const select=document.querySelector('#licenseCustomer'); if(select) select.innerHTML=customerOptions();
  const userSelect=document.querySelector('#userCustomer'); if(userSelect) userSelect.innerHTML=customerOptions();
}
function isoDateInput(value){ if(!value) return ''; const d=typeof value.toDate==='function'?value.toDate():new Date(value); return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10); }
function openForm(id){const f=document.getElementById(id);if(f){f.hidden=false;f.scrollIntoView({behavior:'smooth',block:'nearest'});}}
function resetForm(id){const f=document.getElementById(id);if(f){f.reset();f.querySelectorAll('input[type="hidden"]').forEach(hidden=>hidden.value='');f.hidden=true;}}
function fillCustomerForm(id){const c=adminData.customers.find(x=>x.id===id);const f=document.querySelector('#customerForm');if(!c||!f)return;f.elements.docId.value=id;['name','contactName','email','phone','street','postalCode','city','customerType'].forEach(k=>{if(f.elements[k])f.elements[k].value=c[k]??'';});f.elements.active.value=String(c.active!==false);openForm('customerForm');}
function fillLicenseForm(id){const l=adminData.licenses.find(x=>x.id===id);const f=document.querySelector('#licenseForm');if(!l||!f)return;f.elements.docId.value=id;['customerId','productName','sport','licenseNumber','status'].forEach(k=>{if(f.elements[k])f.elements[k].value=l[k]??'';});f.elements.startDate.value=isoDateInput(l.startDate);f.elements.endDate.value=isoDateInput(l.endDate);openForm('licenseForm');}
function syncUserCustomerRequirement(){
  const f=document.querySelector('#userForm'); if(!f) return;
  const isAdmin=f.elements.role.value==='admin';
  f.elements.customerId.disabled=isAdmin;
  f.elements.customerId.required=!isAdmin;
  if(isAdmin) f.elements.customerId.value='';
}
function fillUserForm(id){
  const u=adminData.users.find(x=>x.id===id); const f=document.querySelector('#userForm'); if(!u||!f)return;
  f.elements.uid.value=id; f.elements.displayName.value=u.displayName||u.name||''; f.elements.email.value=u.email||''; f.elements.role.value=u.role||'customer'; f.elements.customerId.value=u.customerId||''; f.elements.active.value=String(u.active!==false); f.elements.sendInvite.value='false';
  syncUserCustomerRequirement(); openForm('userForm');
}
async function sendResetForUser(id){
  const u=adminData.users.find(x=>x.id===id); if(!u?.email){showPortalMessage('Für diesen Zugang ist keine E-Mail-Adresse hinterlegt.','error');return;}
  if(u.active===false){showPortalMessage('Der Zugang ist gesperrt. Bitte zuerst aktivieren.','error');return;}
  try{await sendPasswordResetEmail(auth,u.email);showPortalMessage(`Passwort-E-Mail wurde an ${u.email} versendet.`);}catch(err){console.error(err);showPortalMessage('Die Passwort-E-Mail konnte nicht versendet werden. Bitte Authentication-Einstellungen prüfen.','error');}
}


function paymentStatusLabel(status='open'){return ({open:'Offen',paid:'Bezahlt',cancelled:'Storniert'}[String(status)]||status||'Offen');}
function paymentMethodLabel(method='bank'){return ({bank:'Überweisung',paypal:'PayPal',other:'Sonstiges'}[String(method)]||method||'–');}
function renderAdminInvoices(){
  const target=document.querySelector('#adminInvoiceList'); if(!target)return;
  const rows=[...adminData.invoices].sort((a,b)=>String(b.invoiceDate||'').localeCompare(String(a.invoiceDate||'')));
  target.innerHTML=rows.length?`<table class="portal-table"><thead><tr><th>Rechnung</th><th>Kunde</th><th>Datum</th><th>Betrag</th><th>Zahlung</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(i=>`<tr><td><strong>${escapeHtml(i.invoiceNumber||i.id)}</strong><span class="admin-subline">${escapeHtml(i.description||'')}</span></td><td>${escapeHtml(customerName(i.customerId))}</td><td>${dateText(i.invoiceDate)}</td><td>${money(i.totalAmount)}</td><td>${escapeHtml(paymentMethodLabel(i.paymentMethod))}</td><td><span class="status ${statusClass(i.paymentStatus)}">${escapeHtml(paymentStatusLabel(i.paymentStatus))}</span>${i.paymentDate?`<span class="admin-subline">${dateText(i.paymentDate)}</span>`:''}</td><td class="table-actions"><a class="table-action" href="rechnung.html?id=${encodeURIComponent(i.id)}" target="_blank" rel="noopener">Öffnen</a>${i.paymentStatus!=='paid'?`<button class="table-action secondary" type="button" data-mark-paid="${i.id}">Bezahlt</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-state"><strong>Noch keine Rechnung vorhanden.</strong><span>Erstelle die erste Rechnung direkt aus HOGAsports.</span></div>';
  target.querySelectorAll('[data-mark-paid]').forEach(btn=>btn.addEventListener('click',()=>markInvoicePaid(btn.dataset.markPaid)));
}
function updateInvoiceSelectors(){
  const customer=document.querySelector('#invoiceCustomer'); if(customer) customer.innerHTML=customerOptions();
  updateInvoiceLicenseSelect();
}
function updateInvoiceLicenseSelect(){
  const form=document.querySelector('#invoiceForm'); if(!form)return;
  const customerId=String(form.elements.customerId?.value||'');
  const licenses=adminData.licenses.filter(l=>!customerId||l.customerId===customerId);
  form.elements.licenseId.innerHTML='<option value="">Ohne Lizenzbezug</option>'+licenses.map(l=>`<option value="${l.id}">${escapeHtml((l.productName||'Lizenz')+' · '+(l.sport||'')+' · '+(l.licenseNumber||'ohne Nr.'))}</option>`).join('');
}
function datePlusDays(dateStr,days){const d=new Date(dateStr+'T12:00:00');d.setDate(d.getDate()+Number(days||0));return d.toISOString().slice(0,10);}
function fillInvoiceSettingsForm(){
  const f=document.querySelector('#invoiceSettingsForm'); if(!f)return;
  const s=adminData.invoiceSettings||{};
  ['businessName','ownerName','street','postalCode','city','phone','email','website','taxMode','vatRate','taxNumber','vatId','taxNote','accountHolder','bankName','iban','bic','paypalEmail','paymentTermsDays','invoicePrefix','invoiceStartNumber','invoiceFooter'].forEach(k=>{if(f.elements[k]&&s[k]!==undefined&&s[k]!==null)f.elements[k].value=s[k];});
}
async function markInvoicePaid(id){
  try{await updateDoc(doc(db,'invoices',id),{paymentStatus:'paid',paymentDate:new Date().toISOString().slice(0,10),updatedAt:serverTimestamp(),updatedBy:currentUserUid});await loadAdminPortal();showPortalMessage('Zahlungseingang wurde erfasst.');}catch(err){console.error(err);showPortalMessage('Zahlungsstatus konnte nicht aktualisiert werden.','error');}
}

async function loadAdminPortal(){
  const [customersSnap, licensesSnap, usersSnap, invoicesSnap, settingsSnap]=await Promise.all([
    getDocs(collection(db,'customers')), getDocs(collection(db,'licenses')), getDocs(collection(db,'users')), getDocs(collection(db,'invoices')), getDoc(doc(db,'settings','invoice'))
  ]);
  adminData.customers=customersSnap.docs.map(d=>({id:d.id,...d.data()}));
  adminData.licenses=licensesSnap.docs.map(d=>({id:d.id,...d.data()}));
  adminData.users=usersSnap.docs.map(d=>({id:d.id,...d.data()}));
  adminData.invoices=invoicesSnap.docs.map(d=>({id:d.id,...d.data()}));
  adminData.invoiceSettings=settingsSnap.exists()?settingsSnap.data():null;
  setText('[data-admin-customers]',adminData.customers.length);setText('[data-admin-licenses]',adminData.licenses.length);setText('[data-admin-users]',adminData.users.length);setText('[data-admin-invoices]',adminData.invoices.length);
  renderAdminCustomers();renderAdminLicenses();renderAdminUsers();renderAdminInvoices();updateLicenseCustomerSelect();updateInvoiceSelectors();fillInvoiceSettingsForm();renderAccounting();
}

function initAdminForms(){
  document.querySelectorAll('[data-toggle-form]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.toggleForm;const f=document.getElementById(id);if(f.hidden){f.reset();f.querySelectorAll('input[type="hidden"]').forEach(h=>h.value='');if(id==='userForm')syncUserCustomerRequirement();openForm(id);}else resetForm(id);}));
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

  const userForm=document.querySelector('#userForm');
  userForm?.elements.role.addEventListener('change',syncUserCustomerRequirement);
  userForm?.addEventListener('submit',async e=>{
    e.preventDefault(); const fd=new FormData(userForm); const uid=String(fd.get('uid')||'');
    const payload={uid,displayName:String(fd.get('displayName')||'').trim(),email:String(fd.get('email')||'').trim(),role:String(fd.get('role')||''),customerId:String(fd.get('customerId')||''),active:String(fd.get('active'))==='true'};
    const wantsInvite=String(fd.get('sendInvite'))==='true';
    if(payload.role!=='admin'&&!payload.customerId){showPortalMessage('Bitte einen Kunden/Verein auswählen.','error');return;}
    if(wantsInvite&&!payload.active){showPortalMessage('Eine Passwort-E-Mail kann nur für einen aktiven Zugang versendet werden.','error');return;}
    const submit=userForm.querySelector('[type="submit"]'); const oldText=submit?.textContent; if(submit){submit.disabled=true;submit.textContent='Bitte warten …';}
    try{
      if(uid) await updateHogaUser(payload); else await createHogaUser(payload);
      if(wantsInvite) await sendPasswordResetEmail(auth,payload.email);
      resetForm('userForm'); await loadAdminPortal();
      showPortalMessage(uid?(wantsInvite?'Benutzer wurde aktualisiert und die Passwort-E-Mail versendet.':'Benutzer wurde aktualisiert.'):(wantsInvite?'Benutzer wurde angelegt und die Passwort-E-Mail versendet.':'Benutzer wurde angelegt.'));
    }catch(err){console.error(err);const msg=err?.message||'';showPortalMessage(msg.includes('already-exists')?'Für diese E-Mail-Adresse existiert bereits ein Zugang.':msg.includes('permission-denied')?'Keine Berechtigung für diese Aktion.':msg.includes('not-found')?'Der ausgewählte Datensatz wurde nicht gefunden.':'Benutzer konnte nicht gespeichert werden. Bitte prüfen, ob die Firebase Function bereitgestellt wurde.','error');}
    finally{if(submit){submit.disabled=false;submit.textContent=oldText||'Benutzer speichern';}}
  });

  const invoiceForm=document.querySelector('#invoiceForm');
  invoiceForm?.elements.customerId.addEventListener('change',()=>{updateInvoiceLicenseSelect();const c=adminData.customers.find(x=>x.id===invoiceForm.elements.customerId.value);const l=adminData.licenses.find(x=>x.id===invoiceForm.elements.licenseId.value);if(!invoiceForm.elements.description.value&&l)invoiceForm.elements.description.value=`${l.productName||'HOGAsports Lizenz'} – ${l.sport||''}`;});
  invoiceForm?.elements.licenseId.addEventListener('change',()=>{const l=adminData.licenses.find(x=>x.id===invoiceForm.elements.licenseId.value);if(l)invoiceForm.elements.description.value=`${l.productName||'HOGAsports Lizenz'} – ${l.sport||''}`;});
  invoiceForm?.addEventListener('submit',async e=>{
    e.preventDefault(); const fd=new FormData(invoiceForm); const payload={customerId:String(fd.get('customerId')||''),licenseId:String(fd.get('licenseId')||''),invoiceDate:String(fd.get('invoiceDate')||''),dueDate:String(fd.get('dueDate')||''),description:String(fd.get('description')||'').trim(),amountNet:Number(fd.get('amountNet')),paymentMethod:String(fd.get('paymentMethod')||'bank'),note:String(fd.get('note')||'').trim()};
    const submit=invoiceForm.querySelector('[type="submit"]');const old=submit?.textContent;if(submit){submit.disabled=true;submit.textContent='Rechnung wird erstellt …';}
    try{const res=await createHogaInvoice(payload);resetForm('invoiceForm');await loadAdminPortal();showPortalMessage(`Rechnung ${res.data.invoiceNumber} wurde erstellt.`);window.open(`rechnung.html?id=${encodeURIComponent(res.data.invoiceId)}`,'_blank','noopener');}catch(err){console.error(err);const m=String(err?.message||'');showPortalMessage(m.includes('Grunddaten')?'Bitte zuerst die Rechnungs-Grunddaten vollständig speichern.':'Rechnung konnte nicht erstellt werden. Bitte Function und Rechnungsdaten prüfen.','error');}finally{if(submit){submit.disabled=false;submit.textContent=old||'Rechnung erstellen';}}
  });
  const settingsForm=document.querySelector('#invoiceSettingsForm');
  settingsForm?.addEventListener('submit',async e=>{
    e.preventDefault();const fd=new FormData(settingsForm);const data={};['businessName','ownerName','street','postalCode','city','phone','email','website','taxMode','taxNumber','vatId','taxNote','accountHolder','bankName','iban','bic','paypalEmail','invoicePrefix','invoiceFooter'].forEach(k=>data[k]=String(fd.get(k)||'').trim());data.vatRate=Number(fd.get('vatRate')||19);data.paymentTermsDays=Number(fd.get('paymentTermsDays')||14);data.invoiceStartNumber=Math.max(1,Number(fd.get('invoiceStartNumber')||1));data.updatedAt=serverTimestamp();data.updatedBy=currentUserUid;
    try{await setDoc(doc(db,'settings','invoice'),data,{merge:true});adminData.invoiceSettings=data;showPortalMessage('Rechnungs-Grunddaten wurden gespeichert.');}catch(err){console.error(err);showPortalMessage('Rechnungsdaten konnten nicht gespeichert werden.','error');}
  });
  document.querySelector('[data-toggle-form="invoiceForm"]')?.addEventListener('click',()=>{const f=document.querySelector('#invoiceForm');if(!f||f.hidden)return;const today=new Date().toISOString().slice(0,10);if(!f.elements.invoiceDate.value)f.elements.invoiceDate.value=today;const days=adminData.invoiceSettings?.paymentTermsDays??14;if(!f.elements.dueDate.value)f.elements.dueDate.value=datePlusDays(today,days);updateInvoiceSelectors();});
  const accountingYear=document.querySelector('#accountingYear');
  accountingYear?.addEventListener('change',renderAccounting);
  document.querySelector('#exportIncomeCsv')?.addEventListener('click',exportIncomeCsv);
  document.querySelector('#exportInvoicesCsv')?.addEventListener('click',exportInvoicesCsv);
  syncUserCustomerRequirement();
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
    if(pageRole==='admin'){currentUserUid=user.uid;initAdminForms();await loadAdminPortal();}
    if(loading) loading.hidden=true; if(content) content.hidden=false;
  } catch(error){ console.error(error); await signOut(auth); window.location.replace('login.html'); }
});

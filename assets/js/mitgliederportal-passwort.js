import { mitgliederportalFirebase } from './firebase-config.js';
import { verifyPasswordResetCode, confirmPasswordReset } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const auth=mitgliederportalFirebase.auth,form=document.querySelector('#mitgliedPasswordForm'),message=document.querySelector('#passwordMessage'),intro=document.querySelector('#passwordIntro'),loginLink=document.querySelector('#mitgliedLoginLink'),button=document.querySelector('#savePassword');
const code=new URLSearchParams(location.search).get('oobCode');
function show(text,error=true){message.textContent=text;message.hidden=false;message.className=`auth-message ${error?'error':'success'}`;}

async function validate(){
  if(!code){form.hidden=true;show('Der Zugangslink ist unvollständig. Bitte bei Ihrem Verein einen neuen Zugangslink anfordern.');return;}
  try{await verifyPasswordResetCode(auth,code);}
  catch(e){console.error(e);form.hidden=true;show('Dieser Zugangslink ist ungültig oder abgelaufen. Bitte bei Ihrem Verein bei Ihrem Verein einen neuen Zugangslink anfordern.');}
}
form.addEventListener('submit',async event=>{
  event.preventDefault();const password=document.querySelector('#newPassword').value;
  if(password.length<8){show('Bitte mindestens 8 Zeichen verwenden.');return;}
  if(password!==document.querySelector('#repeatPassword').value){show('Die Passwörter stimmen nicht überein.');return;}
  button.disabled=true;
  try{await confirmPasswordReset(auth,code,password);form.hidden=true;intro.hidden=true;loginLink.hidden=false;show('Ihr Passwort wurde gespeichert. Sie können sich jetzt im Mitgliederportal anmelden.',false);}
  catch(e){console.error(e);show(e?.code==='auth/weak-password'?'Das Passwort ist zu schwach. Bitte wählen Sie ein stärkeres Passwort.':'Der Link ist ungültig oder abgelaufen. Bitte bei Ihrem Verein einen neuen Zugangslink anfordern.');button.disabled=false;}
});
validate();

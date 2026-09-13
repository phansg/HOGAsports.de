<?php
header('Content-Type: text/html; charset=UTF-8');
function clean($v){ return trim(str_replace(["\r","\0"], '', (string)$v)); }
function esc($v){ return htmlspecialchars($v, ENT_QUOTES, 'UTF-8'); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: interesse.html'); exit; }
if (!empty($_POST['website'] ?? '')) { http_response_code(200); exit('OK'); }

$verein = clean($_POST['verein'] ?? '');
$ansprechpartner = clean($_POST['ansprechpartner'] ?? '');
$email = clean($_POST['email'] ?? '');
$telefon = clean($_POST['telefon'] ?? '');
$anschrift = clean($_POST['anschrift'] ?? '');
$produkt = clean($_POST['produkt'] ?? '');
$sportart = clean($_POST['sportart'] ?? '');
$zahlung = clean($_POST['zahlung'] ?? '');
$nachricht = clean($_POST['nachricht'] ?? '');
$datenschutz = $_POST['datenschutz'] ?? '';

$errors = [];
if ($verein === '') $errors[] = 'Bitte Verein / Organisation angeben.';
if ($ansprechpartner === '') $errors[] = 'Bitte Ansprechpartner angeben.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Bitte eine gültige E-Mail-Adresse angeben.';
if ($produkt === '') $errors[] = 'Bitte ein Produkt auswählen.';
if ($datenschutz !== '1') $errors[] = 'Bitte die Datenschutzerklärung bestätigen.';

$sent = false;
if (!$errors) {
  $to = 'info@hogasports.de';
  $subject = 'HOGAsports Interessenvormerkung: ' . $produkt;
  $body = "Neue Interessenvormerkung über hogasports.de\n\n".
          "Verein / Organisation: $verein\n".
          "Ansprechpartner: $ansprechpartner\n".
          "E-Mail: $email\n".
          "Telefon: $telefon\n".
          "Rechnungsanschrift: $anschrift\n".
          "Produkt: $produkt\n".
          "Sportart: $sportart\n".
          "Bevorzugte Zahlung: $zahlung\n\n".
          "Nachricht:\n$nachricht\n\n".
          "Datenschutz bestätigt: Ja\n".
          "Zeitpunkt: ".date('d.m.Y H:i')."\n";
  $headers = "From: HOGAsports Website <info@hogasports.de>\r\n";
  $headers .= "Reply-To: ".str_replace(["\n","\r"], '', $email)."\r\n";
  $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
  $sent = @mail($to, '=?UTF-8?B?'.base64_encode($subject).'?=', $body, $headers);
  if (!$sent) $errors[] = 'Die Anfrage konnte technisch nicht versendet werden. Bitte senden Sie uns stattdessen eine E-Mail an info@hogasports.de.';
}
?>
<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Interesse | HOGAsports</title><link rel="stylesheet" href="assets/css/style.css"></head><body><main class="section"><div class="container"><div class="form-card" style="text-align:center;max-width:720px"><img src="assets/img/hogasports-logo.png" alt="HOGAsports" style="width:220px;margin:0 auto 28px"><?php if($sent): ?><div class="success"><strong>Vielen Dank!</strong><br>Ihre unverbindliche Interessenvormerkung wurde an HOGAsports gesendet. Wir melden uns bei Ihnen.</div><a class="btn btn-primary" href="index.html">Zurück zur Startseite</a><?php else: ?><div class="error"><strong>Die Anfrage konnte nicht gesendet werden.</strong><br><?php echo implode('<br>', array_map('esc',$errors)); ?></div><a class="btn btn-secondary" href="interesse.html">Zurück zum Formular</a> <a class="btn btn-primary" href="mailto:info@hogasports.de">E-Mail schreiben</a><?php endif; ?></div></div></main></body></html>

HOGAsports Website V0.3
=======================

Ziel dieser Version
-------------------
Weiterentwicklung der ersten Website zur zentralen HOGAsports-Plattform für digitale Lösungen für Sportvereine, Turnierveranstalter und Sportanlagen.

Neu / geändert
--------------
- Startseite vollständig auf das erweiterte HOGAsports-Konzept umgestellt.
- Drei Produktwelten eingeführt:
  1. HOGAsports Desktop Basic
  2. HOGAsports Tournament Web
  3. HOGAsports Court
- Tennis, Padel und Pickleball als erste drei Sportarten integriert.
- Statuskennzeichnungen: Desktop vorhanden / geplant ab 01.12.2026 / in Entwicklung.
- Zielgruppen Sportvereine, Turnierveranstalter und Sportanlagen ergänzt.
- Eigene Seiten für Desktop Basic, Tournament Web und HOGAsports Court erstellt.
- Kundenbereich/Login als Vorschauseite vorbereitet; Firebase ist in V0.3 noch NICHT angebunden.
- Bestellanfrage durch unverbindliche "Interesse vormerken"-Seite ersetzt.
- Tennis-Detailseite an den aktuellen Projektstand angepasst.
- Mobilen Navigationsfehler in Impressum und Datenschutz behoben (inline display:flex entfernt).
- Mobile Navigation robuster gemacht (Schließen nach Link-Klick und bei Desktop-Resize).
- Dezenten Besucherzähler im Footer der Startseite integriert.

Besucherzähler
--------------
Der Zähler arbeitet serverseitig über counter.php und speichert ausschließlich eine Gesamtzahl in data/visits.txt.
Keine Cookies, keine IP-Adressen, keine Besucherprofile und kein Tracking.
Gezählt werden Aufrufe der Startseite. Unterseiten erhöhen den Zähler nicht.

Wichtig beim Upload zu STRATO:
- counter.php und der Ordner data müssen mit hochgeladen werden.
- PHP muss für die Domain aktiviert sein.
- Der Webserver benötigt Schreibrechte auf data/visits.txt bzw. den Ordner data.
- Falls der Zähler nicht schreiben darf, wird er auf der Website automatisch ausgeblendet.

E-Mail-Formular
---------------
interesse.html sendet weiterhin über bestellung.php an info@hogasports.de.
Der PHP-mail()-Versand muss auf dem STRATO-Paket getestet werden.

Noch nicht umgesetzt
--------------------
- Firebase Authentication
- Firestore Kunden-/Rollen-/Lizenzverwaltung
- echter Login/Kundenbereich
- Buchung und Zahlung
- endgültige Preise und Lizenzpakete
- Tournament Web selbst
- HOGAsports Court selbst

Empfohlener nächster Schritt
----------------------------
V0.3 zunächst auf Desktop und Smartphone testen. Danach gemeinsam Texte, Darstellung und Navigation feinjustieren. Erst wenn die öffentliche Website-Struktur gefällt, sollte der technische Kundenbereich/Firebase folgen.


ÄNDERUNGEN V0.3
----------------
- Echter HOGAsports-QR-Code in der Tournament-Web-Vorschau eingebunden.
- Neuer Bereich „Customising & neue Ideen“ auf der Startseite.
- Leitgedanke „Smarte Lösungen für smarte Vereine.“ ergänzt.
- Interesse-Formular um „Customising / neue Idee“ erweitert.
- Neue Bilddatei: assets/img/hogasports-qr.png

# k8s-wizard

Offline-Wizard für Kubernetes-Manifeste. `index.html` im Browser öffnen — kein
Server, kein Build, keine Abhängigkeiten.

## cluster-setup.sh

Das Panel **Cluster** gibt es auch fürs Terminal: `cluster-setup.sh` stellt
dieselben Optionen mit whiptail oder dialog zur Auswahl und erzeugt daraus
dieselbe Anleitung.

![Hauptmenü](docs/tui-hauptmenue.png)

```sh
./cluster-setup.sh                 # Oberfläche
./cluster-setup.sh --selftest      # Selbsttests
./cluster-setup.sh --set cni=calico --set ha=1 --set endpoint=k8s-api.firma.de --md k8s.md
```

### Einstellungen

Dieselben zwölf Felder wie in der WebUI. Die Kopfzeile zeigt jederzeit, was
gerade eingestellt ist.

![Einstellungen](docs/tui-einstellungen.png)

Passt etwas nicht zusammen, steht es als eine Zeile über der Liste — ein zu
kleines Pod-Netz, ein Pod-Netz aus dem üblichen Heimnetzbereich, mehrere
Hauptserver ohne feste API-Adresse. Den Wortlaut gibt es hinter dem Eintrag
*Hinweise im Wortlaut*, der nur erscheint, wenn es etwas zu sagen gibt.

![Warnung im Kopf](docs/tui-warnung.png)

### Anleitung, Markdown, Script

Die Anleitung selbst — Abschnitt für Abschnitt, jeder mit der Angabe, auf
welchem Rechner er auszuführen ist:

![Anleitung](docs/tui-anleitung.png)

**Als Markdown speichern** liefert dieselbe Datei wie der Knopf in der WebUI.
**Als Shell-Script exportieren** stellt aus den gewählten Abschnitten ein
eigenständiges Script zusammen; die Vorauswahl richtet sich nach der Rolle des
Rechners. Befehle mit Platzhaltern (`<TOKEN>`, `ADRESSE-…`) werden darin nur
angezeigt, nie ausgeführt.

![Abschnitte](docs/tui-abschnitte.png)

### Auf dem Rechner ausführen

Schritt für Schritt, mit Befehl und Begründung vor jeder Entscheidung.
Mehrzeilige Befehle lassen sich vorher Zeile für Zeile bearbeiten; die Ausgabe
und der Rückgabewert stehen danach im Bild.

![Ein Schritt](docs/tui-schritt.png)

### Ohne whiptail

Fehlen whiptail und dialog, fällt das Script auf reine Textabfragen zurück
(`--no-tui` erzwingt das), womit sich der Ablauf auch skripten lässt:

```sh
printf 'set\ncni\ncalico\nzurueck\nmd\nk8s.md\nquit\n' | ./cluster-setup.sh --no-tui
```

# k8s-wizard

Offline-Wizard für Kubernetes-Manifeste. `index.html` im Browser öffnen — kein
Server, kein Build, keine Abhängigkeiten.

## cluster-setup.sh

Das Panel **Cluster** gibt es auch fürs Terminal: `cluster-setup.sh` stellt
dieselben Optionen mit whiptail oder dialog zur Auswahl und erzeugt daraus
dieselbe Anleitung.

```sh
./cluster-setup.sh                 # Oberfläche
./cluster-setup.sh --selftest      # Selbsttests
./cluster-setup.sh --set cni=calico --set ha=1 --set endpoint=k8s-api.firma.de --md k8s.md
```

Aus der Oberfläche heraus:

- **Anleitung anzeigen** — die Abschnitte mit Befehlen, Erklärungen und Warnungen
- **Als Markdown speichern** — dieselbe Datei wie der Knopf in der WebUI
- **Als Shell-Script exportieren** — ausführbares Script, je Rolle zusammengestellt;
  Befehle mit Platzhaltern (`<TOKEN>`, `ADRESSE-…`) werden nur angezeigt, nie ausgeführt
- **Schritte auf diesem Rechner ausführen** — Schritt für Schritt, mit Rückfrage
  vor jedem Befehl und der Möglichkeit, ihn vorher zu bearbeiten

Ohne whiptail und dialog fällt das Script auf reine Textabfragen zurück
(`--no-tui` erzwingt das), womit sich der Ablauf auch skripten lässt.

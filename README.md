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

### Als Ansible-Playbook

Für mehr als eine Handvoll Knoten gibt es denselben Ablauf als Playbook, dazu
ein passendes Inventar:

```sh
./cluster-setup.sh --ansible k8s-cluster.yml
ansible-playbook -i k8s-cluster-inventory.ini k8s-cluster.yml
```

![Ansible-Export](docs/tui-ansible.png)

Jeder Abschnitt der Anleitung wird ein Play, die Rolle bestimmt die Hostgruppe:
`k8s_cluster` für die Vorbereitung, `k8s_control_plane[0]` für `kubeadm init`,
`k8s_control_plane[1:]` für weitere Hauptserver, `k8s_workers` für den Beitritt.
Jeder Befehl wird eine Aufgabe, die Begründung aus der Anleitung steht als
Kommentar darüber.

Vier Dinge macht der Export bewusst anders als die Textanleitung, weil Ansible
sie besser kann:

- **Der Beitrittsbefehl steht nicht in der Datei.** Ein eigener Play holt Token
  und CA-Hash zur Laufzeit vom ersten Hauptserver und reicht sie über
  `hostvars` weiter. Ein Token in der Datei wäre nach 24 Stunden wertlos und
  bis dahin ein Geheimnis im Klartext.
- **`kubeadm init` und `kubeadm join` bekommen ein `creates:`**, damit ein
  zweiter Durchlauf sie überspringt statt Schaden anzurichten.
- **`sudo` fällt weg**, dafür steht `become: true` über dem Play.
- **Lesende Befehle bekommen `changed_when: false`** — geprüft über eine
  Weißliste, damit im Zweifel eine Änderung zu viel gemeldet wird statt einer
  zu wenig.

Die CNI-Installation trägt `tags: [cni]`. Sie gehört genau einmal ins Cluster;
beim zweiten Lauf `--skip-tags cni` mitgeben.

### Beitrittspakete: vom Hauptserver zu den anderen Knoten

![Wer macht was](docs/beitrittspakete.png)

Damit auf Worker und weiteren Hauptservern nichts abgetippt werden muss, holt
das Script auf dem **ersten Hauptserver** ein frisches Token, den CA-Hash und —
bei Hochverfügbarkeit — einen Zertifikatsschlüssel und schreibt sie zusammen
mit allen Einstellungen in eine Datei je Rolle:

    k8s-worker.conf         Einstellungen + Token + Hash
    k8s-controlplane.conf   dasselbe, dazu der Zertifikatsschlüssel

![Pakete erstellt](docs/tui-pakete-erstellt.png)

Beide Dateien bekommen Rechte `0600` — es sind Geheimnisse. Anschließend kann
das Script sie per `scp` auf den Zielrechner kopieren, das Script selbst kommt
dabei mit.

Auf dem Zielrechner genügt dann `./cluster-setup.sh`. Die Datei wird beim Start
gefunden und angeboten:

![Konfiguration gefunden](docs/tui-paket-gefunden.png)

Danach steht im Menü **Diesem Cluster beitreten** — Vorbereitung und Beitritt in
einem Durchgang, mit den echten Werten in den Befehlen statt `<TOKEN>` und
`<HASH>`:

![Beitreten](docs/tui-beitreten.png)

Zwei Dinge sind dabei bewusst so gebaut:

- Die **Markdown-Ausgabe maskiert** Token, Hash und Schlüssel wieder zu
  `<TOKEN>`, `<HASH>` und `<KEY>`. Die Anleitung darf man weitergeben, das
  Token nicht.
- Befehle, die auf einen **anderen** Rechner gehören — etwa das Erzeugen eines
  neuen Zertifikatsschlüssels auf dem ersten Hauptserver — stehen in der
  Anleitung, werden beim Beitreten aber nicht angeboten.

Das Token gilt 24 Stunden, der Zertifikatsschlüssel zwei. Das Menü zeigt, wie
alt beides ist; danach auf dem ersten Hauptserver ein neues Paket erzeugen.
Nach dem Beitritt gehört die Datei gelöscht — das Script sagt es auch.

Der ganze Weg an einem durchgerechneten Beispiel — ein Hauptserver, zwei Worker,
feste Adressen, inklusive Trockenübung ohne Cluster:
**[docs/beispiel-drei-knoten.md](docs/beispiel-drei-knoten.md)**

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

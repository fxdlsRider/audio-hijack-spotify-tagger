# Audio Hijack Auto-Tagger – Komplette Anleitung

**Developed by Zoran Zdravkovic & Claude (Anthropic)**

Dieses Script taggt deine Audio Hijack Aufnahmen automatisch mit Metadaten und Album-Cover. Du spielst Musik ab, Audio Hijack nimmt auf, das Script erledigt den Rest.

---

## Was du brauchst

- macOS (Apple Silicon oder Intel)
- [Audio Hijack](https://rogueamoeba.com/audiohijack/) von Rogue Amoeba
- Spotify **oder** Apple Music
- Eine Internetverbindung (für Discogs Album-Cover)

---

## Schritt 1: Terminal öffnen

Das Terminal ist eine App auf deinem Mac. Du wirst sie für die Einrichtung brauchen.

1. Drücke `Cmd + Leertaste`
2. Tippe `Terminal`
3. Drücke `Enter`

Ein schwarzes (oder weißes) Fenster öffnet sich. Das ist das Terminal. Keine Angst davor.

---

## Schritt 2: Homebrew installieren

Homebrew ist ein Paketmanager für macOS - damit installierst du Tools wie ffmpeg.

Im Terminal eintippen und Enter drücken:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Das dauert ein paar Minuten. Es wird nach deinem Mac-Passwort gefragt - tippe es ein (du siehst nichts beim Tippen, das ist normal) und drücke Enter.

Nach der Installation im Terminal eintippen:

```bash
brew --version
```

Wenn eine Versionsnummer erscheint, hat es geklappt.

---

## Schritt 3: ffmpeg installieren

ffmpeg ist das Tool das die MP3-Tags schreibt und Cover einbettet.

Im Terminal:

```bash
brew install ffmpeg
```

Das dauert ein paar Minuten. Danach testen:

```bash
ffmpeg -version
```

Wenn eine lange Ausgabe erscheint, hat es geklappt.

---

## Schritt 4: Discogs Account und Token

Discogs ist eine Musikdatenbank von der wir die Album-Cover holen.

1. Geh zu [discogs.com](https://www.discogs.com) und erstelle einen kostenlosen Account
2. Nach dem Login geh zu: https://www.discogs.com/settings/developers
3. Klick auf **"Create an Application"**
4. Gib einen Namen ein (z.B. "Audio Hijack Tagger") und bestätige
5. Kopiere den **Personal Access Token** - du brauchst ihn gleich

---

## Schritt 5: Aufnahme-Ordner anlegen

Im Terminal (ersetze `DEINNAME` mit deinem Mac-Benutzernamen):

```bash
mkdir -p "/Users/DEINNAME/Music/Audio Hijack/spotify captures"
```

Deinen Benutzernamen findest du im Terminal - er steht vor dem `%` Zeichen.

---

## Schritt 6: AppleScript erstellen

Das AppleScript liest den aktuellen Song aus Spotify oder Apple Music aus.

### Für Spotify:

Im Terminal (ersetze `DEINNAME`):

```bash
cat > "/Users/DEINNAME/Music/Audio Hijack/spotify captures/spotify_info.scpt" << 'EOF'
tell application "Spotify"
    if it is running then
        try
            set trackName to name of current track
            set artistName to artist of current track
            set albumName to album of current track
            set trackNum to track number of current track
            set discNum to disc number of current track
            return artistName & "|||" & trackName & "|||" & albumName & "|||" & trackNum & "|||" & discNum
        on error
            return "ERROR"
        end try
    else
        return "NOTRUNNING"
    end if
end tell
EOF
```

### Für Apple Music:

Im Terminal (ersetze `DEINNAME`):

```bash
cat > "/Users/DEINNAME/Music/Audio Hijack/spotify captures/spotify_info.scpt" << 'EOF'
tell application "Music"
    if it is running then
        try
            set trackName to name of current track
            set artistName to artist of current track
            set albumName to album of current track
            set trackNum to track number of current track
            set discNum to disc number of current track
            return artistName & "|||" & trackName & "|||" & albumName & "|||" & trackNum & "|||" & discNum
        on error
            return "ERROR"
        end try
    else
        return "NOTRUNNING"
    end if
end tell
EOF
```

### AppleScript testen:

Spotify oder Apple Music starten und einen Song abspielen, dann im Terminal:

```bash
osascript "/Users/DEINNAME/Music/Audio Hijack/spotify captures/spotify_info.scpt"
```

Erwartete Ausgabe (Beispiel):
```
The Beatles|||Come Together|||Abbey Road|||1|||1
```

Wenn das klappt, weiter zu Schritt 7.

---

## Schritt 7: Script in Audio Hijack einrichten

1. Audio Hijack öffnen
2. Deine Session öffnen (oder eine neue erstellen)
3. Im Sidebar auf **"Scripting"** klicken
4. Unten links auf **"Script Library"** klicken
5. Auf **"+"** klicken → **"New Script"**
6. Namen eingeben: `Spotify Discogs Tagger`
7. Den kompletten Inhalt der Datei `spotify_tagger.js` hineinkopieren
8. Oben im Script folgende Zeilen anpassen:

```javascript
const DISCOGS_TOKEN = "DEIN_TOKEN_HIER";        // ← deinen Discogs Token eintragen
const RECORDING_FOLDER = "/Users/DEINNAME/..."; // ← deinen Benutzernamen eintragen
```

> ⚠️ **Wichtig:** Trage deinen Discogs Token **nur lokal** in Audio Hijack ein. Speichere das Script **niemals mit echtem Token** in einem öffentlichen Git Repository. Was einmal im Netz war, ist schwer wieder zu löschen.

9. Speichern

---

## Schritt 8: Automations einrichten

Du brauchst zwei Automations:

**Automation 1:**
- Klick auf **"New Automation"**
- Event: **Session Start**
- Run: **Spotify Discogs Tagger**
- On/Off: **On**

**Automation 2:**
- Klick auf **"New Automation"**
- Event: **Recording Stop**
- Run: **Spotify Discogs Tagger**
- On/Off: **On**

---

## Schritt 9: Silence Monitor einrichten

Im Recorder-Block in Audio Hijack:
1. Klick auf das Popover-Symbol des Recorder-Blocks
2. Tab **"File Limits"** auswählen
3. Haken setzen bei **"Start new file"**
4. Wert: **1.0** seconds of silence
5. Silence Threshold: ca. **-40dB**

---

## Schritt 10: Berechtigungen erteilen

Beim ersten Start fragt macOS ob Audio Hijack Zugriff auf Spotify (oder Music) haben darf.

**Unbedingt auf "OK" klicken!**

Falls du versehentlich abgelehnt hast:
1. Apple-Menü → **Systemeinstellungen**
2. **Datenschutz & Sicherheit**
3. **Automatisierung**
4. **Audio Hijack** → **Spotify** (oder **Music**) aktivieren

---

## Benutzung

### Normaler Workflow

1. Spotify oder Apple Music starten
2. Song starten der aufgenommen werden soll
3. Audio Hijack Session starten
4. Musik läuft - jeder Song wird automatisch getaggt, Cover geladen, Datei umbenannt
5. Session stoppen wenn fertig

### Was passiert genau?

- Nach jedem Song erkennt Audio Hijack die Stille zwischen den Songs
- Das Script liest aus was gerade gespielt hat
- Die Datei wird getaggt und umbenannt zu `Artist - Title.mp3`
- Das Album-Cover wird von Discogs geladen und eingebettet

---

## Debugging

### Log-Datei anschauen

Im Terminal:

```bash
tail -50 /tmp/ah_tagger_debug.log
```

### Häufige Probleme

**"osascript failed"**
→ Spotify/Music läuft nicht, oder Berechtigungen fehlen (siehe Schritt 10)

**Kein Cover**
→ Discogs Token abgelaufen. Neuen Token holen unter: https://www.discogs.com/settings/developers

Token testen:
```bash
curl -s -H "Authorization: Discogs token=DEIN_TOKEN" \
"https://api.discogs.com/database/search?q=Beatles&type=release" | head -c 100
```
Wenn JSON-Text erscheint, funktioniert der Token.

**Songs falsch getaggt**
→ Spotify Crossfade und Automix deaktivieren (Einstellungen → Wiedergabe)
→ Nicht manuell zwischen Songs springen während der Aufnahme

**ffmpeg nicht gefunden**
```bash
brew install ffmpeg
```

### Cache löschen (Neustart)

```bash
rm /tmp/ah_spotify_cache.json
```

### Log löschen

```bash
rm /tmp/ah_tagger_debug.log
```

---

## Uncopyright

Dieses Script ist frei — kein Copyright, keine Lizenz, keine Bedingungen.
Nimm es, verändere es, teile es. Kein Credit nötig, aber immer willkommen.

Musik gehört allen.

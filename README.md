# Audio Hijack Auto-Tagger – Complete Setup Guide

**Built by Zoran Zdravkovic & Claude (Anthropic)**

This script automatically tags your Audio Hijack recordings with metadata and album art. You play music, Audio Hijack records, the script does the rest.

---

## What you need

- macOS (Apple Silicon or Intel)
- [Audio Hijack](https://rogueamoeba.com/audiohijack/) by Rogue Amoeba
- Spotify **or** Apple Music
- An internet connection (for Discogs album art)

---

## Step 1: Open Terminal

Terminal is an app on your Mac. You'll need it for the setup.

1. Press `Cmd + Space`
2. Type `Terminal`
3. Press `Enter`

A black (or white) window opens. That's the Terminal. Don't be scared.

---

## Step 2: Install Homebrew

Homebrew is a package manager for macOS — it lets you install tools like ffmpeg.

Type this in Terminal and press Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

This takes a few minutes. It will ask for your Mac password — type it (you won't see anything while typing, that's normal) and press Enter.

After installation, verify it worked:

```bash
brew --version
```

If a version number appears, you're good.

---

## Step 3: Install ffmpeg

ffmpeg is the tool that writes MP3 tags and embeds album art.

In Terminal:

```bash
brew install ffmpeg
```

This takes a few minutes. Test it afterwards:

```bash
ffmpeg -version
```

If a long output appears, it worked.

---

## Step 4: Discogs Account and Token

Discogs is a music database we use to fetch album art.

1. Go to [discogs.com](https://www.discogs.com) and create a free account
2. After logging in, go to: https://www.discogs.com/settings/developers
3. Click **"Create an Application"**
4. Enter a name (e.g. "Audio Hijack Tagger") and confirm
5. Copy the **Personal Access Token** — you'll need it shortly

---

## Step 5: Create the recordings folder

In Terminal (replace `YOURUSERNAME` with your Mac username):

```bash
mkdir -p "/Users/YOURUSERNAME/Music/Audio Hijack/spotify captures"
```

You can find your username in Terminal — it appears before the `%` sign.

---

## Step 6: Create the AppleScript

The AppleScript reads the current song from Spotify or Apple Music.

### For Spotify:

In Terminal (replace `YOURUSERNAME`):

```bash
cat > "/Users/YOURUSERNAME/Music/Audio Hijack/spotify captures/spotify_info.scpt" << 'EOF'
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

### For Apple Music:

In Terminal (replace `YOURUSERNAME`):

```bash
cat > "/Users/YOURUSERNAME/Music/Audio Hijack/spotify captures/spotify_info.scpt" << 'EOF'
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

### Test the AppleScript:

Start Spotify or Apple Music and play a song, then in Terminal:

```bash
osascript "/Users/YOURUSERNAME/Music/Audio Hijack/spotify captures/spotify_info.scpt"
```

Expected output (example):
```
The Beatles|||Come Together|||Abbey Road|||1|||1
```

If that works, continue to Step 7.

---

## Step 7: Set up the script in Audio Hijack

1. Open Audio Hijack
2. Open your session (or create a new one)
3. Click **"Scripting"** in the sidebar
4. Click **"Script Library"** at the bottom left
5. Click **"+"** → **"New Script"**
6. Enter a name: `Spotify Discogs Tagger`
7. Copy the entire contents of `spotify_tagger.js` into the editor
8. Update these lines at the top of the script:

```javascript
const DISCOGS_TOKEN = "YOUR_TOKEN_HERE";              // ← your Discogs token
const RECORDING_FOLDER = "/Users/YOURUSERNAME/...";   // ← your username
const APPLESCRIPT_FILE = "/Users/YOURUSERNAME/Music/Audio Hijack/spotify captures/spotify_info.scpt";
```

> ⚠️ **Important:** Only enter your Discogs token locally in Audio Hijack. **Never commit your real token** to a public Git repository. Once it's on the internet, it's very hard to fully remove.

9. Save

---

## Step 8: Set up automations

You need two automations:

**Automation 1:**
- Click **"New Automation"**
- Event: **Session Start**
- Run: **Spotify Discogs Tagger**
- On/Off: **On**

**Automation 2:**
- Click **"New Automation"**
- Event: **Recording Stop**
- Run: **Spotify Discogs Tagger**
- On/Off: **On**

---

## Step 9: Set up the Silence Monitor

In the Recorder block in Audio Hijack:
1. Click the popover icon on the Recorder block
2. Select the **"File Limits"** tab
3. Check **"Start new file"**
4. Set value to **1.0** seconds of silence
5. Silence Threshold: around **-40dB**

---

## Step 10: Grant permissions

On first run, macOS will ask if Audio Hijack can access Spotify (or Music).

**Click "OK"!**

If you accidentally denied it:
1. Apple menu → **System Settings**
2. **Privacy & Security**
3. **Automation**
4. Enable **Audio Hijack** → **Spotify** (or **Music**)

---

## Usage

### Normal workflow

1. Start Spotify or Apple Music
2. Start the song you want to record
3. Start your Audio Hijack session
4. Music plays — every song is automatically tagged, cover art fetched, file renamed
5. Stop the session when done

### What happens exactly?

- After each song, Audio Hijack detects the silence between tracks
- The script reads what was just playing
- The file is tagged and renamed to `Artist - Title.mp3`
- The album cover is fetched from Discogs and embedded

---

## Debugging

### View the log file

In Terminal:

```bash
tail -50 /tmp/ah_tagger_debug.log
```

### Common issues

**"osascript failed"**
→ Spotify/Music is not running, or permissions are missing (see Step 10)

**No cover art**
→ Discogs token expired. Get a new one at: https://www.discogs.com/settings/developers

Test your token:
```bash
curl -s -H "Authorization: Discogs token=YOUR_TOKEN" \
"https://api.discogs.com/database/search?q=Beatles&type=release" | head -c 100
```
If JSON text appears, the token works.

**Songs tagged incorrectly**
→ Disable Spotify Crossfade and Automix (Settings → Playback)
→ Don't skip manually between songs during recording

**ffmpeg not found**
```bash
brew install ffmpeg
```

### Clear the cache (fresh start)

```bash
rm /tmp/ah_spotify_cache.json
```

### Clear the log

```bash
rm /tmp/ah_tagger_debug.log
```

---

## Uncopyright

This script is free — no copyright, no license, no conditions.
Take it, change it, share it. No credit required, but always appreciated.

Music belongs to everyone.

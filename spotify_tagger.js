// ============================================================================
// Spotify Auto-Tagger for Audio Hijack
// Version 1.7 - April 2026
// Built by Zoran Zdravkovic & Claude (Anthropic)
//
// This script does the heavy lifting you're too lazy to do yourself:
// - Tags your MP3s with artist, title, album, track and disc number
// - Fetches album covers from Discogs (when Discogs feels cooperative)
// - Renames files to "Artist - Title.mp3" like a civilized person
//
// TWO AUTOMATIONS REQUIRED:
// 1. Event "Session Start"  → this script (clears the cache)
// 2. Event "Recording Stop" → this script (does all the actual work)
// ============================================================================

// ============================================================================
// CONFIGURATION - Change these. Everything else: hands off.
// ============================================================================

// Your Discogs Personal Access Token.
// Get one at: https://www.discogs.com/settings/developers
const DISCOGS_TOKEN = "YOUR_DISCOGS_TOKEN_HERE";

// Where Audio Hijack dumps your recordings.
// Replace DEINNAME with your actual username. Shocking, we know.
const RECORDING_FOLDER = "/Users/YOUR_MAC_USERNAME/Music/Audio Hijack/spotify captures";

// The AppleScript that interrogates Spotify.
// Lives in the same folder as your MP3s. Don't move it.
const APPLESCRIPT_FILE = "/Users/YOUR_MAC_USERNAME/Documents/Scripts/spotify_info.scpt";

// ============================================================================
// STOP TOUCHING THINGS
// ============================================================================

const DISCOGS_API = "https://api.discogs.com";
const CACHE_FILE = "/tmp/ah_spotify_cache.json";
const LOG_FILE = "/tmp/ah_tagger_debug.log";

// Files smaller than this are silence artifacts. Not music. Delete them.
const MIN_FILE_SIZE = 500000;

// --- Logging -----------------------------------------------------------------

// Writes to log file. Because console.log alone is for optimists.
function log(message) {
    let timestamp = new Date().toISOString();
    let fullMsg = "[" + timestamp + "] " + message;
    console.log(fullMsg);
    app.runShellCommand("echo " + app.shellEscapeArgument(fullMsg) + " >> " + app.shellEscapeArgument(LOG_FILE));
}

// Same but louder. For when things go wrong (and they will).
function logError(message) {
    let timestamp = new Date().toISOString();
    let fullMsg = "[" + timestamp + "] ERROR: " + message;
    console.error(fullMsg);
    app.runShellCommand("echo " + app.shellEscapeArgument(fullMsg) + " >> " + app.shellEscapeArgument(LOG_FILE));
}

// --- Cache -------------------------------------------------------------------

// Reads the cached track. Returns null if the cache is empty or life is hard.
function readCache() {
    let cmd = "cat " + app.shellEscapeArgument(CACHE_FILE) + " 2>/dev/null";
    let [status, stdout] = app.runShellCommand(cmd);
    if (status !== 0) return null;
    
    try {
        let data = JSON.parse(stdout.trim());
        log("Cache hit: " + data.artist + " - " + data.title);
        return data;
    } catch (e) {
        return null;
    }
}

// Writes current track to cache. This is how we remember things across splits.
function writeCache(data) {
    let json = JSON.stringify(data);
    let cmd = "echo " + app.shellEscapeArgument(json) + " > " + app.shellEscapeArgument(CACHE_FILE);
    app.runShellCommand(cmd);
    log("Cache updated: " + data.artist + " - " + data.title);
}

// --- Spotify -----------------------------------------------------------------

// Asks Spotify what it's playing via AppleScript.
// Returns null if Spotify is being difficult (which is always).
function getSpotifyTrackInfo() {
    let cmd = "osascript " + app.shellEscapeArgument(APPLESCRIPT_FILE);
    let [status, stdout] = app.runShellCommand(cmd);
    
    if (status !== 0) {
        logError("osascript failed. Is Spotify running?");
        return null;
    }
    
    let output = stdout.trim();
    let parts = output.split("|||");
    if (parts.length < 3) {
        logError("Unexpected format from AppleScript: " + output);
        return null;
    }
    
    return {
        artist: parts[0],
        title:  parts[1],
        album:  parts[2],
        track:  parts[3] || "",
        disc:   parts[4] || ""
    };
}

// --- Cleanup -----------------------------------------------------------------

// Deletes tiny MP3s that are older than 30 seconds.
// These are silence artifacts, not music. Nobody wants them.
function deleteSmallFiles() {
    let cmd = "python3 -c \"import os, time; folder='" + RECORDING_FOLDER.replace(/'/g, "\\'") + "'; " +
              "now=time.time(); " +
              "files=[f for f in os.listdir(folder) if f.endswith('.mp3') and f.startswith('App Recording')]; " +
              "small=[f for f in files if os.path.getsize(os.path.join(folder,f)) < 500000 " +
              "and (now - os.path.getmtime(os.path.join(folder,f))) > 30]; " +
              "[os.remove(os.path.join(folder,f)) for f in small]; " +
              "print(len(small))\"";
    let [status, stdout] = app.runShellCommand(cmd);
    let count = parseInt(stdout.trim(), 10) || 0;
    if (count > 0) {
        log("Deleted " + count + " silence artifact(s). Good riddance.");
    }
}

// --- File size ---------------------------------------------------------------

// Returns file size in bytes. Zero if the file doesn't exist or is as empty as your soul.
function getFileSize(filePath) {
    let cmd = "stat -f%z " + app.shellEscapeArgument(filePath);
    let [status, stdout] = app.runShellCommand(cmd);
    if (status !== 0) return 0;
    return parseInt(stdout.trim(), 10);
}

// --- String normalization ----------------------------------------------------

// Strips accents for Discogs search.
// Because Rodríguez is a perfectly valid name but Discogs disagrees.
function normalizeString(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// --- ID3 tagging -------------------------------------------------------------

// Writes ID3 tags to MP3 via ffmpeg.
// Uses a temp file because overwriting in-place is for cowboys.
function setMP3Tags(filePath, title, artist, album, track, disc) {
    let tempMP3 = filePath + ".tmp.mp3";
    
    let ffmpegCmd = "/opt/homebrew/bin/ffmpeg -i " + app.shellEscapeArgument(filePath) +
                    " -metadata title=" +  app.shellEscapeArgument(title) +
                    " -metadata artist=" + app.shellEscapeArgument(artist) +
                    " -metadata album=" +  app.shellEscapeArgument(album) +
                    " -metadata track=" +  app.shellEscapeArgument(track) +
                    " -metadata disc=" +   app.shellEscapeArgument(disc) +
                    " -c copy " + app.shellEscapeArgument(tempMP3) + " 2>/dev/null";
    
    let [status] = app.runShellCommand(ffmpegCmd);
    if (status !== 0) {
        logError("ffmpeg tagging failed. ffmpeg is judging you.");
        return false;
    }
    
    let [mvStatus] = app.runShellCommand("mv " + app.shellEscapeArgument(tempMP3) + " " + app.shellEscapeArgument(filePath));
    if (mvStatus !== 0) {
        logError("mv failed. The file is going nowhere.");
        return false;
    }
    
    log("Tagged: " + artist + " - " + title);
    return true;
}

// --- Album art ---------------------------------------------------------------

// Fetches album art from Discogs and embeds it in the MP3.
// May fail. Discogs is moody. Life goes on.
function addCover(filePath, artist, title) {
    // Step 1: Search Discogs for a release ID
    let query = encodeURIComponent(normalizeString(artist) + " " + normalizeString(title));
    let url = DISCOGS_API + "/database/search?q=" + query + "&type=release";
    let cmd = "curl -s -H " + app.shellEscapeArgument("Authorization: Discogs token=" + DISCOGS_TOKEN) +
              " " + app.shellEscapeArgument(url);
    
    let [status, stdout] = app.runShellCommand(cmd);
    if (status !== 0) { logError("Discogs search failed. No internet? No cover."); return false; }
    
    let releaseId = null;
    try {
        let response = JSON.parse(stdout);
        releaseId = response.results && response.results[0] ? response.results[0].id : null;
    } catch (e) { logError("Discogs returned garbage. Shocking."); return false; }
    
    if (!releaseId) { log("No Discogs match for: " + artist + " - " + title + ". Obscure taste? Respect."); return false; }
    log("Discogs match: " + releaseId);
    
    // Step 2: Get the cover URL from the release
    let releaseCmd = "curl -s -H " + app.shellEscapeArgument("Authorization: Discogs token=" + DISCOGS_TOKEN) +
                     " " + app.shellEscapeArgument(DISCOGS_API + "/releases/" + releaseId);
    let [releaseStatus, releaseData] = app.runShellCommand(releaseCmd);
    if (releaseStatus !== 0) { logError("Discogs release fetch failed."); return false; }
    
    let coverUrl = null;
    try {
        let release = JSON.parse(releaseData);
        coverUrl = release.images && release.images[0] ? release.images[0].uri : null;
    } catch (e) { logError("Discogs release data unreadable."); return false; }
    
    if (!coverUrl) { log("No cover image on Discogs. Even Discogs has limits."); return false; }
    log("Cover URL found.");
    
    // Step 3: Download the cover
    let tempCover = "/tmp/ah_cover_temp.jpg";
    let [dlStatus] = app.runShellCommand(
        "curl -s -L " + app.shellEscapeArgument(coverUrl) + " -o " + app.shellEscapeArgument(tempCover)
    );
    if (dlStatus !== 0) { logError("Cover download failed. The internet is lying to you."); return false; }
    
    // Step 4: Embed the cover into the MP3
    let tempMP3 = filePath + ".tmp.mp3";
    let ffmpegCmd = "/opt/homebrew/bin/ffmpeg -i " + app.shellEscapeArgument(filePath) +
                    " -i " + app.shellEscapeArgument(tempCover) +
                    " -map 0 -map 1 -c copy -id3v2_version 3" +
                    " -metadata:s:v title=" +   app.shellEscapeArgument("Album cover") +
                    " -metadata:s:v comment=" + app.shellEscapeArgument("Cover (front)") +
                    " " + app.shellEscapeArgument(tempMP3) + " 2>/dev/null";
    
    let [ffStatus] = app.runShellCommand(ffmpegCmd);
    app.runShellCommand("rm -f " + app.shellEscapeArgument(tempCover));
    
    if (ffStatus !== 0) { logError("ffmpeg cover embedding failed. No art for you."); return false; }
    
    let [mvStatus] = app.runShellCommand("mv " + app.shellEscapeArgument(tempMP3) + " " + app.shellEscapeArgument(filePath));
    if (mvStatus !== 0) { logError("mv failed after cover embed. Truly cursed."); return false; }
    
    log("Cover embedded. Beautiful.");
    return true;
}

// --- Rename ------------------------------------------------------------------

// Renames file to "Artist - Title.mp3".
// If the file already exists, appends (2), (3), etc. like a responsible adult.
function renameFile(filePath, artist, title) {
    if (!artist || !title) return filePath;
    
    let cleanArtist = artist.replace(/[\/:*?"<>|]/g, "-");
    let cleanTitle  = title.replace(/[\/:*?"<>|]/g, "-");
    let newName = cleanArtist + " - " + cleanTitle;
    let newPath = RECORDING_FOLDER + "/" + newName + ".mp3";
    
    // Don't overwrite existing files. That would be rude.
    let counter = 2;
    let checkCmd = "test -f " + app.shellEscapeArgument(newPath) + " && echo exists || echo ok";
    let [, checkOut] = app.runShellCommand(checkCmd);
    while (checkOut.trim() === "exists") {
        newPath = RECORDING_FOLDER + "/" + newName + " (" + counter + ").mp3";
        checkCmd = "test -f " + app.shellEscapeArgument(newPath) + " && echo exists || echo ok";
        [, checkOut] = app.runShellCommand(checkCmd);
        counter++;
    }
    
    let [status] = app.runShellCommand(
        "mv " + app.shellEscapeArgument(filePath) + " " + app.shellEscapeArgument(newPath)
    );
    
    if (status === 0) {
        log("Renamed to: " + newPath);
        return newPath;
    } else {
        logError("Rename failed. The file is staying ugly.");
        return filePath;
    }
}

// --- Event handlers ----------------------------------------------------------

// Session Start: wipe the cache so yesterday's songs don't haunt today's session.
function handleSessionStart() {
    log("Session starting. Wiping cache. Fresh start. Very zen.");
    app.runShellCommand("rm -f " + app.shellEscapeArgument(CACHE_FILE));
    log("Cache cleared. You're welcome.");
}

// File Did End: the main event.
//
// The offset principle (pay attention):
// Split 1 → no cache → use current track as fallback → tag this file
// Split 2 → cache has Song A → tag previous file with Song A, cache Song B
// Split 3 → cache has Song B → tag previous file with Song B, cache Song C
//
// The double-read trick for caching:
// Read Spotify immediately at split (likely still old song).
// Wait 3 seconds. Read again.
// If track changed → cache the new one. If not → cache what we have.
function handleFileDidEnd() {
    log("File complete. Time to get to work.");
    
    // Clean up silence artifacts older than 30s.
    deleteSmallFiles();

    // Get the file directly from the event object. RTFM, Bronko.
    let filePath = event.file.filePath;
    log("File from event: " + filePath);

    // Read Spotify immediately at split time
    log("Reading Spotify at split time...");
    let trackAtSplit = getSpotifyTrackInfo();
    if (trackAtSplit) {
        log("Track at split: " + trackAtSplit.artist + " - " + trackAtSplit.title);
    }

    // Tag this file using cached track info.
    // Fallback: if cache is empty (first file of session), use current track.
    let cachedTrack = readCache();
    if (!cachedTrack && trackAtSplit) {
        log("Cache empty - using current track as fallback for first file.");
        cachedTrack = trackAtSplit;
    }

    if (cachedTrack && filePath) {
        let fileSize = getFileSize(filePath);
        log("File size: " + Math.round(fileSize / 1024) + " KB");
        
        if (fileSize < MIN_FILE_SIZE) {
            log("File too small - silence artifact. Skipping.");
        } else {
            log("Tagging: " + filePath);
            let tagged = setMP3Tags(filePath, cachedTrack.title, cachedTrack.artist, cachedTrack.album, cachedTrack.track, cachedTrack.disc);
            if (tagged) {
                addCover(filePath, cachedTrack.artist, cachedTrack.title);
                renameFile(filePath, cachedTrack.artist, cachedTrack.title);
            }
        }
    }

    // Wait 3 seconds for Spotify to settle on the next track
    log("Waiting 3s for Spotify to make up its mind...");
    app.runShellCommand("sleep 3");

    // Read Spotify again after the wait
    let trackAfterSplit = getSpotifyTrackInfo();
    if (trackAfterSplit) {
        log("Track after split: " + trackAfterSplit.artist + " - " + trackAfterSplit.title);
    }

    // Cache the right track for next split
    let trackToCache = null;
    if (trackAtSplit && trackAfterSplit) {
        if (trackAfterSplit.title !== trackAtSplit.title) {
            log("Track changed. Caching new track.");
            trackToCache = trackAfterSplit;
        } else {
            log("Track unchanged. Caching current track.");
            trackToCache = trackAtSplit;
        }
    } else {
        trackToCache = trackAtSplit || trackAfterSplit;
    }

    if (trackToCache) {
        writeCache(trackToCache);
    } else {
        logError("Couldn't determine current track. This is fine. Everything is fine.");
    }
}

// --- Main --------------------------------------------------------------------

function main() {
    log("========== START (Event: " + event.eventType + ") ==========");
    
    if (event.eventType === "sessionWillStart") {
        handleSessionStart();
    } else if (event.eventType === "fileDidEnd") {
        handleFileDidEnd();
    } else {
        log("Unknown event: " + event.eventType + ". Logging it for science.");
    }
    
    log("========== END ==========\n");
}

main();

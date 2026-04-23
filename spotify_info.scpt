tell application "Spotify"
    set trackArtist to artist of current track
    set trackName to name of current track
    set trackAlbum to album of current track
    set trackNumber to track number of current track as string
    set discNumber to disc number of current track as string
    set playerState to player state as string
    return trackArtist & "|||" & trackName & "|||" & trackAlbum & "|||" & trackNumber & "|||" & discNumber & "|||" & playerState
end tell
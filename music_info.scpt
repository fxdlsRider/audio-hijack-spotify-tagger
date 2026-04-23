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

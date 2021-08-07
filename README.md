# User-Scripts
A collection of short random scripts I've made that aren't worthy of a standalone repository.  
Browser userscripts require an addons like [Violentmonkey](https://github.com/violentmonkey/violentmonkey) to install and run.

<br />

## Browser Userscripts:
### TheWorker-Bypass:
A script for removing blur and registration banner, and enabling right mouse click and text selection on [theworker.co.il](https://theworker.co.il).  
[Install Link](https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/TheWorker-Bypass.js)

<br />

## Bash Scripts:
### CreateLinks:
A Bash script to generate symlink for each media file within folder (works with single files, folders, and nested folders).

Usage: ```CreateLinks <Source Directory> <Destination Directory>```

<br />

### extrack:
A script for extracting a specific track id from media files that are supported by ffmpeg.
Input can be either a file, or a directory (which will run the script on all files within the folder).

Requires ffmpeg to be installed to work.

Usage: ```extrack <File / Directory> <Track ID> <File Format>```
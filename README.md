# User-Scripts
A collection of small user-scripts that aren't worthy of a standalone repository.  
For using the user-scripts, a browser add-on like [Violentmonkey](https://github.com/violentmonkey/violentmonkey) is required to be installed.

<br />

## Browser Userscripts:
### TheWorker-Bypass:
Remove blur and mid screen banner, and enable right-click and selection on [theworker.co.il](https://theworker.co.il).  
[Install Link](https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/TheWorker-Bypass.user.js)

<br />

### RealPython-Bypass:
Remove registartion / login pop-up, and restore scrolling on [realpython.com](https://realpython.com).  
[Install Link](https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/RealPython-Bypass.user.js)

<br />

## Bash Scripts:
### genlinks:
A script for generating symlinks.  
The script will duplicate source's directory structure to destination with symlinks instead of files.  
File extensions can be passed to allow filtering and will allow creating symlinks only for files with the extensions that were passed.

Usage: ```genlinks <Source File / Directory> <Destination Directory> [<File Extensions>...]```

<br />

### extrack:
A script for extracting a specific track id from media files that are supported by ffmpeg.
Input can be either a file, or a directory (which will run the script on all files within the folder).

Requires ffmpeg to be installed to work.

Usage: ```extrack <File / Directory> <Track ID> <File Format>```
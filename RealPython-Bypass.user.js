// ==UserScript==
// @name        RealPython Registartion Pop-up Bypass
// @namespace   https://github.com/MichaelYochpaz/User-Scripts
// @icon        https://cdn.realpython.com/static/favicon.ico
// @author      Michael Yochpaz
// @version     1.0.1
// @include     https://realpython.com/*
// @description Remove registration / login pop-up on realpython.com.
// @downloadURL https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/RealPython-Bypass.js
// @updateURL   https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/RealPython-Bypass.js
// ==/UserScript==

// Remove Registration Pop-up
document.getElementById("rprw").remove();
document.getElementsByClassName("modal-backdrop").remove();
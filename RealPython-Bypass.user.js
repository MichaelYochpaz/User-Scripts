// ==UserScript==
// @name        RealPython Registartion Pop-up Bypass
// @namespace   https://github.com/MichaelYochpaz/User-Scripts
// @icon        https://cdn.realpython.com/static/favicon.ico
// @author      Michael Yochpaz
// @version     1.0.0
// @include     https://realpython.com/*
// @grant       GM_addStyle
// @description Remove registration / login pop-up, and restore scrolling on realpython.com.
// @downloadURL https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/RealPython-Bypass.js
// @updateURL   https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/RealPython-Bypass.js
// ==/UserScript==

// Remove Registration Pop-up
document.getElementById("rprw").remove();
document.getElementsByClassName("modal-backdrop").remove()

// Restore Scrolling
GM_addStyle (`.modal-open {overflow: scroll !important}`);
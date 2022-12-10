// ==UserScript==
// @name        RealPython Registartion Pop-up Bypass
// @description Remove registration / login pop-up on realpython.com.
// @namespace   https://github.com/MichaelYochpaz/User-Scripts
// @homepageURL  https://github.com/MichaelYochpaz/User-Scripts
// @downloadURL https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/RealPython-Bypass.js
// @updateURL   https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/RealPython-Bypass.js
// @supportURL   https://github.com/MichaelYochpaz/User-Scripts/issues
// @icon        https://cdn.realpython.com/static/favicon.ico
// @author      Michael Yochpaz
// @license     MIT
// @version     1.0.2
// @include     *://realpython.com/*
// @grant       GM_addStyle
// @run-at      document-idle
// ==/UserScript==

// Hide modal
GM_addStyle (`.modal {display: none !important}`);
GM_addStyle (`.modal-backdrop.show {opacity: 0 !important}`);

// Restore Scrolling
GM_addStyle (`.modal-open {overflow: scroll !important}`);
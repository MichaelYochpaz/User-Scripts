// ==UserScript==
// @name         Booking.com Mobile Price Viewer
// @namespace    https://github.com/MichaelYochpaz/User-Scripts
// @version      1.1.0
// @description  Displays mobile-exclusive prices on the desktop version of Booking.com
// @author       Michael Yochpaz
// @match        *://*.booking.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      booking.com
// @noframes
// @run-at       document-idle
// @icon         https://cf.bstatic.com/static/img/favicon/40749a316c45e239a7149b6711ea4c48d10f8d89.ico
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/browser-userscripts/Booking-Mobile-Price-Viewer.user.js
// @updateURL    https://raw.githubusercontent.com/MichaelYochpaz/User-Scripts/main/browser-userscripts/Booking-Mobile-Price-Viewer.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    const CONFIG = {
        mobileUserAgent: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.123 Mobile Safari/537.36',
        
        // Timing configuration (milliseconds)
        debounceDelay: 500,
        reinjectDelay: 100,
        networkTimeout: 10000,
        initialWaitTime: 1000,
        spaCheckInterval: 2000,
        
        // Display configuration
        badgeIcon: '📱',
        badgeTextFormat: '{price}',
        tooltipText: 'Mobile-exclusive price — book via a mobile device to get this rate (added by Mobile Price Viewer userscript)',
        badgeClassName: 'mobile-price-badge',
        
        debug: false,
        
        // CSS Selectors - These are based on Booking.com's current structure
        // NOTE: These selectors may need updates if Booking.com changes their layout
        selectors: {
            // Search results page selectors
            hotelCard: '[data-testid="property-card"]',
            hotelTitle: '[data-testid="title"]',
            
            // Property page selectors
            propertyRoomRow: 'tbody tr[data-block-id]',
            propertyPriceCell: '.hprt-table-cell-price',
            propertyPriceBlock: '.hprt-price-block',
            mobileRoomOption: 'label[role="radio"][data-block-id]',
            mobileDealBadge_Property: '.bui-badge.bui-badge--constructive',
            mobilePrice_Property: '.bui-price-display__value .prco-valign-middle-helper',
        },
        
        // CSS styles for the mobile price badge and card highlight
        style: `
            /* Card-level highlight for properties with mobile deals */
            [data-testid="property-card"].mobile-deal-card {
                background: linear-gradient(to left, rgba(185, 220, 190, 0.45), transparent 50%), #fff !important;
                border-inline-end: 3px solid #66bb6a !important;
            }
            
            [dir="rtl"] [data-testid="property-card"].mobile-deal-card {
                background: linear-gradient(to right, rgba(185, 220, 190, 0.45), transparent 50%), #fff !important;
            }
            
            .mobile-price-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 10px;
                margin-top: 4px;
                background: #dcefdc;
                border: 1px solid #81c784;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 700;
                color: #2e7d32;
                cursor: help;
                position: relative;
                direction: ltr;
                unicode-bidi: isolate;
                transition: background 0.15s ease;
            }
            
            .mobile-price-badge:hover {
                background: #c8e6c9;
            }
            
            .mobile-price-badge-icon {
                font-size: 14px;
                flex-shrink: 0;
                line-height: 1;
            }
            
            .mobile-price-badge-text {
                line-height: 1;
            }
            
            /* Tooltip on hover */
            .mobile-price-badge::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 100%;
                left: 0;
                transform: translateY(-6px);
                padding: 6px 10px;
                background: #333;
                color: #fff;
                font-size: 11px;
                font-weight: 400;
                border-radius: 4px;
                width: max-content;
                max-width: 260px;
                white-space: normal;
                line-height: 1.4;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.15s ease;
                z-index: 1000;
            }
            
            .mobile-price-badge::before {
                content: '';
                position: absolute;
                bottom: 100%;
                left: 12px;
                border: 5px solid transparent;
                border-top-color: #333;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.15s ease;
                z-index: 1000;
            }
            
            .mobile-price-badge:hover::after {
                opacity: 1;
            }
            
            .mobile-price-badge:hover::before {
                opacity: 1;
            }
        `
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    
    /**
     * Debug logger
     * @param {...any} args - Arguments to log
     */
    function log(...args) {
        if (CONFIG.debug) {
            console.log('[Booking Mobile Prices]', ...args);
        }
    }
    
    /**
     * Error logger
     * @param {...any} args - Arguments to log
     */
    function logError(...args) {
        console.error('[Booking Mobile Prices ERROR]', ...args);
    }
    
    /**
     * Creates a debounced version of a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
    
    /**
     * Detects the current page type (search results or property page)
     * @returns {string} Page type: 'search', 'property', or 'unknown'
     */
    function detectPageType() {
        const url = window.location.href;
        
        if (url.includes('searchresults')) {
            return 'search';
        } else if (url.includes('/hotel/')) {
            return 'property';
        }
        
        return 'unknown';
    }
    
    /**
     * Formats a price from a raw numeric value and currency code.
     * Uses a fixed locale to ensure consistent symbol-first formatting
     * regardless of the page's language (e.g., "₪ 2,407" instead of "2,407 ₪").
     * @param {number} amount - The unformatted numeric price
     * @param {string} currency - ISO 4217 currency code (e.g., "ILS", "EUR")
     * @returns {string} Formatted price string, or empty string on failure
     */
    function formatPrice(amount, currency) {
        if (amount == null || !currency) return '';
        try {
            return new Intl.NumberFormat('en', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 0,
                minimumFractionDigits: 0,
            }).format(Math.round(amount));
        } catch {
            return '';
        }
    }
    
    /**
     * Extracts and normalizes price text from an element
     * @param {Element} parent - Parent element to search within
     * @param {string} selector - Selector for price element
     * @returns {string} Normalized price text
     */
    function extractPriceText(parent, selector) {
        const priceElement = parent.querySelector(selector);
        if (!priceElement) return '';
        
        return priceElement.textContent
            .trim()
            .replace(/\s+/g, ' ');
    }
    
    /**
     * Analyzes MutationObserver records to determine if re-injection or reprocessing is needed
     * @param {MutationRecord[]} mutations - The mutation records to analyze
     * @param {string} cardSelector - CSS selector for the card/row elements to watch for
     * @returns {{shouldReinject: boolean, shouldReprocess: boolean}} Analysis result
     */
    function analyzeMutations(mutations, cardSelector) {
        let shouldReinject = false;
        let shouldReprocess = false;
        
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;
            
            // Check if new card/row elements were added
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                // Skip mutations caused by our own badge injection
                if (node.classList?.contains(CONFIG.badgeClassName)) continue;
                
                if (node.matches?.(cardSelector) || node.querySelector?.(cardSelector)) {
                    shouldReprocess = true;
                    break;
                }
            }
            
            // Check if our badges were removed (e.g., by Booking.com's JS re-rendering)
            if (!shouldReinject) {
                for (const node of mutation.removedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    
                    if (node.classList?.contains(CONFIG.badgeClassName) ||
                        node.querySelector?.(`.${CONFIG.badgeClassName}`)) {
                        shouldReinject = true;
                        break;
                    }
                }
            }
            
            if (shouldReprocess) break;
        }
        
        return { shouldReinject, shouldReprocess };
    }
    
    /**
     * Creates a badge element with icon and text
     * @param {string} priceText - The price text to display
     * @param {string} identifier - Identifier for tracking (hotel name or block ID)
     * @param {string} attributeName - Name of the data attribute ('data-hotel-name' or 'data-block-id')
     * @returns {HTMLElement} The created badge element
     */
    function createBadgeElement(priceText, identifier, attributeName) {
        const badge = document.createElement('div');
        badge.className = CONFIG.badgeClassName;
        badge.setAttribute('data-tooltip', CONFIG.tooltipText);
        badge.setAttribute(attributeName, identifier);
        
        const icon = document.createElement('span');
        icon.className = 'mobile-price-badge-icon';
        icon.textContent = CONFIG.badgeIcon;
        
        const text = document.createElement('span');
        text.className = 'mobile-price-badge-text';
        text.textContent = CONFIG.badgeTextFormat.replace('{price}', priceText);
        
        badge.appendChild(icon);
        badge.appendChild(text);
        
        return badge;
    }

    // ============================================================================
    // CORE FUNCTIONALITY
    // ============================================================================
    
    /**
     * Fetches the mobile version of the current page.
     * Uses callback-based GM_xmlhttpRequest wrapped in a Promise for
     * compatibility across Violentmonkey, Tampermonkey, and Greasemonkey.
     * @param {string} url - The URL to fetch
     * @returns {Promise<string>} The HTML content of the mobile page
     */
    function fetchMobilePage(url) {
        log('Fetching mobile page:', url);
        
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {
                    'User-Agent': CONFIG.mobileUserAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                timeout: CONFIG.networkTimeout,
                onload: (response) => {
                    if (response.status !== 200) {
                        logError('Failed to fetch mobile page:', `HTTP ${response.status}`);
                        reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                    } else {
                        log('Mobile page fetched successfully');
                        resolve(response.responseText);
                    }
                },
                onerror: (error) => {
                    logError('Failed to fetch mobile page:', error);
                    reject(new Error('Network error'));
                },
                ontimeout: () => {
                    logError('Mobile page request timed out');
                    reject(new Error('Request timed out'));
                },
            });
        });
    }
    
    /**
     * Recursively traverses JSON data to find hotels with mobile-exclusive deals.
     * Looks for the priceDisplayInfoIrene object which contains language-invariant
     * badge identifiers (e.g., "Mobile Rate") and discount product IDs (e.g., "mobile-discount").
     * @param {any} obj - JSON object to traverse
     * @param {Map<string, object>} priceMap - Map to populate with results
     */
    function extractMobilePricesFromJSON(obj, priceMap) {
        if (!obj || typeof obj !== 'object') return;
        
        if (obj.priceDisplayInfoIrene && obj.displayName?.text) {
            const info = obj.priceDisplayInfoIrene;
            const badges = info.badges || [];
            const discounts = info.discounts || [];
            
            const isMobileDeal = badges.some(b => b.identifier === 'Mobile Rate') ||
                                 discounts.some(d => d.productId === 'mobile-discount');
            
            if (isMobileDeal) {
                const hotelName = obj.displayName.text.trim();
                const priceData = info.displayPrice?.amountPerStay;
                const priceText = formatPrice(priceData?.amountUnformatted, priceData?.currency)
                                  || priceData?.amount?.trim();
                
                if (hotelName && priceText) {
                    priceMap.set(hotelName, {
                        price: priceText,
                        rawPrice: priceData?.amountUnformatted,
                        hasMobileDeal: true,
                    });
                    log(`✓ Found mobile-only deal for "${hotelName}": ${priceText}`);
                }
            }
        }
        
        if (Array.isArray(obj)) {
            for (const item of obj) extractMobilePricesFromJSON(item, priceMap);
        } else {
            for (const key of Object.keys(obj)) {
                extractMobilePricesFromJSON(obj[key], priceMap);
            }
        }
    }
    
    /**
     * Parses mobile HTML and extracts hotel price data from embedded JSON.
     * Uses the priceDisplayInfoIrene GraphQL data structure which contains
     * language-invariant identifiers, making detection work across all locales.
     * @param {string} mobileHtml - The HTML content from the mobile page
     * @returns {Map<string, object>} Map of hotel names to price information
     */
    function parseMobilePrices(mobileHtml) {
        log('Parsing mobile HTML for prices...');
        
        try {
            const parser = new DOMParser();
            const mobileDoc = parser.parseFromString(mobileHtml, 'text/html');
            const priceMap = new Map();
            
            // Extract pricing data from embedded JSON <script> tags.
            // The priceDisplayInfoIrene object contains badge identifiers
            // (e.g., "Mobile Rate") that remain in English regardless of page language.
            for (const script of mobileDoc.querySelectorAll('script[type="application/json"]')) {
                const content = script.textContent;
                if (!content.includes('priceDisplayInfoIrene')) continue;
                
                try {
                    const data = JSON.parse(content);
                    extractMobilePricesFromJSON(data, priceMap);
                } catch (parseError) {
                    logError('Failed to parse embedded JSON:', parseError);
                }
            }
            
            log(`Price map created with ${priceMap.size} entries`);
            if (priceMap.size === 0) {
                log('⚠️ WARNING: No mobile prices found in embedded JSON. The data structure may have changed.');
            }
            return priceMap;
            
        } catch (error) {
            logError('Error parsing mobile HTML:', error);
            return new Map();
        }
    }
    
    /**
     * Parses mobile HTML for property pages and extracts room price data
     * @param {string} mobileHtml - The HTML content from the mobile page
     * @returns {Map<string, object>} Map of block IDs to price information
     */
    function parseMobileRoomPrices(mobileHtml) {
        log('Parsing mobile HTML for room prices...');
        
        try {
            const parser = new DOMParser();
            const mobileDoc = parser.parseFromString(mobileHtml, 'text/html');
            
            // Find all room options in mobile page
            const mobileRoomOptions = mobileDoc.querySelectorAll(CONFIG.selectors.mobileRoomOption);
            log(`Found ${mobileRoomOptions.length} room options in mobile HTML`);
            
            const priceMap = new Map();
            
            mobileRoomOptions.forEach((option, index) => {
                try {
                    const blockId = option.getAttribute('data-block-id');
                    if (!blockId) return;
                    
                    const dealBadge = option.querySelector(CONFIG.selectors.mobileDealBadge_Property);
                    if (!dealBadge) return;
                    
                    const priceText = extractPriceText(option, CONFIG.selectors.mobilePrice_Property);
                    if (priceText) {
                        priceMap.set(blockId, { price: priceText, hasMobileDeal: true });
                        log(`✓ Found mobile-only deal for block ${blockId}: ${priceText}`);
                    }
                } catch (error) {
                    logError(`Error parsing room option ${index}:`, error);
                }
            });
            
            log(`Price map created with ${priceMap.size} mobile-exclusive room deals`);
            return priceMap;
            
        } catch (error) {
            logError('Error parsing mobile room HTML:', error);
            return new Map();
        }
    }
    
    /**
     * Extracts desktop prices from the current page's embedded JSON data.
     * Uses the same priceDisplayInfoIrene structure as mobile, ensuring
     * consistent numeric comparison without currency parsing.
     * @returns {Map<string, number>} Map of hotel names to raw numeric prices
     */
    function getDesktopPrices() {
        const priceMap = new Map();
        
        for (const script of document.querySelectorAll('script[type="application/json"]')) {
            const content = script.textContent;
            if (!content.includes('priceDisplayInfoIrene')) continue;
            
            try {
                const data = JSON.parse(content);
                (function traverse(obj) {
                    if (!obj || typeof obj !== 'object') return;
                    
                    if (obj.priceDisplayInfoIrene && obj.displayName?.text) {
                        const name = obj.displayName.text.trim();
                        const amount = obj.priceDisplayInfoIrene.displayPrice?.amountPerStay?.amountUnformatted;
                        if (name && amount != null) {
                            priceMap.set(name, amount);
                        }
                    }
                    
                    if (Array.isArray(obj)) {
                        for (const item of obj) traverse(item);
                    } else {
                        for (const key of Object.keys(obj)) traverse(obj[key]);
                    }
                })(data);
            } catch (e) {
                logError('Failed to parse desktop JSON:', e);
            }
        }
        
        log(`Extracted ${priceMap.size} desktop prices from page JSON`);
        return priceMap;
    }
    
    /**
     * Injects mobile price badges into desktop hotel cards
     * @param {Map<string, object>} priceMap - Map of hotel names to price info
     */
    function injectMobilePrices(priceMap) {
        if (priceMap.size === 0) {
            log('No mobile prices to inject');
            return;
        }
        
        log('Injecting mobile prices into desktop cards...');
        
        // Get desktop prices for comparison (from page's embedded JSON)
        const desktopPrices = getDesktopPrices();
        
        // Find all desktop hotel cards
        const desktopCards = document.querySelectorAll(CONFIG.selectors.hotelCard);
        let injectedCount = 0;
        let skippedCount = 0;
        
        desktopCards.forEach((card, index) => {
            try {
                // Extract hotel name from desktop card
                const titleElement = card.querySelector(CONFIG.selectors.hotelTitle);
                if (!titleElement) {
                    return;
                }
                
                const hotelName = titleElement.textContent.trim();
                
                // Check if we have mobile price data for this hotel
                const mobileData = priceMap.get(hotelName);
                if (!mobileData) {
                    return;
                }
                
                // Compare mobile vs desktop price — only show badge if mobile is actually cheaper
                const desktopPrice = desktopPrices.get(hotelName);
                if (desktopPrice != null && mobileData.rawPrice != null) {
                    if (Math.round(mobileData.rawPrice) >= Math.round(desktopPrice)) {
                        skippedCount++;
                        log(`Skipping "${hotelName}": mobile price (${Math.round(mobileData.rawPrice)}) is not lower than desktop (${Math.round(desktopPrice)})`);
                        return;
                    }
                }
                
                if (card.querySelector(`.${CONFIG.badgeClassName}`)) return;
                
                const priceSection = findPriceSection(card);
                if (!priceSection) {
                    log(`Card ${index}: No price section found for "${hotelName}"`);
                    return;
                }
                
                const badge = createBadgeElement(mobileData.price, hotelName, 'data-hotel-name');
                priceSection.insertAdjacentElement('afterend', badge);
                
                // Add highlight to the card (green tint + border accent)
                card.classList.add('mobile-deal-card');
                
                injectedCount++;
                log(`Injected price for "${hotelName}": ${mobileData.price} (desktop: ${Math.round(desktopPrice || 0)})`);
                
            } catch (error) {
                logError(`Error injecting price for card ${index}:`, error);
            }
        });
        
        log(`Injected ${injectedCount} badges, skipped ${skippedCount} (same or higher price)`);
    }
    
    /**
     * Injects mobile price badges into desktop property page room rows
     * @param {Map<string, object>} priceMap - Map of block IDs to price info
     */
    function injectRoomPrices(priceMap) {
        if (priceMap.size === 0) {
            log('No mobile room prices to inject');
            return;
        }
        
        log('Injecting mobile prices into room offerings...');
        
        const roomRows = document.querySelectorAll(CONFIG.selectors.propertyRoomRow);
        log(`Found ${roomRows.length} room rows on desktop page`);
        
        // If no rows found, log helpful diagnostic info
        if (roomRows.length === 0) {
            const dataBlockElements = document.querySelectorAll('[data-block-id]');
            log(`⚠️ No room rows found with selector '${CONFIG.selectors.propertyRoomRow}'`);
            log(`Found ${dataBlockElements.length} elements with data-block-id attribute on page`);
            if (dataBlockElements.length > 0) {
                log(`First element with data-block-id: <${dataBlockElements[0].tagName.toLowerCase()}>`);
            }
            return;
        }
        
        let injectedCount = 0;
        
        roomRows.forEach((row, index) => {
            try {
                const blockId = row.getAttribute('data-block-id');
                if (!blockId) return;
                
                // Check if we have mobile price data for this room
                const mobileData = priceMap.get(blockId);
                if (!mobileData) return;
                
                if (row.querySelector(`.${CONFIG.badgeClassName}`)) return;
                
                const priceCell = row.querySelector(CONFIG.selectors.propertyPriceCell);
                if (!priceCell) {
                    log(`⚠️ No price cell found for block ${blockId}`);
                    return;
                }
                
                const badge = createBadgeElement(mobileData.price, blockId, 'data-block-id');
                
                const taxesText = priceCell.querySelector('.prd-taxes-and-fees-under-price');
                if (taxesText?.parentElement) {
                    taxesText.parentElement.insertBefore(badge, taxesText);
                } else {
                    const fallbackTarget = row.querySelector(CONFIG.selectors.propertyPriceBlock) || priceCell;
                    if (fallbackTarget) {
                        fallbackTarget.appendChild(badge);
                    } else {
                        log(`⚠️ Could not find injection point for block ${blockId}`);
                        return;
                    }
                }
                
                injectedCount++;
                log(`✓ Injected mobile price for block ${blockId}: ${mobileData.price}`);
                
            } catch (error) {
                logError(`Error injecting price for row ${index}:`, error);
            }
        });
        
        log(`Successfully injected ${injectedCount} mobile price badges on property page`);
    }
    
    /**
     * Finds the price section in a hotel card
     * @param {Element} card - The hotel card element
     * @returns {Element|null} The price section element
     */
    function findPriceSection(card) {
        const priceElement = card.querySelector('[data-testid="price-and-discounted-price"]');
        
        // Try to find a named price container via closest(), but ensure
        // we don't walk outside the card boundary
        let priceSection = priceElement?.closest('div[data-testid*="price"]');
        if (priceSection && !card.contains(priceSection)) {
            priceSection = null;
        }
        
        if (!priceSection) {
            const fallback = priceElement || card.querySelector('[data-testid="price"]');
            priceSection = fallback?.parentElement?.parentElement;
        }
        
        return priceSection;
    }
    
    // ============================================================================
    // DYNAMIC CONTENT OBSERVER
    // ============================================================================
    
    /**
     * Sets up MutationObserver to watch for dynamically loaded hotel cards and badge removal
     * @param {Map<string, object>} initialPriceMap - Initial price map to cache
     * @returns {object} Object with observer and disconnect function
     */
    function setupDynamicContentObserver(initialPriceMap) {
        log('Setting up MutationObserver for dynamic content...');
        
        let cachedPriceMap = initialPriceMap || new Map();
        
        const reinjectPrices = () => cachedPriceMap.size > 0 && injectMobilePrices(cachedPriceMap);
        const debouncedReinject = debounce(reinjectPrices, CONFIG.reinjectDelay);
        
        const debouncedProcess = debounce(async () => {
            try {
                const mobileHtml = await fetchMobilePage(window.location.href);
                cachedPriceMap = parseMobilePrices(mobileHtml);
                injectMobilePrices(cachedPriceMap);
            } catch (error) {
                logError('Failed to refetch mobile page:', error);
            }
        }, CONFIG.debounceDelay);
        
        const observer = new MutationObserver((mutations) => {
            const { shouldReinject, shouldReprocess } = analyzeMutations(mutations, CONFIG.selectors.hotelCard);
            
            if (shouldReprocess) {
                log('New hotel cards detected, reprocessing...');
                debouncedProcess();
            } else if (shouldReinject) {
                log('Badges removed, re-injecting...');
                debouncedReinject();
            }
        });
        
        // Observe the main content area
        const targetNode = document.body;
        if (targetNode) {
            observer.observe(targetNode, {
                childList: true,
                subtree: true
            });
            log('MutationObserver started');
        } else {
            logError('Could not find target node for MutationObserver');
        }
        
        return {
            observer,
            disconnect: () => observer.disconnect()
        };
    }
    
    /**
     * Sets up MutationObserver for property pages to watch for new room offerings
     * @param {Map<string, object>} initialPriceMap - Initial price map to cache
     * @returns {object} Object with observer and disconnect function
     */
    function setupPropertyPageObserver(initialPriceMap) {
        log('Setting up MutationObserver for property page...');
        
        let cachedPriceMap = initialPriceMap || new Map();
        
        const reinjectPrices = () => cachedPriceMap.size > 0 && injectRoomPrices(cachedPriceMap);
        const debouncedReinject = debounce(reinjectPrices, CONFIG.reinjectDelay);
        
        const debouncedProcess = debounce(async () => {
            try {
                const mobileHtml = await fetchMobilePage(window.location.href);
                cachedPriceMap = parseMobileRoomPrices(mobileHtml);
                injectRoomPrices(cachedPriceMap);
            } catch (error) {
                logError('Failed to refetch mobile page:', error);
            }
        }, CONFIG.debounceDelay);
        
        const observer = new MutationObserver((mutations) => {
            const { shouldReinject, shouldReprocess } = analyzeMutations(mutations, CONFIG.selectors.propertyRoomRow);
            
            if (shouldReprocess) {
                log('New room rows detected, reprocessing...');
                debouncedProcess();
            } else if (shouldReinject) {
                log('Badges removed, re-injecting...');
                debouncedReinject();
            }
        });
        
        const targetNode = document.body;
        if (targetNode) {
            observer.observe(targetNode, {
                childList: true,
                subtree: true
            });
            log('Property page MutationObserver started');
        }
        
        return {
            observer,
            disconnect: () => observer.disconnect()
        };
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    // Track current observer for cleanup
    let currentObserver = null;
    let stylesInjected = false;
    let currentUrl = location.href;
    let currentPageType = detectPageType();
    
    /**
     * Main initialization function
     */
    async function init() {
        log('Initializing Booking.com Mobile Price Viewer...');
        
        const pageType = detectPageType();
        if (pageType === 'unknown') {
            log('Not a supported page type, exiting');
            return;
        }
        
        log(`Detected page type: ${pageType}`);
        
        // Inject CSS styles (only once)
        if (!stylesInjected) {
            GM_addStyle(CONFIG.style);
            stylesInjected = true;
            log('CSS styles injected');
        }
        
        // Disconnect any existing observer before waiting, to prevent
        // redundant fetches from the old observer during the delay
        if (currentObserver) {
            log('Disconnecting previous observer...');
            currentObserver.disconnect();
            currentObserver = null;
        }
        
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Give the page a moment to render
        await new Promise(resolve => setTimeout(resolve, CONFIG.initialWaitTime));
        
        // Fetch mobile page once and use for both initial injection and observer
        try {
            const mobileHtml = await fetchMobilePage(window.location.href);
            
            // Process based on page type
            if (pageType === 'search') {
                const priceMap = parseMobilePrices(mobileHtml);
                injectMobilePrices(priceMap);
                currentObserver = setupDynamicContentObserver(priceMap);
            } else if (pageType === 'property') {
                const priceMap = parseMobileRoomPrices(mobileHtml);
                injectRoomPrices(priceMap);
                currentObserver = setupPropertyPageObserver(priceMap);
            }
        } catch (error) {
            logError('Failed to fetch and process mobile page:', error);
        }
        
        log('Initialization complete');
    }
    
    /**
     * Detects SPA navigation and reinitializes when needed.
     * Intercepts pushState/replaceState and listens for popstate to
     * detect navigation immediately, with a polling fallback for edge cases.
     */
    function setupSPANavigationWatcher() {
        log('Setting up SPA navigation watcher...');
        
        function onNavigate() {
            if (location.href === currentUrl) return;
            
            const newPageType = detectPageType();
            log(`URL changed from ${currentUrl} to ${location.href}`);
            log(`Page type: ${currentPageType} -> ${newPageType}`);
            
            currentUrl = location.href;
            
            if (newPageType !== 'unknown') {
                currentPageType = newPageType;
                log('URL changed, reinitializing...');
                init().catch(err => logError('Reinitialization failed:', err));
            }
        }
        
        // Intercept history.pushState and history.replaceState on the page's
        // actual history object. In sandboxed environments (when @grant is used),
        // `window` is a proxy — we must use unsafeWindow to ensure page scripts'
        // calls to pushState/replaceState are intercepted.
        try {
            const pageHistory = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).history;
            for (const method of ['pushState', 'replaceState']) {
                const original = pageHistory[method].bind(pageHistory);
                pageHistory[method] = function(...args) {
                    original(...args);
                    onNavigate();
                };
            }
        } catch (e) {
            log('Could not intercept history methods, relying on polling fallback');
        }
        
        // Listen for back/forward navigation
        window.addEventListener('popstate', onNavigate);
        
        // Polling fallback for edge cases (e.g., hash changes, other scripts
        // overriding history methods after us)
        setInterval(onNavigate, CONFIG.spaCheckInterval);
    }
    
    // Start the script
    init().catch(error => {
        logError('Initialization failed:', error);
    });
    
    // Set up SPA navigation watcher
    setupSPANavigationWatcher();

})();
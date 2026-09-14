(function() {
    'use strict';

    // ==========================================
    // 1. POPUP DATABASE (Using jsDelivr CDN for speed)
    // ==========================================
    var POPUP_DATABASE = {
        'studio': {
            images: [
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/Studio%20Unit%20-1.png",
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/Studio%20Unit%20-2.png",
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/Studio%20Unit%20-3.png"
            ]
        },
        '1br': {
            images: [
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/1BR%20Unit%20-1.png",
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/Studio%20Unit%20-2.png",
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/Studio%20Unit%20-3.png"
            ]
        },
        '2br': {
            images: [
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/2BR%20Unit%20-1.png",
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/Studio%20Unit%20-2.png",
                "https://cdn.jsdelivr.net/gh/virtual-sudo/Avida-Abreeza-Assets@main/Studio%20Unit%20-3.png"
            ]
        },
        'amenities': {
            images: []
        }
    };

    // ==========================================
    // 2. BACKGROUND IMAGE PRELOADER (Instant Loading)
    // ==========================================
    Object.keys(POPUP_DATABASE).forEach(function(key) {
        if (POPUP_DATABASE[key].images) {
            POPUP_DATABASE[key].images.forEach(function(src) {
                var img = new Image();
                img.src = src;
            });
        }
    });

    // ==========================================
    // 3. MODERN CSS STYLES & SMOOTH FADE ANIMATIONS
    // ==========================================
    var styleId = 'modern-popup-db-styles';
    if (!document.getElementById(styleId)) {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = 
            '#modern-popup-overlay {' +
            '    position: fixed; inset: 0; z-index: 2147483647;' +
            '    background: rgba(0, 0, 0, 0.8);' +
            '    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);' +
            '    display: flex; align-items: center; justify-content: center; padding: 12px;' +
            '    opacity: 0; visibility: hidden;' +
            '    transition: opacity 0.3s ease, visibility 0.3s ease;' +
            '}' +
            '#modern-popup-overlay.active {' +
            '    opacity: 1; visibility: visible;' +
            '}' +
            '#modern-popup-card {' +
            '    background: rgba(24, 24, 27, 0.95);' +
            '    border: 1px solid rgba(255, 255, 255, 0.12);' +
            '    -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);' +
            '    width: 95vw; max-width: 1300px; border-radius: 0;' +
            '    overflow: hidden; padding: 24px;' +
            '    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);' +
            '    position: relative; box-sizing: border-box;' +
            '    opacity: 0;' +
            '    transition: opacity 0.3s ease;' +
            '}' +
            '#modern-popup-overlay.active #modern-popup-card {' +
            '    opacity: 1;' +
            '}' +
            '#modern-popup-close {' +
            '    position: absolute; top: 12px; right: 12px; z-index: 10;' +
            '    background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 255, 255, 0.2);' +
            '    color: #e4e4e7; width: 34px; height: 34px; border-radius: 50%;' +
            '    font-size: 18px; cursor: pointer;' +
            '    display: flex; align-items: center; justify-content: center;' +
            '    transition: background 0.2s ease, color 0.2s ease;' +
            '}' +
            '#modern-popup-close:hover {' +
            '    background: rgba(255, 255, 255, 0.3); color: #fff;' +
            '}' +
            '#modern-popup-gallery {' +
            '    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;' +
            '    width: 100%; align-items: center;' +
            '}' +
            '.modern-popup-gallery-img {' +
            '    width: 100%; height: auto; max-height: 75vh;' +
            '    object-fit: contain; border-radius: 0;' +
            '    border: 1px solid rgba(255, 255, 255, 0.1);' +
            '}';
        document.head.appendChild(style);
    }

    // ==========================================
    // 4. CREATE MODAL DOM ELEMENTS
    // ==========================================
    var overlay = document.getElementById('modern-popup-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modern-popup-overlay';
        overlay.innerHTML = 
            '<div id="modern-popup-card">' +
                '<button id="modern-popup-close" aria-label="Close">&times;</button>' +
                '<div id="modern-popup-gallery"></div>' +
            '</div>';
        document.body.appendChild(overlay);

        document.getElementById('modern-popup-close').onclick = closePopup;
        overlay.onclick = function(e) { if (e.target === overlay) closePopup(); };
    }

    function closePopup() {
        overlay.classList.remove('active');
    }

    // ==========================================
    // 5. GLOBAL CALLABLE FUNCTION
    // ==========================================
    window.openPopupFromDB = function(key) {
        var data = POPUP_DATABASE[key];
        
        if (!data) {
            console.warn('[Popup DB] Key not found:', key);
            return;
        }

        var galleryEl = document.getElementById('modern-popup-gallery');
        galleryEl.innerHTML = '';

        var imageList = Array.isArray(data.images) ? data.images : (data.image ? [data.image] : []);

        if (imageList.length > 0) {
            imageList.forEach(function(src) {
                var img = document.createElement('img');
                img.src = src;
                img.className = 'modern-popup-gallery-img';
                img.alt = 'Unit Image';
                
                // Speed optimizations
                img.decoding = 'async';
                img.loading = 'eager';
                
                galleryEl.appendChild(img);
            });
        }

        overlay.classList.add('active');
    };

    window.closePopupFromDB = closePopup;
})();

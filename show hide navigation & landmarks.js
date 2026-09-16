(function (thisArg) {
    'use strict';

    var ROOT_ID = 'icx-tour-toggle';
    var STYLE_ID = ROOT_ID + '-style';
    var LOG_PREFIX = '[icx-tour-toggle]';

    if (window.__icxTourToggleReady || window.__icxTourToggleBooting || document.getElementById(ROOT_ID)) {
        console.info(LOG_PREFIX, 'already initialized or booting, skipping');
        return;
    }
    window.__icxTourToggleBooting = true;

    // Every panorama that should be treated as "aerial" for the landmark
    // hide/show toggle - includes duplicates (e.g. a cloned Aerial 1 scene)
    // since those get their own independent overlays list in 3DVista.
    var AERIAL_PANORAMA_IDS = [
        'panorama_4FD0AB57_658A_BFF2_41AD_F53CA5151296', // Aerial 1
        'panorama_4D1097A6_658A_B752_41CC_7D3E034807FE', // Aerial 2
        'panorama_C4E8A786_A595_E927_41E3_EBE57A26020B'  // Aerial 1 (duplicate)
    ];

    var CONTAINER_IDS = {
        bottomNavigation: 'Container_91C865F1_81B5_1803_41C7_C4199E495955',
        overview:         'Container_52329C67_668A_59D2_41C4_D5218559C6B0',
        amenities:        'Container_54F4C7C7_6696_B6D2_41D2_17C380B8740A',
        residential:      'Container_506FBBC6_669B_DED2_41CB_AC7B9932D678',
        sideNavigation:   'Container_79B1AFF7_6B52_AD77_41A1_6F619FC60224',
        studio:           'Container_78A63EC6_6B53_AF89_41C2_F2B5695F8052',
        oneBR:            'Container_DC28CD74_85D3_328D_41CD_A9712610F820',
        twoBR:            'Container_D84C350F_85D1_329B_41D7_31135F811A05'
    };

    var NAV_CONTAINER_IDS = [
        CONTAINER_IDS.bottomNavigation,
        CONTAINER_IDS.overview,
        CONTAINER_IDS.amenities,
        CONTAINER_IDS.residential,
        CONTAINER_IDS.sideNavigation,
        CONTAINER_IDS.studio,
        CONTAINER_IDS.oneBR,
        CONTAINER_IDS.twoBR
    ];

    var OVERLAY_PANEL_IDS = {
        locationMap: 'Container_411D2FB2_5818_4BD8_41AF_CD1F2EA9B336',
        moreInfo:    'Container_43AB7D19_5878_4CC8_4194_9A25D4B0D70E'
    };

    var HIDE_FADE_MS = 100;
    var SHOW_FADE_MS = 0;

    var RETRY_INTERVAL_MS = 250;
    var MAX_WAIT_MS = 30000;
    var waited = 0;

    // GLOBAL STATE & ACTIVE SNAPSHOT
    var isGlobalHidden = false;
    var activeHiddenSnapshot = [];

    function getPlayer() {
        try {
            if (window.tour && window.tour.locManager && window.tour.locManager.rootPlayer) {
                return window.tour.locManager.rootPlayer;
            }
        } catch (e) {}
        try {
            if (window.tour && window.tour.player && typeof window.tour.player.getById === 'function') {
                return window.tour.player.getById('rootPlayer') || window.tour.player;
            }
        } catch (e) {}
        return thisArg || null;
    }

    function getComponent(player, id, label, quiet) {
        try {
            if (player && player[id]) return player[id];
        } catch (e) {}
        try {
            if (player && typeof player.getComponentByName === 'function') {
                var c = player.getComponentByName(id);
                if (c) return c;
            }
        } catch (e) {}
        try {
            if (thisArg && thisArg[id]) return thisArg[id];
        } catch (e) {}
        if (!quiet) console.warn(LOG_PREFIX, 'could not resolve component', label || '', '(' + id + ')');
        return null;
    }

    function safeSet(model, key, value) {
        try {
            if (model && typeof model.set === 'function') { model.set(key, value); return true; }
        } catch (e) {}
        return false;
    }

    function safeGet(model, key) {
        try {
            return model && typeof model.get === 'function' ? model.get(key) : null;
        } catch (e) {
            return null;
        }
    }

    function getFreshEffect(className) {
        try {
            var Cls = window.TDV && window.TDV.qb && typeof window.TDV.qb.getClassByName === 'function'
                ? window.TDV.qb.getClassByName(className)
                : null;
            if (!Cls) return null;
            var inst = new Cls();
            safeSet(inst, 'easing', 'linear');
            return inst;
        } catch (e) {
            return null;
        }
    }

    var panoramaAttempts = [
        function (player) {
            var pp = window.tour && window.tour.player && typeof window.tour.player.getById === 'function'
                ? window.tour.player.getById('MainViewerPanoramaPlayer') : null;
            return pp ? safeGet(pp, 'panorama') : null;
        },
        function (player) {
            var pp = player && typeof player.getById === 'function' ? player.getById('MainViewerPanoramaPlayer') : null;
            return pp ? safeGet(pp, 'panorama') : null;
        },
        function (player) {
            var items = safeGet(player.mainPlayList, 'items');
            var idx = safeGet(player.mainPlayList, 'selectedIndex');
            var item = items && items[idx];
            return item ? safeGet(item, 'media') : null;
        }
    ];
    var lastWorkingPanoramaAttempt = 0;

    function getCurrentPanorama(player) {
        for (var offset = 0; offset < panoramaAttempts.length; offset++) {
            var i = (lastWorkingPanoramaAttempt + offset) % panoramaAttempts.length;
            try {
                var panorama = panoramaAttempts[i](player);
                if (panorama) {
                    lastWorkingPanoramaAttempt = i;
                    return panorama;
                }
            } catch (e) {}
        }
        return null;
    }

    console.info(LOG_PREFIX, 'waiting for tour player...');

    var waitTimer = setInterval(function () {
        waited += RETRY_INTERVAL_MS;
        var player = getPlayer();
        if (!player || !player.mainPlayList) {
            if (waited >= MAX_WAIT_MS) {
                clearInterval(waitTimer);
                window.__icxTourToggleBooting = false;
                console.error(LOG_PREFIX, 'gave up after ' + (MAX_WAIT_MS / 1000) + 's: rootPlayer/mainPlayList never available.');
            }
            return;
        }
        clearInterval(waitTimer);
        try {
            init(player);
            window.__icxTourToggleReady = true;
            window.__icxTourToggleBooting = false;
            console.info(LOG_PREFIX, 'init complete after ' + waited + 'ms');
        } catch (e) {
            window.__icxTourToggleBooting = false;
            console.error(LOG_PREFIX, 'init threw an error:', e);
        }
    }, RETRY_INTERVAL_MS);

    function init(player) {

        var aerialPanoramas = AERIAL_PANORAMA_IDS.map(function (id) {
            return (thisArg && thisArg[id]) || getComponent(player, id, id);
        }).filter(Boolean);

        function resolveNavComponent(id) {
            return getComponent(player, id, id, true);
        }
        function resolveOverlayPanel(key) {
            return getComponent(player, OVERLAY_PANEL_IDS[key], key, true);
        }

        function isOverlayPanelOpen() {
            return Object.keys(OVERLAY_PANEL_IDS).some(function (key) {
                var comp = resolveOverlayPanel(key);
                return !!comp && safeGet(comp, 'visible') === true;
            });
        }

        function isViewingPanorama(currentMedia) {
            if (!currentMedia) return false;
            var overlays = safeGet(currentMedia, 'overlays');
            if (Array.isArray(overlays)) return true;
            var className = currentMedia.constructor ? currentMedia.constructor.name : '';
            return typeof className === 'string' && className.indexOf('Panorama') !== -1;
        }

        window.__icxManualHide = window.__icxManualHide || false;

        function isAerialPanorama(panorama) {
            return !!panorama && aerialPanoramas.indexOf(panorama) !== -1;
        }

        function getPanoramaOverlays(panorama) {
            try {
                return safeGet(panorama, 'overlays') || [];
            } catch (e) {
                return [];
            }
        }

        function applyLandmarksBoth(visible) {
            var caller = (thisArg && typeof thisArg.setOverlaysVisibility === 'function')
                ? thisArg
                : (player && typeof player.setOverlaysVisibility === 'function' ? player : null);

            aerialPanoramas.forEach(function (panorama) {
                var overlays = getPanoramaOverlays(panorama);
                if (!overlays.length) return;
                var handled = false;
                if (caller) {
                    try {
                        caller.setOverlaysVisibility(overlays, visible, panorama, 0);
                        handled = true;
                    } catch (e) {}
                }
                if (!handled) {
                    overlays.forEach(function (overlay) {
                        safeSet(overlay, 'enabled', visible);
                        safeSet(overlay, 'visible', visible);
                    });
                }
            });
        }

        // Detects a panorama whose overlays either haven't attached yet
        // (fresh load, background preload disabled - overlays.length is
        // 0 for a beat) or have drifted from the expected state, so the
        // frame loop can retry until it actually sticks instead of
        // silently giving up the one time applyLandmarksBoth() ran too
        // early.
        function landmarksOutOfSync(panorama, expectedVisible) {
            if (!panorama) return false;
            var overlays = getPanoramaOverlays(panorama);
            if (!overlays.length) return false;
            for (var i = 0; i < overlays.length; i++) {
                if (safeGet(overlays[i], 'visible') !== expectedVisible) return true;
            }
            return false;
        }

        // CAPTURE CURRENTLY VISIBLE CONTAINERS ONLY
        function captureVisibleContainers() {
            var snapshot = [];
            NAV_CONTAINER_IDS.forEach(function (id) {
                var comp = resolveNavComponent(id);
                if (!comp) return;
                if (safeGet(comp, 'visible') !== false) {
                    snapshot.push(id);
                }
            });
            return snapshot;
        }

        function snapContainers(ids, hiddenTarget) {
            ids.forEach(function (id) {
                var comp = resolveNavComponent(id);
                if (!comp) return;
                try {
                    player.setComponentVisibility(comp, !hiddenTarget, 0, null, hiddenTarget ? 'hideEffect' : 'showEffect', false);
                } catch (e) {}
                safeSet(comp, 'interactionEnabled', !hiddenTarget);
            });
        }

        function toggleContainers(ids, hiddenTarget) {
            var durationMs = hiddenTarget ? HIDE_FADE_MS : SHOW_FADE_MS;
            var effectClass = hiddenTarget ? 'FadeOutEffect' : 'FadeInEffect';
            var direction = hiddenTarget ? 'hideEffect' : 'showEffect';

            ids.forEach(function (id) {
                var comp = resolveNavComponent(id);
                if (!comp) return;
                try {
                    if (durationMs === 0) {
                        player.setComponentVisibility(comp, !hiddenTarget, 0, null, direction, false);
                    } else {
                        player.setComponentVisibility(comp, !hiddenTarget, durationMs, getFreshEffect(effectClass), direction, false);
                    }
                } catch (e) {}
                safeSet(comp, 'interactionEnabled', !hiddenTarget);
            });
        }

        function anyDriftedVisible(ids) {
            return ids.some(function (id) {
                var comp = resolveNavComponent(id);
                return !!comp && safeGet(comp, 'visible') !== false;
            });
        }

        // ==========================================
        // UI & NAVIGATION DOCK SETUP
        // ==========================================

        injectStyles();
        var root = document.createElement('div');
        root.id = ROOT_ID;
        document.body.appendChild(root);

        var dockContainer = document.createElement('div');
        dockContainer.className = 'icx-dock-container';
        root.appendChild(dockContainer);

        function relocateRootForFullscreen() {
            var fsEl = document.fullscreenElement || document.webkitFullscreenElement ||
                document.mozFullScreenElement || document.msFullscreenElement;
            var target = fsEl || document.body;
            if (root.parentNode !== target) target.appendChild(root);
            updateFullscreenBtnState();
        }

        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function (evt) {
            document.addEventListener(evt, relocateRootForFullscreen);
        });

        // SVG Icons
        var EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';

        var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94"/>' +
            '<path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19"/>' +
            '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

        var FS_ENTER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';

        var FS_EXIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';

        // 1. Hide/Show UI Button
        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.id = 'icx-tour-toggle-btn';
        toggleBtn.className = 'icx-dock-btn';

        var toggleTooltip = document.createElement('span');
        toggleTooltip.className = 'icx-tooltip';
        toggleBtn.appendChild(toggleTooltip);

        var toggleIconWrapper = document.createElement('div');
        toggleIconWrapper.className = 'icx-icon-wrapper';
        toggleBtn.appendChild(toggleIconWrapper);

        dockContainer.appendChild(toggleBtn);

        function paintToggleBtn(hidden) {
            toggleIconWrapper.innerHTML = hidden ? EYE_OPEN : EYE_OFF;
            var text = hidden ? 'Show Interface' : 'Hide Interface';
            toggleTooltip.textContent = text;
            toggleBtn.setAttribute('aria-label', text);
        }

        toggleBtn.onclick = function () {
            try {
                if (!isGlobalHidden) {
                    // Capture active UI state before hiding
                    activeHiddenSnapshot = captureVisibleContainers();
                    isGlobalHidden = true;
                    toggleContainers(activeHiddenSnapshot, true);
                    applyLandmarksBoth(false);
                } else {
                    // Only restore containers that were visible prior to hiding
                    isGlobalHidden = false;
                    toggleContainers(activeHiddenSnapshot, false);
                    applyLandmarksBoth(true);
                    activeHiddenSnapshot = [];
                }
                paintToggleBtn(isGlobalHidden);
            } catch (e) {
                console.error(LOG_PREFIX, 'click handler failed', e);
            }
        };

        // 2. Fullscreen Button
        var fsBtn = document.createElement('button');
        fsBtn.type = 'button';
        fsBtn.id = 'icx-fullscreen-btn';
        fsBtn.className = 'icx-dock-btn';

        var fsTooltip = document.createElement('span');
        fsTooltip.className = 'icx-tooltip';
        fsBtn.appendChild(fsTooltip);

        var fsIconWrapper = document.createElement('div');
        fsIconWrapper.className = 'icx-icon-wrapper';
        fsBtn.appendChild(fsIconWrapper);

        dockContainer.appendChild(fsBtn);

        function isFullscreenActive() {
            return !!(document.fullscreenElement || document.webkitFullscreenElement ||
                document.mozFullScreenElement || document.msFullscreenElement);
        }

        function updateFullscreenBtnState() {
            var active = isFullscreenActive();
            fsIconWrapper.innerHTML = active ? FS_EXIT : FS_ENTER;
            var text = active ? 'Exit Full Screen' : 'Full Screen';
            fsTooltip.textContent = text;
            fsBtn.setAttribute('aria-label', text);
        }

        fsBtn.onclick = function () {
            try {
                if (!isFullscreenActive()) {
                    var docEl = document.documentElement;
                    if (docEl.requestFullscreen) docEl.requestFullscreen();
                    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
                    else if (docEl.mozRequestFullScreen) docEl.mozRequestFullScreen();
                    else if (docEl.msRequestFullscreen) docEl.msRequestFullscreen();
                } else {
                    if (document.exitFullscreen) document.exitFullscreen();
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
                    else if (document.msExitFullscreen) document.msExitFullscreen();
                }
            } catch (e) {
                console.error(LOG_PREFIX, 'fullscreen toggle error', e);
            }
        };

        updateFullscreenBtnState();

        var lastPanorama = undefined;

        function frameLoop() {
            try {
                var currentPanorama = getCurrentPanorama(player);

                // Detect Scene Changes
                if (currentPanorama !== lastPanorama) {
                    lastPanorama = currentPanorama;
                    paintToggleBtn(isGlobalHidden);

                    if (isAerialPanorama(currentPanorama)) {
                        applyLandmarksBoth(!isGlobalHidden);
                    }
                }

                // CONTINUOUS ENFORCEMENT OF HIDDEN SNAPSHOT
                if (isGlobalHidden && activeHiddenSnapshot.length > 0) {
                    if (anyDriftedVisible(activeHiddenSnapshot)) {
                        snapContainers(activeHiddenSnapshot, true);
                        applyLandmarksBoth(false);
                    }
                }

                // CONTINUOUS ENFORCEMENT OF LANDMARK VISIBILITY
                // An aerial panorama's overlays can attach a beat after the
                // panorama itself becomes "current" (most visible on the
                // tour's very first, initially-displayed panorama, since
                // background preload is disabled) - so a hide/show call
                // made at click time or at the scene-change instant above
                // can run against a still-empty overlays list and silently
                // no-op. Re-checking every frame catches it the moment the
                // overlays exist, instead of only getting a second chance
                // whenever the next scene change happens to occur.
                if (isAerialPanorama(currentPanorama)) {
                    var expectedLandmarksVisible = !isGlobalHidden;
                    var landmarksNeedSync = aerialPanoramas.some(function (panorama) {
                        return landmarksOutOfSync(panorama, expectedLandmarksVisible);
                    });
                    if (landmarksNeedSync) {
                        applyLandmarksBoth(expectedLandmarksVisible);
                    }
                }

                var onPanorama = isViewingPanorama(currentPanorama);
                var overlayOpen = isOverlayPanelOpen();

                if (onPanorama && !overlayOpen && window.__icxManualHide) {
                    window.__icxManualHide = false;
                }

                var shouldShowDock = onPanorama && !overlayOpen && !window.__icxManualHide;
                dockContainer.classList.toggle('icx-visible', shouldShowDock);

            } catch (e) {
                console.error(LOG_PREFIX, 'frameLoop error:', e);
            }
            requestAnimationFrame(frameLoop);
        }

        requestAnimationFrame(frameLoop);
    }

    function injectStyles() {
        var oldStyle = document.getElementById(STYLE_ID);
        if (oldStyle && oldStyle.parentNode) oldStyle.parentNode.removeChild(oldStyle);
        var styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600&display=swap');

            #${ROOT_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
                pointer-events: none;
            }

            .icx-dock-container {
                position: fixed;
                top: 50%;
                right: 20px;
                transform: translateY(-50%) translateX(24px) scale(0.92);
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 6px;
                border-radius: 30px;
                background: rgba(14, 16, 20, 0.45);
                -webkit-backdrop-filter: blur(16px) saturate(160%);
                backdrop-filter: blur(16px) saturate(160%);
                border: 1px solid rgba(255, 255, 255, 0.15);
                box-shadow:
                    0 20px 40px -10px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
                pointer-events: none;
                opacity: 0;
                transition:
                    opacity 200ms cubic-bezier(0.16, 1, 0.3, 1),
                    transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
            }

            .icx-dock-container.icx-visible {
                opacity: 1;
                pointer-events: auto;
                transform: translateY(-50%) translateX(0) scale(1);
            }

            .icx-dock-btn {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                color: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.05);
                cursor: pointer;
                outline: none;
                transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
            }

            .icx-dock-btn:hover {
                color: #ffffff;
                background: rgba(255, 255, 255, 0.22);
                border-color: rgba(255, 255, 255, 0.4);
                transform: scale(1.08);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            }

            .icx-dock-btn:active {
                transform: scale(0.92);
                background: rgba(255, 255, 255, 0.12);
            }

            .icx-icon-wrapper {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
            }

            .icx-icon-wrapper svg {
                width: 20px;
                height: 20px;
                stroke: currentColor;
                transition: transform 150ms ease;
            }

            .icx-tooltip {
                position: absolute;
                right: calc(100% + 12px);
                top: 50%;
                transform: translateY(-50%) translateX(8px) scale(0.95);
                background: rgba(10, 12, 16, 0.85);
                -webkit-backdrop-filter: blur(12px);
                backdrop-filter: blur(12px);
                color: #ffffff;
                font-size: 0.75rem;
                font-weight: 500;
                letter-spacing: 0.3px;
                padding: 6px 12px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 0 10px 20px rgba(0,0,0,0.4);
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                visibility: hidden;
                transition:
                    opacity 150ms ease,
                    transform 150ms cubic-bezier(0.16, 1, 0.3, 1),
                    visibility 150ms ease;
            }

            .icx-dock-btn:hover .icx-tooltip {
                opacity: 1;
                visibility: visible;
                transform: translateY(-50%) translateX(0) scale(1);
            }
        `;
        document.head.appendChild(styleEl);
    }
})(this);

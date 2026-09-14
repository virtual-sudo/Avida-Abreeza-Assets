/**
 * New Project - Per-Scene Hide/Show toggle (Navigation + Aerial Landmarks)
 *
 * Behavior:
 *   - Nothing is touched on load. Whatever 3DVista natively shows for
 *     the current scene stays exactly as it is until the user acts.
 *   - Clicking Hide captures which of the 8 known containers are
 *     ACTUALLY visible right now, on the scene you're currently on, and
 *     fades out only those - not all 8 unconditionally. That snapshot
 *     is remembered per scene, so hiding on one scene doesn't affect a
 *     different scene's containers.
 *   - Clicking Show restores exactly that snapshot, for that scene.
 *   - The same click also hides/shows every overlay in Aerial 1's and
 *     Aerial 2's own `overlays` arrays together (the landmark pins are
 *     HotspotPanoramaOverlay objects living directly on each panorama,
 *     not containers, and not confirmed to share a common tag - so
 *     this targets the overlays array itself via setOverlaysVisibility()
 *     rather than a tag filter). This is a single global on/off, not
 *     scoped to whichever scene you're currently viewing.
 *   - Icon/label represent the ACTION the click performs, not the
 *     current state: "Hide" (closed eye) shows while containers are
 *     visible, "Show" (open eye) shows once they're hidden.
 *   - Re-entering a scene that's marked hidden re-applies the hidden
 *     state defensively (and re-syncs the landmarks state on the aerial
 *     scenes), in case 3DVista's own scene-enter logic reset it.
 *   - The toggle button itself only appears while the current mainPlayList
 *     item is an actual panorama - not on non-panorama sections like
 *     Location Map or More Info. Detected via isViewingPanorama() below,
 *     which checks for panorama-shaped traits (an `overlays` array, or a
 *     constructor name containing "Panorama") rather than needing every
 *     non-panorama section's container id individually.
 *   - Location Map and More Info are actually full-screen OVERLAY
 *     CONTAINERS drawn on top of whichever panorama is underneath
 *     (Container_411D2FB2_5818_4BD8_41AF_CD1F2EA9B336, internal name
 *     "Interactive Map", and Container_43AB7D19_5878_4CC8_4194_9A25D4B0D70E,
 *     internal name "More Info" - confirmed directly in script_general.js),
 *     not separate mainPlayList items. So isViewingPanorama() alone can't
 *     detect them - the underlying media is still a panorama. This script
 *     polls both containers' own `visible` property every frame and hides
 *     the toggle button whenever either is open, on top of the existing
 *     window.__icxManualHide escape hatch (kept for compatibility with any
 *     separate per-button "On Click" snippets, but no longer required).
 *
 * Fade implementation notes (read before changing the tween logic):
 *   - Container references are RESOLVED FRESH every time, never cached
 *     long-term. Verified directly in this project's live build: the
 *     Residential thumbnail row (Container_506FBBC6...) that stays on
 *     screen across Studio/1BR/2BR interior scenes is a DIFFERENT live
 *     object per scene despite sharing the same id - a reference grabbed
 *     once (e.g. on script boot, while still on the aerial exterior
 *     scene) goes stale the moment you navigate into a unit interior,
 *     which is exactly why a one-time-cached version of this script
 *     could fade Overview/Amenities fine but not Residential ("it
 *     reappears"). Overview/Amenities happened to work only because
 *     their containers live solely on the single exterior scene that
 *     was already active when the reference was first grabbed.
 *   - The actual fade is done via 3DVista's OWN native effect system
 *     (`player.setComponentVisibility(component, visible, durationMs,
 *     effect, 'showEffect'|'hideEffect', propagate)`) - the exact same
 *     call the tour's own authored buttons use to hide/show these same
 *     containers (confirmed in script_general.js). A hand-rolled
 *     per-frame opacity tween was tried first and rejected: setting the
 *     model's `opacity` property directly updates the data model but
 *     does not reliably invalidate/repaint certain composite components
 *     (verified on the ThumbnailList-bearing containers specifically),
 *     so it either freezes for most of the transition and then pops, or
 *     cuts instantly with no visible fade at all - the "blinks then
 *     hides" / "disappear-appear" symptom. Native effects repaint
 *     correctly because that's the exact code path 3DVista's own click
 *     handlers already rely on throughout this same tour.
 *   - Effect instances are constructed fresh via
 *     `window.TDV.qb.getClassByName('FadeInEffect'/'FadeOutEffect')`
 *     rather than reused from any specific existing button - those are
 *     lazily instantiated by 3DVista only once their originating button
 *     has fired at least once, so borrowing one by id is unreliable
 *     (confirmed: a freshly-loaded scene's hide-effect id did not exist
 *     yet). `TDV.qb` is an internal (minified, build-specific) namespace,
 *     so this includes a defensive fallback to an immediate no-effect
 *     visibility toggle if that class lookup ever fails on a future
 *     3DVista export.
 *   - While a scene is marked hidden, every frame defensively re-checks
 *     that each of its captured containers is still actually hidden and
 *     snaps it back instantly if not - this is what protects Residential
 *     specifically, since switching between Studio/1BR/2BR while hidden
 *     can cause 3DVista's own native navigation logic to re-show that
 *     scene's chrome out from under us, not just on a full scene change.
 *
 * Install: paste this whole IIFE into the Player's "On Start" JavaScript
 * action in 3DVista:
 * Root Player > Behaviour > Actions > On Start > Execute Javascript
 */
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

    var AERIAL_1_PANORAMA = 'panorama_4FD0AB57_658A_BFF2_41AD_F53CA5151296';
    var AERIAL_2_PANORAMA = 'panorama_4D1097A6_658A_B752_41CC_7D3E034807FE';

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

    // Full-screen overlay panels that sit on top of the current panorama.
    // While either is open, the toggle button must stay hidden - it would
    // otherwise float on top of them since it's a fixed-position DOM
    // element with a very high z-index.
    var OVERLAY_PANEL_IDS = {
        locationMap: 'Container_411D2FB2_5818_4BD8_41AF_CD1F2EA9B336', // "Interactive Map"
        moreInfo:    'Container_43AB7D19_5878_4CC8_4194_9A25D4B0D70E'  // "More Info"
    };

    var FADE_MS = 160;
    var REAPPLY_DELAYS_MS = [50, 250, 700];

    var RETRY_INTERVAL_MS = 250;
    var MAX_WAIT_MS = 30000;
    var waited = 0;

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
        // Not finding a container simply means it doesn't exist on the
        // CURRENT scene (e.g. studio/oneBR/twoBR only exist on some
        // scenes) - normal and expected for every per-frame lookup below,
        // so those pass quiet=true. Only the one-time init-time lookups
        // (aerial panoramas) want the diagnostic warning.
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
            safeSet(inst, 'easing', 'cubic_in_out');
            return inst;
        } catch (e) {
            console.warn(LOG_PREFIX, 'could not construct', className, e);
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
    // Called ~60x/sec from frameLoop, so remember whichever lookup
    // strategy worked last time and try it first instead of re-running
    // all three (each wrapped in try/catch) every single frame.
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

        // Landmarks: this exact call, on `this` (thisArg), targeting
        // `this.panorama_XXXX` directly, is the confirmed-working form -
        // prefer it over going through the abstracted `player` lookup,
        // which was likely why landmarks never actually hid before.
        var aerial1 = (thisArg && thisArg[AERIAL_1_PANORAMA]) || getComponent(player, AERIAL_1_PANORAMA, 'aerial-1');
        var aerial2 = (thisArg && thisArg[AERIAL_2_PANORAMA]) || getComponent(player, AERIAL_2_PANORAMA, 'aerial-2');
        console.info(LOG_PREFIX, 'aerial1 resolved:', !!aerial1, '  aerial2 resolved:', !!aerial2);

        // Resolved fresh on every call, deliberately not cached long-term -
        // see the "Fade implementation notes" header comment for why a
        // one-time cached reference goes stale on some containers.
        function resolveNavComponent(id) {
            return getComponent(player, id, id, true);
        }
        function resolveOverlayPanel(key) {
            return getComponent(player, OVERLAY_PANEL_IDS[key], key, true);
        }

        // True whenever Location Map or More Info is currently open, no
        // matter which panorama is loaded underneath - both are overlay
        // containers drawn on top of the scene, not separate playlist
        // items, so this can't be inferred from isViewingPanorama() alone.
        function isOverlayPanelOpen() {
            return Object.keys(OVERLAY_PANEL_IDS).some(function (key) {
                var comp = resolveOverlayPanel(key);
                return !!comp && safeGet(comp, 'visible') === true;
            });
        }

        // True only while the current mainPlayList item is an actual
        // panorama - false on non-panorama sections, whatever
        // container/button ids those turn out to use internally.
        // Panoramas expose an `overlays` array (used for the landmark
        // pins) and/or a constructor name containing "Panorama" - non-
        // panorama media items shouldn't have either.
        function isViewingPanorama(currentMedia) {
            if (!currentMedia) return false;
            var overlays = safeGet(currentMedia, 'overlays');
            if (Array.isArray(overlays)) return true;
            var className = currentMedia.constructor ? currentMedia.constructor.name : '';
            return typeof className === 'string' && className.indexOf('Panorama') !== -1;
        }

        // Optional escape hatch: if you ever want a button (Location Map,
        // More Info, or anything else) to force-hide the toggle via its
        // own "On Click > Execute Javascript" action, set
        // window.__icxManualHide = true there. Not required for Location
        // Map / More Info anymore - isOverlayPanelOpen() above already
        // covers both - but harmless to keep as a general-purpose override.
        window.__icxManualHide = window.__icxManualHide || false;

        function isAerialPanorama(panorama) {
            return !!panorama && (panorama === aerial1 || panorama === aerial2);
        }

        // Aerial 1/2's landmark pins are HotspotPanoramaOverlay objects
        // living directly in each panorama's own `overlays` array - not
        // containers, and not confirmed to share a common tag, so we
        // target the overlays array itself rather than a tag filter.
        function getPanoramaOverlays(panorama) {
            try {
                return safeGet(panorama, 'overlays') || [];
            } catch (e) {
                return [];
            }
        }

        // Hides/shows every overlay belonging to BOTH aerial panoramas
        // together, every time it's called - not scoped to whichever
        // scene is currently on screen. Tries the bulk
        // setOverlaysVisibility() call first (on `this`, matching the
        // confirmed-working pattern for setOverlaysVisibilityByTags);
        // falls back to setting each overlay's own enabled/visible
        // property directly if that call isn't available or throws.
        function applyLandmarksBoth(visible) {
            var caller = (thisArg && typeof thisArg.setOverlaysVisibility === 'function')
                ? thisArg
                : (player && typeof player.setOverlaysVisibility === 'function' ? player : null);

            [{ panorama: aerial1, label: 'aerial1' }, { panorama: aerial2, label: 'aerial2' }].forEach(function (entry) {
                if (!entry.panorama) return;
                var overlays = getPanoramaOverlays(entry.panorama);
                if (!overlays.length) {
                    console.warn(LOG_PREFIX, 'no overlays found on', entry.label);
                    return;
                }
                var handled = false;
                if (caller) {
                    try {
                        caller.setOverlaysVisibility(overlays, visible, entry.panorama, 0);
                        handled = true;
                    } catch (e) {
                        console.warn(LOG_PREFIX, 'setOverlaysVisibility failed on', entry.label, e);
                    }
                }
                if (!handled) {
                    overlays.forEach(function (overlay) {
                        safeSet(overlay, 'enabled', visible);
                        safeSet(overlay, 'visible', visible);
                    });
                    console.info(LOG_PREFIX, 'fell back to per-overlay enabled/visible on', entry.label, '(' + overlays.length + ' overlays)');
                }
            });
            console.info(LOG_PREFIX, 'landmarks (both aerials, via overlays array) ->', visible);
        }

        // Landmarks are global (both aerials together), not per-scene -
        // tracked separately from the per-scene container states below.
        var landmarksHidden = false;

        // ---- Per-scene state: keyed by panorama object identity. ----
        // { hidden: bool, snapshot: [id, id, ...] }
        var sceneStates = [];

        function getSceneState(panorama) {
            for (var i = 0; i < sceneStates.length; i++) {
                if (sceneStates[i].panorama === panorama) return sceneStates[i];
            }
            var entry = { panorama: panorama, hidden: false, snapshot: null };
            sceneStates.push(entry);
            return entry;
        }

        // Only containers ACTUALLY visible right now count as "present
        // in this panorama" - we never force something visible just to
        // then hide it. Just ids: with native effects driving the fade,
        // there's no need to remember a prior opacity to restore to.
        function captureVisibleContainers() {
            var snapshot = [];
            NAV_CONTAINER_IDS.forEach(function (id) {
                var comp = resolveNavComponent(id);
                if (!comp) return;
                if (safeGet(comp, 'visible') === false) return; // explicitly not shown here, leave it alone
                snapshot.push(id);
            });
            return snapshot;
        }

        // ---- Fade engine: delegates the actual animation to 3DVista's
        // own native effect system (see header comment for why). ----

        function fadeContainers(ids, hiddenTarget, durationMs) {
            var effectClass = hiddenTarget ? 'FadeOutEffect' : 'FadeInEffect';
            var direction = hiddenTarget ? 'hideEffect' : 'showEffect';
            ids.forEach(function (id) {
                var comp = resolveNavComponent(id);
                if (!comp) return;
                // Each container gets its OWN effect instance - matches
                // 3DVista's own native buttons, which never share one
                // effect object across multiple simultaneous targets.
                // Effect instances carry their own animation timer, so
                // sharing one across several containers fading together
                // (e.g. everything reappearing on Show) makes them fight
                // over the same state instead of each running smoothly -
                // the "slow and laggy" Show.
                try {
                    player.setComponentVisibility(comp, !hiddenTarget, durationMs, getFreshEffect(effectClass), direction, false);
                } catch (e) {
                    console.warn(LOG_PREFIX, 'setComponentVisibility failed for', id, e);
                }
                safeSet(comp, 'interactionEnabled', !hiddenTarget);
            });
        }

        // Instant (non-animated) re-assertion, used defensively when
        // re-entering a scene that's marked hidden, and every frame while
        // hidden (see header comment: Residential's chrome can get
        // re-shown by native navigation logic mid-scene, not just on a
        // full scene change).
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

        // True if any container in the snapshot has drifted back to
        // visible while it's supposed to be hidden.
        function anyDriftedVisible(ids) {
            return ids.some(function (id) {
                var comp = resolveNavComponent(id);
                return !!comp && safeGet(comp, 'visible') !== false;
            });
        }

        // ---- UI ----

        injectStyles();
        var root = document.createElement('div');
        root.id = ROOT_ID;
        document.body.appendChild(root);

        function relocateRootForFullscreen() {
            var fsEl = document.fullscreenElement || document.webkitFullscreenElement ||
                document.mozFullScreenElement || document.msFullscreenElement;
            var target = fsEl || document.body;
            if (root.parentNode !== target) target.appendChild(root);
        }
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function (evt) {
            document.addEventListener(evt, relocateRootForFullscreen);
        });

        var EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
        var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94"/>' +
            '<path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19"/>' +
            '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.id = 'icx-tour-toggle-btn';
        toggleBtn.className = 'icx-toggle-btn';
        root.appendChild(toggleBtn);

        // Icon/label represent the ACTION the click will perform, not
        // the current state: while containers are showing, the button
        // reads "Hide" (closed/off eye); once hidden, it reads "Show"
        // (open eye).
        function paintToggleBtn(hidden) {
            toggleBtn.innerHTML = hidden ? EYE_OPEN : EYE_OFF;
            toggleBtn.title = hidden ? 'Show' : 'Hide';
            toggleBtn.setAttribute('aria-label', toggleBtn.title);
        }

        toggleBtn.onclick = function () {
            try {
                var currentPanorama = getCurrentPanorama(player);
                var entry = getSceneState(currentPanorama);

                if (!entry.hidden) {
                    var snapshot = captureVisibleContainers();
                    entry.snapshot = snapshot;
                    entry.hidden = true;
                    fadeContainers(snapshot, true, FADE_MS);
                    landmarksHidden = true;
                    applyLandmarksBoth(false);
                    console.info(LOG_PREFIX, 'hide clicked - containers captured:', snapshot);
                } else {
                    fadeContainers(entry.snapshot || [], false, FADE_MS);
                    entry.hidden = false;
                    landmarksHidden = false;
                    applyLandmarksBoth(true);
                    console.info(LOG_PREFIX, 'show clicked - restoring:', entry.snapshot || []);
                }
                paintToggleBtn(entry.hidden);
            } catch (e) {
                console.error(LOG_PREFIX, 'click handler failed', e);
            }
        };

        var lastPanorama = undefined; // undefined so the very first frame always counts as a scene change
        var reapplyTimers = [];

        function clearReapplyTimers() {
            reapplyTimers.forEach(clearTimeout);
            reapplyTimers = [];
        }

        function frameLoop() {
            try {
                var currentPanorama = getCurrentPanorama(player);
                if (currentPanorama !== lastPanorama) {
                    lastPanorama = currentPanorama;
                    var entry = getSceneState(currentPanorama);
                    paintToggleBtn(entry.hidden);

                    console.info(LOG_PREFIX, 'scene changed - isViewingPanorama:', isViewingPanorama(currentPanorama),
                        'class=' + (currentPanorama && currentPanorama.constructor ? currentPanorama.constructor.name : currentPanorama),
                        'hasOverlaysArray=' + Array.isArray(safeGet(currentPanorama, 'overlays')));

                    // Defensive re-assertion on scene entry, in case
                    // 3DVista's own scene-enter logic reset visibility.
                    // Landmarks track their own global on/off (not tied
                    // to which scene you're on) so re-sync them here too
                    // whenever the aerial scenes are the ones on screen.
                    clearReapplyTimers();
                    if (entry.hidden && entry.snapshot) {
                        snapContainers(entry.snapshot, true);
                        REAPPLY_DELAYS_MS.forEach(function (delay) {
                            reapplyTimers.push(setTimeout(function () {
                                snapContainers(entry.snapshot, true);
                            }, delay));
                        });
                    }
                    if (isAerialPanorama(currentPanorama)) {
                        applyLandmarksBoth(!landmarksHidden);
                        REAPPLY_DELAYS_MS.forEach(function (delay) {
                            reapplyTimers.push(setTimeout(function () {
                                applyLandmarksBoth(!landmarksHidden);
                            }, delay));
                        });
                    }
                }

                // Continuously guard against native navigation logic
                // re-showing a hidden scene's chrome mid-scene (not just
                // on a full scene change) - see header comment. Cheap:
                // at most 8 property reads per frame.
                var activeEntry = getSceneState(currentPanorama);
                if (activeEntry.hidden && activeEntry.snapshot && activeEntry.snapshot.length &&
                    anyDriftedVisible(activeEntry.snapshot)) {
                    snapContainers(activeEntry.snapshot, true);
                }

                // Location Map / More Info are overlay containers that can
                // open/close on top of the CURRENT panorama without any
                // scene change firing above, so this is checked every
                // frame (not just on scene change) via isOverlayPanelOpen().
                //
                // window.__icxManualHide remains available as a manual
                // override for any other button that wants to force-hide
                // the toggle via its own "On Click > Execute Javascript"
                // action; being back on a real panorama with both overlay
                // panels closed auto-clears it, so no separate "show
                // again" snippet is needed anywhere.
                var onPanorama = isViewingPanorama(currentPanorama);
                var overlayOpen = isOverlayPanelOpen();
                if (onPanorama && !overlayOpen && window.__icxManualHide) {
                    window.__icxManualHide = false;
                }
                var shouldShowButton = onPanorama && !overlayOpen && !window.__icxManualHide;
                toggleBtn.classList.toggle('icx-visible', shouldShowButton);
            } catch (e) {
                console.error(LOG_PREFIX, 'frameLoop error (loop continues):', e);
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
        styleEl.textContent =
            '#' + ROOT_ID + '{position:fixed;inset:0;z-index:2147483646;font-family:Arial,Helvetica,sans-serif;pointer-events:none;}' +
            '.icx-toggle-btn{position:fixed;top:50%;right:20px;transform:translateY(-50%) translateX(16px) scale(.9);display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;color:#fff;border:1px solid rgba(255,255,255,.28);cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.22);background:rgba(0,0,0,.32);-webkit-backdrop-filter:blur(14px) saturate(150%);backdrop-filter:blur(14px) saturate(150%);pointer-events:none;opacity:0;transition:opacity 260ms ease, transform 260ms cubic-bezier(.22,1,.36,1), box-shadow 220ms ease, background 180ms ease;}' +
            '.icx-toggle-btn.icx-visible{opacity:1;pointer-events:auto;transform:translateY(-50%) translateX(0) scale(1);}' +
            '.icx-toggle-btn.icx-visible:hover{transform:translateY(-50%) scale(1.08);box-shadow:0 14px 28px rgba(0,0,0,.3);background:rgba(255,255,255,.24);}' +
            '.icx-toggle-btn:active{transform:translateY(-50%) scale(.94);}' +
            '.icx-toggle-btn:focus-visible{outline:2px solid #fff;outline-offset:2px;}' +
            '.icx-toggle-btn svg{width:22px;height:22px;stroke:#fff;}';
        document.head.appendChild(styleEl);
    }
})(this);

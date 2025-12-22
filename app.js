// app.js
// Purpose: Global client-side interactions for SiteSketch AI
// Responsibilities: Active navigation highlighting, toggle switches, selectable cards, modal open/close, simulated loading states
// No network activity ? UI state management only

(function() {
    'use strict';

    // Public API container
    var SiteSketch = {};

    // Small mapping of body[data-page] -> filename used for robust nav matching
    var PAGE_MAP = {
        index: 'index.html',
        brandSetup: 'brand_setup.html',
        brandAssets: 'brand_assets.html',
        websiteGenerator: 'website_generator.html',
        updateWebsite: 'update_website.html'
    };

    // Event emitter used by the component (exposed via SiteSketch.emit)
    SiteSketch.emit = function(eventName, detail) {
        try {
            var ev = new CustomEvent(eventName, { detail: detail });
            window.dispatchEvent(ev);
        } catch (err) {
            // fallback for older browsers if needed
            var evFallback = document.createEvent('CustomEvent');
            evFallback.initCustomEvent(eventName, false, false, detail);
            window.dispatchEvent(evFallback);
        }
    };

    // Centralized loading setter: toggles .is-loading and aria-busy and emits start/stop
    SiteSketch.setLoading = function(elem, isLoading) {
        if (!elem) return;
        var el = (typeof elem === 'string') ? document.querySelector(elem) : elem;
        if (!el) return;

        if (isLoading) {
            el.classList.add('is-loading');
            el.classList.add('loading'); // preserve older class for compatibility
            el.setAttribute('aria-busy', 'true');
            SiteSketch.emit('sitesketch:loading:start', { target: el });
        } else {
            el.classList.remove('is-loading');
            el.classList.remove('loading');
            el.removeAttribute('aria-busy');
            SiteSketch.emit('sitesketch:loading:stop', { target: el });
        }
    };

    // =====================
    // Integrity checks per contract
    // =====================
    function integrityCheck() {
        var errors = [];

        // body[data-page]
        var page = document.body.getAttribute('data-page');
        if (!page) {
            errors.push('Missing body[data-page] attribute');
        }

        // data-nav and data-nav-link presence and link matching page (use PAGE_MAP)
        var nav = document.querySelector('[data-nav]');
        if (!nav) {
            errors.push('Missing [data-nav] element');
        } else {
            var navLinks = nav.querySelectorAll('[data-nav-link]');
            if (!navLinks || navLinks.length === 0) {
                errors.push('No [data-nav-link] elements found inside [data-nav]');
            } else if (page) {
                var expectedHref = PAGE_MAP[page] || page;
                var found = Array.prototype.slice.call(navLinks).some(function(link) {
                    var href = link.getAttribute('href') || '';
                    // match exact filename or, for robustness, compare resolved pathname's last segment
                    if (href === expectedHref) return true;
                    try {
                        var a = document.createElement('a');
                        a.href = href;
                        var linkBasename = a.pathname.split('/').pop();
                        return linkBasename === expectedHref;
                    } catch (err) {
                        return false;
                    }
                });
                if (!found) {
                    errors.push('No nav link href matches body[data-page] value: ' + page + ' (expected ' + expectedHref + ')');
                }
            }
        }

        // data-login-link must exist and href === 'brand_setup.html'
        var loginLink = document.querySelector('[data-login-link]');
        if (!loginLink) {
            errors.push('Missing [data-login-link] element');
        } else {
            var loginHref = loginLink.getAttribute('href') || '';
            if (loginHref !== 'brand_setup.html') {
                errors.push('[data-login-link] href must be "brand_setup.html" (found "' + loginHref + '")');
            }
        }

        // data-two-panel required on updateWebsite page
        if (page === 'updateWebsite' || page === 'updateWebsite.html') {
            var twoPanel = document.querySelector('[data-two-panel]');
            if (!twoPanel) {
                errors.push('Missing [data-two-panel] on updateWebsite page');
            }
        }

        // Modal triggers: data-modal-trigger -> should have aria-controls and referenced modal must exist with same id
        document.querySelectorAll('[data-modal-trigger]').forEach(function(trigger) {
            var modalId = trigger.getAttribute('data-modal-trigger');
            var ariaControls = trigger.getAttribute('aria-controls');
            if (!ariaControls || ariaControls !== modalId) {
                errors.push('Modal trigger must have aria-controls equal to its data-modal-trigger value (' + modalId + ')');
            }
            if (!modalId || !document.getElementById(modalId)) {
                errors.push('Modal with id "' + modalId + '" referenced by data-modal-trigger not found');
            }
        });

        // Toggle role and aria-checked validation for .toggle-switch and [data-toggle] elements
        document.querySelectorAll('.toggle-switch, [data-toggle]').forEach(function(toggle) {
            var role = toggle.getAttribute('role');
            var ariaChecked = toggle.getAttribute('aria-checked');
            if (!(role === 'switch' || role === 'checkbox')) {
                errors.push('Toggle element must have role "switch" or "checkbox"');
            }
            if (ariaChecked === null) {
                errors.push('Toggle element must have aria-checked attribute');
            }
        });

        if (errors.length) {
            SiteSketch.emit('sitesketch:integrity:fail', { errors: errors });
            return false;
        }
        return true;
    }

    // =====================
    // Active Navigation Highlighting (reads body[data-page] and data-nav/data-nav-link selectors)
    // =====================
    function highlightActiveNav() {
        var page = document.body.getAttribute('data-page');
        var nav = document.querySelector('[data-nav]');
        if (!nav) return;

        var expectedHref = PAGE_MAP[page] || page;

        nav.querySelectorAll('[data-nav-link]').forEach(function(link) {
            var href = link.getAttribute('href') || '';
            var match = false;
            if (href === expectedHref) match = true;
            else {
                try {
                    var a = document.createElement('a');
                    a.href = href;
                    var linkBasename = a.pathname.split('/').pop();
                    if (linkBasename === expectedHref) match = true;
                } catch (err) {
                    match = false;
                }
            }

            if (match) {
                link.classList.add('is-active');
                link.classList.add('active'); // preserve old class
                link.setAttribute('aria-current', 'page');
            } else {
                link.classList.remove('is-active');
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            }
        });

        SiteSketch.emit('sitesketch:nav:changed', { page: page });
    }

    // =====================
    // Login link routing normalization
    // Ensure Login always goes to brand_setup.html
    // =====================
    function initLoginLinks() {
        document.querySelectorAll('[data-login-link]').forEach(function(link) {
            try {
                // enforce href for consistency
                link.setAttribute('href', 'brand_setup.html');
            } catch (err) {}
            // intercept clicks to ensure consistent navigation across environments
            link.addEventListener('click', function(e) {
                // allow open in new tab if modifier keys used
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                window.location.href = 'brand_setup.html';
            });
        });
    }

    // =====================
    // Toggle Switch Behavior
    // =====================
    function initToggleSwitches() {
        document.querySelectorAll('.toggle-switch, [data-toggle]').forEach(function(toggle) {
            // ensure there's a role/aria-checked present for accessibility if missing (do not rename)
            // Note: integrityCheck will have validated these; we don't auto-fix here to avoid hiding issues.

            toggle.addEventListener('click', function() {
                var isOn = this.classList.toggle('is-on');
                // keep backward compatibility
                if (isOn) {
                    this.classList.add('on');
                } else {
                    this.classList.remove('on');
                }
                // Update aria-checked consistently
                this.setAttribute('aria-checked', isOn ? 'true' : 'false');

                SiteSketch.emit('sitesketch:toggle:change', {
                    name: this.getAttribute('data-toggle') || this.id || null,
                    checked: isOn,
                    element: this
                });
            });

            toggle.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
            });
        });
    }

    // =====================
    // Selectable Card Behavior
    // =====================
    function initSelectableCards() {
        var selector = '.section-card, .layout-card, .asset-card, .template-card, [data-card], [data-select]';
        document.querySelectorAll(selector).forEach(function(card) {
            card.addEventListener('click', function() {
                var isSection = this.classList.contains('section-card');
                var isAssetOrTemplate = this.classList.contains('asset-card') || this.classList.contains('template-card');
                var dataId = this.getAttribute('data-card') || this.getAttribute('data-id') || this.getAttribute('data-select') || this.getAttribute('data-section') || null;

                if (isSection) {
                    // single-select among section-card
                    document.querySelectorAll('.section-card').forEach(function(c) {
                        c.classList.remove('is-selected');
                        c.classList.remove('selected'); // backward compat
                        c.removeAttribute('aria-pressed');
                    });
                    this.classList.add('is-selected');
                    this.classList.add('selected');
                    this.setAttribute('aria-pressed', 'true');

                    SiteSketch.emit('sitesketch:card:select', {
                        id: dataId,
                        type: 'section',
                        selected: true,
                        element: this
                    });
                } else {
                    // toggle selection for other card types (multi-select)
                    var nowSelected = this.classList.toggle('is-selected');
                    if (nowSelected) this.classList.add('selected');
                    else this.classList.remove('selected');
                    this.setAttribute('aria-pressed', nowSelected ? 'true' : 'false');

                    SiteSketch.emit('sitesketch:card:select', {
                        id: dataId,
                        type: isAssetOrTemplate ? (this.classList.contains('asset-card') ? 'asset' : 'template') : 'card',
                        selected: !!nowSelected,
                        element: this
                    });
                }
            });

            card.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
            });
        });
    }

    // =====================
    // Modal Open/Close Behavior
    // =====================
    function initModals() {
        // Open modal on preview clicks (data-modal-trigger required by integrityCheck)
        document.querySelectorAll('[data-modal-trigger]').forEach(function(trigger) {
            trigger.addEventListener('click', function(e) {
                e.preventDefault();
                var modalId = this.getAttribute('data-modal-trigger');
                var modal = document.getElementById(modalId);
                if (modal) {
                    modal.classList.add('is-open');
                    modal.classList.add('active'); // legacy
                    modal.classList.add('open'); // new simple state class
                    modal.setAttribute('aria-hidden', 'false');
                    modal.setAttribute('role', modal.getAttribute('role') || 'dialog');
                    document.body.style.overflow = 'hidden';
                    try { modal.focus(); } catch (err) {}
                    SiteSketch.emit('sitesketch:modal:open', { id: modalId, element: modal, trigger: this });
                }
            });
        });

        // Close modal on backdrop click or ESC or close buttons
        document.querySelectorAll('.modal, [data-modal]').forEach(function(modal) {
            var backdrop = modal.querySelector('.modal-backdrop');
            var closeBtn = modal.querySelector('.modal-close, [data-modal-close]');

            if (backdrop) {
                backdrop.addEventListener('click', function() {
                    closeModal(modal);
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    closeModal(modal);
                });
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.is-open, .modal.active, .modal.open, [data-modal][aria-hidden=\"false\"]').forEach(function(modal) {
                    closeModal(modal);
                });
            }
        });
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.classList.remove('active');
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        SiteSketch.emit('sitesketch:modal:close', { id: modal.id || null, element: modal });
    }

    // =====================
    // Update Website: Before/After Preview Toggle
    // =====================
    function initBeforeAfterToggle() {
        var beforeAfterImage = 'https://im.runware.ai/image/ws/2/ii/38a74661-6d97-4ce1-8a72-efad694ea401.jpg';
        
        // Set the before/after image in the Update Website preview panels (be tolerant of selector variations)
        var beforePanel = document.querySelector('.preview-panel.before .preview-content img') || document.querySelector('[data-two-panel] .preview-panel.before img');
        var afterPanel = document.querySelector('.preview-panel.after .preview-content img') || document.querySelector('[data-two-panel] .preview-panel.after img');
        
        if (beforePanel && afterPanel) {
            beforePanel.src = beforeAfterImage;
            afterPanel.src = beforeAfterImage;
            beforePanel.alt = 'Website preview before update';
            afterPanel.alt = 'Website preview after update';
        }

        // Toggle between before/after states
        document.querySelectorAll('[data-toggle-preview]').forEach(function(toggle) {
            toggle.addEventListener('click', function() {
                var targetClass = this.getAttribute('data-toggle-preview');
                var panels = document.querySelectorAll('.preview-panel, [data-two-panel] .preview-panel');
                panels.forEach(function(panel) {
                    panel.classList.remove('active');
                    panel.classList.remove('is-active');
                    if (panel.classList.contains(targetClass)) {
                        panel.classList.add('active');
                        panel.classList.add('is-active');
                    }
                });
            });
        });
    }

    // =====================
    // Simulated Loading States
    // =====================
    function initLoadingStates() {
        // Generate button loading
        document.querySelectorAll('.btn-generate').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (btn.classList.contains('loading') || btn.classList.contains('is-loading')) return;

                // Use centralized API
                SiteSketch.setLoading(btn, true);

                var btnText = btn.querySelector('.btn-text');
                var originalText = btnText ? btnText.textContent : btn.textContent;

                if (btnText) {
                    btnText.textContent = 'Generating...';
                } else {
                    btn.textContent = 'Generating...';
                }

                setTimeout(function() {
                    SiteSketch.setLoading(btn, false);
                    if (btnText) {
                        btnText.textContent = originalText;
                    } else {
                        btn.textContent = originalText;
                    }
                    SiteSketch.emit('sitesketch:generate:complete', { element: btn });
                }, 2500);
            });
        });

        // Regenerate button feedback
        document.querySelectorAll('.btn-regenerate').forEach(function(btn) {
            btn.addEventListener('click', function() {
                SiteSketch.emit('sitesketch:regenerate:start', { element: btn });
                this.style.opacity = '0.6';
                setTimeout(function() {
                    btn.style.opacity = '1';
                    SiteSketch.emit('sitesketch:regenerate:complete', { element: btn });
                }, 500);
            });
        });

        // Upload button states
        document.querySelectorAll('.btn-upload, .upload-trigger').forEach(function(btn) {
            btn.addEventListener('click', function() {
                SiteSketch.emit('sitesketch:upload:trigger', { element: btn });
                this.style.transform = 'scale(0.98)';
                setTimeout(function() {
                    btn.style.transform = '';
                }, 150);
            });
        });
    }

    // =====================
    // Smooth Scroll for Anchor Links
    // =====================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
            anchor.addEventListener('click', function (e) {
                var href = this.getAttribute('href');
                if (href !== '#' && href !== '') {
                    e.preventDefault();
                    var target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }
            });
        });
    }

    // =====================
    // Keyboard Navigation Enhancements
    // =====================
    function initKeyboardNav() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-nav');
            }
        });

        document.addEventListener('mousedown', function() {
            document.body.classList.remove('keyboard-nav');
        });
    }

    // =====================
    // Style Selector Changes
    // =====================
    function initStyleSelector() {
        var styleSelect = document.getElementById('styleSelect');
        if (styleSelect) {
            styleSelect.addEventListener('change', function(e) {
                SiteSketch.emit('sitesketch:style:change', { value: e.target.value });
            });
        }
    }

    // =====================
    // Focus Management for Skip Links
    // =====================
    function initSkipLinks() {
        document.querySelectorAll('.skip-link').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                var target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.setAttribute('tabindex', '-1');
                    target.focus();
                    target.addEventListener('blur', function() {
                        this.removeAttribute('tabindex');
                    }, { once: true });
                }
            });
        });
    }

    // =====================
    // Initialize All Features (public)
    // =====================
    SiteSketch.initAll = function() {
        if (!integrityCheck()) {
            return;
        }

        SiteSketch.initNav();
        SiteSketch.initToggles();
        SiteSketch.initCards();
        SiteSketch.initModals();
        // additional inits
        initBeforeAfterToggle();
        initLoadingStates();
        initSmoothScroll();
        initKeyboardNav();
        initStyleSelector();
        initSkipLinks();
        initLoginLinks();

        SiteSketch.emit('sitesketch:app:initialized', {});
    };

    // Expose granular init functions required by public API
    SiteSketch.initNav = highlightActiveNav;
    SiteSketch.initToggles = initToggleSwitches;
    SiteSketch.initCards = initSelectableCards;
    SiteSketch.initModals = initModals;

    // Expose API to global window object
    window.SiteSketch = SiteSketch;

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', SiteSketch.initAll);
    } else {
        SiteSketch.initAll();
    }

    // Re-run card/toggle initialization on dynamic content load
    window.reinitInteractions = function() {
        SiteSketch.initToggles();
        SiteSketch.initCards();
        SiteSketch.initModals();
    };

})();
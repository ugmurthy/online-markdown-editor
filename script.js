function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const Editor = {
    config: {
        debounceDelay: 300,
        mathJaxProcessing: false,
        localStorageKey: 'markdownEditorContent',
        autosaveInterval: 5000,
        minPaneWidth: 280,
        paneResizerWidth: 14,
    },
    state: {
        currentMathEngine: 'katex',
        currentMarkdownEngine: 'markdown-it',
        customCssVisible: false,
        toolbarDeckOpen: false,
        lastText: '',
        lastRenderedHTML: '',
        mathJaxRunning: false,
        libsReady: {
            mathJax: false,
            katex: false,
            mermaid: false,
            hljs: false,
            markdownIt: false,
            marked: false
        },
        isInitialized: false,
        mathPlaceholders: {},
        isMobileView: false,
        currentMobilePane: 'editor',
        lastSavedTime: null,
        editorVisible: true,
        desktopEditorWidth: null,
        isResizingPanes: false,
    },
    elements: {
        container: null,
        editorPane: null,
        textarea: null,
        previewContent: null,
        previewPane: null,
        paneResizer: null,
        toolbar: null,
        toolbarDeck: null,
        markdownItBtn: null,
        markedBtn: null,
        mathJaxBtn: null,
        kaTeXBtn: null,
        downloadBtn: null,
        downloadPdfBtn: null,
        downloadMdBtn: null,
        downloadTxtBtn: null,
        toggleCssBtn: null,
        customCssContainer: null,
        customCssInput: null,
        applyCssBtn: null,
        closeCssBtn: null,
        customStyleTag: null,
        buffer: null,
        toggleEditorVisibilityBtn: null,
        toggleToolbarDeckBtn: null,
        uploadFileBtn: null,
        fileUploadInput: null,
        autosaveIndicator: null,
    },
    markdownItInstance: null,
    markedInstance: null,
    debouncedUpdate: null,
    autosaveTimer: null,

    Init: function () {
        if (!this.getElements()) {
            return;
        }

        this.createBufferElement();
        this.setupMarkdownRenderers();
        this.InitializeMermaid();
        this.debouncedUpdate = debounce(this.UpdatePreview.bind(this), this.config.debounceDelay);
        this.setupEventListeners();
        this.initializeResponsiveUI();
        this.setupAutosave();
        this.LoadFromLocalStorage();
        this.state.lastText = this.elements.textarea.value;

        // Immediate initial rendering (don't wait for library check)
        if (this.elements.textarea.value) {
            this.UpdatePreview(true); // Force update regardless of lastText comparison
        }

        this.CheckLibraries();
    },

    getElements: function () {
        this.elements.container = document.querySelector(".container");
        this.elements.editorPane = document.getElementById("editor-pane");
        this.elements.textarea = document.getElementById("markdown-input");
        this.elements.previewContent = document.getElementById("preview-content");
        this.elements.previewPane = document.getElementById("preview-pane");
        this.elements.paneResizer = document.getElementById("pane-resizer");
        this.elements.toolbar = document.querySelector(".toolbar");
        this.elements.toolbarDeck = document.getElementById("toolbar-deck");
        this.elements.markdownItBtn = document.getElementById("btn-markdown-it");
        this.elements.markedBtn = document.getElementById("btn-marked");
        this.elements.mathJaxBtn = document.getElementById("btn-mathjax");
        this.elements.kaTeXBtn = document.getElementById("btn-katex");
        this.elements.downloadBtn = document.getElementById("btn-download");
        this.elements.downloadPdfBtn = document.getElementById("btn-download-pdf");
        this.elements.downloadMdBtn = document.getElementById("btn-download-md");
        this.elements.downloadTxtBtn = document.getElementById("btn-download-txt");
        this.elements.toggleCssBtn = document.getElementById("btn-toggle-css");
        this.elements.customCssContainer = document.getElementById("custom-css-container");
        this.elements.customCssInput = document.getElementById("custom-css-input");
        this.elements.applyCssBtn = document.getElementById("btn-apply-css");
        this.elements.closeCssBtn = document.getElementById("btn-close-css");
        this.elements.customStyleTag = document.getElementById("custom-styles-output");
        this.elements.toggleEditorVisibilityBtn = document.getElementById("btn-toggle-editor-visibility");
        this.elements.toggleToolbarDeckBtn = document.getElementById("btn-toggle-toolbar-deck");
        this.elements.uploadFileBtn = document.getElementById("btn-upload-file");
        this.elements.fileUploadInput = document.getElementById("file-upload-input");
        this.elements.autosaveIndicator = document.getElementById("autosave-indicator");

        if (!this.elements.container || !this.elements.editorPane || !this.elements.textarea || !this.elements.previewContent || !this.elements.previewPane || !this.elements.paneResizer) {
            console.error("Critical elements not found. Aborting initialization.");
            alert("Error initializing editor: Required elements missing.");
            return false;
        }
        return true;
    },

    createBufferElement: function () {
        this.elements.buffer = document.createElement('div');
        this.elements.buffer.id = "mathjax-buffer";
        this.elements.buffer.style.display = 'none';
        document.body.appendChild(this.elements.buffer);
    },

    setupMarkdownRenderers: function () {
        if (typeof markdownit !== 'function') {
            console.error("markdown-it library not loaded.");
            alert("Error initializing editor: markdown-it library failed to load.");
            return false;
        } else {
            this.state.libsReady.markdownIt = true;
        }

        this.markdownItInstance = window.markdownit({
            html: true,
            linkify: true,
            typographer: true,
            highlight: (str, lang) => this.handleCodeHighlighting(str, lang)
        });

        if (typeof markdownitFootnote === 'function') {
            this.markdownItInstance = this.markdownItInstance.use(markdownitFootnote);
        }

        if (typeof marked !== 'undefined') {
            this.state.libsReady.marked = true;
            marked.setOptions({
                renderer: new marked.Renderer(),
                highlight: (code, lang) => this.handleCodeHighlighting(code, lang),
                pedantic: false,
                gfm: true,
                breaks: false,
                sanitize: false,
                smartLists: true,
                smartypants: false,
                xhtml: false
            });
            this.markedInstance = marked;
        }
        return true;
    },

    handleCodeHighlighting: function (code, lang) {
        if (lang && lang === 'mermaid') {
            return `<pre class="mermaid">${this.EscapeHtml(code)}</pre>`;
        }
        if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
            try {
                const highlightedCode = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
                return `<pre class="hljs language-${lang}"><code>${highlightedCode}</code></pre>`;
            } catch (e) {
                console.warn("Highlight.js error:", e);
            }
        }
        return `<pre class="hljs"><code>${this.markdownItInstance?.utils.escapeHtml(code) || code}</code></pre>`;
    },
 // Detect lines with LaTeX even without brackets nd wrap them in $$...$$ 🤔
    processLatexPaste: function(text) {
        const lines = text.split('\n');
        return lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && 
                !trimmed.startsWith('$$') && 
                !trimmed.startsWith('\\[') && 
                !trimmed.endsWith('$$') && 
                !trimmed.endsWith('\\]') && 
                !/\$.*\$/.test(trimmed) && // Check if line already has $ delimiters
                !/\\[()\[\]]/.test(trimmed) && // Check if line already has \( \) or \[ \] delimiters
                /\\[a-zA-Z]+\b/.test(trimmed)) { // Has LaTeX commands
                return `$$${trimmed}$$`;
            }
            return line;
        }).join('\n');
    },

    setupEventListeners: function () {
        this.elements.textarea.addEventListener('input', () => {
            this.SaveToLocalStorage();
            this.debouncedUpdate();
        });

        // Replace the existing paste listener with this
        this.elements.textarea.addEventListener('paste', (e) => {
            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedText = clipboardData.getData('text/plain');
            const processedText = this.processLatexPaste(pastedText);
            
            // Prevent default paste and insert modified text
            e.preventDefault();
            document.execCommand('insertText', false, processedText);
            
            // Trigger update
            setTimeout(() => this.UpdatePreview(true), 0);
        });

        this.elements.markdownItBtn.addEventListener('click', () => this.SetMarkdownEngine('markdown-it'));
        this.elements.markedBtn.addEventListener('click', () => this.SetMarkdownEngine('marked'));
        this.elements.mathJaxBtn.addEventListener('click', () => this.SetMathEngine('mathjax'));
        this.elements.kaTeXBtn.addEventListener('click', () => this.SetMathEngine('katex'));
        this.elements.downloadPdfBtn.addEventListener('click', () => this.DownloadAs('pdf'));
        this.elements.downloadMdBtn.addEventListener('click', () => this.DownloadAs('md'));
        this.elements.downloadTxtBtn.addEventListener('click', () => this.DownloadAs('txt'));
        this.elements.toggleCssBtn.addEventListener('click', this.ToggleCustomCSS.bind(this));
        this.elements.applyCssBtn.addEventListener('click', this.ApplyCustomCSS.bind(this));
        this.elements.closeCssBtn.addEventListener('click', this.ToggleCustomCSS.bind(this));

        if (this.elements.toggleEditorVisibilityBtn) {
            this.elements.toggleEditorVisibilityBtn.addEventListener('click', () => this.ToggleEditorVisibility());
        }

        if (this.elements.toggleToolbarDeckBtn) {
            this.elements.toggleToolbarDeckBtn.addEventListener('click', () => this.ToggleToolbarDeck());
        }

        if (this.elements.uploadFileBtn) {
            this.elements.uploadFileBtn.addEventListener('click', () => this.OpenFilePicker());
        }

        if (this.elements.fileUploadInput) {
            this.elements.fileUploadInput.addEventListener('change', (event) => this.HandleFileUpload(event));
        }

        if (this.elements.paneResizer) {
            this.elements.paneResizer.addEventListener('pointerdown', this.StartPaneResize.bind(this));
            this.elements.paneResizer.addEventListener('keydown', this.HandlePaneResizerKeydown.bind(this));
        }

        window.addEventListener('pointermove', this.ResizePanes.bind(this));
        window.addEventListener('pointerup', this.StopPaneResize.bind(this));
        window.addEventListener('pointercancel', this.StopPaneResize.bind(this));
    },

    initializeResponsiveUI: function () {
        this.state.desktopEditorWidth = this.getDefaultEditorWidth();
        this.CheckMobileView();
        window.addEventListener('resize', this.CheckMobileView.bind(this));
        this.ApplyToolbarDeckState();
    },

    ToggleEditorVisibility: function () {
        if (this.state.isMobileView) {
            this.SetMobilePane(this.state.currentMobilePane === 'editor' ? 'preview' : 'editor');
            return;
        }

        this.state.editorVisible = !this.state.editorVisible;
        if (this.state.editorVisible && !this.state.desktopEditorWidth) {
            this.state.desktopEditorWidth = this.getDefaultEditorWidth();
        }

        this.ApplyDesktopPaneLayout();

        if (this.state.editorVisible) {
            this.elements.textarea.focus();
        } else {
            this.UpdatePreview();
        }
    },

    StartPaneResize: function (event) {
        if (this.state.isMobileView || !this.state.editorVisible || !this.elements.paneResizer) {
            return;
        }

        this.state.isResizingPanes = true;
        this.elements.paneResizer.classList.add('is-dragging');
        document.body.classList.add('is-resizing');

        if (typeof this.elements.paneResizer.setPointerCapture === 'function') {
            this.elements.paneResizer.setPointerCapture(event.pointerId);
        }

        this.ResizePanes(event);
        event.preventDefault();
    },

    ResizePanes: function (event) {
        if (!this.state.isResizingPanes || !this.elements.container) {
            return;
        }

        const containerRect = this.elements.container.getBoundingClientRect();
        const nextWidth = this.ClampEditorWidth(event.clientX - containerRect.left);
        this.state.desktopEditorWidth = nextWidth;
        this.ApplyDesktopPaneLayout();
    },

    StopPaneResize: function (event) {
        if (!this.state.isResizingPanes) {
            return;
        }

        this.state.isResizingPanes = false;
        document.body.classList.remove('is-resizing');

        if (this.elements.paneResizer) {
            this.elements.paneResizer.classList.remove('is-dragging');

            if (
                event &&
                typeof this.elements.paneResizer.hasPointerCapture === 'function' &&
                this.elements.paneResizer.hasPointerCapture(event.pointerId)
            ) {
                this.elements.paneResizer.releasePointerCapture(event.pointerId);
            }
        }
    },

    HandlePaneResizerKeydown: function (event) {
        if (this.state.isMobileView || !this.state.editorVisible) {
            return;
        }

        const step = event.shiftKey ? 64 : 24;
        const bounds = this.GetEditorWidthBounds();

        switch (event.key) {
            case 'ArrowLeft':
                this.state.desktopEditorWidth = this.ClampEditorWidth((this.state.desktopEditorWidth || this.getDefaultEditorWidth()) - step);
                break;
            case 'ArrowRight':
                this.state.desktopEditorWidth = this.ClampEditorWidth((this.state.desktopEditorWidth || this.getDefaultEditorWidth()) + step);
                break;
            case 'Home':
                this.state.desktopEditorWidth = bounds.min;
                break;
            case 'End':
                this.state.desktopEditorWidth = bounds.max;
                break;
            default:
                return;
        }

        event.preventDefault();
        this.ApplyDesktopPaneLayout();
    },

    GetEditorWidthBounds: function () {
        const containerWidth = this.elements.container ? this.elements.container.clientWidth : 0;
        const fallbackWidth = Math.max(0, Math.floor((containerWidth - this.config.paneResizerWidth) / 2));
        const min = Math.min(this.config.minPaneWidth, fallbackWidth);
        const max = containerWidth - min - this.config.paneResizerWidth;

        if (max <= min) {
            return { min: fallbackWidth, max: fallbackWidth };
        }

        return { min, max };
    },

    getDefaultEditorWidth: function () {
        const containerWidth = this.elements.container ? this.elements.container.clientWidth : 0;
        return this.ClampEditorWidth(Math.round(containerWidth * 0.5));
    },

    ClampEditorWidth: function (width) {
        const bounds = this.GetEditorWidthBounds();

        if (!Number.isFinite(width)) {
            return bounds.max;
        }

        return Math.min(Math.max(width, bounds.min), bounds.max);
    },

    ApplyDesktopPaneLayout: function () {
        if (!this.elements.container || !this.elements.editorPane || !this.elements.previewPane) {
            return;
        }

        this.elements.container.classList.toggle('editor-hidden', !this.state.editorVisible);
        this.elements.editorPane.style.display = this.state.editorVisible ? 'flex' : 'none';
        this.elements.previewPane.style.display = 'block';

        if (this.elements.paneResizer) {
            this.elements.paneResizer.hidden = !this.state.editorVisible;
        }

        if (this.state.editorVisible) {
            const nextWidth = this.ClampEditorWidth(this.state.desktopEditorWidth || this.getDefaultEditorWidth());
            this.state.desktopEditorWidth = nextWidth;
            this.elements.container.style.setProperty('--editor-pane-width', `${nextWidth}px`);
        } else {
            this.elements.container.style.removeProperty('--editor-pane-width');
        }

        this.UpdatePaneResizerAccessibility();
        this.updateEditorToggleButton();
    },

    ApplyMobilePaneLayout: function () {
        if (!this.elements.container || !this.elements.editorPane || !this.elements.previewPane) {
            return;
        }

        this.elements.container.classList.remove('editor-hidden');
        this.elements.container.style.removeProperty('--editor-pane-width');
        this.elements.editorPane.style.display = this.state.currentMobilePane === 'editor' ? 'flex' : 'none';
        this.elements.previewPane.style.display = this.state.currentMobilePane === 'preview' ? 'block' : 'none';

        if (this.elements.paneResizer) {
            this.elements.paneResizer.hidden = true;
        }

        this.UpdatePaneResizerAccessibility();
        this.updateEditorToggleButton();
    },

    UpdatePaneResizerAccessibility: function () {
        if (!this.elements.paneResizer || !this.elements.container) {
            return;
        }

        if (this.state.isMobileView || !this.state.editorVisible) {
            this.elements.paneResizer.setAttribute('aria-valuenow', '0');
            this.elements.paneResizer.setAttribute('aria-valuetext', 'Editor hidden');
            return;
        }

        const containerWidth = this.elements.container.clientWidth;
        const widthPercent = containerWidth > 0
            ? Math.round((this.state.desktopEditorWidth / containerWidth) * 100)
            : 50;

        this.elements.paneResizer.setAttribute('aria-valuemin', '0');
        this.elements.paneResizer.setAttribute('aria-valuemax', '100');
        this.elements.paneResizer.setAttribute('aria-valuenow', String(widthPercent));
        this.elements.paneResizer.setAttribute('aria-valuetext', `Editor width ${widthPercent}%`);
    },

    updateEditorToggleButton: function () {
        const buttons = [this.elements.toggleEditorVisibilityBtn].filter(Boolean);

        if (buttons.length === 0) {
            return;
        }

        const isEditorShown = this.state.isMobileView
            ? this.state.currentMobilePane === 'editor'
            : this.state.editorVisible;

        buttons.forEach((button) => {
            const label = isEditorShown ? 'Hide editor' : 'Show editor';
            button.setAttribute('aria-expanded', String(isEditorShown));
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
            button.classList.toggle('is-active', isEditorShown);

            const accessibleText = button.querySelector('.visually-hidden');
            if (accessibleText) {
                accessibleText.textContent = label;
            }
        });
    },

    ToggleToolbarDeck: function () {
        this.state.toolbarDeckOpen = !this.state.toolbarDeckOpen;
        this.ApplyToolbarDeckState();
    },

    ApplyToolbarDeckState: function () {
        if (!this.elements.toolbar || !this.elements.toggleToolbarDeckBtn) {
            return;
        }

        this.elements.toolbar.classList.toggle('is-deck-open', this.state.toolbarDeckOpen);

        if (this.elements.toolbarDeck) {
            this.elements.toolbarDeck.setAttribute('aria-hidden', String(!this.state.toolbarDeckOpen));
        }

        const label = this.state.toolbarDeckOpen
            ? 'Hide customisation controls'
            : 'Show customisation controls';

        this.elements.toggleToolbarDeckBtn.setAttribute('aria-expanded', String(this.state.toolbarDeckOpen));
        this.elements.toggleToolbarDeckBtn.setAttribute('aria-label', label);
        this.elements.toggleToolbarDeckBtn.setAttribute('title', label);
        this.elements.toggleToolbarDeckBtn.classList.toggle('is-active', this.state.toolbarDeckOpen);

        const accessibleText = this.elements.toggleToolbarDeckBtn.querySelector('.visually-hidden');
        if (accessibleText) {
            accessibleText.textContent = label;
        }
    },

    OpenFilePicker: function () {
        if (!this.elements.fileUploadInput) {
            return;
        }

        this.elements.fileUploadInput.value = '';
        this.elements.fileUploadInput.click();
    },

    HandleFileUpload: function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const content = typeof reader.result === 'string' ? reader.result : '';
            this.elements.textarea.value = content;
            this.SaveToLocalStorage();
            this.state.lastText = '';
            this.UpdatePreview(true);

            if (!this.state.isMobileView || this.state.currentMobilePane === 'editor') {
                this.elements.textarea.focus();
            }

            event.target.value = '';
        };

        reader.onerror = () => {
            console.error('Error reading uploaded file:', reader.error);
            alert('Unable to read that file. Please try another file.');
            event.target.value = '';
        };

        reader.readAsText(file);
    },

    setupAutosave: function () {
        this.autosaveTimer = setInterval(() => {
            if (this.elements.textarea.value !== this.state.lastText) {
                this.SaveToLocalStorage();
                this.state.lastText = this.elements.textarea.value;
            }
        }, this.config.autosaveInterval);

        if (this.elements.autosaveIndicator) {
            this.updateAutosaveIndicator();
        }
    },

    updateAutosaveIndicator: function () {
        if (!this.elements.autosaveIndicator) return;

        const now = new Date();
        if (this.state.lastSavedTime) {
            const secondsAgo = Math.floor((now - this.state.lastSavedTime) / 1000);
            if (secondsAgo < 60) {
                this.elements.autosaveIndicator.textContent = `Saved ${secondsAgo}s ago`;
            } else {
                const minutesAgo = Math.floor(secondsAgo / 60);
                this.elements.autosaveIndicator.textContent = `Saved ${minutesAgo}m ago`;
            }
        } else {
            this.elements.autosaveIndicator.textContent = "Auto-saved";
        }
    },

    CheckLibraries: function () {
        if (typeof MathJax !== 'undefined' && MathJax.Hub) {
            this.state.libsReady.mathJax = true;
        }

        if (typeof katex !== 'undefined' && typeof renderMathInElement === 'function') {
            this.state.libsReady.katex = true;
        }

        if (typeof mermaid !== 'undefined' && typeof mermaid.mermaidAPI !== 'undefined') {
            this.state.libsReady.mermaid = true;
        }

        if (typeof hljs !== 'undefined') {
            this.state.libsReady.hljs = true;
        }

        if (this.AllLibrariesReady() && !this.state.isInitialized) {
            this.state.isInitialized = true;
            this.UpdatePreview(true); // Force update to ensure preview reflects current content
        } else if (!this.state.isInitialized) {
            setTimeout(() => this.CheckLibraries(), 300);
        }
    },

    AllLibrariesReady: function () {
        return (this.state.libsReady.markdownIt || this.state.libsReady.marked) &&
            (this.state.libsReady.mathJax || this.state.libsReady.katex);
    },

    InitializeMermaid: function () {
        if (typeof mermaid !== 'undefined') {
            try {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    fontFamily: 'sans-serif',
                    logLevel: 'fatal',
                });
                this.state.libsReady.mermaid = true;
            } catch (e) {
                console.error("Failed to initialize Mermaid:", e);
            }
        }
    },

    UpdatePreview: function (force = false) {
        const text = this.elements.textarea.value;
        if (!force && text === this.state.lastText && this.state.lastText !== '') return;

        try {
            const scrollPercent = this.elements.previewPane.scrollTop /
                (this.elements.previewPane.scrollHeight - this.elements.previewPane.clientHeight);

            if (this.state.currentMarkdownEngine === 'markdown-it' && this.state.libsReady.markdownIt) {
                this.state.lastRenderedHTML = this.markdownItInstance.render(text);
                this.elements.previewContent.innerHTML = this.state.lastRenderedHTML;
                this.ProcessMath();
                this.ProcessMermaid();
            }
            else if (this.state.currentMarkdownEngine === 'marked' && this.state.libsReady.marked) {
                this.RenderWithMarked(text, scrollPercent);
                return;
            }
            else {
                // Try to use any available engine rather than showing error
                if (this.state.libsReady.markdownIt) {
                    this.state.lastRenderedHTML = this.markdownItInstance.render(text);
                    this.elements.previewContent.innerHTML = this.state.lastRenderedHTML;
                    this.ProcessMath();
                    this.ProcessMermaid();
                } else if (this.state.libsReady.marked) {
                    this.RenderWithMarked(text, scrollPercent);
                    return;
                } else {
                    console.error("No valid markdown engine available");
                    this.elements.previewContent.innerHTML = '<p>Error: No valid markdown renderer available</p>';
                    return;
                }
            }

            this._restoreScrollPosition(scrollPercent);
            this.state.lastText = text;

        } catch (err) {
            console.error("Error during rendering:", err);
            this.elements.previewContent.innerHTML = `<p style='color: red; font-weight: bold;'>Error rendering preview. Check console for details.</p><pre>${this.EscapeHtml(err.stack || err.message)}</pre>`;
        }
    },

    RenderWithMarked: function (text, scrollPercent) {
        if (!this.elements.buffer) {
            this.createBufferElement();
        }

        if (this.state.currentMathEngine === 'mathjax') {
            try {
                if (!this.state.mathJaxRunning) {
                    this.state.mathJaxRunning = true;
                    const escapedText = this.EscapeHtml(text);
                    this.elements.buffer.innerHTML = escapedText;

                    MathJax.Hub.Queue(
                        ["resetEquationNumbers", MathJax.InputJax.TeX],
                        ["Typeset", MathJax.Hub, this.elements.buffer],
                        () => {
                            try {
                                const mathJaxProcessedHtml = this.elements.buffer.innerHTML;
                                const finalHtml = marked.parse(mathJaxProcessedHtml);
                                this.elements.previewContent.innerHTML = finalHtml;
                                this.ProcessMermaid();
                                this._restoreScrollPosition(scrollPercent);
                                this.state.lastText = text;
                            } catch (err) {
                                console.error("Error updating preview after MathJax:", err);
                                this.elements.previewContent.innerHTML = `<p style='color: red;'>Error updating preview with MathJax.</p>`;
                            } finally {
                                this.state.mathJaxRunning = false;
                            }
                        }
                    );
                }
            } catch (err) {
                console.error("Error during MathJax+marked rendering:", err);
                this.elements.previewContent.innerHTML = `<p style='color: red;'>Error rendering preview with MathJax.</p>`;
                this.state.mathJaxRunning = false;
            }
        } else {
            try {
                const html = marked.parse(text);
                this.elements.previewContent.innerHTML = html;

                if (this.state.currentMathEngine === 'katex') {
                    this.ProcessMath();
                }

                this.ProcessMermaid();
                this._restoreScrollPosition(scrollPercent);
                this.state.lastText = text;
            } catch (err) {
                console.error("Error during standard marked rendering:", err);
                this.elements.previewContent.innerHTML = `<p style='color: red;'>Error rendering preview with marked.</p>`;
            }
        }
    },

    _restoreScrollPosition: function (scrollPercent) {
        requestAnimationFrame(() => {
            const newScrollHeight = this.elements.previewPane.scrollHeight;
            const newScrollTop = scrollPercent * (newScrollHeight - this.elements.previewPane.clientHeight);
            if (isFinite(scrollPercent) && newScrollHeight > this.elements.previewPane.clientHeight) {
                this.elements.previewPane.scrollTop = newScrollTop;
            } else {
                this.elements.previewPane.scrollTop = 0;
            }
        });
    },

    ProcessMath: function () {
        if (!this.elements.previewContent) return;

        try {
            if (this.state.currentMathEngine === 'katex' && this.state.libsReady.katex) {
                if (typeof renderMathInElement === 'function') {
                    renderMathInElement(this.elements.previewContent, {
                        delimiters: [
                            { left: "$$", right: "$$", display: true },
                            { left: "\\[", right: "\\]", display: true },
                            { left: "$", right: "$", display: false },
                            { left: "\\(", right: "\\)", display: false }
                        ],
                        throwOnError: false
                    });
                }
            } else if (this.state.currentMathEngine === 'mathjax' && this.state.libsReady.mathJax) {
                if (typeof MathJax !== 'undefined' && MathJax.Hub) {
                    if (this.config.mathJaxProcessing) return;
                    this.config.mathJaxProcessing = true;
                    MathJax.Hub.Queue(
                        ["Typeset", MathJax.Hub, this.elements.previewContent],
                        () => { this.config.mathJaxProcessing = false; }
                    );
                }
            }
        } catch (err) {
            console.error(`Error processing math:`, err);
            const errorDiv = document.createElement('div');
            errorDiv.style.color = 'orange';
            errorDiv.textContent = `Math processing error. Check console.`;
            this.elements.previewContent.prepend(errorDiv);
        }
    },

    ProcessMermaid: function () {
        if (typeof mermaid === 'undefined' || !this.elements.previewContent) return;

        const mermaidBlocks = this.elements.previewContent.querySelectorAll('pre.mermaid');
        if (mermaidBlocks.length === 0) return;

        try {
            mermaid.init(undefined, mermaidBlocks);
        } catch (err) {
            console.error("Error initializing mermaid diagrams:", err);
            mermaidBlocks.forEach((block, index) => {
                try {
                    const container = document.createElement('div');
                    container.className = 'mermaid-diagram';
                    const code = this.UnescapeHtml(block.textContent || "").trim();
                    container.textContent = code;

                    if (block.parentNode) {
                        block.parentNode.replaceChild(container, block);
                        mermaid.init(undefined, container);
                    }
                } catch (blockErr) {
                    console.error(`Error rendering mermaid block ${index}:`, blockErr);
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'mermaid-error';
                    errorDiv.innerHTML = `
                        <strong>Mermaid Diagram Error</strong><br>
                        <p>There was a problem rendering this diagram. Check your syntax.</p>
                        <details>
                            <summary>View Error Details</summary>
                            <pre>${this.EscapeHtml(blockErr.message || String(blockErr))}</pre>
                        </details>
                        <details>
                            <summary>View Diagram Source</summary>
                            <pre>${this.EscapeHtml(block.textContent || "")}</pre>
                        </details>
                    `;
                    if (block.parentNode) {
                        block.parentNode.replaceChild(errorDiv, block);
                    }
                }
            });
        }
    },

    CheckMobileView: function () {
        this.state.isMobileView = window.innerWidth <= 768;

        if (this.state.isMobileView) {
            this.StopPaneResize();
            this.ApplyMobilePaneLayout();
        } else {
            this.ApplyDesktopPaneLayout();
        }
    },

    SetMobilePane: function (pane) {
        if (!this.state.isMobileView) return;

        this.state.currentMobilePane = pane;

        this.ApplyMobilePaneLayout();

        if (pane === 'preview') {
            this.UpdatePreview();
        }
    },

    SetMarkdownEngine: function (engine) {
        if (engine !== this.state.currentMarkdownEngine) {
            this.state.currentMarkdownEngine = engine;
            this.elements.markdownItBtn.classList.toggle('active', engine === 'markdown-it');
            this.elements.markedBtn.classList.toggle('active', engine === 'marked');
            
            // Update mobile buttons
            const mobileMarkdownItBtn = document.getElementById('btn-markdown-it-mobile');
            const mobileMarkedBtn = document.getElementById('btn-marked-mobile');
            if (mobileMarkdownItBtn && mobileMarkedBtn) {
                mobileMarkdownItBtn.classList.toggle('active', engine === 'markdown-it');
                mobileMarkedBtn.classList.toggle('active', engine === 'marked');
            }
            
            this.state.lastText = '';
            this.UpdatePreview();
        }
    },

    SetMathEngine: function (engine) {
        if (engine !== this.state.currentMathEngine) {
            this.state.currentMathEngine = engine;
            this.elements.mathJaxBtn.classList.toggle('active', engine === 'mathjax');
            this.elements.kaTeXBtn.classList.toggle('active', engine === 'katex');
            
            // Update mobile buttons
            const mobileMathJaxBtn = document.getElementById('btn-mathjax-mobile');
            const mobileKaTeXBtn = document.getElementById('btn-katex-mobile');
            if (mobileMathJaxBtn && mobileKaTeXBtn) {
                mobileMathJaxBtn.classList.toggle('active', engine === 'mathjax');
                mobileKaTeXBtn.classList.toggle('active', engine === 'katex');
            }
            
            this.state.lastText = '';
            this.UpdatePreview();
        }
    },

    ToggleCustomCSS: function () {
        this.state.customCssVisible = !this.state.customCssVisible;
        this.elements.customCssContainer.style.display = this.state.customCssVisible ? 'flex' : 'none';
        this.elements.toggleCssBtn.textContent = this.state.customCssVisible ? 'Hide CSS' : 'Custom CSS';

        if (this.state.customCssVisible) {
            try {
                const savedCSS = localStorage.getItem('markdownEditorCustomCSS');
                if (savedCSS && this.elements.customCssInput.value === '') {
                    this.elements.customCssInput.value = savedCSS;
                    this.elements.customStyleTag.innerHTML = savedCSS;
                }
            } catch (err) {
                console.error("Error loading custom CSS:", err);
            }
            this.elements.customCssInput.focus();
        }
    },

    ApplyCustomCSS: function () {
        const css = this.elements.customCssInput.value;
        this.elements.customStyleTag.innerHTML = css;
        try {
            localStorage.setItem('markdownEditorCustomCSS', css);
        } catch (err) {
            console.error("Error saving custom CSS:", err);
        }
    },

    DownloadAs: function (format) {
        const text = this.state.lastText;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `markdown_export_${timestamp}.${format}`;

        if (format === 'txt' || format === 'md') {
            const blob = new Blob([text], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
            this._triggerDownload(blob, filename);
        } else if (format === 'pdf') {
            this._generatePdf(filename);
        }
    },

    _triggerDownload: function (blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    },

    _generatePdf: async function (filename) {
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
            alert('PDF generation libraries not loaded yet. Please try again in a moment.');
            return;
        }

        const previewContent = this.elements.previewContent;
        if (!previewContent) return;

        const downloadBtn = this.elements.downloadPdfBtn || document.getElementById('btn-download-pdf-mobile');
        if (downloadBtn) {
            downloadBtn.textContent = 'Generating...';
            downloadBtn.disabled = true;
        }

        try {
            const printContainer = document.createElement('div');
printContainer.className = 'pdf-container';
printContainer.innerHTML = previewContent.innerHTML;

// 💥 Force inline span layout for all h1s (PDF workaround)
printContainer.querySelectorAll("h1").forEach(h => {
    const text = h.textContent;
    h.innerHTML = ''; // clear
    text.split(' ').forEach(word => {
        const span = document.createElement('span');
        span.textContent = word + ' ';
        span.style.display = 'inline-block';
        span.style.marginRight = '0.25em';
        h.appendChild(span);
    });
    h.style.fontFamily = "Arial, sans-serif";
    h.style.fontSize = "24pt";
    h.style.fontWeight = "bold";
});
            printContainer.style.width = '650px';
            printContainer.style.backgroundColor = 'white';
            printContainer.style.color = 'black';
            printContainer.style.padding = '40px';
            printContainer.style.fontSize = '12pt';
            printContainer.style.lineHeight = '1.4';
            printContainer.style.position = 'absolute';
            printContainer.style.top = '0';
            printContainer.style.left = '-9999px';
            document.body.appendChild(printContainer);

            if (this.state.currentMathEngine === 'mathjax' && typeof MathJax !== 'undefined') {
                await new Promise((resolve) => {
                    MathJax.Hub.Queue(["Typeset", MathJax.Hub, printContainer], resolve);
                });
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const codeBlocks = printContainer.querySelectorAll('pre, code');
            codeBlocks.forEach(block => {
                block.style.fontSize = '10pt';
                block.style.overflow = 'hidden';
                block.style.whiteSpace = 'pre-wrap';
                block.style.wordWrap = 'break-word';
                block.style.border = '1px solid #ccc';
                block.style.padding = '8px';
                block.style.borderRadius = '3px';
                block.style.backgroundColor = '#f8f8f8';
            });

            const { jsPDF } = jspdf;
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 40;
            const contentWidth = pageWidth - (margin * 2);
            const pdfOptions = {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
            };

            const canvas = await html2canvas(printContainer, pdfOptions);
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgWidth = contentWidth;
            const ratio = canvas.height / canvas.width;
            const imgHeight = contentWidth * ratio;

            const pageInnerHeight = pageHeight - (margin * 2);
            let heightLeft = imgHeight;
            let position = margin;
            let pageCount = 1;

            pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
            heightLeft -= pageInnerHeight;

            while (heightLeft > 0) {
                pageCount++;
                position = heightLeft - imgHeight + margin;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
                heightLeft -= pageInnerHeight;
            }

            pdf.save(filename);
            document.body.removeChild(printContainer);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert(`Error generating PDF: ${error.message || 'Unknown error'}`);
        } finally {
            if (downloadBtn) {
                downloadBtn.textContent = 'Save as PDF';
                downloadBtn.disabled = false;
            }
        }
    },

    EscapeHtml: function (str) {
        if (!str) return "";
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    UnescapeHtml: function (str) {
        if (!str) return "";
        try {
            const doc = new DOMParser().parseFromString(str, 'text/html');
            return doc.documentElement.textContent || "";
        } catch (e) {
            console.error("Error unescaping HTML:", e);
            return str;
        }
    },

    SaveToLocalStorage: function () {
        try {
            const content = this.elements.textarea.value;
            localStorage.setItem(this.config.localStorageKey, content);
            this.state.lastSavedTime = new Date();
            this.updateAutosaveIndicator();
        } catch (err) {
            console.error("Error saving to localStorage:", err);
        }
    },

    LoadFromLocalStorage: function () {
        try {
            const savedContent = localStorage.getItem(this.config.localStorageKey);
            if (savedContent) {
                this.elements.textarea.value = savedContent;
                // We'll update the preview in Init after setting lastText
            }

            const savedCSS = localStorage.getItem('markdownEditorCustomCSS');
            if (savedCSS && this.elements.customStyleTag) {
                this.elements.customStyleTag.innerHTML = savedCSS;
                if (this.elements.customCssInput) {
                    this.elements.customCssInput.value = savedCSS;
                }
            }
        } catch (err) {
            console.error("Error loading from localStorage:", err);
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    Editor.Init();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        if (!Editor.state.isInitialized) {
            Editor.Init();
        }
    }, 1);
}

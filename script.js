/**
 * @class StorageManager
 * @description Handles persistence for multiple recent documents.
 */
class StorageManager {
    constructor() {
        this.key = 'DRIVE_VIEWER_HISTORY';
        this.maxItems = 5;
    }

    /**
     * @returns {Array} List of recent items
     */
    getHistory() {
        try {
            return JSON.parse(localStorage.getItem(this.key) || '[]');
        } catch (e) {
            return [];
        }
    }

    /**
     * Gets a specific document by its ID from history
     * @param {string} id 
     * @returns {Object|null}
     */
    getDocument(id) {
        const history = this.getHistory();
        return history.find(item => item.id === id) || null;
    }

    /**
     * Adds or updates a document in history
     * @param {Object} doc - {id, title, page, zoom}
     */
    saveDocument(doc) {
        let history = this.getHistory();
        const existingIndex = history.findIndex(item => item.id === doc.id);
        
        const timestamp = Date.now();
        let updatedDoc;

        if (existingIndex > -1) {
            // Update existing but keep other fields if not provided
            updatedDoc = { 
                ...history[existingIndex], 
                ...doc, 
                timestamp 
            };
            history.splice(existingIndex, 1);
        } else {
            updatedDoc = { ...doc, timestamp };
        }

        // Always put latest at the front
        history.unshift(updatedDoc);
        
        // Cap at maxItems
        if (history.length > this.maxItems) {
            history = history.slice(0, this.maxItems);
        }
        
        localStorage.setItem(this.key, JSON.stringify(history));
    }

    /**
     * Gets the most recent document
     */
    getLatest() {
        const history = this.getHistory();
        return history.length > 0 ? history[0] : null;
    }
}

/**
 * @class DriveViewer
 * @description Main controller for the PDF Rendering and Google Drive Integration.
 */
class DriveViewer {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.defaultId = '1ewNhvYGoxFjso9puvNEKWY0a41lAOUaZ';
        this.storage = new StorageManager();
        
        // State
        this.pdfDoc = null;
        this.pageNum = 1;
        this.zoomScale = 1.0;
        this.currentId = '';
        this.currentTitle = 'Document';
        this.isRendering = false;

        // DOM Elements
        this.els = {
            canvas: document.getElementById('pdf-canvas'),
            ctx: document.getElementById('pdf-canvas').getContext('2d'),
            fileName: document.getElementById('file-name'),
            currentPageInput: document.getElementById('current-page-input'),
            totalPages: document.getElementById('total-pages'),
            zoomLevel: document.getElementById('zoom-level'),
            sidebar: document.getElementById('sidebar-recent'),
            recentList: document.getElementById('recent-list'),
            globalLoading: document.getElementById('global-loading'),
            pdfWrapper: document.getElementById('pdf-wrapper'),
            errorBox: document.getElementById('error-box')
        };

        this.init();
    }

    async init() {
        this.bindEvents();
        
        // 1. Ensure 2 default documents are present in History
        const defaultDocs = [
            { id: '1QKqnPFA0ylq879AOGP9XNvp406Ih-s01', title: 'Guide / Example PDF 2' },
            { id: '1ewNhvYGoxFjso9puvNEKWY0a41lAOUaZ', title: 'Alumni OSINT Tracker' }
        ];

        defaultDocs.forEach(doc => {
            if (!this.storage.getDocument(doc.id)) {
                this.storage.saveDocument(doc);
            }
        });

        // 2. Check URL Params
        const urlParams = new URLSearchParams(window.location.search);
        const fileIdFromUrl = urlParams.get('id');
        
        // 3. Resolve target file and start page
        let targetId = fileIdFromUrl || this.defaultId;
        let startPage = 1;
        let startZoom = 1.0;

        // If no URL param, try to get the very latest viewed document
        if (!fileIdFromUrl) {
            const latest = this.storage.getLatest();
            if (latest) {
                targetId = latest.id;
            }
        }

        // LOOKUP HISTORY for the target ID to resume progress
        const historyEntry = this.storage.getDocument(targetId);
        if (historyEntry) {
            startPage = historyEntry.page || 1;
            startZoom = historyEntry.zoom || 1.0;
        }
        
        await this.loadDocument(targetId, startPage, startZoom);
        this.renderSidebar();
    }

    bindEvents() {
        // Navigation
        document.getElementById('prev-btn').onclick = () => this.changePage(-1);
        document.getElementById('next-btn').onclick = () => this.changePage(1);
        this.els.currentPageInput.onchange = (e) => this.goToPage(parseInt(e.target.value));

        // Zoom
        document.getElementById('zoom-in').onclick = () => this.adjustZoom(0.1);
        document.getElementById('zoom-out').onclick = () => this.adjustZoom(-0.1);

        // UI
        document.getElementById('sidebar-toggle').onclick = () => this.toggleSidebar();
        document.getElementById('load-url-btn').onclick = () => this.handleManualLoad();
        document.getElementById('download-btn').onclick = () => this.downloadFile();

        // Close sidebar on click outside
        window.onclick = (e) => {
            if (this.els.sidebar.classList.contains('active') && 
                !this.els.sidebar.contains(e.target) && 
                e.target.id !== 'sidebar-toggle' && 
                !document.getElementById('sidebar-toggle').contains(e.target)) {
                this.toggleSidebar();
            }
        };

        // Keyboard navigation
        window.onkeydown = (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (e.key === 'ArrowRight') this.changePage(1);
            if (e.key === 'ArrowLeft') this.changePage(-1);
            if (e.key === '=' || e.key === '+') this.adjustZoom(0.1);
            if (e.key === '-') this.adjustZoom(-0.1);
        };
    }

    /**
     * Fetches file metadata (name) from GDrive API
     */
    async fetchMetadata(id) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&key=${this.apiKey}`);
            const data = await response.json();
            return data.name || 'Untitled Document';
        } catch (e) {
            return 'Document';
        }
    }

    /**
     * Loads a document by its ID
     */
    async loadDocument(id, page = 1, zoom = 1.0) {
        this.showLoading(true);
        this.hideError();
        
        try {
            this.currentId = id;
            this.zoomScale = zoom;

            const [name, pdfDoc] = await Promise.all([
                this.fetchMetadata(id),
                this.fetchPdf(id)
            ]);

            this.currentTitle = name;
            this.pdfDoc = pdfDoc;
            this.pageNum = Math.min(Math.max(1, page), pdfDoc.numPages);

            this.els.fileName.innerText = name;
            this.els.totalPages.innerText = pdfDoc.numPages;
            
            await this.renderPage(this.pageNum);
            this.renderSidebar();

        } catch (error) {
            console.error(error);
            this.showError("Gagal memuat dokumen. Periksa akses file atau API Key.");
        } finally {
            this.showLoading(false);
        }
    }

    async fetchPdf(id) {
        const fetchUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${this.apiKey}`;
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        return await pdfjsLib.getDocument(fetchUrl).promise;
    }

    async renderPage(num) {
        if (this.isRendering) return;
        this.isRendering = true;

        try {
            const page = await this.pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale: this.zoomScale * 1.5 });
            
            this.els.canvas.height = viewport.height;
            this.els.canvas.width = viewport.width;

            await page.render({
                canvasContext: this.els.ctx,
                viewport: viewport
            }).promise;

            this.pageNum = num;
            this.updatePageUI();
            this.saveToHistory();
        } catch (e) {
            console.error(e);
        } finally {
            this.isRendering = false;
        }
    }

    updatePageUI() {
        this.els.currentPageInput.value = this.pageNum;
        this.els.zoomLevel.innerText = `${Math.round(this.zoomScale * 100)}%`;
        
        document.getElementById('prev-btn').disabled = (this.pageNum <= 1);
        document.getElementById('next-btn').disabled = (this.pageNum >= this.pdfDoc.numPages);
    }

    changePage(delta) {
        const newPage = this.pageNum + delta;
        if (newPage >= 1 && newPage <= this.pdfDoc.numPages) {
            this.renderPage(newPage);
        }
    }

    goToPage(num) {
        if (num >= 1 && num <= this.pdfDoc.numPages) {
            this.renderPage(num);
        } else {
            this.els.currentPageInput.value = this.pageNum;
        }
    }

    adjustZoom(delta) {
        this.zoomScale = Math.min(Math.max(0.5, this.zoomScale + delta), 3.0);
        this.renderPage(this.pageNum);
    }

    saveToHistory() {
        this.storage.saveDocument({
            id: this.currentId,
            title: this.currentTitle,
            page: this.pageNum,
            zoom: this.zoomScale
        });
    }

    toggleSidebar() {
        this.els.sidebar.classList.toggle('active');
        if (this.els.sidebar.classList.contains('active')) {
            this.renderSidebar();
        }
    }

    renderSidebar() {
        const history = this.storage.getHistory();
        this.els.recentList.innerHTML = history.length ? '' : '<div style="padding: 24px; color: #5f6368; font-size: 13px;">No history yet</div>';
        
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'recent-item';
            div.innerHTML = `
                <span class="title">${item.title}</span>
                <span class="meta">Halaman ${item.page} • ${new Date(item.timestamp).toLocaleDateString()}</span>
            `;
            div.onclick = () => {
                this.loadDocument(item.id, item.page, item.zoom);
                this.toggleSidebar();
            };
            this.els.recentList.appendChild(div);
        });
    }

    handleManualLoad() {
        const val = document.getElementById('manual-url').value;
        const match = val.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            this.loadDocument(match[1]);
            document.getElementById('manual-url').value = '';
            this.toggleSidebar();
        } else {
            alert('URL Google Drive tidak valid.');
        }
    }

    downloadFile() {
        const url = `https://drive.google.com/uc?export=download&id=${this.currentId}`;
        window.open(url, '_blank');
    }

    showLoading(show) {
        this.els.globalLoading.classList.toggle('hidden', !show);
    }

    showError(msg) {
        document.getElementById('error-desc').innerText = msg;
        this.els.errorBox.classList.remove('hidden');
        this.els.canvas.classList.add('hidden');
    }

    hideError() {
        this.els.errorBox.classList.add('hidden');
        this.els.canvas.classList.remove('hidden');
    }
}

// Global Initialization
const viewer = new DriveViewer({
    apiKey: "AIzaSyDgGBbadC6-DUiC7iR_RQQ5OgstvFA3cJ8"
});

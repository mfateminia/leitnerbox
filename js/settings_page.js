class SettingsPage {
    constructor() {
        // DOM elements
        this.geminiKeyInput = document.getElementById('geminiKey');
        this.toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibility');
        this.backupBtn = document.getElementById('backupBtn');
        this.restoreBtn = document.getElementById('restoreBtn');
        this.restoreFileInput = document.getElementById('restoreFileInput');
        this.clearWordsBtn = document.getElementById('clearWordsBtn');
        this.clearParagraphsBtn = document.getElementById('clearParagraphsBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.statusMessage = document.getElementById('statusMessage');
        this.lastUpdated = document.getElementById('lastUpdated');

        // Stats elements
        this.totalWordsEl = document.getElementById('totalWords');
        this.totalParagraphsEl = document.getElementById('totalParagraphs');
        this.masteredWordsEl = document.getElementById('masteredWords');
        this.wordsForReviewEl = document.getElementById('wordsForReview');
        this.dbStatsEl = document.getElementById('dbStats');

        // Modal elements
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.confirmBtn = document.getElementById('confirmBtn');
        this.cancelBtn = document.getElementById('cancelBtn');

        // Database instances
        this.wordDB = new WordDB();
        this.paragraphsDB = new ParagraphsDB();

        // Pending confirmation action
        this.pendingAction = null;

        this.initializeEvents();
        this.loadSettings();
        this.loadDatabaseStats();
    }

    initializeEvents() {
        // API key visibility toggle
        this.toggleKeyVisibilityBtn.addEventListener('click', () => this.toggleKeyVisibility());

        // Backup and restore
        this.backupBtn.addEventListener('click', () => this.backupData());
        this.restoreBtn.addEventListener('click', () => this.restoreFileInput.click());
        this.restoreFileInput.addEventListener('change', (e) => this.handleRestoreFile(e));

        // Clear data buttons
        this.clearWordsBtn.addEventListener('click', () => {
            console.log('Clear words button clicked');
            this.clearWords();
        });
        this.clearParagraphsBtn.addEventListener('click', () => {
            console.log('Clear paragraphs button clicked');
            this.clearParagraphs();
        });
        this.clearAllBtn.addEventListener('click', () => {
            console.log('Clear all button clicked');
            this.clearAllData();
        });

        // Modal events
        this.confirmBtn.addEventListener('click', () => this.executeConfirmedAction());
        this.cancelBtn.addEventListener('click', () => this.closeConfirmModal());

        // Close modal when clicking outside
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) {
                this.closeConfirmModal();
            }
        });

        // Auto-save API key on blur
        this.geminiKeyInput.addEventListener('blur', () => this.saveGeminiKeyUpdate());
    }

    loadSettings() {
        // Load Gemini API key
        const geminiKey = localStorage.getItem('gemini_api_key');
        if (geminiKey) {
            this.geminiKeyInput.value = geminiKey;
        }
    }

    async loadDatabaseStats() {
        try {
            this.dbStatsEl.classList.add('loading-stats');

            // Initialize databases
            await this.wordDB.init();
            await this.paragraphsDB.init();

            // Get statistics
            const wordStats = await this.wordDB.getStatistics();
            const allParagraphs = await this.paragraphsDB.getAllParagraphs();
            const wordsDue = await this.wordDB.getWordsDueForReview();

            // Update UI
            this.updateStatElement(this.totalWordsEl, wordStats.total);
            this.updateStatElement(this.totalParagraphsEl, allParagraphs.length);
            this.updateStatElement(this.masteredWordsEl, wordStats.mastered);
            this.updateStatElement(this.wordsForReviewEl, wordsDue.length);

        } catch (error) {
            console.error('Error loading database stats:', error);
            this.showMessage('Error loading database statistics', 'error');
        } finally {
            this.dbStatsEl.classList.remove('loading-stats');
        }
    }

    updateStatElement(element, value) {
        element.textContent = value;
        element.classList.add('updated');
        setTimeout(() => element.classList.remove('updated'), 300);
    }

    toggleKeyVisibility() {
        const isPassword = this.geminiKeyInput.type === 'password';
        this.geminiKeyInput.type = isPassword ? 'text' : 'password';
        this.toggleKeyVisibilityBtn.textContent = isPassword ? '🙈' : '👁️';
    }

    saveGeminiKeyUpdate() {
        const geminiKey = this.geminiKeyInput.value.trim();
        
        if (geminiKey) {
            localStorage.setItem('gemini_api_key', geminiKey);
        } else {
            localStorage.removeItem('gemini_api_key');
        }

        this.showMessage('Settings saved successfully!', 'success');
    }

    async backupData() {
        try {
            this.backupBtn.classList.add('loading');
            this.backupBtn.textContent = 'Creating Backup...';

            // Initialize databases
            await this.wordDB.init();
            await this.paragraphsDB.init();

            // Get all data
            const words = await this.wordDB.getAllWords();
            const paragraphs = await this.paragraphsDB.getAllParagraphs();

            // Create backup object
            const backup = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                data: {
                    words: words,
                    paragraphs: paragraphs
                }
            };

            // Create and download file
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leitner-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showMessage(`Backup created successfully! ${words.length} words and ${paragraphs.length} paragraphs backed up.`, 'success');

        } catch (error) {
            console.error('Error creating backup:', error);
            this.showMessage('Error creating backup: ' + error.message, 'error');
        } finally {
            this.backupBtn.classList.remove('loading');
            this.backupBtn.textContent = '📁 Backup Data';
        }
    }

    async handleRestoreFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            // Validate backup structure
            if (!backup.data || !Array.isArray(backup.data.words) || !Array.isArray(backup.data.paragraphs)) {
                throw new Error('Invalid backup file format');
            }

            // Show confirmation
            this.confirmAction('restore', 'Restore Data', 
                `This will replace all current data with the backup data. The backup contains ${backup.data.words.length} words and ${backup.data.paragraphs.length} paragraphs. This action cannot be undone.`,
                () => this.restoreData(backup.data)
            );

        } catch (error) {
            console.error('Error reading backup file:', error);
            this.showMessage('Error reading backup file: ' + error.message, 'error');
        }

        // Reset file input
        event.target.value = '';
    }

    async restoreData(data) {
        try {
            this.showMessage('Restoring data...', 'info');

            // Initialize databases
            await this.wordDB.init();
            await this.paragraphsDB.init();

            // Clear existing data
            await this.clearAllData(false); // Don't show success message

            // Restore words
            for (const word of data.words) {
                // Remove the ID so it gets auto-generated
                const { id, ...wordData } = word;
                await this.wordDB.dbWrapper.write(wordData);
            }

            // Restore paragraphs
            for (const paragraph of data.paragraphs) {
                // Remove the ID so it gets auto-generated
                const { id, ...paragraphData } = paragraph;
                await this.paragraphsDB.dbWrapper.write(paragraphData);
            }

            this.showMessage(`Data restored successfully! ${data.words.length} words and ${data.paragraphs.length} paragraphs restored.`, 'success');
            await this.loadDatabaseStats();

        } catch (error) {
            console.error('Error restoring data:', error);
            this.showMessage('Error restoring data: ' + error.message, 'error');
        }
    }

    confirmAction(action, title, message, customAction = null) {
        this.pendingAction = customAction || action;
        this.confirmMessage.textContent = message;
        this.confirmModal.querySelector('.modal-title').textContent = title;
        this.confirmModal.style.display = 'block';
    }

    closeConfirmModal() {
        this.confirmModal.style.display = 'none';
        this.pendingAction = null;
    }

    async executeConfirmedAction() {
        console.log('Executing confirmed action:', this.pendingAction);
        
        if (!this.pendingAction) return;

        this.closeConfirmModal();

        if (typeof this.pendingAction === 'function') {
            await this.pendingAction();
            return;
        }

        switch (this.pendingAction) {
            case 'clearWords':
                console.log('Calling clearWords...');
                await this.clearWords();
                break;
            case 'clearParagraphs':
                console.log('Calling clearParagraphs...');
                await this.clearParagraphs();
                break;
            case 'clearAll':
                console.log('Calling clearAllData...');
                await this.clearAllData();
                break;
        }
    }

    async clearWords() {
        try {
            console.log('Starting clearWords...');
            await this.wordDB.init();
            
            // Get count before clearing
            const words = await this.wordDB.getAllWords();
            const wordCount = words.length;
            console.log(`Found ${wordCount} words to clear`);
            
            if (wordCount === 0) {
                this.showMessage('No words to clear!', 'info');
                await this.loadDatabaseStats();
                return;
            }
            
            // Clear all data (using the working approach from test)
            console.log('Attempting to clear words...');
            await this.wordDB.clearAllWords();
            console.log('Words clearing completed');
            
            // Small delay to ensure transactions complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify clearing worked
            const wordsAfter = await this.wordDB.getAllWords();
            console.log(`Words after clearing: ${wordsAfter.length}`);

            if (wordsAfter.length === 0) {
                this.showMessage(`Cleared ${wordCount} words successfully!`, 'success');
            } else {
                this.showMessage(`Partial clear: ${wordCount - wordsAfter.length}/${wordCount} words cleared. ${wordsAfter.length} remain.`, 'error');
            }
            
            await this.loadDatabaseStats();

        } catch (error) {
            console.error('Error clearing words:', error);
            this.showMessage('Error clearing words: ' + error.message, 'error');
        }
    }

    async clearParagraphs() {
        try {
            console.log('Starting clearParagraphs...');
            await this.paragraphsDB.init();
            
            // Get count before clearing
            const paragraphs = await this.paragraphsDB.getAllParagraphs();
            const paragraphCount = paragraphs.length;
            console.log(`Found ${paragraphCount} paragraphs to clear`);
            
            if (paragraphCount === 0) {
                this.showMessage('No paragraphs to clear!', 'info');
                await this.loadDatabaseStats();
                return;
            }
            
            // Clear all data (using the working approach from test)
            console.log('Attempting to clear paragraphs...');
            await this.paragraphsDB.clearAllParagraphs();
            console.log('Paragraphs clearing completed');
            
            // Small delay to ensure transactions complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify clearing worked
            const paragraphsAfter = await this.paragraphsDB.getAllParagraphs();
            console.log(`Paragraphs after clearing: ${paragraphsAfter.length}`);

            if (paragraphsAfter.length === 0) {
                this.showMessage(`Cleared ${paragraphCount} paragraphs successfully!`, 'success');
            } else {
                this.showMessage(`Partial clear: ${paragraphCount - paragraphsAfter.length}/${paragraphCount} paragraphs cleared. ${paragraphsAfter.length} remain.`, 'error');
            }
            
            await this.loadDatabaseStats();

        } catch (error) {
            console.error('Error clearing paragraphs:', error);
            this.showMessage('Error clearing paragraphs: ' + error.message, 'error');
        }
    }

    async clearAllData(showMessage = true) {
        try {
            console.log('Starting clearAllData...');
            await this.wordDB.init();
            await this.paragraphsDB.init();

            // Get counts before clearing
            const words = await this.wordDB.getAllWords();
            const paragraphs = await this.paragraphsDB.getAllParagraphs();
            const wordCount = words.length;
            const paragraphCount = paragraphs.length;
            
            console.log(`Clearing all data: ${wordCount} words and ${paragraphCount} paragraphs found.`);

            if (wordCount === 0 && paragraphCount === 0) {
                if (showMessage) {
                    this.showMessage('No data to clear!', 'info');
                }
                await this.loadDatabaseStats();
                return;
            }

            // Clear all data (using the working approach from test)
            console.log('Attempting to clear words...');
            await this.wordDB.clearAllWords();
            console.log('Words clearing completed');
            
            console.log('Attempting to clear paragraphs...');
            await this.paragraphsDB.clearAllParagraphs();
            console.log('Paragraphs clearing completed');
            
            // Small delay to ensure transactions complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get counts after clearing
            const wordsAfter = await this.wordDB.getAllWords();
            const paragraphsAfter = await this.paragraphsDB.getAllParagraphs();
            
            console.log(`After: ${wordsAfter.length} words, ${paragraphsAfter.length} paragraphs`);
            
            if (showMessage) {
                if (wordsAfter.length === 0 && paragraphsAfter.length === 0) {
                    this.showMessage(`Cleared all data successfully! ${wordCount} words and ${paragraphCount} paragraphs removed.`, 'success');
                } else {
                    this.showMessage(`Partial clear: ${wordCount - wordsAfter.length}/${wordCount} words and ${paragraphCount - paragraphsAfter.length}/${paragraphCount} paragraphs cleared.`, 'error');
                }
            }
            
            await this.loadDatabaseStats();

        } catch (error) {
            console.error('Error clearing all data:', error);
            this.showMessage('Error clearing all data: ' + error.message, 'error');
        }
    }

    showMessage(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';

        setTimeout(() => {
            this.statusMessage.style.display = 'none';
        }, 5000);
    }
}

// Initialize the settings page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsPage();
});

// Prevent zoom on double tap for mobile
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);
// Word List Page Functionality
class WordListPage {
    constructor() {
        this.wordDB = new WordDB();
        this.words = [];
        this.hiddenTranslations = false;
        this.revealedWords = new Set();
        this.currentEditWordId = null;
        this.currentDeleteWordId = null;
        
        this.init();
    }

    async init() {
        console.log('WordListPage: Initializing...');
        
        try {
            await this.wordDB.init();
            this.setupEventListeners();
            await this.loadWords();
            console.log('WordListPage: Initialization completed successfully');
        } catch (error) {
            console.error('WordListPage: Error during initialization:', error);
            this.showMessage('Error initializing word list page', 'error');
        }
    }

    setupEventListeners() {
        // Hide translations checkbox
        const hideTranslationsCheckbox = document.getElementById('hideTranslations');
        if (hideTranslationsCheckbox) {
            hideTranslationsCheckbox.addEventListener('change', (e) => {
                this.hiddenTranslations = e.target.checked;
                this.toggleTranslations();
            });
        }

        // Edit modal events
        this.setupEditModalEvents();
        
        // Delete modal events
        this.setupDeleteModalEvents();
    }

    setupEditModalEvents() {
        const editModal = document.getElementById('editModal');
        const closeEditModal = document.getElementById('closeEditModal');
        const cancelEdit = document.getElementById('cancelEdit');
        const saveEdit = document.getElementById('saveEdit');

        if (closeEditModal) {
            closeEditModal.addEventListener('click', () => this.closeEditModal());
        }

        if (cancelEdit) {
            cancelEdit.addEventListener('click', () => this.closeEditModal());
        }

        if (saveEdit) {
            saveEdit.addEventListener('click', () => this.saveWordEdit());
        }

        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) {
                    this.closeEditModal();
                }
            });
        }
    }

    setupDeleteModalEvents() {
        const deleteModal = document.getElementById('deleteModal');
        const closeDeleteModal = document.getElementById('closeDeleteModal');
        const cancelDelete = document.getElementById('cancelDelete');
        const confirmDelete = document.getElementById('confirmDelete');

        if (closeDeleteModal) {
            closeDeleteModal.addEventListener('click', () => this.closeDeleteModal());
        }

        if (cancelDelete) {
            cancelDelete.addEventListener('click', () => this.closeDeleteModal());
        }

        if (confirmDelete) {
            confirmDelete.addEventListener('click', () => this.confirmDeleteWord());
        }

        if (deleteModal) {
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) {
                    this.closeDeleteModal();
                }
            });
        }
    }

    async loadWords() {
        console.log('WordListPage: Loading words...');
        
        const loadingMessage = document.getElementById('loadingMessage');
        const wordListContainer = document.getElementById('wordListContainer');
        const noWordsMessage = document.getElementById('noWordsMessage');
        const wordStats = document.getElementById('wordStats');

        try {
            // Show loading state
            if (loadingMessage) loadingMessage.style.display = 'flex';
            if (wordListContainer) wordListContainer.style.display = 'none';
            if (noWordsMessage) noWordsMessage.style.display = 'none';

            // Get all words from database
            const allWords = await this.wordDB.getAllWords();
            
            if (allWords.length === 0) {
                // No words found
                if (loadingMessage) loadingMessage.style.display = 'none';
                if (noWordsMessage) noWordsMessage.style.display = 'flex';
                if (wordStats) wordStats.textContent = 'No words in database';
                return;
            }

            // Sort words by creation date (latest first)
            this.words = allWords.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB - dateA;
            });

            // Take first 100 words
            this.words = this.words.slice(0, 100);

            // Update stats
            if (wordStats) {
                const stats = await this.wordDB.getStatistics();
                wordStats.textContent = `Total: ${stats.total} | Active: ${stats.active} | Mastered: ${stats.mastered} | Showing: ${this.words.length}`;
            }

            // Render words
            this.renderWords();

            // Show word list
            if (loadingMessage) loadingMessage.style.display = 'none';
            if (wordListContainer) wordListContainer.style.display = 'block';

            console.log(`WordListPage: Loaded ${this.words.length} words`);

        } catch (error) {
            console.error('WordListPage: Error loading words:', error);
            if (loadingMessage) loadingMessage.style.display = 'none';
            this.showMessage('Error loading words', 'error');
        }
    }

    renderWords() {
        const wordList = document.getElementById('wordList');
        if (!wordList) return;

        wordList.innerHTML = '';

        this.words.forEach(word => {
            const wordItem = this.createWordItem(word);
            wordList.appendChild(wordItem);
        });
    }

    createWordItem(word) {
        const wordItem = document.createElement('div');
        wordItem.className = 'word-item';
        wordItem.dataset.wordId = word.id;

        // Add status classes
        if (word.is_mastered) {
            wordItem.classList.add('mastered');
        } else if (!word.last_reviewed_at) {
            wordItem.classList.add('new');
        }

        // Format creation date
        const createdDate = word.created_at ? new Date(word.created_at).toLocaleDateString() : 'Unknown';
        const reviewCount = word.count_of_successful_reviews || 0;

        wordItem.innerHTML = `
            <div class="word-content">
                <div class="word-text" onclick="wordListPage.toggleWordTranslation(${word.id})">${word.word}</div>
                <div class="word-translation ${this.hiddenTranslations ? 'hidden' : ''}">${word.translation}</div>
                <div class="word-meta">Added: ${createdDate} | Reviews: ${reviewCount}</div>
            </div>
            <div class="word-actions">
                <button class="action-btn edit-btn" onclick="wordListPage.editWord(${word.id})" title="Edit word">
                    ✏️
                </button>
                <button class="action-btn delete-btn" onclick="wordListPage.deleteWord(${word.id})" title="Delete word">
                    🗑️
                </button>
            </div>
        `;

        return wordItem;
    }

    toggleTranslations() {
        const translations = document.querySelectorAll('.word-translation');
        translations.forEach(translation => {
            if (this.hiddenTranslations) {
                translation.classList.add('hidden');
                translation.classList.remove('revealed');
            } else {
                translation.classList.remove('hidden');
                translation.classList.remove('revealed');
            }
        });

        // Clear revealed words when hiding all translations
        if (this.hiddenTranslations) {
            this.revealedWords.clear();
        }
    }

    toggleWordTranslation(wordId) {
        if (!this.hiddenTranslations) return;

        const wordItem = document.querySelector(`[data-word-id="${wordId}"]`);
        if (!wordItem) return;

        const translation = wordItem.querySelector('.word-translation');
        if (!translation) return;

        if (this.revealedWords.has(wordId)) {
            // Hide translation
            translation.classList.add('hidden');
            translation.classList.remove('revealed');
            this.revealedWords.delete(wordId);
        } else {
            // Reveal translation
            translation.classList.remove('hidden');
            translation.classList.add('revealed');
            this.revealedWords.add(wordId);
        }
    }

    editWord(wordId) {
        const word = this.words.find(w => w.id === wordId);
        if (!word) return;

        this.currentEditWordId = wordId;

        // Populate edit form
        const editWordText = document.getElementById('editWordText');
        const editWordTranslation = document.getElementById('editWordTranslation');

        if (editWordText) editWordText.value = word.word;
        if (editWordTranslation) editWordTranslation.value = word.translation;

        // Show edit modal
        const editModal = document.getElementById('editModal');
        if (editModal) {
            editModal.style.display = 'block';
        }
    }

    async saveWordEdit() {
        if (!this.currentEditWordId) return;

        const editWordText = document.getElementById('editWordText');
        const editWordTranslation = document.getElementById('editWordTranslation');

        if (!editWordText || !editWordTranslation) return;

        const newWord = editWordText.value.trim();
        const newTranslation = editWordTranslation.value.trim();

        if (!newWord || !newTranslation) {
            this.showMessage('Both word and translation are required', 'error');
            return;
        }

        try {
            // Get current word
            const currentWord = await this.wordDB.getWord(this.currentEditWordId);
            if (!currentWord) {
                this.showMessage('Word not found', 'error');
                return;
            }

            // Update word
            currentWord.word = newWord;
            currentWord.translation = newTranslation;

            await this.wordDB.updateWord(this.currentEditWordId, currentWord);

            // Update local array
            const wordIndex = this.words.findIndex(w => w.id === this.currentEditWordId);
            if (wordIndex !== -1) {
                this.words[wordIndex] = { ...currentWord };
            }

            // Re-render words
            this.renderWords();

            // Close modal
            this.closeEditModal();

            this.showMessage('Word updated successfully', 'success');

        } catch (error) {
            console.error('Error updating word:', error);
            this.showMessage('Error updating word', 'error');
        }
    }

    deleteWord(wordId) {
        const word = this.words.find(w => w.id === wordId);
        if (!word) return;

        this.currentDeleteWordId = wordId;

        // Populate delete preview
        const deleteWordPreview = document.getElementById('deleteWordPreview');
        const deleteTranslationPreview = document.getElementById('deleteTranslationPreview');

        if (deleteWordPreview) deleteWordPreview.textContent = word.word;
        if (deleteTranslationPreview) deleteTranslationPreview.textContent = word.translation;

        // Show delete modal
        const deleteModal = document.getElementById('deleteModal');
        if (deleteModal) {
            deleteModal.style.display = 'block';
        }
    }

    async confirmDeleteWord() {
        if (!this.currentDeleteWordId) return;

        try {
            // Delete from database
            await this.wordDB.deleteWord(this.currentDeleteWordId);

            // Remove from local array
            this.words = this.words.filter(w => w.id !== this.currentDeleteWordId);

            // Add animation to word item
            const wordItem = document.querySelector(`[data-word-id="${this.currentDeleteWordId}"]`);
            if (wordItem) {
                wordItem.classList.add('removing');
                setTimeout(() => {
                    // Re-render words after animation
                    this.renderWords();
                }, 300);
            } else {
                // Re-render immediately if no animation
                this.renderWords();
            }

            // Update stats
            const wordStats = document.getElementById('wordStats');
            if (wordStats) {
                const stats = await this.wordDB.getStatistics();
                wordStats.textContent = `Total: ${stats.total} | Active: ${stats.active} | Mastered: ${stats.mastered} | Showing: ${this.words.length}`;
            }

            // Close modal
            this.closeDeleteModal();

            this.showMessage('Word deleted successfully', 'success');

        } catch (error) {
            console.error('Error deleting word:', error);
            this.showMessage('Error deleting word', 'error');
        }
    }

    closeEditModal() {
        const editModal = document.getElementById('editModal');
        if (editModal) {
            editModal.style.display = 'none';
        }
        this.currentEditWordId = null;
    }

    closeDeleteModal() {
        const deleteModal = document.getElementById('deleteModal');
        if (deleteModal) {
            deleteModal.style.display = 'none';
        }
        this.currentDeleteWordId = null;
    }

    showMessage(message, type = 'info') {
        const resultMessage = document.getElementById('resultMessage');
        if (!resultMessage) return;

        resultMessage.textContent = message;
        resultMessage.className = `result-message ${type}`;
        resultMessage.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            resultMessage.style.display = 'none';
        }, 3000);
    }
}

// Initialize word list page when DOM is loaded
let wordListPage;

document.addEventListener('DOMContentLoaded', () => {
    wordListPage = new WordListPage();
});

// Also initialize if script loads after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        wordListPage = new WordListPage();
    });
} else {
    wordListPage = new WordListPage();
}
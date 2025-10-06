class WordReviewApp {
    constructor() {
        this.wordDB = new WordDB();
        this.allWords = []; // All words available for review
        this.currentWords = []; // Current batch of 5 words
        this.wordBatchIndex = 0; // Track which batch we're on
        this.matches = new Map(); // wordId -> translationElement
        this.correctMatches = 0;
        this.totalAttempts = 0;
        this.selectedWordForTouch = null; // For mobile touch interactions
        
        this.initializeElements();
        this.loadStatistics();
        this.autoStartReview(); // Auto-load words when page loads
    }

    initializeElements() {
        this.elements = {
            checkAnswersBtn: document.getElementById('checkAnswersBtn'),
            resetBtn: document.getElementById('resetBtn'),
            finishReviewBtn: document.getElementById('finishReviewBtn'),
            matchingArea: document.getElementById('matchingArea'),
            loadingMessage: document.getElementById('loadingMessage'),
            resultMessage: document.getElementById('resultMessage'),
            wordsContainer: document.getElementById('wordsContainer'),
            translationsContainer: document.getElementById('translationsContainer'),
            totalWords: document.getElementById('totalWords'),
            wordsReviewing: document.getElementById('wordsReviewing'),
            correctMatches: document.getElementById('correctMatches'),
            accuracy: document.getElementById('accuracy'),
            progressFill: document.getElementById('progressFill')
        };
    }

    async loadStatistics() {
        try {
            const stats = await this.wordDB.getStatistics();
            this.elements.totalWords.textContent = stats.total;
            this.elements.accuracy.textContent = stats.masteryRate + '%';
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    async autoStartReview() {
        try {
            this.elements.loadingMessage.style.display = 'block';
            
            // Get words due for review
            const wordsDue = await this.wordDB.getWordsDueForReview();
            
            if (wordsDue.length === 0) {
                // No words to review, redirect to paragraph review
                this.showResultMessage('No words are due for review today! Redirecting to paragraph review... 🎉', 'result-success');
                this.elements.loadingMessage.style.display = 'none';
                return;
            }

            // Store all words and start with first batch
            this.allWords = wordsDue;
            this.wordBatchIndex = 0;
            this.elements.wordsReviewing.textContent = this.allWords.length;
            
            this.loadNextBatch();
            
        } catch (error) {
            console.error('Error starting review:', error);
            this.showResultMessage('Error loading words for review.', 'result-incomplete');
            this.elements.loadingMessage.style.display = 'none';
        }
    }

    loadNextBatch() {
        // Get next batch of 5 words
        const startIndex = this.wordBatchIndex * 5;
        const endIndex = Math.min(startIndex + 5, this.allWords.length);
        this.currentWords = this.allWords.slice(startIndex, endIndex);
        
        if (this.currentWords.length === 0) {
            // No more words to review
            this.showResultMessage('All words have been reviewed! 🎉', 'result-success');
            this.elements.loadingMessage.style.display = 'none';
            this.elements.matchingArea.style.display = 'none';
            return;
        }
        
        this.setupMatchingExercise();
    }

    setupMatchingExercise() {
        this.elements.loadingMessage.style.display = 'none';
        this.elements.matchingArea.style.display = 'flex';
        
        this.matches.clear();
        this.correctMatches = 0;
        this.totalAttempts = 0;
        this.updateProgress();
        
        // Create shuffled arrays
        const words = [...this.currentWords];
        const translations = [...this.currentWords].sort(() => Math.random() - 0.5);
        
        // Render words
        this.elements.wordsContainer.innerHTML = '';
        words.forEach(word => {
            const wordElement = this.createWordElement(word);
            this.elements.wordsContainer.appendChild(wordElement);
        });
        
        // Render translations
        this.elements.translationsContainer.innerHTML = '';
        translations.forEach(word => {
            const translationElement = this.createTranslationElement(word);
            this.elements.translationsContainer.appendChild(translationElement);
        });
    }

    createWordElement(word) {
        const element = document.createElement('div');
        element.className = 'word-item';
        element.textContent = word.word;
        element.draggable = true;
        element.dataset.wordId = word.id;
        
        // Desktop drag and drop
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', word.id);
            element.classList.add('dragging');
        });
        
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
        });

        // Mobile touch support
        let selectedWord = null;
        
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (selectedWord) {
                selectedWord.classList.remove('selected');
            }
            selectedWord = element;
            element.classList.add('selected');
            
            // Store selected word for touch drop
            this.selectedWordForTouch = word.id;
        });

        element.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) { // Mobile/tablet
                e.preventDefault();
                if (selectedWord) {
                    selectedWord.classList.remove('selected');
                }
                selectedWord = element;
                element.classList.add('selected');
                this.selectedWordForTouch = word.id;
                
                // Show visual feedback
                document.querySelectorAll('.translation-item').forEach(trans => {
                    trans.classList.add('touch-target');
                });
            }
        });
        
        return element;
    }

    createTranslationElement(word) {
        const element = document.createElement('div');
        element.className = 'translation-item';
        element.textContent = word.translation;
        element.dataset.wordId = word.id;
        
        // Desktop drag and drop
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('drag-over');
        });
        
        element.addEventListener('dragleave', () => {
            element.classList.remove('drag-over');
        });
        
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            
            const draggedWordId = e.dataTransfer.getData('text/plain');
            this.handleDrop(draggedWordId, element);
        });

        // Mobile touch support
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.selectedWordForTouch) {
                this.handleDrop(this.selectedWordForTouch, element);
                this.clearTouchSelection();
            }
        });

        element.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && this.selectedWordForTouch) { // Mobile/tablet
                e.preventDefault();
                this.handleDrop(this.selectedWordForTouch, element);
                this.clearTouchSelection();
            }
        });
        
        return element;
    }

    async handleDrop(draggedWordId, translationElement) {
        // Remove previous match if exists
        const existingMatch = this.matches.get(draggedWordId);
        if (existingMatch) {
            existingMatch.classList.remove('matched');
        }
        
        // Clear any previous match for this translation
        for (const [wordId, element] of this.matches.entries()) {
            if (element === translationElement) {
                this.matches.delete(wordId);
                const wordElement = document.querySelector(`[data-word-id="${wordId}"]`);
                if (wordElement) {
                    wordElement.classList.remove('matched');
                }
                break;
            }
        }
        
        // Set new match
        this.matches.set(draggedWordId, translationElement);
        translationElement.classList.add('matched');
        
        const wordElement = document.querySelector(`[data-word-id="${draggedWordId}"]`);
        if (wordElement) {
            wordElement.classList.add('matched');
        }
        
        // Immediately check if match is correct and save to database
        const isCorrect = translationElement.dataset.wordId === draggedWordId;
        try {
            await this.wordDB.updateReview(parseInt(draggedWordId), isCorrect);
            
            // Visual feedback for correct/incorrect
            if (isCorrect) {
                wordElement.classList.add('correct');
                translationElement.classList.add('correct');
                this.correctMatches++;
                this.elements.correctMatches.textContent = this.correctMatches;
            } else {
                wordElement.classList.add('incorrect');
                translationElement.classList.add('incorrect');
            }
        } catch (error) {
            console.error('Error saving match result:', error);
        }
        
        this.updateProgress();
        
        // Check if all words in current batch are matched
        if (this.matches.size === this.currentWords.length) {
            setTimeout(() => this.completeBatch(), 1000); // Small delay to see results
        }
    }

    updateProgress() {
        const progress = (this.matches.size / this.currentWords.length) * 100;
        this.elements.progressFill.style.width = progress + '%';
        
        // Update accuracy
        const accuracy = this.currentWords.length > 0 ? Math.round((this.correctMatches / this.currentWords.length) * 100) : 0;
        this.elements.accuracy.textContent = accuracy + '%';
    }

    resetExercise() {
        this.matches.clear();
        this.correctMatches = 0;
        this.elements.correctMatches.textContent = '0';
        this.elements.resultMessage.style.display = 'none';
        this.elements.finishReviewBtn.style.display = 'none';
        this.clearTouchSelection();
        
        // Reset all styling and matches
        document.querySelectorAll('.word-item, .translation-item').forEach(el => {
            el.classList.remove('matched', 'incorrect', 'correct', 'selected', 'touch-target');
        });
        
        this.updateProgress();
    }

    clearTouchSelection() {
        this.selectedWordForTouch = null;
        document.querySelectorAll('.word-item').forEach(word => {
            word.classList.remove('selected');
        });
        document.querySelectorAll('.translation-item').forEach(trans => {
            trans.classList.remove('touch-target');
        });
    }

    completeBatch() {
        const correctCount = this.correctMatches;
        const totalCount = this.currentWords.length;
        
        this.showResultMessage(`Batch completed! ${correctCount}/${totalCount} correct matches.`, 
            correctCount === totalCount ? 'result-success' : 'result-incomplete');
        
        this.wordBatchIndex++;
        
        // Check if there are more words to review
        if (this.wordBatchIndex * 5 < this.allWords.length) {
            setTimeout(() => {
                this.elements.resultMessage.style.display = 'none';
                this.loadNextBatch();
            }, 2000);
        } else {
            // All words completed
            setTimeout(() => {
                this.showResultMessage('All words have been reviewed! 🎉', 'result-success');
                this.elements.matchingArea.style.display = 'none';
                this.elements.resetBtn.style.display = 'none';
                this.loadStatistics(); // Reload statistics
            }, 2000);
        }
    }

    async finishReview() {
        // This method is now mostly obsolete since we save immediately
        // but kept for compatibility
        this.showResultMessage('All reviews have been saved automatically!', 'result-success');
        await this.loadStatistics();
    }

    showResultMessage(message, className) {
        this.elements.resultMessage.textContent = message;
        this.elements.resultMessage.className = `result-message ${className}`;
        this.elements.resultMessage.style.display = 'block';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WordReviewApp();
});
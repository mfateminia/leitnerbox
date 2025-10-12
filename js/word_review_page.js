class WordReviewApp {
    constructor() {
        this.wordDB = new WordDB();
        this.allWords = []; // All words available for review
        this.currentWords = []; // Current batch of 5 words
        this.wordBatchIndex = 0; // Track which batch we're on
        this.matches = new Map(); // wordId -> translationElement
        this.correctMatches = 0;
        this.totalAttempts = 0;
        this.selectedWord = null; // Currently selected word
        this.selectedTranslation = null; // Currently selected translation
        
        // Letter arrangement exercise state
        this.matchingResults = new Map(); // wordId -> boolean (success/failure in matching)
        this.letterExerciseWords = []; // Words that passed matching stage
        this.reviewedWordsForLater = []; // Previously reviewed words that skip matching
        this.currentLetterWord = null;
        this.currentLetterIndex = 0;
        this.userWord = '';
        this.availableLetters = [];
        this.mistakes = 0;
        this.hintsUsed = 0;
        this.startTime = null; // When letter exercise started
        this.userWordHistory = []; // History for undo functionality
        
        this.initializeElements();
        this.setupEventListeners();
        // this.loadStatistics();
        this.autoStartReview(); // Auto-load words when page loads
    }

    setupEventListeners() {
        if (this.elements.hintBtn) {
            this.elements.hintBtn.addEventListener('click', () => this.giveHint());
        }
        if (this.elements.clearWordBtn) {
            this.elements.clearWordBtn.addEventListener('click', () => this.clearUserWord());
        }
        if (this.elements.undoBtn) {
            this.elements.undoBtn.addEventListener('click', () => this.undoLastLetter());
        }
    }

    initializeElements() {
        this.elements = {
            checkAnswersBtn: document.getElementById('checkAnswersBtn'),
            resetBtn: document.getElementById('resetBtn'),
            //finishReviewBtn: document.getElementById('finishReviewBtn'),
            matchingArea: document.getElementById('matchingArea'),
            loadingMessage: document.getElementById('loadingMessage'),
            resultMessage: document.getElementById('resultMessage'),
            wordsContainer: document.getElementById('wordsContainer'),
            translationsContainer: document.getElementById('translationsContainer'),
            // totalWords: document.getElementById('totalWords'),
            // wordsReviewing: document.getElementById('wordsReviewing'),
            // correctMatches: document.getElementById('correctMatches'),
            // accuracy: document.getElementById('accuracy'),
            // progressFill: document.getElementById('progressFill'),
            
            // Letter arrangement exercise elements
            letterExerciseArea: document.getElementById('letterExerciseArea'),
            translationDisplay: document.getElementById('translationDisplay'),
            lettersContainer: document.getElementById('lettersContainer'),
            userWordDisplay: document.getElementById('userWordDisplay'),
            hintBtn: document.getElementById('hintBtn'),
            clearWordBtn: document.getElementById('clearWordBtn'),
            undoBtn: document.getElementById('undoBtn'),
            letterProgress: document.getElementById('letterProgress'),
            letterResultMessage: document.getElementById('letterResultMessage')
        };
    }

    // async loadStatistics() {
    //     try {
    //         const stats = await this.wordDB.getStatistics();
    //         this.elements.totalWords.textContent = stats.total;
    //         this.elements.accuracy.textContent = stats.masteryRate + '%';
    //     } catch (error) {
    //         console.error('Error loading statistics:', error);
    //     }
    // }

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
            // this.elements.wordsReviewing.textContent = this.allWords.length;
            
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
            this.elements.letterExerciseArea.style.display = 'none';
            return;
        }
        
        // Reset display for new batch
        this.elements.letterExerciseArea.style.display = 'none';
        this.elements.letterResultMessage.style.display = 'none';
        
        // Separate first-time words from previously reviewed words
        const firstTimeWords = this.currentWords.filter(word => word.last_reviewed_at === null);
        const reviewedWords = this.currentWords.filter(word => word.last_reviewed_at !== null);
        
        if (firstTimeWords.length > 0) {
            // Start with matching exercise for first-time words
            this.currentWords = firstTimeWords;
            this.reviewedWordsForLater = reviewedWords; // Store for after matching
            this.setupMatchingExercise();
        } else {
            // All words have been reviewed before, go directly to letter arrangement
            this.letterExerciseWords = reviewedWords;
            this.currentLetterIndex = 0;
            // Mark all as "passed matching" since we're skipping it
            reviewedWords.forEach(word => {
                this.matchingResults.set(word.id, true);
            });
            this.elements.matchingArea.style.display = 'none';
            this.startLetterExercise();
        }
    }

    setupMatchingExercise() {
        this.elements.loadingMessage.style.display = 'none';
        this.elements.matchingArea.style.display = 'flex';
        this.elements.letterExerciseArea.style.display = 'none';
        
        this.matches.clear();
        this.correctMatches = 0;
        this.totalAttempts = 0;
        
        // Reset letter exercise state for new batch
        this.matchingResults.clear();
        this.letterExerciseWords = [];
        this.currentLetterIndex = 0;
        this.userWord = '';
        this.mistakes = 0;
        this.hintsUsed = 0;
        
        // this.updateProgress();
        
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
        element.dataset.wordId = word.id;
        
        element.addEventListener('click', (e) => {
            this.selectWord(element, word);
        });
        
        return element;
    }

    createTranslationElement(word) {
        const element = document.createElement('div');
        element.className = 'translation-item';
        element.textContent = word.translation;
        element.dataset.wordId = word.id;
        
        element.addEventListener('click', (e) => {
            this.selectTranslation(element, word);
        });
        
        return element;
    }

    selectWord(element, word) {
        // Clear previous word selection
        if (this.selectedWord) {
            this.selectedWord.classList.remove('selected');
        }
        
        // Select new word
        this.selectedWord = element;
        element.classList.add('selected');
        
        // Store word data
        this.selectedWordData = word;
        
        // Check if we can make a match
        this.checkForMatch();
    }

    selectTranslation(element, word) {
        // Clear previous translation selection
        if (this.selectedTranslation) {
            this.selectedTranslation.classList.remove('selected');
        }
        
        // Select new translation
        this.selectedTranslation = element;
        element.classList.add('selected');
        
        // Store translation data
        this.selectedTranslationData = word;
        
        // Check if we can make a match
        this.checkForMatch();
    }

    checkForMatch() {
        // If both word and translation are selected, create a match
        if (this.selectedWord && this.selectedTranslation) {
            this.createMatch(this.selectedWordData.id, this.selectedTranslation);
            
            // Clear selections
            this.selectedWord.classList.remove('selected');
            this.selectedTranslation.classList.remove('selected');
            this.selectedWord = null;
            this.selectedTranslation = null;
            this.selectedWordData = null;
            this.selectedTranslationData = null;
        }
    }
    async createMatch(draggedWordId, translationElement) {
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
        
        // Immediately check if match is correct and store result
        const wordIdStr = draggedWordId.toString();
        const translationIdStr = translationElement.dataset.wordId;
        const isCorrect = translationIdStr === wordIdStr;
        
        // Store matching result for later use
        this.matchingResults.set(parseInt(draggedWordId), isCorrect);
        
        // Visual feedback for correct/incorrect
        if (isCorrect) {
            wordElement.classList.add('correct');
            translationElement.classList.add('correct');
            this.correctMatches++;
            //this.elements.correctMatches.textContent = this.correctMatches;
        } else {
            wordElement.classList.add('incorrect');
            translationElement.classList.add('incorrect');
            
            // Move incorrect word to end of current batch for retry
            const incorrectWordIndex = this.currentWords.findIndex(w => w.id === parseInt(draggedWordId));
            if (incorrectWordIndex !== -1) {
                const incorrectWord = this.currentWords.splice(incorrectWordIndex, 1)[0];
                this.currentWords.push(incorrectWord);
                
                // Clear the incorrect match after a delay to show feedback
                setTimeout(() => {
                    this.matches.delete(draggedWordId);
                    wordElement.classList.remove('matched', 'incorrect');
                    translationElement.classList.remove('matched', 'incorrect');
                    
                    // Re-render the exercise with the updated word order
                    this.setupMatchingExercise();
                }, 2000);
                return; // Don't proceed with completion check yet
            }
        }
        
        // this.updateProgress();
        
        // Check if all words in current batch are matched
        if (this.matches.size === this.currentWords.length) {
            setTimeout(() => this.completeMatchingStage(), 1000); // Small delay to see results
        }
    }

    // updateProgress() {
    //     const progress = (this.matches.size / this.currentWords.length) * 100;
    //     this.elements.progressFill.style.width = progress + '%';
        
    //     // Update accuracy
    //     const accuracy = this.currentWords.length > 0 ? Math.round((this.correctMatches / this.currentWords.length) * 100) : 0;
    //     this.elements.accuracy.textContent = accuracy + '%';
    // }

    resetExercise() {
        this.matches.clear();
        this.correctMatches = 0;
        this.matchingResults.clear();
        this.letterExerciseWords = [];
        this.reviewedWordsForLater = [];
        this.currentLetterIndex = 0;
        this.userWord = '';
        this.mistakes = 0;
        this.hintsUsed = 0;
        this.userWordHistory = [];
        
        //this.elements.correctMatches.textContent = '0';
        this.elements.resultMessage.style.display = 'none';
        //this.elements.finishReviewBtn.style.display = 'none';
        this.elements.letterExerciseArea.style.display = 'none';
        this.elements.letterResultMessage.style.display = 'none';
        this.clearSelections();
        
        // Reset all styling and matches
        document.querySelectorAll('.word-item, .translation-item').forEach(el => {
            el.classList.remove('matched', 'incorrect', 'correct', 'selected');
        });
        
        // this.updateProgress();
    }

    clearSelections() {
        this.selectedWord = null;
        this.selectedTranslation = null;
        this.selectedWordData = null;
        this.selectedTranslationData = null;
        
        document.querySelectorAll('.word-item, .translation-item').forEach(item => {
            item.classList.remove('selected');
        });
    }

    completeMatchingStage() {
        const correctCount = this.correctMatches;
        const totalCount = this.currentWords.length;
        
        this.showResultMessage(`Matching completed! ${correctCount}/${totalCount} correct. Starting letter exercise...`, 'result-success');
        
        // Get words that passed the matching stage (only correct matches proceed)
        this.letterExerciseWords = this.currentWords.filter(word => 
            this.matchingResults.get(word.id) === true
        );
        
        // Add previously reviewed words that skipped matching to letter exercise
        if (this.reviewedWordsForLater.length > 0) {
            // Mark reviewed words as passed matching
            this.reviewedWordsForLater.forEach(word => {
                this.matchingResults.set(word.id, true);
            });
            this.letterExerciseWords = [...this.letterExerciseWords, ...this.reviewedWordsForLater];
            this.reviewedWordsForLater = []; // Clear the array
        }
        
        if (this.letterExerciseWords.length === 0) {
            // No words passed matching, all words need to be retried
            // Reset for another round of matching
            this.setupMatchingExercise();
            return;
        }
        
        // Start letter arrangement exercise
        setTimeout(() => {
            this.elements.matchingArea.style.display = 'none';
            this.startLetterExercise();
        }, 2000);
    }

    startLetterExercise() {
        if (this.currentLetterIndex >= this.letterExerciseWords.length) {
            // All letter exercises completed, save results and proceed
            this.completeLetterExercise();
            return;
        }
        
        this.currentLetterWord = this.letterExerciseWords[this.currentLetterIndex];
        this.userWord = '';
        this.mistakes = 0;
        this.hintsUsed = 0;
        
        this.setupLetterArrangement();
    }

    setupLetterArrangement() {
        this.elements.letterExerciseArea.style.display = 'block';
        this.elements.resultMessage.style.display = 'none';
        
        // Reset history and start timing
        this.userWordHistory = [];
        this.startTime = Date.now();
        
        // Display translation
        this.elements.translationDisplay.textContent = `English: "${this.currentLetterWord.translation}"`;
        
        // Create scrambled letters
        const letters = this.currentLetterWord.word.split('');
        this.availableLetters = [...letters].sort(() => Math.random() - 0.5);
        
        this.renderLetters();
        this.updateUserWordDisplay();
        this.updateLetterProgress();
    }

    renderLetters() {
        this.elements.lettersContainer.innerHTML = '';
        
        this.availableLetters.forEach((letter, index) => {
            const letterElement = document.createElement('div');
            letterElement.className = 'letter-item';
            letterElement.textContent = letter;
            letterElement.dataset.index = index;
            
            letterElement.addEventListener('click', () => {
                this.selectLetter(index);
            });
            
            this.elements.lettersContainer.appendChild(letterElement);
        });
    }

    selectLetter(index) {
        const letter = this.availableLetters[index];
        
        // Save current state for undo
        this.userWordHistory.push({
            userWord: this.userWord,
            availableLetters: [...this.availableLetters]
        });
        
        this.userWord += letter;
        
        // Remove letter from available letters
        this.availableLetters.splice(index, 1);
        
        this.renderLetters();
        this.updateUserWordDisplay();
        this.checkLetterCompletion();
    }

    updateUserWordDisplay() {
        this.elements.userWordDisplay.textContent = this.userWord || '(click letters to build word)';
    }

    updateLetterProgress() {
        const progress = (this.currentLetterIndex / this.letterExerciseWords.length) * 100;
        this.elements.letterProgress.style.width = progress + '%';
    }

    checkLetterCompletion() {
        if (this.availableLetters.length === 0) {
            // All letters used, check if word is correct
            this.evaluateLetterArrangement();
        }
    }

    evaluateLetterArrangement() {
        // Calculate time taken
        const endTime = Date.now();
        const timeTaken = endTime - this.startTime;
        const expectedTime = this.currentLetterWord.word.length * 2500; // 2.5s per letter
        const tookTooLong = timeTaken > expectedTime;
        
        const correctWord = this.currentLetterWord.word;
        const maxMistakes = Math.floor(correctWord.length * 0.25);
        const maxHints = Math.floor(correctWord.length * 0.25);
        
        // Calculate mistakes (Levenshtein distance-like approach)
        this.mistakes = this.calculateMistakes(correctWord, this.userWord);
        
        // Word is correct if: mistakes within limit, hints within limit, AND time within limit
        const isCorrect = this.mistakes <= maxMistakes && this.hintsUsed <= maxHints && !tookTooLong;
        const hasMistakes = this.mistakes > 0;
        
        if (isCorrect) {
            if (hasMistakes) {
                // Word is acceptable but has mistakes - show yellow warning
                this.elements.letterResultMessage.textContent = `Acceptable with mistakes. Correct word: "${correctWord}" ⚠️`;
                this.elements.letterResultMessage.className = 'result-message result-warning';
            } else {
                // Perfect match - show green success
                this.elements.letterResultMessage.textContent = `Perfect! "${correctWord}" ✅`;
                this.elements.letterResultMessage.className = 'result-message result-success';
            }
        } else {
            let reason = 'Incorrect.';
            if (tookTooLong) {
                const seconds = Math.round(timeTaken / 1000);
                const expectedSeconds = Math.round(expectedTime / 1000);
                reason = `Too slow (${seconds}s, expected ≤${expectedSeconds}s).`;
            }
            this.elements.letterResultMessage.textContent = `${reason} Correct word: "${correctWord}" ❌`;
            this.elements.letterResultMessage.className = 'result-message result-incomplete';
        }
        
        this.elements.letterResultMessage.style.display = 'block';
        
        if (isCorrect) {
            // Word passed - save to database
            const finalResult = this.matchingResults.get(this.currentLetterWord.id) && isCorrect;
            this.saveWordResult(this.currentLetterWord.id, finalResult);
            
            // Move to next word
            this.currentLetterIndex++;
        } else {
            // Word failed - move to end of queue for retry (don't save to DB yet)
            const failedWord = this.letterExerciseWords.splice(this.currentLetterIndex, 1)[0];
            this.letterExerciseWords.push(failedWord);
            // Don't increment currentLetterIndex - we'll retry the same position with next word
        }
        
        // Longer pause for words with mistakes or time issues so user can see the correct word
        const pauseDuration = (hasMistakes || !isCorrect || tookTooLong) ? 5000 : 2000;
        
        // Continue to next word or retry
        setTimeout(() => {
            this.elements.letterResultMessage.style.display = 'none';
            this.startLetterExercise();
        }, pauseDuration);
    }

    calculateMistakes(correct, user) {
        if (correct.length !== user.length) return Math.max(correct.length, user.length);
        
        let mistakes = 0;
        for (let i = 0; i < correct.length; i++) {
            if (correct[i] !== user[i]) {
                mistakes++;
            }
        }
        return mistakes;
    }

    async saveWordResult(wordId, isSuccess) {
        try {
            await this.wordDB.updateReview(wordId, isSuccess);
        } catch (error) {
            console.error('Error saving word result:', error);
        }
    }

    undoLastLetter() {
        if (this.userWordHistory.length === 0) {
            return; // Nothing to undo
        }
        
        // Restore previous state
        const lastState = this.userWordHistory.pop();
        this.userWord = lastState.userWord;
        this.availableLetters = lastState.availableLetters;
        
        this.renderLetters();
        this.updateUserWordDisplay();
    }

    giveHint() {
        if (this.hintsUsed >= Math.floor(this.currentLetterWord.word.length * 0.25)) {
            alert('Maximum hints used!');
            return;
        }
        
        const correctWord = this.currentLetterWord.word;
        const nextCorrectLetter = correctWord[this.userWord.length];
        
        // Find and auto-select the correct letter
        const letterIndex = this.availableLetters.findIndex(letter => letter === nextCorrectLetter);
        if (letterIndex !== -1) {
            this.selectLetter(letterIndex);
            this.hintsUsed++;
        }
    }

    clearUserWord() {
        // Return all letters to available pool
        this.availableLetters = [...this.currentLetterWord.word.split('')].sort(() => Math.random() - 0.5);
        this.userWord = '';
        this.userWordHistory = []; // Clear undo history
        this.renderLetters();
        this.updateUserWordDisplay();
    }

    completeLetterExercise() {
        // All words in batch completed both stages
        this.elements.letterExerciseArea.style.display = 'none';
        this.elements.letterResultMessage.style.display = 'none';
        this.completeBatch();
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
                // this.loadStatistics(); // Reload statistics
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
class ParagraphReviewApp {
    constructor() {
        this.paragraphDisplay = document.getElementById('paragraphDisplay');
        this.revealBtn = document.getElementById('revealBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.buttonContainer = document.getElementById('buttonContainer');
        this.statusMessage = document.getElementById('statusMessage');
        this.reviewStats = document.getElementById('reviewStats');
        
        this.paragraphsDB = new ParagraphsDB();
        this.reviewParagraphs = [];
        this.currentIndex = 0;
        this.currentParagraph = null;
        this.currentSelectedWords = new Set();
        this.clickedWords = new Set();
        this.isShowingTranslation = false;
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            await this.loadReviewParagraphs();
            this.initializeEvents();
            this.displayCurrentParagraph();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to load review paragraphs: ' + error.message);
        }
    }

    async loadReviewParagraphs() {
        this.reviewParagraphs = await this.paragraphsDB.getParagraphsDueForReview();
        
        // Check if no paragraphs available for review
        if (this.reviewParagraphs.length === 0) {
            this.showNoParagraphsAvailable();
            return;
        }
        
        // Sort by priority: never reviewed first, then by days since last review
        this.reviewParagraphs.sort((a, b) => {
            if (!a.last_reviewed_at && !b.last_reviewed_at) return 0;
            if (!a.last_reviewed_at) return -1;
            if (!b.last_reviewed_at) return 1;
            
            const aDate = new Date(a.last_reviewed_at);
            const bDate = new Date(b.last_reviewed_at);
            return aDate - bDate; // Oldest first
        });
        
        this.updateStats();
    }

    updateStats() {
        const total = this.reviewParagraphs.length;
        const remaining = total - this.currentIndex;
        this.reviewStats.textContent = `${remaining} of ${total} paragraphs remaining`;
    }

    initializeEvents() {
        this.revealBtn.addEventListener('click', () => this.handleReveal());
        this.nextBtn.addEventListener('click', () => this.handleNext());
    }

    displayCurrentParagraph() {
        if (this.currentIndex >= this.reviewParagraphs.length) {
            this.showCompletion();
            return;
        }

        this.currentParagraph = this.reviewParagraphs[this.currentIndex];
        this.currentSelectedWords.clear();
        this.clickedWords.clear();
        this.isShowingTranslation = false;
        
        this.createClickableParagraph(this.currentParagraph);
        this.buttonContainer.style.display = 'flex';
        this.revealBtn.textContent = 'Reveal';
        this.updateStats();
    }

    createClickableParagraph(paragraph) {
        const text = paragraph.paragraph;
        
        // Words are now stored as original words (with Swedish characters), so normalize for comparison
        this.currentSelectedWords = new Set(
            paragraph.words.map(word => word.replace(/[^\w\såäöÅÄÖ]/g, '').toLowerCase())
        );
        
        console.log('Stored words from database:', paragraph.words);
        console.log('Normalized selected words set:', this.currentSelectedWords);
        
        // Split text into words while preserving punctuation and spaces
        const tokens = text.match(/\S+|\s+/g) || [];
        
        this.paragraphDisplay.innerHTML = '';
        
        tokens.forEach((token) => {
            if (token.trim()) {
                // It's a word
                const wordSpan = document.createElement('span');
                wordSpan.className = 'word';
                wordSpan.textContent = token;
                
                // Clean the token to match normalized format (preserve Swedish letters)
                const cleanWord = token.replace(/[^\w\såäöÅÄÖ]/g, '').toLowerCase();
                
                console.log(`Checking token: "${token}" -> clean: "${cleanWord}", isSelected: ${this.currentSelectedWords.has(cleanWord)}`);
                
                if (this.currentSelectedWords.has(cleanWord)) {
                    wordSpan.classList.add('marked');
                    console.log(`MARKED: "${token}"`);
                }
                
                wordSpan.addEventListener('click', () => this.toggleWord(cleanWord, wordSpan));
                this.paragraphDisplay.appendChild(wordSpan);
            } else {
                // It's whitespace
                const textNode = document.createTextNode(token);
                this.paragraphDisplay.appendChild(textNode);
            }
        });
    }

    handleReveal() {
        if (!this.currentParagraph) return;
        
        if (this.isShowingTranslation) {
            // Show original paragraph
            this.createClickableParagraph(this.currentParagraph);
            this.revealBtn.textContent = 'Reveal';
            this.isShowingTranslation = false;
        } else {
            // Show translation
            this.showTranslation();
            this.revealBtn.textContent = 'Original';
            this.isShowingTranslation = true;
        }
    }
    
    showTranslation() {
        if (!this.currentParagraph || !this.currentParagraph.translation) {
            this.paragraphDisplay.innerHTML = '<div class="translation-text">Translation not available</div>';
            return;
        }
        
        const translation = this.currentParagraph.translation;
        this.paragraphDisplay.innerHTML = '';
        
        // Show translated text
        const translationDiv = document.createElement('div');
        translationDiv.className = 'translation-text';
        translationDiv.innerHTML = translation.text;
        this.paragraphDisplay.appendChild(translationDiv);
        
        // Show word explanations
        if (translation.words && Array.isArray(translation.words) && translation.words.length > 0) {
            const wordsDiv = document.createElement('div');
            wordsDiv.className = 'translation-words';
            
            const wordsTitle = document.createElement('h3');
            wordsTitle.textContent = 'Word Explanations:';
            wordsDiv.appendChild(wordsTitle);
            
            translation.words.forEach(wordObj => {
                const wordItem = document.createElement('div');
                wordItem.className = 'word-explanation';
                wordItem.innerHTML = `<strong>${wordObj.word}:</strong> ${wordObj.translation}`;
                wordsDiv.appendChild(wordItem);
            });
            
            this.paragraphDisplay.appendChild(wordsDiv);
        }
    }

    toggleWord(word, element) {
        if (this.isShowingTranslation) {
            // Don't allow word toggling when showing translation
            return;
        }
        
        if (!word) return; // Skip if no actual word content
        
        if (this.clickedWords.has(word)) {
            // Remove from clicked words
            this.clickedWords.delete(word);
            element.classList.remove('clicked');
        } else {
            // Add to clicked words
            this.clickedWords.add(word);
            element.classList.add('clicked');
        }
        
        this.showMessage(`Clicked words: ${this.clickedWords.size}`, 'info');
    }

    async handleNext() {
        if (!this.currentParagraph) return;

        this.nextBtn.classList.add('loading');
        this.nextBtn.disabled = true;

        try {
            // Update the words array based on user interactions
            await this.updateWordsArray();
            
            // Determine if review was successful (user clicked at least one word)
            const wasSuccessful = this.clickedWords.size > 0;
            
            // Update the review information
            await this.paragraphsDB.updateReview(this.currentParagraph.id, wasSuccessful);
            
            const message = wasSuccessful 
                ? `Review completed successfully! (${this.clickedWords.size} words clicked)`
                : 'Review completed (no words clicked)';
            
            this.showMessage(message, wasSuccessful ? 'success' : 'info');
            
            // Move to next paragraph
            setTimeout(() => {
                this.currentIndex++;
                this.displayCurrentParagraph();
            }, 1000);
            
        } catch (error) {
            console.error('Error updating review:', error);
            this.showMessage('Error updating review: ' + error.message, 'error');
        } finally {
            this.nextBtn.classList.remove('loading');
            this.nextBtn.disabled = false;
        }
    }

    async updateWordsArray() {
        // Get current words array
        let currentWords = new Set(this.currentParagraph.words.map(word => word.toLowerCase()));
        
        // Get all words from the paragraph (for potential additions)
        const allWordsInParagraph = new Set();
        const tokens = this.currentParagraph.paragraph.match(/\S+/g) || [];
        tokens.forEach(token => {
            const cleanWord = token.replace(/[^\w\såäöÅÄÖ]/g, '').toLowerCase();
            if (cleanWord) {
                allWordsInParagraph.add(cleanWord);
            }
        });
        
        // Process clicked words (red words)
        this.clickedWords.forEach(clickedWord => {
            if (currentWords.has(clickedWord)) {
                // Red word that was previously blue - remove it
                currentWords.delete(clickedWord);
            } else if (allWordsInParagraph.has(clickedWord)) {
                // Red word that wasn't previously marked - add it
                currentWords.add(clickedWord);
            }
        });
        
        // Update the paragraph with new words array
        const updatedParagraph = {
            ...this.currentParagraph,
            words: Array.from(currentWords)
        };
        
        await this.paragraphsDB.updateParagraph(this.currentParagraph.id, updatedParagraph);
        
        // Update local reference
        this.currentParagraph.words = updatedParagraph.words;
    }

    showCompletion() {
        this.paragraphDisplay.innerHTML = `
            <div class="completion-message">
                <div class="emoji">🎉</div>
                <div>Hurray, nothing more to review!</div>
                <div style="font-size: 16px; color: #666; margin-top: 10px;">
                    You've completed all your reviews for today! Redirecting to add new content...
                </div>
            </div>
        `;
        this.buttonContainer.style.display = 'none';
        this.reviewStats.textContent = 'All reviews completed!';
        
        // Wait 3 seconds then redirect to text_loader.html
        setTimeout(() => {
            window.location.href = 'text_loader.html';
        }, 1000);
    }

    showNoParagraphsAvailable() {
        this.paragraphDisplay.innerHTML = `
            <div class="completion-message">
                <div class="emoji">📚</div>
                <div>No paragraphs available for review!</div>
                <div style="font-size: 16px; color: #666; margin-top: 10px;">
                    Add some new content to start learning. Redirecting...
                </div>
            </div>
        `;
        this.buttonContainer.style.display = 'none';
        this.reviewStats.textContent = 'No paragraphs to review';
        
        // Wait 3 seconds then redirect to text_loader.html
        setTimeout(() => {
            window.location.href = 'text_loader.html';
        }, 3000);
    }

    showError(message) {
        this.paragraphDisplay.innerHTML = `
            <div class="completion-message">
                <div class="emoji">❌</div>
                <div style="color: #ff6b6b;">${message}</div>
            </div>
        `;
        this.buttonContainer.style.display = 'none';
    }

    showMessage(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.opacity = '1';
        
        setTimeout(() => {
            this.statusMessage.style.opacity = '0';
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ParagraphReviewApp();
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
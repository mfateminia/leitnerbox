class ParagraphReviewApp {
    constructor() {
        this.paragraphDisplay = document.getElementById('paragraphDisplay');
        this.revealBtn = document.getElementById('revealBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.buttonContainer = document.getElementById('buttonContainer');
        this.statusMessage = document.getElementById('statusMessage');
        this.reviewStats = document.getElementById('reviewStats');
        
        this.paragraphsDB = new ParagraphsDB();
        this.wordDB = new WordDB(); // Add WordDB instance
        this.reviewParagraphs = [];
        this.currentIndex = 0;
        this.currentParagraph = null;
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
        this.isShowingTranslation = false;
        
        // Simply display the paragraph text without word selection
        this.paragraphDisplay.innerHTML = `<div class="paragraph-text">${this.currentParagraph.paragraph}</div>`;
        this.buttonContainer.style.display = 'flex';
        this.revealBtn.textContent = 'Reveal';
        this.updateStats();
    }



    async handleReveal() {
        if (!this.currentParagraph) return;
        
        if (this.isShowingTranslation) {
            // Show original paragraph
            this.paragraphDisplay.innerHTML = `<div class="paragraph-text">${this.currentParagraph.paragraph}</div>`;
            this.revealBtn.textContent = 'Reveal';
            this.isShowingTranslation = false;
        } else {
            // Show translation
            await this.showTranslation();
            this.revealBtn.textContent = 'Original';
            this.isShowingTranslation = true;
        }
    }
    
    async showTranslation() {
        if (!this.currentParagraph || !this.currentParagraph.translated_paragraph) {
            this.paragraphDisplay.innerHTML = '<div class="translation-text">Translation not available</div>';
            return;
        }
        
        this.paragraphDisplay.innerHTML = '';
        
        // Show translated text
        const translationDiv = document.createElement('div');
        translationDiv.className = 'translation-text';
        translationDiv.innerHTML = this.currentParagraph.translated_paragraph;
        this.paragraphDisplay.appendChild(translationDiv);
        
        // Show expression explanations - fetch from word_db instead of paragraph
        try {
            const associatedWords = await this.wordDB.getWordsByParagraphId(this.currentParagraph.id);
            
            if (associatedWords && associatedWords.length > 0) {
                const expressionsDiv = document.createElement('div');
                expressionsDiv.className = 'translation-words';

                const expressionsTitle = document.createElement('h3');
                expressionsTitle.textContent = 'Expression Explanations:';
                expressionsDiv.appendChild(expressionsTitle);

                associatedWords.forEach(wordData => {
                    const expressionItem = document.createElement('div');
                    expressionItem.className = 'phrase-explanation';
                    expressionItem.innerHTML = `<strong>${wordData.word}:</strong> ${wordData.translation}`;
                    expressionsDiv.appendChild(expressionItem);
                });

                this.paragraphDisplay.appendChild(expressionsDiv);
            }
        } catch (error) {
            console.error('Error loading associated words:', error);
            // Continue without expressions if there's an error
        }
    }

    async handleNext() {
        if (!this.currentParagraph) return;

        this.nextBtn.classList.add('loading');
        this.nextBtn.disabled = true;

        try {
            // Simply mark the paragraph as reviewed (always successful since no word selection)
            await this.paragraphsDB.updateReview(this.currentParagraph.id, true);
            
            this.showMessage('Review completed!', 'success');
            
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
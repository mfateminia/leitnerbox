class ParagraphLearningApp {
    constructor() {
        this.textInput = document.getElementById('textInput');
        this.textDisplay = document.getElementById('textDisplay');
        this.clearBtn = document.getElementById('clearBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.workspaceBtn = document.getElementById('workspaceBtn');
        this.statusMessage = document.getElementById('statusMessage');

        // Workspace modal elements
        this.workspaceModal = document.getElementById('workspaceModal');
        this.workspaceTextarea = document.getElementById('workspaceTextarea');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.workspaceClearBtn = document.getElementById('workspaceClearBtn');
        this.moveChunkBtn = document.getElementById('moveChunkBtn');

        // Overview modal elements
        this.overviewModal = document.getElementById('overviewModal');
        this.closeOverviewModalBtn = document.getElementById('closeOverviewModalBtn');
        this.overviewCloseBtn = document.getElementById('overviewCloseBtn');
        this.overviewParagraph = document.getElementById('overviewParagraph');
        this.overviewTranslation = document.getElementById('overviewTranslation');
        this.overviewWords = document.getElementById('overviewWords');
        this.revealTranslationBtn = document.getElementById('revealTranslationBtn');

        this.selectedWords = [];
        this.originalText = '';
        this.currentMode = 'input'; // 'input' or 'selection'

        this.paragraphsDB = new ParagraphsDB();
        this.geminiAI = new GeminiAI(this.getGeminiKey());
        this.initializeEvents();
        this.loadWorkspaceFromStorage();
    }

    initializeEvents() {
        this.clearBtn.addEventListener('click', () => this.handleClear());
        this.nextBtn.addEventListener('click', () => this.handleNext());
        this.workspaceBtn.addEventListener('click', () => this.openWorkspaceModal());

        // Workspace modal events
        this.closeModalBtn.addEventListener('click', () => this.closeWorkspaceModal());
        this.workspaceClearBtn.addEventListener('click', () => this.clearWorkspace());
        this.moveChunkBtn.addEventListener('click', () => this.moveChunk());
        this.workspaceTextarea.addEventListener('input', () => this.saveWorkspaceToStorage());

        // Close modal when clicking outside
        this.workspaceModal.addEventListener('click', (e) => {
            if (e.target === this.workspaceModal) {
                this.closeWorkspaceModal();
            }
        });

        // Overview modal events
        this.closeOverviewModalBtn.addEventListener('click', () => this.closeOverviewModal());
        this.overviewCloseBtn.addEventListener('click', () => this.closeOverviewModal());
        this.revealTranslationBtn.addEventListener('click', () => this.revealTranslation());
        this.overviewModal.addEventListener('click', (e) => {
            if (e.target === this.overviewModal) {
                this.closeOverviewModal();
            }
        });

        // Auto-resize textarea and check button state
        this.textInput.addEventListener('input', () => {
            this.autoResize();
            this.updateNextButtonState();
        });

        // Initial button state check
        this.updateNextButtonState();
    }

    getGeminiKey() {
        const key = localStorage.getItem('gemini_api_key');
        if (!key) {
            let userInput = prompt("Get your Gemini API key from https://aistudio.google.com/api-keys");
            if (userInput !== null) {
                localStorage.setItem('gemini_api_key', userInput);
            }
        }
        return key;
    }

    // Workspace modal methods
    openWorkspaceModal() {
        this.workspaceModal.style.display = 'block';
        this.workspaceTextarea.focus();
    }

    closeWorkspaceModal() {
        this.workspaceModal.style.display = 'none';
    }

    clearWorkspace() {
        this.workspaceTextarea.value = '';
        this.saveWorkspaceToStorage();
        this.showMessage('Workspace cleared!', 'info');
    }

    moveChunk() {
        const workspaceContent = this.workspaceTextarea.value.trim();
        if (!workspaceContent) {
            this.showMessage('Workspace is empty!', 'error');
            return;
        }

        // Find approximately 40 words, but end at sentence boundary
        const chunk = this.extractChunk(workspaceContent);
        if (!chunk) {
            this.showMessage('Could not find a suitable chunk to move!', 'error');
            return;
        }

        // Remove chunk from workspace
        const remainingContent = workspaceContent.substring(chunk.length).trim();
        this.workspaceTextarea.value = remainingContent;
        this.saveWorkspaceToStorage();

        // Add chunk to main textbox
        const currentText = this.textInput.value.trim();
        const newText = currentText ? currentText + '\n\n' + chunk : chunk;
        this.textInput.value = newText;
        this.autoResize();
        this.updateNextButtonState();

        this.showMessage(`Moved chunk (${chunk.split(/\s+/).length} words) to main text!`, 'success');
        this.closeWorkspaceModal();
    }

    extractChunk(text, targetWords = 40) {
        const words = text.split(/\s+/);
        if (words.length <= targetWords) {
            return text.replace(/\n/g, ' ').trim(); // Return entire text, remove newlines
        }

        // Find the best sentence ending near the target word count
        let bestEnd = targetWords;
        let searchRange = Math.min(15, Math.floor(words.length / 4)); // Search within 15 words or 25% of text

        // Look for sentence endings around the target position (only dots)
        for (let i = Math.max(20, targetWords - searchRange); i <= Math.min(words.length - 1, targetWords + searchRange); i++) {
            const word = words[i];
            // Check if word ends with a dot (only dots count as sentence endings)
            if (/\.$/.test(word.trim())) {
                bestEnd = i + 1;
                break;
            }
        }

        // If no sentence ending found, use target word count
        return words.slice(0, bestEnd).join(' ').replace(/\n/g, ' ').trim();
    }

    loadWorkspaceFromStorage() {
        const savedWorkspace = localStorage.getItem('workspace');
        if (savedWorkspace) {
            this.workspaceTextarea.value = savedWorkspace;
        }
    }

    saveWorkspaceToStorage() {
        localStorage.setItem('workspace', this.workspaceTextarea.value);
    }

    // Overview modal methods
    showOverviewModal(paragraphData, aiResponse) {
        // Populate the modal with data
        this.overviewParagraph.textContent = paragraphData.paragraph;
        
        // Reset translation state (hide translation, show reveal button)
        this.overviewTranslation.textContent = 'Click "Reveal" to see the translation';
        this.overviewTranslation.className = 'overview-text hidden-translation';
        this.revealTranslationBtn.style.display = 'inline-block';
        this.revealTranslationBtn.textContent = 'Reveal';
        
        // Store the translation for later reveal
        this.currentTranslation = aiResponse.translated_paragraph;
        
        // Clear previous words
        this.overviewWords.innerHTML = '';
        
        // Add word pairs
        aiResponse.translated_words.forEach(wordData => {
            const wordPair = document.createElement('div');
            wordPair.className = 'word-pair';
            
            const original = document.createElement('span');
            original.className = 'word-original';
            original.textContent = wordData.word;
            
            const translation = document.createElement('span');
            translation.className = 'word-translation';
            translation.textContent = wordData.translation;
            
            wordPair.appendChild(original);
            wordPair.appendChild(translation);
            this.overviewWords.appendChild(wordPair);
        });
        
        // Show the modal
        this.overviewModal.style.display = 'block';
    }
    
    revealTranslation() {
        if (this.overviewTranslation.classList.contains('hidden-translation')) {
            // Reveal the translation
            this.overviewTranslation.textContent = this.currentTranslation;
            this.overviewTranslation.classList.remove('hidden-translation');
            this.revealTranslationBtn.textContent = 'Hide';
        } else {
            // Hide the translation
            this.overviewTranslation.textContent = 'Click "Reveal" to see the translation';
            this.overviewTranslation.classList.add('hidden-translation');
            this.revealTranslationBtn.textContent = 'Reveal';
        }
    }
    
    closeOverviewModal() {
        this.overviewModal.style.display = 'none';
    }

    autoResize() {
        this.textInput.style.height = 'auto';
        this.textInput.style.height = this.textInput.scrollHeight + 'px';
    }

    updateNextButtonState() {
        if (this.currentMode === 'input') {
            const hasContent = this.textInput.value.trim().length > 0;
            this.nextBtn.disabled = !hasContent;
        }
    }

    showMessage(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';

        setTimeout(() => {
            this.statusMessage.style.display = 'none';
        }, 3000);
    }

    handleClear() {
        if (this.currentMode === 'input') {
            this.textInput.value = '';
            this.textInput.focus();
        } else {
            // Reset to input mode
            this.currentMode = 'input';
            this.selectedWords = [];
            this.originalText = '';
            this.textInput.style.display = 'block';
            this.textDisplay.style.display = 'none';
            this.textInput.value = '';
            this.textInput.focus();
            this.nextBtn.textContent = 'Next';
        }
        this.updateNextButtonState();
        this.showMessage('Cleared!', 'info');
    }

    async handleNext() {
        if (this.currentMode === 'input') {
            this.handleFirstNext();
        } else {
            await this.handleSaveToDatabase();
        }
    }

    handleFirstNext() {
        const text = this.textInput.value.trim();

        if (!text) {
            this.showMessage('Please enter some text first!', 'error');
            return;
        }

        this.originalText = text;
        this.currentMode = 'selection';

        // Hide textarea and show text display
        this.textInput.style.display = 'none';
        this.textDisplay.style.display = 'block';

        // Convert text to clickable words
        this.createClickableWords(text);

        // Change button text
        this.nextBtn.textContent = 'Save to Database';

        this.showMessage('Click on words to select them. Click again to deselect.', 'info');
    }

    createClickableWords(text) {
        // Split text into words while preserving punctuation and spaces
        const tokens = text.match(/\S+|\s+/g) || [];

        this.textDisplay.innerHTML = '';

        tokens.forEach((token, index) => {
            if (token.trim()) {
                // It's a word
                const wordSpan = document.createElement('span');
                wordSpan.className = 'word';
                wordSpan.textContent = token;
                wordSpan.addEventListener('click', () => this.toggleWord(token, wordSpan));
                this.textDisplay.appendChild(wordSpan);
            } else {
                // It's whitespace
                const textNode = document.createTextNode(token);
                this.textDisplay.appendChild(textNode);
            }
        });
    }

    toggleWord(word, element) {
        // Remove only punctuation, preserve Swedish letters (å, ä, ö) and other letters
        const originalWord = word.replace(/[^\w\såäöÅÄÖ]/g, '');
        const cleanWordForComparison = originalWord.toLowerCase();

        if (!cleanWordForComparison) return; // Skip if no actual word content

        // Find if we already have this word (compare using cleaned version)
        const existingIndex = this.selectedWords.findIndex(selectedWord =>
            selectedWord.replace(/[^\w\såäöÅÄÖ]/g, '').toLowerCase() === cleanWordForComparison
        );

        if (existingIndex === -1) {
            // Add the original word (with Swedish characters preserved)
            this.selectedWords.push(originalWord);
            element.classList.add('selected');
        } else {
            // Remove word
            this.selectedWords.splice(existingIndex, 1);
            element.classList.remove('selected');
        }

        console.log(`Selected word: "${originalWord}" (from "${word}")`);
        this.showMessage(`Selected words: ${this.selectedWords.length}`, 'info');
    }

    resetWorkspace() {
        // Reset to input mode
        this.currentMode = 'input';
        this.selectedWords = [];
        this.originalText = '';
        this.textInput.style.display = 'block';
        this.textDisplay.style.display = 'none';
        this.textInput.value = '';
        this.nextBtn.textContent = 'Next';
        this.updateNextButtonState();
        this.textInput.focus();
    }

    async getTranslationFromGemini(paragraph, words) {
        const wordsString = words.join(', ');

        const prompt = `Input:

paragraph: ${paragraph}
words: ${wordsString}

Output JSON format:

{
"corrected_paragraph": "...",
"selected_words": ["...", "...", ...],
"translated_paragraph": "...",
"translated_words": [
{"word": "lemma form of the word...", "translation": "english translation of the lemma form..."},
...
]
}

Instructions:

If there is a grammar or spelling mistake in the paragraph, correct it. the corrected_paragraph must always contain the correct version.

If the user selected parts of a phrase as a word, correct it to the full phrase in both corrected_words and translated_words.

Translate the paragraph to English.

For each word, provide a short meaning and its base form.

Only return valid JSON, no extra text.

Example Input:

paragraph: "Jag gick till affären och köpte en äpple, till och med fast jag inte var hungrig."
words: ["affären", "köpte", "med"]

Example Output:

{
"corrected_paragraph": "Jag gick till affären och köpte ett äpple, till och med fast jag inte var hungrig.",
"corrected_words": ["affären", "köpte", "till och med"],
"translated_paragraph": "I went to the store and bought an apple, even though I wasn’t hungry",
"translated_words": [
{"word": "affär", "translation": "store"},
{"word": "att köpa", "translation": "to buy"},
{"word": "till och med", "translation": "'even' or 'even though'"}
]
}`;

        const response = await this.geminiAI.generateContent(prompt);

        // Extract text from Gemini response
        const content = response.candidates[0].content.parts[0].text;

        // Parse JSON response
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(content);
        } catch (parseError) {
            // If direct parsing fails, try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedResponse = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Failed to parse JSON response from Gemini. Response: ' + content);
            }
        }

        // Validate response structure
        if (!parsedResponse.corrected_paragraph ||
             !parsedResponse.translated_paragraph ||
              !Array.isArray(parsedResponse.translated_words)) {
            throw new Error('Invalid response structure from Gemini API');
        }

        return parsedResponse;
    }

    async handleSaveToDatabase() {
        if (this.selectedWords.length === 0) {
            this.showMessage('Please select at least one word!', 'error');
            return;
        }

        // Show loading state
        this.nextBtn.classList.add('loading');
        this.nextBtn.disabled = true;
        this.nextBtn.textContent = 'Translating...';

        try {
            // Get translation from Gemini AI
            const uniqueWords = [...new Set(this.selectedWords)];
            const aiResponse = await this.getTranslationFromGemini(this.originalText, uniqueWords);
            const { corrected_paragraph, ...translationObject } = aiResponse;
            console.log('Gemini AI response:', aiResponse);
            const paragraphData = {
                paragraph: corrected_paragraph,
                translation: translationObject,
                words: uniqueWords
            };

            this.nextBtn.textContent = 'Saving to database...';
            await this.paragraphsDB.addParagraph(paragraphData);

            this.showMessage(`Successfully saved with translation! Selected ${this.selectedWords.length} words.`, 'success');

            // Show overview modal with the saved data
            this.showOverviewModal(paragraphData, aiResponse);

            // Reset the workspace immediately
            this.resetWorkspace();
            this.nextBtn.textContent = 'Next';

        } catch (error) {
            console.error('Error processing paragraph:', error);
            this.showMessage('Error: ' + error.message, 'error');
        } finally {
            // Remove loading state
            this.nextBtn.classList.remove('loading');
            this.nextBtn.disabled = false;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ParagraphLearningApp();
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
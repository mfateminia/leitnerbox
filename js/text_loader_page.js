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
        this.workspacePasteBtn = document.getElementById('workspacePasteBtn');
        this.moveChunkBtn = document.getElementById('moveChunkBtn');

        // Overview modal elements
        this.overviewModal = document.getElementById('overviewModal');
        this.closeOverviewModalBtn = document.getElementById('closeOverviewModalBtn');
        this.overviewCloseBtn = document.getElementById('overviewCloseBtn');
        this.overviewSaveBtn = document.getElementById('overviewSaveBtn');
        this.overviewParagraph = document.getElementById('overviewParagraph');
        this.overviewTranslation = document.getElementById('overviewTranslation');
        this.overviewWords = document.getElementById('overviewWords');
        this.revealTranslationBtn = document.getElementById('revealTranslationBtn');

        this.paragraphsDB = new ParagraphsDB();
        this.geminiAI = new GeminiAI(this.getGeminiKey());
        
        // Pending data for overview modal
        this.pendingParagraphData = null;
        this.pendingAiResponse = null;
        
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
        this.workspacePasteBtn.addEventListener('click', () => this.pasteToWorkspace());
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
        this.overviewSaveBtn.addEventListener('click', () => this.saveToDatabase());
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
    }

    closeWorkspaceModal() {
        this.workspaceModal.style.display = 'none';
    }

    clearWorkspace() {
        this.workspaceTextarea.value = '';
        this.saveWorkspaceToStorage();
        this.showMessage('Workspace cleared!', 'info');
    }

    async pasteToWorkspace() {
        try {
            // Check if clipboard API is available
            if (!navigator.clipboard) {
                throw new Error('Clipboard API not available');
            }

            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText.trim()) {
                this.showMessage('Clipboard is empty!', 'error');
                return;
            }

            // Add clipboard content to workspace (append if there's existing content)
            const currentContent = this.workspaceTextarea.value.trim();
            const newContent = currentContent ? currentContent + '\n\n' + clipboardText : clipboardText;
            this.workspaceTextarea.value = newContent;
            this.saveWorkspaceToStorage();
            
            this.showMessage('Pasted content to workspace!', 'success');
        } catch (error) {
            console.error('Failed to paste from clipboard:', error);
            this.showMessage('Failed to paste from clipboard. Make sure your browser supports clipboard access.', 'error');
        }
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
        this.textInput.blur(); // Remove focus to prevent mobile zoom
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
        
        // Clear previous phrases
        this.overviewWords.innerHTML = '';
        
        // Add phrase pairs with remove functionality
        aiResponse.phrases.forEach((phraseData, index) => {
            const phrasePair = document.createElement('div');
            phrasePair.className = 'word-pair removable';
            phrasePair.dataset.phraseIndex = index;
            
            const originalPhrase = document.createElement('span');
            originalPhrase.className = 'word-original';
            originalPhrase.textContent = phraseData.phrase;
            
            const translatedPhrase = document.createElement('span');
            translatedPhrase.className = 'word-translation';
            translatedPhrase.textContent = phraseData.translation;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-phrase-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove this phrase';
            removeBtn.addEventListener('click', () => this.removePhrase(index));
            
            phrasePair.appendChild(originalPhrase);
            phrasePair.appendChild(translatedPhrase);
            phrasePair.appendChild(removeBtn);
            this.overviewWords.appendChild(phrasePair);
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

    removePhrase(phraseIndex) {
        // Remove phrase from the data
        this.pendingAiResponse.phrases.splice(phraseIndex, 1);
        this.pendingParagraphData.phrases.splice(phraseIndex, 1);
        
        // Refresh the modal display
        this.showOverviewModal(this.pendingParagraphData, this.pendingAiResponse);
        
        this.showMessage(`Phrase removed. ${this.pendingAiResponse.phrases.length} phrases remaining.`, 'info');
    }

    async saveToDatabase() {
        if (!this.pendingParagraphData || !this.pendingAiResponse) {
            this.showMessage('No data to save!', 'error');
            return;
        }

        // Show loading state on the save button
        const saveBtn = document.getElementById('overviewSaveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            // Save to database
            await this.paragraphsDB.addParagraph(this.pendingParagraphData);

            this.showMessage(`Successfully saved paragraph with ${this.pendingParagraphData.phrases.length} phrases!`, 'success');

            // Reset the workspace and close modal
            this.resetWorkspace();
            this.closeOverviewModal();
            
            // Clear pending data
            this.pendingParagraphData = null;
            this.pendingAiResponse = null;

        } catch (error) {
            console.error('Error saving to database:', error);
            this.showMessage('Error saving to database: ' + error.message, 'error');
        } finally {
            // Remove loading state
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
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
        const userConfirmed = confirm("Are you sure?");

        if (!userConfirmed) {
            return;
        }
        if (this.currentMode === 'input') {
            this.textInput.value = '';
        } else {
            // Reset to input mode
            this.currentMode = 'input';
            this.selectedWords = [];
            this.originalText = '';
            this.textInput.style.display = 'block';
            this.textDisplay.style.display = 'none';
            this.textInput.value = '';
            this.nextBtn.textContent = 'Next';
        }
        this.updateNextButtonState();
        this.showMessage('Cleared!', 'info');
    }

    async handleNext() {
        await this.handleSaveToDatabase();
    }







    resetWorkspace() {
        this.textInput.value = '';
        this.updateNextButtonState();
        // Clear any pending data
        this.pendingParagraphData = null;
        this.pendingAiResponse = null;
    }

    async getTranslationFromGemini(paragraph) {
        const prompt = `
You are a swedish language learning assistant. Given the swedish paragraph below:

Input paragraph: ${paragraph}

respond with this output in JSON format:

{
"corrected_paragraph": "If there is a grammar or spelling mistake in the paragraph, correct it. the corrected_paragraph must always contain the correct version.",
"translated_paragraph": "provide the english translation of the entire paragraph here...",
"phrases": [
{"phrase": "important phrase or word", "translation": "english translation of the phrase or word..."},
...
]
}

Instructions:
the "phrases" array should contain the most important words and/or phrases that are useful for language learners to study.

Only return valid JSON, no extra text.

Example Input: Sverig är en vackert land med många sjöar och skogar. Det är känt för sin natur och sina midnattssol.

Example Output JSON format:
{
"corrected_paragraph": "Sverige är ett vackert land med många sjöar och skogar. Det är känt för sin natur och sin midnattssol.",
"translated_paragraph": "Sweden is a beautiful country with many lakes and forests. It is known for its nature and its midnight sun.",
"phrases": [
{"phrase": "vackert land", "translation": "beautiful country"},
{"phrase": "många sjöar", "translation": "many lakes"},
{"phrase": "skogar", "translation": "forests"},
{"phrase": "känt för sin natur", "translation": "known for its nature"},
{"phrase": "midnattssol", "translation": "midnight sun"}
]
`;

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
              !Array.isArray(parsedResponse.phrases)) {
            throw new Error('Invalid response structure from Gemini API');
        }

        return parsedResponse;
    }

    async handleSaveToDatabase() {
        const text = this.textInput.value.trim();

        if (!text) {
            this.showMessage('Please enter some text first!', 'error');
            return;
        }

        // Show loading state
        this.nextBtn.classList.add('loading');
        this.nextBtn.disabled = true;
        this.nextBtn.textContent = 'Translating...';

        try {
            // Get translation from Gemini AI
            const aiResponse = await this.getTranslationFromGemini(text);
            console.log('Gemini AI response:', aiResponse);
            
            const paragraphData = {
                paragraph: aiResponse.corrected_paragraph,
                translated_paragraph: aiResponse.translated_paragraph,
                phrases: aiResponse.phrases
            };

            // Store data for later saving
            this.pendingParagraphData = paragraphData;
            this.pendingAiResponse = aiResponse;

            this.showMessage(`Translation complete! Found ${aiResponse.phrases.length} phrases. Review and save below.`, 'success');

            // Show overview modal without saving to database yet
            this.showOverviewModal(paragraphData, aiResponse);

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
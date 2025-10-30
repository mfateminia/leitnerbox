class ParagraphLearningApp {
    constructor() {
        this.textInput = document.getElementById('textInput');
        this.richTextInput = document.getElementById('richTextInput');
        this.textDisplay = document.getElementById('textDisplay');
        this.clearBtn = document.getElementById('clearBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.workspaceBtn = document.getElementById('workspaceBtn');
        this.evaluateFullBtn = document.getElementById('evaluateFullBtn');
        this.statusMessage = document.getElementById('statusMessage');
        this.normalModeBtn = document.getElementById('normalModeBtn');
        this.trackModeBtn = document.getElementById('trackModeBtn');

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
        this.paragraphData = null;
        
        // Mode state
        this.currentMode = 'reading'; // 'reading' or 'writing'
        this.processedText = []; // Array of processed sentence objects
        this.isProcessing = false;
        this.originalText = ''; // Store original text without annotations
        
        this.initializeEvents();
        this.loadWorkspaceFromStorage();
    }

    initializeEvents() {
        this.clearBtn.addEventListener('click', () => this.handleClear());
        this.nextBtn.addEventListener('click', () => this.handleNext());
        this.workspaceBtn.addEventListener('click', () => this.openWorkspaceModal());
        this.evaluateFullBtn.addEventListener('click', () => this.evaluateFullText());
        
        // Mode toggle events
        this.normalModeBtn.addEventListener('click', () => this.switchMode('reading'));
        this.trackModeBtn.addEventListener('click', () => this.switchMode('writing'));

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
        
        // Rich text input handler for writing mode
        this.richTextInput.addEventListener('input', () => {
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

    // Mode switching
    switchMode(mode) {
        if (this.currentMode === mode) return;
        
        this.currentMode = mode;
        
        // Update button states
        if (mode === 'reading') {
            this.normalModeBtn.classList.add('active');
            this.trackModeBtn.classList.remove('active');
            this.evaluateFullBtn.style.display = 'none';
            this.workspaceBtn.style.display = 'inline-block';
            document.querySelector('.container').classList.remove('writing-mode');
            this.textInput.placeholder = 'Enter your paragraph here...';
        } else {
            this.trackModeBtn.classList.add('active');
            this.normalModeBtn.classList.remove('active');
            this.evaluateFullBtn.style.display = 'inline-block';
            this.workspaceBtn.style.display = 'none';
            document.querySelector('.container').classList.add('writing-mode');
            this.textInput.placeholder = 'Type or paste your text...';
            // Make rich text editable when entering writing mode
            this.richTextInput.contentEditable = 'true';
            this.richTextInput.style.cursor = 'text';
        }
        
        // Reset state
        this.processedText = [];
        this.originalText = '';
        
        this.showMessage(`Switched to ${mode} mode`, 'info');
    }

    // Get plain text from rich text editor
    getPlainText() {
        // If we have original text stored, return that (without annotations)
        // Otherwise extract from the contenteditable div
        if (this.originalText) {
            return this.originalText;
        }
        return this.richTextInput.textContent || '';
    }
    
    // Set the original plain text (before any annotations)
    setOriginalText(text) {
        this.originalText = text;
    }
    
    // Evaluate full text at once
    async evaluateFullText() {
        // Get the current text from the rich text editor
        const currentText = (this.richTextInput.textContent || '').trim();
        
        if (!currentText) {
            this.showMessage('Please enter some text first!', 'error');
            return;
        }
        
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processedText = [];
        
        // Store the original text (before annotations)
        this.setOriginalText(currentText);
        
        // Update button state
        this.evaluateFullBtn.disabled = true;
        this.evaluateFullBtn.textContent = 'Assessing...';
        
        try {
            this.showMessage('⏳ Evaluating text...', 'info');
            
            // Single call to Gemini for the entire text (use original text)
            const result = await this.evaluateWriting(this.originalText);
            
            // Store the result
            this.processedText = [{
                original: this.originalText,
                corrected: result.corrected_text,
                errors: result.errors
            }];
            
            // Apply all corrections to rich text editor
            this.applyCorrectionsToRichText();
            
            // Make rich text editor readonly
            this.richTextInput.contentEditable = 'false';
            this.richTextInput.style.cursor = 'default';
            
            // Keep Evaluate button disabled but change text back, enable Next button
            this.evaluateFullBtn.textContent = 'Assess';
            this.nextBtn.disabled = false;
            
            this.showMessage(`Successfully evaluated! Found ${result.errors.length} errors. Click "Next" to continue.`, 'success');
            
        } catch (error) {
            console.error('Error evaluating full text:', error);
            this.showMessage('Error: ' + error.message, 'error');
            // Re-enable evaluate button on error
            this.evaluateFullBtn.disabled = false;
            this.evaluateFullBtn.textContent = 'Assess';
        } finally {
            this.isProcessing = false;
        }
    }

    // Normalize text for consistent processing
    normalizeText(text) {
        // Convert to Unicode NFC form
        let normalized = text.normalize('NFC');
        
        // Replace CRLF with LF
        normalized = normalized.replace(/\r\n/g, '\n');
        
        // Optionally remove zero-width characters (but keep them mapped for restoration)
        // For now, we'll keep the text as-is to maintain positions
        
        return normalized;
    }
    
    // Find all occurrences of a word in text with context matching
    findWordPositions(normalizedText, wordToFind, contextBefore = '', contextAfter = '') {
        const positions = [];
        
        // Escape special regex characters in the word
        const escapedWord = wordToFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Create regex with word boundaries
        const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        
        let match;
        while ((match = wordRegex.exec(normalizedText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            
            // If context is provided, verify it matches
            if (contextBefore || contextAfter) {
                const actualBefore = normalizedText.substring(Math.max(0, start - 20), start);
                const actualAfter = normalizedText.substring(end, Math.min(normalizedText.length, end + 20));
                
                const beforeMatches = !contextBefore || actualBefore.includes(contextBefore);
                const afterMatches = !contextAfter || actualAfter.includes(contextAfter);
                
                if (beforeMatches && afterMatches) {
                    positions.push({ start, end, matchedText: match[0] });
                }
            } else {
                positions.push({ start, end, matchedText: match[0] });
            }
        }
        
        return positions;
    }
    
    // Call Gemini AI to evaluate text and return structured response
    async evaluateWriting(text) {
        const prompt = `Analyze this Swedish text for errors (grammar, spelling, style):

Text: "${text}"

Return ONLY valid JSON in this exact format:
{
  "errors": [
    {
      "word": "<the exact incorrect word or phrase from the text>",
      "suggestion": "<the corrected version>",
      "type": "grammar|spelling|style",
      "context_before": "<2-3 words that appear immediately before this word>",
      "context_after": "<2-3 words that appear immediately after this word>"
    }
  ],
  "corrected_text": "<full corrected text>"
}

If no errors, return: {"errors": [], "corrected_text": "${text}"}

IMPORTANT: 
- "word" must be the EXACT word/phrase as it appears in the text (preserve case, spacing)
- "context_before" and "context_after" help locate the word if it appears multiple times
- Do NOT include character positions or indexes
- Be precise with the context strings

Example:
Input: "jag hetar ali jag bor i sverige"
Output: {
  "errors": [
    {"word": "jag", "suggestion": "Jag", "type": "grammar", "context_before": "", "context_after": "hetar ali"},
    {"word": "hetar", "suggestion": "heter", "type": "spelling", "context_before": "jag", "context_after": "ali jag"}
  ],
  "corrected_text": "Jag heter Ali. Jag bor i Sverige."
}

Return ONLY the JSON, no other text.`;

        const response = await this.geminiAI.generateContent(prompt);
        const content = response.candidates[0].content.parts[0].text;
        
        // Extract JSON from response
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(content);
        } catch (parseError) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedResponse = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Failed to parse JSON response from Gemini');
            }
        }
        
        // Normalize the input text
        const normalizedText = this.normalizeText(text);
        
        // Convert AI response to position-based errors
        const positionedErrors = [];
        
        for (const error of parsedResponse.errors || []) {
            // Find positions of this word using context
            const positions = this.findWordPositions(
                normalizedText,
                error.word,
                error.context_before || '',
                error.context_after || ''
            );
            
            if (positions.length === 0) {
                // Fallback: try without context
                const fallbackPositions = this.findWordPositions(normalizedText, error.word);
                
                if (fallbackPositions.length > 0) {
                    console.warn(`Word "${error.word}" found without context. Using first occurrence.`);
                    const pos = fallbackPositions[0];
                    positionedErrors.push({
                        original: pos.matchedText,
                        correction: error.suggestion,
                        type: error.type,
                        start: pos.start,
                        end: pos.end
                    });
                } else {
                    console.warn(`Word "${error.word}" not found in text. Skipping.`);
                }
            } else if (positions.length === 1) {
                // Single match - use it
                const pos = positions[0];
                positionedErrors.push({
                    original: pos.matchedText,
                    correction: error.suggestion,
                    type: error.type,
                    start: pos.start,
                    end: pos.end
                });
            } else {
                // Multiple matches with context - use the first one
                // In a more sophisticated system, we could ask the user or use more context
                console.warn(`Multiple matches for "${error.word}". Using first match with context.`);
                const pos = positions[0];
                positionedErrors.push({
                    original: pos.matchedText,
                    correction: error.suggestion,
                    type: error.type,
                    start: pos.start,
                    end: pos.end
                });
            }
        }
        
        // Validate positions
        for (const error of positionedErrors) {
            const extracted = normalizedText.substring(error.start, error.end);
            if (extracted.toLowerCase() !== error.original.toLowerCase()) {
                console.error(`Position validation failed for "${error.original}". Got "${extracted}" at position ${error.start}-${error.end}`);
            }
        }
        
        return {
            errors: positionedErrors,
            corrected_text: parsedResponse.corrected_text
        };
    }

    // Apply corrections directly to the rich text editor with HTML formatting
    applyCorrectionsToRichText() {
        if (this.processedText.length === 0) return;
        
        const textData = this.processedText[0];
        const html = textData.errors.length === 0 
            ? textData.original 
            : this.applySentenceCorrectionsHTML(textData.original, textData.errors);
        
        this.richTextInput.innerHTML = html;
    }

    // Apply corrections with HTML formatting
    applySentenceCorrectionsHTML(original, errors) {
        if (!errors || errors.length === 0) return original;
        
        const sortedErrors = [...errors].sort((a, b) => a.start - b.start);
        let html = '';
        let lastIndex = 0;
        
        for (const error of sortedErrors) {
            // Validate and skip invalid errors
            if (error.start === undefined || error.end === undefined || 
                error.start < 0 || error.end > original.length || 
                error.start >= error.end || error.start < lastIndex) {
                continue;
            }
            
            // Add text before error
            if (error.start > lastIndex) {
                html += original.substring(lastIndex, error.start);
            }
            
            // Add error with strikethrough and correction in green
            const errorText = original.substring(error.start, error.end);
            html += `<span class="error-word">${errorText}</span> <span class="correction-word">${error.correction}</span>`;
            
            lastIndex = error.end;
        }
        
        // Add remaining text
        if (lastIndex < original.length) {
            html += original.substring(lastIndex);
        }
        
        return html;
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
    showOverviewModal(paragraphData) {
        // Populate the modal with data
        this.overviewParagraph.textContent = paragraphData.paragraph;
        
        // Reset translation state (hide translation, show reveal button)
        this.overviewTranslation.textContent = 'Click "Reveal" to see the translation';
        this.overviewTranslation.className = 'overview-text hidden-translation';
        this.revealTranslationBtn.style.display = 'inline-block';
        this.revealTranslationBtn.textContent = 'Reveal';
        
        // Store the translation for later reveal
        this.currentTranslation = paragraphData.translated_paragraph;
        
        // Initialize selected expressions array
        this.selectedExpressions = [];
        
        // Clear previous expressions
        this.overviewWords.innerHTML = '';
        
        // Add expression pairs with add/remove functionality (none selected by default)
        paragraphData.expressions.forEach((expressionObj, index) => {
            const expressionPair = document.createElement('div');
            expressionPair.className = 'word-pair selectable';
            expressionPair.dataset.expressionIndex = index;
            
            // Create content wrapper for the text
            const wordContent = document.createElement('div');
            wordContent.className = 'word-content';
            
            const originalExpression = document.createElement('span');
            originalExpression.className = 'word-original';
            originalExpression.textContent = expressionObj.expression;
            
            const translatedExpression = document.createElement('span');
            translatedExpression.className = 'word-translation';
            translatedExpression.textContent = expressionObj.translation;
            
            const addBtn = document.createElement('button');
            addBtn.className = 'add-phrase-btn';
            addBtn.innerHTML = '+';
            addBtn.title = 'Add this phrase to learn';
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleExpression(index);
            });
            
            // Also allow clicking the entire expression to toggle
            expressionPair.addEventListener('click', () => {
                this.toggleExpression(index);
            });
            
            // Append text elements to content wrapper
            wordContent.appendChild(originalExpression);
            wordContent.appendChild(translatedExpression);
            
            // Append content and button to expression pair
            expressionPair.appendChild(wordContent);
            expressionPair.appendChild(addBtn);
            this.overviewWords.appendChild(expressionPair);
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

    toggleExpression(expressionIndex) {
        const expressionPair = document.querySelector(`[data-expression-index="${expressionIndex}"]`);
        const button = expressionPair.querySelector('.add-phrase-btn, .remove-phrase-btn');
        
        if (this.selectedExpressions.includes(expressionIndex)) {
            // Remove from selected
            this.selectedExpressions = this.selectedExpressions.filter(idx => idx !== expressionIndex);
            button.className = 'add-phrase-btn';
            button.innerHTML = '+';
            button.title = 'Add this phrase to learn';
            this.showMessage(`Expression removed. ${this.selectedExpressions.length} expressions selected.`, 'info');
        } else {
            // Add to selected
            this.selectedExpressions.push(expressionIndex);
            button.className = 'remove-phrase-btn';
            button.innerHTML = '&times;';
            button.title = 'Remove this phrase';
            this.showMessage(`Expression added. ${this.selectedExpressions.length} expressions selected.`, 'info');
        }
    }

    // Legacy method - no longer needed, kept for compatibility
    removeExpression(expressionIndex) {
        this.toggleExpression(expressionIndex);
    }

    async saveToDatabase() {
        if (!this.paragraphData) {
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
            // Check if any expressions are selected
            if (!this.selectedExpressions || this.selectedExpressions.length === 0) {
                this.showMessage('Please select at least one expression to learn!', 'error');
                return;
            }

            // Create a copy of paragraph data with only selected expressions
            const selectedExpressionsData = this.selectedExpressions.map(index => this.paragraphData.expressions[index]);
            const paragraphToSave = {
                ...this.paragraphData,
                expressions: selectedExpressionsData
            };

            // Save to database
            await this.paragraphsDB.addParagraph(paragraphToSave);

            this.showMessage(`Successfully saved paragraph with ${selectedExpressionsData.length} expressions!`, 'success');

            // Reset the workspace and close modal
            this.resetWorkspace();
            this.closeOverviewModal();
            
            // Clear pending data
            this.paragraphData = null;
            this.selectedExpressions = [];

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
        if (this.currentMode === 'reading') {
            this.nextBtn.disabled = this.textInput.value.trim().length === 0;
        } else if (this.currentMode === 'writing') {
            this.nextBtn.disabled = true;
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

    resetWorkspace() {
        this.textInput.value = '';
        this.updateNextButtonState();
        this.paragraphData = null;
    }

    handleClear() {
        const userConfirmed = confirm("Are you sure?");
        if (!userConfirmed) return;
        
        if (this.currentMode === 'writing') {
            this.richTextInput.innerHTML = '';
            this.richTextInput.contentEditable = 'true';
            this.richTextInput.style.cursor = 'text';
            this.processedText = [];
            this.originalText = '';
            this.evaluateFullBtn.disabled = false;
            this.evaluateFullBtn.textContent = 'Assess';
            this.nextBtn.disabled = true;
        } else {
            this.textInput.value = '';
        }
        
        this.updateNextButtonState();
        this.showMessage('Cleared!', 'info');
    }

    async getVocabularyFromCorrection(userText, correctedText) {
        const prompt = `You are a Swedish language tutor.  
The user provides a Swedish text they wrote (which may contain errors) and a corrected version of that text.

Your task:
1. Provide an English translation of the corrected text.
2. Identify only the words or phrases that differ between the user text and the corrected text.
3. For each, provide:
   - \`word\`: the LEMMA (base form) of the correct Swedish word or phrase
     * If it's a noun: use singular form (e.g., "hus" not "husen")
     * If it's a verb: use infinitive form (e.g., "vara" not "var")
     * If it's an adjective: use base form (e.g., "vacker" not "vackert")
   - \`meaning\`: ONLY the English translation of the lemma form, no explanations or context

Return your answer strictly in JSON format with the structure:
{
  "translation": "English translation of the corrected text",
  "vocabulary": [
    { "word": "lemma form", "meaning": "translation only" },
    ...
  ]
}

Example:
User text: "jag såg många husen igår"
Correct text: "jag såg många hus igår"
Output: {
  "translation": "I saw many houses yesterday",
  "vocabulary": [
    { "word": "hus", "meaning": "house" },
    { "word": "se", "meaning": "to see" }
  ]
}

User text: "${userText}"
Correct text: "${correctedText}"

Return ONLY the JSON, no other text.`;

        const response = await this.geminiAI.generateContent(prompt);
        const content = response.candidates[0].content.parts[0].text;
        
        // Extract JSON from response
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(content);
        } catch (parseError) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedResponse = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Failed to parse JSON response from Gemini');
            }
        }
        
        return parsedResponse;
    }

    async getParagraphAnalysis(paragraph) {
        const prompt = `
You are a swedish language learning assistant. Given the swedish paragraph below:

Input paragraph: ${paragraph}

respond with this output in JSON format:

{
"corrected_paragraph": "If there is a grammar or spelling mistake in the paragraph, correct it. the corrected_paragraph must always contain the correct version.",
"translated_paragraph": "provide the english translation of the entire paragraph here...",
"phrases": [
{"phrase": "base form of important phrase", "translation": "english translation of the base form of the phrase..."},
...
],
"words": [
{"word": "base form of important word", "translation": "english translation of the base form of the word..."},
...
]
}

Instructions:
the "phrases" array should contain the most important phrases that are useful for language learners to study.

the "words" array should contain the most important words that are useful for language learners to study.

Only return valid JSON, no extra text.

Example Input: Sverig är en vackert land med många sjöar och skogar. Det är känt för sin natur och sina midnattssol.

Example Output JSON format:
{
"corrected_paragraph": "Sverige är ett vackert land med många sjöar och skogar. Det är känt för sin natur och sin midnattssol.",
"translated_paragraph": "Sweden is a beautiful country with many lakes and forests. It is known for its nature and its midnight sun.",
"words": [
{"word": "sjö", "translation": "lake"},
{"word": "skog", "translation": "forest"},
{"word": "midnattssol", "translation": "midnight sun"}
],
"phrases": [
{"phrase": "att vara känt för sin natur", "translation": "to be known for its nature"},
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
              !Array.isArray(parsedResponse.phrases) ||
                !Array.isArray(parsedResponse.words)) {
            throw new Error('Invalid response structure from Gemini API');
        }

        parsedResponse.expressions = [...parsedResponse.phrases.map(p => ({ expression: p.phrase, translation: p.translation})),
                     ...parsedResponse.words.map(w => ({ expression: w.word, translation: w.translation}))];

        return parsedResponse;
    }

    async handleNext() {
        // Check which mode we're in
        if (this.currentMode === 'writing') {
            // Writing mode: process corrected text
            if (!this.processedText || this.processedText.length === 0) {
                this.showMessage('Please evaluate the text first!', 'error');
                return;
            }
            
            const userText = this.processedText[0].original;
            const correctedText = this.processedText[0].corrected;
            
            // Show loading state
            this.nextBtn.classList.add('loading');
            this.nextBtn.disabled = true;
            this.nextBtn.textContent = 'Loading...';
            
            try {
                // Get vocabulary from correction
                const aiResponse = await this.getVocabularyFromCorrection(userText, correctedText);
                console.log('Vocabulary response:', aiResponse);
                
                // Convert to the format expected by overview modal
                const expressions = aiResponse.vocabulary.map(item => ({
                    expression: item.word,
                    translation: item.meaning
                }));
                
                const paragraphData = {
                    paragraph: correctedText,
                    translated_paragraph: aiResponse.translation,
                    expressions: expressions
                };
                
                // Store data for later saving
                this.paragraphData = paragraphData;
                
                this.showMessage(`Found ${expressions.length} vocabulary items to learn!`, 'success');
                
                // Show overview modal
                this.showOverviewModal(paragraphData);
                
            } catch (error) {
                console.error('Error processing correction:', error);
                this.showMessage('Error: ' + error.message, 'error');
            } finally {
                // Remove loading state
                this.nextBtn.classList.remove('loading');
                this.nextBtn.disabled = false;
                this.nextBtn.textContent = 'Next';
            }
            
        } else {
            // Reading mode: original behavior
            const text = this.textInput.value.trim();

            if (!text) {
                this.showMessage('Please enter some text first!', 'error');
                return;
            }

            // Show loading state
            this.nextBtn.classList.add('loading');
            this.nextBtn.disabled = true;
            this.nextBtn.textContent = 'loading';

            try {
                // Get translation from Gemini AI
                const aiResponse = await this.getParagraphAnalysis(text);
                console.log('Gemini AI response:', aiResponse);
                
                const paragraphData = {
                    paragraph: aiResponse.corrected_paragraph,
                    translated_paragraph: aiResponse.translated_paragraph,
                    expressions: aiResponse.expressions
                };

                // Store data for later saving
                this.paragraphData = paragraphData;

                this.showMessage(`Translation complete! Found ${paragraphData.expressions.length} expressions. Review and save below.`, 'success');

                // Show overview modal without saving to database yet
                this.showOverviewModal(paragraphData);

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
class ParagraphsDB {
    constructor() {
        this.dbWrapper = new IndexedDBWrapper('leitner_db', 'paragraphs', 2);
        this.isInitialized = false;
        this.wordDB = null; // Will be initialized when needed
    }

    async init() {
        if (!this.isInitialized) {
            await this.dbWrapper.open();
            this.isInitialized = true;
        }
        
        // Initialize WordDB if not already done
        if (!this.wordDB) {
            this.wordDB = new WordDB();
            await this.wordDB.init();
        }
    }

    /**
     * Add a new paragraph to the database
     * @param {Object} paragraphData - The paragraph object
     * @param {string} paragraphData.paragraph - The original paragraph text
     * @param {Object} paragraphData.translation - The translation object
     * @param {string} paragraphData.translation.translated_paragraph - The full translation of the paragraph
     * @param {Object[]} paragraphData.translation.translated_words - Array of word translation objects
     * @param {string} paragraphData.translation.translated_words[].word - The word itself
     * @param {string} paragraphData.translation.translated_words[].translation - The detailed translation of the word
     * @param {string[]} paragraphData.words - Array of words from the paragraph
     * @param {Date|null} paragraphData.last_reviewed_at - Last review date (optional, defaults to null)
     * @param {number} paragraphData.count_of_successful_reviews - Number of successful reviews (optional, defaults to 0)
     * @param {boolean} paragraphData.is_excluded - Whether the paragraph is excluded (optional, defaults to false)
     * @returns {Promise<number>} The ID of the added paragraph
     */
    async addParagraph(paragraphData) {
        await this.init();
        
        // Validate required fields
        if (!paragraphData.paragraph || 
            !paragraphData.translation || 
            typeof paragraphData.translation !== 'object' ||
            !paragraphData.translation.translated_paragraph ||
            !Array.isArray(paragraphData.translation.translated_words) ||
            !Array.isArray(paragraphData.words)) {
            throw new Error('Missing required fields: paragraph, translation (with text and words), and words are required');
        }

        // Validate translation words structure
        for (const wordObj of paragraphData.translation.translated_words) {
            if (!wordObj.word || !wordObj.translation) {
                throw new Error('Each translation word must have "word" and "translation" properties');
            }
        }

        // Create paragraph object with defaults
        const paragraph = {
            paragraph: paragraphData.paragraph,
            translation: {
                text: paragraphData.translation.translated_paragraph,
                words: paragraphData.translation.translated_words.map(wordObj => ({
                    word: wordObj.word,
                    translation: wordObj.translation
                }))
            },
            words: paragraphData.words,
            last_reviewed_at: paragraphData.last_reviewed_at || null,
            count_of_successful_reviews: paragraphData.count_of_successful_reviews || 0,
            is_excluded: paragraphData.is_excluded || false,
            is_mastered: false, // New paragraphs are not mastered
            created_at: new Date().toISOString()
        };

        const paragraphId = await this.dbWrapper.write(paragraph)

        // Add translated words to the word database
        for (const wordObj of paragraphData.translation.translated_words) {
            try {
                await this.wordDB.addWord({
                    word: wordObj.word,
                    translation: wordObj.translation,
                    paragraphId
                });
                console.log(`Added word "${wordObj.word}" to word database`);
            } catch (error) {
                // If word already exists, that's fine - just skip it
                if (error.message.includes('already exists')) {
                    console.log(`Word "${wordObj.word}" already exists in word database - skipping`);
                } else {
                    console.error(`Error adding word "${wordObj.word}" to word database:`, error);
                    // Don't throw here - we still want to save the paragraph even if word addition fails
                }
            }
        }

        return paragraphId;
    }

    /**
     * Get a paragraph by ID
     * @param {number} id - The paragraph ID
     * @returns {Promise<Object|undefined>} The paragraph object or undefined if not found
     */
    async getParagraph(id) {
        await this.init();
        return await this.dbWrapper.read(id);
    }

    /**
     * Get all paragraphs
     * @returns {Promise<Object[]>} Array of all paragraph objects
     */
    async getAllParagraphs() {
        await this.init();
        return await this.dbWrapper.readAll();
    }

    /**
     * Get paragraphs that are not excluded and not mastered (for review)
     * @returns {Promise<Object[]>} Array of non-excluded, non-mastered paragraph objects
     */
    async getActiveParagraphs() {
        await this.init();
        const allParagraphs = await this.dbWrapper.readAll();
        return allParagraphs.filter(p => !p.is_excluded && !p.is_mastered);
    }

    /**
     * Get paragraphs that are mastered
     * @returns {Promise<Object[]>} Array of mastered paragraph objects
     */
    async getMasteredParagraphs() {
        await this.init();
        const allParagraphs = await this.dbWrapper.readAll();
        return allParagraphs.filter(p => p.is_mastered);
    }

    /**
     * Update a paragraph's review information
     * @param {number} id - The paragraph ID
     * @param {boolean} wasSuccessful - Whether the review was successful
     * @returns {Promise<void>}
     */
    async updateReview(id, wasSuccessful) {
        await this.init();
        const paragraph = await this.getParagraph(id);
        
        if (!paragraph) {
            throw new Error(`Paragraph with ID ${id} not found`);
        }

        paragraph.last_reviewed_at = new Date().toISOString();
        
        if (wasSuccessful) {
            paragraph.count_of_successful_reviews += 1;
            
            // Mark as mastered if successfully reviewed 5 times in a row
            if (paragraph.count_of_successful_reviews >= 5) {
                paragraph.is_mastered = true;
            }
        } else {
            // Reset successful review count on failure
            paragraph.count_of_successful_reviews = 0;
            paragraph.is_mastered = false;
        }

        return await this.updateParagraph(id, paragraph);
    }

    /**
     * Update a paragraph
     * @param {number} id - The paragraph ID
     * @param {Object} updatedData - The updated paragraph data
     * @returns {Promise<void>}
     */
    async updateParagraph(id, updatedData) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.dbWrapper.db.transaction([this.dbWrapper.storeName], 'readwrite');
            const store = transaction.objectStore(this.dbWrapper.storeName);
            
            // Ensure the ID is preserved
            updatedData.id = id;
            
            const request = store.put(updatedData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Toggle the exclusion status of a paragraph
     * @param {number} id - The paragraph ID
     * @returns {Promise<void>}
     */
    async toggleExclusion(id) {
        await this.init();
        const paragraph = await this.getParagraph(id);
        
        if (!paragraph) {
            throw new Error(`Paragraph with ID ${id} not found`);
        }

        paragraph.is_excluded = !paragraph.is_excluded;
        return await this.updateParagraph(id, paragraph);
    }

    /**
     * Toggle the mastered status of a paragraph
     * @param {number} id - The paragraph ID
     * @returns {Promise<void>}
     */
    async toggleMastered(id) {
        await this.init();
        const paragraph = await this.getParagraph(id);
        
        if (!paragraph) {
            throw new Error(`Paragraph with ID ${id} not found`);
        }

        paragraph.is_mastered = !paragraph.is_mastered;
        
        if (!paragraph.is_mastered) {
            // Reset review count when unmarking as mastered
            paragraph.count_of_successful_reviews = 0;
        }
        
        return await this.updateParagraph(id, paragraph);
    }

    /**
     * Delete a paragraph
     * @param {number} id - The paragraph ID
     * @returns {Promise<void>}
     */
    async deleteParagraph(id) {
        await this.init();
        return await this.dbWrapper.delete(id);
    }

    /**
     * Clear all paragraphs from the database
     * @returns {Promise<void>}
     */
    async clearAllParagraphs() {
        await this.init();
        return await this.dbWrapper.clear();
    }

    /**
     * Get paragraphs due for review (using same logic as word database)
     * @returns {Promise<Object[]>} Array of paragraphs due for review
     */
    async getParagraphsDueForReview() {
        await this.init();
        const activeParagraphs = await this.getActiveParagraphs();
        const now = new Date();
        
        return activeParagraphs.filter(paragraph => {
            if (!paragraph.last_reviewed_at) {
                return true; // Never reviewed, so due for review
            }
            
            const lastReviewed = new Date(paragraph.last_reviewed_at);
            const daysSinceReview = Math.floor((now - lastReviewed) / (1000 * 60 * 60 * 24));
            
            // Simple spaced repetition: interval increases with successful reviews
            // 1st review: 1 day, 2nd: 3 days, 3rd: 7 days, 4th: 14 days, etc.
            const intervals = [1, 3, 7, 14, 30];
            const reviewCount = paragraph.count_of_successful_reviews;
            const requiredInterval = intervals[Math.min(reviewCount, intervals.length - 1)];
            
            return daysSinceReview >= requiredInterval;
        });
    }
}

// Usage example:
// const paragraphsDB = new ParagraphsDB();
// await paragraphsDB.addParagraph({
//     paragraph: "Jag gick till affären och köpte ett äpple.",
//     translation: {
//         text: "I went to the store and bought an apple.",
//         words: [
//             { word: "affären", translation: "means 'the store', lemma 'affär'" },
//             { word: "köpte", translation: "means 'bought', lemma 'köpa'" }
//         ]
//     },
//     words: ["affären", "köpte"]
// });

class WordDB {
    constructor() {
        this.dbWrapper = new IndexedDBWrapper('leitner_db', 'words', 2);
        this.isInitialized = false;
    }

    async init() {
        if (!this.isInitialized) {
            await this.dbWrapper.open();
            this.isInitialized = true;
        }
    }

    /**
     * Add a new word to the database
     * @param {Object} wordData - The word object
     * @param {string} wordData.word - The word itself
     * @param {string} wordData.translation - The translation/definition of the word
     * @param {number} wordData.paragraphId - The id of the reference paragraph
     * @param {Date|null} [wordData.last_reviewed_at] - Last review date (optional, defaults to null)
     * @param {number} wordData.count_of_successful_reviews - Number of successful reviews (optional, defaults to 0)
     * @returns {Promise<number>} The ID of the added word
     */
    async addWord(wordData) {
        await this.init();
        
        // Validate required fields
        if (!wordData.word || !wordData.translation || !wordData.paragraphId) {
            throw new Error('Missing required fields: word, translation, and paragraphId are required');
        }

        // Check if word already exists
        const existingWord = await this.getWordByText(wordData.word);
        if (existingWord) {
            throw new Error(`Word "${wordData.word}" already exists in the database`);
        }

        // Create word object with automatic date handling
        const word = {
            paragraph_id: wordData.paragraphId,
            word: wordData.word,
            translation: wordData.translation,
            last_reviewed_at: null, // New words haven't been reviewed yet
            count_of_successful_reviews: 0, // Start with 0 successful reviews
            is_mastered: false, // New words are not mastered
            created_at: new Date().toISOString()
        };

        return await this.dbWrapper.write(word);
    }

    /**
     * Get a word by ID
     * @param {number} id - The word ID
     * @returns {Promise<Object|undefined>} The word object or undefined if not found
     */
    async getWord(id) {
        await this.init();
        return await this.dbWrapper.read(id);
    }

    /**
     * Get a word by its text
     * @param {string} wordText - The word text to search for
     * @returns {Promise<Object|undefined>} The word object or undefined if not found
     */
    async getWordByText(wordText) {
        await this.init();
        const allWords = await this.dbWrapper.readAll();
        return allWords.find(word => word.word === wordText);
    }

    /**
     * Get all words
     * @returns {Promise<Object[]>} Array of all word objects
     */
    async getAllWords() {
        await this.init();
        return await this.dbWrapper.readAll();
    }

    /**
     * Get words that are not mastered (for review)
     * @returns {Promise<Object[]>} Array of non-mastered word objects
     */
    async getActiveWords() {
        await this.init();
        const allWords = await this.dbWrapper.readAll();
        return allWords.filter(word => !word.is_mastered);
    }

    /**
     * Get words that are mastered
     * @returns {Promise<Object[]>} Array of mastered word objects
     */
    async getMasteredWords() {
        await this.init();
        const allWords = await this.dbWrapper.readAll();
        return allWords.filter(word => word.is_mastered);
    }

    /**
     * Update a word's review information
     * @param {number} id - The word ID
     * @param {boolean} wasSuccessful - Whether the review was successful
     * @returns {Promise<void>}
     */
    async updateReview(id, wasSuccessful) {
        await this.init();
        const word = await this.getWord(id);
        
        if (!word) {
            throw new Error(`Word with ID ${id} not found`);
        }

        word.last_reviewed_at = new Date().toISOString();
        
        if (wasSuccessful) {
            word.count_of_successful_reviews += 1;
            
            // Mark as mastered if successfully reviewed 5 times in a row
            if (word.count_of_successful_reviews >= 5) {
                word.is_mastered = true;
            }
        } else {
            // Reset successful review count on failure
            word.count_of_successful_reviews = 0;
            word.is_mastered = false;
        }

        return await this.updateWord(id, word);
    }

    /**
     * Toggle the mastered status of a word
     * @param {number} id - The word ID
     * @returns {Promise<void>}
     */
    async toggleMastered(id) {
        await this.init();
        const word = await this.getWord(id);
        
        if (!word) {
            throw new Error(`Word with ID ${id} not found`);
        }

        word.is_mastered = !word.is_mastered;
        
        if (!word.is_mastered) {
            // Reset review count when unmarking as mastered
            word.count_of_successful_reviews = 0;
        }
        
        return await this.updateWord(id, word);
    }

    /**
     * Update a word
     * @param {number} id - The word ID
     * @param {Object} updatedData - The updated word data
     * @returns {Promise<void>}
     */
    async updateWord(id, updatedData) {
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
     * Delete a word
     * @param {number} id - The word ID
     * @returns {Promise<void>}
     */
    async deleteWord(id) {
        await this.init();
        return await this.dbWrapper.delete(id);
    }

    /**
     * Clear all words from the database
     * @returns {Promise<void>}
     */
    async clearAllWords() {
        await this.init();
        return await this.dbWrapper.clear();
    }

    /**
     * Get words due for review (using same logic as paragraph database)
     * @returns {Promise<Object[]>} Array of words due for review
     */
    async getWordsDueForReview() {
        await this.init();
        const activeWords = await this.getActiveWords();
        const now = new Date();
        
        return activeWords.filter(word => {
            if (!word.last_reviewed_at) {
                return true; // Never reviewed, so due for review
            }
            
            const lastReviewed = new Date(word.last_reviewed_at);
            const daysSinceReview = Math.floor((now - lastReviewed) / (1000 * 60 * 60 * 24));
            
            // Simple spaced repetition: interval increases with successful reviews
            // 1st review: 1 day, 2nd: 3 days, 3rd: 7 days, 4th: 14 days, etc.
            const intervals = [1, 3, 7, 14, 30];
            const reviewCount = word.count_of_successful_reviews;
            const requiredInterval = intervals[Math.min(reviewCount, intervals.length - 1)];
            
            return daysSinceReview >= requiredInterval;
        });
    }

    /**
     * Get statistics about the word collection
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        await this.init();
        const allWords = await this.getAllWords();
        const activeWords = await this.getActiveWords();
        const masteredWords = await this.getMasteredWords();
        const wordsDue = await this.getWordsDueForReview();
        
        return {
            total: allWords.length,
            active: activeWords.length,
            mastered: masteredWords.length,
            dueForReview: wordsDue.length,
            masteryRate: allWords.length > 0 ? (masteredWords.length / allWords.length * 100).toFixed(1) : 0
        };
    }

    /**
     * Get words associated with a specific paragraph
     * @param {number} paragraphId - The paragraph ID
     * @returns {Promise<Object[]>} Array of words associated with the paragraph
     */
    async getWordsByParagraphId(paragraphId) {
        await this.init();
        const allWords = await this.dbWrapper.readAll();
        return allWords.filter(word => word.paragraph_id === paragraphId);
    }
}

// Usage example:
// const wordDB = new WordDB();
// await wordDB.addWord({
//     word: "affären",
//     translation: "the store (noun, definite form of affär)"
// });

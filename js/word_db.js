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
     * @returns {Promise<number>} The ID of the added word
     */
    async addWord(wordData) {
        await this.init();
        
        // Validate required fields
        if (!wordData.word || !wordData.translation) {
            throw new Error('Missing required fields: word and translation are required');
        }

        // Check if word already exists
        const existingWord = await this.getWordByText(wordData.word);
        if (existingWord) {
            throw new Error(`Word "${wordData.word}" already exists in the database`);
        }

        // Calculate next review date (tomorrow for new words)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Create word object with automatic date handling
        const word = {
            word: wordData.word,
            translation: wordData.translation,
            last_review_date: null, // New words haven't been reviewed yet
            next_review_at: tomorrow.toISOString(), // Schedule for tomorrow
            successful_review_count: 0, // Start with 0 successful reviews
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

        word.last_review_date = new Date().toISOString();
        
        if (wasSuccessful) {
            word.successful_review_count += 1;
            
            // Mark as mastered if successfully reviewed 5 times in a row
            if (word.successful_review_count >= 5) {
                word.is_mastered = true;
                word.next_review_at = null; // No more reviews needed
            } else {
                // Calculate next review date based on spaced repetition
                word.next_review_at = this.calculateNextReviewDate(word.successful_review_count);
            }
        } else {
            // Reset successful review count on failure
            word.successful_review_count = 0;
            word.is_mastered = false;
            // Schedule next review for tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            word.next_review_at = tomorrow.toISOString();
        }

        return await this.updateWord(id, word);
    }

    /**
     * Calculate next review date based on successful review count
     * @param {number} successfulCount - Number of successful reviews
     * @returns {string} ISO string of next review date
     */
    calculateNextReviewDate(successfulCount) {
        // Spaced repetition intervals: 1 day, 3 days, 7 days, 14 days
        const intervals = [1, 3, 7, 14];
        const daysToAdd = intervals[Math.min(successfulCount - 1, intervals.length - 1)];
        
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);
        
        return nextReviewDate.toISOString();
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
        
        if (word.is_mastered) {
            word.next_review_at = null; // No more reviews needed
        } else {
            // Reset and schedule next review
            word.successful_review_count = 0;
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            word.next_review_at = tomorrow.toISOString();
        }
        
        return await this.updateWord(id, word);
    }

    /**
     * Delete a word
     * @param {number} id - The word ID
     * @returns {Promise<void>}
     */
    async deleteWord(id) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.dbWrapper.db.transaction([this.dbWrapper.storeName], 'readwrite');
            const store = transaction.objectStore(this.dbWrapper.storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get words due for review
     * @returns {Promise<Object[]>} Array of words due for review
     */
    async getWordsDueForReview() {
        await this.init();
        const activeWords = await this.getActiveWords();
        const now = new Date();
        return activeWords.filter(word => {
            if (!word.next_review_at) {
                return true; // Never reviewed or no scheduled review, so due for review
            }
            
            const nextReviewDate = new Date(word.next_review_at);
            return now >= nextReviewDate;
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
}

// Usage example:
// const wordDB = new WordDB();
// await wordDB.addWord({
//     word: "affären",
//     translation: "the store (noun, definite form of affär)"
// });

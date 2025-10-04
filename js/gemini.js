class GeminiAI {
    constructor() {
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
    }

    async generateContent(userPrompt) {
        const key = localStorage.getItem('gemini_api_key');
        if (!key) {
            let userInput = prompt("Please set your Gemini API key in the settings.");
            if (userInput !== null) {
                localStorage.setItem('gemini_api_key', userInput);
            }
        }

        const url = `${this.baseUrl}?key=${key}`;
        
        const body = {
            contents: [
                {
                    parts: [{ text: userPrompt }]
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response from Gemini API');
        }
        
        return data;
    }
}
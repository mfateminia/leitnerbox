// Hamburger Menu Functionality
class HamburgerMenu {
    constructor() {
        this.init();
    }

    init() {
        this.createMenuHTML();
        this.bindEvents();
        this.setCurrentPage();
    }

    createMenuHTML() {
        // Remove existing navigation buttons
        this.removeExistingNavButtons();

        // Create hamburger menu HTML
        const menuHTML = `
            <div class="hamburger-menu">
                <button class="hamburger-btn" id="hamburgerBtn">
                    <div class="hamburger-icon">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </button>
                <nav class="nav-menu" id="navMenu">
                    <ul>
                        <li><a href="text_loader.html" data-page="text_loader"><span class="icon">📝</span>Text Loader</a></li>
                        <li><a href="paragraph_review.html" data-page="paragraph_review"><span class="icon">📖</span>Paragraph Review</a></li>
                        <li><a href="word_review.html" data-page="word_review"><span class="icon">🔍</span>Word Review</a></li>
                        <li><a href="settings.html" data-page="settings"><span class="icon">⚙️</span>Settings</a></li>
                    </ul>
                </nav>
            </div>
        `;

        // Find the button container and insert the menu as the first item
        const buttonContainer = document.querySelector('.button-container') || 
                               document.querySelector('.control-buttons');
        
        if (buttonContainer) {
            buttonContainer.insertAdjacentHTML('afterbegin', menuHTML);
        } else {
            // Fallback: create a button container if none exists
            const container = document.querySelector('.container') || document.body;
            const fallbackHTML = `
                <div class="button-container">
                    ${menuHTML}
                </div>
            `;
            container.insertAdjacentHTML('beforeend', fallbackHTML);
        }
    }

    removeExistingNavButtons() {
        // Wait a bit to ensure DOM is fully loaded
        setTimeout(() => {
            // Remove navigation buttons from different pages with more specific selectors
            const navSelectors = [
                // From all pages - settings button
                'button[onclick*="settings.html"]',
                '#settingsBtn',
                
                // From all pages - text loader navigation
                'button[onclick*="text_loader.html"]',
                '#backToAppBtn',
                
                // From text_loader and other pages - word review navigation
                'button[onclick*="word_review.html"]',
                '#newParagraph',
                '#addNewWordBtn',
                
                // Any button with navigation href
                'button[onclick*=".html"]'
            ];

            navSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    // Only remove if it's clearly a navigation button
                    if (element && (
                        element.onclick || 
                        element.getAttribute('onclick') ||
                        element.textContent.includes('Settings') ||
                        element.textContent.includes('Back to') ||
                        element.textContent.includes('Add paragraph') ||
                        element.title === 'Settings' ||
                        element.title === 'Review'
                    )) {
                        element.remove();
                    }
                });
            });
        }, 100);
    }

    bindEvents() {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const navMenu = document.getElementById('navMenu');

        if (hamburgerBtn && navMenu) {
            hamburgerBtn.addEventListener('click', () => {
                hamburgerBtn.classList.toggle('active');
                navMenu.classList.toggle('active');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.hamburger-menu')) {
                    hamburgerBtn.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            });

            // Close menu when clicking on a navigation link
            navMenu.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') {
                    hamburgerBtn.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            });
        }
    }

    setCurrentPage() {
        const currentPage = this.getCurrentPageName();
        const navLinks = document.querySelectorAll('.nav-menu a');
        
        navLinks.forEach(link => {
            const linkPage = link.getAttribute('data-page');
            if (linkPage === currentPage) {
                link.classList.add('current-page');
            }
        });
    }

    getCurrentPageName() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        
        // Map filenames to page identifiers
        const pageMap = {
            'text_loader.html': 'text_loader',
            'paragraph_review.html': 'paragraph_review',
            'word_review.html': 'word_review',
            'settings.html': 'settings'
        };
        
        return pageMap[filename] || 'text_loader'; // Default to text_loader
    }
}

// Initialize hamburger menu when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HamburgerMenu();
});
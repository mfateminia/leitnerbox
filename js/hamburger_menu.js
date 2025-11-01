// Hamburger Menu Functionality
class HamburgerMenu {
    constructor() {
        console.log('HamburgerMenu constructor called');
        this.init();
    }

    init() {
        console.log('HamburgerMenu init called on page:', window.location.pathname);
        try {
            this.createMenuHTML();
            this.setCurrentPage();
            console.log('HamburgerMenu initialization completed successfully');
        } catch (error) {
            console.error('Error during HamburgerMenu initialization:', error);
        }
    }

    createMenuHTML() {
        // Remove existing navigation buttons
        this.removeExistingNavButtons();

        // Check if hamburger menu already exists
        if (document.querySelector('.hamburger-menu')) {
            console.log('Hamburger menu already exists, skipping creation');
            return;
        }

        // Create hamburger menu HTML
        const menuHTML = `
            <div class="hamburger-menu" style="position: fixed !important; bottom: 80px !important; left: 20px !important; z-index: 500 !important; display: inline-block !important;">
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
                        <li><a href="word_list.html" data-page="word_list"><span class="icon">📚</span>Word List</a></li>
                        <li><a href="settings.html" data-page="settings"><span class="icon">⚙️</span>Settings</a></li>
                    </ul>
                </nav>
            </div>
        `;

        try {
            // Insert hamburger menu directly into body (fixed position)
            document.body.insertAdjacentHTML('beforeend', menuHTML);
            console.log('Hamburger menu created successfully');
            
            // Bind events immediately after creating the HTML
            this.bindEvents();
        } catch (error) {
            console.error('Error creating hamburger menu:', error);
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
            console.log('Binding hamburger menu events');
            console.log('Hamburger button element:', hamburgerBtn);
            console.log('Nav menu element:', navMenu);
            
            hamburgerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Hamburger button clicked!');
                console.log('Before toggle - Button classes:', hamburgerBtn.className);
                console.log('Before toggle - Menu classes:', navMenu.className);
                
                hamburgerBtn.classList.toggle('active');
                navMenu.classList.toggle('active');
                
                console.log('After toggle - Button classes:', hamburgerBtn.className);
                console.log('After toggle - Menu classes:', navMenu.className);
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
            
            // Fallback: Add click handler to the entire hamburger menu div
            const hamburgerMenu = document.querySelector('.hamburger-menu');
            if (hamburgerMenu) {
                hamburgerMenu.addEventListener('click', (e) => {
                    // Only toggle if clicking on the button or its children, not the menu itself
                    if (e.target.closest('.hamburger-btn')) {
                        console.log('Fallback click handler triggered');
                        hamburgerBtn.classList.toggle('active');
                        navMenu.classList.toggle('active');
                    }
                });
            }
        } else {
            console.error('Hamburger menu elements not found:', {
                hamburgerBtn: !!hamburgerBtn,
                navMenu: !!navMenu
            });
        }
        
        // Hide hamburger menu when modals are open
        this.setupModalDetection();
    }

    setupModalDetection() {
        const hamburgerMenu = document.querySelector('.hamburger-menu');
        if (!hamburgerMenu) return;

        // Watch for modal overlay visibility changes
        const observer = new MutationObserver((mutations) => {
            const modalOverlay = document.querySelector('.modal-overlay');
            if (modalOverlay && modalOverlay.style.display !== 'none') {
                hamburgerMenu.style.display = 'none';
            } else {
                hamburgerMenu.style.display = 'inline-block';
            }
        });

        // Observe document for modal changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        // Also check immediately
        setTimeout(() => {
            const modalOverlay = document.querySelector('.modal-overlay');
            if (modalOverlay && modalOverlay.style.display !== 'none') {
                hamburgerMenu.style.display = 'none';
            }
        }, 100);
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
            'word_list.html': 'word_list',
            'settings.html': 'settings'
        };
        
        return pageMap[filename] || 'text_loader'; // Default to text_loader
    }
}

// Initialize hamburger menu when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure all page elements are ready
    setTimeout(() => {
        new HamburgerMenu();
    }, 100);
});

// Also initialize if the script loads after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            new HamburgerMenu();
        }, 100);
    });
} else {
    // DOM is already ready
    setTimeout(() => {
        new HamburgerMenu();
    }, 100);
}
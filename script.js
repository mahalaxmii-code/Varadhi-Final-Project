

// Define the backend API URL
const BACKEND_URL = 'http://localhost:3000';

// Helper function to fetch data from the backend
async function fetchData(endpoint, options = {}) {
    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
        }
        const data = await response.json();
        console.log(`✅ Data fetched for ${endpoint}:`, data); // Keep this log - very important!
        return data;
    } catch (error) {
        console.error(`❌ Error fetching data from ${endpoint}:`, error); // Keep this log
        displayMessage(error.message, 'error');
        return null;
    }
}

// Function to display services on the services.html page (for service cards)
function displayServices(services, title) {
    console.log('🔄 Calling displayServices with title:', title);
    console.log('   Services data received by displayServices:', services);

    const servicesContainer = document.getElementById('service-list-container');
    const loadingMessage = document.getElementById('loading-message');
    const noResultsMessage = document.getElementById('no-results-message');
    const servicesTitle = document.getElementById('services-title');

    if (loadingMessage) loadingMessage.style.display = 'none';
    if (noResultsMessage) noResultsMessage.style.display = 'none';

    if (servicesContainer) servicesContainer.innerHTML = '';
    else {
        console.error('❌ displayServices: service-list-container element not found!');
        return;
    }

    if (servicesTitle) {
        servicesTitle.textContent = title || 'All Services';
    }

    if (!services || services.length === 0) {
        if (noResultsMessage) noResultsMessage.style.display = 'block';
        console.warn('⚠️ displayServices: No services found to display.');
        return;
    }

    services.forEach(service => {
        const serviceCard = document.createElement('div');
        serviceCard.classList.add('service-card');

        let cardContent = `<h3>${service.SOCIETY_NAME || 'N/A'}</h3>`;
        for (const key in service) {
            if (service.hasOwnProperty(key) && key !== 'ID') {
                cardContent += `<p><strong>${formatKey(key)}:</strong> ${service[key] || 'N/A'}</p>`;
            }
        }
        serviceCard.innerHTML = cardContent;
        servicesContainer.appendChild(serviceCard);
    });
    console.log(`✅ displayServices: Successfully displayed ${services.length} service cards.`);
}

// Helper function to format keys for display
function formatKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

// Function to handle search
async function handleSearch(searchTerm) {
    if (searchTerm.trim() === '') {
        window.location.href = `services.html?category=All Services`;
        return;
    }
    window.location.href = `services.html?search=${encodeURIComponent(searchTerm)}`;
}

// Function to display messages to the user
function displayMessage(message, type) {
    const messageBox = document.getElementById('message-box');
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.style.display = 'block';
        messageBox.style.opacity = '1';

        if (messageBox.hideTimeout) {
            clearTimeout(messageBox.hideTimeout);
        }

        messageBox.hideTimeout = setTimeout(() => {
            messageBox.style.opacity = '0';
            setTimeout(() => {
                messageBox.style.display = 'none';
            }, 500);
        }, 5000);
    }
}

// --- Common Logic for all pages (header search functionality) ---
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');

    if (searchInput && searchButton) {
        searchButton.addEventListener('click', () => {
            const searchTerm = searchInput.value;
            handleSearch(searchTerm);
        });

        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const searchTerm = searchInput.value;
                handleSearch(searchTerm);
            }
        });
    }


    // --- Specific Logic for index.html ---
    if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html')) {
        const serviceButtonsContainer = document.getElementById('service-buttons-container');

        async function loadDistinctServices() {
            if (!serviceButtonsContainer) {
                console.error('🔴 index.html: service-buttons-container element NOT FOUND!');
                return;
            }

            // Attempt to fetch dynamic services
            const distinctServices = await fetchData('/api/services/distinct');

            if (distinctServices && distinctServices.length > 0) {
                console.log('✅ Dynamic services received. Replacing static buttons.');
                serviceButtonsContainer.innerHTML = ''; // Clear existing static buttons

                const allServicesButton = document.createElement('button');
                allServicesButton.classList.add('service-button');
                allServicesButton.textContent = 'All Services';
                allServicesButton.dataset.service = 'All Services';
                serviceButtonsContainer.appendChild(allServicesButton);

                distinctServices.forEach(service => {
                    const button = document.createElement('button');
                    button.classList.add('service-button');
                    button.textContent = service;
                    button.dataset.service = service;
                    serviceButtonsContainer.appendChild(button);
                });
                console.log(`✅ Successfully added ${distinctServices.length + 1} dynamic buttons.`);
            } else {
                console.warn('⚠️ No dynamic services fetched or received empty array. Static fallback buttons should be visible from HTML.');
                // If dynamic fetch fails or is empty, the static buttons from HTML will remain.
                // This block is for scenarios where the fetch failed OR returned empty, and static buttons are still desired.
                // Since index.html now has static buttons directly, this else block simply logs
                // The static buttons are already in the HTML.
            }

            // Add event listeners for both static and dynamic buttons
            serviceButtonsContainer.addEventListener('click', (event) => {
                const targetButton = event.target.closest('.service-button');
                if (targetButton) {
                    const serviceName = targetButton.dataset.service;
                    window.location.href = `services.html?category=${encodeURIComponent(serviceName)}`;
                }
            });
        }
        loadDistinctServices();
    }

    // --- Specific Logic for services.html ---
    if (window.location.pathname.endsWith('/services.html')) {
        console.log("Running services.html specific logic.");
        const params = new URLSearchParams(window.location.search);
        const category = params.get('category');
        const searchTerm = params.get('search');

        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) loadingMessage.style.display = 'block';

        if (category) {
            if (category === 'All Services') {
                fetchData('/api/services').then(services => {
                    displayServices(services, 'All Services Available');
                });
            } else {
                fetchData(`/api/services/category/${encodeURIComponent(category)}`).then(services => {
                    displayServices(services, `Services for "${category}"`);
                });
            }
        } else if (searchTerm) {
            fetchData(`/api/services/search?query=${encodeURIComponent(searchTerm)}`).then(services => {
                displayServices(services, `Search Results for "${searchTerm}"`);
            });
        } else { // Default: if no category or search term, show all services
            fetchData('/api/services').then(services => {
                displayServices(services, 'All Services Available');
            });
        }
    }

    // --- Specific Logic for login.html ---
    if (window.location.pathname.endsWith('/login.html')) {
        console.log("Running login.html specific logic.");
        const authForm = document.getElementById('auth-form');
        const authTitle = document.getElementById('auth-title');
        const authSubmitButton = document.getElementById('auth-submit-button');
        const toggleAuthModeLink = document.getElementById('toggle-auth-mode');
        const messageBox = document.getElementById('message-box');
        const registerFields = document.querySelectorAll('.register-field');

        let isLoginMode = true;

        const updateAuthModeUI = () => {
            if (isLoginMode) {
                authTitle.textContent = 'Login to Your Account';
                authSubmitButton.textContent = 'Login';
                toggleAuthModeLink.textContent = 'Register here';
                toggleAuthModeLink.parentElement.firstChild.nodeValue = 'Don\'t have an account? ';
                registerFields.forEach(field => field.classList.remove('visible'));
                document.getElementById('email').removeAttribute('required');
                document.getElementById('mobileNumber').removeAttribute('required');

            } else {
                authTitle.textContent = 'Register New Account';
                authSubmitButton.textContent = 'Register';
                toggleAuthModeLink.textContent = 'Login here';
                toggleAuthModeLink.parentElement.firstChild.nodeValue = 'Already have an account? ';
                registerFields.forEach(field => field.classList.add('visible'));
                document.getElementById('email').setAttribute('required', 'required');
                document.getElementById('mobileNumber').removeAttribute('required');
            }
            if (messageBox) messageBox.style.display = 'none';
            if (authForm) authForm.reset();
        };

        if (toggleAuthModeLink) {
            toggleAuthModeLink.addEventListener('click', (event) => {
                event.preventDefault();
                isLoginMode = !isLoginMode;
                updateAuthModeUI();
            });
        }

        if (authForm) {
            authForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                const usernameInput = document.getElementById('username');
                const emailInput = document.getElementById('email');
                const passwordInput = document.getElementById('password');
                const mobileNumberInput = document.getElementById('mobileNumber');

                const username = usernameInput.value.trim();
                const email = emailInput ? emailInput.value.trim() : '';
                const password = passwordInput.value;
                const mobileNumber = mobileNumberInput ? mobileNumberInput.value.trim() : '';

                if (!username || !password || (!isLoginMode && !email)) {
                    displayMessage('Please fill in all required fields.', 'error');
                    return;
                }

                let endpoint = '';
                let successMessage = '';
                let errorMessage = '';
                let payload = {};

                if (isLoginMode) {
                    endpoint = '/api/login';
                    successMessage = 'Login successful! Redirecting...';
                    errorMessage = 'Login failed: ';
                    payload = { username, password };
                } else {
                    endpoint = '/api/register';
                    successMessage = 'Registration successful! You can now login.';
                    errorMessage = 'Registration failed: ';
                    payload = { username, email, password, mobileNumber };
                }

                if (messageBox) messageBox.style.display = 'none';

                const response = await fetch(`${BACKEND_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok) {
                    displayMessage(successMessage, 'success');
                    if (isLoginMode) {
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 1500);
                    } else {
                        isLoginMode = true;
                        updateAuthModeUI();
                    }
                } else {
                    displayMessage(errorMessage + (data.message || 'Server error.'), 'error');
                    console.error('Authentication error:', data);
                }
            });
        }

        updateAuthModeUI();
    }
});

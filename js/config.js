// Configuration for the application
const config = {
    // Development (local) server URL
    DEV_SERVER_URL: 'http://localhost:3000',
    
    // Production server URL - Your Render.com backend URL
    PROD_SERVER_URL: 'https://srijal.onrender.com',
    
    // Get the appropriate server URL
    get SERVER_URL() {
        // If running locally, use development URL
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return this.DEV_SERVER_URL;
        }
        // Otherwise use production URL
        return this.PROD_SERVER_URL;
    }
};

// Export the config
export default config;

// Browser Fingerprinting Utility
async function generateBrowserFingerprint() {
    try {
        const components = [
            navigator.userAgent,
            navigator.language,
            new Date().getTimezoneOffset(),
            screen.width,
            screen.height,
            screen.colorDepth
        ];

        // Create a simple hash
        const text = components.join('|');
        const hashArray = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) {
            hashArray[i] = text.charCodeAt(i);
        }
        
        // Use a more browser-compatible hashing approach
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        // Convert to hex string and take last 32 chars
        const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
        return hexHash;
    } catch (error) {
        console.error('Error generating fingerprint:', error);
        // Fallback to timestamp-based fingerprint
        return Date.now().toString(16);
    }
}

// Rate Limiting Check
async function checkRateLimit() {
    const fingerprint = await generateBrowserFingerprint();
    const lastSubmission = localStorage.getItem(`lastSubmission_${fingerprint}`);
    
    if (lastSubmission) {
        const timeDiff = Date.now() - parseInt(lastSubmission);
        const hoursLeft = Math.ceil((3600000 - timeDiff) / 3600000); // 1 hour in milliseconds
        
        if (timeDiff < 3600000) { // 1 hour in milliseconds
            throw new Error(`Please wait ${hoursLeft} hour(s) before sending another message.`);
        }
    }
    
    return fingerprint;
}

// Update Last Submission Time
function updateLastSubmission(fingerprint) {
    localStorage.setItem(`lastSubmission_${fingerprint}`, Date.now().toString());
}

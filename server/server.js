require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware with relaxed settings for local development
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Additional headers for better compatibility
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Debug middleware to log all requests
app.use((req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} from ${clientIP}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname, '..'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        // Disable caching for development
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Access token configuration
const validTokens = new Set();
validTokens.add('fe1f768e6a077621c5a5508795b2bdf51f5fac8757cfe12d552625d17b910301');

// Generate a secure random token
function generateAccessToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Access denied page
app.get('/access-denied', (req, res) => {
    const providedToken = req.query.invalid_token || 'No token provided';
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Access Required</title>
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 20px;
                    text-align: center;
                    background-color: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                h1 { color: #e74c3c; margin-bottom: 1rem; }
                .message { margin: 1rem 0; color: #666; }
                .token-form {
                    margin: 2rem 0;
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 4px;
                }
                input[type="text"] {
                    width: 100%;
                    padding: 8px;
                    margin: 8px 0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                button {
                    background: #3498db;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover { background: #2980b9; }
                .error { color: #e74c3c; margin: 1rem 0; }
                .help { color: #666; font-size: 0.9rem; margin-top: 2rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚠️ Access Required</h1>
                
                ${providedToken !== 'No token provided' ? 
                    `<div class="error">
                        ❌ Invalid access token provided:<br>
                        <code>${providedToken}</code>
                    </div>` : 
                    '<div class="message">This portfolio is private. Please use the access link provided by the owner.</div>'
                }

                <div class="token-form">
                    <form id="tokenForm" onsubmit="submitToken(event)">
                        <input type="text" id="token" placeholder="Enter your access token" required>
                        <button type="submit">View Portfolio</button>
                    </form>
                </div>

                <div class="help">
                    <p>Need access? Ask the portfolio owner for an access link.</p>
                    <p>Make sure you're using the correct port: ${req.get('host').split(':')[1] || '80'}</p>
                </div>
            </div>

            <script>
                function submitToken(event) {
                    event.preventDefault();
                    const token = document.getElementById('token').value.trim();
                    if (token) {
                        window.location.href = '/access?token=' + token;
                    }
                }

                // If we're in an iframe, redirect the parent
                if (window.self !== window.top) {
                    window.top.location.href = window.location.href;
                }
            </script>
        </body>
        </html>
    `);
});

// Token validation endpoint
app.get('/access', (req, res) => {
    const token = req.query.token;
    
    if (!token) {
        return res.redirect('/access-denied');
    }

    if (validTokens.has(token)) {
        // Set cookie and redirect to home
        res.cookie('access_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Only use secure in production
            sameSite: 'lax', // Changed from strict for better compatibility
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        res.redirect('/');
    } else {
        res.redirect(`/access-denied?invalid_token=${token}`);
    }
});

// Middleware to check access token
function checkAccessToken(req, res, next) {
    const token = req.query.token || req.cookies.access_token;
    
    // Skip token check for access and access-denied routes
    if (req.path === '/access' || req.path === '/access-denied' || req.path === '/api/contact' || req.path === '/api/check-status') {
        return next();
    }

    if (!token) {
        return res.redirect('/access-denied');
    }

    if (validTokens.has(token)) {
        // Refresh cookie
        res.cookie('access_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Only use secure in production
            sameSite: 'lax', // Changed from strict for better compatibility
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        next();
    } else {
        res.redirect(`/access-denied?invalid_token=${token}`);
    }
}

// Apply token check to all routes
app.use(checkAccessToken);

// Store rate limit data
const rateLimits = new Map();

// Rate limit middleware
function checkRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const cooldownHours = 12;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;

    if (rateLimits.has(ip)) {
        const lastSent = rateLimits.get(ip);
        const timeLeft = lastSent + cooldownMs - now;

        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

            return res.status(429).json({
                success: false,
                error: `Please wait before sending another message`,
                timeLeft: {
                    hours,
                    minutes,
                    seconds,
                    totalMs: timeLeft
                }
            });
        }
    }

    next();
}

// Check rate limit status endpoint
app.post('/api/check-status', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const cooldownHours = 12;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;

    if (rateLimits.has(ip)) {
        const lastSent = rateLimits.get(ip);
        const timeLeft = lastSent + cooldownMs - now;

        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

            return res.json({
                canSendMessage: false,
                timeLeft: {
                    hours,
                    minutes,
                    seconds,
                    totalMs: timeLeft
                }
            });
        }
    }

    res.json({
        canSendMessage: true,
        timeLeft: null
    });
});

// Email endpoint with rate limiting
app.post('/api/contact', checkRateLimit, async (req, res) => {
    console.log('Received contact request:', req.body);
    
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
        }

        console.log('Sending email with data:', { name, email, messageLength: message.length });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `Portfolio Contact from ${name}`,
            text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
            html: `
                <h3>New Contact Message</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong> ${message}</p>
            `
        };

        await transporter.sendMail(mailOptions);
        
        // Update rate limit after successful send
        const ip = req.ip || req.connection.remoteAddress;
        rateLimits.set(ip, Date.now());

        res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            timeLeft: {
                totalMs: 12 * 60 * 60 * 1000
            }
        });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send email. Please try again later.'
        });
    }
});

// Email transporter setup
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    },
    debug: true,
    logger: true
});

// Verify email configuration on startup
transporter.verify(function(error, success) {
    if (error) {
        console.error('Email configuration error:', error);
        console.error('Email settings:', {
            user: process.env.EMAIL_USER,
            host: 'smtp.gmail.com',
            port: 465
        });
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Mobile-specific endpoint
app.get('/mobile', (req, res) => {
    const token = generateAccessToken();
    validTokens.add(token);
    
    // Check if using Facebook browser
    const userAgent = req.headers['user-agent'] || '';
    const isFacebookBrowser = userAgent.includes('FB_IAB') || userAgent.includes('FBAN');
    
    if (isFacebookBrowser) {
        // Show direct access link for Facebook browser users
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Portfolio Access</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .warning { color: #721c24; background: #f8d7da; padding: 15px; border-radius: 4px; margin: 20px 0; }
                    .token { background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all; margin: 10px 0; }
                    .link { color: #007bff; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>⚠️ Facebook Browser Detected</h1>
                    <div class="warning">
                        <p>You're using Facebook's built-in browser, which may cause issues.</p>
                        <p>Please either:</p>
                        <ol>
                            <li>Copy and open this link in Chrome/Safari:<br>
                                <div class="token">http://${req.headers.host}/access?token=${token}</div>
                            </li>
                            <li>Or use this token in the access page:<br>
                                <div class="token">${token}</div>
                            </li>
                        </ol>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else {
        // For regular mobile browsers, set cookie and redirect
        res.cookie('access_token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
        res.redirect('/');
    }
});

// Start server with port fallback
async function startServer(initialPort) {
    const maxAttempts = 10;
    let currentPort = initialPort;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const server = await new Promise((resolve, reject) => {
                const srv = app.listen(currentPort, '0.0.0.0', () => {
                    const localIP = getLocalIP();
                    const desktopToken = generateAccessToken();
                    const mobileToken = generateAccessToken();
                    validTokens.add(desktopToken);
                    validTokens.add(mobileToken);

                    console.log('\nServer started successfully on port ' + currentPort + '!');
                    console.log('\n==================================');
                    console.log('Desktop Access:');
                    console.log('URL: http://localhost:' + currentPort + '/access?token=' + desktopToken);
                    console.log('Token: ' + desktopToken);
                    
                    console.log('\nMobile Access:');
                    console.log('URL: http://' + localIP + ':' + currentPort + '/mobile');
                    console.log('Alternate URL: http://' + localIP + ':' + currentPort + '/access?token=' + mobileToken);
                    console.log('Token: ' + mobileToken);
                    console.log('==================================\n');

                    console.log('Server Status:');
                    console.log(`- Port: ${currentPort}`);
                    console.log(`- Local IP: ${localIP}`);
                    console.log('- CORS: Enabled\n');

                    console.log('Mobile Access Tips:');
                    console.log('1. Connect mobile to "CG 2.4G" WiFi network');
                    console.log('2. If using Facebook browser, copy link to Chrome/Safari');
                    console.log('3. Or use the token shown above in the access page');
                    console.log('4. Clear browser cache if needed\n');

                    resolve(srv);
                });

                srv.on('error', reject);
            });

            global.server = server;
            return server;
        } catch (err) {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${currentPort} is in use, trying next port...`);
                currentPort++;
                attempts++;
            } else {
                throw err;
            }
        }
    }

    throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

// Clean up function to handle server shutdown
function cleanup() {
    console.log('\nShutting down server...');
    process.exit(0);
}

// Handle cleanup on process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start the server
startServer(PORT).catch(err => {
    console.error('\nFailed to start server:', err.message);
    process.exit(1);
});

// Helper function to get local IP
function getLocalIP() {
    const networkInterfaces = require('os').networkInterfaces();
    console.log('\nAvailable Network Interfaces:');
    
    for (const interfaceName in networkInterfaces) {
        console.log(`\nInterface: ${interfaceName}`);
        networkInterfaces[interfaceName].forEach((interface, index) => {
            if (interface.family === 'IPv4') {
                console.log(`  Address ${index + 1}: ${interface.address}`);
                if (interface.address !== '127.0.0.1' && !interface.internal) {
                    return interface.address;
                }
            }
        });
    }
    
    // Find the first non-internal IPv4 address
    for (const interfaces of Object.values(networkInterfaces)) {
        for (const interface of interfaces) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    
    return null;
}

// Handle process termination
process.on('exit', () => {
    if (global.server) {
        try {
            global.server.close();
        } catch (err) {
            console.error('Error closing server:', err);
        }
    }
});

// Improved error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Debug endpoint to verify server is reachable
app.get('/ping', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    console.log(`Ping received from ${clientIP}`);
    res.send('pong');
});

// Enhanced logging middleware
app.use((req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    console.log(`\nIncoming Request:`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`IP: ${clientIP}`);
    console.log(`Path: ${req.path}`);
    console.log(`User-Agent: ${userAgent}`);
    console.log(`Headers:`, req.headers);
    next();
});

// Health check endpoint with CORS enabled
app.options('*', cors());
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Redirect all page refreshes to home page
app.get('/*', (req, res) => {
    if (req.path !== '/' && !req.path.includes('.')) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(__dirname, '..', req.path === '/' ? 'index.html' : req.path));
    }
});

// Handle favicon.ico requests
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content response for favicon
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

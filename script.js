document.addEventListener('DOMContentLoaded', function() {
    // Redirect to home page on refresh
    if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD) {
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        }
    }

    // Typed.js initialization (only on home page)
    if (document.querySelector('.typed-text')) {
        const typed = new Typed('.typed-text', {
            strings: ['Web Developer', 'UI Designer', 'Full Stack Developer', 'Problem Solver'],
            typeSpeed: 50,
            backSpeed: 30,
            loop: true,
            backDelay: 1500,
            cursorChar: '|'
        });
    }

    // Project cards hover effect
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Button hover animation
    const buttons = document.querySelectorAll('.cta-button, .project-button, .submit-button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function(e) {
            const x = e.pageX - this.offsetLeft;
            const y = e.pageY - this.offsetTop;
            
            const ripple = document.createElement('span');
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Navigation button animation
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            
            // Remove flash from all buttons
            document.querySelectorAll('.nav-button').forEach(btn => {
                btn.classList.remove('flash');
                btn.offsetHeight; // Trigger reflow
            });
            
            // Add flash to clicked button
            this.classList.add('flash');
            
            // Navigate after animation
            setTimeout(() => {
                window.location.href = href;
            }, 800);
        });
    });

    // Get the base API URL
    function getApiBaseUrl() {
        const host = window.location.hostname;
        const port = 3000; 
        return `http://${host}:${port}`;
    }

    // Form submission with email functionality
    const contactForm = document.querySelector('#contactForm');
    if (contactForm) {
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const formMessage = document.getElementById('formMessage');
        let isSubmitting = false; // Flag to prevent multiple submissions

        // Function to update cooldown timer
        function updateCooldownTimer(timeLeft) {
            if (!timeLeft || timeLeft.totalMs <= 0) {
                if (formMessage) {
                    formMessage.textContent = '';
                }
                submitButton.disabled = false;
                submitButton.textContent = 'Send Message';
                isSubmitting = false;
                return;
            }

            // Calculate time components
            let totalSeconds = Math.ceil(timeLeft.totalMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            totalSeconds %= 3600;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            submitButton.disabled = true;
            submitButton.textContent = `Wait ${hours}h ${minutes}m ${seconds}s`;

            if (formMessage) {
                formMessage.textContent = `You can send another message in ${hours} hours, ${minutes} minutes, and ${seconds} seconds`;
                formMessage.style.color = '#64ffda'; 
            }

            if (timeLeft.totalMs > 1000) {
                setTimeout(() => {
                    updateCooldownTimer({
                        totalMs: timeLeft.totalMs - 1000
                    });
                }, 1000);
            } else {
                updateCooldownTimer({ totalMs: 0 });
            }
        }

        // Check cooldown status on page load
        async function checkCooldownStatus() {
            try {
                const response = await fetch(`${window.location.origin}/api/check-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                if (!data.canSendMessage && data.timeLeft) {
                    updateCooldownTimer(data.timeLeft);
                }
            } catch (error) {
                console.error('Error checking cooldown status:', error);
            }
        }

        // Check cooldown status immediately
        checkCooldownStatus();

        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Prevent multiple submissions
            if (isSubmitting || submitButton.disabled) {
                return;
            }

            const formData = {
                name: this.querySelector('input[name="name"]').value.trim(),
                email: this.querySelector('input[name="email"]').value.trim(),
                message: this.querySelector('textarea[name="message"]').value.trim()
            };

            // Basic validation
            if (!formData.name || !formData.email || !formData.message) {
                if (formMessage) {
                    formMessage.textContent = 'Please fill in all fields';
                    formMessage.style.color = '#ff6b6b';
                }
                return;
            }

            // Set submitting flag and disable button
            isSubmitting = true;
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';

            if (formMessage) {
                formMessage.textContent = 'Sending message...';
                formMessage.style.color = '#64ffda';
            }

            try {
                const response = await fetch(`${window.location.origin}/api/contact`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    this.reset();
                    if (formMessage) {
                        formMessage.textContent = 'Message sent successfully!';
                        formMessage.style.color = '#64ffda';
                    }
                    if (data.timeLeft) {
                        updateCooldownTimer(data.timeLeft);
                    }
                } else if (response.status === 429 && data.timeLeft) {
                    // Rate limit hit
                    updateCooldownTimer(data.timeLeft);
                } else {
                    throw new Error(data.error || 'Failed to send message');
                }
            } catch (error) {
                console.error('Error sending message:', error);
                
                if (formMessage) {
                    if (error.message.includes('Failed to fetch')) {
                        formMessage.textContent = 'Could not connect to server. Please check your network connection.';
                    } else {
                        formMessage.textContent = error.message || 'Could not send message. Please try again.';
                    }
                    formMessage.style.color = '#ff6b6b';
                }
                
                submitButton.textContent = 'Send Message';
                submitButton.disabled = false;
                isSubmitting = false;
            }
        });
    }
});

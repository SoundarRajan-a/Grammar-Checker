class GrammarChecker {
    constructor() {
        this.apiUrl = 'https://api.languagetool.org/v2/check';
        this.language = 'en-US';
        this.maxCharacters = 20000;
        this.debounceTimer = null;
        this.debounceDelay = 1500;
        
        this.errors = [];
        this.currentTheme = 'light';
        this.isChecking = false;
        
        this.initializeElements();
        this.initializeTheme();
        this.bindEvents();
        this.updateStats();
    }

    initializeElements() {
        // Theme elements
        this.themeToggle = document.getElementById('themeToggle');
        this.themeIcon = document.getElementById('themeIcon');
        
        // Editor elements
        this.textEditor = document.getElementById('textEditor');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        
        // Toolbar elements
        this.fixAllBtn = document.getElementById('fixAllBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.exportBtn = document.getElementById('exportBtn');
        
        // Stats elements
        this.wordCount = document.getElementById('wordCount');
        this.charCount = document.getElementById('charCount');
        
        // Error panel elements
        this.errorPanel = document.getElementById('errorPanel');
        this.panelToggle = document.getElementById('panelToggle');
        this.errorList = document.getElementById('errorList');
        this.noErrors = document.getElementById('noErrors');
        
        // Error counts
        this.grammarCount = document.getElementById('grammarCount');
        this.spellingCount = document.getElementById('spellingCount');
        this.styleCount = document.getElementById('styleCount');
        
        // Status elements
        this.apiStatus = document.getElementById('apiStatus');
        this.lastCheck = document.getElementById('lastCheck');
        
        // Tooltip elements
        this.suggestionTooltip = document.getElementById('suggestionTooltip');
        this.tooltipContent = document.getElementById('tooltipContent');
        this.tooltipClose = document.getElementById('tooltipClose');
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('grammar-checker-theme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        this.themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
        localStorage.setItem('grammar-checker-theme', theme);
    }

    bindEvents() {
        // Theme toggle
        this.themeToggle.addEventListener('click', () => {
            const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
            this.setTheme(newTheme);
        });

        // Text editor events
        this.textEditor.addEventListener('input', () => {
            this.updateStats();
            this.debounceGrammarCheck();
        });

        this.textEditor.addEventListener('paste', () => {
            setTimeout(() => {
                this.updateStats();
                this.debounceGrammarCheck();
            }, 100);
        });

        // Toolbar events
        this.fixAllBtn.addEventListener('click', () => this.fixAllErrors());
        this.clearBtn.addEventListener('click', () => this.clearText());
        this.exportBtn.addEventListener('click', () => this.exportText());

        // Panel toggle
        this.panelToggle.addEventListener('click', () => this.toggleErrorPanel());

        // Tooltip close
        this.tooltipClose.addEventListener('click', () => this.hideTooltip());

        // Click outside to close tooltip
        document.addEventListener('click', (e) => {
            if (!this.suggestionTooltip.contains(e.target) && !e.target.classList.contains('error-highlight')) {
                this.hideTooltip();
            }
        });

        // Handle error highlight clicks
        this.textEditor.addEventListener('click', (e) => {
            if (e.target.classList.contains('error-highlight')) {
                this.showSuggestionTooltip(e.target);
            }
        });
    }

    updateStats() {
        const text = this.getPlainText();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const characters = text.length;

        this.wordCount.textContent = words.toLocaleString();
        this.charCount.textContent = characters.toLocaleString();
    }

    getPlainText() {
        // Get text content, preserving line breaks but removing HTML
        return this.textEditor.textContent || this.textEditor.innerText || '';
    }

    debounceGrammarCheck() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.checkGrammar();
        }, this.debounceDelay);
    }

    async checkGrammar() {
        const text = this.getPlainText();
        
        if (!text.trim()) {
            this.clearErrors();
            return;
        }

        if (text.length > this.maxCharacters) {
            this.showError(`Text is too long. Maximum ${this.maxCharacters.toLocaleString()} characters allowed.`);
            return;
        }

        this.setLoadingState(true);
        this.apiStatus.textContent = 'Checking...';

        try {
            // Use URLSearchParams for better compatibility
            const params = new URLSearchParams();
            params.append('text', text);
            params.append('language', this.language);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.processGrammarResults(data.matches || []);
            
            this.apiStatus.textContent = 'Ready';
            this.lastCheck.textContent = new Date().toLocaleTimeString();
            
        } catch (error) {
            console.error('Grammar check failed:', error);
            this.apiStatus.textContent = 'API Error';
            
            // Fallback: Create some demo errors for testing
            this.createDemoErrors(text);
        } finally {
            this.setLoadingState(false);
        }
    }

    // Fallback method to create demo errors when API is unavailable
    createDemoErrors(text) {
        const demoErrors = [];
        
        // Simple error detection patterns for demo purposes
        const patterns = [
            {
                regex: /\bteh\b/gi,
                message: 'Possible spelling mistake found.',
                suggestions: ['the'],
                category: 'spelling'
            },
            {
                regex: /\byour\s+welcome\b/gi,
                message: "Use 'you're' (you are) instead of 'your' (possessive).",
                suggestions: ["you're welcome"],
                category: 'grammar'
            },
            {
                regex: /\bits\s+a\s+nice\s+day\b/gi,
                message: "Consider using 'it's' (it is) instead of 'its' (possessive).",
                suggestions: ["it's a nice day"],
                category: 'grammar'
            },
            {
                regex: /\bthat\s+that\b/gi,
                message: 'Possible word repetition.',
                suggestions: ['that'],
                category: 'style'
            }
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                demoErrors.push({
                    offset: match.index,
                    length: match[0].length,
                    message: pattern.message,
                    shortMessage: pattern.message,
                    suggestions: pattern.suggestions,
                    category: pattern.category,
                    rule: 'demo-rule',
                    context: {
                        text: text.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20),
                        offset: Math.min(20, match.index),
                        length: match[0].length
                    }
                });
            }
        });

        this.errors = demoErrors;
        this.processErrors();
        this.apiStatus.textContent = 'Demo Mode';
    }

    processGrammarResults(matches) {
        this.errors = matches.map(match => ({
            offset: match.offset,
            length: match.length,
            message: match.message,
            shortMessage: match.shortMessage || match.message,
            suggestions: match.replacements ? match.replacements.slice(0, 3).map(r => r.value) : [],
            category: this.categorizeError(match),
            rule: match.rule?.id || 'unknown',
            context: match.context
        }));

        this.processErrors();
    }

    processErrors() {
        this.highlightErrors();
        this.updateErrorPanel();
        this.updateErrorCounts();
        this.updateFixAllButton();
    }

    categorizeError(match) {
        const category = match.rule?.category?.id || '';
        const issueType = match.rule?.issueType || '';
        
        if (category.includes('TYPOS') || issueType === 'misspelling') {
            return 'spelling';
        } else if (category.includes('STYLE') || issueType === 'style') {
            return 'style';
        } else {
            return 'grammar';
        }
    }

    highlightErrors() {
        const text = this.getPlainText();
        if (!text || this.errors.length === 0) {
            this.textEditor.innerHTML = this.escapeHtml(text);
            return;
        }

        let htmlContent = '';
        let lastOffset = 0;

        // Sort errors by offset to process them in order
        const sortedErrors = [...this.errors].sort((a, b) => a.offset - b.offset);

        sortedErrors.forEach((error, index) => {
            // Add text before error
            htmlContent += this.escapeHtml(text.substring(lastOffset, error.offset));
            
            // Add highlighted error
            const errorText = text.substring(error.offset, error.offset + error.length);
            htmlContent += `<span class="error-highlight ${error.category}" data-error-index="${index}" title="${this.escapeHtml(error.shortMessage)}">${this.escapeHtml(errorText)}</span>`;
            
            lastOffset = error.offset + error.length;
        });

        // Add remaining text
        htmlContent += this.escapeHtml(text.substring(lastOffset));

        this.textEditor.innerHTML = htmlContent;
    }

    updateErrorPanel() {
        if (this.errors.length === 0) {
            this.errorList.innerHTML = '';
            this.errorList.appendChild(this.noErrors);
            this.noErrors.style.display = 'block';
            return;
        }

        this.noErrors.style.display = 'none';
        
        const errorsByCategory = {
            grammar: this.errors.filter(e => e.category === 'grammar'),
            spelling: this.errors.filter(e => e.category === 'spelling'),
            style: this.errors.filter(e => e.category === 'style')
        };

        let html = '';
        
        Object.entries(errorsByCategory).forEach(([category, errors]) => {
            if (errors.length > 0) {
                errors.forEach((error, index) => {
                    const globalIndex = this.errors.indexOf(error);
                    html += this.createErrorCard(error, globalIndex, category);
                });
            }
        });

        this.errorList.innerHTML = html;
        this.bindErrorCardEvents();
    }

    createErrorCard(error, index, category) {
        const suggestions = error.suggestions.map(suggestion => 
            `<span class="suggestion-chip" data-suggestion="${this.escapeHtml(suggestion)}" data-error-index="${index}">${this.escapeHtml(suggestion)}</span>`
        ).join('');

        const contextText = error.context?.text || '';
        const contextPreview = contextText.length > 50 ? contextText.substring(0, 50) + '...' : contextText;

        return `
            <div class="error-card ${category}" data-error-index="${index}">
                <div class="error-card-header">
                    <span class="error-type ${category}">${category}</span>
                </div>
                <div class="error-message">${this.escapeHtml(error.shortMessage)}</div>
                ${contextPreview ? `<div class="error-context" style="font-size: 0.75rem; color: var(--paper-text-muted); margin: 0.5rem 0; font-style: italic;">"${this.escapeHtml(contextPreview)}"</div>` : ''}
                ${suggestions ? `<div class="error-suggestions">${suggestions}</div>` : ''}
                <div class="error-actions">
                    <button class="btn btn-sm btn--primary fix-error-btn" data-error-index="${index}">
                        ${error.suggestions.length > 0 ? 'Fix' : 'Skip'}
                    </button>
                </div>
            </div>
        `;
    }

    bindErrorCardEvents() {
        // Error card click - navigate to error
        this.errorList.querySelectorAll('.error-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('suggestion-chip') && !e.target.classList.contains('fix-error-btn')) {
                    const errorIndex = parseInt(card.dataset.errorIndex);
                    this.navigateToError(errorIndex);
                }
            });
        });

        // Suggestion chip click
        this.errorList.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const errorIndex = parseInt(chip.dataset.errorIndex);
                const suggestion = chip.dataset.suggestion;
                this.applySuggestion(errorIndex, suggestion);
            });
        });

        // Fix button click
        this.errorList.querySelectorAll('.fix-error-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const errorIndex = parseInt(btn.dataset.errorIndex);
                this.fixError(errorIndex);
            });
        });
    }

    navigateToError(errorIndex) {
        const errorElement = this.textEditor.querySelector(`[data-error-index="${errorIndex}"]`);
        if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight the error temporarily
            const originalBg = errorElement.style.backgroundColor;
            errorElement.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
            errorElement.style.transition = 'background-color 0.3s ease';
            
            setTimeout(() => {
                errorElement.style.backgroundColor = originalBg;
            }, 2000);
        }
    }

    fixError(errorIndex) {
        const error = this.errors[errorIndex];
        if (error && error.suggestions.length > 0) {
            this.applySuggestion(errorIndex, error.suggestions[0]);
        }
    }

    applySuggestion(errorIndex, suggestion) {
        const error = this.errors[errorIndex];
        if (!error) return;

        const text = this.getPlainText();
        const before = text.substring(0, error.offset);
        const after = text.substring(error.offset + error.length);
        const newText = before + suggestion + after;

        this.textEditor.textContent = newText;
        this.updateStats();
        
        // Recheck grammar after applying suggestion
        setTimeout(() => {
            this.debounceGrammarCheck();
        }, 500);
    }

    fixAllErrors() {
        if (this.errors.length === 0) return;

        let text = this.getPlainText();
        
        // Sort errors by offset in reverse order to avoid offset changes
        const sortedErrors = [...this.errors].sort((a, b) => b.offset - a.offset);
        
        sortedErrors.forEach(error => {
            if (error.suggestions.length > 0) {
                const before = text.substring(0, error.offset);
                const after = text.substring(error.offset + error.length);
                text = before + error.suggestions[0] + after;
            }
        });

        this.textEditor.textContent = text;
        this.updateStats();
        
        // Recheck grammar after applying all suggestions
        setTimeout(() => {
            this.debounceGrammarCheck();
        }, 500);
    }

    updateErrorCounts() {
        const counts = {
            grammar: this.errors.filter(e => e.category === 'grammar').length,
            spelling: this.errors.filter(e => e.category === 'spelling').length,
            style: this.errors.filter(e => e.category === 'style').length
        };

        this.grammarCount.textContent = counts.grammar;
        this.spellingCount.textContent = counts.spelling;
        this.styleCount.textContent = counts.style;
    }

    updateFixAllButton() {
        const hasFixableErrors = this.errors.some(error => error.suggestions.length > 0);
        this.fixAllBtn.disabled = !hasFixableErrors;
    }

    showSuggestionTooltip(element) {
        const errorIndex = parseInt(element.dataset.errorIndex);
        const error = this.errors[errorIndex];
        
        if (!error) return;

        let html = `
            <div class="error-message" style="margin-bottom: 1rem;">${this.escapeHtml(error.message)}</div>
        `;

        if (error.suggestions.length > 0) {
            html += '<div class="error-suggestions">';
            error.suggestions.forEach(suggestion => {
                html += `<span class="suggestion-chip" data-suggestion="${this.escapeHtml(suggestion)}" data-error-index="${errorIndex}">${this.escapeHtml(suggestion)}</span>`;
            });
            html += '</div>';
        } else {
            html += '<p style="color: var(--paper-text-muted); font-size: 0.875rem; margin: 0;">No suggestions available</p>';
        }

        this.tooltipContent.innerHTML = html;

        // Position tooltip
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.suggestionTooltip.getBoundingClientRect();
        
        let left = rect.left;
        let top = rect.bottom + 10;
        
        // Adjust if tooltip would go off screen
        if (left + 300 > window.innerWidth) {
            left = window.innerWidth - 320;
        }
        if (top + 150 > window.innerHeight) {
            top = rect.top - 160;
        }
        
        this.suggestionTooltip.style.left = `${left}px`;
        this.suggestionTooltip.style.top = `${top}px`;
        
        this.suggestionTooltip.classList.add('active');

        // Bind suggestion clicks in tooltip
        this.tooltipContent.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const errorIndex = parseInt(chip.dataset.errorIndex);
                const suggestion = chip.dataset.suggestion;
                this.applySuggestion(errorIndex, suggestion);
                this.hideTooltip();
            });
        });
    }

    hideTooltip() {
        this.suggestionTooltip.classList.remove('active');
    }

    toggleErrorPanel() {
        this.errorPanel.classList.toggle('collapsed');
        const icon = this.panelToggle.querySelector('.toggle-icon');
        icon.textContent = this.errorPanel.classList.contains('collapsed') ? '»' : '«';
    }

    clearText() {
        this.textEditor.textContent = '';
        this.clearErrors();
        this.updateStats();
        this.apiStatus.textContent = 'Ready';
        this.lastCheck.textContent = 'Never checked';
    }

    clearErrors() {
        this.errors = [];
        const text = this.getPlainText();
        this.textEditor.innerHTML = this.escapeHtml(text);
        this.updateErrorPanel();
        this.updateErrorCounts();
        this.updateFixAllButton();
        this.hideTooltip();
    }

    exportText() {
        const text = this.getPlainText();
        if (!text.trim()) {
            alert('No text to export');
            return;
        }

        try {
            navigator.clipboard.writeText(text).then(() => {
                this.showTemporaryMessage('Text copied to clipboard!');
            }).catch(() => {
                // Fallback for browsers that don't support clipboard API
                this.fallbackCopyToClipboard(text);
            });
        } catch (error) {
            this.fallbackCopyToClipboard(text);
        }
    }

    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showTemporaryMessage('Text copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy text to clipboard');
        }
        
        document.body.removeChild(textArea);
    }

    showTemporaryMessage(message) {
        const originalText = this.exportBtn.innerHTML;
        this.exportBtn.innerHTML = `<span class="btn-icon">✅</span>${message}`;
        this.exportBtn.disabled = true;
        
        setTimeout(() => {
            this.exportBtn.innerHTML = originalText;
            this.exportBtn.disabled = false;
        }, 2000);
    }

    setLoadingState(isLoading) {
        this.isChecking = isLoading;
        if (isLoading) {
            this.loadingIndicator.classList.add('active');
        } else {
            this.loadingIndicator.classList.remove('active');
        }
    }

    showError(message) {
        console.error(message);
        this.apiStatus.textContent = 'Error';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the grammar checker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GrammarChecker();
});

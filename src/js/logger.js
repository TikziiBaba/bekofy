/**
 * Central Logger Module for Bekofy
 * Browser-safe: checks for process before using it
 */
var Logger = {
    /**
     * Log error messages
     * @param {string} message 
     * @param {*} [data] 
     */
    error(message, data) {
        if (typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL === 'debug') {
            console.error(`[Bekofy] ${message}`, data || '');
        } else if (typeof process === 'undefined' || !process.env || process.env.NODE_ENV === 'development') {
            console.error(`[Bekofy] ${message}`, data || '');
        }
    },

    /**
     * Log warning messages
     * @param {string} message 
     * @param {*} [data] 
     */
    warn(message, data) {
        if (typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL === 'debug') {
            console.warn(`[Bekofy] ${message}`, data || '');
        } else if (typeof process === 'undefined' || !process.env || process.env.NODE_ENV === 'development') {
            console.warn(`[Bekofy] ${message}`, data || '');
        }
    },

    /**
     * Log info messages
     * @param {string} message 
     * @param {*} [data] 
     */
    info(message, data) {
        if (typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL === 'debug') {
            console.log(`[Bekofy] ${message}`, data || '');
        } else if (typeof process === 'undefined' || !process.env || process.env.NODE_ENV === 'development') {
            console.log(`[Bekofy] ${message}`, data || '');
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}
// cf-security.js - Security module for Codice Fiscale
// GDPR Compliant - Encryption & Hashing - Audit Logging
// Zero dependencies - Web Crypto API

class CFSecurity {
    /**
     * Hasha un codice fiscale con SHA-256
     * Utilizzato per storage sicuro e confronti
     * @param {string} cf - Codice fiscale da hashare
     * @returns {Promise<string>} Hash base64
     */
    static async hashCF(cf) {
        try {
            if (!cf) return null;

            const encoder = new TextEncoder();
            const data = encoder.encode(cf.toUpperCase().trim());
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            return hashHex;
        } catch (error) {
            console.error('❌ Errore hashing CF:', error);
            return null;
        }
    }

    /**
     * Verifica se due CF sono equivalenti (gestisce omocodes)
     * @param {string} cf1 - Primo CF
     * @param {string} cf2 - Secondo CF
     * @param {CodiceFiscaleCalculator} calculator - Instance del calculator
     * @returns {boolean} True se equivalenti
     */
    static areEquivalent(cf1, cf2, calculator) {
        if (!cf1 || !cf2) return false;

        const normalized1 = cf1.toUpperCase().trim();
        const normalized2 = cf2.toUpperCase().trim();

        // Confronto diretto
        if (normalized1 === normalized2) return true;

        // Confronto deomocoded (gestisce omocodes)
        if (calculator && calculator.deomocode) {
            const deomocode1 = calculator.deomocode(normalized1);
            const deomocode2 = calculator.deomocode(normalized2);
            return deomocode1 === deomocode2;
        }

        return false;
    }

    /**
     * Sanitizza input per prevenire injection
     * @param {string} input - Input da sanitizzare
     * @returns {string} Input sanitizzato
     */
    static sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';

        return input
            .replace(/[<>\"'`]/g, '')           // Rimuovi caratteri HTML/script
            .replace(/[^\w\s\-'àèéìòù]/gi, '') // Solo alfanumerici + spazi + accenti comuni
            .trim()
            .substring(0, 200);                 // Limita lunghezza
    }

    /**
     * Valida input nome/cognome
     * @param {string} name - Nome o cognome
     * @returns {object} { valid: boolean, error: string }
     */
    static validateName(name) {
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Nome/cognome vuoto' };
        }

        const sanitized = this.sanitizeInput(name);
        if (sanitized.length < 2) {
            return { valid: false, error: 'Nome/cognome troppo corto' };
        }

        if (sanitized.length > 50) {
            return { valid: false, error: 'Nome/cognome troppo lungo' };
        }

        // Solo lettere, spazi, apostrofi, trattini
        if (!/^[A-Za-zÀ-ÿ\s\-']+$/.test(sanitized)) {
            return { valid: false, error: 'Caratteri non validi nel nome' };
        }

        return { valid: true, sanitized };
    }

    /**
     * Valida data di nascita
     * @param {string} date - Data in formato YYYY-MM-DD o Date object
     * @returns {object} { valid: boolean, error: string, date: Date }
     */
    static validateBirthDate(date) {
        try {
            const birthDate = date instanceof Date ? date : new Date(date);

            if (isNaN(birthDate.getTime())) {
                return { valid: false, error: 'Data non valida' };
            }

            const now = new Date();
            const minDate = new Date('1861-01-01'); // Unificazione d'Italia

            if (birthDate > now) {
                return { valid: false, error: 'Data di nascita nel futuro' };
            }

            if (birthDate < minDate) {
                return { valid: false, error: 'Data di nascita troppo antica' };
            }

            const age = (now - birthDate) / (365.25 * 24 * 60 * 60 * 1000);
            if (age > 120) {
                return { valid: false, error: 'Età non reale (> 120 anni)' };
            }

            return { valid: true, date: birthDate };

        } catch (error) {
            return { valid: false, error: 'Errore validazione data' };
        }
    }

    /**
     * Log audit per operazioni CF (GDPR compliance)
     * @param {string} operation - Tipo operazione (calculate, validate, save)
     * @param {object} data - Dati operazione
     */
    static logAudit(operation, data) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            operation,
            user: data.user || 'anonymous',
            cfHash: data.cfHash || null,  // Solo hash, mai CF in chiaro
            success: data.success !== false,
            ip: data.ip || null
        };

        // In produzione: salvare in database o log server
        // Per ora: console log
        console.log('📋 Audit CF:', auditEntry);

        // Optional: salva in localStorage per audit locale
        try {
            const auditLog = JSON.parse(localStorage.getItem('cf_audit_log') || '[]');
            auditLog.push(auditEntry);

            // Mantieni solo ultimi 100 record
            if (auditLog.length > 100) {
                auditLog.shift();
            }

            localStorage.setItem('cf_audit_log', JSON.stringify(auditLog));
        } catch (e) {
            // Ignora errori localStorage
        }
    }

    /**
     * Genera un ID unico per tracking operazioni
     * @returns {string} UUID v4
     */
    static generateOperationId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Rate limiting per prevenire abusi
     * @param {string} operation - Nome operazione
     * @param {number} maxRequests - Max richieste per finestra
     * @param {number} windowMs - Finestra temporale in ms
     * @returns {boolean} True se permesso, false se rate limit superato
     */
    static checkRateLimit(operation, maxRequests = 100, windowMs = 60000) {
        try {
            const key = `cf_ratelimit_${operation}`;
            const now = Date.now();

            const data = JSON.parse(localStorage.getItem(key) || '{"requests":[],"blocked":0}');

            // Rimuovi richieste fuori dalla finestra temporale
            data.requests = data.requests.filter(t => now - t < windowMs);

            // Controlla limite
            if (data.requests.length >= maxRequests) {
                data.blocked++;
                localStorage.setItem(key, JSON.stringify(data));
                console.warn(`⚠️ Rate limit superato per operazione: ${operation}`);
                return false;
            }

            // Aggiungi richiesta corrente
            data.requests.push(now);
            localStorage.setItem(key, JSON.stringify(data));

            return true;

        } catch (e) {
            // In caso di errore, permetti operazione
            return true;
        }
    }

    /**
     * Mascheramento parziale CF per display sicuro
     * @param {string} cf - Codice fiscale
     * @returns {string} CF mascherato (es. RSSMRA85***H501Y)
     */
    static maskCF(cf) {
        if (!cf || cf.length !== 16) return '***';

        // Mostra solo prime 8 e ultime 3 lettere
        return cf.substring(0, 8) + '***' + cf.substring(13);
    }

    /**
     * Verifica integrità dati CF prima del salvataggio
     * @param {object} cfData - Dati CF completi
     * @returns {object} { valid: boolean, errors: array }
     */
    static validateCFData(cfData) {
        const errors = [];

        // Verifica campi obbligatori
        const required = ['nome', 'cognome', 'sesso', 'dataNascita', 'luogoNascita'];
        for (const field of required) {
            if (!cfData[field]) {
                errors.push(`Campo obbligatorio mancante: ${field}`);
            }
        }

        // Valida nome
        const nameValidation = this.validateName(cfData.nome);
        if (!nameValidation.valid) {
            errors.push(`Nome: ${nameValidation.error}`);
        }

        // Valida cognome
        const surnameValidation = this.validateName(cfData.cognome);
        if (!surnameValidation.valid) {
            errors.push(`Cognome: ${surnameValidation.error}`);
        }

        // Valida sesso
        if (!['M', 'F'].includes(cfData.sesso)) {
            errors.push('Sesso deve essere M o F');
        }

        // Valida data nascita
        const dateValidation = this.validateBirthDate(cfData.dataNascita);
        if (!dateValidation.valid) {
            errors.push(`Data nascita: ${dateValidation.error}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Prepara dati CF per salvataggio sicuro (GDPR)
     * @param {string} cf - Codice fiscale
     * @param {object} metadata - Metadati opzionali
     * @returns {Promise<object>} Dati preparati per storage
     */
    static async prepareForStorage(cf, metadata = {}) {
        const hash = await this.hashCF(cf);

        return {
            cf_hash: hash,                      // Hash per confronti
            cf_masked: this.maskCF(cf),         // Versione mascherata per display
            timestamp: new Date().toISOString(),
            metadata: {
                calculated: metadata.calculated || false,
                validated: metadata.validated || false,
                source: metadata.source || 'manual'
            }
        };
    }
}

// Export per utilizzo globale
window.CFSecurity = CFSecurity;

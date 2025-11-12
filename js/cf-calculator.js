// cf-calculator.js - Calcolo e Validazione Codice Fiscale Italiano
// Implementazione standalone enterprise-grade
// Zero dipendenze esterne - Performance ottimizzate
// GDPR compliant - Omocodia support

class CodiceFiscaleCalculator {
    constructor() {
        this.belfioreData = null;
        this.belfioreIndex = {
            byCode: new Map(),     // O(1) lookup per codice
            byName: new Map(),      // O(1) lookup per nome
            byProvince: new Map()   // O(1) lookup per provincia
        };
        this.cache = new Map();     // Memoization cache
        this.isReady = false;

        // Tabelle per calcolo check digit
        this.ODD_VALUES = {
            '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
            'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
            'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
            'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
        };

        this.EVEN_VALUES = {
            '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
            'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
            'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
        };

        this.CHECK_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        this.MONTH_LETTERS = {
            1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'H',
            7: 'L', 8: 'M', 9: 'P', 10: 'R', 11: 'S', 12: 'T'
        };

        // Mapping omocodia
        this.OMOCODIA_MAP = {
            '0': 'L', '1': 'M', '2': 'N', '3': 'P', '4': 'Q',
            '5': 'R', '6': 'S', '7': 'T', '8': 'U', '9': 'V'
        };
    }

    /**
     * Inizializza il calculator caricando il database Belfiore
     */
    async init() {
        if (this.isReady) return;

        console.log('🔄 Inizializzazione CF Calculator...');
        const startTime = performance.now();

        try {
            // Carica database Belfiore da GitHub Pages
            const response = await fetch('https://contattisilvestri.github.io/SIAF/DATA/belfiore-comuni.json');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Database non trovato su GitHub Pages. Verifica che il file belfiore-comuni.json sia stato caricato in /DATA/`);
            }

            this.belfioreData = await response.json();

            if (!this.belfioreData || this.belfioreData.length === 0) {
                throw new Error('Database Belfiore vuoto o non valido');
            }

            // Costruisci indici in-memory per lookup O(1)
            this.buildBelfioreIndex();

            this.isReady = true;
            const loadTime = (performance.now() - startTime).toFixed(2);
            console.log(`✅ CF Calculator ready in ${loadTime}ms`);
            console.log(`   - Comuni indicizzati: ${this.belfioreIndex.byCode.size}`);

        } catch (error) {
            console.error('❌ Errore inizializzazione CF Calculator:', error);
            throw error;
        }
    }

    /**
     * Costruisce indici in-memory per lookup O(1)
     */
    buildBelfioreIndex() {
        this.belfioreData.forEach(comune => {
            const code = comune.codiceCatastale;
            // Normalizza: lowercase + trim + rimuovi spazi multipli
            const name = comune.nome.toLowerCase().trim().replace(/\s+/g, ' ');
            const province = comune.sigla;

            // Indice per codice
            this.belfioreIndex.byCode.set(code, comune);

            // Indice per nome (può avere duplicati)
            if (!this.belfioreIndex.byName.has(name)) {
                this.belfioreIndex.byName.set(name, []);
            }
            this.belfioreIndex.byName.get(name).push(comune);

            // Indice per provincia
            if (!this.belfioreIndex.byProvince.has(province)) {
                this.belfioreIndex.byProvince.set(province, []);
            }
            this.belfioreIndex.byProvince.get(province).push(comune);
        });
    }

    /**
     * Normalizza una stringa rimuovendo accenti e caratteri speciali
     */
    normalizeName(str) {
        if (!str) return '';

        return str
            .normalize('NFD')                     // Decompone caratteri accentati
            .replace(/[\u0300-\u036f]/g, '')     // Rimuove diacritici
            .replace(/['\-\s]/g, '')              // Rimuove apostrofi, trattini, spazi
            .toUpperCase()                        // Maiuscolo
            .trim();
    }

    /**
     * Estrae consonanti da una stringa
     */
    extractConsonants(str) {
        const normalized = this.normalizeName(str);
        return normalized.replace(/[AEIOU]/g, '');
    }

    /**
     * Estrae vocali da una stringa
     */
    extractVowels(str) {
        const normalized = this.normalizeName(str);
        return normalized.replace(/[^AEIOU]/g, '');
    }

    /**
     * Calcola i 3 caratteri del cognome
     */
    getSurnameCode(surname) {
        const consonants = this.extractConsonants(surname);
        const vowels = this.extractVowels(surname);

        let code = consonants.substring(0, 3);
        if (code.length < 3) {
            code += vowels.substring(0, 3 - code.length);
        }
        if (code.length < 3) {
            code += 'X'.repeat(3 - code.length);
        }

        return code;
    }

    /**
     * Calcola i 3 caratteri del nome
     * ATTENZIONE: Se ci sono 4+ consonanti, prende 1°, 3°, 4° (salta il 2°)
     */
    getNameCode(name) {
        const consonants = this.extractConsonants(name);
        const vowels = this.extractVowels(name);

        let code;
        if (consonants.length >= 4) {
            // Regola speciale: prendi 1°, 3°, 4° consonante
            code = consonants[0] + consonants[2] + consonants[3];
        } else if (consonants.length >= 3) {
            code = consonants.substring(0, 3);
        } else {
            code = consonants + vowels.substring(0, 3 - consonants.length);
        }

        if (code.length < 3) {
            code += 'X'.repeat(3 - code.length);
        }

        return code;
    }

    /**
     * Calcola i 2 caratteri dell'anno
     */
    getYearCode(year) {
        return String(year).substring(2, 4);
    }

    /**
     * Calcola il carattere del mese
     */
    getMonthCode(month) {
        return this.MONTH_LETTERS[month] || 'A';
    }

    /**
     * Calcola i 2 caratteri del giorno + genere
     * Maschi: giorno normale (01-31)
     * Femmine: giorno + 40 (41-71)
     */
    getDayGenderCode(day, gender) {
        const dayNum = parseInt(day, 10);
        const adjustedDay = gender === 'F' ? dayNum + 40 : dayNum;
        return String(adjustedDay).padStart(2, '0');
    }

    /**
     * Cerca il codice Belfiore per un comune
     */
    findBelfioreCode(cityName, province = null) {
        // Normalizza: lowercase + trim + rimuovi spazi multipli
        const normalizedCity = cityName.toLowerCase().trim().replace(/\s+/g, ' ');

        // Lookup per nome
        const matches = this.belfioreIndex.byName.get(normalizedCity) || [];

        if (matches.length === 0) {
            // DEBUG: Mostra comuni simili per aiutare l'utente
            console.warn(`❌ Comune "${cityName}" non trovato`);
            console.warn(`   Normalizzato come: "${normalizedCity}"`);
            console.warn(`   Tot comuni in indice: ${this.belfioreIndex.byName.size}`);

            // Cerca comuni che iniziano con le stesse lettere
            const similar = [];
            for (const [name, comuni] of this.belfioreIndex.byName.entries()) {
                if (name.startsWith(normalizedCity.substring(0, 10))) {
                    similar.push(name);
                }
            }
            if (similar.length > 0) {
                console.warn(`   Comuni simili trovati: ${similar.slice(0, 5).join(', ')}`);
            }

            return { error: `Comune "${cityName}" non trovato nel database` };
        }

        if (matches.length === 1) {
            return { code: matches[0].codiceCatastale, comune: matches[0] };
        }

        // Ambiguità: più comuni con stesso nome
        if (province) {
            const match = matches.find(c => c.sigla === province.toUpperCase());
            if (match) {
                return { code: match.codiceCatastale, comune: match };
            }
        }

        return {
            error: `Ambiguità: trovati ${matches.length} comuni con nome "${cityName}"`,
            matches: matches.map(c => ({ nome: c.nome, provincia: c.sigla, codice: c.codiceCatastale }))
        };
    }

    /**
     * Calcola il check digit (16° carattere)
     */
    calculateCheckDigit(first15) {
        let sum = 0;

        // Posizioni dispari (1-indexed: 1, 3, 5, ... 15) → 0-indexed: 0, 2, 4, ... 14
        for (let i = 0; i < 15; i += 2) {
            sum += this.ODD_VALUES[first15[i]];
        }

        // Posizioni pari (1-indexed: 2, 4, 6, ... 14) → 0-indexed: 1, 3, 5, ... 13
        for (let i = 1; i < 15; i += 2) {
            sum += this.EVEN_VALUES[first15[i]];
        }

        const remainder = sum % 26;
        return this.CHECK_LETTERS[remainder];
    }

    /**
     * Calcola il codice fiscale da dati anagrafici
     */
    calculate(data) {
        try {
            // Validazione input
            const required = ['nome', 'cognome', 'sesso', 'dataNascita', 'luogoNascita'];
            for (const field of required) {
                if (!data[field]) {
                    return {
                        success: false,
                        error: `Campo obbligatorio mancante: ${field}`
                    };
                }
            }

            // Cache check
            const cacheKey = JSON.stringify(data);
            if (this.cache.has(cacheKey)) {
                console.log('✨ CF trovato in cache');
                return this.cache.get(cacheKey);
            }

            // Parse data di nascita
            const birthDate = new Date(data.dataNascita);
            const day = birthDate.getDate();
            const month = birthDate.getMonth() + 1;
            const year = birthDate.getFullYear();

            // Calcola componenti CF
            const surname = this.getSurnameCode(data.cognome);
            const name = this.getNameCode(data.nome);
            const yearCode = this.getYearCode(year);
            const monthCode = this.getMonthCode(month);
            const dayGender = this.getDayGenderCode(day, data.sesso);

            // Cerca codice Belfiore
            const belfioreResult = this.findBelfioreCode(data.luogoNascita, data.provincia);

            if (belfioreResult.error) {
                return {
                    success: false,
                    error: belfioreResult.error,
                    matches: belfioreResult.matches
                };
            }

            const belfioreCode = belfioreResult.code;

            // Primi 15 caratteri
            const first15 = surname + name + yearCode + monthCode + dayGender + belfioreCode;

            // Calcola check digit
            const checkDigit = this.calculateCheckDigit(first15);

            // Codice fiscale completo
            const cf = first15 + checkDigit;

            const result = {
                success: true,
                cf: cf,
                isOmocode: false,
                warnings: [],
                components: {
                    surname,
                    name,
                    year: yearCode,
                    month: monthCode,
                    dayGender,
                    birthplace: belfioreCode,
                    checkDigit
                }
            };

            // Salva in cache
            this.cache.set(cacheKey, result);

            return result;

        } catch (error) {
            return {
                success: false,
                error: `Errore calcolo CF: ${error.message}`
            };
        }
    }

    /**
     * Valida un codice fiscale
     */
    validate(cf) {
        const errors = [];
        const warnings = [];

        if (!cf || typeof cf !== 'string') {
            return { valid: false, errors: ['Codice fiscale non fornito'] };
        }

        const cfUpper = cf.toUpperCase().trim();

        // Validazione formato
        const formatRegex = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
        if (!formatRegex.test(cfUpper)) {
            errors.push('Formato codice fiscale non valido');
        }

        if (cfUpper.length !== 16) {
            errors.push('Lunghezza errata (deve essere 16 caratteri)');
        }

        if (errors.length > 0) {
            return { valid: false, errors, warnings };
        }

        // Validazione check digit
        const first15 = cfUpper.substring(0, 15);
        const providedCheck = cfUpper[15];
        const calculatedCheck = this.calculateCheckDigit(first15);

        if (providedCheck !== calculatedCheck) {
            errors.push('Check digit non valido');
        }

        // Rilevamento omocodia
        const omocodeId = this.detectOmocode(cfUpper);
        if (omocodeId > 0) {
            warnings.push(`Possibile omocode rilevato (variante ${omocodeId})`);
        }

        // Validazione data nascita
        try {
            const dateValidation = this.validateBirthDate(cfUpper);
            if (!dateValidation.valid) {
                errors.push(dateValidation.error);
            }
        } catch (e) {
            errors.push('Errore validazione data nascita');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            isOmocode: omocodeId > 0,
            omocodeId
        };
    }

    /**
     * Rileva se un CF è un omocode
     */
    detectOmocode(cf) {
        // Posizioni che possono essere sostituite: 6, 7, 9, 10, 12, 13, 14 (0-indexed)
        const omocodePositions = [6, 7, 9, 10, 12, 13, 14];
        let omocodeCount = 0;

        for (const pos of omocodePositions) {
            const char = cf[pos];
            // Se è una lettera nelle posizioni che dovrebbero essere numeri
            if (Object.values(this.OMOCODIA_MAP).includes(char)) {
                omocodeCount++;
            }
        }

        return omocodeCount;
    }

    /**
     * Decodifica un omocode alla versione originale
     */
    deomocode(cf) {
        if (!cf) return cf;

        const cfArray = cf.toUpperCase().split('');
        const omocodePositions = [6, 7, 9, 10, 12, 13, 14];
        const reverseMap = {};

        // Inverti mapping omocodia
        for (const [num, letter] of Object.entries(this.OMOCODIA_MAP)) {
            reverseMap[letter] = num;
        }

        // Sostituisci lettere omocode con numeri originali
        for (const pos of omocodePositions) {
            const char = cfArray[pos];
            if (reverseMap[char]) {
                cfArray[pos] = reverseMap[char];
            }
        }

        // Ricalcola check digit
        const first15 = cfArray.slice(0, 15).join('');
        const newCheck = this.calculateCheckDigit(first15);
        cfArray[15] = newCheck;

        return cfArray.join('');
    }

    /**
     * Valida la data di nascita estratta dal CF
     */
    validateBirthDate(cf) {
        try {
            // Estrai anno (posizioni 6-7)
            let yearStr = cf.substring(6, 8);
            // Decodifica se omocode
            yearStr = yearStr.split('').map(c => this.OMOCODIA_MAP[c] ?
                Object.keys(this.OMOCODIA_MAP).find(k => this.OMOCODIA_MAP[k] === c) : c).join('');

            const year = parseInt(yearStr, 10);
            const currentYear = new Date().getFullYear() % 100;
            const fullYear = year > currentYear ? 1900 + year : 2000 + year;

            // Estrai mese (posizione 8)
            const monthLetter = cf[8];
            const monthReverse = Object.entries(this.MONTH_LETTERS).find(([k, v]) => v === monthLetter);
            const month = monthReverse ? parseInt(monthReverse[0], 10) : 0;

            // Estrai giorno (posizioni 9-10)
            let dayStr = cf.substring(9, 11);
            // Decodifica se omocode
            dayStr = dayStr.split('').map(c => this.OMOCODIA_MAP[c] ?
                Object.keys(this.OMOCODIA_MAP).find(k => this.OMOCODIA_MAP[k] === c) : c).join('');

            let day = parseInt(dayStr, 10);
            const isFemale = day > 40;
            if (isFemale) day -= 40;

            // Valida data
            const date = new Date(fullYear, month - 1, day);

            if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
                return { valid: false, error: 'Data di nascita non valida' };
            }

            if (date > new Date()) {
                return { valid: false, error: 'Data di nascita nel futuro' };
            }

            if (fullYear < 1861) {
                return { valid: false, error: 'Data di nascita troppo antica' };
            }

            return { valid: true };

        } catch (e) {
            return { valid: false, error: 'Errore parsing data nascita' };
        }
    }
}

// Export per utilizzo globale
window.CodiceFiscaleCalculator = CodiceFiscaleCalculator;

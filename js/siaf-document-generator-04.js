// siaf-document-generator.js - Sistema generazione documenti e cartelle
// Versione: 1.0 - Separato dal core SIAF per sicurezza

// BLOCCO 1: Definizione classe principale e inizializzazione variabili
class SiafDocumentGenerator {
    constructor() {
        this.appsScriptUrl = 'https://script.google.com/macros/s/AKfycbyt5wpzq9dLg52WJphwcKKgRexTcI7GQsZ0Mz3-2ofkEQbo8tlziYf2trZ-wobUL26K/exec';
        this.isGenerating = false;
    }

    init() {
        console.log('🚀 SIAF Document Generator inizializzato');
        this.initializeGenerateButton();
    }

    // BLOCCO 2: Inizializzazione pulsante e eventi
    initializeGenerateButton() {
        const generateBtn = document.getElementById('generate-documents');

        if (generateBtn) {
            // Previene click multipli con debounce
            let lastClickTime = 0;
            const DEBOUNCE_MS = 2000; // 2 secondi di debounce

            generateBtn.addEventListener('click', (e) => {
                const now = Date.now();
                if (now - lastClickTime < DEBOUNCE_MS) {
                    console.log('⚠️ Click ignorato - debounce attivo');
                    e.preventDefault();
                    return;
                }
                lastClickTime = now;

                console.log('📁 Click genera documenti');
                this.handleGenerateDocuments();
            });
            console.log('✅ Pulsante genera documenti inizializzato con debounce');
        } else {
            console.error('❌ Pulsante generate-documents non trovato!');
        }
    }

    // BLOCCO 3: Gestione principale del processo di generazione
    async handleGenerateDocuments() {
        if (this.isGenerating) {
            console.log('⚠️ Generazione già in corso - richiesta ignorata');
            return;
        }

        const generateBtn = document.getElementById('generate-documents');

        try {
            this.isGenerating = true;

            // Lock forte sul bottone
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.style.opacity = '0.5';
                generateBtn.style.pointerEvents = 'none';
            }

            this.showGenerateLoading();

            // STEP 1: Salva prima la pratica
            console.log('📝 Step 1: Salvataggio pratica...');
            const saveResult = await this.savePraticaFirst();

            if (!saveResult.success) {
                throw new Error('Errore salvataggio pratica: ' + saveResult.error);
            }

            console.log('✅ Pratica salvata con protocollo:', saveResult.protocollo);

            // STEP 2: Ricarica dati DAL DATABASE (non dal frontend)
            console.log('📊 Step 2: Ricaricamento dati dal database...');
            const dbData = await this.loadPraticaFromDB(saveResult.protocollo);

            if (!dbData.success) {
                throw new Error('Errore caricamento pratica da DB: ' + dbData.error);
            }

            // STEP 3: Prepara dati per generazione usando dati dal DB
            console.log('📦 Step 3: Preparazione dati per generazione...');
            const generationData = this.prepareGenerationDataFromDB(dbData, saveResult.protocollo);

            // STEP 4: Chiama backend per generazione cartelle/documenti
            console.log('🏗️ Step 4: Generazione cartelle e documenti...');
            const generateResult = await this.callGenerateBackend(generationData);

            if (!generateResult.success) {
                throw new Error('Errore generazione: ' + generateResult.error);
            }

            // STEP 5: Mostra risultati
            this.showGenerateSuccess(generateResult);

        } catch (error) {
            console.error('❌ Errore generazione documenti:', error);
            this.showGenerateError(error);
        } finally {
            this.isGenerating = false;

            // Unlock bottone dopo 3 secondi per sicurezza
            setTimeout(() => {
                if (generateBtn) {
                    generateBtn.disabled = false;
                    generateBtn.style.opacity = '1';
                    generateBtn.style.pointerEvents = 'auto';
                }
            }, 3000);
        }
    }

    // BLOCCO 4: Salvataggio pratica riutilizzando logica esistente
    async savePraticaFirst() {
        if (window.siafApp && typeof window.siafApp.collectAllFormData === 'function') {
            const formData = window.siafApp.collectAllFormData();
            
            const protocolField = document.getElementById('numero_protocollo');
            const currentProtocol = protocolField?.value;
            
            if (currentProtocol && !currentProtocol.includes('Preview:')) {
                formData.azione = 'update';
                formData.protocollo_esistente = currentProtocol;
            } else {
                formData.azione = 'create';
            }

            return await this.submitToAppsScript(formData);
        } else {
            throw new Error('Sistema SIAF non disponibile per salvataggio');
        }
    }

    async submitToAppsScript(formData) {
        const response = await fetch(this.appsScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'save',
                data: JSON.stringify(formData)
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore salvataggio pratica');
        }
        
        return result;
    }

   // BLOCCO 5: Caricamento pratica dal database
async loadPraticaFromDB(protocollo) {
    try {
        const params = new URLSearchParams({
            action: 'load',
            protocollo: protocollo
        });

        const url = `${this.appsScriptUrl}?${params}`;
        console.log('🔄 Caricando pratica dal DB:', protocollo);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Errore caricamento pratica da DB');
        }

        console.log('✅ Pratica caricata dal DB:', result);
        return result;

    } catch (error) {
        console.error('❌ Errore caricamento pratica da DB:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

   // BLOCCO 5B: Preparazione dati per generazione usando dati dal DATABASE
prepareGenerationDataFromDB(dbData, protocollo) {
    const generationData = {
        protocollo: protocollo,
        lettera: dbData.lettera || '',
        operatore: dbData.operatore || '',
        data_compilazione: dbData.data_compilazione || '',
        venditori: dbData.venditori || [],
        immobili: dbData.immobili || [],

        anno: new Date().getFullYear(),
        generazione_timestamp: new Date().toISOString(),

        documenti_richiesti: [
            'incarico_mediazione'
        ]
    };

    console.log('📦 Dati preparati dal DB per generazione:', generationData);
    return generationData;
}

   // BLOCCO 6: Chiamata al backend per generazione documenti
async callGenerateBackend(generationData) {
    const params = new URLSearchParams({
        action: 'generate_documents',
        data: JSON.stringify(generationData)
    });
    
    const url = `${this.appsScriptUrl}?${params}`;
    
    console.log('🌐 Chiamando backend:', url);
    
    try {
        const response = await fetch(url);
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        console.log('📡 Risposta backend completa:', result);
        console.log('📡 Success:', result.success);
        console.log('📡 Message:', result.message);
        console.log('📡 Error (se presente):', result.error);
        
        if (!result.success) {
            throw new Error(result.error || 'Errore generazione documenti');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Errore nella chiamata backend:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        throw error;
    }
}
    
    // BLOCCO 7: Gestione feedback visivo di caricamento
    showGenerateLoading() {
        const status = document.getElementById('generate-status');
        const generateBtn = document.getElementById('generate-documents');
        
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.classList.add('loading');
        }
        
        if (status) {
            status.className = 'generate-status loading';
            status.textContent = '🏗️ Generando cartelle e documenti...';
        }
    }

    // BLOCCO 8: Gestione feedback visivo di successo
    showGenerateSuccess(result) {
        const status = document.getElementById('generate-status');
        const generateBtn = document.getElementById('generate-documents');
        
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.classList.remove('loading');
        }
        
        if (status) {
            status.className = 'generate-status success';
            status.innerHTML = `✅ Documenti generati! <br>📁 Cartella: ${result.cartella_nome || 'Creata'}<br>📄 Documenti: ${result.documenti_creati || 0}`;
        }
        
        setTimeout(() => {
            if (status) {
                status.className = 'generate-status';
                status.textContent = '';
            }
        }, 10000);
    }

    // BLOCCO 9: Gestione feedback visivo di errore
    showGenerateError(error) {
        const status = document.getElementById('generate-status');
        const generateBtn = document.getElementById('generate-documents');
        
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.classList.remove('loading');
        }
        
        if (status) {
            status.className = 'generate-status error';
            status.textContent = `❌ Errore generazione: ${error.message}`;
        }
    }

    // BLOCCO 10: Funzioni di utilità
    getProtocolloFromInterface() {
        const protocolField = document.getElementById('numero_protocollo');
        return protocolField?.value?.replace('Preview: ', '') || '';
    }

    isValidForGeneration() {
        const protocollo = this.getProtocolloFromInterface();
        const hasVenditori = window.siafApp?.venditori?.length > 0;
        
        return protocollo && !protocollo.includes('Preview:') && hasVenditori;
    }
}

// BLOCCO 11: Inizializzazione automatica quando DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 DOM loaded, avvio debug Document Generator...');
    
    const generateBtn = document.getElementById('generate-documents');
    const generateStatus = document.getElementById('generate-status');
    const siafApp = window.siafApp;
    
    console.log('🔍 Generate button trovato:', !!generateBtn);
    console.log('🔍 Generate status trovato:', !!generateStatus);
    console.log('🔍 SIAF App disponibile:', !!siafApp);
    
    if (generateBtn) {
        console.log('🔍 Pulsante HTML:', generateBtn.outerHTML);
    }
    
    setTimeout(() => {
        console.log('🚀 Inizializzazione SIAF Document Generator...');
        console.log('🔍 SIAF App dopo timeout:', !!window.siafApp);
        
        try {
            window.siafDocumentGenerator = new SiafDocumentGenerator();
            window.siafDocumentGenerator.init();
            console.log('✅ SIAF Document Generator pronto!');
        } catch (error) {
            console.error('❌ Errore inizializzazione Document Generator:', error);
        }
    }, 1000);
});

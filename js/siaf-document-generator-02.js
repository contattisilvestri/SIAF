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
            generateBtn.addEventListener('click', () => {
                console.log('📁 Click genera documenti');
                this.handleGenerateDocuments();
            });
            console.log('✅ Pulsante genera documenti inizializzato');
        } else {
            console.error('❌ Pulsante generate-documents non trovato!');
        }
    }

    // BLOCCO 3: Gestione principale del processo di generazione
    async handleGenerateDocuments() {
        if (this.isGenerating) {
            console.log('⚠️ Generazione già in corso...');
            return;
        }

        try {
            this.isGenerating = true;
            this.showGenerateLoading();

            // STEP 1: Salva prima la pratica
            console.log('📝 Step 1: Salvataggio pratica...');
            const saveResult = await this.savePraticaFirst();
            
            if (!saveResult.success) {
                throw new Error('Errore salvataggio pratica: ' + saveResult.error);
            }

            // STEP 2: Raccogli dati completi per generazione
            console.log('📊 Step 2: Raccolta dati per generazione...');
            const generationData = this.collectGenerationData(saveResult);

            // STEP 3: Chiama backend per generazione cartelle/documenti
            console.log('🏗️ Step 3: Generazione cartelle e documenti...');
            const generateResult = await this.callGenerateBackend(generationData);

            if (!generateResult.success) {
                throw new Error('Errore generazione: ' + generateResult.error);
            }

            // STEP 4: Mostra risultati
            this.showGenerateSuccess(generateResult);

        } catch (error) {
            console.error('❌ Errore generazione documenti:', error);
            this.showGenerateError(error);
        } finally {
            this.isGenerating = false;
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
        const params = new URLSearchParams({
            action: 'save',
            data: JSON.stringify(formData)
        });
        
        const url = `${this.appsScriptUrl}?${params}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Errore salvataggio pratica');
        }
        
        return result;
    }

    // BLOCCO 5: Raccolta e preparazione dati per generazione
    collectGenerationData(saveResult) {
        const formData = window.siafApp ? window.siafApp.collectAllFormData() : {};
        
        const generationData = {
            protocollo: saveResult.protocollo,
            lettera: formData.lettera || '',
            operatore: formData.operatore || '',
            data_compilazione: formData.data_compilazione || '',
            venditori: formData.venditori || [],
            
            anno: new Date().getFullYear(),
            generazione_timestamp: new Date().toISOString(),
            
            documenti_richiesti: [
                'incarico_mediazione',
                'preventivo_imposte',
                'delega_planimetrie'
            ]
        };

        console.log('📦 Dati per generazione:', generationData);
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
        
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        console.log('📡 Risposta backend:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Errore generazione documenti');
        }
        
        return result;
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

// siaf-tabs.js - Sistema completo gestione pratiche con tab
class SiafApp {
    constructor() {
        this.currentTab = 'pratica';
        this.formData = {};
        this.isDirty = false;
        this.appsScriptUrl = 'https://script.google.com/macros/s/AKfycbyt5wpzq9dLg52WJphwcKKgRexTcI7GQsZ0Mz3-2ofkEQbo8tlziYf2trZ-wobUL26K/exec';
    }

    init() {
        console.log('🚀 SIAF App inizializzata');
        
        // Inizializza componenti
        this.initializeTabs();
        this.initializeForm();
        this.initializeActions();
        
        // Auto-popola data
        this.setCurrentDate();
        
        // Auto-save periodico
        this.startAutoSave();
    }

    // ========== GESTIONE TAB ==========
    
    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = btn.dataset.tab;
                this.switchTab(targetTab);
            });
        });
        
        console.log('✅ Tab navigation inizializzata');
    }

    switchTab(tabName) {
        // Nascondi tutte le tab
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Rimuovi active da tutti i button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Mostra tab target
        const targetPanel = document.getElementById(`tab-${tabName}`);
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (targetPanel && targetButton) {
            targetPanel.classList.add('active');
            targetButton.classList.add('active');
            this.currentTab = tabName;
            
            console.log(`📂 Switched to tab: ${tabName}`);
            
            // Aggiorna progress
            this.updateTabProgress();
        }
    }

    updateTabProgress() {
        const tabs = ['pratica', 'venditore', 'acquirente', 'immobile-prima', 'immobile-dopo', 'condizioni'];
        
        tabs.forEach(tabName => {
            const btn = document.querySelector(`[data-tab="${tabName}"]`);
            const status = btn?.querySelector('.status');
            
            if (status) {
                const progress = this.getTabProgress(tabName);
                
                if (progress === 100) {
                    status.textContent = '✅';
                    status.className = 'status complete';
                } else if (progress > 0) {
                    status.textContent = '⚠️';
                    status.className = 'status partial';
                } else {
                    status.textContent = '⭕';
                    status.className = 'status empty';
                }
            }
        });
    }

    getTabProgress(tabName) {
        const fieldsInTab = this.getFieldsInTab(tabName);
        if (fieldsInTab.length === 0) return 0;
        
        const filledFields = fieldsInTab.filter(fieldId => {
            const field = document.getElementById(fieldId);
            return field && field.value && field.value.trim() !== '';
        });
        
        return Math.round((filledFields.length / fieldsInTab.length) * 100);
    }

    getFieldsInTab(tabName) {
        const fieldsByTab = {
            'pratica': ['operatore', 'numero_protocollo', 'data_compilazione'],
            'venditore': [
                'venditore_nome', 'venditore_cognome', 'venditore_luogo_nascita',
                'venditore_data_nascita', 'venditore_codice_fiscale', 'venditore_tipo_documento',
                'venditore_numero_documento', 'venditore_data_rilascio', 'venditore_data_scadenza',
                'venditore_indirizzo', 'venditore_citta', 'venditore_provincia',
                'venditore_telefono', 'venditore_email'
            ],
            'acquirente': [], // TODO
            'immobile-prima': [], // TODO
            'immobile-dopo': [], // TODO
            'condizioni': [] // TODO
        };
        
        return fieldsByTab[tabName] || [];
    }

    // ========== GESTIONE FORM ==========
    
    initializeForm() {
        // Operatore change
        const operatoreSelect = document.getElementById('operatore');
        if (operatoreSelect) {
            operatoreSelect.addEventListener('change', (e) => {
                this.handleOperatoreChange(e);
            });
        }

        // Track form changes
        const form = document.getElementById('siaf-form');
        if (form) {
            form.addEventListener('input', () => {
                this.isDirty = true;
                this.updateTabProgress();
            });
            
            form.addEventListener('change', () => {
                this.isDirty = true;
                this.updateTabProgress();
            });
        }
        
        console.log('✅ Form event listeners inizializzati');
    }

    setCurrentDate() {
        const dateField = document.getElementById('data_compilazione');
        if (dateField) {
            const now = new Date();
            const formattedDate = this.formatDate(now);
            dateField.value = formattedDate;
            console.log('📅 Data compilazione impostata:', formattedDate);
        }
    }

    formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    async handleOperatoreChange(event) {
        const selectedOption = event.target.selectedOptions[0];
        const protocolField = document.getElementById('numero_protocollo');
        
        if (!selectedOption.value) {
            if (protocolField) {
                protocolField.value = '';
                protocolField.className = 'readonly-field';
            }
            return;
        }

        const lettera = selectedOption.dataset.letter;
        
        if (!lettera) {
            console.error('❌ Lettera operatore non trovata');
            return;
        }

        if (protocolField) {
            protocolField.value = 'Caricando preview...';
            protocolField.className = 'readonly-field loading';
        }
        
        try {
            const previewData = await this.getPreviewNumber(lettera);
            
            if (protocolField) {
                protocolField.value = `Preview: ${previewData.previewNumber}`;
                protocolField.className = 'readonly-field preview';
            }
            
        } catch (error) {
            console.error('❌ Errore preview:', error);
            
            if (protocolField) {
                protocolField.value = 'Errore preview';
                protocolField.className = 'readonly-field error';
            }
        }
    }

    async getPreviewNumber(lettera) {
        const url = `${this.appsScriptUrl}?action=preview&lettera=${lettera}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Errore preview numero protocollo');
        }
        
        return data;
    }

    // ========== GESTIONE SALVATAGGIO ==========
    
    initializeActions() {
    const savePraticaBtn = document.getElementById('save-pratica');
    
    if (savePraticaBtn) {
        savePraticaBtn.addEventListener('click', () => {
            this.savePratica();
        });
    }
    
    console.log('✅ Save button inizializzato');
}

async savePratica() {
    const formData = this.collectAllFormData();
    const protocolField = document.getElementById('numero_protocollo');
    const currentProtocol = protocolField?.value;
    
    // Determina se UPDATE o CREATE
    if (currentProtocol && !currentProtocol.includes('Preview:')) {
        formData.azione = 'update';
        formData.protocollo_esistente = currentProtocol;
    } else {
        formData.azione = 'create';
    }
    
    this.showSaveLoading();
    
    try {
        const result = await this.submitToAppsScript(formData);
        this.showSaveSuccess(result);
        this.isDirty = false;
        
        // Aggiorna protocollo se nuovo
        if (result.protocollo && protocolField) {
            protocolField.value = result.protocollo;
            protocolField.className = 'readonly-field saved';
        }
        
    } catch (error) {
        this.showSaveError(error);
    }
}

    async saveComplete() {
        try {
            // Validazione più rigorosa per salvataggio completo
            if (!this.validateCompleteForm()) {
                return;
            }
            
            await this.saveForm('Completata');
        } catch (error) {
            console.error('❌ Errore salvataggio completo:', error);
        }
    }

    async saveForm(stato = 'Bozza') {
        const formData = this.collectAllFormData();
        formData.stato = stato;
        
        this.showSaveLoading(stato);
        
        try {
            const result = await this.submitToAppsScript(formData);
            this.showSaveSuccess(result, stato);
            this.isDirty = false;
            
            // Aggiorna numero protocollo se definitivo
            if (result.protocollo) {
                const protocolField = document.getElementById('numero_protocollo');
                if (protocolField) {
                    protocolField.value = result.protocollo;
                    protocolField.className = 'readonly-field saved';
                }
            }
            
        } catch (error) {
            this.showSaveError(error, stato);
        }
    }

    collectAllFormData() {
        const operatorSelect = document.getElementById('operatore');
        const selectedOption = operatorSelect?.selectedOptions[0];
        
        return {
            // Dati operatore
            lettera: selectedOption?.dataset.letter || '',
            operatore: selectedOption?.textContent || '',
            
            // Dati pratica
            data_compilazione: document.getElementById('data_compilazione')?.value || '',
            
            // Dati venditore
            venditore_nome: document.getElementById('venditore_nome')?.value || '',
            venditore_cognome: document.getElementById('venditore_cognome')?.value || '',
            venditore_luogo_nascita: document.getElementById('venditore_luogo_nascita')?.value || '',
            venditore_data_nascita: document.getElementById('venditore_data_nascita')?.value || '',
            venditore_codice_fiscale: document.getElementById('venditore_codice_fiscale')?.value || '',
            venditore_tipo_documento: document.getElementById('venditore_tipo_documento')?.value || '',
            venditore_numero_documento: document.getElementById('venditore_numero_documento')?.value || '',
            venditore_data_rilascio: document.getElementById('venditore_data_rilascio')?.value || '',
            venditore_data_scadenza: document.getElementById('venditore_data_scadenza')?.value || '',
            venditore_indirizzo: document.getElementById('venditore_indirizzo')?.value || '',
            venditore_citta: document.getElementById('venditore_citta')?.value || '',
            venditore_provincia: document.getElementById('venditore_provincia')?.value || '',
            venditore_telefono: document.getElementById('venditore_telefono')?.value || '',
            venditore_email: document.getElementById('venditore_email')?.value || ''
        };
    }

    validateCompleteForm() {
        const errors = [];
        const formData = this.collectAllFormData();
        
        // Validazioni obbligatorie
        if (!formData.lettera) errors.push('Seleziona un operatore');
        if (!formData.venditore_nome.trim()) errors.push('Nome venditore obbligatorio');
        if (!formData.venditore_cognome.trim()) errors.push('Cognome venditore obbligatorio');
        
        if (errors.length > 0) {
            this.showValidationErrors(errors);
            return false;
        }
        
        return true;
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

    // ========== UI FEEDBACK ==========
    
    showSaveLoading() {  // ← Senza parametro
    const status = document.getElementById('save-status');
    const savePraticaBtn = document.getElementById('save-pratica');
    
    if (savePraticaBtn) {
        savePraticaBtn.disabled = true;
        savePraticaBtn.classList.add('loading');
    }
    
    if (status) {
        status.className = 'save-status loading';
        status.textContent = '💾 Salvando pratica...';  // ← Testo fisso
    }
}

    showSaveSuccess(result) {  // ← Senza parametro stato
    const status = document.getElementById('save-status');
    const savePraticaBtn = document.getElementById('save-pratica');
    
    if (savePraticaBtn) {
        savePraticaBtn.disabled = false;
        savePraticaBtn.classList.remove('loading');
    }
    
    if (status) {
        status.className = 'save-status success';
        status.textContent = `✅ Pratica salvata! ${result.protocollo ? `Numero: ${result.protocollo}` : ''}`;
    }
    
    setTimeout(() => {
        if (status) {
            status.className = 'save-status';
            status.textContent = '';
        }
    }, 5000);
}
    
    showSaveError(error) {  // ← Senza parametro stato
    const status = document.getElementById('save-status');
    const savePraticaBtn = document.getElementById('save-pratica');
    
    if (savePraticaBtn) {
        savePraticaBtn.disabled = false;
        savePraticaBtn.classList.remove('loading');
    }
    
    if (status) {
        status.className = 'save-status error';
        status.textContent = `❌ Errore: ${error.message}`;
    }
}

    showValidationErrors(errors) {
        const status = document.getElementById('save-status');
        
        if (status) {
            status.className = 'save-status error';
            status.innerHTML = `❌ Errori:<br>• ${errors.join('<br>• ')}`;
        }
    }

    // ========== AUTO-SAVE ==========
    
    startAutoSave() {
    setInterval(() => {
        if (this.isDirty) {
            console.log('💾 Auto-save...');
            this.savePratica();  // ← Cambiato da saveDraft
        }
    }, 30000);
}
}

// Inizializza app quando DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inizializzazione SIAF App...');
    
    window.siafApp = new SiafApp();
    window.siafApp.init();
    
    console.log('✅ SIAF App pronta!');
});

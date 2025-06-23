// pratica-form.js - Versione completa con salvataggio
class PraticaForm {
    constructor() {
        // Inizializzazione vuota - init() chiamato dopo DOM ready
    }

    init() {
        this.operatoreSelect = document.getElementById('operatore');
        this.numeroProtocolloField = document.getElementById('numero_protocollo');
        this.dataCompilazioneField = document.getElementById('data_compilazione');
        this.appsScriptUrl = 'https://script.google.com/macros/s/AKfycbyt5wpzq9dLg52WJphwcKKgRexTcI7GQsZ0Mz3-2ofkEQbo8tlziYf2trZ-wobUL26K/exec';
        
        this.setCurrentDate();
        this.bindEvents();
    }

    setCurrentDate() {
        if (this.dataCompilazioneField) {
            const now = new Date();
            const formattedDate = this.formatDate(now);
            this.dataCompilazioneField.value = formattedDate;
            this.dataCompilazioneField.classList.add('auto-filled');
            console.log('Data impostata:', formattedDate);
        } else {
            console.log('Campo data_compilazione non trovato');
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

    bindEvents() {
        if (this.operatoreSelect) {
            this.operatoreSelect.addEventListener('change', (e) => {
                this.handleOperatoreChange(e);
            });
        }
        
        // Pulsante salva pratica
        const salvaPraticaBtn = document.getElementById('salva-pratica');
        if (salvaPraticaBtn) {
            salvaPraticaBtn.addEventListener('click', (e) => {
                this.handleSalvaPratica(e);
            });
        }
    }

    async handleOperatoreChange(event) {
        const selectedOption = event.target.selectedOptions[0];
        
        if (!selectedOption.value) {
            this.clearProtocolNumber();
            return;
        }

        const lettera = selectedOption.dataset.letter;
        
        if (!lettera) {
            console.error('Lettera operatore non trovata');
            return;
        }

        this.showLoading();
        
        try {
            const previewData = await this.getPreviewNumber(lettera);
            this.updateProtocolNumber(previewData);
        } catch (error) {
            this.handleError(error);
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

    updateProtocolNumber(data) {
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = `Preview: ${data.previewNumber}`;
            this.numeroProtocolloField.classList.remove('loading', 'error');
            this.numeroProtocolloField.classList.add('preview');
        }
    }

    showLoading() {
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = 'Caricando preview...';
            this.numeroProtocolloField.classList.add('loading');
            this.numeroProtocolloField.classList.remove('error', 'preview');
        }
    }

    clearProtocolNumber() {
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = '';
            this.numeroProtocolloField.classList.remove('loading', 'error', 'preview');
        }
    }

    handleError(error) {
        console.error('Errore:', error);
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = 'Errore preview';
            this.numeroProtocolloField.classList.remove('loading', 'preview');
            this.numeroProtocolloField.classList.add('error');
        }
    }

    // ========== GESTIONE SALVATAGGIO ==========

    async handleSalvaPratica(event) {
        event.preventDefault();
        
        try {
            const formData = this.collectFormData();
            
            if (!this.validateFormData(formData)) {
                return;
            }
            
            this.showSaveLoading();
            
            const result = await this.savePratica(formData);
            this.showSaveSuccess(result);
            
        } catch (error) {
            this.showSaveError(error);
        }
    }

    collectFormData() {
        const operatorSelect = this.operatoreSelect.selectedOptions[0];
        
        return {
            lettera: operatorSelect?.dataset.letter,
            operatore: operatorSelect?.textContent,
            data_compilazione: this.dataCompilazioneField?.value,
            venditore_nome: document.getElementById('venditore_nome')?.value || '',
            venditore_cognome: document.getElementById('venditore_cognome')?.value || '',
            venditore_luogo_nascita: document.getElementById('venditore_luogo_nascita')?.value || '',
            venditore_data_nascita: document.getElementById('venditore_data_nascita')?.value || '',
            venditore_codice_fiscale: document.getElementById('venditore_codice_fiscale')?.value || '',
            venditore_tipo_documento: document.getElementById('venditore_tipo_documento')?.value || '',
            venditore_numero_documento: document.getElementById('venditore_numero_documento')?.value || '',
            venditore_data_rilascio: document.getElementById('venditore_data_rilascio')?.value || '',
            venditore_data_scadenza: document.getElementById('venditore_data_scadenza')?.value || '',
            venditore_cittadinanza: document.getElementById('venditore_cittadinanza')?.value || '',
            venditore_stato_civile: document.getElementById('venditore_stato_civile')?.value || '',
            venditore_indirizzo: document.getElementById('venditore_indirizzo')?.value || '',
            venditore_citta: document.getElementById('venditore_citta')?.value || '',
            venditore_provincia: document.getElementById('venditore_provincia')?.value || '',
            venditore_pensionato: document.getElementById('venditore_pensionato')?.value || '',
            venditore_telefono: document.getElementById('venditore_telefono')?.value || '',
            venditore_email: document.getElementById('venditore_email')?.value || ''
        };
    }

    validateFormData(data) {
        const errors = [];
        
        if (!data.lettera) {
            errors.push('Seleziona un operatore');
        }
        
        if (!data.venditore_nome.trim()) {
            errors.push('Nome venditore obbligatorio');
        }
        
        if (!data.venditore_cognome.trim()) {
            errors.push('Cognome venditore obbligatorio');
        }
        
        if (errors.length > 0) {
            this.showValidationErrors(errors);
            return false;
        }
        
        return true;
    }

    async savePratica(formData) {
        
        // Test: converti POST in GET con parametri
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

    showSaveLoading() {
        const btn = document.getElementById('salva-pratica');
        const status = document.getElementById('save-status');
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="icon">⏳</span>SALVANDO...';
        }
        
        if (status) {
            status.className = 'save-status loading';
            status.textContent = 'Salvataggio in corso...';
        }
    }

    showSaveSuccess(result) {
        const btn = document.getElementById('salva-pratica');
        const status = document.getElementById('save-status');
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="icon">💾</span>SALVA PRATICA';
        }
        
        if (status) {
            status.className = 'save-status success';
            status.textContent = `✅ Pratica salvata! Numero: ${result.protocollo}`;
        }
        
        // Aggiorna campo numero protocollo con quello definitivo
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = result.protocollo;
            this.numeroProtocolloField.classList.remove('preview');
            this.numeroProtocolloField.classList.add('saved');
        }
    }

    showSaveError(error) {
        const btn = document.getElementById('salva-pratica');
        const status = document.getElementById('save-status');
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="icon">💾</span>SALVA PRATICA';
        }
        
        if (status) {
            status.className = 'save-status error';
            status.textContent = `❌ Errore: ${error.message}`;
        }
        
        console.error('Errore salvataggio:', error);
    }

    showValidationErrors(errors) {
        const status = document.getElementById('save-status');
        
        if (status) {
            status.className = 'save-status error';
            status.innerHTML = `❌ Errori:<br>• ${errors.join('<br>• ')}`;
        }
    }
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    const form = new PraticaForm();
    form.init();
});

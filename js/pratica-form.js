// pratica-form.js - Versione con preview
class PraticaForm {
    constructor() {
        this.init();
    }

    init() {
        this.operatoreSelect = document.getElementById('operatore');
        this.numeroProtocolloField = document.getElementById('numero_protocollo');
this.dataCompilazioneField = document.getElementById('data_compilazione');
        this.appsScriptUrl = 'https://script.google.com/macros/s/AKfycbyt5wpzq9dLg52WJphwcKKgRexTcI7GQsZ0Mz3-2ofkEQbo8tlziYf2trZ-wobUL26K/exec';
        
  this.setCurrentDate(); // ← Nuova funzione
        this.bindEvents();
    }

    bindEvents() {
        if (this.operatoreSelect) {
            this.operatoreSelect.addEventListener('change', (e) => {
                this.handleOperatoreChange(e);
            });
        }
    }

// Nuova funzione per impostare data automatica
setCurrentDate() {
    if (this.dataCompilazioneField) {
        const now = new Date();
        const formattedDate = this.formatDate(now);
        this.dataCompilazioneField.value = formattedDate;
        this.dataCompilazioneField.classList.add('auto-filled');
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

    // Funzione per salvare pratica completa (da implementare)
    async savePratica(formData) {
        try {
            const response = await fetch(this.appsScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'save',
                    data: formData
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('Pratica salvata:', result.protocollo);
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Errore salvataggio:', error);
            throw error;
        }
    }
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    new PraticaForm();
});

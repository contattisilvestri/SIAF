// pratica-form.js
class PraticaForm {
    constructor() {
        this.init();
    }

    init() {
        this.operatoreSelect = document.getElementById('operatore');
        this.numeroProtocolloField = document.getElementById('numero_protocollo');
        this.appsScriptUrl = 'https://script.google.com/macros/s/TUO_DEPLOYMENT_ID/exec';
        
        this.bindEvents();
    }

    bindEvents() {
        if (this.operatoreSelect) {
            this.operatoreSelect.addEventListener('change', (e) => {
                this.handleOperatoreChange(e);
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
            const protocolData = await this.generateProtocolNumber(lettera);
            this.updateProtocolNumber(protocolData);
        } catch (error) {
            this.handleError(error);
        }
    }

    async generateProtocolNumber(lettera) {
        const url = `${this.appsScriptUrl}?lettera=${lettera}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Errore generazione numero protocollo');
        }
        
        return data;
    }

    updateProtocolNumber(data) {
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = data.protocolNumber;
            this.numeroProtocolloField.classList.remove('loading', 'error');
            this.numeroProtocolloField.classList.add('success');
        }
    }

    showLoading() {
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = 'Generando...';
            this.numeroProtocolloField.classList.add('loading');
            this.numeroProtocolloField.classList.remove('error', 'success');
        }
    }

    clearProtocolNumber() {
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = '';
            this.numeroProtocolloField.classList.remove('loading', 'error', 'success');
        }
    }

    handleError(error) {
        console.error('Errore:', error);
        if (this.numeroProtocolloField) {
            this.numeroProtocolloField.value = 'Errore generazione';
            this.numeroProtocolloField.classList.remove('loading', 'success');
            this.numeroProtocolloField.classList.add('error');
        }
    }
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    new PraticaForm();
});

// BLOCCO 1: Definizione classe principale e inizializzazione variabili
class SiafApp {
    constructor() {
        this.currentTab = 'pratica';
        this.formData = {};
        this.isDirty = false;
        this.appsScriptUrl = 'https://script.google.com/macros/s/AKfycbyt5wpzq9dLg52WJphwcKKgRexTcI7GQsZ0Mz3-2ofkEQbo8tlziYf2trZ-wobUL26K/exec';
        
        // Venditori multipli
        this.venditori = [];
        this.venditoreCounter = 0;
    }

    init() {
        console.log('🚀 SIAF App inizializzata');
        
        // Inizializza componenti
        this.initializeTabs();
        this.initializeForm();
        this.initializeVenditori(); // ← QUESTA CHIAMATA MANCAVA!
        this.initializeActions();
        
        // Auto-popola data
        this.setCurrentDate();
        
        // Auto-save periodico
        this.startAutoSave();
    }
}

// BLOCCO 2: Sistema navigazione tab e progress tracking
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
        'venditore': this.getVenditoriFieldsList(),
        'acquirente': [], // TODO
        'immobile-prima': [], // TODO
        'immobile-dopo': [], // TODO
        'condizioni': [] // TODO
    };
    
    return fieldsByTab[tabName] || [];
}

getVenditoriFieldsList() {
    // Genera dinamicamente lista campi venditori
    const fields = [];
    this.venditori.forEach(venditore => {
        fields.push(`venditore_${venditore.id}_nome`);
        fields.push(`venditore_${venditore.id}_cognome`);
        fields.push(`venditore_${venditore.id}_cf`);
    });
    return fields;
}

// BLOCCO 3: Gestione form base (operatore, data, eventi generali)
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

// BLOCCO 4: Sistema venditori multipli dinamici (add/remove/render) - DEBUG
initializeVenditori() {
    console.log('🔧 Inizializzando sistema venditori...');
    
    const addBtn = document.getElementById('add-venditore');
    
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            console.log('➕ Click add venditore');
            this.addVenditore();
        });
    } else {
        console.error('❌ Pulsante add-venditore non trovato!');
    }
    
    // Aggiungi primo venditore di default
    console.log('🚀 Aggiungendo primo venditore di default...');
    this.addVenditore();
    
    console.log('✅ Venditori dopo init:', this.venditori);
    console.log('✅ Sistema venditori inizializzato');
}

addVenditore() {
    console.log('➕ Aggiungendo venditore...');
    
    const venditore = {
        id: ++this.venditoreCounter,
        nome: '',
        cognome: '',
        luogo_nascita: '',
        data_nascita: '',
        codice_fiscale: '',
        tipo_documento: '',
        numero_documento: '',
        data_rilascio: '',
        data_scadenza: '',
        cittadinanza: 'Italiana',
        stato_civile: '',
        indirizzo: '',
        citta: '',
        provincia: '',
        pensionato: '',
        telefono: '',
        email: ''
    };
    
    this.venditori.push(venditore);
    console.log(`✅ Venditore ${venditore.id} aggiunto. Totale venditori:`, this.venditori.length);
    
    this.renderVenditore(venditore);
    this.updateTabProgress();
    
    console.log('📊 Array venditori attuale:', this.venditori);
}

// Resto delle funzioni uguale...

removeVenditore(id) {
    // Non permettere rimozione se è l'unico venditore
    if (this.venditori.length === 1) {
        alert('Deve esserci almeno un venditore');
        return;
    }
    
    this.venditori = this.venditori.filter(v => v.id !== id);
    document.getElementById(`venditore-${id}`).remove();
    this.updateTabProgress();
    this.isDirty = true;
    
    console.log(`❌ Rimosso venditore ${id}`);
}

renderVenditore(venditore) {
    const container = document.getElementById('venditori-container');
    const isFirst = this.venditori.length === 1;
    
    const venditoreHtml = `
        <div id="venditore-${venditore.id}" class="venditore-card">
            <div class="venditore-header">
                <h3>👤 Venditore ${venditore.id}</h3>
                ${!isFirst ? `<button type="button" class="btn-remove" onclick="window.siafApp.removeVenditore(${venditore.id})">❌ Rimuovi</button>` : ''}
            </div>
            
            <div class="form-grid">
                <!-- Dati anagrafici -->
                <div class="field-card">
                    <h4>Dati Anagrafici</h4>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_nome">Nome</label>
                            <input type="text" id="venditore_${venditore.id}_nome" value="${venditore.nome}" required>
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_cognome">Cognome</label>
                            <input type="text" id="venditore_${venditore.id}_cognome" value="${venditore.cognome}" required>
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_luogo_nascita">Luogo di Nascita</label>
                            <input type="text" id="venditore_${venditore.id}_luogo_nascita" value="${venditore.luogo_nascita}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_data_nascita">Data di Nascita</label>
                            <input type="date" id="venditore_${venditore.id}_data_nascita" value="${venditore.data_nascita}">
                        </div>
                    </div>

                    <div class="field-group">
                        <label for="venditore_${venditore.id}_codice_fiscale">Codice Fiscale</label>
                        <input type="text" id="venditore_${venditore.id}_codice_fiscale" value="${venditore.codice_fiscale}" 
                               maxlength="16" style="text-transform: uppercase;">
                    </div>
                </div>

                <!-- Documento -->
                <div class="field-card">
                    <h4>Documento di Riconoscimento</h4>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_tipo_documento">Tipo Documento</label>
                            <select id="venditore_${venditore.id}_tipo_documento">
                                <option value="">Seleziona...</option>
                                <option value="carta_identita" ${venditore.tipo_documento === 'carta_identita' ? 'selected' : ''}>Carta d'Identità</option>
                                <option value="patente" ${venditore.tipo_documento === 'patente' ? 'selected' : ''}>Patente di Guida</option>
                                <option value="passaporto" ${venditore.tipo_documento === 'passaporto' ? 'selected' : ''}>Passaporto</option>
                            </select>
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_numero_documento">Numero Documento</label>
                            <input type="text" id="venditore_${venditore.id}_numero_documento" value="${venditore.numero_documento}">
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_data_rilascio">Data Rilascio</label>
                            <input type="date" id="venditore_${venditore.id}_data_rilascio" value="${venditore.data_rilascio}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_data_scadenza">Data Scadenza</label>
                            <input type="date" id="venditore_${venditore.id}_data_scadenza" value="${venditore.data_scadenza}">
                        </div>
                    </div>
                </div>

                <!-- Residenza e Contatti -->
                <div class="field-card">
                    <h4>Residenza e Contatti</h4>
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_indirizzo">Indirizzo</label>
                        <input type="text" id="venditore_${venditore.id}_indirizzo" value="${venditore.indirizzo}">
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_citta">Città</label>
                            <input type="text" id="venditore_${venditore.id}_citta" value="${venditore.citta}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_provincia">Provincia</label>
                            <input type="text" id="venditore_${venditore.id}_provincia" value="${venditore.provincia}" 
                                   maxlength="2" style="text-transform: uppercase;">
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_telefono">Telefono</label>
                            <input type="tel" id="venditore_${venditore.id}_telefono" value="${venditore.telefono}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_email">Email</label>
                            <input type="email" id="venditore_${venditore.id}_email" value="${venditore.email}">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', venditoreHtml);
}

// BLOCCO 5: Sistema salvataggio (raccolta dati, validazione, submit)
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

// BLOCCO 5: Sistema salvataggio (raccolta dati, validazione, submit)
collectAllFormData() {
    const operatorSelect = document.getElementById('operatore');
    const selectedOption = operatorSelect?.selectedOptions[0];
    
    console.log('=== DEBUG COLLECT DATA ===');
    console.log('this.venditori:', this.venditori);
    console.log('Numero venditori:', this.venditori.length);
    
    // Raccolta dati venditori
    const venditoriData = this.venditori.map(venditore => {
        const data = {
            id: venditore.id,
            nome: document.getElementById(`venditore_${venditore.id}_nome`)?.value || '',
            cognome: document.getElementById(`venditore_${venditore.id}_cognome`)?.value || '',
            luogo_nascita: document.getElementById(`venditore_${venditore.id}_luogo_nascita`)?.value || '',
            data_nascita: document.getElementById(`venditore_${venditore.id}_data_nascita`)?.value || '',
            codice_fiscale: document.getElementById(`venditore_${venditore.id}_codice_fiscale`)?.value || '',
            tipo_documento: document.getElementById(`venditore_${venditore.id}_tipo_documento`)?.value || '',
            numero_documento: document.getElementById(`venditore_${venditore.id}_numero_documento`)?.value || '',
            data_rilascio: document.getElementById(`venditore_${venditore.id}_data_rilascio`)?.value || '',
            data_scadenza: document.getElementById(`venditore_${venditore.id}_data_scadenza`)?.value || '',
            indirizzo: document.getElementById(`venditore_${venditore.id}_indirizzo`)?.value || '',
            citta: document.getElementById(`venditore_${venditore.id}_citta`)?.value || '',
            provincia: document.getElementById(`venditore_${venditore.id}_provincia`)?.value || '',
            telefono: document.getElementById(`venditore_${venditore.id}_telefono`)?.value || '',
            email: document.getElementById(`venditore_${venditore.id}_email`)?.value || ''
        };
        
        console.log(`📋 Dati venditore ${venditore.id}:`, data);
        return data;
    });
    
    console.log('📦 Venditori data finale:', venditoriData);
    console.log('📦 Venditori data length:', venditoriData.length);
    
    const finalData = {
        // Dati operatore
        lettera: selectedOption?.dataset.letter || '',
        operatore: selectedOption?.textContent || '',
        
        // Dati pratica
        data_compilazione: document.getElementById('data_compilazione')?.value || '',
        
        // Venditori (JSON)
        venditori: venditoriData
    };
    
    console.log('🎯 Final form data:', finalData);
    console.log('🎯 Final venditori nel data:', finalData.venditori);
    console.log('🎯 Final venditori length:', finalData.venditori.length);
    
    return finalData;
}

validateCompleteForm() {
    const errors = [];
    const formData = this.collectAllFormData();
    
    // Validazioni obbligatorie
    if (!formData.lettera) errors.push('Seleziona un operatore');
    
    // Validazione venditori
    if (formData.venditori.length === 0) {
        errors.push('Aggiungi almeno un venditore');
    } else {
        formData.venditori.forEach((venditore, index) => {
            if (!venditore.nome.trim()) errors.push(`Nome venditore ${index + 1} obbligatorio`);
            if (!venditore.cognome.trim()) errors.push(`Cognome venditore ${index + 1} obbligatorio`);
        });
    }
    
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

// BLOCCO 6: Gestione UI feedback (loading, success, error) e auto-save
showSaveLoading() {
    const status = document.getElementById('save-status');
    const savePraticaBtn = document.getElementById('save-pratica');
    
    if (savePraticaBtn) {
        savePraticaBtn.disabled = true;
        savePraticaBtn.classList.add('loading');
    }
    
    if (status) {
        status.className = 'save-status loading';
        status.textContent = '💾 Salvando pratica...';
    }
}

showSaveSuccess(result) {
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
    
    // Auto-hide dopo 5 secondi
    setTimeout(() => {
        if (status) {
            status.className = 'save-status';
            status.textContent = '';
        }
    }, 5000);
}

showSaveError(error) {
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

startAutoSave() {
    setInterval(() => {
        if (this.isDirty) {
            console.log('💾 Auto-save...');
            this.savePratica();
        }
    }, 30000); // Auto-save ogni 30 secondi
}

// BLOCCO 7: Inizializzazione app quando DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inizializzazione SIAF App...');
    
    window.siafApp = new SiafApp();
    window.siafApp.init();
    
    console.log('✅ SIAF App pronta!');
});

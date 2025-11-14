// BLOCCO 1: Definizione classe principale e inizializzazione variabili
// 🚀 VERSION: PRATICA-FORM-v2.3.2-FINAL-2025-10-31-09:11

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
        this.initializeVenditori();
        this.initializeActions();

        // Auto-popola data
        this.setCurrentDate();

        // Auto-save periodico
        this.startAutoSave();
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
        }

        this.currentTab = tabName;

        console.log(`📂 Switched to tab: ${tabName}`);

        // Aggiorna progress
        this.updateTabProgress();
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
                    status.textContent = '🟡';
                    status.className = 'status partial';
                } else {
                    status.textContent = '⭕';
                    status.className = 'status empty';
                }
            }
        });

        console.log('📊 Tab progress aggiornato');
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

        // Form change detection per auto-save
        const form = document.getElementById('siaf-form');
        if (form) {
            form.addEventListener('input', () => {
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

        const lettera = selectedOption.dataset.lettera;
        if (!lettera) {
            console.error('❌ Lettera non trovata per operatore:', selectedOption.value);
            return;
        }

        try {
            console.log('🔄 Richiesta preview numero per lettera:', lettera);

            const response = await fetch(`${this.appsScriptUrl}?action=preview&lettera=${lettera}`);
            const result = await response.json();

            if (result.success && result.data && result.data.numero_preview) {
                if (protocolField) {
                    protocolField.value = result.data.numero_preview;
                    protocolField.className = 'preview-field';
                }
                console.log('✅ Preview numero ottenuto:', result.data.numero_preview);
            } else {
                console.error('❌ Errore nel preview numero:', result.error || 'Risposta non valida');
                if (protocolField) {
                    protocolField.value = 'Errore preview';
                    protocolField.className = 'error-field';
                }
            }
        } catch (error) {
            console.error('❌ Errore chiamata preview:', error);
            if (protocolField) {
                protocolField.value = 'Errore connessione';
                protocolField.className = 'error-field';
            }
        }
    }

    // BLOCCO 4: Gestione venditori multipli
    initializeVenditori() {
        console.log('🏗️ Inizializzo sistema venditori multipli');

        // Bottone aggiunta venditore
        const addBtn = document.getElementById('add-venditore-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addVenditore();
            });
        }

        // Aggiungi primo venditore di default
        this.addVenditore();

        console.log('✅ Sistema venditori inizializzato');
    }

    addVenditore() {
        this.venditoreCounter++;
        const venditore = {
            id: this.venditoreCounter,
            nome: '',
            cognome: '',
            sesso: 'M',
            luogo_nascita: '',
            data_nascita: '',
            codice_fiscale: '',
            tipo_documento: 'carta_identita',
            numero_documento: '',
            data_rilascio: '',
            data_scadenza: '',
            citta: '',
            provincia: '',
            indirizzo: '',
            stato_civile: 'celibe',
            telefono: '',
            email: ''
        };

        this.venditori.push(venditore);
        this.renderVenditore(venditore);
        this.updateTabProgress();

        console.log(`✅ Venditore ${venditore.id} aggiunto`);
    }

    removeVenditore(id) {
        // Non permettere rimozione se è l'unico venditore
        if (this.venditori.length <= 1) {
            alert('Non puoi rimuovere l\'ultimo venditore');
            return;
        }

        // Rimuovi dall'array
        this.venditori = this.venditori.filter(v => v.id !== id);

        // Rimuovi dal DOM
        const venditoreElement = document.getElementById(`venditore-${id}`);
        if (venditoreElement) {
            venditoreElement.remove();
        }

        this.updateTabProgress();
        console.log(`🗑️ Venditore ${id} rimosso`);
    }

    renderVenditore(venditore) {
        const container = document.getElementById('venditori-list');
        if (!container) {
            console.error('❌ Container venditori-list non trovato');
            return;
        }

        const venditoreHtml = `
        <div class="venditore-card" id="venditore-${venditore.id}">
            <div class="venditore-header">
                <h3>👤 Venditore ${venditore.id}</h3>
                <button type="button" class="remove-venditore-btn" onclick="window.siafApp.removeVenditore(${venditore.id})">
                    <span class="icon">🗑️</span>
                    <span class="text">Rimuovi</span>
                </button>
            </div>

            <div class="form-grid">
                <div class="form-group">
                    <label for="venditore_${venditore.id}_nome">Nome *</label>
                    <input type="text" id="venditore_${venditore.id}_nome" name="venditore_${venditore.id}_nome" required>
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_cognome">Cognome *</label>
                    <input type="text" id="venditore_${venditore.id}_cognome" name="venditore_${venditore.id}_cognome" required>
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_sesso">Sesso</label>
                    <select id="venditore_${venditore.id}_sesso" name="venditore_${venditore.id}_sesso">
                        <option value="M">Maschio</option>
                        <option value="F">Femmina</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_luogo_nascita">Luogo di nascita</label>
                    <input type="text" id="venditore_${venditore.id}_luogo_nascita" name="venditore_${venditore.id}_luogo_nascita">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_data_nascita">Data di nascita</label>
                    <input type="date" id="venditore_${venditore.id}_data_nascita" name="venditore_${venditore.id}_data_nascita">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_cf">Codice fiscale</label>
                    <input type="text" id="venditore_${venditore.id}_cf" name="venditore_${venditore.id}_cf" maxlength="16">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_tipo_documento">Tipo documento</label>
                    <select id="venditore_${venditore.id}_tipo_documento" name="venditore_${venditore.id}_tipo_documento">
                        <option value="carta_identita">Carta d'identità</option>
                        <option value="patente">Patente</option>
                        <option value="passaporto">Passaporto</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_numero_documento">Numero documento</label>
                    <input type="text" id="venditore_${venditore.id}_numero_documento" name="venditore_${venditore.id}_numero_documento">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_data_rilascio">Data rilascio</label>
                    <input type="date" id="venditore_${venditore.id}_data_rilascio" name="venditore_${venditore.id}_data_rilascio">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_data_scadenza">Data scadenza</label>
                    <input type="date" id="venditore_${venditore.id}_data_scadenza" name="venditore_${venditore.id}_data_scadenza">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_citta">Città di residenza</label>
                    <input type="text" id="venditore_${venditore.id}_citta" name="venditore_${venditore.id}_citta">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_provincia">Provincia</label>
                    <input type="text" id="venditore_${venditore.id}_provincia" name="venditore_${venditore.id}_provincia">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_indirizzo">Indirizzo completo</label>
                    <input type="text" id="venditore_${venditore.id}_indirizzo" name="venditore_${venditore.id}_indirizzo">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_stato_civile">Stato civile</label>
                    <select id="venditore_${venditore.id}_stato_civile" name="venditore_${venditore.id}_stato_civile">
                        <option value="celibe">Celibe/Nubile</option>
                        <option value="coniugato">Coniugato/a</option>
                        <option value="divorziato">Divorziato/a</option>
                        <option value="vedovo">Vedovo/a</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_telefono">Telefono</label>
                    <input type="tel" id="venditore_${venditore.id}_telefono" name="venditore_${venditore.id}_telefono">
                </div>

                <div class="form-group">
                    <label for="venditore_${venditore.id}_email">Email</label>
                    <input type="email" id="venditore_${venditore.id}_email" name="venditore_${venditore.id}_email">
                </div>
            </div>
        </div>
        `;

        container.insertAdjacentHTML('beforeend', venditoreHtml);
    }

    // BLOCCO 5: Gestione azioni principali (salva, genera documenti)
    initializeActions() {
        // Bottone salva
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.handleSave();
            });
        }

        // Bottone genera documenti
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.handleGenerateDocuments();
            });
        }

        console.log('✅ Action buttons inizializzati');
    }

    async handleSave() {
        console.log('💾 Inizio salvataggio...');

        // Raccogli tutti i dati
        const formData = this.collectAllFormData();

        // Validazione
        const validation = this.validateCompleteForm(formData);
        if (!validation.isValid) {
            this.showValidationErrors(validation.errors);
            return;
        }

        this.showSaveLoading();

        try {
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
            const result = await response.json();

            if (result.success) {
                this.showSaveSuccess(result);
                this.isDirty = false;
            } else {
                this.showSaveError(result.error);
            }
        } catch (error) {
            console.error('❌ Errore salvataggio:', error);
            this.showSaveError('Errore di connessione');
        }
    }

    async handleGenerateDocuments() {
        console.log('📄 Inizio generazione documenti...');

        // Raccogli tutti i dati
        const formData = this.collectAllFormData();

        // Validazione
        const validation = this.validateCompleteForm(formData);
        if (!validation.isValid) {
            this.showValidationErrors(validation.errors);
            return;
        }

        this.showSaveLoading();

        try {
            const response = await fetch(this.appsScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'generate_documents',
                    data: JSON.stringify(formData)
                })
            });
            const result = await response.json();

            if (result.success) {
                this.showSaveSuccess(result);
                console.log('✅ Documenti generati:', result);
            } else {
                this.showSaveError(result.error);
            }
        } catch (error) {
            console.error('❌ Errore generazione documenti:', error);
            this.showSaveError('Errore di connessione durante generazione documenti');
        }
    }

    collectAllFormData() {
        const formData = {};

        // Dati base pratica
        formData.operatore = document.getElementById('operatore')?.value || '';
        formData.numero_protocollo = document.getElementById('numero_protocollo')?.value || '';
        formData.data_compilazione = document.getElementById('data_compilazione')?.value || '';

        // Raccogli dati venditori
        formData.venditori = this.venditori.map(venditore => {
            const venditoreData = {};
            ['nome', 'cognome', 'sesso', 'luogo_nascita', 'data_nascita', 'codice_fiscale',
             'tipo_documento', 'numero_documento', 'data_rilascio', 'data_scadenza',
             'citta', 'provincia', 'indirizzo', 'stato_civile', 'telefono', 'email'].forEach(field => {
                const element = document.getElementById(`venditore_${venditore.id}_${field}`);
                venditoreData[field] = element ? element.value : '';
            });
            return venditoreData;
        });

        // Determina lettera operatore
        const operatoreSelect = document.getElementById('operatore');
        if (operatoreSelect && operatoreSelect.selectedOptions[0]) {
            formData.lettera = operatoreSelect.selectedOptions[0].dataset.lettera || '';
            formData.operatore_id = operatoreSelect.value;
        }

        // TODO: Aggiungere dati altre tab quando implementate
        formData.immobili = [];

        return formData;
    }

    validateCompleteForm(formData) {
        const errors = [];

        if (!formData.operatore) {
            errors.push('Operatore obbligatorio');
        }

        if (!formData.venditori || formData.venditori.length === 0) {
            errors.push('Almeno un venditore è obbligatorio');
        }

        formData.venditori.forEach((venditore, index) => {
            if (!venditore.nome || !venditore.cognome) {
                errors.push(`Venditore ${index + 1}: Nome e cognome obbligatori`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    showSaveLoading() {
        // TODO: Implementare UI loading
        console.log('🔄 Showing loading...');
    }

    showSaveSuccess(result) {
        alert('✅ Operazione completata con successo!');
        console.log('✅ Success:', result);
    }

    showSaveError(error) {
        alert('❌ Errore: ' + error);
        console.error('❌ Error:', error);
    }

    showValidationErrors(errors) {
        alert('⚠️ Errori di validazione:\n' + errors.join('\n'));
        console.warn('⚠️ Validation errors:', errors);
    }

    startAutoSave() {
        setInterval(() => {
            if (this.isDirty) {
                console.log('🔄 Auto-save triggered');
                // TODO: Implementare auto-save
            }
        }, 30000); // Ogni 30 secondi
    }
}

// BLOCCO 6: Inizializzazione globale
document.addEventListener('DOMContentLoaded', () => {
    window.siafApp = new SiafApp();
    window.siafApp.init();

    // 🚀 VERSION FINALE - Sempre ultimo messaggio in console
    console.log('%c🚀 PRATICA-FORM v2.3.2-FINAL-2025-10-31-09:11 🚀', 'background: #FF9800; color: white; font-size: 16px; font-weight: bold; padding: 10px; border-radius: 5px;');
    console.log('%c📅 Last Update: 31/10/2025 09:11 - Versioning migliorato + orario italiano', 'background: #E91E63; color: white; font-size: 12px; padding: 5px;');
});

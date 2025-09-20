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

        // Modalità pratica: 'selection', 'new', 'edit'
        this.praticaMode = 'selection';
        this.currentProtocollo = null;
    }

    init() {
        console.log('🚀 SIAF App inizializzata');
        
        // Inizializza componenti
        this.initializeTabs();
        this.initializePraticaSelection();
        this.initializeForm();
        this.initializeVenditori();
        this.initializeActions();

        // Auto-popola data
        this.setCurrentDate();

        // Auto-save periodico
        this.startAutoSave();
    }

    // ========== BLOCCO 2: GESTIONE NAVIGAZIONE TAB ==========
    
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

    // ========== BLOCCO 2.5: GESTIONE SELEZIONE PRATICA ==========

    initializePraticaSelection() {
        const btnNuovaPratica = document.getElementById('btn-nuova-pratica');
        const btnCaricaPratica = document.getElementById('btn-carica-pratica');
        const btnBackSelection = document.getElementById('btn-back-selection');
        const protocolloLoad = document.getElementById('protocollo-load');

        if (btnNuovaPratica) {
            btnNuovaPratica.addEventListener('click', () => {
                this.startNuovaPratica();
            });
        }

        if (btnCaricaPratica) {
            btnCaricaPratica.addEventListener('click', () => {
                const protocollo = protocolloLoad?.value?.trim();
                if (protocollo) {
                    this.caricaPraticaEsistente(protocollo);
                } else {
                    alert('Inserisci un numero di protocollo valido (es: 3743/B)');
                }
            });
        }

        if (btnBackSelection) {
            btnBackSelection.addEventListener('click', () => {
                this.tornaAllaSelenzione();
            });
        }

        // Enter sul campo protocollo
        if (protocolloLoad) {
            protocolloLoad.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    btnCaricaPratica?.click();
                }
            });
        }

        console.log('✅ Selezione pratica inizializzata');
    }

    startNuovaPratica() {
        console.log('🆕 Avvio nuova pratica');
        this.praticaMode = 'new';
        this.currentProtocollo = null;
        this.showPraticaForm('📝 Nuova Pratica');
        this.resetForm();
    }

    async caricaPraticaEsistente(protocollo) {
        console.log('📂 Caricamento pratica:', protocollo);

        try {
            this.showLoadingState('Caricamento pratica...');

            const result = await this.loadPraticaFromBackend(protocollo);

            if (result.success) {
                this.praticaMode = 'edit';
                this.currentProtocollo = protocollo;
                this.showPraticaForm(`📝 Modifica Pratica - ${protocollo}`);
                this.populateFormWithData(result);
                this.hideLoadingState();
            } else {
                this.hideLoadingState();
                alert('Errore caricamento pratica: ' + result.error);
            }

        } catch (error) {
            this.hideLoadingState();
            console.error('❌ Errore caricamento:', error);
            alert('Errore durante il caricamento della pratica');
        }
    }

    async loadPraticaFromBackend(protocollo) {
        const url = `${this.appsScriptUrl}?action=load&protocollo=${encodeURIComponent(protocollo)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    }

    populateFormWithData(praticaData) {
        console.log('📋 Popolamento form con dati:', praticaData);

        // Popola campi base
        if (praticaData.operatore) {
            const operatoreSelect = document.getElementById('operatore');
            if (operatoreSelect) {
                // Trova l'option corrispondente per testo
                const options = operatoreSelect.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].textContent === praticaData.operatore) {
                        operatoreSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        }

        // Popola protocollo
        const protocolloField = document.getElementById('numero_protocollo');
        if (protocolloField && praticaData.protocollo) {
            protocolloField.value = praticaData.protocollo;
            protocolloField.className = 'readonly-field saved';
        }

        // Popola data
        const dataField = document.getElementById('data_compilazione');
        if (dataField && praticaData.data_creazione) {
            dataField.value = this.formatDateForDisplay(praticaData.data_creazione);
        }

        // Popola venditori
        if (praticaData.venditori && Array.isArray(praticaData.venditori)) {
            this.populateVenditori(praticaData.venditori);
        }
    }

    populateVenditori(venditoriData) {
        console.log('👥 Popolamento venditori:', venditoriData);

        // Reset venditori esistenti
        this.venditori = [];
        this.venditoreCounter = 0;
        const container = document.getElementById('venditori-container');
        if (container) {
            container.innerHTML = '';
        }

        // Ricostruisce venditori dai dati
        venditoriData.forEach(venditoreData => {
            const venditore = {
                id: ++this.venditoreCounter,
                ...venditoreData
            };

            this.venditori.push(venditore);
            this.renderVenditore(venditore);

            // Popola i campi del venditore
            setTimeout(() => {
                this.populateSingleVenditore(venditore);
            }, 100);
        });
    }

    populateSingleVenditore(venditore) {
        const fields = [
            'nome', 'cognome', 'sesso', 'stato_civile', 'luogo_nascita', 'data_nascita',
            'codice_fiscale', 'tipo_documento', 'numero_documento', 'data_rilascio',
            'data_scadenza', 'indirizzo', 'citta', 'provincia', 'telefono', 'email'
        ];

        fields.forEach(field => {
            const fieldElement = document.getElementById(`venditore_${venditore.id}_${field}`);
            if (fieldElement && venditore[field]) {
                fieldElement.value = venditore[field];
            }
        });
    }

    formatDateForDisplay(date) {
        if (date instanceof Date) {
            return this.formatDate(date);
        } else if (typeof date === 'string') {
            try {
                return this.formatDate(new Date(date));
            } catch (e) {
                return date;
            }
        }
        return '';
    }

    showPraticaForm(title) {
        const selection = document.getElementById('pratica-selection');
        const form = document.getElementById('pratica-form');
        const formTitle = document.getElementById('form-title');

        if (selection) selection.style.display = 'none';
        if (form) form.style.display = 'block';
        if (formTitle) formTitle.textContent = title;
    }

    tornaAllaSelenzione() {
        const selection = document.getElementById('pratica-selection');
        const form = document.getElementById('pratica-form');

        if (selection) selection.style.display = 'block';
        if (form) form.style.display = 'none';

        this.praticaMode = 'selection';
        this.currentProtocollo = null;
    }

    resetForm() {
        // Reset form fields
        const form = document.getElementById('siaf-form');
        if (form) {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            });
        }

        // Reset venditori
        this.venditori = [];
        this.venditoreCounter = 0;
        const container = document.getElementById('venditori-container');
        if (container) {
            container.innerHTML = '';
        }

        // Riaggiungi primo venditore
        setTimeout(() => {
            this.addVenditore();
        }, 100);

        // Reset protocollo field
        const protocolloField = document.getElementById('numero_protocollo');
        if (protocolloField) {
            protocolloField.value = '';
            protocolloField.placeholder = 'Seleziona operatore...';
            protocolloField.className = 'readonly-field';
        }
    }

    showLoadingState(message) {
        const btnCarica = document.getElementById('btn-carica-pratica');
        if (btnCarica) {
            btnCarica.disabled = true;
            btnCarica.innerHTML = `<span class="icon">⏳</span> ${message}`;
        }
    }

    hideLoadingState() {
        const btnCarica = document.getElementById('btn-carica-pratica');
        if (btnCarica) {
            btnCarica.disabled = false;
            btnCarica.innerHTML = '<span class="icon">🔍</span> CARICA PRATICA';
        }
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

    // ========== BLOCCO 3: GESTIONE FORM BASE ==========

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

    // BLOCCO 4: GESTIONE VENDITORI DINAMICI

initializeVenditori() {
    console.log('🔧 Inizializzando sistema venditori...');
    
    const addBtn = document.getElementById('add-venditore');
    
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            console.log('➕ Click add venditore');
            this.addVenditore();
        });
        console.log('✅ Event listener add-venditore attaccato');
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
        sesso: 'M',
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
    
    if (!container) {
        console.error('❌ Container venditori-container non trovato!');
        return;
    }
    
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
                            <label for="venditore_${venditore.id}_sesso">Sesso</label>
                            <select id="venditore_${venditore.id}_sesso" required>
                                <option value="M" ${venditore.sesso === 'M' ? 'selected' : ''}>Maschio</option>
                                <option value="F" ${venditore.sesso === 'F' ? 'selected' : ''}>Femmina</option>
                            </select>
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_stato_civile">Stato Civile</label>
                            <select id="venditore_${venditore.id}_stato_civile">
                                <option value="">Seleziona...</option>
                                <option value="celibe" ${venditore.stato_civile === 'celibe' ? 'selected' : ''}>Celibe</option>
                                <option value="nubile" ${venditore.stato_civile === 'nubile' ? 'selected' : ''}>Nubile</option>
                                <option value="coniugato" ${venditore.stato_civile === 'coniugato' ? 'selected' : ''}>Coniugato/a</option>
                                <option value="vedovo" ${venditore.stato_civile === 'vedovo' ? 'selected' : ''}>Vedovo</option>
                                <option value="vedova" ${venditore.stato_civile === 'vedova' ? 'selected' : ''}>Vedova</option>
                                <option value="divorziato" ${venditore.stato_civile === 'divorziato' ? 'selected' : ''}>Divorziato/a</option>
                            </select>
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
    console.log(`✅ Venditore ${venditore.id} renderizzato`);
}

    // ========== BLOCCO 5: GESTIONE SALVATAGGIO ==========

    initializeActions() {
        const savePraticaBtn = document.getElementById('save-pratica');
        const generateDocumentsBtn = document.getElementById('generate-documents');

        if (savePraticaBtn) {
            savePraticaBtn.addEventListener('click', () => {
                this.savePratica();
            });
        }

        if (generateDocumentsBtn) {
            generateDocumentsBtn.addEventListener('click', () => {
                this.saveAndGenerateDocuments();
            });
        }

        console.log('✅ Save and Generate buttons inizializzati');
    }

    async savePratica() {
        const formData = this.collectAllFormData();

        // Determina azione basata sulla modalità
        if (this.praticaMode === 'edit' && this.currentProtocollo) {
            formData.azione = 'update';
            formData.protocollo_esistente = this.currentProtocollo;
        } else {
            formData.azione = 'create';
        }

        console.log('💾 Salvataggio pratica - Modalità:', this.praticaMode, 'Azione:', formData.azione);

        this.showSaveLoading();
        
        try {
            const result = await this.submitToAppsScript(formData);
            this.showSaveSuccess(result);
            this.isDirty = false;
            
            // Aggiorna protocollo se nuova pratica
            if (result.protocollo && this.praticaMode === 'new') {
                const protocolField = document.getElementById('numero_protocollo');
                if (protocolField) {
                    protocolField.value = result.protocollo;
                    protocolField.className = 'readonly-field saved';
                }

                // Passa a modalità edit
                this.praticaMode = 'edit';
                this.currentProtocollo = result.protocollo;

                // Aggiorna titolo
                const formTitle = document.getElementById('form-title');
                if (formTitle) {
                    formTitle.textContent = `📝 Modifica Pratica - ${result.protocollo}`;
                }
            }
            
        } catch (error) {
            this.showSaveError(error);
        }
    }

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
sesso: document.getElementById(`venditore_${venditore.id}_sesso`)?.value || 'M',
stato_civile: document.getElementById(`venditore_${venditore.id}_stato_civile`)?.value || '',
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

    async saveAndGenerateDocuments() {
        console.log('🎯 Avvio salvataggio + generazione documenti');

        // Prima salva la pratica
        await this.savePratica();

        // Se il salvataggio è andato a buon fine, genera i documenti
        if (!this.isDirty) { // isDirty viene settato a false dopo salvataggio riuscito
            await this.generateDocuments();
        }
    }

    async generateDocuments() {
        const formData = this.collectAllFormData();

        // Determina protocollo da usare
        const protocollo = this.currentProtocollo || this.extractProtocolloFromField();

        if (!protocollo) {
            alert('Errore: numero protocollo non trovato. Salva prima la pratica.');
            return;
        }

        console.log('📁 Generazione documenti per protocollo:', protocollo);

        this.showGenerateLoading();

        try {
            const generateData = {
                ...formData,
                protocollo: protocollo,
                lettera: formData.lettera
            };

            const result = await this.submitGenerateToAppsScript(generateData);
            this.showGenerateSuccess(result);

        } catch (error) {
            this.showGenerateError(error);
        }
    }

    extractProtocolloFromField() {
        const protocolField = document.getElementById('numero_protocollo');
        if (protocolField && protocolField.value) {
            // Rimuovi "Preview: " se presente
            return protocolField.value.replace('Preview: ', '');
        }
        return null;
    }

    async submitGenerateToAppsScript(generateData) {
        const params = new URLSearchParams({
            action: 'generate_documents',
            data: JSON.stringify(generateData)
        });

        const url = `${this.appsScriptUrl}?${params}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Errore generazione documenti');
        }

        return result;
    }

    // ========== BLOCCO 6: UI FEEDBACK E UTILITÀ ==========

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

    showGenerateLoading() {
        const status = document.getElementById('generate-status');
        const generateBtn = document.getElementById('generate-documents');

        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.classList.add('loading');
        }

        if (status) {
            status.className = 'generate-status loading';
            status.textContent = '📁 Generando documenti...';
        }
    }

    showGenerateSuccess(result) {
        const status = document.getElementById('generate-status');
        const generateBtn = document.getElementById('generate-documents');

        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.classList.remove('loading');
        }

        if (status) {
            status.className = 'generate-status success';
            status.textContent = `✅ Documenti generati! ${result.documenti_creati || 0} file creati`;
        }

        // Auto-hide dopo 5 secondi
        setTimeout(() => {
            if (status) {
                status.className = 'generate-status';
                status.textContent = '';
            }
        }, 5000);
    }

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

    startAutoSave() {
        // Auto-save disabilitato per evitare cartelle duplicate su Drive
        // L'utente deve salvare manualmente con SALVA o GENERA DOCUMENTI
        console.log('⚠️ Auto-save disabilitato - salvataggio manuale richiesto');
    }
}

// BLOCCO 7: Inizializzazione app quando DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inizializzazione SIAF App...');
    
    window.siafApp = new SiafApp();
    window.siafApp.init();
    
    console.log('✅ SIAF App pronta!');
});

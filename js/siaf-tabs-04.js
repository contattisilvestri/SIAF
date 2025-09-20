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

        // Immobili multipli
        this.immobili = [];
        this.immobileCounter = 0;

        // Sistema province/comuni
        this.comuniRecenti = this.loadComuniRecenti();

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
        this.initializeImmobili();
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
            operatore_id: selectedOption?.value || '', // ID operatore per mapping template

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

    // ========== BLOCCO IMMOBILI: GESTIONE IMMOBILI DINAMICI ==========

    initializeImmobili() {
        console.log('🏠 Inizializzando sistema immobili...');

        const addBtn = document.getElementById('add-immobile');

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                console.log('➕ Click add immobile');
                this.addImmobile();
            });
            console.log('✅ Event listener add-immobile attaccato');
        } else {
            console.error('❌ Pulsante add-immobile non trovato!');
        }

        // Aggiungi primo immobile di default
        console.log('🚀 Aggiungendo primo immobile di default...');
        this.addImmobile();

        // Inizializza comuni recenti UI dopo il primo rendering
        setTimeout(() => {
            this.refreshComuniRecentiUI();
        }, 200);

        console.log('✅ Sistema immobili inizializzato');
    }

    addImmobile() {
        console.log('🏠 Aggiungendo immobile...');

        const immobile = {
            id: ++this.immobileCounter,
            provincia: 'Rovigo',
            comune: 'Bergantino',
            via: '',
            numero: '',
            intestatari: [''],
            blocchiCatastali: [],
            confini: {
                nord: [''],
                est: [''],
                sud: [''],
                ovest: ['']
            }
        };

        // Aggiungi primo blocco catastale (sempre Fabbricati)
        immobile.blocchiCatastali.push({
            id: 1,
            descrizione: 'distinta nel catasto dei fabbricati al',
            tipoCatasto: 'fabbricati',
            righe: [this.createEmptyFabbricatoRow()]
        });

        this.immobili.push(immobile);
        console.log(`✅ Immobile ${immobile.id} aggiunto. Totale immobili:`, this.immobili.length);

        this.renderImmobile(immobile);
        this.updateTabProgress();

        console.log('📊 Array immobili attuale:', this.immobili);
    }

    createEmptyFabbricatoRow() {
        return {
            id: 1,
            foglio: '',
            mappale: '',
            subalterno: '',
            categoria: '',
            classe: '',
            vani_mq: '',
            superfici: '',
            indirizzo_piano: '',
            rendita: ''
        };
    }

    createEmptyTerrenoRow() {
        return {
            id: 1,
            foglio: '',
            mappale: '',
            porzione: '',
            qualita: '',
            classe: '',
            metri_quadrati: '',
            dominicale: '',
            agrario: ''
        };
    }

    renderImmobile(immobile) {
        const container = document.getElementById('immobili-container');

        if (!container) {
            console.error('❌ Container immobili-container non trovato!');
            return;
        }

        const isFirst = this.immobili.length === 1;

        const immobileHtml = `
            <div id="immobile-${immobile.id}" class="immobile-card">
                <div class="immobile-header">
                    <h3>🏠 Immobile ${immobile.id}</h3>
                    ${!isFirst ? `<button type="button" class="btn-remove" onclick="window.siafApp.removeImmobile(${immobile.id})">❌ Rimuovi Immobile</button>` : ''}
                </div>

                <!-- Dati Generali Immobile -->
                <div class="field-card">
                    <h4>📍 Dati Generali</h4>

                    <!-- Comuni Recenti -->
                    <div class="comuni-recenti-section">
                        <h5>🕐 Comuni Recenti</h5>
                        <div class="comuni-recenti">
                            ${this.renderComuniRecenti(immobile.id)}
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label for="immobile_${immobile.id}_provincia">Provincia</label>
                            <select id="immobile_${immobile.id}_provincia"
                                    onchange="window.siafApp.handleProvinciaChange(${immobile.id})">
                                <option value="">Seleziona provincia...</option>
                                ${Object.keys(PROVINCE_COMUNI).map(prov =>
                                    `<option value="${prov}" ${prov === immobile.provincia ? 'selected' : ''}>${prov}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="field-group">
                            <label for="immobile_${immobile.id}_comune">Comune</label>
                            <select id="immobile_${immobile.id}_comune"
                                    onchange="window.siafApp.handleComuneChange(${immobile.id})">
                                <option value="">Prima seleziona provincia...</option>
                            </select>
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="immobile_${immobile.id}_via">Via</label>
                            <input type="text" id="immobile_${immobile.id}_via" value="${immobile.via}">
                        </div>
                        <div class="field-group">
                            <label for="immobile_${immobile.id}_numero">Numero</label>
                            <input type="text" id="immobile_${immobile.id}_numero" value="${immobile.numero}">
                        </div>
                    </div>
                </div>

                <!-- Intestatari -->
                <div class="field-card">
                    <div class="field-header">
                        <h4>👤 Proprietà intestata a</h4>
                        <button type="button" class="btn btn-sm" onclick="window.siafApp.addIntestatario(${immobile.id})">➕ Aggiungi Intestatario</button>
                    </div>
                    <div id="intestatari-${immobile.id}" class="intestatari-container">
                        ${this.renderIntestatari(immobile)}
                    </div>
                </div>

                <!-- Blocchi Catastali -->
                <div class="field-card">
                    <div class="field-header">
                        <h4>📋 Descrizione Catastale</h4>
                        <button type="button" class="btn btn-sm" onclick="window.siafApp.addBloccoCatastale(${immobile.id})">➕ Aggiungi Blocco</button>
                    </div>
                    <div id="blocchi-${immobile.id}">
                        ${this.renderBlocchiCatastali(immobile)}
                    </div>
                </div>

                <!-- Confini -->
                <div class="confini-section">
                    <h4>🧭 Confini</h4>
                    ${this.renderConfini(immobile)}
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', immobileHtml);

        // Inizializza dropdown comune se la provincia è già impostata
        setTimeout(() => {
            if (immobile.provincia) {
                this.populateComuniDropdown(immobile.id, immobile.provincia, immobile.comune);
            }
        }, 100);

        console.log(`✅ Immobile ${immobile.id} renderizzato`);
    }

    renderIntestatari(immobile) {
        return immobile.intestatari.map((intestatario, index) => `
            <div class="intestatario-row">
                <input type="text" class="intestatario-input"
                       id="intestatario_${immobile.id}_${index}"
                       value="${intestatario}"
                       placeholder="Nome intestatario">
                ${immobile.intestatari.length > 1 ?
                    `<button type="button" class="btn-remove-mappale" onclick="window.siafApp.removeIntestatario(${immobile.id}, ${index})">❌</button>` :
                    ''}
            </div>
        `).join('');
    }

    renderBlocchiCatastali(immobile) {
        return immobile.blocchiCatastali.map(blocco => `
            <div id="blocco-${immobile.id}-${blocco.id}" class="blocco-catastale">
                <div class="blocco-header">
                    <h4>📊 Blocco Catastale ${blocco.id}</h4>
                    ${immobile.blocchiCatastali.length > 1 ?
                        `<button type="button" class="btn-remove-block" onclick="window.siafApp.removeBloccoCatastale(${immobile.id}, ${blocco.id})">❌ Rimuovi Blocco</button>` :
                        ''}
                </div>

                <!-- Dropdown Descrizione -->
                ${blocco.id === 1 ? '' : this.renderDescrizioneDropdown(immobile.id, blocco.id, blocco.descrizione)}

                <!-- Tipo Catasto -->
                ${blocco.id === 1 ? '' : this.renderTipoCatastoSelector(immobile.id, blocco.id, blocco.tipoCatasto)}

                <!-- Righe Catastali -->
                <div id="righe-${immobile.id}-${blocco.id}">
                    ${this.renderRigheCatastali(immobile.id, blocco)}
                </div>

                <button type="button" class="btn-add-catasto-row" onclick="window.siafApp.addRigaCatastale(${immobile.id}, ${blocco.id})">➕ Aggiungi Riga</button>
            </div>
        `).join('');
    }

    renderDescrizioneDropdown(immobileId, bloccoId, selectedValue) {
        const options = [
            { value: 'distinta nel catasto dei fabbricati al', text: 'distinta nel catasto dei fabbricati al' },
            { value: 'area_sedime', text: "l'area di sedime di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'area_cortiliva', text: "l'area cortiliva di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'parte_area_sedime', text: "parte dell'area di sedime di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'parte_area_cortiliva', text: "parte dell'area cortiliva di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'area_sedime_e_cortiliva', text: "l'area di sedime e parte dell'area cortiliva di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'custom', text: 'Inserisci testo manualmente' }
        ];

        return `
            <select class="descrizione-dropdown" id="descrizione-${immobileId}-${bloccoId}"
                    onchange="window.siafApp.handleDescrizioneChange(${immobileId}, ${bloccoId})">
                ${options.map(opt => `<option value="${opt.value}" ${opt.value === selectedValue ? 'selected' : ''}>${opt.text}</option>`).join('')}
            </select>
            <textarea class="descrizione-custom" id="descrizione-custom-${immobileId}-${bloccoId}"
                      placeholder="Inserisci descrizione personalizzata"
                      style="${selectedValue === 'custom' ? 'display: block;' : 'display: none;'}"></textarea>
        `;
    }

    renderTipoCatastoSelector(immobileId, bloccoId, selectedType) {
        return `
            <div class="tipo-catasto-selector">
                <label>
                    <input type="radio" name="tipo-${immobileId}-${bloccoId}" value="fabbricati"
                           ${selectedType === 'fabbricati' ? 'checked' : ''}
                           onchange="window.siafApp.changeTipoCatasto(${immobileId}, ${bloccoId}, 'fabbricati')">
                    Catasto Fabbricati
                </label>
                <label>
                    <input type="radio" name="tipo-${immobileId}-${bloccoId}" value="terreni"
                           ${selectedType === 'terreni' ? 'checked' : ''}
                           onchange="window.siafApp.changeTipoCatasto(${immobileId}, ${bloccoId}, 'terreni')">
                    Catasto Terreni
                </label>
            </div>
        `;
    }

    renderRigheCatastali(immobileId, blocco) {
        return blocco.righe.map(riga => `
            <div id="riga-${immobileId}-${blocco.id}-${riga.id}" class="catasto-row">
                ${blocco.tipoCatasto === 'fabbricati' ? this.renderRigaFabbricati(immobileId, blocco.id, riga) : this.renderRigaTerreni(immobileId, blocco.id, riga)}
                ${blocco.righe.length > 1 ?
                    `<button type="button" class="btn-remove-mappale" onclick="window.siafApp.removeRigaCatastale(${immobileId}, ${blocco.id}, ${riga.id})">❌ Rimuovi</button>` :
                    ''}
            </div>
        `).join('');
    }

    renderRigaFabbricati(immobileId, bloccoId, riga) {
        return `
            <div class="catasto-fields">
                <div><label>Fog.</label><input type="text" id="fog_${immobileId}_${bloccoId}_${riga.id}" value="${riga.foglio}" placeholder="8"></div>
                <div><label>Map.</label><input type="text" id="map_${immobileId}_${bloccoId}_${riga.id}" value="${riga.mappale}" placeholder="1335"></div>
                <div><label>Sub.</label><input type="text" id="sub_${immobileId}_${bloccoId}_${riga.id}" value="${riga.subalterno}" placeholder="-"></div>
                <div><label>Categoria</label><input type="text" id="cat_${immobileId}_${bloccoId}_${riga.id}" value="${riga.categoria}" placeholder="A/3"></div>
                <div><label>Classe</label><input type="text" id="classe_${immobileId}_${bloccoId}_${riga.id}" value="${riga.classe}" placeholder="1"></div>
                <div><label>Vani/mq</label><input type="text" id="vani_${immobileId}_${bloccoId}_${riga.id}" value="${riga.vani_mq}" placeholder="5,5"></div>
                <div><label>Superfici</label><input type="text" id="sup_${immobileId}_${bloccoId}_${riga.id}" value="${riga.superfici}" placeholder="128"></div>
                <div><label>Indirizzo/Piano</label><input type="text" id="ind_${immobileId}_${bloccoId}_${riga.id}" value="${riga.indirizzo_piano}" placeholder="pt-1"></div>
                <div><label>Rendita</label><input type="text" id="rend_${immobileId}_${bloccoId}_${riga.id}" value="${riga.rendita}" placeholder="298,25"></div>
            </div>
        `;
    }

    renderRigaTerreni(immobileId, bloccoId, riga) {
        return `
            <div class="catasto-fields">
                <div><label>Fog.</label><input type="text" id="fog_${immobileId}_${bloccoId}_${riga.id}" value="${riga.foglio}" placeholder="8"></div>
                <div><label>Map.</label><input type="text" id="map_${immobileId}_${bloccoId}_${riga.id}" value="${riga.mappale}" placeholder="1335"></div>
                <div><label>Porz.</label><input type="text" id="porz_${immobileId}_${bloccoId}_${riga.id}" value="${riga.porzione}" placeholder="-"></div>
                <div><label>Qualità</label><input type="text" id="qual_${immobileId}_${bloccoId}_${riga.id}" value="${riga.qualita}" placeholder="ente urbano"></div>
                <div><label>Classe</label><input type="text" id="classe_${immobileId}_${bloccoId}_${riga.id}" value="${riga.classe}" placeholder="1"></div>
                <div><label>Mq</label><input type="text" id="mq_${immobileId}_${bloccoId}_${riga.id}" value="${riga.metri_quadrati}" placeholder="745"></div>
                <div><label>Dominicale</label><input type="text" id="dom_${immobileId}_${bloccoId}_${riga.id}" value="${riga.dominicale}" placeholder="0,62"></div>
                <div><label>Agrario</label><input type="text" id="agr_${immobileId}_${bloccoId}_${riga.id}" value="${riga.agrario}" placeholder="0,34"></div>
            </div>
        `;
    }

    renderConfini(immobile) {
        const direzioni = ['nord', 'est', 'sud', 'ovest'];
        return direzioni.map(direzione => `
            <div class="confini-direction">
                <label>${direzione.charAt(0).toUpperCase() + direzione.slice(1)} ragioni ai mappali:</label>
                <div id="confini-${immobile.id}-${direzione}" class="mappali-container">
                    ${this.renderMappaliConfini(immobile.id, direzione, immobile.confini[direzione])}
                    <button type="button" class="btn-add-mappale" onclick="window.siafApp.addMappaleConfine(${immobile.id}, '${direzione}')">➕ Aggiungi</button>
                </div>
            </div>
        `).join('');
    }

    renderMappaliConfini(immobileId, direzione, mappali) {
        return mappali.map((mappale, index) => `
            <span>
                <input type="text" class="mappale-input"
                       id="confine_${immobileId}_${direzione}_${index}"
                       value="${mappale}"
                       placeholder="n. mappale">
                ${mappali.length > 1 ?
                    `<button type="button" class="btn-remove-mappale" onclick="window.siafApp.removeMappaleConfine(${immobileId}, '${direzione}', ${index})">❌</button>` :
                    ''}
            </span>
        `).join('');
    }

    // Funzioni di gestione eventi

    addIntestatario(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile) {
            immobile.intestatari.push('');
            this.refreshIntestatari(immobileId);
        }
    }

    removeIntestatario(immobileId, index) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile && immobile.intestatari.length > 1) {
            immobile.intestatari.splice(index, 1);
            this.refreshIntestatari(immobileId);
        }
    }

    refreshIntestatari(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const container = document.getElementById(`intestatari-${immobileId}`);
        if (container && immobile) {
            container.innerHTML = this.renderIntestatari(immobile);
        }
    }

    addBloccoCatastale(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile) {
            const newBlocco = {
                id: immobile.blocchiCatastali.length + 1,
                descrizione: 'area_sedime',
                tipoCatasto: 'terreni',
                righe: [this.createEmptyTerrenoRow()]
            };
            immobile.blocchiCatastali.push(newBlocco);
            this.refreshBlocchiCatastali(immobileId);
        }
    }

    removeBloccoCatastale(immobileId, bloccoId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile && immobile.blocchiCatastali.length > 1) {
            immobile.blocchiCatastali = immobile.blocchiCatastali.filter(b => b.id !== bloccoId);
            this.refreshBlocchiCatastali(immobileId);
        }
    }

    refreshBlocchiCatastali(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const container = document.getElementById(`blocchi-${immobileId}`);
        if (container && immobile) {
            container.innerHTML = this.renderBlocchiCatastali(immobile);
        }
    }

    handleDescrizioneChange(immobileId, bloccoId) {
        const select = document.getElementById(`descrizione-${immobileId}-${bloccoId}`);
        const customField = document.getElementById(`descrizione-custom-${immobileId}-${bloccoId}`);

        if (select.value === 'custom') {
            customField.style.display = 'block';
        } else {
            customField.style.display = 'none';
        }
    }

    changeTipoCatasto(immobileId, bloccoId, tipo) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);

        if (blocco) {
            blocco.tipoCatasto = tipo;
            // Reset righe con nuovo tipo
            blocco.righe = [tipo === 'fabbricati' ? this.createEmptyFabbricatoRow() : this.createEmptyTerrenoRow()];
            this.refreshRigheCatastali(immobileId, bloccoId);
        }
    }

    addRigaCatastale(immobileId, bloccoId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);

        if (blocco) {
            const newRow = blocco.tipoCatasto === 'fabbricati' ?
                this.createEmptyFabbricatoRow() :
                this.createEmptyTerrenoRow();
            newRow.id = blocco.righe.length + 1;
            blocco.righe.push(newRow);
            this.refreshRigheCatastali(immobileId, bloccoId);
        }
    }

    removeRigaCatastale(immobileId, bloccoId, rigaId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);

        if (blocco && blocco.righe.length > 1) {
            blocco.righe = blocco.righe.filter(r => r.id !== rigaId);
            this.refreshRigheCatastali(immobileId, bloccoId);
        }
    }

    refreshRigheCatastali(immobileId, bloccoId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);
        const container = document.getElementById(`righe-${immobileId}-${bloccoId}`);

        if (container && blocco) {
            container.innerHTML = this.renderRigheCatastali(immobileId, blocco);
        }
    }

    addMappaleConfine(immobileId, direzione) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile) {
            immobile.confini[direzione].push('');
            this.refreshMappaliConfini(immobileId, direzione);
        }
    }

    removeMappaleConfine(immobileId, direzione, index) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile && immobile.confini[direzione].length > 1) {
            immobile.confini[direzione].splice(index, 1);
            this.refreshMappaliConfini(immobileId, direzione);
        }
    }

    refreshMappaliConfini(immobileId, direzione) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const container = document.getElementById(`confini-${immobileId}-${direzione}`);
        if (container && immobile) {
            // Mantieni il bottone "Aggiungi"
            const addButton = container.querySelector('.btn-add-mappale');
            container.innerHTML = this.renderMappaliConfini(immobileId, direzione, immobile.confini[direzione]);
            container.appendChild(addButton);
        }
    }

    removeImmobile(id) {
        if (this.immobili.length === 1) {
            alert('Deve esserci almeno un immobile');
            return;
        }

        this.immobili = this.immobili.filter(i => i.id !== id);
        document.getElementById(`immobile-${id}`).remove();
        this.updateTabProgress();
        this.isDirty = true;

        console.log(`❌ Rimosso immobile ${id}`);
    }

    // ========== SISTEMA PROVINCE/COMUNI CON MEMORIZZAZIONE ==========

    loadComuniRecenti() {
        try {
            const stored = localStorage.getItem('siaf-comuni-recenti');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Verifica che sia un array valido
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (error) {
            console.warn('⚠️ Errore caricamento comuni recenti:', error);
        }
        // Ritorna default se non trova nulla o in caso di errore
        return [...COMUNI_FREQUENTI_DEFAULT];
    }

    saveComuniRecenti() {
        try {
            localStorage.setItem('siaf-comuni-recenti', JSON.stringify(this.comuniRecenti));
            console.log('✅ Comuni recenti salvati in localStorage');
        } catch (error) {
            console.warn('⚠️ Errore salvataggio comuni recenti:', error);
        }
    }

    addComuneRecente(comune, provincia) {
        // Rimuovi se già presente
        this.comuniRecenti = this.comuniRecenti.filter(c =>
            !(c.comune === comune && c.provincia === provincia)
        );

        // Aggiungi in cima
        this.comuniRecenti.unshift({ comune, provincia });

        // Mantieni solo gli ultimi 7
        this.comuniRecenti = this.comuniRecenti.slice(0, 7);

        // Salva in localStorage
        this.saveComuniRecenti();

        console.log(`✅ Aggiunto comune recente: ${comune} (${provincia})`);
    }

    setComuneFromRecent(immobileId, comune, provincia) {
        const provinciaField = document.getElementById(`immobile_${immobileId}_provincia`);
        const comuneField = document.getElementById(`immobile_${immobileId}_comune`);

        if (provinciaField && comuneField) {
            provinciaField.value = provincia;
            comuneField.innerHTML = '';

            // Popola dropdown comuni per la provincia selezionata
            this.populateComuniDropdown(immobileId, provincia, comune);

            console.log(`📍 Impostato ${comune} (${provincia}) per immobile ${immobileId}`);
        }
    }

    populateComuniDropdown(immobileId, provincia, selectedComune = '') {
        const comuneField = document.getElementById(`immobile_${immobileId}_comune`);
        if (!comuneField || !provincia || !PROVINCE_COMUNI[provincia]) {
            return;
        }

        const comuni = PROVINCE_COMUNI[provincia];
        let options = '<option value="">Seleziona comune...</option>';

        comuni.forEach(comune => {
            const selected = comune === selectedComune ? 'selected' : '';
            options += `<option value="${comune}" ${selected}>${comune}</option>`;
        });

        comuneField.innerHTML = options;
    }

    handleProvinciaChange(immobileId) {
        const provinciaField = document.getElementById(`immobile_${immobileId}_provincia`);
        const comuneField = document.getElementById(`immobile_${immobileId}_comune`);

        if (provinciaField && comuneField) {
            const provincia = provinciaField.value;
            this.populateComuniDropdown(immobileId, provincia);
        }
    }

    handleComuneChange(immobileId) {
        const provinciaField = document.getElementById(`immobile_${immobileId}_provincia`);
        const comuneField = document.getElementById(`immobile_${immobileId}_comune`);

        if (provinciaField && comuneField && provinciaField.value && comuneField.value) {
            // Aggiungi ai recenti quando viene selezionato un comune
            this.addComuneRecente(comuneField.value, provinciaField.value);

            // Aggiorna la UI dei comuni recenti per tutti gli immobili
            this.refreshComuniRecentiUI();
        }
    }

    refreshComuniRecentiUI() {
        // Aggiorna la sezione comuni recenti per tutti gli immobili
        this.immobili.forEach(immobile => {
            const container = document.querySelector(`#immobile-${immobile.id} .comuni-recenti`);
            if (container) {
                container.innerHTML = this.renderComuniRecenti(immobile.id);
            }
        });
    }

    renderComuniRecenti(immobileId) {
        if (this.comuniRecenti.length === 0) {
            return '<p class="no-recent">Nessun comune recente</p>';
        }

        return this.comuniRecenti.map(item => `
            <button type="button" class="btn-comune-recente"
                    onclick="window.siafApp.setComuneFromRecent(${immobileId}, '${item.comune}', '${item.provincia}')">
                <span class="comune">${item.comune}</span>
                <span class="provincia">(${item.provincia})</span>
            </button>
        `).join('');
    }
}

// ========== DATASET PROVINCE E COMUNI ITALIANI ==========

const PROVINCE_COMUNI = {
    "Rovigo": ["Adria", "Ariano nel Polesine", "Arquà Polesine", "Badia Polesine", "Bagnolo di Po", "Bergantino", "Bosaro", "Calto", "Canaro", "Canda", "Castelguglielmo", "Castelmassa", "Castelnovo Bariano", "Ceneselli", "Ceregnano", "Costa di Rovigo", "Crespino", "Ficarolo", "Fiesso Umbertiano", "Frassinelle Polesine", "Fratta Polesine", "Gaiba", "Gavello", "Giacciano con Baruchella", "Guarda Veneta", "Lendinara", "Loreo", "Lusia", "Melara", "Occhiobello", "Papozze", "Pettorazza Grimani", "Pincara", "Polesella", "Pontecchio Polesine", "Porto Tolle", "Porto Viro", "Rosolina", "Rovigo", "Salara", "San Bellino", "San Martino di Venezze", "Stienta", "Taglio di Po", "Trecenta", "Villadose", "Villamarzana", "Villanova del Ghebbo", "Villanova Marchesana"],

    "Verona": ["Affi", "Albaredo d'Adige", "Angiari", "Arcole", "Badia Calavena", "Bardolino", "Belfiore", "Bevilacqua", "Bonavigo", "Boschi Sant'Anna", "Bosco Chiesanuova", "Bovolone", "Brentino Belluno", "Brenzone sul Garda", "Bussolengo", "Buttapietra", "Caldiero", "Caprino Veronese", "Casaleone", "Castagnaro", "Castel d'Azzano", "Castelnuovo del Garda", "Cavaion Veronese", "Cazzano di Tramigna", "Cerea", "Cerro Veronese", "Cologna Veneta", "Colognola ai Colli", "Concamarise", "Costermano sul Garda", "Dolcè", "Erbè", "Erbezzo", "Ferrara di Monte Baldo", "Fumane", "Garda", "Gazzo Veronese", "Grezzana", "Illasi", "Isola della Scala", "Isola Rizza", "Lavagno", "Lazise", "Legnago", "Malcesine", "Marano di Valpolicella", "Mezzane di Sotto", "Minerbe", "Montecchia di Crosara", "Monteforte d'Alpone", "Mozzecane", "Negrar di Valpolicella", "Nogara", "Nogarole Rocca", "Oppeano", "Ossimo", "Palù", "Pastrengo", "Pescantina", "Peschiera del Garda", "Povegliano Veronese", "Pressana", "Rivoli Veronese", "Roncà", "Ronco all'Adige", "Roverchiara", "Roveredo di Guà", "Salizzole", "San Bonifacio", "San Giovanni Ilarione", "San Giovanni Lupatoto", "San Martino Buon Albergo", "San Mauro di Saline", "San Pietro di Morubio", "San Pietro in Cariano", "San Zeno di Montagna", "Sant'Ambrogio di Valpolicella", "Sant'Anna d'Alfaedo", "Selva di Progno", "Soave", "Sommacampagna", "Sona", "Sorgà", "Terrazzo", "Torri del Benaco", "Tregnago", "Trevenzuolo", "Valeggio sul Mincio", "Velo Veronese", "Verona", "Veronella", "Vestenanova", "Vigasio", "Villa Bartolomea", "Villafranca di Verona", "Zevio", "Zimella"],

    "Venezia": ["Annone Veneto", "Campagna Lupia", "Campolongo Maggiore", "Camponogara", "Caorle", "Cavallino-Treporti", "Cavarzere", "Chioggia", "Cinto Caomaggiore", "Cona", "Concordia Sagittaria", "Dolo", "Eraclea", "Fiesso d'Artico", "Fossalta di Piave", "Fossalta di Portogruaro", "Fossò", "Gruaro", "Jesolo", "Marcon", "Martellago", "Meolo", "Mestre", "Mira", "Mirano", "Musile di Piave", "Noale", "Noventa di Piave", "Pianiga", "Portogruaro", "Pramaggiore", "Quarto d'Altino", "Salzano", "San Donà di Piave", "San Michele al Tagliamento", "San Stino di Livenza", "Santa Maria di Sala", "Santo Stino di Livenza", "Scorzè", "Spinea", "Stra", "Teglio Veneto", "Torre di Mosto", "Venezia", "Vigonovo"],

    "Mantova": ["Asola", "Bagnolo San Vito", "Bigarello", "Borgo Virgilio", "Borgofranco sul Po", "Bozzolo", "Canneto sull'Oglio", "Casalmoro", "Casaloldo", "Casalromano", "Castel d'Ario", "Castel Goffredo", "Castellucchio", "Castiglione delle Stiviere", "Ceresara", "Commessaggio", "Curtatone", "Dosolo", "Gazoldo degli Ippoliti", "Goito", "Gonzaga", "Guidizzolo", "Magnacavallo", "Mantova", "Marcaria", "Mariana Mantovana", "Marmirolo", "Medole", "Moglia", "Monzambano", "Motteggiana", "Ostiglia", "Pegognaga", "Piubega", "Poggio Rusco", "Pomponesco", "Ponti sul Mincio", "Porto Mantovano", "Quingentole", "Quistello", "Redondesco", "Revere", "Rivarolo Mantovano", "Rodigo", "Roncoferraro", "Roverbella", "Sabbioneta", "San Benedetto Po", "San Giorgio Bigarello", "San Martino dall'Argine", "Schivenoglia", "Sermide e Felonica", "Serravalle a Po", "Solferino", "Sustinente", "Suzzara", "Villimpenta", "Viadana", "Villa Poma", "Volta Mantovana"],

    "Ferrara": ["Argenta", "Berra", "Bondeno", "Cento", "Codigoro", "Comacchio", "Copparo", "Ferrara", "Fiscaglia", "Goro", "Jolanda di Savoia", "Lagosanto", "Masi Torello", "Mesola", "Ostellato", "Poggio Renatico", "Portomaggiore", "Riva del Po", "Sant'Agostino", "Terre del Reno", "Tresigallo", "Vigarano Mainarda", "Voghiera"]
};

// Comuni più frequenti per l'area SIAF (personalizzabile)
const COMUNI_FREQUENTI_DEFAULT = [
    { comune: "Bergantino", provincia: "Rovigo" },
    { comune: "Castelmassa", provincia: "Rovigo" },
    { comune: "Ostiglia", provincia: "Mantova" },
    { comune: "Revere", provincia: "Mantova" },
    { comune: "Suzzara", provincia: "Mantova" },
    { comune: "Bondeno", provincia: "Ferrara" }
];

// BLOCCO 7: Inizializzazione app quando DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inizializzazione SIAF App...');

    window.siafApp = new SiafApp();
    window.siafApp.init();

    console.log('✅ SIAF App pronta!');
});

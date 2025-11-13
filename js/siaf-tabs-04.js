// BLOCCO 1: Definizione classe principale e inizializzazione variabili
// 🚀 VERSION: SIAF-v2.3.15-FINAL-2025-11-03-19:00

// Sistema versioning dinamico
window.SIAF_VERSION = {
    major: 2,
    minor: 9,
    patch: 2,
    date: '12/11/2025',
    time: '18:00',
    description: 'Performance: Loading robusto con timeout, retry e indicatori progressivi',
    color: '#FF9500'  // iOS orange - performance
};

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
        this.geoDataLoaded = false;

        // Modalità pratica: 'selection', 'new', 'edit'
        this.praticaMode = 'selection';
        this.currentProtocollo = null;

        // Controllo prevenzione doppia generazione documenti
        this.isGeneratingDocuments = false;

        // CF Calculator (lazy loaded)
        this.cfCalculator = null;
        this.cfCalculatorReady = false;

        // Cittadinanza list (lazy loaded)
        this.cittadinanzaData = null;
        this.cittadinanzaLoaded = false;

        // Condizioni Economiche (a livello pratica)
        this.condizioniEconomiche = {
            modalita_prezzo: 'singola', // 'singola' o 'offerta_unica'
            prezzo_forfettario: {
                prezzo_totale: 0,
                percentuale_riduzione: 0
            },
            compenso: {
                percentuale_provvigione: 3,
                soglia_minima: 50000,
                importo_minimo: 1500
            },
            durata: {
                data_inizio: '',
                data_fine: '',
                tipo_rinnovo: 'cessato', // 'cessato', 'tacito_unico', 'tacito_continuo'
                giorni_preavviso: 5
            },
            esclusiva: {
                attiva: false,
                testo_custom: '',
                spese_massime: 0
            },
            autorizzazioni: {
                cartello_vendita: true,
                vetrine: true,
                internet: true,
                stampa: true
            },
            condizioni_pagamento: {
                giorni_versamento: 15,
                percentuale_anticipo: 10,
                modalita_saldo: 'assegno_circolare', // 'assegno_circolare', 'bonifico_istantaneo', 'altro'
                saldo_altro_testo: '',
                giorni_stipula_atto: 150
            },
            diritto_recesso: {
                luogo_conferimento: 'locale_agenzia' // 'locale_agenzia' o 'domicilio_venditore'
            },
            osservazioni: '',
            firma: {
                luogo: '',
                data: '' // formato YYYY-MM-DD
            }
        };
    }

    async init() {
        console.log('🚀 SIAF App inizializzata');

        try {
            // Inizializza componenti CORE (sincroni e veloci)
            this.updateLoadingStatus('Inizializzazione componenti...', 20);
            this.initializeTabs();
            this.initializePraticaSelection();
            this.initializeForm();
            this.initializeVenditori();
            this.initializeImmobili();
            this.initializeCondizioniTab();
            this.initializeActions();

            this.updateLoadingStatus('Configurazione interfaccia...', 60);
            // Renderizza ultime pratiche
            this.renderUltimePratiche();

            // Auto-popola data
            this.setCurrentDate();

            // Auto-save periodico
            this.startAutoSave();

            this.updateLoadingStatus('Caricamento dati geografici...', 80);
            // Carica geodati italiani in background (non bloccante)
            this.loadGeoDataInBackground();

            this.updateLoadingStatus('Completato!', 100);

            // Nascondi loading dopo 500ms
            setTimeout(() => this.hideLoadingIndicator(), 500);

        } catch (error) {
            console.error('❌ Errore durante init():', error);
            this.updateLoadingStatus('Errore di inizializzazione', 0, true);
            throw error;
        }
    }

    updateLoadingStatus(message, progress, isError = false) {
        const indicator = document.getElementById('version-indicator');
        if (indicator) {
            indicator.textContent = isError ? `❌ ${message}` : `⏳ ${message} (${progress}%)`;
            indicator.style.background = isError ? '#dc3545' : '#FF9500';
            indicator.style.color = 'white';
        }
        console.log(`📊 Loading: ${message} - ${progress}%`);
    }

    hideLoadingIndicator() {
        const indicator = document.getElementById('version-indicator');
        if (indicator) {
            // Chiamata alla funzione updateVersionIndicator che esiste già
            if (typeof updateVersionIndicator === 'function') {
                updateVersionIndicator();
            }
        }
    }

    async loadGeoDataInBackground() {
        const GEODATA_TIMEOUT = 5000; // 5 secondi max per geodati

        try {
            console.log('📍 Caricamento geodati in background...');

            // Promise con timeout per geodati
            const geoDataPromise = loadItalyGeoData();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout caricamento geodati')), GEODATA_TIMEOUT)
            );

            await Promise.race([geoDataPromise, timeoutPromise]);
            this.geoDataLoaded = true;

            console.log('✅ Geodati caricati - Province disponibili:', Object.keys(PROVINCE_COMUNI).length);

            // Aggiorna UI se ci sono immobili già renderizzati
            this.refreshProvinciaDropdowns();

            // Forza aggiornamento di tutte le dropdown provincia
            setTimeout(() => {
                this.forceUpdateAllProvinciaDropdowns();
            }, 500);

        } catch (error) {
            console.warn('⚠️ Geodati non disponibili o timeout, usando fallback');
            console.error('Errore dettagliato:', error);
            this.geoDataLoaded = false;
            // L'applicazione continua a funzionare con le province base
        }
    }

    forceUpdateAllProvinciaDropdowns() {
        // Aggiorna tutte le dropdown provincia esistenti
        this.immobili.forEach(immobile => {
            this.populateProvinciaDropdown(immobile.id, immobile.provincia);
        });
        console.log('🔄 Aggiornate tutte le dropdown provincia');
    }

    refreshProvinciaDropdowns() {
        // Aggiorna le dropdown province se ci sono immobili già renderizzati
        this.immobili.forEach(immobile => {
            const provinciaSelect = document.getElementById(`immobile_${immobile.id}_provincia`);
            if (provinciaSelect) {
                this.populateProvinciaDropdown(immobile.id, immobile.provincia);
            }
        });
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

            // Se si sta passando alla tab condizioni, aggiorna la sezione prezzo
            if (tabName === 'condizioni') {
                setTimeout(() => {
                    this.renderSezionePrezzo();
                    console.log('🔄 Sezione prezzo aggiornata dopo switch a tab condizioni');
                }, 50);
            }

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

            // Autocompletamento
            this.initializeAutocomplete(protocolloLoad);
        }

        console.log('✅ Selezione pratica inizializzata');
    }

    // ========== BLOCCO 2.6: AUTOCOMPLETAMENTO RICERCA ==========
    initializeAutocomplete(inputElement) {
        const dropdown = document.getElementById('autocomplete-dropdown');
        let debounceTimer;
        let selectedIndex = -1;

        inputElement.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Reset selezione
            selectedIndex = -1;

            // Debounce per evitare troppe chiamate
            clearTimeout(debounceTimer);

            if (query.length < 2) {
                this.hideAutocomplete(dropdown);
                return;
            }

            debounceTimer = setTimeout(() => {
                this.performSearch(query, dropdown);
            }, 300);
        });

        // Gestione navigazione con tastiera
        inputElement.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.autocomplete-item');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                this.updateSelection(items, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                this.updateSelection(items, selectedIndex);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                const selectedItem = items[selectedIndex];
                const protocollo = selectedItem.dataset.protocollo;
                this.selectAutocompleteItem(protocollo, inputElement, dropdown);
            } else if (e.key === 'Escape') {
                this.hideAutocomplete(dropdown);
            }
        });

        // Chiudi dropdown cliccando fuori
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !dropdown.contains(e.target)) {
                this.hideAutocomplete(dropdown);
            }
        });
    }

    async performSearch(query, dropdown) {
        try {
            const url = `${this.appsScriptUrl}?action=search&term=${encodeURIComponent(query)}&type=protocollo`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.success && data.results && data.results.length > 0) {
                this.showAutocompleteResults(data.results, dropdown);
            } else {
                this.showNoResults(dropdown);
            }
        } catch (error) {
            console.error('Errore ricerca autocompletamento:', error);
            this.hideAutocomplete(dropdown);
        }
    }

    showAutocompleteResults(results, dropdown) {
        // Limita a max 5 risultati
        const limitedResults = results.slice(0, 5);

        dropdown.innerHTML = limitedResults.map(result => `
            <div class="autocomplete-item" data-protocollo="${result.protocollo}">
                <div>
                    <div class="autocomplete-protocollo">${result.protocollo}</div>
                    <div class="autocomplete-operatore">${result.operatore || 'N/A'}</div>
                </div>
                <div class="autocomplete-data">${result.data_compilazione || ''}</div>
            </div>
        `).join('');

        // Aggiungi click listeners
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const protocollo = item.dataset.protocollo;
                const inputElement = document.getElementById('protocollo-load');
                this.selectAutocompleteItem(protocollo, inputElement, dropdown);
            });
        });

        dropdown.style.display = 'block';
    }

    showNoResults(dropdown) {
        dropdown.innerHTML = '<div class="autocomplete-no-results">Nessun risultato trovato</div>';
        dropdown.style.display = 'block';
    }

    hideAutocomplete(dropdown) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
    }

    updateSelection(items, selectedIndex) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    selectAutocompleteItem(protocollo, inputElement, dropdown) {
        inputElement.value = protocollo;
        this.hideAutocomplete(dropdown);
        // Carica automaticamente la pratica
        this.caricaPraticaEsistente(protocollo);
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

                // Disabilita dropdown operatore in modalità edit
                if (this.praticaMode === 'edit') {
                    this.lockOperatoreField(operatoreSelect, praticaData.operatore);
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

        // Popola immobili
        if (praticaData.immobili && Array.isArray(praticaData.immobili)) {
            this.populateImmobili(praticaData.immobili);
        }

        // Popola condizioni economiche
        if (praticaData.condizioni_economiche) {
            this.populateCondizioniEconomiche(praticaData.condizioni_economiche);
        }

        // Aggiungi alle pratiche recenti
        if (praticaData.protocollo && praticaData.venditori && praticaData.venditori.length > 0) {
            const cognomeVenditore = praticaData.venditori[0]?.cognome || 'Sconosciuto';
            this.addPraticaRecente(praticaData.protocollo, cognomeVenditore);
        }
    }

    lockOperatoreField(operatoreSelect, operatoreName) {
        // Disabilita il dropdown
        operatoreSelect.disabled = true;

        // Aggiunge stile visivo per indicare che è bloccato
        operatoreSelect.style.backgroundColor = '#f8f9fa';
        operatoreSelect.style.color = '#666';
        operatoreSelect.style.cursor = 'not-allowed';

        // Aggiunge icona di blocco se non è già presente
        const existingLock = operatoreSelect.parentNode.querySelector('.lock-indicator');
        if (!existingLock) {
            const lockIndicator = document.createElement('span');
            lockIndicator.className = 'lock-indicator';
            lockIndicator.innerHTML = '🔒';
            lockIndicator.style.cssText = `
                position: absolute;
                right: 30px;
                top: 50%;
                transform: translateY(-50%);
                color: #999;
                font-size: 14px;
                pointer-events: none;
            `;

            // Assicura che il parent abbia position relative
            operatoreSelect.parentNode.style.position = 'relative';
            operatoreSelect.parentNode.appendChild(lockIndicator);
        }

        // Aggiunge tooltip informativo
        operatoreSelect.title = `Operatore bloccato: ${operatoreName}\nL'operatore non può essere modificato per pratiche esistenti`;

        console.log(`🔒 Operatore bloccato in modalità edit: ${operatoreName}`);
    }

    populateImmobili(immobiliData) {
        console.log('🏠 Popolamento immobili:', immobiliData);

        // Reset immobili esistenti
        this.immobili = [];
        this.immobileCounter = 0;
        const container = document.getElementById('immobili-container');
        if (container) {
            container.innerHTML = '';
        }

        // Ricostruisce immobili dai dati
        immobiliData.forEach(immobileData => {
            const immobile = {
                id: ++this.immobileCounter,
                provincia: immobileData.provincia || 'Rovigo',
                comune: immobileData.comune || 'Bergantino',
                via: immobileData.via || '',
                numero: immobileData.numero || '',
                intestatari: immobileData.intestatari || [{ nome: '', cognome: '' }],
                blocchiCatastali: immobileData.blocchiCatastali || [],
                confini: immobileData.confini || {
                    nord: [''],
                    est: [''],
                    sud: [''],
                    ovest: ['']
                },
                condizioni_economiche: immobileData.condizioni_economiche || {
                    prezzo_vendita: 0,
                    percentuale_riduzione: 0
                },
                stato: immobileData.stato || {}
            };

            this.immobili.push(immobile);
            this.renderImmobile(immobile);

            // Popola i campi HTML dopo il render
            setTimeout(() => {
                this.populateSingleImmobile(immobile);
            }, 100);

            console.log(`✅ Ricostruito immobile ${immobile.id}:`, immobile);
        });

        // Se non ci sono immobili, aggiungi uno di default
        if (this.immobili.length === 0) {
            this.addImmobile();
        }
    }

    populateSingleImmobile(immobile) {
        if (!immobile || !immobile.stato) return;

        const id = immobile.id;
        const stato = immobile.stato;

        console.log(`🏠 Popolamento campi immobile ${id}:`, stato);

        // Helper per settare radio button
        const setRadio = (name, value) => {
            if (!value) return;
            const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
            if (radio) {
                radio.checked = true;
                // Trigger change event per mostrare/nascondere campi condizionali
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        // Helper per settare checkbox
        const setCheckbox = (id, checked) => {
            const checkbox = document.getElementById(id);
            if (checkbox) checkbox.checked = !!checked;
        };

        // Helper per settare valore campo
        const setValue = (id, value) => {
            const field = document.getElementById(id);
            if (field && value) field.value = value;
        };

        // 1. OCCUPAZIONE
        if (stato.occupazione) {
            setRadio(`occupazione_${id}`, stato.occupazione);
        }

        // 2. LOCAZIONE (se occupazione = locato)
        if (stato.locazione) {
            setValue(`inquilino_${id}`, stato.locazione.inquilino);
            setValue(`canone_${id}`, stato.locazione.canone_annuo);
            setValue(`scadenza_${id}`, stato.locazione.scadenza_contratto);
        }

        // 3. CONFORMITÀ
        if (stato.conformita) {
            setCheckbox(`conf_edilizia_${id}`, stato.conformita.edilizia);
            setCheckbox(`conf_catastale_${id}`, stato.conformita.catastale);
            setCheckbox(`conf_impianti_${id}`, stato.conformita.impianti);
        }

        // 4. VINCOLI
        if (stato.vincoli) {
            setCheckbox(`iscriz_preg_${id}`, stato.vincoli.iscrizioni_pregiudizievoli);
            setCheckbox(`vincoli_serv_${id}`, stato.vincoli.vincoli_servitu);
        }

        // 5. CERTIFICAZIONE ENERGETICA
        if (stato.certificazione_energetica) {
            const cert = stato.certificazione_energetica;

            // Modalità
            if (cert.modalita) {
                setRadio(`cert_modalita_${id}`, cert.modalita);
            }

            // Classe (dropdown o testo)
            setValue(`cert_classe_select_${id}`, cert.classe);
            setValue(`cert_classe_text_${id}`, cert.classe);

            // Altri campi
            setValue(`cert_consumo_${id}`, cert.consumo_kwh);
            setValue(`cert_codice_${id}`, cert.codice_attestato);
            setValue(`cert_data_${id}`, cert.data_emissione);
            setValue(`cert_certificatore_${id}`, cert.certificatore);
        }

        // 6. DOCUMENTI CONSEGNATI
        if (stato.documenti_consegnati && Array.isArray(stato.documenti_consegnati)) {
            stato.documenti_consegnati.forEach(doc => {
                if (doc === 'titoli_provenienza') setCheckbox(`doc_titoli_${id}`, true);
                else if (doc === 'planimetria') setCheckbox(`doc_planimetria_${id}`, true);
                else if (doc === 'visure') setCheckbox(`doc_visure_${id}`, true);
                else if (doc === 'ape') setCheckbox(`doc_ape_${id}`, true);
                else if (doc.startsWith('altro:')) {
                    const altroText = doc.replace('altro:', '').trim();
                    setValue(`doc_altro_${id}`, altroText);
                }
            });
        }

        console.log(`✅ Campi stato immobile ${id} popolati`);
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
            'nome', 'cognome', 'sesso', 'stato_civile', 'regime_patrimoniale', 'luogo_nascita', 'data_nascita',
            'codice_fiscale', 'tipo_documento', 'numero_documento', 'data_rilascio',
            'data_scadenza', 'indirizzo', 'citta', 'provincia', 'telefono1', 'telefono2', 'email1', 'email2'
        ];

        fields.forEach(field => {
            const fieldElement = document.getElementById(`venditore_${venditore.id}_${field}`);
            if (fieldElement && venditore[field]) {
                fieldElement.value = venditore[field];
            }
        });
    }

    // ========== BLOCCO 2.9: POPOLAMENTO CONDIZIONI ECONOMICHE ==========
    populateCondizioniEconomiche(condizioniData) {
        console.log('💰 Popolamento condizioni economiche:', condizioniData);

        // Aggiorna oggetto interno
        if (condizioniData) {
            this.condizioniEconomiche = {
                modalita_prezzo: condizioniData.modalita_prezzo || 'singola',
                prezzo_forfettario: condizioniData.prezzo_forfettario || {
                    prezzo_totale: 0,
                    percentuale_riduzione: 0
                },
                compenso: condizioniData.compenso || {
                    percentuale_provvigione: 3,
                    soglia_minima: 50000,
                    importo_minimo: 1500
                },
                durata: condizioniData.durata || {
                    data_inizio: '',
                    data_fine: '',
                    tipo_rinnovo: 'cessato',
                    giorni_preavviso: 5
                },
                esclusiva: condizioniData.esclusiva || {
                    attiva: false,
                    testo_custom: '',
                    spese_massime: 0
                },
                autorizzazioni: condizioniData.autorizzazioni || {
                    cartello_vendita: true,
                    vetrine: true,
                    internet: true,
                    stampa: true
                },
                condizioni_pagamento: condizioniData.condizioni_pagamento || {
                    giorni_versamento: 15,
                    percentuale_anticipo: 10,
                    modalita_saldo: 'assegno_circolare',
                    saldo_altro_testo: '',
                    giorni_stipula_atto: 150
                },
                diritto_recesso: condizioniData.diritto_recesso || {
                    luogo_conferimento: 'locale_agenzia'
                },
                osservazioni: condizioniData.osservazioni || '',
                firma: condizioniData.firma || {
                    luogo: '',
                    data: ''
                }
            };
        }

        // Popola toggle OFFERTA UNICA
        const toggleOfferta = document.getElementById('toggle-offerta-unica');
        if (toggleOfferta) {
            toggleOfferta.checked = this.condizioniEconomiche.modalita_prezzo === 'offerta_unica';
        }

        // Popola compenso mediazione
        const percProvvigione = document.getElementById('percentuale_provvigione');
        if (percProvvigione) percProvvigione.value = this.condizioniEconomiche.compenso.percentuale_provvigione || 3;

        const sogliaMinima = document.getElementById('soglia_minima');
        if (sogliaMinima) sogliaMinima.value = this.condizioniEconomiche.compenso.soglia_minima || 50000;

        const importoMinimo = document.getElementById('importo_minimo');
        if (importoMinimo) importoMinimo.value = this.condizioniEconomiche.compenso.importo_minimo || 1500;

        // Popola durata incarico
        const dataInizio = document.getElementById('data_inizio_incarico');
        if (dataInizio) dataInizio.value = this.condizioniEconomiche.durata.data_inizio || '';

        const dataFine = document.getElementById('data_fine_incarico');
        if (dataFine) dataFine.value = this.condizioniEconomiche.durata.data_fine || '';

        // Popola tipo rinnovo
        const tipoRinnovo = this.condizioniEconomiche.durata.tipo_rinnovo || 'cessato';
        const rinnovoRadio = document.querySelector(`input[name="tipo_rinnovo"][value="${tipoRinnovo}"]`);
        if (rinnovoRadio) {
            rinnovoRadio.checked = true;

            // Mostra/nascondi giorni preavviso
            const giorniSection = document.getElementById('giorni-preavviso-section');
            if (giorniSection) {
                giorniSection.style.display = tipoRinnovo === 'tacito_continuo' ? 'block' : 'none';
            }
        }

        const giorniPreavviso = document.getElementById('giorni_preavviso');
        if (giorniPreavviso) giorniPreavviso.value = this.condizioniEconomiche.durata.giorni_preavviso || 5;

        // Popola esclusiva (radio buttons)
        const esclusivaTipo = this.condizioniEconomiche.esclusiva.attiva ? 'esclusiva' : 'non_esclusiva';
        const esclusivaRadio = document.querySelector(`input[name="esclusiva_tipo"][value="${esclusivaTipo}"]`);
        if (esclusivaRadio) {
            esclusivaRadio.checked = true;

            // Mostra/nascondi campi appropriati
            const esclusivaFields = document.getElementById('esclusiva-fields');
            const nonEsclusivaFields = document.getElementById('non-esclusiva-fields');
            if (esclusivaTipo === 'esclusiva') {
                if (esclusivaFields) esclusivaFields.style.display = 'block';
                if (nonEsclusivaFields) nonEsclusivaFields.style.display = 'none';
            } else {
                if (esclusivaFields) esclusivaFields.style.display = 'none';
                if (nonEsclusivaFields) nonEsclusivaFields.style.display = 'block';
            }
        }

        // Popola testo custom esclusiva
        const esclusivaTesto = document.getElementById('esclusiva_testo');
        if (esclusivaTesto) {
            esclusivaTesto.value = this.condizioniEconomiche.esclusiva.testo_custom || '';
        }

        // Popola spese massime (NON esclusiva)
        const speseMassime = document.getElementById('spese_massime');
        if (speseMassime) {
            speseMassime.value = this.condizioniEconomiche.esclusiva.spese_massime || '';
        }

        // Popola autorizzazioni
        const authCartello = document.getElementById('auth_cartello');
        const authVetrine = document.getElementById('auth_vetrine');
        const authInternet = document.getElementById('auth_internet');
        const authStampa = document.getElementById('auth_stampa');

        if (authCartello) authCartello.checked = this.condizioniEconomiche.autorizzazioni.cartello_vendita !== false;
        if (authVetrine) authVetrine.checked = this.condizioniEconomiche.autorizzazioni.vetrine !== false;
        if (authInternet) authInternet.checked = this.condizioniEconomiche.autorizzazioni.internet !== false;
        if (authStampa) authStampa.checked = this.condizioniEconomiche.autorizzazioni.stampa !== false;

        // Aggiorna preview obblighi in base al tipo esclusiva
        this.updateObblighi(this.condizioniEconomiche.esclusiva.attiva);

        // Popola condizioni di pagamento
        const giorniVersamento = document.getElementById('giorni_versamento');
        if (giorniVersamento) giorniVersamento.value = this.condizioniEconomiche.condizioni_pagamento.giorni_versamento || 15;

        const percAnticipo = document.getElementById('percentuale_anticipo');
        if (percAnticipo) percAnticipo.value = this.condizioniEconomiche.condizioni_pagamento.percentuale_anticipo || 10;

        const modalitaSaldo = this.condizioniEconomiche.condizioni_pagamento.modalita_saldo || 'assegno_circolare';
        const saldoRadio = document.querySelector(`input[name="modalita_saldo"][value="${modalitaSaldo}"]`);
        if (saldoRadio) {
            saldoRadio.checked = true;
            const altroSection = document.getElementById('saldo-altro-section');
            if (altroSection) {
                altroSection.style.display = modalitaSaldo === 'altro' ? 'block' : 'none';
            }
        }

        const saldoAltroTesto = document.getElementById('saldo_altro_testo');
        if (saldoAltroTesto) saldoAltroTesto.value = this.condizioniEconomiche.condizioni_pagamento.saldo_altro_testo || '';

        const giorniStipula = document.getElementById('giorni_stipula_atto');
        if (giorniStipula) giorniStipula.value = this.condizioniEconomiche.condizioni_pagamento.giorni_stipula_atto || 150;

        // Popola diritto di recesso (luogo conferimento)
        if (condizioniData && condizioniData.diritto_recesso) {
            const luogoConferimento = condizioniData.diritto_recesso.luogo_conferimento || 'locale_agenzia';
            const luogoRadio = document.querySelector(`input[name="luogo_conferimento"][value="${luogoConferimento}"]`);
            if (luogoRadio) {
                luogoRadio.checked = true;
            }
        }

        // Popola osservazioni
        if (condizioniData && condizioniData.osservazioni) {
            const osservazioni = document.getElementById('osservazioni_note');
            if (osservazioni) {
                osservazioni.value = condizioniData.osservazioni;
            }
        }

        // Popola data e luogo firma
        if (condizioniData && condizioniData.firma) {
            const luogoFirma = document.getElementById('luogo_firma');
            if (luogoFirma) {
                luogoFirma.value = condizioniData.firma.luogo || '';
            }

            const dataFirma = document.getElementById('data_firma');
            if (dataFirma) {
                dataFirma.value = condizioniData.firma.data || '';
            }
        }

        // Renderizza sezione prezzo (include dati immobili già caricati)
        setTimeout(() => {
            this.renderSezionePrezzo();
        }, 200);

        console.log('✅ Condizioni economiche popolate');
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

        // Sblocca campo operatore per nuove pratiche
        this.unlockOperatoreField();
    }

    unlockOperatoreField() {
        const operatoreSelect = document.getElementById('operatore');
        if (operatoreSelect) {
            // Riabilita il dropdown
            operatoreSelect.disabled = false;

            // Ripristina stile normale
            operatoreSelect.style.backgroundColor = '';
            operatoreSelect.style.color = '';
            operatoreSelect.style.cursor = '';

            // Rimuove icona di blocco se presente
            const lockIndicator = operatoreSelect.parentNode.querySelector('.lock-indicator');
            if (lockIndicator) {
                lockIndicator.remove();
            }

            // Rimuove tooltip
            operatoreSelect.title = '';

            console.log('🔓 Campo operatore sbloccato per nuova pratica');
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

        const lettera = selectedOption.dataset.lettera;
        
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
        tipo: 'privato', // 'privato' | 'ditta' | 'societa'

        // ========== CAMPI PRIVATO (esistenti) ==========
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
        cittadinanza: 'italiana',
        professione: '',
        stato_civile: '',
        regime_patrimoniale: '',
        specificare_regime: false,
        // Flags per gestione automatica coniuge
        isConiuge: false,
        linkedTo: null,
        hasConiuge: false,
        coniugeId: null,
        indirizzo: '',
        citta: '',
        provincia: '',
        pensionato: '',
        telefono1: '',
        telefono2: '',
        email1: '',
        email2: '',
        // Permesso di soggiorno (per cittadinanza estera)
        permesso_tipo: '',
        permesso_numero: '',
        permesso_rilascio: '',
        permesso_scadenza: '',
        permesso_questura: '',

        // ========== CAMPI DITTA ==========
        // Titolare (persona fisica)
        titolare_nome: '',
        titolare_cognome: '',
        titolare_sesso: 'M',
        titolare_luogo_nascita: '',
        titolare_data_nascita: '',
        titolare_cittadinanza: 'italiana',
        cf_titolare: '',
        titolare_tipo_documento: 'carta_identita',
        titolare_numero_documento: '',
        titolare_data_rilascio: '',
        titolare_data_scadenza: '',
        titolare_domicilio_presso_sede: true,
        titolare_domicilio_via: '',
        titolare_domicilio_numero: '',
        titolare_domicilio_cap: '',
        titolare_domicilio_comune: '',
        titolare_domicilio_provincia: '',
        // Dati ditta
        denominazione_ditta: '',
        sede_ditta_via: '',
        sede_ditta_numero: '',
        sede_ditta_cap: '',
        sede_ditta_comune: '',
        sede_ditta_provincia: '',
        sede_ditta_stato: 'Italia',
        piva_ditta: '',
        cf_ditta: '',
        rea_numero_ditta: '',
        rea_cciaa_ditta: '',
        pec_ditta: '',
        codice_destinatario_ditta: '',
        email_ditta: '',
        telefono_ditta: '',

        // ========== CAMPI SOCIETÀ ==========
        // Dati società
        ragione_sociale: '',
        sede_societa_via: '',
        sede_societa_numero: '',
        sede_societa_cap: '',
        sede_societa_comune: '',
        sede_societa_provincia: '',
        sede_societa_stato: 'Italia',
        piva_societa: '',
        cf_societa: '',
        ri_numero: '',
        ri_cciaa: '',
        rea_numero_societa: '',
        rea_cciaa_societa: '',
        pec_societa: '',
        codice_destinatario_societa: '',
        email_societa: '',
        telefono_societa: '',
        // Tipo rappresentanza
        tipo_rappresentanza: 'persona_fisica', // 'persona_fisica' | 'persona_giuridica_con_designato'
        // Rappresentante persona fisica
        rappresentante_nome: '',
        rappresentante_cognome: '',
        rappresentante_sesso: 'M',
        rappresentante_luogo_nascita: '',
        rappresentante_data_nascita: '',
        rappresentante_cittadinanza: 'italiana',
        rappresentante_cf: '',
        rappresentante_tipo_documento: 'carta_identita',
        rappresentante_numero_documento: '',
        rappresentante_data_rilascio: '',
        rappresentante_data_scadenza: '',
        rappresentante_domicilio_presso_sede: true,
        rappresentante_domicilio_via: '',
        rappresentante_domicilio_numero: '',
        rappresentante_domicilio_cap: '',
        rappresentante_domicilio_comune: '',
        rappresentante_domicilio_provincia: '',
        // Società-amministratore
        soc_amm_ragione_sociale: '',
        soc_amm_sede_via: '',
        soc_amm_sede_numero: '',
        soc_amm_sede_comune: '',
        soc_amm_sede_provincia: '',
        soc_amm_piva: '',
        soc_amm_cf: '',
        soc_amm_ri_numero: '',
        soc_amm_rea_numero: '',
        soc_amm_pec: '',
        // Designato (persona fisica obbligatoria)
        designato_nome: '',
        designato_cognome: '',
        designato_sesso: 'M',
        designato_luogo_nascita: '',
        designato_data_nascita: '',
        designato_cittadinanza: 'italiana',
        designato_cf: '',
        designato_tipo_documento: 'carta_identita',
        designato_numero_documento: '',
        designato_data_rilascio: '',
        designato_data_scadenza: '',
        designato_domicilio_presso_sede: true,
        designato_domicilio_via: '',
        designato_domicilio_numero: '',
        designato_domicilio_cap: '',
        designato_domicilio_comune: '',
        designato_domicilio_provincia: ''
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

    const venditore = this.venditori.find(v => v.id === id);
    if (!venditore) return;

    // 🛡️ PROTEZIONE: Blocca rimozione manuale di coniuge auto-aggiunto
    if (venditore.isConiuge) {
        alert('⚠️ Questo coniuge è stato aggiunto automaticamente.\n\nPer rimuoverlo, cambia il regime patrimoniale del venditore principale o deseleziona "Specificare regime".');
        return;
    }

    // ⚠️ CASO SPECIALE: Venditore principale con coniuge collegato
    if (venditore.hasConiuge) {
        const coniuge = this.venditori.find(v => v.id === venditore.coniugeId);
        const coniugeNome = coniuge ? `${coniuge.nome} ${coniuge.cognome}`.trim() : 'sconosciuto';

        const conferma = confirm(
            `⚠️ ATTENZIONE!\n\n` +
            `Questo venditore ha un coniuge collegato automaticamente:\n"${coniugeNome}"\n\n` +
            `Rimuovendo questo venditore, verrà rimosso anche il coniuge.\n\n` +
            `Vuoi procedere?`
        );

        if (!conferma) {
            console.log('❌ Rimozione annullata dall\'utente');
            return;
        }

        // Rimuovi prima il coniuge
        if (coniuge) {
            this.venditori = this.venditori.filter(v => v.id !== coniuge.id);
            const coniugeCard = document.getElementById(`venditore-${coniuge.id}`);
            if (coniugeCard) coniugeCard.remove();
            console.log(`✅ Coniuge ${coniuge.id} rimosso insieme al principale`);
        }
    }

    // Rimuovi il venditore
    this.venditori = this.venditori.filter(v => v.id !== id);
    document.getElementById(`venditore-${id}`).remove();
    this.updateTabProgress();
    this.isDirty = true;

    console.log(`❌ Rimosso venditore ${id}`);
}

// ========== BLOCCO REGIME PATRIMONIALE: GESTIONE CONIUGE AUTOMATICO ==========

/**
 * Gestisce il cambio di regime patrimoniale e l'aggiunta/rimozione automatica del coniuge
 */
handleRegimePatrimonialeChange(venditoreId) {
    const venditore = this.venditori.find(v => v.id === venditoreId);
    if (!venditore) return;

    const regimeSelect = document.getElementById(`venditore_${venditoreId}_regime_patrimoniale`);
    const regimeValue = regimeSelect ? regimeSelect.value : '';

    console.log(`🔄 Cambio regime patrimoniale per venditore ${venditoreId}:`, regimeValue);

    // Se seleziona "Comunione dei beni" E non ha già un coniuge collegato
    if (regimeValue === 'comunione' && !venditore.hasConiuge) {
        this.addConiugeAuto(venditoreId);
    }
    // Se cambia da "Comunione" ad altro E ha un coniuge collegato
    else if (regimeValue !== 'comunione' && venditore.hasConiuge) {
        this.removeConiugeAuto(venditoreId);
    }
}

/**
 * Aggiunge automaticamente un coniuge collegato al venditore principale
 */
addConiugeAuto(principaleId) {
    const principale = this.venditori.find(v => v.id === principaleId);
    if (!principale || principale.hasConiuge) {
        console.log('⚠️ Coniuge già presente o venditore non trovato');
        return;
    }

    // Crea il nuovo venditore coniuge con dati ereditati
    const coniuge = {
        id: ++this.venditoreCounter,
        nome: '',
        cognome: principale.cognome || '', // Eredita cognome
        sesso: principale.sesso === 'M' ? 'F' : 'M', // Sesso opposto
        luogo_nascita: '',
        data_nascita: '',
        codice_fiscale: '',
        tipo_documento: '',
        numero_documento: '',
        data_rilascio: '',
        data_scadenza: '',
        cittadinanza: 'Italiana',
        stato_civile: 'coniugato',
        regime_patrimoniale: 'comunione',
        specificare_regime: true,
        // FLAGS CONIUGE
        isConiuge: true,
        linkedTo: principaleId,
        hasConiuge: false,
        coniugeId: null,
        // Eredita indirizzo
        indirizzo: principale.indirizzo || '',
        citta: principale.citta || '',
        provincia: principale.provincia || '',
        pensionato: '',
        telefono1: '',
        telefono2: '',
        email1: '',
        email2: ''
    };

    // Trova la posizione del principale e inserisci il coniuge dopo
    const principaleIndex = this.venditori.findIndex(v => v.id === principaleId);
    this.venditori.splice(principaleIndex + 1, 0, coniuge);

    // Aggiorna il principale con il collegamento
    principale.hasConiuge = true;
    principale.coniugeId = coniuge.id;

    // Renderizza il coniuge nella posizione corretta
    const principaleCard = document.getElementById(`venditore-${principaleId}`);
    this.renderVenditore(coniuge);

    // Sposta il card del coniuge dopo quello del principale
    const coniugeCard = document.getElementById(`venditore-${coniuge.id}`);
    if (principaleCard && coniugeCard) {
        principaleCard.parentNode.insertBefore(coniugeCard, principaleCard.nextSibling);
    }

    this.updateTabProgress();
    this.isDirty = true;

    this.showNotification(
        `💍 Coniuge aggiunto automaticamente per "${principale.nome} ${principale.cognome}"`,
        'success',
        4000
    );

    console.log(`✅ Coniuge ${coniuge.id} aggiunto automaticamente per venditore ${principaleId}`);
}

/**
 * Rimuove automaticamente il coniuge collegato
 */
removeConiugeAuto(principaleId) {
    const principale = this.venditori.find(v => v.id === principaleId);
    if (!principale || !principale.hasConiuge) {
        console.log('⚠️ Nessun coniuge da rimuovere');
        return;
    }

    const coniugeId = principale.coniugeId;
    const coniuge = this.venditori.find(v => v.id === coniugeId);

    if (!coniuge) {
        console.log('⚠️ Coniuge non trovato');
        return;
    }

    // Rimuovi il coniuge
    this.venditori = this.venditori.filter(v => v.id !== coniugeId);
    const coniugeCard = document.getElementById(`venditore-${coniugeId}`);
    if (coniugeCard) coniugeCard.remove();

    // Aggiorna il principale
    principale.hasConiuge = false;
    principale.coniugeId = null;

    this.updateTabProgress();
    this.isDirty = true;

    this.showNotification(
        `❌ Coniuge rimosso automaticamente`,
        'info',
        3000
    );

    console.log(`✅ Coniuge ${coniugeId} rimosso automaticamente`);
}

/**
 * Mostra una notifica toast
 */
showNotification(message, type = 'info', duration = 3000) {
    // Crea elemento notifica
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animazione entrata
    setTimeout(() => notification.classList.add('show'), 10);

    // Rimuovi dopo duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// ========== BLOCCO CODICE FISCALE: CALCOLO AUTOMATICO ==========

/**
 * Inizializza il CF Calculator (lazy loading)
 */
async initializeCFCalculator() {
    if (this.cfCalculatorReady) return;

    const CF_INIT_TIMEOUT = 8000; // 8 secondi max per CF calculator

    try {
        console.log('🔄 Inizializzazione CF Calculator...');

        // Verifica che la classe sia disponibile
        if (!window.CodiceFiscaleCalculator) {
            throw new Error('CodiceFiscaleCalculator non disponibile');
        }

        // Crea istanza calculator
        this.cfCalculator = new window.CodiceFiscaleCalculator();

        // Inizializza con timeout (carica database Belfiore)
        const initPromise = this.cfCalculator.init();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout inizializzazione CF Calculator')), CF_INIT_TIMEOUT)
        );

        await Promise.race([initPromise, timeoutPromise]);

        this.cfCalculatorReady = true;
        console.log('✅ CF Calculator ready');

    } catch (error) {
        console.error('❌ Errore inizializzazione CF Calculator:', error);
        this.cfCalculatorReady = false;
        throw new Error(`Impossibile caricare il sistema di calcolo CF: ${error.message}`);
    }
}

/**
 * Calcola il codice fiscale per un venditore
 * @param {number} venditoreId - ID del venditore
 * @param {string} tipo - Tipo di persona: 'privato' | 'titolare' | 'rappresentante' | 'designato'
 */
async calculateCF(venditoreId, tipo = 'privato') {
    try {
        // Inizializza calculator se necessario (lazy loading)
        if (!this.cfCalculatorReady) {
            this.showCFWarning(venditoreId, '⏳ Caricamento database comuni...', 'info');
            await this.initializeCFCalculator();
            this.hideCFWarning(venditoreId);
        }

        const venditore = this.venditori.find(v => v.id === venditoreId);
        if (!venditore) return;

        // Determina prefisso campo in base al tipo
        const fieldPrefix = tipo === 'privato' ? '' : `${tipo}_`;

        // Raccogli dati necessari
        const nome = document.getElementById(`venditore_${venditoreId}_${fieldPrefix}nome`)?.value;
        const cognome = document.getElementById(`venditore_${venditoreId}_${fieldPrefix}cognome`)?.value;

        // Leggi sesso dai radio button
        const sessoRadioM = document.getElementById(`venditore_${venditoreId}_${fieldPrefix}sesso_m`);
        const sessoRadioF = document.getElementById(`venditore_${venditoreId}_${fieldPrefix}sesso_f`);
        const sesso = sessoRadioM?.checked ? 'M' : (sessoRadioF?.checked ? 'F' : null);

        const dataNascita = document.getElementById(`venditore_${venditoreId}_${fieldPrefix}data_nascita`)?.value;
        const luogoNascita = document.getElementById(`venditore_${venditoreId}_${fieldPrefix}luogo_nascita`)?.value;

        // Per privato usiamo 'provincia', per gli altri il campo non esiste (usiamo null)
        const provincia = tipo === 'privato'
            ? document.getElementById(`venditore_${venditoreId}_provincia`)?.value
            : null;

        // Validazione campi obbligatori
        const campiMancanti = [];
        if (!nome) campiMancanti.push('Nome');
        if (!cognome) campiMancanti.push('Cognome');
        if (!sesso) campiMancanti.push('Sesso');
        if (!dataNascita) campiMancanti.push('Data di nascita');
        if (!luogoNascita) campiMancanti.push('Luogo di nascita');

        if (campiMancanti.length > 0) {
            this.showCFWarning(
                venditoreId,
                `⚠️ Campi mancanti: ${campiMancanti.join(', ')}`,
                'error'
            );
            return;
        }

        // Validazione security
        const nameValidation = window.CFSecurity.validateName(nome);
        if (!nameValidation.valid) {
            this.showCFWarning(venditoreId, `❌ Nome: ${nameValidation.error}`, 'error');
            return;
        }

        const surnameValidation = window.CFSecurity.validateName(cognome);
        if (!surnameValidation.valid) {
            this.showCFWarning(venditoreId, `❌ Cognome: ${surnameValidation.error}`, 'error');
            return;
        }

        const dateValidation = window.CFSecurity.validateBirthDate(dataNascita);
        if (!dateValidation.valid) {
            this.showCFWarning(venditoreId, `❌ Data: ${dateValidation.error}`, 'error');
            return;
        }

        // Rate limiting (max 100 calcoli al minuto)
        if (!window.CFSecurity.checkRateLimit('calculate_cf', 100, 60000)) {
            this.showCFWarning(
                venditoreId,
                '⚠️ Troppi calcoli. Attendi un minuto.',
                'warning'
            );
            return;
        }

        // Calcola CF
        console.log(`🧮 Calcolo CF per venditore ${venditoreId}...`);

        const result = this.cfCalculator.calculate({
            nome: nome,
            cognome: cognome,
            sesso: sesso,
            dataNascita: dataNascita,
            luogoNascita: luogoNascita,
            provincia: provincia
        });

        if (!result.success) {
            // Errore calcolo
            if (result.matches && result.matches.length > 0) {
                // Ambiguità comune
                const matchesList = result.matches
                    .map(m => `${m.nome} (${m.provincia})`)
                    .join(', ');
                this.showCFWarning(
                    venditoreId,
                    `⚠️ ${result.error}. Comuni trovati: ${matchesList}. Specifica la provincia.`,
                    'warning'
                );
            } else {
                this.showCFWarning(venditoreId, `❌ ${result.error}`, 'error');
            }
            return;
        }

        // Successo!
        // Determina l'ID del campo CF in base al tipo
        let cfInputId;
        let cfFieldName;
        switch (tipo) {
            case 'titolare':
                cfInputId = `venditore_${venditoreId}_cf_titolare`;
                cfFieldName = 'cf_titolare';
                break;
            case 'rappresentante':
                cfInputId = `venditore_${venditoreId}_rappresentante_cf`;
                cfFieldName = 'rappresentante_cf';
                break;
            case 'designato':
                cfInputId = `venditore_${venditoreId}_designato_cf`;
                cfFieldName = 'designato_cf';
                break;
            default: // privato
                cfInputId = `venditore_${venditoreId}_codice_fiscale`;
                cfFieldName = 'codice_fiscale';
        }

        const cfInput = document.getElementById(cfInputId);
        if (cfInput) {
            cfInput.value = result.cf;
        }

        // Aggiorna venditore object
        venditore[cfFieldName] = result.cf;
        this.isDirty = true;

        // Mostra successo
        this.showCFWarning(
            venditoreId,
            `✅ Codice Fiscale calcolato: ${result.cf}`,
            'success'
        );

        // Nascondi warning dopo 3 secondi
        setTimeout(() => this.hideCFWarning(venditoreId), 3000);

        // Audit log
        const cfHash = await window.CFSecurity.hashCF(result.cf);
        window.CFSecurity.logAudit('calculate', {
            cfHash,
            success: true,
            venditoreId
        });

        console.log(`✅ CF calcolato: ${result.cf}`);

    } catch (error) {
        console.error('❌ Errore calcolo CF:', error);
        this.showCFWarning(
            venditoreId,
            `❌ Errore imprevisto: ${error.message}`,
            'error'
        );
    }
}

/**
 * Valida CF inserito manualmente
 */
async validateCFManual(venditoreId) {
    try {
        const cfInput = document.getElementById(`venditore_${venditoreId}_codice_fiscale`);
        const cf = cfInput?.value;

        if (!cf || cf.trim().length === 0) {
            this.hideCFWarning(venditoreId);
            return;
        }

        // Inizializza calculator se necessario
        if (!this.cfCalculatorReady) {
            await this.initializeCFCalculator();
        }

        // Valida formato e check digit
        const validation = this.cfCalculator.validate(cf);

        if (!validation.valid) {
            this.showCFWarning(
                venditoreId,
                `❌ ${validation.errors.join(', ')}`,
                'error'
            );
        } else if (validation.warnings.length > 0) {
            this.showCFWarning(
                venditoreId,
                `⚠️ ${validation.warnings.join(', ')}`,
                'warning'
            );
        } else {
            this.showCFWarning(
                venditoreId,
                '✅ Codice Fiscale valido',
                'success'
            );
            setTimeout(() => this.hideCFWarning(venditoreId), 2000);
        }

    } catch (error) {
        console.error('❌ Errore validazione CF:', error);
    }
}

/**
 * Mostra warning CF
 */
showCFWarning(venditoreId, message, type = 'info') {
    const warningDiv = document.getElementById(`cf-warning-${venditoreId}`);
    if (!warningDiv) return;

    warningDiv.className = `cf-warning cf-warning-${type}`;
    warningDiv.textContent = message;
    warningDiv.style.display = 'block';
}

/**
 * Nascondi warning CF
 */
hideCFWarning(venditoreId) {
    const warningDiv = document.getElementById(`cf-warning-${venditoreId}`);
    if (!warningDiv) return;

    warningDiv.style.display = 'none';
}

/**
 * Carica la lista delle cittadinanze e popola il datalist
 * Lazy loading - carica solo una volta
 */
async loadCittadinanzaList() {
    // Se già caricato, esci
    if (this.cittadinanzaLoaded) return;

    try {
        console.log('🌍 Caricamento lista cittadinanze...');
        const response = await fetch('https://contattisilvestri.github.io/SIAF/DATA/stato-cittadinanza.json');

        if (!response.ok) {
            console.warn('⚠️ File cittadinanze non trovato, funzionalità disabilitata');
            return;
        }

        this.cittadinanzaData = await response.json();

        // Popola il datalist
        const datalist = document.getElementById('paesi-cittadinanza-list');
        if (!datalist) {
            console.warn('⚠️ Datalist cittadinanze non trovato nel DOM');
            return;
        }

        // Svuota datalist esistente
        datalist.innerHTML = '';

        // Aggiungi tutte le cittadinanze
        this.cittadinanzaData.forEach(paese => {
            const option = document.createElement('option');
            option.value = paese.cittadinanza;
            option.setAttribute('data-stato', paese.stato);
            datalist.appendChild(option);
        });

        this.cittadinanzaLoaded = true;
        console.log(`✅ Caricate ${this.cittadinanzaData.length} cittadinanze`);

    } catch (error) {
        console.error('❌ Errore caricamento cittadinanze:', error);
    }
}

renderVenditore(venditore) {
    const container = document.getElementById('venditori-container');

    if (!container) {
        console.error('❌ Container venditori-container non trovato!');
        return;
    }

    // Carica lista cittadinanze (lazy load - solo la prima volta)
    this.loadCittadinanzaList();

    const isFirst = this.venditori.length === 1;
    const isConiugeAuto = venditore.isConiuge || false;
    const cardClass = isConiugeAuto ? 'venditore-card venditore-coniuge-auto' : 'venditore-card';

    const venditoreHtml = `
        <div id="venditore-${venditore.id}" class="${cardClass}">
            <div class="venditore-header">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <h3>
                        👤 Venditore ${venditore.id}
                        ${isConiugeAuto ? '<span class="badge-coniuge">💍 CONIUGE AUTO-AGGIUNTO</span>' : ''}
                    </h3>
                    <div class="segmented-control tipo-soggetto-control">
                        <input type="radio" name="venditore_${venditore.id}_tipo" id="venditore_${venditore.id}_tipo_privato" value="privato" ${!venditore.tipo || venditore.tipo === 'privato' ? 'checked' : ''}>
                        <label for="venditore_${venditore.id}_tipo_privato">Privato</label>

                        <input type="radio" name="venditore_${venditore.id}_tipo" id="venditore_${venditore.id}_tipo_ditta" value="ditta" ${venditore.tipo === 'ditta' ? 'checked' : ''}>
                        <label for="venditore_${venditore.id}_tipo_ditta">Ditta</label>

                        <input type="radio" name="venditore_${venditore.id}_tipo" id="venditore_${venditore.id}_tipo_societa" value="societa" ${venditore.tipo === 'societa' ? 'checked' : ''}>
                        <label for="venditore_${venditore.id}_tipo_societa">Società</label>

                        <div class="segmented-control-slider"></div>
                    </div>
                </div>
                <div>
                    ${!isFirst && !isConiugeAuto ? `<button type="button" class="btn-remove" onclick="window.siafApp.removeVenditore(${venditore.id})">❌ Rimuovi</button>` : ''}
                    ${isConiugeAuto ? `<button type="button" class="btn-remove" disabled title="Il coniuge verrà rimosso automaticamente">🔒 Protetto</button>` : ''}
                </div>
            </div>

            <!-- FORM PRIVATO -->
            <div class="form-tipo-privato ${!venditore.tipo || venditore.tipo === 'privato' ? 'active' : ''}">
            <div class="form-grid">
                <!-- COLONNA 1 (60%): Dati Anagrafici -->
                <div class="field-card">
                    <h4>Dati Anagrafici</h4>

                    <!-- Nome | Cognome -->
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

                    <!-- Sesso: Segmented Control iOS-style -->
                    <div class="field-group">
                        <label>Sesso</label>
                        <div class="segmented-control sesso-control">
                            <input type="radio"
                                   name="venditore_${venditore.id}_sesso"
                                   id="venditore_${venditore.id}_sesso_m"
                                   value="M"
                                   ${venditore.sesso === 'M' || !venditore.sesso ? 'checked' : ''}
                                   data-venditore-id="${venditore.id}">
                            <label for="venditore_${venditore.id}_sesso_m">Maschio</label>

                            <input type="radio"
                                   name="venditore_${venditore.id}_sesso"
                                   id="venditore_${venditore.id}_sesso_f"
                                   value="F"
                                   ${venditore.sesso === 'F' ? 'checked' : ''}
                                   data-venditore-id="${venditore.id}">
                            <label for="venditore_${venditore.id}_sesso_f">Femmina</label>

                            <div class="segmented-control-slider"></div>
                        </div>
                    </div>

                    <!-- Luogo Nascita | Data Nascita -->
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

                    <!-- Cittadinanza | Professione -->
                    <div class="field-row">
                        <div class="field-group">
                            <label>Cittadinanza</label>
                            <div class="segmented-control cittadinanza-control">
                                <input type="radio"
                                       name="venditore_${venditore.id}_cittadinanza_tipo"
                                       id="venditore_${venditore.id}_citt_italia"
                                       value="italia"
                                       ${(!venditore.cittadinanza || venditore.cittadinanza === 'italiana') ? 'checked' : ''}
                                       data-venditore-id="${venditore.id}">
                                <label for="venditore_${venditore.id}_citt_italia">Italia</label>

                                <input type="radio"
                                       name="venditore_${venditore.id}_cittadinanza_tipo"
                                       id="venditore_${venditore.id}_citt_estero"
                                       value="estero"
                                       ${(venditore.cittadinanza && venditore.cittadinanza !== 'italiana') ? 'checked' : ''}
                                       data-venditore-id="${venditore.id}">
                                <label for="venditore_${venditore.id}_citt_estero">Estero</label>

                                <div class="segmented-control-slider"></div>
                            </div>

                            <!-- Campo autocomplete (nascosto se Italia è selezionato) -->
                            <div class="cittadinanza-field"
                                 id="cittadinanza-field-${venditore.id}"
                                 style="display: ${(!venditore.cittadinanza || venditore.cittadinanza === 'italiana') ? 'none' : 'block'}">
                                <input type="text"
                                       id="venditore_${venditore.id}_cittadinanza_custom"
                                       list="paesi-cittadinanza-list"
                                       value="${venditore.cittadinanza && venditore.cittadinanza !== 'italiana' ? venditore.cittadinanza : ''}"
                                       placeholder="Digita il paese di cittadinanza..."
                                       autocomplete="off">
                                <datalist id="paesi-cittadinanza-list"></datalist>
                                <small class="field-hint">Inizia a digitare per vedere i suggerimenti</small>
                            </div>
                        </div>

                        <div class="field-group">
                            <label for="venditore_${venditore.id}_professione">Professione</label>
                            <input type="text"
                                   id="venditore_${venditore.id}_professione"
                                   value="${venditore.professione || ''}"
                                   placeholder="Es. Impiegato, Commerciante...">
                        </div>
                    </div>

                    <!-- Stato Civile -->
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_stato_civile">Stato Civile</label>
                        <select id="venditore_${venditore.id}_stato_civile">
                            <option value="">Seleziona...</option>
                            <option value="libero" ${venditore.stato_civile === 'libero' ? 'selected' : ''}>Libero/a</option>
                            <option value="coniugato" ${venditore.stato_civile === 'coniugato' ? 'selected' : ''}>Coniugato/a</option>
                            <option value="separato" ${venditore.stato_civile === 'separato' ? 'selected' : ''}>Legalmente separato/a</option>
                            <option value="divorziato" ${venditore.stato_civile === 'divorziato' ? 'selected' : ''}>Divorziato/a</option>
                            <option value="vedovo" ${venditore.stato_civile === 'vedovo' ? 'selected' : ''}>Vedovo/a</option>
                        </select>
                    </div>

                    <!-- Regime Patrimoniale (conditional) -->
                    <div id="regime-patrimoniale-section-${venditore.id}" class="conditional-fields" style="display: none;">
                        <div class="field-group" style="margin-bottom: 15px;">
                            <button type="button"
                                    id="venditore_${venditore.id}_specificare_regime"
                                    class="regime-chip-toggle ${venditore.specificare_regime ? 'active' : ''}"
                                    data-active="${venditore.specificare_regime ? 'true' : 'false'}">
                                Regime Patrimoniale
                            </button>
                            <small class="field-hint" style="display: block; margin-top: 8px;">Clicca per specificare il regime patrimoniale</small>
                        </div>
                        <div id="regime-dropdown-${venditore.id}" class="conditional-fields" style="display: none;">
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_regime_patrimoniale">Regime Patrimoniale</label>
                                <select id="venditore_${venditore.id}_regime_patrimoniale">
                                    <option value="">Seleziona...</option>
                                    <option value="comunione" ${venditore.regime_patrimoniale === 'comunione' ? 'selected' : ''}>Comunione dei beni</option>
                                    <option value="separazione" ${venditore.regime_patrimoniale === 'separazione' ? 'selected' : ''}>Separazione dei beni</option>
                                </select>
                            </div>
                            <div id="comunione-alert-${venditore.id}" class="info-alert" style="display: none;">
                                <strong>ℹ️ Comunione dei beni:</strong> Verrà automaticamente aggiunto il coniuge come co-venditore.
                            </div>
                        </div>
                    </div>

                    <!-- Codice Fiscale -->
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_codice_fiscale">Codice Fiscale</label>
                        <div class="cf-input-group">
                            <input type="text"
                                   id="venditore_${venditore.id}_codice_fiscale"
                                   value="${venditore.codice_fiscale}"
                                   maxlength="16"
                                   style="text-transform: uppercase;"
                                   placeholder="Inserisci o calcola automaticamente">
                            <button type="button"
                                    class="btn-calculate-cf"
                                    onclick="window.siafApp.calculateCF(${venditore.id})">
                                🧮 Calcola CF
                            </button>
                        </div>
                        <div id="cf-warning-${venditore.id}" class="cf-warning" style="display: none;"></div>
                        <small class="field-hint">
                            Inserisci manualmente o clicca "Calcola CF" per generarlo dai dati anagrafici. <strong>È responsabilità dell'operatore verificare la correttezza del codice.</strong>
                        </small>
                    </div>
                </div>

                <!-- COLONNA 2 (40%): Permesso Soggiorno + Documento + Residenza + Contatti -->
                <div class="field-card">
                    <!-- Permesso di Soggiorno (nascosto se cittadinanza italiana) -->
                    <div id="permesso-soggiorno-section-${venditore.id}"
                         class="permesso-soggiorno-section"
                         style="display: ${(venditore.cittadinanza && venditore.cittadinanza !== 'italiana') ? 'block' : 'none'};">
                        <h4>📋 Permesso di Soggiorno</h4>
                        <div class="field-row">
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_permesso_tipo">Tipo Permesso</label>
                                <select id="venditore_${venditore.id}_permesso_tipo">
                                    <option value="">Seleziona...</option>
                                    <option value="lavoro" ${venditore.permesso_tipo === 'lavoro' ? 'selected' : ''}>Lavoro</option>
                                    <option value="studio" ${venditore.permesso_tipo === 'studio' ? 'selected' : ''}>Studio</option>
                                    <option value="famiglia" ${venditore.permesso_tipo === 'famiglia' ? 'selected' : ''}>Motivi familiari</option>
                                    <option value="residenza_elettiva" ${venditore.permesso_tipo === 'residenza_elettiva' ? 'selected' : ''}>Residenza elettiva</option>
                                    <option value="protezione_internazionale" ${venditore.permesso_tipo === 'protezione_internazionale' ? 'selected' : ''}>Protezione internazionale</option>
                                    <option value="lungo_soggiornante" ${venditore.permesso_tipo === 'lungo_soggiornante' ? 'selected' : ''}>Soggiornante UE lungo periodo</option>
                                    <option value="altro" ${venditore.permesso_tipo === 'altro' ? 'selected' : ''}>Altro</option>
                                </select>
                            </div>
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_permesso_numero">Numero Permesso</label>
                                <input type="text"
                                       id="venditore_${venditore.id}_permesso_numero"
                                       value="${venditore.permesso_numero || ''}"
                                       placeholder="Es. 123456789">
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_permesso_rilascio">Data Rilascio</label>
                                <input type="date"
                                       id="venditore_${venditore.id}_permesso_rilascio"
                                       value="${venditore.permesso_rilascio || ''}">
                            </div>
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_permesso_scadenza">Data Scadenza</label>
                                <input type="date"
                                       id="venditore_${venditore.id}_permesso_scadenza"
                                       value="${venditore.permesso_scadenza || ''}">
                            </div>
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_permesso_questura">Questura di Rilascio</label>
                            <input type="text"
                                   id="venditore_${venditore.id}_permesso_questura"
                                   value="${venditore.permesso_questura || ''}"
                                   placeholder="Es. Questura di Roma">
                        </div>

                        <!-- Separatore visivo -->
                        <hr style="border: none; border-top: 2px solid #e9ecef; margin: 24px 0;">
                    </div>

                    <!-- Documento di Riconoscimento -->
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

                    <!-- Separatore visivo -->
                    <hr style="border: none; border-top: 2px solid #e9ecef; margin: 24px 0;">

                    <!-- Residenza e Contatti -->
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
                            <label for="venditore_${venditore.id}_telefono1">Telefono 1</label>
                            <input type="tel" id="venditore_${venditore.id}_telefono1" value="${venditore.telefono1}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_telefono2">Telefono 2 (opzionale)</label>
                            <input type="tel" id="venditore_${venditore.id}_telefono2" value="${venditore.telefono2}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_email1">Email 1</label>
                            <input type="email" id="venditore_${venditore.id}_email1" value="${venditore.email1}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_email2">Email 2 (opzionale)</label>
                            <input type="email" id="venditore_${venditore.id}_email2" value="${venditore.email2}">
                        </div>
                    </div>
                </div>
            </div>
            </div>
            <!-- FINE FORM PRIVATO -->

            <!-- FORM DITTA -->
            <div class="form-tipo-ditta ${venditore.tipo === 'ditta' ? 'active' : ''}">
            <div class="form-grid">
                <!-- COLONNA 1 (60%): Titolare -->
                <div class="field-card">
                    <h4>👤 Titolare</h4>

                    <!-- Nome | Cognome -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_titolare_nome">Nome</label>
                            <input type="text" id="venditore_${venditore.id}_titolare_nome" value="${venditore.titolare_nome || ''}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_titolare_cognome">Cognome</label>
                            <input type="text" id="venditore_${venditore.id}_titolare_cognome" value="${venditore.titolare_cognome || ''}">
                        </div>
                    </div>

                    <!-- Sesso -->
                    <div class="field-group">
                        <label>Sesso</label>
                        <div class="segmented-control sesso-control">
                            <input type="radio" name="venditore_${venditore.id}_titolare_sesso" id="venditore_${venditore.id}_titolare_sesso_m" value="M" ${!venditore.titolare_sesso || venditore.titolare_sesso === 'M' ? 'checked' : ''}>
                            <label for="venditore_${venditore.id}_titolare_sesso_m">Maschio</label>

                            <input type="radio" name="venditore_${venditore.id}_titolare_sesso" id="venditore_${venditore.id}_titolare_sesso_f" value="F" ${venditore.titolare_sesso === 'F' ? 'checked' : ''}>
                            <label for="venditore_${venditore.id}_titolare_sesso_f">Femmina</label>

                            <div class="segmented-control-slider"></div>
                        </div>
                    </div>

                    <!-- Luogo nascita | Data nascita -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_titolare_luogo_nascita">Luogo di Nascita</label>
                            <input type="text" id="venditore_${venditore.id}_titolare_luogo_nascita" value="${venditore.titolare_luogo_nascita || ''}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_titolare_data_nascita">Data di Nascita</label>
                            <input type="date" id="venditore_${venditore.id}_titolare_data_nascita" value="${venditore.titolare_data_nascita || ''}">
                        </div>
                    </div>

                    <!-- Cittadinanza Titolare -->
                    <div class="field-group">
                        <label>Cittadinanza</label>
                        <div class="segmented-control cittadinanza-control">
                            <input type="radio" name="venditore_${venditore.id}_titolare_cittadinanza_tipo" id="venditore_${venditore.id}_titolare_citt_italia" value="italia" ${!venditore.titolare_cittadinanza || venditore.titolare_cittadinanza === 'italiana' ? 'checked' : ''}>
                            <label for="venditore_${venditore.id}_titolare_citt_italia">Italia</label>

                            <input type="radio" name="venditore_${venditore.id}_titolare_cittadinanza_tipo" id="venditore_${venditore.id}_titolare_citt_estero" value="estero" ${venditore.titolare_cittadinanza && venditore.titolare_cittadinanza !== 'italiana' ? 'checked' : ''}>
                            <label for="venditore_${venditore.id}_titolare_citt_estero">Estero</label>

                            <div class="segmented-control-slider"></div>
                        </div>
                        <div class="cittadinanza-field" id="cittadinanza-titolare-field-${venditore.id}" style="display: ${venditore.titolare_cittadinanza && venditore.titolare_cittadinanza !== 'italiana' ? 'block' : 'none'};">
                            <input type="text" id="venditore_${venditore.id}_titolare_cittadinanza_custom" value="${venditore.titolare_cittadinanza !== 'italiana' ? venditore.titolare_cittadinanza || '' : ''}" list="paesi-cittadinanza-list" placeholder="Specificare paese">
                        </div>
                    </div>

                    <!-- Codice Fiscale titolare -->
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_cf_titolare">Codice Fiscale Titolare</label>
                        <div class="cf-input-group">
                            <input type="text" id="venditore_${venditore.id}_cf_titolare" value="${venditore.cf_titolare || ''}" maxlength="16" style="text-transform: uppercase;">
                            <button type="button" class="btn-calculate-cf" data-venditore-id="${venditore.id}" data-tipo="titolare">🧮 Calcola</button>
                        </div>
                    </div>

                    <!-- Documento -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_titolare_tipo_documento">Tipo Documento</label>
                            <select id="venditore_${venditore.id}_titolare_tipo_documento">
                                <option value="carta_identita" ${!venditore.titolare_tipo_documento || venditore.titolare_tipo_documento === 'carta_identita' ? 'selected' : ''}>Carta d'Identità</option>
                                <option value="patente" ${venditore.titolare_tipo_documento === 'patente' ? 'selected' : ''}>Patente</option>
                                <option value="passaporto" ${venditore.titolare_tipo_documento === 'passaporto' ? 'selected' : ''}>Passaporto</option>
                            </select>
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_titolare_numero_documento">Numero Documento</label>
                            <input type="text" id="venditore_${venditore.id}_titolare_numero_documento" value="${venditore.titolare_numero_documento || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_titolare_data_rilascio">Data Rilascio</label>
                            <input type="date" id="venditore_${venditore.id}_titolare_data_rilascio" value="${venditore.titolare_data_rilascio || ''}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_titolare_data_scadenza">Data Scadenza</label>
                            <input type="date" id="venditore_${venditore.id}_titolare_data_scadenza" value="${venditore.titolare_data_scadenza || ''}">
                        </div>
                    </div>

                    <!-- Domicilio per la carica -->
                    <div class="field-group">
                        <div class="domicilio-carica-toggle">
                            <input type="checkbox" id="venditore_${venditore.id}_titolare_domicilio_presso_sede" ${!venditore.titolare_domicilio_presso_sede || venditore.titolare_domicilio_presso_sede === true ? 'checked' : ''}>
                            <label for="venditore_${venditore.id}_titolare_domicilio_presso_sede">Domiciliato per la carica presso la sede</label>
                        </div>
                        <div id="domicilio-titolare-${venditore.id}" class="domicilio-carica-fields ${venditore.titolare_domicilio_presso_sede === false ? 'active' : ''}">
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_titolare_domicilio_via">Via</label>
                                    <input type="text" id="venditore_${venditore.id}_titolare_domicilio_via" value="${venditore.titolare_domicilio_via || ''}">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_titolare_domicilio_numero">Numero</label>
                                    <input type="text" id="venditore_${venditore.id}_titolare_domicilio_numero" value="${venditore.titolare_domicilio_numero || ''}">
                                </div>
                            </div>
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_titolare_domicilio_cap">CAP</label>
                                    <input type="text" id="venditore_${venditore.id}_titolare_domicilio_cap" value="${venditore.titolare_domicilio_cap || ''}" maxlength="5">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_titolare_domicilio_comune">Comune</label>
                                    <input type="text" id="venditore_${venditore.id}_titolare_domicilio_comune" value="${venditore.titolare_domicilio_comune || ''}">
                                </div>
                            </div>
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_titolare_domicilio_provincia">Provincia</label>
                                <input type="text" id="venditore_${venditore.id}_titolare_domicilio_provincia" value="${venditore.titolare_domicilio_provincia || ''}" maxlength="2" style="text-transform: uppercase;">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- COLONNA 2 (40%): Ditta -->
                <div class="field-card">
                    <h4>🏢 Ditta</h4>

                    <!-- Denominazione -->
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_denominazione_ditta">Denominazione</label>
                        <input type="text" id="venditore_${venditore.id}_denominazione_ditta" value="${venditore.denominazione_ditta || ''}" placeholder="Es. Ditta Individuale Mario Rossi">
                    </div>

                    <!-- Sede -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_ditta_via">Via</label>
                            <input type="text" id="venditore_${venditore.id}_sede_ditta_via" value="${venditore.sede_ditta_via || ''}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_ditta_numero">Numero</label>
                            <input type="text" id="venditore_${venditore.id}_sede_ditta_numero" value="${venditore.sede_ditta_numero || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_ditta_cap">CAP</label>
                            <input type="text" id="venditore_${venditore.id}_sede_ditta_cap" value="${venditore.sede_ditta_cap || ''}" maxlength="5">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_ditta_comune">Comune</label>
                            <input type="text" id="venditore_${venditore.id}_sede_ditta_comune" value="${venditore.sede_ditta_comune || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_ditta_provincia">Provincia</label>
                            <input type="text" id="venditore_${venditore.id}_sede_ditta_provincia" value="${venditore.sede_ditta_provincia || ''}" maxlength="2" style="text-transform: uppercase;">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_ditta_stato">Stato</label>
                            <input type="text" id="venditore_${venditore.id}_sede_ditta_stato" value="${venditore.sede_ditta_stato || 'Italia'}">
                        </div>
                    </div>

                    <!-- P.IVA e CF Ditta -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_piva_ditta">Partita IVA</label>
                            <input type="text" id="venditore_${venditore.id}_piva_ditta" value="${venditore.piva_ditta || ''}" maxlength="11">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_cf_ditta">CF Ditta</label>
                            <input type="text" id="venditore_${venditore.id}_cf_ditta" value="${venditore.cf_ditta || ''}" maxlength="16" style="text-transform: uppercase;">
                        </div>
                    </div>

                    <!-- REA -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_rea_numero_ditta">REA Numero</label>
                            <input type="text" id="venditore_${venditore.id}_rea_numero_ditta" value="${venditore.rea_numero_ditta || ''}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_rea_cciaa_ditta">CCIAA</label>
                            <input type="text" id="venditore_${venditore.id}_rea_cciaa_ditta" value="${venditore.rea_cciaa_ditta || ''}" placeholder="Es. Verona">
                        </div>
                    </div>

                    <!-- Contatti -->
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_pec_ditta">PEC</label>
                        <input type="email" id="venditore_${venditore.id}_pec_ditta" value="${venditore.pec_ditta || ''}">
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_codice_destinatario_ditta">Codice Destinatario</label>
                            <input type="text" id="venditore_${venditore.id}_codice_destinatario_ditta" value="${venditore.codice_destinatario_ditta || ''}" maxlength="7" style="text-transform: uppercase;">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_email_ditta">Email</label>
                            <input type="email" id="venditore_${venditore.id}_email_ditta" value="${venditore.email_ditta || ''}">
                        </div>
                    </div>
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_telefono_ditta">Telefono</label>
                        <input type="tel" id="venditore_${venditore.id}_telefono_ditta" value="${venditore.telefono_ditta || ''}">
                    </div>
                </div>
            </div>
            </div>
            <!-- FINE FORM DITTA -->

            <!-- FORM SOCIETÀ -->
            <div class="form-tipo-societa ${venditore.tipo === 'societa' ? 'active' : ''}">
            <div class="form-grid">
                <!-- COLONNA 1 (60%): Società -->
                <div class="field-card">
                    <h4>🏛️ Società</h4>

                    <!-- Ragione Sociale -->
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_ragione_sociale">Ragione Sociale</label>
                        <input type="text" id="venditore_${venditore.id}_ragione_sociale" value="${venditore.ragione_sociale || ''}" placeholder="Es. Rossi S.r.l.">
                    </div>

                    <!-- Sede -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_societa_via">Via</label>
                            <input type="text" id="venditore_${venditore.id}_sede_societa_via" value="${venditore.sede_societa_via || ''}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_societa_numero">Numero</label>
                            <input type="text" id="venditore_${venditore.id}_sede_societa_numero" value="${venditore.sede_societa_numero || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_societa_cap">CAP</label>
                            <input type="text" id="venditore_${venditore.id}_sede_societa_cap" value="${venditore.sede_societa_cap || ''}" maxlength="5">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_societa_comune">Comune</label>
                            <input type="text" id="venditore_${venditore.id}_sede_societa_comune" value="${venditore.sede_societa_comune || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_societa_provincia">Provincia</label>
                            <input type="text" id="venditore_${venditore.id}_sede_societa_provincia" value="${venditore.sede_societa_provincia || ''}" maxlength="2" style="text-transform: uppercase;">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_sede_societa_stato">Stato</label>
                            <input type="text" id="venditore_${venditore.id}_sede_societa_stato" value="${venditore.sede_societa_stato || 'Italia'}">
                        </div>
                    </div>

                    <!-- P.IVA e CF -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_piva_societa">Partita IVA</label>
                            <input type="text" id="venditore_${venditore.id}_piva_societa" value="${venditore.piva_societa || ''}" maxlength="11">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_cf_societa">Codice Fiscale</label>
                            <input type="text" id="venditore_${venditore.id}_cf_societa" value="${venditore.cf_societa || ''}" maxlength="16" style="text-transform: uppercase;">
                        </div>
                    </div>

                    <!-- Registro Imprese -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_ri_numero">Registro Imprese Numero</label>
                            <input type="text" id="venditore_${venditore.id}_ri_numero" value="${venditore.ri_numero || ''}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_ri_cciaa">CCIAA</label>
                            <input type="text" id="venditore_${venditore.id}_ri_cciaa" value="${venditore.ri_cciaa || ''}" placeholder="Es. Verona">
                        </div>
                    </div>

                    <!-- REA -->
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_rea_numero_societa">REA Numero</label>
                            <input type="text" id="venditore_${venditore.id}_rea_numero_societa" value="${venditore.rea_numero_societa || ''}">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_rea_cciaa_societa">CCIAA</label>
                            <input type="text" id="venditore_${venditore.id}_rea_cciaa_societa" value="${venditore.rea_cciaa_societa || ''}" placeholder="Es. Verona">
                        </div>
                    </div>

                    <!-- Contatti -->
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_pec_societa">PEC</label>
                        <input type="email" id="venditore_${venditore.id}_pec_societa" value="${venditore.pec_societa || ''}">
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_codice_destinatario_societa">Codice Destinatario</label>
                            <input type="text" id="venditore_${venditore.id}_codice_destinatario_societa" value="${venditore.codice_destinatario_societa || ''}" maxlength="7" style="text-transform: uppercase;">
                        </div>
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_email_societa">Email</label>
                            <input type="email" id="venditore_${venditore.id}_email_societa" value="${venditore.email_societa || ''}">
                        </div>
                    </div>
                    <div class="field-group">
                        <label for="venditore_${venditore.id}_telefono_societa">Telefono</label>
                        <input type="tel" id="venditore_${venditore.id}_telefono_societa" value="${venditore.telefono_societa || ''}">
                    </div>
                </div>

                <!-- COLONNA 2 (40%): Rappresentanza -->
                <div class="field-card">
                    <h4>👔 Rappresentanza</h4>

                    <!-- Tipo rappresentanza -->
                    <div class="field-group">
                        <label>Tipo Rappresentanza</label>
                        <div class="segmented-control cittadinanza-control">
                            <input type="radio" name="venditore_${venditore.id}_tipo_rappresentanza" id="venditore_${venditore.id}_rapp_persona_fisica" value="persona_fisica" ${!venditore.tipo_rappresentanza || venditore.tipo_rappresentanza === 'persona_fisica' ? 'checked' : ''}>
                            <label for="venditore_${venditore.id}_rapp_persona_fisica">Persona fisica</label>

                            <input type="radio" name="venditore_${venditore.id}_tipo_rappresentanza" id="venditore_${venditore.id}_rapp_societa_amm" value="persona_giuridica_con_designato" ${venditore.tipo_rappresentanza === 'persona_giuridica_con_designato' ? 'checked' : ''}>
                            <label for="venditore_${venditore.id}_rapp_societa_amm">Società-amm</label>

                            <div class="segmented-control-slider"></div>
                        </div>
                    </div>

                    <!-- Sezione Persona Fisica -->
                    <div id="rappresentante-persona-fisica-${venditore.id}" class="${!venditore.tipo_rappresentanza || venditore.tipo_rappresentanza === 'persona_fisica' ? '' : 'hidden'}">
                        <h5>Legale Rappresentante</h5>

                        <!-- Nome | Cognome -->
                        <div class="field-row">
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_rappresentante_nome">Nome</label>
                                <input type="text" id="venditore_${venditore.id}_rappresentante_nome" value="${venditore.rappresentante_nome || ''}">
                            </div>
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_rappresentante_cognome">Cognome</label>
                                <input type="text" id="venditore_${venditore.id}_rappresentante_cognome" value="${venditore.rappresentante_cognome || ''}">
                            </div>
                        </div>

                        <!-- Sesso -->
                        <div class="field-group">
                            <label>Sesso</label>
                            <div class="segmented-control sesso-control">
                                <input type="radio" name="venditore_${venditore.id}_rappresentante_sesso" id="venditore_${venditore.id}_rappresentante_sesso_m" value="M" ${!venditore.rappresentante_sesso || venditore.rappresentante_sesso === 'M' ? 'checked' : ''}>
                                <label for="venditore_${venditore.id}_rappresentante_sesso_m">Maschio</label>

                                <input type="radio" name="venditore_${venditore.id}_rappresentante_sesso" id="venditore_${venditore.id}_rappresentante_sesso_f" value="F" ${venditore.rappresentante_sesso === 'F' ? 'checked' : ''}>
                                <label for="venditore_${venditore.id}_rappresentante_sesso_f">Femmina</label>

                                <div class="segmented-control-slider"></div>
                            </div>
                        </div>

                        <!-- Luogo nascita | Data nascita -->
                        <div class="field-row">
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_rappresentante_luogo_nascita">Luogo di Nascita</label>
                                <input type="text" id="venditore_${venditore.id}_rappresentante_luogo_nascita" value="${venditore.rappresentante_luogo_nascita || ''}">
                            </div>
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_rappresentante_data_nascita">Data di Nascita</label>
                                <input type="date" id="venditore_${venditore.id}_rappresentante_data_nascita" value="${venditore.rappresentante_data_nascita || ''}">
                            </div>
                        </div>

                        <!-- Cittadinanza Rappresentante -->
                        <div class="field-group">
                            <label>Cittadinanza</label>
                            <div class="segmented-control cittadinanza-control">
                                <input type="radio" name="venditore_${venditore.id}_rappresentante_cittadinanza_tipo" id="venditore_${venditore.id}_rappresentante_citt_italia" value="italia" ${!venditore.rappresentante_cittadinanza || venditore.rappresentante_cittadinanza === 'italiana' ? 'checked' : ''}>
                                <label for="venditore_${venditore.id}_rappresentante_citt_italia">Italia</label>

                                <input type="radio" name="venditore_${venditore.id}_rappresentante_cittadinanza_tipo" id="venditore_${venditore.id}_rappresentante_citt_estero" value="estero" ${venditore.rappresentante_cittadinanza && venditore.rappresentante_cittadinanza !== 'italiana' ? 'checked' : ''}>
                                <label for="venditore_${venditore.id}_rappresentante_citt_estero">Estero</label>

                                <div class="segmented-control-slider"></div>
                            </div>
                            <div class="cittadinanza-field" id="cittadinanza-rappresentante-field-${venditore.id}" style="display: ${venditore.rappresentante_cittadinanza && venditore.rappresentante_cittadinanza !== 'italiana' ? 'block' : 'none'};">
                                <input type="text" id="venditore_${venditore.id}_rappresentante_cittadinanza_custom" value="${venditore.rappresentante_cittadinanza !== 'italiana' ? venditore.rappresentante_cittadinanza || '' : ''}" list="paesi-cittadinanza-list" placeholder="Specificare paese">
                            </div>
                        </div>

                        <!-- CF -->
                        <div class="field-group">
                            <label for="venditore_${venditore.id}_rappresentante_cf">Codice Fiscale</label>
                            <div class="cf-input-group">
                                <input type="text" id="venditore_${venditore.id}_rappresentante_cf" value="${venditore.rappresentante_cf || ''}" maxlength="16" style="text-transform: uppercase;">
                                <button type="button" class="btn-calculate-cf" data-venditore-id="${venditore.id}" data-tipo="rappresentante">🧮 Calcola</button>
                            </div>
                        </div>

                        <!-- Documento -->
                        <div class="field-row">
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_rappresentante_tipo_documento">Tipo Documento</label>
                                <select id="venditore_${venditore.id}_rappresentante_tipo_documento">
                                    <option value="carta_identita" ${!venditore.rappresentante_tipo_documento || venditore.rappresentante_tipo_documento === 'carta_identita' ? 'selected' : ''}>Carta d'Identità</option>
                                    <option value="patente" ${venditore.rappresentante_tipo_documento === 'patente' ? 'selected' : ''}>Patente</option>
                                    <option value="passaporto" ${venditore.rappresentante_tipo_documento === 'passaporto' ? 'selected' : ''}>Passaporto</option>
                                </select>
                            </div>
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_rappresentante_numero_documento">Numero</label>
                                <input type="text" id="venditore_${venditore.id}_rappresentante_numero_documento" value="${venditore.rappresentante_numero_documento || ''}">
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_rappresentante_data_rilascio">Data Rilascio</label>
                                <input type="date" id="venditore_${venditore.id}_rappresentante_data_rilascio" value="${venditore.rappresentante_data_rilascio || ''}">
                            </div>
                            <div class="field-group">
                                <label for="venditore_${venditore.id}_rappresentante_data_scadenza">Data Scadenza</label>
                                <input type="date" id="venditore_${venditore.id}_rappresentante_data_scadenza" value="${venditore.rappresentante_data_scadenza || ''}">
                            </div>
                        </div>

                        <!-- Domicilio per la carica -->
                        <div class="field-group">
                            <div class="domicilio-carica-toggle">
                                <input type="checkbox" id="venditore_${venditore.id}_rappresentante_domicilio_presso_sede" ${!venditore.rappresentante_domicilio_presso_sede || venditore.rappresentante_domicilio_presso_sede === true ? 'checked' : ''}>
                                <label for="venditore_${venditore.id}_rappresentante_domicilio_presso_sede">Domiciliato per la carica presso la sede</label>
                            </div>
                            <div id="domicilio-rappresentante-${venditore.id}" class="domicilio-carica-fields ${venditore.rappresentante_domicilio_presso_sede === false ? 'active' : ''}">
                                <div class="field-row">
                                    <div class="field-group">
                                        <label for="venditore_${venditore.id}_rappresentante_domicilio_via">Via</label>
                                        <input type="text" id="venditore_${venditore.id}_rappresentante_domicilio_via" value="${venditore.rappresentante_domicilio_via || ''}">
                                    </div>
                                    <div class="field-group">
                                        <label for="venditore_${venditore.id}_rappresentante_domicilio_numero">Numero</label>
                                        <input type="text" id="venditore_${venditore.id}_rappresentante_domicilio_numero" value="${venditore.rappresentante_domicilio_numero || ''}">
                                    </div>
                                </div>
                                <div class="field-row">
                                    <div class="field-group">
                                        <label for="venditore_${venditore.id}_rappresentante_domicilio_cap">CAP</label>
                                        <input type="text" id="venditore_${venditore.id}_rappresentante_domicilio_cap" value="${venditore.rappresentante_domicilio_cap || ''}" maxlength="5">
                                    </div>
                                    <div class="field-group">
                                        <label for="venditore_${venditore.id}_rappresentante_domicilio_comune">Comune</label>
                                        <input type="text" id="venditore_${venditore.id}_rappresentante_domicilio_comune" value="${venditore.rappresentante_domicilio_comune || ''}">
                                    </div>
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_rappresentante_domicilio_provincia">Provincia</label>
                                    <input type="text" id="venditore_${venditore.id}_rappresentante_domicilio_provincia" value="${venditore.rappresentante_domicilio_provincia || ''}" maxlength="2" style="text-transform: uppercase;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sezione Società-amministratore + Designato -->
                    <div id="rappresentante-societa-amm-${venditore.id}" class="${venditore.tipo_rappresentanza === 'persona_giuridica_con_designato' ? '' : 'hidden'}">
                        <!-- Società-amministratore -->
                        <div class="societa-amministratore-section">
                            <h5>🏢 Società-amministratore</h5>

                            <div class="field-group">
                                <label for="venditore_${venditore.id}_soc_amm_ragione_sociale">Ragione Sociale</label>
                                <input type="text" id="venditore_${venditore.id}_soc_amm_ragione_sociale" value="${venditore.soc_amm_ragione_sociale || ''}">
                            </div>

                            <!-- Sede -->
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_soc_amm_sede_via">Via</label>
                                    <input type="text" id="venditore_${venditore.id}_soc_amm_sede_via" value="${venditore.soc_amm_sede_via || ''}">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_soc_amm_sede_numero">Numero</label>
                                    <input type="text" id="venditore_${venditore.id}_soc_amm_sede_numero" value="${venditore.soc_amm_sede_numero || ''}">
                                </div>
                            </div>
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_soc_amm_sede_comune">Comune</label>
                                    <input type="text" id="venditore_${venditore.id}_soc_amm_sede_comune" value="${venditore.soc_amm_sede_comune || ''}">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_soc_amm_sede_provincia">Provincia</label>
                                    <input type="text" id="venditore_${venditore.id}_soc_amm_sede_provincia" value="${venditore.soc_amm_sede_provincia || ''}" maxlength="2" style="text-transform: uppercase;">
                                </div>
                            </div>

                            <!-- P.IVA e CF -->
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_soc_amm_piva">Partita IVA</label>
                                    <input type="text" id="venditore_${venditore.id}_soc_amm_piva" value="${venditore.soc_amm_piva || ''}" maxlength="11">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_soc_amm_cf">Codice Fiscale</label>
                                    <input type="text" id="venditore_${venditore.id}_soc_amm_cf" value="${venditore.soc_amm_cf || ''}" maxlength="16" style="text-transform: uppercase;">
                                </div>
                            </div>

                            <!-- RI e REA -->
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_soc_amm_ri_numero">RI Numero</label>
                                    <input type="text" id="venditore_${venditore.id}_soc_amm_ri_numero" value="${venditore.soc_amm_ri_numero || ''}">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_soc_amm_rea_numero">REA Numero</label>
                                    <input type="text" id="venditore_${venditore.id}_soc_amm_rea_numero" value="${venditore.soc_amm_rea_numero || ''}">
                                </div>
                            </div>

                            <div class="field-group">
                                <label for="venditore_${venditore.id}_soc_amm_pec">PEC</label>
                                <input type="email" id="venditore_${venditore.id}_soc_amm_pec" value="${venditore.soc_amm_pec || ''}">
                            </div>
                        </div>

                        <!-- Designato -->
                        <div class="designato-section">
                            <h5>👤 Designato (Persona Fisica)</h5>

                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_designato_nome">Nome</label>
                                    <input type="text" id="venditore_${venditore.id}_designato_nome" value="${venditore.designato_nome || ''}">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_designato_cognome">Cognome</label>
                                    <input type="text" id="venditore_${venditore.id}_designato_cognome" value="${venditore.designato_cognome || ''}">
                                </div>
                            </div>

                            <!-- Sesso -->
                            <div class="field-group">
                                <label>Sesso</label>
                                <div class="segmented-control sesso-control">
                                    <input type="radio" name="venditore_${venditore.id}_designato_sesso" id="venditore_${venditore.id}_designato_sesso_m" value="M" ${!venditore.designato_sesso || venditore.designato_sesso === 'M' ? 'checked' : ''}>
                                    <label for="venditore_${venditore.id}_designato_sesso_m">Maschio</label>

                                    <input type="radio" name="venditore_${venditore.id}_designato_sesso" id="venditore_${venditore.id}_designato_sesso_f" value="F" ${venditore.designato_sesso === 'F' ? 'checked' : ''}>
                                    <label for="venditore_${venditore.id}_designato_sesso_f">Femmina</label>

                                    <div class="segmented-control-slider"></div>
                                </div>
                            </div>

                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_designato_luogo_nascita">Luogo di Nascita</label>
                                    <input type="text" id="venditore_${venditore.id}_designato_luogo_nascita" value="${venditore.designato_luogo_nascita || ''}">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_designato_data_nascita">Data di Nascita</label>
                                    <input type="date" id="venditore_${venditore.id}_designato_data_nascita" value="${venditore.designato_data_nascita || ''}">
                                </div>
                            </div>

                            <!-- Cittadinanza Designato -->
                            <div class="field-group">
                                <label>Cittadinanza</label>
                                <div class="segmented-control cittadinanza-control">
                                    <input type="radio" name="venditore_${venditore.id}_designato_cittadinanza_tipo" id="venditore_${venditore.id}_designato_citt_italia" value="italia" ${!venditore.designato_cittadinanza || venditore.designato_cittadinanza === 'italiana' ? 'checked' : ''}>
                                    <label for="venditore_${venditore.id}_designato_citt_italia">Italia</label>

                                    <input type="radio" name="venditore_${venditore.id}_designato_cittadinanza_tipo" id="venditore_${venditore.id}_designato_citt_estero" value="estero" ${venditore.designato_cittadinanza && venditore.designato_cittadinanza !== 'italiana' ? 'checked' : ''}>
                                    <label for="venditore_${venditore.id}_designato_citt_estero">Estero</label>

                                    <div class="segmented-control-slider"></div>
                                </div>
                                <div class="cittadinanza-field" id="cittadinanza-designato-field-${venditore.id}" style="display: ${venditore.designato_cittadinanza && venditore.designato_cittadinanza !== 'italiana' ? 'block' : 'none'};">
                                    <input type="text" id="venditore_${venditore.id}_designato_cittadinanza_custom" value="${venditore.designato_cittadinanza !== 'italiana' ? venditore.designato_cittadinanza || '' : ''}" list="paesi-cittadinanza-list" placeholder="Specificare paese">
                                </div>
                            </div>

                            <div class="field-group">
                                <label for="venditore_${venditore.id}_designato_cf">Codice Fiscale</label>
                                <div class="cf-input-group">
                                    <input type="text" id="venditore_${venditore.id}_designato_cf" value="${venditore.designato_cf || ''}" maxlength="16" style="text-transform: uppercase;">
                                    <button type="button" class="btn-calculate-cf" data-venditore-id="${venditore.id}" data-tipo="designato">🧮 Calcola</button>
                                </div>
                            </div>

                            <!-- Documento -->
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_designato_tipo_documento">Tipo Documento</label>
                                    <select id="venditore_${venditore.id}_designato_tipo_documento">
                                        <option value="carta_identita" ${!venditore.designato_tipo_documento || venditore.designato_tipo_documento === 'carta_identita' ? 'selected' : ''}>Carta d'Identità</option>
                                        <option value="patente" ${venditore.designato_tipo_documento === 'patente' ? 'selected' : ''}>Patente</option>
                                        <option value="passaporto" ${venditore.designato_tipo_documento === 'passaporto' ? 'selected' : ''}>Passaporto</option>
                                    </select>
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_designato_numero_documento">Numero</label>
                                    <input type="text" id="venditore_${venditore.id}_designato_numero_documento" value="${venditore.designato_numero_documento || ''}">
                                </div>
                            </div>
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_designato_data_rilascio">Data Rilascio</label>
                                    <input type="date" id="venditore_${venditore.id}_designato_data_rilascio" value="${venditore.designato_data_rilascio || ''}">
                                </div>
                                <div class="field-group">
                                    <label for="venditore_${venditore.id}_designato_data_scadenza">Data Scadenza</label>
                                    <input type="date" id="venditore_${venditore.id}_designato_data_scadenza" value="${venditore.designato_data_scadenza || ''}">
                                </div>
                            </div>

                            <!-- Domicilio per la carica -->
                            <div class="field-group">
                                <div class="domicilio-carica-toggle">
                                    <input type="checkbox" id="venditore_${venditore.id}_designato_domicilio_presso_sede" ${!venditore.designato_domicilio_presso_sede || venditore.designato_domicilio_presso_sede === true ? 'checked' : ''}>
                                    <label for="venditore_${venditore.id}_designato_domicilio_presso_sede">Domiciliato per la carica presso la sede</label>
                                </div>
                                <div id="domicilio-designato-${venditore.id}" class="domicilio-carica-fields ${venditore.designato_domicilio_presso_sede === false ? 'active' : ''}">
                                    <div class="field-row">
                                        <div class="field-group">
                                            <label for="venditore_${venditore.id}_designato_domicilio_via">Via</label>
                                            <input type="text" id="venditore_${venditore.id}_designato_domicilio_via" value="${venditore.designato_domicilio_via || ''}">
                                        </div>
                                        <div class="field-group">
                                            <label for="venditore_${venditore.id}_designato_domicilio_numero">Numero</label>
                                            <input type="text" id="venditore_${venditore.id}_designato_domicilio_numero" value="${venditore.designato_domicilio_numero || ''}">
                                        </div>
                                    </div>
                                    <div class="field-row">
                                        <div class="field-group">
                                            <label for="venditore_${venditore.id}_designato_domicilio_cap">CAP</label>
                                            <input type="text" id="venditore_${venditore.id}_designato_domicilio_cap" value="${venditore.designato_domicilio_cap || ''}" maxlength="5">
                                        </div>
                                        <div class="field-group">
                                            <label for="venditore_${venditore.id}_designato_domicilio_comune">Comune</label>
                                            <input type="text" id="venditore_${venditore.id}_designato_domicilio_comune" value="${venditore.designato_domicilio_comune || ''}">
                                        </div>
                                    </div>
                                    <div class="field-group">
                                        <label for="venditore_${venditore.id}_designato_domicilio_provincia">Provincia</label>
                                        <input type="text" id="venditore_${venditore.id}_designato_domicilio_provincia" value="${venditore.designato_domicilio_provincia || ''}" maxlength="2" style="text-transform: uppercase;">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            <!-- FINE FORM SOCIETÀ -->

        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', venditoreHtml);
    console.log(`✅ Venditore ${venditore.id} renderizzato`);

    // ========== EVENT LISTENERS: REGIME PATRIMONIALE ==========
    // Non aggiungere listener se è un coniuge auto-aggiunto (readonly)
    if (!venditore.isConiuge) {
        setTimeout(() => {
            const statoCivileSelect = document.getElementById(`venditore_${venditore.id}_stato_civile`);
            const regimeSection = document.getElementById(`regime-patrimoniale-section-${venditore.id}`);
            const checkboxRegime = document.getElementById(`venditore_${venditore.id}_specificare_regime`);
            const regimeDropdown = document.getElementById(`regime-dropdown-${venditore.id}`);
            const regimeSelect = document.getElementById(`venditore_${venditore.id}_regime_patrimoniale`);
            const comunioneAlert = document.getElementById(`comunione-alert-${venditore.id}`);

            if (statoCivileSelect && regimeSection) {
                // 1. Show/hide regime section based on stato_civile (coniugato O separato)
                const toggleRegimeSection = () => {
                    const statoCivile = statoCivileSelect.value;
                    const showRegimeSection = (statoCivile === 'coniugato' || statoCivile === 'separato');
                    regimeSection.style.display = showRegimeSection ? 'block' : 'none';

                    // Reset fields if not married/separated anymore
                    if (!showRegimeSection) {
                        if (checkboxRegime) {
                            checkboxRegime.classList.remove('active');
                            checkboxRegime.dataset.active = 'false';
                        }
                        if (regimeSelect) regimeSelect.value = '';
                        if (regimeDropdown) regimeDropdown.style.display = 'none';

                        // Remove spouse if exists
                        const v = this.venditori.find(ven => ven.id === venditore.id);
                        if (v && v.hasConiuge) {
                            this.removeConiugeAuto(venditore.id);
                        }
                    }
                };

                statoCivileSelect.addEventListener('change', toggleRegimeSection);
                toggleRegimeSection(); // Initial trigger

                // 2. Show/hide regime dropdown based on chip button toggle
                if (checkboxRegime && regimeDropdown) {
                    const toggleRegimeDropdown = () => {
                        const isActive = checkboxRegime.classList.contains('active');
                        regimeDropdown.style.display = isActive ? 'block' : 'none';

                        // Reset regime if deactivated
                        if (!isActive) {
                            if (regimeSelect) regimeSelect.value = '';
                            if (comunioneAlert) comunioneAlert.style.display = 'none';

                            // Remove spouse if exists
                            const v = this.venditori.find(ven => ven.id === venditore.id);
                            if (v && v.hasConiuge) {
                                this.removeConiugeAuto(venditore.id);
                            }
                        }
                    };

                    // Click handler per toggle chip button
                    checkboxRegime.addEventListener('click', () => {
                        // Toggle active state
                        checkboxRegime.classList.toggle('active');
                        const isNowActive = checkboxRegime.classList.contains('active');
                        checkboxRegime.dataset.active = isNowActive ? 'true' : 'false';

                        console.log(`🔘 Chip button regime toggled: ${isNowActive}`);

                        // Trigger dropdown visibility
                        toggleRegimeDropdown();
                    });

                    toggleRegimeDropdown(); // Initial trigger
                }

                // 3. Handle regime change (add/remove spouse)
                if (regimeSelect && comunioneAlert) {
                    const handleRegimeChange = () => {
                        const regimeValue = regimeSelect.value;

                        // Show/hide alert
                        comunioneAlert.style.display = regimeValue === 'comunione' ? 'block' : 'none';

                        // Trigger spouse add/remove
                        this.handleRegimePatrimonialeChange(venditore.id);
                    };

                    regimeSelect.addEventListener('change', handleRegimeChange);
                    handleRegimeChange(); // Initial trigger
                }

                console.log(`✅ Event listeners regime patrimoniale attivati per venditore ${venditore.id}`);
            }

            // ========== EVENT LISTENERS: SEGMENTED CONTROL SESSO ==========
            const sessoRadioM = document.getElementById(`venditore_${venditore.id}_sesso_m`);
            const sessoRadioF = document.getElementById(`venditore_${venditore.id}_sesso_f`);

            const handleSessoChange = () => {
                const sessoValue = sessoRadioM.checked ? 'M' : 'F';

                // Aggiorna l'oggetto venditore in memoria
                const v = this.venditori.find(ven => ven.id === venditore.id);
                if (v) {
                    v.sesso = sessoValue;
                    console.log(`🚹🚺 Sesso venditore ${venditore.id} aggiornato: ${sessoValue}`);
                }
            };

            if (sessoRadioM && sessoRadioF) {
                sessoRadioM.addEventListener('change', handleSessoChange);
                sessoRadioF.addEventListener('change', handleSessoChange);
                console.log(`✅ Event listeners segmented control sesso attivati per venditore ${venditore.id}`);
            }

            // ========== EVENT LISTENERS: SEGMENTED CONTROL CITTADINANZA ==========
            const cittItaliaRadio = document.getElementById(`venditore_${venditore.id}_citt_italia`);
            const cittEsteroRadio = document.getElementById(`venditore_${venditore.id}_citt_estero`);
            const cittadinanzaField = document.getElementById(`cittadinanza-field-${venditore.id}`);
            const cittadinanzaInput = document.getElementById(`venditore_${venditore.id}_cittadinanza_custom`);
            const permessoSoggiornoSection = document.getElementById(`permesso-soggiorno-section-${venditore.id}`);

            const handleCittadinanzaChange = () => {
                const isItalia = cittItaliaRadio.checked;

                // Mostra/nascondi campo autocomplete
                if (cittadinanzaField) {
                    cittadinanzaField.style.display = isItalia ? 'none' : 'block';
                }

                // Mostra/nascondi sezione Permesso di Soggiorno
                if (permessoSoggiornoSection) {
                    permessoSoggiornoSection.style.display = isItalia ? 'none' : 'block';
                    console.log(`📋 Permesso soggiorno ${isItalia ? 'nascosto' : 'mostrato'} per venditore ${venditore.id}`);
                }

                // Reset campo se Italia
                if (isItalia && cittadinanzaInput) {
                    cittadinanzaInput.value = '';
                }

                // Aggiorna l'oggetto venditore in memoria
                const v = this.venditori.find(ven => ven.id === venditore.id);
                if (v) {
                    v.cittadinanza = isItalia ? 'italiana' : (cittadinanzaInput?.value || '');
                    console.log(`🌍 Cittadinanza venditore ${venditore.id} aggiornata: ${v.cittadinanza}`);
                }
            };

            if (cittItaliaRadio && cittEsteroRadio) {
                cittItaliaRadio.addEventListener('change', handleCittadinanzaChange);
                cittEsteroRadio.addEventListener('change', handleCittadinanzaChange);

                // Listener per quando digita nel campo estero
                if (cittadinanzaInput) {
                    cittadinanzaInput.addEventListener('change', () => {
                        const v = this.venditori.find(ven => ven.id === venditore.id);
                        if (v && cittEsteroRadio.checked) {
                            v.cittadinanza = cittadinanzaInput.value;
                            console.log(`🌍 Cittadinanza estera venditore ${venditore.id} aggiornata: ${v.cittadinanza}`);
                        }
                    });
                }

                console.log(`✅ Event listeners segmented control cittadinanza attivati per venditore ${venditore.id}`);
            }

            // ========== EVENT LISTENERS: TIPO SOGGETTO (Privato/Ditta/Società) ==========
            const tipoPrivatoRadio = document.getElementById(`venditore_${venditore.id}_tipo_privato`);
            const tipoDittaRadio = document.getElementById(`venditore_${venditore.id}_tipo_ditta`);
            const tipoSocietaRadio = document.getElementById(`venditore_${venditore.id}_tipo_societa`);

            const formPrivato = document.querySelector(`#venditore-${venditore.id} .form-tipo-privato`);
            const formDitta = document.querySelector(`#venditore-${venditore.id} .form-tipo-ditta`);
            const formSocieta = document.querySelector(`#venditore-${venditore.id} .form-tipo-societa`);

            const handleTipoSoggettoChange = () => {
                const tipo = tipoPrivatoRadio.checked ? 'privato' :
                            tipoDittaRadio.checked ? 'ditta' : 'societa';

                // Mostra/nascondi form
                if (formPrivato) formPrivato.classList.toggle('active', tipo === 'privato');
                if (formDitta) formDitta.classList.toggle('active', tipo === 'ditta');
                if (formSocieta) formSocieta.classList.toggle('active', tipo === 'societa');

                // Aggiorna oggetto venditore
                const v = this.venditori.find(ven => ven.id === venditore.id);
                if (v) {
                    v.tipo = tipo;
                    console.log(`👤 Tipo soggetto venditore ${venditore.id} aggiornato: ${tipo}`);
                }
            };

            if (tipoPrivatoRadio && tipoDittaRadio && tipoSocietaRadio) {
                tipoPrivatoRadio.addEventListener('change', handleTipoSoggettoChange);
                tipoDittaRadio.addEventListener('change', handleTipoSoggettoChange);
                tipoSocietaRadio.addEventListener('change', handleTipoSoggettoChange);
                console.log(`✅ Event listeners tipo soggetto attivati per venditore ${venditore.id}`);
            }

            // ========== EVENT LISTENERS: TIPO RAPPRESENTANZA (solo per Società) ==========
            const rappPersonaFisicaRadio = document.getElementById(`venditore_${venditore.id}_rapp_persona_fisica`);
            const rappSocietaAmmRadio = document.getElementById(`venditore_${venditore.id}_rapp_societa_amm`);

            const rappPersonaFisicaSection = document.getElementById(`rappresentante-persona-fisica-${venditore.id}`);
            const rappSocietaAmmSection = document.getElementById(`rappresentante-societa-amm-${venditore.id}`);

            const handleTipoRappresentanzaChange = () => {
                const tipoRapp = rappPersonaFisicaRadio?.checked ? 'persona_fisica' : 'persona_giuridica_con_designato';

                // Mostra/nascondi sezioni
                if (rappPersonaFisicaSection) {
                    rappPersonaFisicaSection.classList.toggle('hidden', tipoRapp !== 'persona_fisica');
                }
                if (rappSocietaAmmSection) {
                    rappSocietaAmmSection.classList.toggle('hidden', tipoRapp !== 'persona_giuridica_con_designato');
                }

                // Aggiorna oggetto venditore
                const v = this.venditori.find(ven => ven.id === venditore.id);
                if (v) {
                    v.tipo_rappresentanza = tipoRapp;
                    console.log(`👔 Tipo rappresentanza venditore ${venditore.id} aggiornato: ${tipoRapp}`);
                }
            };

            if (rappPersonaFisicaRadio && rappSocietaAmmRadio) {
                rappPersonaFisicaRadio.addEventListener('change', handleTipoRappresentanzaChange);
                rappSocietaAmmRadio.addEventListener('change', handleTipoRappresentanzaChange);
                console.log(`✅ Event listeners tipo rappresentanza attivati per venditore ${venditore.id}`);
            }

            // ========== EVENT LISTENERS: DOMICILIO PER LA CARICA (Titolare - DITTA) ==========
            const domicilioTitolareCheckbox = document.getElementById(`venditore_${venditore.id}_titolare_domicilio_presso_sede`);
            const domicilioTitolareFields = document.getElementById(`domicilio-titolare-${venditore.id}`);

            if (domicilioTitolareCheckbox && domicilioTitolareFields) {
                domicilioTitolareCheckbox.addEventListener('change', () => {
                    const pressoSede = domicilioTitolareCheckbox.checked;
                    domicilioTitolareFields.classList.toggle('active', !pressoSede);

                    const v = this.venditori.find(ven => ven.id === venditore.id);
                    if (v) {
                        v.titolare_domicilio_presso_sede = pressoSede;
                        console.log(`🏠 Domicilio titolare presso sede: ${pressoSede}`);
                    }
                });
            }

            // ========== EVENT LISTENERS: DOMICILIO PER LA CARICA (Rappresentante - SOCIETÀ) ==========
            const domicilioRappresentanteCheckbox = document.getElementById(`venditore_${venditore.id}_rappresentante_domicilio_presso_sede`);
            const domicilioRappresentanteFields = document.getElementById(`domicilio-rappresentante-${venditore.id}`);

            if (domicilioRappresentanteCheckbox && domicilioRappresentanteFields) {
                domicilioRappresentanteCheckbox.addEventListener('change', () => {
                    const pressoSede = domicilioRappresentanteCheckbox.checked;
                    domicilioRappresentanteFields.classList.toggle('active', !pressoSede);

                    const v = this.venditori.find(ven => ven.id === venditore.id);
                    if (v) {
                        v.rappresentante_domicilio_presso_sede = pressoSede;
                        console.log(`🏠 Domicilio rappresentante presso sede: ${pressoSede}`);
                    }
                });
            }

            // ========== EVENT LISTENERS: DOMICILIO PER LA CARICA (Designato - SOCIETÀ) ==========
            const domicilioDesignatoCheckbox = document.getElementById(`venditore_${venditore.id}_designato_domicilio_presso_sede`);
            const domicilioDesignatoFields = document.getElementById(`domicilio-designato-${venditore.id}`);

            if (domicilioDesignatoCheckbox && domicilioDesignatoFields) {
                domicilioDesignatoCheckbox.addEventListener('change', () => {
                    const pressoSede = domicilioDesignatoCheckbox.checked;
                    domicilioDesignatoFields.classList.toggle('active', !pressoSede);

                    const v = this.venditori.find(ven => ven.id === venditore.id);
                    if (v) {
                        v.designato_domicilio_presso_sede = pressoSede;
                        console.log(`🏠 Domicilio designato presso sede: ${pressoSede}`);
                    }
                });
            }

            // ========== EVENT LISTENERS: CITTADINANZA TITOLARE (DITTA) ==========
            const titolareCittItaliaRadio = document.getElementById(`venditore_${venditore.id}_titolare_citt_italia`);
            const titolareCittEsteroRadio = document.getElementById(`venditore_${venditore.id}_titolare_citt_estero`);
            const titolareCittadinanzaField = document.getElementById(`cittadinanza-titolare-field-${venditore.id}`);
            const titolareCittadinanzaInput = document.getElementById(`venditore_${venditore.id}_titolare_cittadinanza_custom`);

            const handleTitolareCittadinanzaChange = () => {
                const isItalia = titolareCittItaliaRadio.checked;

                // Mostra/nascondi campo autocomplete
                if (titolareCittadinanzaField) {
                    titolareCittadinanzaField.style.display = isItalia ? 'none' : 'block';
                }

                // Reset campo se Italia
                if (isItalia && titolareCittadinanzaInput) {
                    titolareCittadinanzaInput.value = '';
                }

                // Aggiorna l'oggetto venditore in memoria
                const v = this.venditori.find(ven => ven.id === venditore.id);
                if (v) {
                    v.titolare_cittadinanza = isItalia ? 'italiana' : (titolareCittadinanzaInput?.value || '');
                    console.log(`🌍 Cittadinanza titolare venditore ${venditore.id} aggiornata: ${v.titolare_cittadinanza}`);
                }
            };

            if (titolareCittItaliaRadio && titolareCittEsteroRadio) {
                titolareCittItaliaRadio.addEventListener('change', handleTitolareCittadinanzaChange);
                titolareCittEsteroRadio.addEventListener('change', handleTitolareCittadinanzaChange);

                // Listener per quando digita nel campo estero
                if (titolareCittadinanzaInput) {
                    titolareCittadinanzaInput.addEventListener('change', () => {
                        const v = this.venditori.find(ven => ven.id === venditore.id);
                        if (v && titolareCittEsteroRadio.checked) {
                            v.titolare_cittadinanza = titolareCittadinanzaInput.value;
                            console.log(`🌍 Cittadinanza estera titolare venditore ${venditore.id} aggiornata: ${v.titolare_cittadinanza}`);
                        }
                    });
                }

                console.log(`✅ Event listeners cittadinanza titolare attivati per venditore ${venditore.id}`);
            }

            // ========== EVENT LISTENERS: CITTADINANZA RAPPRESENTANTE (SOCIETÀ) ==========
            const rappresentanteCittItaliaRadio = document.getElementById(`venditore_${venditore.id}_rappresentante_citt_italia`);
            const rappresentanteCittEsteroRadio = document.getElementById(`venditore_${venditore.id}_rappresentante_citt_estero`);
            const rappresentanteCittadinanzaField = document.getElementById(`cittadinanza-rappresentante-field-${venditore.id}`);
            const rappresentanteCittadinanzaInput = document.getElementById(`venditore_${venditore.id}_rappresentante_cittadinanza_custom`);

            const handleRappresentanteCittadinanzaChange = () => {
                const isItalia = rappresentanteCittItaliaRadio.checked;

                // Mostra/nascondi campo autocomplete
                if (rappresentanteCittadinanzaField) {
                    rappresentanteCittadinanzaField.style.display = isItalia ? 'none' : 'block';
                }

                // Reset campo se Italia
                if (isItalia && rappresentanteCittadinanzaInput) {
                    rappresentanteCittadinanzaInput.value = '';
                }

                // Aggiorna l'oggetto venditore in memoria
                const v = this.venditori.find(ven => ven.id === venditore.id);
                if (v) {
                    v.rappresentante_cittadinanza = isItalia ? 'italiana' : (rappresentanteCittadinanzaInput?.value || '');
                    console.log(`🌍 Cittadinanza rappresentante venditore ${venditore.id} aggiornata: ${v.rappresentante_cittadinanza}`);
                }
            };

            if (rappresentanteCittItaliaRadio && rappresentanteCittEsteroRadio) {
                rappresentanteCittItaliaRadio.addEventListener('change', handleRappresentanteCittadinanzaChange);
                rappresentanteCittEsteroRadio.addEventListener('change', handleRappresentanteCittadinanzaChange);

                // Listener per quando digita nel campo estero
                if (rappresentanteCittadinanzaInput) {
                    rappresentanteCittadinanzaInput.addEventListener('change', () => {
                        const v = this.venditori.find(ven => ven.id === venditore.id);
                        if (v && rappresentanteCittEsteroRadio.checked) {
                            v.rappresentante_cittadinanza = rappresentanteCittadinanzaInput.value;
                            console.log(`🌍 Cittadinanza estera rappresentante venditore ${venditore.id} aggiornata: ${v.rappresentante_cittadinanza}`);
                        }
                    });
                }

                console.log(`✅ Event listeners cittadinanza rappresentante attivati per venditore ${venditore.id}`);
            }

            // ========== EVENT LISTENERS: CITTADINANZA DESIGNATO (SOCIETÀ) ==========
            const designatoCittItaliaRadio = document.getElementById(`venditore_${venditore.id}_designato_citt_italia`);
            const designatoCittEsteroRadio = document.getElementById(`venditore_${venditore.id}_designato_citt_estero`);
            const designatoCittadinanzaField = document.getElementById(`cittadinanza-designato-field-${venditore.id}`);
            const designatoCittadinanzaInput = document.getElementById(`venditore_${venditore.id}_designato_cittadinanza_custom`);

            const handleDesignatoCittadinanzaChange = () => {
                const isItalia = designatoCittItaliaRadio.checked;

                // Mostra/nascondi campo autocomplete
                if (designatoCittadinanzaField) {
                    designatoCittadinanzaField.style.display = isItalia ? 'none' : 'block';
                }

                // Reset campo se Italia
                if (isItalia && designatoCittadinanzaInput) {
                    designatoCittadinanzaInput.value = '';
                }

                // Aggiorna l'oggetto venditore in memoria
                const v = this.venditori.find(ven => ven.id === venditore.id);
                if (v) {
                    v.designato_cittadinanza = isItalia ? 'italiana' : (designatoCittadinanzaInput?.value || '');
                    console.log(`🌍 Cittadinanza designato venditore ${venditore.id} aggiornata: ${v.designato_cittadinanza}`);
                }
            };

            if (designatoCittItaliaRadio && designatoCittEsteroRadio) {
                designatoCittItaliaRadio.addEventListener('change', handleDesignatoCittadinanzaChange);
                designatoCittEsteroRadio.addEventListener('change', handleDesignatoCittadinanzaChange);

                // Listener per quando digita nel campo estero
                if (designatoCittadinanzaInput) {
                    designatoCittadinanzaInput.addEventListener('change', () => {
                        const v = this.venditori.find(ven => ven.id === venditore.id);
                        if (v && designatoCittEsteroRadio.checked) {
                            v.designato_cittadinanza = designatoCittadinanzaInput.value;
                            console.log(`🌍 Cittadinanza estera designato venditore ${venditore.id} aggiornata: ${v.designato_cittadinanza}`);
                        }
                    });
                }

                console.log(`✅ Event listeners cittadinanza designato attivati per venditore ${venditore.id}`);
            }

            // ========== EVENT LISTENERS: CALCOLA CF (Titolare, Rappresentante, Designato) ==========
            // Trova tutti i button con classe btn-calculate-cf per questo venditore
            const cfButtons = document.querySelectorAll(`.btn-calculate-cf[data-venditore-id="${venditore.id}"]`);

            cfButtons.forEach(button => {
                const tipo = button.dataset.tipo; // 'titolare', 'rappresentante', o 'designato'
                if (tipo && ['titolare', 'rappresentante', 'designato'].includes(tipo)) {
                    button.addEventListener('click', () => {
                        this.calculateCF(venditore.id, tipo);
                    });
                    console.log(`✅ Event listener calcola CF attivato per ${tipo} venditore ${venditore.id}`);
                }
            });
        }, 100);
    } else {
        console.log(`⏭️ Venditore ${venditore.id} è un coniuge auto-aggiunto - event listeners non necessari`);
    }
}

    // ========== BLOCCO 5: GESTIONE SALVATAGGIO ==========

    initializeActions() {
        const savePraticaBtn = document.getElementById('save-pratica');
        const generateDocumentsBtn = document.getElementById('generate-documents');

        if (savePraticaBtn && !savePraticaBtn.hasAttribute('data-listener-attached')) {
            savePraticaBtn.addEventListener('click', () => {
                this.savePratica();
            });
            savePraticaBtn.setAttribute('data-listener-attached', 'true');
        }

        if (generateDocumentsBtn && !generateDocumentsBtn.hasAttribute('data-listener-attached')) {
            generateDocumentsBtn.addEventListener('click', () => {
                this.saveAndGenerateDocuments();
            });
            generateDocumentsBtn.setAttribute('data-listener-attached', 'true');
        }

        console.log('✅ Save and Generate buttons inizializzati (prevenendo duplicati)');
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

                // Aggiungi alle pratiche recenti
                const cognomeVenditore = this.venditori[0]?.cognome || 'Sconosciuto';
                this.addPraticaRecente(result.protocollo, cognomeVenditore);
            } else if (this.praticaMode === 'edit' && this.currentProtocollo) {
                // Se è un edit, aggiorna comunque le pratiche recenti
                const cognomeVenditore = this.venditori[0]?.cognome || 'Sconosciuto';
                this.addPraticaRecente(this.currentProtocollo, cognomeVenditore);
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
        
        // Raccolta dati venditori - LOGICA DIVERSA IN BASE AL TIPO
        const venditoriData = this.venditori.map(venditore => {
            // Leggi tipo soggetto
            const tipoPrivatoRadio = document.getElementById(`venditore_${venditore.id}_tipo_privato`);
            const tipoDittaRadio = document.getElementById(`venditore_${venditore.id}_tipo_ditta`);
            const tipoSocietaRadio = document.getElementById(`venditore_${venditore.id}_tipo_societa`);
            const tipo = tipoPrivatoRadio?.checked ? 'privato' :
                        tipoDittaRadio?.checked ? 'ditta' :
                        tipoSocietaRadio?.checked ? 'societa' : 'privato';

            let data = { id: venditore.id, tipo: tipo };

            // ========== PRIVATO ==========
            if (tipo === 'privato') {
                // Leggi stato chip button regime
                const chipRegime = document.getElementById(`venditore_${venditore.id}_specificare_regime`);
                const specificareRegime = chipRegime ? chipRegime.classList.contains('active') : false;

                // Leggi sesso dai radio button
                const sessoRadioM = document.getElementById(`venditore_${venditore.id}_sesso_m`);
                const sessoRadioF = document.getElementById(`venditore_${venditore.id}_sesso_f`);
                const sesso = sessoRadioM?.checked ? 'M' : (sessoRadioF?.checked ? 'F' : 'M');

                // Leggi cittadinanza dai radio button
                const cittItaliaRadio = document.getElementById(`venditore_${venditore.id}_citt_italia`);
                const isItalia = cittItaliaRadio?.checked || false;
                const cittadinanzaCustom = document.getElementById(`venditore_${venditore.id}_cittadinanza_custom`)?.value || '';
                const cittadinanza = isItalia ? 'italiana' : (cittadinanzaCustom || '');

                data = {
                    ...data,
                    nome: document.getElementById(`venditore_${venditore.id}_nome`)?.value || '',
                    cognome: document.getElementById(`venditore_${venditore.id}_cognome`)?.value || '',
                    sesso: sesso,
                    stato_civile: document.getElementById(`venditore_${venditore.id}_stato_civile`)?.value || '',
                    regime_patrimoniale: document.getElementById(`venditore_${venditore.id}_regime_patrimoniale`)?.value || '',
                    specificare_regime: specificareRegime,
                    isConiuge: venditore.isConiuge || false,
                    linkedTo: venditore.linkedTo || null,
                    hasConiuge: venditore.hasConiuge || false,
                    coniugeId: venditore.coniugeId || null,
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
                    telefono1: document.getElementById(`venditore_${venditore.id}_telefono1`)?.value || '',
                    telefono2: document.getElementById(`venditore_${venditore.id}_telefono2`)?.value || '',
                    email1: document.getElementById(`venditore_${venditore.id}_email1`)?.value || '',
                    email2: document.getElementById(`venditore_${venditore.id}_email2`)?.value || '',
                    cittadinanza: cittadinanza,
                    professione: document.getElementById(`venditore_${venditore.id}_professione`)?.value || '',
                    permesso_tipo: document.getElementById(`venditore_${venditore.id}_permesso_tipo`)?.value || '',
                    permesso_numero: document.getElementById(`venditore_${venditore.id}_permesso_numero`)?.value || '',
                    permesso_rilascio: document.getElementById(`venditore_${venditore.id}_permesso_rilascio`)?.value || '',
                    permesso_scadenza: document.getElementById(`venditore_${venditore.id}_permesso_scadenza`)?.value || '',
                    permesso_questura: document.getElementById(`venditore_${venditore.id}_permesso_questura`)?.value || ''
                };
            }

            // ========== DITTA ==========
            else if (tipo === 'ditta') {
                // Leggi sesso titolare
                const titolareSessoM = document.getElementById(`venditore_${venditore.id}_titolare_sesso_m`);
                const titolareSessoF = document.getElementById(`venditore_${venditore.id}_titolare_sesso_f`);
                const titolareSesso = titolareSessoM?.checked ? 'M' : 'F';

                // Leggi cittadinanza titolare
                const titolareCittItaliaRadio = document.getElementById(`venditore_${venditore.id}_titolare_citt_italia`);
                const isItaliaTitolare = titolareCittItaliaRadio?.checked !== false;
                const titolareCittadinanzaCustom = document.getElementById(`venditore_${venditore.id}_titolare_cittadinanza_custom`)?.value || '';
                const titolareCittadinanza = isItaliaTitolare ? 'italiana' : titolareCittadinanzaCustom;

                data = {
                    ...data,
                    titolare_nome: document.getElementById(`venditore_${venditore.id}_titolare_nome`)?.value || '',
                    titolare_cognome: document.getElementById(`venditore_${venditore.id}_titolare_cognome`)?.value || '',
                    titolare_sesso: titolareSesso,
                    titolare_luogo_nascita: document.getElementById(`venditore_${venditore.id}_titolare_luogo_nascita`)?.value || '',
                    titolare_data_nascita: document.getElementById(`venditore_${venditore.id}_titolare_data_nascita`)?.value || '',
                    titolare_cittadinanza: titolareCittadinanza,
                    cf_titolare: document.getElementById(`venditore_${venditore.id}_cf_titolare`)?.value || '',
                    titolare_tipo_documento: document.getElementById(`venditore_${venditore.id}_titolare_tipo_documento`)?.value || '',
                    titolare_numero_documento: document.getElementById(`venditore_${venditore.id}_titolare_numero_documento`)?.value || '',
                    titolare_data_rilascio: document.getElementById(`venditore_${venditore.id}_titolare_data_rilascio`)?.value || '',
                    titolare_data_scadenza: document.getElementById(`venditore_${venditore.id}_titolare_data_scadenza`)?.value || '',
                    titolare_domicilio_presso_sede: document.getElementById(`venditore_${venditore.id}_titolare_domicilio_presso_sede`)?.checked || false,
                    titolare_domicilio_via: document.getElementById(`venditore_${venditore.id}_titolare_domicilio_via`)?.value || '',
                    titolare_domicilio_numero: document.getElementById(`venditore_${venditore.id}_titolare_domicilio_numero`)?.value || '',
                    titolare_domicilio_cap: document.getElementById(`venditore_${venditore.id}_titolare_domicilio_cap`)?.value || '',
                    titolare_domicilio_comune: document.getElementById(`venditore_${venditore.id}_titolare_domicilio_comune`)?.value || '',
                    titolare_domicilio_provincia: document.getElementById(`venditore_${venditore.id}_titolare_domicilio_provincia`)?.value || '',
                    denominazione_ditta: document.getElementById(`venditore_${venditore.id}_denominazione_ditta`)?.value || '',
                    sede_ditta_via: document.getElementById(`venditore_${venditore.id}_sede_ditta_via`)?.value || '',
                    sede_ditta_numero: document.getElementById(`venditore_${venditore.id}_sede_ditta_numero`)?.value || '',
                    sede_ditta_cap: document.getElementById(`venditore_${venditore.id}_sede_ditta_cap`)?.value || '',
                    sede_ditta_comune: document.getElementById(`venditore_${venditore.id}_sede_ditta_comune`)?.value || '',
                    sede_ditta_provincia: document.getElementById(`venditore_${venditore.id}_sede_ditta_provincia`)?.value || '',
                    sede_ditta_stato: document.getElementById(`venditore_${venditore.id}_sede_ditta_stato`)?.value || '',
                    piva_ditta: document.getElementById(`venditore_${venditore.id}_piva_ditta`)?.value || '',
                    cf_ditta: document.getElementById(`venditore_${venditore.id}_cf_ditta`)?.value || '',
                    rea_numero_ditta: document.getElementById(`venditore_${venditore.id}_rea_numero_ditta`)?.value || '',
                    rea_cciaa_ditta: document.getElementById(`venditore_${venditore.id}_rea_cciaa_ditta`)?.value || '',
                    pec_ditta: document.getElementById(`venditore_${venditore.id}_pec_ditta`)?.value || '',
                    codice_destinatario_ditta: document.getElementById(`venditore_${venditore.id}_codice_destinatario_ditta`)?.value || '',
                    email_ditta: document.getElementById(`venditore_${venditore.id}_email_ditta`)?.value || '',
                    telefono_ditta: document.getElementById(`venditore_${venditore.id}_telefono_ditta`)?.value || ''
                };
            }

            // ========== SOCIETÀ ==========
            else if (tipo === 'societa') {
                // Leggi tipo rappresentanza
                const rappPersonaFisicaRadio = document.getElementById(`venditore_${venditore.id}_rapp_persona_fisica`);
                const tipoRapp = rappPersonaFisicaRadio?.checked ? 'persona_fisica' : 'persona_giuridica_con_designato';

                data = {
                    ...data,
                    ragione_sociale: document.getElementById(`venditore_${venditore.id}_ragione_sociale`)?.value || '',
                    sede_societa_via: document.getElementById(`venditore_${venditore.id}_sede_societa_via`)?.value || '',
                    sede_societa_numero: document.getElementById(`venditore_${venditore.id}_sede_societa_numero`)?.value || '',
                    sede_societa_cap: document.getElementById(`venditore_${venditore.id}_sede_societa_cap`)?.value || '',
                    sede_societa_comune: document.getElementById(`venditore_${venditore.id}_sede_societa_comune`)?.value || '',
                    sede_societa_provincia: document.getElementById(`venditore_${venditore.id}_sede_societa_provincia`)?.value || '',
                    sede_societa_stato: document.getElementById(`venditore_${venditore.id}_sede_societa_stato`)?.value || '',
                    piva_societa: document.getElementById(`venditore_${venditore.id}_piva_societa`)?.value || '',
                    cf_societa: document.getElementById(`venditore_${venditore.id}_cf_societa`)?.value || '',
                    ri_numero: document.getElementById(`venditore_${venditore.id}_ri_numero`)?.value || '',
                    ri_cciaa: document.getElementById(`venditore_${venditore.id}_ri_cciaa`)?.value || '',
                    rea_numero_societa: document.getElementById(`venditore_${venditore.id}_rea_numero_societa`)?.value || '',
                    rea_cciaa_societa: document.getElementById(`venditore_${venditore.id}_rea_cciaa_societa`)?.value || '',
                    pec_societa: document.getElementById(`venditore_${venditore.id}_pec_societa`)?.value || '',
                    codice_destinatario_societa: document.getElementById(`venditore_${venditore.id}_codice_destinatario_societa`)?.value || '',
                    email_societa: document.getElementById(`venditore_${venditore.id}_email_societa`)?.value || '',
                    telefono_societa: document.getElementById(`venditore_${venditore.id}_telefono_societa`)?.value || '',
                    tipo_rappresentanza: tipoRapp
                };

                if (tipoRapp === 'persona_fisica') {
                    // Leggi sesso rappresentante
                    const rappSessoM = document.getElementById(`venditore_${venditore.id}_rappresentante_sesso_m`);
                    const rappSessoF = document.getElementById(`venditore_${venditore.id}_rappresentante_sesso_f`);
                    const rappSesso = rappSessoM?.checked ? 'M' : 'F';

                    // Leggi cittadinanza rappresentante
                    const rappresentanteCittItaliaRadio = document.getElementById(`venditore_${venditore.id}_rappresentante_citt_italia`);
                    const isItaliaRappresentante = rappresentanteCittItaliaRadio?.checked !== false;
                    const rappresentanteCittadinanzaCustom = document.getElementById(`venditore_${venditore.id}_rappresentante_cittadinanza_custom`)?.value || '';
                    const rappresentanteCittadinanza = isItaliaRappresentante ? 'italiana' : rappresentanteCittadinanzaCustom;

                    data = {
                        ...data,
                        rappresentante_nome: document.getElementById(`venditore_${venditore.id}_rappresentante_nome`)?.value || '',
                        rappresentante_cognome: document.getElementById(`venditore_${venditore.id}_rappresentante_cognome`)?.value || '',
                        rappresentante_sesso: rappSesso,
                        rappresentante_luogo_nascita: document.getElementById(`venditore_${venditore.id}_rappresentante_luogo_nascita`)?.value || '',
                        rappresentante_data_nascita: document.getElementById(`venditore_${venditore.id}_rappresentante_data_nascita`)?.value || '',
                        rappresentante_cittadinanza: rappresentanteCittadinanza,
                        rappresentante_cf: document.getElementById(`venditore_${venditore.id}_rappresentante_cf`)?.value || '',
                        rappresentante_tipo_documento: document.getElementById(`venditore_${venditore.id}_rappresentante_tipo_documento`)?.value || '',
                        rappresentante_numero_documento: document.getElementById(`venditore_${venditore.id}_rappresentante_numero_documento`)?.value || '',
                        rappresentante_data_rilascio: document.getElementById(`venditore_${venditore.id}_rappresentante_data_rilascio`)?.value || '',
                        rappresentante_data_scadenza: document.getElementById(`venditore_${venditore.id}_rappresentante_data_scadenza`)?.value || '',
                        rappresentante_domicilio_presso_sede: document.getElementById(`venditore_${venditore.id}_rappresentante_domicilio_presso_sede`)?.checked || false,
                        rappresentante_domicilio_via: document.getElementById(`venditore_${venditore.id}_rappresentante_domicilio_via`)?.value || '',
                        rappresentante_domicilio_numero: document.getElementById(`venditore_${venditore.id}_rappresentante_domicilio_numero`)?.value || '',
                        rappresentante_domicilio_cap: document.getElementById(`venditore_${venditore.id}_rappresentante_domicilio_cap`)?.value || '',
                        rappresentante_domicilio_comune: document.getElementById(`venditore_${venditore.id}_rappresentante_domicilio_comune`)?.value || '',
                        rappresentante_domicilio_provincia: document.getElementById(`venditore_${venditore.id}_rappresentante_domicilio_provincia`)?.value || ''
                    };
                } else {
                    // Società-amministratore + Designato
                    const designatoSessoM = document.getElementById(`venditore_${venditore.id}_designato_sesso_m`);
                    const designatoSessoF = document.getElementById(`venditore_${venditore.id}_designato_sesso_f`);
                    const designatoSesso = designatoSessoM?.checked ? 'M' : 'F';

                    // Leggi cittadinanza designato
                    const designatoCittItaliaRadio = document.getElementById(`venditore_${venditore.id}_designato_citt_italia`);
                    const isItaliaDesignato = designatoCittItaliaRadio?.checked !== false;
                    const designatoCittadinanzaCustom = document.getElementById(`venditore_${venditore.id}_designato_cittadinanza_custom`)?.value || '';
                    const designatoCittadinanza = isItaliaDesignato ? 'italiana' : designatoCittadinanzaCustom;

                    data = {
                        ...data,
                        soc_amm_ragione_sociale: document.getElementById(`venditore_${venditore.id}_soc_amm_ragione_sociale`)?.value || '',
                        soc_amm_sede_via: document.getElementById(`venditore_${venditore.id}_soc_amm_sede_via`)?.value || '',
                        soc_amm_sede_numero: document.getElementById(`venditore_${venditore.id}_soc_amm_sede_numero`)?.value || '',
                        soc_amm_sede_comune: document.getElementById(`venditore_${venditore.id}_soc_amm_sede_comune`)?.value || '',
                        soc_amm_sede_provincia: document.getElementById(`venditore_${venditore.id}_soc_amm_sede_provincia`)?.value || '',
                        soc_amm_piva: document.getElementById(`venditore_${venditore.id}_soc_amm_piva`)?.value || '',
                        soc_amm_cf: document.getElementById(`venditore_${venditore.id}_soc_amm_cf`)?.value || '',
                        soc_amm_ri_numero: document.getElementById(`venditore_${venditore.id}_soc_amm_ri_numero`)?.value || '',
                        soc_amm_rea_numero: document.getElementById(`venditore_${venditore.id}_soc_amm_rea_numero`)?.value || '',
                        soc_amm_pec: document.getElementById(`venditore_${venditore.id}_soc_amm_pec`)?.value || '',
                        designato_nome: document.getElementById(`venditore_${venditore.id}_designato_nome`)?.value || '',
                        designato_cognome: document.getElementById(`venditore_${venditore.id}_designato_cognome`)?.value || '',
                        designato_sesso: designatoSesso,
                        designato_luogo_nascita: document.getElementById(`venditore_${venditore.id}_designato_luogo_nascita`)?.value || '',
                        designato_data_nascita: document.getElementById(`venditore_${venditore.id}_designato_data_nascita`)?.value || '',
                        designato_cittadinanza: designatoCittadinanza,
                        designato_cf: document.getElementById(`venditore_${venditore.id}_designato_cf`)?.value || '',
                        designato_tipo_documento: document.getElementById(`venditore_${venditore.id}_designato_tipo_documento`)?.value || '',
                        designato_numero_documento: document.getElementById(`venditore_${venditore.id}_designato_numero_documento`)?.value || '',
                        designato_data_rilascio: document.getElementById(`venditore_${venditore.id}_designato_data_rilascio`)?.value || '',
                        designato_data_scadenza: document.getElementById(`venditore_${venditore.id}_designato_data_scadenza`)?.value || '',
                        designato_domicilio_presso_sede: document.getElementById(`venditore_${venditore.id}_designato_domicilio_presso_sede`)?.checked || false,
                        designato_domicilio_via: document.getElementById(`venditore_${venditore.id}_designato_domicilio_via`)?.value || '',
                        designato_domicilio_numero: document.getElementById(`venditore_${venditore.id}_designato_domicilio_numero`)?.value || '',
                        designato_domicilio_cap: document.getElementById(`venditore_${venditore.id}_designato_domicilio_cap`)?.value || '',
                        designato_domicilio_comune: document.getElementById(`venditore_${venditore.id}_designato_domicilio_comune`)?.value || '',
                        designato_domicilio_provincia: document.getElementById(`venditore_${venditore.id}_designato_domicilio_provincia`)?.value || ''
                    };
                }
            }

            console.log(`📋 Dati venditore ${venditore.id} (${tipo}):`, data);
            return data;
        });
        
        console.log('📦 Venditori data finale:', venditoriData);
        console.log('📦 Venditori data length:', venditoriData.length);
        
        // Prima salva tutti i dati degli immobili dai campi HTML
        this.saveAllImmobiliData();

        // Aggiorna condizioni economiche da form
        this.updateCondizioniEconomiche();

        const finalData = {
            // Dati operatore
            lettera: selectedOption?.dataset.lettera || '',
            operatore: selectedOption?.textContent || '',
            operatore_id: selectedOption?.value || '', // ID operatore per mapping template

            // Dati pratica
            data_compilazione: document.getElementById('data_compilazione')?.value || '',

            // Venditori (JSON)
            venditori: venditoriData,

            // Immobili (JSON)
            immobili: this.immobili,

            // Condizioni Economiche (JSON)
            condizioni_economiche: this.condizioniEconomiche
        };
        
        console.log('🎯 Final form data:', finalData);
        console.log('🎯 Final venditori nel data:', finalData.venditori);
        console.log('🎯 Final venditori length:', finalData.venditori.length);
        console.log('🎯 Final immobili nel data:', finalData.immobili);
        console.log('🎯 Final immobili length:', finalData.immobili.length);
        
        return finalData;
    }

    saveAllImmobiliData() {
        console.log('💾 Salvataggio completo dati immobili...');

        this.immobili.forEach(immobile => {
            // Salva dati generali immobile
            const provinciaField = document.getElementById(`immobile_${immobile.id}_provincia`);
            const comuneField = document.getElementById(`immobile_${immobile.id}_comune`);
            const viaField = document.getElementById(`immobile_${immobile.id}_via`);
            const numeroField = document.getElementById(`immobile_${immobile.id}_numero`);

            if (provinciaField) immobile.provincia = provinciaField.value || '';
            if (comuneField) immobile.comune = comuneField.value || '';
            if (viaField) immobile.via = viaField.value || '';
            if (numeroField) immobile.numero = numeroField.value || '';

            // Salva intestatari
            this.saveAllIntestatariData(immobile.id);

            // Salva tutti i blocchi catastali
            this.saveBlocchiCatastaliData(immobile.id);

            // Salva confini
            this.saveAllConfiniData(immobile.id);

            // Salva stato immobile
            this.saveStatoImmobileData(immobile.id);

            console.log(`✅ Salvato immobile ${immobile.id}:`, JSON.stringify(immobile, null, 2));
        });
    }

    saveStatoImmobileData(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (!immobile) return;

        // Helper functions
        const getValue = (id) => document.getElementById(id)?.value || '';
        const getRadioValue = (name) => {
            const selected = document.querySelector(`input[name="${name}"]:checked`);
            return selected?.value || '';
        };
        const isChecked = (id) => document.getElementById(id)?.checked || false;

        // Inizializza stato se non esiste
        if (!immobile.stato) {
            immobile.stato = {};
        }

        // Occupazione
        immobile.stato.occupazione = getRadioValue(`occupazione_${immobileId}`);

        // Locazione (se occupazione = locato)
        immobile.stato.locazione = {
            inquilino: getValue(`inquilino_${immobileId}`),
            canone_annuo: getValue(`canone_${immobileId}`),
            scadenza_contratto: getValue(`scadenza_${immobileId}`)
        };

        // Conformità
        immobile.stato.conformita = {
            edilizia: isChecked(`conf_edilizia_${immobileId}`),
            catastale: isChecked(`conf_catastale_${immobileId}`),
            impianti: isChecked(`conf_impianti_${immobileId}`)
        };

        // Vincoli
        immobile.stato.vincoli = {
            iscrizioni_pregiudizievoli: isChecked(`iscriz_preg_${immobileId}`),
            vincoli_servitu: isChecked(`vincoli_serv_${immobileId}`)
        };

        // Certificazione energetica
        const modalitaCert = getRadioValue(`cert_modalita_${immobileId}`);
        const classeSelect = getValue(`cert_classe_select_${immobileId}`);
        const classeText = getValue(`cert_classe_text_${immobileId}`);

        immobile.stato.certificazione_energetica = {
            modalita: modalitaCert,
            classe: classeSelect || classeText, // Usa dropdown, se vuoto usa testo libero
            consumo_kwh: getValue(`cert_consumo_${immobileId}`),
            codice_attestato: getValue(`cert_codice_${immobileId}`),
            data_emissione: getValue(`cert_data_${immobileId}`),
            certificatore: getValue(`cert_certificatore_${immobileId}`)
        };

        // Documenti consegnati
        const documenti = [];
        if (isChecked(`doc_titoli_${immobileId}`)) documenti.push('titoli_provenienza');
        if (isChecked(`doc_planimetria_${immobileId}`)) documenti.push('planimetria');
        if (isChecked(`doc_visure_${immobileId}`)) documenti.push('visure');
        if (isChecked(`doc_ape_${immobileId}`)) documenti.push('ape');

        const altroDoc = getValue(`doc_altro_${immobileId}`);
        if (altroDoc) documenti.push(`altro: ${altroDoc}`);

        immobile.stato.documenti_consegnati = documenti;

        console.log(`🏠 Stato salvato per immobile ${immobileId}:`, immobile.stato);
    }

    saveAllConfiniData(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (!immobile) return;

        // Salva mappali per ogni direzione
        ['nord', 'est', 'sud', 'ovest'].forEach(direzione => {
            const mappaliInputs = document.querySelectorAll(`input[id^="confine_${immobileId}_${direzione}_"]`);
            const mappaliValues = [];

            mappaliInputs.forEach(input => {
                mappaliValues.push(input.value || '');
            });

            if (mappaliValues.length > 0) {
                immobile.confini[direzione] = mappaliValues;
            }

            console.log(`📍 Confini ${direzione} per immobile ${immobileId}:`, mappaliValues);
        });
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

    async saveAndGenerateDocuments() {
        // Prevenzione click multipli
        if (this.isGeneratingDocuments) {
            console.log('⏳ Generazione documenti già in corso, ignoro click multiplo');
            return;
        }

        this.isGeneratingDocuments = true;
        console.log('🎯 Avvio salvataggio + generazione documenti');

        try {
            // Prima salva la pratica
            await this.savePratica();

            // Se il salvataggio è andato a buon fine, genera i documenti
            if (!this.isDirty) { // isDirty viene settato a false dopo salvataggio riuscito
                await this.generateDocuments();
            }
        } finally {
            this.isGeneratingDocuments = false;
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
        const response = await fetch(this.appsScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'generate_documents',
                data: JSON.stringify(generateData)
            })
        });

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
            // Debug: controlla se i geodati sono caricati
            console.log('🔍 Debug - Geodati caricati:', this.geoDataLoaded);
            console.log('🔍 Debug - Province disponibili:', Object.keys(PROVINCE_COMUNI).length);
        }, 200);

        console.log('✅ Sistema immobili inizializzato');
    }

    // ========== BLOCCO: SISTEMA CONDIZIONI ECONOMICHE ==========

    initializeCondizioniTab() {
        console.log('💰 Inizializzando tab Condizioni Economiche...');

        // Event listener toggle OFFERTA UNICA
        const toggleOfferta = document.getElementById('toggle-offerta-unica');
        if (toggleOfferta) {
            toggleOfferta.addEventListener('change', () => {
                this.handleToggleOffertaUnica();
            });
            console.log('✅ Toggle offerta unica inizializzato');
        }

        // Event listeners tipo rinnovo
        const rinnovoRadios = document.querySelectorAll('input[name="tipo_rinnovo"]');
        rinnovoRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const giorniSection = document.getElementById('giorni-preavviso-section');
                if (e.target.value === 'tacito_continuo') {
                    giorniSection.style.display = 'block';
                } else {
                    giorniSection.style.display = 'none';
                }
            });
        });

        // Event listener esclusiva (radio buttons)
        const esclusivaTipoRadios = document.querySelectorAll('input[name="esclusiva_tipo"]');
        if (esclusivaTipoRadios.length > 0) {
            esclusivaTipoRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const esclusivaFields = document.getElementById('esclusiva-fields');
                    const nonEsclusivaFields = document.getElementById('non-esclusiva-fields');

                    console.log('🔒 Toggle esclusiva:', e.target.value);

                    if (e.target.value === 'esclusiva') {
                        if (esclusivaFields) esclusivaFields.style.display = 'block';
                        if (nonEsclusivaFields) nonEsclusivaFields.style.display = 'none';
                    } else {
                        if (esclusivaFields) esclusivaFields.style.display = 'none';
                        if (nonEsclusivaFields) nonEsclusivaFields.style.display = 'block';
                    }

                    // Aggiorna anche la preview degli obblighi
                    this.updateObblighi(e.target.value === 'esclusiva');
                });
            });
            console.log('✅ Event listener esclusiva tipo inizializzato');
        } else {
            console.warn('⚠️ Radio buttons esclusiva_tipo non trovati');
        }

        // Inizializza preview obblighi al caricamento
        const esclusivaChecked = document.querySelector('input[name="esclusiva_tipo"]:checked');
        if (esclusivaChecked) {
            this.updateObblighi(esclusivaChecked.value === 'esclusiva');
        }

        // Event listeners modalità saldo (condizioni pagamento)
        const saldoRadios = document.querySelectorAll('input[name="modalita_saldo"]');
        saldoRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const altroSection = document.getElementById('saldo-altro-section');
                if (e.target.value === 'altro') {
                    altroSection.style.display = 'block';
                } else {
                    altroSection.style.display = 'none';
                }
            });
        });

        // Event listeners calcoli automatici compenso
        const provvigioneInput = document.getElementById('percentuale_provvigione');
        const sogliaInput = document.getElementById('soglia_minima');
        const importoInput = document.getElementById('importo_minimo');

        if (provvigioneInput) {
            provvigioneInput.addEventListener('input', () => {
                this.updateCondizioniEconomiche();
                this.refreshSezionePrezzoIfNeeded();
            });
        }

        // Event listeners autorizzazioni
        const authCartello = document.getElementById('auth_cartello');
        const authVetrine = document.getElementById('auth_vetrine');
        const authInternet = document.getElementById('auth_internet');
        const authStampa = document.getElementById('auth_stampa');

        [authCartello, authVetrine, authInternet, authStampa].forEach(checkbox => {
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.updateCondizioniEconomiche();
                });
            }
        });

        if (authCartello && authVetrine && authInternet && authStampa) {
            console.log('✅ Event listener autorizzazioni inizializzati');
        }

        // Event listeners diritto di recesso (luogo conferimento)
        const luogoRadios = document.querySelectorAll('input[name="luogo_conferimento"]');
        luogoRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateCondizioniEconomiche();
            });
        });
        if (luogoRadios.length > 0) {
            console.log('✅ Event listener diritto recesso inizializzati');
        }

        // Event listeners osservazioni e firma
        const osservazioniTextarea = document.getElementById('osservazioni_note');
        const luogoFirma = document.getElementById('luogo_firma');
        const dataFirma = document.getElementById('data_firma');

        if (osservazioniTextarea) {
            osservazioniTextarea.addEventListener('input', () => {
                this.updateCondizioniEconomiche();
            });
        }

        if (luogoFirma) {
            luogoFirma.addEventListener('input', () => {
                this.updateCondizioniEconomiche();
            });
        }

        if (dataFirma) {
            dataFirma.addEventListener('change', () => {
                this.updateCondizioniEconomiche();
            });
        }

        if (osservazioniTextarea && luogoFirma && dataFirma) {
            console.log('✅ Event listener osservazioni e firma inizializzati');
        }

        // Auto-compila data firma con data odierna
        if (dataFirma && !dataFirma.value) {
            const today = new Date().toISOString().split('T')[0];
            dataFirma.value = today;
        }

        // Rendering iniziale sezione prezzo
        this.renderSezionePrezzo();

        console.log('✅ Tab Condizioni Economiche inizializzato');
    }

    updateObblighi(isEsclusiva) {
        const header = document.getElementById('obblighi-header');
        const preview = document.getElementById('obblighi-preview');

        if (!preview) return;

        if (isEsclusiva) {
            if (header) header.textContent = '📋 Obblighi dell\'Agenzia - INCARICO IN ESCLUSIVA';
            preview.innerHTML = `
                <p style="margin-bottom: 12px; font-weight: 600;">Con l'accettazione del presente incarico l'Agenzia Immobiliare si obbliga a:</p>
                <ul style="margin-left: 20px; list-style: disc;">
                    <li>visionare e valutare accuratamente l'immobile redigendo scheda estimativa;</li>
                    <li>produrre a propria cura la documentazione edilizia e catastale;</li>
                    <li>impegnare la propria organizzazione per promuovere la vendita, utilizzando gli strumenti ritenuti adeguati dalla stessa;</li>
                    <li>redigere il preventivo imposte, tasse e spese a carico del Venditore;</li>
                    <li>redigere il preventivo imposte, tasse e spese a carico dell'acquirente;</li>
                    <li>accompagnare i potenziali acquirenti a visitare l'immobile;</li>
                    <li>predisporre a richiesta delle parti ogni atto negoziale ritenuto necessario per il perfezionamento dell'affare;</li>
                    <li>effettuare le visure relative all'esistenza d'iscrizioni e/o trascrizioni successive alla data dell'atto di provenienza;</li>
                    <li>non richiedere un prezzo di vendita diverso da quello su indicato, fatto salvo il margine di trattativa stabilito;</li>
                    <li>fornire su semplice richiesta del Venditore informazioni sull'attività effettuata;</li>
                    <li>fornire a entrambe le parti la propria assistenza fino all'atto notarile;</li>
                    <li>comunicare l'avvenuta vendita agli enti per le variazioni di rito;</li>
                    <li>registrare, entro 20 (venti) giorni, la proposta d'acquisto accettata o il preliminare di compravendita, previa consegna in proprie mani di almeno due copie con firme autografe originali e della relativa provvista economica, necessaria per procedere al versamento di quanto dovuto per la registrazione.</li>
                </ul>
            `;
        } else {
            if (header) header.textContent = '📋 Obblighi dell\'Agenzia - INCARICO NON IN ESCLUSIVA';
            preview.innerHTML = `
                <p style="margin-bottom: 12px; font-weight: 600;">Con l'accettazione del presente incarico l'Agenzia Immobiliare si obbliga a:</p>
                <ul style="margin-left: 20px; list-style: disc;">
                    <li>visionare e valutare sinteticamente l'immobile;</li>
                    <li>promuovere la vendita, utilizzando gli strumenti ritenuti adeguati dallo stesso;</li>
                    <li>accompagnare i potenziali acquirenti a visitare l'immobile;</li>
                    <li>predisporre a richiesta ogni atto negoziale tra le parti ritenuto necessario per il perfezionamento dell'affare;</li>
                    <li>effettuare le visure relative all'esistenza d'iscrizioni e/o trascrizioni pregiudizievoli successive alla data dell'atto di provenienza;</li>
                    <li>fornire a entrambe le parti la propria assistenza fino all'atto notarile;</li>
                    <li>non richiedere un prezzo di vendita diverso da quello su indicato, fatto salvo il margine di trattativa stabilito;</li>
                    <li>registrare, entro 20 (venti) giorni, la proposta d'acquisto accettata o il preliminare di compravendita, previa consegna in proprie mani di almeno due copie con firme autografe originali e della relativa provvista economica, necessaria per procedere al versamento di quanto dovuto per la registrazione.</li>
                </ul>
            `;
        }
    }

    handleToggleOffertaUnica() {
        const toggle = document.getElementById('toggle-offerta-unica');
        const isOffertaUnica = toggle.checked;

        this.condizioniEconomiche.modalita_prezzo = isOffertaUnica ? 'offerta_unica' : 'singola';

        console.log(`🔄 Modalità prezzo cambiata: ${this.condizioniEconomiche.modalita_prezzo}`);

        // Re-render sezione prezzo
        this.renderSezionePrezzo();
    }

    renderSezionePrezzo() {
        const container = document.getElementById('sezione-prezzo');
        if (!container) return;

        const isOffertaUnica = this.condizioniEconomiche.modalita_prezzo === 'offerta_unica';

        if (isOffertaUnica) {
            container.innerHTML = this.renderSezionePrezzoForfettaria();
        } else {
            container.innerHTML = this.renderSezionePrezzoSingola();
        }

        // Inizializza event listeners per i campi prezzo
        this.initializePrezzoEventListeners();
    }

    renderSezionePrezzoSingola() {
        let html = '<div class="prezzo-section">';
        html += '<h3>💰 Prezzo di Vendita per Immobile</h3>';

        // Filtra immobili con dati compilati (provincia e comune)
        const immobiliCompilati = this.immobili.filter(imm => imm.provincia && imm.comune);

        if (immobiliCompilati.length === 0) {
            html += '<p style="color: #6c757d; font-style: italic; padding: 20px; text-align: center;">Nessun immobile compilato. Completa almeno un immobile nella tab "Immobile Prima".</p>';
        } else {
            immobiliCompilati.forEach((immobile, index) => {
                const cond = immobile.condizioni_economiche || { prezzo_vendita: 0, percentuale_riduzione: 0 };
                const calcolati = calcolaValoriCondizioni(cond);

                html += `
                    <div class="prezzo-immobile-card">
                        <h4>🏠 Immobile ${index + 1}: ${immobile.comune} (${immobile.provincia})</h4>
                        <div class="condizioni-form">
                            <div class="field-row">
                                <div class="field-group">
                                    <label for="prezzo_vendita_${immobile.id}">Prezzo richiesto €</label>
                                    <input type="text" id="prezzo_vendita_${immobile.id}"
                                           inputmode="numeric"
                                           pattern="[0-9]*"
                                           placeholder="es. 60000"
                                           value="${cond.prezzo_vendita || ''}"
                                           data-immobile-id="${immobile.id}">
                                </div>
                                <div class="field-group">
                                    <label for="percentuale_riduzione_${immobile.id}">Riduzione max %</label>
                                    <input type="number" id="percentuale_riduzione_${immobile.id}"
                                           min="0" max="100" step="0.5"
                                           placeholder="es. 5"
                                           value="${cond.percentuale_riduzione || ''}"
                                           data-immobile-id="${immobile.id}">
                                </div>
                            </div>

                            <div id="output_prezzo_${immobile.id}" class="prezzo-output-container">
                                ${calcolati.prezzo_vendita ? `
                                    <div class="prezzo-info-row">
                                        <span class="prezzo-info-label">Prezzo in lettere:</span>
                                        <span class="prezzo-info-value prezzo-in-lettere">${calcolati.prezzo_vendita_lettere}</span>
                                    </div>
                                ` : ''}

                                ${calcolati.prezzo_minimo ? `
                                    <div class="prezzo-info-row">
                                        <span class="prezzo-info-label">Prezzo minimo (dopo riduzione):</span>
                                        <span class="prezzo-info-value">€ ${calcolati.prezzo_minimo.toLocaleString('it-IT')}</span>
                                    </div>
                                    <div class="prezzo-info-row">
                                        <span class="prezzo-info-label">Prezzo minimo in lettere:</span>
                                        <span class="prezzo-info-value prezzo-in-lettere">${calcolati.prezzo_minimo_lettere}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });

            // Pulsante "Applica a tutti"
            if (immobiliCompilati.length > 1) {
                html += `
                    <div style="text-align: center; margin-top: 20px;">
                        <button type="button" class="btn-applica-tutti" onclick="window.siafApp.applicaCondizioniATutti()">
                            🔄 Applica condizioni Immobile 1 a tutti
                        </button>
                    </div>
                `;
            }
        }

        html += '</div>';
        return html;
    }

    renderSezionePrezzoForfettaria() {
        const cond = this.condizioniEconomiche.prezzo_forfettario;
        const calcolati = calcolaValoriCondizioni({
            prezzo_vendita: cond.prezzo_totale,
            percentuale_riduzione: cond.percentuale_riduzione
        });

        let html = '<div class="prezzo-section">';
        html += '<h3>🏢 Prezzo Unico Gruppo Immobili</h3>';
        html += `
            <div class="prezzo-immobile-card">
                <div class="condizioni-form">
                    <div class="field-row">
                        <div class="field-group">
                            <label for="prezzo_totale_forfettario">Prezzo totale richiesto €</label>
                            <input type="text" id="prezzo_totale_forfettario"
                                   inputmode="numeric"
                                   pattern="[0-9]*"
                                   placeholder="es. 140000"
                                   value="${cond.prezzo_totale || ''}">
                        </div>
                        <div class="field-group">
                            <label for="percentuale_riduzione_forfettaria">Riduzione max %</label>
                            <input type="number" id="percentuale_riduzione_forfettaria"
                                   min="0" max="100" step="0.5"
                                   placeholder="es. 5"
                                   value="${cond.percentuale_riduzione || ''}">
                        </div>
                    </div>

                    <div id="output_prezzo_forfettario" class="prezzo-output-container">
                        ${calcolati.prezzo_vendita ? `
                            <div class="prezzo-info-row">
                                <span class="prezzo-info-label">Prezzo in lettere:</span>
                                <span class="prezzo-info-value prezzo-in-lettere">${calcolati.prezzo_vendita_lettere}</span>
                            </div>
                        ` : ''}

                        ${calcolati.prezzo_minimo ? `
                            <div class="prezzo-info-row">
                                <span class="prezzo-info-label">Prezzo minimo (dopo riduzione):</span>
                                <span class="prezzo-info-value">€ ${calcolati.prezzo_minimo.toLocaleString('it-IT')}</span>
                            </div>
                            <div class="prezzo-info-row">
                                <span class="prezzo-info-label">Prezzo minimo in lettere:</span>
                                <span class="prezzo-info-value prezzo-in-lettere">${calcolati.prezzo_minimo_lettere}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        html += '</div>';
        return html;
    }

    initializePrezzoEventListeners() {
        const isOffertaUnica = this.condizioniEconomiche.modalita_prezzo === 'offerta_unica';

        if (isOffertaUnica) {
            // Event listeners per prezzo forfettario
            const prezzoInput = document.getElementById('prezzo_totale_forfettario');
            const riduzioneInput = document.getElementById('percentuale_riduzione_forfettaria');

            if (prezzoInput) {
                prezzoInput.addEventListener('input', () => {
                    this.updatePrezzoForfettario();
                });
            }

            if (riduzioneInput) {
                riduzioneInput.addEventListener('input', () => {
                    this.updatePrezzoForfettario();
                });
            }
        } else {
            // Event listeners per prezzo singolo
            this.immobili.forEach(immobile => {
                const prezzoInput = document.getElementById(`prezzo_vendita_${immobile.id}`);
                const riduzioneInput = document.getElementById(`percentuale_riduzione_${immobile.id}`);

                if (prezzoInput) {
                    prezzoInput.addEventListener('input', (e) => {
                        this.updatePrezzoSingolo(immobile.id);
                    });
                }

                if (riduzioneInput) {
                    riduzioneInput.addEventListener('input', (e) => {
                        this.updatePrezzoSingolo(immobile.id);
                    });
                }
            });
        }
    }

    updatePrezzoSingolo(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (!immobile) return;

        const prezzoInput = document.getElementById(`prezzo_vendita_${immobileId}`);
        const riduzioneInput = document.getElementById(`percentuale_riduzione_${immobileId}`);

        if (!immobile.condizioni_economiche) {
            immobile.condizioni_economiche = { prezzo_vendita: 0, percentuale_riduzione: 0 };
        }

        immobile.condizioni_economiche.prezzo_vendita = parseFloat(prezzoInput.value) || 0;
        immobile.condizioni_economiche.percentuale_riduzione = parseFloat(riduzioneInput.value) || 0;

        this.isDirty = true;

        // Aggiorna solo i campi di output senza ri-renderizzare tutto
        this.updatePrezzoOutputSingolo(immobileId);
    }

    updatePrezzoOutputSingolo(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (!immobile || !immobile.condizioni_economiche) return;

        const outputContainer = document.getElementById(`output_prezzo_${immobileId}`);
        if (!outputContainer) return;

        const calcolati = calcolaValoriCondizioni(immobile.condizioni_economiche);

        let html = '';
        if (calcolati.prezzo_vendita) {
            html += `
                <div class="prezzo-info-row">
                    <span class="prezzo-info-label">Prezzo in lettere:</span>
                    <span class="prezzo-info-value prezzo-in-lettere">${calcolati.prezzo_vendita_lettere}</span>
                </div>
            `;
        }

        if (calcolati.prezzo_minimo) {
            html += `
                <div class="prezzo-info-row">
                    <span class="prezzo-info-label">Prezzo minimo (dopo riduzione):</span>
                    <span class="prezzo-info-value">€ ${calcolati.prezzo_minimo.toLocaleString('it-IT')}</span>
                </div>
                <div class="prezzo-info-row">
                    <span class="prezzo-info-label">Prezzo minimo in lettere:</span>
                    <span class="prezzo-info-value prezzo-in-lettere">${calcolati.prezzo_minimo_lettere}</span>
                </div>
            `;
        }

        outputContainer.innerHTML = html;
    }

    updatePrezzoForfettario() {
        const prezzoInput = document.getElementById('prezzo_totale_forfettario');
        const riduzioneInput = document.getElementById('percentuale_riduzione_forfettaria');

        this.condizioniEconomiche.prezzo_forfettario.prezzo_totale = parseFloat(prezzoInput.value) || 0;
        this.condizioniEconomiche.prezzo_forfettario.percentuale_riduzione = parseFloat(riduzioneInput.value) || 0;

        this.isDirty = true;

        // Aggiorna solo i campi di output senza ri-renderizzare tutto
        this.updatePrezzoOutputForfettario();
    }

    updatePrezzoOutputForfettario() {
        const outputContainer = document.getElementById('output_prezzo_forfettario');
        if (!outputContainer) return;

        const calcolati = calcolaValoriCondizioni(this.condizioniEconomiche.prezzo_forfettario);

        let html = '';
        if (calcolati.prezzo_vendita) {
            html += `
                <div class="prezzo-info-row">
                    <span class="prezzo-info-label">Prezzo in lettere:</span>
                    <span class="prezzo-info-value prezzo-in-lettere">${calcolati.prezzo_vendita_lettere}</span>
                </div>
            `;
        }

        if (calcolati.prezzo_minimo) {
            html += `
                <div class="prezzo-info-row">
                    <span class="prezzo-info-label">Prezzo minimo (dopo riduzione):</span>
                    <span class="prezzo-info-value">€ ${calcolati.prezzo_minimo.toLocaleString('it-IT')}</span>
                </div>
                <div class="prezzo-info-row">
                    <span class="prezzo-info-label">Prezzo minimo in lettere:</span>
                    <span class="prezzo-info-value prezzo-in-lettere">${calcolati.prezzo_minimo_lettere}</span>
                </div>
            `;
        }

        outputContainer.innerHTML = html;
    }

    applicaCondizioniATutti() {
        const immobiliCompilati = this.immobili.filter(imm => imm.provincia && imm.comune);
        if (immobiliCompilati.length === 0) return;

        const primoImmobile = immobiliCompilati[0];
        const condizioniDaCopiare = primoImmobile.condizioni_economiche || { prezzo_vendita: 0, percentuale_riduzione: 0 };

        immobiliCompilati.forEach((immobile, index) => {
            if (index > 0) { // Salta il primo
                immobile.condizioni_economiche = {
                    prezzo_vendita: condizioniDaCopiare.prezzo_vendita,
                    percentuale_riduzione: condizioniDaCopiare.percentuale_riduzione
                };
            }
        });

        this.isDirty = true;

        // Re-render
        this.renderSezionePrezzo();

        console.log('✅ Condizioni applicate a tutti gli immobili');
        alert('✅ Condizioni economiche del primo immobile applicate a tutti!');
    }

    updateCondizioniEconomiche() {
        const provvigione = document.getElementById('percentuale_provvigione');
        const soglia = document.getElementById('soglia_minima');
        const importo = document.getElementById('importo_minimo');
        const dataInizio = document.getElementById('data_inizio_incarico');
        const dataFine = document.getElementById('data_fine_incarico');
        const giorniPreavviso = document.getElementById('giorni_preavviso');
        const esclusivaTipo = document.querySelector('input[name="esclusiva_tipo"]:checked');
        const esclusivaTesto = document.getElementById('esclusiva_testo');
        const speseMassime = document.getElementById('spese_massime');

        if (provvigione) {
            this.condizioniEconomiche.compenso.percentuale_provvigione = parseFloat(provvigione.value) || 3;
        }

        if (soglia) {
            this.condizioniEconomiche.compenso.soglia_minima = parseFloat(soglia.value) || 50000;
        }

        if (importo) {
            this.condizioniEconomiche.compenso.importo_minimo = parseFloat(importo.value) || 1500;
        }

        if (dataInizio) {
            this.condizioniEconomiche.durata.data_inizio = dataInizio.value;
        }

        if (dataFine) {
            this.condizioniEconomiche.durata.data_fine = dataFine.value;
        }

        const tipoRinnovo = document.querySelector('input[name="tipo_rinnovo"]:checked');
        if (tipoRinnovo) {
            this.condizioniEconomiche.durata.tipo_rinnovo = tipoRinnovo.value;
        }

        if (giorniPreavviso) {
            this.condizioniEconomiche.durata.giorni_preavviso = parseInt(giorniPreavviso.value) || 5;
        }

        // Salva tipo esclusiva (da radio button)
        if (esclusivaTipo) {
            this.condizioniEconomiche.esclusiva.attiva = (esclusivaTipo.value === 'esclusiva');
        }

        // Salva testo custom esclusiva
        if (esclusivaTesto) {
            this.condizioniEconomiche.esclusiva.testo_custom = esclusivaTesto.value;
        }

        // Salva spese massime (NON esclusiva)
        if (speseMassime) {
            this.condizioniEconomiche.esclusiva.spese_massime = parseFloat(speseMassime.value) || 0;
        }

        // Salva autorizzazioni
        const authCartello = document.getElementById('auth_cartello');
        const authVetrine = document.getElementById('auth_vetrine');
        const authInternet = document.getElementById('auth_internet');
        const authStampa = document.getElementById('auth_stampa');

        if (authCartello) this.condizioniEconomiche.autorizzazioni.cartello_vendita = authCartello.checked;
        if (authVetrine) this.condizioniEconomiche.autorizzazioni.vetrine = authVetrine.checked;
        if (authInternet) this.condizioniEconomiche.autorizzazioni.internet = authInternet.checked;
        if (authStampa) this.condizioniEconomiche.autorizzazioni.stampa = authStampa.checked;

        // Condizioni di pagamento
        const giorniVersamento = document.getElementById('giorni_versamento');
        const percAnticipo = document.getElementById('percentuale_anticipo');
        const modalitaSaldo = document.querySelector('input[name="modalita_saldo"]:checked');
        const saldoAltroTesto = document.getElementById('saldo_altro_testo');
        const giorniStipula = document.getElementById('giorni_stipula_atto');

        if (giorniVersamento) {
            this.condizioniEconomiche.condizioni_pagamento.giorni_versamento = parseInt(giorniVersamento.value) || 15;
        }

        if (percAnticipo) {
            this.condizioniEconomiche.condizioni_pagamento.percentuale_anticipo = parseFloat(percAnticipo.value) || 10;
        }

        if (modalitaSaldo) {
            this.condizioniEconomiche.condizioni_pagamento.modalita_saldo = modalitaSaldo.value;
        }

        if (saldoAltroTesto) {
            this.condizioniEconomiche.condizioni_pagamento.saldo_altro_testo = saldoAltroTesto.value;
        }

        if (giorniStipula) {
            this.condizioniEconomiche.condizioni_pagamento.giorni_stipula_atto = parseInt(giorniStipula.value) || 150;
        }

        // Diritto di recesso (luogo conferimento)
        const luogoConferimento = document.querySelector('input[name="luogo_conferimento"]:checked');
        if (luogoConferimento) {
            this.condizioniEconomiche.diritto_recesso.luogo_conferimento = luogoConferimento.value;
        }

        // Osservazioni e note
        const osservazioni = document.getElementById('osservazioni_note');
        if (osservazioni) {
            this.condizioniEconomiche.osservazioni = osservazioni.value;
        }

        // Data e luogo firma
        const luogoFirma = document.getElementById('luogo_firma');
        const dataFirma = document.getElementById('data_firma');

        if (luogoFirma) {
            this.condizioniEconomiche.firma.luogo = luogoFirma.value;
        }

        if (dataFirma) {
            this.condizioniEconomiche.firma.data = dataFirma.value;
        }

        this.isDirty = true;
    }

    refreshSezionePrezzoIfNeeded() {
        // Se siamo nella tab condizioni, re-render per aggiornare calcoli provvigione
        if (this.currentTab === 'condizioni') {
            this.renderSezionePrezzo();
        }
    }

    addImmobile() {
        console.log('🏠 Aggiungendo immobile...');

        const immobile = {
            id: ++this.immobileCounter,
            provincia: 'Rovigo',
            comune: 'Bergantino',
            via: '',
            numero: '',
            intestatari: [{ nome: '', cognome: '' }],
            blocchiCatastali: [],  // Inizialmente vuoto - l'utente sceglierà il tipo
            confini: {
                nord: [''],
                est: [''],
                sud: [''],
                ovest: ['']
            },
            stato: {
                occupazione: '',
                locazione: {
                    inquilino: '',
                    canone_annuo: '',
                    scadenza_contratto: ''
                },
                conformita: {
                    edilizia: false,
                    catastale: false,
                    impianti: false
                },
                vincoli: {
                    iscrizioni_pregiudizievoli: false,
                    vincoli_servitu: false
                },
                certificazione_energetica: {
                    modalita: '',
                    classe: '',
                    consumo_kwh: '',
                    codice_attestato: '',
                    data_emissione: '',
                    certificatore: ''
                },
                documenti_consegnati: []
            },
            condizioni_economiche: {
                prezzo_vendita: 0,
                percentuale_riduzione: 0
            }
        };

        this.immobili.push(immobile);
        console.log(`✅ Immobile ${immobile.id} aggiunto. Totale immobili:`, this.immobili.length);

        this.renderImmobile(immobile);
        this.updateTabProgress();

        // Se siamo nella tab condizioni, aggiorna la sezione prezzo
        if (this.currentTab === 'condizioni') {
            setTimeout(() => {
                this.renderSezionePrezzo();
                console.log('🔄 Sezione prezzo aggiornata dopo aggiunta immobile');
            }, 100);
        }

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
                            <input type="text" id="immobile_${immobile.id}_via" value="${immobile.via || ''}"
                                   onchange="window.siafApp.updateImmobileField(${immobile.id}, 'via', this.value)">
                        </div>
                        <div class="field-group">
                            <label for="immobile_${immobile.id}_numero">Numero</label>
                            <input type="text" id="immobile_${immobile.id}_numero" value="${immobile.numero || ''}"
                                   onchange="window.siafApp.updateImmobileField(${immobile.id}, 'numero', this.value)">
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

                <!-- STATO IMMOBILE -->
                <div class="stato-immobile-section">
                    <h4>🏠 Stato Immobile</h4>
                    ${this.renderStatoImmobile(immobile)}
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', immobileHtml);

        // Inizializza dropdown provincia e comune
        setTimeout(() => {
            this.populateProvinciaDropdown(immobile.id, immobile.provincia);
            if (immobile.provincia && immobile.comune) {
                setTimeout(() => {
                    this.populateComuniDropdown(immobile.id, immobile.provincia, immobile.comune);
                }, 200);
            }

            // Inizializza event listeners per stato immobile
            this.initializeStatoEventListeners(immobile.id);
        }, 100);

        console.log(`✅ Immobile ${immobile.id} renderizzato`);
    }

    renderIntestatari(immobile) {
        return immobile.intestatari.map((intestatario, index) => `
            <div class="intestatario-row">
                <input type="text" class="intestatario-input"
                       id="intestatario_nome_${immobile.id}_${index}"
                       value="${intestatario.nome || ''}"
                       placeholder="Nome"
                       onchange="window.siafApp.updateIntestatario(${immobile.id}, ${index}, 'nome', this.value)">
                <input type="text" class="intestatario-input"
                       id="intestatario_cognome_${immobile.id}_${index}"
                       value="${intestatario.cognome || ''}"
                       placeholder="Cognome"
                       onchange="window.siafApp.updateIntestatario(${immobile.id}, ${index}, 'cognome', this.value)">
                ${immobile.intestatari.length > 1 ?
                    `<button type="button" class="btn-remove-mappale" onclick="window.siafApp.removeIntestatario(${immobile.id}, ${index})">❌</button>` :
                    ''}
            </div>
        `).join('');
    }

    renderBlocchiCatastali(immobile) {
        // Se non ci sono blocchi, mostra pulsanti di selezione tipo
        if (immobile.blocchiCatastali.length === 0) {
            return `
                <div class="tipo-selection-chips">
                    <button type="button" class="chip-button" onclick="window.siafApp.addFirstBloccoCatastale(${immobile.id}, 'fabbricati')">
                        🏢 Fabbricati
                    </button>
                    <button type="button" class="chip-button" onclick="window.siafApp.addFirstBloccoCatastale(${immobile.id}, 'terreni')">
                        🌾 Terreni
                    </button>
                </div>
            `;
        }

        // Altrimenti renderizza i blocchi normali + pulsanti aggiungi blocco
        const blocchiHtml = immobile.blocchiCatastali.map(blocco => `
            <div id="blocco-${immobile.id}-${blocco.id}" class="blocco-catastale">
                <div class="blocco-header">
                    <h4>📊 Blocco Catastale ${blocco.id}</h4>
                    <button type="button" class="btn-remove-block" onclick="window.siafApp.removeBloccoCatastale(${immobile.id}, ${blocco.id})">❌ Rimuovi Blocco</button>
                </div>

                <!-- Nota/Descrizione con pulsante -->
                <div class="nota-section">
                    <button type="button" class="btn-nota" onclick="window.siafApp.toggleNotaDropdown(${immobile.id}, ${blocco.id})">
                        📝 Aggiungi nota
                    </button>
                    <div id="nota-dropdown-${immobile.id}-${blocco.id}" class="nota-dropdown" style="display: none;">
                        ${this.renderNotaDropdown(immobile.id, blocco.id, blocco.descrizione, blocco.descrizioneCustom)}
                    </div>
                </div>

                <!-- Righe Catastali -->
                <div id="righe-${immobile.id}-${blocco.id}">
                    ${this.renderRigheCatastali(immobile.id, blocco)}
                </div>

                <button type="button" class="btn-add-catasto-row" onclick="window.siafApp.addRigaCatastale(${immobile.id}, ${blocco.id})">➕ Aggiungi Riga</button>
            </div>
        `).join('');

        // Aggiungi i pulsanti per aggiungere altri blocchi alla fine
        const addButtonsHtml = `
            <div class="add-blocco-buttons">
                <button type="button" class="btn-add-blocco-tipo" onclick="window.siafApp.addBloccoCatastale(${immobile.id}, 'fabbricati')">
                    🏢 Aggiungi blocco fabbricati
                </button>
                <button type="button" class="btn-add-blocco-tipo" onclick="window.siafApp.addBloccoCatastale(${immobile.id}, 'terreni')">
                    🌾 Aggiungi blocco terreni
                </button>
            </div>
        `;

        return blocchiHtml + addButtonsHtml;
    }

    renderNotaDropdown(immobileId, bloccoId, selectedValue, customText) {
        const options = [
            { value: '', text: '-- Nessuna nota --' },
            { value: 'area_sedime', text: "l'area di sedime di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'area_cortiliva', text: "l'area cortiliva di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'parte_area_sedime', text: "parte dell'area di sedime di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'parte_area_cortiliva', text: "parte dell'area cortiliva di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'area_sedime_e_cortiliva', text: "l'area di sedime e parte dell'area cortiliva di pertinenza è distinta nel catasto dei terreni al" },
            { value: 'custom', text: 'Inserisci testo manualmente' }
        ];

        return `
            <select class="nota-select" id="nota-${immobileId}-${bloccoId}"
                    onchange="window.siafApp.handleNotaChange(${immobileId}, ${bloccoId})">
                ${options.map(opt => `<option value="${opt.value}" ${opt.value === selectedValue ? 'selected' : ''}>${opt.text}</option>`).join('')}
            </select>
            <textarea class="nota-custom" id="nota-custom-${immobileId}-${bloccoId}"
                      placeholder="Inserisci nota personalizzata"
                      onchange="window.siafApp.handleNotaCustomChange(${immobileId}, ${bloccoId})"
                      style="${selectedValue === 'custom' ? 'display: block;' : 'display: none;'}">${customText || ''}</textarea>
        `;
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
                <div><label>Fog.</label><input type="text" id="foglio_${immobileId}_${bloccoId}_${riga.id}" value="${riga.foglio || ''}" placeholder="8"></div>
                <div><label>Map.</label><input type="text" id="mappale_${immobileId}_${bloccoId}_${riga.id}" value="${riga.mappale || ''}" placeholder="1335"></div>
                <div><label>Sub.</label><input type="text" id="subalterno_${immobileId}_${bloccoId}_${riga.id}" value="${riga.subalterno || ''}" placeholder="-"></div>
                <div><label>Categoria</label><input type="text" id="categoria_${immobileId}_${bloccoId}_${riga.id}" value="${riga.categoria || ''}" placeholder="A/3"></div>
                <div><label>Classe</label><input type="text" id="classe_${immobileId}_${bloccoId}_${riga.id}" value="${riga.classe || ''}" placeholder="1"></div>
                <div><label>Vani/mq</label><input type="text" id="vani_mq_${immobileId}_${bloccoId}_${riga.id}" value="${riga.vani_mq || ''}" placeholder="5,5"></div>
                <div><label>Superfici</label><input type="text" id="superfici_${immobileId}_${bloccoId}_${riga.id}" value="${riga.superfici || ''}" placeholder="128"></div>
                <div><label>Indirizzo/Piano</label><input type="text" id="indirizzo_piano_${immobileId}_${bloccoId}_${riga.id}" value="${riga.indirizzo_piano || ''}" placeholder="pt-1"></div>
                <div><label>Rendita</label><input type="text" id="rendita_${immobileId}_${bloccoId}_${riga.id}" value="${riga.rendita || ''}" placeholder="298,25"></div>
            </div>
        `;
    }

    renderRigaTerreni(immobileId, bloccoId, riga) {
        return `
            <div class="catasto-fields">
                <div><label>Fog.</label><input type="text" id="foglio_${immobileId}_${bloccoId}_${riga.id}" value="${riga.foglio || ''}" placeholder="8"></div>
                <div><label>Map.</label><input type="text" id="mappale_${immobileId}_${bloccoId}_${riga.id}" value="${riga.mappale || ''}" placeholder="1335"></div>
                <div><label>Porz.</label><input type="text" id="porzione_${immobileId}_${bloccoId}_${riga.id}" value="${riga.porzione || ''}" placeholder="-"></div>
                <div><label>Qualità</label><input type="text" id="qualita_${immobileId}_${bloccoId}_${riga.id}" value="${riga.qualita || ''}" placeholder="ente urbano"></div>
                <div><label>Classe</label><input type="text" id="classe_${immobileId}_${bloccoId}_${riga.id}" value="${riga.classe || ''}" placeholder="1"></div>
                <div><label>Mq</label><input type="text" id="metri_quadrati_${immobileId}_${bloccoId}_${riga.id}" value="${riga.metri_quadrati || ''}" placeholder="745"></div>
                <div><label>Dominicale</label><input type="text" id="dominicale_${immobileId}_${bloccoId}_${riga.id}" value="${riga.dominicale || ''}" placeholder="0,62"></div>
                <div><label>Agrario</label><input type="text" id="agrario_${immobileId}_${bloccoId}_${riga.id}" value="${riga.agrario || ''}" placeholder="0,34"></div>
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

    // BLOCCO: Render Stato Immobile - Design Moderno
    renderStatoImmobile(immobile) {
        const stato = immobile.stato || {};
        const id = immobile.id;

        return `
            <div class="stato-form">
                <!-- OCCUPAZIONE -->
                <div class="form-group">
                    <label>Occupazione:</label>
                    <div class="radio-group">
                        <input type="radio" name="occupazione_${id}" id="occ_libero_${id}" value="libero" ${stato.occupazione === 'libero' ? 'checked' : ''}>
                        <label for="occ_libero_${id}" class="stato-success">Libero</label>

                        <input type="radio" name="occupazione_${id}" id="occ_proprietario_${id}" value="occupato_proprietario" ${stato.occupazione === 'occupato_proprietario' ? 'checked' : ''}>
                        <label for="occ_proprietario_${id}" class="stato-success">Utilizzato dal proprietario</label>

                        <input type="radio" name="occupazione_${id}" id="occ_locato_${id}" value="locato" ${stato.occupazione === 'locato' ? 'checked' : ''}>
                        <label for="occ_locato_${id}" class="stato-neutral">Locato a uso abitativo</label>
                    </div>

                    <!-- Campi condizionali locazione -->
                    <div id="locazione-fields-${id}" class="conditional-fields" style="display: ${stato.occupazione === 'locato' ? 'block' : 'none'}">
                        <div class="conditional-fields-grid">
                            <div>
                                <label>Nome inquilino</label>
                                <input type="text" id="inquilino_${id}" placeholder="es. Mario Rossi" value="${stato.locazione?.inquilino || ''}">
                            </div>
                            <div>
                                <label>Canone annuo €</label>
                                <input type="number" id="canone_${id}" placeholder="es. 6000" value="${stato.locazione?.canone_annuo || ''}">
                            </div>
                            <div>
                                <label>Scadenza contratto</label>
                                <input type="date" id="scadenza_${id}" value="${stato.locazione?.scadenza_contratto || ''}">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONFORMITÀ (3 elementi in riga) -->
                <div class="form-group">
                    <label>Conformità:</label>
                    <div class="checkbox-group checkbox-group-3">
                        <input type="checkbox" id="conf_edilizia_${id}" ${stato.conformita?.edilizia ? 'checked' : ''}>
                        <label for="conf_edilizia_${id}" class="stato-success">Conforme norme edilizie/urbanistiche</label>

                        <input type="checkbox" id="conf_catastale_${id}" ${stato.conformita?.catastale ? 'checked' : ''}>
                        <label for="conf_catastale_${id}" class="stato-success">Conforme norme catastali</label>

                        <input type="checkbox" id="conf_impianti_${id}" ${stato.conformita?.impianti ? 'checked' : ''}>
                        <label for="conf_impianti_${id}" class="stato-success">Impianti conformi normative</label>
                    </div>
                </div>

                <!-- VINCOLI (2 elementi in riga) -->
                <div class="form-group">
                    <label>Vincoli:</label>
                    <div class="checkbox-group checkbox-group-3">
                        <input type="checkbox" id="iscriz_preg_${id}" ${stato.vincoli?.iscrizioni_pregiudizievoli ? 'checked' : ''}>
                        <label for="iscriz_preg_${id}" class="stato-danger">Iscrizioni/trascrizioni pregiudizievoli</label>

                        <input type="checkbox" id="vincoli_serv_${id}" ${stato.vincoli?.vincoli_servitu ? 'checked' : ''}>
                        <label for="vincoli_serv_${id}" class="stato-danger">Vincoli e/o servitù attive/passive</label>
                    </div>
                </div>

                <!-- CERTIFICAZIONE ENERGETICA (4 pulsanti) -->
                <div class="form-group">
                    <label>Certificazione Energetica:</label>
                    <div class="radio-group">
                        <input type="radio" name="cert_modalita_${id}" id="cert_predisporre_${id}" value="da_predisporre" ${stato.certificazione_energetica?.modalita === 'da_predisporre' ? 'checked' : ''}>
                        <label for="cert_predisporre_${id}" class="stato-warning">Da predisporre<br><small>(cura venditore)</small></label>

                        <input type="radio" name="cert_modalita_${id}" id="cert_commissionata_${id}" value="commissionata" ${stato.certificazione_energetica?.modalita === 'commissionata' ? 'checked' : ''}>
                        <label for="cert_commissionata_${id}" class="stato-success">Commissionata all'Agenzia</label>

                        <input type="radio" name="cert_modalita_${id}" id="cert_non_soggetto_${id}" value="non_soggetto" ${stato.certificazione_energetica?.modalita === 'non_soggetto' ? 'checked' : ''}>
                        <label for="cert_non_soggetto_${id}" class="stato-success">Non soggetto</label>

                        <input type="radio" name="cert_modalita_${id}" id="cert_presente_${id}" value="gia_presente" ${stato.certificazione_energetica?.modalita === 'gia_presente' ? 'checked' : ''}>
                        <label for="cert_presente_${id}" class="stato-success">Già presente</label>
                    </div>

                    <!-- Campi condizionali certificazione -->
                    <div id="cert-fields-${id}" class="conditional-fields" style="display: ${stato.certificazione_energetica?.modalita === 'gia_presente' ? 'block' : 'none'}">
                        <div>
                            <label>Classe energetica</label>
                            <div class="dual-input-container">
                                <select id="cert_classe_select_${id}">
                                    <option value="">Seleziona...</option>
                                    ${['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].map(classe =>
                                        `<option value="${classe}" ${stato.certificazione_energetica?.classe === classe ? 'selected' : ''}>${classe}</option>`
                                    ).join('')}
                                </select>
                                <span class="dual-input-separator">oppure</span>
                                <input type="text" id="cert_classe_text_${id}" placeholder="Classe personalizzata" value="${stato.certificazione_energetica?.classe && !['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(stato.certificazione_energetica.classe) ? stato.certificazione_energetica.classe : ''}">
                            </div>
                        </div>

                        <div class="conditional-fields-grid">
                            <div>
                                <label>Consumo kWh/mq anno</label>
                                <input type="number" id="cert_consumo_${id}" placeholder="es. 120" value="${stato.certificazione_energetica?.consumo_kwh || ''}">
                            </div>
                            <div>
                                <label>Codice attestato</label>
                                <input type="text" id="cert_codice_${id}" placeholder="es. ABC123XYZ" value="${stato.certificazione_energetica?.codice_attestato || ''}">
                            </div>
                        </div>

                        <div class="conditional-fields-grid">
                            <div>
                                <label>Data emissione</label>
                                <input type="date" id="cert_data_${id}" value="${stato.certificazione_energetica?.data_emissione || ''}">
                            </div>
                            <div>
                                <label>Certificatore</label>
                                <input type="text" id="cert_certificatore_${id}" placeholder="es. Ing. Mario Rossi" value="${stato.certificazione_energetica?.certificatore || ''}">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- DOCUMENTI CONSEGNATI (4 checkbox + altro) -->
                <div class="form-group">
                    <label>Documenti consegnati:</label>
                    <div class="checkbox-group">
                        <input type="checkbox" id="doc_titoli_${id}" ${stato.documenti_consegnati?.includes('titoli_provenienza') ? 'checked' : ''}>
                        <label for="doc_titoli_${id}" class="stato-success">Copia titoli di provenienza</label>

                        <input type="checkbox" id="doc_planimetria_${id}" ${stato.documenti_consegnati?.includes('planimetria') ? 'checked' : ''}>
                        <label for="doc_planimetria_${id}" class="stato-success">Planimetria catastale</label>

                        <input type="checkbox" id="doc_visure_${id}" ${stato.documenti_consegnati?.includes('visure') ? 'checked' : ''}>
                        <label for="doc_visure_${id}" class="stato-success">Visure catastali</label>

                        <input type="checkbox" id="doc_ape_${id}" ${stato.documenti_consegnati?.includes('ape') ? 'checked' : ''}>
                        <label for="doc_ape_${id}" class="stato-success">APE (Attestato Prestazione Energetica)</label>
                    </div>

                    <div style="margin-top: 12px;">
                        <label>Altro:</label>
                        <textarea id="doc_altro_${id}" placeholder="Altri documenti consegnati..." rows="2">${stato.documenti_consegnati?.find(d => d.startsWith('altro:'))?.substring(6) || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    // BLOCCO: Inizializzazione Event Listeners Stato Immobile
    initializeStatoEventListeners(immobileId) {
        // Event listener per mostrare/nascondere campi locazione
        const occupazioneRadios = document.querySelectorAll(`input[name="occupazione_${immobileId}"]`);
        const locazioneFields = document.getElementById(`locazione-fields-${immobileId}`);

        if (occupazioneRadios && locazioneFields) {
            occupazioneRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.value === 'locato') {
                        locazioneFields.style.display = 'block';
                    } else {
                        locazioneFields.style.display = 'none';
                    }
                });
            });
            console.log(`✅ Event listeners occupazione inizializzati per immobile ${immobileId}`);
        }

        // Event listener per mostrare/nascondere campi certificazione energetica
        const certRadios = document.querySelectorAll(`input[name="cert_modalita_${immobileId}"]`);
        const certFields = document.getElementById(`cert-fields-${immobileId}`);

        if (certRadios && certFields) {
            certRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.value === 'gia_presente') {
                        certFields.style.display = 'block';
                    } else {
                        certFields.style.display = 'none';
                    }
                });
            });
            console.log(`✅ Event listeners certificazione inizializzati per immobile ${immobileId}`);
        }
    }

    // Funzioni di gestione eventi

    addIntestatario(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile) {
            const newIntestatario = { nome: '', cognome: '' };
            immobile.intestatari.push(newIntestatario);

            // Aggiungi solo il nuovo intestatario senza refresh completo
            this.appendNewIntestatario(immobileId, newIntestatario, immobile.intestatari.length - 1);
            this.isDirty = true;

            console.log(`✅ Aggiunto intestatario per immobile ${immobileId}`);
        }
    }

    appendNewIntestatario(immobileId, intestatario, index) {
        const container = document.getElementById(`intestatari-${immobileId}`);
        if (container) {
            const intestatarioHtml = this.renderSingleIntestatario(immobileId, intestatario, index, true);
            container.insertAdjacentHTML('beforeend', intestatarioHtml);
        }
    }

    renderSingleIntestatario(immobileId, intestatario, index, showRemoveButton = false) {
        return `
            <div class="intestatario-row">
                <input type="text" class="intestatario-input"
                       id="intestatario_nome_${immobileId}_${index}"
                       value="${intestatario.nome || ''}"
                       placeholder="Nome"
                       onchange="window.siafApp.updateIntestatario(${immobileId}, ${index}, 'nome', this.value)">
                <input type="text" class="intestatario-input"
                       id="intestatario_cognome_${immobileId}_${index}"
                       value="${intestatario.cognome || ''}"
                       placeholder="Cognome"
                       onchange="window.siafApp.updateIntestatario(${immobileId}, ${index}, 'cognome', this.value)">
                ${showRemoveButton ?
                    `<button type="button" class="btn-remove-mappale" onclick="window.siafApp.removeIntestatario(${immobileId}, ${index})">❌</button>` :
                    ''}
            </div>
        `;
    }

    saveAllIntestatariData(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (!immobile) return;

        // Salva TUTTI i campi intestatari visibili attualmente
        const container = document.getElementById(`intestatari-${immobileId}`);
        if (!container) return;

        const nomeInputs = container.querySelectorAll('input[id*="intestatario_nome_"]');
        const cognomeInputs = container.querySelectorAll('input[id*="intestatario_cognome_"]');

        nomeInputs.forEach((input, index) => {
            if (immobile.intestatari[index]) {
                immobile.intestatari[index].nome = input.value || '';
            }
        });

        cognomeInputs.forEach((input, index) => {
            if (immobile.intestatari[index]) {
                immobile.intestatari[index].cognome = input.value || '';
            }
        });

        console.log(`💾 Salvati ${nomeInputs.length} intestatari per immobile ${immobileId}`);
    }

    updateIntestatario(immobileId, index, field, value) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile && immobile.intestatari[index]) {
            immobile.intestatari[index][field] = value;
            this.isDirty = true;
            console.log(`📝 Aggiornato intestatario ${index}: ${field} = ${value}`);
        }
    }

    updateImmobileField(immobileId, field, value) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile) {
            immobile[field] = value;
            this.isDirty = true;
            console.log(`📝 Aggiornato immobile ${immobileId}: ${field} = ${value}`);
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
            // Salva i dati attuali prima del re-rendering
            this.saveIntestatariData(immobileId);
            container.innerHTML = this.renderIntestatari(immobile);
        }
    }

    saveIntestatariData(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (!immobile) return;

        immobile.intestatari.forEach((intestatario, index) => {
            const nomeField = document.getElementById(`intestatario_nome_${immobileId}_${index}`);
            const cognomeField = document.getElementById(`intestatario_cognome_${immobileId}_${index}`);

            if (nomeField) {
                intestatario.nome = nomeField.value || '';
            }
            if (cognomeField) {
                intestatario.cognome = cognomeField.value || '';
            }
        });

        console.log(`💾 Salvati dati intestatari immobile ${immobileId}`);
    }

    addFirstBloccoCatastale(immobileId, tipo) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile && immobile.blocchiCatastali.length === 0) {
            const newBlocco = {
                id: 1,
                descrizione: '',
                descrizioneCustom: '',
                tipoCatasto: tipo,
                righe: [tipo === 'fabbricati' ? this.createEmptyFabbricatoRow() : this.createEmptyTerrenoRow()]
            };
            immobile.blocchiCatastali.push(newBlocco);

            // Re-renderizza i blocchi (da chip a blocco vero)
            this.refreshBlocchiCatastali(immobileId);
            this.isDirty = true;

            console.log(`✅ Creato primo blocco catastale ${tipo} per immobile ${immobileId}`);
        }
    }

    toggleNotaDropdown(immobileId, bloccoId) {
        const dropdown = document.getElementById(`nota-dropdown-${immobileId}-${bloccoId}`);
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    }

    handleNotaChange(immobileId, bloccoId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);

        if (blocco) {
            const select = document.getElementById(`nota-${immobileId}-${bloccoId}`);
            const customTextarea = document.getElementById(`nota-custom-${immobileId}-${bloccoId}`);

            if (select) {
                blocco.descrizione = select.value;

                // Mostra/nascondi textarea custom
                if (customTextarea) {
                    customTextarea.style.display = select.value === 'custom' ? 'block' : 'none';
                    if (select.value === 'custom') {
                        blocco.descrizioneCustom = customTextarea.value;
                    } else {
                        blocco.descrizioneCustom = '';
                    }
                }

                this.isDirty = true;
                console.log(`📝 Nota aggiornata per blocco ${bloccoId}: ${blocco.descrizione}`);
            }
        }
    }

    handleNotaCustomChange(immobileId, bloccoId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);

        if (blocco) {
            const customTextarea = document.getElementById(`nota-custom-${immobileId}-${bloccoId}`);
            if (customTextarea) {
                blocco.descrizioneCustom = customTextarea.value;
                this.isDirty = true;
                console.log(`📝 Nota custom aggiornata per blocco ${bloccoId}: ${blocco.descrizioneCustom}`);
            }
        }
    }

    addBloccoCatastale(immobileId, tipo) {
        console.log(`🔵 addBloccoCatastale chiamato: immobileId=${immobileId}, tipo=${tipo}`);
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile) {
            console.log(`🔵 Immobile trovato, blocchi attuali: ${immobile.blocchiCatastali.length}`);
            const newBlocco = {
                id: immobile.blocchiCatastali.length + 1,
                descrizione: '',
                descrizioneCustom: '',
                tipoCatasto: tipo,
                righe: [tipo === 'fabbricati' ? this.createEmptyFabbricatoRow() : this.createEmptyTerrenoRow()]
            };
            immobile.blocchiCatastali.push(newBlocco);
            console.log(`🔵 Nuovo blocco aggiunto, totale blocchi: ${immobile.blocchiCatastali.length}`);

            // Refresh completo per mostrare anche i nuovi pulsanti
            this.refreshBlocchiCatastali(immobileId);
            this.isDirty = true;

            console.log(`✅ Aggiunto blocco catastale ${tipo} ${newBlocco.id} per immobile ${immobileId}`);
        } else {
            console.error(`❌ Immobile ${immobileId} non trovato!`);
        }
    }


    removeBloccoCatastale(immobileId, bloccoId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile) {
            // Permette di rimuovere anche l'ultimo blocco per tornare ai chip buttons
            immobile.blocchiCatastali = immobile.blocchiCatastali.filter(b => b.id !== bloccoId);
            this.refreshBlocchiCatastali(immobileId);
            this.isDirty = true;
            console.log(`🗑️ Rimosso blocco ${bloccoId}, blocchi rimanenti: ${immobile.blocchiCatastali.length}`);
        }
    }

    refreshBlocchiCatastali(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const container = document.getElementById(`blocchi-${immobileId}`);
        if (container && immobile) {
            // Salva i dati attuali prima del re-rendering
            this.saveBlocchiCatastaliData(immobileId);
            container.innerHTML = this.renderBlocchiCatastali(immobile);
        }
    }

    saveBlocchiCatastaliData(immobileId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (!immobile) return;

        immobile.blocchiCatastali.forEach(blocco => {
            // Salva descrizione dropdown
            const descSelect = document.getElementById(`descrizione-${immobileId}-${blocco.id}`);
            if (descSelect) {
                blocco.descrizione = descSelect.value;
            }

            // Salva descrizione custom
            const descCustom = document.getElementById(`descrizione-custom-${immobileId}-${blocco.id}`);
            if (descCustom && descCustom.style.display !== 'none') {
                blocco.descrizioneCustom = descCustom.value;
            }

            // Salva tipo catasto
            const tipoRadios = document.querySelectorAll(`input[name="tipo-${immobileId}-${blocco.id}"]:checked`);
            if (tipoRadios.length > 0) {
                blocco.tipoCatasto = tipoRadios[0].value;
            }

            // Salva righe catastali
            this.saveRigheCatastaliData(immobileId, blocco.id);
        });

        console.log(`💾 Salvati dati blocchi catastali immobile ${immobileId}`);
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
            // Salva i dati delle righe prima del re-rendering
            this.saveRigheCatastaliData(immobileId, bloccoId);
            container.innerHTML = this.renderRigheCatastali(immobileId, blocco);
        }
    }

    saveRigheCatastaliData(immobileId, bloccoId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);
        if (!blocco) {
            console.warn(`❌ Blocco catastale non trovato: immobile ${immobileId}, blocco ${bloccoId}`);
            return;
        }

        console.log(`🔍 DEBUG SAVE: Salvando righe catastali per immobile ${immobileId}, blocco ${bloccoId}`);
        console.log(`🔍 DEBUG SAVE: Tipo catasto: ${blocco.tipoCatasto}`);
        console.log(`🔍 DEBUG SAVE: Numero righe da salvare: ${blocco.righe.length}`);

        // Definisci campi diversi in base al tipo di catasto
        const fieldsFabbricati = ['foglio', 'mappale', 'subalterno', 'categoria', 'classe', 'vani_mq', 'superfici', 'indirizzo_piano', 'rendita'];
        const fieldsTerreni = ['foglio', 'mappale', 'porzione', 'qualita', 'classe', 'metri_quadrati', 'dominicale', 'agrario'];

        const fields = blocco.tipoCatasto === 'fabbricati' ? fieldsFabbricati : fieldsTerreni;

        blocco.righe.forEach((riga, rigaIndex) => {
            console.log(`🔍 DEBUG SAVE: Processando riga ${rigaIndex + 1}, ID: ${riga.id}`);

            let campiSalvati = 0;
            let campiVuoti = 0;

            fields.forEach(field => {
                const fieldId = `${field}_${immobileId}_${bloccoId}_${riga.id}`;
                const fieldElement = document.getElementById(fieldId);

                if (fieldElement) {
                    const valorePrecedente = riga[field];
                    const nuovoValore = fieldElement.value || '';
                    riga[field] = nuovoValore;

                    if (nuovoValore.trim() !== '') {
                        campiSalvati++;
                        console.log(`  ✅ ${field}: "${valorePrecedente}" → "${nuovoValore}"`);
                    } else {
                        campiVuoti++;
                        if (valorePrecedente && valorePrecedente.trim() !== '') {
                            console.log(`  ⚠️ ${field}: "${valorePrecedente}" → VUOTO (perso!)`);
                        }
                    }
                } else {
                    console.warn(`  ❌ Campo HTML non trovato: ${fieldId}`);
                }
            });

            console.log(`  📊 Riga ${rigaIndex + 1}: ${campiSalvati} campi salvati, ${campiVuoti} campi vuoti`);
        });

        console.log(`💾 ✅ Completato salvataggio righe catastali ${immobileId}-${bloccoId}`);
        console.log(`💾 📋 Dati finali blocco:`, JSON.stringify(blocco, null, 2));
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
            // Salva i dati attuali prima del re-rendering
            this.saveMappaliConfiniData(immobileId, direzione);

            // Mantieni il bottone "Aggiungi"
            const addButton = container.querySelector('.btn-add-mappale');
            container.innerHTML = this.renderMappaliConfini(immobileId, direzione, immobile.confini[direzione]);
            container.appendChild(addButton);
        }
    }

    saveMappaliConfiniData(immobileId, direzione) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (!immobile) return;

        // Salva i valori dei mappali per la direzione specifica
        immobile.confini[direzione].forEach((mappale, index) => {
            const mappaleInput = document.getElementById(`mappale-${immobileId}-${direzione}-${index}`);
            if (mappaleInput) {
                immobile.confini[direzione][index] = mappaleInput.value || '';
            }
        });

        console.log(`💾 Salvati mappali confini ${direzione} per immobile ${immobileId}`);
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

        // Se siamo nella tab condizioni, aggiorna la sezione prezzo
        if (this.currentTab === 'condizioni') {
            setTimeout(() => {
                this.renderSezionePrezzo();
                console.log('🔄 Sezione prezzo aggiornata dopo rimozione immobile');
            }, 100);
        }

        console.log(`❌ Rimosso immobile ${id}`);
    }

    // ========== FUNZIONI RIGHE CATASTALI (APPEND-ONLY) ==========

    addRigaCatastale(immobileId, bloccoId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);

        if (blocco) {
            // Crea riga con struttura corretta in base al tipo di catasto
            let newRiga = {
                id: blocco.righe.length + 1
            };

            if (blocco.tipoCatasto === 'fabbricati') {
                newRiga = {
                    ...newRiga,
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
            } else {
                newRiga = {
                    ...newRiga,
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

            blocco.righe.push(newRiga);
            this.appendNewRigaCatastale(immobileId, bloccoId, newRiga);
            this.isDirty = true;

            console.log(`✅ Aggiunta riga catastale ${newRiga.id} per blocco ${bloccoId} (tipo: ${blocco.tipoCatasto})`);
        }
    }

    appendNewRigaCatastale(immobileId, bloccoId, riga) {
        const container = document.getElementById(`righe-${immobileId}-${bloccoId}`);
        if (container) {
            const rigaHtml = this.renderSingleRigaCatastale(immobileId, bloccoId, riga, true);
            container.insertAdjacentHTML('beforeend', rigaHtml);
        }
    }

    renderSingleRigaCatastale(immobileId, bloccoId, riga, showRemoveButton = false) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);
        const isFabbricati = blocco?.tipoCatasto === 'fabbricati';

        if (isFabbricati) {
            return `
                <div class="catasto-row">
                    <div class="catasto-fields">
                        <input type="text" id="foglio_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.foglio || ''}" placeholder="Foglio">
                        <input type="text" id="mappale_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.mappale || ''}" placeholder="Mappale">
                        <input type="text" id="subalterno_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.subalterno || ''}" placeholder="Sub">
                        <input type="text" id="categoria_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.categoria || ''}" placeholder="Cat">
                        <input type="text" id="classe_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.classe || ''}" placeholder="Classe">
                        <input type="text" id="vani_mq_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.vani_mq || ''}" placeholder="Vani/mq">
                        <input type="text" id="superfici_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.superfici || ''}" placeholder="Superfici">
                        <input type="text" id="indirizzo_piano_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.indirizzo_piano || ''}" placeholder="Ind/Piano">
                        <input type="text" id="rendita_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.rendita || ''}" placeholder="Rendita">
                    </div>
                    ${showRemoveButton ?
                        `<button type="button" class="btn-remove-mappale"
                                 onclick="window.siafApp.removeRigaCatastale(${immobileId}, ${bloccoId}, ${riga.id})">
                            ❌ Rimuovi
                         </button>` : ''}
                </div>
            `;
        } else {
            return `
                <div class="catasto-row">
                    <div class="catasto-fields">
                        <input type="text" id="foglio_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.foglio || ''}" placeholder="Foglio">
                        <input type="text" id="mappale_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.mappale || ''}" placeholder="Mappale">
                        <input type="text" id="porzione_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.porzione || ''}" placeholder="Porz">
                        <input type="text" id="qualita_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.qualita || ''}" placeholder="Qualità">
                        <input type="text" id="classe_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.classe || ''}" placeholder="Classe">
                        <input type="text" id="metri_quadrati_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.metri_quadrati || ''}" placeholder="Mq">
                        <input type="text" id="dominicale_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.dominicale || ''}" placeholder="Dominicale">
                        <input type="text" id="agrario_${immobileId}_${bloccoId}_${riga.id}"
                               value="${riga.agrario || ''}" placeholder="Agrario">
                    </div>
                    ${showRemoveButton ?
                        `<button type="button" class="btn-remove-mappale"
                                 onclick="window.siafApp.removeRigaCatastale(${immobileId}, ${bloccoId}, ${riga.id})">
                            ❌ Rimuovi
                         </button>` : ''}
                </div>
            `;
        }
    }

    // ========== FUNZIONI MAPPALI CONFINI (APPEND-ONLY) ==========

    addMappaleConfine(immobileId, direzione) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile) {
            immobile.confini[direzione].push('');
            this.appendNewMappaleConfine(immobileId, direzione, immobile.confini[direzione].length - 1);
            this.isDirty = true;

            console.log(`✅ Aggiunto mappale confine ${direzione} per immobile ${immobileId}`);
        }
    }

    appendNewMappaleConfine(immobileId, direzione, index) {
        const container = document.getElementById(`confini-${immobileId}-${direzione}`);
        if (container) {
            // Trova il pulsante "Aggiungi" e inserisci prima di esso
            const addButton = container.querySelector('.btn-add-mappale');
            const mappaleHtml = this.renderSingleMappaleConfine(immobileId, direzione, index, true);

            if (addButton) {
                addButton.insertAdjacentHTML('beforebegin', mappaleHtml);
            } else {
                container.insertAdjacentHTML('beforeend', mappaleHtml);
            }
        }
    }

    renderSingleMappaleConfine(immobileId, direzione, index, showRemoveButton = false) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const mappaleValue = immobile?.confini[direzione][index] || '';

        return `
            <input type="text" class="mappale-input"
                   id="mappale-${immobileId}-${direzione}-${index}"
                   value="${mappaleValue}"
                   placeholder="Mappale">
            ${showRemoveButton ?
                `<button type="button" class="btn-remove-mappale"
                         onclick="window.siafApp.removeMappaleConfine(${immobileId}, '${direzione}', ${index})">
                    ❌
                 </button>` : ''}
        `;
    }

    removeRigaCatastale(immobileId, bloccoId, rigaId) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        const blocco = immobile?.blocchiCatastali.find(b => b.id === bloccoId);

        if (blocco && blocco.righe.length > 1) {
            blocco.righe = blocco.righe.filter(r => r.id !== rigaId);
            // Rimuovi l'elemento DOM direttamente
            const rigaElement = document.querySelector(`#righe-${immobileId}-${bloccoId} .catasto-row:has(input[id*="_${rigaId}"])`);
            if (rigaElement) {
                rigaElement.remove();
            }
            this.isDirty = true;
        }
    }

    removeMappaleConfine(immobileId, direzione, index) {
        const immobile = this.immobili.find(i => i.id === immobileId);
        if (immobile && immobile.confini[direzione].length > 1) {
            immobile.confini[direzione].splice(index, 1);
            // Refresh necessario per ricalcolare gli indici
            this.refreshMappaliConfini(immobileId, direzione);
            this.isDirty = true;
        }
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

    populateProvinciaDropdown(immobileId, selectedProvincia = '') {
        const provinciaField = document.getElementById(`immobile_${immobileId}_provincia`);
        if (!provinciaField) return;

        if (!this.geoDataLoaded || Object.keys(PROVINCE_COMUNI).length === 0) {
            provinciaField.innerHTML = '<option value="">Caricamento province...</option>';
            return;
        }

        let options = '<option value="">Seleziona provincia...</option>';

        // Ordina province alfabeticamente
        const provinceList = Object.keys(PROVINCE_COMUNI).sort();

        provinceList.forEach(provincia => {
            const selected = provincia === selectedProvincia ? 'selected' : '';
            options += `<option value="${provincia}" ${selected}>${provincia}</option>`;
        });

        provinciaField.innerHTML = options;

        // Se c'è una provincia selezionata, popola anche i comuni
        if (selectedProvincia) {
            setTimeout(() => {
                this.populateComuniDropdown(immobileId, selectedProvincia);
            }, 100);
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

            // Salva la provincia nell'oggetto immobile
            const immobile = this.immobili.find(i => i.id === immobileId);
            if (immobile) {
                immobile.provincia = provincia;
                this.isDirty = true;
            }

            this.populateComuniDropdown(immobileId, provincia);

            // Se siamo nella tab condizioni, aggiorna la sezione prezzo
            if (this.currentTab === 'condizioni') {
                setTimeout(() => {
                    this.renderSezionePrezzo();
                    console.log('🔄 Sezione prezzo aggiornata dopo cambio provincia');
                }, 100);
            }
        }
    }

    handleComuneChange(immobileId) {
        const provinciaField = document.getElementById(`immobile_${immobileId}_provincia`);
        const comuneField = document.getElementById(`immobile_${immobileId}_comune`);

        if (provinciaField && comuneField && provinciaField.value && comuneField.value) {
            // Salva il comune nell'oggetto immobile
            const immobile = this.immobili.find(i => i.id === immobileId);
            if (immobile) {
                immobile.comune = comuneField.value;
                this.isDirty = true;
            }

            // Aggiungi ai recenti quando viene selezionato un comune
            this.addComuneRecente(comuneField.value, provinciaField.value);

            // Aggiorna la UI dei comuni recenti per tutti gli immobili
            this.refreshComuniRecentiUI();

            // Se siamo nella tab condizioni, aggiorna la sezione prezzo
            if (this.currentTab === 'condizioni') {
                setTimeout(() => {
                    this.renderSezionePrezzo();
                    console.log('🔄 Sezione prezzo aggiornata dopo cambio comune');
                }, 100);
            }
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

    // ========== BLOCCO: GESTIONE ULTIME PRATICHE ==========

    /**
     * Aggiunge una pratica alla lista delle pratiche recenti
     * @param {string} protocollo - Numero protocollo (es. "3764/L")
     * @param {string} cognomeVenditore - Cognome del primo venditore
     */
    addPraticaRecente(protocollo, cognomeVenditore) {
        const pratiche = this.getPraticheRecenti();

        // Crea oggetto pratica
        const nuovaPratica = {
            protocollo: protocollo,
            cognome: cognomeVenditore,
            timestamp: new Date().toISOString(),
            dataFormattata: new Date().toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        };

        // Rimuovi duplicati (stesso protocollo)
        const senzaDuplicati = pratiche.filter(p => p.protocollo !== protocollo);

        // Aggiungi in testa
        senzaDuplicati.unshift(nuovaPratica);

        // Mantieni solo ultime 10
        const ultime10 = senzaDuplicati.slice(0, 10);

        // Salva in localStorage
        try {
            localStorage.setItem('siaf_pratiche_recenti', JSON.stringify(ultime10));
            console.log(`✅ Pratica ${protocollo} aggiunta alle recenti`);
        } catch (error) {
            console.error('Errore salvataggio pratiche recenti:', error);
        }

        // Re-render della sezione
        this.renderUltimePratiche();
    }

    /**
     * Recupera le pratiche recenti da localStorage
     * @returns {Array} Lista pratiche recenti
     */
    getPraticheRecenti() {
        try {
            const data = localStorage.getItem('siaf_pratiche_recenti');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Errore lettura pratiche recenti:', error);
            return [];
        }
    }

    /**
     * Renderizza la sezione ultime pratiche
     */
    renderUltimePratiche() {
        const container = document.getElementById('ultime-pratiche-container');
        if (!container) return;

        const pratiche = this.getPraticheRecenti();

        if (pratiche.length === 0) {
            container.innerHTML = `
                <div class="ultime-pratiche-empty">
                    Nessuna pratica recente. Le pratiche salvate o caricate appariranno qui.
                </div>
            `;
            return;
        }

        container.innerHTML = pratiche.map(pratica => `
            <button type="button" class="pratica-recente-btn" onclick="window.siafApp.caricaPraticaRecente('${pratica.protocollo}')">
                <div class="pratica-recente-protocollo">${pratica.protocollo}</div>
                <div class="pratica-recente-venditore">${pratica.cognome}</div>
            </button>
        `).join('');

        console.log(`📋 Renderizzate ${pratiche.length} pratiche recenti`);
    }

    /**
     * Carica una pratica dalla lista recenti
     * @param {string} protocollo - Numero protocollo da caricare
     */
    async caricaPraticaRecente(protocollo) {
        console.log(`📂 Caricamento pratica recente: ${protocollo}`);
        await this.caricaPraticaEsistente(protocollo);
    }
}

// ========== SISTEMA GESTIONE GEODATI ITALIANI ==========

// URL del JSON completo comuni italiani
const ITALY_GEO_URL = 'https://contattisilvestri.github.io/SIAF/DATA/italy-comuni.json';

// Cache locale per evitare ricaricamenti
let ITALY_GEO_DATA = null;
let PROVINCE_COMUNI = {}; // Popolato dinamicamente

// Funzione per caricare e processare i geodati
async function loadItalyGeoData() {
    if (ITALY_GEO_DATA) {
        return ITALY_GEO_DATA; // Già caricato
    }

    // Retry logic: max 2 tentativi
    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🌍 Caricamento geodati italiani... (tentativo ${attempt}/${maxRetries})`);

            // AbortController per timeout di 5 secondi
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(ITALY_GEO_URL, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            ITALY_GEO_DATA = data;

            // Processa i dati per creare la struttura province->comuni
            processGeoDataForDropdowns();

            console.log(`✅ Caricati ${data.length} comuni italiani`);
            return data;

        } catch (error) {
            lastError = error;

            if (error.name === 'AbortError') {
                console.warn(`⏱️ Timeout caricamento geodati (tentativo ${attempt}/${maxRetries})`);
            } else {
                console.warn(`⚠️ Errore caricamento geodati (tentativo ${attempt}/${maxRetries}):`, error.message);
            }

            // Se non è l'ultimo tentativo, aspetta 1 secondo prima di riprovare
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // Tutti i tentativi falliti - usa fallback
    console.warn('❌ Impossibile caricare geodati completi dopo', maxRetries, 'tentativi');
    console.warn('📍 Utilizzo dati fallback (Nord Italia)');
    console.warn('💡 L\'applicazione funzionerà con un subset limitato di province/comuni');

    return getFallbackGeoData();
}

// Processa i dati per creare la struttura ottimizzata per dropdown
function processGeoDataForDropdowns() {
    if (!ITALY_GEO_DATA) return;

    PROVINCE_COMUNI = {};

    ITALY_GEO_DATA.forEach(comune => {
        const provinciaName = comune.provincia.nome;

        if (!PROVINCE_COMUNI[provinciaName]) {
            PROVINCE_COMUNI[provinciaName] = [];
        }

        PROVINCE_COMUNI[provinciaName].push(comune.nome);
    });

    // Ordina comuni alfabeticamente per ogni provincia
    Object.keys(PROVINCE_COMUNI).forEach(provincia => {
        PROVINCE_COMUNI[provincia].sort();
    });

    console.log(`📊 Processate ${Object.keys(PROVINCE_COMUNI).length} province`);
}

// Fallback per dati base (Nord Italia) in caso di errore
function getFallbackGeoData() {
    console.log('🔄 Usando dati fallback Nord Italia');
    PROVINCE_COMUNI = {
        "Rovigo": ["Bergantino", "Castelmassa", "Ostiglia", "Adria", "Rovigo"],
        "Mantova": ["Ostiglia", "Revere", "Suzzara", "Mantova", "Gonzaga"],
        "Ferrara": ["Bondeno", "Ferrara", "Cento", "Argenta"],
        "Verona": ["Verona", "Legnago", "Villafranca di Verona"],
        "Padova": ["Padova", "Abano Terme", "Cittadella"]
    };
    return [];
}

// Comuni più frequenti per l'area SIAF (personalizzabile)
const COMUNI_FREQUENTI_DEFAULT = [
    { comune: "Bergantino", provincia: "Rovigo" },
    { comune: "Castelmassa", provincia: "Rovigo" },
    { comune: "Ostiglia", provincia: "Mantova" },
    { comune: "Revere", provincia: "Mantova" },
    { comune: "Suzzara", provincia: "Mantova" },
    { comune: "Bondeno", provincia: "Ferrara" }
];

// BLOCCO 6: Sistema versioning dinamico
function updateVersionIndicator() {
    const version = window.SIAF_VERSION;
    const indicator = document.getElementById('version-indicator');

    if (indicator && version) {
        // Aggiorna contenuto
        indicator.textContent = `📅 SIAF v${version.major}.${version.minor}.${version.patch} - ${version.date.slice(0, 5)} ${version.time}`;

        // Aggiorna colore (con variazione randomica)
        const colors = ['#FF5722', '#9C27B0', '#3F51B5', '#009688', '#FF9800', '#E91E63', '#673AB7', '#4CAF50', '#F44336', '#2196F3'];
        const baseColor = version.color;
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        indicator.style.background = randomColor;

        // Aggiungi animazione e eventi
        indicator.style.animation = 'pulse 2s infinite';

        // Aggiungi CSS per animazione e hover
        if (!document.getElementById('version-styles')) {
            const style = document.createElement('style');
            style.id = 'version-styles';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                #version-indicator:hover {
                    background: #000 !important;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(style);
        }

        // Aggiungi evento click (solo una volta)
        if (!indicator.hasAttribute('data-click-added')) {
            indicator.addEventListener('click', function() {
                alert(`🚀 SIAF SYSTEM v${version.major}.${version.minor}.${version.patch}\n📅 ${version.date} ${version.time}\n🔧 ${version.description}\n🎨 Colore: ${randomColor}\n💾 File JS caricato correttamente!`);
            });
            indicator.setAttribute('data-click-added', 'true');
        }

        console.log(`✅ Version indicator aggiornato: v${version.major}.${version.minor}.${version.patch}`);
    }
}

// ========== BLOCCO: UTILITY FUNCTIONS - Conversione numeri in lettere ==========

/**
 * Converte un numero in formato lettere italiano
 * @param {number} numero - Il numero da convertire
 * @param {boolean} includiDecimali - Se true, aggiunge /00 per i decimali
 * @returns {string} - Il numero in lettere
 *
 * Esempi:
 * numeroInLettere(60000, true) → "sessantamila/00"
 * numeroInLettere(3, false) → "tre"
 * numeroInLettere(1500, true) → "millecinquecento/00"
 */
function numeroInLettere(numero, includiDecimali = true) {
    if (numero === 0) return includiDecimali ? "zero/00" : "zero";
    if (!numero || isNaN(numero)) return "";

    const unita = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];
    const decine = ['', 'dieci', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
    const teens = ['dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];

    function convertiCentinaia(num) {
        if (num === 0) return '';

        let risultato = '';

        // Centinaia
        const centinaia = Math.floor(num / 100);
        if (centinaia > 0) {
            if (centinaia === 1) {
                risultato += 'cento';
            } else {
                risultato += unita[centinaia] + 'cento';
            }
        }

        // Decine e unità
        const resto = num % 100;
        if (resto >= 10 && resto < 20) {
            risultato += teens[resto - 10];
        } else {
            const decina = Math.floor(resto / 10);
            const unita_resto = resto % 10;

            if (decina > 0) {
                risultato += decine[decina];
                // Eufonia: venti + uno = ventuno, venti + otto = ventotto
                if (unita_resto === 1 || unita_resto === 8) {
                    risultato = risultato.slice(0, -1); // Rimuovi ultima vocale
                }
            }

            if (unita_resto > 0) {
                risultato += unita[unita_resto];
            }
        }

        return risultato;
    }

    let numInt = Math.floor(numero);
    let risultato = '';

    // Milioni
    const milioni = Math.floor(numInt / 1000000);
    if (milioni > 0) {
        if (milioni === 1) {
            risultato += 'unmilione';
        } else {
            risultato += convertiCentinaia(milioni) + 'milioni';
        }
        numInt %= 1000000;
    }

    // Migliaia
    const migliaia = Math.floor(numInt / 1000);
    if (migliaia > 0) {
        if (migliaia === 1) {
            risultato += 'mille';
        } else {
            risultato += convertiCentinaia(migliaia) + 'mila';
        }
        numInt %= 1000;
    }

    // Centinaia, decine, unità
    if (numInt > 0) {
        risultato += convertiCentinaia(numInt);
    }

    // Aggiungi decimali se richiesto
    if (includiDecimali) {
        const decimali = Math.round((numero - Math.floor(numero)) * 100);
        risultato += '/' + decimali.toString().padStart(2, '0');
    }

    return risultato || 'zero';
}

/**
 * Calcola automaticamente valori derivati per le condizioni economiche
 * @param {object} condizioni - Oggetto condizioni economiche
 * @returns {object} - Oggetto con valori calcolati e convertiti in lettere
 */
function calcolaValoriCondizioni(condizioni) {
    const risultato = {};

    // Prezzo e riduzione
    if (condizioni.prezzo_vendita) {
        risultato.prezzo_vendita = condizioni.prezzo_vendita;
        risultato.prezzo_vendita_lettere = numeroInLettere(condizioni.prezzo_vendita, true);

        if (condizioni.percentuale_riduzione) {
            risultato.percentuale_riduzione = condizioni.percentuale_riduzione;
            risultato.percentuale_riduzione_lettere = numeroInLettere(condizioni.percentuale_riduzione, false);

            // Calcola prezzo minimo
            const prezzoMinimo = condizioni.prezzo_vendita * (1 - condizioni.percentuale_riduzione / 100);
            risultato.prezzo_minimo = Math.round(prezzoMinimo);
            risultato.prezzo_minimo_lettere = numeroInLettere(risultato.prezzo_minimo, true);
        }
    }

    // Provvigione
    if (condizioni.percentuale_provvigione) {
        risultato.percentuale_provvigione = condizioni.percentuale_provvigione;
        risultato.percentuale_provvigione_lettere = numeroInLettere(condizioni.percentuale_provvigione, false);

        if (condizioni.prezzo_vendita) {
            const provvigioneEuro = condizioni.prezzo_vendita * (condizioni.percentuale_provvigione / 100);
            risultato.provvigione_euro = Math.round(provvigioneEuro);
            risultato.provvigione_euro_lettere = numeroInLettere(risultato.provvigione_euro, true);
        }
    }

    // Soglia minima e importo minimo
    if (condizioni.soglia_minima) {
        risultato.soglia_minima = condizioni.soglia_minima;
        risultato.soglia_minima_lettere = numeroInLettere(condizioni.soglia_minima, true);
    }

    if (condizioni.importo_minimo) {
        risultato.importo_minimo = condizioni.importo_minimo;
        risultato.importo_minimo_lettere = numeroInLettere(condizioni.importo_minimo, true);
    }

    return risultato;
}

// BLOCCO 7: Inizializzazione app quando DOM è pronto
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inizializzazione SIAF App...');

    // Timeout di 10 secondi per l'inizializzazione
    const INIT_TIMEOUT = 10000; // 10 secondi

    try {
        window.siafApp = new SiafApp();

        // Promise con timeout
        const initPromise = window.siafApp.init();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout inizializzazione (10s)')), INIT_TIMEOUT)
        );

        // Race tra init e timeout
        await Promise.race([initPromise, timeoutPromise]);

        console.log('✅ SIAF App pronta!');

        // 🚀 VERSION FINALE - Sempre ultimo messaggio in console
        const version = window.SIAF_VERSION;
        console.log(`%c🚀 SIAF SYSTEM v${version.major}.${version.minor}.${version.patch}-FINAL-${version.date.replace(/\//g, '-')}-${version.time.replace(':', '')} 🚀`, `background: ${version.color}; color: white; font-size: 16px; font-weight: bold; padding: 10px; border-radius: 5px;`);
        console.log(`%c📅 Last Update: ${version.date} ${version.time} - ${version.description}`, 'background: #2196F3; color: white; font-size: 12px; padding: 5px;');

    } catch (error) {
        console.error('❌ ERRORE CRITICO durante inizializzazione:', error);

        // Aggiorna indicatore con stato errore
        const indicator = document.getElementById('version-indicator');
        if (indicator) {
            indicator.textContent = '❌ Errore - Ricarica pagina';
            indicator.style.background = '#dc3545';
            indicator.style.color = 'white';
            indicator.style.cursor = 'pointer';

            // Click per ricaricare
            indicator.addEventListener('click', () => {
                window.location.reload(true);
            });
        }

        // Mostra alert con opzione retry
        const retry = confirm(
            'Errore durante il caricamento dell\'applicazione.\n\n' +
            'Possibili cause:\n' +
            '• Connessione internet lenta\n' +
            '• Cache del browser\n' +
            '• Problemi temporanei del server\n\n' +
            'Clicca OK per ricaricare la pagina, Annulla per continuare.'
        );

        if (retry) {
            window.location.reload(true);
        }
    }
});

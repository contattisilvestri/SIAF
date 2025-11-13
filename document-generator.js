// document-generator.gs - Generatore documenti SIAF
// Gestisce creazione cartelle pratiche e generazione documenti da template

// ========== MAPPA PROVINCE ITALIANE ==========
const PROVINCE_ITALIANE = {
  'AG': 'Agrigento', 'AL': 'Alessandria', 'AN': 'Ancona', 'AO': 'Aosta', 'AP': 'Ascoli Piceno',
  'AQ': "L'Aquila", 'AR': 'Arezzo', 'AT': 'Asti', 'AV': 'Avellino', 'BA': 'Bari',
  'BG': 'Bergamo', 'BI': 'Biella', 'BL': 'Belluno', 'BN': 'Benevento', 'BO': 'Bologna',
  'BR': 'Brindisi', 'BS': 'Brescia', 'BT': 'Barletta-Andria-Trani', 'BZ': 'Bolzano', 'CA': 'Cagliari',
  'CB': 'Campobasso', 'CE': 'Caserta', 'CH': 'Chieti', 'CL': 'Caltanissetta', 'CN': 'Cuneo',
  'CO': 'Como', 'CR': 'Cremona', 'CS': 'Cosenza', 'CT': 'Catania', 'CZ': 'Catanzaro',
  'EN': 'Enna', 'FC': 'Forlì-Cesena', 'FE': 'Ferrara', 'FG': 'Foggia', 'FI': 'Firenze',
  'FM': 'Fermo', 'FR': 'Frosinone', 'GE': 'Genova', 'GO': 'Gorizia', 'GR': 'Grosseto',
  'IM': 'Imperia', 'IS': 'Isernia', 'KR': 'Crotone', 'LC': 'Lecco', 'LE': 'Lecce',
  'LI': 'Livorno', 'LO': 'Lodi', 'LT': 'Latina', 'LU': 'Lucca', 'MB': 'Monza e della Brianza',
  'MC': 'Macerata', 'ME': 'Messina', 'MI': 'Milano', 'MN': 'Mantova', 'MO': 'Modena',
  'MS': 'Massa-Carrara', 'MT': 'Matera', 'NA': 'Napoli', 'NO': 'Novara', 'NU': 'Nuoro',
  'OR': 'Oristano', 'PA': 'Palermo', 'PC': 'Piacenza', 'PD': 'Padova', 'PE': 'Pescara',
  'PG': 'Perugia', 'PI': 'Pisa', 'PN': 'Pordenone', 'PO': 'Prato', 'PR': 'Parma',
  'PT': 'Pistoia', 'PU': 'Pesaro e Urbino', 'PV': 'Pavia', 'PZ': 'Potenza', 'RA': 'Ravenna',
  'RC': 'Reggio Calabria', 'RE': 'Reggio Emilia', 'RG': 'Ragusa', 'RI': 'Rieti', 'RM': 'Roma',
  'RN': 'Rimini', 'RO': 'Rovigo', 'SA': 'Salerno', 'SI': 'Siena', 'SO': 'Sondrio',
  'SP': 'La Spezia', 'SR': 'Siracusa', 'SS': 'Sassari', 'SU': 'Sud Sardegna', 'SV': 'Savona',
  'TA': 'Taranto', 'TE': 'Teramo', 'TN': 'Trento', 'TO': 'Torino', 'TP': 'Trapani',
  'TR': 'Terni', 'TS': 'Trieste', 'TV': 'Treviso', 'UD': 'Udine', 'VA': 'Varese',
  'VB': 'Verbano-Cusio-Ossola', 'VC': 'Vercelli', 'VE': 'Venezia', 'VI': 'Vicenza', 'VR': 'Verona',
  'VT': 'Viterbo', 'VV': 'Vibo Valentia'
};

// Funzione helper per convertire sigla provincia in nome completo
function getNomeProvinciaCompleto(sigla) {
  if (!sigla) return '';
  const siglaMaiuscola = sigla.toUpperCase().trim();
  return PROVINCE_ITALIANE[siglaMaiuscola] || sigla; // Fallback alla sigla se non trovata
}

// ========== ENDPOINT PRINCIPALE ==========

function handleGenerateDocuments(requestData) {
  try {
    const executionId = Math.random().toString(36).substr(2, 9);
    console.log(`🏗️ [${executionId}] === INIZIO GENERAZIONE DOCUMENTI ===`);
    console.log(`🏗️ [${executionId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`🏗️ [${executionId}] Protocollo: ${requestData.protocollo}`);
    console.log(`🏗️ [${executionId}] Request data:`, requestData);

    // STEP 0: Carica dati completi dal database
    console.log(`🏗️ [${executionId}] Caricamento dati completi dal database...`);
    const praticaCompleta = loadPratica(requestData.protocollo);
    if (!praticaCompleta.success) {
      return {
        success: false,
        error: 'Errore caricamento pratica: ' + praticaCompleta.error
      };
    }

    console.log(`🏗️ [${executionId}] Pratica caricata - Immobili trovati: ${praticaCompleta.immobili ? praticaCompleta.immobili.length : 0}`);

    // Merge dei dati del request con quelli del database
    const dataCompleta = {
      ...requestData,
      ...praticaCompleta,
      // Mantieni i dati del request per eventuali override
      protocollo: requestData.protocollo,
      lettera: requestData.lettera
    };

    // STEP 1: Validazione dati
    const validationResult = validateGenerationData(dataCompleta);
    if (!validationResult.valid) {
      return {
        success: false,
        error: 'Dati non validi: ' + validationResult.error
      };
    }
    
    // STEP 2: Creazione struttura cartelle
    console.log(`🏗️ [${executionId}] Avvio creazione cartelle...`);
    const folderResult = createPraticaFolders(dataCompleta, executionId);
    if (!folderResult.success) {
      return {
        success: false,
        error: 'Errore creazione cartelle: ' + folderResult.error
      };
    }

    // STEP 3: Generazione documenti
    const documentsResult = generateDocuments(dataCompleta, folderResult.folders);
    if (!documentsResult.success) {
      return {
        success: false,
        error: 'Errore generazione documenti: ' + documentsResult.error
      };
    }
    
    return {
      success: true,
      message: 'Documenti generati con successo',
      cartella_nome: folderResult.mainFolderName,
      cartella_url: folderResult.mainFolderUrl,
      documenti_creati: documentsResult.documenti_creati,
      documenti_dettaglio: documentsResult.documenti_lista
    };
    
  } catch (error) {
    console.error('❌ Errore generazione documenti:', error);
    return {
      success: false,
      error: 'Errore interno: ' + error.toString()
    };
  }
}

// ========== VALIDAZIONE DATI ==========

function validateGenerationData(data) {
  const errors = [];
  
  if (!data.protocollo) {
    errors.push('Protocollo mancante');
  }
  
  if (!data.lettera) {
    errors.push('Lettera operatore mancante');
  }
  
  if (!data.venditori || !Array.isArray(data.venditori) || data.venditori.length === 0) {
    errors.push('Dati venditori mancanti o non validi');
  }
  
  if (data.venditori) {
    data.venditori.forEach((venditore, index) => {
      if (!venditore.nome || !venditore.cognome) {
        errors.push(`Venditore ${index + 1}: nome e cognome obbligatori`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join('; ')
  };
}

// ========== CREAZIONE CARTELLE PRATICA ==========

function createPraticaFolders(data, executionId = 'unknown') {
  try {
    console.log(`📁 [${executionId}] === INIZIO CREAZIONE CARTELLE ===`);
    const protocollo = data.protocollo;
    const lettera = data.lettera.toUpperCase();
    
    // Estrai anno-mese dalla data di compilazione
    const dataCompilazione = data.data_compilazione || '';
    const annoMese = extractAnnoMeseFromData(dataCompilazione);
    
    // Estrai solo il numero dalla stringa protocollo (es: "3705/B" -> "3705")
    const numeroProtocollo = protocollo.split('/')[0];

    // Cerca prima se esiste già una cartella per questo protocollo (con qualsiasi nome venditore)
    console.log(`📁 [${executionId}] Cercando cartella esistente...`);
    const praticheFolderParent = DriveApp.getFolderById(TEMPLATE_FOLDERS.PRATICHE_GENERATE);
    const protocolloPattern = `${annoMese}-${lettera}-${numeroProtocollo}`;
    console.log(`📁 [${executionId}] Pattern ricerca: ${protocolloPattern}`);
    let praticaFolder = findExistingPraticaFolderByProtocol(praticheFolderParent, protocolloPattern);
    console.log(`📁 [${executionId}] Cartella esistente trovata: ${praticaFolder ? praticaFolder.getName() : 'NESSUNA'}`);

    let praticaFolderName;

    if (praticaFolder) {
      // Cartella esistente trovata - mantieni il nome originale
      praticaFolderName = praticaFolder.getName();
      console.log(`🔄 Riutilizzo cartella esistente: ${praticaFolderName}`);
    } else {
      // Nuova cartella - crea con dati del primo venditore
      const primoVenditore = data.venditori && data.venditori.length > 0 ? data.venditori[0] : null;
      const cognomeNome = primoVenditore ?
        `${(primoVenditore.cognome || 'SCONOSCIUTO').toUpperCase()}-${(primoVenditore.nome || 'SCONOSCIUTO').toUpperCase()}` :
        'VENDITORE-SCONOSCIUTO';

      praticaFolderName = `${annoMese}-${lettera}-${numeroProtocollo}-${cognomeNome}`;
      console.log(`📁 [${executionId}] 🆕 Creazione nuova cartella: ${praticaFolderName}`);
      console.log(`📁 [${executionId}] Prima di createFolder - timestamp: ${new Date().toISOString()}`);
      praticaFolder = DriveApp.createFolder(praticaFolderName);
      console.log(`📁 [${executionId}] Cartella creata ID: ${praticaFolder.getId()}`);
      praticheFolderParent.addFolder(praticaFolder);
      console.log(`📁 [${executionId}] Cartella aggiunta al parent`);

      // PAUSA per evitare race conditions
      Utilities.sleep(500);
      console.log(`📁 [${executionId}] Pausa completata`);

      // CONTROLLO POST-CREAZIONE: Verifica se ci sono duplicati
      console.log(`📁 [${executionId}] Controllo duplicati post-creazione...`);
      checkForDuplicateFolders(praticheFolderParent, praticaFolderName, executionId);
    }

    // Crea o trova sottocartelle
    let docGeneratiFolder = findOrCreateSubfolder(praticaFolder, '01-DOCUMENTI-GENERATI');
    let allegatiFolder = findOrCreateSubfolder(praticaFolder, '02-ALLEGATI');
    let corrispondenzaFolder = findOrCreateSubfolder(praticaFolder, '03-CORRISPONDENZA');
    
    console.log(`✅ Struttura cartelle creata per pratica ${praticaFolderName}`);
    
    return {
      success: true,
      mainFolderName: praticaFolderName,
      mainFolderUrl: praticaFolder.getUrl(),
      folders: {
        main: praticaFolder,
        documenti: docGeneratiFolder,
        allegati: allegatiFolder,
        corrispondenza: corrispondenzaFolder
      }
    };
    
  } catch (error) {
    console.error('❌ Errore creazione cartelle:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function extractAnnoMeseFromData(dataString) {
  try {
    // Formato atteso: "24/06/2025 01:05" -> estrai "2025-06"
    if (!dataString) {
      const now = new Date();
      const anno = now.getFullYear();
      const mese = (now.getMonth() + 1).toString().padStart(2, '0');
      return `${anno}-${mese}`;
    }
    
    // Parse della data nel formato DD/MM/YYYY HH:MM
    const parts = dataString.split(' ')[0].split('/'); // Prendi solo la parte data
    if (parts.length === 3) {
      const giorno = parts[0];
      const mese = parts[1];
      const anno = parts[2];
      return `${anno}-${mese}`;
    }
    
    // Fallback al mese corrente se il parsing fallisce
    const now = new Date();
    const anno = now.getFullYear();
    const mese = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${anno}-${mese}`;
    
  } catch (error) {
    console.error('❌ Errore parsing data:', error);
    const now = new Date();
    const anno = now.getFullYear();
    const mese = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${anno}-${mese}`;
  }
}

function findOrCreateFolder(folderName, parentFolderId) {
  const parentFolder = DriveApp.getFolderById(parentFolderId);
  const existingFolders = parentFolder.getFoldersByName(folderName);
  
  if (existingFolders.hasNext()) {
    return existingFolders.next();
  } else {
    const newFolder = DriveApp.createFolder(folderName);
    parentFolder.addFolder(newFolder);
    return newFolder;
  }
}

// ========== GENERAZIONE DOCUMENTI ==========

function generateDocuments(data, folders) {
  try {
    const documentiCreati = [];

    console.log('🏗️ Avvio generazione documenti standard...');

    // Genera sempre l'incarico di mediazione (unico documento implementato)
    console.log('🏗️ Generando incarico di mediazione...');
    const incaricoResult = generateIncaricoMediazione(data, folders.documenti);
    console.log('📄 Risultato incarico:', incaricoResult);

    if (incaricoResult.success) {
      documentiCreati.push(incaricoResult);
      console.log('✅ Incarico aggiunto alla lista documenti creati');
    } else {
      console.error('❌ Errore nella generazione incarico:', incaricoResult.error);
    }

    // TODO: Aggiungere altri documenti quando saranno implementati
    // - Preventivo imposte
    // - Delega planimetrie
    // - Altri documenti SIAF

    console.log(`📊 Totale documenti creati: ${documentiCreati.length}`);
    console.log('📄 Lista documenti:', documentiCreati);

    return {
      success: true,
      documenti_creati: documentiCreati.length,
      documenti_lista: documentiCreati,
      debug_data_received: data
    };
    
  } catch (error) {
    console.error('❌ Errore generazione documenti:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== GENERAZIONE INCARICO MEDIAZIONE ==========

function generateIncaricoMediazione(data, targetFolder) {
  try {
    console.log('🏗️ === INIZIO GENERAZIONE INCARICO MEDIAZIONE ===');
    console.log('🏗️ Dati ricevuti:', JSON.stringify(data, null, 2));
    console.log('🏗️ Target folder:', targetFolder.getName());
    console.log('🏗️ Lettera ricevuta:', data.lettera);

    // Debug TEMPLATE_MAPPING
    console.log('🔍 TEMPLATE_MAPPING completo:', JSON.stringify(TEMPLATE_MAPPING, null, 2));

    // Trova template per tipo documento (semplificato - un template per tipo)
    // I dati operatore sono ora dinamici tramite {{blocco_agenzia_completo}}
    const tipoDocumento = 'INCARICO_MEDIAZIONE';
    const templateName = TEMPLATE_MAPPING[tipoDocumento];

    console.log('🔍 Template cercato per tipo:', tipoDocumento);
    console.log('🔍 Template trovato:', templateName);
    console.log('🔍 Operatore selezionato:', data.operatore, '- Dati dinamici via placeholder');

    if (!templateName) {
      const availableTypes = Object.keys(TEMPLATE_MAPPING);
      console.error('❌ Template non trovato!');
      console.error('❌ Tipo documento:', tipoDocumento);
      console.error('❌ Tipi disponibili:', availableTypes);
      throw new Error(`Template non trovato per tipo documento: "${tipoDocumento}"`);
    }

    console.log('🔍 Calling findTemplateDocument con:', templateName);
    const templateDoc = findTemplateDocument(templateName);

    if (!templateDoc) {
      console.error('❌ findTemplateDocument ha ritornato null');
      throw new Error(`Template document non trovato: ${templateName} nella cartella INCARICHI`);
    }

    console.log('✅ Template documento trovato! ID:', templateDoc.getId());
    console.log('✅ Template documento nome:', templateDoc.getName());
    
    // Prepara dati per merge
    const mergeData = prepareMergeDataIncarico(data);
    
    // Crea copia del template (templateDoc è ora un File, non un Document)
    const newDocName = `Incarico_Mediazione_${data.protocollo.replace('/', '-')}`;

    console.log(`📋 Nome documento da generare: ${newDocName}`);

    // Rimuovi file esistenti prima della creazione
    removeExistingFile(targetFolder, newDocName);

    // Pausa breve per permettere la cancellazione
    Utilities.sleep(1000);

    console.log(`📄 Creando nuovo documento: ${newDocName}`);
    const newDocFile = templateDoc.makeCopy(newDocName, targetFolder);

    // Controllo aggiuntivo: rimuovi eventuali duplicati creati nel frattempo
    cleanupDuplicates(targetFolder, newDocName, newDocFile.getId());

    console.log('📄 Documento copiato, procedo con merge');
    console.log('📄 Nuovo documento ID:', newDocFile.getId());

    // DEBUG: Verifica dati immobili
    console.log('🔍 DEBUG DATA IMMOBILI:');
    console.log('🔍 data.immobili exists:', !!data.immobili);
    console.log('🔍 data.immobili type:', typeof data.immobili);
    console.log('🔍 data.immobili length:', data.immobili ? data.immobili.length : 'N/A');
    console.log('🔍 data keys:', Object.keys(data));
    console.log('🔍 data completo:', JSON.stringify(data, null, 2));

    // Ora apri il documento per il merge
    const newDoc = DocumentApp.openById(newDocFile.getId());

    // Esegui merge dati
    const mergeResult = performDocumentMerge(newDoc, mergeData, data.immobili || []);

    console.log(`✅ Incarico mediazione generato: ${newDocName}`);

    return {
      success: true,
      tipo: 'incarico_mediazione',
      nome: newDocName,
      url: newDocFile.getUrl(),
      id: newDocFile.getId(),
      debug_merge: mergeResult ? mergeResult.debugInfo : ['Nessun debug disponibile']
    };
    
  } catch (error) {
    console.error('❌ Errore generazione incarico:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== UTILITÀ TEMPLATE ==========

function findTemplateDocument(templateName) {
  try {
    console.log(`🔍 Cercando template: ${templateName}`);
    console.log(`🔍 ID cartella base: ${TEMPLATE_FOLDERS.BASE}`);

    // Accedi direttamente alla cartella template base
    const templatesFolder = DriveApp.getFolderById(TEMPLATE_FOLDERS.BASE);
    console.log(`✅ Cartella templates trovata: ${templatesFolder.getName()}`);

    // Cerca il file template direttamente nella cartella base
    const files = templatesFolder.getFilesByName(templateName);

    if (!files.hasNext()) {
      console.error(`❌ Template ${templateName} non trovato nella cartella base`);
      // Lista tutti i file per debug (limitati ai primi 20)
      const allFiles = templatesFolder.getFiles();
      const fileNames = [];
      let count = 0;
      while (allFiles.hasNext() && count < 20) {
        fileNames.push(allFiles.next().getName());
        count++;
      }
      console.log(`📄 File disponibili (primi 20): ${fileNames.join(', ')}`);
      throw new Error(`Template ${templateName} non trovato nella cartella base`);
    }

    const templateFile = files.next();
    console.log(`✅ Template file trovato: ${templateFile.getName()}`);
    console.log(`✅ Template file ID: ${templateFile.getId()}`);

    return templateFile;

  } catch (error) {
    console.error(`❌ Errore ricerca template ${templateName}:`, error);
    return null;
  }
}

// ========== PREPARAZIONE DATI MERGE ==========

function prepareMergeDataIncarico(data) {
  // Elabora logica venditori basata sul campo sesso
  const venditori = data.venditori || [];
  const isPlural = venditori.length > 1;
  const hasFemmine = venditori.some(v => v.sesso === 'F');

  // Arricchisci venditori con dati quota e natura diritto dal primo immobile
  const immobiliData = data.immobili || [];
  const primoImmobile = immobiliData.length > 0 ? immobiliData[0] : null;
  const venditoriQuote = primoImmobile && primoImmobile.venditori_quote ? primoImmobile.venditori_quote : [];

  const venditoriArricchiti = venditori.map(venditore => {
    const quotaInfo = venditoriQuote.find(vq => vq.venditore_id === venditore.id);
    return {
      ...venditore,
      quota_percentuale: quotaInfo ? quotaInfo.quota_percentuale : null,
      natura_diritto: quotaInfo ? quotaInfo.natura_diritto : null
    };
  });

  // Genera testo venditori completo
  const testoVenditori = generateVenditoriText(venditoriArricchiti);

  // Genera dati immobili e marker per tabelle catastali (già caricati sopra)

  // DEBUG: Log dati immobile per troubleshooting
  console.log('🏠 DEBUG Primo immobile:', JSON.stringify(primoImmobile, null, 2));
  console.log('🏠 DEBUG Immobili totali:', immobiliData.length);

  // Genera marker per tabelle catastali dinamiche
  const catastaliMarker = generateCatastaliMarker(immobiliData);

  // ========== CARICA DATI AGENZIA ==========
  const agenziaData = getAgenziaData(data.operatore);

  if (!agenziaData) {
    console.error(`⚠️ ATTENZIONE: Anagrafica agenzia non trovata per operatore "${data.operatore}"`);
    console.error(`Verifica che esista una riga in Anagrafica_Agenzie con Operatore="${data.operatore}" e Attiva=TRUE`);
  }

  // ========== GENERA PLACEHOLDER CONDIZIONI ECONOMICHE ==========
  const condizioniPlaceholders = prepareCondizioniEconomichePlaceholders(data, agenziaData);

  return {
    // Dati venditori elaborati
    testo_venditori_completo: testoVenditori,
    articolo_venditori: isPlural ? 'i' : (hasFemmine ? 'a' : 'o'),
    denominazione_venditori: isPlural ? 'Venditori' : (hasFemmine ? 'Venditrice' : 'Venditore'),
    articolo_venditori_breve: isPlural ? 'i' : (hasFemmine ? 'la' : 'il'),
    articolo_de_venditori: isPlural ? 'dei' : (hasFemmine ? 'della' : 'del'),
    articolo_da_venditori: isPlural ? 'dai' : (hasFemmine ? 'dalla' : 'dal'),

    // Verbi coniugati in base al numero di venditori
    conferisce_conferiscono: isPlural ? 'CONFERISCONO' : 'CONFERISCE',

    // Dati pratica
    protocollo: data.protocollo,
    operatore: data.operatore,
    data_compilazione: data.data_compilazione,

    // NOTA: Placeholder provincia_immobile, comune_immobile, indirizzo_immobile, intestatario_catastale,
    // tipologia_immobile RIMOSSI - ora ogni immobile ha la sua intestazione completa generata
    // dinamicamente in processTabelleCatastaliDirettamente()

    // Marker per tabelle catastali dinamiche - genera intestazione completa per ogni immobile
    tabelle_catastali_complete: 'TABELLE_CATASTALI_PLACEHOLDER_TEMP',

    // ========== CONDIZIONI ECONOMICHE ==========
    // NOTA: I placeholder per condizioni economiche sono ora generati dinamicamente
    // tramite prepareCondizioniEconomichePlaceholders() e verranno mergiati successivamente

    // Placeholder temporanei (verranno sovrascritti se ci sono condizioni economiche)
    prezzo_vendita: '0,00',
    prezzo_vendita_lettere: 'zero/00',
    prezzo_minimo: '0,00',
    prezzo_minimo_lettere: 'zero/00',

    // Confini: generati dinamicamente dalle tabelle catastali (non come placeholder)

    // ========== PLACEHOLDER AGENZIA ==========

    // Blocchi preformattati (uso principale)
    blocco_intestazione: agenziaData?.blocco_intestazione || '[INTESTAZIONE AGENZIA MANCANTE]',
    blocco_agenzia_completo: agenziaData?.blocco_agenzia_completo || '[DATI AGENZIA MANCANTI - Verificare Anagrafica_Agenzie]',
    blocco_footer: agenziaData?.blocco_footer || '[FOOTER AGENZIA MANCANTE]',

    // Dati agenzia singoli (per uso separato nel template)
    ragione_sociale_agenzia: agenziaData?.ragione_sociale || '',
    indirizzo_agenzia: agenziaData?.indirizzo_completo || '',
    citta_agenzia: agenziaData?.citta_completa || '',
    telefono_agenzia: agenziaData?.telefono || '',
    email_agenzia: agenziaData?.email_1 || '',
    pec_agenzia: agenziaData?.pec || '',
    sito_web_agenzia: agenziaData?.sito_web || '',

    // Dati rappresentante (per uso separato)
    nome_rappresentante: agenziaData?.nome_rappresentante || '',
    cognome_rappresentante: agenziaData?.cognome_rappresentante || '',
    titolo_rappresentante: agenziaData?.titolo_rappresentante || '',
    ruolo_rappresentante: agenziaData?.ruolo_rappresentante || '',

    // Dati da configurare (deprecati - ora provengono da condizioniPlaceholders)
    percentuale_provvigione: '3',
    percentuale_provvigione_lettere: 'tre',
    soglia_minima: '50.000,00',
    importo_minimo: '1.500,00',

    // ========== MERGE CONDIZIONI ECONOMICHE ==========
    // Sovrascrive i placeholder temporanei con i dati reali
    ...condizioniPlaceholders
  };
}

/**
 * Coniuga lo stato civile in base al sesso e aggiunge il regime patrimoniale se presente
 * @param {string} statoCivile - Valore grezzo: libero, coniugato, separato, divorziato, vedovo
 * @param {string} sesso - M o F
 * @param {string} regimePatrimoniale - comunione, separazione, o vuoto
 * @param {boolean} specificareRegime - Se true, include il regime nel testo
 * @returns {string} - Testo formattato correttamente
 */
function coniugaStatoCivileConRegime(statoCivile, sesso, regimePatrimoniale = '', specificareRegime = false) {
  if (!statoCivile) return '';

  const isFemale = sesso === 'F';
  let testoStatoCivile = '';

  // Coniugazione stato civile in base al genere
  switch(statoCivile.toLowerCase()) {
    case 'libero':
      testoStatoCivile = isFemale ? 'libera' : 'libero';
      break;
    case 'coniugato':
      testoStatoCivile = isFemale ? 'coniugata' : 'coniugato';
      break;
    case 'separato':
      testoStatoCivile = isFemale ? 'legalmente separata' : 'legalmente separato';
      break;
    case 'divorziato':
      testoStatoCivile = isFemale ? 'divorziata' : 'divorziato';
      break;
    case 'vedovo':
      testoStatoCivile = isFemale ? 'vedova' : 'vedovo';
      break;
    default:
      testoStatoCivile = statoCivile; // Fallback
  }

  // Aggiungi regime patrimoniale se specificato
  if (specificareRegime && regimePatrimoniale) {
    const testoRegime = regimePatrimoniale === 'comunione' ? 'comunione dei beni' :
                       regimePatrimoniale === 'separazione' ? 'separazione dei beni' :
                       regimePatrimoniale;

    // Solo per coniugato o separato ha senso specificare il regime
    if (statoCivile.toLowerCase() === 'coniugato' || statoCivile.toLowerCase() === 'separato') {
      testoStatoCivile += ` in ${testoRegime}`;
    }
  }

  return testoStatoCivile;
}

// ========== HELPER FUNCTION: NATURA DIRITTO LABEL ==========

/**
 * Converte il codice natura_diritto in label formattata con accordo di genere
 * @param {string} naturaCodice - Codice natura diritto (proprietario, comproprietario, usufruttuario, nudo_proprietario)
 * @param {boolean} isFemale - Se il venditore è di sesso femminile
 * @returns {string} Label formattata
 */
function getNaturaDirectLabel(naturaCodice, isFemale) {
  const labels = {
    'proprietario': isFemale ? 'proprietaria' : 'proprietario',
    'comproprietario': isFemale ? 'comproprietaria' : 'comproprietario',
    'usufruttuario': isFemale ? 'usufruttuaria' : 'usufruttuario',
    'nudo_proprietario': isFemale ? 'nuda proprietaria' : 'nudo proprietario'
  };
  return labels[naturaCodice] || naturaCodice;
}

function generateVenditoriText(venditori) {
  if (!venditori || venditori.length === 0) return '';

  let result = '';

  venditori.forEach((venditore, index) => {
    const isLast = index === venditori.length - 1;
    const tipo = venditore.tipo || 'privato';

    // SWITCH IN BASE AL TIPO SOGGETTO
    switch (tipo) {
      case 'ditta':
        result += generateDittaText(venditore, index, isLast);
        break;

      case 'societa':
        result += generateSocietaText(venditore, index, isLast);
        break;

      case 'privato':
      default:
        result += generatePrivatoText(venditore, index, isLast, venditori);
        break;
    }
  });

  return result;
}

// ========== NUOVE FUNZIONI: GENERAZIONE TESTO PER TIPO SOGGETTO ==========

/**
 * Genera testo per PRIVATO (persona fisica)
 */
function generatePrivatoText(venditore, index, isLast, venditori) {
  const isFemale = venditore.sesso === 'F';
  const isFirst = index === 0;
  let result = '';

  if (isFirst) {
    result += isFemale ? 'La sottoscritta ' : 'Il sottoscritto ';
  } else {
    result += isFemale ? 'la sottoscritta ' : 'il sottoscritto ';
  }

  result += `**${venditore.nome} ${venditore.cognome}**`;

  if (venditore.luogo_nascita && venditore.data_nascita) {
    result += ` nat${isFemale ? 'a' : 'o'} a ${venditore.luogo_nascita} il ${venditore.data_nascita}`;
  }

  if (venditore.codice_fiscale) {
    result += `, codice fiscale ${venditore.codice_fiscale}`;
  }

  if (venditore.cittadinanza) {
    result += `, di cittadinanza ${venditore.cittadinanza}`;
  }

  if (venditore.numero_documento) {
    const tipoDoc = venditore.tipo_documento === 'carta_identita' ? "carta d'identità" :
                   venditore.tipo_documento === 'patente' ? 'patente' :
                   venditore.tipo_documento === 'passaporto' ? 'passaporto' : 'documento';
    result += `, ${tipoDoc} numero ${venditore.numero_documento}`;
  }

  if (venditore.data_rilascio) {
    result += `, data di rilascio ${venditore.data_rilascio}`;
  }

  if (venditore.data_scadenza) {
    result += `, data di scadenza ${venditore.data_scadenza}`;
  }

  // Permesso di soggiorno
  if (venditore.permesso_tipo || venditore.permesso_numero) {
    result += ', titolare di';
    if (venditore.permesso_tipo) {
      const tipiPermesso = {
        'lavoro': 'permesso di soggiorno per lavoro',
        'studio': 'permesso di soggiorno per studio',
        'famiglia': 'permesso di soggiorno per motivi familiari',
        'residenza_elettiva': 'permesso di soggiorno per residenza elettiva',
        'protezione_internazionale': 'permesso di soggiorno per protezione internazionale',
        'lungo_soggiornante': 'permesso di soggiorno UE per soggiornanti di lungo periodo',
        'altro': 'permesso di soggiorno'
      };
      result += ` ${tipiPermesso[venditore.permesso_tipo] || 'permesso di soggiorno'}`;
    }
    if (venditore.permesso_numero) result += ` numero ${venditore.permesso_numero}`;
    if (venditore.permesso_rilascio) result += `, rilasciato in data ${venditore.permesso_rilascio}`;
    if (venditore.permesso_scadenza) result += `, con scadenza ${venditore.permesso_scadenza}`;
    if (venditore.permesso_questura) result += `, dalla ${venditore.permesso_questura}`;
  }

  if (venditore.citta && venditore.provincia) {
    result += `, residente a ${venditore.citta}, provincia di ${getNomeProvinciaCompleto(venditore.provincia)}`;
  }

  if (venditore.indirizzo) {
    result += `, ${venditore.indirizzo}`;
  }

  if (venditore.stato_civile) {
    const statoCivileConiugato = coniugaStatoCivileConRegime(
      venditore.stato_civile,
      venditore.sesso,
      venditore.regime_patrimoniale || '',
      venditore.specificare_regime || false
    );
    result += `, di stato civile ${statoCivileConiugato}`;
  }

  const telefoni = [venditore.telefono1, venditore.telefono2].filter(t => t && t.trim() !== '');
  if (telefoni.length > 0) {
    result += `, telefono ${telefoni.join(', ')}`;
  }

  const emails = [venditore.email1, venditore.email2].filter(e => e && e.trim() !== '');
  if (emails.length > 0) {
    result += `, indirizzo di posta elettronica ${emails.join(', ')}`;
  }

  // Aggiunge quota e natura del diritto se presenti
  if (venditore.natura_diritto && venditore.quota_percentuale !== null && venditore.quota_percentuale !== undefined) {
    const naturaLabel = getNaturaDirectLabel(venditore.natura_diritto, isFemale);
    result += `, ${naturaLabel} per la quota del ${venditore.quota_percentuale}%`;
  } else if (venditore.natura_diritto) {
    const naturaLabel = getNaturaDirectLabel(venditore.natura_diritto, isFemale);
    result += `, ${naturaLabel}`;
  }

  if (!isLast) {
    result += ';\n';
  }

  return result;
}

/**
 * Genera testo per DITTA (impresa individuale)
 * Template: "Il sottoscritto [titolare]... nella sua qualità di titolare della [ditta]..."
 */
function generateDittaText(venditore, index, isLast) {
  const isFemale = venditore.titolare_sesso === 'F';
  const isFirst = index === 0;
  let result = '';

  // Titolare (persona fisica)
  if (isFirst) {
    result += isFemale ? 'La sottoscritta ' : 'Il sottoscritto ';
  } else {
    result += isFemale ? 'la sottoscritta ' : 'il sottoscritto ';
  }

  result += `**${venditore.titolare_nome} ${venditore.titolare_cognome}**`;

  if (venditore.titolare_luogo_nascita && venditore.titolare_data_nascita) {
    result += ` nat${isFemale ? 'a' : 'o'} a ${venditore.titolare_luogo_nascita} il ${venditore.titolare_data_nascita}`;
  }

  if (venditore.cf_titolare) {
    result += `, codice fiscale ${venditore.cf_titolare}`;
  }

  // Cittadinanza titolare
  if (venditore.titolare_cittadinanza) {
    result += `, di cittadinanza ${venditore.titolare_cittadinanza}`;
  }

  // Documento titolare
  if (venditore.titolare_numero_documento) {
    const tipoDoc = venditore.titolare_tipo_documento === 'carta_identita' ? "carta d'identità" :
                   venditore.titolare_tipo_documento === 'patente' ? 'patente' :
                   venditore.titolare_tipo_documento === 'passaporto' ? 'passaporto' : 'documento';
    result += `, ${tipoDoc} numero ${venditore.titolare_numero_documento}`;

    if (venditore.titolare_data_rilascio) {
      result += `, rilasciat${isFemale ? 'a' : 'o'} in data ${venditore.titolare_data_rilascio}`;
    }
    if (venditore.titolare_data_scadenza) {
      result += `, con scadenza ${venditore.titolare_data_scadenza}`;
    }
  }

  // Qualità di titolare/legale rappresentante
  result += `, **nella sua qualità di ${isFemale ? 'titolare' : 'titolare'}** della `;

  // Dati ditta
  if (venditore.denominazione_ditta) {
    result += `**${venditore.denominazione_ditta}**`;
  } else {
    result += '**[DENOMINAZIONE DITTA]**';
  }

  // Sede ditta
  if (venditore.sede_ditta_via && venditore.sede_ditta_comune && venditore.sede_ditta_provincia) {
    result += `, con sede in ${venditore.sede_ditta_via}`;
    if (venditore.sede_ditta_numero) result += ` n. ${venditore.sede_ditta_numero}`;
    result += `, ${venditore.sede_ditta_comune}`;
    if (venditore.sede_ditta_cap) result += ` (CAP ${venditore.sede_ditta_cap})`;
    result += `, provincia di ${getNomeProvinciaCompleto(venditore.sede_ditta_provincia)}`;
    if (venditore.sede_ditta_stato && venditore.sede_ditta_stato !== 'Italia') {
      result += `, ${venditore.sede_ditta_stato}`;
    }
  }

  // P.IVA e CF ditta
  if (venditore.piva_ditta) {
    result += `, partita IVA ${venditore.piva_ditta}`;
  }
  if (venditore.cf_ditta) {
    result += `, codice fiscale ${venditore.cf_ditta}`;
  }

  // REA
  if (venditore.rea_numero_ditta && venditore.rea_cciaa_ditta) {
    result += `, iscritta al REA di ${venditore.rea_cciaa_ditta} al numero ${venditore.rea_numero_ditta}`;
  } else if (venditore.rea_numero_ditta) {
    result += `, numero REA ${venditore.rea_numero_ditta}`;
  }

  // Contatti ditta
  if (venditore.pec_ditta) {
    result += `, PEC ${venditore.pec_ditta}`;
  }
  if (venditore.codice_destinatario_ditta) {
    result += `, codice destinatario ${venditore.codice_destinatario_ditta}`;
  }
  if (venditore.email_ditta) {
    result += `, email ${venditore.email_ditta}`;
  }
  if (venditore.telefono_ditta) {
    result += `, telefono ${venditore.telefono_ditta}`;
  }

  // Domicilio per la carica (se diverso dalla sede)
  if (venditore.titolare_domicilio_presso_sede === false && venditore.titolare_domicilio_via && venditore.titolare_domicilio_comune) {
    result += `, domiciliat${isFemale ? 'a' : 'o'} per la carica in ${venditore.titolare_domicilio_via}`;
    if (venditore.titolare_domicilio_numero) result += ` n. ${venditore.titolare_domicilio_numero}`;
    result += `, ${venditore.titolare_domicilio_comune}`;
    if (venditore.titolare_domicilio_provincia) {
      result += ` (${getNomeProvinciaCompleto(venditore.titolare_domicilio_provincia)})`;
    }
  } else if (venditore.titolare_domicilio_presso_sede !== false) {
    result += `, domiciliat${isFemale ? 'a' : 'o'} per la carica presso la sede sociale`;
  }

  if (!isLast) {
    result += ';\n';
  }

  return result;
}

/**
 * Genera testo per SOCIETÀ
 * Template: "La società [ragione sociale]... nella persona del legale rappresentante..."
 */
function generateSocietaText(venditore, index, isLast) {
  const isFirst = index === 0;
  let result = '';

  // Inizio (società come soggetto principale)
  if (isFirst) {
    result += 'La società ';
  } else {
    result += 'la società ';
  }

  // Ragione sociale
  if (venditore.ragione_sociale) {
    result += `**${venditore.ragione_sociale}**`;
  } else {
    result += '**[RAGIONE SOCIALE]**';
  }

  // Sede
  if (venditore.sede_societa_via && venditore.sede_societa_comune && venditore.sede_societa_provincia) {
    result += `, con sede in ${venditore.sede_societa_via}`;
    if (venditore.sede_societa_numero) result += ` n. ${venditore.sede_societa_numero}`;
    result += `, ${venditore.sede_societa_comune}`;
    if (venditore.sede_societa_cap) result += ` (CAP ${venditore.sede_societa_cap})`;
    result += `, provincia di ${getNomeProvinciaCompleto(venditore.sede_societa_provincia)}`;
    if (venditore.sede_societa_stato && venditore.sede_societa_stato !== 'Italia') {
      result += `, ${venditore.sede_societa_stato}`;
    }
  }

  // P.IVA e CF
  if (venditore.piva_societa) {
    result += `, partita IVA ${venditore.piva_societa}`;
  }
  if (venditore.cf_societa) {
    result += `, codice fiscale ${venditore.cf_societa}`;
  }

  // Registro Imprese
  if (venditore.ri_numero && venditore.ri_cciaa) {
    result += `, iscritta al Registro delle Imprese di ${venditore.ri_cciaa} al numero ${venditore.ri_numero}`;
  } else if (venditore.ri_numero) {
    result += `, numero di iscrizione al Registro delle Imprese ${venditore.ri_numero}`;
  }

  // REA
  if (venditore.rea_numero_societa && venditore.rea_cciaa_societa) {
    result += `, iscritta al REA di ${venditore.rea_cciaa_societa} al numero ${venditore.rea_numero_societa}`;
  } else if (venditore.rea_numero_societa) {
    result += `, numero REA ${venditore.rea_numero_societa}`;
  }

  // Contatti società
  if (venditore.pec_societa) {
    result += `, PEC ${venditore.pec_societa}`;
  }
  if (venditore.codice_destinatario_societa) {
    result += `, codice destinatario ${venditore.codice_destinatario_societa}`;
  }
  if (venditore.email_societa) {
    result += `, email ${venditore.email_societa}`;
  }
  if (venditore.telefono_societa) {
    result += `, telefono ${venditore.telefono_societa}`;
  }

  // RAPPRESENTANZA
  const tipoRapp = venditore.tipo_rappresentanza || 'persona_fisica';

  if (tipoRapp === 'persona_fisica') {
    // Rappresentante persona fisica
    const isFemale = venditore.rappresentante_sesso === 'F';
    result += `, **nella persona del${isFemale ? 'la' : ''} legale rappresentante**, ${isFemale ? 'Signora' : 'Signor'} `;

    if (venditore.rappresentante_nome && venditore.rappresentante_cognome) {
      result += `**${venditore.rappresentante_nome} ${venditore.rappresentante_cognome}**`;
    } else {
      result += '**[NOME COGNOME RAPPRESENTANTE]**';
    }

    if (venditore.rappresentante_luogo_nascita && venditore.rappresentante_data_nascita) {
      result += ` nat${isFemale ? 'a' : 'o'} a ${venditore.rappresentante_luogo_nascita} il ${venditore.rappresentante_data_nascita}`;
    }

    if (venditore.rappresentante_cf) {
      result += `, codice fiscale ${venditore.rappresentante_cf}`;
    }

    // Cittadinanza rappresentante
    if (venditore.rappresentante_cittadinanza) {
      result += `, di cittadinanza ${venditore.rappresentante_cittadinanza}`;
    }

    // Documento rappresentante
    if (venditore.rappresentante_numero_documento) {
      const tipoDoc = venditore.rappresentante_tipo_documento === 'carta_identita' ? "carta d'identità" :
                     venditore.rappresentante_tipo_documento === 'patente' ? 'patente' :
                     venditore.rappresentante_tipo_documento === 'passaporto' ? 'passaporto' : 'documento';
      result += `, ${tipoDoc} numero ${venditore.rappresentante_numero_documento}`;

      if (venditore.rappresentante_data_rilascio) {
        result += `, rilasciat${isFemale ? 'a' : 'o'} in data ${venditore.rappresentante_data_rilascio}`;
      }
      if (venditore.rappresentante_data_scadenza) {
        result += `, con scadenza ${venditore.rappresentante_data_scadenza}`;
      }
    }

    // Domicilio per la carica
    if (venditore.rappresentante_domicilio_presso_sede === false && venditore.rappresentante_domicilio_via && venditore.rappresentante_domicilio_comune) {
      result += `, domiciliat${isFemale ? 'a' : 'o'} per la carica in ${venditore.rappresentante_domicilio_via}`;
      if (venditore.rappresentante_domicilio_numero) result += ` n. ${venditore.rappresentante_domicilio_numero}`;
      result += `, ${venditore.rappresentante_domicilio_comune}`;
      if (venditore.rappresentante_domicilio_provincia) {
        result += ` (${getNomeProvinciaCompleto(venditore.rappresentante_domicilio_provincia)})`;
      }
    } else if (venditore.rappresentante_domicilio_presso_sede !== false) {
      result += `, domiciliat${isFemale ? 'a' : 'o'} per la carica presso la sede sociale`;
    }
  } else {
    // Società-amministratore + Designato
    result += `, **amministrata da ${venditore.soc_amm_ragione_sociale || '[SOCIETÀ AMMINISTRATORE]'}**`;

    // Sede società-amministratore
    if (venditore.soc_amm_sede_via && venditore.soc_amm_sede_comune) {
      result += `, con sede in ${venditore.soc_amm_sede_via}`;
      if (venditore.soc_amm_sede_numero) result += ` n. ${venditore.soc_amm_sede_numero}`;
      result += `, ${venditore.soc_amm_sede_comune}`;
      if (venditore.soc_amm_sede_provincia) {
        result += ` (${getNomeProvinciaCompleto(venditore.soc_amm_sede_provincia)})`;
      }
    }

    // P.IVA e CF società-amministratore
    if (venditore.soc_amm_piva) result += `, partita IVA ${venditore.soc_amm_piva}`;
    if (venditore.soc_amm_cf) result += `, codice fiscale ${venditore.soc_amm_cf}`;
    if (venditore.soc_amm_ri_numero) result += `, RI ${venditore.soc_amm_ri_numero}`;
    if (venditore.soc_amm_rea_numero) result += `, REA ${venditore.soc_amm_rea_numero}`;
    if (venditore.soc_amm_pec) result += `, PEC ${venditore.soc_amm_pec}`;

    // Designato (persona fisica obbligatoria)
    const isFemale = venditore.designato_sesso === 'F';
    result += `, **in persona del${isFemale ? 'la' : ''} designat${isFemale ? 'a' : 'o'}** ${isFemale ? 'Signora' : 'Signor'} `;

    if (venditore.designato_nome && venditore.designato_cognome) {
      result += `**${venditore.designato_nome} ${venditore.designato_cognome}**`;
    } else {
      result += '**[NOME COGNOME DESIGNATO]**';
    }

    if (venditore.designato_luogo_nascita && venditore.designato_data_nascita) {
      result += ` nat${isFemale ? 'a' : 'o'} a ${venditore.designato_luogo_nascita} il ${venditore.designato_data_nascita}`;
    }

    if (venditore.designato_cf) {
      result += `, codice fiscale ${venditore.designato_cf}`;
    }

    // Cittadinanza designato
    if (venditore.designato_cittadinanza) {
      result += `, di cittadinanza ${venditore.designato_cittadinanza}`;
    }

    // Documento designato
    if (venditore.designato_numero_documento) {
      const tipoDoc = venditore.designato_tipo_documento === 'carta_identita' ? "carta d'identità" :
                     venditore.designato_tipo_documento === 'patente' ? 'patente' :
                     venditore.designato_tipo_documento === 'passaporto' ? 'passaporto' : 'documento';
      result += `, ${tipoDoc} numero ${venditore.designato_numero_documento}`;

      if (venditore.designato_data_rilascio) {
        result += `, rilasciat${isFemale ? 'a' : 'o'} in data ${venditore.designato_data_rilascio}`;
      }
      if (venditore.designato_data_scadenza) {
        result += `, con scadenza ${venditore.designato_data_scadenza}`;
      }
    }

    // Domicilio designato
    if (venditore.designato_domicilio_presso_sede === false && venditore.designato_domicilio_via && venditore.designato_domicilio_comune) {
      result += `, domiciliat${isFemale ? 'a' : 'o'} per la carica in ${venditore.designato_domicilio_via}`;
      if (venditore.designato_domicilio_numero) result += ` n. ${venditore.designato_domicilio_numero}`;
      result += `, ${venditore.designato_domicilio_comune}`;
      if (venditore.designato_domicilio_provincia) {
        result += ` (${getNomeProvinciaCompleto(venditore.designato_domicilio_provincia)})`;
      }
    } else if (venditore.designato_domicilio_presso_sede !== false) {
      result += `, domiciliat${isFemale ? 'a' : 'o'} per la carica presso la sede della società amministratrice`;
    }
  }

  if (!isLast) {
    result += ';\n';
  }

  return result;
}

// ========== BLOCCO: PREPARAZIONE PLACEHOLDER CONDIZIONI ECONOMICHE ==========

/**
 * Converte un numero in testo italiano con formato /00 per i decimali
 * Esempio: 60000 -> "sessantamila/00"
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
    const centinaia = Math.floor(num / 100);
    if (centinaia > 0) {
      risultato += (centinaia === 1 ? 'cento' : unita[centinaia] + 'cento');
    }
    const resto = num % 100;
    if (resto >= 10 && resto < 20) {
      risultato += teens[resto - 10];
    } else {
      const decina = Math.floor(resto / 10);
      const unita_resto = resto % 10;
      if (decina > 0) {
        risultato += decine[decina];
        if (unita_resto === 1 || unita_resto === 8) {
          risultato = risultato.slice(0, -1);
        }
      }
      if (unita_resto > 0) {
        risultato += unita[unita_resto];
      }
    }
    return risultato;
  }

  const numeroInt = Math.floor(numero);
  const milioni = Math.floor(numeroInt / 1000000);
  const migliaia = Math.floor((numeroInt % 1000000) / 1000);
  const centinaia = numeroInt % 1000;

  let risultato = '';

  if (milioni > 0) {
    if (milioni === 1) {
      risultato += 'unmilione';
    } else {
      risultato += convertiCentinaia(milioni) + 'milioni';
    }
  }

  if (migliaia > 0) {
    if (migliaia === 1) {
      risultato += 'mille';
    } else {
      risultato += convertiCentinaia(migliaia) + 'mila';
    }
  }

  if (centinaia > 0) {
    risultato += convertiCentinaia(centinaia);
  }

  return includiDecimali ? risultato + '/00' : risultato;
}

/**
 * Formatta un numero come valuta italiana
 * Esempio: 60000 -> "60.000,00"
 */
function formatCurrency(numero) {
  if (!numero || isNaN(numero)) return '0,00';
  const numeroInt = Math.floor(numero);
  return numeroInt.toLocaleString('it-IT') + ',00';
}

/**
 * Prepara tutti i placeholder per le condizioni economiche
 */
function prepareCondizioniEconomichePlaceholders(data, agenziaData) {
  const condizioni = data.condizioni_economiche || {};
  const immobili = data.immobili || [];
  const placeholders = {};

  // Estrai dati agenzia per sostituzione nei testi generati
  const datiAgenzia = {
    ragione_sociale: agenziaData?.ragione_sociale || '',
    email: agenziaData?.email_1 || '',
    pec: agenziaData?.pec || '',
    telefono: agenziaData?.telefono || ''
  };

  console.log('💰 === PREPARAZIONE PLACEHOLDER CONDIZIONI ECONOMICHE ===');
  console.log('💰 Modalità prezzo:', condizioni.modalita_prezzo);
  console.log('💰 Numero immobili:', immobili.length);

  // ========== SEZIONE PREZZO ==========
  if (condizioni.modalita_prezzo === 'offerta_unica' && condizioni.prezzo_forfettario) {
    // OFFERTA UNICA - prezzo unico per tutti gli immobili
    const prezzoTotale = condizioni.prezzo_forfettario.prezzo_totale || 0;
    const percRiduzione = condizioni.prezzo_forfettario.percentuale_riduzione || 0;

    placeholders.prezzo_vendita = formatCurrency(prezzoTotale);
    placeholders.prezzo_vendita_lettere = numeroInLettere(prezzoTotale, true);

    if (percRiduzione > 0) {
      const prezzoMinimo = Math.round(prezzoTotale * (1 - percRiduzione / 100));
      placeholders.prezzo_minimo = formatCurrency(prezzoMinimo);
      placeholders.prezzo_minimo_lettere = numeroInLettere(prezzoMinimo, true);
      placeholders.percentuale_riduzione = percRiduzione.toString();
    }

    placeholders.tipo_offerta = 'gruppo_immobili';
    console.log('💰 Offerta unica - Prezzo:', placeholders.prezzo_vendita);
  } else {
    // PREZZI SINGOLI - genera placeholder per ogni immobile
    immobili.forEach((immobile, index) => {
      const cond = immobile.condizioni_economiche || {};
      const prezzoVendita = cond.prezzo_vendita || 0;
      const percRiduzione = cond.percentuale_riduzione || 0;

      const immobileNum = index + 1;

      placeholders[`prezzo_vendita_immobile_${immobileNum}`] = formatCurrency(prezzoVendita);
      placeholders[`prezzo_vendita_lettere_immobile_${immobileNum}`] = numeroInLettere(prezzoVendita, true);

      if (percRiduzione > 0) {
        const prezzoMinimo = Math.round(prezzoVendita * (1 - percRiduzione / 100));
        placeholders[`prezzo_minimo_immobile_${immobileNum}`] = formatCurrency(prezzoMinimo);
        placeholders[`prezzo_minimo_lettere_immobile_${immobileNum}`] = numeroInLettere(prezzoMinimo, true);
        placeholders[`percentuale_riduzione_immobile_${immobileNum}`] = percRiduzione.toString();
      }

      console.log(`💰 Immobile ${immobileNum} - Prezzo:`, placeholders[`prezzo_vendita_immobile_${immobileNum}`]);
    });

    // Per retrocompatibilità, usa i dati del primo immobile per i placeholder generici
    if (immobili.length > 0 && immobili[0].condizioni_economiche) {
      const primoPrezzo = immobili[0].condizioni_economiche.prezzo_vendita || 0;
      placeholders.prezzo_vendita = formatCurrency(primoPrezzo);
      placeholders.prezzo_vendita_lettere = numeroInLettere(primoPrezzo, true);
    }

    placeholders.tipo_offerta = 'per_immobile';
  }

  // ========== COMPENSO MEDIAZIONE ==========
  if (condizioni.compenso) {
    placeholders.percentuale_provvigione = (condizioni.compenso.percentuale_provvigione || 3).toString();
    placeholders.percentuale_provvigione_lettere = numeroInLettere(condizioni.compenso.percentuale_provvigione || 3, false);
    placeholders.soglia_minima = formatCurrency(condizioni.compenso.soglia_minima || 50000);
    placeholders.importo_minimo = formatCurrency(condizioni.compenso.importo_minimo || 1500);

    console.log('💰 Compenso - Provvigione:', placeholders.percentuale_provvigione + '%');
  }

  // ========== DURATA INCARICO ==========
  if (condizioni.durata) {
    placeholders.data_inizio_incarico = condizioni.durata.data_inizio || '';
    placeholders.data_fine_incarico = condizioni.durata.data_fine || '';
    placeholders.tipo_rinnovo = condizioni.durata.tipo_rinnovo || 'cessato';

    // Testo rinnovo in formato leggibile
    const tipoRinnovoTesti = {
      'cessato': 'cessato a scadenza',
      'tacito_continuo': 'tacito rinnovo continuo',
      'tacito_annuale': 'tacito rinnovo annuale',
      'automatico': 'automatico per 6 mesi'
    };
    placeholders.testo_rinnovo = tipoRinnovoTesti[condizioni.durata.tipo_rinnovo] || 'cessato a scadenza';

    if (condizioni.durata.tipo_rinnovo === 'tacito_continuo') {
      placeholders.giorni_preavviso = (condizioni.durata.giorni_preavviso || 30).toString();
      placeholders.testo_preavviso = `con preavviso di ${placeholders.giorni_preavviso} giorni`;
    } else {
      placeholders.testo_preavviso = '';
    }

    console.log('💰 Durata -', placeholders.data_inizio_incarico, 'al', placeholders.data_fine_incarico);
  }

  // ========== ESCLUSIVA ==========
  if (condizioni.esclusiva) {
    placeholders.esclusiva_attiva = condizioni.esclusiva.attiva ? 'SI' : 'NO';
    placeholders.testo_esclusiva = condizioni.esclusiva.attiva
      ? (condizioni.esclusiva.testo_custom || 'Incarico conferito in esclusiva.')
      : '';

    console.log('💰 Esclusiva:', placeholders.esclusiva_attiva);
  }

  // ========== SEZIONI COMPLETE PREFORMATE ==========
  // Genera sezioni complete con testo e checkbox già formattate

  // SEZIONE PREZZO COMPLETA
  placeholders.sezione_prezzo_completa = generaSezionePrezzo(condizioni, immobili);

  // SEZIONE COMPENSO COMPLETA
  placeholders.sezione_compenso_completa = generaSezioneCompenso(condizioni.compenso, datiAgenzia);

  // SEZIONE RINNOVO COMPLETA
  placeholders.sezione_rinnovo_completa = generaSezioneRinnovo(condizioni.durata, datiAgenzia);

  // SEZIONE ESCLUSIVA COMPLETA
  placeholders.sezione_esclusiva_completa = generaSezioneEsclusiva(condizioni.esclusiva);

  // SEZIONE CONDIZIONI DI PAGAMENTO COMPLETA
  placeholders.sezione_condizioni_pagamento_completa = generaSezioneCondizionipagamento(condizioni.condizioni_pagamento);

  // SEZIONE ATTO NOTARILE COMPLETA
  placeholders.sezione_atto_notarile_completa = generaSezioneAttoNotarile(condizioni.condizioni_pagamento);

  // SEZIONE OBBLIGHI AGENZIA COMPLETA
  placeholders.sezione_obblighi_agenzia_completa = generaSezioneObblighi(condizioni.esclusiva.attiva);

  // SEZIONE CORRISPONDENTI E AUTORIZZAZIONI COMPLETA
  placeholders.sezione_corrispondenti_completa = generaSezioneCorrispondenti(condizioni.autorizzazioni);

  // SEZIONE COMUNICAZIONI ED ACCETTAZIONE INCARICO COMPLETA
  const venditori = data.venditori || [];
  placeholders.sezione_comunicazioni_completa = generaSezioneComunicazioni(venditori);

  // SEZIONE DIRITTO DI RECESSO COMPLETA
  placeholders.sezione_diritto_recesso_completa = generaSezioneDirittoRecesso(condizioni.diritto_recesso, datiAgenzia);

  // OSSERVAZIONI E NOTE
  placeholders.osservazioni_note = condizioni.osservazioni || '';

  // SEZIONE FIRME E DATE COMPLETA
  placeholders.sezione_firme_date_completa = generaSezioneFireDate(condizioni.firma, venditori);

  console.log('💰 === FINE PREPARAZIONE PLACEHOLDER ===');
  console.log('💰 Totale placeholder generati:', Object.keys(placeholders).length);

  return placeholders;
}

// ========== FUNZIONI GENERAZIONE SEZIONI COMPLETE ==========

/**
 * Genera sezione PREZZO completa con testo formattato
 */
function generaSezionePrezzo(condizioni, immobili) {
  let testo = '';

  if (condizioni.modalita_prezzo === 'offerta_unica' && condizioni.prezzo_forfettario) {
    // OFFERTA UNICA
    const prezzoTotale = condizioni.prezzo_forfettario.prezzo_totale || 0;
    const percRiduzione = condizioni.prezzo_forfettario.percentuale_riduzione || 0;

    testo = `Euro ${formatCurrency(prezzoTotale)} (${numeroInLettere(prezzoTotale, true)})`;

    if (percRiduzione > 0) {
      const prezzoMinimo = Math.round(prezzoTotale * (1 - percRiduzione / 100));
      testo += `, con possibilità di trattativa in riduzione fino a un massimo del ${percRiduzione}%, fino a Euro ${formatCurrency(prezzoMinimo)} (${numeroInLettere(prezzoMinimo, true)})`;
    }

    testo += '. Indipendentemente dai prezzi citati, il prezzo complessivo e finale sarà quello che il Venditore riterrà di accettare, in seguito alle proposte d\'acquisto che riceverà.';

  } else {
    // PREZZI SINGOLI PER IMMOBILE
    const immobiliCompilati = immobili.filter(imm => imm.provincia && imm.comune);

    if (immobiliCompilati.length === 0) {
      testo = '[PREZZI DA DEFINIRE - Nessun immobile compilato]';
    } else if (immobiliCompilati.length === 1) {
      // Un solo immobile - testo semplice
      const cond = immobiliCompilati[0].condizioni_economiche || {};
      const prezzoVendita = cond.prezzo_vendita || 0;
      const percRiduzione = cond.percentuale_riduzione || 0;

      testo = `Euro ${formatCurrency(prezzoVendita)} (${numeroInLettere(prezzoVendita, true)})`;

      if (percRiduzione > 0) {
        const prezzoMinimo = Math.round(prezzoVendita * (1 - percRiduzione / 100));
        testo += `, con possibilità di trattativa in riduzione fino a un massimo del ${percRiduzione}%, fino a Euro ${formatCurrency(prezzoMinimo)} (${numeroInLettere(prezzoMinimo, true)})`;
      }

      testo += '. Indipendentemente dai prezzi citati, il prezzo complessivo e finale sarà quello che il Venditore riterrà di accettare, in seguito alle proposte d\'acquisto che riceverà.';

    } else {
      // Più immobili - elenco
      testo = 'Prezzi richiesti per i singoli immobili:\n\n';

      immobiliCompilati.forEach((immobile, index) => {
        const cond = immobile.condizioni_economiche || {};
        const prezzoVendita = cond.prezzo_vendita || 0;
        const percRiduzione = cond.percentuale_riduzione || 0;

        const indirizzo = `${immobile.via || '[VIA]'} n. ${immobile.numero || '[N.]'}, ${immobile.comune || '[COMUNE]'} (${getNomeProvinciaCompleto(immobile.provincia) || '[PROV]'})`;

        testo += `Immobile ${index + 1} - ${indirizzo}:\n`;
        testo += `Euro ${formatCurrency(prezzoVendita)} (${numeroInLettere(prezzoVendita, true)})`;

        if (percRiduzione > 0) {
          const prezzoMinimo = Math.round(prezzoVendita * (1 - percRiduzione / 100));
          testo += `, con possibilità di trattativa in riduzione fino a un massimo del ${percRiduzione}%, fino a Euro ${formatCurrency(prezzoMinimo)} (${numeroInLettere(prezzoMinimo, true)})`;
        }

        testo += '.\n\n';
      });

      testo += 'Indipendentemente dai prezzi citati, il prezzo complessivo e finale sarà quello che il Venditore riterrà di accettare, in seguito alle proposte d\'acquisto che riceverà.';
    }
  }

  return testo;
}

/**
 * Genera sezione COMPENSO MEDIAZIONE completa
 */
function generaSezioneCompenso(compenso, datiAgenzia) {
  if (!compenso) return '';

  const percProvvigione = compenso.percentuale_provvigione || 3;
  const percLettere = numeroInLettere(percProvvigione, false);
  const sogliaMinima = formatCurrency(compenso.soglia_minima || 50000);
  const importoMinimo = formatCurrency(compenso.importo_minimo || 1500);

  const ragioneSociale = datiAgenzia?.ragione_sociale || '{{ragione_sociale_agenzia}}';

  let testo = `Provvigione ${percProvvigione}% (${percLettere} per cento) più IVA, sul prezzo di vendita se uguale o superiore a Euro ${sogliaMinima}, con un minimo di ${importoMinimo} più IVA. `;
  testo += `Il compenso maturerà all'avvenuta conoscenza da parte dell'acquirente dell'accettazione della proposta d'acquisto e sarà corrisposto dal Venditore all'agenzia d'affari "${ragioneSociale}". `;
  testo += `La provvigione pattuita sarà comunque dovuta, nel caso di vendita o promessa di vendita con soggetti che l'Agenzia Immobiliare abbia segnalato in esecuzione dell'incarico, anche qualora la stipulazione avvenga dopo la scadenza di quest'ultimo o la vendita si realizzi per interposta persona fisica o giuridica.`;

  return testo;
}

/**
 * Genera sezione RINNOVO - solo opzione scelta (senza checkbox)
 */
function generaSezioneRinnovo(durata, datiAgenzia) {
  if (!durata) return '';

  const tipoRinnovo = durata.tipo_rinnovo || 'cessato';
  let testo = 's\'intenderà ';

  // Estrai dati agenzia con fallback ai placeholder
  const ragioneSociale = datiAgenzia?.ragione_sociale || '{{ragione_sociale_agenzia}}';
  const email = datiAgenzia?.email || '{{email_agenzia}}';
  const pec = datiAgenzia?.pec || '{{pec_agenzia}}';
  const telefono = datiAgenzia?.telefono || '{{telefono_agenzia}}';

  switch (tipoRinnovo) {
    case 'cessato':
      testo += 'cessato a tutti gli effetti senza oneri e vincoli per il Venditore.';
      break;

    case 'tacito_unico':
      testo += 'tacitamente rinnovato per ugual periodo e per una sola volta alle stesse condizioni.';
      break;

    case 'tacito_continuo':
      testo += 'tacitamente rinnovato per ugual periodo, e così di seguito, fino alla vendita dell\'immobile';

      if (durata.giorni_preavviso) {
        const giorni = durata.giorni_preavviso;
        const giorniLettere = numeroInLettere(giorni, false);
        testo += `, salvo disdetta da inviarsi non prima del termine del secondo periodo di rinnovo, all'agenzia d'affari "${ragioneSociale}" a mezzo lettera raccomandata o e-mail agli indirizzi ${email}, oppure all'indirizzo ${pec}, telegramma o telefax al numero ${telefono}, almeno ${giorni} (${giorniLettere}) giorni prima della scadenza del periodo.`;
      } else {
        testo += '.';
      }
      break;

    default:
      testo += 'cessato a tutti gli effetti senza oneri e vincoli per il Venditore.';
  }

  return testo;
}

/**
 * Genera sezione ESCLUSIVA - solo opzione scelta (senza checkbox)
 */
function generaSezioneEsclusiva(esclusiva) {
  if (!esclusiva) return '';

  const isEsclusiva = esclusiva.attiva;
  let testo = '';

  if (isEsclusiva) {
    // INCARICO IN ESCLUSIVA
    testo += 'Il presente incarico viene conferito IN ESCLUSIVA.\n\n';
    testo += 'Il Venditore s\'impegna a non conferire incarico ad altre agenzie immobiliari, né a terzi, né a vendere l\'immobile per tutto il periodo di validità dell\'incarico. La violazione dell\'obbligo di esclusiva, sia nel caso di conferimento d\'incarico ad altre agenzie e/o a terzi, che per il caso di vendita effettuata direttamente dal Venditore, comporterà il pagamento da parte di quest\'ultimo della penale prevista al successivo punto.\n\n';
    testo += 'Nell\'ipotesi di conferimento dell\'incarico in esclusiva l\'Agenzia Immobiliare s\'impegna a rinunciare al rimborso delle spese che sosterrà per l\'esecuzione dell\'incarico, anche in caso di mancata conclusione dell\'affare, fatto salvo il rimborso delle spese preventivate ed autorizzate.';

    // Testo custom (se presente)
    if (esclusiva.testo_custom && esclusiva.testo_custom.trim() !== '') {
      testo += `\n\nNote aggiuntive sull'esclusiva:\n${esclusiva.testo_custom}`;
    }

  } else {
    // INCARICO NON IN ESCLUSIVA
    testo += 'Il presente incarico viene conferito NON IN ESCLUSIVA.\n\n';
    testo += 'Il Venditore potrà vendere l\'immobile direttamente o tramite altre agenzie immobiliari senza nulla dovere all\'Agenzia Immobiliare a titolo di provvigione o penale, impegnandosi però a comunicare tempestivamente all\'Agenzia Immobiliare l\'avvenuta accettazione di una proposta d\'acquisto e a rimborsare alla stessa le spese documentate sostenute nell\'esecuzione del presente incarico anche in caso di mancata vendita. ';

    // Spese massime autorizzate (se specificate)
    const speseMax = esclusiva.spese_massime || 0;
    const speseMaxLettere = numeroInLettere(speseMax, false);

    testo += `Il Venditore autorizza fin d'ora l'Agenzia Immobiliare a fare tali spese fino all'ammontare massimo di €uro ${speseMax.toFixed(2).replace('.', ',')} (${speseMaxLettere}/00).`;
  }

  return testo;
}

/**
 * BLOCCO 7: GENERAZIONE SEZIONE CONDIZIONI DI PAGAMENTO - VERSIONE COMPLETA
 *
 * Genera il testo formattato completo per le condizioni di pagamento
 * Include: versamento anticipo, modalità saldo, stipula atto, clausole mutuo e deposito notarile
 */
function generaSezioneCondizionipagamento(condizioni) {
  if (!condizioni) return '';

  // Calcola valori e conversioni in lettere
  const giorniVersamento = condizioni.giorni_versamento || 15;
  const giorniVersamentoLettere = numeroInLettere(giorniVersamento, false);

  const percAnticipo = condizioni.percentuale_anticipo || 10;
  const percAnticipoLettere = numeroInLettere(percAnticipo, false);

  const giorniStipula = condizioni.giorni_stipula_atto || 150;
  const giorniStipulaLettere = numeroInLettere(giorniStipula, false);

  // Determina modalità saldo testo
  const modalitaSaldo = condizioni.modalita_saldo || 'assegno_circolare';
  let modalitaSaldoTesto = '';

  switch (modalitaSaldo) {
    case 'assegno_circolare':
      modalitaSaldoTesto = 'assegno circolare';
      break;
    case 'bonifico_istantaneo':
      modalitaSaldoTesto = 'bonifico bancario istantaneo';
      break;
    case 'altro':
      if (condizioni.saldo_altro_testo && condizioni.saldo_altro_testo.trim() !== '') {
        modalitaSaldoTesto = condizioni.saldo_altro_testo.trim();
      } else {
        modalitaSaldoTesto = 'modalità da concordare';
      }
      break;
    default:
      modalitaSaldoTesto = 'assegno circolare';
  }

  // Genera testo completo
  let testo = '';

  // Paragrafo 1: Proposta d'acquisto e versamento anticipo
  testo += `La proposta d'acquisto dovrà contenere l'impegno del proponente di versare, entro ${giorniVersamento} (${giorniVersamentoLettere}) giorni dalla conoscenza dell'accettazione della proposta stessa, una somma non inferiore al ${percAnticipo}% (${percAnticipoLettere} per cento) del prezzo di vendita, comprensiva di quanto versato alla proposta d'acquisto.\n\n`;

  // Paragrafo 2: Facoltà riproduzione proposta
  testo += `In tale occasione, sarà facoltà delle parti riprodurre il contenuto della proposta d'acquisto, al fine di aggiungervi gli aspetti non disciplinati nella stessa (contratto preliminare).\n\n`;

  // Paragrafo 3: Saldo prezzo
  testo += `Il saldo del prezzo dovrà essere liquidato per mezzo di ${modalitaSaldoTesto} entro ${giorniStipula} (${giorniStipulaLettere}) giorni dal perfezionamento del vincolo contrattuale, momento di stipulazione dell'atto notarile. Nel caso l'acquirente non intendesse accollarsi l'eventuale mutuo, il Venditore si obbliga, entro la data o contestualmente alla rogitazione, a estinguere il debito e a eseguire ogni formalità necessaria alla cancellazione della relativa ipoteca.\n\n`;

  // Paragrafo 4: Mutui e finanziamenti
  testo += `L'acquirente potrà avvalersi, a propria cura e spesa, di mutui o finanziamenti, il cui importo sarà messo a disposizione del Venditore al momento del rogito notarile, esperite le formalità necessarie.\n\n`;

  // Paragrafo 5: Deposito presso notaio (legge 147/2013)
  testo += `Il Venditore dichiara di essere stato debitamente edotto dall'Agenzia Immobiliare che, a norma dell'articolo 1 comma 63, lettera "C" della legge 27 dicembre 2013 numero 147, ciascuna delle parti e quindi anche la sola parte acquirente, qualora ne faccia apposita richiesta, potrà avvalersi della facoltà di depositare, presso il Notaio rogante, fino ad avvenuta trascrizione del contratto di compravendita, la somma relativa al saldo prezzo, se determinato in denaro, oltre alle somme destinate ad estinzione di gravami o spese non pagate dal Venditore o di altri oneri dovuti in occasione del ricevimento o dell'autenticazione dell'atto di trasferimento della proprietà.`;

  return testo;
}

/**
 * BLOCCO 8: GENERAZIONE SEZIONE ATTO NOTARILE
 *
 * Genera il testo formattato per la sezione atto notarile
 * Include: termine stipula, spese a carico, condizioni immobile, servitù e spese condominiali
 */
function generaSezioneAttoNotarile(condizioni) {
  if (!condizioni) return '';

  // Estrai giorni stipula atto (stesso valore usato in condizioni pagamento)
  const giorniStipula = condizioni.giorni_stipula_atto || 150;
  const giorniStipulaLettere = numeroInLettere(giorniStipula, false);

  let testo = '';

  // Paragrafo 1: Termine stipula
  testo += `L'atto notarile dovrà essere stipulato entro ${giorniStipula} (${giorniStipulaLettere}) giorni dal perfezionamento in vincolo contrattuale della proposta d'acquisto (contratto preliminare). `;

  // Paragrafo 2: Spese e imposte
  testo += `Ogni spesa, imposta o tassa inerente alla vendita, sarà a carico dell'acquirente, escluse solamente quelle per legge a carico del Venditore. `;

  // Paragrafo 3: Condizioni immobile
  testo += `L'immobile in oggetto, al momento dell'atto notarile, dovrà essere libero da oneri e pesi, trascrizioni pregiudizievoli, pignoramenti, iscrizioni ipotecarie, salvo se espressamente indicate e accettate dall'acquirente, ed essere in regola con la normativa edilizia e urbanistica, regolarmente accatastato e liberamente compravendibile. `;

  // Paragrafo 4: Stato di fatto e servitù
  testo += `Dovrà essere trasferito nello stato di fatto in cui si trova, con tutte le servitù attive e passive, comprensivo della proporzionale quota delle parti comuni e in regola con il pagamento delle spese condominiali se esistenti, come risultante da dichiarazione dell'Amministratore del condominio.`;

  return testo;
}

/**
 * BLOCCO 9: GENERAZIONE SEZIONE OBBLIGHI AGENZIA
 *
 * Genera il testo formattato per gli obblighi dell'agenzia immobiliare
 * Cambia in base al tipo di incarico (esclusiva o non esclusiva)
 */
function generaSezioneObblighi(isEsclusiva) {
  let testo = '';

  testo += 'OBBLIGHI DELL\'AGENZIA IMMOBILIARE - INCARICO ';
  testo += isEsclusiva ? 'IN ESCLUSIVA' : 'NON IN ESCLUSIVA';
  testo += '\n\n';
  testo += 'Con l\'accettazione del presente incarico l\'Agenzia Immobiliare si obbliga a:\n\n';

  if (isEsclusiva) {
    // OBBLIGHI IN ESCLUSIVA (13 punti)
    testo += '• visionare e valutare accuratamente l\'immobile redigendo scheda estimativa;\n\n';
    testo += '• produrre a propria cura la documentazione edilizia e catastale;\n\n';
    testo += '• impegnare la propria organizzazione per promuovere la vendita, utilizzando gli strumenti ritenuti adeguati dalla stessa;\n\n';
    testo += '• redigere il preventivo imposte, tasse e spese a carico del Venditore;\n\n';
    testo += '• redigere il preventivo imposte, tasse e spese a carico dell\'acquirente;\n\n';
    testo += '• accompagnare i potenziali acquirenti a visitare l\'immobile;\n\n';
    testo += '• predisporre a richiesta delle parti ogni atto negoziale ritenuto necessario per il perfezionamento dell\'affare;\n\n';
    testo += '• effettuare le visure relative all\'esistenza d\'iscrizioni e/o trascrizioni successive alla data dell\'atto di provenienza;\n\n';
    testo += '• non richiedere un prezzo di vendita diverso da quello su indicato, fatto salvo il margine di trattativa stabilito;\n\n';
    testo += '• fornire su semplice richiesta del Venditore informazioni sull\'attività effettuata;\n\n';
    testo += '• fornire a entrambe le parti la propria assistenza fino all\'atto notarile;\n\n';
    testo += '• comunicare l\'avvenuta vendita agli enti per le variazioni di rito;\n\n';
    testo += '• registrare, entro 20 (venti) giorni, la proposta d\'acquisto accettata o il preliminare di compravendita, previa consegna in proprie mani di almeno due copie con firme autografe originali e della relativa provvista economica, necessaria per procedere al versamento di quanto dovuto per la registrazione.';
  } else {
    // OBBLIGHI NON IN ESCLUSIVA (8 punti)
    testo += '• visionare e valutare sinteticamente l\'immobile;\n\n';
    testo += '• promuovere la vendita, utilizzando gli strumenti ritenuti adeguati dallo stesso;\n\n';
    testo += '• accompagnare i potenziali acquirenti a visitare l\'immobile;\n\n';
    testo += '• predisporre a richiesta ogni atto negoziale tra le parti ritenuto necessario per il perfezionamento dell\'affare;\n\n';
    testo += '• effettuare le visure relative all\'esistenza d\'iscrizioni e/o trascrizioni pregiudizievoli successive alla data dell\'atto di provenienza;\n\n';
    testo += '• fornire a entrambe le parti la propria assistenza fino all\'atto notarile;\n\n';
    testo += '• non richiedere un prezzo di vendita diverso da quello su indicato, fatto salvo il margine di trattativa stabilito;\n\n';
    testo += '• registrare, entro 20 (venti) giorni, la proposta d\'acquisto accettata o il preliminare di compravendita, previa consegna in proprie mani di almeno due copie con firme autografe originali e della relativa provvista economica, necessaria per procedere al versamento di quanto dovuto per la registrazione.';
  }

  return testo;
}

/**
 * BLOCCO 10: GENERAZIONE SEZIONE CORRISPONDENTI E AUTORIZZAZIONI
 *
 * Genera il testo formattato per la sezione corrispondenti e autorizzazioni pubblicitarie
 * Include: paragrafo introduttivo + elenco autorizzazioni concesse/negate
 */
function generaSezioneCorrispondenti(autorizzazioni) {
  if (!autorizzazioni) {
    // Default: tutte le autorizzazioni concesse
    autorizzazioni = {
      cartello_vendita: true,
      vetrine: true,
      internet: true,
      stampa: true
    };
  }

  let testo = '';

  // Paragrafo introduttivo (sempre presente)
  testo += 'L\'Agenzia Immobiliare è autorizzata ad avvalersi a proprie spese di banche dati e della collaborazione di colleghi esterni alla propria organizzazione, purché abilitati in conformità alla normativa vigente, senza che ciò comporti a carico del venditore costi aggiuntivi.\n\n';

  testo += 'L\'AGENTE IMMOBILIARE\n\n';

  // Elenco autorizzazioni
  const items = [
    { key: 'cartello_vendita', label: 'esporre il cartello di vendita in loco' },
    { key: 'vetrine', label: 'esporre l\'annuncio di vendita sulle vetrine' },
    { key: 'internet', label: 'pubblicizzare l\'immobile sul proprio sito Internet' },
    { key: 'stampa', label: 'pubblicizzare l\'immobile a mezzo stampa' }
  ];

  items.forEach((item, index) => {
    const isAutorizzato = autorizzazioni[item.key] !== false;
    const prefix = isAutorizzato ? 'è autorizzato' : 'non è autorizzato';

    testo += `${prefix} - a ${item.label}`;

    // Aggiungi separatore solo se non è l'ultimo elemento
    if (index < items.length - 1) {
      testo += ' -\n\n';
    }
  });

  return testo;
}

// ========== BLOCCO: SEZIONE COMUNICAZIONI ED ACCETTAZIONE INCARICO ==========

/**
 * Genera la sezione "COMUNICAZIONI ED ACCETTAZIONE DELL'INCARICO"
 * Utilizza i dati dei venditori (indirizzi, telefoni, email) per indicare i canali di comunicazione
 * @param {Array} venditori - Array di oggetti venditore
 * @returns {string} Testo formattato della sezione comunicazioni
 */
function generaSezioneComunicazioni(venditori) {
  if (!venditori || venditori.length === 0) {
    return 'COMUNICAZIONI ED ACCETTAZIONE DELL\'INCARICO\n\nNessun venditore specificato.';
  }

  let testo = 'COMUNICAZIONI ED ACCETTAZIONE DELL\'INCARICO\n\n';

  testo += 'Tutte le comunicazioni inerenti il presente incarico potranno essere inviate ';

  // Se c'è un solo venditore
  if (venditori.length === 1) {
    const v = venditori[0];
    testo += `al venditore ${v.nome} ${v.cognome}`;

    // Indirizzo
    if (v.indirizzo && v.citta) {
      testo += ` presso ${v.indirizzo}, ${v.citta}`;
      if (v.provincia) testo += ` (${getNomeProvinciaCompleto(v.provincia)})`;
    }

    // Telefoni
    const telefoni = [v.telefono1, v.telefono2].filter(t => t && t.trim() !== '');
    if (telefoni.length > 0) {
      testo += `, ai numeri telefonici ${telefoni.join(' e ')}`;
    }

    // Email
    const emails = [v.email1, v.email2].filter(e => e && e.trim() !== '');
    if (emails.length > 0) {
      testo += `, agli indirizzi di posta elettronica ${emails.join(' e ')}`;
    }

    testo += '.\n\n';
  } else {
    // Più venditori
    testo += 'ai seguenti indirizzi:\n\n';

    venditori.forEach((v, index) => {
      testo += `• ${v.nome} ${v.cognome}: `;

      const contatti = [];

      // Indirizzo
      if (v.indirizzo && v.citta) {
        let addr = `${v.indirizzo}, ${v.citta}`;
        if (v.provincia) addr += ` (${getNomeProvinciaCompleto(v.provincia)})`;
        contatti.push(addr);
      }

      // Telefoni
      const telefoni = [v.telefono1, v.telefono2].filter(t => t && t.trim() !== '');
      if (telefoni.length > 0) {
        contatti.push(`tel. ${telefoni.join(', ')}`);
      }

      // Email
      const emails = [v.email1, v.email2].filter(e => e && e.trim() !== '');
      if (emails.length > 0) {
        contatti.push(`email ${emails.join(', ')}`);
      }

      testo += contatti.join(' - ');
      testo += '\n\n';
    });
  }

  // Paragrafo di accettazione
  testo += `${venditori.length > 1 ? 'I venditori accettano' : 'Il venditore accetta'} il presente incarico di mediazione e dichiara${venditori.length > 1 ? 'no' : ''} di aver ricevuto copia del presente documento e di averne preso piena visione, comprese le condizioni economiche e gli obblighi reciproci.\n\n`;

  testo += 'Il presente incarico è regolato dalla normativa vigente in materia di mediazione immobiliare e dalle disposizioni del Codice Civile.';

  return testo;
}

// ========== BLOCCO: SEZIONE DIRITTO DI RECESSO ==========

/**
 * Genera la sezione "DIRITTO DI RECESSO" con testo completo e checkbox luogo conferimento
 * @param {Object} dirittoRecesso - Oggetto con luogo_conferimento ('locale_agenzia' o 'domicilio_venditore')
 * @param {Object} datiAgenzia - Dati agenzia (per PEC)
 * @returns {string} Testo formattato della sezione diritto di recesso
 */
function generaSezioneDirittoRecesso(dirittoRecesso, datiAgenzia) {
  let testo = 'DIRITTO DI RECESSO\n\n';

  // Testo introduttivo diritto di recesso
  testo += 'Ai sensi del decreto legislativo 206/2005 (codice del consumo) nel caso di contratti conclusi fuori dai locali commerciali, è concessa al Venditore qualora abbia i requisiti per essere qualificato consumatore, la facoltà di esercitare il diritto di recesso entro 14 (quattordici) giorni dalla sottoscrizione del presente contratto a mezzo raccomandata con ricevuta di ritorno da inviarsi presso la sede dell\'Agenzia Immobiliare ';

  // Aggiungi PEC agenzia
  const pec = datiAgenzia?.pec || '{{pec_agenzia}}';
  testo += `o a posta elettronica certificata all\'indirizzo ${pec}, a tal proposito si precisa che l\'incarico viene conferito presso:\n\n`;

  // Checkbox luogo conferimento (con segno spunta in base a selezione)
  const luogo = dirittoRecesso?.luogo_conferimento || 'locale_agenzia';

  if (luogo === 'domicilio_venditore') {
    testo += '☑ il domicilio del Venditore o altro luogo.\n\n';
    testo += '☐ il locale commerciale dell\'Agenzia Immobiliare';
  } else {
    testo += '☐ il domicilio del Venditore o altro luogo.\n\n';
    testo += '☑ il locale commerciale dell\'Agenzia Immobiliare';
  }

  return testo;
}

// ========== BLOCCO: SEZIONE FIRME E DATE ==========

/**
 * Genera la sezione firme con spazi per venditori e agente
 * Include: data/luogo, firme venditori (2 per venditore: contratto + art. 1341-1342), firma agente
 * @param {Object} firma - Oggetto con luogo e data
 * @param {Array} venditori - Array venditori
 * @returns {string} Testo formattato con spazi firma
 */
function generaSezioneFireDate(firma, venditori) {
  if (!venditori || venditori.length === 0) {
    return 'FIRME E DATE\n\nNessun venditore specificato.';
  }

  let testo = '';

  // Formatta luogo e data
  const luogo = firma?.luogo || '_______________';
  const dataFirma = firma?.data || '___/___/_______';

  // Formatta data in formato italiano DD/MM/YYYY se presente
  let dataFormattata = dataFirma;
  if (dataFirma && dataFirma.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Converti da YYYY-MM-DD a DD/MM/YYYY
    const parts = dataFirma.split('-');
    dataFormattata = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // Prima sezione: Luogo e data + firme contratto
  testo += `${luogo} ${dataFormattata}\n\n`;

  // Spazi firma per ogni venditore
  venditori.forEach((venditore, index) => {
    const nomeCompleto = `${venditore.nome || ''} ${venditore.cognome || ''}`.trim() || 'Venditore';
    testo += 'firma del Venditore\n\n';
    testo += `${nomeCompleto}\n\n`;
    testo += '___________________________________\n\n';

    if (index < venditori.length - 1) {
      testo += '\n';
    }
  });

  // Sezione approvazione clausole art. 1341-1342 CC
  testo += '\nAi sensi e per gli effetti degli articoli 1341 e 1342 Codice civile il Venditore dichiara espressamente di approvare la durata e proroga dell\'incarico, l\'esclusiva se concessa e clausola penale.\n\n';

  // Secondo set di firme venditori (per approvazione clausole)
  venditori.forEach((venditore, index) => {
    const nomeCompleto = `${venditore.nome || ''} ${venditore.cognome || ''}`.trim() || 'Venditore';
    testo += 'firma del Venditore\n\n';
    testo += `${nomeCompleto}\n\n`;
    testo += '___________________________________\n\n';

    if (index < venditori.length - 1) {
      testo += '\n';
    }
  });

  // Firma agente
  testo += '\nPer accettazione dell\'incarico.\n\n';
  testo += `${luogo} ${dataFormattata}\n\n`;
  testo += 'firma dell\'Agente Immobiliare\n\n';
  testo += '___________________________________';

  return testo;
}

// BLOCCO FUNZIONI HELPER PER GENERAZIONE DATI CATASTALI
function generateCatastaliMarker(immobiliData) {
  // Genera marker speciale per tabelle catastali
  return `{{TABELLE_CATASTALI_START}}
${JSON.stringify(immobiliData)}
{{TABELLE_CATASTALI_END}}`;
}

function generateIntestatariCompleto(immobiliArray) {
  const tuttiIntestatari = [];

  immobiliArray.forEach((immobile, index) => {
    if (immobile.intestatari && Array.isArray(immobile.intestatari)) {
      immobile.intestatari.forEach(intestatario => {
        if (intestatario.nome && intestatario.cognome) {
          const nomeCompleto = `**${intestatario.nome} ${intestatario.cognome}**`;
          if (tuttiIntestatari.indexOf(nomeCompleto) === -1) {
            tuttiIntestatari.push(nomeCompleto);
          }
        }
      });
    }
  });

  return tuttiIntestatari.join(', ');
}

// BLOCCO: Genera intestatari di un SINGOLO immobile
function generateIntestatariSingoloImmobile(immobile) {
  const intestatari = [];

  if (immobile.intestatari && Array.isArray(immobile.intestatari)) {
    immobile.intestatari.forEach(intestatario => {
      if (intestatario.nome && intestatario.cognome) {
        intestatari.push(`**${intestatario.nome} ${intestatario.cognome}**`);
      }
    });
  }

  return intestatari.length > 0 ? intestatari.join(', ') : '[INTESTATARIO NON SPECIFICATO]';
}

// ========== MERGE DOCUMENTI ==========

// BLOCCO 1: Applicazione stili ai blocchi speciali agenzia
function applyStyledBlocks(body, mergeData, debugInfo = []) {
  // Helper per convertire string alignment a DocumentApp constant
  const getAlignment = (alignmentStr) => {
    switch (alignmentStr) {
      case 'CENTER': return DocumentApp.HorizontalAlignment.CENTER;
      case 'LEFT': return DocumentApp.HorizontalAlignment.LEFT;
      case 'RIGHT': return DocumentApp.HorizontalAlignment.RIGHT;
      case 'JUSTIFY': return DocumentApp.HorizontalAlignment.JUSTIFY;
      default: return DocumentApp.HorizontalAlignment.LEFT;
    }
  };

  // Configurazione stili per ciascun blocco (da config.js)
  const blockConfigs = {
    'blocco_intestazione': {
      placeholder: '{{blocco_intestazione}}',
      data: mergeData.blocco_intestazione,
      styles: {
        fontSize: BLOCK_STYLES.blocco_intestazione.fontSize,
        bold: BLOCK_STYLES.blocco_intestazione.bold,
        alignment: getAlignment(BLOCK_STYLES.blocco_intestazione.alignment),
        lineSpacing: BLOCK_STYLES.blocco_intestazione.lineSpacing
      }
    },
    'blocco_agenzia_completo': {
      placeholder: '{{blocco_agenzia_completo}}',
      data: mergeData.blocco_agenzia_completo,
      styles: {
        fontSize: BLOCK_STYLES.blocco_agenzia_completo.fontSize,
        bold: BLOCK_STYLES.blocco_agenzia_completo.bold,
        alignment: getAlignment(BLOCK_STYLES.blocco_agenzia_completo.alignment),
        lineSpacing: BLOCK_STYLES.blocco_agenzia_completo.lineSpacing
      }
    },
    'blocco_footer': {
      placeholder: '{{blocco_footer}}',
      data: mergeData.blocco_footer,
      styles: {
        fontSize: BLOCK_STYLES.blocco_footer.fontSize,
        bold: BLOCK_STYLES.blocco_footer.bold,
        alignment: getAlignment(BLOCK_STYLES.blocco_footer.alignment),
        lineSpacing: BLOCK_STYLES.blocco_footer.lineSpacing
      }
    }
  };

  // Processa ogni blocco
  Object.keys(blockConfigs).forEach(blockKey => {
    const config = blockConfigs[blockKey];

    debugInfo.push(`🔍 Cercando placeholder: ${config.placeholder}`);

    // Cerca il placeholder nel documento
    const searchResult = body.findText(config.placeholder);

    if (!searchResult) {
      debugInfo.push(`⚠️ Placeholder ${config.placeholder} non trovato nel documento`);
      return;
    }

    debugInfo.push(`✅ Placeholder ${config.placeholder} trovato`);

    try {
      // Ottieni l'elemento testo e il paragrafo contenitore
      const textElement = searchResult.getElement();
      const paragraph = textElement.getParent().asParagraph();
      const paragraphIndex = body.getChildIndex(paragraph);

      debugInfo.push(`📍 Paragrafo trovato all'indice: ${paragraphIndex}`);

      // Dividi il testo in righe
      const lines = (config.data || '').split('\n').filter(line => line.trim() !== '');

      debugInfo.push(`📝 Numero righe da inserire: ${lines.length}`);

      // Inserisci ogni riga come paragrafo separato con stili
      lines.forEach((line, index) => {
        const newParagraph = body.insertParagraph(paragraphIndex + index, line);
        const text = newParagraph.editAsText();

        // Applica stili configurati
        text.setFontSize(config.styles.fontSize);
        text.setBold(config.styles.bold);
        newParagraph.setAlignment(config.styles.alignment);
        newParagraph.setLineSpacing(config.styles.lineSpacing);

        debugInfo.push(`  ✓ Riga ${index + 1} inserita con stili`);
      });

      // Rimuovi il paragrafo con il placeholder
      const placeholderParagraphIndex = paragraphIndex + lines.length;
      const placeholderParagraph = body.getChild(placeholderParagraphIndex).asParagraph();
      placeholderParagraph.removeFromParent();

      debugInfo.push(`🗑️ Placeholder rimosso, blocco ${blockKey} completato`);

    } catch (error) {
      debugInfo.push(`❌ Errore processing blocco ${blockKey}: ${error.toString()}`);
    }
  });
}

function performDocumentMerge(doc, mergeData, immobiliData = []) {
  const body = doc.getBody();

  // Array per raccogliere informazioni di debug
  const debugInfo = [];

  // Blocchi speciali che richiedono formattazione custom
  const styledBlocks = ['blocco_intestazione', 'blocco_agenzia_completo', 'blocco_footer'];

  // Sostituisci tutti i placeholder normali
  Object.keys(mergeData).forEach(key => {
    // Salta i blocchi speciali - verranno gestiti separatamente
    if (styledBlocks.includes(key)) {
      debugInfo.push(`⏭️ Saltato placeholder speciale: {{${key}}} - verrà processato con stili`);
      return;
    }

    const placeholder = `{{${key}}}`;
    const value = mergeData[key] || '';

    // Sostituisci il testo
    body.replaceText(placeholder, value);
  });

  // NUOVO: Applica blocchi con formattazione personalizzata
  debugInfo.push('🎨 Applicazione blocchi stilizzati...');
  try {
    applyStyledBlocks(body, mergeData, debugInfo);
    debugInfo.push('✅ Blocchi stilizzati applicati');
  } catch (error) {
    debugInfo.push(`❌ Errore applicazione blocchi stilizzati: ${error.toString()}`);
  }

  // NUOVO: Processa tabelle catastali dopo sostituzione placeholder
  debugInfo.push('🚀 MARKER-1: Inizio sezione tabelle catastali');
  debugInfo.push(`🚀 MARKER-1: immobiliData type: ${typeof immobiliData}`);
  debugInfo.push(`🚀 MARKER-1: immobiliData length: ${immobiliData ? immobiliData.length : 'null/undefined'}`);

  try {
    debugInfo.push('🚀 MARKER-2: Dentro try-catch tabelle');

    debugInfo.push('🚀 MARKER-3: Chiamando processTabelleCatastaliDirettamente...');
    const tableResult = processTabelleCatastaliDirettamente(doc, body, mergeData, immobiliData);
    debugInfo.push('🚀 MARKER-4: processTabelleCatastaliDirettamente completata');
    debugInfo.push('✅ Tabelle catastali processate');

    if (tableResult && tableResult.debugInfo) {
      debugInfo.push(...tableResult.debugInfo);
    }

    debugInfo.push('🚀 MARKER-5: Fine sezione tabelle catastali');
  } catch (error) {
    debugInfo.push('🚀 MARKER-ERROR: Errore durante processing tabelle');
    debugInfo.push(`❌ ERRORE processing tabelle catastali: ${error.toString()}`);

    // Scrivi l'errore direttamente nel documento
    body.appendParagraph(`\n\n=== DEBUG ERROR ===\nErrore processing tabelle: ${error.toString()}\n==================`);
  }

  // Scrivi tutte le informazioni di debug alla fine del documento
  const debugSection = body.appendParagraph('\n\n=== DEBUG INFO ===');
  debugInfo.forEach(info => {
    body.appendParagraph(info);
  });

  // Aggiungi info specifiche sui dati immobili passati
  body.appendParagraph('\n--- DETTAGLI DATI IMMOBILI ---');
  body.appendParagraph(`Tipo immobiliData: ${typeof immobiliData}`);
  body.appendParagraph(`Array? ${Array.isArray(immobiliData)}`);
  body.appendParagraph(`Length: ${immobiliData ? immobiliData.length : 'undefined/null'}`);
  if (immobiliData && immobiliData.length > 0) {
    body.appendParagraph(`Primo immobile keys: ${Object.keys(immobiliData[0]).join(', ')}`);
  } else {
    body.appendParagraph('Nessun immobile presente nell\'array');
  }

  body.appendParagraph('==================');

  // Restituisci anche le info di debug
  return {
    success: true,
    debugInfo: debugInfo
  };
}

// ========== UTILITÀ ==========

function formatDate(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Stub per altri documenti (da implementare)
function generatePreventivoImposte(data, targetFolder) {
  return { success: false, error: 'Non ancora implementato' };
}

function generateDelegaPlanimetrie(data, targetFolder) {
  return { success: false, error: 'Non ancora implementato' };
}

// ========== HELPER FUNCTIONS PER RIUTILIZZO CARTELLE ==========

function findExistingPraticaFolder(parentFolder, folderName) {
  try {
    const folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      return folders.next();
    }
    return null;
  } catch (error) {
    console.error('❌ Errore ricerca cartella esistente:', error);
    return null;
  }
}

function findExistingPraticaFolderByProtocol(parentFolder, protocolloPattern) {
  try {
    console.log(`🔍 Cercando cartella che inizia con: ${protocolloPattern}`);

    const allFolders = parentFolder.getFolders();
    while (allFolders.hasNext()) {
      const folder = allFolders.next();
      const folderName = folder.getName();

      // Cerca cartelle che iniziano con il pattern del protocollo
      if (folderName.startsWith(protocolloPattern)) {
        console.log(`✅ Cartella trovata: ${folderName}`);
        return folder;
      }
    }

    console.log(`❌ Nessuna cartella trovata per pattern: ${protocolloPattern}`);
    return null;
  } catch (error) {
    console.error('❌ Errore ricerca cartella per protocollo:', error);
    return null;
  }
}

function findOrCreateSubfolder(parentFolder, subfolderName) {
  try {
    const existingSubfolders = parentFolder.getFoldersByName(subfolderName);
    if (existingSubfolders.hasNext()) {
      console.log(`🔄 Riutilizzo sottocartella esistente: ${subfolderName}`);
      return existingSubfolders.next();
    } else {
      console.log(`🆕 Creazione nuova sottocartella: ${subfolderName}`);
      const newSubfolder = DriveApp.createFolder(subfolderName);
      parentFolder.addFolder(newSubfolder);
      return newSubfolder;
    }
  } catch (error) {
    console.error('❌ Errore gestione sottocartella:', error);
    // Fallback: prova a creare la cartella
    const newSubfolder = DriveApp.createFolder(subfolderName);
    parentFolder.addFolder(newSubfolder);
    return newSubfolder;
  }
}

function removeExistingFile(folder, fileName) {
  try {
    console.log(`🔍 Cercando file da rimuovere che iniziano con: ${fileName}`);

    const allFiles = folder.getFiles();
    const filesToRemove = [];

    while (allFiles.hasNext()) {
      const file = allFiles.next();
      const currentFileName = file.getName();

      // Cerca file che iniziano con il nome base (per gestire copie con suffissi)
      if (currentFileName.startsWith(fileName) || currentFileName === fileName) {
        filesToRemove.push(file);
        console.log(`🎯 File trovato da rimuovere: ${currentFileName}`);
      }
    }

    // Rimuovi tutti i file trovati
    for (const file of filesToRemove) {
      console.log(`🗑️ Rimozione file: ${file.getName()}`);
      file.setTrashed(true); // Elimina completamente il file
    }

    console.log(`✅ Rimossi ${filesToRemove.length} file esistenti`);

  } catch (error) {
    console.error('❌ Errore rimozione file esistente:', error);
    // Non bloccare il processo se la rimozione fallisce
  }
}

function cleanupDuplicates(folder, baseName, keepFileId) {
  try {
    console.log(`🧹 Cleanup duplicati per: ${baseName}, mantenendo ID: ${keepFileId}`);

    const allFiles = folder.getFiles();
    const duplicatesToRemove = [];

    while (allFiles.hasNext()) {
      const file = allFiles.next();
      const currentFileName = file.getName();
      const currentFileId = file.getId();

      // Se il file inizia con il nome base ma ha un ID diverso da quello da mantenere
      if ((currentFileName.startsWith(baseName) || currentFileName === baseName)
          && currentFileId !== keepFileId) {
        duplicatesToRemove.push(file);
        console.log(`🎯 Duplicato trovato da rimuovere: ${currentFileName} (ID: ${currentFileId})`);
      }
    }

    // Rimuovi tutti i duplicati
    for (const file of duplicatesToRemove) {
      console.log(`🗑️ Rimozione duplicato: ${file.getName()}`);
      file.setTrashed(true);
    }

    console.log(`✅ Cleanup completato: rimossi ${duplicatesToRemove.length} duplicati`);

  } catch (error) {
    console.error('❌ Errore cleanup duplicati:', error);
  }
}

function checkForDuplicateFolders(parentFolder, folderName, executionId) {
  try {
    console.log(`🔍 [${executionId}] Controllo duplicati per: ${folderName}`);

    const allFolders = parentFolder.getFolders();
    const foundFolders = [];

    while (allFolders.hasNext()) {
      const folder = allFolders.next();
      if (folder.getName() === folderName) {
        foundFolders.push({
          id: folder.getId(),
          name: folder.getName(),
          created: folder.getDateCreated()
        });
      }
    }

    console.log(`🔍 [${executionId}] Cartelle trovate con nome "${folderName}": ${foundFolders.length}`);
    foundFolders.forEach((folder, index) => {
      console.log(`🔍 [${executionId}] Cartella ${index + 1}: ID=${folder.id}, Created=${folder.created.toISOString()}`);
    });

    if (foundFolders.length > 1) {
      console.error(`🚨 [${executionId}] DUPLICAZIONE RILEVATA! ${foundFolders.length} cartelle con lo stesso nome!`);
    }

  } catch (error) {
    console.error(`❌ [${executionId}] Errore controllo duplicati:`, error);
  }
}

// ========== SISTEMA TABELLE CATASTALI AVANZATE ==========

/**
 * Configurazione stili per tabelle catastali
 */
const TABELLE_STILI_CONFIG = {
  font: {
    famiglia: 'Arial',         // Famiglia font (Arial, Times, etc.)
    dimensione_header: 9,      // Dimensione font headers
    dimensione_dati: 8,        // Dimensione font dati
    colore_header: '#000000',  // Colore testo headers
    colore_dati: '#333333'     // Colore testo dati
  },
  tabella: {
    larghezza_bordo: 1,        // Spessore bordi in punti
    colore_bordo: '#000000',   // Colore bordi
    sfondo_header: '#E7E6E6',  // Colore sfondo headers
    sfondo_dati: '#FFFFFF',    // Colore sfondo dati
    allineamento_header: 'CENTER', // LEFT, CENTER, RIGHT
    allineamento_dati: 'CENTER'    // LEFT, CENTER, RIGHT
  },
  spaziatura: {
    padding_celle: 4,          // Padding interno celle in punti
    margine_sopra: 6,          // Margine sopra tabella in punti
    margine_sotto: 6           // Margine sotto tabella in punti
  }
};

/**
 * Processa i marker delle tabelle catastali e li sostituisce con tabelle formattate
 */
function processTabelleCatastali(doc, body) {
  console.log('🏗️ Inizio processing tabelle catastali...');

  const startMarker = '{{TABELLE_CATASTALI_START}}';
  const endMarker = '{{TABELLE_CATASTALI_END}}';

  // Cerca il marker di inizio
  const startElement = body.findText(startMarker);
  if (!startElement) {
    console.log('ℹ️ Nessun marker tabelle catastali trovato');
    return;
  }

  const endElement = body.findText(endMarker);
  if (!endElement) {
    console.warn('⚠️ Marker fine tabelle catastali non trovato');
    return;
  }

  // Estrai i dati JSON tra i marker
  const startOffset = startElement.getStartOffset();
  const endOffset = endElement.getEndOffsetInclusive();
  const startParagraph = startElement.getElement().getParent();

  // Trova il testo completo tra i marker
  const fullText = body.getText();
  const startIndex = fullText.indexOf(startMarker);
  const endIndex = fullText.indexOf(endMarker) + endMarker.length;
  const markerContent = fullText.substring(startIndex, endIndex);

  // Estrai JSON
  const jsonStart = markerContent.indexOf('\n') + 1;
  const jsonEnd = markerContent.lastIndexOf('\n');
  const jsonString = markerContent.substring(jsonStart, jsonEnd).trim();

  let immobiliData;
  try {
    immobiliData = JSON.parse(jsonString);
    console.log('✅ Dati immobili parsati:', immobiliData.length, 'immobili');
  } catch (error) {
    console.error('❌ Errore parsing JSON immobili:', error);
    return;
  }

  // Rimuovi il contenuto del marker
  body.replaceText(startMarker + '[\\s\\S]*?' + endMarker, '');

  // Trova dove inserire le tabelle (al posto del marker rimosso)
  const insertElement = body.findText('');
  let insertIndex = 0;

  if (insertElement) {
    const paragraph = insertElement.getElement().getParent();
    insertIndex = body.getChildIndex(paragraph);
  }

  // Genera tabelle per ogni immobile
  let currentIndex = insertIndex;
  immobiliData.forEach((immobile, immobileIndex) => {
    console.log(`🏗️ Generando tabelle per immobile ${immobileIndex + 1}`);

    // Inserisci titolo immobile se ci sono più immobili
    if (immobiliData.length > 1) {
      const titoloParagraph = body.insertParagraph(currentIndex, `Immobile ${immobileIndex + 1}:`);
      applicaStiliTitolo(titoloParagraph);
      currentIndex++;
    }

    // Genera tabella FABBRICATI se presente
    if (immobile.righe_catastali_fabbricati && immobile.righe_catastali_fabbricati.length > 0) {
      currentIndex = insertTabellaFabbricatiAvanzata(body, immobile.righe_catastali_fabbricati, currentIndex);
    }

    // Genera tabella TERRENI se presente
    if (immobile.righe_catastali_terreni && immobile.righe_catastali_terreni.length > 0) {
      currentIndex = insertTabellaTerreniaAvanzata(body, immobile.righe_catastali_terreni, currentIndex);
    }

    // Spazio tra immobili
    if (immobileIndex < immobiliData.length - 1) {
      body.insertParagraph(currentIndex, '');
      currentIndex++;
    }
  });

  console.log('✅ Tabelle catastali processate completamente');
}

// ========== FUNZIONI HELPER PER GENERAZIONE TESTO STATO IMMOBILE ==========

// BLOCCO: Genera testo occupazione immobile (sezione STATO ATTUALE)
function generaTestoOccupazione(stato) {
  if (!stato || !stato.occupazione) return '';

  const prefix = 'Allo stato attuale l\'immobile è ';

  switch(stato.occupazione) {
    case 'libero':
      return prefix + 'libero.';

    case 'occupato_proprietario':
      return prefix + 'utilizzato dal proprietario, libero al rogito.';

    case 'locato':
      const inquilino = stato.locazione?.inquilino || '[NOME INQUILINO]';
      const canone = stato.locazione?.canone_annuo || '0';
      const scadenza = stato.locazione?.scadenza_contratto || '[DATA]';
      return `${prefix}locato a uso abitativo al Signor ${inquilino}, al canone annuo attuale di €uro ${canone}, con contratto scadente il ${scadenza}, libero al rogito.`;

    default:
      return '';
  }
}

// BLOCCO: Genera testo completo dichiarazioni del venditore (conformità + vincoli + documenti)
function generaTestoDichiarazioni(stato) {
  if (!stato) return '';

  let testo = '';

  // PARTE 1: Conformità
  if (stato.conformita) {
    const edilizia = stato.conformita.edilizia === true;
    const catastale = stato.conformita.catastale === true;
    const impianti = stato.conformita.impianti === true;

    const parts = [];

    // Conformità edilizia/urbanistica
    if (edilizia) {
      parts.push('è conforme alle norme edilizie/urbanistiche');
    } else {
      parts.push('non è conforme alle norme edilizie/urbanistiche');
    }

    // Conformità catastale
    if (catastale) {
      parts.push('è conforme alle norme catastali');
    } else {
      parts.push('non è conforme alle norme catastali');
    }

    // Conformità impianti (plurale)
    if (impianti) {
      parts.push('gli impianti sono conformi alle normative vigenti');
    } else {
      parts.push('gli impianti non sono conformi alle normative vigenti');
    }

    testo = 'L\'immobile ' + parts.join(', ');
  }

  // PARTE 2: Vincoli (continua con virgola)
  if (stato.vincoli) {
    const iscrizioni = stato.vincoli.iscrizioni_pregiudizievoli === true;
    const vincoli = stato.vincoli.vincoli_servitu === true;

    if (testo) {
      testo += ', ';
    } else {
      testo = 'Sull\'immobile ';
    }

    // Iscrizioni pregiudizievoli
    if (iscrizioni) {
      testo += 'esistono iscrizioni/trascrizioni pregiudizievoli';
    } else {
      testo += 'non esistono iscrizioni/trascrizioni pregiudizievoli';
    }

    // Vincoli e servitù
    if (vincoli) {
      testo += ', esistono vincoli e/o servitù attive/passive.';
    } else {
      testo += ', non esistono vincoli e/o servitù attive/passive.';
    }
  } else if (testo) {
    // Chiude la frase se c'è solo conformità
    testo += '.';
  }

  // PARTE 3: Documenti consegnati
  if (stato.documenti_consegnati && stato.documenti_consegnati.length > 0) {
    const mappingDocumenti = {
      'titoli_provenienza': 'copia titoli di provenienza',
      'planimetria': 'planimetria catastale',
      'visure': 'visure catastali',
      'ape': 'attestato di prestazione energetica'
    };

    const documenti = stato.documenti_consegnati.map(doc => {
      // Se inizia con "altro:", ritorna direttamente
      if (doc.startsWith('altro:')) {
        return doc.substring(6).trim();
      }
      // Altrimenti usa il mapping
      return mappingDocumenti[doc] || doc;
    });

    // Aggiungi paragrafo separato per documenti
    if (testo) {
      testo += '\n\nSono stati consegnati: ' + documenti.join(', ') + '.';
    } else {
      testo = 'Sono stati consegnati: ' + documenti.join(', ') + '.';
    }
  }

  return testo;
}

// BLOCCO: Genera testo certificazione energetica
function generaTestoCertificazione(stato) {
  if (!stato || !stato.certificazione_energetica) return '';

  const cert = stato.certificazione_energetica;

  if (!cert.modalita) return '';

  if (cert.modalita === 'gia_presente') {
    const classe = cert.classe || '[N/D]';
    const consumo = cert.consumo_kwh || '[N/D]';
    const codice = cert.codice_attestato || '[N/D]';
    const data = cert.data_emissione || '[N/D]';
    const certificatore = cert.certificatore || '[N/D]';

    return `Attestato di prestazione energetica: classe energetica ${classe}, consumo ${consumo} kWh/mq anno, codice attestato ${codice}, data di emissione ${data}, certificatore ${certificatore}.`;
  }

  switch(cert.modalita) {
    case 'da_predisporre':
      return 'Attestato di prestazione energetica da predisporre a cura e spese del Venditore.';
    case 'commissionata':
      return 'Attestato di prestazione energetica commissionata all\'Agenzia Immobiliare dal Venditore che ne sosterrà direttamente e completamente il costo.';
    case 'non_soggetto':
      return 'Immobile non soggetto all\'obbligo di certificazione energetica.';
    default:
      return '';
  }
}

/**
 * Processa tabelle catastali direttamente dal mergeData senza marker JSON
 */
function processTabelleCatastaliDirettamente(doc, body, mergeData, immobiliData) {
  const debugInfo = [];

  debugInfo.push('🚀 TABELLE-MARKER-1: Entrata funzione processTabelleCatastaliDirettamente');
  debugInfo.push('🏗️ === INIZIO PROCESSING TABELLE CATASTALI ===');
  debugInfo.push(`🏗️ DEBUG Immobili ricevuti: ${immobiliData ? immobiliData.length : 'undefined'}`);

  let immobiliStructure = 'ERROR_STRINGIFY';
  try {
    debugInfo.push('🚀 TABELLE-MARKER-2: Tentativo JSON.stringify immobili...');
    immobiliStructure = JSON.stringify(immobiliData, null, 2);
    debugInfo.push('🚀 TABELLE-MARKER-3: JSON.stringify completato');
  } catch (jsonError) {
    debugInfo.push(`🚀 TABELLE-MARKER-ERROR: Errore JSON.stringify: ${jsonError.toString()}`);
    immobiliStructure = `ERROR: ${jsonError.toString()}`;
  }

  // Cerca il placeholder delle tabelle catastali
  const placeholder = 'TABELLE_CATASTALI_PLACEHOLDER_TEMP';
  const placeholderElement = body.findText(placeholder);

  debugInfo.push('🚀 TABELLE-MARKER-4: Cercando placeholder...');
  debugInfo.push(`🔍 Cercando placeholder: "${placeholder}"`);
  debugInfo.push(`🔍 Placeholder trovato: ${!!placeholderElement}`);

  if (!placeholderElement) {
    debugInfo.push('🚀 TABELLE-MARKER-5: Placeholder NON trovato');
    debugInfo.push('❌ Nessun placeholder tabelle catastali trovato');
    const docContent = body.getText().substring(0, 1000);
    debugInfo.push(`🔍 Contenuto documento (primi 1000 char): ${docContent}`);

    // Scrivi debug nel documento
    body.appendParagraph(`\n=== TABELLE DEBUG ===\nPlaceholder '${placeholder}' NON TROVATO\nContenuto documento: ${docContent}\n====================`);

    return { success: false, debugInfo: debugInfo };
  }

  debugInfo.push('🚀 TABELLE-MARKER-6: Placeholder TROVATO!');

  if (!immobiliData || immobiliData.length === 0) {
    debugInfo.push('🚀 TABELLE-MARKER-7: Nessun dato immobile');
    debugInfo.push('⚠️ Nessun dato immobile disponibile');
    body.replaceText(placeholder, '[NESSUN DATO CATASTALE DISPONIBILE]');
    return { success: true, debugInfo: debugInfo };
  }

  debugInfo.push('🚀 TABELLE-MARKER-8: Dati immobile presenti, procedo...');

  // Analizza struttura dati immobili
  const primoImmobile = immobiliData[0] || {};
  const campiDisponibili = Object.keys(primoImmobile);

  debugInfo.push(`🚀 TABELLE-ANALISI: Campi disponibili nel primo immobile: ${campiDisponibili.join(', ')}`);

  // Ora che abbiamo i dati, procediamo con la generazione delle tabelle
  debugInfo.push('🚀 TABELLE-PROCESSING: Avvio generazione tabelle reali...');

  // Rimuovi il placeholder per preparare l'inserimento delle tabelle
  const paragraphElement = placeholderElement.getElement().getParent();
  const insertIndex = body.getChildIndex(paragraphElement);

  debugInfo.push(`🔍 Insert index calcolato: ${insertIndex}`);

  // Rimuovi il placeholder
  body.replaceText(placeholder, '');

  // Genera tabelle per ogni immobile
  let currentIndex = insertIndex;
  immobiliData.forEach((immobile, immobileIndex) => {
    debugInfo.push(`🏗️ === Generando tabelle per immobile ${immobileIndex + 1} ===`);

    // INTESTAZIONE COMPLETA PER OGNI IMMOBILE

    // Titolo "Immobile N:" (sempre, anche con 1 solo immobile)
    const titoloParagraph = body.insertParagraph(currentIndex, `Immobile ${immobileIndex + 1}:`);
    applicaStiliTitolo(titoloParagraph);
    currentIndex++;

    // Riga: Provincia, Comune, Via, Numero
    const provinciaSigla = immobile.provincia || '[PROVINCIA NON SPECIFICATA]';
    const provincia = getNomeProvinciaCompleto(provinciaSigla) || provinciaSigla;
    const comune = immobile.comune || '[COMUNE NON SPECIFICATO]';
    const via = immobile.via || '[VIA NON SPECIFICATA]';
    const numero = immobile.numero || '[S.N.]';

    const indirizzoCompleto = `Provincia di ${provincia}, Comune di ${comune}, ${via} n. ${numero}`;
    const indirizzoParagraph = body.insertParagraph(currentIndex, indirizzoCompleto);
    indirizzoParagraph.editAsText().setFontSize(11);
    currentIndex++;

    // Riga: Intestato a: **nome cognome**, **nome cognome**
    const intestatari = generateIntestatariSingoloImmobile(immobile);
    const intestatariParagraph = body.insertParagraph(currentIndex, `Intestato a: ${intestatari}`);
    intestatariParagraph.editAsText().setFontSize(11);
    currentIndex++;

    // Riga: Attualmente distinto nel catasto dei [fabbricati/terreni] al:
    let tipoCatasto = 'catasto';
    if (immobile.blocchiCatastali && immobile.blocchiCatastali.length > 0) {
      const primoBlocco = immobile.blocchiCatastali[0];
      tipoCatasto = primoBlocco.tipoCatasto === 'fabbricati' ? 'fabbricati' : 'terreni';
    }

    const catastoParagraph = body.insertParagraph(currentIndex, `Attualmente distinto nel catasto dei ${tipoCatasto} al:`);
    catastoParagraph.editAsText().setFontSize(11);
    currentIndex++;

    // Spazio vuoto prima della tabella
    body.insertParagraph(currentIndex, '');
    currentIndex++;

    // LOGICA MULTI-SCENARIO per diverse strutture di dati
    let tabelleFabbricatiGenerate = false;
    let tabelleTerrenigenerate = false;

    // SCENARIO 1: Struttura con blocchiCatastali (nuova struttura)
    if (immobile.blocchiCatastali && immobile.blocchiCatastali.length > 0) {
      debugInfo.push(`🏗️ SCENARIO 1: Trovati ${immobile.blocchiCatastali.length} blocchi catastali`);

      immobile.blocchiCatastali.forEach((blocco, bloccoIndex) => {
        debugInfo.push(`🏗️ Processing blocco ${bloccoIndex + 1}: ${blocco.tipoCatasto}`);

        if (blocco.tipoCatasto === 'fabbricati' && blocco.righe && blocco.righe.length > 0) {
          debugInfo.push(`🏗️ Inserendo tabella FABBRICATI con ${blocco.righe.length} righe`);
          try {
            // ✅ USA TABELLA con supporto note
            currentIndex = insertTabellaFabbricatiAvanzata(body, blocco, currentIndex);
            tabelleFabbricatiGenerate = true;
            debugInfo.push(`✅ Tabella FABBRICATI inserita con note, nuovo index: ${currentIndex}`);
          } catch (error) {
            debugInfo.push(`❌ Errore inserimento tabella FABBRICATI: ${error.toString()}`);
          }
        } else if (blocco.tipoCatasto === 'terreni' && blocco.righe && blocco.righe.length > 0) {
          debugInfo.push(`🏗️ Inserendo tabella TERRENI con ${blocco.righe.length} righe`);
          try {
            // ✅ USA TABELLA con supporto note
            currentIndex = insertTabellaTerreniaAvanzata(body, blocco, currentIndex);
            tabelleTerrenigenerate = true;
            debugInfo.push(`✅ Tabella TERRENI inserita con note, nuovo index: ${currentIndex}`);
          } catch (error) {
            debugInfo.push(`❌ Errore inserimento tabella TERRENI: ${error.toString()}`);
          }
        }
      });
    }

    // SCENARIO 2: Struttura con righe_catastali_fabbricati dirette (vecchia struttura)
    if (!tabelleFabbricatiGenerate && immobile.righe_catastali_fabbricati && immobile.righe_catastali_fabbricati.length > 0) {
      debugInfo.push(`🏗️ SCENARIO 2: Trovate ${immobile.righe_catastali_fabbricati.length} righe fabbricati dirette`);
      try {
        currentIndex = insertTabellaFabbricatiAvanzata(body, immobile.righe_catastali_fabbricati, currentIndex);
        tabelleFabbricatiGenerate = true;
        debugInfo.push(`✅ Tabella FABBRICATI (scenario 2) inserita, nuovo index: ${currentIndex}`);
      } catch (error) {
        debugInfo.push(`❌ Errore inserimento tabella FABBRICATI (scenario 2): ${error.toString()}`);
      }
    }

    // SCENARIO 3: Fallback - crea messaggio di debug
    if (!tabelleFabbricatiGenerate && !tabelleTerrenigenerate) {
      debugInfo.push(`🏗️ SCENARIO 3: Fallback - nessuna struttura catastale riconosciuta`);
      const debugParagraph = body.insertParagraph(currentIndex, `[DEBUG] Immobile ${immobileIndex + 1} - Campi: ${campiDisponibili.join(', ')}`);
      currentIndex++;
    }

    // CONFINI: Genera testo confini se presenti
    if (immobile.confini) {
      debugInfo.push(`📍 Generando confini per immobile ${immobileIndex + 1}`);
      debugInfo.push(`📍 Struttura confini:`, JSON.stringify(immobile.confini));

      const confiniParts = [];

      // Processa ogni direzione
      ['nord', 'est', 'sud', 'ovest'].forEach(direzione => {
        if (immobile.confini[direzione] && Array.isArray(immobile.confini[direzione])) {
          // Filtra mappali vuoti e uniscili
          const mappaliValidi = immobile.confini[direzione].filter(m => m && m.trim() !== '');

          if (mappaliValidi.length > 0) {
            const mappaliText = mappaliValidi.join(', ');
            confiniParts.push(`${direzione} ai mappali ${mappaliText}`);
          }
        }
      });

      if (confiniParts.length > 0) {
        const confiniText = `confini: ${confiniParts.join('; ')}`;
        debugInfo.push(`📍 Testo confini generato: ${confiniText}`);

        const confiniPara = body.insertParagraph(currentIndex++, confiniText);
        confiniPara.editAsText().setFontSize(11);

        // Riga vuota dopo confini
        body.insertParagraph(currentIndex++, '');
        debugInfo.push(`✅ Confini inseriti, nuovo index: ${currentIndex}`);
      } else {
        debugInfo.push(`⚠️ Nessun mappale valido nei confini`);
      }
    } else {
      debugInfo.push(`⚠️ Nessuna struttura confini trovata per immobile ${immobileIndex + 1}`);
    }

    // ========== STATO IMMOBILE ==========
    if (immobile.stato) {
      debugInfo.push(`🏠 Generando stato per immobile ${immobileIndex + 1}`);

      // Spazio prima dello stato
      body.insertParagraph(currentIndex++, '');

      // ===== SEZIONE 1: STATO ATTUALE (solo occupazione) =====
      const testoOccupazione = generaTestoOccupazione(immobile.stato);
      if (testoOccupazione) {
        const titoloStato = body.insertParagraph(currentIndex++, 'STATO ATTUALE');
        titoloStato.editAsText().setBold(true).setFontSize(11);

        body.insertParagraph(currentIndex++, testoOccupazione).editAsText().setFontSize(11);
        debugInfo.push(`✅ Sezione STATO ATTUALE generata`);
      }

      // ===== SEZIONE 2: DICHIARAZIONI DEL VENDITORE (conformità + vincoli + documenti) =====
      const testoDichiarazioni = generaTestoDichiarazioni(immobile.stato);
      if (testoDichiarazioni) {
        // Spazio tra sezioni
        body.insertParagraph(currentIndex++, '');

        const titoloDichiarazioni = body.insertParagraph(currentIndex++, 'DICHIARAZIONI DEL VENDITORE');
        titoloDichiarazioni.editAsText().setBold(true).setFontSize(11);

        // Il testo può contenere \n\n per paragrafi separati (documenti)
        const paragrafi = testoDichiarazioni.split('\n\n');
        paragrafi.forEach(paragrafo => {
          if (paragrafo.trim()) {
            body.insertParagraph(currentIndex++, paragrafo.trim()).editAsText().setFontSize(11);
          }
        });

        debugInfo.push(`✅ Sezione DICHIARAZIONI DEL VENDITORE generata`);
      }

      // ===== SEZIONE 3: CERTIFICAZIONE ENERGETICA =====
      const testoCert = generaTestoCertificazione(immobile.stato);
      if (testoCert) {
        // Spazio tra sezioni
        body.insertParagraph(currentIndex++, '');

        const titoloCert = body.insertParagraph(currentIndex++, 'CERTIFICAZIONE ENERGETICA');
        titoloCert.editAsText().setBold(true).setFontSize(11);

        body.insertParagraph(currentIndex++, testoCert).editAsText().setFontSize(11);
        debugInfo.push(`✅ Sezione CERTIFICAZIONE ENERGETICA generata`);
      }

      debugInfo.push(`✅ Stato immobile completato`);
    } else {
      debugInfo.push(`⚠️ Nessuno stato trovato per immobile ${immobileIndex + 1}`);
    }

    // Spazio tra immobili
    if (immobileIndex < immobiliData.length - 1) {
      body.insertParagraph(currentIndex, '');
      currentIndex++;
    }
  });

  debugInfo.push('✅ === FINE PROCESSING TABELLE CATASTALI ===');
  return { success: true, debugInfo: debugInfo };
}

/**
 * Inserisce tabella FABBRICATI con stili avanzati
 */
function insertTabellaFabbricatiAvanzata(body, blocco, insertIndex) {
  console.log(`📋 === INIZIO insertTabellaFabbricatiAvanzata ===`);
  console.log(`📋 Insert index: ${insertIndex}`);
  console.log(`📋 Blocco:`, JSON.stringify(blocco, null, 2));

  const config = TABELLE_STILI_CONFIG;
  const righe = blocco.righe || [];

  try {
    // NUOVO: Se c'è una nota, inseriscila PRIMA della tabella
    if (blocco.descrizione || blocco.descrizioneCustom) {
      const notaText = blocco.descrizioneCustom || getNotaText(blocco.descrizione);
      if (notaText && notaText.trim() !== '') {
        console.log(`📋 Inserendo nota FABBRICATI: ${notaText}`);
        const notaPara = body.insertParagraph(insertIndex++, notaText);
        notaPara.editAsText().setItalic(true).setFontSize(10);
        body.insertParagraph(insertIndex++, ''); // Riga vuota
      }
    }

    // Crea tabella
    console.log(`📋 Inserendo tabella al index ${insertIndex}...`);
    const table = body.insertTable(insertIndex);
    console.log(`📋 Tabella creata, ID:`, table.getId ? table.getId() : 'N/A');

    // Crea header
    console.log(`📋 Creando header...`);
    const headerRow = table.appendTableRow();
    const headerLabels = ['FOG', 'MAP', 'SUB', 'CATEGORIA', 'CLASSE', 'VANI-MQ', 'SUPERFICI', 'INDIRIZZO-PIANO', 'RENDITA'];

    headerLabels.forEach((label, index) => {
      console.log(`📋 Aggiungendo header cell ${index + 1}: "${label}"`);
      const cell = headerRow.appendTableCell(label);

      // Applica stili header
      try {
        applicaStiliCella(cell, {
          fontSize: config.font.dimensione_header,
          fontFamily: config.font.famiglia,
          fontColor: config.font.colore_header,
          backgroundColor: config.tabella.sfondo_header,
          alignment: config.tabella.allineamento_header,
          bold: true
        });
        console.log(`📋 ✅ Stili applicati a header cell ${index + 1}`);
      } catch (styleError) {
        console.error(`📋 ❌ Errore applicazione stili header cell ${index + 1}:`, styleError);
      }
    });

    console.log(`📋 Header completato. Aggiungendo ${righe.length} righe dati...`);

    // Aggiungi righe dati
    righe.forEach((riga, rigaIndex) => {
      console.log(`📋 Aggiungendo riga ${rigaIndex + 1}:`, JSON.stringify(riga, null, 2));

      try {
        const dataRow = table.appendTableRow();

        // Valori delle celle
        const cellValues = [
          riga.foglio || '',
          riga.mappale || '',
          riga.subalterno || '',
          riga.categoria || '',
          riga.classe || '',
          riga.vani_mq || '',         // ✅ CORRETTO: era "vani" o "superficie"
          riga.superfici || '',       // ✅ CORRETTO: era "superficie"
          riga.indirizzo_piano || '', // ✅ CORRETTO: era "indirizzo"
          riga.rendita ? `€ ${riga.rendita}` : ''
        ];

        console.log(`📋 Valori celle riga ${rigaIndex + 1}:`, cellValues);

        cellValues.forEach((value, cellIndex) => {
          try {
            const cell = dataRow.appendTableCell(value.toString());

            // Applica stili dati
            applicaStiliCella(cell, {
              fontSize: config.font.dimensione_dati,
              fontFamily: config.font.famiglia,
              fontColor: config.font.colore_dati,
              backgroundColor: config.tabella.sfondo_dati,
              alignment: config.tabella.allineamento_dati,
              bold: false
            });
          } catch (cellError) {
            console.error(`📋 ❌ Errore cella ${cellIndex + 1} della riga ${rigaIndex + 1}:`, cellError);
          }
        });

        console.log(`📋 ✅ Riga ${rigaIndex + 1} completata`);
      } catch (rowError) {
        console.error(`📋 ❌ Errore riga ${rigaIndex + 1}:`, rowError);
      }
    });

    // Applica stili tabella globali
    console.log(`📋 Applicando stili globali tabella...`);
    applicaStiliTabella(table, config);

    console.log(`✅ Tabella FABBRICATI inserita con ${righe.length} righe`);
    return insertIndex + 1;

  } catch (error) {
    console.error(`❌ ERRORE CRITICO insertTabellaFabbricatiAvanzata:`, error);
    console.error(`❌ Stack trace:`, error.stack);

    // Fallback: inserisci un paragrafo di errore
    try {
      const errorParagraph = body.insertParagraph(insertIndex, `[ERRORE] Impossibile generare tabella fabbricati: ${error.toString()}`);
      return insertIndex + 1;
    } catch (fallbackError) {
      console.error(`❌ Anche il fallback è fallito:`, fallbackError);
      return insertIndex;
    }
  }
}

/**
 * Inserisce tabella TERRENI con stili avanzati
 */
function insertTabellaTerreniaAvanzata(body, blocco, insertIndex) {
  console.log(`📋 === INIZIO insertTabellaTerreniaAvanzata ===`);
  console.log(`📋 Insert index: ${insertIndex}`);
  console.log(`📋 Blocco:`, JSON.stringify(blocco, null, 2));

  const config = TABELLE_STILI_CONFIG;
  const righe = blocco.righe || [];

  try {
    // NUOVO: Se c'è una nota, inseriscila PRIMA della tabella
    if (blocco.descrizione || blocco.descrizioneCustom) {
      const notaText = blocco.descrizioneCustom || getNotaText(blocco.descrizione);
      if (notaText && notaText.trim() !== '') {
        console.log(`📋 Inserendo nota TERRENI: ${notaText}`);
        const notaPara = body.insertParagraph(insertIndex++, notaText);
        notaPara.editAsText().setItalic(true).setFontSize(10);
        body.insertParagraph(insertIndex++, ''); // Riga vuota
      }
    }

    // Crea tabella
    console.log(`📋 Inserendo tabella TERRENI al index ${insertIndex}...`);
    const table = body.insertTable(insertIndex);
    console.log(`📋 Tabella TERRENI creata, ID:`, table.getId ? table.getId() : 'N/A');

    // Crea header
    console.log(`📋 Creando header TERRENI...`);
    const headerRow = table.appendTableRow();
    const headerLabels = ['FOG', 'MAP', 'PORZ', 'QUALITA', 'CLASSE', 'METRI QUADRATI', 'DOMINICALE', 'AGRARIO'];

    headerLabels.forEach((label, index) => {
      console.log(`📋 Aggiungendo header cell ${index + 1}: "${label}"`);
      const cell = headerRow.appendTableCell(label);

      // Applica stili header
      try {
        applicaStiliCella(cell, {
          fontSize: config.font.dimensione_header,
          fontFamily: config.font.famiglia,
          fontColor: config.font.colore_header,
          backgroundColor: config.tabella.sfondo_header,
          alignment: config.tabella.allineamento_header,
          bold: true
        });
        console.log(`📋 ✅ Stili applicati a header cell TERRENI ${index + 1}`);
      } catch (styleError) {
        console.error(`📋 ❌ Errore applicazione stili header TERRENI cell ${index + 1}:`, styleError);
      }
    });

    console.log(`📋 Header TERRENI completato. Aggiungendo ${righe.length} righe dati...`);

    // Aggiungi righe dati
    righe.forEach((riga, rigaIndex) => {
      console.log(`📋 Aggiungendo riga TERRENI ${rigaIndex + 1}:`, JSON.stringify(riga, null, 2));

      try {
        const dataRow = table.appendTableRow();

        // Valori delle celle
        const cellValues = [
          riga.foglio || '',
          riga.mappale || '',
          riga.porzione || '',
          riga.qualita || '',
          riga.classe || '',
          riga.metri_quadrati || '',        // ✅ CORRETTO: era "superficie"
          riga.dominicale ? `€ ${riga.dominicale}` : '',  // ✅ CORRETTO: era "reddito_dominicale"
          riga.agrario ? `€ ${riga.agrario}` : ''         // ✅ CORRETTO: era "reddito_agrario"
        ];

        console.log(`📋 Valori celle riga TERRENI ${rigaIndex + 1}:`, cellValues);

        cellValues.forEach((value, cellIndex) => {
          try {
            const cell = dataRow.appendTableCell(value.toString());

            // Applica stili dati
            applicaStiliCella(cell, {
              fontSize: config.font.dimensione_dati,
              fontFamily: config.font.famiglia,
              fontColor: config.font.colore_dati,
              backgroundColor: config.tabella.sfondo_dati,
              alignment: config.tabella.allineamento_dati,
              bold: false
            });
          } catch (cellError) {
            console.error(`📋 ❌ Errore cella TERRENI ${cellIndex + 1} della riga ${rigaIndex + 1}:`, cellError);
          }
        });

        console.log(`📋 ✅ Riga TERRENI ${rigaIndex + 1} completata`);
      } catch (rowError) {
        console.error(`📋 ❌ Errore riga TERRENI ${rigaIndex + 1}:`, rowError);
      }
    });

    // Applica stili tabella globali
    console.log(`📋 Applicando stili globali tabella TERRENI...`);
    applicaStiliTabella(table, config);

    console.log(`✅ Tabella TERRENI inserita con ${righe.length} righe`);
    return insertIndex + 1;

  } catch (error) {
    console.error(`❌ ERRORE CRITICO insertTabellaTerreniaAvanzata:`, error);
    console.error(`❌ Stack trace:`, error.stack);

    // Fallback: inserisci un paragrafo di errore
    try {
      const errorParagraph = body.insertParagraph(insertIndex, `[ERRORE] Impossibile generare tabella terreni: ${error.toString()}`);
      return insertIndex + 1;
    } catch (fallbackError) {
      console.error(`❌ Anche il fallback TERRENI è fallito:`, fallbackError);
      return insertIndex;
    }
  }
}

// ========== NUOVE FUNZIONI FORMATO TESTO (NON TABELLE) ==========

/**
 * Helper per ottenere testo nota da codice
 */
function getNotaText(descrizioneValue) {
  const mapping = {
    'area_sedime': "l'area di sedime di pertinenza è distinta nel catasto dei terreni al",
    'area_cortiliva': "l'area cortiliva di pertinenza è distinta nel catasto dei terreni al",
    'parte_area_sedime': "parte dell'area di sedime di pertinenza è distinta nel catasto dei terreni al",
    'parte_area_cortiliva': "parte dell'area cortiliva di pertinenza è distinta nel catasto dei terreni al",
    'area_sedime_e_cortiliva': "l'area di sedime e parte dell'area cortiliva di pertinenza è distinta nel catasto dei terreni al"
  };
  return mapping[descrizioneValue] || '';
}

// (Funzioni testo rimosse - si usano le tabelle)

/**
 * Applica stili a una singola cella
 */
function applicaStiliCella(cell, options) {
  const text = cell.editAsText();

  // Font
  if (options.fontFamily) text.setFontFamily(options.fontFamily);
  if (options.fontSize) text.setFontSize(options.fontSize);
  if (options.fontColor) text.setForegroundColor(options.fontColor);
  if (options.bold !== undefined) text.setBold(options.bold);

  // Sfondo cella
  if (options.backgroundColor) cell.setBackgroundColor(options.backgroundColor);

  // Allineamento
  if (options.alignment) {
    const textAlign = DocumentApp.HorizontalAlignment[options.alignment];
    if (textAlign) {
      cell.editAsText().editAsText().getParent().asParagraph().setAlignment(textAlign);
    }
  }

  // Padding (se supportato)
  if (TABELLE_STILI_CONFIG.spaziatura.padding_celle) {
    cell.setPaddingTop(TABELLE_STILI_CONFIG.spaziatura.padding_celle);
    cell.setPaddingBottom(TABELLE_STILI_CONFIG.spaziatura.padding_celle);
    cell.setPaddingLeft(TABELLE_STILI_CONFIG.spaziatura.padding_celle);
    cell.setPaddingRight(TABELLE_STILI_CONFIG.spaziatura.padding_celle);
  }
}

/**
 * Applica stili globali alla tabella
 */
function applicaStiliTabella(table, config) {
  // Bordi
  if (config.tabella.larghezza_bordo) {
    table.setBorderWidth(config.tabella.larghezza_bordo);
  }
  if (config.tabella.colore_bordo) {
    table.setBorderColor(config.tabella.colore_bordo);
  }
}

/**
 * Applica stili al titolo immobile
 */
function applicaStiliTitolo(paragraph) {
  const text = paragraph.editAsText();
  text.setBold(true);
  text.setFontSize(10);
  text.setFontFamily(TABELLE_STILI_CONFIG.font.famiglia);
}
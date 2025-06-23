// document-generator.gs - Generatore documenti SIAF
// Gestisce creazione cartelle pratiche e generazione documenti da template

// ========== CONFIGURAZIONI TEMPLATE ==========

const TEMPLATE_CONFIG = {
  FOLDER_ID: '1DavE6tVOlyyilPAZUKONkLpCFwYKgpFH',
  PRATICHE_FOLDER_ID: '1DavE6tVOlyyilPAZUKONkLpCFwYKgpFH', // Temporary - da configurare
  
  TEMPLATE_MAPPING: {
    'luigi_b': 'Template_Incarico_Luigi_B',
    'daniele_d': 'Template_Incarico_Daniele_D',
    'giulia_t': 'Template_Incarico_Giulia_T',
    'mirco_c': 'Template_Incarico_Mirco_C',
    'giuliano_h': 'Template_Incarico_Giuliano_H',
    'silvia_b': 'Template_Incarico_Silvia_B',
    'milena_b': 'Template_Incarico_Milena_B'
  }
};

// ========== ENDPOINT PRINCIPALE ==========

function handleGenerateDocuments(requestData) {
  try {
    console.log('🏗️ Inizio generazione documenti:', requestData);
    
    // STEP 1: Validazione dati
    const validationResult = validateGenerationData(requestData);
    if (!validationResult.valid) {
      return {
        success: false,
        error: 'Dati non validi: ' + validationResult.error
      };
    }
    
    // STEP 2: Creazione struttura cartelle
    const folderResult = createPraticaFolders(requestData);
    if (!folderResult.success) {
      return {
        success: false,
        error: 'Errore creazione cartelle: ' + folderResult.error
      };
    }
    
    // STEP 3: Generazione documenti
    const documentsResult = generateDocuments(requestData, folderResult.folders);
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

function createPraticaFolders(data) {
  try {
    const anno = data.anno || new Date().getFullYear();
    const protocollo = data.protocollo;
    
    // Trova o crea cartella anno
    const annoFolder = findOrCreateFolder(`PRATICHE ${anno}`, TEMPLATE_CONFIG.FOLDER_ID);
    
    // Crea cartella pratica specifica
    const praticaFolderName = protocollo.replace('/', '-'); // 3667/B → 3667-B
    const praticaFolder = DriveApp.createFolder(praticaFolderName);
    annoFolder.addFolder(praticaFolder);
    
    // Crea sottocartelle
    const docGeneratiFolder = DriveApp.createFolder('01-DOCUMENTI-GENERATI');
    const allegatiFolder = DriveApp.createFolder('02-ALLEGATI');
    const corrispondenzaFolder = DriveApp.createFolder('03-CORRISPONDENZA');
    
    praticaFolder.addFolder(docGeneratiFolder);
    praticaFolder.addFolder(allegatiFolder);
    praticaFolder.addFolder(corrispondenzaFolder);
    
    console.log(`✅ Struttura cartelle creata per pratica ${protocollo}`);
    
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
    
    // Genera incarico di mediazione se richiesto
    if (data.documenti_richiesti.includes('incarico_mediazione')) {
      const incaricoResult = generateIncaricoMediazione(data, folders.documenti);
      if (incaricoResult.success) {
        documentiCreati.push(incaricoResult);
      }
    }
    
    // Genera preventivo imposte se richiesto
    if (data.documenti_richiesti.includes('preventivo_imposte')) {
      const preventivoResult = generatePreventivoImposte(data, folders.documenti);
      if (preventivoResult.success) {
        documentiCreati.push(preventivoResult);
      }
    }
    
    // Genera delega planimetrie se richiesto
    if (data.documenti_richiesti.includes('delega_planimetrie')) {
      const delegaResult = generateDelegaPlanimetrie(data, folders.documenti);
      if (delegaResult.success) {
        documentiCreati.push(delegaResult);
      }
    }
    
    return {
      success: true,
      documenti_creati: documentiCreati.length,
      documenti_lista: documentiCreati
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
    // Trova template corretto per operatore
    const templateName = TEMPLATE_CONFIG.TEMPLATE_MAPPING[data.lettera.toLowerCase()];
    if (!templateName) {
      throw new Error(`Template non trovato per operatore: ${data.lettera}`);
    }
    
    const templateDoc = findTemplateDocument(templateName, 'INCARICHI');
    if (!templateDoc) {
      throw new Error(`Template document non trovato: ${templateName}`);
    }
    
    // Prepara dati per merge
    const mergeData = prepareMergeDataIncarico(data);
    
    // Crea copia del template
    const newDocName = `Incarico_Mediazione_${data.protocollo.replace('/', '-')}`;
    const newDoc = templateDoc.makeCopy(newDocName, targetFolder);
    
    // Esegui merge dati
    performDocumentMerge(newDoc, mergeData);
    
    console.log(`✅ Incarico mediazione generato: ${newDocName}`);
    
    return {
      success: true,
      tipo: 'incarico_mediazione',
      nome: newDocName,
      url: newDoc.getUrl(),
      id: newDoc.getId()
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

function findTemplateDocument(templateName, subfolder) {
  try {
    const templatesFolder = DriveApp.getFolderById(TEMPLATE_CONFIG.FOLDER_ID);
    const subfolders = templatesFolder.getFoldersByName(subfolder);
    
    if (!subfolders.hasNext()) {
      throw new Error(`Sottocartella ${subfolder} non trovata`);
    }
    
    const targetFolder = subfolders.next();
    const files = targetFolder.getFilesByName(templateName);
    
    if (!files.hasNext()) {
      throw new Error(`Template ${templateName} non trovato in ${subfolder}`);
    }
    
    return DocumentApp.openById(files.next().getId());
    
  } catch (error) {
    console.error(`❌ Errore ricerca template ${templateName}:`, error);
    return null;
  }
}

// ========== PREPARAZIONE DATI MERGE ==========

function prepareMergeDataIncarico(data) {
  // Elabora logica venditori
  const venditori = data.venditori || [];
  const isPlural = venditori.length > 1;
  const hasFemmine = venditori.some(v => v.sesso === 'F' || detectFemaleFromName(v.nome));
  
  // Genera testo venditori completo
  const testoVenditori = generateVenditoriText(venditori);
  
  return {
    // Dati venditori elaborati
    testo_venditori_completo: testoVenditori,
    articolo_venditori: isPlural ? 'i' : (hasFemmine ? 'a' : 'o'),
    denominazione_venditori: isPlural ? 'Venditori' : (hasFemmine ? 'Venditrice' : 'Venditore'),
    articolo_venditori_breve: isPlural ? 'i' : (hasFemmine ? 'la' : 'il'),
    articolo_de_venditori: isPlural ? 'dei' : (hasFemmine ? 'della' : 'del'),
    articolo_da_venditori: isPlural ? 'dai' : (hasFemmine ? 'dalla' : 'dal'),
    
    // Dati pratica
    protocollo: data.protocollo,
    operatore: data.operatore,
    data_compilazione: data.data_compilazione,
    
    // Placeholder temporanei (da implementare)
    provincia_immobile: 'Rovigo',
    comune_immobile: 'Bergantino',
    indirizzo_immobile: 'via Giuseppe Garibaldi numero 747',
    prezzo_vendita: '60.000,00',
    prezzo_vendita_lettere: 'sessantamila/00',
    luogo_sottoscrizione: 'Bergantino',
    data_sottoscrizione: formatDate(new Date()),
    
    // Dati da configurare
    percentuale_provvigione: '3',
    percentuale_provvigione_lettere: 'tre',
    soglia_minima: '50.000,00',
    importo_minimo: '1.500,00'
  };
}

function generateVenditoriText(venditori) {
  if (!venditori || venditori.length === 0) return '';
  
  let result = '';
  
  venditori.forEach((venditore, index) => {
    const isFemale = venditore.sesso === 'F' || detectFemaleFromName(venditore.nome);
    const isFirst = index === 0;
    const isLast = index === venditori.length - 1;
    
    if (isFirst) {
      result += isFemale ? 'La sottoscritta ' : 'Il sottoscritto ';
    } else {
      result += isFemale ? 'la sottoscritta ' : 'il sottoscritto ';
    }
    
    result += `${venditore.nome} ${venditore.cognome}`;
    
    if (venditore.luogo_nascita && venditore.data_nascita) {
      result += ` nat${isFemale ? 'a' : 'o'} a ${venditore.luogo_nascita} il ${venditore.data_nascita}`;
    }
    
    if (venditore.codice_fiscale) {
      result += `, codice fiscale ${venditore.codice_fiscale}`;
    }
    
    // Aggiungi altri dati se disponibili
    // documento, residenza, telefono, etc.
    
    if (!isLast) {
      result += ';\n';
    }
  });
  
  return result;
}

function detectFemaleFromName(nome) {
  if (!nome) return false;
  const femaleEndings = ['a', 'ia', 'ina', 'etta', 'anna'];
  return femaleEndings.some(ending => nome.toLowerCase().endsWith(ending));
}

// ========== MERGE DOCUMENTI ==========

function performDocumentMerge(doc, mergeData) {
  const body = doc.getBody();
  
  // Sostituisci tutti i placeholder
  Object.keys(mergeData).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = mergeData[key] || '';
    body.replaceText(placeholder, value);
  });
  
  doc.saveAndClose();
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

// ========== INIZIALIZZAZIONE AUTOMATICA (DEBUG) ==========

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 DOM loaded, avvio debug Document Generator...');
    
    // Verifica presenza elementi
    const generateBtn = document.getElementById('generate-documents');
    const generateStatus = document.getElementById('generate-status');
    const siafApp = window.siafApp;
    
    console.log('🔍 Generate button trovato:', !!generateBtn);
    console.log('🔍 Generate status trovato:', !!generateStatus);
    console.log('🔍 SIAF App disponibile:', !!siafApp);
    
    if (generateBtn) {
        console.log('🔍 Pulsante HTML:', generateBtn.outerHTML);
    }
    
    // Aspetta che anche siafApp sia inizializzato
    setTimeout(() => {
        console.log('🚀 Inizializzazione SIAF Document Generator...');
        console.log('🔍 SIAF App dopo timeout:', !!window.siafApp);
        
        try {
            window.siafDocumentGenerator = new SiafDocumentGenerator();
            window.siafDocumentGenerator.init();
            console.log('✅ SIAF Document Generator pronto!');
        } catch (error) {
            console.error('❌ Errore inizializzazione Document Generator:', error);
        }
    }, 1000);
});

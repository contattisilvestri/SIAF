// Script per generare tutti i template SIAF con nuova nomenclatura
// Da eseguire una sola volta su Google Apps Script

const TEMPLATE_FOLDER_ID = '1UE7ZpwY_70h6lYN6PHHJ5NTr2IsfRRgu';

// Nuova mappatura operatori
const OPERATORI = [
  { nome: 'Luigi', lettera: 'L' },
  { nome: 'Silvia', lettera: 'L' },
  { nome: 'Milena', lettera: 'L' },
  { nome: 'Daniele', lettera: 'D' },
  { nome: 'Giulia', lettera: 'G' },
  { nome: 'Mirco', lettera: 'M' },
  { nome: 'Giuliano', lettera: 'H' }
];

// Elenco completo moduli
const MODULI = [
  'MODULO_A-DATI',
  'MODULO_AA-SCHEDA-COSTI-TEMPI',
  'MODULO_B-PREVENTIVO-PARTE-VENDITRICE',
  'MODULO_BB-CONSUNTIVO-PARTE-VENDITRICE',
  'MODULO_C-INCARICO-ASSISTENZA',
  'MODULO_C-INCARICO-MEDIAZIONE',
  'MODULO_D-PUBBLICITA',
  'MODULO_E-INFORMATIVA-E-CONSENSO',
  'MODULO_EE-INFORMATIVA-E-CONSENSO',
  'MODULO_F-DELEGA-ACCESSO-PLANIMETRIE',
  'MODULO_G-DELEGA-CDU-DOC-EDILIZIA',
  'MODULO_H-PREVENTIVI-PARTE-ACQUIRENTE',
  'MODULO_H-PREVENTIVI-PARTE-ACQUIRENTE-TERRENO-AGRICOLO',
  'MODULO_H-CESSIONE-DI-FABBRICATO',
  'MODULO_HH-CONSUNTIVO-PARTE-ACQUIRENTE-TERRENO-AGRICOLO',
  'MODULO_HH-CONSUNTIVO-PARTE-ACQUIRENTE',
  'MODULO_I-DICHIARAZIONE-DI-PRESA-VISIONE',
  'MODULO_L-PROPOSTA-ACQUISTO',
  'MODULO_M-PROPOSTA-ACQUISTO-CONDIZIONATA',
  'MODULO_N-RICHIESTA-DOCUMENTAZIONE-EDILIZIA',
  'MODULO_O-CONTRATTO-DI-COMPRAVENDITA',
  'MODULO_O-LISTA-IMPORTI-PARTE-ACQUIRENTE',
  'MODULO_O-LISTA-IMPORTI-PARTE-VENDITRICE',
  'MODULO_O-PRELIMINARE',
  'MODULO_P-VERIFICA-CLIENTELA',
  'MODULO_Q-VALUTAZIONE-RISCHIO',
  'MODULO_R-DELEGA-AGENZIA-ENTRATE',
  'MODULO_S-RICHIESTA-CDU',
  'MODULO_T-PROMEMORIA',
  'MODULO_V-INVIO-VOLTURA',
  'MODULO_Z-PREVENTIVO-AGENZIA',
  'MODULO_ZZ-PREVENTIVO-AGENZIA-CON-RITENUTA'
];

// Funzione principale - crea template in batch per evitare timeout
function generateTemplatesBatch(batchSize = 10) {
  try {
    console.log('🏗️ Inizio generazione template SIAF in batch...');

    const templateFolder = DriveApp.getFolderById(TEMPLATE_FOLDER_ID);

    // Raggruppa operatori per lettera
    const operatoriPerLettera = {};
    OPERATORI.forEach(op => {
      if (!operatoriPerLettera[op.lettera]) {
        operatoriPerLettera[op.lettera] = [];
      }
      operatoriPerLettera[op.lettera].push(op.nome);
    });

    // Crea lista di SOLO i template mancanti
    const missingTemplates = [];
    Object.keys(operatoriPerLettera).forEach(lettera => {
      const primoOperatore = operatoriPerLettera[lettera][0];
      MODULI.forEach(modulo => {
        const templateName = `${modulo}-${primoOperatore}-${lettera}`;

        // Controlla se esiste già
        const existingFiles = templateFolder.getFilesByName(templateName);
        if (!existingFiles.hasNext()) {
          missingTemplates.push({
            name: templateName,
            lettera: lettera,
            operatore: primoOperatore,
            modulo: modulo
          });
        }
      });
    });

    console.log(`📊 Template mancanti trovati: ${missingTemplates.length}`);

    if (missingTemplates.length === 0) {
      console.log('🎉 Tutti i template sono già stati creati!');
      return {
        success: true,
        created: 0,
        remaining: 0,
        totalQueue: 0,
        allComplete: true
      };
    }

    // Crea batch di template mancanti
    let created = 0;
    const batchToProcess = Math.min(batchSize, missingTemplates.length);

    for (let i = 0; i < batchToProcess; i++) {
      const template = missingTemplates[i];

      try {

        // Crea documento
        const doc = DocumentApp.create(template.name);
        const docFile = DriveApp.getFileById(doc.getId());

        // Sposta nella cartella
        templateFolder.addFile(docFile);
        DriveApp.getRootFolder().removeFile(docFile);

        // Aggiungi contenuto base
        const body = doc.getBody();
        body.clear();
        body.appendParagraph(`TEMPLATE: ${template.name}`).setHeading(DocumentApp.ParagraphHeading.TITLE);
        body.appendParagraph('');
        body.appendParagraph('{{venditori_completo}}');
        body.appendParagraph('');
        body.appendParagraph('Protocollo: {{protocollo}}');
        body.appendParagraph('Operatore: {{operatore}}');
        body.appendParagraph('Data: {{data_compilazione}}');

        doc.saveAndClose();
        created++;

        console.log(`✅ Creato [${i+1}/${batchToProcess}]: ${template.name}`);

      } catch (error) {
        console.error(`❌ Errore creazione ${template.name}:`, error);
      }
    }

    const remaining = missingTemplates.length - batchToProcess;

    return {
      success: true,
      created: created,
      remaining: Math.max(0, remaining),
      totalQueue: missingTemplates.length,
      nextBatch: remaining > 0
    };

  } catch (error) {
    console.error('❌ Errore generazione batch:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Funzione helper per continuare la generazione
function continueTemplateGeneration(batchSize = 10) {
  return generateTemplatesBatch(batchSize);
}

// Funzione di utilità per contare template mancanti
function countMissingTemplates() {
  const templateFolder = DriveApp.getFolderById(TEMPLATE_FOLDER_ID);

  const operatoriPerLettera = {};
  OPERATORI.forEach(op => {
    if (!operatoriPerLettera[op.lettera]) {
      operatoriPerLettera[op.lettera] = [];
    }
    operatoriPerLettera[op.lettera].push(op.nome);
  });

  let existing = 0;
  let missing = 0;

  Object.keys(operatoriPerLettera).forEach(lettera => {
    const primoOperatore = operatoriPerLettera[lettera][0];
    MODULI.forEach(modulo => {
      const templateName = `${modulo}-${primoOperatore}-${lettera}`;
      const files = templateFolder.getFilesByName(templateName);
      if (files.hasNext()) {
        existing++;
      } else {
        missing++;
      }
    });
  });

  console.log(`📊 Template esistenti: ${existing}`);
  console.log(`📊 Template mancanti: ${missing}`);
  console.log(`📊 Totale previsto: ${existing + missing}`);

  return { existing, missing, total: existing + missing };
}

// Funzione di test per verificare la struttura
function testTemplateMappingStructure() {
  const operatoriPerLettera = {};
  OPERATORI.forEach(op => {
    if (!operatoriPerLettera[op.lettera]) {
      operatoriPerLettera[op.lettera] = [];
    }
    operatoriPerLettera[op.lettera].push(op.nome);
  });

  console.log('🧪 Test struttura mapping:');
  console.log('Operatori per lettera:', operatoriPerLettera);
  console.log('Lettere uniche:', Object.keys(operatoriPerLettera));
  console.log('Totale moduli:', MODULI.length);
  console.log('Template da creare:', Object.keys(operatoriPerLettera).length * MODULI.length);

  // Esempio nomi generati
  console.log('\n📝 Esempi nomi template:');
  Object.keys(operatoriPerLettera).forEach(lettera => {
    const primoOperatore = operatoriPerLettera[lettera][0];
    console.log(`Lettera ${lettera} (${primoOperatore}): ${MODULI[0]}-${primoOperatore}-${lettera}`);
  });
}

// Funzione per eliminare tutti i template (per test)
function deleteAllGeneratedTemplates() {
  const templateFolder = DriveApp.getFolderById(TEMPLATE_FOLDER_ID);
  const files = templateFolder.getFiles();
  let deleted = 0;

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    // Elimina solo i file che seguono il pattern MODULO_*
    if (fileName.startsWith('MODULO_')) {
      console.log(`🗑️ Eliminando: ${fileName}`);
      file.setTrashed(true);
      deleted++;
    }
  }

  console.log(`✅ Eliminati ${deleted} template`);
}
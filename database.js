// BLOCCO 1: Gestione principale salvataggio (routing CREATE/UPDATE)
function savePraticaComplete(praticaData) {
  try {
    if (praticaData.azione === 'update') {
      return updatePratica(praticaData);
    } else {
      return createNewPratica(praticaData);
    }
  } catch (error) {
    return {
      error: 'Errore salvataggio: ' + error.toString(),
      success: false
    };
  }
}

// BLOCCO 2: Aggiornamento pratica esistente (UPDATE)
function updatePratica(praticaData) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_DATABASE);
  const data = sheet.getDataRange().getValues();
  
  // Cerca riga con protocollo esistente
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === praticaData.protocollo_esistente) {
      
      const timestamp = new Date();
      
      // Prepara dati venditori JSON
      const venditoriJSON = JSON.stringify(praticaData.venditori);

      // DEBUG: Verifica dati immobili ricevuti
      console.log('🔍 DEBUG UPDATE: Dati immobili ricevuti:', JSON.stringify(praticaData.immobili, null, 2));

      // Prepara dati immobili
      const immobiliData = processImmobiliData(praticaData.immobili || []);

      console.log('🔍 DEBUG UPDATE: Dati immobili processati:', JSON.stringify(immobiliData, null, 2));

      // STRUTTURA OTTIMIZZATA: Aggiorna riga esistente (mantieni data creazione originale)
      const updatedRow = [
        praticaData.protocollo_esistente,   // A: Protocollo (stesso)
        praticaData.operatore,              // B: Operatore
        data[i][2],                         // C: Data_Creazione (originale)
        venditoriJSON,                      // D: Venditori_JSON
        'Aggiornata',                       // E: Stato
        timestamp,                          // F: Data_Modifica
        immobiliData.immobili_json          // G: Immobili_JSON (unica fonte - contiene tutto)
        // NOTA: Colonne H-N eliminate - dati estratti dinamicamente dal document-generator
      ];
      
      // Sovrascrivi riga esistente
      sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      
      return {
        protocollo: praticaData.protocollo_esistente,
        success: true,
        message: 'Pratica aggiornata con successo',
        venditori_salvati: praticaData.venditori.length,
        immobili_salvati: (praticaData.immobili || []).length,
        debug_immobili_data: immobiliData
      };
    }
  }
  
  // Se arriva qui, protocollo non trovato
  return { 
    success: false, 
    error: 'Protocollo non trovato per aggiornamento: ' + praticaData.protocollo_esistente 
  };
}

// BLOCCO 3: Creazione nuova pratica (CREATE) - VERSIONE DEBUG
function createNewPratica(praticaData) {
  // DEBUG: Log dati ricevuti
  console.log('=== DEBUG CREATE NEW PRATICA ===');
  console.log('praticaData ricevuti:', JSON.stringify(praticaData));
  
  // Verifica se venditori esiste
  if (!praticaData.venditori) {
    return {
      error: 'Campo venditori mancante nei dati ricevuti',
      success: false,
      debug_data: praticaData
    };
  }
  
  if (!Array.isArray(praticaData.venditori)) {
    return {
      error: 'Campo venditori non è un array',
      success: false,
      debug_venditori_type: typeof praticaData.venditori,
      debug_venditori_value: praticaData.venditori
    };
  }
  
  if (praticaData.venditori.length === 0) {
    return {
      error: 'Array venditori è vuoto',
      success: false
    };
  }
  
  // Genera numero protocollo definitivo
  const protocollo = incrementContatore(praticaData.lettera);
  
  if (!protocollo) {
    return {
      error: 'Errore generazione numero protocollo',
      success: false
    };
  }
  
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_DATABASE);
  const timestamp = new Date();
  
  // Prepara dati venditori JSON
  const venditoriJSON = JSON.stringify(praticaData.venditori);
  
  console.log('Venditori JSON generato:', venditoriJSON);
  
  // Prepara dati immobili
  const immobiliData = processImmobiliData(praticaData.immobili || []);

  console.log('Immobili processati:', immobiliData);

  // STRUTTURA OTTIMIZZATA: 7 colonne base
  const newRow = [
    protocollo,                     // A: Protocollo
    praticaData.operatore,          // B: Operatore
    timestamp,                      // C: Data_Creazione
    venditoriJSON,                  // D: Venditori_JSON
    'Bozza',                        // E: Stato
    timestamp,                      // F: Data_Modifica
    immobiliData.immobili_json      // G: Immobili_JSON (unica fonte - contiene tutto)
    // NOTA: Colonne H-N eliminate - dati estratti dinamicamente dal document-generator
  ];
  
  sheet.appendRow(newRow);
  
  return {
    protocollo: protocollo,
    success: true,
    message: 'Nuova pratica creata con successo',
    venditori_salvati: praticaData.venditori.length,
    immobili_salvati: (praticaData.immobili || []).length,
    debug_venditori_count: praticaData.venditori.length,
    debug_immobili_count: (praticaData.immobili || []).length,
    debug_first_venditore: praticaData.venditori[0],
    debug_immobili_data: immobiliData
  };
}

// ========== BLOCCO GESTIONE IMMOBILI (APPROCCIO IBRIDO) ==========

// BLOCCO: Processing dati immobili (OTTIMIZZATO)
// Ritorna solo JSON completo - tutti i dati estratti (provincia, intestatari, etc)
// vengono generati dinamicamente dal document-generator.js quando serve
function processImmobiliData(immobiliArray) {
  if (!immobiliArray || !Array.isArray(immobiliArray) || immobiliArray.length === 0) {
    return {
      immobili_json: '[]'
    };
  }

  return {
    immobili_json: JSON.stringify(immobiliArray)  // Struttura completa - unica fonte di verità
  };
}

// BLOCCO: Funzioni generateIntestatariCompleto() e generatePrimoIntestatario() rimosse
// Non più necessarie qui - la generazione degli intestatari per i placeholder
// avviene dinamicamente nel document-generator.js quando serve

// BLOCCO: Funzione generateCatastaliCompleto() rimossa
// Non più necessaria - le tabelle catastali vengono generate dinamicamente
// dal document-generator.js usando direttamente l'array Immobili_JSON

// Funzione per processare e creare tabelle catastali vere
function processTabelleCatastali(doc, body) {
  const text = body.getText();
  const startMarker = '{{TABELLE_CATASTALI_START}}';
  const endMarker = '{{TABELLE_CATASTALI_END}}';

  const startIndex = text.indexOf(startMarker);
  if (startIndex !== -1) {
    const endIndex = text.indexOf(endMarker);
    const jsonData = text.substring(startIndex + startMarker.length, endIndex).trim();

    try {
      const immobiliData = JSON.parse(jsonData);

      // Trova il range del placeholder
      const searchRange = body.findText(startMarker);
      if (searchRange) {
        const element = searchRange.getElement();
        const elementIndex = body.getChildIndex(element.getParent());

        // Rimuovi il placeholder
        const fullPlaceholder = startMarker + '\n' + jsonData + '\n' + endMarker;
        body.replaceText(escapeRegExp(fullPlaceholder), '');

        // Inserisci tabelle catastali
        insertTabelleCatastali(body, immobiliData, elementIndex);
      }
    } catch (e) {
      console.error('Errore parsing JSON tabelle catastali:', e);
    }
  }
}

function insertTabelleCatastali(body, immobiliData, insertIndex) {
  let currentIndex = insertIndex;

  immobiliData.forEach((immobile, immobileIndex) => {
    if (immobile.blocchiCatastali && immobile.blocchiCatastali.length > 0) {

      // Titolo immobile
      const titoloImmobile = body.insertParagraph(currentIndex++, `\n\nIMMOBILE ${immobileIndex + 1} - ${immobile.comune || ''} (${immobile.provincia || ''})`);
      titoloImmobile.setHeading(DocumentApp.ParagraphHeading.HEADING3);

      // Separa fabbricati e terreni
      const fabbricati = [];
      const terreni = [];

      immobile.blocchiCatastali.forEach(blocco => {
        if (blocco.righe && Array.isArray(blocco.righe)) {
          blocco.righe.forEach(riga => {
            if (blocco.tipoCatasto === 'fabbricati') {
              fabbricati.push(riga);
            } else {
              terreni.push(riga);
            }
          });
        }
      });

      // Crea tabella FABBRICATI se ci sono dati
      if (fabbricati.length > 0) {
        body.insertParagraph(currentIndex++, '\nCATASTO FABBRICATI:');
        currentIndex = insertTabellaFabbricati(body, fabbricati, currentIndex);
      }

      // Crea tabella TERRENI se ci sono dati
      if (terreni.length > 0) {
        body.insertParagraph(currentIndex++, '\nCATASTO TERRENI:');
        currentIndex = insertTabellaTerreni(body, terreni, currentIndex);
      }
    }
  });
}

function insertTabellaFabbricati(body, righe, insertIndex) {
  const table = body.insertTable(insertIndex);

  // Header FABBRICATI - aggiornato con nuove colonne specificate
  const headerRow = table.appendTableRow();
  const headerLabels = ['FOG', 'MAP', 'SUB', 'CATEGORIA', 'CLASSE', 'VANI-MQ', 'SUPERFICI', 'INDIRIZZO-PIANO', 'RENDITA'];

  headerLabels.forEach(label => {
    const cell = headerRow.appendTableCell(label);
    cell.editAsText().setBold(true);
    cell.setBackgroundColor('#E7E6E6');
  });

  // Righe dati FABBRICATI - struttura su singola riga con formattazione normale
  righe.forEach(riga => {
    const dataRow = table.appendTableRow();

    dataRow.appendTableCell(riga.foglio || '');
    dataRow.appendTableCell(riga.mappale || '');
    dataRow.appendTableCell(riga.subalterno || '');
    dataRow.appendTableCell(riga.categoria || '');
    dataRow.appendTableCell(riga.classe || '');
    dataRow.appendTableCell(riga.vani_mq || '');         // ✅ CORRETTO: era consistenza
    dataRow.appendTableCell(riga.superfici || '');       // ✅ CORRETTO: era superficie
    dataRow.appendTableCell(riga.indirizzo_piano || ''); // ✅ Corretto
    dataRow.appendTableCell(riga.rendita ? `€ ${riga.rendita}` : '');

    // Assicura formattazione normale per le celle dati
    for (let i = 0; i < dataRow.getNumCells(); i++) {
      dataRow.getCell(i).editAsText().setBold(false);
    }
  });

  // Stile tabella
  table.setBorderWidth(1);
  table.setBorderColor('#000000');

  return insertIndex + 1;
}

function insertTabellaTerreni(body, righe, insertIndex) {
  const table = body.insertTable(insertIndex);

  // Header TERRENI - aggiornato con nuove colonne specificate
  const headerRow = table.appendTableRow();
  const headerLabels = ['FOG', 'MAP', 'PORZ', 'QUALITA', 'CLASSE', 'METRI QUADRATI', 'DOMINICALE', 'AGRARIO'];

  headerLabels.forEach(label => {
    const cell = headerRow.appendTableCell(label);
    cell.editAsText().setBold(true);
    cell.setBackgroundColor('#E7E6E6');
  });

  // Righe dati TERRENI - struttura su singola riga con formattazione normale
  righe.forEach(riga => {
    const dataRow = table.appendTableRow();

    dataRow.appendTableCell(riga.foglio || '');
    dataRow.appendTableCell(riga.mappale || '');
    dataRow.appendTableCell(riga.porzione || '');  // ✅ Corretto
    dataRow.appendTableCell(riga.qualita || '');   // ✅ Corretto
    dataRow.appendTableCell(riga.classe || '');
    dataRow.appendTableCell(riga.metri_quadrati || '');        // ✅ CORRETTO: era superficie
    dataRow.appendTableCell(riga.dominicale ? `€ ${riga.dominicale}` : '');  // ✅ CORRETTO: era reddito_dominicale
    dataRow.appendTableCell(riga.agrario ? `€ ${riga.agrario}` : '');        // ✅ CORRETTO: era reddito_agrario

    // Assicura formattazione normale per le celle dati
    for (let i = 0; i < dataRow.getNumCells(); i++) {
      dataRow.getCell(i).editAsText().setBold(false);
    }
  });

  // Stile tabella
  table.setBorderWidth(1);
  table.setBorderColor('#000000');

  return insertIndex + 1;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// BLOCCO 4: Ricerca pratiche esistenti con parsing JSON venditori
function searchPratica(searchTerm, searchType = 'protocollo') {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_DATABASE);
    const data = sheet.getDataRange().getValues();
    
    // Header nella prima riga
    const headers = data[0];
    const rows = data.slice(1);
    
    let results = [];
    
    if (searchType === 'protocollo') {
      // Ricerca per protocollo
      results = rows.filter(row => 
        row[0] && 
        row[0].toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else if (searchType === 'venditore_nome' || searchType === 'venditore_cognome') {
      // Ricerca nei dati JSON venditori
      results = rows.filter(row => {
        if (row[3]) { // Colonna Venditori_JSON
          try {
            const venditori = JSON.parse(row[3]);
            return venditori.some(venditore => {
              const fieldValue = searchType === 'venditore_nome' ? venditore.nome : venditore.cognome;
              return fieldValue && fieldValue.toLowerCase().includes(searchTerm.toLowerCase());
            });
          } catch (e) {
            return false; // JSON malformato
          }
        }
        return false;
      });
    }
    
    // Trasforma righe grezze in oggetti strutturati per autocompletamento
    const structuredResults = results.map(row => ({
      protocollo: row[0] || '',
      operatore: row[1] || '',
      data_compilazione: row[2] || '',
      venditori_json: row[3] || '',
      stato: row[4] || '',
      data_modifica: row[5] || ''
    }));

    return {
      results: structuredResults,
      headers: headers,
      total_found: structuredResults.length,
      success: true
    };
    
  } catch (error) {
    return {
      error: 'Errore ricerca: ' + error.toString(),
      success: false
    };
  }
}

// BLOCCO 6: Funzioni di utilità per gestione venditori
function getVenditoriFromPratica(protocollo) {
  const pratica = loadPratica(protocollo);
  
  if (pratica.success) {
    return {
      venditori: pratica.venditori,
      count: pratica.venditori.length,
      success: true
    };
  }
  
  return pratica; // Ritorna errore
}

function updateVenditoriOnly(protocollo, nuoviVenditori) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_DATABASE);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === protocollo) {
        
        const venditoriJSON = JSON.stringify(nuoviVenditori);
        const timestamp = new Date();
        
        // Aggiorna solo colonna venditori e data modifica
        sheet.getRange(i + 1, 4).setValue(venditoriJSON); // Colonna D
        sheet.getRange(i + 1, 6).setValue(timestamp);     // Colonna F
        
        return {
          success: true,
          message: 'Venditori aggiornati',
          venditori_count: nuoviVenditori.length
        };
      }
    }
    
    return {
      success: false,
      error: 'Pratica non trovata per aggiornamento venditori'
    };
    
  } catch (error) {
    return {
      error: 'Errore aggiornamento venditori: ' + error.toString(),
      success: false
    };
  }
}

// BLOCCO 7: Funzione loadPratica mancante
function loadPratica(protocollo) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_DATABASE);
    const data = sheet.getDataRange().getValues();

    // Cerca riga con protocollo
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === protocollo) {
        // Parse JSON per venditori e immobili
        const venditori = data[i][3] ? JSON.parse(data[i][3]) : [];
        const immobili = data[i][6] ? JSON.parse(data[i][6]) : [];

        // STRUTTURA OTTIMIZZATA: solo 7 colonne base
        return {
          protocollo: data[i][0],       // A: Protocollo
          operatore: data[i][1],        // B: Operatore
          data_creazione: data[i][2],   // C: Data_Creazione
          venditori: venditori,         // D: Venditori_JSON (parsed)
          stato: data[i][4],            // E: Stato
          data_modifica: data[i][5],    // F: Data_Modifica
          immobili: immobili,           // G: Immobili_JSON (parsed)

          // NOTA: Dati estratti (provincia, intestatari, etc) non più presenti nel DB
          // Vengono generati dinamicamente dal document-generator.js quando necessario

          success: true
        };
      }
    }

    return {
      error: 'Pratica non trovata: ' + protocollo,
      success: false
    };

  } catch (error) {
    return {
      error: 'Errore caricamento pratica: ' + error.toString(),
      success: false
    };
  }
}

// BLOCCO: Caricamento anagrafica agenzia per operatore
function getAgenziaData(operatore) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Anagrafica_Agenzie');
    const data = sheet.getDataRange().getValues();

    console.log(`🔍 Cercando operatore: "${operatore}"`);
    console.log(`🔍 Totale righe nel sheet: ${data.length - 1}`);

    // Cerca riga con operatore attivo
    for (let i = 1; i < data.length; i++) { // Salta header (riga 0)
      console.log(`🔍 Riga ${i}: Operatore="${data[i][0]}", Attiva=${data[i][4]} (tipo: ${typeof data[i][4]})`);

      // Confronto case-insensitive e gestione TRUE come stringa o boolean
      const nomeOperatoreSheet = String(data[i][0]).trim();
      const nomeOperatoreCercato = String(operatore).trim();
      const isAttiva = data[i][4] === true || data[i][4] === 'TRUE' || data[i][4] === 'true';

      if (nomeOperatoreSheet === nomeOperatoreCercato && isAttiva) { // A: Operatore, E: Attiva
        console.log(`✅ TROVATO operatore alla riga ${i}`);

        const row = data[i];

        // CF e P.IVA: gestisci se uguali o diversi
        const cf = row[15] || ''; // P
        const piva = row[16] || ''; // Q
        const cf_piva_testo = (cf === piva)
          ? cf
          : `codice fiscale ${cf}, partita IVA ${piva}`;

        // Costruisci oggetto dati agenzia
        return {
          // Identificazione
          operatore: row[0],              // A
          lettera: row[1],                // B
          ragione_sociale: row[2],        // C - Nome completo già incluso
          forma_giuridica: row[3],        // D

          // Sede e contatti
          via_sede: row[5],               // F
          numero_sede: row[6],            // G
          cap: row[7],                    // H
          citta_sede: row[8],             // I
          provincia_sede: row[9],         // J
          citta_completa: `${row[8]} (${row[9]})`, // "Bergantino (RO)"
          indirizzo_completo: `${row[8]} ${row[5]} numero ${row[6]}`, // "Bergantino Via Vittorio Emanuele numero 128"

          telefono: row[10],              // K
          email_1: row[11],               // L
          email_2: row[12],               // M
          pec: row[13],                   // N
          sito_web: row[14],              // O

          // Formattazioni emails
          indirizzi_email: `${row[11]} ${row[12]} ${row[13]}`,

          // Fiscali
          cf: cf,                         // P
          piva: piva,                     // Q
          cf_piva: cf_piva_testo,
          numero_rea: row[17],            // R
          cciaa: row[18],                 // S
          numero_ruolo_azienda: row[19],  // T
          sezioni_iscrizione: row[20],    // U
          albo_ctu: row[21] || '',        // V
          tribunale_ctu: row[22] || '',   // W

          // Rappresentante legale
          titolo_rappresentante: row[23] || '',  // X
          ruolo_rappresentante: row[24],         // Y
          nome_rappresentante: row[25],          // Z
          cognome_rappresentante: row[26],       // AA
          data_nascita_rappresentante: row[27],  // AB
          luogo_nascita_rappresentante: row[28], // AC
          via_residenza_rappresentante: row[29], // AD
          numero_residenza_rappresentante: row[30], // AE
          citta_residenza_rappresentante: row[31], // AF
          residenza_completa: `${row[31]} ${row[29]} numero ${row[30]}`, // "Bergantino Via Campo numero 225"
          telefono_rappresentante: row[32],      // AG
          numero_ruolo_rappresentante: row[33] || '', // AH

          // Blocchi pre-formattati per template
          blocco_intestazione: generateBloccoIntestazione(row),
          blocco_agenzia_completo: generateBloccoAgenziaCompleto(row),
          blocco_footer: generateBloccoFooter(row)
        };
      }
    }

    // Se non trova operatore
    console.error(`⚠️ Operatore "${operatore}" non trovato in Anagrafica_Agenzie`);
    return null;

  } catch (error) {
    console.error('❌ Errore caricamento anagrafica agenzia:', error);
    return null;
  }
}

// BLOCCO: Generazione testo lungo per template
function generateBloccoAgenziaCompleto(row) {
  // Gestione titolo rappresentante (lowercase per inserimento in frase)
  const titolo = row[23] ? row[23].toLowerCase() + ' ' : ''; // "geometra " o ""

  // Gestione residenza rappresentante
  const via_residenza = row[29] || row[5]; // Usa via residenza, fallback a via sede
  const numero_residenza = row[30] || row[6];
  const citta_residenza = row[31] || row[8];

  // Formattazione data nascita (da Date object a stringa gg/mm/aaaa)
  const dataNascita = row[27];
  let dataNascitaFormattata = '';
  if (dataNascita) {
    if (dataNascita instanceof Date) {
      const giorno = String(dataNascita.getDate()).padStart(2, '0');
      const mese = String(dataNascita.getMonth() + 1).padStart(2, '0');
      const anno = dataNascita.getFullYear();
      dataNascitaFormattata = `${giorno}/${mese}/${anno}`;
    } else {
      dataNascitaFormattata = String(dataNascita); // Se è già stringa, usa così
    }
  }

  // Gestione albo CTU (se presente)
  const albo_ctu_text = row[21] && row[22]
    ? `, numero di iscrizione all'albo dei consulenti tecnici, ramo civile, presso il tribunale di ${row[22]} ${row[21]}`
    : '';

  // CF e P.IVA
  const piva = row[16] || row[15]; // Usa P.IVA, se mancante usa CF

  // Testo completo secondo formato documento
  return `all'agenzia d'affari "${row[2]}", con sede in ${row[8]} ${row[5]} numero ${row[6]}, telefono ${row[10]}, indirizzi di posta elettronica ${row[11]} ${row[12]} ${row[13]}, sito internet ${row[14]}, codice fiscale, partita IVA e numero di iscrizione al registro delle imprese tenuto presso la camera di commercio, industria, artigianato ed agricoltura di ${row[18]} ${piva}, numero di iscrizione al repertorio economico amministrativo ${row[17]}, già iscritta all'ex ruolo agenti d'affari in mediazione al numero ${row[19]}, nella persona del ${row[24]} ${titolo}${row[25]} ${row[26]}, nato a ${row[28]} il ${dataNascitaFormattata}, ivi residente in ${via_residenza} numero ${numero_residenza}${citta_residenza !== row[8] ? ', ' + citta_residenza : ''}, telefono ${row[32]}, già iscritto all'ex ruolo agenti d'affari in mediazione al numero ${row[33]}${albo_ctu_text}, in seguito denominata "Agenzia Immobiliare"`;
}

// BLOCCO: Generazione intestazione documento (header in alto)
function generateBloccoIntestazione(row) {
  // Costruisce l'intestazione includendo solo le righe con dati
  const righe = [];

  // Riga 1: Nome agenzia (sempre presente)
  if (row[3]) righe.push(row[3]);

  // Riga 2: Indirizzo sede
  righe.push(`SEDE - ${row[5]} n. ${row[6]} ${row[7]} ${row[8]} (${row[9]})`);

  // Riga 3: Telefoni
  righe.push(`telefono ${row[10]} portatile ${row[32]}`);

  // Righe email: solo se il dato esiste e non è vuoto
  if (row[11] && String(row[11]).trim() !== '') righe.push(`e-mail: ${row[11]}`);
  if (row[12] && String(row[12]).trim() !== '') righe.push(`e-mail: ${row[12]}`);
  if (row[13] && String(row[13]).trim() !== '') righe.push(`e-mail: ${row[13]}`);

  // Riga web
  if (row[14]) righe.push(`web: ${row[14]}`);

  return righe.join('\n');
}

// BLOCCO: Generazione footer documento (formato multiplo righe)
function generateBloccoFooter(row) {
  const titolo = row[23] ? row[23] + ' ' : ''; // "Geometra " o ""
  const piva = row[16] || row[15]; // Usa P.IVA, se mancante usa CF

  return `${row[2]} già iscritta all'ex ruolo Agenti d'Affari in Mediazione, sezioni ${row[20]} al numero ${row[19]} - C.C.I.A.A. di ${row[18]} -
${titolo}${row[25]} ${row[26]} già iscritto all'ex ruolo Agenti d'Affari in Mediazione, sezioni ${row[20]} al numero ${row[33]} - C.C.I.A.A. di ${row[18]} -
sede: ${row[5]}, ${row[6]} - ${row[7]} ${row[8]} (${row[9]}) - R.I., C.F. e P. I.V.A. ${piva}, numero d'iscrizione al repertorio economico amministrativo di ${row[18]} ${row[17]} - telefono ${row[10]}
Indirizzi di posta elettronica: ${row[11]} ${row[12]} ${row[13]} - sito internet ${row[14]}`;
}
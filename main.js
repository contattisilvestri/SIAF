  // BLOCCO 1: Gestione richieste GET (preview, search, load, generate_documents)
  function doGet(e) {
    if (!e || !e.parameter) {
      return createErrorResponse('Parametri mancanti - testare tramite URL');
    }

    const action = e.parameter.action;
    const lettera = e.parameter.lettera;

    try {
      switch(action) {
        case 'preview':
          if (!lettera) {
            return createErrorResponse('Parametro lettera mancante');
          }
          return createSuccessResponse(getPreviewNumber(lettera));

        case 'save':
          if (!e.parameter.data) {
            return createErrorResponse('Dati mancanti per salvataggio');
          }
          const saveData = JSON.parse(e.parameter.data);
          return createSuccessResponse(savePraticaComplete(saveData));

        case 'generate_documents':
          if (!e.parameter.data) {
            return createErrorResponse('Dati mancanti per generazione documenti');
          }
          try {
            const generateData = JSON.parse(e.parameter.data);
            console.log('MAIN: Dati parsed:', generateData);
            console.log('MAIN: Protocollo:', generateData.protocollo);
            console.log('MAIN: Lettera:', generateData.lettera);

            const result = handleGenerateDocuments(generateData);
            console.log('MAIN: Risultato:', result);

            return createSuccessResponse({
              ...result,
              debug_main_wrapper: true,
              debug_timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('MAIN: ERRORE:', error);
            return createErrorResponse('Errore wrapper: ' + error.toString());
          }

        case 'search':
          const searchTerm = e.parameter.term;
          const searchType = e.parameter.type || 'protocollo';

          if (!searchTerm) {
            return createErrorResponse('Parametro di ricerca mancante');
          }
          return createSuccessResponse(searchPratica(searchTerm, searchType));

        case 'load':
          const protocollo = e.parameter.protocollo;

          if (!protocollo) {
            return createErrorResponse('Parametro protocollo mancante');
          }
          return createSuccessResponse(loadPratica(protocollo));

        case 'load_venditori':
          const protocolloVenditori = e.parameter.protocollo;

          if (!protocolloVenditori) {
            return createErrorResponse('Parametro protocollo mancante');
          }
          return createSuccessResponse(getVenditoriFromPratica(protocolloVenditori));

        default:
          return createErrorResponse('Azione non valida. Azioni disponibili: preview, save, generate_documents, search, load, load_venditori');
      }
    } catch (error) {
      return createErrorResponse('Errore server: ' + error.toString());
    }
  }

  // BLOCCO 2: Gestione richieste POST
  function doPost(e) {
    // Se i dati sono in e.parameter (form-urlencoded), delega a doGet
    if (e && e.parameter && e.parameter.action) {
      return doGet(e);
    }

    // Altrimenti gestisci JSON POST
    if (!e || !e.postData) {
      return createErrorResponse('Dati POST mancanti');
    }

    try {
      const postData = JSON.parse(e.postData.contents);
      const action = postData.action;

      switch(action) {
        case 'save_complete':
          return createSuccessResponse(savePraticaComplete(postData.data));

        case 'update_venditori_only':
          if (!postData.protocollo || !postData.venditori) {
            return createErrorResponse('Parametri mancanti: protocollo e venditori richiesti');
          }
          return createSuccessResponse(updateVenditoriOnly(postData.protocollo,
  postData.venditori));

        case 'bulk_search':
          if (!postData.queries || !Array.isArray(postData.queries)) {
            return createErrorResponse('Parametro queries array mancante');
          }

          const bulkResults = postData.queries.map(query => {
            return searchPratica(query.term, query.type);
          });

          return createSuccessResponse({
            results: bulkResults,
            total_queries: bulkResults.length,
            success: true
          });

        default:
          return createErrorResponse('Azione POST non valida. Azioni disponibili: save_complete, update_venditori_only, bulk_search');
      }
    } catch (error) {
      return createErrorResponse('Errore parsing POST: ' + error.toString());
    }
  }

  // BLOCCO 3: Funzioni helper
  function createSuccessResponse(data) {
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function createErrorResponse(message) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: message,
        success: false,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function createDebugResponse(data, debugInfo) {
    return ContentService
      .createTextOutput(JSON.stringify({
        data: data,
        debug: debugInfo,
        timestamp: new Date().toISOString(),
        success: true
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // BLOCCO 4: Statistiche
  function getPraticheStats() {
    try {
      const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_DATABASE);
      const data = sheet.getDataRange().getValues();
      const rows = data.slice(1);

      const stats = {
        totale_pratiche: rows.length,
        per_stato: {},
        per_operatore: {},
        venditori_multipli: 0,
        ultima_modifica: null
      };

      rows.forEach(row => {
        const stato = row[4] || 'Non specificato';
        const operatore = row[1] || 'Non specificato';
        const dataModifica = row[5];

        stats.per_stato[stato] = (stats.per_stato[stato] || 0) + 1;
        stats.per_operatore[operatore] = (stats.per_operatore[operatore] || 0) + 1;

        if (row[3]) {
          try {
            const venditori = JSON.parse(row[3]);
            if (venditori.length > 1) {
              stats.venditori_multipli++;
            }
          } catch (e) {
            // Ignora errori parsing
          }
        }

        if (dataModifica && (!stats.ultima_modifica || dataModifica >
  stats.ultima_modifica)) {
          stats.ultima_modifica = dataModifica;
        }
      });

      return {
        stats: stats,
        success: true
      };

    } catch (error) {
      return {
        error: 'Errore calcolo statistiche: ' + error.toString(),
        success: false
      };
    }
  }

  function validatePratica(protocollo) {
    try {
      const pratica = loadPratica(protocollo);

      if (!pratica.success) {
        return pratica;
      }

      const validazione = {
        protocollo_valido: !!pratica.protocollo,
        ha_venditori: pratica.venditori && pratica.venditori.length > 0,
        venditori_completi: true,
        errori: [],
        avvisi: []
      };

      if (pratica.venditori) {
        pratica.venditori.forEach((venditore, index) => {
          if (!venditore.nome || !venditore.cognome) {
            validazione.venditori_completi = false;
            validazione.errori.push(`Venditore ${index + 1}: Nome e cognome obbligatori`);
          }

          if (!venditore.codice_fiscale) {
            validazione.avvisi.push(`Venditore ${index + 1}: Codice fiscale mancante`);
          }
        });
      }

      validazione.valida = validazione.errori.length === 0;

      return {
        validazione: validazione,
        success: true
      };

    } catch (error) {
      return {
        error: 'Errore validazione: ' + error.toString(),
        success: false
      };
    }
  }

  function exportPratiche(formato, filtri) {
    try {
      const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_DATABASE);
      const data = sheet.getDataRange().getValues();

      return {
        total_records: data.length - 1,
        format: formato,
        success: true
      };
    } catch (error) {
      return {
        error: 'Errore export: ' + error.toString(),
        success: false
      };
    }
  }
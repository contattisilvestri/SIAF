// contatori.gs

function getPreviewNumber(lettera) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Contatori');
  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === lettera) {
      const nextNumber = data[i][1] + 1;
      return {
        previewNumber: nextNumber + "/" + lettera,
        numero: nextNumber,
        lettera: lettera,
        success: true
      };
    }
  }

  return {
    error: 'Lettera operatore non trovata',
    success: false
  };
}

function incrementContatore(lettera) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Contatori');
  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === lettera) {
      const newNumber = data[i][1] + 1;
      sheet.getRange(i + 1, 2).setValue(newNumber);
      return newNumber + "/" + lettera;
    }
  }

  return null;
}
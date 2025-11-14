// config.gs - Configurazioni globali SIAF
const SHEET_ID = '1aWvqesmSC7zOIBP-povUfGKmaAeV5FZJa78k5jwcVsk';
const SHEET_CONTATORI = 'Contatori';
const SHEET_DATABASE = 'Master-Database';

// ========== CONFIGURAZIONI TEMPLATE E CARTELLE ==========

const TEMPLATE_FOLDERS = {
  BASE: '1UE7ZpwY_70h6lYN6PHHJ5NTr2IsfRRgu',
  PRATICHE_GENERATE: '1f1QFHVRd11gL51OMEX193GMdDzphNPeF'
};

// Nuova mappatura operatori -> lettere
const OPERATORI_MAPPING = {
  'luigi_b': 'L',
  'silvia_b': 'L',
  'milena_b': 'L',
  'daniele_d': 'D',
  'giulia_t': 'G',
  'mirco_c': 'M',
  'giuliano_h': 'H'
};

// Mapping templates per tipo documento (semplificato - un template per tipo)
// I dati operatore sono ora dinamici tramite placeholder {{blocco_agenzia_completo}}
const TEMPLATE_MAPPING = {
  'INCARICO_MEDIAZIONE': 'MODULO_C-INCARICO-MEDIAZIONE',
  'PREVENTIVO_IMPOSTE': 'MODULO_H-PREVENTIVI-PARTE-ACQUIRENTE'
  // TODO: Aggiungere altri tipi documento quando necessario
};

const DOCUMENT_TYPES = {
  INCARICO_MEDIAZIONE: 'incarico_mediazione',
  PREVENTIVO_IMPOSTE: 'preventivo_imposte',
  DELEGA_PLANIMETRIE: 'delega_planimetrie',
  PROPOSTA_ACQUISTO: 'proposta_acquisto',
  PROMEMORIA_NOTARILE: 'promemoria_notarile'
};

// ========== CONFIGURAZIONE STILI BLOCCHI AGENZIA ==========
// Questi stili vengono applicati ai blocchi intestazione, agenzia completo e footer
// Puoi modificare fontSize, bold, alignment e lineSpacing per personalizzare l'aspetto

const BLOCK_STYLES = {
  blocco_intestazione: {
    fontSize: 10,           // Dimensione font (punti)
    bold: false,            // true = grassetto, false = normale
    alignment: 'CENTER',    // CENTER, LEFT, RIGHT, JUSTIFY
    lineSpacing: 1.0        // Interlinea (1.0 = singola, 1.15 = standard, 1.5 = 1.5, 2.0 = doppia)
  },
  blocco_agenzia_completo: {
    fontSize: 11,
    bold: false,
    alignment: 'LEFT',
    lineSpacing: 1.15
  },
  blocco_footer: {
    fontSize: 8,
    bold: false,
    alignment: 'CENTER',
    lineSpacing: 1.0
  }
};

// ============================================================================
// CONFIGURAZIONI FRONTEND - SIAF APPLICATION
// ============================================================================

// ============================================================================
// BLOCCO 1: Configurazione utente e tenant (hardcoded per MVP)
// ============================================================================

const CURRENT_USER = {
    user_id: "U001",
    tenant_id: "T0001",
    agency_id: "B",
    nome: "Luigi Montagnini",
    email: "luigi@esempio.it",
    role_tenant: "OWNER",      // OWNER, TENANT_ADMIN, BILLING
    role_agency: "ADMIN"       // ADMIN, AGENT, ASSISTANT, VIEWER
};

// Derivata dalla configurazione utente
const AGENZIA_CORRENTE = CURRENT_USER.agency_id;

// ============================================================================
// BLOCCO 2: Array dropdown per sezione Provenienza
// ============================================================================

// --- SUCCESSIONI ---
const TIPI_SUCCESSIONE = [
    'testamentaria',
    'legittima'
];

const TIPI_TESTAMENTO = [
    'olografo pubblicato',
    'pubblico',
    'segreto pubblicato'
];

const FIGURE_LEGALI = [
    'Notaio',
    'Giudice',
    'Segretario Comunale'
];

const TIPI_ACCETTAZIONE = [
    'tacita',
    'espressa',
    'con beneficio d\'inventario'
];

// --- ATTI ---
const TIPI_ATTO = [
    'atto',
    'atto tra vivi',
    'atto per causa di morte',
    'atto esecutivo o cautelare',
    'atto di pignoramento',
    'decreto di trasferimento',
    'ipoteca giudiziale',
    'ipoteca legale',
    'ipoteca volontaria',
    'sentenza di',
    'scrittura privata con sottoscrizione autenticata',
    'scrittura privata con sottoscrizioni autenticate',
    'verbale di pubblicazione testamento olografo',
    'verbale di acquiescenza e accettazione eredità',
    'verbale di acquiescenza, accettazione e rinuncia',
    'verbale di erezione d\'inventario'
];

const NATURE_ATTO = [
    'compravendita',
    'donazione',
    'permuta',
    'divisione',
    'assegnazione a stralcio',
    'cessione di quota',
    'cessione dilazionata',
    'costituzione servitù',
    'costituzione di diritti reali a titolo oneroso',
    'costituzione di diritti reali a titolo gratuito',
    'convenzione di lottizzazione',
    'vincolo',
    'certificato di denunciata successione',
    'accettazione di eredità',
    'ad acquiescenza a disposizioni testamentarie',
    'accettazione di eredità con beneficio d\'inventario',
    'rinuncia ad azione di riduzione',
    'mutuo',
    'quietanza',
    'ipoteca legale',
    'decreto ingiuntivo',
    'giudiziario',
    'amministrativo',
    'usucapione'
];

// --- STATI TRASCRIZIONE / ISCRIZIONE ---
const STATI_REGISTRAZIONE = [
    'trascritto',
    'iscritto',
    'da trascrivere',
    'da iscrivere'
];

// --- CATEGORIE PRINCIPALI ATTO ---
const CATEGORIE_ATTO = [
    'successione',
    'atto_tra_vivi',
    'atto_giudiziario'
];

// ============================================================================
// BLOCCO 3: Helper functions per caricamento contatti
// ============================================================================

/**
 * Carica i contatti preferiti dell'agenzia corrente
 * @returns {Promise<Object>} Oggetto con notai_preferiti e altri contatti
 */
async function caricaContattiAgenzia() {
    try {
        const response = await fetch('configs/contatti_agenzie.json');
        const data = await response.json();
        return data[AGENZIA_CORRENTE] || { notai_preferiti: [] };
    } catch (error) {
        console.error('❌ Errore caricamento contatti agenzia:', error);
        return { notai_preferiti: [] };
    }
}

/**
 * Formatta nome completo notaio per autocomplete
 * @param {Object} notaio - Oggetto con nome e sede
 * @returns {string} Nome formattato "Nome Notaio - Sede"
 */
function formatNotaio(notaio) {
    return `${notaio.nome} - ${notaio.sede}`;
}

// ============================================================================
// BLOCCO 4: Metadati future-proof per pratiche
// ============================================================================

/**
 * Genera metadati standard per una nuova pratica
 * Include campi future-proof per multi-tenancy
 */
function generaMetadatiPratica() {
    return {
        tenant_id: CURRENT_USER.tenant_id,
        agency_id: CURRENT_USER.agency_id,
        operatore_user_id: CURRENT_USER.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}
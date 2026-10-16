(function () {
  "use strict";

  if (window.SPA_CDSP_DEADLINE_REPORT_PANEL_INITIALIZED) return;
  window.SPA_CDSP_DEADLINE_REPORT_PANEL_INITIALIZED = true;

  const CONFIG = Object.assign(
    {
      pageLength: 50,
      delayPageMs: 1000,
      processingTimeoutMs: 180000,
      panelId: "spa-cdsp-deadline-panel",
      headerImageUrl: "",
      version: "2.31"
    },
    window.SPA_CDSP_DEADLINE_REPORT_CONFIG || {}
  );

  const REPORT_TYPES = {
    todos: {
      label: "Todos",
      baseDays: 5,
      filePart: "todos",
      columns: []
    },
    recursos: {
      label: "Recursos",
      baseDays: 5,
      filePart: "recursos",
      columns: ["TIPO", "Número do Processo", "Data da Ciência", "Recebido há", "Prazo no SPA (PJE)", "Prazo Interno"]
    },
    contestacao: {
      label: "Contestação",
      baseDays: 10,
      filePart: "contestacao",
      columns: ["TIPO", "Número do Processo", "Data da Ciência", "Recebido há", "Prazo no SPA (PJE)", "Prazo Interno"]
    },
    demais: {
      label: "Demais Prazos",
      baseDays: 10,
      filePart: "demais_prazos",
      columns: ["TIPO", "Número do Processo", "Data da Ciência", "Recebido há", "Prazo no SPA (PJE)", "Prazo Interno"]
    }
  };

  const REPORT_CATEGORY_ORDER = ["recursos", "contestacao", "demais"];
  const REPORT_SORTS = {
    pje: {
      label: "Prazo no SPA (PJE)"
    },
    interno: {
      label: "Prazo Interno"
    },
    recebido: {
      label: "Dias Recebidos"
    }
  };
  const SECTOR_FOLDER_LINKS = [
    {
      label: "Procedimentos",
      url: "https://sitecdsp.pages.dev/#procedimentos",
      kind: "setor"
    },
    {
      label: "Medicamentos",
      url: "https://sitecdsp.pages.dev/#medicamentos",
      kind: "setor"
    },
    {
      label: "Terapias",
      url: "https://sitecdsp.pages.dev/#terapias",
      kind: "setor"
    },
    {
      label: "Home Care",
      url: "https://sitecdsp.pages.dev/#homecare",
      kind: "setor"
    },
    {
      label: "TFD",
      url: "https://sitecdsp.pages.dev/#tfd",
      kind: "setor"
    },
    {
      label: "Fora do SUS",
      url: "https://sitecdsp.pages.dev/#forasus",
      kind: "setor"
    },
    {
      label: "Internação",
      url: "https://sitecdsp.pages.dev/#internacao",
      kind: "setor"
    },
    {
      label: "Manuais",
      url: "https://sitecdsp.pages.dev/manuais",
      kind: "manual"
    }
  ];

  const DEFAULT_INTERNAL_DEADLINE_BUSINESS_DAYS = 5;
  const INTERNAL_DEADLINE_LIMITS = {
    embargos_de_declaracao: { label: "Embargos de Declara\u00e7\u00e3o", recurso: 2, contrarrazao: 4 },
    recurso_inominado: { label: "Recurso Inominado", recurso: 4, contrarrazao: 6 },
    apelacao: { label: "Apela\u00e7\u00e3o", recurso: 8, contrarrazao: 16 },
    agravo_interno: { label: "Agravo Interno", recurso: 8, contrarrazao: 16 },
    recurso_especial: { label: "Recurso Especial", recurso: 10, contrarrazao: 20 },
    recurso_extraordinario: { label: "Recurso Extraordin\u00e1rio", recurso: 10, contrarrazao: 20 },
    contestacao: { label: "Contesta\u00e7\u00e3o", recurso: 6, contrarrazao: null },
    agravo_de_instrumento: { label: "Agravo de Instrumento", recurso: 6, contrarrazao: 16 },
    manifestacao: { label: "Manifesta\u00e7\u00e3o", recurso: 4, contrarrazao: null }
  };
  const FIXED_HOLIDAYS = [
    { day: 1, month: 1, label: "Confraterniza\u00e7\u00e3o Universal" },
    { day: 8, month: 4, label: "Anivers\u00e1rio de Cuiab\u00e1" },
    { day: 21, month: 4, label: "Tiradentes" },
    { day: 1, month: 5, label: "Dia do Trabalho" },
    { day: 10, month: 8, label: "Dia da Justi\u00e7a / Dia do Advogado" },
    { day: 7, month: 9, label: "Independ\u00eancia do Brasil" },
    { day: 12, month: 10, label: "Nossa Senhora Aparecida" },
    { day: 2, month: 11, label: "Finados" },
    { day: 15, month: 11, label: "Proclama\u00e7\u00e3o da Rep\u00fablica" },
    { day: 20, month: 11, label: "Consci\u00eancia Negra" },
    { day: 8, month: 12, label: "Dia da Justi\u00e7a" },
    { day: 24, month: 12, label: "V\u00e9spera de Natal" },
    { day: 25, month: 12, label: "Natal" },
    { day: 31, month: 12, label: "V\u00e9spera de Ano Novo" }
  ];

  const PETITION_ACTION_KEY = "SPA_CDSP_DEADLINE_PETITION_ACTION";
  const PETITION_ACTION_MAX_AGE_MS = 10 * 60 * 1000;
  const SIMPLE_CLOSURE_ACTION_KEY = "SPA_CDSP_SIMPLE_CLOSURE_ACTION";
  const SIMPLE_CLOSURE_ACTION_MAX_AGE_MS = 15 * 60 * 1000;
  const SIMPLE_CLOSURE_BRIDGE_SOURCE = "SPA_CDSP_PAGE";
  const SIMPLE_CLOSURE_BRIDGE_RESPONSE_SOURCE = "SPA_CDSP_EXTENSION_BRIDGE";
  const SIMPLE_CLOSURE_MODEL_TARGETS = {
    preclusao_temporal: {
      folder: { documentTypeId: "1263", tokens: ["preclusao", "temporal"], folderOnly: true },
      template: { tokens: ["simples", "encerramento", "preclusao", "temporal", "cdsp", "proced"] }
    },
    conteudo_irrecorrivel: {
      folder: { documentTypeId: "1264", tokens: ["conteudo", "recorrer", "manifestar"], folderOnly: true },
      template: { tokens: ["simples", "encerramento", "nao", "recorrer", "cdsp", "proced"] }
    },
    demais_situacoes: {
      folder: { documentTypeId: "1265", tokens: ["demais", "situacoes"], folderOnly: true },
      template: { tokens: ["simples", "encerramento", "demais", "situacoes", "cdsp", "proced"] }
    },
    preclusao_consumativa: {
      folder: { documentTypeId: "1262", tokens: ["preclusao", "consumativa"], folderOnly: true },
      template: { tokens: ["simples", "encerramento", "preclusao", "consumativa", "cdsp", "proced"] }
    }
  };
  const CORRECTION_OPEN_QUEUE_KEY = "SPA_CDSP_CORRECTION_OPEN_QUEUE";
  const CORRECTION_OPEN_QUEUE_MAX_AGE_MS = 15 * 60 * 1000;
  const CORRECTION_BACK_HISTORY_KEY = "SPA_CDSP_CORRECTION_BACK_HISTORY";
  const CORRECTION_BACK_CONTEXT_KEY = "SPA_CDSP_CORRECTION_BACK_CONTEXT";
  const CORRECTION_BACK_HISTORY_MAX_AGE_MS = 15 * 60 * 1000;
  const CORRECTION_SEND_ACTION_KEY = "SPA_CDSP_CORRECTION_SEND_ACTION";
  const CORRECTION_SEND_ACTION_MAX_AGE_MS = 5 * 60 * 1000;
  const CORRECTION_SEND_STEP_ID = "2882";
  const CORRECTION_STEP_ACTION_KEY = "SPA_CDSP_CORRECTION_STEP_ACTION";
  const CORRECTION_STEP_ACTION_MAX_AGE_MS = 5 * 60 * 1000;
  const CORRECTION_RETURN_STEP_ID = "2786";
  const CORRECTION_CLOSE_STEP_ID = "2756";
  const CORRECTION_RETURN_ASSESSOR_FIELD_ID = "progress_form_data_ATR007572";
  const CORRECTION_RETURN_OBSERVATION_FIELD_ID = "progress_form_data_ATR007573";
  const CORRECTION_FILTER_ORDER_KEY = "SPA_CDSP_CORRECTION_FILTER_ORDER";
  const CORRECTION_FILTER_DEFAULT_ORDER = ["assessors", "judgingBodies", "manifestations", "activePoles", "receivedPeriods"];
  const CORRECTION_FILTER_DEFINITIONS = {
    assessors: {
      label: "Assessor(a)",
      placeholder: "Assessor(a)",
      recordKey: "assessor",
      stateKey: "assessors"
    },
    judgingBodies: {
      label: "Orgao julgador",
      placeholder: "Orgao julgador",
      recordKey: "judgingBody",
      stateKey: "judgingBodies"
    },
    manifestations: {
      label: "Manifestacao sugerida",
      placeholder: "Manifestacao sugerida",
      recordKey: "manifestation",
      stateKey: "manifestations"
    },
    activePoles: {
      label: "Polo ativo",
      placeholder: "Polo ativo (opcional)",
      recordKey: "activePole",
      stateKey: "activePoles"
    },
    receivedPeriods: {
      label: "Recebido",
      placeholder: "Recebido",
      recordKey: "receivedPeriod",
      stateKey: "receivedPeriods"
    }
  };
  const PANEL_POSITION_KEY = "SPA_CDSP_DEADLINE_PANEL_POSITION";
  const AGRAVO_ACTION_KEY = "SPA_CDSP_AGRAVO_INSTRUMENTO_ACTION";
  const AGRAVO_ACTION_MAX_AGE_MS = 10 * 60 * 1000;
  const AGRAVO_LAST_CLIPBOARD_KEY = "SPA_CDSP_AGRAVO_LAST_CLIPBOARD";
  const AGRAVO_BUTTON_ID = "spa-cdsp-agravo-instrumento-button";
  const AGRAVO_SUBJECT_LABEL = "Urg\u00eancia";
  const AGRAVO_STATE_COMPETENCE_LABELS = [
    "C\u00e2maras isoladas c\u00edveis de direito p\u00fablico",
    "Camaras isoladas civeis de direito publico"
  ];
  const AGRAVO_TRF_COMMON_SECTION_LABEL = "Tribunal Regional Federal da 1\u00aa Regi\u00e3o";
  const AGRAVO_TRF_RECURSAL_SECTION_LABEL = "Turma Recursal dos Juizados Especiais Federais da SJMT";
  const AGRAVO_TRF_COMPETENCE_LABELS = [
    "TRF1-5\u00aa e 6\u00aa Turmas-Direito Adm/Civil/Comercial",
    "TRF1 - 5\u00aa e 6\u00aa Turmas - Direito Adm/Civil/Comercial",
    "TRF1 5\u00aa e 6\u00aa Turmas Direito Adm Civil Comercial"
  ];
  const AGRAVO_ACTIVE_PARTY_CNPJ = "03.507.415/0003-06";
  const AGRAVO_FIELD_MAP = {
    processNumber: {
      selectors: ["#progress_form_data_ATR001943", "#progress_form_data_ATR007883"],
      labels: ["N\u00famero do Processo Vinculado", "Numero do Processo Vinculado"]
    },
    section: {
      selectors: ["#progress_form_data_ATR001934", "#progress_form_data_ATR007884"],
      labels: ["Se\u00e7\u00e3o/Subse\u00e7\u00e3o", "Secao/Subsecao", "Se\u00e7\u00e3o", "Subse\u00e7\u00e3o"]
    },
    competence: {
      selectors: ["#progress_form_data_ATR001938", "#progress_form_data_ATR007891"],
      labels: ["Compet\u00eancia", "Competencia"]
    },
    subject: {
      selectors: ["#progress_form_data_ATR001939", "#progress_form_data_ATR007892"],
      labels: ["Assunto(s)", "Assuntos", "Assunto"]
    },
    activeParty: {
      selectors: ["#progress_form_data_ATR001940", "#progress_form_data_ATR007893"],
      labels: ["Parte(s) Ativa(s)", "Parte Ativa", "Agravante"]
    },
    passiveParty: {
      selectors: ["#progress_form_data_ATR007894"],
      labels: ["Parte(s) Passiva(s)", "Parte Passiva", "Agravado"]
    },
    valueCause: {
      selectors: ["#progress_form_data_ATR001942", "#progress_form_data_ATR007895"],
      labels: ["Valor da causa", "Valor da Causa"]
    }
  };
  const AGRAVO_TABLE_FORMAT = {
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: "12pt",
    lineHeight: "115%",
    lineHeightAlt: "13.8pt",
    tableWidth: "18.92cm",
    leftColumnWidth: "6.64cm",
    leftColumnWidthPt: "188.22pt",
    leftColumnWidthTwips: "3765",
    rightColumnWidth: "12.28cm",
    rightColumnWidthPt: "348.09pt",
    rightColumnWidthTwips: "6964",
    border: "1px solid #000",
    textAlign: "justify",
    fontWeight: "400",
    padding: "0",
    textIndent: "0"
  };
  const AGRAVO_REPRESENTATION_TEXT =
    "Procuradoria-Geral do Estado de Mato Grosso, edif\u00edcio-sede localizado na av. Rep\u00fablica do L\u00edbano, n\u00b0. 2258, Jardim Monte L\u00edbano, Cuiab\u00e1/MT, CEP n\u00b0. 78.048-901, por meio do Procurador do Estado que assina este recurso";
  const AGRAVO_PREROGATIVE_LINES = [
    "- Dispensa de Procura\u00e7\u00e3o: representa\u00e7\u00e3o legal constitucional (Lei Complementar Estadual n\u00b0 111/2002, art. 2\u00b0, I; c/c Constitui\u00e7\u00e3o Federal, art. 32).",
    "- Isen\u00e7\u00e3o de preparo recursal (CPC, art. 1.007, \u00a71\u00b0, do CPC).",
    "- Prazo em dobro, a contar da intima\u00e7\u00e3o pessoal (CPC, art. 183)."
  ];
  const AGRAVO_PREROGATIVE_BOLD =
    "Dispensa de juntada dos autos integrais, tendo em vista que se trata de processo eletr\u00f4nico (CPC, art. 1017, \u00a75\u00b0 do CPC).";
  const AGRAVO_PREROGATIVE_BOLD_PLAIN = "- " + AGRAVO_PREROGATIVE_BOLD;
  const SIMPLE_CLOSURE_LAST_CLIPBOARD_KEY = "SPA_CDSP_SIMPLE_CLOSURE_LAST_CLIPBOARD";
  const SIMPLE_CLOSURE_TYPES = {
    preclusao_temporal: {
      label: "Preclus\u00e3o Temporal",
      pieces: [
        "Contesta\u00e7\u00e3o / Contrarraz\u00f5es / Contraminuta",
        "Apela\u00e7\u00e3o",
        "Recurso Inominado",
        "Agravo de Instrumento",
        "Embargos de Declara\u00e7\u00e3o",
        "Agravo Interno",
        "Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a",
        "Recurso Especial / Recurso Extraordin\u00e1rio"
      ]
    },
    conteudo_irrecorrivel: {
      label: "Conte\u00fado ao qual n\u00e3o cabe Recorrer/Manifestar",
      pieces: [
        "Contesta\u00e7\u00e3o",
        "Contraminuta / Contrarraz\u00f5es",
        "Agravo de Instrumento",
        "Embargos de Declara\u00e7\u00e3o",
        "Agravo Interno",
        "Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a",
        "Manifesta\u00e7\u00e3o",
        "Senten\u00e7a/Ac\u00f3rd\u00e3o: Extin\u00e7\u00e3o sem Resolu\u00e7\u00e3o de M\u00e9rito",
        "Senten\u00e7a/Ac\u00f3rd\u00e3o: Extin\u00e7\u00e3o com Resolu\u00e7\u00e3o de M\u00e9rito"
      ]
    },
    demais_situacoes: {
      label: "Demais Situa\u00e7\u00f5es",
      pieces: ["Pauta de Julgamento", "Retorno dos Autos", "Decl\u00ednio de Compet\u00eancia", "Outras Situa\u00e7\u00f5es"]
    },
    preclusao_consumativa: {
      label: "Preclus\u00e3o Consumativa",
      pieces: [
        "Contesta\u00e7\u00e3o",
        "Apela\u00e7\u00e3o",
        "Recurso Inominado",
        "Contrarraz\u00f5es",
        "Agravo de Instrumento",
        "Contraminuta",
        "Embargos de Declara\u00e7\u00e3o",
        "Agravo Interno",
        "Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a",
        "Manifesta\u00e7\u00e3o",
        "Recurso Especial / Recurso Extraordin\u00e1rio"
      ]
    }
  };
  const SIMPLE_CLOSURE_FORMAT = {
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: "14pt",
    lineHeight: "115%",
    textIndent: "1.25cm"
  };

  function createSimpleClosureModels() {
    const models = Object.create(null);
    const field = (key, label, type, options) => Object.assign({ key, label, type: type || "text", required: true }, options || {});
    const choice = (key, label, options, when) => field(key, label, "choice", { options, when });
    const check = (key, text, options) => Object.assign({ key, text, required: true, level: 0 }, options || {});
    const add = (typeKey, piece, fields, lines, checks, options) => {
      models[typeKey + "|" + piece] = Object.assign({ fields, lines, checks: checks || [] }, options || {});
    };
    const id = (key, label, options) => {
      // Accept a conditional callback directly, just like choice(), so a conditional ID is not rendered unconditionally.
      const fieldOptions = typeof options === "function" ? { when: options } : options;
      return field(key, label || "ID", "text", fieldOptions);
    };
    const protocolDate = field("protocolDate", "Data", "date");
    const pgeDate = field("pgeDate", "Data da intima\u00e7\u00e3o da PGE", "date");
    const protocolId = (label) => id("protocolId", label || "ID da pe\u00e7a protocolada");
    const processNumber = field("processNumber", "Processo origin\u00e1rio", "cnj");
    const pgeLine = "A intima\u00e7\u00e3o da PGE se deu em {pgeDate}, conforme consta na aba \"Expedientes\" do PJE.";
    const standardChecks = [
      check("fine", "N\u00e3o houve deferimento de multa posterior ao protocolo da contesta\u00e7\u00e3o;", { level: 1 }),
      check(
        "movement",
        "N\u00e3o houve movimenta\u00e7\u00e3o processual posterior \u00e0 contesta\u00e7\u00e3o que convenha ao Estado se manifestar, tais como: Emenda ou aditamento \u00e0 peti\u00e7\u00e3o inicial ou formula\u00e7\u00e3o de pedidos novos; Produ\u00e7\u00e3o de provas; Anu\u00eancia com extin\u00e7\u00e3o/desist\u00eancia etc.",
        { level: 1 }
      )
    ];
    const noFurtherResource = check(
      "noFurtherResource",
      "N\u00e3o h\u00e1 recurso posterior que necessite de manifesta\u00e7\u00e3o processual (contrarraz\u00f5es, agravo interno ou manifesta\u00e7\u00f5es).",
      { level: 1 }
    );
    const noFineAndMovementFor = (protocolReference, movementReference) => [
      check("fine", "N\u00e3o houve deferimento de multa posterior ao protocolo " + protocolReference + ";", { level: 1 }),
      check("movement", "N\u00e3o houve movimenta\u00e7\u00e3o processual posterior " + movementReference + " que convenha ao Estado se manifestar.", { level: 1 })
    ];

    add(
      "preclusao_consumativa",
      "Contesta\u00e7\u00e3o",
      [protocolId("ID da Contesta\u00e7\u00e3o"), protocolDate],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "A contesta\u00e7\u00e3o do Estado foi protocolada em {protocolDate} sob Id. {protocolId}.",
        "Considerando que est\u00e1 em Procedimento Comum ou Juizado, eu verifiquei que:"
      ],
      standardChecks
    );
    add(
      "preclusao_consumativa",
      "Apela\u00e7\u00e3o",
      [protocolId("ID da Apela\u00e7\u00e3o"), protocolDate, id("sentenceId", "ID da senten\u00e7a")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "A apela\u00e7\u00e3o foi protocolada em {protocolDate} sob Id. {protocolId}.",
        "A senten\u00e7a que gerou a Apela\u00e7\u00e3o est\u00e1 na Id. {sentenceId}.",
        "Verifiquei que:"
      ],
      [
        check("triage", "N\u00e3o h\u00e1 observa\u00e7\u00e3o feita pela triagem explicando a feitura da manifesta\u00e7\u00e3o sugerida.", { level: 1 }),
        check("changedSentence", "N\u00e3o h\u00e1 decis\u00e3o posterior julgando embargos de declara\u00e7\u00e3o da parte contr\u00e1ria que tenha modificado a senten\u00e7a anterior, objeto de apela\u00e7\u00e3o pelo Estado, de modo prejudicial ao Estado.", { level: 1 }),
        check("wrongDistribution", "N\u00e3o \u00e9 caso de distribui\u00e7\u00e3o de pend\u00eancia com o nome equivocado de \"apela\u00e7\u00e3o\".", { level: 1 }),
        check("otherAppeal", "N\u00e3o houve interposi\u00e7\u00e3o de apela\u00e7\u00e3o por outra parte em que o Estado ainda n\u00e3o apresentou contrarraz\u00f5es.", { level: 1 }),
        check("movement", "N\u00e3o houve movimenta\u00e7\u00e3o processual posterior \u00e0 senten\u00e7a que convenha ao Estado se manifestar.", { level: 1, warning: "Aten\u00e7\u00e3o: pode ser pend\u00eancia de contrarraz\u00f5es." })
      ]
    );
    add(
      "preclusao_consumativa",
      "Recurso Inominado",
      [protocolId("ID do Recurso Inominado"), protocolDate, id("sentenceId", "ID da senten\u00e7a")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "O Recurso Inominado foi protocolado em {protocolDate} sob Id. {protocolId}.",
        "A senten\u00e7a que gerou o Recurso Inominado est\u00e1 na Id. {sentenceId}.",
        "Verifiquei que:"
      ],
      [
        check("changedSentence", "N\u00e3o h\u00e1 decis\u00e3o posterior julgando embargos de declara\u00e7\u00e3o da parte contr\u00e1ria que tenha modificado a senten\u00e7a anterior, objeto de recurso inominado pelo Estado, de modo prejudicial ao Estado.", { level: 1 }),
        check("wrongDistribution", "N\u00e3o \u00e9 caso de distribui\u00e7\u00e3o de pend\u00eancia com o nome equivocado de \"recurso inominado\".", { level: 1 }),
        check("otherAppeal", "N\u00e3o houve interposi\u00e7\u00e3o de recurso inominado por outra parte em que o Estado ainda n\u00e3o apresentou contrarraz\u00f5es.", { level: 1 }),
        check("movement", "N\u00e3o houve movimenta\u00e7\u00e3o processual posterior \u00e0 senten\u00e7a que convenha ao Estado se manifestar.", { level: 1, warning: "Aten\u00e7\u00e3o: pode ser pend\u00eancia de contrarraz\u00f5es." })
      ]
    );
    add(
      "preclusao_consumativa",
      "Contrarraz\u00f5es",
      [protocolId("ID das Contrarraz\u00f5es"), protocolDate, id("resourceId", "ID do recurso")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "As Contrarraz\u00f5es do Estado foram protocoladas em {protocolDate} sob Id. {protocolId}.",
        "O recurso que gerou as Contrarraz\u00f5es est\u00e1 na Id. {resourceId}.",
        "Considerando que est\u00e1 em Procedimento Comum ou Juizado, eu verifiquei que:"
      ],
      noFineAndMovementFor("das contrarraz\u00f5es", "\u00e0s contrarraz\u00f5es")
    );
    add(
      "preclusao_consumativa",
      "Agravo de Instrumento",
      [protocolId("ID do Agravo de Instrumento"), protocolDate, processNumber, id("decisionId", "ID da decis\u00e3o que gerou o Agravo")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "O Agravo de Instrumento foi protocolado em {protocolDate} sob Id. {protocolId}.",
        "O processo origin\u00e1rio \u00e9 o n\u00ba {processNumber}.",
        "A decis\u00e3o que gerou o Agravo de Instrumento est\u00e1 na Id. {decisionId}.",
        "Considerando que est\u00e1 em Procedimento Comum ou Juizado, eu verifiquei que:"
      ],
      [noFurtherResource]
    );
    add(
      "preclusao_consumativa",
      "Contraminuta",
      [protocolId("ID da Contraminuta"), protocolDate, id("appealId", "ID do Agravo"), processNumber],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "A Contraminuta do Estado foi protocolada em {protocolDate} sob Id. {protocolId}.",
        "O Agravo que gerou a Contraminuta est\u00e1 na Id. {appealId}.",
        "O processo origin\u00e1rio \u00e9 o n\u00ba {processNumber}.",
        "Considerando que est\u00e1 em Procedimento Comum ou Juizado, eu verifiquei que:"
      ],
      noFineAndMovementFor("da contraminuta", "\u00e0 contraminuta")
    );
    add(
      "preclusao_consumativa",
      "Embargos de Declara\u00e7\u00e3o",
      [protocolId("ID dos Embargos de Declara\u00e7\u00e3o"), protocolDate, id("decisionId", "ID da decis\u00e3o/senten\u00e7a")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "Os Embargos de Declara\u00e7\u00e3o foram protocolados em {protocolDate} sob Id. {protocolId}.",
        "A decis\u00e3o/senten\u00e7a que gerou os Embargos de Declara\u00e7\u00e3o est\u00e1 na Id. {decisionId}.",
        "Considerando que est\u00e1 em Procedimento Comum ou Juizado, eu verifiquei que:"
      ],
      [noFurtherResource]
    );
    add(
      "preclusao_consumativa",
      "Agravo Interno",
      [id("decisionId", "ID da decis\u00e3o que gerou o Agravo"), protocolDate, protocolId("ID do Agravo Interno")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "A decis\u00e3o que gerou o Agravo Interno est\u00e1 na Id. {decisionId}.",
        "O Agravo Interno foi protocolado em {protocolDate} sob Id. {protocolId}.",
        "Considerando que est\u00e1 em Procedimento Comum ou Juizado, eu verifiquei que:"
      ],
      [noFurtherResource]
    );
    add(
      "preclusao_consumativa",
      "Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a",
      [protocolId("ID da Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a"), protocolDate, id("sentenceId", "ID da senten\u00e7a"), id("complianceId", "ID do Cumprimento de Senten\u00e7a")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "A Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a foi protocolada em {protocolDate} sob Id. {protocolId}.",
        "A senten\u00e7a que gerou o Cumprimento de Senten\u00e7a est\u00e1 na Id. {sentenceId}.",
        "O Cumprimento de Senten\u00e7a que gerou a Impugna\u00e7\u00e3o est\u00e1 na Id. {complianceId}.",
        "Considerando que est\u00e1 em Procedimento Comum ou Juizado, eu verifiquei que:"
      ],
      noFineAndMovementFor("da impugna\u00e7\u00e3o ao cumprimento de senten\u00e7a", "\u00e0 impugna\u00e7\u00e3o ao cumprimento de senten\u00e7a")
    );
    add(
      "preclusao_consumativa",
      "Recurso Especial / Recurso Extraordin\u00e1rio",
      [protocolId("ID do Recurso Especial / Recurso Extraordin\u00e1rio"), protocolDate, id("judgmentId", "ID do Ac\u00f3rd\u00e3o")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        "O Recurso Especial / Recurso Extraordin\u00e1rio foi protocolado em {protocolDate} sob Id. {protocolId}.",
        "O Ac\u00f3rd\u00e3o que gerou o recurso est\u00e1 na Id. {judgmentId}.",
        "Eu verifiquei que:"
      ],
      [
        check("changedJudgment", "N\u00e3o h\u00e1 decis\u00e3o posterior julgando embargos de declara\u00e7\u00e3o que tenha modificado o Ac\u00f3rd\u00e3o, de modo prejudicial ao Estado.", { level: 1 }),
        check("wrongDistribution", "N\u00e3o \u00e9 caso de distribui\u00e7\u00e3o de pend\u00eancia com o nome equivocado de Recurso Especial ou Recurso Extraordin\u00e1rio.", { level: 1, warning: "Aten\u00e7\u00e3o: pode ser pend\u00eancia de contrarraz\u00f5es." }),
        check("otherResource", "N\u00e3o houve interposi\u00e7\u00e3o de outro Recurso Especial ou Recurso Extraordin\u00e1rio em que o Estado ainda n\u00e3o apresentou contrarraz\u00f5es.", { level: 1 })
      ]
    );
    add(
      "preclusao_consumativa",
      "Manifesta\u00e7\u00e3o",
      [id("decisionId", "ID da decis\u00e3o"), pgeDate, field("reason", "Motivo", "textarea")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        pgeLine,
        "A decis\u00e3o que gerou a poss\u00edvel manifesta\u00e7\u00e3o est\u00e1 na Id. {decisionId}.",
        "N\u00e3o \u00e9 necess\u00e1ria a manifesta\u00e7\u00e3o, pois: {reason}"
      ],
      []
    );

    add(
      "preclusao_temporal",
      "Contesta\u00e7\u00e3o / Contrarraz\u00f5es / Contraminuta",
      [pgeDate, id("initialId", "ID da peti\u00e7\u00e3o inicial"), id("terminativeDecisionId", "ID da decis\u00e3o terminativa")],
      [
        "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
        pgeLine,
        "A peti\u00e7\u00e3o inicial est\u00e1 na Id. {initialId}.",
        "A pe\u00e7a do Estado n\u00e3o foi protocolada por haver decis\u00e3o terminativa (Id. {terminativeDecisionId}) posterior \u00e0 intima\u00e7\u00e3o. Por\u00e9m, considerando tal decis\u00e3o, eu verifiquei que:"
      ],
      [
        check("noFine", "N\u00e3o houve deferimento de multa em liminar;", { level: 1 }),
        check("noMovement", "N\u00e3o houve movimenta\u00e7\u00e3o processual posterior que demande manifesta\u00e7\u00e3o do Estado;", { level: 1 }),
        check("noSuppression", "O prazo para apresentar a pe\u00e7a n\u00e3o foi suprimido pela decis\u00e3o terminativa.", { level: 1 })
      ]
    );
    const temporalModels = [
      ["Apela\u00e7\u00e3o", "sentenceId", "ID da senten\u00e7a", [
        ["common", "Justi\u00e7a Comum", 30, true], ["child", "Crian\u00e7a", 10, false]
      ]],
      ["Recurso Inominado", "sentenceId", "ID da senten\u00e7a", [
        ["smallClaims", "Juizado", 10, true]
      ]],
      ["Agravo de Instrumento", "decisionId", "ID da decis\u00e3o", [
        ["smallClaims", "Juizado", 10, true], ["common", "Justi\u00e7a Comum", 30, true], ["child", "Crian\u00e7a", 10, false]
      ]],
      ["Embargos de Declara\u00e7\u00e3o", "decisionId", "ID da decis\u00e3o/senten\u00e7a", [
        ["smallClaims", "Juizado", 5, true], ["common", "Justi\u00e7a Comum", 10, true], ["child", "Crian\u00e7a", 5, false]
      ]],
      ["Agravo Interno", "decisionId", "ID da decis\u00e3o", [
        ["smallClaims", "Juizado", 10, true], ["common", "Justi\u00e7a Comum", 30, true], ["child", "Crian\u00e7a", 10, false]
      ]]
    ];
    temporalModels.forEach((entry) => {
      const piece = entry[0];
      const idKey = entry[1];
      const options = entry[3].map((option) => ({ value: option[0], label: option[1], days: option[2], businessDays: option[3] }));
      const fields = [pgeDate, id(idKey, entry[2])];
      const childDeadline = entry[3].find((option) => option[0] === "child");
      const childTempestivityDeadline = {
        "Apela\u00e7\u00e3o": 30,
        "Agravo de Instrumento": 30,
        "Embargos de Declara\u00e7\u00e3o": 10,
        "Agravo Interno": 30
      }[piece];
      const childTempestivityText = childDeadline
        ? "Em \u00faltima possibilidade, conferi que n\u00e3o h\u00e1 tempo de se utilizar o t\u00f3pico de Tempestividade em causas envolvendo menor de idade que poderia aumentar meu prazo para " + childTempestivityDeadline + " dias \u00fateis."
        : "";
      if (piece === "Agravo de Instrumento" || piece === "Agravo Interno") fields.unshift(processNumber);
      fields.push(choice("court", "Rito", options));
      add(
        "preclusao_temporal",
        piece,
        fields,
        [
          "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.",
          pgeLine,
          (piece === "Agravo de Instrumento" || piece === "Agravo Interno") ? "O processo origin\u00e1rio \u00e9 o n\u00ba {processNumber}." : "",
          "A decis\u00e3o/senten\u00e7a pertinente est\u00e1 na Id. {" + idKey + "}.",
          "Considerando que est\u00e1 em {courtLabel}, o prazo de {deadlineDescription} se encerraria em {deadline}, eu verifiquei:"
        ].filter(Boolean),
        [
          check("courtRecord", "Na aba do PJE, conferi o rito processual informado.", { level: 1 }),
          check("noRiteChange", "Na decis\u00e3o/senten\u00e7a, n\u00e3o houve altera\u00e7\u00e3o do rito processual.", { level: 1 }),
          check("holidays", "Conferi poss\u00edveis feriados e pontos facultativos na Justi\u00e7a estadual e na federal.", { level: 1 }),
          check("embargos", "Conferi a possibilidade de Embargos de Declara\u00e7\u00e3o terem sido opostos, interrompendo o prazo.", { level: 1 })
        ].concat(childTempestivityText
          ? [check("childTempestivity", childTempestivityText, { level: 1, when: (values) => values.court === "child" })]
          : [])
      );
    });
    add(
      "preclusao_temporal",
      "Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a",
      [pgeDate, id("sentenceId", "ID da senten\u00e7a"), id("complianceId", "ID do Cumprimento de Senten\u00e7a")],
      ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", pgeLine, "A senten\u00e7a est\u00e1 na Id. {sentenceId}.", "O Cumprimento de Senten\u00e7a est\u00e1 na Id. {complianceId}.", "Considerando que o prazo de 30 dias \u00fateis se encerraria em {deadline}, eu verifiquei:"],
      [check("holidays", "Conferi poss\u00edveis feriados e pontos facultativos na Justi\u00e7a estadual e na federal.", { level: 1 })],
      { deadline: { days: 30, businessDays: true } }
    );
    add(
      "preclusao_temporal",
      "Recurso Especial / Recurso Extraordin\u00e1rio",
      [pgeDate, id("judgmentId", "ID do Ac\u00f3rd\u00e3o")],
      ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", pgeLine, "O Ac\u00f3rd\u00e3o est\u00e1 na Id. {judgmentId}.", "Considerando que o prazo de 30 dias \u00fateis se encerraria em {deadline}, eu verifiquei:"],
      [check("holidays", "Conferi poss\u00edveis feriados e pontos facultativos na Justi\u00e7a estadual e na federal.", { level: 1 }), check("embargos", "Conferi a possibilidade de Embargos de Declara\u00e7\u00e3o terem sido opostos, interrompendo o prazo.", { level: 1 })]
    );
    add(
      "conteudo_irrecorrivel",
      "Contesta\u00e7\u00e3o",
      [id("sentenceId", "ID da senten\u00e7a")],
      ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", "A Contesta\u00e7\u00e3o do Estado n\u00e3o foi protocolada por haver senten\u00e7a (Id. {sentenceId}) posterior \u00e0 intima\u00e7\u00e3o. Por\u00e9m, considerando tal senten\u00e7a, eu verifiquei que:"],
      [check("notUnfavorable", "Ela n\u00e3o \u00e9 desfavor\u00e1vel ao Estado;", { level: 1 }), check("noFine", "N\u00e3o houve deferimento de multa em liminar.", { level: 1 })]
    );
    add(
      "conteudo_irrecorrivel",
      "Contraminuta / Contrarraz\u00f5es",
      [id("resourceId", "ID do recurso"), pgeDate, choice("defenseReason", "Motivo", [{ value: "favorable", label: "O recurso \u00e9 favor\u00e1vel ao Estado" }, { value: "notInterested", label: "O Estado n\u00e3o \u00e9 o interessado/objeto do recurso" }])],
      ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", "O recurso que gerou esta pend\u00eancia est\u00e1 na Id. {resourceId}.", pgeLine, "N\u00e3o h\u00e1 necessidade de defesa do Estado, pois: {defenseReasonLabel}.", "Por\u00e9m, considerando tal recurso, eu verifiquei que:"],
      [check("noFine", "N\u00e3o houve deferimento de multa em liminar.", { level: 1 })]
    );
    add(
      "conteudo_irrecorrivel",
      "Agravo de Instrumento",
      [
        id("intimationId", "ID da intima\u00e7\u00e3o"), pgeDate,
        choice("agravoReason", "Motivo", [{ value: "notInterlocutory", label: "A decis\u00e3o n\u00e3o \u00e9 interlocut\u00f3ria" }, { value: "urgentDenied", label: "A tutela de urg\u00eancia foi indeferida" }, { value: "municipality", label: "O exame/consulta foi direcionado exclusivamente para o Munic\u00edpio" }]),
        choice("fineStatus", "Multa", [{ value: "noFine", label: "N\u00e3o foi fixada multa" }, { value: "fine", label: "Foi fixada multa" }]),
        choice("fineOutcome", "Situa\u00e7\u00e3o da multa", [{ value: "complied", label: "Cumprimos integralmente no prazo estipulado pelo juiz, devidamente comprovado nos autos" }, { value: "revoked", label: "A multa foi revogada por decis\u00e3o posterior" }], (values) => values.fineStatus === "fine")
      ],
      ["O conte\u00fado da intima\u00e7\u00e3o que gerou a pend\u00eancia est\u00e1 na Id. {intimationId}.", pgeLine, "{agravoReasonLabel}.", "Verifiquei que:", "{fineStatusLabel}.", "{fineOutcomeLabel}"],
      [
        check("municipality", "N\u00e3o houve exclus\u00e3o do Munic\u00edpio do polo passivo;", { level: 1 }),
        check("noPrison", "Se deferida a tutela de urg\u00eancia, n\u00e3o foi determinada a pris\u00e3o ou o afastamento do Governador, Secret\u00e1rio, Procurador ou agente p\u00fablico.", { level: 1 }),
        check("wrongDistribution", "N\u00e3o \u00e9 caso de distribui\u00e7\u00e3o de pend\u00eancia com o nome equivocado de \"Agravo de Instrumento\".", { level: 1, warning: "Aten\u00e7\u00e3o: pode ser pend\u00eancia de contrarraz\u00f5es." })
      ]
    );
    add(
      "conteudo_irrecorrivel",
      "Embargos de Declara\u00e7\u00e3o",
      [
        pgeDate,
        choice("origin", "Foi gerado por", [{ value: "decision", label: "Despacho / Liminar / Decis\u00e3o Monocr\u00e1tica" }, { value: "sentence", label: "Senten\u00e7a" }, { value: "judgment", label: "Ac\u00f3rd\u00e3o" }]),
        id("originId", "ID da decis\u00e3o/senten\u00e7a/ac\u00f3rd\u00e3o"),
        choice("rite", "Rito", [{ value: "common", label: "Procedimento Comum" }, { value: "smallClaims", label: "Juizado" }], (values) => values.origin === "sentence"),
        choice("liminarFine", "Multa em liminar", [{ value: "noFine", label: "N\u00e3o foi fixada multa em liminar" }, { value: "revoked", label: "Foi fixada multa em liminar, por\u00e9m foi revogada posteriormente" }], (values) => values.origin === "sentence"),
        id("revocationId", "ID da decis\u00e3o de revoga\u00e7\u00e3o", (values) => values.origin === "sentence" && values.liminarFine === "revoked")
      ],
      ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", pgeLine, "Foi gerado por: {originLabel}.", "A {originLabel} est\u00e1 no Id. {originId}.", "{embargoHeading}"],
      [
        check("materialError", "N\u00e3o houve erro material, obscuridade, contradi\u00e7\u00e3o ou omiss\u00e3o;", { level: 1, when: (values) => values.origin !== "sentence" }),
        check("decisionCompetence", "A decis\u00e3o n\u00e3o imputa ao Estado de Mato Grosso mat\u00e9ria que deveria ser de compet\u00eancia municipal ou federal.", { level: 1, when: (values) => values.origin === "decision" }),
        check("decisionFine", "N\u00e3o foi fixada multa.", { level: 1, when: (values) => values.origin === "decision" }),
        check("decisionOther", "N\u00e3o possui qualquer outra mat\u00e9ria que deveria ser agravada.", { level: 1, when: (values) => values.origin === "decision" }),
        check("commonLimit", "O valor da causa ou bloqueio ultrapassam o teto do Juizado.", { level: 1, when: (values) => values.origin === "sentence" && values.rite === "common" }),
        check("smallClaimsRite", "Conferi na senten\u00e7a que n\u00e3o houve altera\u00e7\u00e3o do rito processual.", { level: 1, when: (values) => values.origin === "sentence" && values.rite === "smallClaims" }),
        check("sentenceCompetence", "O procedimento \u00e9 de responsabilidade do Estado.", { level: 1, when: (values) => values.origin === "sentence" }),
        check("noFine", "N\u00e3o foi fixada multa em liminar.", { level: 1, when: (values) => values.origin === "sentence" && values.liminarFine === "noFine" }),
        check("fineRevoked", "Foi fixada multa em liminar, por\u00e9m foi revogada posteriormente (Id. {revocationId}).", { level: 1, when: (values) => values.origin === "sentence" && values.liminarFine === "revoked" }),
        check("fees", "Os honor\u00e1rios foram definidos por equidade ou n\u00e3o ultrapassaram R$ 5.000,00 para advogado particular ou Defensoria.", { level: 1, when: (values) => values.origin === "sentence" && values.rite === "common" }),
        check("publicProsecutor", "N\u00e3o foram deferidos honor\u00e1rios ao Minist\u00e9rio P\u00fablico.", { level: 1, when: (values) => values.origin === "sentence" && values.rite === "common" }),
        check("equalFees", "Os honor\u00e1rios foram direcionados ao Estado e ao Munic\u00edpio de forma igualit\u00e1ria.", { level: 1, when: (values) => values.origin === "sentence" && values.rite === "common" }),
        check("noOther", "N\u00e3o h\u00e1 qualquer outra mat\u00e9ria para ser apelada/embargada.", { level: 1, when: (values) => values.origin === "sentence" }),
        check("sentenceFine", "N\u00e3o foi fixada multa em senten\u00e7a.", { level: 1, when: (values) => values.origin === "sentence" }),
        check("judgmentCompetence", "O procedimento \u00e9 de responsabilidade do Estado.", { level: 1, when: (values) => values.origin === "judgment" }),
        check("judgmentFees", "Os honor\u00e1rios foram definidos por equidade ou n\u00e3o ultrapassaram R$ 5.000,00 para advogado particular ou Defensoria.", { level: 1, when: (values) => values.origin === "judgment" }),
        check("judgmentEqualFees", "Os honor\u00e1rios foram direcionados ao Estado e ao Munic\u00edpio de forma igualit\u00e1ria.", { level: 1, when: (values) => values.origin === "judgment" }),
        check("judgmentFine", "N\u00e3o foi fixada multa.", { level: 1, when: (values) => values.origin === "judgment" }),
        check("noCosts", "N\u00e3o houve fixa\u00e7\u00e3o de custas.", { level: 1, when: (values) => values.origin !== "decision" })
      ]
    );
    add(
      "conteudo_irrecorrivel",
      "Agravo Interno",
      [id("decisionId", "ID da decis\u00e3o monocr\u00e1tica"), pgeDate, choice("fineStatus", "Multa", [{ value: "noFine", label: "N\u00e3o foi fixada multa" }, { value: "fine", label: "A multa foi fixada" }]), choice("fineThreshold", "Patamar da multa", [{ value: "daily", label: "O valor da multa di\u00e1ria foi igual ou inferior a R$ 2.000,00" }, { value: "cap", label: "Foi fixado teto de incid\u00eancia de at\u00e9 R$ 30.000,00" }], (values) => values.fineStatus === "fine")],
      ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", pgeLine, "A decis\u00e3o monocr\u00e1tica est\u00e1 no Id. {decisionId}.", "Considerando, eu verifiquei que:", "{fineStatusLabel}.", "{fineThresholdLabel}"],
      [
        check("notMonocratic", "A decis\u00e3o n\u00e3o \u00e9 monocr\u00e1tica;", { level: 1, exclusiveGroup: "agravoInternoReason" }),
        check("responsibility", "Trata-se de direcionamento de responsabilidade;", { level: 1, exclusiveGroup: "agravoInternoReason" }),
        check("noUrgent", "N\u00e3o foi concedida tutela de urg\u00eancia.", { level: 1, exclusiveGroup: "agravoInternoReason" })
      ]
    );
    add(
      "conteudo_irrecorrivel",
      "Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a",
      [protocolId("ID da Impugna\u00e7\u00e3o ao Cumprimento de Senten\u00e7a"), protocolDate, pgeDate, id("sentenceId", "ID da senten\u00e7a"), choice("rite", "Rito", [{ value: "common", label: "Procedimento Comum" }, { value: "smallClaims", label: "Juizado" }])],
      ["O Cumprimento de Senten\u00e7a foi protocolado em {protocolDate} sob Id. {protocolId}.", pgeLine, "A senten\u00e7a est\u00e1 na Id. {sentenceId}.", "Considerando que est\u00e1 em {riteLabel}, eu verifiquei:"],
      [check("noExcess", "N\u00e3o houve excesso de execu\u00e7\u00e3o;", { level: 1 }), check("noFine", "N\u00e3o foi pedida multa no Cumprimento de Senten\u00e7a;", { level: 1 }), check("noPrison", "N\u00e3o foi pedida pris\u00e3o ou afastamento de agente p\u00fablico;", { level: 1 }), check("noCosts", "N\u00e3o houve fixa\u00e7\u00e3o de custas;", { level: 1 }), check("procedure", "Conferi o procedimento no SISREG e no SIGADOC.", { level: 1 }), check("noFees", "N\u00e3o foram pedidos honor\u00e1rios.", { level: 1, when: (values) => values.rite === "smallClaims" })]
    );
    add(
      "conteudo_irrecorrivel",
      "Manifesta\u00e7\u00e3o",
      [pgeDate, id("decisionId", "ID da decis\u00e3o"), field("reason", "Motivo", "textarea")],
      ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", pgeLine, "A decis\u00e3o que gerou a poss\u00edvel manifesta\u00e7\u00e3o est\u00e1 na Id. {decisionId}.", "N\u00e3o \u00e9 necess\u00e1ria a manifesta\u00e7\u00e3o, pois: {reason}"],
      []
    );
    add(
      "conteudo_irrecorrivel",
      "Senten\u00e7a/Ac\u00f3rd\u00e3o: Extin\u00e7\u00e3o sem Resolu\u00e7\u00e3o de M\u00e9rito",
      [id("judgmentId", "ID da Senten\u00e7a/Ac\u00f3rd\u00e3o"), pgeDate],
      ["O expediente que est\u00e1 comigo \u00e9 o seguinte: Senten\u00e7a/Ac\u00f3rd\u00e3o.", "A Senten\u00e7a/Ac\u00f3rd\u00e3o est\u00e1 na Id. {judgmentId}.", pgeLine, "Considerando, eu verifiquei que:"],
      [check("noFees", "N\u00e3o fomos condenados em honor\u00e1rios;", { level: 1 }), check("noCosts", "N\u00e3o fomos condenados em custas processuais;", { level: 1 }), check("noFine", "N\u00e3o h\u00e1 multa fixada;", { level: 1 }), check("noBlock", "N\u00e3o h\u00e1 bloqueio deferido.", { level: 1 })]
    );
    add(
      "conteudo_irrecorrivel",
      "Senten\u00e7a/Ac\u00f3rd\u00e3o: Extin\u00e7\u00e3o com Resolu\u00e7\u00e3o de M\u00e9rito",
      [id("judgmentId", "ID da Senten\u00e7a/Ac\u00f3rd\u00e3o"), pgeDate, choice("fees", "Honor\u00e1rios", [{ value: "noFees", label: "N\u00e3o fomos condenados em honor\u00e1rios" }, { value: "reasonable", label: "Os honor\u00e1rios est\u00e3o em patamar aceit\u00e1vel" }]), choice("fine", "Multa", [{ value: "noFine", label: "N\u00e3o h\u00e1 multa fixada" }, { value: "reasonable", label: "A multa est\u00e1 em patamar aceit\u00e1vel" }]), choice("fineThreshold", "Patamar da multa", [{ value: "daily", label: "O valor da multa di\u00e1ria \u00e9 igual ou inferior a R$ 2.000,00" }, { value: "cap", label: "H\u00e1 teto de incid\u00eancia de at\u00e9 R$ 30.000,00" }], (values) => values.fine === "reasonable")],
      ["O expediente que est\u00e1 comigo \u00e9 o seguinte: Senten\u00e7a/Ac\u00f3rd\u00e3o.", "A Senten\u00e7a/Ac\u00f3rd\u00e3o est\u00e1 na Id. {judgmentId}.", pgeLine, "Considerando, eu verifiquei que:", "{feesLabel}.", "{fineLabel}.", "{fineThresholdLabel}"],
      [check("responsibility", "O procedimento \u00e9 realmente de responsabilidade estadual;", { level: 1 }), check("feeAmount", "Em favor de advogado ou da Defensoria, os honor\u00e1rios n\u00e3o ultrapassam R$ 5.000,00 em valor fixo.", { level: 1, when: (values) => values.fees === "reasonable" }), check("noCosts", "N\u00e3o fomos condenados em custas processuais;", { level: 1 }), check("noEmbargos", "N\u00e3o h\u00e1 mat\u00e9ria a ser discutida em Embargos de Declara\u00e7\u00e3o.", { level: 1 })]
    );

    add("demais_situacoes", "Pauta de Julgamento", [pgeDate], ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", pgeLine, "Eu verifiquei que:"], [check("movement", "N\u00e3o houve movimenta\u00e7\u00e3o processual que demande manifesta\u00e7\u00e3o do Estado, tais como: produ\u00e7\u00e3o de provas, aditamento da inicial, anu\u00eancia com extin\u00e7\u00e3o/desist\u00eancia etc.", { level: 1 })]);
    add("demais_situacoes", "Retorno dos Autos", [pgeDate], ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", pgeLine, "Eu verifiquei que:"], [check("returned", "Houve intima\u00e7\u00e3o do Estado em rela\u00e7\u00e3o ao recurso julgado que est\u00e1 sendo devolvido \u00e0 1\u00aa inst\u00e2ncia.", { level: 1 }), check("noBenefit", "N\u00e3o h\u00e1 decis\u00e3o favor\u00e1vel ao Estado, pass\u00edvel de cumprimento, tal como execu\u00e7\u00e3o de honor\u00e1rios advocat\u00edcios em favor da PGE, levantamento de valores bloqueados ainda n\u00e3o liberados, liquida\u00e7\u00e3o e execu\u00e7\u00e3o de valores usados pela parte autora que devam ser devolvidos ao Estado em caso de decis\u00e3o final de improced\u00eancia etc.", { level: 2 })]);
    add("demais_situacoes", "Decl\u00ednio de Compet\u00eancia", [pgeDate], ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {piece}.", pgeLine, "Eu verifiquei que:"], [check("notHarmful", "O decl\u00ednio de compet\u00eancia relativo ao expediente n\u00e3o apresenta motivos para serem questionados, pois n\u00e3o \u00e9 mal\u00e9fico ao Estado;", { level: 1 }), check("movement", "N\u00e3o houve movimenta\u00e7\u00e3o processual que demande manifesta\u00e7\u00e3o do Estado, tais como: produ\u00e7\u00e3o de provas, aditamento da inicial, anu\u00eancia com extin\u00e7\u00e3o/desist\u00eancia etc.", { level: 1 })]);
    add("demais_situacoes", "Outras Situa\u00e7\u00f5es", [field("intimation", "Intima\u00e7\u00e3o", "textarea"), pgeDate, field("reason", "Motivo", "textarea")], ["A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: {intimation}", pgeLine, "N\u00e3o \u00e9 necess\u00e1ria a manifesta\u00e7\u00e3o processual, pois: {reason}"], []);
    return models;
  }

  const SIMPLE_CLOSURE_MODELS = createSimpleClosureModels();
  const DEADLINE_STYLE_PRESETS = {
    long: {
      label: "Azul",
      fillColor: [0, 123, 255],
      textColor: [255, 255, 255],
      borderColor: [0, 98, 204],
      screenBackground: "#007bff",
      screenText: "#ffffff",
      screenBorder: "#0062cc"
    },
    short: {
      label: "Amarelo",
      fillColor: [255, 193, 7],
      textColor: [33, 37, 41],
      borderColor: [224, 168, 0],
      screenBackground: "#ffc107",
      screenText: "#212529",
      screenBorder: "#e0a800"
    },
    late: {
      label: "Vermelho",
      fillColor: [220, 53, 69],
      textColor: [255, 255, 255],
      borderColor: [189, 33, 48],
      screenBackground: "#dc3545",
      screenText: "#ffffff",
      screenBorder: "#bd2130"
    },
    none: {
      label: "Sem prazo",
      fillColor: [233, 236, 239],
      textColor: [73, 80, 87],
      borderColor: [206, 212, 218],
      screenBackground: "#e9ecef",
      screenText: "#495057",
      screenBorder: "#ced4da"
    },
    default: {
      label: "",
      fillColor: null,
      textColor: [28, 43, 57],
      borderColor: [210, 218, 232],
      screenBackground: "",
      screenText: "#1c2b39",
      screenBorder: "#d2dae8"
    }
  };

  const state = {
    running: false,
    stopped: false,
    logs: [],
    lastSummary: null,
    lastReport: null,
    reportEscapeHandler: null,
    correctionRecords: [],
    correctionFilters: {
      assessors: [],
      judgingBodies: [],
      activePoles: [],
      manifestations: [],
      receivedPeriods: []
    },
    correctionAvailableFilterKeys: CORRECTION_FILTER_DEFAULT_ORDER.slice(),
    correctionFilterOrder: readStoredCorrectionFilterOrder(),
    activeTeamNames: [],
    activeTeamLoaded: false,
    activeTeamLoading: false,
    activeTeamError: "",
    activeTeamPromise: null
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[º°]/g, "o")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(text) {
    return normalizeText(text)
      .toLowerCase()
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  function addDays(date, days) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
  }

  function startOfDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function isFixedHoliday(date) {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return FIXED_HOLIDAYS.some((holiday) => holiday.day === day && holiday.month === month);
  }

  function isBusinessDay(date) {
    return !isWeekend(date) && !isFixedHoliday(date);
  }

  function addBusinessDays(date, days) {
    const total = Math.max(0, Number(days) || 0);
    let cursor = startOfDate(date);
    let counted = 0;

    while (counted < total) {
      cursor = addDays(cursor, 1);
      if (isBusinessDay(cursor)) counted += 1;
    }

    return cursor;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(date) {
    return pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1) + "/" + date.getFullYear();
  }

  function formatDateTime(date) {
    return (
      formatDate(date) +
      " " +
      pad2(date.getHours()) +
      ":" +
      pad2(date.getMinutes())
    );
  }

  function sanitizeFilename(text) {
    return normalizeKey(text)
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "relatorio";
  }

  function resolveSpaUrl(url) {
    const value = String(url || "").trim();
    if (!value || value === "#") return "";

    try {
      return new URL(value, window.location.origin).href;
    } catch (_error) {
      return "";
    }
  }

  function elementUrl(element) {
    if (!element) return "";
    return resolveSpaUrl(element.href || element.getAttribute("href") || "");
  }

  function isProcedureFolderUrl(url) {
    const href = resolveSpaUrl(url);
    if (!href) return false;

    try {
      const parsed = new URL(href);
      return /^\/procedures\/[^/]+\/folder\/?$/.test(parsed.pathname);
    } catch (_error) {
      return false;
    }
  }

  function isExternalDocumentsUrl(url) {
    const href = resolveSpaUrl(url);
    if (!href || isProcedureFolderUrl(href)) return false;

    try {
      const parsed = new URL(href);
      return /^\/judicial_processes\/[^/]+\/documents\/?$/.test(parsed.pathname);
    } catch (_error) {
      return false;
    }
  }

  function procedurePageUrl(procedureId) {
    return procedureId ? resolveSpaUrl("/procedures/" + procedureId) : "";
  }

  function setStatus(text) {
    const status = document.querySelector("#spa-cdsp-deadline-status");
    if (status) status.textContent = text;
  }

  function log(message, type) {
    const prefix = "[" + new Date().toLocaleTimeString("pt-BR") + "] ";
    const item = { message: prefix + message, type: type || "info" };
    state.logs.push(item);
    if (state.logs.length > 120) state.logs.shift();
    renderLogs();
  }

  function renderLogs() {
    const box = document.querySelector("#spa-cdsp-deadline-log");
    if (!box) return;

    box.innerHTML = "";
    state.logs.forEach((entry) => {
      const row = document.createElement("div");
      row.textContent = entry.message;
      row.style.cssText =
        "font-size:11px;line-height:1.35;margin:0 0 2px 0;color:" +
        (entry.type === "error" ? "#ffb4b4" : entry.type === "ok" ? "#b9f6ca" : "#d5e5f2") +
        ";";
      box.appendChild(row);
    });
    box.scrollTop = box.scrollHeight;
  }

  function ensureJquery() {
    if (!window.jQuery) {
      throw new Error("jQuery nao encontrado. Abra a caixa de processos do SPA antes de gerar o relatorio.");
    }
    return window.jQuery;
  }

  function getDataTable() {
    const $ = ensureJquery();
    if (window.dtProceduresBox) return window.dtProceduresBox;
    if ($.fn.DataTable && $("#procedures-box").length) return $("#procedures-box").DataTable();
    throw new Error("Tabela #procedures-box nao encontrada. Abra a caixa de processos do SPA.");
  }

  async function waitProcessingDone(context, timeoutMs) {
    const started = Date.now();
    const timeout = timeoutMs || CONFIG.processingTimeoutMs;
    let slowLoadLogged = false;
    while (Date.now() - started < timeout) {
      const processing = document.querySelector("#procedures-box_processing");
      const visible =
        processing &&
        window.getComputedStyle(processing).display !== "none" &&
        window.getComputedStyle(processing).visibility !== "hidden";
      if (!visible) return;

      if (!slowLoadLogged && Date.now() - started > 10000) {
        slowLoadLogged = true;
        setStatus("SPA ainda carregando...");
        log(
          "Aguardando o SPA concluir o carregamento" +
            (context ? " (" + context + ")" : "") +
            ". Em caixas muito extensas isso pode levar alguns minutos."
        );
      }

      await sleep(250);
    }

    throw new Error(
      "Tempo excedido aguardando o carregamento da tabela do SPA" +
        (context ? " (" + context + ")" : "") +
        ". A caixa pode estar muito extensa, o SPA pode estar lento ou a consulta pode ter travado. " +
        "Tente gerar novamente; se persistir, aplique um filtro no SPA para reduzir a quantidade de processos."
    );
  }

  function isRenderedTableCell(cell) {
    if (!cell || cell.hidden) return false;
    try {
      const style = window.getComputedStyle(cell);
      return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
    } catch (_error) {
      return true;
    }
  }

  function renderedTableCells(cells) {
    return Array.from(cells || []).filter(isRenderedTableCell);
  }

  function headerLabel(header) {
    const clone = header.cloneNode(true);
    clone.querySelectorAll(".filter-icon-wrapper, .group-toggle-icon, script, style").forEach((node) => {
      node.remove();
    });
    return normalizeText(clone.textContent || header.getAttribute("aria-label") || "");
  }

  function headerCandidates(header) {
    const aria = String(header.getAttribute("aria-label") || "").split(":")[0];
    return [
      header.getAttribute("data-name") || "",
      header.getAttribute("data-column-name") || "",
      headerLabel(header),
      aria
    ].map(normalizeKey);
  }

  function tableHeaders() {
    const preferredRowSelectors = [
      "#procedures-box_wrapper .dataTables_scrollHead thead tr.dt-header",
      "#procedures-box thead tr.dt-header",
      "#procedures-box_wrapper table.dataTable thead tr.dt-header",
      "table#procedures-box thead tr.dt-header"
    ];
    const fallbackRowSelectors = [
      "#procedures-box_wrapper .dataTables_scrollHead thead tr",
      "#procedures-box thead tr",
      "#procedures-box_wrapper table.dataTable thead tr",
      "table#procedures-box thead tr"
    ];

    function bestHeaderCells(rowSelectors) {
      const rows = [];
      const seen = new Set();

      rowSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((row) => {
          if (seen.has(row)) return;
          seen.add(row);
          rows.push(row);
        });
      });

      let bestCells = [];
      let bestScore = -1;

      rows.forEach((row) => {
        const cells = renderedTableCells(row.children);
        const score = cells.reduce((total, cell) => {
          const hasName = headerCandidates(cell).some(Boolean);
          return total + (hasName ? 1 : 0);
        }, 0);
        if (score > bestScore || (score === bestScore && cells.length > bestCells.length)) {
          bestScore = score;
          bestCells = cells;
        }
      });

      return bestCells;
    }

    const preferredCells = bestHeaderCells(preferredRowSelectors);
    if (preferredCells.length) return preferredCells;

    const fallbackCells = bestHeaderCells(fallbackRowSelectors);
    if (fallbackCells.length) return fallbackCells;

    return renderedTableCells(document.querySelectorAll("#procedures-box thead tr.dt-header th"));
  }

  function columnCandidateMatches(candidate, wanted) {
    if (!candidate) return false;
    if (wanted.indexOf(candidate) >= 0) return true;

    return wanted.some((name) => {
      const candidateWords = candidate.split(" ").filter(Boolean).length;
      const wantedParts = name.split(" ").filter(Boolean);
      return (
        candidate.indexOf(name) >= 0 ||
        (candidateWords > 1 && name.indexOf(candidate) >= 0) ||
        (wantedParts.length > 0 && wantedParts.every((part) => candidate.indexOf(part) >= 0))
      );
    });
  }

  function findColumnIndexFromDataTable(names) {
    let dt;
    try {
      dt = getDataTable();
    } catch (_error) {
      return -1;
    }

    const wanted = names.map(normalizeKey).filter(Boolean);
    let settings = null;
    try {
      settings = dt.settings && dt.settings()[0];
    } catch (_error) {
      settings = null;
    }

    const columns = (settings && Array.isArray(settings.aoColumns) && settings.aoColumns) || [];
    const visibleIndexes = [];

    try {
      if (dt.columns) {
        dt.columns(":visible").every(function () {
          if (this && typeof this.index === "function") visibleIndexes.push(this.index());
        });
      }
    } catch (_error) {
      visibleIndexes.length = 0;
    }

    if (!visibleIndexes.length && columns.length) {
      columns.forEach((column, index) => {
        if (!column || column.bVisible === false) return;
        visibleIndexes.push(index);
      });
    }

    for (let visiblePosition = 0; visiblePosition < visibleIndexes.length; visiblePosition += 1) {
      const dataIndex = visibleIndexes[visiblePosition];
      const column = columns[dataIndex] || {};
      const candidates = [
        column.sTitle,
        column.title,
        column.name,
        column.sName,
        column.data,
        column.mData,
        column.idx,
        column.nTh && headerLabel(column.nTh),
        column.nTh && column.nTh.getAttribute && column.nTh.getAttribute("data-name"),
        column.nTh && column.nTh.getAttribute && column.nTh.getAttribute("aria-label")
      ].map(normalizeKey);

      if (candidates.some((candidate) => columnCandidateMatches(candidate, wanted))) {
        return visiblePosition;
      }
    }

    return -1;
  }

  function findColumnIndex(names) {
    const wanted = names.map(normalizeKey).filter(Boolean);
    const headers = tableHeaders();

    for (let position = 0; position < headers.length; position += 1) {
      const header = headers[position];
      const candidates = headerCandidates(header);
      if (!candidates.some((candidate) => columnCandidateMatches(candidate, wanted))) continue;

      return position;
    }

    return findColumnIndexFromDataTable(names);
  }

  function elementFullText(element) {
    const pieces = [];
    const seen = new Set();
    if (!element) return "";

    function addPiece(value) {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      const key = normalizeKey(text);
      const duplicatesExisting = Array.from(seen).some((existing) => {
        if (!existing || existing.length < 4 || !key) return false;
        return existing === key || existing.indexOf(key) >= 0 || key.indexOf(existing) >= 0;
      });
      if (!text || duplicatesExisting) return;
      seen.add(key);
      pieces.push(text);
    }

    element.querySelectorAll("[data-full-text]").forEach((child) => {
      addPiece(child.getAttribute("data-full-text") || child.textContent || "");
    });
    addPiece(element.getAttribute("data-full-text") || element.textContent || "");
    return pieces.join(" ").replace(/\s+/g, " ").trim();
  }

  function cellText(row, index) {
    const cells = renderedTableCells(row && row.children);
    if (index < 0 || !cells[index]) return "";
    return elementFullText(cells[index]);
  }

  function deadlineCell(row, index) {
    const cells = renderedTableCells(row && row.children);
    return index >= 0 && cells[index] ? cells[index] : null;
  }

  function elementClassSnapshot(element) {
    if (!element) return "";
    const nodes = [element].concat(Array.from(element.querySelectorAll ? element.querySelectorAll("*") : []));
    return normalizeKey(
      nodes
        .map((node) => String(node.className || node.getAttribute("class") || ""))
        .join(" ")
    );
  }

  function deadlineVisualElement(row, deadlineIndex) {
    const cell = deadlineCell(row, deadlineIndex);
    if (!cell) return null;

    return (
      cell.querySelector("a.badge[href*='/calendars/']") ||
      cell.querySelector(".badge-danger, .badge-warning, .badge-primary") ||
      cell.querySelector(".deadline-late, .deadline-short, .deadline-long, .deadline-none") ||
      cell.querySelector("a.badge, .badge") ||
      cell
    );
  }

  function deadlineKindFromClasses(classes) {
    if (/\b(deadline late|badge danger|text danger)\b/.test(classes)) return "late";
    if (/\b(deadline short|badge warning|text warning|bg warning)\b/.test(classes)) return "short";
    if (/\b(deadline long|badge primary|text info|text primary)\b/.test(classes)) return "long";
    if (/\b(deadline none|badge secondary|badge light)\b/.test(classes)) return "none";
    return "";
  }

  function parseRgbColor(value) {
    const match = String(value || "").match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\s*\)/i);
    if (!match) return null;

    const alpha = match[4] == null ? 1 : Number(match[4]);
    if (!alpha) return null;

    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }

  function rgbArrayToCss(color) {
    return Array.isArray(color) ? "rgb(" + color.join(", ") + ")" : "";
  }

  function deadlineComputedColors(element) {
    if (!element || !window.getComputedStyle) return {};

    try {
      const style = window.getComputedStyle(element);
      return {
        fillColor: parseRgbColor(style.backgroundColor),
        textColor: parseRgbColor(style.color),
        borderColor: parseRgbColor(style.borderColor)
      };
    } catch (_error) {
      return {};
    }
  }

  function deadlineKindFromColor(fillColor) {
    if (!Array.isArray(fillColor)) return "";
    const red = fillColor[0];
    const green = fillColor[1];
    const blue = fillColor[2];

    if (red >= 180 && green <= 100 && blue <= 110) return "late";
    if (red >= 190 && green >= 140 && blue <= 90) return "short";
    if (blue >= 140 && red <= 110) return "long";
    return "";
  }

  function deadlineStyle(row, deadlineIndex) {
    const cell = deadlineCell(row, deadlineIndex);
    const visualElement = deadlineVisualElement(row, deadlineIndex);
    const classes = elementClassSnapshot(cell);
    const computed = deadlineComputedColors(visualElement);
    const kind = deadlineKindFromClasses(classes) || deadlineKindFromColor(computed.fillColor) || "default";
    const preset = DEADLINE_STYLE_PRESETS[kind] || DEADLINE_STYLE_PRESETS.default;
    const fillColor = computed.fillColor || preset.fillColor;
    const textColor = computed.textColor || preset.textColor;
    const borderColor = computed.borderColor || preset.borderColor;

    return {
      kind,
      label: preset.label,
      fillColor,
      textColor,
      borderColor,
      screenBackground: rgbArrayToCss(fillColor) || preset.screenBackground,
      screenText: rgbArrayToCss(textColor) || preset.screenText,
      screenBorder: rgbArrayToCss(borderColor) || preset.screenBorder,
      className: classes
    };
  }

  function fallbackReceivedText(row) {
    const cells = Array.from(row.children).reverse();
    const found = cells.find((cell) => {
      const text = normalizeKey(elementFullText(cell));
      return /(dia|hora|minuto|mes|semana|ano)/.test(text);
    });
    return found ? elementFullText(found) : "";
  }

  function rowProcedureId(row) {
    const checkbox = row.querySelector("input.procedure-inbox-checkbox[value], input[name^='procedure_inbox_']");
    const fromCheckbox = checkbox ? checkbox.value : "";
    const folder = row.querySelector("a[href*='/procedures/'][href*='/folder']");
    const folderId = folder ? String(folder.href || folder.getAttribute("href") || "").match(/\/procedures\/(\d+)\/folder/) : null;
    return row.getAttribute("data-procedure-id") || fromCheckbox || (folderId ? folderId[1] : "");
  }

  function rowExternalDocumentsUrl(row) {
    const links = Array.from(row.querySelectorAll("a[href]"));
    const candidates = links.filter((link) => isExternalDocumentsUrl(elementUrl(link)));

    const byTitle = candidates.find((link) => {
      const text = normalizeKey(linkDescriptor(link));
      return text.indexOf("documentos externos") >= 0;
    });
    if (byTitle) return elementUrl(byTitle);

    return candidates.length ? elementUrl(candidates[0]) : "";
  }

  function linkDescriptor(element) {
    if (!element) return "";
    return [
      element.getAttribute("data-original-title"),
      element.getAttribute("title"),
      element.getAttribute("aria-label"),
      element.textContent
    ].join(" ");
  }

  function isExpedienteLink(element) {
    const label = normalizeKey(linkDescriptor(element));
    const href = String(elementUrl(element)).toLowerCase();
    const target = String(element.getAttribute("target") || "");
    const hasFileIcon = Boolean(
      element.querySelector(
        "i.zmdi-file, i.zmdi-file-text, .zmdi-file, .zmdi-file-text, .fa-file, .fa-file-text, [class*='file']"
      )
    );

    if (label.indexOf("ler expediente") >= 0) return true;
    if (href.indexOf("/coresigner/info/") >= 0) return true;
    if (/^document-\d+/i.test(target) && hasFileIcon) return true;
    return hasFileIcon && label.indexOf("expediente") >= 0;
  }

  function sortElementsByScreenPosition(elements) {
    return elements
      .map((element, index) => {
        const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : { left: 0, top: 0 };
        return { element, index, x: rect.left || 0, y: Math.round((rect.top || 0) / 10) * 10 };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x || a.index - b.index)
      .map((item) => item.element);
  }

  function rowExpedienteUrl(row) {
    const expedientes = sortElementsByScreenPosition(
      Array.from(row.querySelectorAll("a[href], button, [role='button']")).filter(isExpedienteLink)
    );
    return elementUrl(expedientes[0]);
  }

  function extractProcessNumber(text) {
    const match = normalizeText(text).match(/\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}/);
    return match ? match[0] : "";
  }

  function rowSearchText(row) {
    const pieces = [];
    row.querySelectorAll("[data-full-text], td").forEach((element) => {
      pieces.push(element.getAttribute("data-full-text") || element.textContent || "");
    });
    return pieces.join(" ");
  }

  function columnsForReport() {
    const manifestationIndex = findColumnIndex([
      "Manisfestação Sugerida",
      "Manifestação Sugerida",
      "Manifestacao Sugerida",
      "manifestation"
    ]);
    const processIndex = findColumnIndex(["Número do Processo", "Numero do Processo", "Processo"]);
    const receivedIndex = findColumnIndex(["received_at", "Recebido"]);
    const deadlineIndex = findColumnIndex(["deadline", "Prazo"]);

    if (manifestationIndex < 0) {
      throw new Error("Coluna 'Manifestação Sugerida' não encontrada ou não habilitada no SPA.");
    }
    if (processIndex < 0) {
      throw new Error("Coluna 'Número do Processo' não encontrada ou não habilitada no SPA.");
    }

    if (deadlineIndex < 0) {
      throw new Error("Coluna 'Prazo' nao encontrada ou nao habilitada no SPA.");
    }

    return {
      manifestationIndex,
      processIndex,
      receivedIndex,
      deadlineIndex
    };
  }

  function parseNumericWord(text) {
    const normalized = normalizeKey(text);
    const number = normalized.match(/\d+/);
    if (number) return parseInt(number[0], 10);
    if (/\b(um|uma)\b/.test(normalized)) return 1;
    return 0;
  }

  function receivedDurationInfo(text) {
    const normalized = normalizeKey(text);
    const amount = parseNumericWord(normalized);

    if (!amount) {
      return { amount: 0, unit: "dias", days: 0, display: "0 dias" };
    }

    if (normalized.indexOf("hora") >= 0) {
      return {
        amount,
        unit: "horas",
        days: 0,
        display: amount + " " + (amount === 1 ? "hora" : "horas")
      };
    }

    if (normalized.indexOf("minuto") >= 0 || normalized.indexOf("segundo") >= 0) {
      return { amount: 0, unit: "horas", days: 0, display: "0 horas" };
    }

    let days = 0;
    if (normalized.indexOf("semana") >= 0) days = amount * 7;
    else if (normalized.indexOf("mes") >= 0) days = amount * 30;
    else if (normalized.indexOf("ano") >= 0) days = amount * 365;
    else if (normalized.indexOf("dia") >= 0) days = amount;

    return {
      amount: days,
      unit: "dias",
      days,
      display: days + " " + (days === 1 ? "dia" : "dias")
    };
  }

  function parseReceivedDays(text) {
    return receivedDurationInfo(text).days;
  }

  function formatReceivedText(text) {
    return receivedDurationInfo(text).display;
  }

  function parseDeadlineDate(text) {
    const value = String(text || "").replace(/\s+/g, " ");
    const match = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{2}):(\d{2}))?/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 23;
    const minute = match[5] ? parseInt(match[5], 10) : 59;
    const date = new Date(year, month, day, hour, minute, 0, 0);

    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return date;
  }

  function textFromHtmlSnippet(value) {
    const raw = String(value || "");
    if (!raw) return "";

    try {
      const template = document.createElement("template");
      template.innerHTML = raw;
      return String(template.content.textContent || raw).replace(/\s+/g, " ").trim();
    } catch (_error) {
      return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  function deadlineDetailText(row, deadlineIndex) {
    const cell = deadlineIndex >= 0 && row.children[deadlineIndex] ? row.children[deadlineIndex] : null;
    if (!cell) return "";

    const pieces = [];
    const attributes = ["data-content", "data-original-title", "title", "aria-label"];
    const candidates = [cell].concat(Array.from(cell.querySelectorAll("[data-content], [data-original-title], [title], [aria-label]")));

    candidates.forEach((element) => {
      attributes.forEach((attribute) => {
        const value = textFromHtmlSnippet(element.getAttribute(attribute));
        if (value) pieces.push(value);
      });
    });

    return pieces.join(" ").replace(/\s+/g, " ").trim();
  }

  function parseKnowledgeDate(text) {
    const value = normalizeText(text);
    const match = value.match(/ciencia\s+registrada\s+em\s+(\d{2}\/\d{2}\/\d{4}(?:\s*-\s*\d{2}:\d{2})?)/i);
    if (match) return parseDeadlineDate(match[1]);

    const fallback = value.match(/ciencia[^0-9]{0,50}(\d{2}\/\d{2}\/\d{4}(?:\s*-\s*\d{2}:\d{2})?)/i);
    return fallback ? parseDeadlineDate(fallback[1]) : null;
  }

  function receivedBaseDate(reportDate, receivedDays) {
    const days = Math.max(0, Number(receivedDays) || 0);
    return addDays(startOfDate(reportDate), -days);
  }

  function daysBetweenDates(fromDate, toDate) {
    const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
    const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 0, 0, 0, 0);
    return Math.ceil((to.getTime() - from.getTime()) / 86400000);
  }

  function formatDaysLabel(days) {
    const amount = Math.abs(days);
    const label = amount === 1 ? "dia" : "dias";
    if (days < 0) return "Vencido h\u00e1 " + amount + " " + label;
    if (days === 0) return "Hoje";
    return amount + " " + label;
  }

  function formatOverDaysLabel(days) {
    const amount = Math.max(0, days);
    return amount + " " + (amount === 1 ? "dia" : "dias");
  }

  function movementKind(type) {
    const value = normalizeKey(type);
    return value.indexOf("contrarra") >= 0 || value.indexOf("contra raz") >= 0 ? "contrarrazao" : "recurso";
  }

  function deadlineRuleKey(type) {
    const value = normalizeKey(type);

    if (value.indexOf("embarg") >= 0 && value.indexOf("declar") >= 0) return "embargos_de_declaracao";
    if (value.indexOf("inominad") >= 0) return "recurso_inominado";
    if (value.indexOf("apel") >= 0) return "apelacao";
    if (value.indexOf("agravo") >= 0 && value.indexOf("intern") >= 0) return "agravo_interno";
    if (value.indexOf("agravo") >= 0 && value.indexOf("instrument") >= 0) return "agravo_de_instrumento";
    if (value.indexOf("especial") >= 0) return "recurso_especial";
    if (value.indexOf("extraordin") >= 0) return "recurso_extraordinario";
    if (value.indexOf("contest") >= 0) return "contestacao";
    if (value.indexOf("manifest") >= 0) return "manifestacao";
    return "";
  }

  function internalDeadlineForType(type) {
    const kind = movementKind(type);
    const key = deadlineRuleKey(type);
    const rule = key ? INTERNAL_DEADLINE_LIMITS[key] : null;
    const ruleLimit = rule ? rule[kind] : null;
    const limit =
      Number.isFinite(ruleLimit) && ruleLimit > 0 ? ruleLimit : DEFAULT_INTERNAL_DEADLINE_BUSINESS_DAYS;

    return {
      key: key || "padrao",
      label: rule ? rule.label : "Padr\u00e3o",
      movementKind: kind,
      days: limit,
      isDefault: !rule || !(Number.isFinite(ruleLimit) && ruleLimit > 0)
    };
  }

  function resourcePriority(type) {
    const value = normalizeKey(type);
    const isCounter = value.indexOf("contrarra") >= 0 || value.indexOf("contra raz") >= 0;

    if (isCounter && value.indexOf("embarg") >= 0) {
      return { priority: 5, label: "Contrarrazões de Embargos" };
    }
    if (!isCounter && value.indexOf("embarg") >= 0 && value.indexOf("declar") >= 0) {
      return { priority: 1, label: "Embargos de Declaração" };
    }
    if (!isCounter && value.indexOf("inominad") >= 0) {
      return { priority: 2, label: "Recurso Inominado" };
    }
    if (!isCounter && (value.indexOf("especial") >= 0 || value.indexOf("extraordin") >= 0)) {
      return { priority: 2, label: "Recurso Especial/Extraordin\u00e1rio" };
    }
    if (!isCounter && value.indexOf("apel") >= 0) {
      return { priority: 3, label: "Recurso de Apelação" };
    }
    if (!isCounter && value.indexOf("agravo") >= 0 && value.indexOf("intern") >= 0) {
      return { priority: 4, label: "Agravo Interno" };
    }
    if (!isCounter && value.indexOf("agravo") >= 0 && value.indexOf("instrument") >= 0) {
      return { priority: 4, label: "Agravo de Instrumento" };
    }

    return null;
  }

  function classifyManifestation(type) {
    const priority = resourcePriority(type);
    const value = normalizeKey(type);

    if (priority) {
      return {
        group: "recursos",
        baseDays: DEFAULT_INTERNAL_DEADLINE_BUSINESS_DAYS,
        priority: priority.priority,
        priorityLabel: priority.label
      };
    }

    if (value.indexOf("contest") >= 0) {
      return {
        group: "contestacao",
        baseDays: DEFAULT_INTERNAL_DEADLINE_BUSINESS_DAYS,
        priority: null,
        priorityLabel: ""
      };
    }

    return {
      group: "demais",
      baseDays: DEFAULT_INTERNAL_DEADLINE_BUSINESS_DAYS,
      priority: null,
      priorityLabel: ""
    };
  }

  function buildRecord(row, columns, reportDate) {
    const procedureId = rowProcedureId(row);
    const rawType = cellText(row, columns.manifestationIndex) || "Sem manifestacao sugerida";
    const processNumber = cellText(row, columns.processIndex) || extractProcessNumber(rowSearchText(row));
    const rawReceivedText = cellText(row, columns.receivedIndex) || fallbackReceivedText(row) || "0 dia(s)";
    const rawDeadlineText = cellText(row, columns.deadlineIndex);
    const pjeDeadlineDate = parseDeadlineDate(rawDeadlineText);
    const pjeDeadlineStyle = deadlineStyle(row, columns.deadlineIndex);
    const deadlineDetails = deadlineDetailText(row, columns.deadlineIndex);
    const knowledgeDate = parseKnowledgeDate(deadlineDetails);
    const receivedText = formatReceivedText(rawReceivedText);
    const receivedDays = parseReceivedDays(rawReceivedText);
    const classification = classifyManifestation(rawType);
    const internalDeadline = internalDeadlineForType(rawType);
    const calculationBaseDate = knowledgeDate || receivedBaseDate(reportDate, receivedDays);
    const internalDueDate = addBusinessDays(calculationBaseDate, internalDeadline.days);
    const internalDaysRemaining = daysBetweenDates(reportDate, internalDueDate);

    return {
      procedureId,
      procedureUrl: procedurePageUrl(procedureId),
      externalDocumentsUrl: rowExternalDocumentsUrl(row),
      expedienteUrl: rowExpedienteUrl(row),
      type: rawType,
      processNumber: processNumber || "Processo nao identificado",
      knowledgeDate,
      knowledgeDateText: knowledgeDate ? formatDateTime(knowledgeDate) : "N\u00e3o localizada",
      pjeDeadlineDate,
      pjeDeadlineText: pjeDeadlineDate ? formatDateTime(pjeDeadlineDate) : "-",
      pjeDeadlineStyle,
      receivedText,
      receivedDays,
      internalDeadline,
      internalDeadlineText:
        internalDeadline.days + " " + (internalDeadline.days === 1 ? "dia \u00fatil" : "dias \u00fateis"),
      calculationBaseDate,
      calculationBaseSource: knowledgeDate ? "ci\u00eancia" : "recebido",
      internalDueDate,
      internalDueDateText: formatDate(internalDueDate),
      internalDaysRemaining,
      group: classification.group,
      baseDays: classification.baseDays,
      priority: classification.priority,
      priorityLabel: classification.priorityLabel
    };
  }

  function dateSortValue(date) {
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
  }

  function baseRecordCompare(a, b) {
    return (
      (a.priority || 999) - (b.priority || 999) ||
      normalizeKey(a.type).localeCompare(normalizeKey(b.type), "pt-BR") ||
      a.processNumber.localeCompare(b.processNumber, "pt-BR")
    );
  }

  function sortRecords(records, reportType, sortMode) {
    const mode = REPORT_SORTS[sortMode] ? sortMode : "pje";
    return records.slice().sort((a, b) => {
      if (mode === "interno") {
        return (
          dateSortValue(a.internalDueDate) - dateSortValue(b.internalDueDate) ||
          dateSortValue(a.pjeDeadlineDate) - dateSortValue(b.pjeDeadlineDate) ||
          b.receivedDays - a.receivedDays ||
          baseRecordCompare(a, b)
        );
      }

      if (mode === "recebido") {
        return (
          b.receivedDays - a.receivedDays ||
          dateSortValue(a.pjeDeadlineDate) - dateSortValue(b.pjeDeadlineDate) ||
          dateSortValue(a.internalDueDate) - dateSortValue(b.internalDueDate) ||
          baseRecordCompare(a, b)
        );
      }

      return (
        dateSortValue(a.pjeDeadlineDate) - dateSortValue(b.pjeDeadlineDate) ||
        dateSortValue(a.internalDueDate) - dateSortValue(b.internalDueDate) ||
        b.receivedDays - a.receivedDays ||
        baseRecordCompare(a, b)
      );
    });
  }

  function currentRows() {
    return Array.from(document.querySelectorAll("#procedures-box tbody tr.group-item"));
  }

  async function setDataTablePage(dt, pageNumber, timeoutMs) {
    dt.page(pageNumber).draw("page");
    await sleep(CONFIG.delayPageMs);
    await waitProcessingDone("pagina " + (pageNumber + 1), timeoutMs);
  }

  async function setDataTablePageLength(dt, length, timeoutMs) {
    if (dt.page.len() === length) return;
    dt.page.len(length).draw(false);
    await sleep(CONFIG.delayPageMs);
    await waitProcessingDone(length + " processos por pagina", timeoutMs);
  }

  async function collectAllRecords() {
    const dt = getDataTable();
    const columns = columnsForReport();
    const reportDate = startOfToday();
    const originalLength = dt.page.len();
    const originalInfo = dt.page.info();
    const originalPage = originalInfo && Number.isFinite(originalInfo.page) ? originalInfo.page : 0;
    const collected = [];
    const seen = new Set();

    try {
      await setDataTablePageLength(dt, CONFIG.pageLength);
      await setDataTablePage(dt, 0);

      let info = dt.page.info();
      const pages = Math.max(1, info && Number.isFinite(info.pages) ? info.pages : 1);

      for (let page = 0; page < pages; page += 1) {
        if (state.stopped) break;
        if (page > 0) await setDataTablePage(dt, page);
        setStatus("Lendo pagina " + (page + 1) + "/" + pages + "...");

        currentRows().forEach((row) => {
          const record = buildRecord(row, columns, reportDate);
          const key =
            record.processNumber && record.processNumber !== "Processo nao identificado"
              ? [record.processNumber, normalizeKey(record.type)].join("|")
              : record.procedureId || [record.processNumber, record.type, record.receivedText].join("|");
          if (seen.has(key)) return;
          seen.add(key);
          collected.push(record);
        });
      }
    } finally {
      try {
        await setDataTablePageLength(dt, originalLength, 30000);
        const restoredInfo = dt.page.info();
        const maxPage = Math.max(0, (restoredInfo.pages || 1) - 1);
        await setDataTablePage(dt, Math.min(originalPage, maxPage), 30000);
      } catch (error) {
        log("Nao foi possivel restaurar a paginacao original: " + error.message, "error");
      }
    }

    return {
      records: collected,
      reportDate
    };
  }

  function columnsForCorrectionFlow() {
    const assessorIndex = findColumnIndex(["Assessor(a)", "Assessor"]);
    const judgingBodyIndex = findColumnIndex(["Órgão julgador", "Orgao julgador", "Julgador"]);
    const activePoleIndex = findColumnIndex(["Polo ativo", "Polo Ativo"]);
    const receivedIndex = findColumnIndex(["received_at", "Recebido"]);
    const manifestationIndex = findColumnIndex([
      "Manifestação sugerida",
      "Manifestacao sugerida",
      "Manifestação Sugerida",
      "Manifestacao Sugerida",
      "Manisfestação sugerida",
      "Manisfestacao sugerida",
      "Manisfestação Sugerida",
      "Manisfestacao Sugerida"
    ]);
    const processIndex = findColumnIndex(["Número do Processo", "Numero do Processo", "Processo"]);

    return {
      assessorIndex,
      judgingBodyIndex,
      activePoleIndex,
      manifestationIndex,
      receivedIndex,
      processIndex,
      availableFilterKeys: Object.entries({
        assessors: assessorIndex,
        judgingBodies: judgingBodyIndex,
        manifestations: manifestationIndex,
        activePoles: activePoleIndex,
        receivedPeriods: receivedIndex
      }).filter(([, index]) => index >= 0).map(([key]) => key)
    };
  }

  function normalizeCorrectionReceivedPeriod(text) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    const normalized = normalizeKey(raw);
    if (!normalized) return "Sem recebido";
    if (
      normalized === "hoje" ||
      normalized.indexOf("hora") >= 0 ||
      normalized.indexOf("minuto") >= 0 ||
      normalized.indexOf("segundo") >= 0
    ) {
      return "Hoje";
    }
    return raw;
  }

  function buildCorrectionRecord(row, columns) {
    const procedureId = rowProcedureId(row);
    const processNumber = cellText(row, columns.processIndex) || extractProcessNumber(rowSearchText(row));
    const assessor = cellText(row, columns.assessorIndex);
    const judgingBody = cellText(row, columns.judgingBodyIndex);
    const activePole = cellText(row, columns.activePoleIndex);
    const manifestation = cellText(row, columns.manifestationIndex);
    const receivedText = cellText(row, columns.receivedIndex);

    return {
      procedureId,
      procedureUrl: procedurePageUrl(procedureId),
      processNumber: processNumber || "Processo nao identificado",
      assessor: assessor || "Sem assessor(a)",
      judgingBody: judgingBody || "Sem orgao julgador",
      activePole: activePole || "Sem polo ativo",
      manifestation: manifestation || "Sem manifestacao sugerida",
      receivedPeriod: normalizeCorrectionReceivedPeriod(receivedText)
    };
  }

  async function collectCorrectionRecords() {
    const dt = getDataTable();
    const columns = columnsForCorrectionFlow();
    state.correctionAvailableFilterKeys = columns.availableFilterKeys;
    Object.keys(CORRECTION_FILTER_DEFINITIONS).forEach((key) => {
      if (columns.availableFilterKeys.indexOf(key) >= 0) return;
      const definition = CORRECTION_FILTER_DEFINITIONS[key];
      state.correctionFilters[definition.stateKey] = [];
    });
    const originalLength = dt.page.len();
    const originalInfo = dt.page.info();
    const originalPage = originalInfo && Number.isFinite(originalInfo.page) ? originalInfo.page : 0;
    const collected = [];
    const seen = new Set();

    try {
      await setDataTablePageLength(dt, CONFIG.pageLength);
      await setDataTablePage(dt, 0);

      const info = dt.page.info();
      const pages = Math.max(1, info && Number.isFinite(info.pages) ? info.pages : 1);

      for (let page = 0; page < pages; page += 1) {
        if (state.stopped) break;
        if (page > 0) await setDataTablePage(dt, page);
        setStatus("Lendo fluxo " + (page + 1) + "/" + pages + "...");

        currentRows().forEach((row) => {
          const record = buildCorrectionRecord(row, columns);
          if (!record.procedureId || !record.procedureUrl) return;
          const key = record.procedureId || [
            record.processNumber,
            record.assessor,
            record.judgingBody,
            record.activePole,
            record.manifestation
          ].join("|");
          if (seen.has(key)) return;
          seen.add(key);
          collected.push(record);
        });
      }
    } finally {
      try {
        await setDataTablePageLength(dt, originalLength, 30000);
        const restoredInfo = dt.page.info();
        const maxPage = Math.max(0, (restoredInfo.pages || 1) - 1);
        await setDataTablePage(dt, Math.min(originalPage, maxPage), 30000);
      } catch (error) {
        log("Nao foi possivel restaurar a paginacao original: " + error.message, "error");
      }
    }

    state.correctionRecords = collected;
    return collected;
  }

  function uniqueSorted(values) {
    return Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => String(value || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }));
  }

  function selectionArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    const single = String(value || "").trim();
    return single ? [single] : [];
  }

  function selectionHas(values, value) {
    const selected = selectionArray(values);
    return !selected.length || selected.indexOf(value) >= 0;
  }

  function filteredCorrectionRecords() {
    const filters = state.correctionFilters || {};
    const available = new Set(state.correctionAvailableFilterKeys || []);
    const assessors = selectionArray(filters.assessors);
    const judgingBodies = selectionArray(filters.judgingBodies);
    const activePoles = selectionArray(filters.activePoles);
    const manifestations = selectionArray(filters.manifestations);
    const receivedPeriods = selectionArray(filters.receivedPeriods);
    return (state.correctionRecords || []).filter((record) => {
      if (available.has("assessors") && assessors.length && !selectionHas(assessors, record.assessor)) return false;
      if (available.has("judgingBodies") && judgingBodies.length && !selectionHas(judgingBodies, record.judgingBody)) return false;
      if (available.has("activePoles") && activePoles.length && !selectionHas(activePoles, record.activePole)) return false;
      if (available.has("manifestations") && manifestations.length && !selectionHas(manifestations, record.manifestation)) return false;
      if (available.has("receivedPeriods") && receivedPeriods.length && !selectionHas(receivedPeriods, record.receivedPeriod)) return false;
      return true;
    });
  }

  function selectedCorrectionFiltersReady() {
    return (state.correctionRecords || []).length > 0;
  }

  function selectedCorrectionFilterKeys() {
    const filters = state.correctionFilters || {};
    const available = new Set(state.correctionAvailableFilterKeys || []);
    return ["assessors", "judgingBodies", "activePoles", "manifestations", "receivedPeriods"].filter((key) =>
      available.has(key) && selectionArray(filters[key]).length > 0
    );
  }

  function normalizeCorrectionFilterOrder(value) {
    const parsed = String(value || "")
      .split(",")
      .map((key) => key.trim())
      .filter((key) => CORRECTION_FILTER_DEFINITIONS[key]);
    const order = [];
    parsed.concat(CORRECTION_FILTER_DEFAULT_ORDER).forEach((key) => {
      if (order.indexOf(key) < 0) order.push(key);
    });
    return order;
  }

  function readStoredCorrectionFilterOrder() {
    try {
      return normalizeCorrectionFilterOrder(window.localStorage.getItem(CORRECTION_FILTER_ORDER_KEY) || "");
    } catch (_error) {
      return CORRECTION_FILTER_DEFAULT_ORDER.slice();
    }
  }

  function storeCorrectionFilterOrder(order) {
    const normalized = normalizeCorrectionFilterOrder((Array.isArray(order) ? order : []).join(","));
    try {
      window.localStorage.setItem(CORRECTION_FILTER_ORDER_KEY, normalized.join(","));
    } catch (_error) {}
    return normalized;
  }

  function recordsMatchingCorrectionFilterKeys(records, keys) {
    const filters = state.correctionFilters || {};
    const available = new Set(state.correctionAvailableFilterKeys || []);
    return (Array.isArray(records) ? records : []).filter((record) =>
      (Array.isArray(keys) ? keys : []).every((key) => {
        const definition = CORRECTION_FILTER_DEFINITIONS[key];
        const selected = definition ? selectionArray(filters[definition.stateKey]) : [];
        return !available.has(key) || !selected.length || selected.indexOf(record[definition.recordKey]) >= 0;
      })
    );
  }

  function storeCorrectionOpenQueue(records) {
    const returnUrl = resolveSpaUrl(window.location.href) || resolveSpaUrl("/procedures");
    const items = (Array.isArray(records) ? records : [])
      .filter((record) => record && record.procedureId)
      .map((record) => ({
        procedureId: String(record.procedureId),
        processNumber: record.processNumber || "",
        procedureUrl: resolveSpaUrl(record.procedureUrl || procedurePageUrl(record.procedureId)),
        returnUrl: returnUrl
      }));

    window.localStorage.setItem(
      CORRECTION_OPEN_QUEUE_KEY,
      JSON.stringify({
        type: "abrir_minuta_correcao",
        createdAt: Date.now(),
        returnUrl: returnUrl,
        items
      })
    );
  }

  function readCorrectionOpenQueue() {
    let queue = null;
    try {
      queue = JSON.parse(window.localStorage.getItem(CORRECTION_OPEN_QUEUE_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(CORRECTION_OPEN_QUEUE_KEY);
      return null;
    }

    if (!queue || queue.type !== "abrir_minuta_correcao" || !Array.isArray(queue.items)) return null;
    if (Date.now() - (Number(queue.createdAt) || 0) > CORRECTION_OPEN_QUEUE_MAX_AGE_MS) {
      window.localStorage.removeItem(CORRECTION_OPEN_QUEUE_KEY);
      return null;
    }
    return queue;
  }

  function removeCorrectionOpenQueueItem(procedureId) {
    const queue = readCorrectionOpenQueue();
    if (!queue) return;
    queue.items = queue.items.filter((item) => String(item.procedureId) !== String(procedureId));
    if (!queue.items.length) {
      window.localStorage.removeItem(CORRECTION_OPEN_QUEUE_KEY);
      return;
    }
    queue.updatedAt = Date.now();
    window.localStorage.setItem(CORRECTION_OPEN_QUEUE_KEY, JSON.stringify(queue));
  }

  function currentCorrectionQueueItem() {
    const procedureId = currentProcedureIdFromPath();
    const queue = readCorrectionOpenQueue();
    if (!procedureId || !queue) return null;
    const item = queue.items.find((entry) => String(entry.procedureId) === String(procedureId)) || null;
    if (!item) return null;
    return Object.assign({}, item, { returnUrl: item.returnUrl || queue.returnUrl || "" });
  }

  function readCorrectionBackHistoryStore() {
    let store = null;
    try {
      store = JSON.parse(window.localStorage.getItem(CORRECTION_BACK_HISTORY_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(CORRECTION_BACK_HISTORY_KEY);
      return null;
    }

    if (!store || store.type !== "historico_correcao" || !store.items || typeof store.items !== "object") return null;
    if (Date.now() - (Number(store.createdAt) || 0) > CORRECTION_BACK_HISTORY_MAX_AGE_MS) {
      window.localStorage.removeItem(CORRECTION_BACK_HISTORY_KEY);
      return null;
    }
    return store;
  }

  function writeCorrectionBackHistoryStore(store) {
    if (!store || !store.items || !Object.keys(store.items).length) {
      window.localStorage.removeItem(CORRECTION_BACK_HISTORY_KEY);
      return;
    }
    store.updatedAt = Date.now();
    window.localStorage.setItem(CORRECTION_BACK_HISTORY_KEY, JSON.stringify(store));
  }

  function storeCorrectionBackHistoryRepair(item, procedureId, minuteUrl) {
    const cleanProcedureId = String(procedureId || "");
    const pendencyUrl = resolveSpaUrl((item && item.procedureUrl) || window.location.href);
    if (!cleanProcedureId || !pendencyUrl) return;

    const store =
      readCorrectionBackHistoryStore() || {
        type: "historico_correcao",
        createdAt: Date.now(),
        items: {}
      };

    store.items[cleanProcedureId] = {
      procedureId: cleanProcedureId,
      processNumber: (item && item.processNumber) || "",
      returnUrl: resolveSpaUrl((item && item.returnUrl) || ""),
      pendencyUrl: pendencyUrl,
      minuteUrl: resolveSpaUrl(minuteUrl || ""),
      createdAt: Date.now()
    };
    writeCorrectionBackHistoryStore(store);
  }

  function takeCorrectionBackHistoryRepair(procedureId) {
    const cleanProcedureId = String(procedureId || "");
    const store = readCorrectionBackHistoryStore();
    if (!cleanProcedureId || !store || !store.items) return null;

    const item = store.items[cleanProcedureId] || null;
    if (!item) return null;

    delete store.items[cleanProcedureId];
    writeCorrectionBackHistoryStore(store);
    return item;
  }

  function readCorrectionBackContext() {
    let context = null;
    try {
      context = JSON.parse(window.sessionStorage.getItem(CORRECTION_BACK_CONTEXT_KEY) || "null");
    } catch (_error) {
      window.sessionStorage.removeItem(CORRECTION_BACK_CONTEXT_KEY);
      return null;
    }

    if (!context || context.type !== "historico_correcao_aba" || !context.procedureId) return null;
    if (Date.now() - (Number(context.createdAt) || 0) > CORRECTION_BACK_HISTORY_MAX_AGE_MS) {
      window.sessionStorage.removeItem(CORRECTION_BACK_CONTEXT_KEY);
      return null;
    }
    return context;
  }

  function writeCorrectionBackContext(item) {
    const cleanProcedureId = String((item && item.procedureId) || "");
    const pendencyUrl = resolveSpaUrl((item && item.pendencyUrl) || (cleanProcedureId ? procedurePageUrl(cleanProcedureId) : ""));
    if (!cleanProcedureId || !pendencyUrl) return null;

    const context = {
      type: "historico_correcao_aba",
      procedureId: cleanProcedureId,
      processNumber: (item && item.processNumber) || "",
      returnUrl: resolveSpaUrl((item && item.returnUrl) || ""),
      pendencyUrl: pendencyUrl,
      minuteUrl: resolveSpaUrl((item && item.minuteUrl) || window.location.href),
      createdAt: Date.now()
    };

    try {
      window.sessionStorage.setItem(CORRECTION_BACK_CONTEXT_KEY, JSON.stringify(context));
    } catch (_error) {
      return null;
    }
    return context;
  }

  function filterRecords(records, reportType) {
    return records.filter((record) => record.group === reportType);
  }

  function summarize(records) {
    return { total: records.length };
  }

  function summarizeSections(sections) {
    return { total: sections.reduce((sum, section) => sum + section.records.length, 0) };
  }

  function decimalText(value, digits) {
    const number = Number(value) || 0;
    return number.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits == null ? 1 : digits
    });
  }

  function boxMetrics(records, reportDate) {
    const items = Array.isArray(records) ? records : [];
    const baseDate = reportDate || startOfToday();
    const total = items.length;
    let maxReceivedDays = 0;
    let sumReceivedDays = 0;
    let over20Days = 0;

    items.forEach((record) => {
      const days = Math.max(0, Number(record && record.receivedDays) || 0);
      maxReceivedDays = Math.max(maxReceivedDays, days);
      sumReceivedDays += days;
      if (days > 20) over20Days += 1;
    });

    const oldestBaseDate = total ? receivedBaseDate(baseDate, maxReceivedDays) : null;
    const averageReceivedDays = total ? sumReceivedDays / total : 0;

    return {
      total,
      oldestBaseDate,
      oldestBaseDateText: oldestBaseDate ? formatDate(oldestBaseDate) : "-",
      maxReceivedDays,
      over20Days,
      averageReceivedDays,
      averageReceivedDaysText: decimalText(averageReceivedDays, 1) + " dias"
    };
  }

  function boxMetricsLine(metrics) {
    const data = metrics || boxMetrics([], startOfToday());
    return (
      "Pend\u00eancia mais antiga: " +
      data.oldestBaseDateText +
      (data.total ? " (" + data.maxReceivedDays + " dias)" : "") +
      " | Processos h\u00e1 mais de 20 dias: " +
      data.over20Days +
      " | Tempo m\u00e9dio na caixa: " +
      data.averageReceivedDaysText
    );
  }

  function reportTitle(reportType) {
    return "Relatório de Controle de Prazos - " + REPORT_TYPES[reportType].label;
  }

  function boxTitle() {
    const titles = Array.from(document.querySelectorAll(".card-title"));
    const inboxTitle = titles.find((title) => /^Processos\s+de\s+/i.test(normalizeText(title.textContent || "")));
    if (inboxTitle) return normalizeText(inboxTitle.textContent || "");

    const scopedTitle = document.querySelector("[data-react-class='ProcedureInboxCards'] .card-title");
    if (scopedTitle) return normalizeText(scopedTitle.textContent || "");

    return "Caixa de Processos";
  }

  function currentInboxUserFromReactProps() {
    const root = document.querySelector("[data-react-class='ProcedureInboxCards'][data-react-props]");
    if (!root) return "";

    try {
      const props = JSON.parse(root.getAttribute("data-react-props") || "{}");
      const userId = props.userId;
      const users =
        props.currentUserData && Array.isArray(props.currentUserData.access_users)
          ? props.currentUserData.access_users
          : [];
      const selected = users.find((user) => String(user.id) === String(userId));
      return normalizeText(selected ? selected.name : "");
    } catch (_error) {
      return "";
    }
  }

  function reportOwner() {
    const title = boxTitle();
    const match = title.match(/^Processos\s+de\s+(.+)$/i);
    if (match) return match[1].trim();
    return currentInboxUserFromReactProps() || title;
  }

  function tableBody(records, reportType) {
    return records.map((record) => [
      record.type,
      record.processNumber,
      record.knowledgeDateText,
      record.receivedText,
      record.pjeDeadlineText,
      record.internalDueDateText
    ]);
  }

  function sectionColumns(sectionKey) {
    return REPORT_TYPES[sectionKey].columns;
  }

  function reportSections(records, reportType, sortMode) {
    const isUrgent = (record) => {
      return record.internalDueDate && record.internalDaysRemaining <= 0;
    };

    if (reportType === "todos") {
      return REPORT_CATEGORY_ORDER.map((key) => ({
        key,
        title: REPORT_TYPES[key].label,
        records: sortRecords(filterRecords(records, key).filter(isUrgent), key, sortMode)
      }));
    }

    const selected = filterRecords(records, reportType).filter(isUrgent);

    return [
      {
        key: reportType,
        title: REPORT_TYPES[reportType].label,
        records: sortRecords(selected, reportType, sortMode)
      }
    ];
  }

  function reportPayload(records, reportType, sortMode) {
    const sectionType = REPORT_TYPES[reportType] ? reportType : "todos";
    const orderMode = REPORT_SORTS[sortMode] ? sortMode : "pje";
    const sections = reportSections(records, sectionType, orderMode);
    const selectedRecords = sections.reduce((items, section) => items.concat(section.records), []);

    return {
      sections,
      records: selectedRecords,
      summary: summarizeSections(sections),
      reportType: sectionType,
      sortMode: orderMode
    };
  }

  function sortModeLabel(sortMode) {
    return REPORT_SORTS[sortMode] ? REPORT_SORTS[sortMode].label : REPORT_SORTS.pje.label;
  }

  function buildPdfMetadata(reportType, summary, sortMode, records, reportDate) {
    const generatedAt = new Date();
    const metrics = boxMetrics(records || [], reportDate || startOfToday());
    return {
      title: reportTitle(reportType),
      subtitle:
        "Responsável: " +
        reportOwner() +
        " | Gerado em " +
        formatDateTime(generatedAt) +
        " | Processos: " +
        summary.total +
        " | Ordenação: " +
        sortModeLabel(sortMode),
      metrics,
      metricsLine: boxMetricsLine(metrics)
    };
  }

  function metricExplanationItems() {
    return [
      {
        title: "Finalidade",
        text:
          "O relat\u00f3rio destaca processos que chegaram ao prazo interno institucional ou passaram dele, para organizar urg\u00eancias e prioridades de minuta."
      },
      {
        title: "Data da Ci\u00eancia",
        text:
          "Quando localizada no detalhe da coluna \"Prazo no SPA (PJE)\", a partir dos dados do PJE, a ci\u00eancia \u00e9 a base principal do c\u00e1lculo. Desse modo, a contagem do prazo come\u00e7a no dia seguinte da ci\u00eancia."
      },
      {
        title: "Sem Ci\u00eancia",
        text:
          "Quando a ci\u00eancia n\u00e3o \u00e9 localizada, a base \u00e9 estimada pela coluna \"Recebido\" (Data Atual - tempo que o processo est\u00e1 na caixa do assessor)."
      },
      {
        title: "Dias \u00fateis",
        text:
          "O prazo interno considera dias \u00fateis, ignorando s\u00e1bados, domingos e os feriados fixos: " +
          fixedHolidayDatesText() +
          "."
      },
      {
        title: "Confer\u00eancia",
        text:
          "O relat\u00f3rio \u00e9 um controle institucional de urg\u00eancia e n\u00e3o substitui a confer\u00eancia do prazo processual no SPA/PJE."
      }
    ];
  }

  function limitCellText(days) {
    if (!Number.isFinite(days) || days <= 0) return "-";
    return days + " " + (days === 1 ? "dia util" : "dias uteis");
  }

  function internalDeadlineTableRows() {
    return Object.keys(INTERNAL_DEADLINE_LIMITS).map((key) => {
      const rule = INTERNAL_DEADLINE_LIMITS[key];
      return [rule.label, limitCellText(rule.recurso), limitCellText(rule.contrarrazao)];
    });
  }

  function fixedHolidayDatesText() {
    return FIXED_HOLIDAYS.map((holiday) => pad2(holiday.day) + "/" + pad2(holiday.month)).join(", ");
  }

  function closeScreenReport() {
    const oldReport = document.querySelector("#spa-cdsp-deadline-report-modal");
    if (oldReport) oldReport.remove();

    if (state.reportEscapeHandler) {
      document.removeEventListener("keydown", state.reportEscapeHandler);
      state.reportEscapeHandler = null;
    }
  }

  function createScreenText(tagName, text, cssText) {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (cssText) element.style.cssText = cssText;
    return element;
  }

  function setImportantStyles(element, styles) {
    if (!element || !element.style || !styles) return;
    Object.keys(styles).forEach((property) => {
      element.style.setProperty(property, styles[property], "important");
    });
  }

  function enforceScreenReportTheme(root) {
    if (!root) return;

    setImportantStyles(root, {
      "color-scheme": "light",
      background: "#ffffff",
      color: "#1c2b39"
    });

    root.querySelectorAll("table").forEach((table) => {
      setImportantStyles(table, {
        background: "#ffffff",
        color: "#1c2b39",
        "border-collapse": "collapse"
      });

      table.querySelectorAll("thead th").forEach((cell) => {
        setImportantStyles(cell, {
          background: "#272f7e",
          "background-color": "#272f7e",
          color: "#ffffff",
          "border-color": "#d2dae8"
        });
      });

      table.querySelectorAll("tbody tr").forEach((row, rowIndex) => {
        const empty = !!row.querySelector("td[colspan]");
        const background = empty ? "#f7f9fc" : rowIndex % 2 ? "#ffffff" : "#f4f6fb";
        setImportantStyles(row, {
          background,
          "background-color": background,
          color: "#1c2b39"
        });

        Array.from(row.cells || []).forEach((cell) => {
          setImportantStyles(cell, {
            background,
            "background-color": background,
            color: "#1c2b39",
            "border-color": "#d2dae8"
          });
        });
      });
    });

    root.querySelectorAll("select").forEach((select) => {
      setImportantStyles(select, {
        "color-scheme": "light",
        background: "#ffffff",
        "background-color": "#ffffff",
        color: "#1c2b39",
        "border-color": "#c8d2e2"
      });
    });

    root.querySelectorAll("option").forEach((option) => {
      setImportantStyles(option, {
        background: "#ffffff",
        "background-color": "#ffffff",
        color: "#1c2b39"
      });
    });
  }

  function createScreenSelectControl(labelText, selectId, options, selectedValue, onChange) {
    const wrapper = document.createElement("label");
    wrapper.htmlFor = selectId;
    wrapper.style.cssText =
      "display:flex;align-items:center;gap:7px;margin:0;color:#192452;font-size:12px;font-weight:800;";

    const label = document.createElement("span");
    label.textContent = labelText;

    const select = document.createElement("select");
    select.id = selectId;
    select.style.cssText =
      "height:32px;border:1px solid #c8d2e2;border-radius:5px;padding:4px 8px;" +
      "background:#fff;color:#1c2b39;font-size:12px;min-width:190px;";

    options.forEach((optionData) => {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      if (optionData.value === selectedValue) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener("change", () => onChange(select.value));

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    return { wrapper, select };
  }

  function reportTypeOptions() {
    return ["todos"].concat(REPORT_CATEGORY_ORDER).map((key) => ({
      value: key,
      label: REPORT_TYPES[key].label
    }));
  }

  function sortModeOptions() {
    return Object.keys(REPORT_SORTS).map((key) => ({
      value: key,
      label: REPORT_SORTS[key].label
    }));
  }

  function createScreenReceivedLimitTable() {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "margin-top:12px;overflow:auto;border:1px solid #d2dae8;border-radius:6px;background:#fff;";

    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;table-layout:fixed;min-width:560px;";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Tipo", "Recurso (dias uteis)", "Contrarraz\u00e3o (dias uteis)"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      th.style.cssText =
        "border:1px solid #d2dae8;padding:8px 9px;text-align:center;background:#272f7e;" +
        "color:#fff;font-size:13px;font-weight:800;";
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    internalDeadlineTableRows().forEach((cells, rowIndex) => {
      const row = document.createElement("tr");
      row.style.cssText = rowIndex % 2 ? "background:#fff;" : "background:#f4f6fb;";

      cells.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        td.style.cssText =
          "border:1px solid #d2dae8;padding:8px 9px;text-align:center;vertical-align:middle;" +
          "font-size:13px;color:#1c2b39;";
        row.appendChild(td);
      });

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }

  function createScreenMetricExplanation() {
    const section = document.createElement("section");
    section.style.cssText =
      "margin:18px auto 0 auto;border:1px solid #d2dae8;border-radius:6px;background:#f8fafd;" +
      "padding:14px 16px;max-width:1120px;color:#1c2b39;";

    section.appendChild(
      createScreenText(
        "h3",
        "Explica\u00e7\u00e3o das M\u00e9tricas",
        "margin:0 0 10px 0;color:#192452;text-align:center;font-size:16px;line-height:1.25;"
      )
    );

    const items = metricExplanationItems();
    items.forEach((item) => {
      const row = document.createElement("div");
      row.style.cssText =
        "padding:7px 0;border-top:1px solid #e4e9f2;font-size:13px;line-height:1.4;color:#344252;";

      const title = createScreenText("span", "\u2794 " + item.title + "  ", "font-weight:800;color:#192452;");
      const text = createScreenText("span", item.text, "color:#344252;");

      row.appendChild(title);
      row.appendChild(text);
      section.appendChild(row);
    });

    section.appendChild(
      createScreenText(
        "h4",
        "Tabela de prazos internos",
        "margin:14px 0 8px 0;color:#192452;text-align:center;font-size:14px;line-height:1.25;"
      )
    );
    section.appendChild(createScreenReceivedLimitTable());
    section.appendChild(
      createScreenText(
        "div",
        "Tipos n\u00e3o listados na tabela, ou sem prazo para a combina\u00e7\u00e3o encontrada, usam " +
          DEFAULT_INTERNAL_DEADLINE_BUSINESS_DAYS +
          " dias \u00fateis.",
        "margin-top:8px;color:#5f6c7a;text-align:center;font-size:12px;font-style:italic;"
      )
    );

    return section;
  }

  function appendCenteredCell(row, text, cssText) {
    const cell = document.createElement("td");
    cell.textContent = text;
    cell.style.cssText =
      "border:1px solid #d2dae8;padding:8px 9px;text-align:center;vertical-align:middle;" +
      "font-size:13px;line-height:1.25;color:#1c2b39;overflow-wrap:anywhere;word-break:break-word;" +
      (cssText || "");
    row.appendChild(cell);
    return cell;
  }

  function openUrlInNewTab(url) {
    const href = resolveSpaUrl(url);
    if (!href) return false;

    try {
      const opened = window.open(href, "_blank");
      if (opened) {
        try {
          opened.blur();
        } catch (_error) {
          // Alguns navegadores bloqueiam controle de foco da aba aberta.
        }
        try {
          window.focus();
        } catch (_error) {
          // A aba atual pode nao aceitar foco programatico.
        }
        return true;
      }
    } catch (_error) {
      // Se window.open for bloqueado, tenta o clique em um link descartavel.
    }

    if (!document.body) return false;

    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;";
    document.body.appendChild(link);

    try {
      link.click();
      return true;
    } catch (_error) {
      return false;
    } finally {
      link.remove();
    }
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (!window.chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
        reject(new Error("API da extensao indisponivel nesta pagina."));
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message || "Falha na comunicacao com a extensao."));
          return;
        }
        resolve(response || {});
      });
    });
  }

  function activeTeamDatabase() {
    const database = window.SPA_CDSP_TEAM_DATABASE;
    return database && typeof database.loadActiveNames === "function" ? database : null;
  }

  function loadCorrectionActiveTeam() {
    if (state.activeTeamLoaded) return Promise.resolve(state.activeTeamNames);
    if (state.activeTeamLoading && state.activeTeamPromise) return state.activeTeamPromise;

    const database = activeTeamDatabase();
    if (!database) {
      state.activeTeamError = "Leitor da lista interna da equipe nao foi carregado.";
      return Promise.reject(new Error(state.activeTeamError));
    }

    state.activeTeamLoading = true;
    state.activeTeamPromise = database
      .loadActiveNames()
      .then((names) => {
        state.activeTeamNames = uniqueSorted(names);
        state.activeTeamLoaded = true;
        state.activeTeamError = "";
        log("Lista interna carregada com " + state.activeTeamNames.length + " assessor(es) ativo(s).", "ok");
        return state.activeTeamNames;
      })
      .catch((error) => {
        state.activeTeamNames = [];
        state.activeTeamLoaded = false;
        state.activeTeamError = error && error.message ? error.message : String(error);
        log("Lista interna da equipe nao carregou: " + state.activeTeamError, "error");
        throw error;
      })
      .finally(() => {
        state.activeTeamLoading = false;
        state.activeTeamPromise = null;
        refreshCorrectionFlowControls();
      });

    return state.activeTeamPromise;
  }

  function sendSimpleClosureBridgeMessage(type, payload) {
    return new Promise((resolve) => {
      const requestId = "simple-closure-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve({ ok: false, error: "A extensao nao respondeu a solicitacao de Simples Encerramento." });
      }, 30000);

      function onMessage(event) {
        if (event.source !== window || event.origin !== window.location.origin) return;
        const data = event.data || {};
        if (
          data.source !== SIMPLE_CLOSURE_BRIDGE_RESPONSE_SOURCE ||
          data.type !== "SPA_CDSP_OPEN_BACKGROUND_RESULT" ||
          data.requestId !== requestId
        ) {
          return;
        }
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve(data.error ? { ok: false, error: data.error } : data.response || { ok: false, error: "Sem resposta." });
      }

      window.addEventListener("message", onMessage);
      window.postMessage(
        {
          source: SIMPLE_CLOSURE_BRIDGE_SOURCE,
          type,
          requestId,
          payload: payload || null
        },
        window.location.origin
      );
    });
  }

  async function openUrlsInBackgroundTabs(urls, delayMs) {
    const normalizedUrls = (Array.isArray(urls) ? urls : []).map(resolveSpaUrl).filter(Boolean);
    if (!normalizedUrls.length) return 0;

    if (!window.chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
      let fallbackOpened = 0;
      normalizedUrls.forEach((url) => {
        if (openUrlInNewTab(url)) fallbackOpened += 1;
      });
      return fallbackOpened;
    }

    let opened = 0;
    const chunkSize = 80;
    for (let index = 0; index < normalizedUrls.length; index += chunkSize) {
      const chunk = normalizedUrls.slice(index, index + chunkSize);
      const response = await sendRuntimeMessage({
        type: "SPA_CDSP_OPEN_BACKGROUND_TABS",
        urls: chunk,
        delayMs: delayMs == null ? 250 : delayMs
      });
      opened += Number(response.opened) || 0;
      if (index + chunkSize < normalizedUrls.length) await sleep(350);
    }

    return opened;
  }

  function storePetitionAction(record) {
    const action = {
      type: "elaborar_peticao",
      phase: "abrir_pendencia",
      procedureId: record.procedureId,
      processNumber: record.processNumber,
      createdAt: Date.now()
    };
    window.localStorage.setItem(PETITION_ACTION_KEY, JSON.stringify(action));
  }

  function updatePetitionAction(action, phase) {
    if (!action) return;
    action.phase = phase || action.phase || "abrir_pendencia";
    action.updatedAt = Date.now();
    window.localStorage.setItem(PETITION_ACTION_KEY, JSON.stringify(action));
  }

  function startPetitionAction(record) {
    if (!record || !record.procedureId) {
      window.alert("Nao foi possivel identificar a pendencia deste processo no SPA.");
      return;
    }

    const externalDocumentsUrl = record.externalDocumentsUrl || "";
    const expedienteUrl = record.expedienteUrl || "";
    const pendencyUrl = record.procedureUrl || procedurePageUrl(record.procedureId);
    const failures = [];

    if (!isExternalDocumentsUrl(externalDocumentsUrl) || !openUrlInNewTab(externalDocumentsUrl)) {
      failures.push("Documentos Externos");
    }
    if (!expedienteUrl || !openUrlInNewTab(expedienteUrl)) failures.push("Expediente");

    if (failures.length) {
      log("Falha ao abrir: " + failures.join(", ") + " do processo " + record.processNumber + ".", "error");
      window.alert(
        "Alguma etapa nao abriu automaticamente para o processo " +
          record.processNumber +
          ".\n\nVerifique se o navegador bloqueou pop-ups ou se o expediente esta visivel na linha.\n\nEtapas: " +
          failures.join(", ")
      );
      return;
    }

    storePetitionAction(record);

    if (!openUrlInNewTab(pendencyUrl)) {
      window.localStorage.removeItem(PETITION_ACTION_KEY);
      log("Falha ao abrir a pendencia do processo " + record.processNumber + ".", "error");
      window.alert(
        "Nao foi possivel abrir a pendencia do processo " +
          record.processNumber +
          ".\n\nVerifique se o navegador bloqueou pop-ups para o SPA."
      );
      return;
    }

    log("Fluxo de elaboracao iniciado para o processo " + record.processNumber + ".", "ok");
  }

  function createActionButton(record) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Elaborar peti\u00e7\u00e3o";
    button.title = "Abrir documentos externos, expediente e elaborar peti\u00e7\u00e3o do processo " + record.processNumber;
    button.style.cssText =
      "border:1px solid #efb7b2;border-radius:5px;background:#f7d5d2;color:#7f1d1d;padding:7px 10px;" +
      "font-size:12px;font-weight:800;cursor:pointer;min-width:122px;";
    button.addEventListener("click", () => {
      startPetitionAction(record);
    });
    return button;
  }

  function closeFolderMenu() {
    const oldMenu = document.querySelector("#spa-cdsp-folder-menu-modal");
    if (oldMenu) oldMenu.remove();
  }

  function createFolderLinkButton(item) {
    const button = document.createElement("button");
    const manual = item.kind === "manual";
    button.type = "button";
    button.textContent = item.label;
    button.title = "Abrir material de auxilio: " + item.label;
    button.style.cssText =
      "border:1px solid " +
      (manual ? "#d7b56d" : "#b9cde7") +
      ";border-radius:6px;padding:10px 12px;min-height:40px;cursor:pointer;" +
      "font-size:13px;font-weight:800;line-height:1.2;text-align:center;" +
      "background:" +
      (manual ? "#fff3cf" : "#e8f2ff") +
      ";color:" +
      (manual ? "#6a4600" : "#163a68") +
      ";";
    button.addEventListener("click", () => {
      closeFolderMenu();
      if (!openUrlInNewTab(item.url)) {
        window.alert("Nao foi possivel abrir o material de auxilio '" + item.label + "'.");
      }
    });
    return button;
  }

  function openFolderMenu(record) {
    closeFolderMenu();

    const overlay = document.createElement("div");
    overlay.id = "spa-cdsp-folder-menu-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:1000002;background:rgba(10,14,20,.42);" +
      "display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;" +
      "font-family:Arial,sans-serif;";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "width:min(620px,calc(100vw - 28px));background:#fff;color:#1c2b39;border-radius:8px;" +
      "border:1px solid #d2dae8;box-shadow:0 18px 55px rgba(0,0,0,.35);overflow:hidden;";

    const header = document.createElement("div");
    header.style.cssText =
      "background:#272f7e;color:#fff;padding:13px 16px;display:flex;align-items:center;" +
      "justify-content:space-between;gap:12px;";

    const title = document.createElement("div");
    title.textContent = "Material de Aux\u00edlio";
    title.style.cssText = "font-size:16px;font-weight:900;line-height:1.2;";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Fechar";
    closeButton.style.cssText =
      "border:1px solid rgba(255,255,255,.42);border-radius:5px;background:#1e286a;color:#fff;" +
      "padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer;";
    closeButton.addEventListener("click", closeFolderMenu);

    header.appendChild(title);
    header.appendChild(closeButton);
    dialog.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = "padding:14px 16px 16px 16px;background:#f8fafd;";

    const subtitle = document.createElement("div");
    subtitle.textContent =
      "Selecione o material de aux\u00edlio do setor" +
      (record && record.processNumber ? " para apoio ao processo " + record.processNumber : "") +
      ".";
    subtitle.style.cssText = "margin:0 0 12px 0;color:#344252;font-size:13px;line-height:1.35;text-align:center;";
    body.appendChild(subtitle);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px;";
    SECTOR_FOLDER_LINKS.forEach((item) => {
      grid.appendChild(createFolderLinkButton(item));
    });
    body.appendChild(grid);

    dialog.appendChild(body);
    overlay.appendChild(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeFolderMenu();
    });
    document.body.appendChild(overlay);
  }

  function createFolderMenuButton(record) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Material de Aux\u00edlio";
    button.title = "Abrir materiais de aux\u00edlio";
    button.style.cssText =
      "border:1px solid #a9c9ef;border-radius:5px;background:#dceeff;color:#17466f;padding:7px 10px;" +
      "font-size:12px;font-weight:800;cursor:pointer;min-width:98px;";
    button.addEventListener("click", () => openFolderMenu(record));
    return button;
  }

  function appendActionCell(row, record) {
    const cell = document.createElement("td");
    cell.style.cssText =
      "border:1px solid #d2dae8;padding:8px 9px;text-align:center;vertical-align:middle;min-width:0;";
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;";
    wrapper.appendChild(createActionButton(record));
    wrapper.appendChild(createFolderMenuButton(record));
    cell.appendChild(wrapper);
    row.appendChild(cell);
  }

  function appendDeadlineScreenCell(row, record) {
    const style = record && record.pjeDeadlineStyle ? record.pjeDeadlineStyle : DEADLINE_STYLE_PRESETS.default;
    const cell = appendCenteredCell(row, "");
    const text = record && record.pjeDeadlineText ? record.pjeDeadlineText : "-";

    if (!style || style.kind === "default") {
      cell.textContent = text;
      return cell;
    }

    const badge = document.createElement("span");
    badge.textContent = text;
    badge.title = style.label ? "Prazo no SPA (PJE): " + style.label : "Prazo no SPA (PJE)";
    badge.style.cssText =
      "display:inline-block;box-sizing:border-box;max-width:100%;min-width:112px;padding:4px 8px;" +
      "border-radius:4px;font-size:12px;font-weight:400;line-height:1.2;text-align:center;" +
      "white-space:normal;overflow-wrap:anywhere;background:" +
      (style.screenBackground || DEADLINE_STYLE_PRESETS.none.screenBackground) +
      ";color:" +
      (style.screenText || DEADLINE_STYLE_PRESETS.none.screenText) +
      ";border:1px solid " +
      (style.screenBorder || DEADLINE_STYLE_PRESETS.none.screenBorder) +
      ";";
    cell.appendChild(badge);
    return cell;
  }

  function createScreenReportTable(records, reportType) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "width:100%;overflow-x:hidden;margin:0 auto 18px auto;border:1px solid #d2dae8;border-radius:6px;";

    const table = document.createElement("table");
    table.style.cssText =
      "width:100%;border-collapse:collapse;table-layout:fixed;margin:0 auto;background:#fff;";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const columns = sectionColumns(reportType).concat(["A\u00e7\u00f5es"]);

    columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column;
      th.style.cssText =
        "border:1px solid #d2dae8;padding:10px 9px;text-align:center;vertical-align:middle;" +
        "background:#272f7e;color:#fff;font-size:13px;font-weight:800;line-height:1.2;" +
        "overflow-wrap:anywhere;word-break:break-word;";
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    if (!records.length) {
      const emptyRow = document.createElement("tr");
      const emptyCell = appendCenteredCell(
        emptyRow,
        "Nenhum processo encontrado neste bloco.",
        "font-style:italic;color:#5f6c7a;background:#f7f9fc;"
      );
      emptyCell.colSpan = columns.length;
      tbody.appendChild(emptyRow);
    } else {
      const values = tableBody(records, reportType);
      records.forEach((record, rowIndex) => {
        const row = document.createElement("tr");
        row.style.cssText = rowIndex % 2 ? "background:#fff;" : "background:#f4f6fb;";

        values[rowIndex].forEach((value, columnIndex) => {
          if (columnIndex === 4) {
            appendDeadlineScreenCell(row, record);
            return;
          }

          appendCenteredCell(row, value);
        });

        appendActionCell(row, record);
        tbody.appendChild(row);
      });
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }

  function createScreenReportSection(section, showTitle) {
    const sectionElement = document.createElement("section");
    sectionElement.style.cssText = "margin-top:16px;";

    if (showTitle) {
      const title = createScreenText(
        "div",
        section.title + " (" + section.records.length + ")",
        "margin:0 auto 8px auto;padding:8px 12px;border:1px solid #d2dae8;" +
          "border-radius:6px;background:#ebeff9;color:#192452;text-align:center;" +
          "font-size:14px;font-weight:800;max-width:720px;"
      );
      sectionElement.appendChild(title);
    }

    sectionElement.appendChild(createScreenReportTable(section.records, section.key));
    return sectionElement;
  }

  function renderScreenReport(records, reportDate) {
    closeScreenReport();

    let currentReportType = "todos";
    let currentSortMode = "pje";
    let currentPayload = reportPayload(records, currentReportType, currentSortMode);
    let metadata = buildPdfMetadata(currentReportType, currentPayload.summary, currentSortMode, records, reportDate);

    const overlay = document.createElement("div");
    overlay.id = "spa-cdsp-deadline-report-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:rgba(10,14,20,.58);" +
      "display:flex;align-items:flex-start;justify-content:center;padding:18px 6px;" +
      "box-sizing:border-box;overflow:auto;font-family:Arial,sans-serif;";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "width:min(1760px,calc(100vw - 8px));background:#fff;color:#1c2b39;" +
      "border-radius:8px;border:1px solid #d2dae8;box-shadow:0 18px 55px rgba(0,0,0,.35);" +
      "padding:12px 12px 18px 12px;box-sizing:border-box;";

    const toolbar = document.createElement("div");
    toolbar.style.cssText =
      "display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;";

    const pdfButton = document.createElement("button");
    pdfButton.type = "button";
    pdfButton.textContent = "Imprimir / salvar PDF";
    pdfButton.style.cssText =
      "border:0;border-radius:5px;background:#26317d;color:#fff;padding:8px 12px;" +
      "font-size:12px;font-weight:800;cursor:pointer;";
    pdfButton.addEventListener("click", () => {
      if (!currentPayload.records.length) {
        window.alert("Nenhum processo encontrado para o filtro atual.");
        return;
      }

      setStatus("Abrindo impressão...");
      log("Use a opção Salvar como PDF na janela de impressão do Chrome.", "ok");
      window.print();
      setStatus("Impressão aberta");
    });

    const excelButton = document.createElement("button");
    excelButton.type = "button";
    excelButton.textContent = "Exportar Excel";
    excelButton.style.cssText =
      "border:0;border-radius:5px;background:#107c41;color:#fff;padding:8px 12px;" +
      "font-size:12px;font-weight:800;cursor:pointer;";
    excelButton.addEventListener("click", () => {
      if (!currentPayload.records.length) {
        window.alert("Nenhum processo encontrado para o filtro atual.");
        return;
      }

      setStatus("Gerando Excel...");
      generateExcel(records, currentReportType, reportDate, currentSortMode)
        .then(() => {
          setStatus("Excel gerado");
          log("Excel gerado com os filtros atuais do relat\u00f3rio.", "ok");
        })
        .catch((error) => {
          setStatus("Erro ao gerar");
          const message = error && error.message ? error.message : String(error);
          log(message, "error");
          window.alert("Nao foi possivel gerar o Excel: " + message);
        });
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Fechar";
    closeButton.style.cssText =
      "border:0;border-radius:5px;background:#425466;color:#fff;padding:8px 12px;" +
      "font-size:12px;font-weight:800;cursor:pointer;";
    closeButton.addEventListener("click", closeScreenReport);
    toolbar.appendChild(pdfButton);
    toolbar.appendChild(excelButton);
    toolbar.appendChild(closeButton);
    dialog.appendChild(toolbar);

    if (CONFIG.headerImageUrl) {
      const header = document.createElement("img");
      header.src = CONFIG.headerImageUrl;
      header.alt = "CDSP PGE-MT";
      header.style.cssText = "display:block;width:100%;height:auto;background:#272f7e;margin:0 auto 12px auto;";
      dialog.appendChild(header);
    }

    const title = createScreenText(
      "h2",
      metadata.title,
      "margin:0 0 6px 0;color:#00245b;text-align:center;font-size:22px;line-height:1.2;"
    );
    const subtitle = createScreenText(
      "div",
      metadata.subtitle,
      "margin:0 0 12px 0;color:#263544;text-align:center;font-size:13px;line-height:1.35;"
    );
    const metricsLine = createScreenText(
      "div",
      metadata.metricsLine || "",
      "margin:-6px 0 12px 0;color:#344252;text-align:center;font-size:12px;line-height:1.35;font-weight:700;"
    );
    dialog.appendChild(title);
    dialog.appendChild(subtitle);
    dialog.appendChild(metricsLine);

    const controls = document.createElement("div");
    controls.style.cssText =
      "display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;" +
      "margin:0 auto 14px auto;padding:10px;border:1px solid #d2dae8;border-radius:6px;background:#f8fafd;";

    const categoryControl = createScreenSelectControl(
      "Categoria",
      "spa-cdsp-report-category",
      reportTypeOptions(),
      currentReportType,
      (value) => {
        currentReportType = value;
        redrawReport();
      }
    );
    const sortControl = createScreenSelectControl(
      "Ordenar por",
      "spa-cdsp-report-sort",
      sortModeOptions(),
      currentSortMode,
      (value) => {
        currentSortMode = value;
        redrawReport();
      }
    );

    controls.appendChild(categoryControl.wrapper);
    controls.appendChild(sortControl.wrapper);
    dialog.appendChild(controls);

    const sectionsContainer = document.createElement("div");
    dialog.appendChild(sectionsContainer);

    function redrawReport() {
      currentPayload = reportPayload(records, currentReportType, currentSortMode);
      metadata = buildPdfMetadata(currentReportType, currentPayload.summary, currentSortMode, records, reportDate);
      title.textContent = metadata.title;
      subtitle.textContent = metadata.subtitle;
      metricsLine.textContent = metadata.metricsLine || "";
      pdfButton.disabled = !currentPayload.records.length;
      pdfButton.style.opacity = currentPayload.records.length ? "1" : ".55";
      pdfButton.style.cursor = currentPayload.records.length ? "pointer" : "not-allowed";
      excelButton.disabled = !currentPayload.records.length;
      excelButton.style.opacity = currentPayload.records.length ? "1" : ".55";
      excelButton.style.cursor = currentPayload.records.length ? "pointer" : "not-allowed";

      sectionsContainer.innerHTML = "";
      currentPayload.sections.forEach((section) => {
        sectionsContainer.appendChild(createScreenReportSection(section, currentPayload.sections.length > 1));
      });

      state.lastReport = {
        reportType: currentReportType,
        sortMode: currentSortMode,
        summary: currentPayload.summary,
        sections: currentPayload.sections,
        records
      };

      enforceScreenReportTheme(dialog);
    }

    redrawReport();
    dialog.appendChild(createScreenMetricExplanation());
    enforceScreenReportTheme(dialog);

    overlay.appendChild(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeScreenReport();
    });

    state.reportEscapeHandler = (event) => {
      if (event.key === "Escape") closeScreenReport();
    };
    document.addEventListener("keydown", state.reportEscapeHandler);

    document.body.appendChild(overlay);
    enforceScreenReportTheme(dialog);
  }

  function currentProcedureIdFromPath() {
    const match = String(window.location.pathname || "").match(/^\/procedures\/(\d+)(?:\/new_progress\/\d+)?\/?$/);
    return match ? match[1] : "";
  }

  function currentProgressStepIdFromPath() {
    const match = String(window.location.pathname || "").match(/^\/procedures\/\d+\/new_progress\/(\d+)\/?$/);
    return match ? match[1] : "";
  }

  function installCorrectionBackHistoryHandler() {
    if (window.SPA_CDSP_CORRECTION_BACK_HISTORY_HANDLER) return;
    window.SPA_CDSP_CORRECTION_BACK_HISTORY_HANDLER = true;

    window.addEventListener("popstate", (event) => {
      const state = event && event.state && typeof event.state === "object" ? event.state : {};
      const targetUrl = resolveSpaUrl(state.cdspCorrectionSyntheticUrl || "");
      if (!targetUrl) return;

      window.setTimeout(() => {
        try {
          window.location.replace(targetUrl);
        } catch (_error) {
          window.location.href = targetUrl;
        }
      }, 0);
    });
  }

  function correctionHistoryState(kind, procedureId, targetUrl, extra) {
    return Object.assign(
      {
        cdspCorrectionBackSeed: String(procedureId || ""),
        cdspCorrectionSyntheticKind: kind,
        cdspCorrectionSyntheticUrl: targetUrl,
        cdspCorrectionProcedureId: String(procedureId || "")
      },
      extra || {}
    );
  }

  function seedCorrectionBackHistory(item, procedureId, options) {
    const cleanProcedureId = String(procedureId || "");
    const currentUrl = resolveSpaUrl((options && options.currentUrl) || window.location.href);
    const pendencyUrl = resolveSpaUrl(
      (options && options.pendencyUrl) ||
        (item && item.pendencyUrl) ||
        (item && item.procedureUrl) ||
        procedurePageUrl(cleanProcedureId)
    );
    const returnUrl = resolveSpaUrl((options && options.returnUrl) || (item && item.returnUrl) || "");
    if (!cleanProcedureId || !currentUrl) return;

    try {
      installCorrectionBackHistoryHandler();
      const state = window.history && window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
      if (state && state.cdspCorrectionBackSeed === cleanProcedureId && state.cdspCorrectionCurrentUrl === currentUrl) {
        return;
      }

      if (returnUrl && returnUrl !== pendencyUrl && returnUrl !== currentUrl) {
        window.history.replaceState(
          Object.assign(
            {},
            state,
            correctionHistoryState("lista", cleanProcedureId, returnUrl, {
              cdspCorrectionNextUrl: pendencyUrl || currentUrl
            })
          ),
          "",
          returnUrl
        );
        if (pendencyUrl && pendencyUrl !== returnUrl) {
          window.history.pushState(
            correctionHistoryState("pendencia", cleanProcedureId, pendencyUrl, {
              cdspCorrectionReturnUrl: returnUrl,
              cdspCorrectionNextUrl: currentUrl
            }),
            "",
            pendencyUrl
          );
        }
        if (currentUrl !== pendencyUrl) {
          window.history.pushState(
            correctionHistoryState("minuta", cleanProcedureId, currentUrl, {
              cdspCorrectionReturnUrl: returnUrl,
              cdspCorrectionPendencyUrl: pendencyUrl,
              cdspCorrectionCurrentUrl: currentUrl
            }),
            "",
            currentUrl
          );
        }
        return;
      }

      if (pendencyUrl && pendencyUrl !== currentUrl) {
        window.history.replaceState(
          Object.assign(
            {},
            state,
            correctionHistoryState("pendencia", cleanProcedureId, pendencyUrl, {
              cdspCorrectionNextUrl: currentUrl
            })
          ),
          "",
          pendencyUrl
        );
        window.history.pushState(
          correctionHistoryState("minuta", cleanProcedureId, currentUrl, {
            cdspCorrectionPendencyUrl: pendencyUrl,
            cdspCorrectionCurrentUrl: currentUrl
          }),
          "",
          currentUrl
        );
        return;
      }

      if (returnUrl && returnUrl !== currentUrl) {
        window.history.replaceState(
          Object.assign(
            {},
            state,
            correctionHistoryState("lista", cleanProcedureId, returnUrl, {
              cdspCorrectionNextUrl: currentUrl
            })
          ),
          "",
          returnUrl
        );
        window.history.pushState(
          correctionHistoryState("pendencia", cleanProcedureId, currentUrl, {
            cdspCorrectionReturnUrl: returnUrl,
            cdspCorrectionCurrentUrl: currentUrl
          }),
          "",
          currentUrl
        );
      }
    } catch (_error) {
      // Se o SPA bloquear manipulacao do historico, o clique nativo ainda segue como rota principal.
    }
  }

  function repairCorrectionBackHistoryIfNeeded() {
    installCorrectionBackHistoryHandler();
    const procedureId = currentProcedureIdFromPath();
    if (!procedureId || !currentProgressStepIdFromPath()) return;

    const item = takeCorrectionBackHistoryRepair(procedureId);
    if (!item) return;

    const context = writeCorrectionBackContext(
      Object.assign({}, item, {
        procedureId: procedureId,
        pendencyUrl: item.pendencyUrl || procedurePageUrl(procedureId),
        minuteUrl: resolveSpaUrl(window.location.href)
      })
    );

    seedCorrectionBackHistory(context || item, procedureId, {
      returnUrl: item.returnUrl || "",
      pendencyUrl: item.pendencyUrl || procedurePageUrl(procedureId),
      currentUrl: resolveSpaUrl(window.location.href)
    });
    installCorrectionBackLinkRepair();
    log("Historico de retorno preparado para a minuta do processo " + (item.processNumber || procedureId) + ".", "ok");
  }

  function correctionBackContextForCurrentPage() {
    const procedureId = currentProcedureIdFromPath();
    if (!procedureId || !currentProgressStepIdFromPath()) return null;

    const sessionContext = readCorrectionBackContext();
    if (sessionContext && String(sessionContext.procedureId) === String(procedureId) && sessionContext.pendencyUrl) {
      return sessionContext;
    }

    const historyState = window.history && window.history.state && typeof window.history.state === "object"
      ? window.history.state
      : {};
    if (!historyState || String(historyState.cdspCorrectionBackSeed || "") !== String(procedureId)) return null;

    const pendencyUrl = resolveSpaUrl(
      historyState.cdspCorrectionPendencyUrl ||
        (historyState.cdspCorrectionSyntheticKind === "pendencia" ? historyState.cdspCorrectionSyntheticUrl : "") ||
        procedurePageUrl(procedureId)
    );
    if (!pendencyUrl) return null;

    return {
      type: "historico_correcao_aba",
      procedureId: String(procedureId),
      processNumber: "",
      returnUrl: resolveSpaUrl(historyState.cdspCorrectionReturnUrl || ""),
      pendencyUrl: pendencyUrl,
      minuteUrl: resolveSpaUrl(window.location.href),
      createdAt: Date.now()
    };
  }

  function isCorrectionNativeBackLink(element) {
    if (!element || !element.matches || !element.matches("a[href]")) return false;
    const text = candidateActionText(element);
    const hasBackIcon = hasClassName(element, "zmdi-arrow-left") || !!element.querySelector(".zmdi-arrow-left");
    const isActionButton = hasClassName(element, "actions__item") || hasClassName(element, "btn--icon");

    if (text.indexOf("voltar") >= 0) return true;
    return hasBackIcon && isActionButton;
  }

  function applyCorrectionBackLinkRepair() {
    const context = correctionBackContextForCurrentPage();
    if (!context) return false;

    const targetUrl = resolveSpaUrl(context.pendencyUrl || procedurePageUrl(context.procedureId));
    if (!targetUrl) return false;

    const links = Array.from(document.querySelectorAll("a[href]")).filter(isCorrectionNativeBackLink);
    links.forEach((link) => {
      if (link.href !== targetUrl) link.href = targetUrl;
      if (link.getAttribute("data-original-title") !== "Voltar para a pendencia do processo") {
        link.setAttribute("data-original-title", "Voltar para a pendencia do processo");
      }
      if (link.getAttribute("title") !== "Voltar para a pendencia do processo") {
        link.setAttribute("title", "Voltar para a pendencia do processo");
      }
      if (link.getAttribute("data-cdsp-correction-back-target") !== targetUrl) {
        link.setAttribute("data-cdsp-correction-back-target", targetUrl);
      }

      if (link.getAttribute("data-cdsp-correction-back-repaired") === "1") return;
      link.setAttribute("data-cdsp-correction-back-repaired", "1");
      link.addEventListener(
        "click",
        (event) => {
          const currentTarget = resolveSpaUrl(link.getAttribute("data-cdsp-correction-back-target") || targetUrl);
          if (!currentTarget) return;
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
          window.location.assign(currentTarget);
        },
        true
      );
    });

    return links.length > 0;
  }

  function installCorrectionBackLinkRepair() {
    if (!correctionBackContextForCurrentPage()) return;

    applyCorrectionBackLinkRepair();
    if (window.SPA_CDSP_CORRECTION_BACK_LINK_OBSERVER) return;

    const root = document.body || document.documentElement;
    if (!root || typeof MutationObserver !== "function") return;

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(() => {
        scheduled = false;
        if (!correctionBackContextForCurrentPage()) {
          observer.disconnect();
          window.SPA_CDSP_CORRECTION_BACK_LINK_OBSERVER = null;
          return;
        }
        applyCorrectionBackLinkRepair();
      }, 100);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "title", "data-original-title"]
    });
    window.SPA_CDSP_CORRECTION_BACK_LINK_OBSERVER = observer;
  }

  function pendingPetitionAction() {
    let action = null;

    try {
      action = JSON.parse(window.localStorage.getItem(PETITION_ACTION_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(PETITION_ACTION_KEY);
      return null;
    }

    if (!action || action.type !== "elaborar_peticao" || !action.procedureId) return null;

    if (Date.now() - Number(action.createdAt || 0) > PETITION_ACTION_MAX_AGE_MS) {
      window.localStorage.removeItem(PETITION_ACTION_KEY);
      return null;
    }

    return action;
  }

  function pendingAgravoAction() {
    let action = null;

    try {
      action = JSON.parse(window.localStorage.getItem(AGRAVO_ACTION_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(AGRAVO_ACTION_KEY);
      return null;
    }

    if (!action || action.type !== "cadastrar_agravo_instrumento" || !action.procedureId) return null;

    if (Date.now() - Number(action.createdAt || 0) > AGRAVO_ACTION_MAX_AGE_MS) {
      window.localStorage.removeItem(AGRAVO_ACTION_KEY);
      return null;
    }

    return action;
  }

  function storeCorrectionSendAction(source) {
    const procedureId = currentProcedureIdFromPath();
    if (!procedureId) return null;

    const action = {
      type: "enviar_minuta_procurador",
      source: source || "pendencia",
      procedureId,
      stepId: CORRECTION_SEND_STEP_ID,
      createdAt: Date.now()
    };
    window.localStorage.setItem(CORRECTION_SEND_ACTION_KEY, JSON.stringify(action));
    return action;
  }

  function pendingCorrectionSendAction() {
    let action = null;

    try {
      action = JSON.parse(window.localStorage.getItem(CORRECTION_SEND_ACTION_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(CORRECTION_SEND_ACTION_KEY);
      return null;
    }

    if (!action || action.type !== "enviar_minuta_procurador" || !action.procedureId) return null;

    if (Date.now() - Number(action.createdAt || 0) > CORRECTION_SEND_ACTION_MAX_AGE_MS) {
      window.localStorage.removeItem(CORRECTION_SEND_ACTION_KEY);
      return null;
    }

    return action;
  }

  function storeCorrectionStepAction(type, extra) {
    const procedureId = currentProcedureIdFromPath();
    if (!procedureId) return null;

    const action = Object.assign(
      {
        type,
        procedureId,
        createdAt: Date.now()
      },
      extra || {}
    );
    window.localStorage.setItem(CORRECTION_STEP_ACTION_KEY, JSON.stringify(action));
    return action;
  }

  function pendingCorrectionStepAction() {
    let action = null;

    try {
      action = JSON.parse(window.localStorage.getItem(CORRECTION_STEP_ACTION_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(CORRECTION_STEP_ACTION_KEY);
      return null;
    }

    if (!action || !action.type || !action.procedureId) return null;

    if (Date.now() - Number(action.createdAt || 0) > CORRECTION_STEP_ACTION_MAX_AGE_MS) {
      window.localStorage.removeItem(CORRECTION_STEP_ACTION_KEY);
      return null;
    }

    return action;
  }

  function clearAgravoAction() {
    window.localStorage.removeItem(AGRAVO_ACTION_KEY);
  }

  function procedureDetailValue(labelNames) {
    const wanted = (Array.isArray(labelNames) ? labelNames : [labelNames]).map(normalizeKey).filter(Boolean);
    if (!wanted.length) return "";

    const copyElements = Array.from(document.querySelectorAll(".copyElement"));
    for (const element of copyElements) {
      const label = normalizeKey(element.querySelector("b") ? element.querySelector("b").textContent : "");
      if (!wanted.some((name) => label === name || label.indexOf(name) >= 0)) continue;

      const valueElement = element.querySelector(".copyValue");
      const value =
        valueElement &&
        (valueElement.getAttribute("data-clip-board") ||
          valueElement.getAttribute("data-content") ||
          valueElement.getAttribute("data-full-text") ||
          valueElement.getAttribute("title") ||
          valueElement.textContent);
      if (value) return normalizeText(value);
    }

    const rows = Array.from(document.querySelectorAll(".row"));
    for (const row of rows) {
      if (!row.children || row.children.length < 2) continue;
      const label = normalizeKey(row.children[0].textContent || "");
      if (!wanted.some((name) => label === name || label.indexOf(name) >= 0)) continue;
      const value = row.children[1].getAttribute("data-full-text") || row.children[1].textContent;
      if (value) return normalizeText(value);
    }

    return "";
  }

  function agravoSectionFromProcedureData(data) {
    const processNumber = String(data && data.processNumber ? data.processNumber : "");
    const combined = normalizeKey(
      [
        data && data.classText,
        data && data.jurisdiction,
        data && data.tribunal
      ].join(" ")
    );

    if (isAgravoTrfProcess(processNumber)) {
      return agravoTrfSectionFromProcessNumber(processNumber);
    }

    if (combined.indexOf("juizado") >= 0 || combined.indexOf("turma recursal") >= 0) {
      return "Turma Recursal \u00danica";
    }

    if (
      combined.indexOf("procedimento comum") >= 0 ||
      combined.indexOf("comum civel") >= 0 ||
      combined.indexOf("tjmt") >= 0 ||
      combined.indexOf("2o grau") >= 0 ||
      combined.indexOf("tribunal de justica") >= 0 ||
      combined.indexOf("apelacao") >= 0
    ) {
      return "TJMT - 2\u00ba Grau";
    }

    return "";
  }

  function isAgravoTrfProcess(processNumber) {
    return String(processNumber || "").indexOf(".4.01.") >= 0;
  }

  function agravoTrfCourtCode(processNumber) {
    const match = String(processNumber || "").match(/\.4\.01\.(\d{4})$/);
    return match ? match[1] : "";
  }

  function agravoTrfSectionFromProcessNumber(processNumber) {
    return agravoTrfCourtCode(processNumber) === "9360"
      ? AGRAVO_TRF_RECURSAL_SECTION_LABEL
      : AGRAVO_TRF_COMMON_SECTION_LABEL;
  }

  function agravoFlowTypeFromProcessNumber(processNumber) {
    return isAgravoTrfProcess(processNumber) ? "trf" : "estadual";
  }

  function formatMoneyForSpa(value) {
    const text = String(value || "").replace(/\u00a0/g, " ").trim();
    const matches = text.match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g);
    return matches && matches.length ? matches[0] : text;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function plainTableRows(rows) {
    return rows
      .map((row) => row.label + "\t" + row.plainValue)
      .join("\n");
  }

  function agravoPassivePoleValue(value) {
    const text = normalizeText(value);
    if (!text) return "";
    if (/\be\s+outros\b/i.test(text)) return text;
    return text + " e Outros";
  }

  function agravoTableRows(data) {
    const prerogativesPlain = AGRAVO_PREROGATIVE_LINES.concat([AGRAVO_PREROGATIVE_BOLD_PLAIN]).join("\n");
    const prerogativesHtml =
      AGRAVO_PREROGATIVE_LINES.map(escapeHtml).join("<br>") +
      "<br>- " +
      escapeHtml(AGRAVO_PREROGATIVE_BOLD) +
      "";

    return [
      {
        label: "Ju\u00edzo Origin\u00e1rio",
        plainValue: data.judgingBody || "",
        htmlValue: escapeHtml(data.judgingBody || "")
      },
      {
        label: "Numera\u00e7\u00e3o Origin\u00e1ria",
        plainValue: data.processNumber || "",
        htmlValue: escapeHtml(data.processNumber || "")
      },
      {
        label: "Agravante (requerido)",
        plainValue: "ESTADO DE MATO GROSSO",
        htmlValue: "ESTADO DE MATO GROSSO"
      },
      {
        label: "Representa\u00e7\u00e3o Processual",
        plainValue: AGRAVO_REPRESENTATION_TEXT,
        htmlValue: escapeHtml(AGRAVO_REPRESENTATION_TEXT)
      },
      {
        label: "Prerrogativas",
        plainValue: prerogativesPlain,
        htmlValue: prerogativesHtml
      },
      {
        label: "Agravado",
        plainValue: agravoPassivePoleValue(data.activePole),
        htmlValue: escapeHtml(agravoPassivePoleValue(data.activePole))
      }
    ];
  }

  function buildAgravoClipboardHtml(data) {
    const rows = agravoTableRows(data);
    const format = AGRAVO_TABLE_FORMAT;
    const baseTextStyle =
      "font-family:" +
      format.fontFamily +
      ";font-size:" +
      format.fontSize +
      ";line-height:" +
      format.lineHeight +
      ";font-weight:" +
      format.fontWeight +
      ";text-align:" +
      format.textAlign +
      ";text-indent:" +
      format.textIndent +
      ";margin:0;padding:0;mso-line-height-rule:auto;mso-line-height-alt:" +
      format.lineHeightAlt +
      ";mso-para-margin:0cm;";
    const leftStyle =
      "border:" +
      format.border +
      ";background:#fff;color:#111;font-weight:" +
      format.fontWeight +
      ";padding:" +
      format.padding +
      ";vertical-align:top;width:" +
      format.leftColumnWidth +
      ";min-width:" +
      format.leftColumnWidth +
      ";max-width:" +
      format.leftColumnWidth +
      ";mso-width-source:userset;mso-width-alt:" +
      format.leftColumnWidthTwips +
      ";text-align:" +
      format.textAlign +
      ";text-indent:" +
      format.textIndent +
      ";margin:0;overflow-wrap:break-word;word-wrap:break-word;" +
      baseTextStyle;
    const rightStyle =
      "border:" +
      format.border +
      ";background:#fff;color:#111;font-weight:" +
      format.fontWeight +
      ";padding:" +
      format.padding +
      ";vertical-align:top;width:" +
      format.rightColumnWidth +
      ";min-width:" +
      format.rightColumnWidth +
      ";max-width:" +
      format.rightColumnWidth +
      ";mso-width-source:userset;mso-width-alt:" +
      format.rightColumnWidthTwips +
      ";text-align:" +
      format.textAlign +
      ";text-indent:" +
      format.textIndent +
      ";margin:0;overflow-wrap:break-word;word-wrap:break-word;" +
      baseTextStyle;
    const tableStyle =
      "border-collapse:collapse;table-layout:fixed;width:" +
      format.tableWidth +
      ";min-width:" +
      format.tableWidth +
      ";max-width:" +
      format.tableWidth +
      ";mso-table-lspace:0pt;mso-table-rspace:0pt;mso-padding-alt:0cm 0cm 0cm 0cm;font-family:" +
      format.fontFamily +
      ";font-size:" +
      format.fontSize +
      ";line-height:" +
      format.lineHeight +
      ";font-weight:" +
      format.fontWeight +
      ";text-align:" +
      format.textAlign +
      ";text-indent:" +
      format.textIndent +
      ";";
    const colgroup =
      '<colgroup><col style="width:' +
      format.leftColumnWidth +
      ";mso-width-source:userset;mso-width-alt:" +
      format.leftColumnWidthTwips +
      '"><col style="width:' +
      format.rightColumnWidth +
      ";mso-width-source:userset;mso-width-alt:" +
      format.rightColumnWidthTwips +
      '"></colgroup>';
    const wrapCell = (html) => '<div style="' + baseTextStyle + '">' + html + "</div>";

    return (
      '<table border="1" cellspacing="0" cellpadding="0" width="715" style="' +
      tableStyle +
      '">' +
      colgroup +
      rows
        .map(
          (row) =>
            "<tr><td style=\"" +
            leftStyle +
            "\">" +
            wrapCell(escapeHtml(row.label)) +
            "</td><td style=\"" +
            rightStyle +
            "\">" +
            wrapCell(row.htmlValue) +
            "</td></tr>"
        )
        .join("") +
      "</table>"
    );
  }

  function buildAgravoClipboardPlain(data) {
    return plainTableRows(agravoTableRows(data));
  }

  function fallbackCopyHtml(html) {
    if (!document.body) return false;

    const container = document.createElement("div");
    container.contentEditable = "true";
    container.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;";
    container.innerHTML = html;
    document.body.appendChild(container);

    const selection = window.getSelection && window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(container);

    try {
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return document.execCommand("copy");
    } catch (_error) {
      return false;
    } finally {
      if (selection) selection.removeAllRanges();
      container.remove();
    }
  }

  async function copyHtmlToClipboard(html, plain) {
    try {
      if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([String(html || "")], { type: "text/html" }),
            "text/plain": new Blob([String(plain || "")], { type: "text/plain" })
          })
        ]);
        return true;
      }
    } catch (_error) {
      // Alguns navegadores aceitam somente a copia por selecao do documento.
    }

    return fallbackCopyHtml(html);
  }

  function storeLastAgravoClipboard(data) {
    const payload = {
      type: "agravo_table",
      createdAt: Date.now(),
      procedureId: data && data.procedureId ? String(data.procedureId) : "",
      processNumber: data && data.processNumber ? String(data.processNumber) : "",
      html: buildAgravoClipboardHtml(data || {}),
      plain: buildAgravoClipboardPlain(data || {})
    };
    window.localStorage.setItem(AGRAVO_LAST_CLIPBOARD_KEY, JSON.stringify(payload));
    return payload;
  }

  function readLastAgravoClipboard() {
    let payload = null;
    try {
      payload = JSON.parse(window.localStorage.getItem(AGRAVO_LAST_CLIPBOARD_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(AGRAVO_LAST_CLIPBOARD_KEY);
      return null;
    }
    if (!payload || payload.type !== "agravo_table" || !payload.html) return null;
    return payload;
  }

  async function copyStoredAgravoTable() {
    const payload = readLastAgravoClipboard();
    if (!payload) {
      window.alert("Ainda nao ha tabela de agravo salva para copiar. Use primeiro o botao Cadastrar Agravo.");
      return false;
    }
    const copied = await copyHtmlToClipboard(payload.html, payload.plain || "");
    if (copied) {
      log(
        "Tabela do agravo copiada novamente" +
          (payload.processNumber ? " para o processo " + payload.processNumber : "") +
          ".",
        "ok"
      );
    } else {
      log("Nao foi possivel copiar novamente a tabela do agravo.", "error");
      window.alert("Nao consegui copiar a tabela do agravo. Confira se o navegador permitiu acesso ao clipboard.");
    }
    return copied;
  }

  async function copyAgravoTableToClipboard(data) {
    const payload = storeLastAgravoClipboard(data);
    return copyHtmlToClipboard(payload.html, payload.plain);
  }

  function simpleClosureComboKey(typeKey, pieceLabel) {
    return String(typeKey || "") + "|" + String(pieceLabel || "");
  }

  function simpleClosureModel(typeKey, pieceLabel) {
    return SIMPLE_CLOSURE_MODELS[simpleClosureComboKey(typeKey, pieceLabel)] || null;
  }

  function simpleClosurePieceOptions(typeKey) {
    const definition = SIMPLE_CLOSURE_TYPES[typeKey];
    return definition && Array.isArray(definition.pieces) ? definition.pieces.slice() : [];
  }

  function isValidBrazilianDate(value) {
    const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (year < 1900 || month < 1 || month > 12 || day < 1) return false;

    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function formatBrazilianDateInput(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
  }

  function formatSimpleClosureProcessNumber(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 20);
    if (digits.length <= 7) return digits;
    if (digits.length <= 9) return digits.slice(0, 7) + "-" + digits.slice(7);
    if (digits.length <= 13) return digits.slice(0, 7) + "-" + digits.slice(7, 9) + "." + digits.slice(9);
    if (digits.length <= 14) return digits.slice(0, 7) + "-" + digits.slice(7, 9) + "." + digits.slice(9, 13) + "." + digits.slice(13);
    if (digits.length <= 16) return digits.slice(0, 7) + "-" + digits.slice(7, 9) + "." + digits.slice(9, 13) + "." + digits.slice(13, 14) + "." + digits.slice(14);
    return digits.slice(0, 7) + "-" + digits.slice(7, 9) + "." + digits.slice(9, 13) + "." + digits.slice(13, 14) + "." + digits.slice(14, 16) + "." + digits.slice(16);
  }

  function isValidSimpleClosureProcessNumber(value) {
    return String(value || "").replace(/\D/g, "").length === 20;
  }

  function simpleClosureDateFromValue(value) {
    if (!isValidBrazilianDate(value)) return null;
    const parts = String(value).split("/").map(Number);
    return new Date(parts[2], parts[1] - 1, parts[0], 12, 0, 0, 0);
  }

  function formatSimpleClosureDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return String(date.getDate()).padStart(2, "0") + "/" + String(date.getMonth() + 1).padStart(2, "0") + "/" + date.getFullYear();
  }

  function simpleClosureEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day, 12, 0, 0, 0);
  }

  function simpleClosureHolidayKeys(year) {
    const fixed = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
    const easter = simpleClosureEasterDate(year);
    const dateKey = (date) => formatSimpleClosureDate(date);
    const keys = new Set();
    fixed.forEach((monthDay) => {
      const parts = monthDay.split("-");
      keys.add(parts[1] + "/" + parts[0] + "/" + year);
    });
    [-48, -47, -46, -2, 0, 60].forEach((offset) => {
      const date = new Date(easter);
      date.setDate(date.getDate() + offset);
      keys.add(dateKey(date));
    });
    const tjmt2026 = ["16/02/2026", "17/02/2026", "18/02/2026", "02/04/2026", "20/04/2026", "04/06/2026", "05/06/2026", "10/08/2026", "11/08/2026", "28/10/2026", "07/12/2026", "08/12/2026", "24/12/2026", "31/12/2026"];
    if (year === 2026) tjmt2026.forEach((date) => keys.add(date));
    return keys;
  }

  function calculateSimpleClosureDeadline(value, days, businessDays) {
    const date = simpleClosureDateFromValue(value);
    const total = Number(days);
    if (!date || !Number.isFinite(total) || total < 1) return "";
    let counted = 0;
    const result = new Date(date);
    while (counted < total) {
      result.setDate(result.getDate() + 1);
      if (businessDays) {
        const day = result.getDay();
        if (day === 0 || day === 6 || simpleClosureHolidayKeys(result.getFullYear()).has(formatSimpleClosureDate(result))) continue;
      }
      counted += 1;
    }
    return formatSimpleClosureDate(result);
  }

  function simpleClosureFieldIsComplete(field, values) {
    if (!field || (typeof field.when === "function" && !field.when(values))) return true;
    const value = String(values[field.key] || "").trim();
    if (!value) return false;
    if (field.type === "date") return isValidBrazilianDate(value);
    if (field.type === "cnj") return isValidSimpleClosureProcessNumber(value);
    return true;
  }

  function simpleClosureChoiceLabel(field, values) {
    if (!field || field.type !== "choice") return "";
    const option = (field.options || []).find((candidate) => candidate.value === values[field.key]);
    return option ? option.label : "";
  }

  function simpleClosureValuesForOutput(model, values, piece) {
    const output = Object.assign({}, values, { piece });
    (model && model.fields ? model.fields : []).forEach((field) => {
      if (field.type === "choice") output[field.key + "Label"] = simpleClosureChoiceLabel(field, values);
    });
    const courtField = (model && model.fields ? model.fields : []).find((field) => field.key === "court");
    const courtOption = courtField && (courtField.options || []).find((option) => option.value === values.court);
    if (courtOption) {
      output.deadline = calculateSimpleClosureDeadline(values.pgeDate, courtOption.days, courtOption.businessDays);
      output.deadlineDescription = String(courtOption.days) + " dias " + (courtOption.businessDays ? "\u00fateis" : "corridos");
    }
    if (!output.deadline && model && model.deadline) {
      output.deadline = calculateSimpleClosureDeadline(values.pgeDate, model.deadline.days, model.deadline.businessDays);
      output.deadlineDescription = String(model.deadline.days) + " dias " + (model.deadline.businessDays ? "\u00fateis" : "corridos");
    }
    const origin = values.origin;
    output.embargoHeading = origin === "decision" ? "Em Despacho / Liminar / Decis\u00e3o Monocr\u00e1tica eu verifiquei que:" : origin === "sentence" ? "Em Senten\u00e7a eu verifiquei que:" : "Em Ac\u00f3rd\u00e3o eu verifiquei que:";
    return output;
  }

  function interpolateSimpleClosureText(text, values) {
    let missingValue = false;
    const output = String(text || "")
      .replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_match, key) => {
        const value = String(values[key] || "").trim();
        if (!value) missingValue = true;
        return value;
      })
      .replace(/\s+\./g, ".")
      .replace(/\s{2,}/g, " ")
      .trim();
    return missingValue ? "" : output;
  }

  function buildSimpleClosureItems(data) {
    if (data && Array.isArray(data.items) && data.items.length) return data.items;
    const piece = data && data.piece ? data.piece : "";
    const protocolDate = data && data.protocolDate ? data.protocolDate : "";
    const protocolId = data && data.protocolId ? data.protocolId : "";
    return [
      { text: "A intima\u00e7\u00e3o que est\u00e1 comigo \u00e9 a seguinte: " + piece + ".", level: 0 },
      { text: "A contesta\u00e7\u00e3o do Estado foi protocolada em " + protocolDate + " sob Id. " + protocolId + ".", level: 0 },
      { text: "Considerando que est\u00e1 em Procedimento Comum ou Juizado, eu verifiquei que:", level: 0 },
      { text: "N\u00e3o houve deferimento de multa posterior ao protocolo da contesta\u00e7\u00e3o;", level: 1 },
      { text: "N\u00e3o houve movimenta\u00e7\u00e3o processual posterior \u00e0 contesta\u00e7\u00e3o que convenha ao Estado se manifestar, tais como: Emenda ou aditamento \u00e0 peti\u00e7\u00e3o inicial ou formula\u00e7\u00e3o de pedidos novos; Produ\u00e7\u00e3o de provas; Anu\u00eancia com extin\u00e7\u00e3o/desist\u00eancia etc.", level: 1 }
    ];
  }

  function simpleClosureParagraph(item) {
    const format = SIMPLE_CLOSURE_FORMAT;
    const level = Math.max(0, Number(item && item.level) || 0);
    const bullet = level > 0 ? (level > 1 ? "&#9702; " : "&bull; ") : "";
    const text = item && item.text ? item.text : "";
    return (
      '<p style="font-family:' +
      format.fontFamily +
      ";font-size:" +
      format.fontSize +
      ";line-height:" +
      format.lineHeight +
      ";text-indent:" +
      format.textIndent +
      ";margin:0 0 8pt " +
      (level ? String(level * 0.75) + "cm" : "0") +
      ';mso-line-height-rule:auto;white-space:pre-wrap;">' +
      bullet +
      escapeHtml(text) +
      "</p>"
    );
  }

  function buildSimpleClosureHtml(data) {
    const items = buildSimpleClosureItems(data);

    return (
      '<div style="font-family:' +
      SIMPLE_CLOSURE_FORMAT.fontFamily +
      ";font-size:" +
      SIMPLE_CLOSURE_FORMAT.fontSize +
      ";line-height:" +
      SIMPLE_CLOSURE_FORMAT.lineHeight +
      ';color:#111;background:#fff;">' +
      items.map(simpleClosureParagraph).join("") +
      "</div>"
    );
  }

  function buildSimpleClosurePlain(data) {
    return buildSimpleClosureItems(data)
      .map((item) => {
        const level = Math.max(0, Number(item && item.level) || 0);
        return (level > 0 ? "  ".repeat(level - 1) + (level > 1 ? "o " : "- ") : "") + String(item && item.text ? item.text : "");
      })
      .join("\n");
  }

  function storeLastSimpleClosureClipboard(data) {
    const payload = {
      type: "simple_closure_text",
      createdAt: Date.now(),
      closureType: data && data.closureType ? String(data.closureType) : "",
      piece: data && data.piece ? String(data.piece) : "",
      html: buildSimpleClosureHtml(data || {}),
      plain: buildSimpleClosurePlain(data || {})
    };
    window.localStorage.setItem(SIMPLE_CLOSURE_LAST_CLIPBOARD_KEY, JSON.stringify(payload));
    return payload;
  }

  function readLastSimpleClosureClipboard() {
    let payload = null;
    try {
      payload = JSON.parse(window.localStorage.getItem(SIMPLE_CLOSURE_LAST_CLIPBOARD_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(SIMPLE_CLOSURE_LAST_CLIPBOARD_KEY);
      return null;
    }
    if (!payload || payload.type !== "simple_closure_text" || !payload.html) return null;
    return payload;
  }

  async function copySimpleClosurePayload(payload) {
    if (!payload || !payload.html) return false;
    const copied = await copyHtmlToClipboard(payload.html, payload.plain || "");
    if (copied) log("Texto do Simples Encerramento copiado para a area de transferencia.", "ok");
    else log("Nao foi possivel copiar o texto do Simples Encerramento.", "error");
    return copied;
  }

  async function copyStoredSimpleClosureText() {
    const payload = readLastSimpleClosureClipboard();
    if (!payload) {
      window.alert("Ainda nao ha texto de Simples Encerramento salvo para copiar. Gere o texto primeiro.");
      return false;
    }
    const copied = await copySimpleClosurePayload(payload);
    if (!copied) window.alert("Nao consegui copiar o texto. Confira se o navegador permitiu acesso ao clipboard.");
    return copied;
  }

  function closeSimpleClosureModal() {
    const old = document.querySelector("#spa-cdsp-simple-closure-modal");
    if (old) old.remove();
  }

  function renderSimpleClosureModal(payload) {
    closeSimpleClosureModal();
    if (!document.body || !payload) return;

    const overlay = document.createElement("div");
    overlay.id = "spa-cdsp-simple-closure-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:rgba(8,13,20,.62);" +
      "display:flex;align-items:center;justify-content:center;padding:18px;";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "width:min(780px,96vw);max-height:88vh;overflow:auto;background:#fff;color:#111;border-radius:8px;" +
      "box-shadow:0 20px 60px rgba(0,0,0,.38);border:1px solid #d2dae8;";

    const toolbar = document.createElement("div");
    toolbar.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:8px;position:sticky;top:0;" +
      "background:#1f2d3a;color:#fff;padding:9px 10px;border-bottom:1px solid #d2dae8;";

    const title = document.createElement("div");
    title.textContent = "Simples Encerramento";
    title.style.cssText = "font-size:13px;font-weight:800;line-height:1.2;";

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:6px;align-items:center;";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copiar";
    copyButton.style.cssText =
      "border:0;border-radius:5px;background:#26317d;color:white;font-size:12px;font-weight:800;" +
      "padding:7px 10px;cursor:pointer;";
    copyButton.addEventListener("click", () => {
      copySimpleClosurePayload(payload).catch((error) => log(error.message || String(error), "error"));
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Fechar";
    closeButton.style.cssText =
      "border:0;border-radius:5px;background:#425466;color:white;font-size:12px;font-weight:800;" +
      "padding:7px 10px;cursor:pointer;";
    closeButton.addEventListener("click", closeSimpleClosureModal);

    const body = document.createElement("div");
    body.style.cssText = "padding:18px 22px;background:#fff;";
    body.innerHTML = payload.html;

    buttons.appendChild(copyButton);
    buttons.appendChild(closeButton);
    toolbar.appendChild(title);
    toolbar.appendChild(buttons);
    dialog.appendChild(toolbar);
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeSimpleClosureModal();
    });
    document.body.appendChild(overlay);
  }

  async function generateSimpleClosureText(data) {
    const payload = storeLastSimpleClosureClipboard(data);
    const copied = await copySimpleClosurePayload(payload);
    renderSimpleClosureModal(payload);
    if (!copied) {
      window.alert(
        "O texto foi gerado, mas nao consegui copiar automaticamente.\n\n" +
          "Use o botao Copiar na caixa aberta."
      );
    }
    return payload;
  }

  function collectAgravoProcedureData() {
    const data = {
      procedureId: currentProcedureIdFromPath(),
      processNumber: procedureDetailValue(["N\u00famero do Processo"]),
      classText: procedureDetailValue(["Classe"]),
      valueCause: procedureDetailValue(["Valor da Causa"]),
      jurisdiction: procedureDetailValue(["Jurisdi\u00e7\u00e3o"]),
      tribunal: procedureDetailValue(["Tribunal"]),
      judgingBody: procedureDetailValue(["\u00d3rg\u00e3o julgador", "Orgao julgador"]),
      activePole: procedureDetailValue(["Polo ativo"])
    };

    data.sectionLabel = agravoSectionFromProcedureData(data);
    data.flowType = agravoFlowTypeFromProcessNumber(data.processNumber);
    data.federalCourtCode = agravoTrfCourtCode(data.processNumber);
    return data;
  }

  function agravoStartLinkText(element) {
    return normalizeKey(
      [
        element && element.textContent,
        element && element.getAttribute("title"),
        element && element.getAttribute("data-original-title"),
        element && element.getAttribute("aria-label")
      ].join(" ")
    );
  }

  function findCadastrarAgravoInstrumentoLink(flowType, procedureId) {
    const isTrf = flowType === "trf";
    const stepId = isTrf ? "2934" : "748";
    const currentLabel = isTrf ? "distribuicao em 2o grau trf" : "distribuicao em 2o grau tj";

    return Array.from(document.querySelectorAll("a[href*='/procedures/start_procedure/']")).find((element) => {
      const href = elementUrl(element);
      if (!href) return false;

      const url = new URL(href);
      if (url.origin !== window.location.origin || url.pathname !== "/procedures/start_procedure/" + stepId) return false;
      if (url.searchParams.get("main_procedure_id") !== procedureId) return false;

      const label = agravoStartLinkText(element);
      return label.includes(currentLabel) ||
        (label.includes("cadastrar agravo de instrumento") && (isTrf ? label.includes("trf") : !label.includes("trf")));
    }) || null;
  }

  function hasStartSubprocessMenu() {
    return Array.from(document.querySelectorAll("[title], [data-original-title], [aria-label]")).some((element) => {
      const text = normalizeKey(
        [
          element.getAttribute("title"),
          element.getAttribute("data-original-title"),
          element.getAttribute("aria-label"),
          element.textContent
        ].join(" ")
      );
      return text.indexOf("iniciar subprocessos") >= 0;
    });
  }

  async function startAgravoInstrumentoRegistration() {
    const data = collectAgravoProcedureData();
    if (!data.procedureId) {
      window.alert("Nao foi possivel identificar a pendencia atual no SPA.");
      return;
    }

    const link = findCadastrarAgravoInstrumentoLink(data.flowType, data.procedureId);
    const href = elementUrl(link);
    if (!href || !hasStartSubprocessMenu()) {
      window.alert(
        data.flowType === "trf"
          ? "Nao encontrei o item Distribuicao em 2o Grau TRF no menu Iniciar subprocessos desta pendencia."
          : "Nao encontrei o item Distribuicao em 2o Grau TJ no menu Iniciar subprocessos desta pendencia."
      );
      return;
    }

    const clipboardCopied = await copyAgravoTableToClipboard(data);
    if (clipboardCopied) {
      log("Tabela de dados do agravo copiada para a area de transferencia.", "ok");
    } else {
      log("Nao foi possivel copiar automaticamente a tabela do agravo.", "error");
      window.alert(
        "Nao consegui copiar automaticamente a tabela de dados do agravo para a area de transferencia.\n\n" +
          "O cadastro sera aberto normalmente, mas confira se o navegador permitiu acesso ao clipboard."
      );
    }

    window.localStorage.setItem(
      AGRAVO_ACTION_KEY,
      JSON.stringify({
        type: "cadastrar_agravo_instrumento",
        createdAt: Date.now(),
        procedureId: data.procedureId,
        processNumber: data.processNumber,
        classText: data.classText,
        valueCause: formatMoneyForSpa(data.valueCause),
        jurisdiction: data.jurisdiction,
        tribunal: data.tribunal,
        judgingBody: data.judgingBody,
        activePole: data.activePole,
        sectionLabel: data.sectionLabel,
        flowType: data.flowType,
        federalCourtCode: data.federalCourtCode
      })
    );

    setStatus("Abrindo cadastro de agravo...");
    log(
      "Abrindo " +
        (data.flowType === "trf" ? "Distribuicao em 2o Grau TRF" : "Distribuicao em 2o Grau TJ") +
        " para o processo " +
        (data.processNumber || data.procedureId) +
        ".",
      "ok"
    );
    window.location.assign(href);
  }

  function removerAgravoInstrumentoButtonSolto() {
    const existing = document.querySelector("#" + AGRAVO_BUTTON_ID);
    if (existing) existing.remove();
  }

  function candidateActionText(element) {
    return normalizeKey(
      [
        element.getAttribute("data-title"),
        element.getAttribute("data-original-title"),
        element.getAttribute("title"),
        element.getAttribute("aria-label"),
        element.textContent
      ].join(" ")
    );
  }

  function hasClassName(element, className) {
    const value = String(element.className || element.getAttribute("class") || "");
    return (" " + value + " ").indexOf(" " + className + " ") >= 0;
  }

  function isMainPetitionProgressLink(element, procedureId) {
    const href = elementUrl(element);
    const text = candidateActionText(element);

    if (!href || href.indexOf("/procedures/" + procedureId + "/new_progress/") < 0) return false;
    if (text.indexOf("elaborar") < 0 || text.indexOf("peti") < 0) return false;
    if (text.indexOf("avulsa") >= 0 || text.indexOf("minuta") >= 0 || text.indexOf("oficio") >= 0) return false;
    return true;
  }

  function findPetitionProgressLink(procedureId) {
    const candidates = Array.from(document.querySelectorAll("a[href*='/new_progress/']")).filter((element) =>
      isMainPetitionProgressLink(element, procedureId)
    );

    return (
      candidates.find((element) => /^ordered-step-new-/i.test(String(element.id || ""))) ||
      candidates.find((element) => hasClassName(element, "btn-primary")) ||
      candidates[0] ||
      null
    );
  }

  async function waitForPetitionProgressLink(procedureId) {
    const started = Date.now();
    while (Date.now() - started < 15000) {
      const link = findPetitionProgressLink(procedureId);
      if (link) return link;
      await sleep(300);
    }
    return null;
  }

  function isViewEditMinuteLink(element, procedureId) {
    const href = elementUrl(element);
    const text = candidateActionText(element);

    if (!href || href.indexOf("/procedures/" + procedureId + "/new_progress/") < 0) return false;
    if (href.indexOf("edited_progress_id=") < 0) return false;
    return text.indexOf("visualizar") >= 0 && text.indexOf("editar") >= 0 && text.indexOf("minuta") >= 0;
  }

  function findViewEditMinuteLink(procedureId) {
    const candidates = Array.from(document.querySelectorAll("a[href*='/new_progress/']")).filter((element) =>
      isViewEditMinuteLink(element, procedureId)
    );
    return sortElementsByScreenPosition(candidates)[0] || null;
  }

  async function waitForViewEditMinuteLink(procedureId) {
    const started = Date.now();
    while (Date.now() - started < 30000) {
      const link = findViewEditMinuteLink(procedureId);
      if (link) return link;
      await sleep(300);
    }
    return null;
  }

  function isCurrentCorrectionMinuteUrl(href) {
    const targetUrl = resolveSpaUrl(href);
    if (!targetUrl) return false;

    try {
      const current = new URL(window.location.href);
      const target = new URL(targetUrl);
      if (current.pathname !== target.pathname || !currentProgressStepIdFromPath()) return false;

      const targetProgressId = target.searchParams.get("edited_progress_id");
      const currentProgressId = current.searchParams.get("edited_progress_id");
      return !targetProgressId || !currentProgressId || targetProgressId === currentProgressId;
    } catch (_error) {
      return false;
    }
  }

  function isSendToProcuradorControl(element, procedureId) {
    const href = elementUrl(element);
    const text = candidateActionText(element);
    const dataStep = String(element.getAttribute("data-step") || "");
    const isStepLink = href && href.indexOf("/procedures/" + procedureId + "/new_progress/" + CORRECTION_SEND_STEP_ID) >= 0;
    const isRedirectStep = dataStep === CORRECTION_SEND_STEP_ID;

    if (!isStepLink && !isRedirectStep) return false;
    return text.indexOf("enviar") >= 0 && text.indexOf("minuta") >= 0 && text.indexOf("procurador") >= 0;
  }

  function findSendToProcuradorControl(procedureId, source) {
    const elements = Array.from(
      document.querySelectorAll("a[href], button, input[type='button'], input[type='submit'], [data-step]")
    ).filter((element) => isSendToProcuradorControl(element, procedureId));

    if (!elements.length) return null;

    const visible = elements.filter(isElementVisible);
    const candidates = source === "minuta" && visible.length ? visible : elements;
    return (
      candidates.find((element) => String(element.getAttribute("data-step") || "") === CORRECTION_SEND_STEP_ID) ||
      candidates.find((element) => elementUrl(element).indexOf("/new_progress/" + CORRECTION_SEND_STEP_ID) >= 0) ||
      candidates[0] ||
      null
    );
  }

  function normalizeCorrectionActionSource(source) {
    return source === "minuta" ? "minuta" : "pendencia";
  }

  function correctionActionSourceLabel(source) {
    return normalizeCorrectionActionSource(source) === "minuta" ? "tela da minuta" : "tela da pendencia";
  }

  function defaultCorrectionActionSource() {
    return currentProgressStepIdFromPath() ? "minuta" : "pendencia";
  }

  function currentCorrectionActionContext(source, targetStepId, actionLabel) {
    const procedureId = currentProcedureIdFromPath();
    const normalizedSource = normalizeCorrectionActionSource(source);
    const stepId = currentProgressStepIdFromPath();
    const target = String(targetStepId || "");

    if (!procedureId) {
      window.alert("Abra uma pendencia ou minuta do processo para usar este atalho.");
      return null;
    }

    if (stepId && target && String(stepId) === target) {
      return {
        procedureId,
        source: normalizedSource,
        stepId,
        alreadyOnStep: true
      };
    }

    if (normalizedSource === "pendencia" && stepId) {
      window.alert(
        "O modo 'Tela da pendencia' deve ser usado na tela da pendencia do processo.\n\n" +
          "Para executar pela tela atual, marque 'Tela da Minuta' em " +
          actionLabel +
          "."
      );
      return null;
    }

    if (normalizedSource === "minuta" && !stepId) {
      window.alert(
        "O modo 'Tela da Minuta' deve ser usado na tela da minuta.\n\n" +
          "Para executar pela tela atual, marque 'Tela da pendencia' em " +
          actionLabel +
          "."
      );
      return null;
    }

    return {
      procedureId,
      source: normalizedSource,
      stepId,
      alreadyOnStep: false
    };
  }

  function openCorrectionStepControl(control, stepId, source) {
    const href = elementUrl(control);
    const dataStep = String(control && control.getAttribute ? control.getAttribute("data-step") || "" : "");

    if (normalizeCorrectionActionSource(source) === "minuta" && dataStep === String(stepId || "")) {
      clickElement(control);
      return;
    }

    if (href) window.location.assign(href);
    else clickElement(control);
  }

  function isCorrectionStepControl(element, procedureId, stepId, textTerms) {
    const href = elementUrl(element);
    const text = candidateActionText(element);
    const dataStep = String(element.getAttribute("data-step") || "");
    const isStepLink = href && href.indexOf("/procedures/" + procedureId + "/new_progress/" + stepId) >= 0;
    const isRedirectStep = dataStep === String(stepId);

    if (!isStepLink && !isRedirectStep) return false;
    return (Array.isArray(textTerms) ? textTerms : []).every((term) => text.indexOf(normalizeKey(term)) >= 0);
  }

  function findCorrectionStepControl(procedureId, stepId, textTerms, source) {
    const elements = Array.from(
      document.querySelectorAll("a[href], button, input[type='button'], input[type='submit'], [data-step]")
    ).filter((element) => isCorrectionStepControl(element, procedureId, stepId, textTerms));

    if (!elements.length) return null;

    const visible = elements.filter(isElementVisible);
    const candidates = normalizeCorrectionActionSource(source) === "minuta" && visible.length ? visible : elements;
    return (
      candidates.find((element) => String(element.getAttribute("data-step") || "") === String(stepId)) ||
      candidates.find((element) => elementUrl(element).indexOf("/new_progress/" + stepId) >= 0) ||
      candidates[0] ||
      null
    );
  }

  function findProgressSaveButton() {
    return (
      document.querySelector("#btn-progress-save") ||
      Array.from(document.querySelectorAll("input[type='submit'], button[type='submit'], button, input[type='button']")).find(
        (element) => normalizeKey(element.value || element.textContent || element.getAttribute("aria-label") || "").indexOf("salvar") >= 0
      ) ||
      null
    );
  }

  async function refreshCorrectionFlowRecords() {
    if (state.running) return state.correctionRecords || [];

    state.running = true;
    state.stopped = false;
    setStatus("Lendo correção...");
    log("Lendo a caixa inteira para montar os filtros do Fluxo de Correção.");

    try {
      const records = await collectCorrectionRecords();
      refreshCorrectionFlowControls();
      setStatus("Filtros prontos");
      log("Fluxo de Correção atualizado com " + records.length + " processo(s).", "ok");
      return records;
    } catch (error) {
      state.correctionRecords = [];
      refreshCorrectionFlowControls();
      setStatus("Erro nos filtros");
      log(error && error.message ? error.message : String(error), "error");
      window.alert("Nao foi possivel montar os filtros do Fluxo de Correcao: " + (error.message || String(error)));
      return [];
    } finally {
      state.running = false;
    }
  }

  async function startCorrectionOpenFlow() {
    if (!state.correctionRecords.length) {
      await refreshCorrectionFlowRecords();
    }

    if (!selectedCorrectionFiltersReady()) {
      refreshCorrectionFlowControls();
      window.alert("Atualize os filtros antes de abrir as minutas.");
      return;
    }

    const records = filteredCorrectionRecords();
    if (!records.length) {
      window.alert("Nenhum processo encontrado para os filtros selecionados.");
      return;
    }

    if (!selectedCorrectionFilterKeys().length) {
      const confirmed = window.confirm(
        "Nenhum filtro foi selecionado. Deseja abrir todas as " + records.length + " minuta(s) lida(s)?"
      );
      if (!confirmed) return;
    }

    storeCorrectionOpenQueue(records);
    setStatus("Abrindo minutas...");
    log("Abrindo " + records.length + " pendencia(s) e acionando Visualizar e editar minuta.", "ok");

    const opened = await openUrlsInBackgroundTabs(
      records.map((record) => record.procedureUrl),
      250
    );

    if (!opened) {
      window.alert("Nao foi possivel abrir as abas. Verifique o bloqueio de pop-ups do navegador.");
    } else {
      setStatus(opened + " aba(s) abertas");
    }
  }

  async function startSendToProcurador(source) {
    const context = currentCorrectionActionContext(source, CORRECTION_SEND_STEP_ID, "Enviar ao procurador");
    if (!context) return;

    if (context.alreadyOnStep) {
      storeCorrectionSendAction(context.source);
      await continuePendingCorrectionSendAction();
      return;
    }

    setStatus("Procurando envio...");
    const control = await waitForValue(
      () => findSendToProcuradorControl(context.procedureId, context.source),
      10000,
      300
    );
    if (!control) {
      window.alert(
        "Nao encontrei a opcao 'Enviar minuta ao procurador(a)' na " +
          correctionActionSourceLabel(context.source) +
          "."
      );
      setStatus("Envio nao encontrado");
      return;
    }

    storeCorrectionSendAction(context.source);
    setStatus("Abrindo envio...");
    log(
      "Acionando Enviar minuta ao procurador(a) pela " +
        correctionActionSourceLabel(context.source) +
        " " +
        context.procedureId +
        ".",
      "ok"
    );

    openCorrectionStepControl(control, CORRECTION_SEND_STEP_ID, context.source);
  }

  async function startSendToProcuradorFromPendency() {
    await startSendToProcurador("pendencia");
  }

  async function startSendToProcuradorFromMinute() {
    await startSendToProcurador("minuta");
  }

  function firstTwoNameQuery(name) {
    const parts = normalizeText(name).split(/\s+/).filter(Boolean);
    return parts.slice(0, Math.min(2, parts.length)).join(" ");
  }

  function setNativeSelectValue(select, value) {
    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (window.jQuery) {
      try {
        window.jQuery(select).val(value).trigger("change");
      } catch (_error) {}
    }
  }

  function selectReturnAssessorFromOptions(select, assessorName) {
    if (!select || !assessorName) return false;

    const wanted = normalizeKey(assessorName);
    const firstTwo = normalizeKey(firstTwoNameQuery(assessorName));
    const options = Array.from(select.options || []).filter((option) => option && option.value);
    const option =
      options.find((candidate) => normalizeKey(candidate.textContent || "").indexOf(wanted) >= 0) ||
      options.find((candidate) => normalizeKey(candidate.textContent || "").indexOf(firstTwo) >= 0);

    if (!option) return false;
    setNativeSelectValue(select, option.value);
    return true;
  }

  async function selectReturnAssessorThroughSearch(select, assessorName) {
    if (!select || !window.jQuery || !window.jQuery.fn || !window.jQuery.fn.select2) return false;

    const query = firstTwoNameQuery(assessorName);
    try {
      window.jQuery(select).select2("open");
    } catch (_error) {
      return false;
    }

    await sleep(250);
    const field = document.querySelector(".select2-container--open .select2-search__field");
    if (!field) return false;

    field.value = query;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: query.slice(-1) || "a" }));
    await sleep(800);

    const option = Array.from(document.querySelectorAll(".select2-results__option"))
      .filter((element) => element.getAttribute("aria-disabled") !== "true")
      .find((element) => normalizeKey(element.textContent || "").indexOf(normalizeKey(query)) >= 0);

    if (!option) return false;
    clickElement(option);
    await sleep(250);
    return Boolean(select.value);
  }

  async function fillReturnAssessor(assessorName) {
    const select = await waitForValue(() => document.querySelector("#" + CORRECTION_RETURN_ASSESSOR_FIELD_ID), 20000, 300);
    if (!select) {
      throw new Error("Campo Assessor(a) nao encontrado no passo Devolver ao assessor.");
    }

    if (selectReturnAssessorFromOptions(select, assessorName)) return;
    if (await selectReturnAssessorThroughSearch(select, assessorName)) return;
    throw new Error("Nao encontrei o assessor '" + assessorName + "' na lista do SPA.");
  }

  async function fillReturnObservation(observation) {
    const text = String(observation || "").trim();
    if (!text) return;

    const field = await waitForValue(
      () => document.querySelector("#" + CORRECTION_RETURN_OBSERVATION_FIELD_ID),
      20000,
      300
    );
    if (!field || !setInputValue(field, text)) {
      throw new Error("Campo Observacao nao encontrado no passo Devolver ao assessor.");
    }
  }

  async function startReturnToAssessor(assessorName, source, observation) {
    const cleanName = normalizeText(assessorName);
    const cleanObservation = String(observation || "").trim();
    if (!cleanName) {
      window.alert("Selecione um assessor para devolver o processo.");
      return;
    }

    const context = currentCorrectionActionContext(source, CORRECTION_RETURN_STEP_ID, "Devolver ao assessor");
    if (!context) return;

    if (context.alreadyOnStep) {
      storeCorrectionStepAction("devolver_assessor", {
        stepId: CORRECTION_RETURN_STEP_ID,
        assessorName: cleanName,
        observation: cleanObservation,
        source: context.source
      });
      await continuePendingCorrectionStepAction();
      return;
    }

    setStatus("Procurando devolucao...");
    const control = await waitForValue(
      () => findCorrectionStepControl(
        context.procedureId,
        CORRECTION_RETURN_STEP_ID,
        ["devolver", "assessor"],
        context.source
      ),
      10000,
      300
    );
    if (!control) {
      window.alert("Nao encontrei o passo 'Devolver ao assessor' na " + correctionActionSourceLabel(context.source) + ".");
      setStatus("Devolucao nao encontrada");
      return;
    }

    storeCorrectionStepAction("devolver_assessor", {
      stepId: CORRECTION_RETURN_STEP_ID,
      assessorName: cleanName,
      observation: cleanObservation,
      source: context.source
    });
    setStatus("Abrindo devolucao...");
    log(
      "Abrindo passo Devolver ao assessor para " +
        cleanName +
        " pela " +
        correctionActionSourceLabel(context.source) +
        " no processo " +
        context.procedureId +
        ".",
      "ok"
    );

    openCorrectionStepControl(control, CORRECTION_RETURN_STEP_ID, context.source);
  }

  async function startSuggestClosureFromCorrection(source) {
    const context = currentCorrectionActionContext(source, CORRECTION_CLOSE_STEP_ID, "Sugerir encerramento de tarefa");
    if (!context) return;

    if (context.alreadyOnStep) {
      storeCorrectionStepAction("sugerir_encerramento", {
        stepId: CORRECTION_CLOSE_STEP_ID,
        source: context.source
      });
      await continuePendingCorrectionStepAction();
      return;
    }

    setStatus("Procurando encerramento...");
    const control = await waitForValue(
      () => findCorrectionStepControl(
        context.procedureId,
        CORRECTION_CLOSE_STEP_ID,
        ["sugerir", "encerramento", "tarefa"],
        context.source
      ),
      10000,
      300
    );
    if (!control) {
      window.alert(
        "Nao encontrei o passo 'Sugerir encerramento de tarefa' na " + correctionActionSourceLabel(context.source) + "."
      );
      setStatus("Encerramento nao encontrado");
      return;
    }

    storeCorrectionStepAction("sugerir_encerramento", {
      stepId: CORRECTION_CLOSE_STEP_ID,
      source: context.source
    });
    setStatus("Abrindo encerramento...");
    log(
      "Abrindo passo Sugerir encerramento de tarefa pela " +
        correctionActionSourceLabel(context.source) +
        " no processo " +
        context.procedureId +
        ".",
      "ok"
    );

    openCorrectionStepControl(control, CORRECTION_CLOSE_STEP_ID, context.source);
  }

  function isElementVisible(element) {
    if (!element || !element.ownerDocument || !element.ownerDocument.defaultView) return false;

    let cursor = element;
    while (cursor && cursor.nodeType === 1) {
      const style = cursor.ownerDocument.defaultView.getComputedStyle(cursor);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      cursor = cursor.parentElement;
    }

    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function waitForValue(getValue, timeoutMs, intervalMs) {
    const timeout = Number(timeoutMs) || 15000;
    const interval = Number(intervalMs) || 300;
    const started = Date.now();

    return new Promise((resolve) => {
      const tick = () => {
        let value = null;
        try {
          value = getValue();
        } catch (_error) {
          value = null;
        }

        if (value) {
          resolve(value);
          return;
        }

        if (Date.now() - started >= timeout) {
          resolve(null);
          return;
        }

        window.setTimeout(tick, interval);
      };

      tick();
    });
  }

  function clickElement(element) {
    if (!element) return false;

    try {
      if (element.scrollIntoView) element.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (_error) {
      // Alguns elementos em modais nao aceitam rolagem programatica.
    }

    try {
      if (element.focus) element.focus({ preventScroll: true });
    } catch (_error) {
      // O foco visual nao e requisito para o clique funcionar.
    }

    try {
      element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      element.click();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function dispatchFieldEvents(element) {
    if (!element) return;

    ["input", "change", "blur"].forEach((eventName) => {
      try {
        element.dispatchEvent(new Event(eventName, { bubbles: true }));
      } catch (_error) {
        // Eventos nativos bastam para o SPA recalcular validacoes simples.
      }
    });

    try {
      if (window.jQuery) window.jQuery(element).trigger("change");
    } catch (_error) {
      // Select2 pode nao estar ativo em todas as telas.
    }
  }

  function resolveFieldTarget(target) {
    if (!target) return null;
    if (typeof target === "string") return document.querySelector(target);
    if (target.nodeType === 1) return target;
    return null;
  }

  function labelTextMatches(label, labelCandidates) {
    const source = normalizeKey(label && label.textContent);
    if (!source) return false;

    const wanted = (Array.isArray(labelCandidates) ? labelCandidates : [labelCandidates]).map(normalizeKey).filter(Boolean);
    return wanted.some((item) => source === item || source.indexOf(item) >= 0 || item.indexOf(source) >= 0);
  }

  function findControlNearLabel(label) {
    if (!label) return null;

    const forId = label.getAttribute("for");
    if (forId) {
      const byId = document.getElementById(forId);
      if (byId) return byId;
    }

    const container = label.closest(".form-group, [id^='step-attribute-'], .step-attribute-box, .col-md-6, .col-6, div");
    return container ? container.querySelector("select, textarea, input:not([type='hidden'])") : null;
  }

  function findAgravoField(fieldKey) {
    const config = AGRAVO_FIELD_MAP[fieldKey];
    if (!config) return null;

    for (const selector of config.selectors || []) {
      const field = document.querySelector(selector);
      if (field) return field;
    }

    const labels = Array.from(document.querySelectorAll("label"));
    for (const label of labels) {
      if (!labelTextMatches(label, config.labels || [])) continue;
      const control = findControlNearLabel(label);
      if (control) return control;
    }

    return null;
  }

  function agravoFormReadyElement(action) {
    return isAgravoInstrumentoForm(action) ? findAgravoField("processNumber") || document.querySelector("form#progress-form") : null;
  }

  function setInputValue(target, value) {
    const input = resolveFieldTarget(target);
    if (!input) return false;

    input.value = value == null ? "" : String(value);
    dispatchFieldEvents(input);
    return true;
  }

  function selectOptionByLabel(target, labelCandidates) {
    const select = resolveFieldTarget(target);
    if (!select) return false;

    const wanted = (Array.isArray(labelCandidates) ? labelCandidates : [labelCandidates]).map(normalizeKey).filter(Boolean);
    if (!wanted.length) return false;

    const options = Array.from(select.options || []);
    const option =
      options.find((item) => wanted.some((label) => normalizeKey(item.textContent) === label)) ||
      options.find((item) => {
        const text = normalizeKey(item.textContent);
        return item.value && wanted.some((label) => text.indexOf(label) >= 0 || label.indexOf(text) >= 0);
      });

    if (!option || !option.value) return false;

    select.value = option.value;
    dispatchFieldEvents(select);
    return true;
  }

  function remoteOptionLabel(item) {
    if (!item || typeof item !== "object") return "";
    return normalizeText(item.text || item.name || item.label || item.title || item.description || "");
  }

  function remoteOptionValue(item) {
    if (!item || typeof item !== "object") return "";
    return String(item.code || item.value || item.gid || item.global_id || item.globalId || item.user_id || item.id || item.identifier || "").trim();
  }

  function remoteOptionSearchText(item) {
    if (!item || typeof item !== "object") return "";
    return normalizeText(
      [
        item.text,
        item.name,
        item.label,
        item.title,
        item.description,
        item.cpf_cnpj,
        item.cpfCnpj,
        item.cnpj,
        item.cpf,
        item.document,
        item.document_number,
        item.documentNumber
      ].join(" ")
    );
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function flattenRemoteOptions(payload) {
    const items = [];
    const seen = new Set();

    function visit(value) {
      if (!value) return;

      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      if (typeof value !== "object") return;

      const label = remoteOptionLabel(value);
      const optionValue = remoteOptionValue(value);
      const key = optionValue + "|" + normalizeKey(label);
      const searchText = remoteOptionSearchText(value);
      if ((label || searchText) && optionValue && !seen.has(key)) {
        seen.add(key);
        items.push({
          label: label || searchText || optionValue,
          value: optionValue,
          searchText
        });
      }

      Object.keys(value).forEach((keyName) => {
        if (keyName === "element") return;
        visit(value[keyName]);
      });
    }

    visit(payload);
    return items;
  }

  async function fetchRemoteOptions(select, searchText) {
    const url = resolveSpaUrl(select && select.getAttribute("data-url"));
    if (!url) return [];

    const parsed = new URL(url);
    parsed.searchParams.set("term", searchText);
    parsed.searchParams.set("q", searchText);
    if (parsed.pathname.indexOf("/people/search") >= 0) {
      parsed.searchParams.set("search", searchText);
      parsed.searchParams.set("cpf_cnpj", searchText);
    }

    const response = await fetch(parsed.href, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (!response.ok) return [];

    const payload = await response.json();
    return flattenRemoteOptions(payload);
  }

  function appendRemoteOption(select, option, replaceSelection) {
    if (!select || !option || !option.value) return false;

    let domOption = Array.from(select.options || []).find((item) => String(item.value) === String(option.value));
    if (!domOption) {
      domOption = new Option(option.label || option.value, option.value, true, true);
      select.appendChild(domOption);
    }

    if (select.multiple) {
      if (replaceSelection) {
        Array.from(select.options || []).forEach((item) => {
          item.selected = false;
        });
      }
      domOption.selected = true;
    } else {
      select.value = option.value;
    }

    dispatchFieldEvents(select);
    return true;
  }

  async function selectRemoteOptionByLabel(target, label) {
    const select = resolveFieldTarget(target);
    if (!select) return false;

    const wanted = normalizeKey(label);
    const existing = Array.from(select.options || []).find((item) =>
      item.value && normalizeKey(item.textContent) === wanted
    );
    if (existing) {
      select.value = existing.value;
      dispatchFieldEvents(select);
      return true;
    }

    const searchTerms = [label, normalizeText(label)];

    for (const term of searchTerms) {
      let options = [];
      try {
        options = await fetchRemoteOptions(select, term);
      } catch (_error) {
        options = [];
      }

      const option = options.find((item) => normalizeKey(item.label) === wanted);

      if (!option || !option.value) continue;

      return appendRemoteOption(select, option, false);
    }

    return false;
  }

  async function selectRemoteOptionBySearch(target, searchText, preferredLabel, settings) {
    const select = resolveFieldTarget(target);
    if (!select) return false;

    const cnpjDigits = onlyDigits(searchText);
    const preferred = normalizeKey(preferredLabel || "");
    const searchKey = normalizeKey(searchText);
    const replaceSelection = !!(settings && settings.replaceSelection);
    const searchTerms = [searchText, cnpjDigits, preferredLabel].filter(Boolean);

    for (const term of searchTerms) {
      let options = [];
      try {
        options = await fetchRemoteOptions(select, term);
      } catch (_error) {
        options = [];
      }

      if (!options.length) continue;

      const option =
        options.find((item) => {
          const itemDigits = onlyDigits([item.label, item.searchText, item.value].join(" "));
          return cnpjDigits && itemDigits.indexOf(cnpjDigits) >= 0;
        }) ||
        options.find((item) => preferred && normalizeKey([item.label, item.searchText].join(" ")).indexOf(preferred) >= 0) ||
        options.find((item) => searchKey && normalizeKey([item.label, item.searchText].join(" ")).indexOf(searchKey) >= 0) ||
        (cnpjDigits && onlyDigits(term) === cnpjDigits ? options[0] : null);

      if (!option || !option.value) continue;
      return appendRemoteOption(select, option, replaceSelection);
    }

    return false;
  }

  function isAgravoInstrumentoForm(action) {
    const form = document.querySelector("form#progress-form");
    const stepId = form ? String(form.getAttribute("data-step-id") || "") : "";
    const title = normalizeKey(document.querySelector(".card-title") ? document.querySelector(".card-title").textContent : document.title);
    const hasPendingAgravo = !!(action && action.type === "cadastrar_agravo_instrumento");
    const hasAgravoFields = !!(findAgravoField("processNumber") && findAgravoField("valueCause"));
    return !!(
      form &&
      hasAgravoFields &&
      (stepId === "748" || stepId === "2934" || title.indexOf("cadastrar agravo de instrumento") >= 0 || (hasPendingAgravo && form))
    );
  }

  async function fillAgravoInstrumentoForm(action) {
    const formReady = await waitForValue(() => agravoFormReadyElement(action), 15000, 300);
    if (!formReady) return false;

    setStatus("Preenchendo agravo...");
    log("Preenchendo cadastro de Agravo de Instrumento para o processo " + action.processNumber + ".");

    const filled = [];
    const missing = [];
    const isTrf = action.flowType === "trf" || isAgravoTrfProcess(action.processNumber);
    const competenceLabels = isTrf ? AGRAVO_TRF_COMPETENCE_LABELS : AGRAVO_STATE_COMPETENCE_LABELS;
    const fields = {
      processNumber: findAgravoField("processNumber"),
      section: findAgravoField("section"),
      competence: findAgravoField("competence"),
      subject: findAgravoField("subject"),
      activeParty: findAgravoField("activeParty"),
      passiveParty: findAgravoField("passiveParty"),
      valueCause: findAgravoField("valueCause")
    };

    if (action.processNumber && setInputValue(fields.processNumber, action.processNumber)) filled.push("Numero do Processo Vinculado");
    else missing.push("Numero do Processo Vinculado");

    if (action.sectionLabel && selectOptionByLabel(fields.section, action.sectionLabel)) filled.push("Secao/Subsecao");
    else missing.push("Secao/Subsecao");

    if (selectOptionByLabel(fields.competence, competenceLabels)) {
      filled.push("Competencia");
    } else {
      missing.push("Competencia");
    }

    if (await selectRemoteOptionByLabel(fields.subject, AGRAVO_SUBJECT_LABEL)) {
      filled.push("Assunto");
    } else {
      missing.push("Assunto");
    }

    if (
      await selectRemoteOptionBySearch(fields.activeParty, AGRAVO_ACTIVE_PARTY_CNPJ, "ESTADO DE MATO GROSSO", {
        replaceSelection: true
      })
    ) {
      filled.push("Parte(s) Ativa(s)");
    } else if (!isTrf) {
      missing.push("Parte(s) Ativa(s)");
    }

    if (action.valueCause && setInputValue(fields.valueCause, action.valueCause)) filled.push("Valor da causa");
    else missing.push("Valor da causa");

    if (missing.length) {
      setStatus("Conferir agravo");
      log("Cadastro de agravo preenchido parcialmente. Campos pendentes: " + missing.join(", ") + ".", "error");
      window.alert(
        "O cadastro de Agravo de Instrumento foi aberto, mas alguns campos precisam de conferencia manual:\n\n" +
          missing.join("\n") +
          "\n\nOs demais campos foram preenchidos quando localizados."
      );
      return false;
    }

    setStatus("Agravo preenchido");
    log("Cadastro de agravo preenchido. Confira os dados antes de salvar.", "ok");
    return true;
  }

  function documentModelsModal() {
    return document.querySelector("#document-type-modal");
  }

  function isDocumentModelsModalOpen(modal) {
    if (!modal) return false;
    if (modal.classList && modal.classList.contains("show")) return true;
    if (String(modal.getAttribute("aria-hidden") || "") === "false") return true;
    return isElementVisible(modal);
  }

  function forceShowDocumentModelsModal(modal) {
    if (!modal) return;

    modal.classList.add("show");
    modal.removeAttribute("aria-hidden");
    modal.setAttribute("aria-modal", "true");
    modal.style.display = "block";
    if (document.body) document.body.classList.add("modal-open");
  }

  function findDocumentModelsButton() {
    const direct = Array.from(document.querySelectorAll('[data-target="#document-type-modal"]')).find((element) => {
      const text = candidateActionText(element);
      return text.indexOf("modelo") >= 0 && text.indexOf("document") >= 0;
    });
    if (direct) return direct;

    return Array.from(document.querySelectorAll("a,button,[role='button']")).find((element) => {
      const text = candidateActionText(element);
      return text.indexOf("modelo") >= 0 && text.indexOf("document") >= 0 && isElementVisible(element);
    });
  }

  async function openDocumentModelsModal() {
    const button = findDocumentModelsButton();
    if (button && !isDocumentModelsModalOpen(documentModelsModal())) {
      setStatus("Abrindo modelos...");
      log("Abrindo Modelos de documentos.");
      clickElement(button);
    }

    const modal = await waitForValue(() => documentModelsModal(), 8000, 250);
    if (!modal) return null;

    const opened = await waitForValue(() => (isDocumentModelsModalOpen(modal) ? modal : null), 2500, 200);
    if (!opened) forceShowDocumentModelsModal(modal);

    return modal;
  }

  function documentModelLinkMatches(element, target) {
    const href = elementUrl(element);
    const text = candidateActionText(element);
    if (!href && element.tagName !== "BUTTON") return false;
    if (target.folderOnly && href.indexOf("/manage_documents/list_document_type/") < 0) return false;
    if (target.exactText && text !== normalizeKey(target.exactText)) return false;

    if (target.documentTypeId && href.indexOf("/manage_documents/list_document_type/" + target.documentTypeId) >= 0) {
      return true;
    }

    return (target.tokens || []).every((token) => text.indexOf(normalizeKey(token)) >= 0);
  }

  function findDocumentModelLink(root, target, options) {
    const scope = root || document;
    const settings = options || {};
    const candidates = Array.from(scope.querySelectorAll("a[href],button,[role='button']")).filter((element) =>
      documentModelLinkMatches(element, target)
    );

    const visibleCandidates = candidates.filter(isElementVisible);
    const pool = visibleCandidates.length ? visibleCandidates : settings.allowHidden ? candidates : [];

    return (
      pool.find((element) => hasClassName(element, "go-to-folder")) ||
      pool.find((element) => hasClassName(element, "manage-documents-navigation-button")) ||
      pool[0] ||
      null
    );
  }

  function waitForDocumentModelLink(root, target, timeoutMs) {
    return waitForValue(() => findDocumentModelLink(root, target, { allowHidden: false }), timeoutMs || 15000, 300);
  }

  function isNsusDocumentFolderOpen(root) {
    if (!root) return false;

    const breadcrumb = root.querySelector(".manage-documents-breadcrumb");
    const breadcrumbText = normalizeKey(breadcrumb ? breadcrumb.textContent : "");
    if (breadcrumbText.indexOf("sgj") >= 0 && breadcrumbText.indexOf("nsus") >= 0) return true;

    const contextualInput = root.querySelector(".manage-documents-contextual-search-input");
    const listUrl = contextualInput ? String(contextualInput.getAttribute("data-list-url") || "") : "";
    return listUrl.indexOf("/manage_documents/list_document_type/787") >= 0;
  }

  function isSgjDocumentFolderOpen(root) {
    if (!root) return false;

    const breadcrumb = root.querySelector(".manage-documents-breadcrumb");
    const breadcrumbText = normalizeKey(breadcrumb ? breadcrumb.textContent : "");
    if (breadcrumbText.indexOf("sgj") >= 0 && breadcrumbText.indexOf("subprocuradoria") >= 0) return true;

    const contextualInput = root.querySelector(".manage-documents-contextual-search-input");
    const listUrl = contextualInput ? String(contextualInput.getAttribute("data-list-url") || "") : "";
    return listUrl.indexOf("/manage_documents/list_document_type/78") >= 0;
  }

  async function clickDocumentModelPathLink(root, target, nextTarget, label) {
    const link = findDocumentModelLink(root, target, { allowHidden: false }) || (await waitForDocumentModelLink(root, target));
    if (!link) return false;

    setStatus("Abrindo " + label + "...");
    log("Abrindo " + label + " nos modelos de documentos.");
    if (!clickElement(link)) return false;

    if (!nextTarget) return true;
    return !!(await waitForDocumentModelLink(root, nextTarget, 18000));
  }

  async function continueDocumentModelSelection(action) {
    setStatus("Selecionando modelos...");
    log("Pagina de elaboracao aberta. Selecionando pasta de modelos SGJ > NSUS.");

    const modal = await openDocumentModelsModal();
    if (!modal) {
      window.localStorage.removeItem(PETITION_ACTION_KEY);
      setStatus("Modelos nao encontrados");
      log("Modal de Modelos de documentos nao encontrado.", "error");
      window.alert(
        "Nao encontrei o botao ou a janela de Modelos de documentos.\n\nProcesso: " +
          (action.processNumber || action.procedureId)
      );
      return;
    }

    const publicTarget = {
      label: "Modelos Publicos",
      documentTypeId: "63",
      tokens: ["modelos", "publicos"],
      folderOnly: true
    };
    const sgjTarget = {
      label: "SGJ - Subprocuradoria-Geral Judicial",
      documentTypeId: "78",
      tokens: ["sgj", "subprocuradoria"],
      folderOnly: true
    };
    const nsusTarget = {
      label: "NSUS - Nucleo saude",
      documentTypeId: "787",
      tokens: ["nsus", "nucleo", "saude"],
      folderOnly: true
    };

    if (!isNsusDocumentFolderOpen(modal) && !isSgjDocumentFolderOpen(modal) && !findDocumentModelLink(modal, sgjTarget, { allowHidden: false })) {
      await clickDocumentModelPathLink(modal, publicTarget, sgjTarget, "Modelos Publicos");
    }

    if (!isNsusDocumentFolderOpen(modal) && !isSgjDocumentFolderOpen(modal)) {
      const openedSgj = await clickDocumentModelPathLink(modal, sgjTarget, nsusTarget, "SGJ - Subprocuradoria-Geral Judicial");
      if (!openedSgj) {
        window.localStorage.removeItem(PETITION_ACTION_KEY);
        setStatus("Pasta SGJ nao encontrada");
        log("Pasta SGJ - Subprocuradoria-Geral Judicial nao encontrada nos modelos publicos.", "error");
        window.alert(
          "Nao encontrei a pasta SGJ - Subprocuradoria-Geral Judicial nos Modelos Publicos.\n\nProcesso: " +
            (action.processNumber || action.procedureId)
        );
        return;
      }
    }

    if (!isNsusDocumentFolderOpen(modal)) {
      const nsusLink = findDocumentModelLink(modal, nsusTarget, { allowHidden: false }) ||
        (await waitForDocumentModelLink(modal, nsusTarget, 18000));

      if (!nsusLink || !clickElement(nsusLink)) {
        window.localStorage.removeItem(PETITION_ACTION_KEY);
        setStatus("Pasta NSUS nao encontrada");
        log("Pasta NSUS - Nucleo saude nao encontrada dentro da SGJ.", "error");
        window.alert(
          "Nao encontrei a pasta NSUS - Nucleo saude dentro da SGJ.\n\nProcesso: " +
            (action.processNumber || action.procedureId)
        );
        return;
      }

      await waitForValue(() => (isNsusDocumentFolderOpen(modal) ? modal : null), 18000, 300);
    }

    if (!isNsusDocumentFolderOpen(modal)) {
      window.localStorage.removeItem(PETITION_ACTION_KEY);
      setStatus("Pasta NSUS nao confirmada");
      log("Nao foi possivel confirmar a abertura da pasta NSUS - Nucleo saude.", "error");
      window.alert(
        "A extensao clicou nas pastas, mas nao conseguiu confirmar a abertura da pasta NSUS - Nucleo saude.\n\nProcesso: " +
          (action.processNumber || action.procedureId)
      );
      return;
    }

    window.localStorage.removeItem(PETITION_ACTION_KEY);
    setStatus("Modelos NSUS abertos");
    log("Pasta SGJ > NSUS aberta para o processo " + action.processNumber + ".", "ok");
  }

  async function continuePendingPetitionAction() {
    const action = pendingPetitionAction();
    const procedureId = currentProcedureIdFromPath();
    if (!action || !procedureId || String(action.procedureId) !== String(procedureId)) return;

    if (currentProgressStepIdFromPath()) {
      if (action.phase !== "selecionar_modelo") return;
      await continueDocumentModelSelection(action);
      return;
    }

    setStatus("Procurando botao de peticao...");
    log("Pendencia aberta. Procurando botao de elaborar peticao para o processo " + action.processNumber + ".");

    const link = await waitForPetitionProgressLink(procedureId);
    if (!link) {
      window.localStorage.removeItem(PETITION_ACTION_KEY);
      setStatus("Botao nao encontrado");
      log("Botao de elaborar peticao nao encontrado na pendencia " + procedureId + ".", "error");
      window.alert(
        "Nao encontrei o botao principal de Elaborar peticao nesta pendencia.\n\nProcesso: " +
          (action.processNumber || procedureId)
      );
      return;
    }

    updatePetitionAction(action, "selecionar_modelo");
    setStatus("Abrindo elaboracao...");
    log("Botao de elaborar peticao encontrado. Abrindo passo do processo " + action.processNumber + ".", "ok");

    if (link.scrollIntoView) {
      link.scrollIntoView({ block: "center", inline: "nearest" });
    }

    link.click();
  }

  function pendingSimpleClosureAction() {
    let action = null;
    try {
      action = JSON.parse(window.localStorage.getItem(SIMPLE_CLOSURE_ACTION_KEY) || "null");
    } catch (_error) {
      window.localStorage.removeItem(SIMPLE_CLOSURE_ACTION_KEY);
      return null;
    }

    if (!action || action.type !== "simple_closure_template" || !action.procedureId || !action.payload) return null;
    if (Date.now() - Number(action.createdAt || 0) > SIMPLE_CLOSURE_ACTION_MAX_AGE_MS) {
      window.localStorage.removeItem(SIMPLE_CLOSURE_ACTION_KEY);
      return null;
    }
    return action;
  }

  function saveSimpleClosureAction(action, phase) {
    if (!action) return;
    action.phase = phase || action.phase || "abrir_elaboracao";
    action.updatedAt = Date.now();
    window.localStorage.setItem(SIMPLE_CLOSURE_ACTION_KEY, JSON.stringify(action));
  }

  function simpleClosureProgressLink(procedureId) {
    const tribunal = normalizeKey(procedureDetailValue(["Tribunal"]));
    const preferredDegree = tribunal.indexOf("2") >= 0 && tribunal.indexOf("grau") >= 0 ? "2" : "1";
    const candidates = Array.from(document.querySelectorAll("a[href*='/new_progress/']")).filter((element) => {
      const href = elementUrl(element);
      const text = candidateActionText(element);
      return (
        href.indexOf("/procedures/" + procedureId + "/new_progress/") >= 0 &&
        text.indexOf("elaborar") >= 0 &&
        text.indexOf("peti") >= 0 &&
        text.indexOf("tj") >= 0 &&
        text.indexOf("grau") >= 0
      );
    });
    const preferred = candidates.filter((element) => candidateActionText(element).indexOf(preferredDegree) >= 0);
    return sortElementsByScreenPosition(preferred.length ? preferred : candidates)[0] || null;
  }

  function waitForSimpleClosureProgressLink(procedureId) {
    return waitForValue(() => simpleClosureProgressLink(procedureId), 18000, 300);
  }

  async function selectSimpleClosureDocumentTemplate(action) {
    const target = SIMPLE_CLOSURE_MODEL_TARGETS[action.closureTypeKey];
    if (!target) throw new Error("Tipo de Simples Encerramento sem modelo configurado.");

    const modal = await openDocumentModelsModal();
    if (!modal) throw new Error("Janela de Modelos de documentos nao encontrada.");

    const path = [
      { documentTypeId: "63", tokens: ["modelos", "publicos"], folderOnly: true },
      { documentTypeId: "78", tokens: ["sgj", "subprocuradoria"], folderOnly: true },
      { documentTypeId: "787", tokens: ["nsus", "nucleo", "saude"], folderOnly: true },
      { exactText: "Procedimentos", folderOnly: true },
      { documentTypeId: "1204", tokens: ["2", "simples", "encerramento"], folderOnly: true },
      target.folder
    ];

    for (let index = 0; index < path.length; index += 1) {
      const current = path[index];
      const next = path[index + 1] || target.template;
      const nextAlreadyVisible = findDocumentModelLink(modal, next, { allowHidden: false });
      if (nextAlreadyVisible) continue;

      const link = findDocumentModelLink(modal, current, { allowHidden: false }) ||
        (await waitForDocumentModelLink(modal, current, 18000));
      if (!link || !clickElement(link)) {
        throw new Error("Pasta nao encontrada: " + (current.tokens || []).join(" ") + ".");
      }
      if (!(await waitForDocumentModelLink(modal, next, 18000))) {
        throw new Error("A pasta nao carregou: " + (next.tokens || []).join(" ") + ".");
      }
    }

    const template = findDocumentModelLink(modal, target.template, { allowHidden: false }) ||
      (await waitForDocumentModelLink(modal, target.template, 18000));
    if (!template || !clickElement(template)) {
      throw new Error("Modelo de Simples Encerramento nao encontrado.");
    }
  }

  async function continuePendingSimpleClosureAction() {
    const action = pendingSimpleClosureAction();
    const procedureId = currentProcedureIdFromPath();
    if (!action || !procedureId || String(action.procedureId) !== String(procedureId)) return;

    if (!currentProgressStepIdFromPath()) {
      const link = await waitForSimpleClosureProgressLink(procedureId);
      if (!link) throw new Error("Botao Elaborar peticao - TJ nao encontrado.");
      saveSimpleClosureAction(action, "selecionar_modelo");
      setStatus("Abrindo elaboracao...");
      log("Abrindo Elaborar peticao - TJ para o Simples Encerramento.", "ok");
      const href = elementUrl(link);
      clickElement(link);
      await sleep(1200);
      if (!currentProgressStepIdFromPath() && href) window.location.assign(href);
      return;
    }

    if (action.phase === "abrir_elaboracao") saveSimpleClosureAction(action, "selecionar_modelo");
    if (action.phase !== "selecionar_modelo") return;
    saveSimpleClosureAction(action, "abrindo_modelo");
    setStatus("Selecionando modelo...");
    log("Selecionando o modelo de Simples Encerramento nos Modelos Publicos.");

    try {
      await selectSimpleClosureDocumentTemplate(action);
      saveSimpleClosureAction(action, "inserindo_texto");
    } catch (error) {
      window.localStorage.removeItem(SIMPLE_CLOSURE_ACTION_KEY);
      throw error;
    }

    const editorFrame = await waitForValue(
      () => document.querySelector("iframe.google-docs-editor[src*='docs.google.com']"),
      45000,
      500
    );
    if (!editorFrame) throw new Error("Editor do Google Docs nao carregou apos selecionar o modelo.");

    setStatus("Inserindo texto...");
    const result = await sendSimpleClosureBridgeMessage("SPA_CDSP_SIMPLE_CLOSURE_INSERT_DOCUMENT", {
      html: action.payload.html,
      plain: action.payload.plain
    });
    window.localStorage.removeItem(SIMPLE_CLOSURE_ACTION_KEY);

    if (!result || !result.ok) {
      const detail = result && result.error ? result.error : "Falha sem retorno do editor.";
      setStatus("Cole o texto copiado");
      log("Modelo aberto, mas a insercao automatica falhou: " + detail, "error");
      window.alert(
        "O modelo foi aberto, mas o Google Docs nao confirmou a insercao automatica.\n\n" +
          "O texto continua copiado. Use Ctrl+V no lugar de 'INSERIR O TEXTO DO SIMPLES ENCERRAMENTO'.\n\n" +
          detail
      );
      return;
    }

    setStatus("Texto inserido");
    log("Modelo aberto e texto do Simples Encerramento inserido na minuta.", "ok");
  }

  async function startSimpleClosureDocumentAction(closureTypeKey, payload) {
    if (!payload || !SIMPLE_CLOSURE_MODEL_TARGETS[closureTypeKey]) return;

    const procedureId = currentProcedureIdFromPath();
    if (!procedureId) {
      window.alert("Abra a pendencia do processo antes de gerar o Simples Encerramento.");
      return;
    }

    saveSimpleClosureAction(
      {
        type: "simple_closure_template",
        procedureId,
        closureTypeKey,
        payload,
        createdAt: Date.now()
      },
      "abrir_elaboracao"
    );
    await continuePendingSimpleClosureAction();
  }

  async function continuePendingCorrectionOpenAction() {
    const item = currentCorrectionQueueItem();
    const procedureId = currentProcedureIdFromPath();
    if (!item || !procedureId) return;

    if (currentProgressStepIdFromPath()) {
      removeCorrectionOpenQueueItem(procedureId);
      return;
    }

    setStatus("Abrindo minuta...");
    log("Pendencia aberta. Procurando Visualizar e editar minuta para o processo " + (item.processNumber || procedureId) + ".");

    const link = await waitForViewEditMinuteLink(procedureId);
    if (!link) {
      removeCorrectionOpenQueueItem(procedureId);
      setStatus("Minuta nao encontrada");
      log("Link Visualizar e editar minuta nao encontrado na pendencia " + procedureId + ".", "error");
      window.alert(
        "Nao encontrei o link 'Visualizar e editar minuta' nesta pendencia.\n\nProcesso: " +
          (item.processNumber || procedureId)
      );
      return;
    }

    setStatus("Abrindo editor...");
    log("Link Visualizar e editar minuta encontrado para " + (item.processNumber || procedureId) + ".", "ok");

    const href = elementUrl(link);
    const beforeClickUrl = resolveSpaUrl(window.location.href);
    const historyItem = Object.assign({}, item, {
      procedureUrl: beforeClickUrl,
      pendencyUrl: beforeClickUrl
    });

    storeCorrectionBackHistoryRepair(historyItem, procedureId, href);
    seedCorrectionBackHistory(historyItem, procedureId, {
      currentUrl: beforeClickUrl,
      pendencyUrl: beforeClickUrl
    });
    if (link.scrollIntoView) {
      link.scrollIntoView({ block: "center", inline: "nearest" });
    }

    const clicked = clickElement(link);
    if (!clicked) {
      if (href) window.location.assign(href);
      return;
    }

    if (href) {
      window.setTimeout(() => {
        if (!isCurrentCorrectionMinuteUrl(href)) {
          log("Clique da minuta nao navegou; aplicando abertura direta para o processo " + (item.processNumber || procedureId) + ".", "warn");
          window.location.assign(href);
        }
      }, 1500);
    }
  }

  async function continuePendingCorrectionSendAction() {
    const action = pendingCorrectionSendAction();
    const procedureId = currentProcedureIdFromPath();
    if (!action || !procedureId || String(action.procedureId) !== String(procedureId)) return;
    if (currentProgressStepIdFromPath() !== CORRECTION_SEND_STEP_ID) return;

    setStatus("Salvando envio...");
    const saveButton = await waitForValue(findProgressSaveButton, 20000, 300);
    if (!saveButton) {
      window.localStorage.removeItem(CORRECTION_SEND_ACTION_KEY);
      setStatus("Salvar nao encontrado");
      log("Botao Salvar nao encontrado no passo Enviar minuta ao procurador(a).", "error");
      window.alert("Nao encontrei o botao Salvar nesta tela de envio ao procurador.");
      return;
    }

    window.localStorage.removeItem(CORRECTION_SEND_ACTION_KEY);
    log("Confirmando Enviar minuta ao procurador(a) no processo " + procedureId + ".", "ok");
    if (saveButton.scrollIntoView) {
      saveButton.scrollIntoView({ block: "center", inline: "nearest" });
    }
    clickElement(saveButton);
  }

  async function continuePendingCorrectionStepAction() {
    const action = pendingCorrectionStepAction();
    const procedureId = currentProcedureIdFromPath();
    if (!action || !procedureId || String(action.procedureId) !== String(procedureId)) return;

    const stepId = currentProgressStepIdFromPath();
    if (String(stepId || "") !== String(action.stepId || "")) return;

    try {
      if (action.type === "devolver_assessor") {
        setStatus("Selecionando assessor...");
        await fillReturnAssessor(action.assessorName);
        await fillReturnObservation(action.observation);
      } else if (action.type === "sugerir_encerramento") {
        setStatus("Salvando encerramento...");
      } else {
        return;
      }

      const saveButton = await waitForValue(findProgressSaveButton, 20000, 300);
      if (!saveButton) {
        throw new Error("Botao Salvar nao encontrado nesta tela.");
      }

      window.localStorage.removeItem(CORRECTION_STEP_ACTION_KEY);
      if (saveButton.scrollIntoView) {
        saveButton.scrollIntoView({ block: "center", inline: "nearest" });
      }

      log(
        (action.type === "devolver_assessor"
          ? "Confirmando Devolver ao assessor para " + action.assessorName
          : "Confirmando Sugerir encerramento de tarefa") +
          " no processo " +
          procedureId +
          ".",
        "ok"
      );
      clickElement(saveButton);
    } catch (error) {
      window.localStorage.removeItem(CORRECTION_STEP_ACTION_KEY);
      setStatus("Erro no passo");
      log(error && error.message ? error.message : String(error), "error");
      window.alert(error && error.message ? error.message : "Nao foi possivel concluir o passo.");
    }
  }

  async function continuePendingAgravoAction() {
    const action = pendingAgravoAction();
    if (!action) return;

    const formReady = await waitForValue(
      () => agravoFormReadyElement(action),
      20000,
      300
    );

    if (!formReady) {
      removerAgravoInstrumentoButtonSolto();
      return;
    }

    try {
      await fillAgravoInstrumentoForm(action);
    } finally {
      clearAgravoAction();
    }
  }

  function excelLib() {
    if (!window.ExcelJS) {
      throw new Error("Biblioteca Excel nao carregada. Recarregue a extensao e tente novamente.");
    }

    return window.ExcelJS;
  }

  function excelSafeSheetName(name) {
    return String(name || "Relatorio")
      .replace(/[\\/?*[\]:]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31);
  }

  function rgbToArgb(color, fallback) {
    const value = Array.isArray(color) ? color : fallback;
    if (!Array.isArray(value)) return "FFFFFFFF";

    return (
      "FF" +
      value
        .map((part) => {
          const hex = Math.max(0, Math.min(255, Number(part) || 0)).toString(16).toUpperCase();
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  function excelReportColumns() {
    return [
      { header: "Categoria", key: "category", width: 16 },
      { header: "Tipo", key: "type", width: 34 },
      { header: "N\u00famero do Processo", key: "processNumber", width: 28 },
      { header: "Data da Ci\u00eancia", key: "knowledgeDate", width: 21 },
      { header: "Dias Recebido", key: "receivedDays", width: 15 },
      { header: "Prazo no SPA (PJE)", key: "pjeDeadlineDate", width: 22 },
      { header: "Prazo Interno", key: "internalDueDate", width: 18 },
      { header: "Dias p/ vencer no SPA (PJE)", key: "daysToSpa", width: 24 },
      { header: "Dias p/ prazo interno", key: "daysToInternal", width: 20 }
    ];
  }

  function excelCategoryLabel(record) {
    return REPORT_TYPES[record.group] ? REPORT_TYPES[record.group].label : record.group || "";
  }

  function validExcelDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function applyExcelBorder(cell, color) {
    const argb = color || "FFD2DAE8";
    cell.border = {
      top: { style: "thin", color: { argb } },
      left: { style: "thin", color: { argb } },
      bottom: { style: "thin", color: { argb } },
      right: { style: "thin", color: { argb } }
    };
  }

  function applyExcelDeadlineStyle(cell, record) {
    const style = record && record.pjeDeadlineStyle ? record.pjeDeadlineStyle : DEADLINE_STYLE_PRESETS.default;
    if (!style || style.kind === "default") return;

    const textArgb = rgbToArgb(style.fillColor, DEADLINE_STYLE_PRESETS.none.textColor);
    const borderArgb = rgbToArgb(style.borderColor, DEADLINE_STYLE_PRESETS.none.borderColor);

    cell.font = Object.assign({}, cell.font || {}, { bold: false, color: { argb: textArgb } });
    applyExcelBorder(cell, borderArgb);
  }

  function styleExcelReportHeader(row) {
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF272F7E" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      applyExcelBorder(cell, "FFBFC8DC");
    });
  }

  function styleExcelDataRow(row, record) {
    row.eachCell((cell, columnNumber) => {
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = Object.assign({}, cell.font || {}, { color: { argb: "FF1C2B39" } });
      applyExcelBorder(cell);

      if (columnNumber === 4 || columnNumber === 6) cell.numFmt = "dd/mm/yyyy hh:mm";
      if (columnNumber === 7) cell.numFmt = "dd/mm/yyyy";
    });

    applyExcelDeadlineStyle(row.getCell(6), record);
  }

  function addExcelReportSheet(workbook, name, records) {
    const columns = excelReportColumns();
    const worksheet = workbook.addWorksheet(excelSafeSheetName(name), {
      views: [{ state: "frozen", ySplit: 1 }]
    });
    worksheet.properties.defaultRowHeight = 20;
    worksheet.columns = columns.map((column) => ({
      key: column.key,
      width: column.width
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.values = columns.map((column) => column.header);
    headerRow.height = 28;
    styleExcelReportHeader(headerRow);

    records.forEach((record) => {
      const row = worksheet.addRow([
        excelCategoryLabel(record),
        record.type,
        record.processNumber,
        validExcelDate(record.knowledgeDate),
        Math.max(0, Number(record.receivedDays) || 0),
        validExcelDate(record.pjeDeadlineDate),
        validExcelDate(record.internalDueDate),
        "",
        ""
      ]);
      const rowNumber = row.number;
      const daysToSpa = record.pjeDeadlineDate ? daysBetweenDates(startOfToday(), record.pjeDeadlineDate) : "";
      const daysToInternal = record.internalDueDate ? daysBetweenDates(startOfToday(), record.internalDueDate) : "";
      row.getCell(8).value = { formula: 'IF(F' + rowNumber + '="","",INT(F' + rowNumber + "-TODAY()))", result: daysToSpa };
      row.getCell(9).value = {
        formula: 'IF(G' + rowNumber + '="","",INT(G' + rowNumber + "-TODAY()))",
        result: daysToInternal
      };

      styleExcelDataRow(row, record);
    });

    const lastRow = Math.max(1, worksheet.rowCount);
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastRow, column: columns.length }
    };
    worksheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
    worksheet.getColumn(2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    return worksheet;
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 40000);
  }

  async function generateExcel(records, reportType, reportDate, sortMode) {
    const ExcelJS = excelLib();
    const payload = reportPayload(records, reportType, sortMode);
    const summary = payload.summary;
    const metadata = buildPdfMetadata(payload.reportType, summary, payload.sortMode, records, reportDate);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CDSP - Redacao e Correcao";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = "Controle de prazos SPA CDSP";
    workbook.title = metadata.title;

    addExcelReportSheet(workbook, "Dados", payload.records);

    const buffer = await workbook.xlsx.writeBuffer();
    const filename =
      "controle_prazos_" +
      REPORT_TYPES[payload.reportType].filePart +
      "_" +
      sanitizeFilename(boxTitle()) +
      "_" +
      reportDate.getFullYear() +
      "-" +
      pad2(reportDate.getMonth() + 1) +
      "-" +
      pad2(reportDate.getDate()) +
      ".xlsx";

    saveBlob(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }),
      filename
    );
  }

  function selectedReportType() {
    const select = document.querySelector("#spa-cdsp-deadline-type");
    return select && REPORT_TYPES[select.value] ? select.value : "todos";
  }

  function validateSelectedRecords(records, reportType) {
    if (records.length) return;
    throw new Error(
      "Nenhum processo urgente encontrado para '" +
        REPORT_TYPES[reportType].label +
        "' conforme o prazo interno calculado."
    );
  }

  async function generateSelectedScreenReport() {
    if (state.running) {
      log("Ja existe uma geracao em andamento.");
      return;
    }

    state.running = true;
    state.stopped = false;

    try {
      setStatus("Coletando processos...");
      log("Iniciando leitura de todas as paginas do resultado atual do SPA.");
      const result = await collectAllRecords();
      const payload = reportPayload(result.records, "todos", "pje");
      validateSelectedRecords(payload.records, "todos");

      state.lastSummary = payload.summary;

      log(
        "Processos lidos: " +
          result.records.length +
          ". Relatorio em tela: Todos" +
          " (" +
          payload.summary.total +
          ")."
      );

      setStatus("Exibindo relatorio...");
      renderScreenReport(result.records, result.reportDate);
      setStatus("Relatorio exibido");
      log("Relatorio exibido na tela.", "ok");
    } catch (error) {
      setStatus("Erro ao gerar");
      log(error && error.message ? error.message : String(error), "error");
      window.alert("Nao foi possivel gerar o relatorio: " + (error && error.message ? error.message : String(error)));
    } finally {
      state.running = false;
    }
  }

  async function generateSelectedReport() {
    if (state.running) {
      log("Ja existe uma geracao em andamento.");
      return;
    }

    state.running = true;
    state.stopped = false;
    const reportType = selectedReportType();
    const sortMode = "pje";

    try {
      setStatus("Coletando processos...");
      log("Iniciando leitura de todas as paginas do resultado atual do SPA.");
      const result = await collectAllRecords();
      const allSummary = summarize(result.records);

      const payload = reportPayload(result.records, reportType, sortMode);
      validateSelectedRecords(payload.records, reportType);

      const selectedSummary = payload.summary;
      state.lastSummary = selectedSummary;

      log(
        "Processos lidos: " +
          allSummary.total +
          ". Entraram no relatorio '" +
          REPORT_TYPES[reportType].label +
          "': " +
          selectedSummary.total +
          "."
      );

      setStatus("Exibindo relatório...");
      renderScreenReport(result.records, result.reportDate);
      setStatus("Relatório exibido");
      log("Relatório exibido. Use Imprimir / salvar PDF se precisar do arquivo.", "ok");
    } catch (error) {
      setStatus("Erro ao gerar");
      log(error && error.message ? error.message : String(error), "error");
      window.alert("Nao foi possivel gerar o relatorio: " + (error && error.message ? error.message : String(error)));
    } finally {
      state.running = false;
    }
  }

  function createButton(text, onclick, variant) {
    const colors = {
      primary: "#26317d",
      neutral: "#425466",
      danger: "#9f2f27"
    };
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("mtprev-action", "mtprev-action--" + (variant || "primary"));
    button.textContent = text;
    button.style.cssText =
      "border:0;padding:8px 10px;border-radius:5px;cursor:pointer;" +
      "font-size:12px;font-weight:700;line-height:1.15;background:" +
      (colors[variant || "primary"] || colors.primary) +
      ";color:white;min-height:34px;";
    button.addEventListener("click", () => {
      try {
        const result = onclick();
        if (result && typeof result.catch === "function") {
          result.catch((error) => log(error.message || String(error), "error"));
        }
      } catch (error) {
        log(error.message || String(error), "error");
      }
    });
    return button;
  }

  function createSmallUtilityButton(text, title, onclick) {
    const button = createButton(text, onclick, "neutral");
    button.title = title || text;
    button.style.cssText =
      "border:1px solid #5b6b7d;padding:0 8px;border-radius:5px;cursor:pointer;" +
      "font-size:11px;font-weight:800;line-height:1;background:#1f2d3a;color:#e8f0f7;" +
      "height:34px;min-width:54px;white-space:nowrap;";
    return button;
  }

  function createAgravoActionGroup() {
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:stretch;";

    const mainButton = createButton("Cadastrar Agravo", startAgravoInstrumentoRegistration, "neutral");
    const copyButton = createSmallUtilityButton("Copiar", "Copiar novamente a ultima tabela do Agravo", copyStoredAgravoTable);

    wrapper.appendChild(mainButton);
    wrapper.appendChild(copyButton);
    return wrapper;
  }

  function selectValues(select) {
    if (!select) return [];
    return Array.from(select.selectedOptions || [])
      .map((option) => option.value)
      .filter(Boolean);
  }

  function fillSelectOptions(select, values, placeholder, selectedValues) {
    if (!select) return [];

    const cleanValues = uniqueSorted(values);
    const previous = new Set(selectionArray(selectedValues));
    select.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    placeholderOption.disabled = true;
    select.appendChild(placeholderOption);

    cleanValues.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = previous.has(value);
      select.appendChild(option);
    });

    return cleanValues.filter((value) => previous.has(value));
  }

  function styleCorrectionSelect(select) {
    select.multiple = true;
    select.size = 3;
    select.title = "Use Ctrl+clique para selecionar mais de uma opcao.";
    select.style.cssText =
      "width:100%;border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
      "font-size:11px;font-weight:700;padding:5px 7px;min-height:68px;max-height:78px;outline:none;";
  }

  function setCorrectionSelectDisabled(select, disabled) {
    if (!select) return;
    select.disabled = Boolean(disabled);
    select.style.opacity = select.disabled ? ".55" : "1";
  }

  function setCorrectionOpenButtonState(button, enabled) {
    if (!button) return;
    button.disabled = !enabled;
    button.style.opacity = enabled ? "1" : ".55";
    button.style.cursor = enabled ? "pointer" : "not-allowed";
  }

  function refreshCorrectionFlowControls() {
    const fieldsContainer = document.querySelector("#spa-cdsp-correction-fields");
    const count = document.querySelector("#spa-cdsp-correction-count");
    const openButton = document.querySelector("#spa-cdsp-correction-open");
    if (!fieldsContainer) return;

    const records = state.correctionRecords || [];
    const filters = state.correctionFilters;
    const order = normalizeCorrectionFilterOrder((state.correctionFilterOrder || []).join(","));
    const available = new Set(state.correctionAvailableFilterKeys || []);
    state.correctionFilterOrder = order;

    order.forEach((key) => {
      const group = fieldsContainer.querySelector('[data-filter-key="' + key + '"]');
      if (!group) return;
      group.hidden = !available.has(key);
      group.style.display = available.has(key) ? "grid" : "none";
      if (available.has(key)) fieldsContainer.appendChild(group);
    });

    order.forEach((key, index) => {
      const definition = CORRECTION_FILTER_DEFINITIONS[key];
      if (!definition) return;

      const select = document.querySelector("#spa-cdsp-correction-" + key);
      if (!select) return;
      if (!available.has(key)) {
        filters[definition.stateKey] = fillSelectOptions(select, [], "", []);
        setCorrectionSelectDisabled(select, true);
        return;
      }

      const previousKeys = order.slice(0, index);
      const availableRecords = recordsMatchingCorrectionFilterKeys(records, previousKeys);
      const values = availableRecords.map((record) => record[definition.recordKey]);
      const placeholder = records.length ? definition.placeholder : "Atualize os filtros";
      filters[definition.stateKey] = fillSelectOptions(
        select,
        values,
        placeholder,
        filters[definition.stateKey]
      );
      setCorrectionSelectDisabled(select, !records.length);
    });

    const filtered = filteredCorrectionRecords();
    if (count) {
      const selectedLabels = selectedCorrectionFilterKeys()
        .map((key) => CORRECTION_FILTER_DEFINITIONS[key] && CORRECTION_FILTER_DEFINITIONS[key].label)
        .filter(Boolean);
      count.textContent = records.length
        ? selectedCorrectionFiltersReady()
          ? filtered.length + " processo(s)" + (selectedLabels.length ? " · " + selectedLabels.join(", ") : " · sem filtros")
          : records.length + " processo(s) lidos"
        : "Sem leitura";
    }

    setCorrectionOpenButtonState(openButton, selectedCorrectionFiltersReady() && filtered.length > 0);
  }

  function createCorrectionSelect(id) {
    const select = document.createElement("select");
    select.id = id;
    styleCorrectionSelect(select);
    return select;
  }

  function correctionFilterOrderFromDom(container) {
    return normalizeCorrectionFilterOrder(
      Array.from(container.querySelectorAll("[data-filter-key]"))
        .map((element) => element.dataset.filterKey || "")
        .join(",")
    );
  }

  function correctionFilterInsertBeforeElement(container, y) {
    const items = Array.from(
      container.querySelectorAll("[data-filter-key]:not(.spa-cdsp-correction-filter-dragging)")
    );
    return items.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  function enableCorrectionFilterDrag(container) {
    if (!container || container.dataset.dragReady === "1") return;
    container.dataset.dragReady = "1";

    container.addEventListener("dragover", (event) => {
      const dragging = container.querySelector(".spa-cdsp-correction-filter-dragging");
      if (!dragging) return;
      event.preventDefault();
      const before = correctionFilterInsertBeforeElement(container, event.clientY);
      if (before) container.insertBefore(dragging, before);
      else container.appendChild(dragging);
    });

    container.addEventListener("drop", (event) => {
      event.preventDefault();
      state.correctionFilterOrder = storeCorrectionFilterOrder(correctionFilterOrderFromDom(container));
      refreshCorrectionFlowControls();
    });
  }

  function createCorrectionFilterGroup(key, select) {
    const definition = CORRECTION_FILTER_DEFINITIONS[key];
    const group = document.createElement("div");
    group.dataset.filterKey = key;
    group.draggable = true;
    group.style.cssText =
      "display:grid;grid-template-columns:1fr;gap:4px;margin:0;padding:6px;border:1px solid #2b3a4a;" +
      "border-radius:6px;background:#0c1219;color:#b8c6d1;font-size:10px;font-weight:800;";

    const label = document.createElement("span");
    label.textContent = "↕ " + (definition ? definition.label : key);
    label.style.cssText = "cursor:grab;user-select:none;";

    label.addEventListener("mousedown", () => {
      group.draggable = true;
    });

    select.addEventListener("mousedown", () => {
      group.draggable = false;
    });

    select.addEventListener("blur", () => {
      group.draggable = true;
    });

    group.addEventListener("dragstart", (event) => {
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", key);
      }
      group.classList.add("spa-cdsp-correction-filter-dragging");
      group.style.opacity = ".55";
    });

    group.addEventListener("dragend", () => {
      group.classList.remove("spa-cdsp-correction-filter-dragging");
      group.style.opacity = "1";
      if (group.parentElement) {
        state.correctionFilterOrder = storeCorrectionFilterOrder(correctionFilterOrderFromDom(group.parentElement));
        refreshCorrectionFlowControls();
      }
    });

    group.appendChild(label);
    group.appendChild(select);
    return group;
  }

  function createCorrectionSourceChooser() {
    const wrapper = document.createElement("div");
    const pendencyLabel = document.createElement("label");
    const minuteLabel = document.createElement("label");
    const pendencyInput = document.createElement("input");
    const minuteInput = document.createElement("input");

    wrapper.style.cssText =
      "display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0;";

    function styleSourceLabel(label) {
      label.style.cssText =
        "display:flex;align-items:center;gap:6px;border:1px solid #344253;border-radius:5px;" +
        "background:#0d131a;color:#e8f0f7;font-size:10px;font-weight:800;line-height:1.15;" +
        "padding:7px 8px;cursor:pointer;user-select:none;";
    }

    pendencyInput.type = "checkbox";
    minuteInput.type = "checkbox";
    pendencyInput.style.margin = "0";
    minuteInput.style.margin = "0";

    styleSourceLabel(pendencyLabel);
    styleSourceLabel(minuteLabel);
    pendencyLabel.appendChild(pendencyInput);
    pendencyLabel.appendChild(document.createTextNode("Tela da pendência"));
    minuteLabel.appendChild(minuteInput);
    minuteLabel.appendChild(document.createTextNode("Tela da Minuta"));

    function setSource(source) {
      const normalizedSource = normalizeCorrectionActionSource(source);
      pendencyInput.checked = normalizedSource === "pendencia";
      minuteInput.checked = normalizedSource === "minuta";
    }

    pendencyInput.addEventListener("change", () => {
      setSource(pendencyInput.checked ? "pendencia" : "minuta");
    });
    minuteInput.addEventListener("change", () => {
      setSource(minuteInput.checked ? "minuta" : "pendencia");
    });

    setSource(defaultCorrectionActionSource());
    wrapper.appendChild(pendencyLabel);
    wrapper.appendChild(minuteLabel);

    return {
      element: wrapper,
      value: () => (minuteInput.checked ? "minuta" : "pendencia")
    };
  }

  function createCorrectionActionSourcePanel(title, runLabel, handler) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const inner = document.createElement("div");
    const sourceChooser = createCorrectionSourceChooser();
    const runButton = createButton(runLabel || "Executar", () => handler(sourceChooser.value()), "primary");

    details.style.cssText =
      "border:1px solid #344253;border-radius:6px;background:#0c1219;overflow:hidden;";
    summary.textContent = title;
    summary.style.cssText =
      "cursor:pointer;list-style:none;border:0;padding:8px 10px;background:#425466;color:white;" +
      "font-size:12px;font-weight:700;line-height:1.15;text-align:center;";
    inner.style.cssText = "display:grid;grid-template-columns:1fr;gap:6px;padding:6px;";

    inner.appendChild(sourceChooser.element);
    inner.appendChild(runButton);
    details.appendChild(summary);
    details.appendChild(inner);
    return details;
  }

  function createSimpleClosureSelect(id, placeholder) {
    const select = document.createElement("select");
    select.id = id;
    select.style.cssText =
      "width:100%;border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
      "font-size:11px;font-weight:700;padding:7px 8px;min-height:34px;outline:none;";

    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.appendChild(option);
    return select;
  }

  function fillSimpleClosureSelect(select, placeholder, options) {
    if (!select) return;
    const selected = select.value;
    select.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);

    (Array.isArray(options) ? options : []).forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      if (item.value === selected) option.selected = true;
      select.appendChild(option);
    });
  }

  function createSimpleClosureLabeledField(labelText, input) {
    const label = document.createElement("label");
    label.style.cssText =
      "display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:6px;color:#b8c6d1;" +
      "font-size:11px;font-weight:800;";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = labelText;

    input.style.cssText =
      "width:100%;border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
      "font-size:12px;font-weight:700;padding:7px 8px;outline:none;min-height:34px;";

    label.appendChild(labelSpan);
    label.appendChild(input);
    return label;
  }

  function createSimpleClosureCheckbox(text) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const span = document.createElement("span");

    input.type = "checkbox";
    input.style.margin = "0";
    span.textContent = text;
    span.style.cssText = "min-width:0;";
    label.style.cssText =
      "display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:start;" +
      "border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
      "font-size:11px;font-weight:700;line-height:1.25;padding:7px 8px;cursor:pointer;";
    label.appendChild(input);
    label.appendChild(span);
    return { label, input };
  }

  function createSimpleClosureSection() {
    const section = document.createElement("details");
    section.id = "spa-cdsp-simple-closure-flow";
    section.style.cssText =
      "margin-top:8px;border:1px solid #344253;border-radius:6px;background:#101821;overflow:hidden;";

    const summary = document.createElement("summary");
    summary.textContent = "Simples Encerramento";
    summary.style.cssText =
      "cursor:pointer;list-style:none;padding:8px 9px;background:#1f2d3a;color:#e8f0f7;" +
      "font-size:12px;font-weight:800;line-height:1.2;";

    const body = document.createElement("div");
    body.style.cssText = "display:grid;grid-template-columns:1fr;gap:7px;padding:8px;";
    const state = { values: Object.create(null), checks: Object.create(null) };

    const typeLabel = document.createElement("label");
    typeLabel.style.cssText = "display:grid;grid-template-columns:1fr;gap:4px;color:#b8c6d1;font-size:10px;font-weight:800;";
    const typeTitle = document.createElement("span");
    typeTitle.textContent = "Tipo do Simples Encerramento";
    const typeSelect = createSimpleClosureSelect("spa-cdsp-simple-closure-type", "Selecione...");
    fillSimpleClosureSelect(
      typeSelect,
      "Selecione...",
      Object.keys(SIMPLE_CLOSURE_TYPES).map((key) => ({ value: key, label: SIMPLE_CLOSURE_TYPES[key].label }))
    );
    typeLabel.appendChild(typeTitle);
    typeLabel.appendChild(typeSelect);

    const pieceLabel = document.createElement("label");
    pieceLabel.style.cssText = "display:none;grid-template-columns:1fr;gap:4px;color:#b8c6d1;font-size:10px;font-weight:800;";
    const pieceTitle = document.createElement("span");
    pieceTitle.textContent = "Tipo da Pe\u00e7a";
    const pieceSelect = createSimpleClosureSelect("spa-cdsp-simple-closure-piece", "Selecione...");
    pieceLabel.appendChild(pieceTitle);
    pieceLabel.appendChild(pieceSelect);

    const fields = document.createElement("div");
    fields.style.cssText = "display:none;grid-template-columns:1fr;gap:6px;";
    const deadlineHint = document.createElement("div");
    deadlineHint.style.cssText =
      "display:none;padding:7px 8px;border:1px solid #2f766e;border-radius:5px;background:#0d2526;color:#d8f1ed;font-size:11px;font-weight:800;line-height:1.3;";

    const checklistBox = document.createElement("div");
    checklistBox.style.cssText = "display:none;grid-template-columns:1fr;gap:6px;";
    const checklistTitle = document.createElement("div");
    checklistTitle.textContent = "Checklist";
    checklistTitle.style.cssText =
      "padding:7px 8px;border:1px solid #344253;border-radius:5px;background:#1f2d3a;color:#e8f0f7;" +
      "font-size:12px;font-weight:800;text-align:center;";

    const actions = document.createElement("div");
    actions.style.cssText = "display:none;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:stretch;";
    const generateButton = createButton("Gerar Simples Encerramento", async () => {
      const model = selectedModel();
      if (!model || !canGenerate(model)) return;
      const outputValues = simpleClosureValuesForOutput(model, state.values, pieceSelect.value);
      const items = model.lines
        .map((line) => ({ text: interpolateSimpleClosureText(line, outputValues), level: 0 }))
        .filter((item) => item.text);
      activeChecks(model).forEach((item) => {
        if (state.checks[item.key] && !item.uiOnly) {
          items.push({ text: interpolateSimpleClosureText(item.text, outputValues), level: item.level || 1 });
        }
      });
      const payload = await generateSimpleClosureText({
        closureType: SIMPLE_CLOSURE_TYPES[typeSelect.value].label,
        piece: pieceSelect.value,
        items
      });
      try {
        await startSimpleClosureDocumentAction(typeSelect.value, payload);
      } catch (error) {
        window.localStorage.removeItem(SIMPLE_CLOSURE_ACTION_KEY);
        const detail = error && error.message ? error.message : String(error);
        setStatus("Simples Encerramento falhou");
        log("Erro ao abrir minuta de Simples Encerramento: " + detail, "error");
        window.alert("Nao foi possivel concluir a abertura da minuta de Simples Encerramento.\n\n" + detail);
      }
    }, "primary");
    const copyButton = createSmallUtilityButton("Copiar", "Copiar novamente o ultimo Simples Encerramento", copyStoredSimpleClosureText);
    actions.appendChild(generateButton);
    actions.appendChild(copyButton);

    function selectedModel() {
      return simpleClosureModel(typeSelect.value, pieceSelect.value);
    }

    function activeFields(model) {
      return (model && model.fields ? model.fields : []).filter((field) => !field.when || field.when(state.values));
    }

    function activeChecks(model) {
      return (model && model.checks ? model.checks : []).filter((item) => !item.when || item.when(state.values));
    }

    function fieldsComplete(model) {
      return activeFields(model).every((field) => simpleClosureFieldIsComplete(field, state.values));
    }

    function canGenerate(model) {
      const checks = activeChecks(model);
      const exclusiveGroups = new Map();
      const individualChecks = checks.filter((item) => {
        if (!item.exclusiveGroup) return true;
        const group = exclusiveGroups.get(item.exclusiveGroup) || [];
        group.push(item);
        exclusiveGroups.set(item.exclusiveGroup, group);
        return false;
      });
      const individualComplete = individualChecks.every((item) => !item.required || state.checks[item.key]);
      const exclusiveComplete = Array.from(exclusiveGroups.values()).every((group) => {
        const required = group.some((item) => item.required);
        return !required || group.some((item) => state.checks[item.key]);
      });
      return fieldsComplete(model) && individualComplete && exclusiveComplete;
    }

    function createFieldControl(field) {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "display:grid;grid-template-columns:1fr;gap:4px;";
      const label = document.createElement("div");
      label.textContent = field.label;
      label.style.cssText = "color:#b8c6d1;font-size:10px;font-weight:800;";
      wrapper.appendChild(label);

      if (field.type === "choice") {
        const choices = document.createElement("div");
        choices.style.cssText = "display:grid;grid-template-columns:1fr;gap:4px;";
        (field.options || []).forEach((option) => {
          const optionLabel = document.createElement("label");
          const input = document.createElement("input");
          const text = document.createElement("span");
          input.type = "radio";
          input.name = "spa-cdsp-simple-closure-" + field.key;
          input.value = option.value;
          input.checked = state.values[field.key] === option.value;
          input.style.margin = "1px 0 0";
          text.textContent = option.label;
          optionLabel.style.cssText =
            "display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:start;border:1px solid #344253;" +
            "border-radius:5px;background:#0d131a;color:#e8f0f7;font-size:11px;font-weight:700;line-height:1.25;padding:7px 8px;cursor:pointer;";
          optionLabel.appendChild(input);
          optionLabel.appendChild(text);
          input.addEventListener("change", () => {
            state.values[field.key] = option.value;
            refresh();
          });
          choices.appendChild(optionLabel);
        });
        wrapper.appendChild(choices);
        return wrapper;
      }

      const input = document.createElement(field.type === "textarea" ? "textarea" : "input");
      if (field.type !== "textarea") input.type = "text";
      input.dataset.simpleClosureField = field.key;
      input.value = state.values[field.key] || "";
      input.autocomplete = "off";
      input.placeholder = field.type === "date" ? "dd/mm/aaaa" : field.type === "cnj" ? "0000000-00.0000.0.00.0000" : field.label;
      if (field.type === "date") {
        input.inputMode = "numeric";
        input.maxLength = 10;
      }
      if (field.type === "cnj") {
        input.inputMode = "numeric";
        input.maxLength = 25;
      }
      if (field.type === "textarea") input.rows = 3;
      input.style.cssText =
        "width:100%;box-sizing:border-box;border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
        "font-size:12px;font-weight:700;padding:7px 8px;outline:none;min-height:" + (field.type === "textarea" ? "72px" : "34px") + ";resize:vertical;";
      input.addEventListener("input", () => {
        let value = input.value;
        if (field.type === "date") value = formatBrazilianDateInput(value);
        if (field.type === "cnj") value = formatSimpleClosureProcessNumber(value);
        if (input.value !== value) input.value = value;
        state.values[field.key] = value;
        refresh();
      });
      wrapper.appendChild(input);
      return wrapper;
    }

    function renderFields(model) {
      fields.innerHTML = "";
      const modelFields = activeFields(model);
      let showNext = true;
      modelFields.forEach((field) => {
        if (!showNext) return;
        fields.appendChild(createFieldControl(field));
        showNext = simpleClosureFieldIsComplete(field, state.values);
      });
      fields.style.display = model ? "grid" : "none";

      const outputValues = model ? simpleClosureValuesForOutput(model, state.values, pieceSelect.value) : {};
      deadlineHint.style.display = outputValues.deadline ? "block" : "none";
      deadlineHint.textContent = outputValues.deadline ? "Prazo calculado: " + outputValues.deadline + ". A contagem inicia no dia seguinte \u00e0 intima\u00e7\u00e3o." : "";
    }

    function renderChecklist(model) {
      checklistBox.innerHTML = "";
      const complete = fieldsComplete(model);
      const checks = activeChecks(model);
      checklistBox.style.display = model && complete && checks.length ? "grid" : "none";
      if (!model || !complete || !checks.length) return;
      checklistBox.appendChild(checklistTitle);
      checks.forEach((item) => {
        if (item.uiOnly) {
          const warning = document.createElement("div");
          warning.textContent = item.warning || item.text;
          warning.style.cssText =
            "margin-left:" + String((item.level || 1) * 12) + "px;color:#ff8f8f;font-size:11px;font-weight:800;line-height:1.3;";
          checklistBox.appendChild(warning);
          return;
        }
        const label = document.createElement("label");
        const input = document.createElement("input");
        const text = document.createElement("span");
        input.type = item.exclusiveGroup ? "radio" : "checkbox";
        if (item.exclusiveGroup) input.name = "spa-cdsp-simple-closure-check-" + item.exclusiveGroup;
        input.checked = Boolean(state.checks[item.key]);
        input.style.margin = "1px 0 0";
        text.textContent = item.text;
        label.style.cssText =
          "display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:start;margin-left:" + String(Math.max(0, (item.level || 1) - 1) * 12) + "px;" +
          "border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;font-size:11px;font-weight:700;line-height:1.25;padding:7px 8px;cursor:pointer;";
        label.appendChild(input);
        label.appendChild(text);
        input.addEventListener("change", () => {
          if (item.exclusiveGroup && input.checked) {
            activeChecks(model).forEach((candidate) => {
              if (candidate.exclusiveGroup === item.exclusiveGroup) state.checks[candidate.key] = false;
            });
          }
          state.checks[item.key] = input.checked;
          refresh();
        });
        checklistBox.appendChild(label);
        if (item.warning) {
          const warning = document.createElement("div");
          warning.textContent = item.warning;
          warning.style.cssText = "margin-left:12px;color:#ff8f8f;font-size:11px;font-weight:800;line-height:1.3;";
          checklistBox.appendChild(warning);
        }
      });
    }

    function setGenerateEnabled(enabled) {
      generateButton.disabled = !enabled;
      generateButton.style.opacity = enabled ? "1" : ".55";
      generateButton.style.cursor = enabled ? "pointer" : "not-allowed";
    }

    function clearInactiveValues(model) {
      const activeKeys = new Set(activeFields(model).map((field) => field.key));
      Object.keys(state.values).forEach((key) => {
        if (!activeKeys.has(key)) delete state.values[key];
      });
      const activeCheckKeys = new Set(activeChecks(model).map((item) => item.key));
      Object.keys(state.checks).forEach((key) => {
        if (!activeCheckKeys.has(key)) delete state.checks[key];
      });
    }

    function refresh() {
      const focused = document.activeElement;
      const focusedKey = focused && focused.dataset ? focused.dataset.simpleClosureField : "";
      const focusedStart = focused && typeof focused.selectionStart === "number" ? focused.selectionStart : null;
      const focusedEnd = focused && typeof focused.selectionEnd === "number" ? focused.selectionEnd : null;
      const typeKey = typeSelect.value;
      const model = selectedModel();
      pieceLabel.style.display = typeKey ? "grid" : "none";
      clearInactiveValues(model);
      renderFields(model);
      renderChecklist(model);
      actions.style.display = model ? "grid" : "none";
      setGenerateEnabled(Boolean(model) && canGenerate(model));
      if (focusedKey) {
        const replacement = fields.querySelector('[data-simple-closure-field="' + focusedKey + '"]');
        if (replacement) {
          replacement.focus();
          if (focusedStart !== null && typeof replacement.setSelectionRange === "function") {
            const end = focusedEnd === null ? focusedStart : focusedEnd;
            replacement.setSelectionRange(Math.min(focusedStart, replacement.value.length), Math.min(end, replacement.value.length));
          }
        }
      }
    }

    typeSelect.addEventListener("change", () => {
      state.values = Object.create(null);
      state.checks = Object.create(null);
      pieceSelect.value = "";
      fillSimpleClosureSelect(
        pieceSelect,
        "Selecione...",
        simpleClosurePieceOptions(typeSelect.value).map((label) => ({ value: label, label }))
      );
      refresh();
    });
    pieceSelect.addEventListener("change", () => {
      state.values = Object.create(null);
      state.checks = Object.create(null);
      refresh();
    });

    body.appendChild(typeLabel);
    body.appendChild(pieceLabel);
    body.appendChild(fields);
    body.appendChild(deadlineHint);
    body.appendChild(checklistBox);
    body.appendChild(actions);
    section.appendChild(summary);
    section.appendChild(body);
    refresh();
    return section;
  }

  function createCorrectionFlowSection() {
    const section = document.createElement("details");
    section.id = "spa-cdsp-correction-flow";
    section.style.cssText =
      "margin-top:8px;border:1px solid #344253;border-radius:6px;background:#101821;overflow:hidden;";

    const summary = document.createElement("summary");
    summary.textContent = "Fluxo de Correção";
    summary.style.cssText =
      "cursor:pointer;list-style:none;padding:8px 9px;background:#1f2d3a;color:#e8f0f7;" +
      "font-size:12px;font-weight:800;line-height:1.2;";
    section.appendChild(summary);

    const body = document.createElement("div");
    body.style.cssText = "display:grid;grid-template-columns:1fr;gap:6px;padding:8px;";

    const refreshButton = createButton("Atualizar filtros", refreshCorrectionFlowRecords, "neutral");
    const orderHint = document.createElement("div");
    orderHint.textContent = "Arraste os filtros para mudar a ordem. Campos vazios sao ignorados.";
    orderHint.style.cssText =
      "padding:6px 7px;border:1px solid #2b3a4a;border-radius:5px;background:#0c1219;color:#b8c6d1;" +
      "font-size:10px;font-weight:700;line-height:1.25;text-align:center;";

    const filterFields = document.createElement("div");
    filterFields.id = "spa-cdsp-correction-fields";
    filterFields.style.cssText = "display:grid;grid-template-columns:1fr;gap:6px;";

    const assessorSelect = createCorrectionSelect("spa-cdsp-correction-assessors");
    const judgingBodySelect = createCorrectionSelect("spa-cdsp-correction-judgingBodies");
    const activePoleSelect = createCorrectionSelect("spa-cdsp-correction-activePoles");
    const manifestationSelect = createCorrectionSelect("spa-cdsp-correction-manifestations");
    const receivedPeriodSelect = createCorrectionSelect("spa-cdsp-correction-receivedPeriods");
    filterFields.appendChild(createCorrectionFilterGroup("assessors", assessorSelect));
    filterFields.appendChild(createCorrectionFilterGroup("judgingBodies", judgingBodySelect));
    filterFields.appendChild(createCorrectionFilterGroup("manifestations", manifestationSelect));
    filterFields.appendChild(createCorrectionFilterGroup("activePoles", activePoleSelect));
    filterFields.appendChild(createCorrectionFilterGroup("receivedPeriods", receivedPeriodSelect));

    const openButton = createButton("Abrir", startCorrectionOpenFlow, "primary");
    openButton.id = "spa-cdsp-correction-open";
    enableCorrectionFilterDrag(filterFields);

    [
      ["assessors", assessorSelect],
      ["judgingBodies", judgingBodySelect],
      ["activePoles", activePoleSelect],
      ["manifestations", manifestationSelect],
      ["receivedPeriods", receivedPeriodSelect]
    ].forEach(([key, select]) => {
      select.addEventListener("change", () => {
        const definition = CORRECTION_FILTER_DEFINITIONS[key];
        if (!definition) return;
        state.correctionFilters[definition.stateKey] = selectValues(select);
        refreshCorrectionFlowControls();
      });
    });

    const count = document.createElement("div");
    count.id = "spa-cdsp-correction-count";
    count.style.cssText = "font-size:11px;color:#b8c6d1;text-align:center;margin-top:-1px;";

    const sendButtons = document.createElement("div");
    sendButtons.style.cssText = "display:grid;grid-template-columns:1fr;gap:6px;border-top:1px solid #344253;padding-top:6px;";
    sendButtons.appendChild(
      createCorrectionActionSourcePanel("Enviar ao procurador", "Executar envio", startSendToProcurador)
    );
    sendButtons.appendChild(
      createCorrectionActionSourcePanel("Sugerir encerramento de tarefa", "Executar encerramento", startSuggestClosureFromCorrection)
    );

    const returnBox = document.createElement("details");
    returnBox.id = "spa-cdsp-correction-return-box";
    returnBox.style.cssText =
      "border:1px solid #344253;border-radius:6px;background:#0c1219;overflow:hidden;";

    const returnSummary = document.createElement("summary");
    returnSummary.textContent = "Devolver ao assessor";
    returnSummary.style.cssText =
      "cursor:pointer;list-style:none;border:0;padding:8px 10px;background:#425466;color:white;" +
      "font-size:12px;font-weight:700;line-height:1.15;text-align:center;";

    const returnInner = document.createElement("div");
    returnInner.style.cssText = "display:grid;grid-template-columns:1fr;gap:6px;padding:6px;";
    const returnSourceChooser = createCorrectionSourceChooser();

    const returnSearch = document.createElement("input");
    returnSearch.type = "search";
    returnSearch.id = "spa-cdsp-correction-return-search";
    returnSearch.placeholder = "Pesquisar assessor...";
    returnSearch.style.cssText =
      "width:100%;border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
      "font-size:11px;font-weight:700;padding:7px 8px;outline:none;";

    const returnSelect = createCorrectionSelect("spa-cdsp-correction-return-assessor");
    returnSelect.size = 5;
    returnSelect.multiple = false;
    returnSelect.title = "Selecione a pessoa que recebera a devolucao.";
    const runReturnButton = createButton(
      "Salvar devolução",
      () => startReturnToAssessor(returnSelect.value, returnSourceChooser.value(), returnObservation.value),
      "primary"
    );
    const returnObservation = document.createElement("input");
    returnObservation.type = "text";
    returnObservation.id = "spa-cdsp-correction-return-observation";
    returnObservation.placeholder = "Observação (opcional)";
    returnObservation.autocomplete = "off";
    returnObservation.style.cssText =
      "width:100%;border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
      "font-size:11px;font-weight:700;padding:7px 8px;outline:none;box-sizing:border-box;";

    function refreshReturnAssessorOptions() {
      const query = normalizeKey(returnSearch.value);
      const previous = returnSelect.value;
      const ready = state.activeTeamLoaded && state.activeTeamNames.length > 0;
      returnSelect.innerHTML = "";
      state.activeTeamNames.filter((name) => !query || normalizeKey(name).indexOf(query) >= 0).forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        option.selected = previous === name;
        returnSelect.appendChild(option);
      });
      if (!returnSelect.value && returnSelect.options.length) returnSelect.options[0].selected = true;
      returnSearch.disabled = !ready;
      returnSelect.disabled = !ready;
      runReturnButton.disabled = !ready;
      runReturnButton.style.opacity = ready ? "1" : ".55";
      runReturnButton.style.cursor = ready ? "pointer" : "not-allowed";
    }

    returnSearch.addEventListener("input", refreshReturnAssessorOptions);
    refreshReturnAssessorOptions();

    returnInner.appendChild(returnSourceChooser.element);
    returnInner.appendChild(returnSearch);
    returnInner.appendChild(returnSelect);
    returnInner.appendChild(returnObservation);
    returnInner.appendChild(runReturnButton);
    returnBox.appendChild(returnSummary);
    returnBox.appendChild(returnInner);
    sendButtons.appendChild(returnBox);

    body.appendChild(refreshButton);
    body.appendChild(orderHint);
    body.appendChild(filterFields);
    body.appendChild(openButton);
    body.appendChild(count);
    body.appendChild(sendButtons);
    section.appendChild(body);

    window.setTimeout(() => {
      refreshCorrectionFlowControls();
      loadCorrectionActiveTeam()
        .then(refreshReturnAssessorOptions)
        .catch(() => {
          refreshReturnAssessorOptions();
          return null;
        });
    }, 0);
    return section;
  }

  function readPanelPosition() {
    try {
      const raw = window.localStorage.getItem(PANEL_POSITION_KEY);
      if (!raw) return null;
      const position = JSON.parse(raw);
      const left = Number(position.left);
      const top = Number(position.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
      return { left, top };
    } catch (_error) {
      return null;
    }
  }

  function clampPanelPosition(panel, left, top) {
    const margin = 8;
    const width = panel && panel.offsetWidth ? panel.offsetWidth : 370;
    const height = panel && panel.offsetHeight ? panel.offsetHeight : 80;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);

    return {
      left: Math.min(Math.max(margin, left), maxLeft),
      top: Math.min(Math.max(margin, top), maxTop)
    };
  }

  function positionPanelAt(panel, left, top) {
    const position = clampPanelPosition(panel, left, top);
    panel.style.left = position.left + "px";
    panel.style.top = position.top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    return position;
  }

  function savePanelPosition(panel) {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const position = clampPanelPosition(panel, rect.left, rect.top);
    try {
      window.localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(position));
    } catch (_error) {
      // Sem persistencia, o painel continua funcionando na posicao atual.
    }
  }

  function restorePanelPosition(panel) {
    const saved = readPanelPosition();
    if (!saved) return;
    positionPanelAt(panel, saved.left, saved.top);
  }

  function keepPanelInsideViewport(panel) {
    if (!panel || panel.style.right !== "auto" || panel.style.bottom !== "auto") return;
    const rect = panel.getBoundingClientRect();
    const position = positionPanelAt(panel, rect.left, rect.top);
    try {
      window.localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(position));
    } catch (_error) {
      // Ignora falha de armazenamento local.
    }
  }

  function enablePanelDrag(panel, handle) {
    if (!panel || !handle) return;

    let dragState = null;
    handle.title = "Arraste para mover o painel";
    handle.style.cursor = "move";
    handle.style.userSelect = "none";

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest("button,a,input,select,textarea")) return;

      const rect = panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        moved: false
      };

      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Alguns navegadores podem nao permitir captura neste ponto.
      }
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) dragState.moved = true;
      if (!dragState.moved) return;

      positionPanelAt(panel, dragState.left + deltaX, dragState.top + deltaY);
      event.preventDefault();
    });

    function finishDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const moved = dragState.moved;
      dragState = null;

      try {
        handle.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Captura pode ja ter sido liberada.
      }

      if (moved) {
        savePanelPosition(panel);
        panel.dataset.justDragged = "1";
        window.setTimeout(() => {
          delete panel.dataset.justDragged;
        }, 180);
      }
    }

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
    window.addEventListener("resize", () => keepPanelInsideViewport(panel));
  }

  function createPanel() {
    const old = document.querySelector("#" + CONFIG.panelId);
    if (old) old.remove();

    const embeddedHost = document.querySelector("#cdsp-general-module-prazos");
    const embedded = Boolean(embeddedHost);
    const panel = document.createElement("div");
    panel.id = CONFIG.panelId;
    panel.className = embedded ? "cdsp-general-embedded-module cdsp-general-embedded-prazos" : "";
    panel.tabIndex = -1;
    panel.style.cssText = embedded
      ? "position:relative;width:100%;background:#17212b;color:#fff;border:1px solid #344253;" +
        "border-radius:8px;padding:10px;box-shadow:none;font-family:'Segoe UI',Arial,sans-serif;overflow:hidden;"
      : "position:fixed;left:18px;bottom:18px;width:370px;z-index:999996;" +
        "background:#17212b;color:#fff;border-radius:8px;padding:12px;" +
        "box-shadow:0 12px 40px rgba(0,0,0,.35);font-family:Arial,sans-serif;";

    const header = document.createElement("div");
    header.style.cssText = embedded
      ? "display:flex;align-items:center;gap:8px;margin:-10px -10px 8px -10px;padding:9px 10px;" +
        "background:#1f2d3a;border-bottom:1px solid rgba(255,255,255,.08);"
      : "display:flex;justify-content:space-between;align-items:center;gap:8px;";

    const title = document.createElement("div");
    title.textContent = "Redação e Correção";
    title.style.cssText = "font-weight:800;font-size:14px;flex:1;min-width:0;";

    const status = document.createElement("div");
    status.id = "spa-cdsp-deadline-status";
    status.textContent = "Pronto";
    status.style.cssText =
      "font-size:11px;color:#cfd8dc;background:#263544;border-radius:999px;padding:4px 8px;white-space:nowrap;";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.id = "spa-cdsp-deadline-panel-toggle";
    toggleButton.style.cssText =
      "border:1px solid #425466;background:#263544;color:#e3f2fd;border-radius:5px;" +
      "height:26px;min-width:58px;padding:0 7px;cursor:pointer;font-size:11px;font-weight:700;";
    if (embedded) toggleButton.style.display = "none";

    const content = document.createElement("div");
    content.id = "spa-cdsp-deadline-panel-content";

    if (CONFIG.headerImageUrl) {
      const brand = document.createElement("div");
      brand.className = "cdsp-module-brand";
      brand.style.cssText =
        "display:flex;align-items:center;justify-content:center;margin:8px 0 8px 0;" +
        "padding:6px;border:1px solid #344253;border-radius:6px;background:#1f2d3a;line-height:0;";
      const logo = document.createElement("img");
      logo.src = CONFIG.headerImageUrl;
      logo.alt = "CDSP PGE-MT";
      logo.style.cssText =
        "display:block;width:100%;height:auto;max-height:58px;object-fit:contain;";
      brand.appendChild(logo);
      content.appendChild(brand);
    }

    const actions = document.createElement("div");
    actions.style.cssText = "display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px;";
    actions.appendChild(createButton("Gerar relat\u00f3rio", generateSelectedScreenReport, "primary"));
    actions.appendChild(createAgravoActionGroup());
    actions.children[0].dataset.mtprevRadialOption = actions.children[0].textContent.trim();
    actions.children[1].dataset.mtprevRadialOption = "Cadastrar Agravo";

    const logBox = document.createElement("div");
    logBox.id = "spa-cdsp-deadline-log";
    logBox.style.cssText =
      "height:125px;overflow:auto;background:#0d131a;border:1px solid #344253;border-radius:6px;padding:7px;margin-top:8px;" +
      "color:#d5e5f2;font-family:Consolas,monospace;font-size:11px;line-height:1.35;";

    function setPanelCollapsed(collapsed) {
      if (embedded) collapsed = false;
      panel.dataset.collapsed = collapsed ? "1" : "0";
      content.style.display = collapsed ? "none" : "";
      status.style.display = collapsed ? "none" : "";
      toggleButton.textContent = collapsed ? "Abrir" : "Ocultar";
      toggleButton.title = collapsed ? "Abrir controle de prazos" : "Recolher controle de prazos";
      panel.style.width = embedded ? "100%" : collapsed ? "240px" : "370px";
      panel.style.padding = embedded ? "10px" : collapsed ? "8px 10px" : "12px";
      panel.style.cursor = "default";
      if (!embedded) window.setTimeout(() => keepPanelInsideViewport(panel), 0);
    }

    toggleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setPanelCollapsed(panel.dataset.collapsed !== "1");
    });

    header.addEventListener("click", () => {
      if (panel.dataset.justDragged === "1") return;
      if (panel.dataset.collapsed === "1") setPanelCollapsed(false);
    });

    header.appendChild(title);
    header.appendChild(status);
    header.appendChild(toggleButton);

    content.appendChild(actions);
    const correctionSection = createCorrectionFlowSection();
    correctionSection.dataset.mtprevRadialOption = "Fluxo de Correção";
    content.appendChild(correctionSection);
    const closureSection = createSimpleClosureSection();
    closureSection.dataset.mtprevRadialOption = "Simples Encerramento";
    content.appendChild(closureSection);
    content.appendChild(logBox);

    panel.appendChild(header);
    panel.appendChild(content);
    (embedded ? embeddedHost : document.body).appendChild(panel);
    setPanelCollapsed(!embedded);
    if (!embedded) {
      restorePanelPosition(panel);
      enablePanelDrag(panel, header);
    }
    log("Painel carregado. Versao " + CONFIG.version + ".", "ok");
  }

  function startPanelWhenReady() {
    if (!document.body) {
      setTimeout(startPanelWhenReady, 250);
      return;
    }
    createPanel();
    removerAgravoInstrumentoButtonSolto();
    repairCorrectionBackHistoryIfNeeded();
    installCorrectionBackLinkRepair();
    setTimeout(() => {
      continuePendingAgravoAction().catch((error) => {
        log("Erro ao continuar cadastro de agravo: " + (error.message || String(error)), "error");
      });
      continuePendingPetitionAction().catch((error) => {
        log("Erro ao continuar elaboracao de peticao: " + (error.message || String(error)), "error");
      });
      continuePendingSimpleClosureAction().catch((error) => {
        window.localStorage.removeItem(SIMPLE_CLOSURE_ACTION_KEY);
        setStatus("Simples Encerramento falhou");
        log("Erro ao abrir minuta de Simples Encerramento: " + (error.message || String(error)), "error");
        window.alert("Nao foi possivel concluir a abertura da minuta de Simples Encerramento.\n\n" + (error.message || String(error)));
      });
      continuePendingCorrectionOpenAction().catch((error) => {
        log("Erro ao continuar fluxo de correcao: " + (error.message || String(error)), "error");
      });
      continuePendingCorrectionSendAction().catch((error) => {
        log("Erro ao continuar envio ao procurador: " + (error.message || String(error)), "error");
      });
      continuePendingCorrectionStepAction().catch((error) => {
        log("Erro ao continuar passo de correcao: " + (error.message || String(error)), "error");
      });
    }, 600);
  }

  window.SPA_CDSP_PRAZOS = {
    config: CONFIG,
    state,
    generateSelectedScreenReport,
    generateSelectedReport,
    collectAllRecords,
    classifyManifestation,
    parseReceivedDays,
    formatReceivedText,
    parseDeadlineDate,
    internalDeadlineForType,
    reportPayload,
    metricExplanationItems,
    internalDeadlineTableRows,
    boxMetrics,
    deadlineStyle,
    generateExcel,
    findPetitionProgressLink,
    continuePendingPetitionAction,
    continuePendingSimpleClosureAction,
    startSimpleClosureDocumentAction,
    refreshCorrectionFlowRecords,
    collectCorrectionRecords,
    filteredCorrectionRecords,
    startCorrectionOpenFlow,
    findViewEditMinuteLink,
    continuePendingCorrectionOpenAction,
    startSendToProcuradorFromMinute,
    startSendToProcuradorFromPendency,
    continuePendingCorrectionSendAction,
    startReturnToAssessor,
    startSuggestClosureFromCorrection,
    continuePendingCorrectionStepAction,
    removerAgravoInstrumentoButtonSolto,
    continuePendingAgravoAction,
    copyStoredAgravoTable,
    buildSimpleClosureHtml,
    buildSimpleClosurePlain,
    copyStoredSimpleClosureText
  };

  startPanelWhenReady();
})();

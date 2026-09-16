(function () {
  "use strict";

  if (window.SPA_CDSP_EXTENSION_PANEL_INITIALIZED) return;
  window.SPA_CDSP_EXTENSION_PANEL_INITIALIZED = true;

  const CONFIG = {
    pageLength: 100,
    delayScienceMs: 1200,
    delayPageMs: 2200,
    delayTabMs: 250,
    delayCloseMs: 1800,
    scienceVerificationRounds: 3,
    scienceVerificationDelayMs: 900,
    dateFilter: {
      enabled: false,
      date: "",
      columnNames: ["Data da Distribuicao", "Data da DistribuiÃ§Ã£o", "Recebido"],
      timeSuffix: " - 00:00",
    },
    filters: {
      tribunalColumn: "tribunal",
      jurisdictionColumn: "jurisdicao",
      cejuscText: "CEJUSC",
    },
    scienceSelector:
      "form.take-consciousness-btn button, " +
      "form.take-consciousness-btn input[type='submit'], " +
      "form.take-consciousness-btn a, " +
      "button.take-consciousness-btn, " +
      "a.take-consciousness-btn, " +
      "input.take-consciousness-btn",
    scienceFallbackSelector: "form.take-consciousness-btn, .take-consciousness-btn",
    rowSelector: "#procedures-box tbody tr.group-item:visible",
    expedienteSelector:
      "a[data-original-title*='Ler Expediente'], " +
      "a[title*='Ler Expediente'], " +
      "a[href*='/coresigner/info/'], " +
      "a[target^='document-'], " +
      "a",
    encerrarMarkerText: "ENCERRAR",
    duplicidadeValidadaMarkerText: "Conferido",
    encerramentoText: "Sugerir encerramento de tarefa",
    encerramentoStepId: "2756",
    extensionOpenTimeoutMs: 6000,
    extensionOpenRetries: 4,
    extensionOpenRetryDelayMs: 700,
    batchOpenDelayMs: 80,
    batchOpenMaxUrls: 80,
    expedienteContentFilters: {
      pauta: "pauta_julgamento",
      negociacao: "negociacao_assincrona",
    },
    expedienteContentFilterTimeoutMs: 120000,
    pieceReportTimeoutMs: 240000,
    autosDocumentSearchTimeoutMs: 90000,
    autosDocumentSearchConcurrency: 10,
    autosDocumentSearchMaxConcurrency: 20,
    processCompleteMergeConcurrency: 4,
    allowBrowserOpenFallback: false,
    processingTimeoutMs: 0,
    processingProgressLogMs: 30000,
  };

  const PIECE_REPORT_CATEGORIES = [
    { key: "contestacao_com_agravo", label: "Contestação c/ agravo", color: "#7a1a1a" },
    { key: "contestacao_sem_agravo", label: "Contestação s/ agravo", color: "#0f6e56" },
    { key: "contestacao_possivel_agravo", label: "Contestação c/ possível agravo", color: "#e65100" },
    { key: "pauta_julgamento", label: "Intimação de Pauta de Julgamento", color: "#185fa5" },
    { key: "negociacao_assincrona", label: "Negociação Assíncrona", color: "#4527a0" },
    { key: "peca_identificar", label: "Peças a identificar", color: "#607d8b" },
  ];

  const PIECE_REPORT_INTERNS = [
    { key: "beatriz", name: "Beatriz Vitoria Miranda Silva Cerqueira" },
    { key: "tacita", name: "Tácita Vitória Pereira Gomes" },
    { key: "matheus", name: "Matheus Augusto Ferreira Brandão" },
    { key: "enzo", name: "Enzo Luiz Sawiski lamin" },
    { key: "gabrielle", name: "Gabrielle Rodrigues Silva Espindola" },
  ];

  const state = {
    running: false,
    stopped: false,
    logs: [],
    selectedPages: new Set(),
    pageSelectionLoaded: false,
    pageBatch: null,
  };

  const EXTENSION_PAGE_SOURCE = "SPA_CDSP_PAGE";
  const EXTENSION_BRIDGE_SOURCE = "SPA_CDSP_EXTENSION_BRIDGE";
  let extensionRequestSeq = 0;
  const extensionPendingRequests = {};
  const VISUAL_CONFIG = Object.assign({ headerImageUrl: "" }, window.SPA_CDSP_TRIAGEM_CONFIG || {});
  const LOG_LIMIT = 120;
  const EXTERNAL_DOCS_OPEN_MINIMIZED_KEY = "SPA_CDSP_EXTERNAL_DOCS_OPEN_MINIMIZED";
  const TRIAGE_CLASSIFICATION_ACTION_KEY = "SPA_CDSP_TRIAGE_CLASSIFICATION_ACTION";
  const TRIAGE_MANIFESTATION_OPTIONS = [
    "Alegações finais", "Agravo ao STF", "Agravo ao STJ", "Agravo de instrumento", "Agravo interno", "Apelação",
    "Audiência", "Contestação", "Contrarrazões", "Contrarrazões à Apelação", "Contrarrazões ao Agravo ao STF",
    "Contrarrazões ao Agravo ao STJ", "Contrarrazões ao Agravo de Instrumento", "Contrarrazões ao Agravo Interno",
    "Contrarrazões ao Recurso Especial", "Contrarrazões ao Recurso Extraordinário", "Contrarrazões ao Recurso Inominado",
    "Contrarrazões aos Embargos de Declaração", "Cumprimento de sentença", "Dispensa de atuação", "Embargos à ação monitória",
    "Embargos à execução", "Embargos de Declaração", "Embargos de divergência", "Embargos de terceiro",
    "Exceção de Pré-Executividade", "Execução de cumprimento de sentença", "Impugnação ao Cumprimento de Sentença",
    "Impugnação ao laudo pericial", "Impugnação aos cálculos", "Impugnação aos Embargos",
    "Incidente de Uniformização de Jurisprudência", "Informações em Mandado de Segurança", "Liquidação de sentença",
    "Manifestação", "Manifestação em Mandado de Segurança", "Manifestação sobre o Precatório", "Manifestação sobre o RPVc",
    "Memoriais", "Pauta de julgamento", "Pedido de liminar ou antecipação de tutela", "Pedido de quebra de sigilo de dados",
    "Petição", "Petição de habilitação nos autos", "Petição de quesitos", "Petição em liquidação de sentença",
    "Petição informando interposição de agravo", "Petição Inicial", "Petição terceiro interessado", "Produção de provas",
    "Recurso adesivo", "Recurso de sentença", "Recurso especial", "Recurso extraordinário", "Recurso inominado",
    "Recurso ordinário", "Sessão de julgamento"
  ];
  const TRIAGE_OFFICE_OBSERVATIONS = [
    { label: "CUMP GERAL", value: "Enviar ofício \"CUMP GERAL\" - Cumprimento de decisão judicial." },
    { label: "CUMP MULTA", value: "Enviar ofício \"CUMP MULTA\" - Cumprimento de decisão judicial c/ incidência de multa." },
    { label: "CUMP SANÇÕES", value: "Enviar ofício \"CUMP SANÇÕES\" - Cumprimento de decisão judicial c/ sanções pessoais." },
    { label: "DESCUMP", value: "Enviar ofício \"DESCUMP\" - Descumprimento de decisão judicial." },
    { label: "SECUND", value: "Enviar ofício \"SECUND\" - Responsabilidade secundária ao Estado." },
    { label: "REQ", value: "Enviar ofício \"REQ\" - Informações Requisitadas pelo Judiciário." },
    { label: "SINF", value: "Enviar ofício \"SINF\" - Solicitação de Informações." },
    { label: "SINF DANO MORAL", value: "Enviar ofício \"SINF DANO MORAL\" - Solicitação de Informações para defesa do Estado em ação de dano moral." },
    { label: "EXME", value: "Enviar ofício \"EXME\" - Modificação de decisão judicial pretérita." },
    { label: "PREST", value: "Enviar ofício \"PREST\" - Prestação de Contas." },
    { label: "Audiência", value: "Enviar ofício \"Audiência\"." },
    { label: "Auxiliar de Turma", value: "Enviar ofício \"SEDUC\" - Pedido de auxiliar de turma e afins para pessoa com deficiência ou com doença." },
    { label: "Avaliação Psicopedagógica", value: "Enviar ofício \"AVALIAÇÃO PSICOPEDAGÓGICA\" - Pedido de avaliação de estudante com dificuldade de aprendizagem." },
    { label: "Medicamento Escolar", value: "Enviar ofício \"MED ESCOLAR\" - Pedido de administração de medicamento em ambiente escolar." },
    { label: "SETASC IDOSO", value: "Enviar ofício \"SETASC IDOSO\" - Pedido de prestação de assistência social a pessoa em situação de vulnerabilidade." },
    { label: "Home Care", value: "Enviar ofício \"HOME CARE\" - Determinação judicial para realização de visita domiciliar." },
    { label: "Alta Médica", value: "Enviar ofício \"ALTA HOME CARE\" - Determinação judicial que deferiu alta médica em serviço de home care." }
  ];

  const HEALTH_LOGO_SRC =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAo4AAADACAMAAAC9HRLnAAADAFBMVEVMaXH///////////////////////////////////////////////////////8BAgULEiUCBAkKESI1V6oAAAEiOG4DBg4wT5ssSI4cL1w0VagJDx4KECELEiUlPXczVKUGCxYzU6QpRIYyUqEkO3QuS5QoQoIxUJ4OGC8QGzYTIUEmP30XJ00WJUoeMWEGChQ2WKwOGDAbLVkqRooZKVItSpEWJEgfM2UvTZcRHTogNWkZKlMNFiwsR5IVI0U1VqowTZ4zU6UuSZklPnowUJwrSI02WKwtRZMeMmQtS5QpPYodMF8jLHf////y8vItZqAgRoc2WKzt7u/x8fFASIg1V6vv7/Dk5OlHTozw8fEkMHw3baTf4OYjLHg0VaksNX1skrkrQZEyUKLq6+0lLnjW2OIzU6fn5+t/oMIwS50jLnoqPItSga8mM4EnNYLb4ujs7O4kLXcmL3lijLYlMn4qP47n6u0tRJQoOIfk5utahrIqM3vp6ewvSJo3P4MnN4QoOokzUqWNkrY8RIaanr7r7e/a4Oc1PYFLU496f6tZhbLq7O8xOn9SWZIxTZ9DSoouRpdFTIthZ5x2e6jb3eXZ2uMuNn2qrcefo8He3uaws8vi4+g5QYTP0d3U1eDNztw9cqfIytlOVZBvdaSEiLCVmbtrkrng4edVW5WGi7I+RocoMXrR099eZJp9g62coL9yd6a+wNMwaKFobqC2x9mAha+zts1JUI26vdHDx9eet8+RlbgvOH6ipsNscqOlqMTBw9V2mb5qcKG4u88nTIuuwtWnvNNaYZi3uc6nqsbGyNeJjrRYXpatsMm9zNywvNFkap0pMnrq7O6zxdhuhq/O2OPf5OqJp8aYm7xNa55FZZrL09+5w9WercfY3uYsUI3d4edch7MsZJ5mbJ46W5RTb6CFmbokSYkzVZF/lLd5j7SkutE+X5ZXhLFoj7iSrspge6ils8uGpcWTpMGtus9ulLtWcqKas82Nn79bdqV7nsCYqMROfa6CosNukbg5TYyuOFs7AAAATHRSTlMAIjPddxFmRLvuzKpViJkFOAsl/AGhEeTRh/kgKjGv9hvyxe6p2b3pNkxctm9qjBj+RIDLddVnkd1TmXo95GN5+vv2WHJlf/JHa/ldaTqRoAAAAAlwSFlzAAAsSgAALEoBd3p0TQAAIABJREFUeJztnXlYVcfdx9n3JWwCbii477tmbbq9XZ5zTzz3ci9CBF5AoEC0QiTgC8iaIi2bouDCUlnqgiJoglpUrKZVURO1SZs0W/PaNk2TpuvbtO/yPO+c7d4558xZLly4LPP9A2HOzG/mzPk4++LggIUlq+Bpc2YAzfrmV7/+ra996d+AvvS1r3/1m4sCgeOclf7B9k4f1lRRcODy8PCNkVGrKBlNXz9vRfiapwLsnVCsSa8Z4UsXhM2VAxFS0KbIBfNW+9s7vViTVnOWbYJ4MxrTkjPycvO3x8UTrOK25+fmZSSXJhihknLeY9PsnW6syafANeELzJAl1ycl5eYW7yKkit+1Iys3Kak+mfe7aV74YnsnHmtSyX/N0rAgrlDMKCku3h6HAFGgzO3FxSW1XDEZumDeLHu/AtbkUEDg4rVMr8WYVpuRG6/GoUj5GbWlDJShy2attPerYE10+T/zxHq2fk5KKrYSRU7bc/NKmWbk0idn2Pt1sCa21kVxVfSO4bHIqrg+geltR+JWJNZwFbBoNlswZmwfCYsckRnJdKUd+vgMPPiDZb3814XQ44tp9UmoDvQwlJlLl5FBYStm2vvVsCacHl86na6kk3Zk2gZGBsgdWXQrMiwcF5BY1ihwSShdMhaNqMWI0o6MNCMVtHERBhJLq6Y9Mx8UjKX1w+xKKys/CZSQ08PxQCSWNs1ZABqNxlxbVtMC7cgDBWTYBlxAYqlrTghoNBqLRotFRplJRrqTjYHEUtGskFWUsTZXdRYQVnbi5cRtVvEYn5tspCKX2/tlsca5Hl9Ld6c1D+1U3x88AnTrxq1+8E9TR3O21pDbQY09N+Qpe78v1vhV8MzQ6ca0Wk2D3pUX2jtb0wt3GkiLDPrC9IMDJ/aWayoq4/ISjBHP4OVnWGhNo0d3ivI1kNTccPLWTlJOpqGynr1aiMzKMAaF4EFxLKRWL6SoZC1FY/TFQoMsjIz0bY802CF2ZVBBG3H5iCXVnMgIqjRLtUNdvXegNUUI48MbZxK3NG0VuBl2Hm+6uUeVx/iktOkL8Zg4llizFoAOtWrRmNPQlCIuCIc6mUdnzh4QPYnt66lRBXJHsjF0Hd7lhSXQrLWUsV6tQ93Y2V8oqZbLtuSwTxNPtEgetlSUq/G4PYuKegJX2FgW+c+IpBKSVFZ6Z58q00saiTv7ciw+LhyUNClNTReqVXiMr08Imod5xOLlv24hVarWo77QeVACo+Fw2WXYT3TFUYkf05G7OXI2OR6zEoJmYx6xOK2bSyWord250yYBjSS3nmgU+up+hPCVekjFNpFfS822dyZgjQ8Fr4swlirTmL2l34Tg7PQFqc/riPHI2GvtKgVkXJFxPt64gEVvzoo01hYrtxuvSzoptA6cQUwJll9B8GhofVUZRyK/lML1NZaDw7IItbHvgh5pixAo5S7Sd/NVlOeHnQXKPBanUfPsnRVY9pb/srnGDMUBnm3NN6QdagBjRbNciP0oek397crLKzKTjLh8nOpaEqqyfqfgEaoPQ+rvXJYPs/84Kkj6o25FHomkVSF4I/aU1sxNVLIyIzXS4R1aBxXr3kPIMAduKkeVmRYUYu8MwbKjAsOMKu3GfSmoxRKxp9sVQ1VXoXA0pO9/oBisuDRiDZ6/nrKasYAqVdye1bgfXTbuPH2o6rp0lIfVtjNVh1KRwciHryYq8pifgXcsTF0tpWoVacy+ekB+IVnM0OB5RGOw/extNMKMjncotx93JYcF2jtXsOyjwCCVuZhTyAEeS+Vb2HlKWNo9OHX+aKximK0q7cf8hCfwQWdTUcGLNqVlKaLR3KdIFq30Q/CKnT0Du1VDpNYpxhmfm7Bgjr2zBmvstSgsqF5xsW1Op3hpI0o37poDnDiiwb/p2l3ZGGnFZcxdjpuPU04B66k0xd2r3U0xGugiDalV3JhPTStqXlsa4JjyIvG4pKjH7J05WGOtxZRRuaq+q4UtWjFXGf8XKrQGqFKMl9heikcfp5oCw9JyFavqRvWGI69Wurhr7Nfs/6hy85Eo+fIyvFthSikgfHq94iKenDKFjasp6bvTU0zmMaDYwQIiZ8Ds3xArei5W7G3l5RTxRbj5OKXkvyIoTbmEakdOOwPpW/sP9Tw6c7+q4kgLT2BKFVHD79syHbx2qOf8mf0NXUeG0uVsqFTXmQlRePJ6CmnOXCpJEYicOyiMDC1dHdfbG7kd/QV7z/cOshQeSrzKlIWFF6uunijnVu48iL7f0XsD2b3pr1bmMbc03N5ZhDVmCphnrFc+E+pVyQBi7NaDnXXN4jm+y6fahw7ryfSqg6QhvbU3ulJ8+ERl3fVbhyVI7ryljGN83sI59s4krLHSkqhk5ZNEy8Wrv2PbblfKeW7saiP1ZGr/VTkPlWeHxFM1KXuVeSQy8NrHqaLASKPK/v6Ton5MW+8FpbWzWypibtco7YaJ7r0hqvabVHDcsTAc8zg1tDioVpmFxtvCqrXlhAo8iXsVFuMyam4THhgwpDLYE18bgc+SmhJ6LCxNZRfrXUFjT1/WqOxdkx40XBPw2Knivzhto70zCmsstJTKUz4YKqcL5uZIhw1gpLXnLDwSeU22LcoqvmQuPs1+CmjD3GSVs3gSoXo1tqnaRjQCu13QmgyTSm1NELUhwfbOK6zRVsATxiIVDuqgQqxP/VA87UqsgECX7YjzKlmLW4+TXrNCVY/Ns2y80vefshGJrAruWCZqVBY+0r2ZJ3HxOMnlH25UOxtq25C5ppYfbBymEgfM5WNshZrnklA8VTjJFUAVqd3RUdfKE9NmIwhhXbH0kdS8xhXhY3smuZYYlSergRr4CjX9vG0IFCjavLGrT7XozYvE+7gmtZ6ar9atJvYcYcdjDPoBlWN1hqXsvbe48Z4Y1dPsd5U+Ye8MwxpF+a8w1qsxcJMrHPUNmq8ssk4nDnPFo8oyM6Citbh4nMSaNT9B9UKt/RwsAzZhD6UOfmJG5dBHUDw+u8HeWYY1elq9SmXVLWHGMcVy7El5tC1UboYvkdsTdlZtopsgcsMnwjYFN18PZ52zh6+7jex56jxtZMkKW44uTqNhVkkhCcrbtWj1sjQ2WFxkTjixUof3mQ3eZY8TaIlWTUxxxPifKfRx1vFydrGJRWDJJnasseXoqdM52t6solYp76xmNMigcgw6vdHmOF4eZHozerVFjwSRWfTMyN96dOXHgOjhwULp5WoDk/bA0R14tKJ0t0USNYzyEASz8jblPuSSShpMD38A9LKsfoDUQ7P0BhhHYh87tKmOI5EUNuK3Hl250Cz60L+5+njrdN62sGkPHB18db6jYVZBC5TPK2PFdKwHYZdU0vTp94H+40U5ffR9pP74Aq9fviTAkWsRaMBxx9Pju/HoCuo4P/Nf7t62KBztg+OYm50WprLslhFTjQqOb0wl9d95bmR68RdCHAtSNeJIfGV838EOCkcPmxudGjhumKuhrmZwHKwW4fgTNGXnnhfrnDYcsxsMGnHMDRvXnRkPnc7H5kanBo7hlIbPT+No6BG4yOP435IOy4+14UicoZc+Kh+hyyqOGtfFI6irkfWzq5s3eOTp7eaq4OTownaA2Lang6uLB90Z8nW0fGtHxsnDxdzndfXx8/Ck+/CwZR8/L9rJD+qKIGxJEyCI3zJ0gzCnZFaSRm2aFmLUiOPhMxpx/I4Ex5+hPX70XRGOpy4Cz+r3uQIcE9aN5xMpZEoJH09+7MfTXdbJwzxAxIwPuZs9mI268U6ebqyDN+TF00fkCXSkeNAQtqQJEMbPe0SZc1AwK0mjRi2OUp0gZHE0XBNOVtsAx/8Q47jtbVBbq+0IoxWfN67Pe0Tj6EZ/Hi8PD7qU0bnJOTHf0APIi8bBnSmnOA86cxjagzAI7Ykt1Vg3L84X7cT1qhC2EAkQxs97RJjjJWdWmEaNWkup3TvI4WgS3SE4GjgSPSna2o7Ertrx3HhE4kh3t72ZussRFGeermgnOqyTIIwf4+zoxxmla0RfJjDt4igM4uTFm3HS+bFu9JiTu4wtVAIE8ZvfRGpOIYmoNGoUlaB6ezqLY6FoCfio4LgnVSOORP3jVrzkWAuJoy80/gi+vS/aSRgW7qJzD6AwiCCuzlwl7+AK2fCTsYVKgDDt5r8k5hSSiEqjNvlTtWoLbzkc00UutsHx6Bah1dNaccwbzztckTh6QMWOE/sNEU7CsHAXnXvgZQkDgniJg7hJxph4XwhbqATI4Cgxp5BEVBq1aZnKKVEWHIdGgOOnsjjGiHC8qBXH/Ke1v+SYC4mjwJH9A+EkdPOE/kA8Rzi56iTLGLjHCFuqaUK9ichJzSy6HS2jBcZcjTheHwGOMgM9CBzvmjTiGP/0ON7BZTMcVdhTC6IW0BY4qpm1Cse1aSWavn6sZDhQHse/jgDHgosacSS+8ZT2txxrjTKOLrwUg7j70R1bZw8/2+AoNqeQRFQaNWlaWK3qyltGhyWnix2UxfGXWnH8oxTH7J7j+whN+soazW855hplHGHJBXH0UPJlNY5ScwpJRKVRkx5fmKft49+6KN7pv3XkOL7wPQmOxP1r5YQmlczW/JZjrrHD0VMmCD38ovOgSydvDxvgiDCnkERUGjVpTZCmYR6C6OkRHxm6lXz5v0YBxxNl1dpStGsc44icJLQdjhosgyrVy1E+oLU4IswpJNG69iIkbRPWQHska7QBjv8+CjgWSI7KlVHcgvF7LxxyCcVwcFTpWctbdoZGn7nHI+lZI8wpJHG4OAZrxrFbsp11lHDUrLj14/feI+QCMxuNOzpLpzlUoOJ+H8m4I6oIlE8iKo1aFDBPK45S2RvHzK+M3x0Krjp46sLRm+HM1zazMn7QNIe7m4MkiLl0dBcFHMmsDMKcQhJRadSilfO1LL1Vx/Hzl2DpJTjqBc//2yY4Elkh4/dgZsvmBAd3emSEnrdzFM4PO6KdhF/bMiHswK/eolcsuLDT0n6WVQ+WIOwfLpa1PXxAhC1UApA4IswpJBGVRi0KnK5tTkYNxx9JAFTSd2yDY/54vuRauHWLXWWleUUPZMeNNcMZYpx8dZbFNZ5yOLo6c76YdZA6OVvoFT0OYmtIcwpJRKRRiwIpbYPg4xPHuYu0vqcdBG1s1flxDSlobSHf3JI6ib62D7SYkKsUXcxOHk7SIDxA8EChs6wtaQKQOCLNKSRRmkYtCtS2umyc4mgcv30ZWsy2f08PP3jptwu78tpFwUk8TscutdYBO+beAbvS2su8MFsQxPyHO7N8W+fhbdm5j7AlSYAwfstqcIQ5JbPiNGrRhMaxOGF844hlrWZOZBy3J2McJ5cWTWQcd9ViHCeXvjmRccwswjhOLn1V7d638YwjUY9xnFz6etpExjEJ4zi59K1SbasdxyeOuRjHyaWvqZ4JPp5xzMI4Ti59aULjWIJxnFya2DjmYxwnlzCOWONIX5rQXRlcWU8yfS0N44g1bvQtbQf0qOL4/VdgvSUB8IOfwnoR96yxUPq60TaThMLzbqXb/j9Fn4WLxx2xYH3VRnPWQo3kUBRrhGdlJplstYTCLjjG4znrSSZbLTCzC454Rc9kk62W39oFx10ZGMfJpUBKww1H4xXHKb0anN6q56vubVxZVlWgxsNGR4qj/Om3I9m6pXmvDLzTzU/twhfmXgvn4RyioBS9hu10TuwFGoK9XnKiNzI7I7xpigrODsl9sgLLCHOQk4+zjbkNpDImMI7TtW5s1QnkrAQkv4HTVrf+8tGr2oM3wpp3wsrKQ8akpqiE2eEhjEtgGWHO4kQftWHdtQhqClyVMIFxXD9T42vqRFLIQ3478Vjj6CtKovKdw25yPoaBo84TLv+ElhVxdFdPp5VaOX80zugZIxxLNB+KIsZR/oY2H7bA8PCwZWWtgREXSRKVEkCfQ4K+83A4OHI3f6AsK+JIH9wzrJOhZDU6R0aNDY7x316u9XRwy39jVx+m+HOW80nfX2XTdiMfvQojTHPOwwfE7OTj56lW6rjw5/kMJyrYkyN7OZYlMpFlZRwd/bxte/Ni8Apq2JPW9sYx82nNh4MLstxbqXh0Vq7Khyd1Rph6z3LkmZvncO97tRJH7lhb2eNplXG0vcIpbRcnjEMc4yLnaH1LAY6uwk8v9WnzzFY3ytTVUEfZdbgXYFuNI3vgk1yQscZxTVCGpluOrMLx/8YGR+2HMQsrJLp45Esf/l5RV8inF2g6+iKfOnD3lnpCF5E6uTCHenn4SmtP5ugaTw/4g8v4ZnBEJl0cABpncYLKNURUqNRbXtJMFH0IHlMhoCwzGce8MXSEjzkwPAzkyqTT2Y+vWhSyRUFLojRe5GENji+8DvTKz1m9Qv8hc4j4iHC04mxwSfuI//bmHgR/6Ju5eY986uBkGY1hD+Zyh4ZnxM096JJT7gvK+pbrpEoDQDS4W95DGhUq9XB2uAv+cpGxDFmFDjjjvaEi0zm7qWSLklaGabzmSKpUWRyf+6FYMterjwjHb6/Q/JZyOPpBuQ3dfco9lz518hQ7wYOFojFhN/gR+9lkfTMtOMRoozQAChpUVIjUC7LDehyhC10lOMKReSlni7LWDnteRgFHrRoRjt9Yrfkl+RxnZcaRyXUdd9Sm+ehZPk8RT9leOevkZflwXvypojBOTCVIe/a0MCLvmytdQGUnmASRBkBBIxuVMPWC7JBW1vI4evGWRQkQRebMptNJ8UVVFEkVZU5MHJ/Wfr+6DI7M7fV07jGlnrjwkT51NdtxdfPisPHlj1w2m+BEt1DZC8t9LEZlfUPliyc8jSkJgIIGFRXi3QTZIe3KyOHIXATMNgf8HNA4epgT4OTnovKiylqn8QJhq3BkFoc/95+MzsHLv22IY5wVV2SicWToYnPNR2e5+xSeAhM+hRprUvnqhEPTnjpzJSn4/GjfwoFwxPHFfAAUNIioUO8myA7pQI8cjpybG+cPhaMlMtVsUVEANdw1ZvI4vvDFW7EvvfebzYz+cSD2rS9eRHscCY65IdpfEo0jTJc0/xFPzfUaSu46wfgd3TnVSTujMr5pOfrCSxvE3WE+AAIaVFSodxNkh3QYXAVHBnAnJI5K/00RL6ooargjj3I4fvTjd0ny3Tc5Gje/9q/3SPKDHyOBHAmOeVZcr24jHNm2o5eLu4gVJ3d3d1fRNxEHd1f0zQdy8eCRhEoUQQAENKioVHGExU4SquDI/64dR4UXldd6Ks2GOJ77ybu/MOiPf8LDSOv3b+42GXa/9UdplT0SHOtnaX9HBRwhCfMf9dTcs/YyD6e5uniJPDlYgkPRuyv6huTEeXFDB7AGR7moxDQ6CYI62AJHDS+K1pIoCt2XuZwDfuRYheO5F18hydh3/7BZrE9AgWn4+ec/tArHB9ngR6LMw+K1M7S/o61wdHCyZDJrD740QKeKo6xvoZgEeqMDIKAZIY78zQYIy8PGUeOLIrRynsxQz5lH4MeFMtn7U1slOH70xS9IUv/PX0lo3Lz5V+/vJsmHP//8nGYcc6quPwDx30c/zSx6UnvH2nY4cotzdbxBJ9mvjmJE3rdITE8VHQABzUhw9LIsv0VYHi6Oml8UofBV6CW4PW3gx13T0F2ZErJNhOO5HwIYTTF/+xhBI2hC/uMlE0nu/uicNhy3Vd5J6QGlY1NFNvJ5XNByK16Rp4cVP0nI5KK7WU7C/Ec95TLbhVmF4cmZ8mRur3AVzfOhGJH3LRL/FBHAGhyRqRfaQLuOFEfNL4rQsgj0uVFdKe0EUX6RNA2Kb7I24wjN/Z37/NOXAW5/+z0SRqYJ+c/vAVx/+vnzUHEqh2NOZwyZWgOiP3gMfdn6jvnW7JMR4OjKj6ChWtkiHOUMukPfxs0B5R/V3ZX3Db4gPFDip7N0o0UBnKVOaj1rZHZIcURYlvSsHZE4OokjU3pRNc1Zj54n7DL0g59VKSR5pBmNo958ueBz//snGsa/vCkLI60//8+vQWX+6R/NoV78BXkUhdvlTgBuF/jlpH53BxLHb1hTVwtx9OMzyxX+LE6ughxGP3UVLLVwFwy4ifMdMRio4NsXFNjCkWlvdABo/YfquKMo9YLskOKIsgz55McdnaWRScYdFV5UXZFUfTwKR/LwfoKobiNJsqUX8fwYafrC3J/+wEQafv2rDxVpBDX2Z+8ZSMN3/8oXkD95iTxQJ7XcfAX8H0ivJIh9l0jDq0gcn7bqdkwLjtzyW3YkjM5Z9tJwd29uyRmU/4invjpnFkg/rkDyMvuR5LtlqsRsVN43N6VHzxA6+jBNAeaTIwIwqLITJYhZGUv6EakXZIcUR5RlC1fmWRk6Mi+RHUsCnPzoCUmFbFHXBqoUNRLeRZIXQT+mrBDweGmv9HkfaXiFaQmee+EnsaThg/dQXRhJjf1GqomMfZ1rQv5ST56WXNtORN8wkOTxCvDb+ViSROJYHGbVG+rEssxXWGZkxWPB0qdOAhe6+GKnUpz56yHhfDd7ZnffuCv6lu5N8HCQCcD+JnBCRIV6N0F2SHFEWTbHb5mzduOcfFBz1p5syhWyRV3+FGo/YU4FwPA89y/ZVy3x0ESSb9EjN+f+9BaoWt//s1rRyBWQ//idniS/+yc65PM/I8lrkoZA9RU6wrcbCWLPLVIGxzxrOjJSHPmvAy9EkaxXkT71gR2YZQmu8OiaKN+ly2wUfItGRrhZGVQAJ6mT6ooe0VQS/JKQEJaFLowVV261jgtsRxCZj2K2qGs2lSAderwMcCNPg151dB8orMhDkgHAk6Cx+KPnnv/R6yaD/tK/XtMEI62Pf/tGoSH2rS+ef+4FwPHtyyKz3QMPSdJwCZTL224ZZHDc9awVY+CSXIU2tlpKJQ/JWDDiqZPl2lJn1sXVG7YsnBp2gRBjqy4F366wb0/+/wsqALyW0NNXLipE6gXZgcARYRmOnp9I5+YCBDhCkTFpV8oWVa2mjEWST17ZD1jQ3yHY3gxJDokHIPcDx7/+73cBO+8q92AQRSRoQpIfvPAj8POkON4OOjJ9Ff1bOv1rJwLH/I3WXaxu+VieHr6CkoJbMW0efRPucxc/5Rc5O3tbjDj5MlWUs4ef5CZTboU0iNJRg28HH+YZSCHcK0AFcPN2Zpwgj4ioEKlHviQsiWVXHxdmjZqnt+UsAnbGxU2yGlzHZIyr+ouqaNYmqlbSmdlzA7BgOAYgLG+hsYgVc0Hj+PrrAJ3/+a2VNG7e/Nk/d4PAP0XQdv4aHdnWalBp36MLR/LkNimOScusfEOsCST/FVSCZIsCgyO5kx6L3svsdzlcKcURNBqtqact+vhXn7xsiJXiyHTkSfI6+PUMUziiKuuSMOvqaqyJpcWhVL249Vh9j9111dBNEBXH6d+OCXsd0ZdI8uF78sPeavrw/RiSTD0jjLSJifNKNfHgJrfrS4pjfPIT9s4wrNFU8DOU5FTm7kMsDukNBNF4iK439a8KpgtzgIeXtAzuyOm1D0jyRqMg0vP0qJKhpYbIvnpYFseS9bhwnNyaRknXUXRxPLS1E8R9pnhsE44R0iNA74wAxw9B+CMCiw/66GgKG7YRdcdIWRzzNtg7u7BGV/5PUJKZQh5H8kY5ix7oVlTDHmpSSfK9EeD4PihwBVOAjdeZWG4RxOUjfORMH1ugHU9bsbQMa0LqsShKvJBiIJZHookgtrUy/ZYygQ/QCU4Zfm39G1BXpwu6zb10VU2m7iO2nTQfGNB6QlI4hlszXY01ERUgLR7vbzUz0VRH9DKjLkcfwT7OkGTs34eN4+9MJCnAu+YgM6B0MofoLORjjh18IKIxM0zrqY5YE1fL51Ki41Eq28w4Gs4mll9hEKmAJ2cSQdf43eEWj79/A3TML0DW2CLRMFTXfdUS88P94sIxy4otW1gTVQGRkj1cl0gLFa8SjRcleOR0HicNl36jjh5KfzCQhVeqIWvRzORP2yOi12SJOF08CL7rWe27/bEmrhZFUaXCL3+VhLBoJ7Ywv7TAPgrowaC/DY/GX5PkRZhGghl2N90l7rZC8d4T0bg9Q/vJPFgTWatXGYXVdSNUSpHH9mWfoZuPsUdghuj5w5TPhkHjb0A7MQWuqok7eprGHuLUNShWUrwaMmt6oL3zCWtMFLhWNFXYfQ/iQn+r+RRTe8dchf100WvLrJ8l/Ph3O0myDzbUzLQFWtq7BwT/CUT7IuK/ovkAZqyJreAnp1PJggNSburhguoa0Z5K/9sKD4Y3g95MurULejZvfofepQAP4RQM0XGltBO3C6EoDeL1E3lLMY1TRiEUVS/4+o8Ow2xc29N7mv7lCuxl78FYkvyLdeXja/+QlLKv0oZTG6oHY+EYb4s2MW6PwlX11NGsIMqYL/j+JyE4SP3Z6v30Kpud8LKHbTdBK1D/iTU8vvYmKBtNgiGju/SQY0xv950UOMIjoiHwuAztRzpiTXj5LxWvw62E6SAL9zLLfAzC7u4AcDpqTX1N19TkJUGr8G26l3SxOjFdEF+7kEYiKQgXjlNJARuDjEWC3nXNAUH5WHaGbj7uPATvKOhuAs0+k3Yefwv6KrFDMI3ZvXTDMb3m0VE4spjroh3/O+YusXcGYY2pHptPUXkwAt29MTAiR6s6mX+7YD/NRwBNL3+ibXHPZ7/7Hihf2wQFXy+z3LzrZhsclf5OgZDGXc+um2Pv/MEaW62mRM3Hgl5Bc+541RW6XjUNwKw0PwJOsa1a9ii88y7dV2kRHD1RtZu2fONEq4DGAeFKSCI+LxIvnZhqCgijqFpBdZ1z9aCgCj0/RPP4sOsEVJV2H6Kr2fR31Pa2fvjbd2l/TdDg9rbyqq20wZQyQdkY0yOikchfqPlWI6xJI1BdG/MEGxWyz8A8Go5f2skWXyfbLYOCjR308p/df5EepQfp4zffp7sq+p5qi/EtJ2+wZg8eNECxPOwVn1NV8uwKPOQ49RQAeEwQjvYQNUMwKoXc4Hhs270L5hKSYzbl739GH2AG9K83mEr5YIOlWK3aWq64AAAGKUlEQVSsOMaNMxp2wlEcaBDBSGxPjsSLbqekFoHmY54QhoJHgg62uaRMSb9j7mMXnKf9GF5Ov/QOgsjP3t/9kAbuaEcBT2NOzYFCE8psStke8Sl6mUULcNk4RTWbopLFG7l6r6HAAX2ae6+al5x19LNF3YG/ffKHd6Bx8Q///MknbMPQ1Gcu9qKvDhxFm2wpkxzpGJ+7yZrz87AmkwIXUJKdCkT09VY0PeSBIye5Ha977nO7D8mX33qD0V/+Dn6892uuIm66f4qr2m82XYpBW9Nf2Ss93nTH3HUB9s4VLHvpKdCdSZbcnNnYkKpHI2QqTK2qq2aOEm9+u+Ug5MvAtwhNh0+fbe6mSWyMvnkp/aEBbaj1TrUUxvi8L2/EYzxTWI8vpYy10kP2KjuvyFSwgKRbZQ3sLPSpk103DghwSzl2tqydqYG793cOyhSLJHl8sKxaEidQ0kI8VT21tXg6Jd46wyixR5ZHQN2hfWzRll1+oqzNXEYePXJ9C7f/qrIM2SVitbNBfJgZq8yEFbimntryXxdBGVE8bms8ca9Vps4mTSkxXfui6SqZyClo5JXIOBQ0XyjbWmhCV9LkztRj1xsRZ0MBxSWHYBqnvJ6kKGMR8gh7ovFORZ8MVkDpZb3Suz/qqrpa5EvVvrMn0afhAxXXzsY0YvkvA/2ZWrnbM6Ov9zTJ17p9TSfhKb7KrqZLsvjqr3U8ikZf1kGrpHQpHv7GovcqRFCUtH/NK7v75sXTu83D2PoDB44WWpgzte6vK6cr3+w9dVdbocFuffrRreY/DQ9T+/YXyMVAKy55PV5UhsXoyVWUMVnpduGcqwNN3Hqf44euXDn5dgWtQ/duXBtqO326f39dzp4TZ48dG+q72H/7LPOsoqv/1j1uja3hUkVnpYJ1oF218/BkDBYr//DpgEd0+5FX9fmOfq6sO37kbAfdN86pLt93ob0G6FRO5d729r0X6k7tYfopOWfO3uN33xw+26F6OWZS7ew59s4ErHEj/8BIikrLQ106A6mxuYEb1Ykt3NrScAp9Z1xOZVXb4XR2FtEUc2VfpWIlTSs+z4jLRixYSzZRVGku+kZXSNV3rvCL0AwHyqpqJB62VJX18S3GmNsDjxA2JDQmfTkEHw6FBSt48VqKSpBeqyBRwc2Ot/l9V4aWwUEYuJorg+YVag/PdtwXL6xFant9hJXXI2BNfgWvXBoFGpC5KhU2rQeVJ/pPH2W5MxQePlhWV15ZXtd743AM62ba2nrjpnodzarky5uW4PFGLImCl02nKCP6ymuJsm/2Q1PSW4egYwP0TSfQ0y5IGqmlM+394ljjUivXRIEKG3mpK0Ll+3vvCTZ7sSVjU+912YkXqbJKI2cG2/u9scan/ANDIyhjWr5qj4ZT4559A6lbU7htB6ajBwYv7JFcISev+O1pUXhfDJa8ApaE0lPYSkPiYlV2vD146fS1wUMD++SnAFHaVR8RshoXjVhKWr2UoqjkJNk5Q5Qe1NXUdVuFIj3YWLtwGV5ri6WixyLnggIyQ3mOZsSKSwpauBzTiKWuxUuDQJcmaRSB3J6VvH4j7lFjadLKdQtBAVlbb1WNrV3xSclB8x7DRSOWRvmvXELX2Gl5WvvY1sBYkjx93kw88o1lhfw3LKDoJmSWjUvI+Pyk0tAV+PRGLCs1Y8PsIBpIm7Yhi+vTIp5YbO9Xw5qICpi5fmEQqLJri21SRMbvyiuNCF22EtfTWMPUnJBVoM6m0rJGXETGF9dT1Pw1mEWsEWjlstn0wgpjRp70cABrYMyqTzZuWrMa04g1Mk0LfGZ+1CpQZ5eCSnsYtXZ8ZlxWMqilQxbNwWM7WLbQopB5oRRTaydlFVsz+JOZn5WXTAUtDVlu71fAmkwKWLxs40KWyKL6vBItpWRmfl5eURplXL9mwxx7Jx9rsik4YObs0NAII41kQmlRfhxQJnLtOKie4+Lyi0oTjNOjQsOW4Doaa5TkvyEkZO1CBkl61iYjKYtTCRD3a25RMu0hYv7skDX4Smqs0VXwzMeXLwtfMJ0SyAhk/mPV/NlPLn/mKbyyFmtMFBywMnDmzFmPr1iwKQhictXcsHnLH5s5c+aMabauoP8fP8ozAt7o4mMAAAAASUVORK5CYII=";

  const originalConfirm = window.SPA_CDSP_ORIGINAL_CONFIRM || window.confirm;
  const originalAlert = window.SPA_CDSP_ORIGINAL_ALERT || window.alert;
  window.SPA_CDSP_ORIGINAL_CONFIRM = originalConfirm;
  window.SPA_CDSP_ORIGINAL_ALERT = originalAlert;

  window.confirm = function (message) {
    if (state.running) {
      log("Confirm aceito automaticamente: " + (message || ""));
      return true;
    }

    return originalConfirm.call(window, message);
  };

  window.alert = function (message) {
    if (state.running) {
      log("Alert interceptado: " + (message || ""));
      return;
    }

    return originalAlert.call(window, message);
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeDate(value) {
    const text = String(value || "").trim();
    if (!text) return "";

    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return iso[3] + "/" + iso[2] + "/" + iso[1];

    const br = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return br[1] + "/" + br[2] + "/" + br[3];

    return text;
  }

  function currentDateFilter() {
    const enabledInput = document.querySelector("#spa-cdsp-use-date");
    const dateInput = document.querySelector("#spa-cdsp-date");
    const enabled = enabledInput ? enabledInput.checked : CONFIG.dateFilter.enabled;
    const date = normalizeDate(dateInput ? dateInput.value : CONFIG.dateFilter.date);

    if (!enabled || !date) return null;
    return {
      date,
      values: [date + CONFIG.dateFilter.timeSuffix, date],
    };
  }

  function currentCustomFilters() {
    const tribunal1 = document.querySelector("#spa-cdsp-filter-tribunal-1");
    const tribunal2 = document.querySelector("#spa-cdsp-filter-tribunal-2");
    const cejusc = document.querySelector("#spa-cdsp-filter-cejusc");

    return {
      tribunal1: Boolean(tribunal1 && tribunal1.checked),
      tribunal2: Boolean(tribunal2 && tribunal2.checked),
      cejusc: Boolean(cejusc && cejusc.checked),
      deadlineStatuses: currentDeadlineFilters(),
    };
  }

  function currentExpedienteContentFilters() {
    const pauta = document.querySelector("#spa-cdsp-expediente-filter-pauta");
    const negociacao = document.querySelector("#spa-cdsp-expediente-filter-negociacao");
    const phrases = [];
    const labels = [];

    if (pauta && pauta.checked) {
      phrases.push(CONFIG.expedienteContentFilters.pauta);
      labels.push("Pauta de Julgamento");
    }

    if (negociacao && negociacao.checked) {
      phrases.push(CONFIG.expedienteContentFilters.negociacao);
      labels.push("Negociacao Assincrona");
    }

    return {
      pauta: Boolean(pauta && pauta.checked),
      negociacao: Boolean(negociacao && negociacao.checked),
      phrases: phrases,
      labels: labels,
    };
  }

  function currentDeadlineFilters() {
    const options = [
      ["long", "#spa-cdsp-deadline-long"],
      ["short", "#spa-cdsp-deadline-short"],
      ["late", "#spa-cdsp-deadline-late"],
      ["none", "#spa-cdsp-deadline-none"],
    ];
    const selected = options
      .filter((item) => {
        const input = document.querySelector(item[1]);
        return Boolean(input && input.checked);
      })
      .map((item) => item[0]);

    if (selected.length) return selected;

    const legacySelect = document.querySelector("#spa-cdsp-deadline-filter");
    return legacySelect && legacySelect.value ? [legacySelect.value] : [];
  }

  function hasCustomFilters(filters) {
    return Boolean(
      filters.tribunal1 ||
        filters.tribunal2 ||
        filters.cejusc ||
        filters.deadlineStatuses.length
    );
  }

  function activeFilterLabels(filters) {
    const labels = [];
    if (filters.tribunal1) labels.push("Tribunal: 1o Grau");
    if (filters.tribunal2) labels.push("Tribunal: 2o Grau");
    if (filters.cejusc) labels.push("Jurisdicao: CEJUSC");
    if (filters.deadlineStatuses.indexOf("long") >= 0) labels.push("Prazo: azul");
    if (filters.deadlineStatuses.indexOf("short") >= 0) labels.push("Prazo: amarelo");
    if (filters.deadlineStatuses.indexOf("late") >= 0) labels.push("Prazo: vermelho");
    if (filters.deadlineStatuses.indexOf("none") >= 0) labels.push("Prazo: sem prazo");
    const expedienteFilters = currentExpedienteContentFilters();
    expedienteFilters.labels.forEach((label) => labels.push("Expediente: " + label));
    return labels;
  }

  function logCustomFilters() {
    const labels = activeFilterLabels(currentCustomFilters());
    if (labels.length) {
      log("Filtros ativos: " + labels.join("; ") + ".");
    } else {
      log("Sem filtros condicionais ativos.");
    }
  }

  function normalizeLimit(value) {
    const number = parseInt(value, 10);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return number;
  }

  function currentActionLimit() {
    const input = document.querySelector("#spa-cdsp-limit");
    return normalizeLimit(input ? input.value : 0);
  }

  function logActionLimit(limit) {
    if (limit) {
      log("Limite definido pelo painel: " + limit + " numero(s) de processo.");
    } else {
      log("Sem limite de quantidade: a acao seguira ate o fim da lista.");
    }
  }

  function storageGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_error) {
      // Sem armazenamento local, o script continua funcionando na sessao atual.
    }
  }

  function storageGetBool(key) {
    return storageGet(key, "0") === "1";
  }

  function storageSetBool(key, value) {
    storageSet(key, value ? "1" : "0");
  }

  function log(message, type) {
    const text = "[" + new Date().toLocaleTimeString() + "] " + message;
    state.logs.push(text);
    if (state.logs.length > LOG_LIMIT) state.logs.shift();
    const box = document.querySelector("#spa-cdsp-log");
    if (box) {
      const line = document.createElement("div");
      line.textContent = text;
      line.style.cssText =
        "font-size:11px;line-height:1.35;margin:0 0 2px 0;color:" +
        (type === "error" ? "#ffb4b4" : type === "ok" ? "#b9f6ca" : "#d5e5f2") +
        ";";
      box.appendChild(line);
      while (box.children.length > LOG_LIMIT) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
    }
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;

    const data = event.data || {};
    if (data.source !== EXTENSION_BRIDGE_SOURCE || data.type !== "SPA_CDSP_OPEN_BACKGROUND_RESULT") return;

    const pending = data.requestId ? extensionPendingRequests[data.requestId] : null;
    if (data.error) {
      log("Extensao nao confirmou abertura em segundo plano: " + data.error, "error");
      if (pending) {
        clearTimeout(pending.timeoutId);
        delete extensionPendingRequests[data.requestId];
        pending.resolve(pending.rawResponse ? { ok: false, opened: 0, error: data.error } : false);
      }
      return;
    }

    const response = data.response || {};
    if (pending && pending.rawResponse) {
      clearTimeout(pending.timeoutId);
      delete extensionPendingRequests[data.requestId];
      pending.resolve(response);
      return;
    }

    if (!response.ok || !response.opened) {
      log("Extensao nao abriu a URL em segundo plano.", "error");
      if (pending) {
        clearTimeout(pending.timeoutId);
        delete extensionPendingRequests[data.requestId];
        pending.resolve(pending.rawResponse ? response : false);
      }
      return;
    }

    if (pending) {
      clearTimeout(pending.timeoutId);
      delete extensionPendingRequests[data.requestId];
      pending.resolve(pending.rawResponse ? response : true);
    }
  });

  function setStatus(text) {
    const status = document.querySelector("#spa-cdsp-status");
    if (status) status.textContent = text;
  }

  function ensureJquery() {
    if (!window.jQuery) {
      throw new Error("jQuery nao encontrado. Rode este script dentro da pagina do SPA ja carregada.");
    }
    return window.jQuery;
  }

  function getDataTable() {
    const $ = ensureJquery();
    if (window.dtProceduresBox) return window.dtProceduresBox;
    if ($.fn.DataTable && $("#procedures-box").length) return $("#procedures-box").DataTable();
    throw new Error("DataTable #procedures-box nao encontrado.");
  }

  function normalizeProcedureLabel(text) {
    return normalizeText(text).replace(/:+$/g, "").toLowerCase();
  }

  function readProcedureHeaderValue(labelText) {
    const wanted = normalizeProcedureLabel(labelText);
    const items = Array.from(document.querySelectorAll(".procedure-header .copyElement, .copyElement"));

    for (const item of items) {
      const label = item.querySelector("b, strong");
      if (!label || normalizeProcedureLabel(label.textContent) !== wanted) continue;

      const value = item.querySelector(".copyValue");
      if (!value) return "";

      return String(
        value.getAttribute("data-clip-board") ||
          value.getAttribute("data-content") ||
          value.getAttribute("title") ||
          value.textContent ||
          ""
      ).trim();
    }

    return "";
  }

  function readMainProcedureId() {
    const input = document.querySelector("#main_procedure_id, input[name='main_procedure_id']");
    if (input && String(input.value || "").trim()) return String(input.value || "").trim();

    try {
      const params = new URLSearchParams(window.location.search || "");
      const queryId = params.get("main_procedure_id") || "";
      if (/^\d+$/.test(queryId)) return queryId;
    } catch (_error) {
      // URLSearchParams pode falhar apenas em paginas muito antigas.
    }

    const headerLink = document.querySelector(
      ".alert a[href*='/procedures/'], a[href*='/procedures/'][href*='/folder']"
    );
    const headerHref = headerLink ? headerLink.getAttribute("href") || "" : "";
    const headerMatch = headerHref.match(/\/procedures\/(\d+)/);
    if (headerMatch) return headerMatch[1];

    const pathMatch = window.location.pathname.match(/^\/procedures\/(\d+)(?:\/|$)/);
    return pathMatch ? pathMatch[1] : "";
  }

  function readCurrentProcedureProcessNumber() {
    const headerValue = readProcedureHeaderValue("N\u00famero do Processo");
    if (headerValue) return headerValue;

    const alert = document.querySelector(".alert.alert-info, .alert");
    const alertNumber = alert ? extractProcessNumber(alert.textContent || "") : "";
    if (alertNumber) return alertNumber;

    const processInput = document.querySelector(
      ".judicial-process-number-input, input[data-test='judicial_process_number'], input[name*='process_number']"
    );
    const inputNumber = processInput ? extractProcessNumber(processInput.value || processInput.getAttribute("value") || "") : "";
    if (inputNumber) return inputNumber;

    return extractProcessNumber(document.body ? document.body.textContent || "" : "");
  }

  function isProcedureWorkspaceRoute(path) {
    if (/^\/procedures\/\d+\/?$/.test(path)) return true;
    if (/^\/procedures\/start_procedure\/\d+\/?$/.test(path)) return true;
    if (/^\/procedures\/\d+\/new_progress\/\d+\/?$/.test(path)) return true;
    if (/^\/procedures\/create_progress\/\d+\/?$/.test(path)) return true;
    return false;
  }

  function isProcedureCollectionPage() {
    const path = String(window.location.pathname || "").replace(/\/+$/, "") || "/";
    if (isProcedureWorkspaceRoute(path)) return false;
    if (path === "/procedures" || path === "/procedures/search" || path === "/procedures/follows" || path === "/procedures/outbox") {
      return true;
    }
    return Boolean(document.querySelector("#procedures-box") && !document.querySelector("form#progress-form"));
  }

  function isPotentialProcedureWorkspacePage() {
    const path = window.location.pathname;

    if (isProcedureCollectionPage()) return false;
    if (isProcedureWorkspaceRoute(path)) return true;
    if (document.querySelector("form#progress-form") && readMainProcedureId()) return true;

    return Boolean(readMainProcedureId() && (findExternalDocumentsLink() || findProcedureFolderLink()));
  }

  function isProcedureDetailPage() {
    if (isProcedureCollectionPage()) return false;
    return isPotentialProcedureWorkspacePage() && Boolean(readCurrentProcedureProcessNumber());
  }

  function findExternalDocumentsLink() {
    const links = Array.from(document.querySelectorAll("a[href*='/judicial_processes/'][href*='/documents']"));

    for (const link of links) {
      const label = normalizeText(
        [
          link.getAttribute("title"),
          link.getAttribute("data-original-title"),
          link.getAttribute("aria-label"),
          link.textContent,
        ].join(" ")
      ).toLowerCase();

      if (label.indexOf("documentos externos") >= 0) return link;
    }

    return links[0] || null;
  }

  function findProcedureFolderLink() {
    const links = Array.from(document.querySelectorAll("a[href*='/procedures/'][href*='/folder']"));

    for (const link of links) {
      const label = normalizeText(
        [
          link.getAttribute("title"),
          link.getAttribute("data-original-title"),
          link.getAttribute("aria-label"),
          link.textContent,
        ].join(" ")
      ).toLowerCase();

      if (label.indexOf("pasta do processo") >= 0) return link;
    }

    return links[0] || null;
  }

  function readSoapSettingId() {
    const withSoap = Array.from(document.querySelectorAll("a[href*='soap_setting_id='], form[action*='soap_setting_id=']"));
    const gonPath =
      window.gon && typeof window.gon.judicial_process_movements_path === "string"
        ? window.gon.judicial_process_movements_path
        : "";

    for (const element of withSoap) {
      const raw = element.getAttribute("href") || element.getAttribute("action") || "";
      const match = raw.match(/[?&]soap_setting_id=(\d+)/);
      if (match) return match[1];
    }

    const gonMatch = gonPath.match(/[?&]soap_setting_id=(\d+)/);
    return gonMatch ? gonMatch[1] : "1";
  }

  function buildExternalDocumentsUrl() {
    const existingLink = findExternalDocumentsLink();
    if (existingLink) {
      return new URL(existingLink.getAttribute("href"), window.location.origin).href;
    }

    const processNumber = readCurrentProcedureProcessNumber();
    const processDigits = String(processNumber || "").replace(/\D+/g, "");
    if (processDigits.length < 15) return "";

    return (
      window.location.origin +
      "/judicial_processes/" +
      processDigits +
      "/documents?soap_setting_id=" +
      encodeURIComponent(readSoapSettingId())
    );
  }

  function buildProcedureFolderUrl() {
    const existingLink = findProcedureFolderLink();
    if (existingLink) {
      return new URL(existingLink.getAttribute("href"), window.location.origin).href;
    }

    const procedureId = readMainProcedureId();
    if (!procedureId) return "";

    return window.location.origin + "/procedures/" + procedureId + "/folder";
  }

  function buildExternalDocumentSources() {
    const autosUrl = buildExternalDocumentsUrl();
    const folderUrl = buildProcedureFolderUrl();
    const processNumber = readCurrentProcedureProcessNumber();
    const tribunal = readProcedureHeaderValue("Tribunal");
    const processDigits = String(processNumber || "").replace(/\D+/g, "");

    return {
      autos: {
        key: "autos",
        label: "Autos do processo",
        shortLabel: "Autos",
        buttonLabel: "Abrir autos",
        loadingText: "Buscando a lista de documentos dos autos...",
        emptyText: "Nenhum documento foi encontrado nos autos externos deste processo.",
        errorText: "Nao foi possivel montar o resumo automaticamente. Use Abrir autos para acessar a pagina original.",
        foundSuffix: "documento(s) encontrado(s) nos autos.",
        url: autosUrl,
      },
      folder: {
        key: "folder",
        label: "Pasta do processo",
        shortLabel: "Pasta",
        buttonLabel: "Abrir pasta",
        loadingText: "Buscando a lista de itens da pasta do processo...",
        emptyText: "Nenhum item foi encontrado na pasta do processo.",
        errorText: "Nao foi possivel montar o resumo da pasta automaticamente. Use Abrir pasta para acessar a pagina original.",
        foundSuffix: "item(ns) encontrado(s) na pasta.",
        url: folderUrl,
      },
      movements: {
        key: "movements",
        label: "Andamento processual PJE e prazos",
        shortLabel: "Andamento PJE",
        buttonLabel: "Abrir andamento",
        loadingText: "Consultando andamento, expedientes e prazos no Worker/MCP...",
        emptyText: "Nenhuma movimentação ou expediente foi retornado pelo MNI/PJe para este processo.",
        errorText: "Nao foi possivel consultar o andamento processual e os prazos automaticamente.",
        foundSuffix: "item(ns) encontrado(s) no andamento/prazos.",
        url: processDigits.length === 20 ? "mni-pje://" + processDigits : "",
        openable: false,
        processNumber: processNumber,
        tribunal: tribunal,
      },
    };
  }

  function getExternalDocumentSourceSignature(sources) {
    return [
      sources.autos && sources.autos.url ? sources.autos.url : "",
      sources.folder && sources.folder.url ? sources.folder.url : "",
      sources.movements && sources.movements.url ? sources.movements.url : "",
    ].join("|");
  }

  function findExternalDocumentsHost() {
    const header =
      document.querySelector(".procedure-header .card-body") ||
      document.querySelector(".procedure-header") ||
      (findExternalDocumentsLink() && findExternalDocumentsLink().closest(".card-body, .card, .content__inner")) ||
      document.querySelector(".content__inner, main, .container-fluid, .container");
    if (!header) return null;

    const row = header.querySelector(".row");
    if (!row) return header;

    const columns = Array.from(row.children).filter((child) =>
      /\bcol-(?:sm-|md-|lg-|xl-)?6\b/.test(child.className || "")
    );

    return columns[1] || header;
  }

  function injectExternalDocumentsStyles() {
    if (document.querySelector("#spa-cdsp-external-docs-style")) return;

    const style = document.createElement("style");
    style.id = "spa-cdsp-external-docs-style";
    style.textContent = `
      #spa-cdsp-external-docs-panel {
        margin: 14px 0 0 0;
        border: 1px solid rgba(33, 150, 243, 0.35);
        border-radius: 8px;
        overflow: hidden;
        background: #0d1b2f;
        color: #eaf4ff;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
        font-family: Arial, sans-serif;
        line-height: 1.3;
        clear: both;
      }

      #spa-cdsp-external-docs-panel.spa-cdsp-external-docs-collapsed .spa-cdsp-external-docs-body {
        display: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        background: linear-gradient(90deg, #0f2742, #123a5f);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-title strong {
        color: #ffffff;
        font-size: 13px;
        font-weight: 800;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-title span {
        color: #b8d6ee;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-memory {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 28px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        color: #d7ecff;
        background: rgba(255, 255, 255, 0.08);
        padding: 5px 8px;
        font-size: 10px;
        font-weight: 800;
        line-height: 1.1;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-memory input {
        width: 12px;
        height: 12px;
        margin: 0;
        accent-color: #16966b;
        cursor: pointer;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-button {
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        color: #ffffff;
        background: #1f6fb8;
        padding: 6px 9px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-button:hover,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-button:focus {
        color: #ffffff;
        background: #2e83d2;
        text-decoration: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-button-secondary {
        background: #263d57;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-button-secondary:hover,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-button-secondary:focus {
        background: #31506f;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-complete {
        background: #11825b;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-complete:hover,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-complete:focus {
        background: #16966b;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-wrap {
        position: relative;
        display: inline-flex;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 7;
        display: grid;
        gap: 4px;
        min-width: 172px;
        padding: 6px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 7px;
        background: #10243a;
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.24);
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-menu[hidden] {
        display: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-option {
        width: 100%;
        text-align: left;
        background: #263d57;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-option:hover,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-option:focus {
        background: #31506f;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-option-active {
        background: #11825b;
        box-shadow: inset 3px 0 0 #6ee7b7;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-order {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        padding-top: 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-order[hidden] {
        display: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-button:disabled {
        opacity: 0.65;
        cursor: wait;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-body {
        padding: 10px;
        background: #10243a;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-source {
        display: inline-grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
        width: min(360px, 100%);
        margin: 0 0 8px 0;
        padding: 3px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 7px;
        background: #0b1b2b;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-source-option {
        margin: 0;
        cursor: pointer;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-source-option input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-source-option span {
        display: block;
        border-radius: 5px;
        padding: 5px 8px;
        color: #bdd3e6;
        font-size: 11px;
        font-weight: 800;
        text-align: center;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-source-option input:checked + span {
        background: #1f6fb8;
        color: #ffffff;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-source-option input:disabled + span {
        opacity: 0.45;
        cursor: not-allowed;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-status {
        margin: 0 0 8px 0;
        color: #c5d9eb;
        font-size: 11px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-viewer {
        min-height: 160px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 6px;
        max-height: min(68vh, 620px);
        overflow: hidden;
        background: #07111d;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-placeholder {
        display: flex;
        min-height: 160px;
        align-items: center;
        justify-content: center;
        padding: 16px;
        color: #9db6ca;
        text-align: center;
        font-size: 12px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search {
        width: 100%;
        margin: 0;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        background: #ffffff;
        color: #172536;
        padding: 7px 9px;
        font-size: 12px;
        outline: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search-tools {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto auto;
        gap: 6px;
        align-items: stretch;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-exact-option {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-height: 33px;
        margin: 0;
        padding: 0 8px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        background: #10283f;
        color: #eaf4ff;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-wrap {
        position: relative;
        display: flex;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-button {
        min-width: 82px;
        white-space: nowrap;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-menu {
        position: absolute;
        top: calc(100% + 5px);
        right: 0;
        z-index: 6;
        width: 230px;
        max-width: min(78vw, 260px);
        padding: 5px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 7px;
        background: #0b1b2b;
        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.26);
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-menu[hidden] {
        display: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-option {
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 0;
        padding: 7px 8px;
        border-radius: 6px;
        color: #eaf4ff;
        cursor: pointer;
        user-select: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-option:hover {
        background: rgba(31, 111, 184, 0.28);
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-option:has(input:checked) {
        background: rgba(31, 111, 184, 0.38);
        box-shadow: inset 3px 0 0 #36a3ff;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-option input {
        margin: 0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-option strong {
        display: block;
        color: #ffffff;
        font-size: 11px;
        line-height: 1.25;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-clear {
        width: 100%;
        margin-top: 5px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search-row {
        display: grid;
        grid-template-columns: minmax(240px, 36%) minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        margin: 0 0 8px 0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-bar {
        display: block;
        margin: 0;
        padding: 0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-controls {
        display: grid;
        grid-template-columns: repeat(6, minmax(108px, 1fr));
        align-items: center;
        gap: 6px;
        width: 100%;
        flex-shrink: 0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-all,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-selected,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-direct {
        border-color: rgba(255, 255, 255, 0.22);
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
        min-height: 35px;
        padding: 8px 9px;
        white-space: normal;
        line-height: 1.15;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-all {
        background: #11795f;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-all:hover,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-all:focus {
        background: #159474;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-selected {
        background: #6d3ec9;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-selected:hover,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-selected:focus {
        background: #7b4ce0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-direct {
        background: #0780bf;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-direct:hover,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-direct:focus {
        background: #0b96de;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-list {
        max-height: min(60vh, 560px);
        overflow: auto;
        padding: 8px;
        background: #f3f8fc;
        color: #132337;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-day {
        margin: 0 0 10px 0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-day-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 6px 0;
        padding: 4px 8px;
        border-radius: 999px;
        background: #d9ecfa;
        color: #123a5f;
        font-size: 11px;
        font-weight: 800;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border: 1px solid #d6e3ec;
        border-radius: 7px;
        background: #ffffff;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-select {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        min-width: 22px;
        height: 22px;
        margin: 0;
        cursor: pointer;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-select input {
        width: 15px;
        height: 15px;
        margin: 0;
        cursor: pointer;
        accent-color: #11795f;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-select input:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item + .spa-cdsp-external-docs-item {
        margin-top: 6px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item-title {
        color: #10243a;
        font-size: 12px;
        font-weight: 800;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item-description {
        margin-top: 3px;
        color: #31465c;
        font-size: 11px;
        line-height: 1.35;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 6px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: #eef4f8;
        color: #516b82;
        padding: 4px 8px;
        font-size: 10.5px;
        font-weight: 700;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open {
        align-self: center;
        border-radius: 6px;
        background: #11795f;
        color: #ffffff;
        padding: 7px 10px;
        font-size: 11px;
        font-weight: 800;
        text-decoration: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-copy-id {
        align-self: center;
        border: 1px solid #b7cce0;
        border-radius: 6px;
        background: #edf5fb;
        color: #153653;
        padding: 7px 9px;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open:hover,
      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open:focus {
        background: #159474;
        color: #ffffff;
        text-decoration: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movements-timeline {
        max-height: min(68vh, 720px);
        overflow: auto;
        padding: 14px 14px 16px 14px;
        background: #eef5fb;
        color: #132337;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-open-deadlines {
        margin: 0 0 8px 0;
        padding: 10px;
        border: 1px solid #b7dfc8;
        border-radius: 7px;
        background: #eaf8ef;
        color: #123a2b;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-open-deadlines-title {
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-open-deadlines-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 7px;
        margin-top: 8px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-open-deadline-item {
        display: grid;
        gap: 3px;
        border: 1px solid #cde8d6;
        border-radius: 6px;
        background: #ffffff;
        padding: 8px;
        font-size: 11px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-row {
        display: grid;
        grid-template-columns: 124px 28px minmax(0, 1fr);
        gap: 0;
        position: relative;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-row + .spa-cdsp-movement-row {
        margin-top: 14px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-date {
        padding: 6px 12px 0 0;
        color: #123a5f;
        font-size: 13px;
        font-weight: 800;
        text-align: right;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-date small {
        display: block;
        margin-top: 3px;
        color: #5a7288;
        font-size: 11px;
        font-weight: 700;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-line {
        position: relative;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-line::before {
        content: "";
        position: absolute;
        top: 15px;
        bottom: -27px;
        left: 13px;
        width: 3px;
        background: #c5dcec;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-row:last-child .spa-cdsp-movement-line::before {
        bottom: auto;
        height: 12px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-dot {
        position: absolute;
        top: 9px;
        left: 6px;
        width: 16px;
        height: 16px;
        border: 2px solid #ffffff;
        border-radius: 999px;
        background: #1f6fb8;
        box-shadow: 0 0 0 2px #c5dcec;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-card {
        min-width: 0;
        padding: 14px;
        border: 1px solid #c9deeb;
        border-radius: 7px;
        background: #ffffff;
        box-shadow: 0 4px 12px rgba(18, 58, 95, 0.08);
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-title {
        color: #10243a;
        font-size: 15px;
        font-weight: 800;
        line-height: 1.35;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-description {
        margin-top: 7px;
        color: #31465c;
        font-size: 12.5px;
        line-height: 1.45;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expedientes {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expedientes-heading {
        color: #163654;
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente {
        border: 1px solid #bdd8ea;
        border-left: 5px solid #16876f;
        border-radius: 6px;
        background: #f6fbff;
        padding: 12px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-open {
        border-left-color: #16a34a;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-closed {
        border-left-color: #dc2626;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-title {
        color: #0e314d;
        font-size: 14px;
        font-weight: 900;
        line-height: 1.3;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-summary {
        margin-top: 6px;
        color: #405b73;
        font-size: 12px;
        line-height: 1.45;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-status {
        display: inline-flex;
        width: fit-content;
        margin-top: 6px;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 10.5px;
        font-weight: 900;
        text-transform: uppercase;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-status-open {
        background: #dcfce7;
        color: #166534;
        border: 1px solid #86efac;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-status-closed {
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-deadline-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-deadline-cell {
        min-width: 0;
        border-radius: 6px;
        background: #e8f3fb;
        padding: 8px 9px;
        color: #163654;
        font-size: 12px;
        line-height: 1.35;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-deadline-cell strong {
        display: block;
        margin-bottom: 4px;
        color: #5c7185;
        font-size: 10px;
        text-transform: uppercase;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-deadline-flags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 9px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-response-context {
        flex: 1 0 100%;
        color: #274a68;
        font-size: 11px;
        font-weight: 900;
        line-height: 1.35;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-movement-action {
        border: 0;
        border-radius: 6px;
        background: #0f7a63;
        color: #fff;
        padding: 7px 10px;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-search {
        display: none;
        margin: 8px 0;
        padding: 8px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 7px;
        background: #0b1b2b;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-search-row {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) auto auto auto;
        gap: 6px;
        align-items: start;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-input {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        background: #ffffff;
        color: #172536;
        padding: 7px 9px;
        font-size: 12px;
        outline: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-progress {
        margin-top: 6px;
        color: #bad2e6;
        font-size: 11px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-option {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 7px;
        color: #d5e6f3;
        font-size: 11px;
        cursor: pointer;
        user-select: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-number {
        width: 64px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        background: #ffffff;
        color: #172536;
        padding: 5px 8px;
        font-size: 11px;
        outline: none;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-results {
        display: none;
        max-height: 260px;
        overflow: auto;
        margin-top: 8px;
        padding: 8px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 7px;
        background: #f3f8fc;
        color: #132337;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search-hit {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border: 1px solid #d6e3ec;
        border-radius: 7px;
        background: #ffffff;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search-hit + .spa-cdsp-external-docs-search-hit {
        margin-top: 6px;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-hit-title {
        color: #10243a;
        font-size: 12px;
        font-weight: 800;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-hit-snippet {
        margin-top: 4px;
        color: #31465c;
        font-size: 11px;
        line-height: 1.35;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-highlight {
        border-radius: 3px;
        background: #fff176;
        color: #10243a;
        padding: 0 2px;
        font-weight: 800;
      }

      #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-empty {
        padding: 16px;
        color: #657b90;
        text-align: center;
        font-size: 12px;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel {
        border-color: var(--cdsp-border, #254b86) !important;
        background: var(--cdsp-surface, #0b1730) !important;
        color: var(--cdsp-text, #f4f8ff) !important;
        box-shadow: var(--cdsp-shadow, 0 16px 38px rgba(0, 0, 0, 0.36)) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-body,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-list,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-results {
        background: var(--cdsp-bg-soft, #071226) !important;
        color: var(--cdsp-text, #f4f8ff) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search-hit {
        background: var(--cdsp-surface-2, #101f3b) !important;
        border-color: var(--cdsp-border-soft, #183158) !important;
        color: var(--cdsp-text, #f4f8ff) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-input,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-number {
        background: var(--cdsp-surface-2, #101f3b) !important;
        color: var(--cdsp-text, #f4f8ff) !important;
        border-color: var(--cdsp-border, #254b86) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-menu {
        background: var(--cdsp-surface-2, #101f3b) !important;
        border-color: var(--cdsp-border, #254b86) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-option strong,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-filter-option {
        color: var(--cdsp-text, #f4f8ff) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search::placeholder,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-input::placeholder {
        color: var(--cdsp-muted, #8f9db5) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-day-title,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-chip {
        background: rgba(127, 208, 255, 0.12) !important;
        color: var(--cdsp-text-soft, #bdc9dd) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movements-timeline {
        background: var(--cdsp-bg-soft, #071226) !important;
        color: var(--cdsp-text, #f4f8ff) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-card {
        background: var(--cdsp-surface-2, #101f3b) !important;
        border-color: var(--cdsp-border-soft, #183158) !important;
        color: var(--cdsp-text, #f4f8ff) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-date,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-title {
        color: var(--cdsp-text, #f4f8ff) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-date small,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-description {
        color: var(--cdsp-muted, #8f9db5) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-line::before {
        background: var(--cdsp-border-soft, #183158) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-dot {
        border-color: var(--cdsp-surface-2, #101f3b) !important;
        box-shadow: 0 0 0 2px var(--cdsp-border-soft, #183158) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente {
        background: rgba(127, 208, 255, 0.08) !important;
        border-color: var(--cdsp-border-soft, #183158) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-title {
        color: var(--cdsp-text, #f4f8ff) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-expedientes-heading {
        color: var(--cdsp-text-soft, #bdc9dd) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-summary,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-expediente-response-context,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-deadline-cell {
        color: var(--cdsp-text-soft, #bdc9dd) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-deadline-cell {
        background: rgba(255, 255, 255, 0.06) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-movement-deadline-cell strong {
        color: var(--cdsp-muted, #8f9db5) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item-title,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-hit-title {
        color: var(--cdsp-text, #f4f8ff) !important;
      }

      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item-description,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-hit-snippet,
      html.cdsp-spa-dark-mode #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-empty {
        color: var(--cdsp-muted, #8f9db5) !important;
      }

      @media (max-width: 767px) {
        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-header {
          align-items: flex-start;
          flex-direction: column;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-actions {
          width: 100%;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-button {
          flex: 1;
          text-align: center;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-wrap,
        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-wrap > .spa-cdsp-external-docs-button {
          width: 100%;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-process-menu {
          left: 0;
          right: auto;
          width: 100%;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-item {
          grid-template-columns: 1fr;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-content-search-row,
        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search-row,
        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search-hit {
          grid-template-columns: 1fr;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-search-tools {
          grid-template-columns: 1fr;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-bar {
          align-items: stretch;
          flex-direction: column;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-controls,
        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-open-all,
        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-direct {
          width: 100%;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-external-docs-quick-controls {
          grid-template-columns: 1fr;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-movement-row {
          grid-template-columns: 92px 22px minmax(0, 1fr);
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-movement-date {
          font-size: 11px;
        }

        #spa-cdsp-external-docs-panel .spa-cdsp-movement-deadline-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createExternalDocumentsButton(text, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spa-cdsp-external-docs-button" + (className ? " " + className : "");
    button.textContent = text;
    return button;
  }

  function getExternalDocumentType(dataTitle) {
    const text = normalizeText(dataTitle);
    const match = text.match(/\)\s*-\s*(.+)$/);
    return match ? match[1].trim() : text.replace(/^\(?\d+\)?\s*-\s*/, "").trim();
  }

  function getExternalDocumentDateInfo(info) {
    const text = normalizeText(info);
    const match = text.match(/juntad[oa]\s+em\s+(\d{2}\/\d{2}\/\d{4})(?:\s*-\s*(\d{2}:\d{2}))?/i);
    return {
      date: match ? match[1] : "",
      time: match && match[2] ? match[2] : "",
    };
  }

  function getExternalDocumentDescription(info, title, id) {
    let description = normalizeText(info);
    if (id) description = description.replace(new RegExp("^" + id + "\\s*-\\s*"), "");
    description = description.replace(/\s+juntad[oa]\s+em\s+\d{2}\/\d{2}\/\d{4}(?:\s*-\s*\d{2}:\d{2})?.*$/i, "");
    description = description.trim();

    return description || normalizeText(title) || "Documento do processo";
  }

  function directPdfUrlFromSpaViewer(rawUrl) {
    const safeText = String(rawUrl || "").trim();
    if (!safeText) return "";

    try {
      const parsed = new URL(safeText, window.location.origin);
      if (parsed.pathname === "/pdfjs/web/viewer.html") {
        const file = parsed.searchParams.get("file");
        if (file) return new URL(file, parsed.origin).href;
      }

      return parsed.href;
    } catch (_error) {
      return "";
    }
  }

  function isPdfLikeExternalUrl(rawUrl) {
    const text = String(rawUrl || "");
    return /\.pdf(?:[?#].*)?$/i.test(text) || /\/pdfjs\/web\/viewer\.html/i.test(text);
  }

  function getExternalDocumentOpenUrl(item) {
    if (!item) return "";
    return item.pdfUrl || item.url || item.viewerUrl || "";
  }

  async function openExternalDocumentPdfAsBlob(item, link) {
    const pdfUrl = item && (item.pdfUrl || directPdfUrlFromSpaViewer(item.url || item.viewerUrl));
    if (!pdfUrl) return false;

    const opened = window.open("about:blank", "_blank");
    if (!opened) return false;

    const previousText = link ? link.textContent : "";
    if (link) link.textContent = "Abrindo...";

    try {
      try {
        opened.document.title = "Carregando PDF";
        opened.document.body.style.cssText =
          "margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial,sans-serif;background:#f4f7fa;color:#17324d;";
        opened.document.body.textContent = "Carregando PDF...";
      } catch (_error) {
        // A aba em branco pode nao permitir escrita em alguns cenarios do Chrome.
      }

      const response = await fetch(pdfUrl, {
        credentials: "same-origin",
        cache: "force-cache",
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status + " ao baixar PDF.");
      }

      const blob = await response.blob();
      const pdfBlob = blob.type && /pdf/i.test(blob.type) ? blob : new Blob([blob], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(pdfBlob);
      opened.location.href = blobUrl;

      setTimeout(() => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (_error) {
          // O navegador pode ja ter liberado a URL temporaria.
        }
      }, 10 * 60 * 1000);

      return true;
    } catch (error) {
      try {
        opened.location.href = pdfUrl;
      } catch (_innerError) {
        window.open(pdfUrl, "_blank");
      }

      if (typeof log === "function") {
        log("Nao foi possivel abrir PDF localmente; usando link direto do SPA: " + (error && error.message ? error.message : error));
      }

      return false;
    } finally {
      if (link) link.textContent = previousText || "Abrir PDF";
    }
  }

  function bindExternalDocumentOpenButton(open, item) {
    if (!open || !item || !item.isPdf) return;

    open.addEventListener("click", (event) => {
      event.preventDefault();
      openExternalDocumentPdfAsBlob(item, open);
    });
  }

  function createExternalDocumentItem(data) {
    const viewerUrl = data.viewerUrl || data.url || "";
    const pdfUrl = data.pdfUrl || (isPdfLikeExternalUrl(viewerUrl) ? directPdfUrlFromSpaViewer(viewerUrl) : "");
    const url = pdfUrl || viewerUrl;

    return {
      id: data.id || "",
      type: data.type || "Documento",
      description: data.description || "Documento do processo",
      date: data.date || "",
      time: data.time || "",
      url: url,
      viewerUrl: viewerUrl,
      pdfUrl: pdfUrl,
      source: data.source || "autos",
      sourceLabel: data.sourceLabel || "",
      isPdf: Boolean(pdfUrl || isPdfLikeExternalUrl(url)),
    };
  }

  function getExternalDocumentSearchText(item) {
    if (!item) return "";
    return normalizeText(
      [
        item.id,
        item.type,
        item.description,
        item.date,
        item.time,
        item.sourceLabel,
        item.url,
        item.viewerUrl,
        item.pdfUrl,
      ].join(" ")
    ).toLowerCase();
  }

  function externalDocumentSelectionKey(item) {
    if (!item) return "";
    return [
      item.source || "",
      item.id || "",
      item.pdfUrl || "",
      item.viewerUrl || "",
      item.url || "",
      item.date || "",
      item.time || "",
      item.description || "",
    ].join("|");
  }

  function isExternalDocumentSelectable(item) {
    if (!item || item.noOpen || !item.isPdf) return false;
    return Boolean(directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(item)));
  }

  function getExternalSelectionSet(panel) {
    if (!panel) return new Set();
    if (!panel._externalDocumentSelectedKeys) panel._externalDocumentSelectedKeys = new Set();
    return panel._externalDocumentSelectedKeys;
  }

  function isExternalDocumentSelected(panel, item) {
    const key = externalDocumentSelectionKey(item);
    return Boolean(key && getExternalSelectionSet(panel).has(key));
  }

  function setExternalDocumentSelected(panel, item, selected) {
    if (!panel) return;
    const key = externalDocumentSelectionKey(item);
    if (!key) return;

    const selectedKeys = getExternalSelectionSet(panel);
    if (selected) selectedKeys.add(key);
    else selectedKeys.delete(key);

    if (panel && typeof panel._refreshExternalDocumentSelectionControls === "function") {
      panel._refreshExternalDocumentSelectionControls();
    }
  }

  function selectedExternalDocumentsFromPanel(panel) {
    if (!panel) return [];
    const selectedKeys = getExternalSelectionSet(panel);
    if (!selectedKeys.size) return [];

    const candidates = [];
    const cache = panel._externalDocumentCache || {};
    Object.keys(cache).forEach((key) => {
      if (Array.isArray(cache[key].items)) candidates.push(...cache[key].items);
    });
    if (Array.isArray(panel._contentSearchHits)) candidates.push(...panel._contentSearchHits);

    const seen = new Set();
    return candidates.filter((item) => {
      const key = externalDocumentSelectionKey(item);
      if (!key || !selectedKeys.has(key) || seen.has(key) || !isExternalDocumentSelectable(item)) return false;
      seen.add(key);
      return true;
    });
  }

  function createExternalDocumentSelectionCheckbox(panel, item) {
    const label = document.createElement("label");
    label.className = "spa-cdsp-external-docs-select";
    label.title = isExternalDocumentSelectable(item)
      ? "Selecionar este PDF para abrir ou unificar manualmente."
      : "Este item nao possui PDF direto para selecao.";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.disabled = !isExternalDocumentSelectable(item);
    input.checked = !input.disabled && isExternalDocumentSelected(panel, item);
    input.addEventListener("change", () => {
      setExternalDocumentSelected(panel, item, input.checked);
    });

    label.appendChild(input);
    return label;
  }

  function getExternalDocumentTimestamp(item) {
    const dateText = String((item && item.date) || "");
    const timeText = String((item && item.time) || "");
    const date = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!date) return 0;

    const time = timeText.match(/(\d{2}):(\d{2})/);
    const hour = time ? parseInt(time[1], 10) : 0;
    const minute = time ? parseInt(time[2], 10) : 0;
    return new Date(
      parseInt(date[3], 10),
      parseInt(date[2], 10) - 1,
      parseInt(date[1], 10),
      hour,
      minute
    ).getTime();
  }

  function scoreInitialPetitionItem(item) {
    const text = getExternalDocumentSearchText(item);
    if (!text) return 0;

    let score = 0;
    if (/\bpetic(?:ao|oes|a|as)?\s+(?:inicial|iniciais)\b/.test(text)) score += 120;
    if (/\b(?:inicial|iniciais)\s+petic/.test(text)) score += 95;
    if (text.indexOf("peticao inicial") >= 0 || text.indexOf("peticoes iniciais") >= 0) score += 90;
    if (/\binicial\b/.test(text) && /\bpetic/.test(text)) score += 55;
    if (/\bpetic/.test(text)) score += 10;
    return score;
  }

  function findInitialPetitionItem(items) {
    return (Array.isArray(items) ? items : [])
      .map((item, index) => ({
        item: item,
        index: index,
        score: scoreInitialPetitionItem(item),
        timestamp: getExternalDocumentTimestamp(item),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.timestamp - b.timestamp || a.index - b.index)[0]?.item || null;
  }

  function scorePgePetitionItem(item) {
    const text = getExternalDocumentSearchText(item);
    if (!text || text.indexOf("cdsp") < 0) return 0;

    let score = 80;
    if (/\bpetic/.test(text)) score += 30;
    if (/\bmanifest/.test(text)) score += 18;
    if (/\bcontest/.test(text)) score += 18;
    if (/\bagravo\b/.test(text)) score += 18;
    if (/\bcontrarrazo/.test(text)) score += 14;
    if (/\boficio\b/.test(text)) score += 10;
    return score;
  }

  function findLatestPgePetitionItem(items) {
    return (Array.isArray(items) ? items : [])
      .map((item, index) => ({
        item: item,
        index: index,
        score: scorePgePetitionItem(item),
        timestamp: getExternalDocumentTimestamp(item),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.timestamp - a.timestamp || b.score - a.score || a.index - b.index)[0]?.item || null;
  }

  function findLatestDecisionItem(items) {
    const decisionPattern = /\b(?:decis|tutela|liminar|desp|senten|monoc|julg|ement|acord)/;
    return (Array.isArray(items) ? items : [])
      .map((item, index) => ({
        item: item,
        index: index,
        matches: decisionPattern.test(getExternalDocumentSearchText(item)),
        timestamp: getExternalDocumentTimestamp(item),
      }))
      .filter((entry) => entry.matches)
      .sort((a, b) => b.timestamp - a.timestamp || a.index - b.index)[0]?.item || null;
  }

  function findCurrentProcedureExpedienteItem() {
    const all = Array.from(document.querySelectorAll(CONFIG.expedienteSelector)).filter((element) => {
      if (element.closest("#spa-cdsp-panel, #spa-cdsp-external-docs-panel")) return false;
      return isExpedienteElement(element);
    });
    const visible = all.filter(isVisible);
    const expedientes = sortByScreenPosition(visible.length ? visible : all);
    const element = expedientes[0];
    const url = elementUrl(element);
    if (!element || !url) return null;

    return createExternalDocumentItem({
      type: "Expediente atual",
      description: normalizeText(expedienteTitle(element, 0)) || "Expediente atual da pendência",
      url: url,
      viewerUrl: url,
      source: "procedure",
      sourceLabel: "Pendência",
    });
  }

  async function openExternalDocumentQuickItem(item, status, label) {
    const url = directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(item));
    if (!url) {
      status.textContent = "Nao foi possivel identificar o link para " + label + ".";
      return false;
    }

    if (await openUrlInBackground(url)) {
      status.textContent = label + " aberto em nova aba.";
      return true;
    }

    status.textContent = "O navegador bloqueou a abertura de " + label + ".";
    return false;
  }

  function parseExternalAutosLinks(doc) {
    const links = Array.from(
      doc.querySelectorAll("#tree-documents-list a.document-link[id^='document-'], .documents-timeline a.document-link[id^='document-']")
    );
    const seen = new Set();
    const items = [];

    for (const link of links) {
      const href = link.getAttribute("href");
      if (!href || /^javascript:/i.test(href)) continue;

      const id =
        String(link.id || "").replace(/^document-/, "") ||
        (normalizeText(link.getAttribute("data-title")).match(/\((\d+)\)/) || [])[1] ||
        "";
      const absoluteUrl = new URL(href, window.location.origin).href;
      const key = id || absoluteUrl;
      if (seen.has(key)) continue;
      seen.add(key);

      const dataInfo = link.getAttribute("data-info") || "";
      const dataTitle = link.getAttribute("data-title") || "";
      const title = link.getAttribute("title") || "";
      const dateInfo = getExternalDocumentDateInfo(dataInfo || link.textContent);

      items.push(createExternalDocumentItem({
        id: id,
        type: getExternalDocumentType(dataTitle) || "Documento",
        description: getExternalDocumentDescription(dataInfo || link.textContent, title, id),
        date: dateInfo.date,
        time: dateInfo.time,
        url: absoluteUrl,
        viewerUrl: absoluteUrl,
        source: "autos",
        sourceLabel: "Autos",
      }));
    }

    return items;
  }

  function parseProcedureFolderPdfLinks(doc) {
    const links = Array.from(doc.querySelectorAll("a.document-link[id^='document-'][href*='/pdfjs/web/viewer.html']"));
    const seen = new Set();
    const items = [];

    for (const link of links) {
      const href = link.getAttribute("href");
      if (!href || /^javascript:/i.test(href)) continue;

      const dataInfo = link.getAttribute("data-info") || "";
      if (/^pagina\s+\d+$/i.test(normalizeText(dataInfo))) continue;

      const id =
        String(link.id || "").replace(/^document-/, "") ||
        (normalizeText(link.getAttribute("data-title")).match(/\((\d+)\)/) || [])[1] ||
        "";
      const absoluteUrl = new URL(href, window.location.origin).href;
      const key = id || absoluteUrl;
      if (seen.has(key)) continue;
      seen.add(key);

      const dataTitle = link.getAttribute("data-title") || "";
      const title = link.getAttribute("title") || "";
      const dateInfo = getExternalDocumentDateInfo(dataInfo || link.textContent);

      items.push(
        createExternalDocumentItem({
          id: id,
          type: getExternalDocumentType(dataTitle) || "Documento da pasta",
          description: getExternalDocumentDescription(dataInfo || link.textContent, title, id),
          date: dateInfo.date,
          time: dateInfo.time,
          url: absoluteUrl,
          viewerUrl: absoluteUrl,
          source: "folder",
          sourceLabel: "Pasta",
        })
      );
    }

    return items;
  }

  function firstFolderItemLink(item, selectors) {
    for (const selector of selectors) {
      const link = item.querySelector(selector);
      const href = link ? link.getAttribute("href") : "";
      if (href && !/^javascript:/i.test(href)) return link;
    }

    return null;
  }

  function readFolderCellText(row, selector) {
    const element = row.querySelector(selector);
    return normalizeText(element ? element.textContent : "");
  }

  function parseFolderRecord(item, kind) {
    const isFolder = kind === "folder";
    const id =
      item.getAttribute(isFolder ? "data-document-type-id" : "data-document-template-id") ||
      (item.classList.contains("document-type-row") ? item.getAttribute("data-document-type-id") : "") ||
      (item.classList.contains("document-template-row") ? item.getAttribute("data-document-template-id") : "") ||
      "";

    const link = firstFolderItemLink(
      item,
      isFolder
        ? ["a.go-to-folder[href]", "a[href*='/manage_documents/list_document_type/']"]
        : ["a.preview-document[href]", "a.go-to-document[href]", "a[href*='/manage_documents/'][href*='/preview_template']", "a[href*='/manage_documents/'][href*='/edit']"]
    );
    const href = link ? new URL(link.getAttribute("href"), window.location.origin).href : "";
    if (!href) return null;

    const name =
      normalizeText(link.getAttribute("title")) ||
      readFolderCellText(item, ".sortable-name") ||
      normalizeText(link.textContent) ||
      (isFolder ? "Pasta" : "Documento da pasta");
    const createdAt = readFolderCellText(item, ".sortable-creation-date");
    const category = readFolderCellText(item, ".sortable-category");
    const owner = readFolderCellText(item, ".sortable-owner");
    const descriptionParts = [];

    if (isFolder) {
      descriptionParts.push("Pasta da pasta do processo");
    } else if (category && category !== "-") {
      descriptionParts.push("Categoria: " + category);
    } else {
      descriptionParts.push("Documento/modelo da pasta do processo");
    }

    if (owner && owner !== "-") descriptionParts.push("Proprietario: " + owner);

    return createExternalDocumentItem({
      id: id,
      type: isFolder ? "Pasta" : category && category !== "-" ? category : "Documento da pasta",
      description: name + (descriptionParts.length ? " · " + descriptionParts.join(" · ") : ""),
      date: createdAt || "Sem data informada",
      time: "",
      url: href,
      source: "folder",
      sourceLabel: "Pasta",
    });
  }

  function parseProcedureFolderLinks(doc) {
    const pdfItems = parseProcedureFolderPdfLinks(doc);
    if (pdfItems.length) return pdfItems;

    const seen = new Set();
    const items = [];
    let records = Array.from(doc.querySelectorAll("tr.document-type-row, tr.document-template-row"));

    if (!records.length) {
      records = Array.from(
        doc.querySelectorAll(
          ".manage-documents-grid-container[data-document-type-id], .manage-documents-grid-container[data-document-template-id]"
        )
      );
    }

    for (const record of records) {
      const item = parseFolderRecord(record, record.matches("[data-document-type-id], tr.document-type-row") ? "folder" : "document");
      if (!item) continue;

      const key = item.source + ":" + (item.id || item.url);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }

    return items;
  }

  function parseExternalDocumentLinks(doc, sourceKey) {
    if (sourceKey === "folder") return parseProcedureFolderLinks(doc);
    return parseExternalAutosLinks(doc);
  }

  async function fetchExternalDocumentSummary(url, sourceKey) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("SPA retornou HTTP " + response.status + " ao carregar " + (sourceKey === "folder" ? "a pasta" : "os autos") + ".");
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return parseExternalDocumentLinks(doc, sourceKey);
  }

  function writeExternalAutosPdfLoadingPage(opened, text) {
    if (!opened) return;

    try {
      opened.document.open();
      opened.document.write(
        "<!doctype html><meta charset='utf-8'><title>Processo completo</title>" +
          "<body style=\"margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial,sans-serif;background:#f4f7fa;color:#17324d;font-size:14px;\">" +
          "<div data-cdsp-loading-text style=\"max-width:360px;text-align:center;line-height:1.45;\">" +
          escapeExternalAutosHtml(text || "Gerando PDF completo...") +
          "</div></body>"
      );
      opened.document.close();
    } catch (_error) {
      // A aba em branco pode nao permitir escrita em alguns cenarios do Chrome.
    }
  }

  function escapeExternalAutosHtml(value) {
    return String(value || "").replace(/[<>&"]/g, (char) => ({
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "\"": "&quot;",
    }[char]));
  }

  function updateExternalAutosPdfLoadingPage(opened, text) {
    if (!opened) return;

    try {
      const box = opened.document.querySelector("[data-cdsp-loading-text]");
      if (box) box.textContent = text || "";
    } catch (_error) {
      // A aba pode ja ter navegado para um PDF/blob.
    }
  }

  async function loadExternalAutosDirectItems(source, fallbackItems, status) {
    let html = "";

    try {
      if (status) status.textContent = "Buscando links diretos dos documentos...";
      const response = await fetch(source.url, {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("SPA retornou HTTP " + response.status + " ao carregar os autos.");
      }

      html = await response.text();
    } catch (fetchError) {
      if (!Array.isArray(fallbackItems) || !fallbackItems.length) throw fetchError;
    }

    const autosDoc = html ? new DOMParser().parseFromString(html, "text/html") : null;
    const items = getExternalAutosDirectViewerItems(autosDoc, fallbackItems);

    if (!items.length) {
      throw new Error("Nao encontrei PDFs diretos para montar o Processo Completo.");
    }

    return items;
  }

  function getExternalAutosDirectViewerItems(doc, fallbackItems) {
    const seen = new Set();
    const items = [];
    const addItem = (item) => {
      const url = directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(item));
      const key = (item && item.id) || url;
      if (!url || !key || seen.has(key)) return;
      seen.add(key);
      items.push(
        createExternalDocumentItem({
          id: item.id || "",
          type: item.type || "Documento",
          description: item.description || "Documento do processo",
          date: item.date || "",
          time: item.time || "",
          url: url,
          viewerUrl: item.viewerUrl || item.url || url,
          pdfUrl: url,
          source: "autos",
          sourceLabel: "Autos",
        })
      );
    };

    if (doc) parseExternalAutosLinks(doc).forEach(addItem);
    if (!items.length && Array.isArray(fallbackItems)) {
      fallbackItems.filter((item) => item && item.source === "autos").forEach(addItem);
    }

    return items;
  }

  function parseExternalAutosDateTimeValue(item) {
    const date = String((item && item.date) || "").trim();
    const time = String((item && item.time) || "").trim();
    const dateMatch = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dateMatch) return null;

    const timeMatch = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
    return new Date(
      Number(dateMatch[3]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[1]),
      timeMatch ? Number(timeMatch[1]) : 0,
      timeMatch ? Number(timeMatch[2]) : 0,
      timeMatch && timeMatch[3] ? Number(timeMatch[3]) : 0
    ).getTime();
  }

  function externalAutosNumericId(item) {
    const match = String((item && item.id) || "").match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function sortExternalAutosItems(items, order) {
    const direction = order === "desc" ? "desc" : "asc";
    return (Array.isArray(items) ? items : [])
      .map((item, index) => ({
        item: item,
        index: index,
        dateTime: parseExternalAutosDateTimeValue(item),
        id: externalAutosNumericId(item),
      }))
      .sort((left, right) => {
        const leftHasDate = Number.isFinite(left.dateTime);
        const rightHasDate = Number.isFinite(right.dateTime);

        if (leftHasDate && rightHasDate && left.dateTime !== right.dateTime) {
          return direction === "desc" ? right.dateTime - left.dateTime : left.dateTime - right.dateTime;
        }

        if (leftHasDate !== rightHasDate) return leftHasDate ? -1 : 1;

        const sameDateTime = leftHasDate && rightHasDate && left.dateTime === right.dateTime;
        if (Number.isFinite(left.id) && Number.isFinite(right.id) && left.id !== right.id) {
          if (sameDateTime) return left.id - right.id;
          return direction === "desc" ? right.id - left.id : left.id - right.id;
        }

        return direction === "desc" && !sameDateTime ? right.index - left.index : left.index - right.index;
      })
      .map((entry) => entry.item);
  }

  function externalAutosOrderLabel(order) {
    return order === "desc" ? "decrescente" : "crescente";
  }

  async function ensureExternalPdfMergeLibrary(status) {
    if (window.PDFLib && window.PDFLib.PDFDocument) return true;

    if (status) status.textContent = "Carregando mesclador local de PDF...";
    const response = await requestExtensionMessage("SPA_CDSP_ENSURE_PDF_LIB", {}, 12000);
    if (!response || !response.ok || !(window.PDFLib && window.PDFLib.PDFDocument)) {
      throw new Error((response && response.error) || "Nao foi possivel carregar o mesclador local de PDF.");
    }

    return true;
  }

  async function externalPdfBytesLooksLikePdf(bytes) {
    if (!bytes || !bytes.byteLength) return false;
    const header = new TextDecoder("ascii").decode(bytes.slice(0, Math.min(5, bytes.byteLength)));
    return header === "%PDF-";
  }

  async function fetchExternalAutosPdfBytes(item) {
    const url = directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(item));
    if (!url) throw new Error("Link PDF nao identificado.");

    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " ao baixar PDF.");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!(await externalPdfBytesLooksLikePdf(bytes))) {
      throw new Error("Arquivo retornado nao parece ser PDF.");
    }

    return bytes;
  }

  async function downloadExternalAutosPdfsForMerge(items, status, opened) {
    const docs = Array.isArray(items) ? items : [];
    const limit = Math.max(1, Math.min(CONFIG.processCompleteMergeConcurrency || 4, docs.length || 1));
    const results = new Array(docs.length);
    let nextIndex = 0;
    let completed = 0;

    const update = () => {
      const text =
        "Baixando PDFs " +
        completed +
        "/" +
        docs.length +
        " (" +
        limit +
        " simultaneo(s))...";
      if (status) status.textContent = text;
      updateExternalAutosPdfLoadingPage(opened, text);
    };

    update();

    const workers = Array.from({ length: limit }, async () => {
      while (nextIndex < docs.length) {
        const index = nextIndex;
        nextIndex += 1;

        try {
          results[index] = {
            item: docs[index],
            bytes: await fetchExternalAutosPdfBytes(docs[index]),
          };
        } catch (error) {
          results[index] = {
            item: docs[index],
            error: error && error.message ? error.message : String(error),
          };
        } finally {
          completed += 1;
          update();
        }
      }
    });

    await Promise.all(workers);
    return results;
  }

  function openExternalAutosMergedPdf(opened, mergedBytes, processNumber) {
    const blob = new Blob([mergedBytes], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    opened.location.href = blobUrl;

    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (_error) {
        // O navegador pode ja ter liberado a URL temporaria.
      }
    }, 10 * 60 * 1000);

    try {
      opened.document.title = "Processo completo - " + (processNumber || "CDSP");
    } catch (_error) {
      // A aba pode ja estar navegando para o blob.
    }
  }

  async function mergeExternalAutosPdfs(opened, items, processNumber, status) {
    await ensureExternalPdfMergeLibrary(status);

    const PDFDocument = window.PDFLib.PDFDocument;
    const mergedPdf = await PDFDocument.create();
    let addedPages = 0;
    const failed = [];
    const downloaded = await downloadExternalAutosPdfsForMerge(items, status, opened);

    for (let index = 0; index < downloaded.length; index += 1) {
      const result = downloaded[index];
      const item = result && result.item ? result.item : items[index];
      const label = (index + 1) + "/" + downloaded.length;
      const progressText = "Mesclando PDF " + label + "...";
      if (status) status.textContent = progressText;
      updateExternalAutosPdfLoadingPage(opened, progressText);

      try {
        if (!result || result.error || !result.bytes) {
          throw new Error((result && result.error) || "PDF nao baixado.");
        }

        const sourcePdf = await PDFDocument.load(result.bytes, {
          ignoreEncryption: true,
          updateMetadata: false,
        });
        const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
          addedPages += 1;
        });
        result.bytes = null;
        downloaded[index] = null;
      } catch (error) {
        failed.push({
          item: item,
          error: error && error.message ? error.message : String(error),
        });
      }

      await sleep(20);
    }

    if (!addedPages) {
      throw new Error("Nao foi possivel mesclar nenhum PDF dos autos.");
    }

    const finalText = "Finalizando PDF unificado com " + addedPages + " pagina(s)...";
    if (status) status.textContent = finalText;
    updateExternalAutosPdfLoadingPage(opened, finalText);

    const mergedBytes = await mergedPdf.save({
      addDefaultPage: false,
      useObjectStreams: true,
    });
    openExternalAutosMergedPdf(opened, mergedBytes, processNumber);

    return {
      pages: addedPages,
      failed: failed,
    };
  }

  function addExternalAutosViewerText(doc, parent, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function groupExternalAutosViewerItems(items) {
    const docs = (Array.isArray(items) ? items : []).filter((item) => directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(item)));
    const groups = [];
    let current = null;

    docs.forEach((item) => {
      const hasMovementKey = Boolean(String(item.date || "").trim() && String(item.time || "").trim());
      const key = hasMovementKey ? [item.date || "", item.time || ""].join("|") : "doc-" + groups.length;
      const shouldGroup = hasMovementKey && current && current.key === key;

      if (!shouldGroup) {
        current = {
          key: key || "doc-" + groups.length,
          main: item,
          items: [],
        };
        groups.push(current);
      }

      current.items.push(item);
      current.items.sort((left, right) => {
        const leftId = externalAutosNumericId(left);
        const rightId = externalAutosNumericId(right);
        if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) return leftId - rightId;
        return 0;
      });
      current.main = current.items[0];
    });

    return groups;
  }

  function renderExternalAutosDirectPdfViewer(opened, items, processNumber, options) {
    const docs = (Array.isArray(items) ? items : []).filter((item) => directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(item)));
    const groups = groupExternalAutosViewerItems(docs);
    if (!opened || !docs.length) return false;
    const orderLabel = externalAutosOrderLabel(options && options.order);
    const titleText = (options && options.title) || "Processo Completo";

    try {
      const doc = opened.document;
      doc.open();
      doc.write(
        "<!doctype html><html><head><meta charset='utf-8'><title>Processo completo</title>" +
          "<style>" +
          "body{margin:0;background:#eef3f6;color:#2b3742;font-family:Arial,sans-serif;font-size:13px;}" +
          ".cdsp-header{position:sticky;top:0;z-index:5;background:#f7fafc;color:#22313f;padding:8px 14px;border-bottom:1px solid #cfdbe5;box-shadow:0 1px 6px rgba(28,44,60,.12);}" +
          ".cdsp-title{font-size:14px;font-weight:800;margin:0;color:#17324d;}" +
          ".cdsp-sub{color:#5f6f7d;font-size:11px;margin-top:2px;}" +
          ".cdsp-list{max-width:1380px;margin:10px auto;padding:0 10px 24px;}" +
          ".cdsp-row{display:grid;grid-template-columns:330px minmax(0,1fr);gap:10px;align-items:stretch;margin-bottom:10px;}" +
          ".cdsp-timeline{position:relative;background:#fff;border:1px solid #d5e0e8;border-radius:3px;padding:10px 10px 10px 34px;box-shadow:0 1px 3px rgba(22,40,56,.10);min-height:min(82vh,860px);}" +
          ".cdsp-timeline:before{content:'';position:absolute;left:19px;top:0;bottom:0;width:1px;background:#aab9c4;}" +
          ".cdsp-dot{position:absolute;left:10px;top:14px;width:14px;height:14px;border-radius:50%;background:#128bb3;border:3px solid #f7fbfd;box-shadow:0 0 0 1px #7aaec5;}" +
          ".cdsp-tree-event{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#3c4650;text-transform:uppercase;}" +
          ".cdsp-tree-event:before{content:'\\25B6';font-size:10px;color:#516575;}" +
          ".cdsp-tree-doc{position:relative;display:block;width:100%;margin-top:7px;padding:3px 4px 3px 18px;border:0;border-radius:3px;background:transparent;text-align:left;line-height:1.35;color:#344655;font:inherit;cursor:pointer;}" +
          ".cdsp-tree-doc:hover,.cdsp-tree-doc-active{background:#eef6fb;}" +
          ".cdsp-tree-doc:before{content:'';position:absolute;left:-15px;top:9px;width:24px;border-top:1px solid #aab9c4;}" +
          ".cdsp-tree-doc:after{content:'\\1F5CE';position:absolute;left:0;top:0;font-size:12px;color:#5e7182;}" +
          ".cdsp-tree-doc-child{margin-left:14px;}" +
          ".cdsp-tree-doc-child:before{left:-28px;width:35px;}" +
          ".cdsp-id-inline{background:#fff36b;color:#1e2e3b;font-weight:800;padding:0 2px;border-radius:2px;}" +
          ".cdsp-kind{display:inline;font-size:12px;font-weight:700;color:#263949;}" +
          ".cdsp-datebar{position:absolute;right:10px;bottom:8px;color:#778898;font-size:10px;}" +
          ".cdsp-desc{margin-top:6px;color:#40566b;font-size:11px;line-height:1.4;word-break:break-word;text-transform:uppercase;}" +
          ".cdsp-open{display:inline-block;margin-top:10px;background:#11825b;color:#fff;text-decoration:none;border-radius:4px;padding:6px 10px;font-size:11px;font-weight:800;}" +
          ".cdsp-preload-status{margin-top:8px;color:#63798d;font-size:10px;line-height:1.35;}" +
          ".cdsp-card{position:relative;background:#fff;border:1px solid #cddce8;border-radius:7px;overflow:hidden;box-shadow:0 2px 7px rgba(16,36,58,.07);}" +
          ".cdsp-frame{display:block;width:100%;height:min(82vh,860px);border:0;background:#f4f7fa;}" +
          ".cdsp-frame-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(244,247,250,.86);color:#3e566b;font-size:12px;font-weight:800;pointer-events:none;}" +
          ".cdsp-frame-loading[hidden]{display:none!important;}" +
          ".cdsp-spinner{width:14px;height:14px;border-radius:50%;border:2px solid #b9c9d6;border-top-color:#11825b;animation:cdsp-spin .8s linear infinite;}" +
          "@keyframes cdsp-spin{to{transform:rotate(360deg)}}" +
          ".cdsp-loading{padding:18px;color:#5b7085;text-align:center;}" +
          "@media(max-width:840px){.cdsp-row{grid-template-columns:1fr}.cdsp-timeline{min-height:auto}.cdsp-frame{height:76vh}}" +
          "</style></head><body></body></html>"
      );
      doc.close();

      const header = doc.createElement("header");
      header.className = "cdsp-header";
      addExternalAutosViewerText(doc, header, "h1", "cdsp-title", titleText);
      addExternalAutosViewerText(
        doc,
        header,
        "div",
        "cdsp-sub",
        (processNumber || "Processo") + " · " + groups.length + " andamento(s), " + docs.length + " PDF(s) · " + orderLabel
      );
      doc.body.appendChild(header);

      const list = doc.createElement("main");
      list.className = "cdsp-list";
      doc.body.appendChild(list);

      const frames = [];
      const preloadQueue = [];
      const preloadedUrls = new Set();
      let activePreloads = 0;

      const updatePreloadStatus = (groupMeta) => {
        if (!groupMeta.statusNode || !groupMeta.urls.length) return;

        if (!groupMeta.started) {
          groupMeta.statusNode.textContent =
            groupMeta.urls.length + " anexo(s) serao pre-carregados ao visualizar este andamento.";
          return;
        }

        if (groupMeta.pending > 0) {
          groupMeta.statusNode.textContent = "Carregando anexos... " + groupMeta.done + "/" + groupMeta.urls.length;
          return;
        }

        groupMeta.statusNode.textContent =
          groupMeta.failed > 0
            ? groupMeta.done + "/" + groupMeta.urls.length + " anexo(s) pre-carregado(s); demais abrem sob demanda."
            : groupMeta.urls.length + " anexo(s) pre-carregado(s).";
      };

      const pumpPreloadQueue = () => {
        while (activePreloads < 2 && preloadQueue.length) {
          const task = preloadQueue.shift();
          activePreloads += 1;
          task.meta.pending += 1;
          updatePreloadStatus(task.meta);

          fetch(task.url, {
            credentials: "same-origin",
            cache: "force-cache",
          })
            .then((response) => {
              if (!response.ok) throw new Error("HTTP " + response.status);
              return response.arrayBuffer();
            })
            .then(() => {
              task.meta.done += 1;
            })
            .catch(() => {
              task.meta.failed += 1;
            })
            .finally(() => {
              task.meta.pending = Math.max(0, task.meta.pending - 1);
              activePreloads = Math.max(0, activePreloads - 1);
              updatePreloadStatus(task.meta);
              pumpPreloadQueue();
            });
        }
      };

      const startGroupPreload = (groupMeta) => {
        if (!groupMeta || groupMeta.started || !groupMeta.urls.length) return;

        groupMeta.started = true;
        groupMeta.urls.forEach((preloadUrl) => {
          if (!preloadUrl) return;
          if (preloadedUrls.has(preloadUrl)) {
            groupMeta.done += 1;
            return;
          }
          preloadedUrls.add(preloadUrl);
          preloadQueue.push({ url: preloadUrl, meta: groupMeta });
        });
        updatePreloadStatus(groupMeta);
        pumpPreloadQueue();
      };

      const setFrameLoading = (overlay, textNode, loading, message) => {
        if (!overlay) return;
        if (message && textNode) textNode.textContent = message;
        overlay.hidden = !loading;
      };

      groups.forEach((group, index) => {
        const item = group.main;
        const url = directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(item));
        const row = doc.createElement("section");
        row.className = "cdsp-row";
        row.id = "cdsp-doc-" + (index + 1);

        const timeline = doc.createElement("aside");
        timeline.className = "cdsp-timeline";

        const dot = doc.createElement("span");
        dot.className = "cdsp-dot";
        timeline.appendChild(dot);

        const eventTitle = item.type || "Documento";
        addExternalAutosViewerText(doc, timeline, "div", "cdsp-tree-event", eventTitle);

        addExternalAutosViewerText(doc, timeline, "div", "cdsp-desc", item.description || "Documento do processo");

        const open = doc.createElement("a");
        open.className = "cdsp-open";
        open.href = url;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        open.textContent = "Abrir PDF";
        timeline.appendChild(open);

        addExternalAutosViewerText(
          doc,
          timeline,
          "div",
          "cdsp-datebar",
          [item.date || "Sem data", item.time || ""].filter(Boolean).join(" ")
        );

        const card = doc.createElement("article");
        card.className = "cdsp-card";

        row.appendChild(timeline);

        const iframe = doc.createElement("iframe");
        iframe.className = "cdsp-frame";
        iframe.title = item.description || item.type || "Documento do processo";
        iframe.dataset.src = url;
        card.appendChild(iframe);

        const loadingOverlay = doc.createElement("div");
        loadingOverlay.className = "cdsp-frame-loading";
        loadingOverlay.hidden = true;

        const spinner = doc.createElement("span");
        spinner.className = "cdsp-spinner";

        const loadingText = doc.createElement("span");
        loadingText.textContent = "Carregando PDF...";

        loadingOverlay.appendChild(spinner);
        loadingOverlay.appendChild(loadingText);
        card.appendChild(loadingOverlay);

        const loadFrameUrl = (nextUrl, label) => {
          if (!nextUrl) return;
          if (iframe.src === nextUrl && !iframe.srcdoc) return;

          setFrameLoading(loadingOverlay, loadingText, true, label || "Carregando PDF...");
          iframe.removeAttribute("srcdoc");
          iframe.src = nextUrl;
        };

        iframe.addEventListener("load", () => {
          setFrameLoading(loadingOverlay, loadingText, false);
        });

        iframe.addEventListener("error", () => {
          setFrameLoading(loadingOverlay, loadingText, true, "Nao foi possivel carregar este PDF.");
        });

        if (index === 0) loadFrameUrl(url, "Carregando documento principal...");
        else iframe.srcdoc = "<!doctype html><body style='margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial,sans-serif;color:#5b7085;background:#f4f7fa;'>PDF aguardando rolagem...</body>";

        frames.push(iframe);

        const groupPreload = {
          urls: Array.from(
            new Set(
              group.items
                .slice(1)
                .map((groupItem) => directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(groupItem)))
                .filter(Boolean)
            )
          ),
          statusNode: null,
          started: false,
          pending: 0,
          done: 0,
          failed: 0,
        };

        const treeButtons = [];
        group.items.forEach((groupItem, childIndex) => {
          const groupUrl = directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(groupItem));
          const docLine = doc.createElement("button");
          docLine.type = "button";
          docLine.className = "cdsp-tree-doc" + (childIndex ? " cdsp-tree-doc-child" : " cdsp-tree-doc-active");

          const id = doc.createElement("span");
          id.className = "cdsp-id-inline";
          id.textContent = groupItem.id || String(index + 1) + "." + (childIndex + 1);
          docLine.appendChild(id);
          docLine.appendChild(doc.createTextNode(" - "));

          const kind = doc.createElement("span");
          kind.className = "cdsp-kind";
          kind.textContent = groupItem.type || "Documento";
          docLine.appendChild(kind);

          docLine.title = groupItem.description || groupItem.type || "Abrir documento";
          docLine.addEventListener("click", () => {
            treeButtons.forEach((button) => button.classList.remove("cdsp-tree-doc-active"));
            docLine.classList.add("cdsp-tree-doc-active");
            iframe.title = groupItem.description || groupItem.type || "Documento do processo";
            open.href = groupUrl;
            startGroupPreload(groupPreload);
            loadFrameUrl(groupUrl, childIndex ? "Carregando anexo..." : "Carregando documento principal...");
          });

          treeButtons.push(docLine);
          timeline.insertBefore(docLine, open);
        });

        if (groupPreload.urls.length) {
          const preloadStatus = doc.createElement("div");
          preloadStatus.className = "cdsp-preload-status";
          groupPreload.statusNode = preloadStatus;
          updatePreloadStatus(groupPreload);
          timeline.insertBefore(preloadStatus, open);
        }

        iframe._cdspLoadMainPdf = () => {
          loadFrameUrl(url, "Carregando documento principal...");
          startGroupPreload(groupPreload);
        };

        row.appendChild(card);
        list.appendChild(row);
      });

      if ("IntersectionObserver" in opened) {
        const observer = new opened.IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const frame = entry.target;
              if (typeof frame._cdspLoadMainPdf === "function") frame._cdspLoadMainPdf();
              observer.unobserve(frame);
            });
          },
          { rootMargin: "1200px 0px" }
        );
        frames.forEach((frame) => observer.observe(frame));
      } else {
        frames.forEach((frame) => {
          if (typeof frame._cdspLoadMainPdf === "function") frame._cdspLoadMainPdf();
        });
      }

      return true;
    } catch (_error) {
      return false;
    }
  }

  async function openCompleteAutosPdfFromPanel(source, status, button, fallbackItems, processNumber, mode, order) {
    if (!source || !source.url) {
      status.textContent = "Nao encontrei o link dos autos para gerar o processo completo.";
      return;
    }

    const selectedMode = mode === "merged" ? "merged" : "separate";
    const selectedOrder = order === "desc" ? "desc" : "asc";
    const opened = window.open("about:blank", "_blank");
    if (!opened) {
      status.textContent = "O navegador bloqueou a nova aba do Processo Completo.";
      return;
    }

    const previousText = button ? button.textContent : "";

    if (button) {
      button.disabled = true;
      button.textContent = "Abrindo...";
    }

    try {
      writeExternalAutosPdfLoadingPage(
        opened,
        selectedMode === "merged" ? "Preparando PDF unificado..." : "Abrindo PDFs separados dos autos..."
      );
      const items = sortExternalAutosItems(await loadExternalAutosDirectItems(source, fallbackItems, status), selectedOrder);

      if (selectedMode === "merged") {
        const result = await mergeExternalAutosPdfs(opened, items, processNumber, status);
        status.textContent =
          "PDF unificado aberto com " +
          result.pages +
          " pagina(s)" +
          " (" +
          externalAutosOrderLabel(selectedOrder) +
          ")" +
          (result.failed.length ? "; " + result.failed.length + " documento(s) ignorado(s)." : ".");
        return;
      }

      if (!renderExternalAutosDirectPdfViewer(opened, items, processNumber, { order: selectedOrder, title: "Processo Completo" })) {
        throw new Error("Nao foi possivel abrir o visualizador de PDFs separados.");
      }

      status.textContent =
        "PDFs separados abertos juntos com " +
        items.length +
        " documento(s) (" +
        externalAutosOrderLabel(selectedOrder) +
        ").";
    } catch (error) {
      try {
        opened.location.href = source.url;
      } catch (_innerError) {
        window.open(source.url, "_blank");
      }
      status.textContent =
        (error && error.message ? error.message : "Nao foi possivel abrir o Processo Completo.") +
        " Abri os autos para conferencia.";
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText || "Processo Completo";
      }
    }
  }

  function formatExternalMovementDate(rawDate) {
    const value = String(rawDate || "").trim();
    if (!value) return { date: "Sem data informada", time: "" };

    const compact = value.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?/);
    if (compact) {
      return {
        date: compact[3] + "/" + compact[2] + "/" + compact[1],
        time: compact[4] ? compact[4] + ":" + (compact[5] || "00") + (compact[6] ? ":" + compact[6] : "") : "",
      };
    }

    const direct = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}))?/);
    if (direct) return { date: direct[1] + "/" + direct[2] + "/" + direct[3], time: direct[4] || "" };

    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (iso) return { date: iso[3] + "/" + iso[2] + "/" + iso[1], time: iso[4] ? iso[4] + ":" + iso[5] : "" };

    return { date: value, time: "" };
  }

  function formatExternalMovementDateTime(rawDate, fallback) {
    const dateInfo = formatExternalMovementDate(rawDate);
    if (!dateInfo.date || dateInfo.date === "Sem data informada") return fallback || "Sem data";
    return dateInfo.date + (dateInfo.time ? " " + dateInfo.time : "");
  }

  function externalMovementBooleanLabel(value, yesLabel, noLabel) {
    if (value === true) return yesLabel;
    if (value === false) return noLabel;
    return "";
  }

  function collectProcedureExpedienteDocumentIds(expediente) {
    const ids = [];
    const push = (value) => {
      const text = String(value || "").trim();
      if (text && ids.indexOf(text) < 0) ids.push(text);
    };

    push(expediente && expediente.documentId);
    push(expediente && expediente.linkedDocumentId);
    (Array.isArray(expediente && expediente.documentCandidateIds) ? expediente.documentCandidateIds : []).forEach(push);
    return ids;
  }

  function collectProcedureExpedienteResponseIds(expediente) {
    const ids = [];
    const push = (value) => {
      const text = String(value || "").trim();
      if (text && ids.indexOf(text) < 0) ids.push(text);
    };

    push(expediente && expediente.responseId);
    push(expediente && expediente.answerDocumentId);
    push(expediente && expediente.responseDocumentId);
    (Array.isArray(expediente && expediente.responseCandidateIds) ? expediente.responseCandidateIds : []).forEach(push);
    return ids;
  }

  function parseExternalBrazilianDateValue(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    const direct = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (direct) {
      return new Date(
        Number(direct[3]),
        Number(direct[2]) - 1,
        Number(direct[1]),
        Number(direct[4] || 0),
        Number(direct[5] || 0),
        0,
        0
      );
    }

    const iso = text.match(/^(\d{4})-?(\d{2})-?(\d{2})(?:[T\s]?(\d{2}):?(\d{2}))?/);
    if (iso) {
      return new Date(
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3]),
        Number(iso[4] || 0),
        Number(iso[5] || 0),
        0,
        0
      );
    }

    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }

  function externalDeadlineRemainingText(deadlineValue) {
    const deadline = parseExternalBrazilianDateValue(deadlineValue);
    if (!deadline || Number.isNaN(deadline.getTime())) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((deadline.getTime() - today.getTime()) / 86400000) + 1;
    if (diffDays > 1) return diffDays + " dias";
    if (diffDays === 1) return "1 dia";

    const overdue = Math.abs(diffDays - 1);
    return overdue > 1 ? "Vencido ha " + overdue + " dias" : "Vencido";
  }

  function procedureExpedienteOpenStatus(expediente) {
    return expediente && !expediente.closed && !expediente.returned;
  }

  function procedureExpedienteStateDeadline(expediente) {
    const text = normalizeText([expediente && expediente.party, expediente && expediente.procuradoria].join(" ")).toLowerCase();
    return (
      text.indexOf("estado de mato grosso") >= 0 ||
      text.indexOf("procuradoria geral do estado de mato grosso") >= 0
    );
  }

  function formatProcedureExpedienteInfo(expediente) {
    const documentIds = collectProcedureExpedienteDocumentIds(expediente);
    const responseIds = collectProcedureExpedienteResponseIds(expediente);
    const id = normalizeText((expediente && expediente.id) || "");
    const documentType = normalizeText((expediente && expediente.documentType) || "Expediente");
    const closed = expediente && expediente.closed === true;
    const returned = expediente && expediente.returned === true;
    const titleParts = [];
    const summaryParts = [];
    const flags = [];

    titleParts.push(documentType);
    if (id) titleParts.push("#" + id);
    if (expediente && expediente.deliveryMethod) summaryParts.push("Meio: " + expediente.deliveryMethod);
    if (expediente && expediente.priority) summaryParts.push("Prioridade: " + expediente.priority);
    if (expediente && expediente.party) summaryParts.push("Parte: " + expediente.party);
    if (expediente && expediente.procuradoria) summaryParts.push("Procuradoria: " + expediente.procuradoria);
    if (documentIds.length) summaryParts.push("Doc.: " + documentIds.join(", "));

    const status = returned || closed ? "Expediente Fechado" : "Expediente em Aberto";
    flags.push(status);
    const domicile = externalMovementBooleanLabel(expediente && expediente.sentToDomicile, "Domicilio", "");
    const personal = externalMovementBooleanLabel(expediente && expediente.personalNotice, "Pessoal", "");
    const late = externalMovementBooleanLabel(expediente && expediente.lateResponse, "Resposta intempestiva", "");
    [domicile, personal, late].filter(Boolean).forEach((flag) => flags.push(flag));

    return {
      id,
      title: titleParts.filter(Boolean).join(" "),
      summary: summaryParts.join(" · "),
      createdAt: formatExternalMovementDateTime(expediente && expediente.createdAt, "Sem criacao"),
      createdAtRaw: expediente && expediente.createdAt,
      awareAt: formatExternalMovementDateTime(expediente && expediente.awareAt, "Sem ciencia"),
      awareAtRaw: expediente && expediente.awareAt,
      awareBy: normalizeText((expediente && expediente.awareBy) || ""),
      deadlineAt: formatExternalMovementDateTime(expediente && expediente.deadlineAt, "Sem prazo final"),
      deadlineAtRaw: expediente && expediente.deadlineAt,
      remainingText: externalDeadlineRemainingText(expediente && expediente.deadlineAt),
      legalDeadlineDays: normalizeText((expediente && expediente.legalDeadlineDays) || ""),
      deadlineType: normalizeText((expediente && expediente.deadlineType) || ""),
      manuallyClosedAt: formatExternalMovementDateTime(expediente && expediente.manuallyClosedAt, ""),
      manuallyClosedBy: normalizeText((expediente && expediente.manuallyClosedBy) || ""),
      party: normalizeText((expediente && expediente.party) || ""),
      procuradoria: normalizeText((expediente && expediente.procuradoria) || ""),
      documentIds,
      responseIds,
      closed,
      returned,
      isOpenDeadline: !closed && !returned,
      isStateDeadline: procedureExpedienteStateDeadline(expediente),
      flags,
    };
  }

  function procedureExpedienteSearchText(info) {
    if (!info) return "";
    return [
      info.title,
      info.summary,
      "Criacao: " + info.createdAt,
      "Ciencia: " + info.awareAt,
      info.awareBy ? "Ciente por: " + info.awareBy : "",
      "Prazo final: " + info.deadlineAt,
      info.remainingText ? "Tempo restante: " + info.remainingText : "",
      info.legalDeadlineDays ? "Prazo legal: " + info.legalDeadlineDays + " " + (info.deadlineType || "dias") : "",
      info.flags.join(" ")
    ].filter(Boolean).join(" · ");
  }

  function procedureMovementSortValue(item) {
    const value = parseExternalAutosDateTimeValue(item);
    return Number.isFinite(value) ? value : 0;
  }

  function attachExpedientesToMovements(movements, expedientes) {
    const expedienteViews = (Array.isArray(expedientes) ? expedientes : []).map((expediente) => ({
      raw: expediente,
      view: formatProcedureExpedienteInfo(expediente),
      used: false,
    }));

    const movementItems = (Array.isArray(movements) ? movements : []).map((movement, index) => {
      const dateInfo = formatExternalMovementDate(movement.date);
      const code = movement.code || movement.id || "";
      const linkedIds = Array.isArray(movement.linkedDocumentIds) ? movement.linkedDocumentIds.filter(Boolean).map(String) : [];
      const movementText = normalizeText(movement.description || movement.name || "Movimento processual");
      const attached = expedienteViews.filter((entry) => {
        const documentIds = entry.view.documentIds || [];
        const byDocument = linkedIds.some((id) => documentIds.indexOf(String(id)) >= 0);
        const byExpediente = entry.view.id && movementText.indexOf(entry.view.id) >= 0;
        if (byDocument || byExpediente) entry.used = true;
        return byDocument || byExpediente;
      }).map((entry) => entry.view);
      const descriptionParts = [];

      if (linkedIds.length) descriptionParts.push("Documento(s) vinculado(s): " + linkedIds.join(", "));

      return {
        id: code || String(index + 1),
        code: code,
        movementLabel: code ? "Movimento " + code : "",
        type: movementText || "Movimento processual",
        description: descriptionParts.join(" · "),
        searchText: attached.map(procedureExpedienteSearchText).join(" · "),
        date: dateInfo.date,
        time: dateInfo.time,
        sourceLabel: movement.sourceLabel || "",
        isPdf: false,
        noOpen: true,
        linkedDocumentIds: linkedIds,
        documentIds: Array.from(new Set([].concat(linkedIds, ...attached.map((info) => info.documentIds || [])))),
        responseIds: Array.from(new Set([].concat(...attached.map((info) => info.responseIds || [])))),
        expedientes: attached,
      };
    });

    expedienteViews.filter((entry) => !entry.used).forEach((entry) => {
      const raw = entry.raw || {};
      const dateInfo = formatExternalMovementDate(raw.createdAt || raw.awareAt || raw.deadlineAt);
      movementItems.push({
        id: entry.view.id || "expediente",
        movementLabel: entry.view.id ? "Expediente " + entry.view.id : "Expediente",
        type: "Expediente/Prazo - " + entry.view.title,
        description: entry.view.summary,
        searchText: procedureExpedienteSearchText(entry.view),
        date: dateInfo.date,
        time: dateInfo.time,
        sourceLabel: raw.sourceLabel || "",
        isPdf: false,
        noOpen: true,
        linkedDocumentIds: entry.view.documentIds || [],
        documentIds: entry.view.documentIds || [],
        responseIds: entry.view.responseIds || [],
        expedientes: [entry.view],
      });
    });

    return movementItems.sort((left, right) => procedureMovementSortValue(right) - procedureMovementSortValue(left));
  }

  async function fetchProcedureMovementsSummary(source) {
    const response = await requestExtensionMessage(
      "SPA_CDSP_FETCH_PROCEDURE_MOVEMENTS",
      {
        processNumber: source && source.processNumber ? source.processNumber : readProcedureHeaderValue("Número do Processo"),
        tribunal: source && source.tribunal ? source.tribunal : readProcedureHeaderValue("Tribunal"),
      },
      75000
    );

    if (!response || !response.ok) {
      throw new Error((response && response.error) || "Nao foi possivel consultar o andamento no MNI/PJe.");
    }

    return attachExpedientesToMovements(
      (response.movements || []).map((movement) => Object.assign({ sourceLabel: response.sourceLabel || "MNI/PJe" }, movement)),
      (response.expedientes || []).map((expediente) => Object.assign({ sourceLabel: response.sourceLabel || "MNI/PJe" }, expediente))
    );
  }

  function appendExternalDocumentText(parent, className, text) {
    const node = document.createElement("div");
    node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function createExternalHighlightIndex(text) {
    const source = String(text || "");
    const chars = [];
    const map = [];
    let lastWasSpace = false;

    for (let index = 0; index < source.length; index += 1) {
      const originalChar = source[index];

      if (/\s/.test(originalChar)) {
        if (!lastWasSpace) {
          chars.push(" ");
          map.push(index);
          lastWasSpace = true;
        }
        continue;
      }

      const normalizedChars = originalChar
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      for (let inner = 0; inner < normalizedChars.length; inner += 1) {
        chars.push(normalizedChars[inner]);
        map.push(index);
      }

      lastWasSpace = false;
    }

    return {
      text: chars.join(""),
      map: map,
    };
  }

  function normalizedExternalHighlightQuery(value) {
    return createExternalHighlightIndex(value).text.trim();
  }

  function parseExternalSearchTerms(value) {
    const seen = new Set();
    const terms = [];

    String(value || "")
      .split(";")
      .map((term) => term.trim())
      .filter(Boolean)
      .forEach((term) => {
        const key = normalizedExternalHighlightQuery(term);
        if (!key || seen.has(key)) return;
        seen.add(key);
        terms.push(term);
      });

    return terms;
  }

  function normalizedExternalSearchTerm(value) {
    return normalizeText(value).toLowerCase();
  }

  function externalSearchTerms(value, exact) {
    if (exact) {
      const term = normalizedExternalSearchTerm(String(value || "").trim());
      return term ? [term] : [];
    }

    return parseExternalSearchTerms(value).map(normalizedExternalSearchTerm).filter(Boolean);
  }

  function addExternalHighlightRange(ranges, start, end) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;

    for (const range of ranges) {
      if (start < range.end && end > range.start) return;
    }

    ranges.push({ start: start, end: end });
  }

  function findExternalHighlightRanges(text, query) {
    const source = String(text || "");
    const normalized = createExternalHighlightIndex(source);
    const needles = parseExternalSearchTerms(query).map((term) => normalizedExternalHighlightQuery(term)).filter(Boolean);
    const ranges = [];

    if (!source || !needles.length) return ranges;

    for (const needle of needles) {
      let cursor = 0;
      let foundExact = false;
      while (cursor >= 0 && ranges.length < 40) {
        const foundAt = normalized.text.indexOf(needle, cursor);
        if (foundAt < 0) break;

        const start = normalized.map[foundAt];
        const endMapIndex = foundAt + needle.length - 1;
        const end = (normalized.map[endMapIndex] || start) + 1;
        addExternalHighlightRange(ranges, start, end);
        cursor = foundAt + Math.max(needle.length, 1);
        foundExact = true;
      }

      if (foundExact) continue;

      const tokens = needle.split(/\s+/).filter((token) => token.length >= 3);
      for (const token of tokens) {
        let tokenCursor = 0;
        while (tokenCursor >= 0 && ranges.length < 40) {
          const foundAt = normalized.text.indexOf(token, tokenCursor);
          if (foundAt < 0) break;

          const start = normalized.map[foundAt];
          const endMapIndex = foundAt + token.length - 1;
          const end = (normalized.map[endMapIndex] || start) + 1;
          addExternalHighlightRange(ranges, start, end);
          tokenCursor = foundAt + token.length;
        }
      }
    }

    return ranges.sort((a, b) => a.start - b.start);
  }

  function appendExternalHighlightedSnippet(parent, className, text, query) {
    const node = document.createElement("div");
    const source = String(text || "");
    const ranges = findExternalHighlightRanges(source, query);
    node.className = className;

    if (!ranges.length) {
      node.textContent = source;
      parent.appendChild(node);
      return node;
    }

    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        node.appendChild(document.createTextNode(source.slice(cursor, range.start)));
      }

      const mark = document.createElement("mark");
      mark.className = "spa-cdsp-external-docs-highlight";
      mark.textContent = source.slice(range.start, range.end);
      node.appendChild(mark);
      cursor = range.end;
    }

    if (cursor < source.length) {
      node.appendChild(document.createTextNode(source.slice(cursor)));
    }

    parent.appendChild(node);
    return node;
  }

  function createExternalDocumentChip(text) {
    const chip = document.createElement("span");
    chip.className = "spa-cdsp-external-docs-chip";
    chip.textContent = text;
    return chip;
  }

  async function copyExternalTextToClipboard(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "readonly");
    input.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    return ok;
  }

  function filterExternalDocumentItems(items, filterText, options) {
    const terms = externalSearchTerms(filterText, Boolean(options && options.exactText));
    const implicitDefinitions = Array.isArray(options && options.implicitDefinitions)
      ? options.implicitDefinitions
      : [];
    const implicitTerms = implicitDefinitions.length
      ? implicitDefinitions.reduce((allTerms, definition) => {
          externalSearchTerms(definition && definition.terms, Boolean(definition && definition.exact)).forEach((term) => {
            if (allTerms.indexOf(term) < 0) allTerms.push(term);
          });
          return allTerms;
        }, [])
      : externalSearchTerms(options && options.implicitText, false);

    return (items || []).filter((item) => {
      if (!terms.length && !implicitTerms.length) return true;
      const haystack = normalizeText(
        [
          item.id,
          item.code,
          item.movementLabel,
          item.type,
          item.description,
          item.searchText,
          item.date,
          item.time,
          item.sourceLabel,
        ].join(" ")
      ).toLowerCase();

      const matchesManual = !terms.length || terms.some((term) => haystack.indexOf(term) >= 0);
      const matchesImplicit = !implicitTerms.length || implicitTerms.some((term) => haystack.indexOf(term) >= 0);
      return matchesManual && matchesImplicit;
    });
  }

  function renderExternalDocumentSummary(container, items, filterText, source, filterOptions) {
    const allItems = Array.isArray(items) ? items : [];
    const filtered = filterExternalDocumentItems(items, filterText, filterOptions);
    const panel = container.closest("#spa-cdsp-external-docs-panel");
    const highlightText = [filterText, filterOptions && filterOptions.implicitText].filter(Boolean).join(";");
    const unitLabel =
      source && source.key === "folder"
        ? "item(ns)"
        : source && source.key === "movements"
        ? "movimento(s)"
        : "documento(s)";

    container.textContent = "";

    if (!allItems.length) {
      appendExternalDocumentText(
        container,
        "spa-cdsp-external-docs-empty",
        source && source.emptyText ? source.emptyText : "Nenhum documento foi encontrado nos autos externos deste processo."
      );
      return;
    }

    if (!filtered.length) {
      appendExternalDocumentText(container, "spa-cdsp-external-docs-empty", "Nenhum documento corresponde ao filtro digitado.");
      return;
    }

    const list = document.createElement("div");
    list.className = "spa-cdsp-external-docs-list";

    const groups = new Map();
    for (const item of filtered) {
      const dateKey = item.date || "Sem data informada";
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(item);
    }

    groups.forEach((groupItems, date) => {
      const day = document.createElement("section");
      day.className = "spa-cdsp-external-docs-day";

      const dayTitle = document.createElement("div");
      dayTitle.className = "spa-cdsp-external-docs-day-title";
      dayTitle.textContent = date + " · " + groupItems.length + " " + unitLabel;
      day.appendChild(dayTitle);

      for (const item of groupItems) {
        const row = document.createElement("article");
        row.className = "spa-cdsp-external-docs-item";
        row.appendChild(createExternalDocumentSelectionCheckbox(panel, item));

        const info = document.createElement("div");
        appendExternalHighlightedSnippet(info, "spa-cdsp-external-docs-item-title", item.type, highlightText);
        appendExternalHighlightedSnippet(info, "spa-cdsp-external-docs-item-description", item.description, highlightText);

        const meta = document.createElement("div");
        meta.className = "spa-cdsp-external-docs-item-meta";
        if (item.id) meta.appendChild(createExternalDocumentChip("ID " + item.id));
        if (item.time) meta.appendChild(createExternalDocumentChip(item.time));
        if (item.sourceLabel) meta.appendChild(createExternalDocumentChip(item.sourceLabel));
        if (item.isPdf) meta.appendChild(createExternalDocumentChip("PDF direto"));
        info.appendChild(meta);

        row.appendChild(info);

        const actions = document.createElement("div");
        actions.className = "spa-cdsp-external-docs-item-actions";
        if (source && source.key !== "movements" && item.id) {
          const copyId = document.createElement("button");
          copyId.type = "button";
          copyId.className = "spa-cdsp-external-docs-copy-id";
          copyId.textContent = "Copiar id";
          copyId.title = "Copiar o ID deste documento.";
          copyId.addEventListener("click", async () => {
            const original = copyId.textContent;
            try {
              const copied = await copyExternalTextToClipboard(item.id);
              copyId.textContent = copied ? "Copiado" : "Falhou";
            } catch (_error) {
              copyId.textContent = "Falhou";
            }
            setTimeout(() => {
              copyId.textContent = original;
            }, 1200);
          });
          actions.appendChild(copyId);
        }

        if (!item.noOpen) {
          const open = document.createElement("a");
          open.className = "spa-cdsp-external-docs-open";
          open.href = getExternalDocumentOpenUrl(item);
          open.target = "_blank";
          open.rel = "noopener noreferrer";
          open.textContent = item.isPdf ? "Abrir PDF" : "Abrir";
          bindExternalDocumentOpenButton(open, item);
          actions.appendChild(open);
        }
        if (actions.childElementCount) row.appendChild(actions);
        day.appendChild(row);
      }

      list.appendChild(day);
    });

    container.appendChild(list);
    if (panel && typeof panel._refreshExternalDocumentSelectionControls === "function") {
      panel._refreshExternalDocumentSelectionControls();
    }
  }

  function appendMovementDeadlineCell(parent, label, value) {
    const cell = document.createElement("div");
    cell.className = "spa-cdsp-movement-deadline-cell";

    const title = document.createElement("strong");
    title.textContent = label;
    cell.appendChild(title);
    cell.appendChild(document.createTextNode(value || "Nao informado"));
    parent.appendChild(cell);
  }

  function movementExpedientePartyLabel(expediente) {
    const party = normalizeText(expediente && expediente.party);
    const procuradoria = normalizeText(expediente && expediente.procuradoria);
    const combined = normalizeText([party, procuradoria].filter(Boolean).join(" ")).toLowerCase();

    if (combined.indexOf("procuradoria geral do estado de mato grosso") >= 0 || combined.indexOf("estado de mato grosso") >= 0) {
      return "Estado de Mato Grosso";
    }
    if (combined.indexOf("ministerio publico") >= 0) return "Ministerio Publico";
    if (combined.indexOf("defensoria publica") >= 0) return "Defensoria Publica";

    const label = party || procuradoria;
    if (!label) return "parte informada no expediente";
    return label.length > 54 ? label.slice(0, 51).trim() + "..." : label;
  }

  function createMovementExpedienteLinkItem(expediente) {
    return {
      type: expediente && expediente.title ? expediente.title : "Expediente/Prazo",
      description: expediente && expediente.summary ? expediente.summary : "",
      isPdf: false,
      noOpen: true,
      documentIds: Array.isArray(expediente && expediente.documentIds) ? expediente.documentIds : [],
      linkedDocumentIds: Array.isArray(expediente && expediente.documentIds) ? expediente.documentIds : [],
      responseIds: Array.isArray(expediente && expediente.responseIds) ? expediente.responseIds : [],
      expedientes: expediente ? [expediente] : [],
    };
  }

  function appendProcedureExpedienteDetails(parent, expediente, filterText, panel) {
    if (!expediente) return;

    const block = document.createElement("div");
    block.className =
      "spa-cdsp-movement-expediente " +
      (expediente.closed || expediente.returned ? "spa-cdsp-movement-expediente-closed" : "spa-cdsp-movement-expediente-open");

    appendExternalHighlightedSnippet(block, "spa-cdsp-movement-expediente-title", expediente.title || "Expediente/Prazo", filterText);
    const statusBadge = document.createElement("span");
    statusBadge.className =
      "spa-cdsp-movement-expediente-status " +
      (expediente.isOpenDeadline ? "spa-cdsp-movement-expediente-status-open" : "spa-cdsp-movement-expediente-status-closed");
    statusBadge.textContent = expediente.isOpenDeadline ? "Expediente em Aberto" : "Expediente Fechado";
    block.appendChild(statusBadge);
    if (expediente.summary) {
      appendExternalHighlightedSnippet(block, "spa-cdsp-movement-expediente-summary", expediente.summary, filterText);
    }

    const grid = document.createElement("div");
    grid.className = "spa-cdsp-movement-deadline-grid";
    appendMovementDeadlineCell(grid, "Expedido em", expediente.createdAt);
    appendMovementDeadlineCell(grid, "Ciência", expediente.awareAt + (expediente.awareBy ? " por " + expediente.awareBy : ""));
    appendMovementDeadlineCell(grid, "Prazo final", expediente.deadlineAt);
    appendMovementDeadlineCell(grid, "Tempo restante", expediente.remainingText || "Nao informado");
    appendMovementDeadlineCell(
      grid,
      "Prazo legal",
      expediente.legalDeadlineDays
        ? expediente.legalDeadlineDays + " " + (expediente.deadlineType || "dias")
        : "Nao informado"
    );
    block.appendChild(grid);

    if (expediente.manuallyClosedAt || expediente.manuallyClosedBy) {
      const closeText = [expediente.manuallyClosedAt, expediente.manuallyClosedBy ? "por " + expediente.manuallyClosedBy : ""].filter(Boolean).join(" ");
      appendExternalHighlightedSnippet(block, "spa-cdsp-movement-expediente-summary", "Encerramento manual: " + closeText, filterText);
    }

    if (Array.isArray(expediente.flags) && expediente.flags.length) {
      const flags = document.createElement("div");
      flags.className = "spa-cdsp-movement-deadline-flags";
      expediente.flags.forEach((flag) => flags.appendChild(createExternalDocumentChip(flag)));
      block.appendChild(flags);
    }

    const responseIds = Array.isArray(expediente.responseIds) ? expediente.responseIds.filter(Boolean) : [];
    if (responseIds.length && panel && typeof panel._openMovementLinkedDocument === "function") {
      const actions = document.createElement("div");
      actions.className = "spa-cdsp-movement-expediente-actions";

      const context = document.createElement("div");
      context.className = "spa-cdsp-movement-expediente-response-context";
      context.textContent = "Resposta vinculada a: " + movementExpedientePartyLabel(expediente);
      actions.appendChild(context);

      const openResponse = createMovementActionButton(
        "Abrir resposta",
        "Abrir somente a resposta deste expediente/parte."
      );
      openResponse.addEventListener("click", () => {
        panel._openMovementLinkedDocument(createMovementExpedienteLinkItem(expediente), "response");
      });
      actions.appendChild(openResponse);
      block.appendChild(actions);
    }

    parent.appendChild(block);
  }

  function appendOpenStateDeadlinesSummary(parent, items) {
    const deadlines = [];
    const seen = new Set();

    (Array.isArray(items) ? items : []).forEach((item) => {
      (Array.isArray(item.expedientes) ? item.expedientes : []).forEach((expediente) => {
        if (!expediente || !expediente.isOpenDeadline || !expediente.isStateDeadline) return;
        const key = openStateDeadlineSummaryKey(expediente);
        if (key && seen.has(key)) return;
        if (key) seen.add(key);
        deadlines.push({
          movement: item,
          expediente,
          timestamp: parseExternalBrazilianDateValue(expediente.deadlineAtRaw || expediente.deadlineAt)?.getTime() || 0,
        });
      });
    });

    if (!deadlines.length) return;
    deadlines.sort((left, right) => left.timestamp - right.timestamp);

    const box = document.createElement("section");
    box.className = "spa-cdsp-movement-open-deadlines";

    const title = document.createElement("div");
    title.className = "spa-cdsp-movement-open-deadlines-title";
    title.textContent = "Prazos em aberto do Estado";
    box.appendChild(title);

    const list = document.createElement("div");
    list.className = "spa-cdsp-movement-open-deadlines-list";
    const panel = parent.closest("#spa-cdsp-external-docs-panel");
    deadlines.slice(0, 12).forEach(({ movement, expediente }) => {
      const item = document.createElement("div");
      item.className = "spa-cdsp-movement-open-deadline-item";
      item.innerHTML =
        '<strong>' +
        escapeHtml(expediente.title || movement.type || "Expediente") +
        "</strong>" +
        '<span>Prazo final: ' +
        escapeHtml(expediente.deadlineAt || "Nao informado") +
        "</span>" +
        '<span>Tempo restante: ' +
        escapeHtml(expediente.remainingText || "Nao informado") +
        "</span>";

      if (panel && typeof panel._openMovementLinkedDocument === "function") {
        const openDocument = createMovementActionButton(
          "Abrir PDF",
          "Abrir o expediente vinculado a este prazo em aberto."
        );
        openDocument.addEventListener("click", () => {
          panel._openMovementLinkedDocument(createMovementExpedienteLinkItem(expediente), "document");
        });
        item.appendChild(openDocument);
      }
      list.appendChild(item);
    });
    box.appendChild(list);
    parent.appendChild(box);
  }

  function createMovementActionButton(label, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spa-cdsp-movement-action";
    button.textContent = label;
    if (title) button.title = title;
    return button;
  }

  function openStateDeadlineSummaryKey(expediente) {
    if (!expediente) return "";

    const id = normalizeText(expediente.id).toLowerCase();
    if (id) return "expediente:" + id;

    const documentIds = (Array.isArray(expediente.documentIds) ? expediente.documentIds : [])
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean)
      .sort();
    if (documentIds.length) return "documentos:" + documentIds.join("|");

    return [
      normalizeText(expediente.title).toLowerCase(),
      normalizeText(expediente.deadlineAtRaw || expediente.deadlineAt).toLowerCase(),
      normalizeText(expediente.awareAtRaw || expediente.awareAt).toLowerCase(),
      normalizeText(expediente.party).toLowerCase(),
      normalizeText(expediente.procuradoria).toLowerCase(),
    ]
      .filter(Boolean)
      .join("|");
  }

  function renderProcedureMovementsTimeline(container, items, source, filterText, filterOptions) {
    const allItems = Array.isArray(items) ? items : [];
    const filtered = filterExternalDocumentItems(allItems, filterText, filterOptions);
    const panel = container.closest("#spa-cdsp-external-docs-panel");
    container.textContent = "";

    if (!allItems.length) {
      appendExternalDocumentText(
        container,
        "spa-cdsp-external-docs-empty",
        source && source.emptyText ? source.emptyText : "Nenhuma movimentacao foi retornada para este processo."
      );
      return;
    }

    if (!filtered.length) {
      appendExternalDocumentText(container, "spa-cdsp-external-docs-empty", "Nenhuma movimentacao corresponde ao filtro digitado.");
      return;
    }

    appendOpenStateDeadlinesSummary(container, allItems);

    const timeline = document.createElement("div");
    timeline.className = "spa-cdsp-movements-timeline";

    filtered.forEach((item) => {
      const row = document.createElement("article");
      row.className = "spa-cdsp-movement-row";

      const date = document.createElement("div");
      date.className = "spa-cdsp-movement-date";
      date.textContent = item.date || "Sem data";
      if (item.time) {
        const time = document.createElement("small");
        time.textContent = item.time;
        date.appendChild(time);
      }

      const line = document.createElement("div");
      line.className = "spa-cdsp-movement-line";
      const dot = document.createElement("span");
      dot.className = "spa-cdsp-movement-dot";
      line.appendChild(dot);

      const card = document.createElement("div");
      card.className = "spa-cdsp-movement-card";
      appendExternalHighlightedSnippet(card, "spa-cdsp-movement-title", item.type || "Movimento processual", filterText);
      if (item.description) appendExternalHighlightedSnippet(card, "spa-cdsp-movement-description", item.description, filterText);

      const meta = document.createElement("div");
      meta.className = "spa-cdsp-movement-meta";
      if (item.movementLabel) meta.appendChild(createExternalDocumentChip(item.movementLabel));
      else if (item.id) meta.appendChild(createExternalDocumentChip("ID " + item.id));
      if (item.sourceLabel) meta.appendChild(createExternalDocumentChip(item.sourceLabel));
      card.appendChild(meta);

      if (panel && typeof panel._openMovementLinkedDocument === "function") {
        const actions = document.createElement("div");
        actions.className = "spa-cdsp-movement-actions";
        const openDocument = createMovementActionButton("Abrir PDF", "Abrir o documento vinculado a esta movimentação.");
        openDocument.addEventListener("click", () => panel._openMovementLinkedDocument(item, "document"));
        actions.appendChild(openDocument);
        card.appendChild(actions);
      }

      if (Array.isArray(item.expedientes) && item.expedientes.length) {
        const expedientes = document.createElement("div");
        expedientes.className = "spa-cdsp-movement-expedientes";
        const heading = document.createElement("div");
        heading.className = "spa-cdsp-movement-expedientes-heading";
        heading.textContent = item.expedientes.length === 1 ? "Expediente e prazo vinculado" : "Expedientes e prazos vinculados";
        expedientes.appendChild(heading);
        item.expedientes.forEach((expediente) => appendProcedureExpedienteDetails(expedientes, expediente, filterText, panel));
        card.appendChild(expedientes);
      }

      row.appendChild(date);
      row.appendChild(line);
      row.appendChild(card);
      timeline.appendChild(row);
    });

    container.appendChild(timeline);
  }

  function appendExternalDocumentSearchHit(container, item, result) {
    const row = document.createElement("article");
    row.className = "spa-cdsp-external-docs-search-hit";
    const panel = container.closest("#spa-cdsp-external-docs-panel");
    row.appendChild(createExternalDocumentSelectionCheckbox(panel, item));

    const info = document.createElement("div");
    appendExternalDocumentText(
      info,
      "spa-cdsp-external-docs-hit-title",
      (item.type || "Documento") + (item.id ? " · ID " + item.id : "")
    );
    appendExternalHighlightedSnippet(
      info,
      "spa-cdsp-external-docs-hit-snippet",
      result && result.snippet
        ? result.snippet
        : 'Texto encontrado no documento para a pesquisa "' + (result && result.query ? result.query : "") + '".',
      result && result.matchedQuery ? result.matchedQuery : result && result.query ? result.query : ""
    );

    const meta = document.createElement("div");
    meta.className = "spa-cdsp-external-docs-item-meta";
    if (item.date) meta.appendChild(createExternalDocumentChip(item.date));
    if (item.time) meta.appendChild(createExternalDocumentChip(item.time));
    if (item.sourceLabel) meta.appendChild(createExternalDocumentChip(item.sourceLabel));
    if (item.isPdf) meta.appendChild(createExternalDocumentChip("PDF direto"));
    if (result && result.fromCache) meta.appendChild(createExternalDocumentChip("cache"));
    if (result && result.matchedQuery) meta.appendChild(createExternalDocumentChip("termo: " + result.matchedQuery));
    if (result && result.diagnostics && result.diagnostics.method) {
      meta.appendChild(createExternalDocumentChip("leitura: " + result.diagnostics.method));
    }
    if (result && result.diagnostics && result.diagnostics.offscreenPagesRead) {
      meta.appendChild(
        createExternalDocumentChip(
          "pag. " +
            result.diagnostics.offscreenPagesRead +
            (result.diagnostics.offscreenTotalPages ? "/" + result.diagnostics.offscreenTotalPages : "")
        )
      );
    }
    info.appendChild(meta);

    const open = document.createElement("a");
    open.className = "spa-cdsp-external-docs-open";
    open.href = getExternalDocumentOpenUrl(item);
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = item.isPdf ? "Abrir PDF" : "Abrir";
    bindExternalDocumentOpenButton(open, item);

    row.appendChild(info);
    row.appendChild(open);
    container.appendChild(row);
  }

  async function runExternalDocumentContentSearch(panel, query, controls) {
    const allItems = Array.isArray(panel._externalDocumentItems) ? panel._externalDocumentItems : [];
    const summaryFilterText = controls.summaryFilterValue ? controls.summaryFilterValue() : "";
    const summaryFilterOptions = controls.summaryFilterOptions ? controls.summaryFilterOptions() : null;
    const items = filterExternalDocumentItems(allItems, summaryFilterText, summaryFilterOptions).filter((item) => item && item.isPdf);
    const text = String(query || "").trim();
    const exactSearch = Boolean(controls.exactSearch && controls.exactSearch());
    const terms = exactSearch ? (text ? [text] : []) : parseExternalSearchTerms(text);

    if (!allItems.length) {
      controls.progress.textContent = "Carregue o resumo dos autos antes de pesquisar dentro dos documentos.";
      return;
    }

    if (!items.length) {
      controls.progress.textContent = "Nenhum PDF do resumo corresponde ao filtro atual.";
      return;
    }

    if (!terms.length) {
      controls.progress.textContent = "Digite uma palavra ou frase para pesquisar nos PDFs. Use ; para separar vários termos.";
      return;
    }

    if (panel.dataset.contentSearching === "1") return;

    panel.dataset.contentSearching = "1";
    panel._contentSearchStopped = false;
    panel._contentSearchHits = [];
    if (typeof controls.onResultsChanged === "function") controls.onResultsChanged();
    controls.button.disabled = true;
    controls.stopButton.disabled = false;
    controls.stopButton.style.display = "";
    controls.results.style.display = "block";
    controls.results.textContent = "";
    appendExternalDocumentText(
      controls.results,
      "spa-cdsp-external-docs-empty",
      "Iniciando pesquisa nos documentos por " + terms.length + " termo(s)..."
    );

    let found = 0;
    let read = 0;
    let failed = 0;
    let inconclusive = 0;
    let fromCache = 0;
    const stopOnFirst = controls.stopOnFirst ? controls.stopOnFirst() : false;
    const configuredConcurrency = controls.concurrencyValue ? controls.concurrencyValue() : CONFIG.autosDocumentSearchConcurrency;
    const concurrency = Math.max(
      1,
      Math.min(CONFIG.autosDocumentSearchMaxConcurrency, normalizeLimit(configuredConcurrency) || CONFIG.autosDocumentSearchConcurrency)
    );
    let nextIndex = 0;

    function updateProgress(prefix) {
      controls.progress.textContent =
        (prefix || "Pesquisa em andamento") +
        ": " +
        read +
        "/" +
        items.length +
        " lido(s), " +
        concurrency +
        " simultâneo(s), " +
        found +
        " resultado(s), " +
        inconclusive +
        " inconclusivo(s), " +
        failed +
        " erro(s), " +
        fromCache +
        " do cache.";
    }

    async function worker() {
      while (!panel._contentSearchStopped) {
        if (stopOnFirst && found > 0) {
          panel._contentSearchStopped = true;
          break;
        }

        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) break;

        const item = items[index];
        controls.progress.textContent =
          "Lendo documento " +
          (index + 1) +
          " de " +
          items.length +
          (item.id ? " · ID " + item.id : "") +
          "...";

        const result = await searchAutosDocumentThroughExtension(item, text, exactSearch);
        read += 1;

        if (result && result.fromCache) fromCache += 1;

        if (result && result.ok && result.found) {
          if (found === 0) controls.results.textContent = "";
          found += 1;
          if (!panel._contentSearchHits.some((hit) => externalDocumentSelectionKey(hit) === externalDocumentSelectionKey(item))) {
            panel._contentSearchHits.push(item);
          }
          appendExternalDocumentSearchHit(controls.results, item, result);
          if (typeof controls.onResultsChanged === "function") controls.onResultsChanged();
          if (stopOnFirst) {
            panel._contentSearchStopped = true;
          }
        } else if (result && result.inconclusive) {
          inconclusive += 1;
        } else if (!result || !result.ok) {
          failed += 1;
        }

        updateProgress("Pesquisa em andamento");

        await sleep(40);
      }
    }

    try {
      const workers = [];
      const workerCount = Math.min(concurrency, items.length);
      for (let index = 0; index < workerCount; index += 1) {
        workers.push(worker());
      }
      await Promise.all(workers);
    } finally {
      panel.dataset.contentSearching = "0";
      controls.button.disabled = false;
      controls.stopButton.disabled = true;
      controls.stopButton.style.display = "none";
      controls.stopButton.textContent = "Parar";
    }

    if (found === 0) {
      controls.results.textContent = "";
      appendExternalDocumentText(
        controls.results,
        "spa-cdsp-external-docs-empty",
        panel._contentSearchStopped
          ? "Pesquisa interrompida sem resultado exibido."
          : "Nenhum documento com esse texto foi encontrado."
      );
    }

    controls.progress.textContent =
      (panel._contentSearchStopped ? "Pesquisa interrompida. " : "Pesquisa concluida. ") +
      read +
      "/" +
      items.length +
      " documento(s) lido(s), " +
      found +
      " resultado(s), " +
      inconclusive +
      " inconclusivo(s), " +
      failed +
      " erro(s), " +
      fromCache +
      " do cache.";
    if (typeof controls.onResultsChanged === "function") controls.onResultsChanged();
  }

  function createExternalDocumentsPanel(sources, processNumber) {
    const defaultSourceKey =
      sources && sources.autos && sources.autos.url
        ? "autos"
        : sources && sources.folder && sources.folder.url
        ? "folder"
        : "movements";

    const panel = document.createElement("section");
    panel.id = "spa-cdsp-external-docs-panel";
    panel.dataset.processNumber = processNumber;
    panel.dataset.source = defaultSourceKey;
    panel.dataset.url = sources[defaultSourceKey] ? sources[defaultSourceKey].url : "";
    panel.dataset.sourcesSignature = getExternalDocumentSourceSignature(sources);
    panel._externalDocumentSources = sources;
    panel._externalDocumentCache = {};
    panel._externalDocumentSelectedKeys = new Set();
    panel._contentSearchHits = [];

    const header = document.createElement("div");
    header.className = "spa-cdsp-external-docs-header";

    const title = document.createElement("div");
    title.className = "spa-cdsp-external-docs-title";

    const titleText = document.createElement("strong");
    titleText.textContent = "Documentos do processo";

    const subtitle = document.createElement("span");
    subtitle.textContent = processNumber || "Processo identificado na pendência";

    title.appendChild(titleText);
    title.appendChild(subtitle);

    const actions = document.createElement("div");
    actions.className = "spa-cdsp-external-docs-actions";

    const loadButton = createExternalDocumentsButton("Atualizar");
    const processCompleteButton = createExternalDocumentsButton("Processo Completo", "spa-cdsp-external-docs-process-complete");
    processCompleteButton.title = "Escolher formato do Processo Completo.";
    processCompleteButton.style.display = sources.autos && sources.autos.url ? "" : "none";

    const processCompleteWrap = document.createElement("div");
    processCompleteWrap.className = "spa-cdsp-external-docs-process-wrap";
    processCompleteWrap.style.display = sources.autos && sources.autos.url ? "" : "none";

    const processCompleteMenu = document.createElement("div");
    processCompleteMenu.className = "spa-cdsp-external-docs-process-menu";
    processCompleteMenu.hidden = true;

    const processUnifiedButton = createExternalDocumentsButton("Unificado", "spa-cdsp-external-docs-process-option");
    processUnifiedButton.title = "Gerar um PDF unico com os autos.";

    const processSeparateButton = createExternalDocumentsButton("Separado", "spa-cdsp-external-docs-process-option");
    processSeparateButton.title = "Abrir PDFs separados juntos em uma aba.";

    const processOrderGroup = document.createElement("div");
    processOrderGroup.className = "spa-cdsp-external-docs-process-order";
    processOrderGroup.hidden = true;

    const processAscButton = createExternalDocumentsButton("Crescente", "spa-cdsp-external-docs-process-option");
    processAscButton.title = "Do inicio do processo ate os documentos mais recentes.";

    const processDescButton = createExternalDocumentsButton("Decrescente", "spa-cdsp-external-docs-process-option");
    processDescButton.title = "Das movimentacoes mais recentes para as mais antigas.";

    processOrderGroup.appendChild(processAscButton);
    processOrderGroup.appendChild(processDescButton);
    processCompleteMenu.appendChild(processUnifiedButton);
    processCompleteMenu.appendChild(processSeparateButton);
    processCompleteMenu.appendChild(processOrderGroup);
    processCompleteWrap.appendChild(processCompleteButton);
    processCompleteWrap.appendChild(processCompleteMenu);

    const openButton = document.createElement("a");
    openButton.className = "spa-cdsp-external-docs-button spa-cdsp-external-docs-button-secondary";
    openButton.href = panel.dataset.url;
    openButton.target = "_blank";
    openButton.rel = "noopener noreferrer";
    openButton.textContent = sources[defaultSourceKey] ? sources[defaultSourceKey].buttonLabel : "Abrir";

    const minimizedMemory = document.createElement("label");
    minimizedMemory.className = "spa-cdsp-external-docs-memory";
    minimizedMemory.title = "Quando marcado, novas paginas de processo abrem este painel minimizado.";

    const minimizedMemoryInput = document.createElement("input");
    minimizedMemoryInput.type = "checkbox";
    minimizedMemoryInput.checked = storageGetBool(EXTERNAL_DOCS_OPEN_MINIMIZED_KEY);

    const minimizedMemoryText = document.createElement("span");
    minimizedMemoryText.textContent = "Abrir minimizado";

    minimizedMemory.appendChild(minimizedMemoryInput);
    minimizedMemory.appendChild(minimizedMemoryText);

    const toggleButton = createExternalDocumentsButton("Recolher", "spa-cdsp-external-docs-button-secondary");

    actions.appendChild(loadButton);
    actions.appendChild(processCompleteWrap);
    actions.appendChild(openButton);
    actions.appendChild(minimizedMemory);
    actions.appendChild(toggleButton);

    header.appendChild(title);
    header.appendChild(actions);

    const body = document.createElement("div");
    body.className = "spa-cdsp-external-docs-body";

    const sourceSwitcher = document.createElement("div");
    sourceSwitcher.className = "spa-cdsp-external-docs-source";

    const sourceInputs = {};
    ["autos", "folder", "movements"].forEach((key) => {
      const source = sources[key];
      const option = document.createElement("label");
      option.className = "spa-cdsp-external-docs-source-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "spa-cdsp-external-docs-source";
      input.value = key;
      input.checked = key === defaultSourceKey;
      input.disabled = !source || !source.url;

      const text = document.createElement("span");
      text.textContent = source ? source.shortLabel : key;

      option.appendChild(input);
      option.appendChild(text);
      sourceSwitcher.appendChild(option);
      sourceInputs[key] = input;
    });

    const status = document.createElement("p");
    status.className = "spa-cdsp-external-docs-status";
    status.textContent = "Carregando Autos, Pasta e Andamento PJE...";

    const search = document.createElement("input");
    search.type = "search";
    search.className = "spa-cdsp-external-docs-search";
    search.placeholder = "Filtrar por tipo, ID, descrição ou data... Use ; para vários termos.";
    search.style.display = "none";

    const searchRow = document.createElement("div");
    searchRow.className = "spa-cdsp-external-docs-search-row";
    searchRow.style.display = "none";

    const searchTools = document.createElement("div");
    searchTools.className = "spa-cdsp-external-docs-search-tools";

    const filterWrap = document.createElement("div");
    filterWrap.className = "spa-cdsp-external-docs-filter-wrap";

    const filterButton = createExternalDocumentsButton("Filtros", "spa-cdsp-external-docs-button-secondary spa-cdsp-external-docs-filter-button");

    const filterMenu = document.createElement("div");
    filterMenu.className = "spa-cdsp-external-docs-filter-menu";
    filterMenu.hidden = true;

    const quickFilterDefinitions = [
      {
        id: "general",
        label: "Manifestações em Geral",
        terms: "inicial;contest;impug;embarg;apela;agrav;recurs;contra;cump;edcl;cnt;agint;resp;impsent;impdec;alega;memoriais;parecer;petiç;cdsp;mp para o juízo",
      },
      {
        id: "decisions",
        label: "Decisões Judiciais",
        terms: "decis;tutela;liminar;desp;senten;monoc;julg;ement;acórd",
      },
      {
        id: "cdsp",
        label: "Manifestações CDSP",
        terms: "CDSP",
      },
      {
        id: "nat",
        label: "Nota técnica do NAT",
        terms: "notaT;Código;PM;PF",
      },
      {
        id: "ses",
        label: "Informações da SES",
        terms: "SESDIC;SESOFI;ofi;merged;CIAPS;juntada ses;SESMT",
      },
      {
        id: "oficio_ses",
        label: "Ofício SES",
        terms: "Ofício;Oficio",
        sources: ["folder"],
      },
    ];
    const movementPgeStateFilterDefinition = {
      id: "pge_state_inline",
      label: "PGE/Estado",
      terms: "PROCURADORIA GERAL DO ESTADO DE MATO GROSSO;ESTADO DE MATO GROSSO",
    };
    const selectedQuickFilters = new Set();
    const quickFilterInputs = {};
    const quickFilterOptions = {};

    quickFilterDefinitions.forEach((definition) => {
      const option = document.createElement("label");
      option.className = "spa-cdsp-external-docs-filter-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = definition.id;

      const text = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = definition.label;

      text.appendChild(title);
      option.appendChild(checkbox);
      option.appendChild(text);
      filterMenu.appendChild(option);
      quickFilterInputs[definition.id] = checkbox;
      quickFilterOptions[definition.id] = option;
    });

    const latestDecisionButton = createExternalDocumentsButton("Última decisão", "spa-cdsp-external-docs-button-secondary spa-cdsp-external-docs-filter-clear");
    latestDecisionButton.title = "Abrir o documento da decisão mais recente retornada pelos filtros do Andamento PJE.";
    latestDecisionButton.style.display = "none";
    filterMenu.appendChild(latestDecisionButton);

    const clearQuickFiltersButton = createExternalDocumentsButton("Limpar filtros", "spa-cdsp-external-docs-button-secondary spa-cdsp-external-docs-filter-clear");
    filterMenu.appendChild(clearQuickFiltersButton);

    filterWrap.appendChild(filterButton);
    filterWrap.appendChild(filterMenu);
    searchTools.appendChild(search);
    searchTools.appendChild(filterWrap);

    const exactSearchOption = document.createElement("label");
    exactSearchOption.className = "spa-cdsp-external-docs-exact-option";
    const exactSearchInput = document.createElement("input");
    exactSearchInput.type = "checkbox";
    const exactSearchText = document.createElement("span");
    exactSearchText.textContent = "Busca exata";
    exactSearchOption.appendChild(exactSearchInput);
    exactSearchOption.appendChild(exactSearchText);
    searchTools.appendChild(exactSearchOption);

    const pgeStateOption = document.createElement("label");
    pgeStateOption.className = "spa-cdsp-external-docs-exact-option";
    pgeStateOption.style.display = "none";
    pgeStateOption.title = "Filtrar o Andamento PJE por Estado/PGE.";
    const pgeStateInput = document.createElement("input");
    pgeStateInput.type = "checkbox";
    const pgeStateText = document.createElement("span");
    pgeStateText.textContent = "PGE/Estado";
    pgeStateOption.appendChild(pgeStateInput);
    pgeStateOption.appendChild(pgeStateText);
    searchTools.appendChild(pgeStateOption);

    const quickActionsBar = document.createElement("div");
    quickActionsBar.className = "spa-cdsp-external-docs-quick-bar";
    quickActionsBar.style.display = "none";

    const quickActionsControls = document.createElement("div");
    quickActionsControls.className = "spa-cdsp-external-docs-quick-controls";

    const selectedButton = createExternalDocumentsButton("Selecionados", "spa-cdsp-external-docs-open-selected");
    selectedButton.title = "Escolher formato para abrir apenas os PDFs marcados manualmente.";

    const selectedWrap = document.createElement("div");
    selectedWrap.className = "spa-cdsp-external-docs-process-wrap";

    const selectedMenu = document.createElement("div");
    selectedMenu.className = "spa-cdsp-external-docs-process-menu";
    selectedMenu.hidden = true;

    const selectedUnifiedButton = createExternalDocumentsButton("Unificado", "spa-cdsp-external-docs-process-option");
    selectedUnifiedButton.title = "Mesclar apenas os PDFs marcados.";

    const selectedSeparateButton = createExternalDocumentsButton("Separado", "spa-cdsp-external-docs-process-option");
    selectedSeparateButton.title = "Abrir apenas os PDFs marcados juntos em uma aba.";

    const selectedOrderGroup = document.createElement("div");
    selectedOrderGroup.className = "spa-cdsp-external-docs-process-order";
    selectedOrderGroup.hidden = true;

    const selectedAscButton = createExternalDocumentsButton("Crescente", "spa-cdsp-external-docs-process-option");
    selectedAscButton.title = "Do item mais antigo ao mais recente entre os marcados.";

    const selectedDescButton = createExternalDocumentsButton("Decrescente", "spa-cdsp-external-docs-process-option");
    selectedDescButton.title = "Do item mais recente ao mais antigo entre os marcados.";

    selectedOrderGroup.appendChild(selectedAscButton);
    selectedOrderGroup.appendChild(selectedDescButton);
    selectedMenu.appendChild(selectedUnifiedButton);
    selectedMenu.appendChild(selectedSeparateButton);
    selectedMenu.appendChild(selectedOrderGroup);
    selectedWrap.appendChild(selectedButton);
    selectedWrap.appendChild(selectedMenu);

    const openAllButton = createExternalDocumentsButton(
      "Abrir tudo",
      "spa-cdsp-external-docs-open-all"
    );
    openAllButton.title = "Escolher formato para abrir somente os itens filtrados.";

    const openAllWrap = document.createElement("div");
    openAllWrap.className = "spa-cdsp-external-docs-process-wrap";

    const openAllMenu = document.createElement("div");
    openAllMenu.className = "spa-cdsp-external-docs-process-menu";
    openAllMenu.hidden = true;

    const openAllUnifiedButton = createExternalDocumentsButton("Unificado", "spa-cdsp-external-docs-process-option");
    openAllUnifiedButton.title = "Mesclar somente os PDFs filtrados.";

    const openAllSeparateButton = createExternalDocumentsButton("Separado", "spa-cdsp-external-docs-process-option");
    openAllSeparateButton.title = "Abrir somente os PDFs filtrados juntos em uma aba.";

    const openAllOrderGroup = document.createElement("div");
    openAllOrderGroup.className = "spa-cdsp-external-docs-process-order";
    openAllOrderGroup.hidden = true;

    const openAllAscButton = createExternalDocumentsButton("Crescente", "spa-cdsp-external-docs-process-option");
    openAllAscButton.title = "Do item mais antigo ao mais recente dentro do filtro.";

    const openAllDescButton = createExternalDocumentsButton("Decrescente", "spa-cdsp-external-docs-process-option");
    openAllDescButton.title = "Do item mais recente ao mais antigo dentro do filtro.";

    openAllOrderGroup.appendChild(openAllAscButton);
    openAllOrderGroup.appendChild(openAllDescButton);
    openAllMenu.appendChild(openAllUnifiedButton);
    openAllMenu.appendChild(openAllSeparateButton);
    openAllMenu.appendChild(openAllOrderGroup);
    openAllWrap.appendChild(openAllButton);
    openAllWrap.appendChild(openAllMenu);

    const quickActionItems = [
      {
        id: "initial-petition",
        label: "Petição inicial",
        run: async () => {
          const items = await ensureExternalDocumentItemsLoadedForQuickAction();
          const item = findInitialPetitionItem(items);
          if (!item) {
            status.textContent = "Nao encontrei peticao inicial no resumo carregado.";
            return;
          }
          await openExternalDocumentQuickItem(item, status, "Peticao inicial");
        },
      },
      {
        id: "current-expediente",
        label: "Expediente atual",
        run: async () => {
          const item = findCurrentProcedureExpedienteItem();
          if (!item) {
            status.textContent = "Nao encontrei expediente visivel nesta pendencia.";
            return;
          }
          await openExternalDocumentQuickItem(item, status, "Expediente atual");
        },
      },
      {
        id: "latest-pge-petition",
        label: "Última petição PGE",
        run: async () => {
          const items = await ensureExternalDocumentItemsLoadedForQuickAction();
          const item = findLatestPgePetitionItem(items);
          if (!item) {
            status.textContent = "Nao encontrei item com CDSP no resumo carregado.";
            return;
          }
          await openExternalDocumentQuickItem(item, status, "Ultima peticao da PGE");
        },
      },
      {
        id: "latest-decision",
        label: "Última decisão",
        run: async () => {
          if (getActiveSource().key === "movements") {
            await openLatestDecisionMovement();
            return;
          }
          const items = await ensureExternalDocumentItemsLoadedForQuickAction();
          const item = findLatestDecisionItem(items);
          if (!item) {
            status.textContent = "Nao encontrei decisao no resumo carregado.";
            return;
          }
          await openExternalDocumentQuickItem(item, status, "Ultima decisao");
        },
      },
    ];

    const quickActionButtons = [];

    quickActionItems.forEach((action) => {
      const itemButton = document.createElement("button");
      itemButton.type = "button";
      itemButton.className = "spa-cdsp-external-docs-button spa-cdsp-external-docs-quick-direct";
      itemButton.dataset.quickActionId = action.id;
      itemButton.textContent = action.label;
      itemButton.addEventListener("click", async () => {
        quickActionButtons.forEach((button) => {
          button.disabled = true;
        });
        setOpenAllButtonsDisabled(true);
        setProcessCompleteButtonsDisabled(true);
        setSelectedDocumentsButtonsDisabled(true);
        setContentOpenAllButtonsDisabled(true);
        latestDecisionButton.disabled = true;
        itemButton.disabled = true;
        try {
          await action.run();
        } finally {
          quickActionButtons.forEach((button) => {
            button.disabled = false;
          });
          setOpenAllButtonsDisabled(false);
          setProcessCompleteButtonsDisabled(false);
          setSelectedDocumentsButtonsDisabled(false);
          setContentOpenAllButtonsDisabled(false);
          latestDecisionButton.disabled = false;
          itemButton.disabled = false;
        }
      });
      quickActionButtons.push(itemButton);
    });

    quickActionsControls.appendChild(openAllWrap);
    quickActionsControls.appendChild(selectedWrap);
    quickActionButtons.forEach((button) => quickActionsControls.appendChild(button));
    quickActionsBar.appendChild(quickActionsControls);

    searchRow.appendChild(searchTools);
    searchRow.appendChild(quickActionsBar);

    const contentSearch = document.createElement("div");
    contentSearch.className = "spa-cdsp-external-docs-content-search";

    const contentSearchRow = document.createElement("div");
    contentSearchRow.className = "spa-cdsp-external-docs-content-search-row";

    const contentSearchInput = document.createElement("input");
    contentSearchInput.type = "search";
    contentSearchInput.className = "spa-cdsp-external-docs-content-input";
    contentSearchInput.placeholder = "Pesquisar dentro dos PDFs... Use ; para vários termos.";

    const contentSearchButton = createExternalDocumentsButton("Buscar nos PDFs");
    const contentSearchStopButton = createExternalDocumentsButton("Parar", "spa-cdsp-external-docs-button-secondary");
    contentSearchStopButton.style.display = "none";
    contentSearchStopButton.disabled = true;

    const contentOpenAllButton = createExternalDocumentsButton("Abrir todos", "spa-cdsp-external-docs-open-all");
    contentOpenAllButton.title = "Escolher formato para abrir todos os resultados da pesquisa dentro dos PDFs.";
    contentOpenAllButton.disabled = true;

    const contentOpenAllWrap = document.createElement("div");
    contentOpenAllWrap.className = "spa-cdsp-external-docs-process-wrap";

    const contentOpenAllMenu = document.createElement("div");
    contentOpenAllMenu.className = "spa-cdsp-external-docs-process-menu";
    contentOpenAllMenu.hidden = true;

    const contentOpenAllUnifiedButton = createExternalDocumentsButton("Unificado", "spa-cdsp-external-docs-process-option");
    contentOpenAllUnifiedButton.title = "Mesclar os resultados da pesquisa interna.";

    const contentOpenAllSeparateButton = createExternalDocumentsButton("Separado", "spa-cdsp-external-docs-process-option");
    contentOpenAllSeparateButton.title = "Abrir os resultados da pesquisa interna juntos em uma aba.";

    const contentOpenAllOrderGroup = document.createElement("div");
    contentOpenAllOrderGroup.className = "spa-cdsp-external-docs-process-order";
    contentOpenAllOrderGroup.hidden = true;

    const contentOpenAllAscButton = createExternalDocumentsButton("Crescente", "spa-cdsp-external-docs-process-option");
    contentOpenAllAscButton.title = "Do resultado mais antigo ao mais recente.";

    const contentOpenAllDescButton = createExternalDocumentsButton("Decrescente", "spa-cdsp-external-docs-process-option");
    contentOpenAllDescButton.title = "Do resultado mais recente ao mais antigo.";

    contentOpenAllOrderGroup.appendChild(contentOpenAllAscButton);
    contentOpenAllOrderGroup.appendChild(contentOpenAllDescButton);
    contentOpenAllMenu.appendChild(contentOpenAllUnifiedButton);
    contentOpenAllMenu.appendChild(contentOpenAllSeparateButton);
    contentOpenAllMenu.appendChild(contentOpenAllOrderGroup);
    contentOpenAllWrap.appendChild(contentOpenAllButton);
    contentOpenAllWrap.appendChild(contentOpenAllMenu);

    contentSearchRow.appendChild(contentSearchInput);
    contentSearchRow.appendChild(contentSearchButton);
    contentSearchRow.appendChild(contentOpenAllWrap);
    contentSearchRow.appendChild(contentSearchStopButton);

    const contentSearchOption = document.createElement("label");
    contentSearchOption.className = "spa-cdsp-external-docs-content-option";

    const contentSearchStopOnFirst = document.createElement("input");
    contentSearchStopOnFirst.type = "checkbox";
    contentSearchStopOnFirst.checked = false;

    const contentSearchOptionText = document.createElement("span");
    contentSearchOptionText.textContent = "Parar no primeiro resultado";

    contentSearchOption.appendChild(contentSearchStopOnFirst);
    contentSearchOption.appendChild(contentSearchOptionText);

    const contentSearchConcurrencyOption = document.createElement("label");
    contentSearchConcurrencyOption.className = "spa-cdsp-external-docs-content-option";

    const contentSearchConcurrencyText = document.createElement("span");
    contentSearchConcurrencyText.textContent = "PDFs simultâneos";

    const contentSearchConcurrency = document.createElement("input");
    contentSearchConcurrency.type = "number";
    contentSearchConcurrency.className = "spa-cdsp-external-docs-content-number";
    contentSearchConcurrency.min = "1";
    contentSearchConcurrency.max = String(CONFIG.autosDocumentSearchMaxConcurrency);
    contentSearchConcurrency.step = "1";
    contentSearchConcurrency.value = String(CONFIG.autosDocumentSearchConcurrency);
    contentSearchConcurrency.title =
      "Quantidade de PDFs lidos ao mesmo tempo. Valores muito altos podem deixar o Chrome pesado.";

    contentSearchConcurrencyOption.appendChild(contentSearchConcurrencyText);
    contentSearchConcurrencyOption.appendChild(contentSearchConcurrency);

    const contentSearchProgress = document.createElement("div");
    contentSearchProgress.className = "spa-cdsp-external-docs-content-progress";
    contentSearchProgress.textContent = "A pesquisa usa cache durante a sessão. Ajuste a quantidade de PDFs simultâneos se precisar.";

    const contentSearchResults = document.createElement("div");
    contentSearchResults.className = "spa-cdsp-external-docs-content-results";

    contentSearch.appendChild(contentSearchRow);
    contentSearch.appendChild(contentSearchOption);
    contentSearch.appendChild(contentSearchConcurrencyOption);
    contentSearch.appendChild(contentSearchProgress);
    contentSearch.appendChild(contentSearchResults);

    const viewer = document.createElement("div");
    viewer.className = "spa-cdsp-external-docs-viewer";

    const placeholder = document.createElement("div");
    placeholder.className = "spa-cdsp-external-docs-placeholder";
    placeholder.textContent = "O resumo ficará aqui. Cada item terá um botão para abrir o documento correspondente.";
    viewer.appendChild(placeholder);

    function getActiveSource() {
      const configured = sources[panel.dataset.source];
      if (configured && configured.url) return configured;
      if (sources.autos && sources.autos.url) return sources.autos;
      if (sources.folder && sources.folder.url) return sources.folder;
      if (sources.movements && sources.movements.url) return sources.movements;
      return sources.folder || { key: "folder", url: "", label: "Pasta do processo", buttonLabel: "Abrir" };
    }

    function getSelectedQuickFilterDefinitions() {
      return quickFilterDefinitions.filter((definition) => selectedQuickFilters.has(definition.id));
    }

    function getExternalSummaryFilterOptions() {
      const implicitDefinitions = getSelectedQuickFilterDefinitions();
      const activeSource = getActiveSource();
      if (activeSource && activeSource.key === "movements" && pgeStateInput.checked) {
        implicitDefinitions.push(movementPgeStateFilterDefinition);
      }

      return {
        exactText: exactSearchInput.checked,
        implicitText: implicitDefinitions.map((definition) => definition.terms).join(";"),
        implicitDefinitions,
      };
    }

    function updateQuickFilterAvailability(source) {
      const sourceKey = source && source.key ? source.key : "";
      const isMovements = sourceKey === "movements";
      quickFilterDefinitions.forEach((definition) => {
        const option = quickFilterOptions[definition.id];
        const input = quickFilterInputs[definition.id];
        const allowedSources = Array.isArray(definition.sources) ? definition.sources : [];
        const available = !allowedSources.length || allowedSources.indexOf(sourceKey) >= 0;
        if (option) option.style.display = available ? "" : "none";
        if (!available && input && input.checked) {
          input.checked = false;
          selectedQuickFilters.delete(definition.id);
        }
      });
      latestDecisionButton.style.display = isMovements ? "" : "none";
      pgeStateOption.style.display = isMovements ? "" : "none";
      openAllWrap.style.display = isMovements ? "none" : "";
      selectedWrap.style.display = isMovements ? "none" : "";
      quickActionButtons.forEach((button) => {
        button.style.display = !isMovements || button.dataset.quickActionId === "latest-decision" ? "" : "none";
      });
      updateQuickFilterButtonLabel();
    }

    function updateQuickFilterButtonLabel() {
      const count = selectedQuickFilters.size;
      filterButton.textContent = count ? "Filtros (" + count + ")" : "Filtros";
    }

    function renderActiveExternalSourceWithFilters() {
      const source = getActiveSource();
      if (!getSourceCache(source.key).loaded) return;
      const items = panel._externalDocumentItems || [];
      const options = getExternalSummaryFilterOptions();

      if (source.key === "movements") renderProcedureMovementsTimeline(viewer, items, source, search.value, options);
      else renderExternalDocumentSummary(viewer, items, search.value, source, options);
    }

    function getSourceCache(key) {
      const sourceKey = key || (getActiveSource() && getActiveSource().key) || defaultSourceKey;
      if (!panel._externalDocumentCache[sourceKey]) {
        panel._externalDocumentCache[sourceKey] = {
          loaded: false,
          items: [],
          filterText: "",
          contentQuery: "",
          scrollTop: 0,
        };
      }
      return panel._externalDocumentCache[sourceKey];
    }

    function getExternalDocumentScrollNode() {
      return viewer.querySelector(".spa-cdsp-external-docs-list, .spa-cdsp-movements-timeline");
    }

    function saveExternalSourceViewState() {
      const source = getActiveSource();
      if (!source || !source.key) return;

      const cache = getSourceCache(source.key);
      cache.filterText = search.value || "";
      cache.contentQuery = contentSearchInput.value || "";

      const scrollNode = getExternalDocumentScrollNode();
      if (scrollNode) cache.scrollTop = scrollNode.scrollTop || 0;
    }

    function restoreExternalDocumentScroll(cache) {
      setTimeout(() => {
        const scrollNode = getExternalDocumentScrollNode();
        if (scrollNode) scrollNode.scrollTop = cache && cache.scrollTop ? cache.scrollTop : 0;
      }, 0);
    }

    let processCompleteSelectedMode = "";
    let openAllSelectedMode = "";
    let selectedDocumentsSelectedMode = "";
    let contentOpenAllSelectedMode = "";

    function setActiveProcessOption(buttons, selectedButton) {
      buttons.forEach((button) => {
        button.classList.toggle("spa-cdsp-external-docs-process-option-active", button === selectedButton);
      });
    }

    function resetProcessCompleteMenuChoice() {
      processCompleteSelectedMode = "";
      processOrderGroup.hidden = true;
      setActiveProcessOption([processUnifiedButton, processSeparateButton], null);
    }

    function resetOpenAllMenuChoice() {
      openAllSelectedMode = "";
      openAllOrderGroup.hidden = true;
      setActiveProcessOption([openAllUnifiedButton, openAllSeparateButton], null);
    }

    function resetSelectedDocumentsMenuChoice() {
      selectedDocumentsSelectedMode = "";
      selectedOrderGroup.hidden = true;
      setActiveProcessOption([selectedUnifiedButton, selectedSeparateButton], null);
    }

    function resetContentOpenAllMenuChoice() {
      contentOpenAllSelectedMode = "";
      contentOpenAllOrderGroup.hidden = true;
      setActiveProcessOption([contentOpenAllUnifiedButton, contentOpenAllSeparateButton], null);
    }

    function selectProcessCompleteMode(mode, selectedButton) {
      processCompleteSelectedMode = mode;
      processOrderGroup.hidden = false;
      setActiveProcessOption([processUnifiedButton, processSeparateButton], selectedButton);
    }

    function selectOpenAllMode(mode, selectedButton) {
      openAllSelectedMode = mode;
      openAllOrderGroup.hidden = false;
      setActiveProcessOption([openAllUnifiedButton, openAllSeparateButton], selectedButton);
    }

    function selectSelectedDocumentsMode(mode, selectedButton) {
      selectedDocumentsSelectedMode = mode;
      selectedOrderGroup.hidden = false;
      setActiveProcessOption([selectedUnifiedButton, selectedSeparateButton], selectedButton);
    }

    function selectContentOpenAllMode(mode, selectedButton) {
      contentOpenAllSelectedMode = mode;
      contentOpenAllOrderGroup.hidden = false;
      setActiveProcessOption([contentOpenAllUnifiedButton, contentOpenAllSeparateButton], selectedButton);
    }

    function setProcessCompleteButtonsDisabled(disabled) {
      [
        processCompleteButton,
        processUnifiedButton,
        processSeparateButton,
        processAscButton,
        processDescButton,
      ].forEach((button) => {
        button.disabled = disabled;
      });
    }

    function setOpenAllButtonsDisabled(disabled) {
      [
        openAllButton,
        openAllUnifiedButton,
        openAllSeparateButton,
        openAllAscButton,
        openAllDescButton,
      ].forEach((button) => {
        button.disabled = disabled;
      });
    }

    function setSelectedDocumentsButtonsDisabled(disabled) {
      [
        selectedButton,
        selectedUnifiedButton,
        selectedSeparateButton,
        selectedAscButton,
        selectedDescButton,
      ].forEach((button) => {
        button.disabled = disabled;
      });
      if (!disabled) refreshExternalDocumentSelectionControls();
    }

    function setContentOpenAllButtonsDisabled(disabled) {
      const hasHits = Array.isArray(panel._contentSearchHits) && panel._contentSearchHits.some(isExternalDocumentSelectable);
      [
        contentOpenAllButton,
        contentOpenAllUnifiedButton,
        contentOpenAllSeparateButton,
        contentOpenAllAscButton,
        contentOpenAllDescButton,
      ].forEach((button) => {
        button.disabled = disabled || !hasHits;
      });
    }

    function refreshExternalDocumentSelectionControls() {
      const count = selectedExternalDocumentsFromPanel(panel).length;
      selectedButton.textContent = count ? "Selecionados (" + count + ")" : "Selecionados";
      selectedButton.disabled = !count || panel.dataset.loading === "1" || panel.dataset.openingAll === "1";
      [selectedUnifiedButton, selectedSeparateButton, selectedAscButton, selectedDescButton].forEach((button) => {
        button.disabled = !count || panel.dataset.loading === "1" || panel.dataset.openingAll === "1";
      });
      setContentOpenAllButtonsDisabled(panel.dataset.loading === "1" || panel.dataset.openingAll === "1");
    }

    panel._refreshExternalDocumentSelectionControls = refreshExternalDocumentSelectionControls;

    function movementLinkedIds(item, mode) {
      const ids = [];
      const push = (value) => {
        const text = String(value || "").trim();
        if (text && ids.indexOf(text) < 0) ids.push(text);
      };

      const sourceArrays =
        mode === "response"
          ? [item && item.responseIds]
          : [item && item.documentIds, item && item.linkedDocumentIds];
      sourceArrays.forEach((values) => {
        (Array.isArray(values) ? values : []).forEach(push);
      });
      (Array.isArray(item && item.expedientes) ? item.expedientes : []).forEach((expediente) => {
        const values = mode === "response" ? expediente.responseIds : expediente.documentIds;
        (Array.isArray(values) ? values : []).forEach(push);
      });
      return ids;
    }

    function externalItemMatchesDocumentId(item, ids) {
      if (!item || !Array.isArray(ids) || !ids.length) return false;
      const itemId = String(item.id || "").trim();
      if (itemId && ids.indexOf(itemId) >= 0) return true;
      const text = normalizeText([item.type, item.description, item.url, item.viewerUrl, item.pdfUrl].join(" ")).toLowerCase();
      return ids.some((id) => {
        const value = normalizeText(id).toLowerCase();
        return Boolean(value && text.indexOf(value) >= 0);
      });
    }

    function externalDocumentVerificationMessage(item, ids, mode) {
      const itemId = String((item && item.id) || "").trim();
      if (itemId && ids.indexOf(itemId) >= 0) {
        return (
          (mode === "response" ? "Resposta aberta pelo SPA." : "Documento aberto pelo SPA.") +
          " Conferencia PJe: ID " +
          itemId +
          " confirmado pelo Andamento PJe."
        );
      }

      const text = normalizeText([item && item.type, item && item.description, item && item.url, item && item.viewerUrl, item && item.pdfUrl].join(" ")).toLowerCase();
      const matchedId = ids.find((id) => {
        const value = normalizeText(id).toLowerCase();
        return Boolean(value && text.indexOf(value) >= 0);
      });

      if (matchedId) {
        return (
          (mode === "response" ? "Resposta aberta pelo SPA." : "Documento aberto pelo SPA.") +
          " Conferencia PJe: referencia ao ID " +
          matchedId +
          " localizada no item do SPA."
        );
      }

      return (
        (mode === "response" ? "Resposta aberta pelo SPA." : "Documento aberto pelo SPA.") +
        " Conferencia PJe: nao foi possivel confirmar o ID automaticamente."
      );
    }

    async function findExternalPdfItemByDocumentIds(ids) {
      const sourceOrder = ["autos", "folder"];
      for (const sourceKey of sourceOrder) {
        const source = sources[sourceKey];
        if (!source || !source.url) continue;
        const cache = getSourceCache(sourceKey);
        if (!cache.loaded) {
          try {
            await loadExternalSourceIntoCache(source, { force: false });
          } catch (_error) {
            // A outra fonte ainda pode conter o PDF.
          }
        }
        const item = (Array.isArray(cache.items) ? cache.items : []).find((candidate) =>
          isExternalDocumentSelectable(candidate) && externalItemMatchesDocumentId(candidate, ids)
        );
        if (item) return item;
      }
      return null;
    }

    panel._openMovementLinkedDocument = async (item, mode) => {
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de abrir o PDF vinculado.";
        return false;
      }

      const ids = movementLinkedIds(item, mode);
      if (!ids.length) {
        status.textContent =
          mode === "response"
            ? "Esta movimentacao nao trouxe ID de resposta pelo MCP."
            : "Esta movimentacao nao trouxe ID de documento pelo MCP.";
        return false;
      }

      status.textContent = "Localizando PDF vinculado no SPA...";
      const found = await findExternalPdfItemByDocumentIds(ids);
      if (!found) {
        status.textContent = "Nao encontrei documento vinculado ao(s) ID(s): " + ids.join(", ") + ".";
        return false;
      }

      const opened = await openExternalDocumentQuickItem(
        found,
        status,
        mode === "response" ? "Resposta vinculada" : "PDF vinculado"
      );
      if (opened) status.textContent = externalDocumentVerificationMessage(found, ids, mode);
      return opened;
    };

    async function openLatestDecisionMovement() {
      const source = sources.movements;
      if (!source || !source.url) {
        status.textContent = "Nao foi possivel identificar o Andamento PJE deste processo.";
        return;
      }

      const cache = getSourceCache("movements");
      if (!cache.loaded) {
        status.textContent = "Carregando Andamento PJE...";
        await loadExternalSourceIntoCache(source, { force: false });
      }

      const decisionDefinition = quickFilterDefinitions.find((definition) => definition.id === "decisions");
      const currentFilter =
        getActiveSource().key === "movements" ? search.value : "";
      const candidates = filterExternalDocumentItems(cache.items, currentFilter, getExternalSummaryFilterOptions());
      const decisions = filterExternalDocumentItems(candidates, "", {
        implicitDefinitions: decisionDefinition ? [decisionDefinition] : [],
      });
      const target = decisions.find((item) => movementLinkedIds(item, "document").length);

      if (!target) {
        status.textContent = "Nao encontrei decisao com documento vinculado no Andamento PJE.";
        return;
      }

      await panel._openMovementLinkedDocument(target, "document");
    }

    function setExternalDocumentActionButtonsDisabled(disabled) {
      setOpenAllButtonsDisabled(disabled);
      setProcessCompleteButtonsDisabled(disabled);
      setSelectedDocumentsButtonsDisabled(disabled);
      setContentOpenAllButtonsDisabled(disabled);
      quickActionButtons.forEach((button) => {
        button.disabled = disabled;
      });
      latestDecisionButton.disabled = disabled;
      loadButton.disabled = disabled;
      contentSearchButton.disabled = disabled || panel.dataset.contentSearching === "1";
    }

    function updateExternalSourceChrome(source, cache) {
      panel.dataset.source = source.key;
      panel.dataset.url = source.url || "";
      panel.dataset.loaded = cache && cache.loaded ? "1" : "0";
      titleText.textContent = source.label || "Documentos do processo";
      openButton.href = source.url || "#";
      openButton.textContent = source.buttonLabel || "Abrir";
      openButton.style.display = source.openable === false ? "none" : "";
      loadButton.textContent = "Atualizar";
      search.placeholder =
        source.key === "movements"
          ? "Pesquisar por movimento, número, data ou texto... Use ; para vários termos."
          : "Filtrar por tipo, ID, descrição ou data... Use ; para vários termos.";
      quickActionsBar.style.display = "";
      updateQuickFilterAvailability(source);
      filterMenu.hidden = true;
    }

    function updateExternalContentSearchState(source, items, cache) {
      const isMovements = source.key === "movements";
      const searchableCount = isMovements ? 0 : (items || []).filter((item) => item && item.isPdf).length;
      contentSearch.style.display = !isMovements && searchableCount ? "block" : "none";
      contentSearchResults.style.display = "none";
      contentSearchResults.textContent = "";
      panel._contentSearchHits = [];
      contentSearchInput.value = cache && cache.contentQuery ? cache.contentQuery : "";
      contentSearchProgress.textContent = searchableCount
        ? "A pesquisa usa cache durante a sessão. Ajuste a quantidade de PDFs simultâneos se precisar."
        : isMovements
        ? "A pesquisa em conteúdo de PDF não se aplica ao andamento processual."
        : "A fonte selecionada nao trouxe PDFs pesquisaveis neste resumo.";
      refreshExternalDocumentSelectionControls();
    }

    function renderExternalSourceFromCache(source, cache, statusText) {
      const items = Array.isArray(cache.items) ? cache.items : [];
      panel._externalDocumentItems = items;
      panel.dataset.loaded = "1";
      updateExternalSourceChrome(source, cache);
      search.value = cache.filterText || "";
      search.style.display = "";
      searchRow.style.display = "";
      updateExternalContentSearchState(source, items, cache);

      if (source.key === "movements") renderProcedureMovementsTimeline(viewer, items, source, search.value, getExternalSummaryFilterOptions());
      else renderExternalDocumentSummary(viewer, items, search.value, source, getExternalSummaryFilterOptions());

      loadButton.textContent = "Atualizar";
      status.textContent =
        statusText ||
        items.length +
          " " +
          (source.foundSuffix || "item(ns) encontrado(s).") +
          (source.key === "movements" ? "" : " Use Abrir em cada linha para visualizar o item correspondente.");
      restoreExternalDocumentScroll(cache);
      refreshExternalDocumentSelectionControls();
    }

    function resetExternalDocumentSourceView() {
      const source = getActiveSource();
      const cache = getSourceCache(source.key);
      updateExternalSourceChrome(source, cache);

      if (cache.loaded) {
        renderExternalSourceFromCache(source, cache, "Resumo restaurado desta aba.");
        return;
      }

      panel._externalDocumentItems = [];
      search.value = "";
      search.style.display = "";
      searchRow.style.display = "";
      contentSearch.style.display = "none";
      contentSearchResults.style.display = "none";
      contentSearchResults.textContent = "";
      contentSearchInput.value = "";
      contentSearchProgress.textContent = "A pesquisa usa cache durante a sessão. Ajuste a quantidade de PDFs simultâneos se precisar.";
      refreshExternalDocumentSelectionControls();
      viewer.textContent = "";

      const box = document.createElement("div");
      box.className = "spa-cdsp-external-docs-placeholder";
      box.textContent =
        source.key === "movements"
          ? "O andamento processual ficará aqui em formato de linha do tempo."
          : source.key === "folder"
          ? "O resumo da pasta do processo ficará aqui. Pastas e documentos serão listados em uma visão rápida."
          : "O resumo dos autos ficará aqui. Cada documento terá um botão para abrir o PDF quando possível.";
      viewer.appendChild(box);

      status.textContent =
        source.key === "movements"
          ? "Selecione Andamento PJE para consultar automaticamente pelo MNI/PJe."
          : source.key === "folder"
          ? "Atualize para buscar Autos, Pasta e Andamento PJE novamente."
          : "Atualize para buscar Autos, Pasta e Andamento PJE novamente.";
    }

    async function ensureExternalDocumentItemsLoadedForQuickAction() {
      const source = getActiveSource();
      if (source.key === "movements") return [];
      const cache = getSourceCache(source.key);

      if (panel.dataset.loading === "1") {
        status.textContent = "Aguarde o resumo terminar de carregar antes de usar as ações rápidas.";
        return [];
      }

      if (!cache.loaded) {
        await loadActiveExternalSource();
      }

      return Array.isArray(getSourceCache(source.key).items) ? getSourceCache(source.key).items : [];
    }

    async function filteredExternalDocumentsForOpenAll() {
      const source = getActiveSource();
      if (source.key === "movements") {
        status.textContent = "Abrir tudo se aplica apenas a Autos e Pasta.";
        return [];
      }

      const items = await ensureExternalDocumentItemsLoadedForQuickAction();
      return filterExternalDocumentItems(items, search.value, getExternalSummaryFilterOptions()).filter(
        (item) => !item.noOpen && item.isPdf && directPdfUrlFromSpaViewer(getExternalDocumentOpenUrl(item))
      );
    }

    async function openExternalDocumentItemSet(rawItems, mode, order, triggerButton, options) {
      if (panel.dataset.openingAll === "1") return;

      const source = getActiveSource();
      const selectedMode = mode === "merged" ? "merged" : "separate";
      const selectedOrder = order === "desc" ? "desc" : "asc";
      const items = sortExternalAutosItems(
        (Array.isArray(rawItems) ? rawItems : []).filter(isExternalDocumentSelectable),
        selectedOrder
      );
      const config = options || {};

      if (!items.length) {
        status.textContent = config.emptyMessage || "Nenhum PDF foi encontrado para abrir.";
        return;
      }

      const openedTab = window.open("about:blank", "_blank");
      if (!openedTab) {
        status.textContent = "O navegador bloqueou a nova aba dos documentos.";
        return;
      }

      const previousText = triggerButton ? triggerButton.textContent : "";
      panel.dataset.openingAll = "1";
      setExternalDocumentActionButtonsDisabled(true);

      try {
        if (triggerButton) triggerButton.textContent = "Abrindo...";
        writeExternalAutosPdfLoadingPage(
          openedTab,
          selectedMode === "merged"
            ? config.mergedLoadingText || "Preparando PDF unificado..."
            : config.separateLoadingText || "Abrindo PDFs..."
        );

        if (selectedMode === "merged") {
          const result = await mergeExternalAutosPdfs(openedTab, items, processNumber, status);
          status.textContent =
            (config.mergedStatusPrefix || "PDF unificado aberto") +
            " com " +
            result.pages +
            " pagina(s) de " +
            items.length +
            " documento(s) (" +
            externalAutosOrderLabel(selectedOrder) +
            ")" +
            (result.failed.length ? "; " + result.failed.length + " documento(s) ignorado(s)." : ".");
          return;
        }

        if (
          !renderExternalAutosDirectPdfViewer(openedTab, items, processNumber, {
            order: selectedOrder,
            title: config.viewerTitle || "PDFs",
          })
        ) {
          throw new Error("Nao foi possivel abrir o visualizador dos PDFs.");
        }

        status.textContent =
          (config.separateStatusPrefix || "PDFs abertos juntos") +
          " com " +
          items.length +
          " documento(s) (" +
          externalAutosOrderLabel(selectedOrder) +
          ").";
      } catch (error) {
        const fallbackUrl = config.fallbackUrl || source.url;
        try {
          openedTab.location.href = fallbackUrl;
        } catch (_innerError) {
          if (fallbackUrl) window.open(fallbackUrl, "_blank");
        }
        status.textContent =
          (error && error.message ? error.message : config.errorMessage || "Nao foi possivel abrir os PDFs.") +
          (fallbackUrl ? " Abri a fonte original para conferencia." : "");
      } finally {
        panel.dataset.openingAll = "0";
        if (triggerButton) triggerButton.textContent = previousText || triggerButton.textContent;
        setExternalDocumentActionButtonsDisabled(false);
      }
    }

    async function openAllFilteredExternalDocuments(mode, order, triggerButton) {
      if (panel.dataset.openingAll === "1") return;

      const source = getActiveSource();
      if (source.key === "movements") {
        status.textContent = "Abrir tudo se aplica apenas a Autos e Pasta.";
        return;
      }

      const selectedMode = mode === "merged" ? "merged" : "separate";
      const selectedOrder = order === "desc" ? "desc" : "asc";
      const filtered = await filteredExternalDocumentsForOpenAll();
      await openExternalDocumentItemSet(filtered, selectedMode, selectedOrder, triggerButton, {
        emptyMessage: search.value ? "Nenhum PDF corresponde ao filtro atual para abrir." : "Nenhum PDF foi encontrado para abrir.",
        mergedLoadingText: "Preparando PDF unificado filtrado...",
        separateLoadingText: "Abrindo PDFs filtrados...",
        mergedStatusPrefix: "PDF unificado filtrado aberto",
        separateStatusPrefix: "PDFs filtrados abertos juntos",
        viewerTitle: "PDFs filtrados",
        fallbackUrl: source.url,
      });
    }

    async function openSelectedExternalDocuments(mode, order, triggerButton) {
      await openExternalDocumentItemSet(selectedExternalDocumentsFromPanel(panel), mode, order, triggerButton, {
        emptyMessage: "Marque ao menos um PDF nos autos para usar esta opcao.",
        mergedLoadingText: "Preparando PDF unificado selecionado...",
        separateLoadingText: "Abrindo PDFs selecionados...",
        mergedStatusPrefix: "PDF unificado selecionado aberto",
        separateStatusPrefix: "PDFs selecionados abertos juntos",
        viewerTitle: "PDFs selecionados",
      });
    }

    async function openContentSearchResults(mode, order, triggerButton) {
      await openExternalDocumentItemSet(panel._contentSearchHits || [], mode, order, triggerButton, {
        emptyMessage: "Nenhum resultado da pesquisa interna em PDF foi encontrado para abrir.",
        mergedLoadingText: "Preparando PDF unificado da pesquisa...",
        separateLoadingText: "Abrindo resultados da pesquisa...",
        mergedStatusPrefix: "PDF unificado da pesquisa aberto",
        separateStatusPrefix: "Resultados da pesquisa abertos juntos",
        viewerTitle: "Resultados da pesquisa nos PDFs",
      });
    }

    async function loadExternalSourceIntoCache(source, options) {
      const force = Boolean(options && options.force);
      const isMovements = source.key === "movements";
      const cache = getSourceCache(source.key);

      if (cache.loaded && !force) return cache.items;

      if (!source.url) {
        throw new Error("Nao foi possivel identificar o link de " + (source.shortLabel || source.label || "fonte") + ".");
      }

      const items =
        isMovements
          ? await fetchProcedureMovementsSummary(source)
          : await fetchExternalDocumentSummary(source.url, source.key);

      cache.items = Array.isArray(items) ? items : [];
      cache.loaded = true;
      cache.filterText = cache.filterText || "";
      cache.contentQuery = cache.contentQuery || "";
      cache.scrollTop = 0;
      return cache.items;
    }

    async function loadActiveExternalSource(options) {
      if (panel.dataset.loading === "1") return;

      const source = getActiveSource();
      const isMovements = source.key === "movements";
      const cache = getSourceCache(source.key);

      if (cache.loaded && !(options && options.force)) {
        renderExternalSourceFromCache(source, cache);
        return;
      }

      saveExternalSourceViewState();
      panel.dataset.loading = "1";
      loadButton.disabled = true;
      setOpenAllButtonsDisabled(true);
      setProcessCompleteButtonsDisabled(true);
      setSelectedDocumentsButtonsDisabled(true);
      setContentOpenAllButtonsDisabled(true);
      latestDecisionButton.disabled = true;
      loadButton.textContent = "Carregando...";
      status.textContent = source.loadingText || "Buscando documentos...";
      viewer.textContent = "";
      search.style.display = "none";
      searchRow.style.display = "none";
      quickActionsBar.style.display = "";
      contentSearch.style.display = "none";
      contentSearchResults.style.display = "none";
      contentSearchResults.textContent = "";

      try {
        const items = await loadExternalSourceIntoCache(source, options);
        renderExternalSourceFromCache(
          source,
          cache,
          items.length +
            " " +
            (source.foundSuffix || "item(ns) encontrado(s).") +
            (isMovements ? "" : " Use Abrir em cada linha para visualizar o item correspondente.")
        );
      } catch (error) {
        cache.loaded = false;
        cache.items = [];
        panel.dataset.loaded = "0";
        viewer.textContent = "";
        const errorBox = document.createElement("div");
        errorBox.className = "spa-cdsp-external-docs-placeholder";
        errorBox.textContent = source.errorText || "Nao foi possivel montar o resumo automaticamente. Use Abrir para acessar a pagina original.";
        viewer.appendChild(errorBox);
        contentSearch.style.display = "none";
        status.textContent = error && error.message ? error.message : "Falha ao carregar resumo.";
      } finally {
        panel.dataset.loading = "0";
        loadButton.disabled = false;
        setOpenAllButtonsDisabled(false);
        setProcessCompleteButtonsDisabled(false);
        setSelectedDocumentsButtonsDisabled(false);
        setContentOpenAllButtonsDisabled(false);
        latestDecisionButton.disabled = false;
        loadButton.textContent = "Atualizar";
      }
    }

    async function loadAllExternalSources(options) {
      if (panel.dataset.loading === "1") return;

      const activeSource = getActiveSource();
      const availableSources = ["autos", "folder", "movements"]
        .map((key) => sources[key])
        .filter((source) => source && source.url);

      if (!availableSources.length) {
        status.textContent = "Nao foi possivel identificar Autos, Pasta ou Andamento PJE nesta pendencia.";
        return;
      }

      saveExternalSourceViewState();
      panel.dataset.loading = "1";
      loadButton.disabled = true;
      setOpenAllButtonsDisabled(true);
      setProcessCompleteButtonsDisabled(true);
      setSelectedDocumentsButtonsDisabled(true);
      setContentOpenAllButtonsDisabled(true);
      latestDecisionButton.disabled = true;
      quickActionButtons.forEach((button) => {
        button.disabled = true;
      });
      loadButton.textContent = "Carregando...";
      contentSearch.style.display = "none";
      contentSearchResults.style.display = "none";
      contentSearchResults.textContent = "";

      let loaded = 0;
      const failures = [];

      try {
        for (const source of availableSources) {
          status.textContent = "Carregando " + (source.shortLabel || source.label || "fonte") + "...";
          try {
            await loadExternalSourceIntoCache(source, { force: true });
            loaded += 1;
          } catch (error) {
            failures.push((source.shortLabel || source.label || "fonte") + ": " + (error && error.message ? error.message : error));
          }
          await sleep(80);
        }

        const activeCache = getSourceCache(activeSource.key);
        if (activeCache.loaded) {
          renderExternalSourceFromCache(
            activeSource,
            activeCache,
            "Carregamento concluido: " +
              loaded +
              "/" +
              availableSources.length +
              " fonte(s)" +
              (failures.length ? ". Falhas: " + failures.join(" | ") : ".")
          );
        } else {
          resetExternalDocumentSourceView();
          status.textContent =
            "Carregamento concluido: " +
            loaded +
            "/" +
            availableSources.length +
            " fonte(s)" +
            (failures.length ? ". Falhas: " + failures.join(" | ") : ".");
        }
      } finally {
        panel.dataset.loading = "0";
        loadButton.disabled = false;
        setOpenAllButtonsDisabled(false);
        setProcessCompleteButtonsDisabled(false);
        setSelectedDocumentsButtonsDisabled(false);
        setContentOpenAllButtonsDisabled(false);
        latestDecisionButton.disabled = false;
        quickActionButtons.forEach((button) => {
          button.disabled = false;
        });
        loadButton.textContent = "Atualizar";
      }
    }

    Object.keys(sourceInputs).forEach((key) => {
      sourceInputs[key].addEventListener("change", () => {
        if (!sourceInputs[key].checked) return;
        saveExternalSourceViewState();
        panel.dataset.source = key;
        resetExternalDocumentSourceView();
        if (!getSourceCache(key).loaded) loadActiveExternalSource();
      });
    });

    resetExternalDocumentSourceView();
    setTimeout(() => loadAllExternalSources({ force: false }), 0);

    filterButton.addEventListener("click", (event) => {
      event.stopPropagation();
      filterMenu.hidden = !filterMenu.hidden;
    });

    filterMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    Object.keys(quickFilterInputs).forEach((id) => {
      quickFilterInputs[id].addEventListener("change", () => {
        if (quickFilterInputs[id].checked) selectedQuickFilters.add(id);
        else selectedQuickFilters.delete(id);
        updateQuickFilterButtonLabel();
        renderActiveExternalSourceWithFilters();
      });
    });

    clearQuickFiltersButton.addEventListener("click", () => {
      selectedQuickFilters.clear();
      Object.keys(quickFilterInputs).forEach((id) => {
        quickFilterInputs[id].checked = false;
      });
      updateQuickFilterButtonLabel();
      renderActiveExternalSourceWithFilters();
    });

    body.addEventListener("click", (event) => {
      if (filterWrap.contains(event.target)) return;
      if (processCompleteWrap.contains(event.target)) return;
      if (openAllWrap.contains(event.target)) return;
      if (selectedWrap.contains(event.target)) return;
      if (contentOpenAllWrap.contains(event.target)) return;
      filterMenu.hidden = true;
      processCompleteMenu.hidden = true;
      openAllMenu.hidden = true;
      selectedMenu.hidden = true;
      contentOpenAllMenu.hidden = true;
      resetProcessCompleteMenuChoice();
      resetOpenAllMenuChoice();
      resetSelectedDocumentsMenuChoice();
      resetContentOpenAllMenuChoice();
    });

    loadButton.addEventListener("click", () => {
      loadAllExternalSources({ force: true });
    });

    openAllButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de abrir os itens filtrados.";
        return;
      }

      filterMenu.hidden = true;
      processCompleteMenu.hidden = true;
      selectedMenu.hidden = true;
      contentOpenAllMenu.hidden = true;
      resetProcessCompleteMenuChoice();
      resetSelectedDocumentsMenuChoice();
      resetContentOpenAllMenuChoice();
      const shouldOpen = openAllMenu.hidden;
      openAllMenu.hidden = !shouldOpen;
      if (shouldOpen) resetOpenAllMenuChoice();
    });

    openAllMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    selectedButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de abrir os itens selecionados.";
        return;
      }

      if (!selectedExternalDocumentsFromPanel(panel).length) {
        status.textContent = "Marque ao menos um PDF nos autos para usar esta opcao.";
        return;
      }

      filterMenu.hidden = true;
      openAllMenu.hidden = true;
      processCompleteMenu.hidden = true;
      contentOpenAllMenu.hidden = true;
      resetOpenAllMenuChoice();
      resetProcessCompleteMenuChoice();
      resetContentOpenAllMenuChoice();
      const shouldOpen = selectedMenu.hidden;
      selectedMenu.hidden = !shouldOpen;
      if (shouldOpen) resetSelectedDocumentsMenuChoice();
    });

    selectedMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    contentOpenAllButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1" || panel.dataset.contentSearching === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de abrir os resultados.";
        return;
      }

      if (!Array.isArray(panel._contentSearchHits) || !panel._contentSearchHits.some(isExternalDocumentSelectable)) {
        contentSearchProgress.textContent = "Pesquise dentro dos PDFs antes de usar Abrir todos.";
        return;
      }

      filterMenu.hidden = true;
      openAllMenu.hidden = true;
      processCompleteMenu.hidden = true;
      selectedMenu.hidden = true;
      resetOpenAllMenuChoice();
      resetProcessCompleteMenuChoice();
      resetSelectedDocumentsMenuChoice();
      const shouldOpen = contentOpenAllMenu.hidden;
      contentOpenAllMenu.hidden = !shouldOpen;
      if (shouldOpen) resetContentOpenAllMenuChoice();
    });

    contentOpenAllMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    processCompleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de gerar o Processo Completo.";
        return;
      }

      filterMenu.hidden = true;
      openAllMenu.hidden = true;
      selectedMenu.hidden = true;
      contentOpenAllMenu.hidden = true;
      resetOpenAllMenuChoice();
      resetSelectedDocumentsMenuChoice();
      resetContentOpenAllMenuChoice();
      const shouldOpen = processCompleteMenu.hidden;
      processCompleteMenu.hidden = !shouldOpen;
      if (shouldOpen) resetProcessCompleteMenuChoice();
    });

    processCompleteMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    function runProcessCompleteMode(mode, order, triggerButton) {
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de gerar o Processo Completo.";
        return;
      }

      processCompleteMenu.hidden = true;
      resetProcessCompleteMenuChoice();
      const autosCache = getSourceCache("autos");
      openCompleteAutosPdfFromPanel(sources.autos, status, triggerButton, autosCache.items, processNumber, mode, order);
    }

    function runOpenAllMode(mode, order, triggerButton) {
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de abrir os itens filtrados.";
        return;
      }

      openAllMenu.hidden = true;
      resetOpenAllMenuChoice();
      openAllFilteredExternalDocuments(mode, order, triggerButton);
    }

    function runSelectedDocumentsMode(mode, order, triggerButton) {
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de abrir os itens selecionados.";
        return;
      }

      selectedMenu.hidden = true;
      resetSelectedDocumentsMenuChoice();
      openSelectedExternalDocuments(mode, order, triggerButton);
    }

    function runContentOpenAllMode(mode, order, triggerButton) {
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1" || panel.dataset.contentSearching === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de abrir os resultados.";
        return;
      }

      contentOpenAllMenu.hidden = true;
      resetContentOpenAllMenuChoice();
      openContentSearchResults(mode, order, triggerButton);
    }

    processUnifiedButton.addEventListener("click", () => {
      selectProcessCompleteMode("merged", processUnifiedButton);
    });

    processSeparateButton.addEventListener("click", () => {
      selectProcessCompleteMode("separate", processSeparateButton);
    });

    processAscButton.addEventListener("click", () => {
      if (!processCompleteSelectedMode) {
        status.textContent = "Escolha Unificado ou Separado primeiro.";
        return;
      }
      runProcessCompleteMode(processCompleteSelectedMode, "asc", processAscButton);
    });

    processDescButton.addEventListener("click", () => {
      if (!processCompleteSelectedMode) {
        status.textContent = "Escolha Unificado ou Separado primeiro.";
        return;
      }
      runProcessCompleteMode(processCompleteSelectedMode, "desc", processDescButton);
    });

    openAllUnifiedButton.addEventListener("click", () => {
      selectOpenAllMode("merged", openAllUnifiedButton);
    });

    openAllSeparateButton.addEventListener("click", () => {
      selectOpenAllMode("separate", openAllSeparateButton);
    });

    openAllAscButton.addEventListener("click", () => {
      if (!openAllSelectedMode) {
        status.textContent = "Escolha Unificado ou Separado primeiro.";
        return;
      }
      runOpenAllMode(openAllSelectedMode, "asc", openAllAscButton);
    });

    openAllDescButton.addEventListener("click", () => {
      if (!openAllSelectedMode) {
        status.textContent = "Escolha Unificado ou Separado primeiro.";
        return;
      }
      runOpenAllMode(openAllSelectedMode, "desc", openAllDescButton);
    });

    selectedUnifiedButton.addEventListener("click", () => {
      selectSelectedDocumentsMode("merged", selectedUnifiedButton);
    });

    selectedSeparateButton.addEventListener("click", () => {
      selectSelectedDocumentsMode("separate", selectedSeparateButton);
    });

    selectedAscButton.addEventListener("click", () => {
      if (!selectedDocumentsSelectedMode) {
        status.textContent = "Escolha Unificado ou Separado primeiro.";
        return;
      }
      runSelectedDocumentsMode(selectedDocumentsSelectedMode, "asc", selectedAscButton);
    });

    selectedDescButton.addEventListener("click", () => {
      if (!selectedDocumentsSelectedMode) {
        status.textContent = "Escolha Unificado ou Separado primeiro.";
        return;
      }
      runSelectedDocumentsMode(selectedDocumentsSelectedMode, "desc", selectedDescButton);
    });

    contentOpenAllUnifiedButton.addEventListener("click", () => {
      selectContentOpenAllMode("merged", contentOpenAllUnifiedButton);
    });

    contentOpenAllSeparateButton.addEventListener("click", () => {
      selectContentOpenAllMode("separate", contentOpenAllSeparateButton);
    });

    contentOpenAllAscButton.addEventListener("click", () => {
      if (!contentOpenAllSelectedMode) {
        contentSearchProgress.textContent = "Escolha Unificado ou Separado primeiro.";
        return;
      }
      runContentOpenAllMode(contentOpenAllSelectedMode, "asc", contentOpenAllAscButton);
    });

    contentOpenAllDescButton.addEventListener("click", () => {
      if (!contentOpenAllSelectedMode) {
        contentSearchProgress.textContent = "Escolha Unificado ou Separado primeiro.";
        return;
      }
      runContentOpenAllMode(contentOpenAllSelectedMode, "desc", contentOpenAllDescButton);
    });

    latestDecisionButton.addEventListener("click", async () => {
      if (panel.dataset.loading === "1" || panel.dataset.openingAll === "1") {
        status.textContent = "Aguarde a acao atual terminar antes de abrir a ultima decisao.";
        return;
      }

      latestDecisionButton.disabled = true;
      try {
        await openLatestDecisionMovement();
      } catch (error) {
        status.textContent = "Erro ao abrir ultima decisao: " + (error && error.message ? error.message : error);
      } finally {
        latestDecisionButton.disabled = false;
      }
    });

    search.addEventListener("input", () => {
      const source = getActiveSource();
      const cache = getSourceCache(source.key);
      cache.filterText = search.value || "";
      renderActiveExternalSourceWithFilters();
    });

    exactSearchInput.addEventListener("change", () => {
      renderActiveExternalSourceWithFilters();
    });

    pgeStateInput.addEventListener("change", () => {
      renderActiveExternalSourceWithFilters();
    });

    contentSearchInput.addEventListener("input", () => {
      const source = getActiveSource();
      getSourceCache(source.key).contentQuery = contentSearchInput.value || "";
    });

    contentSearchButton.addEventListener("click", () => {
      runExternalDocumentContentSearch(panel, contentSearchInput.value, {
        button: contentSearchButton,
        stopButton: contentSearchStopButton,
        progress: contentSearchProgress,
        results: contentSearchResults,
        summaryFilterValue: () => search.value,
        summaryFilterOptions: () => getExternalSummaryFilterOptions(),
        exactSearch: () => exactSearchInput.checked,
        stopOnFirst: () => contentSearchStopOnFirst.checked,
        concurrencyValue: () => normalizeLimit(contentSearchConcurrency.value),
        onResultsChanged: () => refreshExternalDocumentSelectionControls(),
      });
    });

    contentSearchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      contentSearchButton.click();
    });

    contentSearchStopButton.addEventListener("click", () => {
      panel._contentSearchStopped = true;
      contentSearchStopButton.disabled = true;
      contentSearchStopButton.textContent = "Parando...";
      setTimeout(() => {
        contentSearchStopButton.textContent = "Parar";
      }, 700);
    });

    function setExternalDocumentsCollapsed(collapsed) {
      panel.classList.toggle("spa-cdsp-external-docs-collapsed", Boolean(collapsed));
      toggleButton.textContent = collapsed ? "Expandir" : "Recolher";
    }

    setExternalDocumentsCollapsed(storageGetBool(EXTERNAL_DOCS_OPEN_MINIMIZED_KEY));

    minimizedMemoryInput.addEventListener("change", () => {
      storageSetBool(EXTERNAL_DOCS_OPEN_MINIMIZED_KEY, minimizedMemoryInput.checked);
    });

    toggleButton.addEventListener("click", () => {
      const collapsed = !panel.classList.contains("spa-cdsp-external-docs-collapsed");
      setExternalDocumentsCollapsed(collapsed);
    });

    body.appendChild(sourceSwitcher);
    body.appendChild(status);
    body.appendChild(searchRow);
    body.appendChild(contentSearch);
    body.appendChild(viewer);

    panel.appendChild(header);
    panel.appendChild(body);
    return panel;
  }

  function refreshExternalDocumentsPanel() {
    const existingPanel = document.querySelector("#spa-cdsp-external-docs-panel");

    if (!isProcedureDetailPage()) {
      if (existingPanel) existingPanel.remove();
      return;
    }

    const processNumber = readCurrentProcedureProcessNumber();
    const sources = buildExternalDocumentSources();
    const sourceSignature = getExternalDocumentSourceSignature(sources);
    const host = findExternalDocumentsHost();

    if (!sourceSignature.replace(/\|/g, "") || !host) {
      if (existingPanel) existingPanel.remove();
      return;
    }

    if (existingPanel && existingPanel.dataset.processNumber === processNumber && existingPanel.dataset.sourcesSignature === sourceSignature) return;
    if (existingPanel) existingPanel.remove();

    injectExternalDocumentsStyles();
    host.appendChild(createExternalDocumentsPanel(sources, processNumber));
  }

  function setupExternalDocumentsPanel() {
    refreshExternalDocumentsPanel();

    setTimeout(refreshExternalDocumentsPanel, 600);
    setTimeout(refreshExternalDocumentsPanel, 1800);

    if (!window.SPA_CDSP_EXTERNAL_DOCS_ROUTE_WATCHER_STARTED) {
      window.SPA_CDSP_EXTERNAL_DOCS_ROUTE_WATCHER_STARTED = true;
      let lastHref = window.location.href;
      const scheduleRouteRefresh = () => {
        setTimeout(refreshExternalDocumentsPanel, 120);
        setTimeout(refreshExternalDocumentsPanel, 700);
      };
      ["pushState", "replaceState"].forEach((methodName) => {
        const original = window.history && window.history[methodName];
        if (typeof original !== "function") return;
        window.history[methodName] = function patchedHistoryMethod() {
          const result = original.apply(this, arguments);
          scheduleRouteRefresh();
          return result;
        };
      });
      window.addEventListener("popstate", scheduleRouteRefresh);
      window.addEventListener("hashchange", scheduleRouteRefresh);
      window.setInterval(() => {
        const href = window.location.href;
        const hasPanel = Boolean(document.querySelector("#spa-cdsp-external-docs-panel"));
        if (href !== lastHref || (hasPanel && !isProcedureDetailPage())) {
          lastHref = href;
          refreshExternalDocumentsPanel();
        }
      }, 1500);
    }

    if (window.SPA_CDSP_EXTERNAL_DOCS_OBSERVER_STARTED) return;
    window.SPA_CDSP_EXTERNAL_DOCS_OBSERVER_STARTED = true;

    let debounceId = null;
    const observer = new MutationObserver(() => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(refreshExternalDocumentsPanel, 350);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function waitProcessingDone() {
    const started = Date.now();
    let nextProgressLog = CONFIG.processingProgressLogMs;

    while (!state.stopped) {
      const processing = document.querySelector("#procedures-box_processing");
      const visible =
        processing &&
        window.getComputedStyle(processing).display !== "none" &&
        window.getComputedStyle(processing).visibility !== "hidden";
      if (!visible) return;

      const elapsed = Date.now() - started;
      if (CONFIG.processingTimeoutMs && elapsed > CONFIG.processingTimeoutMs) {
        log("Tempo de espera excedido aguardando carregamento da tabela. O fluxo seguira com os dados disponiveis.", "error");
        return;
      }

      if (CONFIG.processingProgressLogMs && elapsed >= nextProgressLog) {
        log(
          "Ainda aguardando o carregamento da tabela (" +
            Math.round(elapsed / 1000) +
            "s). Use Encerrar se quiser parar."
        );
        nextProgressLog += CONFIG.processingProgressLogMs;
      }

      await sleep(250);
    }
  }

  function findSearchInputForColumn(columnName) {
    const wanted = normalizeText(columnName).toLowerCase();
    const inputs = Array.from(document.querySelectorAll("input.search-by-column"));

    for (const input of inputs) {
      const name = input.getAttribute("name") || "";
      const match = name.match(/^search_by_column\[(.*)\]$/);
      const actual = match ? match[1] : "";
      if (normalizeText(actual).toLowerCase() === wanted) return input;
    }

    const headers = Array.from(document.querySelectorAll("#procedures-box th[data-name]"));
    const header = headers.find(
      (item) => normalizeText(item.getAttribute("data-name")).toLowerCase() === wanted
    );
    if (!header) return null;

    const exactName = header.getAttribute("data-name");
    return inputs.find((input) => (input.getAttribute("name") || "") === "search_by_column[" + exactName + "]");
  }

  async function applyDateFilterIfNeeded() {
    const filter = currentDateFilter();
    if (!filter) return;

    for (const columnName of CONFIG.dateFilter.columnNames) {
      const input = findSearchInputForColumn(columnName);
      if (!input) continue;

      const value = filter.values.join("|");
      if (input.value !== value) {
        log("Aplicando filtro de data em '" + columnName + "': " + filter.date + ".");
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(CONFIG.delayPageMs);
        await waitProcessingDone();
      } else {
        log("Filtro de data ja aplicado: " + filter.date + ".");
      }
      return;
    }

    log("Filtro nativo de data nao encontrado. Usarei filtro por linha: " + filter.date + ".");
  }

  async function setPageLength() {
    const dt = getDataTable();
    const current = dt.page.len();
    if (current !== CONFIG.pageLength) {
      log("Alterando paginacao para " + CONFIG.pageLength + ".");
      dt.page.len(CONFIG.pageLength).draw(false);
      await sleep(CONFIG.delayPageMs);
      await waitProcessingDone();
    }

    const select = document.querySelector("select[name='procedures-box_length']");
    if (select && String(select.value) !== String(CONFIG.pageLength)) {
      select.value = String(CONFIG.pageLength);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(CONFIG.delayPageMs);
      await waitProcessingDone();
    }
  }

  async function expandGroupsIfPresent() {
    const button = document.querySelector("#expand-all-groups");
    if (!button) return;

    button.click();
    await sleep(700);
    await waitProcessingDone();
  }

  async function goFirstPage() {
    const dt = getDataTable();
    if (dt.page.info().page !== 0) {
      log("Voltando para a primeira pagina.");
      dt.page("first").draw("page");
      await sleep(CONFIG.delayPageMs);
      await waitProcessingDone();
    }
  }

  async function goNextPage() {
    const dt = getDataTable();
    const info = dt.page.info();
    if (info.page >= info.pages - 1) return false;
    log("Indo para a proxima pagina.");
    dt.page("next").draw("page");
    await sleep(CONFIG.delayPageMs);
    await waitProcessingDone();
    return true;
  }

  function tablePageInfo() {
    const info = getDataTable().page.info();
    const total = Math.max(1, normalizeLimit(info.pages) || 1);
    const current = Math.min(total, Math.max(1, normalizeLimit(info.page + 1) || 1));
    return {
      current: current,
      total: total,
    };
  }

  function allPageNumbers(totalPages) {
    const total = Math.max(1, normalizeLimit(totalPages) || 1);
    const pages = [];
    for (let page = 1; page <= total; page += 1) pages.push(page);
    return pages;
  }

  function normalizePageNumbers(values, totalPages) {
    const total = Math.max(1, normalizeLimit(totalPages) || 1);
    const seen = new Set();
    const pages = [];

    (values || []).forEach((value) => {
      const page = normalizeLimit(value);
      if (!page || page > total || seen.has(page)) return;
      seen.add(page);
      pages.push(page);
    });

    pages.sort((a, b) => a - b);
    return pages;
  }

  function storedPageSelection() {
    return String(storageGet("SPA_CDSP_SELECTED_PAGES", ""))
      .split(",")
      .map((value) => normalizeLimit(value))
      .filter(Boolean);
  }

  function persistPageSelection() {
    storageSet(
      "SPA_CDSP_SELECTED_PAGES",
      Array.from(state.selectedPages)
        .sort((a, b) => a - b)
        .join(",")
    );
  }

  function loadStoredPageSelection(totalPages) {
    state.selectedPages = new Set(normalizePageNumbers(storedPageSelection(), totalPages));
    state.pageSelectionLoaded = true;
    persistPageSelection();
  }

  function ensurePageSelectionLoaded(totalPages) {
    if (!state.pageSelectionLoaded) loadStoredPageSelection(totalPages);
  }

  function selectedPageNumbers(totalPages) {
    return normalizePageNumbers(Array.from(state.selectedPages), totalPages);
  }

  function targetPageNumbers(totalPages) {
    const selected = selectedPageNumbers(totalPages);
    return selected.length ? selected : allPageNumbers(totalPages);
  }

  function pageListLabel(pages) {
    if (!pages || !pages.length) return "todas";
    return pages.join(", ");
  }

  function logPageScope(pages, totalPages) {
    const selected = selectedPageNumbers(totalPages);
    if (state.pageBatch) {
      log("Lote ativo: usando paginas " + pageListLabel(state.pageBatch.selectedPages) + ".");
    } else if (selected.length) {
      log("Paginas selecionadas: " + pageListLabel(selected) + ".");
    } else {
      log("Nenhuma pagina selecionada: a acao usara todas as paginas.");
    }
  }

  async function goToPageNumber(pageNumber) {
    const dt = getDataTable();
    const info = dt.page.info();
    const total = Math.max(1, normalizeLimit(info.pages) || 1);
    const targetPage = Math.min(total, Math.max(1, normalizeLimit(pageNumber) || 1));
    const targetIndex = targetPage - 1;

    if (info.page !== targetIndex) {
      log("Indo para a pagina " + targetPage + ".");
      dt.page(targetIndex).draw("page");
      await sleep(CONFIG.delayPageMs);
      await waitProcessingDone();
    }

    return targetPage;
  }

  async function softRefreshProcedures() {
    const dt = getDataTable();
    let refreshed = false;

    if (dt.ajax && typeof dt.ajax.reload === "function") {
      try {
        log("Atualizando a lista interna do SPA, sem recarregar a aba.");
        dt.ajax.reload(null, false);
        refreshed = true;
      } catch (error) {
        log("Atualizacao interna por AJAX falhou. Tentando redesenhar a tabela: " + error.message);
      }
    }

    if (!refreshed) {
      log("Redesenhando a tabela do SPA, sem recarregar a aba.");
      dt.draw(false);
    }

    await sleep(CONFIG.delayPageMs);
    await waitProcessingDone();
    await setPageLength();
    await applyDateFilterIfNeeded();
    await expandGroupsIfPresent();
    log("Lista atualizada. O painel continua carregado.", "ok");
  }

  async function refreshProceduresTable() {
    guardStart();
    try {
      setStatus("Atualizando lista...");
      await softRefreshProcedures();
      setStatus("Lista atualizada");
    } catch (error) {
      log("Erro ao atualizar a lista: " + error.message, "error");
      setStatus("Erro ao atualizar");
    } finally {
      state.running = false;
    }
  }

  function visibleRows() {
    const $ = ensureJquery();
    return $(CONFIG.rowSelector).toArray();
  }

  function rows() {
    return visibleRows().filter(rowMatchesAllFilters);
  }

  function getRowGroup(row) {
    let previous = row.previousElementSibling;
    while (previous && previous.classList.contains("group-item")) {
      previous = previous.previousElementSibling;
    }
    return previous && previous.classList.contains("group-row") ? previous : null;
  }

  function rowGroupText(row) {
    const group = getRowGroup(row);
    if (!group) return "";
    return (group.textContent || "") + " " + (group.getAttribute("data-group") || "");
  }

  function findColumnIndex(normalizedNames) {
    const wanted = normalizedNames.map((name) => normalizeText(name).toLowerCase());
    const headerRow =
      document.querySelector("#procedures-box thead tr.dt-header") ||
      document.querySelector("#procedures-box thead tr:last-child");
    const headers = headerRow
      ? Array.from(headerRow.children)
      : Array.from(document.querySelectorAll("#procedures-box th"));

    function headerLabels(header) {
      const labels = [
        header.getAttribute("data-name"),
        header.getAttribute("aria-label"),
        header.getAttribute("title"),
        header.textContent,
      ]
        .map((value) => normalizeText(value).toLowerCase().replace(/:\s*ordenar.*$/, ""))
        .filter(Boolean);

      return labels.filter((label, index) => labels.indexOf(label) === index);
    }

    function headerIndex(header) {
      const index = parseInt(header.getAttribute("data-index"), 10);
      if (Number.isFinite(index)) return index;

      const siblings = header.parentElement ? Array.from(header.parentElement.children) : headers;
      const position = siblings.indexOf(header);
      return position >= 0 ? position : -1;
    }

    for (const header of headers) {
      const labels = headerLabels(header);
      if (!labels.some((label) => wanted.indexOf(label) >= 0)) continue;

      const index = headerIndex(header);
      if (index >= 0) return index;
    }

    for (const header of headers) {
      const labels = headerLabels(header);
      if (
        !labels.some((label) =>
          wanted.some((name) => label.indexOf(name) >= 0 || name.indexOf(label) >= 0)
        )
      ) {
        continue;
      }

      const index = headerIndex(header);
      if (index >= 0) return index;
    }

    return -1;
  }

  function elementFullText(element) {
    const pieces = [];
    if (!element) return "";

    function pushPiece(value) {
      const text = String(value || "").trim();
      const normalized = normalizeText(text);
      if (!normalized) return;
      if (pieces.some((piece) => normalizeText(piece) === normalized)) return;
      pieces.push(text);
    }

    element.querySelectorAll("span[data-full-text], [data-full-text]").forEach((child) => {
      pushPiece(child.getAttribute("data-full-text") || child.textContent || "");
    });
    pushPiece(element.getAttribute("data-full-text") || element.textContent || "");
    return pieces.join(" ");
  }

  function rowColumnText(row, normalizedNames) {
    const index = findColumnIndex(normalizedNames);
    if (index < 0 || !row.children[index]) return "";
    return elementFullText(row.children[index]);
  }

  function rowSearchText(row) {
    const pieces = [];
    row.querySelectorAll("span[data-full-text], td").forEach((element) => {
      pieces.push(element.getAttribute("data-full-text") || element.textContent || "");
    });
    pieces.push(rowGroupText(row));
    return pieces.join(" ");
  }

  function rowTextForDate(row) {
    return rowSearchText(row);
  }

  function rowMatchesDateFilter(row) {
    const filter = currentDateFilter();
    if (!filter) return true;

    const text = rowTextForDate(row);
    const normalized = normalizeText(text);
    const hyphen = filter.date.replace(/\//g, "-");
    const groupKey = filter.date.replace(/\//g, "-") + "---00-00";
    const reversedGroupKey = filter.date.split("/").join("-");

    return (
      normalized.indexOf(filter.date) >= 0 ||
      normalized.indexOf(hyphen) >= 0 ||
      normalized.indexOf(groupKey) >= 0 ||
      normalized.indexOf(reversedGroupKey) >= 0
    );
  }

  function textHasGrau(text, grau) {
    return inferGrauFromText(text) === String(grau || "");
  }

  function inferGrauFromText(text) {
    const normalized = normalizeText(text).toLowerCase().replace(/a[º°]/g, "o").replace(/[º°]/g, "o");
    const compact = normalized.replace(/[^a-z0-9]+/g, "");

    if (/(^|[^0-9])1\s*o?\s*grau(\b|$)/.test(normalized) || compact.indexOf("1grau") >= 0 || compact.indexOf("1ograu") >= 0 || compact.indexOf("primeirograu") >= 0) {
      return "1";
    }

    if (/(^|[^0-9])2\s*o?\s*grau(\b|$)/.test(normalized) || compact.indexOf("2grau") >= 0 || compact.indexOf("2ograu") >= 0 || compact.indexOf("segundograu") >= 0) {
      return "2";
    }

    return "";
  }

  function rowTribunalText(row) {
    return [
      rowColumnText(row, ["tribunal"]),
      rowGroupText(row),
    ]
      .filter(Boolean)
      .join(" ");
  }

  function rowDeadlineElement(row) {
    const deadlineIndex = findColumnIndex(["deadline"]);
    const cell = deadlineIndex >= 0 ? row.children[deadlineIndex] : null;
    if (!cell) return null;
    return (
      cell.querySelector("[class*='deadline-procedure-'] a.badge") ||
      cell.querySelector("a.badge[href*='calendars'], span.badge, a.badge, .btn-danger, .btn-warning, .btn-primary")
    );
  }

  function deadlineText(row, element) {
    const cellIndex = findColumnIndex(["deadline"]);
    const cell = cellIndex >= 0 ? row.children[cellIndex] : null;
    return [
      element ? element.textContent || "" : "",
      element ? element.getAttribute("data-content") || "" : "",
      element ? element.getAttribute("data-original-title") || "" : "",
      cell ? cell.textContent || "" : "",
    ].join(" ");
  }

  function parseDeadlineDate(text) {
    const normalized = normalizeText(text);
    const specific = normalized.match(/Prazo para manifestacao:\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{2}):(\d{2}))?/i);
    const generic = normalized.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{2}):(\d{2}))?/);
    const match = specific || generic;
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hour = parseInt(match[4] || "23", 10);
    const minute = parseInt(match[5] || "59", 10);
    return new Date(year, month, day, hour, minute, 0, 0);
  }

  function rowDeadlineStatus(row) {
    const element = rowDeadlineElement(row);
    if (!element) return "none";

    const classes = String(element.className || "").toLowerCase();
    if (classes.indexOf("danger") >= 0) return "late";
    if (classes.indexOf("warning") >= 0) return "short";
    if (
      classes.indexOf("primary") >= 0 ||
      classes.indexOf("info") >= 0 ||
      classes.indexOf("success") >= 0
    ) {
      return "long";
    }

    const due = parseDeadlineDate(deadlineText(row, element));
    if (due && due.getTime() < Date.now()) return "late";
    return "";
  }

  function rowMatchesCustomFilters(row) {
    const filters = currentCustomFilters();
    if (!hasCustomFilters(filters)) return true;

    const tribunalText = rowColumnText(row, [CONFIG.filters.tribunalColumn]) + " " + rowGroupText(row);
    if (filters.tribunal1 || filters.tribunal2) {
      const matchesTribunal =
        (filters.tribunal1 && textHasGrau(tribunalText, "1")) ||
        (filters.tribunal2 && textHasGrau(tribunalText, "2"));
      if (!matchesTribunal) return false;
    }

    if (filters.cejusc) {
      const jurisdictionText =
        rowColumnText(row, [CONFIG.filters.jurisdictionColumn]) || rowSearchText(row);
      if (normalizeText(jurisdictionText).toUpperCase().indexOf(CONFIG.filters.cejuscText) < 0) {
        return false;
      }
    }

    if (
      filters.deadlineStatuses.length &&
      filters.deadlineStatuses.indexOf(rowDeadlineStatus(row)) < 0
    ) {
      return false;
    }

    return true;
  }

  function rowMatchesAllFilters(row) {
    return rowMatchesDateFilter(row) && rowMatchesCustomFilters(row);
  }

  function rowInfo(row) {
    const checkbox = row.querySelector("input.procedure-inbox-checkbox[value], input[name^='procedure_inbox_']");
    const id = row.getAttribute("data-procedure-id") || (checkbox ? checkbox.value : "");
    const first = row.querySelector("td.cursor-pointer span[data-full-text]");
    const assunto = first ? first.getAttribute("data-full-text") || first.textContent.trim() : "";
    return { id, assunto };
  }

  function activateScience(row) {
    const target =
      row.querySelector(CONFIG.scienceSelector) ||
      row.querySelector(CONFIG.scienceFallbackSelector);

    if (!target) return false;

    const tag = target.tagName.toLowerCase();
    if (tag === "form") {
      const clickable = target.querySelector("button, input[type='submit'], a");
      if (clickable) {
        clickable.click();
        return true;
      }
      if (target.requestSubmit) {
        target.requestSubmit();
        return true;
      }
      return false;
    }

    target.click();
    return true;
  }

  function rowHasScienceButton(row) {
    return Boolean(
      row &&
        (row.querySelector(CONFIG.scienceSelector) ||
          row.querySelector(CONFIG.scienceFallbackSelector))
    );
  }

  function scienceRecordFromRow(row, processKey, label) {
    const info = rowInfo(row);
    return {
      processKey: processKey || rowProcessNumber(row),
      rowKey: rowProcedureKey(row),
      expedienteId: rowExpedienteId(row),
      label: info.id || info.assunto || label || rowProcedureKey(row) || rowProcessNumber(row),
    };
  }

  function scienceRecordKey(record) {
    return (
      normalizeText(record && record.rowKey) ||
      normalizeText(record && record.expedienteId) ||
      normalizeText(record && record.label) ||
      normalizeText(record && record.processKey)
    );
  }

  function findRowForScienceRecord(record) {
    const candidates = rows();
    const wantedRowKey = normalizeText(record && record.rowKey);
    const wantedExpedienteId = normalizeText(record && record.expedienteId);
    const wantedProcessKey = normalizeText(record && record.processKey);

    if (wantedRowKey) {
      const row = candidates.find((candidate) => normalizeText(rowProcedureKey(candidate)) === wantedRowKey);
      if (row) return row;
    }

    if (wantedExpedienteId) {
      const row = candidates.find((candidate) => normalizeText(rowExpedienteId(candidate)) === wantedExpedienteId);
      if (row) return row;
    }

    if (wantedProcessKey) {
      const matching = candidates.filter((candidate) => normalizeText(rowProcessNumber(candidate)) === wantedProcessKey);
      if (matching.length === 1) return matching[0];
    }

    return null;
  }

  function uniqueScienceRecords(records) {
    const seen = new Set();
    const unique = [];

    (records || []).forEach((record) => {
      const key = scienceRecordKey(record);
      if (key && seen.has(key)) return;
      if (key) seen.add(key);
      unique.push(record);
    });

    return unique;
  }

  function pendingScienceRecords(records) {
    return uniqueScienceRecords(records).filter((record) => {
      const row = findRowForScienceRecord(record);
      return Boolean(row && rowHasScienceButton(row));
    });
  }

  async function retryPendingScienceRecords(records, contextLabel) {
    let pending = pendingScienceRecords(records);
    let recovered = 0;
    const rounds = Math.max(1, normalizeLimit(CONFIG.scienceVerificationRounds) || 1);

    for (let round = 1; round <= rounds && pending.length && !state.stopped; round += 1) {
      log(
        "Conferencia de ciencia " +
          (contextLabel || "") +
          ": " +
          pending.length +
          " pendencia(s) ainda com botao. Tentativa " +
          round +
          "/" +
          rounds +
          "."
      );

      const attemptedAgain = [];
      for (const record of pending) {
        if (state.stopped) break;

        const row = findRowForScienceRecord(record);
        if (!row || !rowHasScienceButton(row)) continue;

        if (activateScience(row)) {
          attemptedAgain.push(record);
          log("Reforco de ciencia acionado: " + record.label + ".", "ok");
          await sleep(CONFIG.delayScienceMs);
          await waitProcessingDone();
        }
      }

      if (CONFIG.scienceVerificationDelayMs) {
        await sleep(CONFIG.scienceVerificationDelayMs);
        await waitProcessingDone();
      }

      const nextPending = pendingScienceRecords(pending);
      const solved = pending.length - nextPending.length;
      if (solved > 0) recovered += solved;
      if (!attemptedAgain.length && nextPending.length === pending.length) break;
      pending = nextPending;
    }

    if (pending.length) {
      pending.slice(0, 8).forEach((record) => {
        log("Ciencia ainda pendente apos conferencia: " + record.label + ".", "error");
      });
      if (pending.length > 8) {
        log("Outras " + (pending.length - 8) + " ciencia(s) seguem pendentes.", "error");
      }
    } else if (records && records.length) {
      log("Conferencia de ciencia concluida sem pendencias" + (contextLabel ? " (" + contextLabel + ")" : "") + ".", "ok");
    }

    return {
      pending: pending,
      recovered: recovered,
    };
  }

  function extractProcessNumber(text) {
    const match = normalizeText(text).match(/\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}/);
    return match ? match[0] : "";
  }

  function rowProcessNumber(row) {
    return (
      extractProcessNumber(rowGroupText(row)) ||
      extractProcessNumber(rowColumnText(row, ["numero do processo", "processo"])) ||
      extractProcessNumber(rowSearchText(row)) ||
      rowProcedureKey(row)
    );
  }

  function rowsByProcess(pageRows) {
    const grouped = new Map();

    pageRows.forEach((row) => {
      const key = rowProcessNumber(row);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });

    return Array.from(grouped.entries()).map(([key, processRows]) => ({
      key: key,
      rows: processRows,
    }));
  }

  function processLogLabel(processKey, processRows) {
    if (processKey) return processKey;
    if (!processRows || !processRows.length) return "processo sem identificacao";
    const info = rowInfo(processRows[0]);
    return info.id || info.assunto || "processo sem identificacao";
  }

  function cloneTaskForBatch(task) {
    return {
      kind: task && task.kind ? task.kind : "link",
      label: task && task.label ? task.label : "Aba",
      url: taskUrl(task),
    };
  }

  function cloneOpenPlanForBatch(plan) {
    const tasks = (plan && plan.tasks ? plan.tasks : []).map(cloneTaskForBatch);
    return {
      label: (plan && plan.label) || "linha sem id",
      hasPendencia: Boolean(plan && plan.hasPendencia),
      expedienteCount: normalizeLimit(plan && plan.expedienteCount),
      tasks: tasks,
    };
  }

  function batchRowRecord(row, pageNumber) {
    const info = rowInfo(row);
    const plan = buildOpenPlanForRow(row);
    const processKey = rowProcessNumber(row);
    const rowKey = rowProcedureKey(row);

    return {
      pageNumber: pageNumber,
      processKey: processKey,
      rowKey: rowKey,
      expedienteId: rowExpedienteId(row),
      label: plan.label || info.id || info.assunto || rowKey || processKey || "linha sem id",
      hasEncerrar: rowHasEncerrarMarker(row),
      hasDuplicidadeValidada: rowHasDuplicidadeValidadaMarker(row),
      openPlan: cloneOpenPlanForBatch(plan),
    };
  }

  function batchProcessRecord(processItem, pageNumber) {
    return {
      key: processItem.key,
      label: processLogLabel(processItem.key, processItem.rows),
      pageNumber: pageNumber,
      rows: processItem.rows.map((row) => batchRowRecord(row, pageNumber)),
    };
  }

  async function duplicateBatchGroupsCurrentPage(pageNumber) {
    const groups = groupRows().filter(
      (groupRow) => groupCount(groupRow) > 1 && isDuplicateProcessGroup(groupRow)
    );
    const records = [];

    for (const groupRow of groups) {
      if (state.stopped) break;

      const label = groupLabel(groupRow);
      const processKey = groupProcessNumber(groupRow) || label;
      const items = (await expandGroup(groupRow)).filter(isVisible);
      if (!items.length) continue;

      const hasValidated = groupHasDuplicidadeValidadaMarker(groupRow, items);
      const allValidated = groupAllDuplicidadeValidadaMarker(items);
      const hasSesProcess = groupHasDuplicateReportSesProcess(groupRow, items);
      const uniqueItems = uniqueDuplicateRowsByExpediente(items, label);
      const tasks = duplicateOpenTasksForRows(uniqueItems, label);

      records.push({
        key: processKey,
        label: label,
        pageNumber: pageNumber,
        duplicateCount: groupCount(groupRow),
        hasValidated: hasValidated,
        allValidated: allValidated,
        hasSesProcess: hasSesProcess,
        tasks: tasks,
      });
    }

    return records;
  }

  async function captureCurrentPageBatch(pageNumber) {
    await expandGroupsIfPresent();

    const pageRows = rows();
    const pageProcesses = rowsByProcess(pageRows);
    const duplicateGroups = await duplicateBatchGroupsCurrentPage(pageNumber);

    return {
      pageNumber: pageNumber,
      rows: pageRows.length,
      processes: pageProcesses.map((processItem) => batchProcessRecord(processItem, pageNumber)),
      duplicateGroups: duplicateGroups,
    };
  }

  function batchProcessCount(batch) {
    return (batch && batch.pages ? batch.pages : []).reduce(
      (total, page) => total + (page.processes ? page.processes.length : 0),
      0
    );
  }

  function batchRowCount(batch) {
    return (batch && batch.pages ? batch.pages : []).reduce(
      (total, page) => total + normalizeLimit(page.rows),
      0
    );
  }

  function batchDuplicateGroupCount(batch) {
    return (batch && batch.pages ? batch.pages : []).reduce(
      (total, page) => total + (page.duplicateGroups ? page.duplicateGroups.length : 0),
      0
    );
  }

  function updateBatchStatus() {
    const label = document.querySelector("#spa-cdsp-batch-status");
    if (!label) return;

    if (!state.pageBatch) {
      label.textContent =
        "Lote ativo: nenhum. Sem lote, as acoes usam as paginas marcadas ou todas.";
      label.style.color = "#b0bec5";
      return;
    }

    label.textContent =
      "Lote ativo: paginas " +
      pageListLabel(state.pageBatch.selectedPages) +
      " | " +
      batchProcessCount(state.pageBatch) +
      " processo(s)";
    label.style.color = "#9be7c4";
  }

  function clearPageBatch(silent) {
    state.pageBatch = null;
    updateBatchStatus();
    if (!silent) log("Lote de paginas limpo.");
  }

  function clearPageBatchForScopeChange(reason) {
    if (!state.pageBatch) return;
    clearPageBatch(true);
    log("Lote limpo porque " + reason + ".");
  }

  function findRowForBatchRecord(record) {
    const candidates = visibleRows();
    const wantedRowKey = normalizeText(record && record.rowKey);
    const wantedExpedienteId = normalizeText(record && record.expedienteId);
    const wantedProcessKey = normalizeText(record && record.processKey);

    if (wantedRowKey) {
      const row = candidates.find((candidate) => normalizeText(rowProcedureKey(candidate)) === wantedRowKey);
      if (row) return row;
    }

    if (wantedExpedienteId) {
      const row = candidates.find((candidate) => normalizeText(rowExpedienteId(candidate)) === wantedExpedienteId);
      if (row) return row;
    }

    if (wantedProcessKey) {
      return candidates.find((candidate) => normalizeText(rowProcessNumber(candidate)) === wantedProcessKey) || null;
    }

    return null;
  }

  async function preparePageBatch() {
    guardStart();
    try {
      setStatus("Preparando lote...");
      await setPageLength();
      await applyDateFilterIfNeeded();

      const pageInfo = tablePageInfo();
      loadStoredPageSelection(pageInfo.total);
      updatePageSelectionControls();

      const pages = targetPageNumbers(pageInfo.total);
      logPageScope(pages, pageInfo.total);
      log("Preparando lote das paginas: " + pageListLabel(pages) + ".");

      const batchPages = [];
      for (const pageNumber of pages) {
        if (state.stopped) break;

        await goToPageNumber(pageNumber);
        log("Lendo pagina " + pageNumber + " para o lote.");
        batchPages.push(await captureCurrentPageBatch(pageNumber));
      }

      state.pageBatch = {
        createdAt: new Date().toISOString(),
        pageLength: CONFIG.pageLength,
        totalPages: pageInfo.total,
        selectedPages: pages.slice(),
        pages: batchPages,
      };

      updateBatchStatus();
      log(
        "Lote preparado: " +
          batchProcessCount(state.pageBatch) +
          " processo(s), " +
          batchRowCount(state.pageBatch) +
          " pendencia(s), " +
          batchDuplicateGroupCount(state.pageBatch) +
          " grupo(s) duplicado(s).",
        "ok"
      );
      setStatus("Lote preparado");
    } catch (error) {
      log("Erro ao preparar lote: " + error.message, "error");
      setStatus("Erro no lote");
    } finally {
      state.running = false;
    }
  }

  async function takeScienceCurrentPage(limit, processedProcessKeys) {
    const pageRows = rows();
    const pageProcesses = rowsByProcess(pageRows);
    const seen = processedProcessKeys || new Set();
    let count = 0;
    const attemptedRecords = [];
    log(
      "Linhas visiveis na pagina: " +
        pageRows.length +
        ". Numeros de processo: " +
        pageProcesses.length +
        "."
    );

    for (const processItem of pageProcesses) {
      if (state.stopped) break;
      if (limit && count >= limit) break;
      if (seen.has(processItem.key)) continue;

      seen.add(processItem.key);
      const label = processLogLabel(processItem.key, processItem.rows);
      let processTotal = 0;

      log("Dando ciencia no processo " + label + " (" + processItem.rows.length + " pendencia(s)).");

      for (const row of processItem.rows) {
        if (state.stopped) break;

        const info = rowInfo(row);
        const record = scienceRecordFromRow(row, processItem.key, label);
        const ok = activateScience(row);
        if (ok) {
          processTotal += 1;
          attemptedRecords.push(record);
          log("Ciencia acionada: " + (info.id || info.assunto || label), "ok");
          await sleep(CONFIG.delayScienceMs);
          await waitProcessingDone();
        } else {
          log("Sem botao de ciencia: " + (info.id || info.assunto || label));
        }
      }

      if (processTotal) {
        count += 1;
        log("Processo contabilizado para ciencia: " + label + ".", "ok");
      }
    }

    await retryPendingScienceRecords(attemptedRecords, "pagina atual");
    return count;
  }

  async function takeSciencePreparedBatch(limit) {
    const batch = state.pageBatch;
    let total = 0;
    const processedProcessKeys = new Set();

    for (const page of batch.pages || []) {
      if (state.stopped) break;
      await goToPageNumber(page.pageNumber);
      await expandGroupsIfPresent();
      log("Fase ciencia, lote pagina " + page.pageNumber + ".");
      const attemptedRecords = [];

      for (const processItem of page.processes || []) {
        if (state.stopped) break;
        if (limit && total >= limit) break;
        if (processedProcessKeys.has(processItem.key)) continue;

        processedProcessKeys.add(processItem.key);
        let processTotal = 0;
        log(
          "Dando ciencia no processo " +
            processItem.label +
            " (" +
            processItem.rows.length +
            " pendencia(s) do lote)."
        );

        for (const rowRecord of processItem.rows) {
          if (state.stopped) break;

          const row = findRowForBatchRecord(rowRecord);
          if (!row) {
            log("Linha do lote nao encontrada para ciencia: " + rowRecord.label + ".", "error");
            continue;
          }

          const record = scienceRecordFromRow(row, processItem.key, processItem.label);
          const ok = activateScience(row);
          if (ok) {
            processTotal += 1;
            attemptedRecords.push(record);
            log("Ciencia acionada pelo lote: " + rowRecord.label, "ok");
            await sleep(CONFIG.delayScienceMs);
            await waitProcessingDone();
          } else {
            log("Sem botao de ciencia no lote: " + rowRecord.label);
          }
        }

        if (processTotal) {
          total += 1;
          log("Processo contabilizado para ciencia pelo lote: " + processItem.label + ".", "ok");
        }
      }

      await retryPendingScienceRecords(attemptedRecords, "lote pagina " + page.pageNumber);

      if (limit && total >= limit) {
        log("Limite de ciencias atingido (" + limit + ").");
        break;
      }
    }

    return total;
  }

  async function takeScienceAllPages(limit) {
    guardStart();
    try {
      limit = normalizeLimit(limit);
      logActionLimit(limit);
      logCustomFilters();
      setStatus("Dando ciencias...");
      await setPageLength();
      await applyDateFilterIfNeeded();

      let total = 0;
      if (state.pageBatch) {
        logPageScope(state.pageBatch.selectedPages, state.pageBatch.totalPages);
        total = await takeSciencePreparedBatch(limit);
      } else {
        const pageInfo = tablePageInfo();
        loadStoredPageSelection(pageInfo.total);
        updatePageSelectionControls();
        const pages = targetPageNumbers(pageInfo.total);
        const processedProcessKeys = new Set();

        logPageScope(pages, pageInfo.total);

        for (const pageNumber of pages) {
          if (state.stopped) break;

          await goToPageNumber(pageNumber);
          await expandGroupsIfPresent();
          log("Fase ciencia, pagina " + pageNumber + ".");
          const remaining = limit ? Math.max(0, limit - total) : 0;
          const pageTotal = await takeScienceCurrentPage(remaining, processedProcessKeys);
          total += pageTotal;

          if (limit && total >= limit) {
            log("Limite de ciencias atingido (" + limit + ").");
            break;
          }
        }
      }

      log("Fase de ciencia concluida. Numeros de processo acionados: " + total + ".", "ok");
      setStatus("Ciencias concluidas: " + total);
    } catch (error) {
      log("Erro na fase de ciencia: " + error.message, "error");
      setStatus("Erro na fase de ciencia");
    } finally {
      state.running = false;
    }
  }

  function procedureIdFromRow(row) {
    const info = rowInfo(row);
    const directId = normalizeText(info.id);
    if (/^\d+$/.test(directId)) return directId;

    const link = row.querySelector("a[href*='/procedures/']");
    const href = link ? link.getAttribute("href") || "" : "";
    const procedure = href.match(/\/procedures\/(\d+)/);
    return procedure ? procedure[1] : "";
  }

  function procedureUrlFromRow(row) {
    const procedureId = procedureIdFromRow(row);
    return procedureId ? resolveUrl("/procedures/" + procedureId) : "";
  }

  function getProcedureUrl(row) {
    const directUrl = procedureUrlFromRow(row);
    if (directUrl) return directUrl;

    try {
      const $ = ensureJquery();
      const dt = getDataTable();
      const data = dt.row(row).data();
      if (!Array.isArray(data)) return "";
      const item = data.find((x) => x && typeof x === "object" && x.procedure_url);
      return item ? item.procedure_url : "";
    } catch (_error) {
      return "";
    }
  }

  function keepCurrentTabFocused() {
    [80, 250, 700].forEach((delay) => {
      setTimeout(() => {
        try {
          window.focus();
          const panel = document.querySelector("#spa-cdsp-panel");
          if (panel) panel.focus({ preventScroll: true });
        } catch (_error) {
          // O navegador pode ignorar foco programatico; o Ctrl+clique e a tentativa principal.
        }
      }, delay);
    });
  }

  function resolveUrl(url) {
    const value = String(url || "").trim();
    if (!value || value === "#" || /^javascript:/i.test(value)) return "";

    try {
      return new URL(value, window.location.href).href;
    } catch (_error) {
      return value;
    }
  }

  function triageClassificationAction() {
    try {
      const raw = window.sessionStorage.getItem(TRIAGE_CLASSIFICATION_ACTION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function saveTriageClassificationAction(action) {
    window.sessionStorage.setItem(TRIAGE_CLASSIFICATION_ACTION_KEY, JSON.stringify(action));
  }

  function clearTriageClassificationAction() {
    try {
      window.sessionStorage.removeItem(TRIAGE_CLASSIFICATION_ACTION_KEY);
    } catch (_error) {
      // A acao fica restrita a aba atual; sem sessionStorage, nao ha continuidade automatica entre paginas.
    }
  }

  function currentProcedureId() {
    const match = String(window.location.pathname || "").match(/^\/procedures\/(\d+)(?:\/|$)/);
    return match ? match[1] : "";
  }

  function dispatchFormEvents(input) {
    if (!input) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setFormFieldValue(input, value) {
    if (!input) return false;
    input.value = String(value || "");
    dispatchFormEvents(input);
    return String(input.value || "") === String(value || "");
  }

  function selectedOptionText(select) {
    if (!select || select.selectedIndex < 0) return "";
    const option = select.options[select.selectedIndex];
    return option ? String(option.textContent || "").trim() : "";
  }

  function selectOptionMatches(select, text, partial) {
    const wanted = normalizeText(text).toLowerCase();
    if (!select || !wanted) return null;
    return Array.from(select.options || []).find((option) => {
      if (option.disabled) return false;
      const candidate = normalizeText(option.textContent).toLowerCase();
      return partial ? candidate.indexOf(wanted) >= 0 : candidate === wanted;
    }) || null;
  }

  function selectionWasApplied(select, text, partial) {
    const selected = normalizeText(selectedOptionText(select)).toLowerCase();
    const wanted = normalizeText(text).toLowerCase();
    return Boolean(selected && wanted && (partial ? selected.indexOf(wanted) >= 0 : selected === wanted));
  }

  function dispatchEnter(input) {
    if (!input) return;
    ["keydown", "keypress", "keyup"].forEach((type) => {
      input.dispatchEvent(new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
    });
  }

  function visibleSelect2Results() {
    return Array.from(document.querySelectorAll(".select2-container--open .select2-results__option"))
      .filter((item) => item.getAttribute("aria-disabled") !== "true" && isVisible(item));
  }

  async function chooseSelect2Option(select, text, partial) {
    const $ = window.jQuery;
    if (!$ || !select || !($(select).hasClass("select2-hidden-accessible") || $(select).data("select2"))) return false;

    try {
      $(select).select2("open");
    } catch (_error) {
      return false;
    }

    await sleep(80);
    const search = document.querySelector(".select2-container--open .select2-search__field");
    if (!search) return false;
    search.value = text;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent("keyup", { key: "", bubbles: true }));
    await sleep(350);

    const wanted = normalizeText(text).toLowerCase();
    const result = visibleSelect2Results().find((item) => {
      const candidate = normalizeText(item.textContent).toLowerCase();
      return partial ? candidate.indexOf(wanted) >= 0 : candidate === wanted;
    });

    dispatchEnter(search);
    await sleep(150);
    if (selectionWasApplied(select, text, partial)) return true;
    if (!result) return false;

    result.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    result.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
    result.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await sleep(220);
    return selectionWasApplied(select, text, partial);
  }

  async function chooseSpaSelect(select, text, partial) {
    if (!select) return false;
    if (await chooseSelect2Option(select, text, partial)) return true;

    const option = selectOptionMatches(select, text, partial);
    if (!option) return false;
    select.value = option.value;
    dispatchFormEvents(select);
    if (window.jQuery) window.jQuery(select).trigger("change.select2").trigger("change");
    await sleep(100);
    return selectionWasApplied(select, text, partial);
  }

  async function chooseSpaSelectWithRetries(select, text, partial, attempts) {
    const totalAttempts = Math.max(1, Number(attempts) || 1);
    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      if (selectionWasApplied(select, text, partial)) return true;
      if (await chooseSpaSelect(select, text, partial) && selectionWasApplied(select, text, partial)) {
        return true;
      }
      if (attempt < totalAttempts) await sleep(450 * attempt);
    }
    return false;
  }

  function fieldValueWasApplied(field, value) {
    return Boolean(field && String(field.value || "") === String(value || ""));
  }

  function nationalHolidayKeys(year) {
    const keys = new Set([
      year + "-01-01", year + "-04-21", year + "-05-01", year + "-09-07", year + "-10-12",
      year + "-11-02", year + "-11-15", year + "-11-20", year + "-12-25"
    ]);
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
    const easter = new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1, 12);
    easter.setDate(easter.getDate() - 2);
    keys.add(easter.getFullYear() + "-" + String(easter.getMonth() + 1).padStart(2, "0") + "-" + String(easter.getDate()).padStart(2, "0"));
    return keys;
  }

  function nextNationalBusinessDay() {
    const result = new Date();
    result.setHours(12, 0, 0, 0);
    do {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      const key = result.getFullYear() + "-" + String(result.getMonth() + 1).padStart(2, "0") + "-" + String(result.getDate()).padStart(2, "0");
      if (day !== 0 && day !== 6 && !nationalHolidayKeys(result.getFullYear()).has(key)) {
        return String(result.getDate()).padStart(2, "0") + "/" + String(result.getMonth() + 1).padStart(2, "0") + "/" + result.getFullYear();
      }
    } while (true);
  }

  function complementaryClassificationLink() {
    return Array.from(document.querySelectorAll("a[href*='/new_progress/']")).find((link) =>
      normalizeText([link.getAttribute("data-title"), link.getAttribute("title"), link.textContent].join(" "))
        .toLowerCase()
        .indexOf("complementar classificacao do processo") >= 0
    ) || null;
  }

  async function beginTriageClassification(action) {
    const link = complementaryClassificationLink();
    if (!link) throw new Error("O botao 'Complementar classificacao do processo' nao foi encontrado nesta pendencia.");
    const prepared = Object.assign({}, action, { procedureId: currentProcedureId(), createdAt: Date.now() });
    saveTriageClassificationAction(prepared);
    setStatus("Abrindo classificacao");
    log("Abrindo Complementar classificacao do processo.");
    const href = resolveUrl(link.getAttribute("href"));
    link.click();
    setTimeout(() => {
      if (href && window.location.href !== href && window.location.pathname.indexOf("/new_progress/") < 0) {
        window.location.assign(href);
      }
    }, 850);
  }

  async function continuePendingTriageClassification() {
    const action = triageClassificationAction();
    if (!action || !action.createdAt || Date.now() - action.createdAt > 5 * 60 * 1000) return;
    if (String(action.procedureId || "") !== currentProcedureId()) return;

    const info = document.querySelector("#progress_form_data_ATR001330");
    const manifestation = document.querySelector("#progress_form_data_ATR007587");
    const assessor = document.querySelector("#progress_form_data_ATR007588");
    const observation = document.querySelector("#progress_form_data_ATR007594");
    const save = document.querySelector("#btn-progress-save[value*='Complementar']");
    if (!info || !manifestation || !assessor || !observation || !save) return;

    try {
      state.running = true;
      setStatus("Preenchendo classificacao");
      if (!setFormFieldValue(info, action.additionalInfo || "")) {
        throw new Error("Nao foi possivel preencher Informacoes adicionais.");
      }
      if (!(await chooseSpaSelectWithRetries(manifestation, action.manifestation, false, 3))) {
        throw new Error("Nao foi possivel selecionar a Manifestacao Sugerida informada.");
      }
      if (!(await chooseSpaSelectWithRetries(assessor, action.assessor, true, 3))) {
        throw new Error("O assessor nao foi preenchido automaticamente. Selecione-o manualmente antes de salvar.");
      }
      if (!setFormFieldValue(observation, action.processObservation || "")) {
        throw new Error("Nao foi possivel preencher a Observacao do Processo.");
      }

      if (action.hasOffice) {
        const taskType = document.querySelector("#progress_form_data_Nova-Tarefa_0_ATR007590");
        const taskUser = document.querySelector("#progress_form_data_Nova-Tarefa_0_ATR007591");
        const taskBusinessDays = document.querySelector("#progress_form_data_Nova-Tarefa_0_ATR007592");
        const taskDueDate = document.querySelector("#progress_form_data_Nova-Tarefa_0_ATR007593");
        const taskObservation = document.querySelector("#progress_form_data_Nova-Tarefa_0_ATR007589");
        if (!taskType || !taskUser || !taskBusinessDays || !taskDueDate || !taskObservation) {
          throw new Error("Os campos da Nova Tarefa nao foram encontrados.");
        }
        if (!(await chooseSpaSelectWithRetries(taskType, "Ofício", false, 3))) {
          throw new Error("Nao foi possivel selecionar 'Ofício' em Tipo de tarefa.");
        }
        if (!(await chooseSpaSelectWithRetries(taskUser, "Yasmim Marques Nascimento", false, 4))) {
          throw new Error("A usuaria Yasmim Marques Nascimento nao foi preenchida automaticamente na Nova Tarefa.");
        }
        const dueDate = nextNationalBusinessDay();
        if (!setFormFieldValue(taskBusinessDays, "1") || !setFormFieldValue(taskDueDate, dueDate) ||
          !setFormFieldValue(taskObservation, action.officeObservation || "")) {
          throw new Error("Nao foi possivel preencher todos os campos da Nova Tarefa.");
        }

        const missingFields = [];
        if (!selectionWasApplied(manifestation, action.manifestation, false)) missingFields.push("Manifestacao Sugerida");
        if (!selectionWasApplied(assessor, action.assessor, true)) missingFields.push("Designar ao assessor(a)");
        if (!fieldValueWasApplied(info, action.additionalInfo || "")) missingFields.push("Informacoes adicionais");
        if (!fieldValueWasApplied(observation, action.processObservation || "")) missingFields.push("Observacao do Processo");
        if (!selectionWasApplied(taskType, "Ofício", false)) missingFields.push("Tipo de tarefa");
        if (!selectionWasApplied(taskUser, "Yasmim Marques Nascimento", false)) missingFields.push("Usuario da Nova Tarefa");
        if (!fieldValueWasApplied(taskBusinessDays, "1")) missingFields.push("Prazo da Nova Tarefa");
        if (!fieldValueWasApplied(taskDueDate, dueDate)) missingFields.push("Vencimento da Nova Tarefa");
        if (!fieldValueWasApplied(taskObservation, action.officeObservation || "")) missingFields.push("Observacao do Oficio");
        if (missingFields.length) {
          throw new Error("A classificacao nao foi salva porque estes campos nao foram confirmados: " + missingFields.join(", ") + ".");
        }
      } else {
        const missingFields = [];
        if (!selectionWasApplied(manifestation, action.manifestation, false)) missingFields.push("Manifestacao Sugerida");
        if (!selectionWasApplied(assessor, action.assessor, true)) missingFields.push("Designar ao assessor(a)");
        if (!fieldValueWasApplied(info, action.additionalInfo || "")) missingFields.push("Informacoes adicionais");
        if (!fieldValueWasApplied(observation, action.processObservation || "")) missingFields.push("Observacao do Processo");
        if (missingFields.length) {
          throw new Error("A classificacao nao foi salva porque estes campos nao foram confirmados: " + missingFields.join(", ") + ".");
        }
      }

      clearTriageClassificationAction();
      setStatus("Classificando processo");
      log("Campos conferidos. Salvando classificacao do processo.", "ok");
      save.click();
    } catch (error) {
      clearTriageClassificationAction();
      const message = error && error.message ? error.message : String(error);
      state.running = false;
      setStatus("Preenchimento pendente");
      log(message, "error");
      originalAlert.call(window, message);
    }
  }

  function elementLink(element) {
    if (!element) return null;
    const tag = String(element.tagName || "").toLowerCase();
    return tag === "a" ? element : element.closest("a[href]");
  }

  function urlFromText(value) {
    const text = String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (!text) return "";

    const spaUrl = text.match(/https?:\/\/spa\.pge\.mt\.gov\.br\/[^\s"'<>\\)]+/i);
    if (spaUrl) return resolveUrl(spaUrl[0]);

    const coresigner = text.match(/\/coresigner\/info\/[^\s"'<>\\)]+\.pdf/i);
    if (coresigner) return resolveUrl(coresigner[0]);

    return "";
  }

  function elementUrl(element) {
    const link = elementLink(element);
    const candidates = [];
    const textCandidates = [];

    if (link) {
      candidates.push(link.href, link.getAttribute("href"));
      [
        "data-url",
        "data-href",
        "data-remote-url",
        "data-download-url",
        "data-original-url",
      ].forEach((name) => candidates.push(link.getAttribute(name)));
      textCandidates.push(link.getAttribute("onclick"));
    }

    if (element && element.querySelector) {
      const childLink = element.querySelector("a[href]");
      if (childLink) candidates.push(childLink.href, childLink.getAttribute("href"));
    }

    if (element && element.getAttribute) {
      [
        "href",
        "data-url",
        "data-href",
        "data-remote-url",
        "data-download-url",
        "data-original-url",
      ].forEach((name) => candidates.push(element.getAttribute(name)));
      [
        "onclick",
        "data-content",
        "data-original-title",
        "title",
        "aria-label",
      ].forEach((name) => textCandidates.push(element.getAttribute(name)));
    }

    for (const candidate of candidates) {
      const raw = String(candidate || "").trim();
      if (!raw || raw === "#" || /^javascript:/i.test(raw)) continue;
      const direct = resolveUrl(raw);
      if (direct && direct !== "#" && !/^javascript:/i.test(direct)) return direct;
    }

    for (const candidate of textCandidates) {
      const extracted = urlFromText(candidate);
      if (extracted) return extracted;
    }

    return "";
  }

  function canUseExtensionBackgroundTabs() {
    return typeof window.postMessage === "function";
  }

  function requestExtensionMessage(type, payload, timeoutMs) {
    if (!type || typeof window.postMessage !== "function") {
      return Promise.resolve({ ok: false, error: "Ponte da extensao indisponivel." });
    }

    return new Promise((resolve) => {
      extensionRequestSeq += 1;
      const requestId = "spa-cdsp-request-" + Date.now() + "-" + extensionRequestSeq;
      const timeoutId = setTimeout(() => {
        delete extensionPendingRequests[requestId];
        resolve({ ok: false, error: "Tempo excedido aguardando resposta da extensao." });
      }, Math.max(3000, timeoutMs || CONFIG.extensionOpenTimeoutMs));

      extensionPendingRequests[requestId] = {
        resolve: resolve,
        timeoutId: timeoutId,
        rawResponse: true,
      };

      try {
        window.postMessage(
          Object.assign(
            {
              source: EXTENSION_PAGE_SOURCE,
              type: type,
              requestId: requestId,
            },
            payload || {}
          ),
          window.location.origin
        );
      } catch (error) {
        clearTimeout(timeoutId);
        delete extensionPendingRequests[requestId];
        resolve({ ok: false, error: error && error.message ? error.message : String(error) });
      }
    });
  }

  function openUrlThroughExtensionOnce(url, attempt, totalAttempts) {
    const href = resolveUrl(url);
    if (!href || !canUseExtensionBackgroundTabs()) return Promise.resolve(false);

    return new Promise((resolve) => {
      extensionRequestSeq += 1;
      const requestId = "spa-cdsp-" + Date.now() + "-" + extensionRequestSeq;
      const timeoutId = setTimeout(() => {
        delete extensionPendingRequests[requestId];
        if (attempt < totalAttempts) {
          log(
            "Extensao demorou para responder a abertura. Tentando novamente (" +
              (attempt + 1) +
              "/" +
              totalAttempts +
              ")."
          );
        }
        resolve(false);
      }, CONFIG.extensionOpenTimeoutMs);

      extensionPendingRequests[requestId] = {
        resolve: resolve,
        timeoutId: timeoutId,
      };

      try {
        window.postMessage(
          {
            source: EXTENSION_PAGE_SOURCE,
            type: "SPA_CDSP_OPEN_BACKGROUND_TABS",
            requestId: requestId,
            urls: [href],
            delayMs: 0,
          },
          window.location.origin
        );

        keepCurrentTabFocused();
      } catch (_error) {
        clearTimeout(timeoutId);
        delete extensionPendingRequests[requestId];
        resolve(false);
      }
    });
  }

  async function openUrlThroughExtension(url) {
    const href = resolveUrl(url);
    if (!href || !canUseExtensionBackgroundTabs()) return false;

    const attempts = Math.max(1, normalizeLimit(CONFIG.extensionOpenRetries) || 1);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (state.stopped) return false;
      if (await openUrlThroughExtensionOnce(href, attempt, attempts)) return true;
      if (attempt < attempts) await sleep(CONFIG.extensionOpenRetryDelayMs);
    }

    log(
      "Extensao nao respondeu apos " +
        attempts +
        " tentativa(s). A URL nao sera aberta pelo fallback para preservar a ordem das abas.",
      "error"
    );
    return false;
  }

  function openUrlsThroughExtensionOnce(urls, attempt, totalAttempts) {
    const hrefs = (urls || []).map(resolveUrl).filter(Boolean);
    if (!hrefs.length || !canUseExtensionBackgroundTabs()) {
      return Promise.resolve({ ok: false, opened: 0, error: "Nenhuma URL valida para abrir." });
    }

    return new Promise((resolve) => {
      extensionRequestSeq += 1;
      const requestId = "spa-cdsp-batch-" + Date.now() + "-" + extensionRequestSeq;
      const timeoutMs = Math.max(
        CONFIG.extensionOpenTimeoutMs,
        5000 + hrefs.length * (CONFIG.batchOpenDelayMs + 250)
      );
      const timeoutId = setTimeout(() => {
        delete extensionPendingRequests[requestId];
        if (attempt < totalAttempts) {
          log(
            "Extensao demorou para responder a abertura em lote. Tentando novamente (" +
              (attempt + 1) +
              "/" +
              totalAttempts +
              ")."
          );
        }
        resolve({ ok: false, opened: 0, error: "Tempo excedido na abertura em lote." });
      }, timeoutMs);

      extensionPendingRequests[requestId] = {
        resolve: resolve,
        timeoutId: timeoutId,
        rawResponse: true,
      };

      try {
        window.postMessage(
          {
            source: EXTENSION_PAGE_SOURCE,
            type: "SPA_CDSP_OPEN_BACKGROUND_TABS",
            requestId: requestId,
            urls: hrefs,
            delayMs: CONFIG.batchOpenDelayMs,
          },
          window.location.origin
        );

        keepCurrentTabFocused();
      } catch (error) {
        clearTimeout(timeoutId);
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          opened: 0,
          error: error && error.message ? error.message : String(error),
        });
      }
    });
  }

  async function openUrlsThroughExtension(urls) {
    const hrefs = (urls || []).map(resolveUrl).filter(Boolean);
    if (!hrefs.length || !canUseExtensionBackgroundTabs()) {
      return { ok: false, opened: 0, error: "Nenhuma URL valida para abrir." };
    }

    const attempts = 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (state.stopped) return { ok: false, opened: 0, error: "Fluxo encerrado." };

      const response = await openUrlsThroughExtensionOnce(hrefs, attempt, attempts);
      if (response && response.ok && response.opened) return response;
      if (attempt < attempts) await sleep(CONFIG.extensionOpenRetryDelayMs);
    }

    return {
      ok: false,
      opened: 0,
      error: "Extensao nao respondeu apos " + attempts + " tentativa(s).",
    };
  }

  function openFilteredExpedienteThroughExtension(group, phrases) {
    if (!group || !phrases || !phrases.length || !canUseExtensionBackgroundTabs()) {
      return Promise.resolve({
        ok: false,
        opened: 0,
        kept: 0,
        closed: 0,
        error: "Filtro de expediente sem dados suficientes.",
      });
    }

    return new Promise((resolve) => {
      extensionRequestSeq += 1;
      const requestId = "spa-cdsp-exp-filter-" + Date.now() + "-" + extensionRequestSeq;
      const timeoutId = setTimeout(() => {
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          opened: 0,
          kept: 0,
          closed: 0,
          error: "Tempo excedido lendo expediente.",
        });
      }, CONFIG.expedienteContentFilterTimeoutMs);

      extensionPendingRequests[requestId] = {
        resolve: resolve,
        timeoutId: timeoutId,
        rawResponse: true,
      };

      try {
        window.postMessage(
          {
            source: EXTENSION_PAGE_SOURCE,
            type: "SPA_CDSP_OPEN_FILTERED_EXPEDIENTE_TABS",
            requestId: requestId,
            group: group,
            phrases: phrases,
            delayMs: CONFIG.batchOpenDelayMs,
          },
          window.location.origin
        );

        keepCurrentTabFocused();
      } catch (error) {
        clearTimeout(timeoutId);
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          opened: 0,
          kept: 0,
          closed: 0,
          error: error && error.message ? error.message : String(error),
        });
      }
    });
  }

  function classifyPieceRecordsThroughExtension(records) {
    const payload = Array.isArray(records) ? records : [];
    if (!payload.length || !canUseExtensionBackgroundTabs()) {
      return Promise.resolve({
        ok: false,
        results: [],
        error: "Sem registros para classificar.",
      });
    }

    return new Promise((resolve) => {
      extensionRequestSeq += 1;
      const requestId = "spa-cdsp-piece-classify-" + Date.now() + "-" + extensionRequestSeq;
      const timeoutMs = Math.max(
        CONFIG.pieceReportTimeoutMs,
        20000 + payload.length * 18000
      );
      const timeoutId = setTimeout(() => {
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          results: [],
          error: "Tempo excedido classificando expedientes.",
        });
      }, timeoutMs);

      extensionPendingRequests[requestId] = {
        resolve: resolve,
        timeoutId: timeoutId,
        rawResponse: true,
      };

      try {
        window.postMessage(
          {
            source: EXTENSION_PAGE_SOURCE,
            type: "SPA_CDSP_CLASSIFY_PIECE_RECORDS",
            requestId: requestId,
            records: payload,
          },
          window.location.origin
        );
      } catch (error) {
        clearTimeout(timeoutId);
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          results: [],
          error: error && error.message ? error.message : String(error),
        });
      }
    });
  }

  function openPieceReportRecordThroughExtension(record) {
    if (!record || !canUseExtensionBackgroundTabs()) {
      return Promise.resolve({
        ok: false,
        opened: 0,
        error: "Registro sem dados suficientes para abertura.",
      });
    }

    return new Promise((resolve) => {
      extensionRequestSeq += 1;
      const requestId = "spa-cdsp-piece-open-" + Date.now() + "-" + extensionRequestSeq;
      const timeoutMs = Math.max(
        45000,
        15000 + ((record.expedientes || []).length + 1) * 12000
      );
      const timeoutId = setTimeout(() => {
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          opened: 0,
          error: "Tempo excedido abrindo/preenchendo registro de peça.",
        });
      }, timeoutMs);

      extensionPendingRequests[requestId] = {
        resolve: resolve,
        timeoutId: timeoutId,
        rawResponse: true,
      };

      try {
        window.postMessage(
          {
            source: EXTENSION_PAGE_SOURCE,
            type: "SPA_CDSP_OPEN_PIECE_REPORT_RECORD",
            requestId: requestId,
            record: record,
            delayMs: CONFIG.batchOpenDelayMs,
          },
          window.location.origin
        );

        keepCurrentTabFocused();
      } catch (error) {
        clearTimeout(timeoutId);
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          opened: 0,
          error: error && error.message ? error.message : String(error),
        });
      }
    });
  }

  function validateDuplicateRecordsThroughExtension(records) {
    const payload = (Array.isArray(records) ? records : [records]).filter((record) => record && record.pendencyUrl);
    if (!payload.length || !canUseExtensionBackgroundTabs()) {
      return Promise.resolve({
        ok: false,
        validated: 0,
        error: "Sem pendencias com URL para validar.",
      });
    }

    return new Promise((resolve) => {
      extensionRequestSeq += 1;
      const requestId = "spa-cdsp-duplicate-validate-" + Date.now() + "-" + extensionRequestSeq;
      const timeoutMs = Math.max(45000, 12000 + payload.length * 18000);
      const timeoutId = setTimeout(() => {
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          validated: 0,
          error: "Tempo excedido validando marcador Conferido.",
        });
      }, timeoutMs);

      extensionPendingRequests[requestId] = {
        resolve: resolve,
        timeoutId: timeoutId,
        rawResponse: true,
      };

      try {
        window.postMessage(
          {
            source: EXTENSION_PAGE_SOURCE,
            type: "SPA_CDSP_VALIDATE_DUPLICATE_RECORDS",
            requestId: requestId,
            records: payload,
            delayMs: CONFIG.batchOpenDelayMs,
          },
          window.location.origin
        );

        keepCurrentTabFocused();
      } catch (error) {
        clearTimeout(timeoutId);
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          validated: 0,
          error: error && error.message ? error.message : String(error),
        });
      }
    });
  }

  function searchAutosDocumentThroughExtension(record, query, exact) {
    const text = String(query || "").trim();
    if (!record || !record.url || !text || !canUseExtensionBackgroundTabs()) {
      return Promise.resolve({
        ok: false,
        found: false,
        record: record || null,
        error: "Documento ou texto de pesquisa nao informado.",
      });
    }

    return new Promise((resolve) => {
      extensionRequestSeq += 1;
      const requestId = "spa-cdsp-autos-search-" + Date.now() + "-" + extensionRequestSeq;
      const timeoutId = setTimeout(() => {
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          found: false,
          record: record,
          error: "Tempo excedido pesquisando no documento.",
        });
      }, CONFIG.autosDocumentSearchTimeoutMs);

      extensionPendingRequests[requestId] = {
        resolve: resolve,
        timeoutId: timeoutId,
        rawResponse: true,
      };

      try {
        window.postMessage(
          {
            source: EXTENSION_PAGE_SOURCE,
            type: "SPA_CDSP_SEARCH_AUTOS_DOCUMENT",
            requestId: requestId,
            record: record,
            query: text,
            exact: Boolean(exact),
          },
          window.location.origin
        );
      } catch (error) {
        clearTimeout(timeoutId);
        delete extensionPendingRequests[requestId];
        resolve({
          ok: false,
          found: false,
          record: record,
          error: error && error.message ? error.message : String(error),
        });
      }
    });
  }

  async function openUrlInBackground(url) {
    const href = resolveUrl(url);
    if (!href) return false;

    if (await openUrlThroughExtension(href)) return true;
    if (!CONFIG.allowBrowserOpenFallback) return false;

    try {
      const opened = window.open(href, "_blank");
      if (opened) {
        try {
          opened.blur();
        } catch (_error) {
          // Alguns navegadores bloqueiam controle de foco da aba aberta.
        }
        keepCurrentTabFocused();
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
      keepCurrentTabFocused();
      return true;
    } catch (_error) {
      return false;
    } finally {
      link.remove();
    }
  }

  async function openElementInBackground(element) {
    if (!element) return false;

    const tag = String(element.tagName || "").toLowerCase();
    const link = tag === "a" ? element : element.closest("a[href]");

    if (link) {
      return await openLinkInBackground(link);
    }

    return ctrlClickElement(element);
  }

  async function openLinkInBackground(link) {
    if (!link) return false;

    const href = link.href || link.getAttribute("href") || "";
    if (!href || href === "#") return ctrlClickElement(link);

    if (await openUrlInBackground(href)) return true;
    return ctrlClickElement(link);
  }

  function ctrlClickElement(element) {
    if (!element) return false;

    if (element.scrollIntoView) {
      element.scrollIntoView({ block: "center", inline: "nearest" });
    }

    const downOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      ctrlKey: true,
      button: 0,
      buttons: 1,
    };
    const clickOptions = Object.assign({}, downOptions, { buttons: 0 });

    element.dispatchEvent(new MouseEvent("mousedown", downOptions));
    element.dispatchEvent(new MouseEvent("mouseup", clickOptions));
    element.dispatchEvent(new MouseEvent("click", clickOptions));
    keepCurrentTabFocused();
    return true;
  }

  async function ctrlClickUrl(url) {
    return await openUrlInBackground(url);
  }

  function sortByScreenPosition(elements) {
    return elements
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        return { element, index, x: rect.left, y: Math.round(rect.top / 10) * 10 };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x || a.index - b.index)
      .map((item) => item.element);
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function getExpedientes(row) {
    return Array.from(row.querySelectorAll(CONFIG.expedienteSelector)).filter((element) => {
      if (!isVisible(element)) return false;
      return isExpedienteElement(element);
    });
  }

  function isExpedienteElement(element) {
    const label = normalizeText(
      [
        element.getAttribute("data-original-title"),
        element.getAttribute("title"),
        element.getAttribute("aria-label"),
        element.textContent,
      ].join(" ")
    ).toLowerCase();
    const href = String(element.href || element.getAttribute("href") || "").toLowerCase();
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

  function rowProcedureKey(row) {
    const info = rowInfo(row);
    if (info.id) return info.id;

    const link = row.querySelector("a[href*='/procedures/']");
    const href = link ? link.getAttribute("href") || "" : "";
    const procedure = href.match(/\/procedures\/(\d+)/);
    if (procedure) return procedure[1];

    return info.assunto || normalizeText(row.textContent).slice(0, 80);
  }

  function rowMarkerElements(row) {
    return Array.from(
      row.querySelectorAll(
        ".zmdi-marker, " +
          ".icon-marker-style, " +
          ".text-marker, " +
          ".span-marker-name, " +
          "[class*='marker'], " +
          "[title], " +
          "[data-original-title], " +
          "[data-full-text], " +
          "[aria-label], " +
          ".badge, " +
          ".label"
      )
    );
  }

  function rowHasMarkerText(row, markerText) {
    const wanted = normalizeText(markerText).toLowerCase();
    if (!wanted) return false;

    const markerElements = rowMarkerElements(row);
    return markerElements.some((element) => {
      const text = normalizeText(
        [
          element.getAttribute("title"),
          element.getAttribute("data-original-title"),
          element.getAttribute("data-full-text"),
          element.getAttribute("aria-label"),
          element.textContent,
        ].join(" ")
      ).toLowerCase();

      return text.indexOf(wanted) >= 0;
    });
  }

  function rowHasEncerrarMarker(row) {
    return rowHasMarkerText(row, CONFIG.encerrarMarkerText);
  }

  function rowHasDuplicidadeValidadaMarker(row) {
    return rowHasMarkerText(row, CONFIG.duplicidadeValidadaMarkerText);
  }

  function groupHasDuplicidadeValidadaMarker(groupRow, items) {
    if (rowHasDuplicidadeValidadaMarker(groupRow)) return true;
    return items.some(rowHasDuplicidadeValidadaMarker);
  }

  function groupAllDuplicidadeValidadaMarker(items) {
    return Boolean(items && items.length && items.every(rowHasDuplicidadeValidadaMarker));
  }

  function markedProcessKeysCurrentPage(processedRowKeys) {
    const keys = [];
    const seen = new Set();

    rows().forEach((row) => {
      const rowKey = rowProcedureKey(row);
      if (!rowHasEncerrarMarker(row) || processedRowKeys.has(rowKey)) return;

      const processKey = rowProcessNumber(row);
      if (seen.has(processKey)) return;

      seen.add(processKey);
      keys.push(processKey);
    });

    return keys;
  }

  function nextMarkedRowForProcess(processKey, processedRowKeys) {
    return rows().find((row) => {
      const rowKey = rowProcedureKey(row);
      return (
        rowProcessNumber(row) === processKey &&
        rowHasEncerrarMarker(row) &&
        !processedRowKeys.has(rowKey)
      );
    });
  }

  function getEncerramentoLink(row) {
    const wantedText = normalizeText(CONFIG.encerramentoText).toLowerCase();
    const wantedStep = "step_id=" + CONFIG.encerramentoStepId;
    const links = Array.from(row.querySelectorAll("a.dropdown-item, a[data-remote='true'], a[href]"));

    return (
      links.find((link) => {
        const href = link.href || link.getAttribute("href") || "";
        const text = normalizeText(link.textContent).toLowerCase();
        return (
          href.indexOf("archive_procedure") >= 0 &&
          href.indexOf(wantedStep) >= 0 &&
          text.indexOf(wantedText) >= 0
        );
      }) ||
      links.find((link) => {
        const href = link.href || link.getAttribute("href") || "";
        return href.indexOf("archive_procedure") >= 0 && href.indexOf(wantedStep) >= 0;
      })
    );
  }

  function isModalShown(modal) {
    if (!modal) return false;
    const style = window.getComputedStyle(modal);
    const rect = modal.getBoundingClientRect();
    return (
      modal.classList.contains("show") ||
      modal.getAttribute("aria-hidden") === "false" ||
      style.display !== "none" ||
      rect.width > 0 ||
      rect.height > 0
    );
  }

  function findEncerramentoModal() {
    const wantedText = normalizeText(CONFIG.encerramentoText).toLowerCase();
    const modals = Array.from(document.querySelectorAll(".modal"));

    return (
      modals.find((modal) => {
        if (!isModalShown(modal)) return false;
        const text = normalizeText(modal.textContent).toLowerCase();
        return text.indexOf(wantedText) >= 0;
      }) ||
      modals.find((modal) => {
        if (!isModalShown(modal)) return false;
        return Boolean(findSaveButton(modal));
      }) ||
      null
    );
  }

  async function waitForEncerramentoModal() {
    const started = Date.now();
    while (Date.now() - started < 20000) {
      const modal = findEncerramentoModal();
      if (modal) return modal;
      await sleep(250);
    }

    return null;
  }

  function findSaveButton(container) {
    const candidates = Array.from(
      container.querySelectorAll(
        "input[type='submit'][value='Salvar'], " +
          "input[name='commit'], " +
          "button[type='submit'], " +
          ".modal-footer .btn-primary"
      )
    );

    return candidates.find((button) => {
      if (!isVisible(button)) return false;
      const label = normalizeText(button.value || button.textContent || button.getAttribute("data-disable-with"));
      return label === "Salvar" || label.indexOf("Salvar") >= 0;
    });
  }

  async function waitForModalToClose(modal) {
    const started = Date.now();
    while (Date.now() - started < 30000) {
      await waitProcessingDone();
      if (!document.body.contains(modal) || !isModalShown(modal)) return true;
      await sleep(350);
    }

    return false;
  }

  async function closeMarkedRow(row) {
    if (!rowHasEncerrarMarker(row)) {
      log("Linha ignorada: marcador ENCERRAR nao encontrado.");
      return false;
    }

    const link = getEncerramentoLink(row);
    const info = rowInfo(row);
    const label = info.id || info.assunto || "linha sem id";

    if (!link) {
      log("Opcao de encerramento nao encontrada: " + label, "error");
      return false;
    }

    const arrow = row.querySelector(
      "[data-original-title='Proximo passo'] [data-toggle='dropdown'], " +
        ".zmdi-arrow-right[data-toggle='dropdown']"
    );

    if (arrow) {
      arrow.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      await sleep(250);
    }

    log("Abrindo encerramento: " + label + ".");
    link.click();

    const modal = await waitForEncerramentoModal();
    if (!modal) {
      log("Janela de encerramento nao abriu: " + label, "error");
      return false;
    }

    const save = findSaveButton(modal);
    if (!save) {
      throw new Error("Botao Salvar nao encontrado no encerramento: " + label);
    }

    save.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(200);
    save.click();
    log("Salvar acionado no encerramento: " + label + ".", "ok");

    const closed = await waitForModalToClose(modal);
    if (!closed) {
      throw new Error("Janela de encerramento permaneceu aberta: " + label);
    }

    await sleep(CONFIG.delayCloseMs);
    return true;
  }

  async function closeMarkedCurrentPage(limit, processedProcessKeys, processedRowKeys) {
    const seenProcesses = processedProcessKeys || new Set();
    const seenRows = processedRowKeys || new Set();
    let count = 0;

    while (!state.stopped) {
      if (limit && count >= limit) break;

      const processKey = markedProcessKeysCurrentPage(seenRows).find((key) => !seenProcesses.has(key));
      if (!processKey) break;

      seenProcesses.add(processKey);
      let processTotal = 0;
      let attempts = 0;

      log("Encerrando processo " + processKey + " e todas as pendencias marcadas dele.");

      while (!state.stopped) {
        const row = nextMarkedRowForProcess(processKey, seenRows);
        if (!row) break;

        const rowKey = rowProcedureKey(row);
        seenRows.add(rowKey);
        attempts += 1;

        const ok = await closeMarkedRow(row);
        if (ok) processTotal += 1;
        await sleep(CONFIG.delayCloseMs);
      }

      if (processTotal) {
        count += 1;
        log(
          "Processo contabilizado no encerramento: " +
            processKey +
            " (" +
            processTotal +
            " pendencia(s)).",
          "ok"
        );
      } else if (attempts) {
        log("Nenhuma pendencia foi encerrada para o processo " + processKey + ".", "error");
      }
    }

    return count;
  }

  async function closeMarkedPreparedBatch(limit) {
    const batch = state.pageBatch;
    let total = 0;
    const processedProcessKeys = new Set();
    const processedRowKeys = new Set();

    for (const page of batch.pages || []) {
      if (state.stopped) break;
      await goToPageNumber(page.pageNumber);
      await expandGroupsIfPresent();
      log("Fase encerramento, lote pagina " + page.pageNumber + ".");

      for (const processItem of page.processes || []) {
        if (state.stopped) break;
        if (limit && total >= limit) break;
        if (processedProcessKeys.has(processItem.key)) continue;

        processedProcessKeys.add(processItem.key);
        let processTotal = 0;
        let attempts = 0;
        log("Encerrando processo do lote " + processItem.label + ".");

        for (const rowRecord of processItem.rows || []) {
          if (state.stopped) break;
          if (processedRowKeys.has(rowRecord.rowKey)) continue;

          const row = findRowForBatchRecord(rowRecord);
          if (!row) {
            log("Linha do lote nao encontrada para encerramento: " + rowRecord.label + ".", "error");
            continue;
          }

          if (!rowHasEncerrarMarker(row)) {
            log("Linha do lote sem marcador ENCERRAR no momento do encerramento: " + rowRecord.label + ".");
            continue;
          }

          processedRowKeys.add(rowRecord.rowKey);
          attempts += 1;

          const ok = await closeMarkedRow(row);
          if (ok) processTotal += 1;
          await sleep(CONFIG.delayCloseMs);
        }

        if (processTotal) {
          total += 1;
          log(
            "Processo contabilizado no encerramento pelo lote: " +
              processItem.label +
              " (" +
              processTotal +
              " pendencia(s)).",
            "ok"
          );
        } else if (attempts) {
          log("Nenhuma pendencia foi encerrada no lote para " + processItem.label + ".", "error");
        }
      }

      if (limit && total >= limit) {
        log("Limite de encerramentos atingido (" + limit + ").");
        break;
      }
    }

    return total;
  }

  async function closeMarkedAllPages(limit) {
    guardStart();
    try {
      limit = normalizeLimit(limit);
      logActionLimit(limit);
      logCustomFilters();
      setStatus("Encerrando marcados...");
      await setPageLength();
      await applyDateFilterIfNeeded();

      let total = 0;
      if (state.pageBatch) {
        logPageScope(state.pageBatch.selectedPages, state.pageBatch.totalPages);
        total = await closeMarkedPreparedBatch(limit);
      } else {
        const pageInfo = tablePageInfo();
        loadStoredPageSelection(pageInfo.total);
        updatePageSelectionControls();
        const pages = targetPageNumbers(pageInfo.total);
        const processedProcessKeys = new Set();
        const processedRowKeys = new Set();

        logPageScope(pages, pageInfo.total);

        for (const pageNumber of pages) {
          if (state.stopped) break;

          await goToPageNumber(pageNumber);
          await expandGroupsIfPresent();
          const visibleMarked = rows().filter(rowHasEncerrarMarker).length;
          log("Fase encerramento, pagina " + pageNumber + ". Marcados visiveis: " + visibleMarked + ".");

          const remaining = limit ? Math.max(0, limit - total) : 0;
          const pageTotal = await closeMarkedCurrentPage(remaining, processedProcessKeys, processedRowKeys);
          total += pageTotal;

          if (limit && total >= limit) {
            log("Limite de encerramentos atingido (" + limit + ").");
            break;
          }
        }
      }

      if (!total) {
        log("Nenhum processo com marcador ENCERRAR foi encerrado.", "error");
      } else {
        log("Fase de encerramento concluida. Numeros de processo encerrados: " + total + ".", "ok");
      }
      setStatus("Encerramentos concluidos: " + total);
    } catch (error) {
      log("Erro na fase de encerramento: " + error.message, "error");
      setStatus("Erro no encerramento");
    } finally {
      state.running = false;
    }
  }

  function expedienteTitle(element, index) {
    return (
      element.getAttribute("data-original-title") ||
      element.getAttribute("title") ||
      element.getAttribute("aria-label") ||
      "Ler Expediente " + (index + 1)
    );
  }

  function buildOpenPlanForRow(row) {
    const info = rowInfo(row);
    const label = info.id || info.assunto || "linha sem id";
    const cell = row.querySelector("td.cursor-pointer");
    const procedureUrl = resolveUrl(getProcedureUrl(row));
    const expedientes = sortByScreenPosition(getExpedientes(row));
    const tasks = [];

    if (cell || procedureUrl) {
      tasks.push({
        kind: "pendency",
        label: "Pendencia",
        element: cell,
        url: procedureUrl,
        preferUrl: Boolean(procedureUrl),
      });
    }

    expedientes.forEach((expediente, index) => {
      tasks.push({
        kind: "expediente",
        label: expedienteTitle(expediente, index),
        element: expediente,
        url: elementUrl(expediente),
        preferUrl: true,
      });
    });

    return {
      label: label,
      tasks: tasks,
      hasPendencia: Boolean(cell || procedureUrl),
      expedienteCount: expedientes.length,
    };
  }

  function buildFilteredExpedienteGroupFromPlan(plan) {
    const pendencyTask = (plan.tasks || []).find((task) => task.kind === "pendency");
    const expedienteTasks = (plan.tasks || []).filter((task) => task.kind === "expediente");

    return {
      label: plan.label,
      tribunal: plan.tribunal || "",
      grau: plan.grau || "",
      pendencyUrl: pendencyTask ? taskUrl(pendencyTask) : "",
      expedientes: expedienteTasks
        .map((task) => ({
          label: task.label || "Expediente",
          url: taskUrl(task),
        }))
        .filter((task) => task.url),
    };
  }

  function effectiveExpedienteContentFilters(filters, expedienteCount, context) {
    const phrases = Array.isArray(filters && filters.phrases) ? filters.phrases : [];
    const labels = Array.isArray(filters && filters.labels) ? filters.labels : [];
    const mustLimitPauta = Boolean(filters && filters.pauta && Number(expedienteCount) !== 1);
    const grau = inferGrauFromText([
      context && context.grau,
      context && context.tribunal,
    ].join(" "));

    const pautaPhrase = CONFIG.expedienteContentFilters.pauta;
    const negociacaoPhrase = CONFIG.expedienteContentFilters.negociacao;
    const keptPhrases = [];
    const keptLabels = [];
    const skippedReasons = [];

    phrases.forEach((phrase, index) => {
      if (phrase === pautaPhrase && mustLimitPauta) {
        skippedReasons.push("Pauta exige processo com 1 expediente.");
        return;
      }

      if (phrase === pautaPhrase && grau === "1") {
        skippedReasons.push("Pauta de Julgamento exige processo de 2o Grau.");
        return;
      }

      if (phrase === negociacaoPhrase && grau === "2") {
        skippedReasons.push("Negociacao Assincrona exige processo de 1o Grau.");
        return;
      }

      keptPhrases.push(phrase);
      keptLabels.push(labels[index] || phrase);
    });

    return {
      phrases: keptPhrases,
      labels: keptLabels,
      skippedPauta: skippedReasons.some((reason) => reason.indexOf("Pauta") >= 0),
      skippedReasons: skippedReasons,
    };
  }

  async function openTabsForRowWithExpedienteContentFilter(row) {
    const filters = currentExpedienteContentFilters();
    const plan = buildOpenPlanForRow(row);
    const tribunal = rowTribunalText(row);
    plan.tribunal = tribunal;
    plan.grau = inferGrauFromText(tribunal);
    const group = buildFilteredExpedienteGroupFromPlan(plan);

    if (!filters.phrases.length) return openTabsForRow(row);

    const effectiveFilters = effectiveExpedienteContentFilters(filters, plan.expedienteCount, plan);
    if (!effectiveFilters.phrases.length) {
      log(
        "Filtro de expediente pulou linha por criterio interno: " +
          plan.label +
          ". " +
          (effectiveFilters.skippedReasons || []).join(" ")
      );
      return { blocked: 0, opened: 0, pendenciaOpened: 0, expedientesOpened: 0 };
    }

    if (!group.pendencyUrl) {
      log("Filtro de expediente sem URL de pendencia: " + plan.label + ".", "error");
      return { blocked: 1, opened: 0, pendenciaOpened: 0, expedientesOpened: 0 };
    }

    if (!group.expedientes.length) {
      log("Filtro de expediente pulou linha sem expediente: " + plan.label + ".");
      return { blocked: 0, opened: 0, pendenciaOpened: 0, expedientesOpened: 0 };
    }

    log(
      "Filtro de expediente ativo (" +
        effectiveFilters.labels.join(" ou ") +
        "): analisando " +
        plan.label +
        "."
    );

    const response = await openFilteredExpedienteThroughExtension(group, effectiveFilters.phrases);
    if (!response || !response.ok) {
      log(
        "Filtro de expediente falhou em " +
          plan.label +
          ": " +
          (response && response.error ? response.error : "sem resposta da extensao") +
          ".",
        "error"
      );
      return { blocked: 1, opened: 0, pendenciaOpened: 0, expedientesOpened: 0 };
    }

    if (response.kept) {
      log(
        "Filtro de expediente manteve " +
          response.kept +
          " expediente(s) e a pendencia: " +
          plan.label +
          ".",
        "ok"
      );
    } else {
      log("Filtro de expediente fechou pendencia sem frase encontrada: " + plan.label + ".");
    }

    if (response.results && response.results.length) {
      response.results.forEach((item) => {
        if (item.kept && item.uncertain) {
          log(
            "Expediente mantido para conferencia porque a leitura do PDF foi inconclusiva: " +
              (item.label || "Expediente") +
              ".",
            "error"
          );
        } else if (item.kept) {
          log("Frase encontrada em: " + (item.label || "Expediente") + ".", "ok");
        } else if (item.error) {
          log("Nao foi possivel ler " + (item.label || "Expediente") + ": " + item.error + ".", "error");
        } else {
          log("Frase nao encontrada em: " + (item.label || "Expediente") + ".");
        }
      });
    }

    return {
      blocked: response.kept ? 0 : 0,
      opened: response.kept ? response.kept + 1 : 0,
      pendenciaOpened: response.kept ? 1 : 0,
      expedientesOpened: response.kept || 0,
    };
  }

  async function openPreparedTask(task) {
    if (!task) return false;

    if (task.preferUrl && task.url && (await openUrlInBackground(task.url))) {
      return true;
    }

    if (task.element && (await openElementInBackground(task.element))) {
      return true;
    }

    if (task.url && (await openUrlInBackground(task.url))) {
      return true;
    }

    return false;
  }

  async function openTabsForRow(row) {
    let blocked = 0;
    let opened = 0;
    let pendenciaOpened = 0;
    let expedientesOpened = 0;
    const plan = buildOpenPlanForRow(row);

    if (!plan.hasPendencia) {
      log("Pendencia nao encontrada: " + plan.label, "error");
    }

    if (!plan.expedienteCount) {
      log("Sem expediente visivel: " + plan.label);
    }

    for (const task of plan.tasks) {
      if (state.stopped) break;

      if (await openPreparedTask(task)) {
        opened += 1;
        if (task.kind === "pendency") {
          pendenciaOpened += 1;
          log("Pendencia acionada para abrir em segundo plano: " + plan.label, "ok");
        } else {
          expedientesOpened += 1;
          log(task.label + " acionado para abrir em segundo plano.", "ok");
        }
      } else {
        blocked += 1;
        log(task.label + " nao abriu. Verifique se o navegador bloqueou pop-ups.", "error");
      }

      await sleep(CONFIG.delayTabMs);
    }

    return {
      blocked: blocked,
      opened: opened,
      pendenciaOpened: pendenciaOpened,
      expedientesOpened: expedientesOpened,
    };
  }

  async function openTabsCurrentPage(limit, processedProcessKeys) {
    const pageRows = rows();
    const pageProcesses = rowsByProcess(pageRows);
    const seen = processedProcessKeys || new Set();
    let count = 0;
    let blocked = 0;

    log(
      "Abrindo abas de " +
        pageProcesses.length +
        " numero(s) de processo (" +
        pageRows.length +
        " pendencia(s) visiveis)."
    );

    for (const processItem of pageProcesses) {
      if (state.stopped) break;
      if (limit && count >= limit) break;
      if (seen.has(processItem.key)) continue;

      seen.add(processItem.key);
      const label = processLogLabel(processItem.key, processItem.rows);
      let processOpened = 0;
      log("Abrindo processo " + label + " (" + processItem.rows.length + " pendencia(s)).");

      for (const row of processItem.rows) {
        if (state.stopped) break;

        const result = await openTabsForRowWithExpedienteContentFilter(row);
        blocked += result.blocked;
        processOpened += result.opened;
      }

      if (processOpened) {
        count += 1;
        log("Processo contabilizado na abertura de abas: " + label + ".", "ok");
      } else {
        log("Processo sem abas acionadas: " + label + ".", "error");
      }
    }

    if (blocked) {
      log(
        "Algumas abas foram bloqueadas. Autorize pop-ups para spa.pge.mt.gov.br e rode novamente.",
        "error"
      );
    }

    return count;
  }

  async function openBatchOpenPlan(plan) {
    let blocked = 0;
    let opened = 0;

    if (!plan.hasPendencia) {
      log("Pendencia nao encontrada no lote: " + plan.label, "error");
    }

    if (!plan.expedienteCount) {
      log("Sem expediente visivel no lote: " + plan.label);
    }

    for (const task of plan.tasks || []) {
      if (state.stopped) break;

      if (task.url && (await openUrlInBackground(task.url))) {
        opened += 1;
        if (task.kind === "pendency") {
          log("Pendencia acionada pelo lote: " + plan.label, "ok");
        } else {
          log(task.label + " acionado pelo lote.", "ok");
        }
      } else {
        blocked += 1;
        log((task.label || "Aba") + " nao abriu pelo lote.", "error");
      }

      await sleep(CONFIG.delayTabMs);
    }

    return {
      blocked: blocked,
      opened: opened,
    };
  }

  async function openTabsForBatchRow(rowRecord) {
    const plan = rowRecord.openPlan || { label: rowRecord.label, tasks: [] };
    const row = findRowForBatchRecord(rowRecord);

    if (row) return openTabsForRowWithExpedienteContentFilter(row);

    log("Linha do lote nao encontrada para abrir abas: " + rowRecord.label + ".", "error");
    if (currentExpedienteContentFilters().phrases.length) {
      return {
        blocked: 1,
        opened: 0,
      };
    }
    return openBatchOpenPlan(plan);
  }

  async function openTabsPreparedBatch(limit) {
    const batch = state.pageBatch;
    let total = 0;
    let blocked = 0;
    const processedProcessKeys = new Set();

    for (const page of batch.pages || []) {
      if (state.stopped) break;
      await goToPageNumber(page.pageNumber);
      await expandGroupsIfPresent();
      log("Fase abas, lote pagina " + page.pageNumber + ".");

      for (const processItem of page.processes || []) {
        if (state.stopped) break;
        if (limit && total >= limit) break;
        if (processedProcessKeys.has(processItem.key)) continue;

        processedProcessKeys.add(processItem.key);
        let processOpened = 0;
        log("Abrindo processo do lote " + processItem.label + " (" + processItem.rows.length + " pendencia(s)).");

        for (const rowRecord of processItem.rows) {
          if (state.stopped) break;

          const result = await openTabsForBatchRow(rowRecord);
          blocked += result.blocked;
          processOpened += result.opened;
        }

        if (processOpened) {
          total += 1;
          log("Processo contabilizado na abertura de abas pelo lote: " + processItem.label + ".", "ok");
        } else {
          log("Processo do lote sem abas acionadas: " + processItem.label + ".", "error");
        }
      }

      if (limit && total >= limit) {
        log("Limite de abertura de abas atingido (" + limit + ").");
        break;
      }
    }

    if (blocked) {
      log(
        "Algumas abas do lote nao abriram. Verifique permissao de pop-ups e a comunicacao da extensao.",
        "error"
      );
    }

    return total;
  }

  async function openTabsAllPages(limit) {
    guardStart();
    try {
      limit = normalizeLimit(limit);
      logActionLimit(limit);
      logCustomFilters();
      setStatus("Abrindo pendencias e expedientes...");
      await setPageLength();
      await applyDateFilterIfNeeded();

      let total = 0;
      if (state.pageBatch) {
        logPageScope(state.pageBatch.selectedPages, state.pageBatch.totalPages);
        total = await openTabsPreparedBatch(limit);
      } else {
        const pageInfo = tablePageInfo();
        loadStoredPageSelection(pageInfo.total);
        updatePageSelectionControls();
        const pages = targetPageNumbers(pageInfo.total);
        const processedProcessKeys = new Set();

        logPageScope(pages, pageInfo.total);

        for (const pageNumber of pages) {
          if (state.stopped) break;

          await goToPageNumber(pageNumber);
          await expandGroupsIfPresent();
          log("Fase abas, pagina " + pageNumber + ".");
          const remaining = limit ? Math.max(0, limit - total) : 0;
          const pageTotal = await openTabsCurrentPage(remaining, processedProcessKeys);
          total += pageTotal;

          if (limit && total >= limit) {
            log("Limite de abertura de abas atingido (" + limit + ").");
            break;
          }
        }
      }

      log("Fase de abas concluida. Processos visitados: " + total + ".", "ok");
      setStatus("Abas concluidas: " + total);
    } catch (error) {
      log("Erro na fase de abas: " + error.message, "error");
      setStatus("Erro na fase de abas");
    } finally {
      state.running = false;
    }
  }

  function normalizeDateOnly(value) {
    const text = normalizeText(value);
    const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return match ? match[1] + "/" + match[2] + "/" + match[3] : text;
  }

  function addUniqueText(list, value) {
    const text = normalizeText(value);
    if (!text) return;
    if (text === "00" || text === "0") return;
    if (list.indexOf(text) < 0) list.push(text);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isSpaCdspDarkMode() {
    return Boolean(
      document.documentElement &&
        document.documentElement.classList &&
        document.documentElement.classList.contains("cdsp-spa-dark-mode")
    );
  }

  function reportTheme() {
    if (isSpaCdspDarkMode()) {
      return {
        overlayBg: "rgba(2,6,18,.74)",
        modalBg: "var(--cdsp-surface,#0b1730)",
        bodyBg: "var(--cdsp-bg-soft,#071226)",
        text: "var(--cdsp-text,#f4f8ff)",
        headerBg: "#111820",
        headerText: "#ffffff",
        headerSubtle: "var(--cdsp-text-soft,#bdc9dd)",
        cardBg: "var(--cdsp-surface-2,#101f3b)",
        cardAltBg: "var(--cdsp-surface-3,#152a52)",
        cardBorder: "var(--cdsp-border-soft,#183158)",
        border: "var(--cdsp-border,#254b86)",
        softBorder: "var(--cdsp-border-soft,#183158)",
        label: "var(--cdsp-text-soft,#bdc9dd)",
        muted: "var(--cdsp-muted,#8f9db5)",
        title: "var(--cdsp-text,#f4f8ff)",
        chipBg: "rgba(127,208,255,.12)",
        chipBorder: "rgba(127,208,255,.28)",
        chipText: "var(--cdsp-text-soft,#bdc9dd)",
        summaryBg: "rgba(127,208,255,.12)",
        summaryValidatedBg: "rgba(148,203,208,.14)",
        warningBg: "var(--cdsp-warning-bg,#3a2e19)",
        warningText: "var(--cdsp-text,#f4f8ff)",
        danger: "#ffb4b4",
        selectBg: "#f8fbff",
        selectText: "#10243a",
        selectBorder: "#7aa7ff",
        selectOptionBg: "#ffffff",
        selectOptionText: "#10243a",
        shadow: "0 22px 70px rgba(0,0,0,.58)",
        rowShadow: "0 1px 4px rgba(0,0,0,.25)",
      };
    }

    return {
      overlayBg: "rgba(8,16,24,.58)",
      modalBg: "#f4f7fb",
      bodyBg: "#f4f7fb",
      text: "#1f2d3a",
      headerBg: "#17212b",
      headerText: "#ffffff",
      headerSubtle: "#b8c7d5",
      cardBg: "#ffffff",
      cardAltBg: "#f7fafc",
      cardBorder: "#d7e0ea",
      border: "#d7e0ea",
      softBorder: "#edf1f6",
      label: "#4f6678",
      muted: "#607d8b",
      title: "#153040",
      chipBg: "#eef3f8",
      chipBorder: "#d7e0ea",
      chipText: "#4f6678",
      summaryBg: "#dbeaf7",
      summaryValidatedBg: "#edf2f7",
      warningBg: "#fff8e1",
      warningText: "#1f2d3a",
      danger: "#9f1d1d",
      selectBg: "#ffffff",
      selectText: "#1f2d3a",
      selectBorder: "#c5d1dd",
      selectOptionBg: "#ffffff",
      selectOptionText: "#1f2d3a",
      shadow: "0 22px 70px rgba(0,0,0,.42)",
      rowShadow: "0 1px 3px rgba(0,0,0,.06)",
    };
  }

  function reportChipHtml(text, theme) {
    return (
      '<span style="display:inline-block;background:' +
      theme.chipBg +
      ";border:1px solid " +
      theme.chipBorder +
      ";color:" +
      theme.chipText +
      ';border-radius:999px;padding:2px 6px;margin:0 4px 4px 0;">' +
      escapeHtml(text) +
      "</span>"
    );
  }

  function rowMarkerLabels(row) {
    const labels = [];
    const markerCell = row.children[1] || null;
    const roots = markerCell ? [markerCell] : [];
    if (!roots.length) roots.push(row);

    roots.forEach((root) => {
      root
        .querySelectorAll(
          ".zmdi-marker, .icon-marker-style, .text-marker, .span-marker-name, [title], [data-original-title], [data-full-text], [aria-label], .badge, .label"
        )
        .forEach((element) => {
          addUniqueText(labels, element.getAttribute("title"));
          addUniqueText(labels, element.getAttribute("data-original-title"));
          addUniqueText(labels, element.getAttribute("data-full-text"));
          addUniqueText(labels, element.getAttribute("aria-label"));
          addUniqueText(labels, element.textContent);
        });
      addUniqueText(labels, root.textContent);
    });

    return labels.filter((label) => {
      const normalized = normalizeText(label).toLowerCase();
      return normalized !== "visualizar anotacoes" && normalized !== "visualizar anotações";
    });
  }

  function reportTaskFromOpenTask(task) {
    const url = task.url || elementUrl(task.element);
    if (!url) return null;
    return {
      kind: task.kind,
      label: task.label,
      url: url,
    };
  }

  function uniqueReportTasks(tasks) {
    const seen = new Set();
    const unique = [];

    (tasks || []).forEach((task) => {
      const url = resolveUrl(task && task.url);
      if (!url) return;

      const key = task.kind + "|" + url;
      if (seen.has(key)) return;

      seen.add(key);
      unique.push({
        kind: task.kind,
        label: task.label,
        url: url,
      });
    });

    return unique;
  }

  function duplicateReportDisplayText(value, fallback) {
    return compactRepeatedText(String(value || "").replace(/\s+/g, " ").trim()) || fallback || "";
  }

  function duplicateReportColumnText(row, columnNames, fallback) {
    return duplicateReportDisplayText(rowColumnText(row, columnNames), fallback || "");
  }

  function duplicateReportManifestationText(row) {
    return duplicateReportColumnText(
      row,
      [
        "manisfestacao sugerida",
        "manisfestação sugerida",
        "manifestacao sugerida",
        "manifestação sugerida",
        "manifestacao_sugerida",
        "manifestação_sugerida",
        "manifestacao-sugerida",
        "manifestação-sugerida",
        "manifestacao",
        "manifestação",
        "manifestation",
      ],
      "Sem manifestação sugerida"
    );
  }

  function isDuplicateReportExcludedLastProgress(value) {
    const text = normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return (
      text.indexOf("minutac da ses enviada ao a procurador a") >= 0 ||
      text.indexOf("minuta da ses enviada ao a procurador a") >= 0
    );
  }

  function isDuplicateReportSesProcessText(value) {
    const text = normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const padded = " " + text + " ";

    return (
      padded.indexOf(" ses ") >= 0 ||
      text.indexOf("sesdic") >= 0 ||
      text.indexOf("sesofi") >= 0 ||
      text.indexOf("sesmt") >= 0 ||
      text.indexOf("ciaps") >= 0 ||
      text.indexOf("juntada ses") >= 0 ||
      text.indexOf("juntada da ses") >= 0 ||
      text.indexOf("minutac da ses") >= 0 ||
      text.indexOf("minuta da ses") >= 0 ||
      text.indexOf("informacao da ses") >= 0 ||
      text.indexOf("informacoes da ses") >= 0 ||
      text.indexOf("secretaria de estado de saude") >= 0 ||
      text.indexOf("secretaria estadual de saude") >= 0
    );
  }

  function rowIsDuplicateReportSesProcess(row) {
    return isDuplicateReportSesProcessText(rowSearchText(row));
  }

  function groupHasDuplicateReportSesProcess(groupRow, items) {
    if (groupRow && rowIsDuplicateReportSesProcess(groupRow)) return true;
    return (items || []).some(rowIsDuplicateReportSesProcess);
  }

  function duplicateReportPjeDeadlineText(row) {
    const element = rowDeadlineElement(row);
    const raw = [
      deadlineText(row, element),
      rowColumnText(row, [
        "prazo do pje",
        "prazo pje",
        "prazo spa",
        "prazo no spa",
        "deadline",
        "prazo",
      ]),
    ].join(" ");
    const clean = duplicateReportDisplayText(raw, "");
    const match = clean.match(/(\d{2}\/\d{2}\/\d{4})(?:\s*-\s*(\d{2}:\d{2}))?/);
    if (match) return match[1] + (match[2] ? " - " + match[2] : "");
    return clean || "Sem prazo";
  }

  function duplicateComparableText(value) {
    const text = normalizeText(duplicateReportDisplayText(value, ""))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (
      !text ||
      text === "sem informacao" ||
      text === "sem manifestacao" ||
      text === "sem prazo" ||
      text === "sem data" ||
      text === "sem assunto" ||
      text === "sem etiqueta"
    ) {
      return "";
    }
    return text;
  }

  function duplicateIdentityParts(record) {
    return [
      { label: "assunto", value: record.assunto },
      { label: "manifestacao", value: record.manifestationSuggested },
      { label: "prazo PJE", value: record.pjeDeadline },
      { label: "distribuicao", value: record.distributionDate },
      { label: "ultimo andamento", value: record.lastProgress },
      { label: "jurisdicao", value: record.jurisdiction },
    ].map((part) => ({
      label: part.label,
      value: duplicateComparableText(part.value),
    }));
  }

  function duplicateIdentityKey(record) {
    const parts = duplicateIdentityParts(record);
    const subject = parts.find((part) => part.label === "assunto");
    const evidence = parts.filter((part) => part.value);
    if (!subject || subject.value.length < 10 || evidence.length < 3) return "";
    return parts.map((part) => part.value || "-").join("|");
  }

  function duplicateIdentityEvidence(record) {
    return duplicateIdentityParts(record)
      .filter((part) => part.value)
      .map((part) => part.label)
      .join(", ");
  }

  function analyzeDuplicateReportGroup(group) {
    const byIdentity = new Map();

    group.records.forEach((record) => {
      record.contentDuplicate = false;
      record.contentDuplicateGroup = "";
      record.contentDuplicateEvidence = "";

      const key = duplicateIdentityKey(record);
      if (!key) return;
      if (!byIdentity.has(key)) byIdentity.set(key, []);
      byIdentity.get(key).push(record);
    });

    let duplicateGroups = 0;
    let duplicateRecords = 0;
    byIdentity.forEach((records) => {
      if (records.length < 2) return;
      duplicateGroups += 1;
      duplicateRecords += records.length;
      records.forEach((record) => {
        record.contentDuplicate = true;
        record.contentDuplicateGroup = String(duplicateGroups);
        record.contentDuplicateEvidence = duplicateIdentityEvidence(record);
      });
    });

    group.contentDuplicateGroups = duplicateGroups;
    group.contentDuplicateRecords = duplicateRecords;
    group.contentDuplicate = duplicateGroups > 0;
  }

  function duplicateReportPdfSeed(record) {
    const subject = duplicateComparableText(record && record.assunto);
    if (!subject || subject.length < 10 || subject === "sem assunto") return "";
    return subject;
  }

  function duplicateReportPdfCandidates(group) {
    const records = (group.records || []).filter((record) => {
      return record && record.expedienteUrls && record.expedienteUrls.length;
    });
    return records.length >= 2 ? records : [];
  }

  function markDuplicateReportPdfMatches(group, resultsById) {
    const byFingerprint = new Map();

    duplicateReportPdfCandidates(group).forEach((record) => {
      const result = resultsById.get(record.pdfFingerprintRequestId || "");
      record.pdfFingerprintError = result && result.error ? result.error : "";
      record.pdfTextLength = result && result.textLength ? result.textLength : 0;
      if (!result || !result.ok || !result.fingerprint) return;

      record.pdfFingerprint = result.fingerprint;
      if (!byFingerprint.has(result.fingerprint)) byFingerprint.set(result.fingerprint, []);
      byFingerprint.get(result.fingerprint).push(record);
    });

    let pdfGroups = 0;
    byFingerprint.forEach((records) => {
      if (records.length < 2) return;
      pdfGroups += 1;
      records.forEach((record) => {
        record.contentDuplicate = true;
        record.contentDuplicateGroup = record.contentDuplicateGroup || "PDF " + pdfGroups;
        record.contentDuplicateEvidence = record.contentDuplicateEvidence
          ? record.contentDuplicateEvidence + "; texto integral do expediente/PDF"
          : "texto integral do expediente/PDF";
        record.pdfContentDuplicate = true;
        record.pdfContentDuplicateGroup = String(pdfGroups);
      });
    });

    if (pdfGroups) {
      group.pdfDuplicateGroups = pdfGroups;
      group.contentDuplicateGroups = (normalizeLimit(group.contentDuplicateGroups) || 0) + pdfGroups;
      group.contentDuplicateRecords = (group.records || []).filter((record) => record.contentDuplicate).length;
      group.contentDuplicate = group.contentDuplicateRecords > 0;
    }
  }

  async function enrichDuplicateReportWithPdfFingerprints(report) {
    const payload = [];

    (report.groups || []).forEach((group, groupIndex) => {
      duplicateReportPdfCandidates(group).forEach((record) => {
        const id = "g" + groupIndex + "-r" + record.index;
        record.pdfFingerprintRequestId = id;
        payload.push({
          id: id,
          expedienteUrls: record.expedienteUrls || [],
        });
      });
    });

    if (!payload.length) return;

    log("Conferindo texto de " + payload.length + " expediente(s) para duplicidade real.");
    setStatus("Conferindo PDFs...");

    const response = await requestExtensionMessage(
      "SPA_CDSP_FINGERPRINT_EXPEDIENTES",
      { records: payload },
      Math.max(90000, payload.length * 6000)
    );

    if (!response || !response.ok) {
      log(
        "Nao foi possivel conferir PDFs no relatorio de duplicados: " +
          (response && response.error ? response.error : "sem resposta da extensao") +
          ".",
        "error"
      );
      return;
    }

    const resultsById = new Map();
    (response.results || []).forEach((result) => {
      if (result && result.id) resultsById.set(result.id, result);
    });

    (report.groups || []).forEach((group) => {
      markDuplicateReportPdfMatches(group, resultsById);
    });
  }

  function duplicateReportRecord(row, index) {
    const info = rowInfo(row);
    const plan = buildOpenPlanForRow(row);
    const tasks = uniqueReportTasks(plan.tasks.map(reportTaskFromOpenTask).filter(Boolean));
    const expedienteTasks = tasks.filter((task) => task.kind === "expediente");
    const pendencyTask = tasks.find((task) => task.kind === "pendency") || null;
    const assunto = rowColumnText(row, ["assunto(s) do tj"]) || info.assunto || "";
    const expedienteId = rowColumnText(row, ["id do expediente"]) || rowExpedienteId(row) || info.id || "";
    const lastProgress = rowColumnText(row, [
      "ultimo andamento",
      "último andamento",
      "ultima andamento",
      "última andamento",
    ]);
    if (isDuplicateReportExcludedLastProgress(lastProgress)) return null;

    const assessor = rowColumnText(row, [
      "assessor(a)",
      "assessor",
      "assessor(a) especial",
      "assessor(a) responsavel",
      "assessor(a) responsável",
    ]);

    return {
      index: index,
      rowKey: rowProcedureKey(row),
      expedienteId: duplicateReportDisplayText(expedienteId, "Sem ID"),
      labels: rowMarkerLabels(row),
      assunto: duplicateReportDisplayText(assunto, "Sem assunto"),
      manifestationSuggested: duplicateReportManifestationText(row),
      distributionDate: normalizeDateOnly(rowColumnText(row, ["data da distribuicao", "data da distribuição"])),
      pjeDeadline: duplicateReportPjeDeadlineText(row),
      jurisdiction: duplicateReportColumnText(row, ["jurisdicao", "jurisdição"], ""),
      lastProgress: duplicateReportDisplayText(lastProgress, "Sem informação"),
      assessor: duplicateReportDisplayText(assessor, "Sem informação"),
      validated: rowHasDuplicidadeValidadaMarker(row),
      tasks: tasks,
      expedienteUrls: expedienteTasks.map((task) => task.url).filter(Boolean),
      pendencyUrl: pendencyTask ? pendencyTask.url : "",
      expedienteCount: expedienteTasks.length,
    };
  }

  function duplicateReportRecordKey(record) {
    return (
      normalizeText(record.rowKey) ||
      normalizeText(record.pendencyUrl) ||
      normalizeText(record.expedienteId) ||
      normalizeText(record.assunto + "|" + record.distributionDate)
    );
  }

  function mergeDuplicateReportRows(groupsByKey, key, processNumber, label, processRows) {
    const cleanKey = normalizeText(key || processNumber || label);
    if (!cleanKey || !processRows || !processRows.length) return;

    let group = groupsByKey.get(cleanKey);
    if (!group) {
      group = {
        key: cleanKey,
        processNumber: normalizeText(processNumber) || cleanKey,
        label: normalizeText(label) || cleanKey,
        duplicateCount: 0,
        records: [],
        recordKeys: new Set(),
      };
      groupsByKey.set(cleanKey, group);
    }

    processRows.forEach((row) => {
      const record = duplicateReportRecord(row, group.records.length + 1);
      if (!record) return;
      const recordKey = duplicateReportRecordKey(record);
      if (recordKey && group.recordKeys.has(recordKey)) return;

      if (recordKey) group.recordKeys.add(recordKey);
      group.records.push(record);
    });

    group.duplicateCount = Math.max(group.duplicateCount, group.records.length);
  }

  function finalizeDuplicateReportGroups(groupsByKey, includeValidated) {
    const groups = [];
    let skippedValidated = 0;

    groupsByKey.forEach((group) => {
      if (group.records.length < 2) return;

      group.records.forEach((record, index) => {
        record.index = index + 1;
      });
      analyzeDuplicateReportGroup(group);

      const validatedRecordCount = group.records.filter((record) => record.validated).length;
      const hasValidatedRecords = validatedRecordCount > 0;
      const allValidated = hasValidatedRecords && validatedRecordCount === group.records.length;

      if (allValidated && !includeValidated) {
        skippedValidated += 1;
        return;
      }

      groups.push({
        key: group.key,
        processNumber: group.processNumber,
        label: group.label,
        duplicateCount: Math.max(group.duplicateCount, group.records.length),
        validated: allValidated,
        allValidated: allValidated,
        hasValidatedRecords: hasValidatedRecords,
        validatedRecordCount: validatedRecordCount,
        contentDuplicate: group.contentDuplicate,
        contentDuplicateGroups: group.contentDuplicateGroups || 0,
        contentDuplicateRecords: group.contentDuplicateRecords || 0,
        records: group.records,
      });
    });

    groups.sort((a, b) => normalizeText(a.processNumber).localeCompare(normalizeText(b.processNumber)));

    return {
      groups: groups,
      scanned: groupsByKey.size,
      skippedValidated: skippedValidated,
    };
  }

  async function collectDuplicateReportCurrentPage(groupsByKey) {
    let scanned = 0;
    let skippedSes = 0;
    const duplicateRows = groupRows().filter(isDuplicateProcessGroup);

    if (duplicateRows.length) {
      for (const groupRow of duplicateRows) {
        if (state.stopped) break;

        const label = groupLabel(groupRow);
        const processNumber = groupProcessNumber(groupRow) || label;
        const items = (await expandGroup(groupRow)).filter(rowMatchesAllFilters);
        if (!items.length) continue;

        scanned += 1;
        if (groupHasDuplicateReportSesProcess(groupRow, items)) {
          skippedSes += 1;
          log("Relatorio de duplicados ignorou processo da SES: " + (processNumber || label) + ".");
          continue;
        }
        mergeDuplicateReportRows(
          groupsByKey,
          processNumber || label,
          processNumber,
          label,
          items
        );
      }

      return {
        scanned: scanned,
        skippedSes: skippedSes,
      };
    }

    const pageProcesses = rowsByProcess(rows());
    pageProcesses.forEach((processItem) => {
      if (!processItem.key || !processItem.rows.length) return;
      scanned += 1;
      if (processItem.rows.some(rowIsDuplicateReportSesProcess)) {
        skippedSes += 1;
        log("Relatorio de duplicados ignorou processo da SES: " + processItem.key + ".");
        return;
      }
      mergeDuplicateReportRows(
        groupsByKey,
        processItem.key,
        processItem.key,
        processLogLabel(processItem.key, processItem.rows),
        processItem.rows
      );
    });

    return {
      scanned: scanned,
      skippedSes: skippedSes,
    };
  }

  async function buildDuplicateReport(includeValidated) {
    guardStart();
    try {
      includeValidated = Boolean(includeValidated);
      setStatus("Gerando relatorio...");
      log("Gerando relatorio de duplicados" + (includeValidated ? " com conferidos." : "."));
      await setPageLength();
      await applyDateFilterIfNeeded();
      const pageInfo = tablePageInfo();
      if (!state.pageBatch) {
        loadStoredPageSelection(pageInfo.total);
        updatePageSelectionControls();
      }
      const pages = state.pageBatch
        ? normalizePageNumbers(state.pageBatch.selectedPages, pageInfo.total)
        : targetPageNumbers(pageInfo.total);
      logPageScope(pages, pageInfo.total);

      const report = {
        includeValidated: includeValidated,
        generatedAt: new Date(),
        groups: [],
        scanned: 0,
        skippedValidated: 0,
        skippedSes: 0,
        pages: 0,
      };
      const groupsByKey = new Map();

      for (const pageNumber of pages) {
        if (state.stopped) break;

        await goToPageNumber(pageNumber);
        log("Relatorio de duplicados, pagina " + pageNumber + ".");
        const pageReport = await collectDuplicateReportCurrentPage(groupsByKey);
        report.pages += 1;
        report.skippedSes += pageReport.skippedSes || 0;
        log("Relatorio analisou " + pageReport.scanned + " numero(s) de processo nesta pagina.");
      }

      const finalReport = finalizeDuplicateReportGroups(groupsByKey, includeValidated);
      report.groups = finalReport.groups;
      report.scanned = finalReport.scanned;
      report.skippedValidated = finalReport.skippedValidated;

      await enrichDuplicateReportWithPdfFingerprints(report);
      showDuplicateReport(report);
      log("Relatorio de duplicados gerado: " + report.groups.length + " grupo(s) exibido(s).", "ok");
      setStatus("Relatorio pronto");
    } catch (error) {
      log("Erro no relatorio de duplicados: " + error.message, "error");
      setStatus("Erro no relatorio");
    } finally {
      state.running = false;
    }
  }

  async function openDuplicateReportRecord(record, openedUrls) {
    if (!record) return false;

    if (record.validated) {
      log(
        "Atencao: abrindo item com etiqueta '" +
          CONFIG.duplicidadeValidadaMarkerText +
          "': expediente " +
          record.expedienteId +
          "."
      );
    }

    let opened = 0;
    const seenUrls = openedUrls || new Set();
    for (const task of record.tasks || []) {
      if (state.stopped) break;
      const taskUrl = resolveUrl(task.url);
      if (!taskUrl) {
        log("Relatorio duplicados sem URL para " + task.label + " do expediente " + record.expedienteId + ".", "error");
        continue;
      }

      if (seenUrls.has(taskUrl)) {
        log("Relatorio duplicados ignorou URL repetida: " + task.label + " do expediente " + record.expedienteId + ".");
        continue;
      }

      seenUrls.add(taskUrl);
      if (await openUrlInBackground(taskUrl)) {
        opened += 1;
        log("Relatorio duplicados abriu " + task.label + " do expediente " + record.expedienteId + ".", "ok");
      } else {
        log("Relatorio duplicados nao abriu " + task.label + " do expediente " + record.expedienteId + ".", "error");
      }
      await sleep(CONFIG.delayTabMs);
    }
    return opened > 0;
  }

  async function openDuplicateReportGroup(group) {
    if (!group) return;

    if (group.validated) {
      log(
        "Atencao: abrindo grupo com etiqueta '" +
          CONFIG.duplicidadeValidadaMarkerText +
          "': " +
          group.processNumber +
          "."
      );
    }

    const openedUrls = new Set();
    for (const record of group.records || []) {
      if (state.stopped) break;
      await openDuplicateReportRecord(record, openedUrls);
    }
  }

  async function validateDuplicateReportRecords(records) {
    const payload = (Array.isArray(records) ? records : [records]).filter((record) => record && record.pendencyUrl);
    if (!payload.length) {
      throw new Error("Nenhuma pendencia com URL foi encontrada para validar.");
    }

    const response = await validateDuplicateRecordsThroughExtension(payload);
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "A extensão não validou os registros.");
    }

    (response.results || []).forEach((result) => {
      if (result.ok) {
        log("Marcador Conferido aplicado: " + (result.label || "pendencia") + ".", "ok");
      } else {
        log(
          "Falha ao aplicar Conferido em " +
            (result.label || "pendencia") +
            ": " +
            (result.error || "sem detalhe") +
            ".",
          "error"
        );
      }
    });

    if (response.failed) {
      throw new Error(response.failed + " pendencia(s) nao receberam o marcador Conferido.");
    }

    return response;
  }

  async function validateDuplicateReportRecord(record) {
    if (!record) return;
    await validateDuplicateReportRecords([record]);
  }

  async function validateDuplicateReportGroup(group) {
    if (!group) return;
    await validateDuplicateReportRecords(group.records || []);
  }

  async function runDuplicateReportOpening(label, action) {
    guardStart();
    try {
      setStatus(label);
      await action();
      setStatus("Relatorio pronto");
    } catch (error) {
      log("Erro ao abrir pelo relatorio: " + error.message, "error");
      setStatus("Erro no relatorio");
    } finally {
      state.running = false;
    }
  }

  async function runDuplicateReportValidation(label, action) {
    guardStart();
    try {
      setStatus(label);
      await action();
      setStatus("Relatorio pronto");
    } catch (error) {
      log("Erro ao validar pelo relatorio: " + error.message, "error");
      setStatus("Erro no relatorio");
      throw error;
    } finally {
      state.running = false;
    }
  }

  function duplicateReportSummary(report) {
    const records = report.groups.reduce((total, group) => total + group.records.length, 0);
    const validated = report.groups.filter((group) => group.allValidated).length;
    const partiallyValidated = report.groups.filter((group) => group.hasValidatedRecords && !group.allValidated).length;
    const validatedRecords = report.groups.reduce(
      (total, group) => total + (normalizeLimit(group.validatedRecordCount) || 0),
      0
    );
    const identicalGroups = report.groups.filter((group) => group.contentDuplicate).length;
    const identicalRecords = report.groups.reduce(
      (total, group) => total + (normalizeLimit(group.contentDuplicateRecords) || 0),
      0
    );
    return {
      groups: report.groups.length,
      records: records,
      identicalGroups: identicalGroups,
      identicalRecords: identicalRecords,
      validated: validated,
      partiallyValidated: partiallyValidated,
      validatedRecords: validatedRecords,
      skippedValidated: report.skippedValidated,
      skippedSes: report.skippedSes || 0,
      scanned: report.scanned,
    };
  }

  function createDuplicateReportButton(text, variant) {
    const button = createButton(text, function () {}, variant || "blue");
    button.style.minHeight = "30px";
    button.style.padding = "7px 10px";
    return button;
  }

  function showDuplicateReport(report) {
    const old = document.querySelector("#spa-cdsp-duplicate-report-overlay");
    if (old) old.remove();
    const theme = reportTheme();

    const overlay = document.createElement("div");
    overlay.id = "spa-cdsp-duplicate-report-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:1000001;background:" +
      theme.overlayBg +
      ";" +
      "display:flex;align-items:center;justify-content:center;padding:22px;font-family:Arial,sans-serif;";

    const modal = document.createElement("div");
    modal.style.cssText =
      "width:min(1440px,calc(100vw - 44px));max-height:calc(100vh - 44px);overflow:auto;" +
      "background:" +
      theme.modalBg +
      ";color:" +
      theme.text +
      ";border-radius:10px;box-shadow:" +
      theme.shadow +
      ";";

    const header = document.createElement("div");
    header.style.cssText =
      "position:sticky;top:0;z-index:2;background:" +
      theme.headerBg +
      ";color:" +
      theme.headerText +
      ";padding:14px 16px;" +
      "display:flex;align-items:center;gap:12px;border-radius:10px 10px 0 0;";

    const title = document.createElement("div");
    title.style.cssText = "flex:1;min-width:0;";
    title.innerHTML =
      '<div style="font-size:17px;font-weight:800;">Relatorio de processos duplicados</div>' +
      '<div style="font-size:12px;color:' +
      theme.headerSubtle +
      ';margin-top:3px;">Blocos por número do processo, com pendências duplicadas e ações de abertura.</div>';

    const includeLabel = document.createElement("label");
    includeLabel.style.cssText = "display:flex;align-items:center;gap:6px;font-size:12px;color:#e3f2fd;white-space:nowrap;";
    const includeCheckbox = document.createElement("input");
    includeCheckbox.type = "checkbox";
    includeCheckbox.checked = Boolean(report.includeValidated);
    const includeText = document.createElement("span");
    includeText.textContent = "Mostrar totalmente conferidos";
    includeLabel.appendChild(includeCheckbox);
    includeLabel.appendChild(includeText);

    const refresh = createDuplicateReportButton("Atualizar", "blue");
    const close = createDuplicateReportButton("Fechar", "gray");
    close.addEventListener("click", () => overlay.remove());
    refresh.addEventListener("click", () => {
      overlay.remove();
      buildDuplicateReport(includeCheckbox.checked);
    });
    includeCheckbox.addEventListener("change", () => {
      overlay.remove();
      buildDuplicateReport(includeCheckbox.checked);
    });

    header.appendChild(title);
    header.appendChild(includeLabel);
    header.appendChild(refresh);
    header.appendChild(close);

    const body = document.createElement("div");
    body.style.cssText = "padding:16px;";

    const summary = duplicateReportSummary(report);
    const summaryRow = document.createElement("div");
    summaryRow.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-bottom:14px;";
    [
      ["Duplicados exibidos", summary.groups],
      ["Pendencias", summary.records],
      ["Iguais detectados", summary.identicalGroups + " / " + summary.identicalRecords],
      ["Grupos escaneados", summary.scanned],
      ["Conferidos parciais", summary.partiallyValidated],
      ["Pend. conferidas", summary.validatedRecords],
      ["Totalmente conferidos", summary.validated],
      ["Conferidos ocultos", summary.skippedValidated],
      ["SES ignorados", summary.skippedSes],
    ].forEach((item) => {
      const card = document.createElement("div");
      card.style.cssText =
        "background:" +
        theme.cardBg +
        ";border-left:4px solid #286b83;border-radius:7px;padding:10px;box-shadow:" +
        theme.rowShadow +
        ";";
      card.innerHTML =
        '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:' +
        theme.label +
        ';font-weight:800;">' +
        item[0] +
        '</div><div style="font-size:24px;font-weight:800;margin-top:4px;">' +
        item[1] +
        "</div>";
      summaryRow.appendChild(card);
    });
    body.appendChild(summaryRow);

    if (!report.groups.length) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "background:" +
        theme.warningBg +
        ";color:" +
        theme.warningText +
        ";border-left:4px solid #f0a500;border-radius:8px;padding:14px;font-size:14px;";
      empty.textContent =
        report.skippedValidated > 0
          ? "Nao ha duplicados pendentes para exibir. Existem grupos totalmente marcados como Conferido ocultos pelo filtro."
          : report.skippedSes > 0
            ? "Nao ha duplicados pendentes para exibir. Processos da SES foram ignorados pela regra do relatorio."
          : "Nenhum processo duplicado foi encontrado com os filtros atuais.";
      body.appendChild(empty);
    }

    report.groups.forEach((group, groupIndex) => {
      const details = document.createElement("details");
      details.open = groupIndex < 6;
      const groupBorder = group.hasValidatedRecords ? "#dc2626" : group.pdfDuplicateGroups ? "#16a34a" : theme.cardBorder;
      const groupShadow = group.hasValidatedRecords
        ? "0 0 0 2px rgba(220,38,38,.20)"
        : group.pdfDuplicateGroups
          ? "0 0 0 2px rgba(22,163,74,.22)"
          : "none";
      details.style.cssText =
        "background:" +
        theme.cardBg +
        ";border:1px solid " +
        groupBorder +
        ";border-radius:8px;margin:10px 0;overflow:hidden;box-shadow:" +
        groupShadow +
        ";";

      const summaryElement = document.createElement("summary");
      const summaryBackground = group.hasValidatedRecords
        ? (isSpaCdspDarkMode() ? "rgba(220,38,38,.22)" : "#fee2e2")
        : group.contentDuplicate
          ? (isSpaCdspDarkMode() ? "rgba(34,197,94,.18)" : "#dff7e8")
          : theme.summaryBg;
      summaryElement.style.cssText =
        "cursor:pointer;list-style:none;padding:11px 13px;background:" +
        summaryBackground +
        ";display:flex;align-items:center;gap:10px;";

      const groupTitle = document.createElement("div");
      groupTitle.style.cssText = "flex:1;font-weight:800;color:" + theme.title + ";";
      groupTitle.textContent = group.processNumber;

      const badges = document.createElement("div");
      badges.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
      const countBadge = document.createElement("span");
      countBadge.style.cssText = "background:#1e88e5;color:#fff;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:800;";
      countBadge.textContent = group.records.length + " pendencia(s)";
      badges.appendChild(countBadge);

      if (group.contentDuplicate) {
        const identityBadge = document.createElement("span");
        identityBadge.style.cssText = "background:#15803d;color:#fff;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:900;text-transform:uppercase;";
        identityBadge.textContent =
          "Expedientes iguais: " +
          group.contentDuplicateRecords +
          " em " +
          group.contentDuplicateGroups +
          " grupo(s)";
        identityBadge.title = "Pendencias com metadados equivalentes ou texto de PDF identico.";
        badges.appendChild(identityBadge);
      }

      if (group.pdfDuplicateGroups) {
        const pdfBadge = document.createElement("span");
        pdfBadge.style.cssText = "background:#dcfce7;color:#14532d;border:1px solid #16a34a;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900;text-transform:uppercase;";
        pdfBadge.textContent = "PDF igual";
        pdfBadge.title = "Ao menos dois expedientes deste processo possuem texto de PDF idêntico.";
        badges.appendChild(pdfBadge);
      }

      if (group.hasValidatedRecords) {
        const validatedBadge = document.createElement("span");
        validatedBadge.style.cssText = "background:#dc2626;color:#fff;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:900;text-transform:uppercase;";
        validatedBadge.textContent = group.allValidated
          ? "Tudo conferido"
          : "Conferido " + group.validatedRecordCount + "/" + group.records.length;
        validatedBadge.title = group.allValidated
          ? "Todas as pendências deste processo estão marcadas como Conferido."
          : "O processo continua exibido porque nem todas as pendências estão marcadas como Conferido.";
        badges.appendChild(validatedBadge);
      }

      const openGroup = createDuplicateReportButton(
        group.allValidated ? "Abrir grupo conferido" : group.hasValidatedRecords ? "Abrir grupo com conferido" : "Abrir grupo",
        group.hasValidatedRecords ? "amber" : "purple"
      );
      openGroup.title = group.hasValidatedRecords
        ? "Abrir pendencias e expedientes deste grupo com marcação Conferido visível."
        : "Abrir pendencias e expedientes deste grupo.";
      openGroup.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        runDuplicateReportOpening("Abrindo grupo...", () => openDuplicateReportGroup(group)).catch((error) => {
          log("Erro ao abrir grupo do relatorio: " + error.message, "error");
        });
      });

      const validateGroup = createDuplicateReportButton("Validar todos", "teal");
      validateGroup.title = "Aplicar o marcador Conferido em todas as pendências deste grupo.";
      validateGroup.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const previous = validateGroup.textContent;
        validateGroup.textContent = "Validando...";
        validateGroup.disabled = true;
        runDuplicateReportValidation("Validando grupo...", () => validateDuplicateReportGroup(group))
          .then(() => {
            validateGroup.textContent = "Validado";
          })
          .catch((error) => {
            validateGroup.textContent = previous;
            validateGroup.disabled = false;
            log("Erro ao validar grupo do relatorio: " + error.message, "error");
          });
      });

      summaryElement.appendChild(groupTitle);
      summaryElement.appendChild(badges);
      summaryElement.appendChild(openGroup);
      summaryElement.appendChild(validateGroup);
      details.appendChild(summaryElement);

      const rowsWrapper = document.createElement("div");
      rowsWrapper.style.cssText = "padding:10px 12px 12px;background:" + theme.cardBg + ";";

      group.records.forEach((record) => {
        const row = document.createElement("div");
        const rowHighlight = record.validated
          ? (isSpaCdspDarkMode() ? "rgba(220,38,38,.18)" : "#fff1f2")
          : record.pdfContentDuplicate
          ? (isSpaCdspDarkMode() ? "rgba(34,197,94,.22)" : "#dcfce7")
          : record.contentDuplicate
            ? (isSpaCdspDarkMode() ? "rgba(34,197,94,.10)" : "#f0fbf4")
            : "transparent";
        row.style.cssText =
          "display:grid;grid-template-columns:96px .92fr 1.45fr 1.15fr 92px 105px 1.18fr .95fr 80px;gap:9px;align-items:start;" +
          "border-top:1px solid " +
          theme.softBorder +
          ";border-left:" +
          (record.validated
            ? "6px solid #dc2626"
            : record.pdfContentDuplicate
              ? "6px solid #16a34a"
              : record.contentDuplicate
                ? "4px solid #15803d"
                : "4px solid transparent") +
          ";background:" +
          rowHighlight +
          ";padding:10px 0 10px 8px;font-size:12px;color:" +
          theme.text +
          ";";

        const labels = record.labels.length ? record.labels : ["Sem etiqueta"];
        const identityChip = record.contentDuplicate
          ? reportChipHtml("Expedientes iguais #" + record.contentDuplicateGroup, theme) +
            '<div style="font-size:11px;color:' +
            theme.muted +
            ';line-height:1.25;margin-top:3px;">Conferencia: ' +
            escapeHtml(record.contentDuplicateEvidence || "conferidos") +
            "</div>"
          : "";
        const visibleLabels = record.validated
          ? labels.filter((label) => normalizeText(label).toLowerCase() !== normalizeText(CONFIG.duplicidadeValidadaMarkerText).toLowerCase())
          : labels;
        const validatedChip = record.validated
          ? '<span style="display:inline-block;background:#dc2626;color:#fff;border-radius:999px;padding:3px 7px;margin:2px 3px 2px 0;font-size:11px;font-weight:900;text-transform:uppercase;">Conferido</span>'
          : "";
        const labelHtml = validatedChip + visibleLabels.map((label) => reportChipHtml(label, theme)).join("") + identityChip;

        const validatedAction = record.validated;
        const action = createDuplicateReportButton(validatedAction ? "Abrir conferido" : "Abrir", validatedAction ? "amber" : "teal");
        action.title = validatedAction
          ? "Abrir esta pendencia e seus expedientes, mesmo com marcador Conferido."
          : "Abrir esta pendencia e seus expedientes.";
        action.addEventListener("click", () => {
          runDuplicateReportOpening("Abrindo pendencia...", () => openDuplicateReportRecord(record)).catch((error) => {
            log("Erro ao abrir item do relatorio: " + error.message, "error");
          });
        });

        const validateAction = createDuplicateReportButton(record.validated ? "Conferido" : "Validar", record.validated ? "gray" : "teal");
        validateAction.title = record.validated
          ? "Esta pendência já tem o marcador Conferido."
          : "Aplicar o marcador Conferido nesta pendência.";
        validateAction.disabled = Boolean(record.validated);
        validateAction.addEventListener("click", () => {
          const previous = validateAction.textContent;
          validateAction.textContent = "Validando...";
          validateAction.disabled = true;
          runDuplicateReportValidation("Validando pendencia...", () => validateDuplicateReportRecord(record))
            .then(() => {
              validateAction.textContent = "Conferido";
            })
            .catch((error) => {
              validateAction.textContent = previous;
              validateAction.disabled = false;
              log("Erro ao validar item do relatorio: " + error.message, "error");
            });
        });

        if (record.validated) {
          const validatedNotice = document.createElement("div");
          validatedNotice.style.cssText =
            "grid-column:1 / -1;background:#dc2626;color:#fff;border-radius:6px;padding:7px 9px;font-weight:900;" +
            "display:flex;align-items:center;justify-content:space-between;gap:8px;box-shadow:0 1px 4px rgba(0,0,0,.14);";
          validatedNotice.innerHTML =
            '<span>Pendência marcada como Conferido</span>' +
            '<span style="background:rgba(255,255,255,.18);border-radius:999px;padding:2px 7px;font-size:11px;">marcador ativo</span>';
          row.appendChild(validatedNotice);
        }

        if (record.contentDuplicate) {
          const pdfNotice = document.createElement("div");
          pdfNotice.style.cssText =
            "grid-column:1 / -1;background:#16a34a;color:#fff;border-radius:6px;padding:7px 9px;font-weight:900;" +
            "display:flex;align-items:center;justify-content:space-between;gap:8px;box-shadow:0 1px 4px rgba(0,0,0,.14);";
          pdfNotice.innerHTML =
            '<span>Expediente igual ao de outra pendência deste processo</span>' +
            '<span style="background:rgba(255,255,255,.18);border-radius:999px;padding:2px 7px;font-size:11px;">' +
            (record.pdfContentDuplicate ? "PDF/texto idêntico" : "metadados conferidos") +
            "</span>";
          row.appendChild(pdfNotice);
        }

        const cells = [
          '<strong>ID expediente</strong><br>' + escapeHtml(record.expedienteId),
          '<strong>Etiquetas</strong><br>' + labelHtml,
          '<strong>Assunto</strong><br>' +
            escapeHtml(record.assunto) +
            (record.tribunal ? '<div style="margin-top:4px;color:' + theme.muted + ';">' + escapeHtml(record.tribunal) + "</div>" : "") +
            (record.jurisdiction ? '<div style="margin-top:4px;color:' + theme.muted + ';">' + escapeHtml(record.jurisdiction) + "</div>" : ""),
          '<strong>Manifestação Sugerida</strong><br>' + escapeHtml(record.manifestationSuggested || "Sem manifestação"),
          '<strong>Distribuicao</strong><br>' + escapeHtml(record.distributionDate || "Sem data"),
          '<strong>Prazo PJE</strong><br>' + escapeHtml(record.pjeDeadline || "Sem prazo"),
          '<strong>Último andamento</strong><br>' + escapeHtml(record.lastProgress || "Sem informação"),
          '<strong>Assessor(a)</strong><br>' + escapeHtml(record.assessor || "Sem informação"),
          '<strong>Expedientes</strong><br>' + escapeHtml(record.expedienteCount),
        ];

        cells.forEach((html) => {
          const cell = document.createElement("div");
          cell.innerHTML = html;
          row.appendChild(cell);
        });

        const actionCell = document.createElement("div");
        actionCell.style.cssText = "grid-column:1 / -1;display:flex;justify-content:flex-end;gap:6px;margin-top:-2px;";
        actionCell.appendChild(action);
        actionCell.appendChild(validateAction);
        row.appendChild(actionCell);
        rowsWrapper.appendChild(row);
      });

      details.appendChild(rowsWrapper);
      body.appendChild(details);
    });

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function pieceCategoryInfo(key) {
    return (
      PIECE_REPORT_CATEGORIES.find((category) => category.key === key) ||
      PIECE_REPORT_CATEGORIES[PIECE_REPORT_CATEGORIES.length - 1]
    );
  }

  function pieceReportDefaultClassification(reason) {
    const category = pieceCategoryInfo("peca_identificar");
    return {
      key: category.key,
      label: category.label,
      autoFill: false,
      reason: reason || "Classificação ainda não executada.",
      snippet: "",
    };
  }

  function compactRepeatedText(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";

    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return text;

    const compareTokens = tokens.map((token) => normalizeText(token).toLowerCase());
    const output = [];
    for (let index = 0; index < tokens.length; ) {
      let repeatLength = 0;
      const maxLength = Math.min(16, Math.floor((tokens.length - index) / 2));

      for (let length = 1; length <= maxLength; length += 1) {
        let same = true;
        for (let offset = 0; offset < length; offset += 1) {
          if (compareTokens[index + offset] !== compareTokens[index + length + offset]) {
            same = false;
            break;
          }
        }

        if (same) {
          repeatLength = length;
          break;
        }
      }

      if (!repeatLength) {
        output.push(tokens[index]);
        index += 1;
        continue;
      }

      const phrase = tokens.slice(index, index + repeatLength);
      output.push(...phrase);
      index += repeatLength;

      while (index + repeatLength <= tokens.length) {
        let same = true;
        for (let offset = 0; offset < repeatLength; offset += 1) {
          if (compareTokens[index + offset] !== normalizeText(phrase[offset]).toLowerCase()) {
            same = false;
            break;
          }
        }

        if (!same) break;
        index += repeatLength;
      }
    }

    return output.join(" ");
  }

  function pieceReportDisplayText(value, fallback) {
    return compactRepeatedText(value) || fallback || "";
  }

  function pieceCategoryNeedsIntern(categoryKey) {
    return (
      categoryKey === "contestacao_com_agravo" ||
      categoryKey === "contestacao_sem_agravo" ||
      categoryKey === "contestacao_possivel_agravo"
    );
  }

  function pieceReportRecord(row, index, pageNumber) {
    const info = rowInfo(row);
    const plan = buildOpenPlanForRow(row);
    const tasks = uniqueReportTasks(plan.tasks.map(reportTaskFromOpenTask).filter(Boolean));
    const expedienteTasks = tasks.filter((task) => task.kind === "expediente");
    const pendencyTask = tasks.find((task) => task.kind === "pendency") || null;
    const assunto = rowColumnText(row, ["assunto(s) do tj"]) || info.assunto || "";
    const expedienteId = rowColumnText(row, ["id do expediente"]) || rowExpedienteId(row) || info.id || "";
    const lastProgress = rowColumnText(row, [
      "ultimo andamento",
      "último andamento",
      "ultima andamento",
      "última andamento",
    ]);
    const assessor = rowColumnText(row, [
      "assessor(a)",
      "assessor",
      "assessor(a) especial",
      "assessor(a) responsavel",
      "assessor(a) responsável",
    ]);
    const rowKey = rowProcedureKey(row);
    const processNumber = rowProcessNumber(row);
    const tribunal = rowTribunalText(row);
    const grau = inferGrauFromText(tribunal);
    const cleanExpedienteId = normalizeText(expedienteId) || "Sem ID";
    const classification = pieceReportDefaultClassification(
      expedienteTasks.length ? "Aguardando leitura do expediente." : "Linha sem expediente visível."
    );

    return {
      id:
        "piece-" +
        pageNumber +
        "-" +
        index +
        "-" +
        normalizeText(rowKey || cleanExpedienteId || processNumber || plan.label).replace(/[^\w-]+/g, "_"),
      index: index,
      pageNumber: pageNumber,
      processNumber: pieceReportDisplayText(processNumber, "Sem número"),
      rowKey: rowKey,
      expedienteId: pieceReportDisplayText(cleanExpedienteId, "Sem ID"),
      labels: rowMarkerLabels(row),
      assunto: pieceReportDisplayText(assunto, "Sem assunto"),
      distributionDate: normalizeDateOnly(rowColumnText(row, ["data da distribuicao", "data da distribuição"])),
      tribunal: pieceReportDisplayText(tribunal, ""),
      grau: grau,
      jurisdiction: pieceReportDisplayText(rowColumnText(row, ["jurisdicao", "jurisdição"]), ""),
      lastProgress: pieceReportDisplayText(lastProgress, "Sem informação"),
      assessor: pieceReportDisplayText(assessor, "Sem informação"),
      tasks: tasks,
      pendencyUrl: pendencyTask ? pendencyTask.url : "",
      expedientes: expedienteTasks.map((task) => ({
        label: task.label || "Expediente",
        url: task.url,
      })),
      expedienteCount: expedienteTasks.length,
      classificationKey: classification.key,
      classificationLabel: classification.label,
      classification: classification,
    };
  }

  function pieceReportRecordKey(record) {
    return (
      normalizeText(record.rowKey) ||
      normalizeText(record.pendencyUrl) ||
      normalizeText(record.expedienteId) ||
      normalizeText(record.processNumber + "|" + record.assunto + "|" + record.distributionDate)
    );
  }

  function mergePieceReportRecord(recordsByKey, row, pageNumber) {
    const record = pieceReportRecord(row, recordsByKey.size + 1, pageNumber);
    const key = pieceReportRecordKey(record);
    if (key && recordsByKey.has(key)) return false;
    recordsByKey.set(key || record.id, record);
    return true;
  }

  async function collectPieceReportCurrentPage(recordsByKey, pageNumber) {
    let scanned = 0;
    const groups = groupRows();

    if (groups.length) {
      for (const groupRow of groups) {
        if (state.stopped) break;
        const items = (await expandGroup(groupRow)).filter(rowMatchesAllFilters);
        items.forEach((row) => {
          if (mergePieceReportRecord(recordsByKey, row, pageNumber)) scanned += 1;
        });
      }
      return { scanned: scanned };
    }

    rows().forEach((row) => {
      if (mergePieceReportRecord(recordsByKey, row, pageNumber)) scanned += 1;
    });

    return { scanned: scanned };
  }

  function pieceReportBackgroundPayload(record) {
    const expedientes = (record.expedientes || []).filter((expediente) => expediente && expediente.url);
    return {
      id: record.id,
      expedienteCount: record.expedienteCount,
      grau: record.grau || "",
      tribunal: record.tribunal || "",
      jurisdiction: record.jurisdiction || "",
      expedienteUrl: expedientes[0] ? expedientes[0].url : "",
      expedientes: expedientes,
    };
  }

  async function classifyPieceReportRecords(records) {
    const chunkSize = 8;
    const fallback = pieceReportDefaultClassification("Não foi possível classificar automaticamente.");
    const classifiable = [];

    (records || []).forEach((record) => {
      const hasExpedienteUrl = (record.expedientes || []).some((expediente) => expediente && expediente.url);
      if (hasExpedienteUrl) {
        classifiable.push(record);
        return;
      }

      const classification = pieceReportDefaultClassification(
        record.expedienteCount
          ? "Expediente encontrado na linha, mas sem URL direta para leitura."
          : "Linha sem expediente visível para leitura."
      );
      record.classification = classification;
      record.classificationKey = classification.key;
      record.classificationLabel = classification.label;
      record.classificationOk = false;
      record.readError = "";
      record.textLength = 0;
    });

    for (let index = 0; index < classifiable.length; index += chunkSize) {
      if (state.stopped) break;

      const chunk = classifiable.slice(index, index + chunkSize);
      log(
        "Lendo expedientes para relatório de peças: " +
          (index + 1) +
          "-" +
          (index + chunk.length) +
          "/" +
          classifiable.length +
          "."
      );

      const response = await classifyPieceRecordsThroughExtension(chunk.map(pieceReportBackgroundPayload));
      const resultMap = new Map();
      if (response && Array.isArray(response.results)) {
        response.results.forEach((item) => {
          if (item && item.id) resultMap.set(item.id, item);
        });
      }

      if (!response || !response.ok) {
        log(
          "Classificação de peças falhou neste lote: " +
            (response && response.error ? response.error : "sem resposta da extensão") +
            ".",
          "error"
        );
      }

      chunk.forEach((record) => {
        const result = resultMap.get(record.id);
        const classification = result && result.classification ? result.classification : fallback;
        record.classification = classification;
        record.classificationKey = classification.key || fallback.key;
        record.classificationLabel = classification.label || pieceCategoryInfo(record.classificationKey).label;
        record.classificationOk = Boolean(result && result.ok);
        record.readError = result && result.error ? result.error : "";
        record.textLength = result && result.textLength ? result.textLength : 0;
      });
    }
  }

  function finalizePieceReport(recordsByKey) {
    const records = Array.from(recordsByKey.values());
    const groups = PIECE_REPORT_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      color: category.color,
      records: [],
    }));
    const groupByKey = new Map(groups.map((group) => [group.key, group]));

    records.forEach((record) => {
      const key = record.classificationKey || "peca_identificar";
      const group = groupByKey.get(key) || groupByKey.get("peca_identificar");
      record.index = group.records.length + 1;
      group.records.push(record);
    });

    return {
      records: records,
      groups: groups.filter((group) => group.records.length),
    };
  }

  async function buildPieceReport() {
    guardStart();
    try {
      setStatus("Gerando relatório de peças...");
      log("Gerando relatório de identificação de peças.");
      await setPageLength();
      await applyDateFilterIfNeeded();
      const pageInfo = tablePageInfo();
      if (!state.pageBatch) {
        loadStoredPageSelection(pageInfo.total);
        updatePageSelectionControls();
      }
      const pages = state.pageBatch
        ? normalizePageNumbers(state.pageBatch.selectedPages, pageInfo.total)
        : targetPageNumbers(pageInfo.total);
      logPageScope(pages, pageInfo.total);

      const report = {
        generatedAt: new Date(),
        groups: [],
        records: [],
        scanned: 0,
        pages: 0,
      };
      const recordsByKey = new Map();

      for (const pageNumber of pages) {
        if (state.stopped) break;

        await goToPageNumber(pageNumber);
        log("Relatório de peças, página " + pageNumber + ".");
        const pageReport = await collectPieceReportCurrentPage(recordsByKey, pageNumber);
        report.pages += 1;
        report.scanned += pageReport.scanned;
        log("Relatório coletou " + pageReport.scanned + " pendência(s) nesta página.");
      }

      const records = Array.from(recordsByKey.values());
      await classifyPieceReportRecords(records);
      const finalReport = finalizePieceReport(recordsByKey);
      report.records = finalReport.records;
      report.groups = finalReport.groups;

      showPieceReport(report);
      log("Relatório de peças gerado: " + report.records.length + " pendência(s) analisada(s).", "ok");
      setStatus("Relatório pronto");
    } catch (error) {
      log("Erro no relatório de peças: " + error.message, "error");
      setStatus("Erro no relatório");
    } finally {
      state.running = false;
    }
  }

  function pieceReportNeedsIntern(record) {
    return Boolean(record && pieceCategoryNeedsIntern(record.classificationKey));
  }

  function pieceReportOpenPayload(record, internKey) {
    return {
      id: record.id,
      label: record.processNumber || record.expedienteId,
      classificationKey: record.classificationKey,
      internKey: internKey || "",
      pendencyUrl: record.pendencyUrl,
      expedientes: record.expedientes,
      expedienteCount: record.expedienteCount,
    };
  }

  async function openPieceReportRecord(record, internKey) {
    if (!record) return false;
    if (!record.pendencyUrl) {
      throw new Error("Registro sem URL da pendência.");
    }
    if (pieceReportNeedsIntern(record) && !internKey) {
      throw new Error("Selecione um estagiário antes de abrir/preencher a contestação.");
    }

    const response = await openPieceReportRecordThroughExtension(pieceReportOpenPayload(record, internKey));
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "A extensão não abriu o registro.");
    }

    log(
      "Relatório de peças abriu " +
        response.opened +
        " aba(s): " +
        record.processNumber +
        " / expediente " +
        record.expedienteId +
        ".",
      "ok"
    );

    if (response.classification) {
      if (response.classification.ok) {
        log(
          "Formulário de Complementar classificação preenchido para " +
            record.expedienteId +
            ". Revise e salve manualmente.",
          "ok"
        );
      } else if (response.classification.error) {
        log(
          "Não foi possível preencher Complementar classificação para " +
            record.expedienteId +
            ": " +
            response.classification.error,
          "error"
        );
      } else if (response.classification.missing && response.classification.missing.length) {
        log(
          "Complementar classificação ficou incompleta em " +
            record.expedienteId +
            ". Campos não localizados: " +
            response.classification.missing.join(", ") +
            ".",
          "error"
        );
      }
    }

    return true;
  }

  async function runPieceReportOpening(label, action) {
    guardStart();
    try {
      setStatus(label);
      await action();
      setStatus("Relatório pronto");
    } catch (error) {
      log("Erro ao abrir pelo relatório de peças: " + error.message, "error");
      setStatus("Erro no relatório");
    } finally {
      state.running = false;
    }
  }

  function pieceReportSummary(report) {
    const counts = {};
    PIECE_REPORT_CATEGORIES.forEach((category) => {
      counts[category.key] = 0;
    });
    (report.records || []).forEach((record) => {
      const key = record.classificationKey || "peca_identificar";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  function createInternOptionsSelect(title) {
    const theme = reportTheme();
    const select = document.createElement("select");
    select.style.cssText =
      "width:100%;border:1px solid " +
      theme.selectBorder +
      ";border-radius:5px;padding:6px;font-size:12px;background:" +
      theme.selectBg +
      ";color:" +
      theme.selectText +
      ";";
    select.title = title || "Estagiário - Ofício";
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", (event) => event.stopPropagation());

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = title || "Estagiário - Ofício";
    empty.style.background = theme.selectOptionBg;
    empty.style.color = theme.selectOptionText;
    select.appendChild(empty);

    PIECE_REPORT_INTERNS.forEach((intern) => {
      const option = document.createElement("option");
      option.value = intern.key;
      option.textContent = intern.name;
      option.style.background = theme.selectOptionBg;
      option.style.color = theme.selectOptionText;
      select.appendChild(option);
    });

    return select;
  }

  function createPieceInternSelect(record) {
    const select = createInternOptionsSelect("Estagiário - Ofício");
    select.dataset.pieceCategory = record && record.classificationKey ? record.classificationKey : "";
    select.dataset.pieceRecord = record && record.id ? record.id : "";

    if (!pieceReportNeedsIntern(record)) {
      select.title = "Usado somente quando houver preenchimento automático de contestação.";
      select.disabled = true;
    }

    return select;
  }

  function showPieceReport(report) {
    const old = document.querySelector("#spa-cdsp-piece-report-overlay");
    if (old) old.remove();
    const theme = reportTheme();

    const overlay = document.createElement("div");
    overlay.id = "spa-cdsp-piece-report-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:1000002;background:" +
      theme.overlayBg +
      ";" +
      "display:flex;align-items:center;justify-content:center;padding:22px;font-family:Arial,sans-serif;";

    const modal = document.createElement("div");
    modal.style.cssText =
      "width:min(1240px,calc(100vw - 44px));max-height:calc(100vh - 44px);overflow:auto;" +
      "background:" +
      theme.modalBg +
      ";color:" +
      theme.text +
      ";border-radius:10px;box-shadow:" +
      theme.shadow +
      ";";

    const header = document.createElement("div");
    header.style.cssText =
      "position:sticky;top:0;z-index:2;background:" +
      theme.headerBg +
      ";color:" +
      theme.headerText +
      ";padding:14px 16px;" +
      "display:flex;align-items:center;gap:12px;border-radius:10px 10px 0 0;";

    const title = document.createElement("div");
    title.style.cssText = "flex:1;min-width:0;";
    title.innerHTML =
      '<div style="font-size:17px;font-weight:800;">Relatório de identificação de peças</div>' +
      '<div style="font-size:12px;color:' +
      theme.headerSubtle +
      ';margin-top:3px;">Classificação inicial por leitura de expedientes, com abertura e preenchimento assistido.</div>';

    const refresh = createDuplicateReportButton("Atualizar", "blue");
    const close = createDuplicateReportButton("Fechar", "gray");
    close.addEventListener("click", () => overlay.remove());
    refresh.addEventListener("click", () => {
      overlay.remove();
      buildPieceReport();
    });

    header.appendChild(title);
    header.appendChild(refresh);
    header.appendChild(close);

    const body = document.createElement("div");
    body.style.cssText = "padding:16px;";

    const counts = pieceReportSummary(report);
    const summaryRow = document.createElement("div");
    summaryRow.style.cssText =
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:14px;";
    PIECE_REPORT_CATEGORIES.forEach((category) => {
      const card = document.createElement("div");
      card.style.cssText =
        "background:" +
        theme.cardBg +
        ";border-left:4px solid " +
        category.color +
        ";border-radius:7px;padding:10px;box-shadow:" +
        theme.rowShadow +
        ";";
      card.innerHTML =
        '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:' +
        theme.label +
        ';font-weight:800;">' +
        escapeHtml(category.label) +
        '</div><div style="font-size:24px;font-weight:800;margin-top:4px;">' +
        escapeHtml(counts[category.key] || 0) +
        "</div>";
      summaryRow.appendChild(card);
    });
    body.appendChild(summaryRow);

    if (!report.records.length) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "background:" +
        theme.warningBg +
        ";color:" +
        theme.warningText +
        ";border-left:4px solid #f0a500;border-radius:8px;padding:14px;font-size:14px;";
      empty.textContent = "Nenhuma pendência foi encontrada com os filtros atuais.";
      body.appendChild(empty);
    }

    report.groups.forEach((group, groupIndex) => {
      const details = document.createElement("details");
      details.open = groupIndex < 3;
      details.style.cssText =
        "background:" +
        theme.cardBg +
        ";border:1px solid " +
        theme.cardBorder +
        ";border-radius:8px;margin:10px 0;overflow:hidden;";

      const summaryElement = document.createElement("summary");
      summaryElement.style.cssText =
        "cursor:pointer;list-style:none;padding:11px 13px;background:" +
        theme.summaryBg +
        ";display:flex;align-items:center;gap:10px;";

      const groupTitle = document.createElement("div");
      groupTitle.style.cssText = "flex:1;font-weight:800;color:" + theme.title + ";";
      groupTitle.textContent = group.label;

      const countBadge = document.createElement("span");
      countBadge.style.cssText =
        "background:" +
        group.color +
        ";color:#fff;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:800;";
      countBadge.textContent = group.records.length + " pendência(s)";

      summaryElement.appendChild(groupTitle);
      summaryElement.appendChild(countBadge);

      if (pieceCategoryNeedsIntern(group.key)) {
        const groupControls = document.createElement("div");
        groupControls.style.cssText = "display:flex;align-items:center;gap:6px;min-width:330px;";
        groupControls.addEventListener("click", (event) => {
          event.stopPropagation();
        });

        const groupSelect = createInternOptionsSelect("Estagiário padrão da categoria");
        groupSelect.style.maxWidth = "238px";

        const applyIntern = createDuplicateReportButton("Aplicar", "gray");
        applyIntern.style.minHeight = "28px";
        applyIntern.style.padding = "6px 9px";
        applyIntern.title = "Aplicar este estagiário em todas as pendências abertas desta categoria.";
        applyIntern.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (!groupSelect.value) {
            log("Selecione um estagiário para aplicar em " + group.label + ".", "error");
            return;
          }

          const selects = details.querySelectorAll('select[data-piece-category="' + group.key + '"]');
          selects.forEach((select) => {
            select.value = groupSelect.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          });

          log("Estagiário aplicado em " + selects.length + " item(ns): " + group.label + ".", "ok");
        });

        groupControls.appendChild(groupSelect);
        groupControls.appendChild(applyIntern);
        summaryElement.appendChild(groupControls);
      }

      details.appendChild(summaryElement);

      const rowsWrapper = document.createElement("div");
      rowsWrapper.style.cssText = "padding:10px 12px 12px;background:" + theme.bodyBg + ";";

      group.records.forEach((record) => {
        const row = document.createElement("div");
        row.style.cssText =
          "display:grid;grid-template-columns:110px 1.75fr 95px 1.25fr 1.05fr 85px 1.15fr 170px;gap:10px;align-items:start;" +
          "border:1px solid " +
          theme.cardBorder +
          ";border-left:4px solid " +
          group.color +
          ";border-radius:8px;padding:12px;margin:10px 0 12px;background:" +
          theme.cardBg +
          ";box-shadow:" +
          theme.rowShadow +
          ";font-size:12px;color:" +
          theme.text +
          ";";

        const seenLabels = new Set();
        const labels = (record.labels.length ? record.labels : ["Sem etiqueta"]).filter((label) => {
          const key = normalizeText(label).toLowerCase();
          if (seenLabels.has(key)) return false;
          seenLabels.add(key);
          return true;
        });
        const labelHtml = labels
          .map((label) => reportChipHtml(label, theme))
          .join("");

        const action = createDuplicateReportButton("Abrir", pieceReportNeedsIntern(record) ? "teal" : "blue");
        const internSelect = createPieceInternSelect(record);
        internSelect.style.maxWidth = "170px";
        action.title = pieceReportNeedsIntern(record)
          ? "Abrir pendência/expediente e preencher Complementar classificação."
          : "Abrir pendência e expediente.";
        action.addEventListener("click", () => {
          runPieceReportOpening("Abrindo peça...", () => openPieceReportRecord(record, internSelect.value)).catch((error) => {
            log("Erro ao abrir item do relatório de peças: " + error.message, "error");
          });
        });

        const processHeader = document.createElement("div");
        processHeader.style.cssText =
          "grid-column:1 / -1;display:flex;align-items:center;justify-content:space-between;gap:8px;" +
          "border-bottom:1px solid " +
          theme.softBorder +
          ";padding-bottom:7px;margin-bottom:2px;";
        processHeader.innerHTML =
          '<strong style="font-size:13px;color:' +
          theme.title +
          ';">Processo ' +
          escapeHtml(record.processNumber || "Sem número") +
          '</strong><span style="background:' +
          theme.chipBg +
          ";border:1px solid " +
          theme.chipBorder +
          ";border-radius:999px;padding:3px 8px;color:" +
          theme.chipText +
          ';font-weight:700;">Página ' +
          escapeHtml(record.pageNumber || 1) +
          "</span>";
        row.appendChild(processHeader);

        const cells = [
          '<strong>ID expediente</strong><br>' + escapeHtml(record.expedienteId),
          '<strong>Assunto</strong><br>' +
            escapeHtml(record.assunto) +
            (record.jurisdiction ? '<div style="margin-top:4px;color:' + theme.muted + ';">' + escapeHtml(record.jurisdiction) + "</div>" : ""),
          '<strong>Distribuição</strong><br>' + escapeHtml(record.distributionDate || "Sem data"),
          '<strong>Último andamento</strong><br>' + escapeHtml(record.lastProgress || "Sem informação"),
          '<strong>Assessor(a)</strong><br>' + escapeHtml(record.assessor || "Sem informação"),
          '<strong>Expedientes</strong><br>' + escapeHtml(record.expedienteCount),
          '<strong>Etiquetas</strong><br>' + labelHtml,
        ];

        cells.forEach((html) => {
          const cell = document.createElement("div");
          cell.innerHTML = html;
          row.appendChild(cell);
        });

        const reasonCell = document.createElement("div");
        reasonCell.style.cssText = "grid-column:1 / 7;color:" + theme.label + ";line-height:1.35;";
        reasonCell.innerHTML =
          '<strong>Critério</strong><br>' +
          escapeHtml((record.classification && record.classification.reason) || "Sem critério identificado.") +
          (record.readError ? '<div style="color:' + theme.danger + ';margin-top:3px;">' + escapeHtml(record.readError) + "</div>" : "");

        const actionCell = document.createElement("div");
        actionCell.style.cssText = "grid-column:7 / -1;display:flex;justify-content:flex-end;gap:6px;align-items:center;";
        if (pieceReportNeedsIntern(record)) {
          actionCell.appendChild(internSelect);
        }
        actionCell.appendChild(action);

        row.appendChild(reasonCell);
        row.appendChild(actionCell);
        rowsWrapper.appendChild(row);
      });

      details.appendChild(rowsWrapper);
      body.appendChild(details);
    });

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function groupRows() {
    return Array.from(document.querySelectorAll("#procedures-box tbody tr.group-row")).filter(isVisible);
  }

  function groupCount(groupRow) {
    const badge = groupRow.querySelector(".badge");
    return normalizeLimit(badge ? badge.textContent : 0);
  }

  function groupLabel(groupRow) {
    const text = normalizeText(groupRow.textContent || "");
    return text || groupRow.getAttribute("data-group") || "grupo sem identificacao";
  }

  function groupProcessNumber(groupRow) {
    return (
      extractProcessNumber(groupLabel(groupRow)) ||
      extractProcessNumber(groupRow.getAttribute("data-group") || "")
    );
  }

  function isDuplicateProcessGroup(groupRow) {
    return normalizeText(groupLabel(groupRow)).toLowerCase().indexOf("numero do processo") >= 0;
  }

  function groupItems(groupRow) {
    const items = [];
    let current = groupRow.nextElementSibling;

    while (current && !current.classList.contains("group-row")) {
      if (current.classList.contains("group-item") && rowMatchesAllFilters(current)) {
        items.push(current);
      }
      current = current.nextElementSibling;
    }

    return items;
  }

  async function expandGroup(groupRow) {
    let items = groupItems(groupRow);
    if (!items.length || items.some(isVisible)) return items;

    groupRow.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await sleep(700);
    await waitProcessingDone();

    items = groupItems(groupRow);
    if (items.some(isVisible)) return items;

    const icon = groupRow.querySelector(".toggle-icon");
    if (icon) {
      icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      await sleep(700);
      await waitProcessingDone();
    }

    items = groupItems(groupRow);
    if (!items.some(isVisible)) {
      items.forEach((row) => {
        row.style.display = "";
      });
      log("Grupo expandido por fallback visual: " + groupLabel(groupRow) + ".");
    }

    return items;
  }

  function expedienteIdFromText(text) {
    const match = normalizeText(text).match(/\b\d{5,}\b/);
    return match ? match[0] : "";
  }

  function rowExpedienteId(row) {
    const columnId = normalizeText(rowColumnText(row, ["id do expediente"]));
    if (columnId) return columnId;

    const expedienteText = getExpedientes(row)
      .map((element) =>
        [
          element.getAttribute("data-original-title"),
          element.getAttribute("title"),
          element.getAttribute("aria-label"),
          element.textContent,
          elementUrl(element),
        ].join(" ")
      )
      .join(" ");

    return expedienteIdFromText(expedienteText);
  }

  function duplicateRowOpenKey(row) {
    return normalizeText(rowExpedienteId(row)) || normalizeText(rowProcedureKey(row));
  }

  function uniqueDuplicateRowsByExpediente(items, label) {
    const seen = new Set();
    const unique = [];

    (items || []).forEach((row) => {
      const key = duplicateRowOpenKey(row);
      if (key && seen.has(key)) {
        log("Pendencia duplicada ignorada pelo ID do expediente (" + key + "): " + label + ".");
        return;
      }

      if (key) seen.add(key);
      unique.push(row);
    });

    return unique;
  }

  function taskUrl(task) {
    return resolveUrl((task && task.url) || elementUrl(task && task.element));
  }

  function duplicateOpenTasksForRows(items, label) {
    const tasks = [];
    const seenUrls = new Set();

    (items || []).forEach((row) => {
      const expedienteId = rowExpedienteId(row) || "sem ID";
      const plan = buildOpenPlanForRow(row);

      if (!plan.hasPendencia) {
        log("Pendencia nao encontrada no grupo duplicado " + label + " (expediente " + expedienteId + ").", "error");
      }

      if (!plan.expedienteCount) {
        log("Sem expediente visivel no grupo duplicado " + label + " (expediente " + expedienteId + ").");
      }

      plan.tasks.forEach((task) => {
        const url = taskUrl(task);
        if (!url) {
          log("URL nao encontrada para " + task.label + " no expediente " + expedienteId + ".", "error");
          return;
        }

        if (seenUrls.has(url)) {
          log("URL repetida ignorada no grupo duplicado " + label + " (expediente " + expedienteId + ").");
          return;
        }

        seenUrls.add(url);
        tasks.push({
          url: url,
          label: task.label,
          kind: task.kind,
          expedienteId: expedienteId,
          planLabel: plan.label,
        });
      });
    });

    return tasks;
  }

  async function openDuplicateTasksBatch(tasks, label) {
    if (!tasks.length) {
      return { opened: 0, blocked: 0 };
    }

    const chunkSize = Math.max(1, normalizeLimit(CONFIG.batchOpenMaxUrls) || 80);
    let opened = 0;
    let blocked = 0;
    let lastError = "";

    for (let index = 0; index < tasks.length; index += chunkSize) {
      if (state.stopped) break;

      const chunk = tasks.slice(index, index + chunkSize);
      const response = await openUrlsThroughExtension(chunk.map((task) => task.url));
      const chunkOpened = response && response.opened ? Math.min(response.opened, chunk.length) : 0;

      opened += chunkOpened;
      blocked += Math.max(0, chunk.length - chunkOpened);
      if (response && response.error) lastError = response.error;
    }

    if (opened) {
      log(
        "Grupo duplicado abriu " +
          opened +
          "/" +
          tasks.length +
          " aba(s) em lote: " +
          label +
          ".",
        opened === tasks.length ? "ok" : "error"
      );
    } else {
      log(
        "Grupo duplicado nao abriu abas em lote: " +
          label +
          (lastError ? " (" + lastError + ")" : ""),
        "error"
      );
    }

    return {
      opened: opened,
      blocked: blocked,
    };
  }

  async function openDuplicateTabsCurrentPage(limit, processedProcessKeys) {
    const groups = groupRows().filter(
      (groupRow) => groupCount(groupRow) > 1 && isDuplicateProcessGroup(groupRow)
    );
    const seen = processedProcessKeys || new Set();
    let count = 0;
    let blocked = 0;

    log("Grupos duplicados visiveis na pagina: " + groups.length + ".");

    for (const groupRow of groups) {
      if (state.stopped) break;
      if (limit && count >= limit) break;

      const label = groupLabel(groupRow);
      const processKey = groupProcessNumber(groupRow) || label;
      if (seen.has(processKey)) continue;

      seen.add(processKey);
      const duplicateCount = groupCount(groupRow);
      log("Abrindo grupo duplicado (" + duplicateCount + "): " + label + ".");

      const items = (await expandGroup(groupRow)).filter(isVisible);
      if (!items.length) {
        log("Nenhum processo visivel dentro do grupo duplicado: " + label, "error");
        continue;
      }

      if (groupHasDuplicateReportSesProcess(groupRow, items)) {
        log("Grupo duplicado ignorado: processo da SES (" + label + ").");
        continue;
      }

      if (groupAllDuplicidadeValidadaMarker(items)) {
        log(
          "Grupo duplicado ignorado: etiqueta '" +
            CONFIG.duplicidadeValidadaMarkerText +
            "' encontrada em todas as pendencias de " +
            label +
            "."
        );
        continue;
      }

      const uniqueItems = uniqueDuplicateRowsByExpediente(items, label);
      const tasks = duplicateOpenTasksForRows(uniqueItems, label);
      const result = await openDuplicateTasksBatch(tasks, label);
      blocked += result.blocked;
      const processOpened = result.opened;

      if (processOpened) {
        count += 1;
        log("Processo duplicado contabilizado: " + processKey + ".", "ok");
      } else {
        log("Grupo duplicado sem abas acionadas: " + processKey + ".", "error");
      }
    }

    if (blocked) {
      log(
        "Algumas abas foram bloqueadas. Autorize pop-ups para spa.pge.mt.gov.br e rode novamente.",
        "error"
      );
    }

    return count;
  }

  async function openDuplicateTabsPreparedBatch(limit) {
    const batch = state.pageBatch;
    let total = 0;
    let blocked = 0;
    const processedProcessKeys = new Set();

    for (const page of batch.pages || []) {
      if (state.stopped) break;
      log("Fase duplicados, lote pagina " + page.pageNumber + ".");

      for (const group of page.duplicateGroups || []) {
        if (state.stopped) break;
        if (limit && total >= limit) break;
        if (processedProcessKeys.has(group.key)) continue;

        processedProcessKeys.add(group.key);

        if (group.hasSesProcess) {
          log("Grupo duplicado ignorado pelo lote: processo da SES (" + group.label + ").");
          continue;
        }

        if (group.allValidated) {
          log(
            "Grupo duplicado ignorado pelo lote: etiqueta '" +
              CONFIG.duplicidadeValidadaMarkerText +
              "' encontrada em todas as pendencias de " +
              group.label +
              "."
          );
          continue;
        }

        log("Abrindo grupo duplicado do lote (" + group.duplicateCount + "): " + group.label + ".");
        const result = await openDuplicateTasksBatch(group.tasks || [], group.label);
        blocked += result.blocked;

        if (result.opened) {
          total += 1;
          log("Processo duplicado contabilizado pelo lote: " + group.key + ".", "ok");
        } else {
          log("Grupo duplicado do lote sem abas acionadas: " + group.key + ".", "error");
        }
      }

      if (limit && total >= limit) {
        log("Limite de abertura de duplicados atingido (" + limit + ").");
        break;
      }
    }

    if (blocked) {
      log(
        "Algumas abas duplicadas do lote nao abriram. Verifique permissao de pop-ups e a comunicacao da extensao.",
        "error"
      );
    }

    return total;
  }

  async function openDuplicateTabsAllPages(limit) {
    guardStart();
    try {
      limit = normalizeLimit(limit);
      logActionLimit(limit);
      logCustomFilters();
      setStatus("Abrindo duplicados...");
      await setPageLength();
      await applyDateFilterIfNeeded();

      let total = 0;
      if (state.pageBatch) {
        logPageScope(state.pageBatch.selectedPages, state.pageBatch.totalPages);
        total = await openDuplicateTabsPreparedBatch(limit);
      } else {
        const pageInfo = tablePageInfo();
        loadStoredPageSelection(pageInfo.total);
        updatePageSelectionControls();
        const pages = targetPageNumbers(pageInfo.total);
        const processedProcessKeys = new Set();

        logPageScope(pages, pageInfo.total);

        for (const pageNumber of pages) {
          if (state.stopped) break;

          await goToPageNumber(pageNumber);
          log("Fase duplicados, pagina " + pageNumber + ".");
          const remaining = limit ? Math.max(0, limit - total) : 0;
          const pageTotal = await openDuplicateTabsCurrentPage(remaining, processedProcessKeys);
          total += pageTotal;

          if (limit && total >= limit) {
            log("Limite de abertura de duplicados atingido (" + limit + ").");
            break;
          }
        }
      }

      log("Fase de duplicados concluida. Processos abertos: " + total + ".", "ok");
      setStatus("Duplicados abertos: " + total);
    } catch (error) {
      log("Erro na fase de duplicados: " + error.message, "error");
      setStatus("Erro nos duplicados");
    } finally {
      state.running = false;
    }
  }

  function guardStart() {
    if (state.running) throw new Error("Automacao ja esta em execucao.");
    state.running = true;
    state.stopped = false;
  }

  function stop() {
    state.stopped = true;
    state.running = false;
    setStatus("Fluxo encerrado");
    log("Parada solicitada pelo usuario.");
  }

  function createButton(text, onclick, variant) {
    const colors = {
      primary: "#1976d2",
      success: "#2e7d32",
      info:    "#0277bd",
      warning: "#f57c00",
      danger:  "#c62828",
      neutral: "#607d8b",
      teal:    "#0f6e56",
      blue:    "#185fa5",
      purple:  "#4527a0",
      amber:   "#e65100",
      red:     "#7a1a1a",
      gray:    "#2a4560",
    };
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText =
      "border:0;padding:8px 9px;border-radius:5px;cursor:pointer;" +
      "font-size:12px;font-weight:700;line-height:1.15;background:" +
      (colors[variant || "primary"] || colors.primary) +
      ";color:white;min-height:34px;";
    button.addEventListener("click", (event) => {
      try {
        const result = onclick(event);
        if (result && typeof result.catch === "function") {
          result.catch((error) => {
            log("Erro ao executar acao: " + (error && error.message ? error.message : String(error)), "error");
          });
        }
      } catch (error) {
        log("Erro ao executar acao: " + (error && error.message ? error.message : String(error)), "error");
      }
    });
    return button;
  }

  function createPanelSection(title, startOpen) {
    const details = document.createElement("details");
    details.open = Boolean(startOpen);
    details.style.cssText =
      "background:#202a36;border:1px solid #344253;border-radius:7px;margin:7px 0;padding:7px;";

    const summary = document.createElement("summary");
    summary.textContent = title;
    summary.style.cssText =
      "cursor:pointer;font-weight:700;font-size:12px;color:#e3f2fd;outline:none;";

    const body = document.createElement("div");
    body.style.cssText = "margin-top:7px;";

    details.appendChild(summary);
    details.appendChild(body);
    return { section: details, body: body };
  }

  function createCheck(id, labelText, storageKey, defaultValue) {
    const label = document.createElement("label");
    label.style.cssText =
      "display:flex;align-items:center;gap:6px;margin:5px 0;color:#dce8f2;font-size:12px;";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = storageGet(storageKey, defaultValue || "0") === "1";

    const span = document.createElement("span");
    span.textContent = labelText;

    input.addEventListener("change", () => {
      storageSet(storageKey, input.checked ? "1" : "0");
      updateActiveFiltersSummary();
      clearPageBatchForScopeChange("os filtros condicionais mudaram");
    });

    label.appendChild(input);
    label.appendChild(span);
    return label;
  }

  function setStoredCheckbox(selector, storageKey, checked) {
    const input = document.querySelector(selector);
    if (input) input.checked = Boolean(checked);
    storageSet(storageKey, checked ? "1" : "0");
  }

  function clearSourceFilters(silent) {
    setStoredCheckbox("#spa-cdsp-filter-tribunal-1", "SPA_CDSP_FILTER_TRIBUNAL_1", false);
    setStoredCheckbox("#spa-cdsp-filter-tribunal-2", "SPA_CDSP_FILTER_TRIBUNAL_2", false);
    setStoredCheckbox("#spa-cdsp-filter-cejusc", "SPA_CDSP_FILTER_CEJUSC", false);
    updateActiveFiltersSummary();
    if (!silent) {
      clearPageBatchForScopeChange("os filtros de origem foram limpos");
      log("Filtros de origem limpos.");
    }
  }

  function clearDeadlineFilters(silent) {
    setStoredCheckbox("#spa-cdsp-deadline-long", "SPA_CDSP_DEADLINE_LONG", false);
    setStoredCheckbox("#spa-cdsp-deadline-short", "SPA_CDSP_DEADLINE_SHORT", false);
    setStoredCheckbox("#spa-cdsp-deadline-late", "SPA_CDSP_DEADLINE_LATE", false);
    setStoredCheckbox("#spa-cdsp-deadline-none", "SPA_CDSP_DEADLINE_NONE", false);
    storageSet("SPA_CDSP_DEADLINE_FILTER", "");
    updateActiveFiltersSummary();
    if (!silent) {
      clearPageBatchForScopeChange("os filtros de prazo foram limpos");
      log("Filtros de prazo limpos.");
    }
  }

  function clearExpedienteContentFilters(silent) {
    setStoredCheckbox("#spa-cdsp-expediente-filter-pauta", "SPA_CDSP_EXPEDIENTE_FILTER_PAUTA", false);
    setStoredCheckbox("#spa-cdsp-expediente-filter-negociacao", "SPA_CDSP_EXPEDIENTE_FILTER_NEGOCIACAO", false);
    updateActiveFiltersSummary();
    if (!silent) {
      clearPageBatchForScopeChange("os filtros de expediente foram limpos");
      log("Filtros de expediente limpos.");
    }
  }

  function clearAllCustomFilters() {
    clearSourceFilters(true);
    clearDeadlineFilters(true);
    clearExpedienteContentFilters(true);
    updateActiveFiltersSummary();
    clearPageBatchForScopeChange("todos os filtros condicionais foram limpos");
    log("Todos os filtros condicionais foram limpos.");
  }

  function updateActiveFiltersSummary() {
    const label = document.querySelector("#spa-cdsp-active-filters-label");
    if (!label) return;

    const labels = activeFilterLabels(currentCustomFilters());
    if (labels.length) {
      label.textContent = "Filtros ativos: " + labels.join("; ");
      label.style.color = "#ffe082";
    } else {
      label.textContent = "Filtros ativos: nenhum";
      label.style.color = "#b0bec5";
    }
  }

  function createSmallUtilityButton(text, onclick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.style.cssText =
      "border:1px solid #425466;background:#263544;color:#e3f2fd;border-radius:4px;" +
      "padding:4px 6px;cursor:pointer;font-size:11px;font-weight:700;";
    button.addEventListener("click", onclick);
    return button;
  }

  function createActiveFiltersSummary() {
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "background:#101820;border:1px solid #344253;border-radius:6px;margin:7px 0;padding:7px;";

    const label = document.createElement("div");
    label.id = "spa-cdsp-active-filters-label";
    label.style.cssText = "font-size:11px;line-height:1.35;margin-bottom:6px;";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:5px;flex-wrap:wrap;";
    actions.appendChild(createSmallUtilityButton("Limpar origem", clearSourceFilters));
    actions.appendChild(createSmallUtilityButton("Limpar prazo", clearDeadlineFilters));
    actions.appendChild(createSmallUtilityButton("Limpar tudo", clearAllCustomFilters));

    wrapper.appendChild(label);
    wrapper.appendChild(actions);
    return wrapper;
  }

  function updatePageSelectionControls() {
    const container = document.querySelector("#spa-cdsp-page-options");
    const infoLabel = document.querySelector("#spa-cdsp-page-info");
    if (!container || !infoLabel) return;

    try {
      const info = tablePageInfo();
      ensurePageSelectionLoaded(info.total);
      const selected = selectedPageNumbers(info.total);

      container.innerHTML = "";
      allPageNumbers(info.total).forEach((pageNumber) => {
        const checked = state.selectedPages.has(pageNumber);
        const label = document.createElement("label");
        label.style.cssText =
          "display:flex;align-items:center;gap:4px;border:1px solid " +
          (checked ? "#1e88e5" : "#425466") +
          ";background:" +
          (checked ? "#173d61" : "#263544") +
          ";border-radius:999px;padding:4px 7px;color:#e3f2fd;font-size:11px;font-weight:700;cursor:pointer;";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = checked;
        input.style.cssText = "margin:0;";

        const span = document.createElement("span");
        span.textContent = String(pageNumber);

        input.addEventListener("change", () => {
          if (input.checked) {
            state.selectedPages.add(pageNumber);
          } else {
            state.selectedPages.delete(pageNumber);
          }

          persistPageSelection();
          clearPageBatchForScopeChange("a selecao de paginas mudou");
          updatePageSelectionControls();
        });

        label.appendChild(input);
        label.appendChild(span);
        container.appendChild(label);
      });

      infoLabel.textContent = selected.length
        ? "Paginas marcadas: " + pageListLabel(selected) + "."
        : "Nenhuma pagina marcada: as acoes usam todas as " + info.total + " pagina(s).";
      infoLabel.style.color = selected.length ? "#9be7c4" : "#b0bec5";
    } catch (error) {
      container.innerHTML = "";
      infoLabel.textContent = "Nao foi possivel ler as paginas do SPA agora.";
      infoLabel.style.color = "#ffccbc";
    }

    updateBatchStatus();
  }

  function clearPageSelection() {
    state.selectedPages.clear();
    persistPageSelection();
    clearPageBatchForScopeChange("a selecao de paginas foi removida");
    updatePageSelectionControls();
    log("Selecao de paginas limpa.");
  }

  function createPageBatchControls() {
    const section = createPanelSection("Lote por paginas", Boolean(state.pageBatch || state.selectedPages.size));

    const hint = document.createElement("div");
    hint.textContent =
      "Uso em equipe: atualizem a caixa juntos, usem a mesma paginacao e cada pessoa marque paginas diferentes.";
    hint.style.cssText = "font-size:11px;color:#9fb3c8;line-height:1.35;margin-bottom:6px;";

    const info = document.createElement("div");
    info.id = "spa-cdsp-page-info";
    info.style.cssText = "font-size:11px;line-height:1.35;margin-bottom:6px;";

    const options = document.createElement("div");
    options.id = "spa-cdsp-page-options";
    options.style.cssText =
      "display:flex;gap:5px;flex-wrap:wrap;max-height:74px;overflow:auto;margin-bottom:7px;";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;";
    actions.appendChild(createSmallUtilityButton("Atualizar paginas", updatePageSelectionControls));
    actions.appendChild(createSmallUtilityButton("Preparar lote", preparePageBatch));
    actions.appendChild(createSmallUtilityButton("Limpar paginas", clearPageSelection));
    actions.appendChild(createSmallUtilityButton("Limpar lote", () => clearPageBatch(false)));

    const batchStatus = document.createElement("div");
    batchStatus.id = "spa-cdsp-batch-status";
    batchStatus.style.cssText =
      "font-size:11px;line-height:1.35;border-top:1px solid #344253;padding-top:6px;";

    section.body.appendChild(hint);
    section.body.appendChild(info);
    section.body.appendChild(options);
    section.body.appendChild(actions);
    section.body.appendChild(batchStatus);

    setTimeout(updatePageSelectionControls, 100);
    return section.section;
  }

  function createHealthLogo() {
    const wrapper = document.createElement("div");
    wrapper.className = "cdsp-module-brand";
    wrapper.style.cssText =
      "display:flex;align-items:center;justify-content:center;margin:8px 0 8px 0;" +
      "padding:6px;border:1px solid #344253;border-radius:6px;background:#1f2d3a;line-height:0;";

    const image = document.createElement("img");
    image.src = VISUAL_CONFIG.headerImageUrl || HEALTH_LOGO_SRC;
    image.alt = "Coordenadoria de Defesa da Saude Publica";
    image.style.cssText =
      "display:block;width:100%;height:auto;max-height:58px;object-fit:contain;";

    wrapper.appendChild(image);
    return wrapper;
  }

  function createButtonGrid() {
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;";
    return grid;
  }

  function createScheduledRoutineControls() {
    const actions = [
      { key: "science", label: "Dar ciencia" },
      { key: "refresh", label: "Atualizar lista" },
      { key: "close_assessoria", label: "Encerrar tarefa sugerida pela assessoria" },
      { key: "protocol_petition", label: "Protocolar peticao em massa" },
      { key: "protocol_ses_joins", label: "Protocolar juntadas da SES" },
      { key: "protocol_agravo_instrumento", label: "Protocolar agravo de instrumento" },
    ];
    const section = createPanelSection("Rotina programada", false);
    const status = document.createElement("div");
    const activeRow = document.createElement("label");
    const active = document.createElement("input");
    const timeRow = document.createElement("div");
    const hours = document.createElement("input");
    const minutes = document.createElement("input");
    const passwordWrapper = document.createElement("label");
    const passwordCaption = document.createElement("span");
    const passwordInput = document.createElement("input");
    const passwordHint = document.createElement("span");
    const actionBox = document.createElement("div");
    const actionInputs = {};
    const actionPriorityBadges = {};
    let selectedActionOrder = [];
    const buttons = createButtonGrid();
    const save = createButton("Salvar rotina", () => saveRoutine(true), "teal");
    const pause = createButton("Pausar rotina", () => pauseRoutine(), "gray");
    const runNow = createButton("Executar uma vez agora", () => runRoutineNow(), "info");

    status.style.cssText = "font-size:11px;color:#b0bec5;line-height:1.35;margin:0 0 8px 0;";
    activeRow.style.cssText =
      "display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#e3f2fd;margin-bottom:7px;";
    active.type = "checkbox";
    active.id = "spa-cdsp-routine-active";
    active.style.margin = "0";
    activeRow.appendChild(active);
    activeRow.appendChild(document.createTextNode("Ativar execucao programada"));

    timeRow.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:8px;";
    [
      { input: hours, label: "Horas" },
      { input: minutes, label: "Minutos" },
    ].forEach((item) => {
      const wrapper = document.createElement("label");
      const caption = document.createElement("span");
      wrapper.style.cssText = "display:flex;flex-direction:column;gap:3px;font-size:11px;color:#cfd8dc;";
      caption.textContent = item.label;
      item.input.type = "number";
      item.input.min = "0";
      item.input.step = "1";
      item.input.style.cssText =
        "height:30px;border:0;border-radius:4px;padding:0 8px;font-size:12px;background:#fff;color:#10202c;";
      wrapper.appendChild(caption);
      wrapper.appendChild(item.input);
      timeRow.appendChild(wrapper);
    });

    let protocolPasswordSessionSet = false;
    passwordWrapper.style.cssText = "display:flex;flex-direction:column;gap:3px;font-size:11px;color:#cfd8dc;margin-bottom:8px;";
    passwordCaption.textContent = "Senha";
    passwordInput.type = "password";
    passwordInput.id = "spa-cdsp-routine-password";
    passwordInput.autocomplete = "off";
    passwordInput.placeholder = "Senha para protocolar";
    passwordInput.style.cssText =
      "height:30px;border:0;border-radius:4px;padding:0 8px;font-size:12px;background:#fff;color:#10202c;";
    passwordHint.textContent = "Usada pelos passos de protocolo e mantida salva nesta extensão.";
    passwordHint.style.cssText = "font-size:10px;color:#9fb3c8;line-height:1.3;";
    passwordInput.addEventListener("input", () => {
      protocolPasswordSessionSet = false;
      passwordHint.textContent = passwordInput.value
        ? "Senha pronta para ser usada no protocolo."
        : "Usada pelos passos de protocolo e mantida salva nesta extensão.";
    });
    passwordInput.addEventListener("change", () => {
      if (passwordInput.value) return;
      requestExtensionMessage("SPA_CDSP_SCHEDULE_PASSWORD_SET", { password: "" }, 6000).then((response) => {
        protocolPasswordSessionSet = Boolean(response && response.hasPassword);
      });
    });
    passwordWrapper.appendChild(passwordCaption);
    passwordWrapper.appendChild(passwordInput);
    passwordWrapper.appendChild(passwordHint);

    actionBox.style.cssText =
      "border:1px solid #344657;border-radius:6px;padding:8px;margin-bottom:8px;background:#1e2b37;";
    function priorityLabel(position) {
      return position ? String(position) + "°" : "-";
    }

    function updateRoutinePriorityBadges() {
      selectedActionOrder = selectedActionOrder.filter((key) => actionInputs[key] && actionInputs[key].checked);
      actions.forEach((item) => {
        const badge = actionPriorityBadges[item.key];
        const input = actionInputs[item.key];
        if (!badge || !input) return;

        if (input.checked) {
          const selectedPosition = selectedActionOrder.indexOf(item.key) + 1;
          badge.textContent = priorityLabel(selectedPosition);
          badge.style.background = "#1e88e5";
          badge.style.color = "#ffffff";
          badge.title = "Sera o " + priorityLabel(selectedPosition) + " passo executado";
        } else {
          badge.textContent = "-";
          badge.style.background = "#263f58";
          badge.style.color = "#b0bec5";
          badge.title = "Passo nao selecionado";
        }
      });
    }

    actions.forEach((item, index) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const number = document.createElement("span");
      input.type = "checkbox";
      input.style.margin = "0";
      actionInputs[item.key] = input;
      actionPriorityBadges[item.key] = number;
      number.textContent = "-";
      number.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;width:23px;height:18px;" +
        "border-radius:999px;background:#263f58;color:#e3f2fd;font-size:10px;font-weight:800;";
      input.addEventListener("change", () => {
        if (input.checked) {
          if (selectedActionOrder.indexOf(item.key) < 0) selectedActionOrder.push(item.key);
        } else {
          selectedActionOrder = selectedActionOrder.filter((key) => key !== item.key);
        }
        updateRoutinePriorityBadges();
      });
      label.style.cssText =
        "display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:6px;" +
        "font-size:12px;color:#e3f2fd;margin-bottom:" +
        (index === actions.length - 1 ? "0" : "6px") +
        ";";
      label.appendChild(input);
      label.appendChild(number);
      label.appendChild(document.createTextNode(item.label));
      actionBox.appendChild(label);
    });

    appendFullWidthButton(buttons, runNow);
    buttons.appendChild(save);
    buttons.appendChild(pause);

    function currentRoutineConfig(forceActive) {
      const parsedHours = Math.max(0, parseInt(hours.value || "0", 10) || 0);
      const parsedMinutes = Math.max(0, parseInt(minutes.value || "0", 10) || 0);
      const intervalMinutes = Math.max(1, parsedHours * 60 + parsedMinutes);
      return {
        active: typeof forceActive === "boolean" ? forceActive : active.checked,
        intervalMinutes: intervalMinutes,
        hours: parsedHours,
        minutes: parsedMinutes,
        steps: selectedActionOrder.filter((key) => actionInputs[key] && actionInputs[key].checked),
        targetUrl: location.href,
        savedAt: new Date().toISOString(),
      };
    }

    async function syncProtocolPassword(config) {
      const hasProtocolStep =
        config &&
        Array.isArray(config.steps) &&
        (config.steps.indexOf("protocol_petition") >= 0 ||
          config.steps.indexOf("protocol_ses_joins") >= 0 ||
          config.steps.indexOf("protocol_agravo_instrumento") >= 0);
      if (!hasProtocolStep) return true;

      const value = passwordInput.value || "";
      if (!value && protocolPasswordSessionSet) return true;
      if (!value) {
        log("Informe a senha na aba Programada antes de salvar ou executar o protocolo.", "error");
        passwordHint.textContent = "Informe a senha para usar os passos de protocolo.";
        return false;
      }

      const response = await requestExtensionMessage("SPA_CDSP_SCHEDULE_PASSWORD_SET", { password: value }, 6000);
      if (response && response.ok) {
        protocolPasswordSessionSet = Boolean(response.hasPassword);
        passwordHint.textContent = "Senha salva para uso nas próximas execuções.";
        return true;
      }

      log("Nao foi possivel preparar a senha do protocolo: " + ((response && response.error) || "sem resposta"), "error");
      return false;
    }

    function applyRoutineConfig(config) {
      const safeConfig = config || {};
      const savedSteps = Array.isArray(safeConfig.steps) ? safeConfig.steps : [];
      active.checked = Boolean(safeConfig.active);
      hours.value = String(Math.max(0, parseInt(safeConfig.hours || "0", 10) || 0));
      const rawMinutes =
        typeof safeConfig.minutes !== "undefined" ? safeConfig.minutes : safeConfig.intervalMinutes || "30";
      minutes.value = String(
        Math.max(0, parseInt(rawMinutes, 10) || 0)
      );
      actions.forEach((item) => {
        actionInputs[item.key].checked = savedSteps.indexOf(item.key) >= 0;
      });
      selectedActionOrder = savedSteps.filter((key) => actionInputs[key] && actionInputs[key].checked);
      actions.forEach((item) => {
        if (actionInputs[item.key].checked && selectedActionOrder.indexOf(item.key) < 0) {
          selectedActionOrder.push(item.key);
        }
      });
      updateRoutinePriorityBadges();
      status.textContent = safeConfig.active
        ? "Rotina ativa: " +
          savedSteps.length +
          " passo(s), intervalo de " +
          (safeConfig.intervalMinutes || 30) +
          " minuto(s)."
        : "Rotina pausada. A ordem seguida sera a numeracao exibida acima.";
    }

    async function loadRoutineConfig() {
      const response = await requestExtensionMessage("SPA_CDSP_SCHEDULE_GET", {}, 6000);
      if (response && response.ok && response.config) {
        protocolPasswordSessionSet = Boolean(response.protocolPasswordSet);
        if (protocolPasswordSessionSet) {
          passwordHint.textContent = "Senha ja salva nesta extensão.";
        }
        applyRoutineConfig(response.config);
      } else {
        applyRoutineConfig({ active: false, intervalMinutes: 30, hours: 0, minutes: 30, steps: [] });
      }
    }

    async function saveRoutine(forceActive) {
      const config = currentRoutineConfig(forceActive);
      if (!config.steps.length) {
        log("Selecione pelo menos um passo para salvar a rotina programada.", "error");
        return;
      }
      if (!(await syncProtocolPassword(config))) return;
      const response = await requestExtensionMessage("SPA_CDSP_SCHEDULE_SAVE", { config: config }, 8000);
      if (response && response.ok) {
        applyRoutineConfig(response.config || config);
        log("Rotina programada salva. Intervalo: " + config.intervalMinutes + " minuto(s).", "ok");
      } else {
        log("Nao foi possivel salvar a rotina: " + ((response && response.error) || "sem resposta"), "error");
      }
    }

    async function pauseRoutine() {
      const config = currentRoutineConfig(false);
      const response = await requestExtensionMessage("SPA_CDSP_SCHEDULE_SAVE", { config: config }, 8000);
      if (response && response.ok) {
        applyRoutineConfig(response.config || config);
        log("Rotina programada pausada.", "ok");
      } else {
        log("Nao foi possivel pausar a rotina: " + ((response && response.error) || "sem resposta"), "error");
      }
    }

    async function runRoutineNow() {
      const config = currentRoutineConfig(false);
      if (!config.steps.length) {
        log("Selecione pelo menos um passo para executar a rotina agora.", "error");
        return;
      }
      if (!(await syncProtocolPassword(config))) return;
      const response = await requestExtensionMessage("SPA_CDSP_SCHEDULE_RUN_NOW", { config: config }, 8000);
      if (response && response.ok) {
        log("Execucao programada enviada para a extensao. Acompanhe pelo log do painel.", "ok");
      } else {
        log("Nao foi possivel iniciar a execucao agora: " + ((response && response.error) || "sem resposta"), "error");
      }
    }

    const hint = document.createElement("div");
    hint.textContent =
      "Salve a rotina na aba da caixa correta do SPA. Se mais de uma conta estiver aberta, a extensao tentara usar esta mesma caixa como alvo.";
    hint.style.cssText = "font-size:11px;color:#9fb3c8;line-height:1.35;margin-top:8px;";

    section.body.appendChild(status);
    section.body.appendChild(activeRow);
    section.body.appendChild(timeRow);
    section.body.appendChild(passwordWrapper);
    section.body.appendChild(actionBox);
    section.body.appendChild(buttons);
    section.body.appendChild(hint);
    loadRoutineConfig();

    return section.section;
  }

  function appendFullWidthButton(container, button) {
    button.style.gridColumn = "1 / -1";
    container.appendChild(button);
    return button;
  }

  function createModuleTabs(tabs) {
    const nav = document.createElement("div");
    nav.style.cssText =
      "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:8px 0 7px;";

    const pages = document.createElement("div");
    pages.style.cssText =
      "border:1px solid #344253;background:#101820;border-radius:7px;padding:7px;min-height:120px;";

    const buttons = [];
    const activeId = storageGet("SPA_CDSP_ACTIVE_MODULE", tabs[0] ? tabs[0].id : "");

    function activate(id) {
      tabs.forEach((tab, index) => {
        const active = tab.id === id || (!id && index === 0);
        tab.page.style.display = active ? "" : "none";
        buttons[index].style.background = active ? "#1e5f96" : "#263544";
        buttons[index].style.borderColor = active ? "#4aa3df" : "#425466";
        buttons[index].style.color = active ? "#ffffff" : "#d7e4ef";
      });
      storageSet("SPA_CDSP_ACTIVE_MODULE", id || (tabs[0] && tabs[0].id) || "");
    }

    tabs.forEach((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = tab.label;
      button.title = tab.title || tab.label;
      button.style.cssText =
        "border:1px solid #425466;background:#263544;color:#d7e4ef;border-radius:5px;" +
        "height:30px;padding:0 5px;cursor:pointer;font-size:11px;font-weight:800;overflow:hidden;" +
        "text-overflow:ellipsis;white-space:nowrap;";
      button.addEventListener("click", () => activate(tab.id));
      buttons.push(button);
      nav.appendChild(button);

      tab.page.style.display = "none";
      pages.appendChild(tab.page);
    });

    activate(tabs.some((tab) => tab.id === activeId) ? activeId : (tabs[0] && tabs[0].id));
    return { nav, pages };
  }

  function applySavedPanelPosition(panel) {
    const raw = storageGet("SPA_CDSP_PANEL_POSITION", "");
    if (!raw) return false;

    try {
      const position = JSON.parse(raw);
      const left = Number(position.left);
      const top = Number(position.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return false;

      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      panel.style.left = Math.min(Math.max(8, left), maxLeft) + "px";
      panel.style.top = Math.min(Math.max(8, top), maxTop) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      return true;
    } catch (_error) {
      return false;
    }
  }

  function persistPanelPosition(panel) {
    const rect = panel.getBoundingClientRect();
    storageSet(
      "SPA_CDSP_PANEL_POSITION",
      JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top),
      })
    );
  }

  function enablePanelDragging(panel, header) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;

    header.style.cursor = "move";
    header.title = "Arraste para mover o painel";

    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest("button,input,select,textarea,a")) return;

      const rect = panel.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    header.addEventListener("pointermove", (event) => {
      if (!dragging) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      const left = Math.min(Math.max(8, startLeft + dx), maxLeft);
      const top = Math.min(Math.max(8, startTop + dy), maxTop);
      panel.style.left = left + "px";
      panel.style.top = top + "px";
      event.preventDefault();
    });

    function finishDrag(event) {
      if (!dragging) return;
      dragging = false;
      try {
        header.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // O ponteiro pode ja ter sido liberado pelo navegador.
      }
      persistPanelPosition(panel);
      if (moved) {
        panel.dataset.dragJustEnded = "1";
        setTimeout(() => {
          delete panel.dataset.dragJustEnded;
        }, 80);
      }
    }

    header.addEventListener("pointerup", finishDrag);
    header.addEventListener("pointercancel", finishDrag);

    window.addEventListener("resize", () => {
      if (!applySavedPanelPosition(panel)) persistPanelPosition(panel);
    });
  }

  function createPanel() {
    const old = document.querySelector("#spa-cdsp-panel");
    if (old) old.remove();

    const embeddedHost = document.querySelector("#cdsp-general-module-triagem");
    const embedded = Boolean(embeddedHost);
    const panel = document.createElement("div");
    panel.id = "spa-cdsp-panel";
    panel.className = embedded ? "cdsp-general-embedded-module cdsp-general-embedded-triagem" : "";
    panel.tabIndex = -1;
    panel.style.cssText = embedded
      ? "position:relative;width:100%;background:#17212b;color:#fff;border:1px solid #344253;" +
        "border-radius:8px;padding:10px;box-shadow:none;font-family:'Segoe UI',Arial,sans-serif;overflow:hidden;"
      : "position:fixed;right:18px;bottom:18px;width:410px;z-index:999999;" +
        "background:#17212b;color:#fff;border-radius:8px;padding:12px;" +
        "box-shadow:0 12px 40px rgba(0,0,0,.35);font-family:Arial,sans-serif;";

    const header = document.createElement("div");
    header.style.cssText = embedded
      ? "display:flex;align-items:center;gap:8px;margin:-10px -10px 8px -10px;padding:9px 10px;" +
        "background:#1f2d3a;border-bottom:1px solid rgba(255,255,255,.08);"
      : "display:flex;justify-content:space-between;align-items:center;gap:8px;";

    const title = document.createElement("div");
    title.textContent = "Triagem";
    title.style.cssText =
      "font-weight:800;font-size:14px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

    const status = document.createElement("div");
    status.id = "spa-cdsp-status";
    status.textContent = "Pronto";
    status.style.cssText =
      "font-size:11px;color:#cfd8dc;background:#263544;border-radius:999px;padding:4px 8px;white-space:nowrap;";

    const quickStopButton = document.createElement("button");
    quickStopButton.type = "button";
    quickStopButton.textContent = "Encerrar";
    quickStopButton.title = "Encerrar fluxo em andamento";
    quickStopButton.style.cssText =
      "border:1px solid #8a3030;background:#3a1b1b;color:#ffd6d6;border-radius:5px;" +
      "height:26px;min-width:62px;padding:0 7px;cursor:pointer;font-size:11px;font-weight:700;";
    quickStopButton.addEventListener("click", (event) => {
      event.stopPropagation();
      stop();
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.id = "spa-cdsp-panel-toggle";
    toggleButton.style.cssText =
      "border:1px solid #425466;background:#263544;color:#e3f2fd;border-radius:5px;" +
      "height:26px;min-width:58px;padding:0 7px;cursor:pointer;font-size:11px;font-weight:700;";
    if (embedded) toggleButton.style.display = "none";

    const help = document.createElement("div");
    help.textContent =
      "Quantidade vazia ou 0 processa tudo. Com lote ativo, as acoes seguem a lista preparada. Depois das ciencias, use Atualizar lista.";
    help.style.cssText = "font-size:11px;color:#b0bec5;margin:0 0 8px 0;line-height:1.35;";

    const logBox = document.createElement("div");
    logBox.id = "spa-cdsp-log";
    logBox.style.cssText =
      "height:125px;overflow:auto;background:#0d131a;border:1px solid #344253;border-radius:6px;padding:7px;" +
      "color:#d5e5f2;font-family:Consolas,monospace;font-size:11px;line-height:1.35;";

    const content = document.createElement("div");
    content.id = "spa-cdsp-panel-content";
    content.style.cssText = "max-height:calc(100vh - 96px);overflow:auto;margin-top:8px;padding-right:2px;";

    const triagemPage = document.createElement("div");
    const triagemButtons = createButtonGrid();
    triagemButtons.appendChild(createButton("Dar Ciência", () => takeScienceAllPages(currentActionLimit()), "teal"));
    triagemButtons.appendChild(createButton("Atualizar Lista", refreshProceduresTable, "blue"));
    appendFullWidthButton(
      triagemButtons,
      createButton("Abrir Abas", () => openTabsAllPages(currentActionLimit()), "purple")
    );
    triagemPage.appendChild(createTriageClassificationFlow());
    triagemPage.appendChild(createExpedienteContentControls());
    triagemPage.appendChild(triagemButtons);

    const duplicadosPage = document.createElement("div");
    const duplicadosButtons = createButtonGrid();
    appendFullWidthButton(
      duplicadosButtons,
      createButton("Abrir Duplicados", () => openDuplicateTabsAllPages(currentActionLimit()), "amber")
    );
    appendFullWidthButton(
      duplicadosButtons,
      createButton("Relatorio Duplicados", () => buildDuplicateReport(false), "info")
    );
    duplicadosPage.appendChild(duplicadosButtons);

    const pecasPage = document.createElement("div");
    const pecasButtons = createButtonGrid();
    appendFullWidthButton(
      pecasButtons,
      createButton("Relatório Peças", () => buildPieceReport(), "info")
    );
    const pecasHint = document.createElement("div");
    pecasHint.textContent =
      "Identifica peças por leitura de expediente e preenche a classificação, sem salvar automaticamente.";
    pecasHint.style.cssText = "font-size:11px;color:#9fb3c8;line-height:1.35;margin-top:7px;";
    pecasPage.appendChild(pecasButtons);
    pecasPage.appendChild(pecasHint);

    const filtrosPage = document.createElement("div");
    filtrosPage.appendChild(createPageBatchControls());
    filtrosPage.appendChild(createJurisdictionControls());
    filtrosPage.appendChild(createDeadlineControls());

    const programadaPage = document.createElement("div");
    programadaPage.appendChild(createScheduledRoutineControls());

    const registroPage = document.createElement("div");
    registroPage.appendChild(help);
    registroPage.appendChild(logBox);

    const moduleTabs = createModuleTabs([
      { id: "triagem", label: "Triagem", page: triagemPage },
      { id: "duplicados", label: "Duplicados", page: duplicadosPage },
      { id: "pecas", label: "Peças", page: pecasPage },
      { id: "filtros", label: "Filtros", page: filtrosPage },
      { id: "programada", label: "Programada", page: programadaPage },
      { id: "registro", label: "Registro", page: registroPage },
    ]);

    function setPanelCollapsed(collapsed) {
      if (embedded) collapsed = false;
      panel.dataset.collapsed = collapsed ? "1" : "0";
      content.style.display = collapsed ? "none" : "";
      status.style.display = collapsed ? "none" : "";
      toggleButton.textContent = collapsed ? "Abrir" : "Ocultar";
      toggleButton.title = collapsed ? "Abrir menu da automacao" : "Recolher menu da automacao";
      if (embedded) {
        panel.style.width = "100%";
        panel.style.padding = "10px";
        panel.style.cursor = "default";
      } else {
        panel.style.width = collapsed ? "215px" : "410px";
        panel.style.padding = collapsed ? "8px 10px" : "12px";
        panel.style.cursor = collapsed ? "pointer" : "default";
        applySavedPanelPosition(panel);
      }
    }

    toggleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setPanelCollapsed(panel.dataset.collapsed !== "1");
    });

    header.addEventListener("click", () => {
      if (panel.dataset.dragJustEnded === "1") return;
      if (panel.dataset.collapsed === "1") setPanelCollapsed(false);
    });

    header.appendChild(title);
    header.appendChild(status);
    header.appendChild(quickStopButton);
    header.appendChild(toggleButton);
    panel.appendChild(header);
    content.appendChild(createHealthLogo());
    content.appendChild(moduleTabs.nav);
    content.appendChild(createDateControls());
    content.appendChild(createLimitControls());
    content.appendChild(createActiveFiltersSummary());
    content.appendChild(moduleTabs.pages);
    panel.appendChild(content);
    (embedded ? embeddedHost : document.body).appendChild(panel);
    if (!embedded) {
      enablePanelDragging(panel, header);
      applySavedPanelPosition(panel);
    }
    setPanelCollapsed(!embedded);
    updateActiveFiltersSummary();
  }

  window.SPA_CDSP_AUTOMACAO = {
    config: CONFIG,
    state: state,
    takeScienceAllPages: takeScienceAllPages,
    refreshProceduresTable: refreshProceduresTable,
    preparePageBatch: preparePageBatch,
    clearPageBatch: clearPageBatch,
    openTabsAllPages: openTabsAllPages,
    openDuplicateTabsAllPages: openDuplicateTabsAllPages,
    buildPieceReport: buildPieceReport,
    refreshExternalDocumentsPanel: refreshExternalDocumentsPanel,
    closeMarkedAllPages: closeMarkedAllPages,
    log: log,
    setStatus: setStatus,
    stop: stop,
    restoreDialogs: function () {
      window.confirm = originalConfirm;
      window.alert = originalAlert;
      log("confirm/alert restaurados.");
    },
  };

  function startPanelWhenReady() {
    if (!document.body) {
      setTimeout(startPanelWhenReady, 250);
      return;
    }

    createPanel();
    setupExternalDocumentsPanel();
    setTimeout(continuePendingTriageClassification, 450);
    log("Painel carregado. Defina uma quantidade ou deixe 0/vazio para processar tudo.", "ok");
  }

  startPanelWhenReady();

  function createDateControls() {
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "display:flex;align-items:center;gap:6px;margin:6px 0 8px 0;font-size:12px;";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "spa-cdsp-use-date";
    checkbox.checked = storageGet("SPA_CDSP_DATE_ENABLED", CONFIG.dateFilter.enabled ? "1" : "0") === "1";

    const label = document.createElement("label");
    label.htmlFor = "spa-cdsp-use-date";
    label.textContent = "Filtrar data";
    label.style.cssText = "margin:0;color:#e3f2fd;";

    const input = document.createElement("input");
    input.id = "spa-cdsp-date";
    input.type = "date";
    input.value = storageGet("SPA_CDSP_DATE", CONFIG.dateFilter.date || "");
    input.style.cssText =
      "height:28px;border:0;border-radius:4px;padding:4px 6px;font-size:12px;flex:1;";

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    wrapper.appendChild(input);

    checkbox.addEventListener("change", () => {
      storageSet("SPA_CDSP_DATE_ENABLED", checkbox.checked ? "1" : "0");
      clearPageBatchForScopeChange("o filtro de data mudou");
    });
    input.addEventListener("change", () => {
      storageSet("SPA_CDSP_DATE", input.value || "");
      clearPageBatchForScopeChange("a data filtrada mudou");
    });

    return wrapper;
  }

  function createLimitControls() {
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "display:flex;align-items:center;gap:6px;margin:6px 0 8px 0;font-size:12px;";

    const label = document.createElement("label");
    label.htmlFor = "spa-cdsp-limit";
    label.textContent = "Quantidade";
    label.style.cssText = "margin:0;color:#e3f2fd;min-width:72px;";

    const input = document.createElement("input");
    input.id = "spa-cdsp-limit";
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.placeholder = "0 = tudo";
    input.value = storageGet("SPA_CDSP_LIMIT", "");
    input.style.cssText =
      "height:28px;border:0;border-radius:4px;padding:4px 6px;font-size:12px;flex:1;";

    input.addEventListener("change", () => {
      const limit = normalizeLimit(input.value);
      input.value = limit ? String(limit) : "";
      storageSet("SPA_CDSP_LIMIT", input.value || "");
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);

    return wrapper;
  }

  function createJurisdictionControls() {
    const hasSavedFilter =
      storageGet("SPA_CDSP_FILTER_TRIBUNAL_1", "0") === "1" ||
      storageGet("SPA_CDSP_FILTER_TRIBUNAL_2", "0") === "1" ||
      storageGet("SPA_CDSP_FILTER_CEJUSC", "0") === "1";
    const section = createPanelSection("Filtros de origem", hasSavedFilter);

    const hint = document.createElement("div");
    hint.textContent = "Aplica as acoes somente aos processos que baterem com os filtros marcados.";
    hint.style.cssText = "font-size:11px;color:#9fb3c8;margin-bottom:6px;";

    section.body.appendChild(hint);
    section.body.appendChild(createCheck("spa-cdsp-filter-tribunal-1", "Processos de 1o Grau", "SPA_CDSP_FILTER_TRIBUNAL_1"));
    section.body.appendChild(createCheck("spa-cdsp-filter-tribunal-2", "Processos de 2o Grau", "SPA_CDSP_FILTER_TRIBUNAL_2"));
    section.body.appendChild(createCheck("spa-cdsp-filter-cejusc", "Jurisdicao contem CEJUSC", "SPA_CDSP_FILTER_CEJUSC"));

    return section.section;
  }

  function createExpedienteContentControls() {
    const hasSavedFilter =
      storageGet("SPA_CDSP_EXPEDIENTE_FILTER_PAUTA", "0") === "1" ||
      storageGet("SPA_CDSP_EXPEDIENTE_FILTER_NEGOCIACAO", "0") === "1";
    const section = createPanelSection("Filtro de expediente", hasSavedFilter);

    const hint = document.createElement("div");
    hint.textContent =
      "Quando marcado, Abrir Abas deixa abertas apenas pendencias com expediente que contenha a frase escolhida.";
    hint.style.cssText = "font-size:11px;color:#9fb3c8;margin-bottom:6px;line-height:1.35;";

    section.body.appendChild(hint);
    section.body.appendChild(
      createCheck(
        "spa-cdsp-expediente-filter-pauta",
        "Pauta de Julgamento",
        "SPA_CDSP_EXPEDIENTE_FILTER_PAUTA"
      )
    );
    section.body.appendChild(
      createCheck(
        "spa-cdsp-expediente-filter-negociacao",
        "Negociacao Assincrona",
        "SPA_CDSP_EXPEDIENTE_FILTER_NEGOCIACAO"
      )
    );

    const note = document.createElement("div");
    note.textContent =
      "Se o texto do PDF nao puder ser lido, a pendencia sera fechada e o erro aparecera no log.";
    note.style.cssText = "font-size:11px;color:#9fb3c8;margin-top:6px;line-height:1.35;";
    section.body.appendChild(note);

    return section.section;
  }

  function createTriageClassificationFlow() {
    const section = createPanelSection("Fluxo de Triagem", false);
    const flowState = {
      additionalInfo: "",
      manifestation: "",
      assessor: "",
      hasOffice: "",
      officeObservation: null,
      processObservation: ""
    };
    const form = document.createElement("div");
    form.style.cssText = "display:grid;grid-template-columns:1fr;gap:7px;";

    function inputField(labelText, placeholder, optional) {
      const label = document.createElement("label");
      label.style.cssText = "display:grid;grid-template-columns:1fr;gap:4px;color:#b8c6d1;font-size:10px;font-weight:800;";
      const title = document.createElement("span");
      title.textContent = labelText + (optional ? " (opcional)" : "");
      const input = document.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.placeholder = placeholder || labelText;
      input.style.cssText =
        "width:100%;box-sizing:border-box;border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
        "font-size:12px;font-weight:700;padding:7px 8px;outline:none;min-height:34px;";
      label.appendChild(title);
      label.appendChild(input);
      return { label: label, input: input };
    }

    function searchableChoice(labelText, choices, onChoose) {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "display:grid;grid-template-columns:1fr;gap:4px;position:relative;";
      const title = document.createElement("div");
      title.textContent = labelText;
      title.style.cssText = "color:#b8c6d1;font-size:10px;font-weight:800;";
      const input = document.createElement("input");
      const menu = document.createElement("div");
      input.type = "text";
      input.autocomplete = "off";
      input.placeholder = "Pesquisar...";
      input.style.cssText =
        "width:100%;box-sizing:border-box;border:1px solid #344253;border-radius:5px;background:#0d131a;color:#e8f0f7;" +
        "font-size:12px;font-weight:700;padding:7px 8px;outline:none;min-height:34px;";
      menu.style.cssText =
        "display:none;max-height:180px;overflow:auto;border:1px solid #344253;border-radius:5px;background:#101821;" +
        "padding:3px;position:relative;z-index:2;";

      function filteredChoices() {
        const query = normalizeText(input.value).toLowerCase();
        return choices.filter((choice) => !query || normalizeText(choice.label).toLowerCase().indexOf(query) >= 0);
      }

      function renderMenu() {
        const matches = filteredChoices().slice(0, 25);
        menu.innerHTML = "";
        menu.style.display = matches.length ? "grid" : "none";
        matches.forEach((choice) => {
          const item = document.createElement("button");
          item.type = "button";
          item.textContent = choice.label;
          item.style.cssText =
            "border:0;border-radius:3px;background:transparent;color:#e8f0f7;text-align:left;padding:6px 7px;cursor:pointer;" +
            "font-size:11px;font-weight:700;line-height:1.25;";
          item.addEventListener("mousedown", (event) => event.preventDefault());
          item.addEventListener("click", () => {
            input.value = choice.label;
            menu.style.display = "none";
            onChoose(choice);
            refresh();
          });
          menu.appendChild(item);
        });
      }

      input.addEventListener("focus", renderMenu);
      input.addEventListener("input", () => {
        onChoose(null);
        renderMenu();
        refresh();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const match = filteredChoices()[0];
        if (!match) return;
        event.preventDefault();
        input.value = match.label;
        menu.style.display = "none";
        onChoose(match);
        refresh();
      });
      input.addEventListener("blur", () => setTimeout(() => { menu.style.display = "none"; }, 150));
      wrapper.appendChild(title);
      wrapper.appendChild(input);
      wrapper.appendChild(menu);
      return { wrapper: wrapper, input: input };
    }

    const additional = inputField("Informações adicionais", "", true);
    additional.input.addEventListener("input", () => { flowState.additionalInfo = additional.input.value; });
    form.appendChild(additional.label);

    const manifestationChoices = TRIAGE_MANIFESTATION_OPTIONS.map((label) => ({ label: label, value: label }));
    const manifestation = searchableChoice("Manifestação Sugerida", manifestationChoices, (choice) => {
      flowState.manifestation = choice ? choice.value : "";
    });
    form.appendChild(manifestation.wrapper);

    const activeAssessorChoices = [];
    const assessor = searchableChoice("Designar ao assessor(a)", activeAssessorChoices, (choice) => {
      flowState.assessor = choice ? choice.value : "";
    });
    assessor.input.placeholder = "Carregando equipe...";
    assessor.input.disabled = true;
    form.appendChild(assessor.wrapper);

    const officeBox = document.createElement("div");
    officeBox.style.cssText = "display:grid;grid-template-columns:1fr;gap:5px;";
    const officeTitle = document.createElement("div");
    officeTitle.textContent = "Terá Ofício";
    officeTitle.style.cssText = "color:#b8c6d1;font-size:10px;font-weight:800;";
    const officeChoices = document.createElement("div");
    officeChoices.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;";
    [
      { value: "yes", label: "Sim" },
      { value: "no", label: "Não" }
    ].forEach((choice) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const text = document.createElement("span");
      input.type = "radio";
      input.name = "spa-cdsp-triage-office";
      input.value = choice.value;
      text.textContent = choice.label;
      label.style.cssText =
        "display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:center;border:1px solid #344253;" +
        "border-radius:5px;background:#0d131a;color:#e8f0f7;font-size:11px;font-weight:700;padding:7px 8px;cursor:pointer;";
      input.addEventListener("change", () => {
        flowState.hasOffice = choice.value;
        refresh();
      });
      label.appendChild(input);
      label.appendChild(text);
      officeChoices.appendChild(label);
    });
    officeBox.appendChild(officeTitle);
    officeBox.appendChild(officeChoices);
    form.appendChild(officeBox);

    const observationSlot = document.createElement("div");
    form.appendChild(observationSlot);

    const classifyButton = createButton("Classificar processo", async () => {
      if (!canClassify() || state.running) return;
      try {
        state.running = true;
        await beginTriageClassification({
          additionalInfo: flowState.additionalInfo,
          manifestation: flowState.manifestation,
          assessor: flowState.assessor,
          hasOffice: flowState.hasOffice === "yes",
          officeObservation: flowState.hasOffice === "yes" && flowState.officeObservation
            ? flowState.officeObservation.value
            : "",
          processObservation: flowState.processObservation
        });
      } catch (error) {
        state.running = false;
        const message = error && error.message ? error.message : String(error);
        setStatus("Fluxo de Triagem falhou");
        log(message, "error");
        originalAlert.call(window, message);
      }
    }, "primary");
    classifyButton.style.width = "100%";
    form.appendChild(classifyButton);

    function canClassify() {
      if (!flowState.manifestation || !String(flowState.assessor || "").trim() || !flowState.hasOffice) return false;
      return flowState.hasOffice !== "yes" || Boolean(flowState.officeObservation && flowState.officeObservation.value);
    }

    function refresh() {
      observationSlot.innerHTML = "";
      if (flowState.hasOffice === "yes") {
        const officeObservation = searchableChoice("Observação do Ofício", TRIAGE_OFFICE_OBSERVATIONS, (choice) => {
          flowState.officeObservation = choice;
        });
        if (flowState.officeObservation) officeObservation.input.value = flowState.officeObservation.label;
        observationSlot.appendChild(officeObservation.wrapper);
      }
      if (flowState.hasOffice === "yes" || flowState.hasOffice === "no") {
        const processObservation = inputField("Observação do Processo", "", true);
        processObservation.input.value = flowState.processObservation;
        processObservation.input.addEventListener("input", () => {
          flowState.processObservation = processObservation.input.value;
        });
        observationSlot.appendChild(processObservation.label);
      }
      classifyButton.disabled = !canClassify();
      classifyButton.style.opacity = classifyButton.disabled ? ".55" : "1";
      classifyButton.style.cursor = classifyButton.disabled ? "not-allowed" : "pointer";
    }

    section.body.appendChild(form);
    refresh();
    window.setTimeout(() => {
      const database = window.SPA_CDSP_TEAM_DATABASE;
      if (!database || typeof database.loadActiveNames !== "function") {
        setStatus("Lista da equipe indisponivel");
        log("Leitor da lista interna da equipe nao foi carregado.", "error");
        return;
      }

      database
        .loadActiveNames()
        .then((names) => {
          names.forEach((name) => activeAssessorChoices.push({ label: name, value: name }));
          assessor.input.disabled = false;
          assessor.input.placeholder = "Pesquisar assessor(a)...";
          log("Lista interna carregada com " + activeAssessorChoices.length + " assessor(es) ativo(s).", "ok");
        })
        .catch((error) => {
          assessor.input.placeholder = "Lista da equipe indisponivel";
          const message = error && error.message ? error.message : String(error);
          setStatus("Lista da equipe indisponivel");
          log(message, "error");
        });
    }, 0);
    return section.section;
  }

  function createDeadlineControls() {
    const legacyDeadline = storageGet("SPA_CDSP_DEADLINE_FILTER", "");
    const hasSavedDeadline =
      Boolean(legacyDeadline) ||
      storageGet("SPA_CDSP_DEADLINE_LONG", "0") === "1" ||
      storageGet("SPA_CDSP_DEADLINE_SHORT", "0") === "1" ||
      storageGet("SPA_CDSP_DEADLINE_LATE", "0") === "1" ||
      storageGet("SPA_CDSP_DEADLINE_NONE", "0") === "1";
    const section = createPanelSection("Filtro de prazo", hasSavedDeadline);

    const hint = document.createElement("div");
    hint.textContent =
      "Marque uma ou mais opcoes. Sem nenhuma opcao marcada, todos os prazos entram no fluxo.";
    hint.style.cssText = "font-size:11px;color:#9fb3c8;margin-bottom:6px;";

    section.body.appendChild(hint);
    section.body.appendChild(
      createCheck(
        "spa-cdsp-deadline-long",
        "Azul - prazo longo",
        "SPA_CDSP_DEADLINE_LONG",
        legacyDeadline === "long" ? "1" : "0"
      )
    );
    section.body.appendChild(
      createCheck(
        "spa-cdsp-deadline-short",
        "Amarelo - prazo curto",
        "SPA_CDSP_DEADLINE_SHORT",
        legacyDeadline === "short" ? "1" : "0"
      )
    );
    section.body.appendChild(
      createCheck(
        "spa-cdsp-deadline-late",
        "Vermelho - atrasado",
        "SPA_CDSP_DEADLINE_LATE",
        legacyDeadline === "late" ? "1" : "0"
      )
    );
    section.body.appendChild(
      createCheck(
        "spa-cdsp-deadline-none",
        "Sem prazo",
        "SPA_CDSP_DEADLINE_NONE",
        legacyDeadline === "none" ? "1" : "0"
      )
    );

    const note = document.createElement("div");
    note.textContent =
      "O filtro usa a cor do prazo no SPA. Vermelho tambem considera prazo vencido quando houver data.";
    note.style.cssText = "font-size:11px;color:#9fb3c8;margin-top:6px;";
    section.body.appendChild(note);

    return section.section;
  }
})();

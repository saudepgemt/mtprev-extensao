/**
 * CDSP - Extrator SPA/SIGADOC — content.js v3.15
 *
 * Fluxos:
 * - SPA: extrai campos visíveis, copia a tabela e salva os dados para o SIGADOC.
 * - SIGADOC: seleciona/preenche somente campos de minuta para conferência humana.
 * - SIGADOC: opcionalmente grava, assina, baixa e tramita ofícios mapeados.
 * - SPA: finaliza a resposta de ofício com o PDF assinado quando houver fluxo pendente.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'spaExtratorUltimoOficio';
  const PENDING_SIGADOC_KEY = 'spaExtratorPreenchimentoSigadocPendente';
  const PENDING_ASSINATURA_KEY = 'spaExtratorAssinaturaSigadocPendente';
  const PENDING_POS_ASSINATURA_KEY = 'spaExtratorPosAssinaturaSigadocPendente';
  const PENDING_TRAMITACAO_KEY = 'spaExtratorTramitacaoSigadocPendente';
  let preenchimentoSigadocPendenteEmAndamento = false;
  const PENDING_SPA_FINALIZACAO_KEY = 'spaExtratorFinalizacaoSpaPendente';
  const SIGADOC_LIST_AUTOMATION_KEY = 'cdspSigadocListAutomation';
  const SIGADOC_MENU_POSITION_KEY = 'cdspSigadocMenuPosition';
  const SIGADOC_MENU_COLLAPSED_KEY = 'cdspSigadocMenuCollapsed';
  const SIGADOC_SESSION_PASSWORD_KEY = 'cdspSigadocSessionPassword';
  const TEMPO_EXPIRACAO_MS = 1000 * 60 * 60 * 8;
  const TEMPO_FLUXO_ASSINATURA_MS = 1000 * 60 * 15;
  const TEMPO_FLUXO_FINALIZACAO_MS = 1000 * 60 * 60 * 8;

  const URL_PROCESSO = /spa\.pge\.mt\.gov\.br\/procedures\/\d+\/?(?:[?#].*)?$/;
  const URL_FOLDER = /spa\.pge\.mt\.gov\.br\/procedures\/\d+\/folder\/?(?:[?#].*)?$/;
  const HOST_SIGADOC = /(^|\.)sigadoc\.mt\.gov\.br$/;

  const ASSUNTOS_SAUDE_PJE = Object.freeze({
    '12480': 'DIREITO DA SAÚDE',
    '15218': 'Autorização para Interrupção de Gravidez (Aborto)',
    '12521': 'Doação e transplante de órgãos, tecidos ou partes',
    '15514': 'Doença Rara',
    '12520': 'Genética / Células Tronco',
    '12507': 'Mental',
    '12508': 'Internação compulsória',
    '12509': 'Internação involuntária',
    '12510': 'Internação voluntária',
    '12481': 'Pública',
    '12485': 'Fornecimento de insumos',
    '12498': 'Cadeira de rodas / cadeira de banho / cama hospitalar',
    '12497': 'Curativos/Bandagem',
    '12499': 'Fraldas',
    '12484': 'Fornecimento de medicamentos',
    '12496': 'Oncológico',
    '12492': 'Registrado na ANVISA',
    '12495': 'Não padronizado',
    '12494': 'Padronizado',
    '12493': 'Sem registro na ANVISA',
    '12483': 'Internação/Transferência Hospitalar',
    '12505': 'Leito de enfermaria / leito oncológico',
    '12506': 'Unidade de terapia intensiva (UTI)',
    '12511': 'Sistema Único de Saúde (SUS)',
    '12518': 'Controle Social e Conselhos de Saúde',
    '12512': 'Convênio médico com o SUS',
    '12513': 'Financiamento do SUS',
    '12514': 'Reajuste da tabela do SUS',
    '12515': 'Repasse de verbas do SUS',
    '12516': 'Ressarcimento do SUS',
    '12517': 'Terceirização do SUS',
    '14759': 'Tratamento Domiciliar (Home Care)',
    '12491': 'Tratamento médico-hospitalar',
    '12501': 'Cirurgia',
    '12502': 'Eletiva',
    '12503': 'Urgência',
    '12500': 'Consulta',
    '12504': 'Diálise/Hemodiálise',
    '12519': 'Vigilância Sanitária e Epidemiológica',
    '12482': 'Suplementar',
    '12486': 'Planos de saúde',
    '12490': 'Fornecimento de insumos',
    '12487': 'Fornecimento de medicamentos',
    '12488': 'Reajuste contratual',
    '12489': 'Tratamento médico-hospitalar',
    '14760': 'Tratamento Domiciliar (Home Care)',
    '12030': 'Internação compulsória',
    '12157': 'Internação Provisória',
    '11388': 'Internação sem atividades externas',
    '11389': 'Liberdade Assistida',
  });

  const USUARIOS_MODELO_SIGADOC = Object.freeze([
    {
      sufixo: 'F',
      nomes: ['FRANSQUISLAINE DE JESUS ANICEZIO'],
    },
    {
      sufixo: 'IG',
      nomes: ['IGOR DIEGO BRAGA RODRIGUES DE CAMPOS'],
    },
  ]);

  const CREDENCIAIS_ASSINATURA_SIGADOC = Object.freeze([
    {
      matricula: 'PGE309619',
      senha: 'Marcela2026*',
      nomes: ['FRANSQUISLAINE DE JESUS ANICEZIO'],
    },
    {
      matricula: 'PGE346756',
      senha: '@Igor30',
      nomes: ['IGOR DIEGO BRAGA RODRIGUES DE CAMPOS'],
    },
  ]);

  const DESTINATARIO_PADRAO_SIGADOC = Object.freeze({
    sigla: 'SES-UNIJUR',
    descricao: 'UNIDADE JURIDICA',
  });

  const DESTINATARIO_UNIJUR_SIGADOC = Object.freeze({
    sigla: 'UNIJUR',
    descricao: 'UNIDADE JURIDICA',
  });

  const DESTINATARIO_DGPG_SIGADOC = Object.freeze({
    sigla: 'DGPG',
    descricao: 'DIRETORIA GERAL DA PROCURADORIA GERAL',
  });

  const MODELO_DOCUMENTO_OFICIO_SIGADOC = 'Ofício';
  const MODELO_DOCUMENTO_COMUNICACAO_INTERNA_SIGADOC = 'Comunicação Interna';

  const CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC = Object.freeze({
    id: '4895',
    codigo: '091',
    descricao: 'AÇÕES JUDICIAIS - Outros Assuntos Referentes à Administração Geral',
  });

  const MODELOS_SIGADOC_POR_TIPO = Object.freeze([
    {
      tipo: 'PERÍCIA JUSTIÇA GRATUITA',
      aliases: [
        'pericia justica gratuita',
        'perícia justiça gratuita',
        'pericia gratuidade',
        'perícia gratuidade',
        'gratuidade de justica',
        'gratuidade de justiça',
      ],
      bases: ['SAÚDE - PERÍCIA JUSTIÇA GRATUITA', 'SAUDE - PERICIA JUSTICA GRATUITA'],
      usarSufixo: false,
      modeloDocumento: MODELO_DOCUMENTO_COMUNICACAO_INTERNA_SIGADOC,
      destinatario: DESTINATARIO_DGPG_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      fluxoPosAssinatura: 'parar',
    },
    {
      tipo: 'PERÍCIA ESTADO',
      aliases: [
        'pericia estado',
        'perícia estado',
        'pericia solicitada pelo estado',
        'perícia solicitada pelo estado',
      ],
      bases: ['SAÚDE - PERÍCIA SOLICITADA PELO ESTADO', 'SAUDE - PERICIA SOLICITADA PELO ESTADO'],
      usarSufixo: false,
      modeloDocumento: MODELO_DOCUMENTO_COMUNICACAO_INTERNA_SIGADOC,
      destinatario: DESTINATARIO_DGPG_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      fluxoPosAssinatura: 'parar',
    },
    {
      tipo: 'AUDIÊNCIA',
      aliases: ['audiencia', 'audiência'],
      bases: ['SAÚDE - AUDIÊNCIA', 'SAUDE - AUDIENCIA'],
      usarSufixo: false,
      modeloDocumento: MODELO_DOCUMENTO_OFICIO_SIGADOC,
      destinatario: DESTINATARIO_UNIJUR_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      apenasPreenchimento: true,
      conteudoProprio: true,
    },
    {
      tipo: 'SINF DANO MORAL',
      aliases: [
        'sinf dano moral',
        'dano moral',
        'solicitacao de informacoes dano moral',
        'solicitação de informações dano moral',
      ],
      bases: ['SAÚDE - SINF DANO MORAL', 'SAUDE - SINF DANO MORAL'],
      usarSufixo: false,
      modeloDocumento: MODELO_DOCUMENTO_OFICIO_SIGADOC,
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      apenasPreenchimento: true,
      conteudoProprio: true,
    },
    {
      tipo: 'AVALIAÇÃO PSICOPEDAGÓGICA',
      aliases: [
        'avaliacao psicopedagogica',
        'avaliação psicopedagógica',
        'avaliacao-psicopedagogica',
        'avaliação-psicopedagógica',
        'psicopedagogica',
        'psicopedagógica',
      ],
      bases: ['SAÚDE - AVALIAÇÃO PSICOPEDAGÓGICA', 'SAUDE - AVALIAÇÃO PSICOPEDAGÓGICA'],
      usarSufixo: false,
      destinatario: { sigla: 'SEDUC-UAS', descricao: 'UNIDADE DE ASSESSORIA' },
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'DESCUMP',
      aliases: ['descump', 'des-cump'],
      bases: ['SAÚDE - DESCUMP', 'SAUDE - DESCUMP'],
      usarSufixo: false,
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'HOME CARE',
      aliases: ['home care', 'home-care', 'homecare'],
      bases: ['SAÚDE - HOME CARE', 'SAUDE - HOME CARE'],
      usarSufixo: false,
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'MED ESCOLAR',
      aliases: ['med escolar', 'med. escolar', 'med-escolar', 'medicamento escolar'],
      bases: ['SAÚDE - MED ESCOLAR', 'SAUDE - MED ESCOLAR'],
      usarSufixo: false,
      destinatario: { sigla: 'SEDUC-UAS', descricao: 'UNIDADE DE ASSESSORIA' },
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'SECUND',
      aliases: ['secund', 'secundaria', 'secundária'],
      bases: ['SAÚDE - SECUND', 'SAUDE - SECUND'],
      usarSufixo: false,
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'SETASC IDOSO',
      aliases: ['setasc idoso', 'setas idoso', 'setasc-idoso', 'setas-idoso'],
      bases: ['SAÚDE - SETASC IDOSO', 'SAUDE - SETASC IDOSO'],
      usarSufixo: false,
      destinatario: {
        sigla: 'SETASC-CPPDDH',
        descricao: 'COORDENADORIA DE PROTECAO A PESSOA E DEFESA DOS DIREITOS HUMANOS',
      },
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'CUMP MULTA',
      aliases: ['cump multa', 'cump multas', 'cump-multa', 'cump-multas'],
      bases: ['SAÚDE CUMP MULTA', 'SAUDE CUMP MULTA'],
      usarSufixo: false,
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'CUMP SANÇÕES',
      aliases: [
        'cump sancoes',
        'cump sanções',
        'cump sançoes',
        'cump sançôes',
        'cump-sancoes',
        'cump-sanções',
        'cump-sançoes',
        'cump-sançôes',
      ],
      bases: ['SAÚDE CUMP SANÇÕES', 'SAUDE CUMP SANÇÕES'],
      usarSufixo: false,
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'REQ',
      aliases: ['req', 'requisicao', 'requisição'],
      bases: ['SAUDE REQ', 'SAÚDE REQ', 'SAUDE - REQ', 'SAÚDE - REQ'],
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'CUMP',
      aliases: ['cump', 'cumprimento', 'cumprir'],
      bases: ['SAUDE CUMP', 'SAÚDE CUMP', 'SAUDE - CUMP', 'SAÚDE - CUMP'],
      aceitarBaseSemSufixo: true,
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'SINF',
      aliases: ['sinf'],
      bases: ['SAUDE SINF', 'SAÚDE SINF', 'SAUDE - SINF', 'SAÚDE - SINF'],
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'EXME',
      aliases: ['exme'],
      bases: ['SAUDE - EXME', 'SAÚDE - EXME', 'SAUDE EXME', 'SAÚDE EXME'],
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'ORÇAMENTO',
      aliases: ['orcamento', 'orçamento'],
      bases: ['SAUDE - ORÇAMENTO', 'SAÚDE - ORÇAMENTO', 'SAUDE ORÇAMENTO', 'SAÚDE ORÇAMENTO'],
    },
    {
      tipo: 'PREST CONTAS',
      aliases: [
        'prest',
        'prest contas',
        'prestacao de contas',
        'prestação de contas',
        'prest contas',
        'prest. contas',
      ],
      bases: [
        'SAUDE PRESTAÇÃO DE CONTAS',
        'SAÚDE PRESTAÇÃO DE CONTAS',
        'SAUDE - PRESTAÇÃO DE CONTAS',
        'SAÚDE - PRESTAÇÃO DE CONTAS',
      ],
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'INFOR SEDUC',
      aliases: ['infor seduc', 'informacoes seduc', 'informações seduc'],
      bases: ['SAÚDE - INFOR SEDUC', 'SAUDE - INFOR SEDUC'],
      usarSufixo: false,
      modeloDocumento: MODELO_DOCUMENTO_OFICIO_SIGADOC,
      destinatario: { sigla: 'SEDUC-UAE', descricao: 'UNIDADE DE APOIO ESTRATÉGICO' },
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
    {
      tipo: 'ALTA',
      aliases: ['alta home care', 'alta medica', 'alta médica', 'alta'],
      bases: ['SAÚDE - ALTA HOME CARE', 'SAUDE - ALTA HOME CARE'],
      usarSufixo: false,
      modeloDocumento: MODELO_DOCUMENTO_OFICIO_SIGADOC,
      destinatario: DESTINATARIO_PADRAO_SIGADOC,
      classificacao: CLASSIFICACAO_ACOES_JUDICIAIS_SIGADOC,
      conteudoProprio: true,
    },
  ]);

  const DESCRICAO_ASSUNTO_POR_TIPO = Object.freeze({
    'AVALIAÇÃO PSICOPEDAGÓGICA': 'Pedido de avaliação psicopedagógica para fins de cumprimento pela Secretaria de Estado de Educação - Ação n°. {Número do Processo}',
    DESCUMP: 'Descumprimento de decisão judicial e consequências - Judicialização da saúde pública - {Número do Processo}',
    'HOME CARE': 'Determinação judicial para realização de visita domiciliar para avaliação de necessidade de serviço de home care - Judicialização da saúde pública - {Número do Processo}',
    'MED ESCOLAR': 'Pedido de administração de medicamento em ambiente escolar para fins de cumprimento pela Secretária de Estado de Educação - Ação n°. {Número do Processo}',
    SECUND: 'Responsabilidade secundária do Estado - Judicialização da saúde pública - {Número do Processo}',
    'SETASC IDOSO': 'Pedido de fornecimento de instituição de longa permanência para idoso para fins de cumprimento pela Secretaria de Estado de Assistência Social - Ação n°. {Número do Processo}',
    'CUMP MULTA': 'MULTA - Comunicação de decisão judicial para fins de cumprimento pela Secretaria de Estado de Saúde - Judicialização da saúde pública - {Número do Processo}',
    'CUMP SANÇÕES': 'SANÇÕES IMPORTANTES - Comunicação de decisão judicial para fins de cumprimento pela Secretaria de Estado de Saúde - Judicialização da saúde pública - {Número do Processo}',
    REQ: 'Requisição de informações pelo Poder Judiciário - Judicialização de saúde pública',
    CUMP: 'Comunicação de decisão judicial para fins de cumprimento pela Secretaria de Estado de Saúde - Judicialização da saúde pública',
    'PREST CONTAS': 'Manifestação sobre prestação de contas ou nota fiscal - Judicialização da saúde pública',
    EXME: 'Alteração, revogação, anulação ou extinção de decisão judicial anterior que determinava fornecimento de produção ou serviço pela SES - Judicialização da saúde pública',
    SINF: 'Eventuais informações para defesa do Estado - Judicialização de saúde pública',
    'PERÍCIA JUSTIÇA GRATUITA': 'Pagamento de perícia de interesse de beneficiário da gratuidade de justiça - Judicialização de saúde pública - {Número do Processo}',
    'PERÍCIA ESTADO': 'Pagamento de perícia solicitada pelo Estado em processo judicial - Judicialização de saúde pública - {Número do Processo}',
    AUDIÊNCIA: 'Designação de audiência judicial - Judicialização de saúde pública - {Número do Processo}',
    'SINF DANO MORAL': 'Solicitação de informações para defesa do Estado em ação de dano moral - Judicialização de saúde pública - {Número do Processo}',
    'INFOR SEDUC': 'SOLICITAÇÃO DE INFORMAÇÕES E PROVIDÊNCIAS PARA CUMPRIMENTO DE DETERMINAÇÃO JUDICIAL - Judicialização de saúde pública - {Número do Processo}',
    ALTA: 'ALTA MÉDICA EM SERVIÇO DE HOME CARE – JUDICIALIZAÇÃO DA SAÚDE PÚBLICA - {Número do Processo}',
  });

  const OFICIOS_COM_FLUXO_SPA = Object.freeze({
    CUMP: 'Ofício de Cumprimento Geral - {Número do Processo} - CDSP',
    'CUMP MULTA': 'Ofício de Cumprimento com incidência de multa - {Número do Processo} - CDSP',
    'CUMP SANÇÕES': 'Ofício de Cumprimento com sanções pessoais - {Número do Processo} - CDSP',
    SINF: 'Ofício de solicitações de informações para defesa - {Número do Processo} - CDSP',
    REQ: 'Ofício de requisição de informações pelo Poder Judiciário - {Número do Processo} - CDSP',
    'PREST CONTAS': 'Ofício de prestação de contas ou nota fiscal - {Número do Processo} - CDSP',
    EXME: 'Ofício de modificação de decisão judicial pretérita - {Número do Processo} - CDSP',
    DESCUMP: 'Ofício de descumprimento de decisão judicial e consequências - {Número do Processo} - CDSP',
    SECUND: 'Ofício de responsabilidade secundária ao Estado - {Número do Processo} - CDSP',
    'HOME CARE': 'Ofício de visita domiciliar para avaliação de home care - {Número do Processo} - CDSP',
  });

  // ─── Utilidades de texto ────────────────────────────────────────────────────

  function limparValorExtraido(valor) {
    const div = document.createElement('div');
    div.innerHTML = valor || '';
    return (div.textContent || valor || '').replace(/\s+/g, ' ').trim();
  }

  function normalizarTexto(texto) {
    return (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function normalizarRotulo(texto) {
    return normalizarTexto(texto).replace(/\s*:\s*$/, '');
  }

  function compactarTexto(texto) {
    return normalizarTexto(texto).replace(/[^a-z0-9]/g, '');
  }

  function aguardar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function aguardarElemento(seletor, timeoutMs = 8000) {
    const inicio = Date.now();

    return new Promise((resolve) => {
      const tentar = () => {
        const elemento = document.querySelector(seletor);
        if (elemento) {
          resolve(elemento);
          return;
        }

        if (Date.now() - inicio > timeoutMs) {
          resolve(null);
          return;
        }

        setTimeout(tentar, 200);
      };

      tentar();
    });
  }

  function rotuloCorresponde(textoRotulo, rotulos) {
    const textoNormalizado = normalizarRotulo(textoRotulo);
    const candidatos = Array.isArray(rotulos) ? rotulos : [rotulos];
    return candidatos.some((rotulo) => textoNormalizado === normalizarRotulo(rotulo));
  }

  function escaparHtml(texto) {
    return (texto || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function identificarTipoOficioEspecial(chave) {
    const texto = normalizarTexto(chave);
    const compacto = compactarTexto(texto);

    if (!texto && !compacto) return '';
    if (
      compacto.includes('periciajusticagratuita') ||
      (compacto.includes('pericia') && compacto.includes('gratuidade'))
    ) {
      return 'PERÍCIA JUSTIÇA GRATUITA';
    }
    if (
      compacto.includes('periciaestado') ||
      compacto.includes('periciasolicitadapeloestado') ||
      (compacto.includes('pericia') && /\bestado\b/.test(texto))
    ) {
      return 'PERÍCIA ESTADO';
    }
    if (compacto.includes('audiencia') || /\baudiencia\b/.test(texto)) {
      return 'AUDIÊNCIA';
    }
    if (
      compacto.includes('sinfdanomoral') ||
      (compacto.includes('danomoral') && /\bsinf\b/.test(texto))
    ) {
      return 'SINF DANO MORAL';
    }
    if (
      compacto.includes('cumpsancao') ||
      compacto.includes('cumpsancoes') ||
      compacto.includes('sancoesimportantes') ||
      (/\bsancoes?\b/.test(texto) && /\b(cump|cumprimento|comunicacao de decisao)\b/.test(texto))
    ) {
      return 'CUMP SANÇÕES';
    }
    if (
      compacto.includes('cumpmulta') ||
      compacto.includes('cumpmultas') ||
      (/\bmulta(s)?\b/.test(texto) && /\b(cump|cumprimento|comunicacao de decisao)\b/.test(texto))
    ) {
      return 'CUMP MULTA';
    }
    if ((compacto.includes('avaliacao') && compacto.includes('psicopedagog')) ||
        compacto.includes('psicopedagogica')) {
      return 'AVALIAÇÃO PSICOPEDAGÓGICA';
    }
    if (
      compacto.includes('setascidoso') ||
      compacto.includes('setasidoso') ||
      (compacto.includes('longapermanencia') && compacto.includes('idoso')) ||
      compacto.includes('instituicaodelongapermanenciaparaidoso')
    ) {
      return 'SETASC IDOSO';
    }
    if (
      compacto.includes('medescolar') ||
      compacto.includes('medicamentoescolar') ||
      (compacto.includes('medicamento') && compacto.includes('ambienteescolar')) ||
      (compacto.includes('administracaodemedicamento') && compacto.includes('escolar'))
    ) {
      return 'MED ESCOLAR';
    }
    if (compacto.includes('inforseduc') || compacto.includes('informacoesseduc')) return 'INFOR SEDUC';
    if (compacto.includes('altahomecare') || compacto.includes('altamedica') || compacto === 'alta') return 'ALTA';
    if (compacto.includes('homecare')) return 'HOME CARE';
    if (/\bdescump\b/.test(texto) || compacto.includes('descumprimento') || compacto === 'descump') return 'DESCUMP';
    if (
      /\bsecund\b/.test(texto) ||
      compacto.includes('responsabilidadesecundaria') ||
      compacto.includes('responsabilidadesecundari') ||
      compacto === 'secund'
    ) {
      return 'SECUND';
    }

    return '';
  }

  function normalizarTipoOficio(valor) {
    const texto = limparValorExtraido(valor);
    const chave = normalizarTexto(texto);

    if (!chave) return '';
    const tipoEspecial = identificarTipoOficioEspecial(chave);
    if (tipoEspecial) return tipoEspecial;
    if (/\breq\b|requisic/.test(chave)) return 'REQ';
    if (/\bcump\b|cumpr/.test(chave)) return 'CUMP';
    if (/\bprest\b|prestacao de contas|prestação de contas|prest.*contas/.test(chave)) return 'PREST CONTAS';
    if (/\bsinf\b/.test(chave)) return 'SINF';
    if (/\bexme\b/.test(chave)) return 'EXME';
    if (/orcamento|orçamento/.test(chave)) return 'ORÇAMENTO';
    if (/informacao|informação|informacoes|informações|\binfo\b/.test(chave)) return 'REQ';

    return texto;
  }

  function normalizarTipoOficioTextoLivre(valor) {
    const chave = normalizarTexto(limparValorExtraido(valor));

    if (!chave) return '';
    const tipoEspecial = identificarTipoOficioEspecial(chave);
    if (tipoEspecial) return tipoEspecial;
    if (/\breq\b/.test(chave)) return 'REQ';
    if (/\bcump\b/.test(chave)) return 'CUMP';
    if (/\bprest\b|prestacao de contas|prest.*contas/.test(chave)) return 'PREST CONTAS';
    if (/\bsinf\b/.test(chave)) return 'SINF';
    if (/\bexme\b/.test(chave)) return 'EXME';
    if (/\borcamento\b/.test(chave)) return 'ORÇAMENTO';

    return '';
  }

  function normalizarAssunto(valor) {
    const assunto = limparValorExtraido(valor);
    if (!assunto) return '';

    const codigosEncontrados = assunto.match(/\b\d{4,}\b/g) || [];
    if (codigosEncontrados.length) {
      for (const codigo of codigosEncontrados) {
        if (ASSUNTOS_SAUDE_PJE[codigo]) return ASSUNTOS_SAUDE_PJE[codigo];
      }
      return assunto;
    }

    return assunto;
  }

  function resolverModeloSigadoc(tipoOficio) {
    const chave = normalizarTexto(tipoOficio);
    if (!chave) return null;

    return MODELOS_SIGADOC_POR_TIPO.find((modelo) =>
      modelo.aliases.some((alias) => chave.includes(normalizarTexto(alias)))
    ) || null;
  }

  function aplicarNumeroProcessoAoTexto(texto, processo) {
    if (!texto) return '';

    const marcadorProcesso = /\{\s*n[úu]mero do processo\s*\}/i;
    if (marcadorProcesso.test(texto)) {
      return texto.replace(marcadorProcesso, processo || '').replace(/\s+$/, '');
    }

    if (processo) return `${texto} - ${processo}`;
    return texto;
  }

  function textoDescricaoAssunto(pacote) {
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao || '');
    const tipo = modelo ? modelo.tipo : normalizarTipoOficio(pacote.tipoOficio || pacote.observacao || '');
    const base = DESCRICAO_ASSUNTO_POR_TIPO[tipo];
    const processo = pacote.processo || '';

    if (base) return aplicarNumeroProcessoAoTexto(base, processo);
    if (processo) return processo;

    return pacote.assunto || 'Judicialização da saúde pública';
  }

  function obterTipoNormalizadoDoPacote(pacote) {
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao || '');
    return (modelo && modelo.tipo) || normalizarTipoOficio(pacote.tipoOficio || pacote.observacao || '');
  }

  function obterModeloNomeOficio(pacote) {
    const tipo = obterTipoNormalizadoDoPacote(pacote);
    return OFICIOS_COM_FLUXO_SPA[tipo] || '';
  }

  function oficioTemFluxoSpa(pacote) {
    return Boolean(obterModeloNomeOficio(pacote));
  }

  function obterModeloDocumentoSigadoc(pacote) {
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao || '');
    return (modelo && modelo.modeloDocumento) || MODELO_DOCUMENTO_OFICIO_SIGADOC;
  }

  function obterModoPosAssinaturaSigadoc(pacote) {
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao || '');
    if (modelo && modelo.fluxoPosAssinatura) return modelo.fluxoPosAssinatura;
    return oficioTemFluxoSpa(pacote) ? 'spa' : 'download';
  }

  function oficioApenasPreenchimento(pacote) {
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao || '');
    return Boolean(modelo && modelo.apenasPreenchimento);
  }

  function montarNomeOficioEnviado(pacote) {
    const modelo = obterModeloNomeOficio(pacote);
    const tipo = obterTipoNormalizadoDoPacote(pacote);

    if (modelo) return aplicarNumeroProcessoAoTexto(modelo, pacote.processo || '');
    if (tipo && pacote.processo) return `Ofício ${tipo} - ${pacote.processo} - CDSP`;
    if (pacote.processo) return `Ofício - ${pacote.processo} - CDSP`;
    return 'Ofício CDSP';
  }

  function sanitizarNomeArquivo(nome) {
    return limparValorExtraido(nome)
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/\.+$/g, '')
      .trim() || 'Oficio CDSP';
  }

  function montarNomeArquivoPdfOficio(pacote) {
    return `${sanitizarNomeArquivo(montarNomeOficioEnviado(pacote))}.pdf`;
  }

  function montarNomeArquivoExpediente(pacote) {
    const processo = limparValorExtraido(pacote && pacote.processo);
    return sanitizarNomeArquivo(`Expediente${processo ? ` - ${processo}` : ''}`) + '.pdf';
  }

  function montarTextoRegistroSpa(numeroSigadoc, nomeOficioEnviado) {
    return [numeroSigadoc, nomeOficioEnviado].map(limparValorExtraido).filter(Boolean).join(' - ');
  }

  function gerarIdArquivoInterno() {
    const aleatorio = Math.random().toString(36).slice(2, 10);
    return `cdsp-oficio-${Date.now()}-${aleatorio}`;
  }

  // ─── Storage compartilhado entre SPA e SIGADOC ─────────────────────────────

  function storageSet(objeto) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(objeto, resolve);
        return;
      }

      Object.entries(objeto).forEach(([chave, valor]) => {
        localStorage.setItem(chave, JSON.stringify(valor));
      });
      resolve();
    });
  }

  function storageGet(chaves) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(chaves, resolve);
        return;
      }

      const resultado = {};
      chaves.forEach((chave) => {
        const bruto = localStorage.getItem(chave);
        resultado[chave] = bruto ? JSON.parse(bruto) : undefined;
      });
      resolve(resultado);
    });
  }

  function storageRemove(chaves) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(chaves, resolve);
        return;
      }

      chaves.forEach((chave) => localStorage.removeItem(chave));
      resolve();
    });
  }

  function enviarMensagemExtensao(mensagem) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error('Comunicação interna da extensão não está disponível.'));
        return;
      }

      chrome.runtime.sendMessage(mensagem, (resposta) => {
        const erro = chrome.runtime.lastError;
        if (erro) {
          reject(new Error(erro.message));
          return;
        }

        if (!resposta || resposta.ok === false) {
          reject(new Error((resposta && resposta.error) || 'A extensão não retornou resposta válida.'));
          return;
        }

        resolve(resposta);
      });
    });
  }

  function blobParaBase64(blob) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        const resultado = String(leitor.result || '');
        resolve(resultado.includes(',') ? resultado.split(',').pop() : resultado);
      };
      leitor.onerror = () => reject(leitor.error || new Error('Falha ao converter o PDF.'));
      leitor.readAsDataURL(blob);
    });
  }

  function base64ParaBlob(base64, mime = 'application/pdf') {
    const binario = atob(base64 || '');
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) {
      bytes[i] = binario.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  async function buscarPdfComoBase64(url) {
    const resposta = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!resposta.ok) {
      throw new Error(`Não foi possível baixar o PDF assinado (${resposta.status}).`);
    }

    const blob = await resposta.blob();
    if (!/pdf/i.test(blob.type) && blob.size < 1024) {
      console.warn('[CDSP - Extrator] O arquivo baixado não parece ser um PDF:', blob.type, blob.size);
    }

    return {
      base64: await blobParaBase64(blob),
      mime: blob.type || 'application/pdf',
      tamanho: blob.size || 0,
    };
  }

  async function salvarPdfInterno(url, nomeArquivo, metadados) {
    const pdf = await buscarPdfComoBase64(url);
    const id = gerarIdArquivoInterno();

    await enviarMensagemExtensao({
      type: 'cdspOficioSalvarPdf',
      payload: {
        id,
        nomeArquivo,
        base64: pdf.base64,
        mime: pdf.mime,
        tamanho: pdf.tamanho,
        criadoEm: new Date().toISOString(),
        metadados: metadados || {},
      },
    });

    return id;
  }

  async function baixarPdfParaDownloads(url, nomeArquivo) {
    await enviarMensagemExtensao({
      type: 'cdspOficioBaixarArquivo',
      url,
      filename: nomeArquivo,
    });
  }

  async function salvarPacote(pacote) {
    await storageSet({ [STORAGE_KEY]: pacote });
  }

  async function obterPacoteSalvo() {
    const resultado = await storageGet([STORAGE_KEY]);
    const pacote = resultado[STORAGE_KEY];
    if (!pacote || !pacote.criadoEm) return null;

    const idade = Date.now() - new Date(pacote.criadoEm).getTime();
    if (idade > TEMPO_EXPIRACAO_MS) {
      await storageRemove([STORAGE_KEY]);
      return null;
    }

    return pacote;
  }

  // ─── Extração do SPA ────────────────────────────────────────────────────────

  function lerValorCopyValue(span) {
    const valor = span.getAttribute('data-content') ||
                  span.getAttribute('data-clip-board') ||
                  span.textContent ||
                  '';
    return limparValorExtraido(valor);
  }

  function lerCampoEmRaiz(raiz, rotulos) {
    const paragrafos = raiz.querySelectorAll('p.copyElement');
    for (const p of paragrafos) {
      const bold = p.querySelector('b');
      if (!bold) continue;
      if (rotuloCorresponde(bold.textContent, rotulos)) {
        const span = p.querySelector('span.copyValue');
        if (span) {
          const valor = lerValorCopyValue(span);
          if (valor) return valor;
        }
      }
    }

    const linhas = raiz.querySelectorAll('div.row');
    for (const linha of linhas) {
      const colunas = linha.children;
      if (colunas.length < 2) continue;
      if (rotuloCorresponde(colunas[0].textContent, rotulos)) {
        const valor = limparValorExtraido(colunas[1].innerHTML || colunas[1].textContent);
        if (valor) return valor;
      }
    }

    return '';
  }

  function lerCampo(rotulos) {
    return lerCampoEmRaiz(document, rotulos);
  }

  function encontrarLinkDocumentosExternosEmRaiz(raiz, baseUrl) {
    const doc = raiz || document;
    const links = Array.from(doc.querySelectorAll('a[href*="/judicial_processes/"][href*="/documents"]'));

    for (const link of links) {
      const rotulo = normalizarTexto([
        link.getAttribute('title'),
        link.getAttribute('data-original-title'),
        link.getAttribute('aria-label'),
        link.textContent,
      ].join(' '));

      if (rotulo.includes('documentos externos') || rotulo.includes('autos')) {
        return new URL(link.getAttribute('href'), baseUrl || window.location.href).href;
      }
    }

    return links[0] ? new URL(links[0].getAttribute('href'), baseUrl || window.location.href).href : '';
  }

  function lerSoapSettingIdEmRaiz(raiz, htmlBruto) {
    const doc = raiz || document;
    const elementos = Array.from(doc.querySelectorAll('a[href*="soap_setting_id="], form[action*="soap_setting_id="]'));

    for (const elemento of elementos) {
      const raw = elemento.getAttribute('href') || elemento.getAttribute('action') || '';
      const match = raw.match(/[?&]soap_setting_id=(\d+)/);
      if (match) return match[1];
    }

    const matchHtml = String(htmlBruto || '').match(/[?&]soap_setting_id=(\d+)/);
    return matchHtml ? matchHtml[1] : '1';
  }

  function extrairLinkAutosProcessuaisSpa(raiz, baseUrl, processo, htmlBruto = '') {
    const linkExistente = encontrarLinkDocumentosExternosEmRaiz(raiz, baseUrl);
    if (linkExistente) return linkExistente;

    const numero = String(processo || '').replace(/\D+/g, '');
    if (numero.length < 15) return '';

    const origem = new URL(baseUrl || window.location.href, window.location.href);
    return `${origem.origin}/judicial_processes/${numero}/documents?soap_setting_id=${encodeURIComponent(
      lerSoapSettingIdEmRaiz(raiz, htmlBruto)
    )}`;
  }

  function extrairCamposDeDocumentoProcesso(doc, baseUrl, htmlBruto = '') {
    const raiz = doc || document;
    const urlBase = baseUrl || window.location.href;
    const lerNoDocumento = (rotulos) => lerCampoEmRaiz(raiz, rotulos);
    const processo = lerNoDocumento(['numero do processo judicial', 'numero do processo']);
    const observacao = lerNoDocumento(['observação', 'observacao']);
    const assuntoBruto = lerNoDocumento(['assunto', 'assunto(s)', 'assunto(s) do tj']);
    const textoPagina = raiz.body ? (raiz.body.innerText || raiz.body.textContent || '') : '';
    const tipoOficio = normalizarTipoOficio(observacao) || normalizarTipoOficioTextoLivre(textoPagina);
    const htmlDocumento = htmlBruto || (raiz.documentElement ? raiz.documentElement.innerHTML : '');

    return {
      processo,
      assunto: normalizarAssunto(assuntoBruto),
      assuntoBruto,
      assuntoOrigem: assuntoBruto ? 'pagina-processo' : 'padrao-saude',
      autor: lerNoDocumento(['parte(s) ativa(s)', 'parte ativa', 'polo ativo']),
      reu: lerNoDocumento(['parte(s) passiva(s)', 'parte passiva', 'polo passivo']) || 'ESTADO DE MATO GROSSO',
      vara: lerNoDocumento(['orgao julgador', 'juizo', 'juízo']),
      observacao,
      tipoOficio,
      tipoTarefa: lerNoDocumento(['tipo de tarefa']),
      numeroOficio: lerNoDocumento(['numero do oficio', 'número do ofício']),
      numeroSigadoc: lerNoDocumento(['numero sigadoc', 'número sigadoc']),
      destinatario: lerNoDocumento(['destinatario', 'destinatário']),
      urlOrigem: urlBase,
      linkProcessoSpa: urlBase,
      linkAutosSpa: extrairLinkAutosProcessuaisSpa(raiz, urlBase, processo, htmlDocumento),
      linkExpedienteSpa: extrairLinkExpedienteDeDocumentoSpa(
        raiz,
        urlBase,
        htmlDocumento
      ),
    };
  }

  function extrairCamposDaPaginaProcesso() {
    return extrairCamposDeDocumentoProcesso(
      document,
      window.location.href,
      document.documentElement ? document.documentElement.innerHTML : ''
    );
  }

  function encontrarUrlProcessoPrincipalEmRaiz(raiz, baseUrl, campos) {
    const urlBase = baseUrl || window.location.href;
    const linkNoCard = raiz.querySelector('#main-procedure a[href^="/procedures/"]');
    if (linkNoCard) return new URL(linkNoCard.getAttribute('href'), urlBase).href;

    const pathname = (() => {
      try {
        return new URL(urlBase, window.location.href).pathname;
      } catch (_erro) {
        return window.location.pathname;
      }
    })();
    const idAtual = (pathname.match(/\/procedures\/(\d+)/) || [])[1];
    const processoJudicial = normalizarTexto(campos && campos.processo);
    const links = Array.from(raiz.querySelectorAll('a[href^="/procedures/"], a[href^="https://spa.pge.mt.gov.br/procedures/"]'));

    const linkPorNumero = links.find((link) => {
      const href = link.getAttribute('href') || '';
      if (idAtual && href.includes(`/procedures/${idAtual}`)) return false;
      return processoJudicial && normalizarTexto(link.textContent).includes(processoJudicial);
    });

    if (linkPorNumero) return new URL(linkPorNumero.getAttribute('href'), urlBase).href;

    const linkPorTarget = links.find((link) => {
      const href = link.getAttribute('href') || '';
      const target = link.getAttribute('target') || '';
      return target.startsWith('procedure-') &&
        (!idAtual || !href.includes(`/procedures/${idAtual}`));
    });

    return linkPorTarget ? new URL(linkPorTarget.getAttribute('href'), urlBase).href : '';
  }

  function encontrarUrlProcessoPrincipal(campos) {
    return encontrarUrlProcessoPrincipalEmRaiz(document, window.location.href, campos);
  }

  function extrairLinkExpedienteDeDocumentoSpa(doc, baseUrl, htmlBruto = '') {
    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const linkExpediente = anchors.find((link) => {
      const href = link.getAttribute('href') || '';
      return /\/coresigner\/info\/[^"'<>]+\.pdf(?:[?#].*)?$/i.test(href) ||
        /\/coresigner\/info\/[^"'<>]+\.pdf/i.test(href);
    });

    if (linkExpediente) {
      return new URL(linkExpediente.getAttribute('href'), baseUrl).href;
    }

    const regexAbsoluto = /https?:\/\/spa\.pge\.mt\.gov\.br\/coresigner\/info\/[^"' <>)]+\.pdf(?:[?#][^"' <>)]+)?/i;
    const matchAbsoluto = htmlBruto.match(regexAbsoluto);
    if (matchAbsoluto) return matchAbsoluto[0].replace(/&amp;/g, '&');

    const regexRelativo = /\/coresigner\/info\/[^"' <>)]+\.pdf(?:[?#][^"' <>)]+)?/i;
    const matchRelativo = htmlBruto.match(regexRelativo);
    if (matchRelativo) return new URL(matchRelativo[0].replace(/&amp;/g, '&'), baseUrl).href;

    return '';
  }

  function extrairAssuntoDeDocumentoSpa(doc) {
    const assuntoBruto = lerCampoEmRaiz(doc, [
      'assunto',
      'assunto(s)',
      'assunto(s) do tj',
      'assunto judicial',
      'assunto subjudicial',
      'assunto subudicial',
    ]);

    return {
      assuntoBruto,
      assunto: assuntoBruto ? normalizarAssunto(assuntoBruto) : '',
    };
  }

  async function enriquecerDadosPeloProcessoPrincipalEmRaiz(raiz, baseUrl, campos) {
    const url = encontrarUrlProcessoPrincipalEmRaiz(raiz || document, baseUrl || window.location.href, campos);
    const linkAutosAtual =
      campos.linkAutosSpa ||
      extrairLinkAutosProcessuaisSpa(
        raiz || document,
        baseUrl || window.location.href,
        campos.processo,
        raiz && raiz.documentElement ? raiz.documentElement.innerHTML : ''
      );

    if (!url) {
      return {
        ...campos,
        urlOrigem: campos.urlOrigem || baseUrl || window.location.href,
        linkProcessoSpa: campos.linkProcessoSpa || baseUrl || window.location.href,
        linkAutosSpa: linkAutosAtual,
        assuntoAviso: campos.assuntoBruto ? '' : 'Link do Processo Principal não encontrado.',
      };
    }

    try {
      const resposta = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!resposta.ok) {
        return {
          ...campos,
          urlOrigem: campos.urlOrigem || baseUrl || window.location.href,
          processoPrincipalUrl: url,
          linkProcessoSpa: url,
          linkAutosSpa: linkAutosAtual || extrairLinkAutosProcessuaisSpa(raiz || document, baseUrl || window.location.href, campos.processo),
          assuntoAviso: campos.assuntoBruto ? '' : `Não foi possível abrir o Processo Principal (${resposta.status}).`,
        };
      }

      const html = await resposta.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const assuntoPrincipal = extrairAssuntoDeDocumentoSpa(doc);
      const linkExpedienteSpa = extrairLinkExpedienteDeDocumentoSpa(doc, url, html);
      const linkAutosSpa = extrairLinkAutosProcessuaisSpa(doc, url, campos.processo, html) || linkAutosAtual;

      if (campos.assuntoBruto) {
        return {
          ...campos,
          urlOrigem: campos.urlOrigem || baseUrl || window.location.href,
          processoPrincipalUrl: url,
          linkProcessoSpa: url,
          linkAutosSpa,
          linkExpedienteSpa,
          assuntoAviso: '',
        };
      }

      if (!assuntoPrincipal.assunto) {
        return {
          ...campos,
          urlOrigem: campos.urlOrigem || baseUrl || window.location.href,
          processoPrincipalUrl: url,
          linkProcessoSpa: url,
          linkAutosSpa,
          linkExpedienteSpa,
          assuntoAviso: 'Assunto não encontrado no Processo Principal.',
        };
      }

      return {
        ...campos,
        assunto: assuntoPrincipal.assunto,
        assuntoBruto: assuntoPrincipal.assuntoBruto,
        assuntoOrigem: 'processo-principal',
        urlOrigem: campos.urlOrigem || baseUrl || window.location.href,
        processoPrincipalUrl: url,
        linkProcessoSpa: url,
        linkAutosSpa,
        linkExpedienteSpa,
        assuntoAviso: '',
      };
    } catch (erro) {
      console.warn('[CDSP - Extrator] Falha ao buscar assunto no Processo Principal:', erro);
      return {
        ...campos,
        urlOrigem: campos.urlOrigem || baseUrl || window.location.href,
        processoPrincipalUrl: url,
        linkProcessoSpa: url,
        linkAutosSpa: linkAutosAtual,
        assuntoAviso: campos.assuntoBruto ? '' : 'Erro ao buscar assunto no Processo Principal.',
      };
    }
  }

  async function enriquecerDadosPeloProcessoPrincipal(campos) {
    return enriquecerDadosPeloProcessoPrincipalEmRaiz(document, window.location.href, campos);
  }

  function mapaColunasTabelaSpa() {
    const mapa = new Map();
    const headers = document.querySelectorAll('#procedures-box thead tr.dt-header th');
    headers.forEach((th, indice) => {
      const nome = th.getAttribute('data-name') || th.textContent || '';
      const chave = normalizarRotulo(nome);
      if (chave) mapa.set(chave, indice);
    });
    return mapa;
  }

  function textoCelula(row, indice) {
    const celula = row.children[indice];
    if (!celula) return '';

    const clone = celula.cloneNode(true);
    clone.querySelectorAll('.spa-extrator-row-btn').forEach((el) => el.remove());
    const texto = clone.getAttribute('data-search') ||
                  clone.getAttribute('title') ||
                  clone.textContent ||
                  '';
    return limparValorExtraido(texto);
  }

  function lerCampoDaLinha(row, mapa, rotulos) {
    const candidatos = Array.isArray(rotulos) ? rotulos : [rotulos];
    for (const rotulo of candidatos) {
      const indice = mapa.get(normalizarRotulo(rotulo));
      if (Number.isInteger(indice)) {
        const valor = textoCelula(row, indice);
        if (valor) return valor;
      }
    }
    return '';
  }

  function normalizarUrlProcessoSpa(valor) {
    if (!valor) return '';

    const bruto = String(valor).replace(/&amp;/g, '&').trim();
    if (!bruto || bruto === '#' || /^javascript:/i.test(bruto)) return '';

    try {
      const url = new URL(bruto, window.location.href);
      if (url.hostname !== 'spa.pge.mt.gov.br') return '';
      if (!/^\/procedures\/\d+(?:\/folder)?\/?$/i.test(url.pathname)) return '';
      return url.href;
    } catch (_erro) {
      return '';
    }
  }

  function adicionarCandidatosUrlProcesso(lista, valor) {
    if (!valor) return;

    const texto = String(valor).replace(/&amp;/g, '&');
    const direto = normalizarUrlProcessoSpa(texto);
    if (direto) lista.push(direto);

    const encontrados = texto.match(/(?:https?:\/\/spa\.pge\.mt\.gov\.br)?\/procedures\/\d+(?:\/folder)?\/?(?:[?#][^\s"'<>)]*)?/gi) || [];
    encontrados.forEach((url) => {
      const normalizado = normalizarUrlProcessoSpa(url);
      if (normalizado) lista.push(normalizado);
    });
  }

  function pontuarUrlProcessoSpa(url) {
    try {
      const pathname = new URL(url, window.location.href).pathname;
      if (/^\/procedures\/\d+\/?$/i.test(pathname)) return 100;
      if (/^\/procedures\/\d+\/folder\/?$/i.test(pathname)) return 80;
      return 0;
    } catch (_erro) {
      return 0;
    }
  }

  function normalizarUrlProcessoParaExtracao(url) {
    try {
      const parsed = new URL(url, window.location.href);
      const match = parsed.pathname.match(/^\/procedures\/(\d+)/i);
      if (!match) return parsed.href;
      return `${parsed.origin}/procedures/${match[1]}`;
    } catch (_erro) {
      return url || '';
    }
  }

  function encontrarUrlProcessoDaLinha(row) {
    if (!row || !row.querySelectorAll) return '';

    const candidatos = [];
    const elementos = [row, ...Array.from(row.querySelectorAll('a[href], [data-href], [data-url], [data-link], [onclick]'))];

    elementos.forEach((elemento) => {
      ['href', 'data-href', 'data-url', 'data-link', 'onclick'].forEach((atributo) => {
        adicionarCandidatosUrlProcesso(candidatos, elemento.getAttribute && elemento.getAttribute(atributo));
      });

      if (elemento.dataset) {
        Object.keys(elemento.dataset).forEach((chave) => {
          if (/url|href|link/i.test(chave)) {
            adicionarCandidatosUrlProcesso(candidatos, elemento.dataset[chave]);
          }
        });
      }
    });

    const ordenados = Array.from(new Set(candidatos))
      .map((url) => ({ url, score: pontuarUrlProcessoSpa(url) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return ordenados.length ? ordenados[0].url : '';
  }

  async function buscarDocumentoProcessoPorUrl(url) {
    const urlExtracao = normalizarUrlProcessoParaExtracao(url);
    const resposta = await fetch(urlExtracao, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!resposta.ok) {
      throw new Error(`Não foi possível abrir o processo (${resposta.status}).`);
    }

    const html = await resposta.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { url: urlExtracao, html, doc };
  }

  async function extrairPacoteProcessoEmAba(url) {
    const resposta = await enviarMensagemExtensao({
      type: 'CDSP_OFICIOS_EXTRACT_PROCESS_TAB',
      url: normalizarUrlProcessoParaExtracao(url),
    });

    return resposta && resposta.pacote ? resposta.pacote : null;
  }

  function preencherCamposAusentes(campos, fallback) {
    const resultado = { ...(campos || {}) };
    Object.entries(fallback || {}).forEach(([chave, valor]) => {
      if (!resultado[chave] && valor) resultado[chave] = valor;
    });
    return resultado;
  }

  function extrairCamposDaLinhaCaixa(row) {
    const mapa = mapaColunasTabelaSpa();
    const observacao = lerCampoDaLinha(row, mapa, ['Observação', 'Observacao']);
    const textoLinha = row.innerText || row.textContent || '';
    const tipoOficio = normalizarTipoOficio(observacao) || normalizarTipoOficioTextoLivre(textoLinha);

    return {
      processo: lerCampoDaLinha(row, mapa, ['Número do processo judicial', 'Numero do processo judicial', 'Número do processo']),
      assunto: normalizarAssunto(lerCampoDaLinha(row, mapa, ['Assunto(s)', 'Assunto'])),
      autor: lerCampoDaLinha(row, mapa, ['Parte(s) ativa(s)', 'Parte ativa', 'Polo ativo']),
      reu: lerCampoDaLinha(row, mapa, ['Parte(s) passiva(s)', 'Parte passiva', 'Polo passivo']) || 'ESTADO DE MATO GROSSO',
      vara: lerCampoDaLinha(row, mapa, ['Órgão julgador', 'Orgão julgador', 'Juízo', 'Juizo']),
      observacao,
      tipoOficio,
      tipoTarefa: lerCampoDaLinha(row, mapa, ['Tipo de tarefa']),
      numeroOficio: lerCampoDaLinha(row, mapa, ['Número do ofício', 'Numero do oficio']),
      numeroSigadoc: lerCampoDaLinha(row, mapa, ['Número SIGADoc', 'Numero SIGADoc']),
      destinatario: lerCampoDaLinha(row, mapa, ['Destinatário', 'Destinatario']),
    };
  }

  function montarLinhas(campos) {
    return [
      ['Número do Processo', campos.processo],
      ['Juízo', campos.vara],
      ['Assunto', campos.assunto],
      ['Polo Ativo', campos.autor],
      ['Polo Passivo', campos.reu],
    ];
  }

  function montarTabelaHtml(linhas) {
    return `
      <table border="1" cellspacing="0" cellpadding="6"
             style="border-collapse:collapse;width:100%;font-family:'Times New Roman',serif;font-size:12pt;">
        ${linhas.map(([label, valor]) => `
          <tr>
            <td style="background:#1a3a5c;color:#ffffff;font-weight:bold;width:35%;padding:6px 10px;">${escaparHtml(label)}</td>
            <td style="padding:6px 10px;">${escaparHtml(valor || '')}</td>
          </tr>`).join('')}
      </table>`;
  }

  function montarLinksSpaHtml(pacote) {
    const links = [
      ['Link dos Documentos Externos', pacote.linkAutosSpa || pacote.linkProcessoSpa || pacote.processoPrincipalUrl || ''],
      ['Link do expediente', pacote.linkExpedienteSpa || ''],
    ];

    if (!links.some(([, url]) => Boolean(url))) return '';

    return `
      <p style="font-family:'Times New Roman',serif;font-size:12pt;margin:10px 0 0 0;">
        ${links.map(([label, url]) => `
          <strong>${escaparHtml(label)}:</strong>
          ${url ? `<a href="${escaparHtml(url)}">${escaparHtml(url)}</a>` : ''}`).join('<br>')}
      </p>`;
  }

  async function prepararExpedienteParaAnexoSigadoc(pacote) {
    if (!pacote || pacote.expedienteArquivoId) return pacote && pacote.expedienteArquivoId;
    if (!pacote.linkExpedienteSpa) {
      throw new Error('Link do expediente não foi encontrado no SPA.');
    }

    const arquivoId = await salvarPdfInterno(
      pacote.linkExpedienteSpa,
      montarNomeArquivoExpediente(pacote),
      {
        processo: pacote.processo || '',
        tipo: 'expediente-para-anexo-sigadoc',
      }
    );

    pacote.expedienteArquivoId = arquivoId;
    await salvarPacote(pacote);
    return arquivoId;
  }

  const TEXTO_ACESSO_SES = 'A íntegra da referida decisão e demais documentações do processo judicial pode ser acessada por intermédio do sistema "SPA - Sistema de Processos Automatizados" da PGE ou, ainda, do sistema "PJe - Processo Judicial eletrônico" do Judiciário, por meio dos dados constantes da tabela acima. A assessoria jurídica da SES possui acesso livre a ambos os sistemas.';
  const TEXTO_INSERCAO_SPA = 'O envio de informação para a juntada no processo judicial pela PGE deve se dar por meio de inserção direta no sistema "SPA - Sistema de Processos Automatizados" pela assessoria jurídica competente, sem necessidade de tramitação do SIGADOC à PGE.';
  const TEXTO_CONTATO = 'Caso tenha alguma dúvida adicional, queira reunião ou uma conversação informal e direta sobre este ou outros processos individuais da saúde, favor enviar mensagem ao WhatsApp nº (65) 9 9226-6963.';

  const CONTEUDOS_PROPRIOS_OFICIOS = Object.freeze({
    CUMP: {
      titulo: 'CUMPRIMENTO DE DECISÃO JUDICIAL',
      paragrafos: [
        'Informa-se que o Estado foi intimado a respeito da recente decisão judicial proferida no processo acima descrito, que determinou o fornecimento de produto ou serviço de saúde, ou confirmou determinação anterior, a ser cumprida no prazo estabelecido pelo Judiciário.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    'CUMP MULTA': {
      titulo: 'CUMPRIMENTO DE DECISÃO JUDICIAL C/ INCIDÊNCIA DE MULTA',
      paragrafos: [
        'Informa-se que o Estado foi intimado a respeito da recente decisão judicial proferida no processo acima descrito, que determinou o fornecimento de produto ou serviço de saúde, ou confirmou determinação anterior, a ser cumprida no prazo estabelecido pelo Judiciário.',
        'A decisão impõe incidência de multa diária ao Estado em caso de descumprimento, de modo que a mora da SES pode gerar ônus patrimonial ou financeiro relevante em favor da parte autora.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    'CUMP SANÇÕES': {
      titulo: 'CUMPRIMENTO DE DECISÃO JUDICIAL C/ SANÇÕES PESSOAIS',
      paragrafos: [
        'Informa-se que o Estado foi intimado a respeito da recente decisão judicial proferida no processo acima descrito, que determinou o fornecimento de produto ou serviço de saúde, ou confirmou determinação anterior, a ser cumprida no prazo estabelecido pelo Judiciário.',
        'A decisão impõe incidência de sanções pessoais, como multa, prisão ou afastamento do cargo, a agentes públicos e/ou ao Secretário de Estado de Saúde.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    SINF: {
      titulo: 'COMUNICAÇÃO DE PROCESSO JUDICIAL E SOLICITAÇÃO DE INFORMAÇÕES PARA A DEFESA',
      paragrafos: [
        'Informa-se que o Estado foi intimado no processo acima descrito em que a pessoa solicita o fornecimento de produto ou serviço de saúde pela SES.',
        'Como ainda não houve decisão judicial determinando que o Estado faça, deixe de fazer, pague ou forneça o produto ou serviço de saúde solicitado pela pessoa, a presente comunicação é para ciência da SES sobre o processo judicial e para que forneça informações à PGE, no prazo de 10 (dez) dias corridos, para fins de defesa do Estado.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    REQ: {
      titulo: 'INFORMAÇÃO REQUISITADA PELO JUDICIÁRIO',
      paragrafos: [
        'Informa-se que o Estado foi intimado no processo acima descrito para prestar informações, no prazo fixado pelo Poder Judiciário, em ação que versa sobre o fornecimento de produto ou serviço de saúde pela SES.',
        'A omissão da SES poderá ensejar a aplicação de multa ou sanção ao Estado ou a agentes públicos, o bloqueio de verbas públicas da SES ou a aceitação da alegação do particular como verdadeira.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    'PREST CONTAS': {
      titulo: 'PRESTAÇÃO DE CONTAS',
      paragrafos: [
        'Informa-se que o Estado foi intimado para que, no prazo estabelecido pelo Judiciário, manifeste-se sobre a “prestação de contas” apresentada pelo particular, pessoa e/ou fornecedor, relativamente ao processo acima descrito, que determinou o fornecimento de produto ou serviço de saúde até hoje não cumprido pela SES.',
        'A omissão da SES em impugnar a “prestação de contas” permitirá que ela venha a ser admitida como justa e suficiente pelo Judiciário, de modo que a SES assumirá o risco de aquiescer com documentos insuficientes juntados ao processo judicial.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    EXME: {
      titulo: 'MODIFICAÇÃO DE DECISÃO JUDICIAL PRETÉRITA',
      paragrafos: [
        'Informa-se que o Estado foi intimado de decisão que acarreta a modificação, alteração, revogação, suspensão ou extinção de decisão anterior relativa ao processo acima descrito, que determinava o fornecimento de produto ou serviço de saúde pela SES. Com isso, não há mais ordem judicial para que a SES faça, deixe de fazer, pague ou forneça o que quer que seja no referido processo.',
        'A modificação pode ter ocorrido pela morte do particular, desistência do processo, alteração ou revogação pelo juiz ou pelos Tribunais, em atendimento a defesas ou recursos da PGE, ou por fatos supervenientes.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    DESCUMP: {
      titulo: 'NOTÍCIA DE DESCUMPRIMENTO DE DECISÃO JUDICIAL E CONSEQUÊNCIAS',
      paragrafos: [
        'O Estado foi intimado para se manifestar a respeito de possível descumprimento de ordem judicial pela Secretaria de Estado de Saúde.',
        'Se confirmada a hipótese, a SES deve apresentar justificativa concreta e, se possível, estimar o modo e a data provável para o cumprimento.',
        'A omissão da SES em apresentar informações concretas poderá levar à admissão judicial de orçamentos de fornecedores privados, com risco de preços superestimados, direcionamento a grupos econômicos ou contratação de profissionais sem capacitação técnica adequada. Também poderá ensejar multa ou sanção ao Estado ou a agentes públicos e bloqueio de verbas públicas da SES.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    SECUND: {
      titulo: 'RESPONSABILIDADE SECUNDÁRIA AO ESTADO',
      paragrafos: [
        'Informa-se que o Estado foi intimado a respeito da recente decisão judicial proferida no processo acima descrito, que determinou o fornecimento de produto ou serviço de saúde, ou confirmou determinação anterior, a ser cumprida no prazo estabelecido pelo Judiciário.',
        'A responsabilidade do Estado foi fixada de maneira secundária, de modo que somente será obrigado a fornecer se o ente primariamente responsável, Município ou União, não vier a cumprir. Por isso, convém a comunicação e a articulação com o ente responsável para o fornecimento do produto ou serviço de saúde.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    'HOME CARE': {
      titulo: 'VISITA DOMICILIAR PARA AVALIAÇÃO DE HOME CARE',
      paragrafos: [
        'Informa-se que o Estado foi intimado no processo acima descrito, no prazo fixado pelo Poder Judiciário, para realizar visita domiciliar para avaliação da parte autora quanto à elegibilidade aos serviços de atendimento domiciliar de saúde, home care, e à modalidade ou complexidade adequada.',
        'A omissão da SES poderá ensejar a aplicação de penalidades ao Estado ou a agentes públicos, o bloqueio de verbas públicas da SES para custeamento de serviços desnecessários ou a aceitação da alegação do particular como verdadeira.',
        TEXTO_ACESSO_SES, TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    'AUDIÊNCIA': {
      titulo: 'DESIGNAÇÃO DE AUDIÊNCIA',
      paragrafos: [
        'Foi designada audiência para o dia XX/XX/XXXX, às XXhXXmin, de interesse da SES, na modalidade XXXXXXXXXX. Se for telepresencial e já existir link, informe-o no próprio ofício ou anexe a respectiva imagem.',
        'A audiência foi solicitada ou designada com o propósito de XXXXXXXXXX. O tema em questão diz respeito ao fornecimento de XXXXXXXXXX.',
        'A íntegra do processo segue em anexo.', TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
    'SINF DANO MORAL': {
      titulo: 'COMUNICAÇÃO DE PROCESSO JUDICIAL E SOLICITAÇÃO DE INFORMAÇÕES PARA A DEFESA SOBRE DANOS MORAIS',
      paragrafos: [
        'Informa-se que o Estado de Mato Grosso foi citado no processo acima descrito, em que a parte autora pleiteia indenização por danos morais, alegando suposta falha na prestação do serviço público de saúde.',
        'Por isso, requisita-se, no prazo de 10 (dez) dias corridos, o fornecimento de informações técnicas e administrativas aptas a subsidiar a defesa do Estado, especialmente quanto a DESCREVER AQUI O QUE VOCÊ PRECISA, e quaisquer outros elementos que demonstrem as providências adotadas pela Administração Pública em relação ao caso.',
        'A íntegra do processo segue em anexo.', 'Por fim, solicita-se o encaminhamento das informações e das providências adotadas ou passíveis de adoção exclusivamente por meio do SIGADOC.', TEXTO_CONTATO,
      ],
    },
    'AVALIAÇÃO PSICOPEDAGÓGICA': {
      titulo: 'AVALIAÇÃO PSICOPEDAGÓGICA',
      paragrafos: [
        'Informa-se que o Estado de Mato Grosso foi citado/intimado, no processo judicial acima identificado, em que a parte autora deseja a realização de avaliação psicopedagógica do(a) estudante indicado(a) na documentação anexa, por profissional devidamente habilitado, a fim de verificar dificuldades de aprendizagem e a necessidade de acompanhamento contínuo por psicopedagogo.',
        'A íntegra do processo segue em anexo.',
        'A ausência de resposta poderá acarretar prejuízos à defesa do Estado no processo judicial, inclusive com a adoção de medidas judiciais em desfavor da Administração Pública.',
        'Solicita-se, com máxima urgência, a indicação da unidade escolar, rede de ensino, etapa ou ano escolar e turno. Caso o(a) estudante esteja na rede estadual, deverá ser providenciada a avaliação psicopedagógica, se determinada judicialmente, com relatório técnico conclusivo e documentos comprobatórios.',
        'O relatório técnico deverá informar as dificuldades eventualmente identificadas, a necessidade ou não de acompanhamento contínuo, a modalidade e periodicidade recomendadas e o órgão ou instituição responsável pelo atendimento. Caso a atribuição seja do Estado de Mato Grosso, devem ser indicadas as providências adotadas ou necessárias.',
        'Caso o(a) estudante esteja em rede diversa da estadual, identifique-se o órgão ou entidade responsável pela avaliação e eventual acompanhamento, bem como as medidas de encaminhamento adotadas ou cabíveis.',
        'As informações e documentos comprobatórios devem ser enviados no prazo necessário pelo SIGADOC à lotação PGE-CPA, com o assunto “Envio ao NCCV-PGE para inserção no SPA”.', TEXTO_CONTATO,
      ],
    },
    'MED ESCOLAR': {
      titulo: 'ADMINISTRAÇÃO DE MEDICAMENTO EM AMBIENTE ESCOLAR',
      paragrafos: [
        'Informa-se que o Estado de Mato Grosso foi citado/intimado, no processo judicial acima identificado, em que a parte autora deseja a disponibilização de profissional habilitado para administrar medicamento prescrito a estudante durante o período escolar.',
        'A íntegra do processo segue em anexo.',
        'A ausência de resposta poderá acarretar prejuízos à defesa do Estado no processo judicial, inclusive com a adoção de medidas judiciais em desfavor da Administração Pública.',
        'Solicita-se que essa Secretaria informe se o estudante está regularmente matriculado e frequenta unidade da rede estadual; se houve requerimento administrativo prévio e suas providências; se há profissional habilitado para administrar medicamentos; se a administração exige profissional de saúde, prescrição, termo de autorização, protocolo ou acompanhamento clínico; se há impedimento técnico, administrativo, funcional ou normativo; qual órgão possui atribuição para o atendimento; se é necessária atuação conjunta entre educação e saúde; quais normas ou protocolos internos existem; e quais providências foram ou poderão ser adotadas.',
        'Caso existam normas, orientações ou protocolos internos sobre guarda, controle, manuseio ou administração de medicamentos no ambiente escolar, solicita-se a respectiva documentação.',
        'As informações e documentos comprobatórios devem ser enviados no prazo necessário pelo SIGADOC à lotação PGE-CPA, com o assunto “Envio ao NCCV-PGE para inserção no SPA”.', TEXTO_CONTATO,
      ],
    },
    'SETASC IDOSO': {
      titulo: 'INFORMAÇÃO REQUISITADA PELO JUDICIÁRIO',
      paragrafos: [
        'Informa-se que o Estado de Mato Grosso foi citado/intimado, no processo judicial acima identificado, em que a parte autora deseja acolhimento em Instituição de Longa Permanência para Idosos, com disponibilidade imediata de vaga ou, alternativamente, assistência domiciliar temporária privada custeada pelo Poder Público.',
        'A íntegra do processo segue em anexo.',
        'A ausência de resposta no prazo assinalado poderá acarretar prejuízos à defesa do Estado, inclusive com a possibilidade de presunção de veracidade das alegações da parte autora e adoção de medidas judiciais em desfavor da Administração Pública.',
        'Solicita-se que a Secretaria de Estado de Assistência Social informe, com máxima urgência, se existe processo administrativo em nome da parte autora para ingresso em ILPI e seu estágio; se há vaga imediata; e, na ausência de vaga, se é possível assistência domiciliar temporária ou outra medida socioassistencial adequada. O envio deve ser feito pelo SIGADOC à lotação PGE-CPA, com o assunto “Envio ao NCCV-PGE para inserção no SPA”.',
        'Caso haja necessidade de esclarecimentos adicionais ou alinhamento quanto às informações requisitadas, favor entrar em contato pelo WhatsApp nº (65) 9 9226-6963.',
      ],
    },
    'INFOR SEDUC': {
      titulo: 'SOLICITAÇÃO DE INFORMAÇÕES E PROVIDÊNCIAS',
      paragrafos: [
        'Informa-se que o Estado de Mato Grosso foi citado/intimado nos autos do processo judicial acima identificado, que envolve demanda relacionada a estudante indicado(a) na documentação anexa, cuja análise e eventual adoção de providências inserem-se no âmbito das atribuições dessa Secretaria de Estado de Educação.',
        'A íntegra do processo e a respectiva decisão judicial seguem em anexo.',
        'Considerando que a ausência de resposta poderá acarretar prejuízos à defesa do Estado, bem como a adoção de medidas judiciais em desfavor da Administração Pública, solicita-se que essa Secretaria, com a máxima urgência, analise a documentação encaminhada e apresente as informações necessárias ao cumprimento da determinação judicial.',
        'Deverá ser informado se o(a) estudante se encontra regularmente matriculado(a), com indicação da unidade escolar, rede de ensino, etapa ou ano escolar e turno. Caso esteja matriculado(a) na rede estadual, solicita-se a adoção das providências necessárias ao atendimento da ordem judicial, com relatório técnico e documentos comprobatórios.',
        'A resposta deverá esclarecer objetivamente a situação apresentada, a possibilidade de atendimento da medida, as providências adotadas ou ainda necessárias, o prazo estimado, e a unidade, o setor ou o profissional responsável pelo caso.',
        'Caso a medida não seja atribuição da rede estadual, a circunstância deve ser justificada, com identificação do órgão, entidade ou rede responsável e das medidas de encaminhamento adotadas ou cabíveis.',
        'Na hipótese de impossibilidade total ou parcial de cumprimento, deverão ser apresentados fundamentos técnicos e administrativos, documentação pertinente e eventual medida alternativa apta a atender à necessidade do(a) estudante.',
        'As informações e documentos comprobatórios devem ser enviados pelo SIGADOC à lotação PGE-CPA, com o assunto “Envio ao NCCV-PGE para inserção no SPA”.',
        'Em caso de dúvida, necessidade de reunião ou contato direto, poderá ser encaminhada mensagem ao WhatsApp nº (65) 9 9226-6963.',
      ],
    },
    ALTA: {
      titulo: 'ALTA MÉDICA EM SERVIÇO DE HOME CARE',
      paragrafos: [
        'Informa-se que o Estado foi intimado no processo acima descrito de decisão judicial que deferiu a realização de alta médica em serviço de atendimento domiciliar de saúde, home care, prestado pela Secretaria de Estado de Saúde.',
        'Por isso, a SES pode cessar imediatamente a prestação do serviço, se tal ocorrer exclusivamente em razão da existência de ordem judicial anterior.',
        'A íntegra do processo judicial pode ser acessada pelos sistemas SPA - Sistema de Processos Automatizados da PGE ou PJe - Processo Judicial eletrônico, pelos dados constantes da tabela acima. A assessoria jurídica da SES possui acesso livre a ambos os sistemas.',
        TEXTO_INSERCAO_SPA, TEXTO_CONTATO,
      ],
    },
  });

  function montarConteudoProprioOficio(pacote) {
    const tipo = obterTipoNormalizadoDoPacote(pacote);
    const modelo = CONTEUDOS_PROPRIOS_OFICIOS[tipo];
    if (!modelo) return '';

    const estilo = "font-family:'Times New Roman',serif;font-size:12pt;line-height:1.15;margin:12pt 0 0 0;";
    const titulo = `<p data-cdsp-conteudo-oficio="${escaparHtml(tipo)}" style="${estilo}font-weight:bold;">${escaparHtml(modelo.titulo)}</p>`;
    const paragrafos = modelo.paragrafos.map((texto) => `<p style="${estilo}">${escaparHtml(texto)}</p>`).join('');
    return `${titulo}${paragrafos}`;
  }

  function montarTextoPlano(linhas) {
    return linhas.map(([label, valor]) => `${label}: ${valor || ''}`).join('\n');
  }

  function criarPacote(campos, origem) {
    const tipoOficio = campos.tipoOficio || normalizarTipoOficio(campos.observacao);
    const modelo = resolverModeloSigadoc(tipoOficio);
    const linhas = montarLinhas(campos);

    return {
      versao: '3.15',
      origem,
      urlOrigem: campos.urlOrigem || window.location.href,
      criadoEm: new Date().toISOString(),
      processo: campos.processo || '',
      assunto: campos.assunto || '',
      assuntoOrigem: campos.assuntoOrigem || '',
      assuntoAviso: campos.assuntoAviso || '',
      processoPrincipalUrl: campos.processoPrincipalUrl || '',
      autor: campos.autor || '',
      reu: campos.reu || 'ESTADO DE MATO GROSSO',
      vara: campos.vara || '',
      observacao: campos.observacao || '',
      tipoOficio,
      tipoTarefa: campos.tipoTarefa || '',
      numeroOficio: campos.numeroOficio || '',
      numeroSigadoc: campos.numeroSigadoc || '',
      destinatario: campos.destinatario || '',
      linkProcessoSpa: campos.linkProcessoSpa || campos.processoPrincipalUrl || '',
      linkAutosSpa: campos.linkAutosSpa || '',
      linkExpedienteSpa: campos.linkExpedienteSpa || '',
      modeloSigadoc: modelo ? modelo.tipo : '',
      modeloSigadocPreferido: modelo && modelo.bases.length ? modelo.bases[0] : '',
      htmlTabela: montarTabelaHtml(linhas),
      textoPlano: montarTextoPlano(linhas),
    };
  }

  function camposFaltantes(pacote) {
    return [
      ['Número do Processo', pacote.processo],
      ['Juízo', pacote.vara],
      ['Assunto', pacote.assunto],
      ['Polo Ativo', pacote.autor],
      ['Polo Passivo', pacote.reu],
    ]
      .filter(([, valor]) => !valor)
      .map(([label]) => label);
  }

  function escolherPacoteMaisCompleto(atual, candidato) {
    if (!atual) return candidato || null;
    if (!candidato) return atual;
    return camposFaltantes(candidato).length < camposFaltantes(atual).length ? candidato : atual;
  }

  function copiarPacote(pacote) {
    if (navigator.clipboard && window.ClipboardItem) {
      return navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([pacote.htmlTabela], { type: 'text/html' }),
          'text/plain': new Blob([pacote.textoPlano], { type: 'text/plain' }),
        })
      ]).catch(() => fallbackCopiar(pacote.textoPlano));
    }

    return fallbackCopiar(pacote.textoPlano);
  }

  function fallbackCopiar(texto) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return Promise.resolve();
  }

  function copiarTextoSimples(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).catch(() => fallbackCopiar(texto));
    }

    return fallbackCopiar(texto);
  }

  // ─── Botões do SPA ─────────────────────────────────────────────────────────

  function atualizarBotao(btn, estado, icone, texto) {
    if (!btn) return;
    btn.classList.remove('copiando', 'sucesso', 'alerta', 'erro');
    btn.classList.add(estado);
    btn.disabled = estado === 'copiando';
    btn.innerHTML = `<span class="spa-icon">${icone}</span> ${texto}`;
  }

  function restaurarBotao(btn) {
    if (!btn) return;
    btn.classList.remove('copiando', 'sucesso', 'alerta', 'erro');
    btn.disabled = false;
    btn.title = 'Extrair dados do SPA para o SIGADOC';
    btn.innerHTML = '<span class="spa-icon">SIG</span> Extrair p/ SIGADOC';
  }

  async function concluirExtracao(pacote, btn) {
    await salvarPacote(pacote);
    await copiarPacote(pacote);

    const faltantes = camposFaltantes(pacote);
    if (faltantes.length) {
      atualizarBotao(btn, 'alerta', '!', 'Salvo com campos faltando');
      btn.title = `Campos não encontrados: ${faltantes.join(', ')}`;
      return;
    }

    atualizarBotao(btn, 'sucesso', 'OK', 'Salvo e copiado');
    const detalheAssunto = pacote.assuntoAviso
      ? ` ${pacote.assuntoAviso}`
      : (pacote.assuntoOrigem === 'processo-principal' ? ' Assunto extraído do Processo Principal.' : '');
    btn.title = (pacote.tipoOficio
      ? `Tipo detectado: ${pacote.tipoOficio}`
      : 'Dados salvos para preencher no SIGADOC') + detalheAssunto;
  }

  async function executarExtracaoProcesso(botaoOrigem) {
    const btn = botaoOrigem || document.getElementById('spa-extrator-btn');
    atualizarBotao(btn, 'copiando', '...', 'Extraindo...');

    try {
      let campos = extrairCamposDaPaginaProcesso();
      const algumEncontrado = Object.values(campos).some(Boolean);
      if (!algumEncontrado) {
        atualizarBotao(btn, 'alerta', '!', 'Nenhum campo encontrado');
        return;
      }

      atualizarBotao(btn, 'copiando', '...', campos.assuntoBruto ? 'Buscando links...' : 'Buscando assunto...');
      campos = await enriquecerDadosPeloProcessoPrincipal(campos);

      await concluirExtracao(criarPacote(campos, 'pagina-processo'), btn);
    } catch (erro) {
      console.error('[CDSP - Extrator] Falha ao extrair ou copiar campos:', erro);
      atualizarBotao(btn, 'erro', '!', 'Erro ao extrair');
    } finally {
      setTimeout(() => restaurarBotao(btn), 3500);
    }
  }

  async function executarExtracaoLinha(row, btn, urlPreferencial) {
    const textoOriginal = btn ? btn.textContent : '';
    const htmlOriginal = btn ? btn.innerHTML : '';
    if (btn) {
      btn.textContent = '...';
      btn.disabled = true;
      btn.title = 'Abrindo processo da linha...';
    }

    try {
      const urlProcesso = urlPreferencial || encontrarUrlProcessoDaLinha(row);
      if (!urlProcesso) {
        if (btn) {
          btn.textContent = '!';
          btn.title = 'Não foi possível localizar o link do processo nesta linha.';
        }
        return false;
      }

      let pacote = null;
      try {
        if (btn) btn.title = 'Abrindo aba do processo e extraindo dados...';
        pacote = await extrairPacoteProcessoEmAba(urlProcesso);
      } catch (_erroRemoto) {
        pacote = null;
      }

      if (!pacote || camposFaltantes(pacote).length) {
        const camposLinha = extrairCamposDaLinhaCaixa(row);
        const pagina = await buscarDocumentoProcessoPorUrl(urlProcesso);
        if (btn) btn.title = 'Extraindo dados da página do processo...';

        let campos = extrairCamposDeDocumentoProcesso(pagina.doc, pagina.url, pagina.html);
        campos = preencherCamposAusentes(campos, camposLinha);
        campos.linkProcessoSpa = campos.linkProcessoSpa || pagina.url;
        campos.urlOrigem = campos.urlOrigem || pagina.url;

        if (btn) btn.title = campos.assuntoBruto ? 'Buscando links do processo...' : 'Buscando assunto do processo...';
        campos = await enriquecerDadosPeloProcessoPrincipalEmRaiz(pagina.doc, pagina.url, campos);

        pacote = escolherPacoteMaisCompleto(pacote, criarPacote(campos, 'pagina-processo-via-caixa'));
      }

      if (!pacote || !pacote.processo) {
        if (btn) {
          btn.textContent = '!';
          btn.title = 'Não foi possível identificar os dados do processo.';
        }
        return;
      }

      await concluirExtracao(pacote, btn);
      return true;
    } catch (erro) {
      console.error('[CDSP - Extrator] Falha ao extrair linha da caixa:', erro);
      if (btn) {
        btn.textContent = '!';
        btn.title = erro && erro.message ? erro.message : 'Erro ao extrair linha';
      }
      return false;
    } finally {
      setTimeout(() => {
        if (!btn) return;
        btn.innerHTML = htmlOriginal || textoOriginal;
        btn.disabled = false;
        if (btn.title && !/^Não foi possível|Erro|Campos não encontrados/i.test(btn.title)) {
          btn.title = 'Extrair esta linha para o SIGADOC';
        }
      }, 3500);
    }
  }

  function linhasCaixaSpaExtraiveis() {
    const tabela = document.querySelector('#procedures-box');
    if (!tabela) return [];

    return Array.from(tabela.querySelectorAll('tbody tr')).filter((row) =>
      row.children.length >= 2 && !row.querySelector('.dataTables_empty')
    );
  }

  function rotuloLinhaCaixaSpa(row, indice) {
    const mapa = mapaColunasTabelaSpa();
    const processo = lerCampoDaLinha(row, mapa, [
      'Número do processo judicial',
      'Numero do processo judicial',
      'Número do processo',
    ]);
    const observacao = lerCampoDaLinha(row, mapa, ['Observação', 'Observacao']);
    const tipoOficio = normalizarTipoOficio(observacao) || normalizarTipoOficioTextoLivre(row.innerText || row.textContent || '');
    const partes = [processo, tipoOficio].filter(Boolean);
    if (partes.length) return partes.join(' - ');

    const textoLinha = limparValorExtraido(row.innerText || row.textContent || '');
    return textoLinha ? textoLinha.slice(0, 90) : `Linha ${indice + 1}`;
  }

  function contextoOficiosSpa() {
    const href = window.location.href;
    const linhas = linhasCaixaSpaExtraiveis();

    return {
      versao: '3.13',
      paginaProcesso: URL_PROCESSO.test(href),
      pastaProcesso: URL_FOLDER.test(href),
      caixa: Boolean(document.querySelector('#procedures-box')),
      linhas: linhas.map((row, indice) => ({
        indice,
        rotulo: rotuloLinhaCaixaSpa(row, indice),
        url: encontrarUrlProcessoDaLinha(row),
      })),
    };
  }

  function removerBotoesSpaSoltos() {
    ['spa-extrator-btn', 'spa-preencher-btn'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.remove();
    });

    document.querySelectorAll('.spa-extrator-row-btn').forEach((btn) => btn.remove());
  }

  function notificarMenuOficiosSpa() {
    try {
      window.dispatchEvent(new CustomEvent('cdsp-extrator-oficios-updated'));
    } catch (_erro) {
      // Evento apenas sincroniza o menu geral quando disponivel.
    }
  }

  function instalarApiOficiosSpa() {
    window.CDSP_EXTRATOR_OFICIOS = {
      versao: '3.13',
      obterContexto: contextoOficiosSpa,
      extrairProcesso: (botao) => executarExtracaoProcesso(botao),
      preencherSpa: (botao) => executarPreencherSpa(botao),
      extrairLinha: (indice, botao, urlPreferencial) => {
        const linhas = linhasCaixaSpaExtraiveis();
        const row = linhas[Number(indice)];
        if (!row) {
          atualizarBotao(botao, 'alerta', '!', 'Linha não encontrada');
          return Promise.resolve(false);
        }

        return executarExtracaoLinha(row, botao, urlPreferencial);
      },
      atualizar: () => {
        removerBotoesSpaSoltos();
        notificarMenuOficiosSpa();
        return contextoOficiosSpa();
      },
    };

    notificarMenuOficiosSpa();
  }

  function injetarBotaoProcesso() {
    if (document.getElementById('spa-extrator-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'spa-extrator-btn';
    btn.innerHTML = '<span class="spa-icon">SIG</span> Extrair p/ SIGADOC';
    btn.title = 'Extrair dados do SPA para o SIGADOC';
    btn.addEventListener('click', executarExtracaoProcesso);
    document.body.appendChild(btn);
  }

  function injetarBotoesCaixa() {
    const tabela = document.querySelector('#procedures-box');
    if (!tabela) return;

    const mapa = mapaColunasTabelaSpa();
    const indiceAcoes = mapa.get('acoes');
    const linhas = tabela.querySelectorAll('tbody tr');

    linhas.forEach((row) => {
      if (row.querySelector('.spa-extrator-row-btn')) return;
      if (row.children.length < 2 || row.querySelector('.dataTables_empty')) return;

      const celula = row.children[Number.isInteger(indiceAcoes) ? indiceAcoes : 2] || row.children[0];
      if (!celula) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'spa-extrator-row-btn';
      btn.textContent = 'SIG';
      btn.title = 'Extrair esta linha para o SIGADOC';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        executarExtracaoLinha(row, btn);
      });

      celula.insertBefore(btn, celula.firstChild);
    });
  }

  // ─── Preenchimento assistido do SIGADOC ────────────────────────────────────

  function setValorCampo(campo, valor) {
    if (!campo) return false;

    const proto = campo.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

    if (descriptor && descriptor.set) descriptor.set.call(campo, valor);
    else campo.value = valor;

    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function selecionarValorPorTexto(select, textoDesejado) {
    if (!select || !textoDesejado) return false;

    const desejado = normalizarTexto(textoDesejado);
    const option = Array.from(select.options).find((opt) =>
      normalizarTexto(opt.textContent) === desejado ||
      normalizarTexto(opt.value) === desejado
    );

    if (!option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function obterCampoAssuntoSigadoc() {
    const ids = [
      'docGovMT_oficio_assunto',
      'docGovMT_comunicacaoInterna_assunto',
    ];

    for (const id of ids) {
      const campo = document.getElementById(id);
      if (campo) return campo;
    }

    return Array.from(document.querySelectorAll('input[id^="docGovMT_"][id$="_assunto"], textarea[id^="docGovMT_"][id$="_assunto"]'))
      .find((campo) => campo.offsetParent !== null || campo.type !== 'hidden') || null;
  }

  function obterTextareaConteudoSigadoc() {
    const ids = [
      'docGovMT_oficio_conteudo',
      'docGovMT_comunicacaoInterna_conteudo',
    ];

    for (const id of ids) {
      const campo = document.getElementById(id);
      if (campo) return campo;
    }

    return Array.from(document.querySelectorAll('textarea.editor, textarea[id^="docGovMT_"][id$="_conteudo"]'))
      .find((campo) => campo.offsetParent !== null || campo.classList.contains('editor')) || null;
  }

  function obterCampoFechamentoSigadoc() {
    return document.getElementById('docGovMT_oficio_fechamento') ||
      document.getElementById('docGovMT_comunicacaoInterna_fechamento') ||
      null;
  }

  function obterNomeSubscritorSigadoc() {
    const fontes = [
      document.getElementById('formulario_exDocumentoDTO.subscritorSel_descricao')?.value,
      document.getElementById('exDocumentoDTO.subscritorSelSpan')?.textContent,
      document.querySelector('[name="exDocumentoDTO.subscritorSel.descricao"]')?.value,
    ];

    return limparValorExtraido(fontes.filter(Boolean).join(' '));
  }

  function detectarSufixoModeloSigadoc() {
    const nome = normalizarTexto(obterNomeSubscritorSigadoc());
    if (!nome) return '';

    const usuario = USUARIOS_MODELO_SIGADOC.find((item) =>
      item.nomes.some((nomeUsuario) => nome.includes(normalizarTexto(nomeUsuario)))
    );

    return usuario ? usuario.sufixo : '';
  }

  function textoOpcaoSelect(option) {
    if (!option) return '';
    return [
      option.textContent,
      option.label,
      option.getAttribute && option.getAttribute('title'),
      option.getAttribute && option.getAttribute('data-text'),
      option.getAttribute && option.getAttribute('data-content'),
    ].filter(Boolean).join(' ');
  }

  function opcaoCombinaTextoPadrao(option, candidato, permitirInclusao = false) {
    const textoOpcao = textoOpcaoSelect(option);
    const normalizadoOpcao = normalizarTexto(textoOpcao);
    const compactoOpcao = compactarTexto(textoOpcao);
    const alvo = normalizarTexto(candidato);
    const alvoCompacto = compactarTexto(candidato);

    if (!normalizadoOpcao || !alvo) return false;
    if (normalizadoOpcao === alvo || compactoOpcao === alvoCompacto) return true;

    return Boolean(permitirInclusao &&
      (normalizadoOpcao.includes(alvo) || compactoOpcao.includes(alvoCompacto)));
  }

  function encontrarOpcaoPorCandidatos(options, candidatos, permitirInclusao = false) {
    for (const candidato of candidatos) {
      const option = options.find((opt) => opcaoCombinaTextoPadrao(opt, candidato, permitirInclusao));
      if (option) return option;
    }

    return null;
  }

  function textoOpcaoModeloDocumentoSigadoc(item) {
    if (!item) return '';

    return [
      item.textContent,
      item.getAttribute && item.getAttribute('data-search'),
      item.getAttribute && item.getAttribute('title'),
      item.querySelector && item.querySelector('a')?.textContent,
    ].filter(Boolean).join(' ');
  }

  function modeloDocumentoCombinaSigadoc(item, modeloDocumento) {
    const texto = normalizarTexto(textoOpcaoModeloDocumentoSigadoc(item));
    const compacto = compactarTexto(texto);
    const alvo = normalizarTexto(modeloDocumento);
    const alvoCompacto = compactarTexto(modeloDocumento);

    if (!compacto || !alvoCompacto) return false;
    if (alvoCompacto === 'comunicacaointerna') {
      return compacto.includes('comunicacaointerna');
    }
    if (alvoCompacto === 'oficio') {
      return compacto.includes('oficiooficio') || /\boficio\b/.test(texto);
    }

    return texto.includes(alvo) || compacto.includes(alvoCompacto);
  }

  function encontrarOpcaoModeloDocumentoSigadoc(modeloDocumento) {
    const itens = Array.from(document.querySelectorAll('#ulmod .dropdown-item[data-value]'))
      .filter((item) => (item.getAttribute('data-value') || '').trim());

    return itens.find((item) => modeloDocumentoCombinaSigadoc(item, modeloDocumento)) || null;
  }

  function obterModeloDocumentoAtualSigadoc() {
    const hidden = document.querySelector('input[name="exDocumentoDTO.idMod"]');
    const label = document.querySelector('#modelos-select .selected-label');

    return {
      valor: hidden ? limparValorExtraido(hidden.value) : '',
      texto: label ? limparValorExtraido(label.textContent) : '',
    };
  }

  function aplicarSelecaoModeloDocumentoSigadoc(item) {
    if (!item) return false;

    const valor = item.getAttribute('data-value') || '';
    if (!valor) return false;

    const hidden = document.querySelector('input[name="exDocumentoDTO.idMod"]');
    const label = document.querySelector('#modelos-select .selected-label');
    const textoLabel = limparValorExtraido(item.querySelector('a')?.childNodes?.[0]?.textContent || item.textContent || '');

    Array.from(document.querySelectorAll('#ulmod .dropdown-item.active')).forEach((ativo) => {
      ativo.classList.remove('active');
    });
    item.classList.add('active');

    if (label && textoLabel) label.textContent = textoLabel;
    if (hidden) setValorCampo(hidden, valor);

    try {
      item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      const link = item.querySelector('a');
      if (link) link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch (erro) {
      console.warn('[CDSP - Extrator] Não foi possível simular clique no Modelo:', erro);
    }

    executarNoContextoDaPagina(`
      (function(valor) {
        var item = document.querySelector('#ulmod .dropdown-item[data-value="' + valor + '"]');
        var hidden = document.getElementsByName('exDocumentoDTO.idMod')[0];
        var label = document.querySelector('#modelos-select .selected-label');

        if (item) {
          try {
            item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            var link = item.querySelector('a');
            if (link) link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          } catch (erro) {}
          try {
            var texto = item.querySelector('a') && item.querySelector('a').childNodes[0]
              ? item.querySelector('a').childNodes[0].textContent
              : item.textContent;
            if (label && texto) label.textContent = texto.trim();
          } catch (erro) {}
        }

        if (hidden) {
          hidden.value = valor;
          hidden.dispatchEvent(new Event('input', { bubbles: true }));
          hidden.dispatchEvent(new Event('change', { bubbles: true }));
          if (typeof hidden.onchange === 'function') {
            try { hidden.onchange.call(hidden, new Event('change', { bubbles: true })); } catch (erro) {}
          }
        }

        try {
          if (typeof alterouModeloSelect === 'function') alterouModeloSelect();
        } catch (erro) {}
        try {
          if (window.jQuery && hidden) window.jQuery(hidden).val(valor).trigger('input').trigger('change');
        } catch (erro) {}
      })(${JSON.stringify(valor)});
    `);

    return true;
  }

  async function selecionarModeloDocumentoSeNecessario(pacote) {
    const modeloDocumento = obterModeloDocumentoSigadoc(pacote);
    const option = encontrarOpcaoModeloDocumentoSigadoc(modeloDocumento);

    if (!option) {
      return { mudou: false, mensagem: `Modelo ${modeloDocumento} não encontrado no SIGADOC.` };
    }

    const atual = obterModeloDocumentoAtualSigadoc();
    const valorAlvo = option.getAttribute('data-value') || '';
    if (atual.valor && valorAlvo && atual.valor === valorAlvo) {
      return { mudou: false, mensagem: `Modelo já selecionado: ${modeloDocumento}.` };
    }

    const mudou = aplicarSelecaoModeloDocumentoSigadoc(option);
    if (mudou) await aguardar(1400);

    return {
      mudou,
      mensagem: mudou
        ? `Modelo selecionado: ${modeloDocumento}.`
        : `Não foi possível selecionar o modelo ${modeloDocumento}.`,
    };
  }

  function encontrarOpcaoTextoPadrao(select, pacote) {
    if (!select) return { option: null, sufixo: '', mensagem: 'Campo Texto padrão não encontrado.' };

    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao);
    const options = Array.from(select.options);
    const sufixo = detectarSufixoModeloSigadoc();

    if (!modelo) {
      return {
        option: null,
        sufixo,
        mensagem: pacote.tipoOficio
          ? `Modelo não mapeado para o tipo ${pacote.tipoOficio}.`
          : 'Tipo do ofício não identificado no SPA.',
      };
    }

    const usarSufixo = modelo.usarSufixo !== false;

    if (usarSufixo && !sufixo && !modelo.aceitarBaseSemSufixo) {
      return {
        option: null,
        sufixo,
        mensagem: 'Subscritor não identificado para escolher modelo F ou IG.',
      };
    }

    const candidatos = usarSufixo
      ? modelo.bases.flatMap((base) => [
        `${base} ${sufixo}`,
        `${base.replace(' - ', ' ')} ${sufixo}`,
      ])
      : modelo.bases.flatMap((base) => [
        base,
        base.replace(' - ', ' '),
      ]);

    if (usarSufixo && modelo.aceitarBaseSemSufixo) {
      modelo.bases.forEach((base) => {
        candidatos.push(base, base.replace(' - ', ' '));
      });
    }

    const optionPorCandidato = encontrarOpcaoPorCandidatos(options, candidatos, !usarSufixo);
    if (optionPorCandidato) return { option: optionPorCandidato, sufixo, mensagem: '' };

    const basesNormalizadas = modelo.bases.flatMap((base) => [
      base,
      base.replace(' - ', ' '),
    ]).map(compactarTexto);

    if (!usarSufixo) {
      const porBase = options.find((opt) => {
        const texto = compactarTexto(textoOpcaoSelect(opt));
        return basesNormalizadas.some((base) => texto === base || texto.includes(base));
      });

      return {
        option: porBase || null,
        sufixo,
        mensagem: `Modelo ${modelo.tipo} não encontrado no Texto padrão.`,
      };
    }

    const sufixoCompacto = compactarTexto(sufixo);
    const porBaseESufixo = options.find((opt) => {
      const texto = compactarTexto(textoOpcaoSelect(opt));
      return texto.endsWith(sufixoCompacto) &&
        basesNormalizadas.some((base) => texto.includes(base));
    });

    if (!porBaseESufixo && modelo.aceitarBaseSemSufixo) {
      const porBase = options.find((opt) => {
        const texto = compactarTexto(textoOpcaoSelect(opt));
        return basesNormalizadas.some((base) => texto === base || texto.includes(base));
      });
      if (porBase) return { option: porBase, sufixo, mensagem: '' };
    }

    return {
      option: porBaseESufixo || null,
      sufixo,
      mensagem: `Modelo ${modelo.tipo} com sufixo ${sufixo} não encontrado no Texto padrão.`,
    };
  }

  function aplicarSelecaoTextoPadraoSigadoc(select, option) {
    const valor = option.value;
    const indice = Array.prototype.indexOf.call(select.options, option);

    Array.from(select.options).forEach((opt) => {
      opt.selected = opt === option;
    });

    if (indice >= 0) select.selectedIndex = indice;
    select.value = valor;
    try {
      select.focus();
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch (erro) {
      console.warn('[CDSP - Extrator] Não foi possível simular clique no Texto padrão:', erro);
    }
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));

    executarNoContextoDaPagina(`
      (function(valor) {
        var select = document.getElementById('preenchimento');
        if (!select) return;
        for (var i = 0; i < select.options.length; i += 1) {
          select.options[i].selected = select.options[i].value === valor;
          if (select.options[i].value === valor) select.selectedIndex = i;
        }
        select.value = valor;
        try {
          select.focus();
          if (select.options[select.selectedIndex]) {
            select.options[select.selectedIndex].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            select.options[select.selectedIndex].dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            select.options[select.selectedIndex].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
        } catch (erro) {}
        var eventoInput = new Event('input', { bubbles: true });
        var eventoChange = new Event('change', { bubbles: true });
        select.dispatchEvent(eventoInput);
        select.dispatchEvent(eventoChange);
        if (typeof select.onchange === 'function') {
          try { select.onchange.call(select, eventoChange); } catch (erro) {}
        }
        if (window.jQuery) {
          try {
            window.jQuery(select).val(valor).trigger('input').trigger('change').trigger('change.select2').trigger('chosen:updated');
          } catch (erro) {}
        }
        if (typeof window.carregaPreench === 'function') {
          try { window.carregaPreench(); } catch (erro) {}
          setTimeout(function() {
            try { window.carregaPreench(); } catch (erro) {}
          }, 250);
        } else {
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })(${JSON.stringify(valor)});
    `);
  }

  function selecionarTextoPadraoSeNecessario(pacote) {
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao);
    if (modelo && modelo.conteudoProprio) {
      return { mudou: false, mensagem: 'Conteúdo próprio configurado para este tipo de ofício.' };
    }

    const select = document.getElementById('preenchimento');
    if (!select) return { mudou: false, mensagem: 'Campo Texto padrão não encontrado.' };

    const { option, mensagem } = encontrarOpcaoTextoPadrao(select, pacote);
    if (!option) {
      return { mudou: false, mensagem };
    }

    aplicarSelecaoTextoPadraoSigadoc(select, option);

    return {
      mudou: true,
      mensagem: select.value === option.value
        ? `Texto padrão aplicado: ${option.textContent.trim()}`
        : `Texto padrão selecionado: ${option.textContent.trim()}`,
    };
  }

  function obterAreaEditavelSigadoc() {
    const textarea = obterTextareaConteudoSigadoc();
    const iframeDoCampo = textarea && textarea.id
      ? document.getElementById(`cke_${textarea.id}`)?.querySelector('iframe')
      : null;
    const iframe = iframeDoCampo || document.querySelector(
      '#cke_docGovMT_oficio_conteudo iframe, #cke_docGovMT_comunicacaoInterna_conteudo iframe, iframe.cke_wysiwyg_frame'
    );

    try {
      if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
        return iframe.contentDocument.body;
      }
    } catch (erro) {
      console.warn('[CDSP - Extrator] Não foi possível acessar o iframe do CKEditor:', erro);
    }

    return null;
  }

  function aguardarAreaEditavelSigadoc(timeoutMs = 6000) {
    const inicio = Date.now();
    return new Promise((resolve) => {
      const tentar = () => {
        const area = obterAreaEditavelSigadoc();
        if (area) {
          resolve(area);
          return;
        }

        if (Date.now() - inicio > timeoutMs) {
          resolve(null);
          return;
        }

        setTimeout(tentar, 250);
      };
      tentar();
    });
  }

  function conteudoJaTemTabela(conteudo, pacote) {
    const texto = normalizarTexto(conteudo);
    return Boolean(pacote.processo && texto.includes(normalizarTexto(pacote.processo)) &&
      texto.includes('numero do processo'));
  }

  function conteudoJaTemTextoProprio(conteudo, pacote) {
    const tipo = obterTipoNormalizadoDoPacote(pacote);
    if (!CONTEUDOS_PROPRIOS_OFICIOS[tipo]) return true;
    return String(conteudo || '').includes(`data-cdsp-conteudo-oficio="${tipo}"`);
  }

  async function inserirTabelaNoEditor(pacote) {
    const areaEditavel = await aguardarAreaEditavelSigadoc();
    const textarea = obterTextareaConteudoSigadoc();
    const blocoTabelaELinks = `${pacote.htmlTabela}${montarLinksSpaHtml(pacote)}`;
    const conteudoProprio = montarConteudoProprioOficio(pacote);

    if (areaEditavel) {
      const atual = areaEditavel.innerHTML || '';
      const jaTemTabela = conteudoJaTemTabela(atual, pacote);
      const jaTemTextoProprio = conteudoJaTemTextoProprio(atual, pacote);
      if (jaTemTabela && jaTemTextoProprio) return 'Tabela e conteúdo próprio já estavam no editor.';

      const corpoAtual = atual.replace(/^\s*<p[^>]*>(?:&nbsp;|\s|<br\s*\/?>)*<\/p>\s*/i, '');
      const cabecalho = jaTemTabela ? '' : `${blocoTabelaELinks}<p>&nbsp;</p>`;
      const texto = jaTemTextoProprio ? '' : conteudoProprio;
      const novoConteudo = `${cabecalho}${texto}${corpoAtual}`;
      const EventCtor = areaEditavel.ownerDocument.defaultView.Event;
      areaEditavel.innerHTML = novoConteudo;
      areaEditavel.dispatchEvent(new EventCtor('input', { bubbles: true }));
      areaEditavel.dispatchEvent(new EventCtor('change', { bubbles: true }));

      if (textarea) {
        textarea.value = novoConteudo;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }

      return jaTemTabela ? 'Conteúdo próprio inserido no editor.' : 'Tabela e conteúdo inseridos no editor.';
    }

    if (textarea) {
      const atual = textarea.value || '';
      const jaTemTabela = conteudoJaTemTabela(atual, pacote);
      const jaTemTextoProprio = conteudoJaTemTextoProprio(atual, pacote);
      if (jaTemTabela && jaTemTextoProprio) return 'Tabela e conteúdo próprio já estavam no campo de conteúdo.';
      textarea.value = `${jaTemTabela ? '' : blocoTabelaELinks}${jaTemTextoProprio ? '' : conteudoProprio}\n${atual}`;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return jaTemTabela ? 'Conteúdo próprio inserido no campo de conteúdo.' : 'Tabela e conteúdo inseridos no campo de conteúdo.';
    }

    return 'Campo de conteúdo não encontrado.';
  }

  function executarNoContextoDaPagina(codigo) {
    const script = document.createElement('script');
    script.textContent = codigo;
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
  }

  function clicarNoContextoDaPaginaSigadoc(elemento) {
    if (!elemento) return false;
    const token = `cdsp-click-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    elemento.setAttribute('data-cdsp-click-token', token);
    executarNoContextoDaPagina(`
      (function () {
        var elemento = document.querySelector('[data-cdsp-click-token="${token}"]');
        if (elemento) elemento.click();
      })();
    `);
    return true;
  }

  function obterDestinatarioSigadoc(pacote) {
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao || '');
    return (modelo && modelo.destinatario) || DESTINATARIO_PADRAO_SIGADOC;
  }

  function descricaoDestinatarioCorresponde(atual, esperado) {
    if (!esperado) return true;
    if (!atual) return false;

    const textoAtual = normalizarTexto(atual);
    const textoEsperado = normalizarTexto(esperado);

    return textoAtual.includes(textoEsperado) || textoEsperado.includes(textoAtual);
  }

  function estadoDestinatarioSigadoc(destino) {
    const id = document.getElementById('formulario_exDocumentoDTO.lotacaoDestinatarioSel_id') ||
      document.getElementsByName('exDocumentoDTO.lotacaoDestinatarioSel.id')[0];
    const sigla = document.getElementById('formulario_exDocumentoDTO.lotacaoDestinatarioSel_sigla') ||
      document.getElementsByName('exDocumentoDTO.lotacaoDestinatarioSel.sigla')[0];
    const descricao = document.getElementById('formulario_exDocumentoDTO.lotacaoDestinatarioSel_descricao') ||
      document.getElementsByName('exDocumentoDTO.lotacaoDestinatarioSel.descricao')[0];
    const span = document.getElementById('exDocumentoDTO.lotacaoDestinatarioSelSpan');
    const idValue = limparValorExtraido(id && id.value);
    const siglaValue = limparValorExtraido(sigla && sigla.value);
    const descricaoValue = limparValorExtraido((span && span.textContent) || (descricao && descricao.value));
    const expectedSigla = limparValorExtraido(destino && destino.sigla);
    const expectedDescription = limparValorExtraido(destino && destino.descricao);

    return {
      idValue,
      siglaValue,
      descricaoValue,
      confirmed: Boolean(
        idValue &&
        normalizarTexto(siglaValue) === normalizarTexto(expectedSigla) &&
        descricaoDestinatarioCorresponde(descricaoValue, expectedDescription)
      ),
    };
  }

  async function aguardarConfirmacaoDestinatarioSigadoc(destino, timeoutMs) {
    const timeout = Math.max(500, Number(timeoutMs) || 0);
    const inicio = Date.now();
    let estado = estadoDestinatarioSigadoc(destino);
    while (Date.now() - inicio < timeout) {
      if (estado.confirmed) return estado;
      await aguardar(200);
      estado = estadoDestinatarioSigadoc(destino);
    }
    return estado;
  }

  function solicitarConfirmacaoDestinatarioSigadoc(siglaDestino) {
    executarNoContextoDaPagina(`
      (function () {
        var destino = ${JSON.stringify(siglaDestino)};
        var campo = document.getElementById('formulario_exDocumentoDTO.lotacaoDestinatarioSel_sigla') ||
          document.getElementsByName('exDocumentoDTO.lotacaoDestinatarioSel.sigla')[0];
        if (!campo) return;

        campo.value = destino;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
        try {
          if (typeof handleEnter === 'function') {
            handleEnter(campo, {
              type: 'keypress', keyCode: 13, which: 13,
              preventDefault: function () {}, stopPropagation: function () {}
            });
          }
        } catch (erro) {
          console.warn('[CDSP - Extrator] Falha ao simular Enter no destinatário:', erro);
        }
        try {
          if (typeof ajax_lotacaoDestinatario === 'function') ajax_lotacaoDestinatario();
        } catch (erro) {
          console.warn('[CDSP - Extrator] Falha ao confirmar destinatário:', erro);
        }
      })();
    `);
  }

  async function preencherDestinatarioSigadoc(pacote, destinoSobrescrito = null) {
    const sigla = document.getElementById('formulario_exDocumentoDTO.lotacaoDestinatarioSel_sigla');
    const span = document.getElementById('exDocumentoDTO.lotacaoDestinatarioSelSpan');
    const descricaoCampo = document.getElementById('formulario_exDocumentoDTO.lotacaoDestinatarioSel_descricao');
    if (!sigla) return 'Campo de destinatário não encontrado.';

    const destino = destinoSobrescrito || obterDestinatarioSigadoc(pacote);
    const siglaDestino = destino.sigla || DESTINATARIO_PADRAO_SIGADOC.sigla;
    const descricaoEsperada = destino.descricao || '';

    setValorCampo(sigla, siglaDestino);
    try {
      sigla.focus();
    } catch (erro) {
      console.warn('[CDSP - Extrator] Não foi possível focar o destinatário:', erro);
    }

    const KeyboardEventCtor = sigla.ownerDocument.defaultView.KeyboardEvent;
    const eventosEnter = ['keydown', 'keypress', 'keyup'];
    eventosEnter.forEach((tipoEvento) => {
      sigla.dispatchEvent(new KeyboardEventCtor(tipoEvento, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }));
    });

    try {
      sigla.blur();
    } catch (erro) {
      console.warn('[CDSP - Extrator] Não foi possível remover o foco do destinatário:', erro);
    }

    let estado = estadoDestinatarioSigadoc(destino);
    for (let attempt = 1; attempt <= 3 && !estado.confirmed; attempt += 1) {
      solicitarConfirmacaoDestinatarioSigadoc(siglaDestino);
      estado = await aguardarConfirmacaoDestinatarioSigadoc(destino, 3000 * attempt);
    }

    if (!estado.confirmed) {
      throw new Error(
        `O SIGADOC nao confirmou o destinatario ${siglaDestino}. ` +
        'A assinatura foi interrompida para evitar gravacao sem a lotacao selecionada.'
      );
    }

    return `Destinatário preenchido como ${siglaDestino} (${descricaoEsperada || 'descrição não informada'}) e Enter enviado.`;
  }

  function validarCamposObrigatoriosSigadoc(pacote) {
    const erros = [];
    const descricao = document.getElementById('descrDocumento');
    const assunto = obterCampoAssuntoSigadoc();
    const areaEditavel = document.querySelector('[contenteditable="true"]');
    const textarea = obterTextareaConteudoSigadoc();
    const destino = obterDestinatarioSigadoc(pacote);
    const estadoDestinatario = estadoDestinatarioSigadoc(destino);
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao || '');
    const classificacao = modelo && modelo.classificacao;
    const conteudo = (areaEditavel && areaEditavel.innerHTML) || (textarea && textarea.value) || '';

    if (!limparValorExtraido(descricao && descricao.value)) erros.push('Descricao');
    if (!limparValorExtraido(assunto && assunto.value)) erros.push('Assunto');
    if (!estadoDestinatario.confirmed) erros.push('Destinatario');
    if (!limparValorExtraido(conteudo)) erros.push('Conteudo');
    if (pacote.processo && !conteudoJaTemTabela(conteudo, pacote)) erros.push('Tabela do processo');
    if (classificacao && !estadoClassificacaoSigadoc(classificacao).confirmed) {
      erros.push('Classificacao');
    }

    if (erros.length) {
      throw new Error('O SIGADOC nao confirmou os campos obrigatorios: ' + erros.join(', ') + '.');
    }
  }

  function estadoClassificacaoSigadoc(classificacao) {
    const campoId = document.getElementsByName('exDocumentoDTO.classificacaoSel.id')[0] ||
      document.getElementById('formulario_exDocumentoDTO.classificacaoSel_id');
    const campoDescricao = document.getElementsByName('exDocumentoDTO.classificacaoSel.descricao')[0] ||
      document.getElementById('formulario_exDocumentoDTO.classificacaoSel_descricao');
    const campoSigla = document.getElementsByName('exDocumentoDTO.classificacaoSel.sigla')[0] ||
      document.getElementById('formulario_exDocumentoDTO.classificacaoSel_sigla');
    const span = document.getElementById('exDocumentoDTO.classificacaoSelSpan');
    const descricao = limparValorExtraido((campoDescricao && campoDescricao.value) || (span && span.textContent));
    const id = limparValorExtraido(campoId && campoId.value);
    const sigla = limparValorExtraido(campoSigla && campoSigla.value);
    const descricaoEsperada = normalizarTexto(classificacao && classificacao.descricao);
    const descricaoConfirmada = descricaoEsperada && normalizarTexto(descricao).includes(descricaoEsperada);

    return {
      id,
      sigla,
      descricao,
      confirmed: Boolean(
        classificacao &&
        Boolean(id) &&
        sigla === String(classificacao.codigo || '') &&
        descricaoConfirmada
      ),
    };
  }

  async function aguardarConfirmacaoClassificacaoSigadoc(classificacao, timeoutMs = 5000) {
    const inicio = Date.now();
    let estado = estadoClassificacaoSigadoc(classificacao);
    while (!estado.confirmed && Date.now() - inicio < timeoutMs) {
      await aguardar(200);
      estado = estadoClassificacaoSigadoc(classificacao);
    }
    return estado;
  }

  function solicitarClassificacaoSigadoc(classificacao, usarRetornoDireto) {
    executarNoContextoDaPagina(`
      (function(classificacao, usarRetornoDireto) {
        var campo = document.getElementsByName('exDocumentoDTO.classificacaoSel.sigla')[0] ||
          document.getElementById('formulario_exDocumentoDTO.classificacaoSel_sigla');
        if (!campo) return;

        campo.value = classificacao.codigo;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));

        try {
          if (!usarRetornoDireto && typeof ajax_classificacao === 'function') {
            ajax_classificacao();
            return;
          }
        } catch (erro) {
          console.warn('[CDSP - Extrator] Falha ao consultar a classificação:', erro);
        }

        try {
          if (typeof retorna_classificacao === 'function') {
            retorna_classificacao(classificacao.id, classificacao.codigo, classificacao.descricao);
          }
        } catch (erro) {
          console.warn('[CDSP - Extrator] Falha ao aplicar a classificação:', erro);
        }
      })(${JSON.stringify(classificacao)}, ${Boolean(usarRetornoDireto)});
    `);
  }

  async function confirmarClassificacaoPorDesfocoSigadoc(campo, classificacao) {
    setValorCampo(campo, classificacao.codigo);
    try {
      campo.focus();
      await aguardar(80);
      campo.blur();
      campo.dispatchEvent(new Event('focusout', { bubbles: true }));
    } catch (erro) {
      console.warn('[CDSP - Extrator] Falha ao desfocar a classificação:', erro);
    }
  }

  async function preencherClassificacaoSigadoc(pacote) {
    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao || '');
    const classificacao = modelo && modelo.classificacao;
    if (!classificacao) return '';

    const campoSigla = document.getElementsByName('exDocumentoDTO.classificacaoSel.sigla')[0] ||
      document.getElementById('formulario_exDocumentoDTO.classificacaoSel_sigla');
    if (!campoSigla) return 'Campo de classificação não encontrado.';

    // O próprio SIGADOC carrega a descrição somente no onblur deste campo.
    // Este foco/desfoco reproduz o clique fora feito manualmente na tela.
    await confirmarClassificacaoPorDesfocoSigadoc(campoSigla, classificacao);
    let estado = await aguardarConfirmacaoClassificacaoSigadoc(classificacao, 4500);

    if (!estado.confirmed) {
      solicitarClassificacaoSigadoc(classificacao, false);
      estado = await aguardarConfirmacaoClassificacaoSigadoc(classificacao, 3500);
    }

    // Contingência para uma resposta AJAX bloqueada pelo próprio SIGADOC: usa o
    // callback nativo, no contexto da página, para registrar ID, sigla e descrição.
    if (!estado.confirmed) {
      solicitarClassificacaoSigadoc(classificacao, true);
      estado = await aguardarConfirmacaoClassificacaoSigadoc(classificacao, 2500);
    }

    if (!estado.confirmed) {
      throw new Error(
        `O SIGADOC não confirmou a classificação ${classificacao.codigo}. ` +
        'Confira a classificação manualmente antes de gravar ou assinar.'
      );
    }

    return `Classificação definida como ${classificacao.codigo}.`;
  }

  async function preencherCamposSigadoc(pacote) {
    const mensagens = [];
    const textoFormal = textoDescricaoAssunto(pacote);

    const descricao = document.getElementById('descrDocumento');
    if (descricao) {
      setValorCampo(descricao, textoFormal);
      mensagens.push('Descrição preenchida.');
    } else {
      mensagens.push('Descrição não encontrada.');
    }

    const assunto = obterCampoAssuntoSigadoc();
    if (assunto) {
      setValorCampo(assunto, textoFormal);
      mensagens.push('Assunto preenchido.');
    } else {
      mensagens.push('Assunto não encontrado.');
    }

    const mensagemClassificacao = await preencherClassificacaoSigadoc(pacote);
    if (mensagemClassificacao) mensagens.push(mensagemClassificacao);

    mensagens.push(await preencherDestinatarioSigadoc(pacote));

    mensagens.push(await inserirTabelaNoEditor(pacote));

    const fechamento = obterCampoFechamentoSigadoc();
    if (fechamento && selecionarValorPorTexto(fechamento, 'Atenciosamente')) {
      mensagens.push('Fechamento definido como Atenciosamente.');
    } else {
      mensagens.push('Fechamento não alterado.');
    }

    validarCamposObrigatoriosSigadoc(pacote);

    await storageRemove([PENDING_SIGADOC_KEY]);
    return mensagens;
  }

  async function salvarFluxoAssinaturaSigadoc(etapa, extra = {}) {
    await storageSet({
      [PENDING_ASSINATURA_KEY]: {
        criadoEm: new Date().toISOString(),
        etapa,
        ...extra,
      },
    });
  }

  async function limparFluxoAssinaturaSigadoc() {
    await storageRemove([PENDING_ASSINATURA_KEY]);
  }

  async function salvarFluxoPosAssinaturaSigadoc(pacote) {
    if (!pacote) return null;

    const destino = obterDestinatarioSigadoc(pacote);
    const nomeOficioEnviado = montarNomeOficioEnviado(pacote);
    const nomeArquivo = montarNomeArquivoPdfOficio(pacote);
    const modoPosAssinatura = obterModoPosAssinaturaSigadoc(pacote);
    const fluxoSpa = modoPosAssinatura === 'spa';

    const pendente = {
      criadoEm: new Date().toISOString(),
      processo: pacote.processo || '',
      tipoOficio: obterTipoNormalizadoDoPacote(pacote),
      fluxoSpa,
      modoPosAssinatura,
      nomeOficioEnviado,
      nomeArquivo,
      destinatarioSigla: destino.sigla || DESTINATARIO_PADRAO_SIGADOC.sigla,
      destinatarioDescricao: destino.descricao || '',
      descricaoOficio: textoDescricaoAssunto(pacote),
      linkExpedienteSpa: pacote.linkExpedienteSpa || '',
      expedienteArquivoId: pacote.expedienteArquivoId || '',
      nomeArquivoExpediente: montarNomeArquivoExpediente(pacote),
      etapa: 'oficio-assinado',
      tentativasAnexo: 0,
    };

    await storageSet({ [PENDING_POS_ASSINATURA_KEY]: pendente });
    return pendente;
  }

  async function obterFinalizacaoSpaPendente() {
    const resultado = await storageGet([PENDING_SPA_FINALIZACAO_KEY]);
    const pendente = resultado[PENDING_SPA_FINALIZACAO_KEY];
    if (!pendente || !pendente.criadoEm) return null;

    const idade = Date.now() - new Date(pendente.criadoEm).getTime();
    if (idade > TEMPO_FLUXO_FINALIZACAO_MS) {
      await storageRemove([PENDING_SPA_FINALIZACAO_KEY]);
      return null;
    }

    return pendente;
  }

  function extrairNumeroSigadocDaPagina() {
    const fontes = [
      document.querySelector('h1')?.textContent,
      document.querySelector('h2')?.textContent,
      document.querySelector('h3')?.textContent,
      document.querySelector('h4')?.textContent,
      document.querySelector('h5')?.textContent,
      document.title,
      document.body ? document.body.innerText : '',
    ].filter(Boolean).join('\n');

    const match = fontes.match(/\bPGE-[A-Z]{2,8}-\d{4}\/\d+\b/i);
    return match ? match[0].toUpperCase() : '';
  }

  function extrairUrlPopitup(valor) {
    const texto = valor || '';
    const match = texto.match(/popitup\((['"])(.*?)\1\)/i) || texto.match(/popitup\((.*?)\)/i);
    if (!match) return '';

    return (match[2] || match[1] || '')
      .replace(/^['"]|['"]$/g, '')
      .replace(/&amp;/g, '&');
  }

  function encontrarUrlImpressaoPdfSigadoc() {
    const candidatos = Array.from(document.querySelectorAll('button[onclick], a[onclick]'));
    for (const elemento of candidatos) {
      const onclick = elemento.getAttribute('onclick') || '';
      if (!/arquivo\/exibir/i.test(onclick) || !/\.pdf/i.test(onclick)) continue;

      const url = extrairUrlPopitup(onclick);
      if (url) return new URL(url, window.location.href).href;
    }

    const linkPdf = Array.from(document.querySelectorAll('a[href], iframe[src], embed[src]'))
      .map((el) => el.getAttribute('href') || el.getAttribute('src') || '')
      .find((url) => /arquivo\/exibir/i.test(url) && /\.pdf/i.test(url));

    return linkPdf ? new URL(linkPdf.replace(/&amp;/g, '&'), window.location.href).href : '';
  }

  function encontrarLinkTramitarSigadoc() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.find((link) => {
      const href = link.getAttribute('href') || '';
      const texto = normalizarTexto(link.textContent || link.title || '');
      return /\/expediente\/mov\/transferir/i.test(href) &&
        (link.id === 'tramitar' || texto.includes('tramitar'));
    }) || null;
  }

  let fluxoPosAssinaturaEmAndamento = false;

  async function verificarFluxoPosAssinaturaSigadocPendente() {
    if (fluxoPosAssinaturaEmAndamento) return;

    const resultado = await storageGet([PENDING_POS_ASSINATURA_KEY]);
    const pendente = resultado[PENDING_POS_ASSINATURA_KEY];
    if (!pendente || !pendente.criadoEm) return;

    const idade = Date.now() - new Date(pendente.criadoEm).getTime();
    if (idade > TEMPO_FLUXO_FINALIZACAO_MS) {
      await storageRemove([PENDING_POS_ASSINATURA_KEY]);
      return;
    }

    if (String(pendente.etapa || '').startsWith('anexo-')) {
      fluxoPosAssinaturaEmAndamento = true;
      try {
        const configurou = await configurarAnexoDoExpedienteSigadoc(pendente);
        if (configurou) return;

        if (pendente.etapa === 'anexo-aguardando-assinatura') {
          const retornou = await retornarDoAnexoParaOficioSigadoc(pendente);
          if (retornou) return;
        }
      } catch (erro) {
        await concluirTentativaDeAnexoComFalhaSigadoc(pendente, erro);
      } finally {
        fluxoPosAssinaturaEmAndamento = false;
      }
      return;
    }

    if (pendente.etapa === 'oficio-assinado') {
      fluxoPosAssinaturaEmAndamento = true;
      try {
        await abrirAnexacaoDoExpedienteSigadoc(pendente);
      } catch (erro) {
        await concluirTentativaDeAnexoComFalhaSigadoc(pendente, erro);
      } finally {
        fluxoPosAssinaturaEmAndamento = false;
      }
      return;
    }

    const pdfUrl = encontrarUrlImpressaoPdfSigadoc();
    const numeroSigadoc = extrairNumeroSigadocDaPagina();

    if (pendente.modoPosAssinatura === 'parar') {
      if (!pdfUrl && !numeroSigadoc && !encontrarLinkTramitarSigadoc()) return;

      fluxoPosAssinaturaEmAndamento = true;
      try {
        if (pendente.avisoAnexo) {
          atualizarStatusMenuSigadoc(pendente.avisoAnexo + ' O ofício foi concluído sem anexo.', 'alerta');
        }
        await finalizarArquivoInternoDoExpedienteSigadoc(pendente);
        await storageRemove([PENDING_POS_ASSINATURA_KEY]);
      } finally {
        fluxoPosAssinaturaEmAndamento = false;
      }
      return;
    }

    if (!pdfUrl || !numeroSigadoc) return;

    fluxoPosAssinaturaEmAndamento = true;

    try {
      if (!pendente.fluxoSpa) {
        await baixarPdfParaDownloads(pdfUrl, pendente.nomeArquivo);
        const textoParaSpa = montarTextoRegistroSpa(numeroSigadoc, pendente.nomeOficioEnviado);
        if (textoParaSpa) {
          await copiarTextoSimples(textoParaSpa);
        }
        if (pendente.avisoAnexo) {
          atualizarStatusMenuSigadoc(pendente.avisoAnexo + ' O ofício foi concluído sem anexo.', 'alerta');
        }
        await finalizarArquivoInternoDoExpedienteSigadoc(pendente);
        await storageRemove([PENDING_POS_ASSINATURA_KEY]);
        return;
      }

      const arquivoId = await salvarPdfInterno(pdfUrl, pendente.nomeArquivo, {
        processo: pendente.processo,
        tipoOficio: pendente.tipoOficio,
        numeroSigadoc,
      });

      await storageSet({
        [PENDING_SPA_FINALIZACAO_KEY]: {
          criadoEm: new Date().toISOString(),
          etapa: 'aguardando-botao',
          arquivoId,
          nomeArquivo: pendente.nomeArquivo,
          nomeOficioEnviado: pendente.nomeOficioEnviado,
          textoRegistroSpa: montarTextoRegistroSpa(numeroSigadoc, pendente.nomeOficioEnviado),
          numeroSigadoc,
          processo: pendente.processo,
          tipoOficio: pendente.tipoOficio,
        },
        [PENDING_TRAMITACAO_KEY]: {
          criadoEm: new Date().toISOString(),
          destinatarioSigla: pendente.destinatarioSigla,
          destinatarioDescricao: pendente.destinatarioDescricao,
          numeroSigadoc,
        },
      });

      await storageRemove([PENDING_POS_ASSINATURA_KEY]);
      if (pendente.avisoAnexo) {
        atualizarStatusMenuSigadoc(pendente.avisoAnexo + ' O ofício seguirá sem anexo.', 'alerta');
      }
      await finalizarArquivoInternoDoExpedienteSigadoc(pendente);

      const tramitar = encontrarLinkTramitarSigadoc();
      if (!tramitar) throw new Error('Botão Tramitar não encontrado no SIGADOC.');
      tramitar.click();
    } catch (erro) {
      console.error('[CDSP - Extrator] Falha após assinatura SIGADOC:', erro);
      await storageRemove([PENDING_POS_ASSINATURA_KEY]);
      const btn = document.getElementById('spa-sigadoc-assinar-btn');
      atualizarBotao(btn, 'erro', '!', 'Erro pós-assinatura');
      const detalhe = erro.message || 'Falha ao baixar ou tramitar o ofício.';
      if (btn) btn.title = detalhe;
      atualizarStatusMenuSigadoc(`Erro pós-assinatura: ${detalhe}`, 'alerta');
    } finally {
      fluxoPosAssinaturaEmAndamento = false;
    }
  }

  let fluxoTramitacaoEmAndamento = false;

  async function verificarTramitacaoSigadocPendente() {
    if (fluxoTramitacaoEmAndamento) return;

    const resultado = await storageGet([PENDING_TRAMITACAO_KEY]);
    const pendente = resultado[PENDING_TRAMITACAO_KEY];
    if (!pendente || !pendente.criadoEm) return;

    const idade = Date.now() - new Date(pendente.criadoEm).getTime();
    if (idade > TEMPO_FLUXO_FINALIZACAO_MS) {
      await storageRemove([PENDING_TRAMITACAO_KEY]);
      return;
    }

    const campo = document.getElementById('formulario_lotaResponsavelSel_sigla');
    const ok = document.getElementById('button_ok');
    const form = document.getElementById('frm');
    if (!campo || !ok || !form) return;

    fluxoTramitacaoEmAndamento = true;

    try {
      const destino = pendente.destinatarioSigla || DESTINATARIO_PADRAO_SIGADOC.sigla;
      setValorCampo(campo, destino);
      campo.focus();

      const KeyboardEventCtor = campo.ownerDocument.defaultView.KeyboardEvent;
      ['keydown', 'keypress', 'keyup'].forEach((tipoEvento) => {
        campo.dispatchEvent(new KeyboardEventCtor(tipoEvento, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }));
      });

      executarNoContextoDaPagina(`
        (function () {
          var destino = ${JSON.stringify(destino)};
          var campo = document.getElementById('formulario_lotaResponsavelSel_sigla') ||
            document.getElementsByName('lotaResponsavelSel.sigla')[0];

          if (!campo) return;
          campo.value = destino;
          campo.dispatchEvent(new Event('input', { bubbles: true }));
          campo.dispatchEvent(new Event('change', { bubbles: true }));

          try {
            if (typeof handleEnter === 'function') {
              handleEnter(campo, {
                type: 'keypress',
                keyCode: 13,
                which: 13,
                preventDefault: function () {},
                stopPropagation: function () {}
              });
            }
          } catch (erro) {
            console.warn('[CDSP - Extrator] Falha no Enter da tramitação:', erro);
          }

          try {
            if (typeof ajax_lotaResponsavel === 'function') ajax_lotaResponsavel();
          } catch (erro) {
            console.warn('[CDSP - Extrator] Falha no AJAX da lotação:', erro);
          }
        })();
      `);

      await aguardar(1200);
      await storageRemove([PENDING_TRAMITACAO_KEY]);
      clicarNoContextoDaPaginaSigadoc(ok);
    } catch (erro) {
      console.error('[CDSP - Extrator] Falha ao tramitar SIGADOC:', erro);
      await storageRemove([PENDING_TRAMITACAO_KEY]);
    } finally {
      fluxoTramitacaoEmAndamento = false;
    }
  }

  function obterFontesUsuarioAssinaturaSigadoc() {
    return {
      matriculas: [
        document.getElementById('siglaUsuarioCadastrante')?.value,
        document.getElementById('siglaUsuSubscritor')?.value,
        document.getElementById('siglaUsuTitular')?.value,
        document.getElementById('nomeUsuarioSubscritor')?.value,
      ].map(limparValorExtraido).filter(Boolean),
      nomes: [
        document.getElementById('nomeUsuSubscritor')?.value,
        obterNomeSubscritorSigadoc(),
      ].map(limparValorExtraido).filter(Boolean),
    };
  }

  function detectarCredencialAssinaturaSigadoc() {
    const fontes = obterFontesUsuarioAssinaturaSigadoc();
    const matriculas = fontes.matriculas.map((valor) => normalizarTexto(valor).toUpperCase());
    const nomes = fontes.nomes.map(normalizarTexto);

    return CREDENCIAIS_ASSINATURA_SIGADOC.find((credencial) => {
      const matricula = normalizarTexto(credencial.matricula).toUpperCase();
      const porMatricula = matriculas.includes(matricula);
      const porNome = credencial.nomes.some((nome) => {
        const esperado = normalizarTexto(nome);
        return nomes.some((atual) => atual.includes(esperado) || esperado.includes(atual));
      });

      return porMatricula || porNome;
    }) || null;
  }

  function encontrarLinkAnexarSigadoc() {
    const elementos = Array.from(document.querySelectorAll('a[href], button, input[type="button"], input[type="submit"]'));
    return elementos.find((elemento) => {
      const texto = normalizarTexto([
        elemento.textContent,
        elemento.value,
        elemento.getAttribute('title'),
        elemento.getAttribute('aria-label'),
      ].filter(Boolean).join(' '));
      const href = elemento.getAttribute('href') || '';
      return texto === 'incluir documento' || /\/expediente\/doc\/incluir/i.test(href);
    }) || elementos.find((elemento) => {
      const texto = normalizarTexto([
        elemento.textContent,
        elemento.value,
        elemento.getAttribute('title'),
        elemento.getAttribute('aria-label'),
      ].filter(Boolean).join(' '));
      const href = elemento.getAttribute('href') || '';
      return texto === 'anexar' || /\/expediente\/doc\/anexar/i.test(href);
    }) || null;
  }

  function paginaNovoDocumentoSigadoc() {
    return Boolean(
      document.querySelector('form#frm input[name="exDocumentoDTO.idMod"]') &&
      (document.querySelector('#ulmod .dropdown-item[data-value]') || document.querySelector('#modelos-select'))
    );
  }

  function encontrarModeloCapturadoSigadoc() {
    return Array.from(document.querySelectorAll('#ulmod .dropdown-item[data-value]')).find((item) =>
      normalizarTexto(textoOpcaoModeloDocumentoSigadoc(item)).includes('capturado')
    ) || null;
  }

  async function obterArquivoInternoSigadoc(id) {
    if (!id) return null;
    const resposta = await enviarMensagemExtensao({
      type: 'cdspOficioObterPdf',
      id,
    });
    return resposta.pdf || null;
  }

  async function garantirArquivoExpedientePendenteSigadoc(pendente) {
    let arquivo = await obterArquivoInternoSigadoc(pendente.expedienteArquivoId);
    if (arquivo) return arquivo;

    if (!pendente.linkExpedienteSpa) {
      throw new Error('O expediente do processo não possui link para download.');
    }

    const pacote = {
      processo: pendente.processo || '',
      linkExpedienteSpa: pendente.linkExpedienteSpa,
    };
    const arquivoId = await prepararExpedienteParaAnexoSigadoc(pacote);
    pendente.expedienteArquivoId = arquivoId;
    pendente.nomeArquivoExpediente = pendente.nomeArquivoExpediente || montarNomeArquivoExpediente(pacote);
    await storageSet({ [PENDING_POS_ASSINATURA_KEY]: pendente });
    arquivo = await obterArquivoInternoSigadoc(arquivoId);
    if (!arquivo) throw new Error('O PDF do expediente não ficou disponível para anexação.');
    return arquivo;
  }

  function preencherArquivoNoInputSigadoc(campo, arquivo) {
    if (!campo || !arquivo || !arquivo.base64) return false;
    const blob = base64ParaBlob(arquivo.base64, arquivo.mime || 'application/pdf');
    const file = new File([blob], arquivo.nomeArquivo || 'Expediente.pdf', {
      type: arquivo.mime || 'application/pdf',
    });
    const transferencia = new DataTransfer();
    transferencia.items.add(file);
    campo.files = transferencia.files;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    return campo.files && campo.files.length === 1;
  }

  function preencherDescricaoAnexoSigadoc(pendente) {
    const descricao = document.getElementById('descrDocumento');
    if (!descricao) throw new Error('O campo Descrição do documento capturado não foi encontrado.');
    const descricaoOficio = limparValorExtraido(pendente.descricaoOficio || pendente.nomeOficioEnviado || '');
    const prefixo = 'Expediente vinculado à pendência que gerou o ofício';
    setValorCampo(descricao, descricaoOficio ? `${prefixo}: ${descricaoOficio}` : prefixo + '.');
  }

  async function abrirAnexacaoDoExpedienteSigadoc(pendente) {
    let anexar = encontrarLinkAnexarSigadoc();
    for (let tentativa = 0; !anexar && tentativa < 16; tentativa += 1) {
      await aguardar(250);
      anexar = encontrarLinkAnexarSigadoc();
    }
    if (!anexar) throw new Error('A ação Incluir documento não foi encontrada no ofício assinado.');

    pendente.etapa = 'anexo-selecionar-modelo';
    pendente.urlOficio = pendente.urlOficio || window.location.href;
    await storageSet({ [PENDING_POS_ASSINATURA_KEY]: pendente });
    anexar.click();
  }

  async function concluirTentativaDeAnexoComFalhaSigadoc(pendente, erro) {
    const motivo = erro && erro.message ? erro.message : String(erro || 'Falha desconhecida.');
    const proximaTentativa = Number(pendente.tentativasAnexo || 0) + 1;
    console.warn('[CDSP - Extrator] Falha ao anexar o expediente:', motivo);

    if (proximaTentativa < 2 && pendente.urlOficio) {
      pendente.tentativasAnexo = proximaTentativa;
      pendente.etapa = 'oficio-assinado';
      await storageSet({ [PENDING_POS_ASSINATURA_KEY]: pendente });
      window.location.assign(pendente.urlOficio);
      return;
    }

    pendente.tentativasAnexo = proximaTentativa;
    pendente.etapa = 'finalizar-sem-anexo';
    pendente.avisoAnexo = `Não foi possível anexar o expediente após ${proximaTentativa} tentativa(s): ${motivo}`;
    await storageSet({ [PENDING_POS_ASSINATURA_KEY]: pendente });

    if (pendente.urlOficio && window.location.href !== pendente.urlOficio) {
      window.location.assign(pendente.urlOficio);
    }
  }

  async function finalizarArquivoInternoDoExpedienteSigadoc(pendente) {
    if (!pendente || !pendente.expedienteArquivoId) return;
    await enviarMensagemExtensao({
      type: 'cdspOficioApagarPdf',
      id: pendente.expedienteArquivoId,
    }).catch((erro) => console.warn('[CDSP - Extrator] Não foi possível limpar o PDF interno do expediente:', erro));
  }

  async function configurarAnexoDoExpedienteSigadoc(pendente) {
    if (!paginaNovoDocumentoSigadoc()) return false;

    if (pendente.etapa === 'anexo-selecionar-modelo') {
      let modelo = encontrarModeloCapturadoSigadoc();
      for (let tentativa = 0; !modelo && tentativa < 16; tentativa += 1) {
        await aguardar(250);
        modelo = encontrarModeloCapturadoSigadoc();
      }
      if (!modelo) throw new Error('O modelo Capturado não foi encontrado no SIGADOC.');
      if (!aplicarSelecaoModeloDocumentoSigadoc(modelo)) {
        throw new Error('Não foi possível selecionar o modelo Capturado.');
      }
      pendente.etapa = 'anexo-enviar-arquivo';
      await storageSet({ [PENDING_POS_ASSINATURA_KEY]: pendente });
      return true;
    }

    if (pendente.etapa !== 'anexo-enviar-arquivo') return false;

    const campoArquivo = document.querySelector('input[type="file"]');
    const gravar = document.getElementById('btnGravar');
    if (!campoArquivo || !gravar) return true;

    const arquivo = await garantirArquivoExpedientePendenteSigadoc(pendente);
    const pacoteOficio = {
      processo: pendente.processo || '',
      tipoOficio: pendente.tipoOficio || '',
    };
    const destinoDoOficio = {
      sigla: pendente.destinatarioSigla || DESTINATARIO_PADRAO_SIGADOC.sigla,
      descricao: pendente.destinatarioDescricao || '',
    };
    await preencherDestinatarioSigadoc(pacoteOficio, destinoDoOficio);
    if (!estadoDestinatarioSigadoc(destinoDoOficio).confirmed) {
      throw new Error('O destinatário do documento capturado não foi confirmado pelo SIGADOC.');
    }

    await preencherClassificacaoSigadoc(pacoteOficio);
    const modeloOficio = resolverModeloSigadoc(pacoteOficio.tipoOficio);
    if (!modeloOficio || !modeloOficio.classificacao ||
        !estadoClassificacaoSigadoc(modeloOficio.classificacao).confirmed) {
      throw new Error('A classificação do documento capturado não foi confirmada pelo SIGADOC.');
    }
    if (!preencherArquivoNoInputSigadoc(campoArquivo, arquivo)) {
      throw new Error('O SIGADOC não aceitou o arquivo do expediente para anexação.');
    }
    preencherDescricaoAnexoSigadoc(pendente);

    pendente.etapa = 'anexo-aguardando-assinatura';
    await storageSet({ [PENDING_POS_ASSINATURA_KEY]: pendente });
    await salvarFluxoAssinaturaSigadoc('aguardando-documento-anexo', {
      processo: pendente.processo || '',
      anexoExpediente: true,
    });
    clicarNoContextoDaPaginaSigadoc(gravar);
    return true;
  }

  async function retornarDoAnexoParaOficioSigadoc(pendente) {
    const numeroAnexo = extrairNumeroSigadocDaPagina();
    if (!numeroAnexo || !/^PGE-CAP-/i.test(numeroAnexo)) return false;

    if (!pendente.urlOficio) throw new Error('A URL do ofício original não foi preservada para concluir a anexação.');
    pendente.etapa = 'oficio-pronto-para-finalizar';
    await storageSet({ [PENDING_POS_ASSINATURA_KEY]: pendente });
    window.location.assign(pendente.urlOficio);
    return true;
  }

  function obterSenhaDaSessaoSigadoc() {
    try {
      return String(sessionStorage.getItem(SIGADOC_SESSION_PASSWORD_KEY) || '');
    } catch (_erro) {
      return '';
    }
  }

  function salvarSenhaDaSessaoSigadoc(senha) {
    try {
      if (senha) {
        sessionStorage.setItem(SIGADOC_SESSION_PASSWORD_KEY, senha);
      } else {
        sessionStorage.removeItem(SIGADOC_SESSION_PASSWORD_KEY);
      }
    } catch (_erro) {
      // O fluxo de assinatura continua disponível mesmo quando a sessão não puder ser gravada.
    }
  }

  function modalSenhaSigadocContinuaAberto(campoSenha) {
    const campoAtual = document.getElementById('senhaUsuarioSubscritor');
    if (!campoSenha || !campoSenha.isConnected) {
      return Boolean(campoAtual && campoAtual.isConnected);
    }
    const dialog = document.getElementById('senhaDialog');
    if (!dialog) return true;
    const style = window.getComputedStyle ? window.getComputedStyle(dialog) : null;
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  }

  function selecionarAssinaturaPorSenhaSigadoc() {
    const radio = document.getElementById('ad_password_0') ||
      document.querySelector('input[name="radioProviderAssinatura"][id^="ad_password"]');

    if (!radio) throw new Error('Opção de assinatura por senha não encontrada.');
    if (radio.disabled) throw new Error('Opção de assinatura por senha está desabilitada.');

    if (!radio.checked) {
      radio.click();
    }

    radio.checked = true;
    radio.dispatchEvent(new Event('input', { bubbles: true }));
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function desmarcarAcoesExtrasAssinaturaSigadoc() {
    const seletores = [
      'input[type="checkbox"][name^="ad_tramitar_"]',
      'input[type="checkbox"][name^="ad_exibirNoProtocolo_"]',
    ];

    document.querySelectorAll(seletores.join(',')).forEach((campo) => {
      campo.checked = false;
    });
  }

  async function preencherModalSenhaAssinaturaSigadoc() {
    const credencial = detectarCredencialAssinaturaSigadoc();
    if (!credencial) {
      throw new Error('Usuário logado no SIGADOC não reconhecido para assinatura por senha.');
    }

    const matricula = await aguardarElemento('#nomeUsuarioSubscritor', 7000);
    const senha = await aguardarElemento('#senhaUsuarioSubscritor', 7000);
    const ok = await aguardarElemento('#senhaOk', 7000);

    if (!matricula || !senha || !ok) {
      throw new Error('Modal de senha do SIGADOC não apareceu com os campos esperados.');
    }

    const assinaturaPendente = (await storageGet([PENDING_ASSINATURA_KEY]))[PENDING_ASSINATURA_KEY];
    const pacote = await obterPacoteSalvo();
    if (pacote && !(assinaturaPendente && assinaturaPendente.anexoExpediente)) {
      await salvarFluxoPosAssinaturaSigadoc(pacote);
    }

    const senhaDaSessao = obterSenhaDaSessaoSigadoc();
    const tentativas = [{ origem: 'credencial interna', senha: credencial.senha }];
    if (senhaDaSessao && senhaDaSessao !== credencial.senha) {
      tentativas.push({ origem: 'Senha do SIGADOC', senha: senhaDaSessao });
    }

    for (let indice = 0; indice < tentativas.length; indice += 1) {
      const tentativa = tentativas[indice];
      setValorCampo(matricula, credencial.matricula);
      setValorCampo(senha, tentativa.senha);
      await aguardar(250);
      clicarNoContextoDaPaginaSigadoc(ok);

      // Em caso de senha incorreta, o SIGADOC mantém o modal aberto. Somente
      // nessa situação a senha opcional da sessão é usada como contingência.
      await aguardar(1600);
      if (!modalSenhaSigadocContinuaAberto(senha)) {
        await limparFluxoAssinaturaSigadoc();
        return;
      }

      if (indice < tentativas.length - 1) {
        console.warn('[CDSP - Extrator] A ' + tentativa.origem + ' não foi aceita; tentando a Senha do SIGADOC da sessão.');
      }
    }

    throw new Error(
      senhaDaSessao
        ? 'O SIGADOC não aceitou a credencial interna nem a Senha do SIGADOC informada nesta sessão.'
        : 'O SIGADOC não aceitou a credencial interna. Informe opcionalmente a Senha do SIGADOC e tente novamente.'
    );
  }

  async function iniciarFluxoAssinaturaSigadoc(pacote, btn) {
    const gravar = document.getElementById('btnGravar');
    if (!gravar) {
      throw new Error('Botão OK da minuta não encontrado.');
    }

    await salvarFluxoAssinaturaSigadoc('aguardando-documento', {
      processo: pacote.processo || '',
    });

    atualizarBotao(btn, 'copiando', '...', 'Gravando...');
    await aguardar(300);
    // O handler do botao OK e o caminho que o SIGADOC usa para executar
    // gravarDoc(). O clique direto preserva esse handler na tela atual.
    gravar.click();
    atualizarStatusMenuSigadoc('OK acionado. Aguardando a tela de assinatura...', 'alerta');
    agendarVerificacaoFluxoAssinaturaSigadoc(700);
  }

  async function iniciarFluxoAssinaturaComExpedienteSigadoc(pacote, btn) {
    try {
      await prepararExpedienteParaAnexoSigadoc(pacote);
    } catch (erro) {
      // A anexação possui duas novas tentativas após a assinatura. Não impede a
      // criação do ofício quando o SPA estiver momentaneamente indisponível.
      console.warn('[CDSP - Extrator] Não foi possível preparar o expediente antes da assinatura:', erro);
    }

    await iniciarFluxoAssinaturaSigadoc(pacote, btn);
  }

  function telaAutenticacaoSigadocEstaVisivel() {
    return Boolean(
      document.getElementById('ad_password_0') ||
      document.querySelector('input[name="radioProviderAssinatura"]') ||
      document.getElementById('bot-autenticar') ||
      document.getElementById('bot-assinar')
    );
  }

  function encontrarAcaoAutenticarSigadoc() {
    return document.getElementById('autenticar') || document.getElementById('assinar') ||
      Array.from(document.querySelectorAll('a[href], button, input[type="button"], input[type="submit"]')).find((elemento) => {
        const texto = normalizarTexto([
          elemento.textContent,
          elemento.value,
          elemento.getAttribute('title'),
          elemento.getAttribute('aria-label'),
        ].filter(Boolean).join(' '));
        return texto === 'autenticar' || texto === 'assinar';
      }) || null;
  }

  function encontrarBotaoConfirmarAutenticacaoSigadoc() {
    const botaoConhecido = document.getElementById('bot-autenticar') || document.getElementById('bot-assinar');
    if (botaoConhecido) return botaoConhecido;
    if (!telaAutenticacaoSigadocEstaVisivel()) return null;

    return
      Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).find((elemento) => {
        const texto = normalizarTexto([elemento.textContent, elemento.value, elemento.getAttribute('title')].filter(Boolean).join(' '));
        return texto === 'autenticar' || texto === 'assinar';
      }) || null;
  }

  async function clicarAutenticarNaExibicaoSigadoc() {
    let link = encontrarAcaoAutenticarSigadoc();
    for (let tentativa = 0; !link && tentativa < 32; tentativa += 1) {
      await aguardar(250);
      link = encontrarAcaoAutenticarSigadoc();
    }
    if (!link) return false;

    const anterior = (await storageGet([PENDING_ASSINATURA_KEY]))[PENDING_ASSINATURA_KEY] || {};
    await salvarFluxoAssinaturaSigadoc('aguardando-tela-assinatura', {
      ...anterior,
    });
    clicarNoContextoDaPaginaSigadoc(link);
    return true;
  }

  async function executarTelaAssinaturaSigadoc() {
    let botaoAssinar = encontrarBotaoConfirmarAutenticacaoSigadoc();
    for (let tentativa = 0; !botaoAssinar && tentativa < 32; tentativa += 1) {
      await aguardar(250);
      botaoAssinar = encontrarBotaoConfirmarAutenticacaoSigadoc();
    }
    if (!botaoAssinar) return false;

    selecionarAssinaturaPorSenhaSigadoc();
    desmarcarAcoesExtrasAssinaturaSigadoc();
    const anterior = (await storageGet([PENDING_ASSINATURA_KEY]))[PENDING_ASSINATURA_KEY] || {};
    await salvarFluxoAssinaturaSigadoc('aguardando-modal-senha', {
      ...anterior,
    });
    await aguardar(250);
    clicarNoContextoDaPaginaSigadoc(botaoAssinar);
    await preencherModalSenhaAssinaturaSigadoc();
    return true;
  }

  let fluxoAssinaturaEmAndamento = false;
  let timerVerificacaoAssinaturaSigadoc = null;

  function agendarVerificacaoFluxoAssinaturaSigadoc(atrasoMs = 700) {
    clearTimeout(timerVerificacaoAssinaturaSigadoc);
    timerVerificacaoAssinaturaSigadoc = setTimeout(() => {
      verificarFluxoAssinaturaPendente();
    }, atrasoMs);
  }

  async function verificarFluxoAssinaturaPendente() {
    if (fluxoAssinaturaEmAndamento) return;

    const resultado = await storageGet([PENDING_ASSINATURA_KEY]);
    const pendente = resultado[PENDING_ASSINATURA_KEY];
    if (!pendente) return;

    const idade = Date.now() - new Date(pendente.criadoEm).getTime();
    if (idade > TEMPO_FLUXO_ASSINATURA_MS) {
      await limparFluxoAssinaturaSigadoc();
      return;
    }

    fluxoAssinaturaEmAndamento = true;
    try {
      if (document.getElementById('senhaDialog') ||
          document.getElementById('senhaUsuarioSubscritor')) {
        await preencherModalSenhaAssinaturaSigadoc();
        return;
      }

      if (telaAutenticacaoSigadocEstaVisivel()) {
        const executou = await executarTelaAssinaturaSigadoc();
        if (executou) return;
      }

      if (encontrarAcaoAutenticarSigadoc()) {
        const executou = await clicarAutenticarNaExibicaoSigadoc();
        if (executou) return;
      }

      atualizarStatusMenuSigadoc('Aguardando o SIGADOC disponibilizar a assinatura...', 'alerta');
      agendarVerificacaoFluxoAssinaturaSigadoc(900);
    } catch (erro) {
      console.error('[CDSP - Extrator] Falha no fluxo de assinatura SIGADOC:', erro);
      await limparFluxoAssinaturaSigadoc();
      await storageRemove([PENDING_POS_ASSINATURA_KEY]);
      const btn = document.getElementById('spa-sigadoc-assinar-btn');
      atualizarBotao(btn, 'erro', '!', 'Erro ao assinar');
      const detalhe = erro.message || 'Falha ao assinar no SIGADOC.';
      if (btn) btn.title = detalhe;
      atualizarStatusMenuSigadoc(`Erro ao assinar: ${detalhe}`, 'alerta');
    } finally {
      fluxoAssinaturaEmAndamento = false;
    }
  }

  async function executarPreenchimentoSigadoc(opcoes = {}) {
    let assinar = Boolean(opcoes.assinar);
    const btn = document.getElementById(assinar ? 'spa-sigadoc-assinar-btn' : 'spa-sigadoc-btn');
    const automatico = Boolean(opcoes.automatico);
    let manterEstadoBotao = false;

    atualizarBotao(btn, 'copiando', '...', automatico ? 'Finalizando...' : 'Preenchendo...');

    try {
      const pacote = await obterPacoteSalvo();
      if (!pacote) {
        atualizarBotao(btn, 'alerta', '!', 'Nenhum dado do SPA');
        if (btn) btn.title = 'Extraia primeiro os dados no SPA.';
        return;
      }

      if (assinar && oficioApenasPreenchimento(pacote)) {
        assinar = false;
        if (btn) {
          btn.title = 'Este tipo foi configurado para preencher sem assinatura automática.';
        }
      }

      if (!automatico) {
        const modeloDocumento = await selecionarModeloDocumentoSeNecessario(pacote);
        if (modeloDocumento.mudou) {
          await storageSet({
            [PENDING_SIGADOC_KEY]: {
              criadoEm: new Date().toISOString(),
              processo: pacote.processo,
              assinar,
              fase: 'modelo',
            },
          });

          atualizarBotao(btn, 'alerta', '...', 'Carregando modelo...');
          if (btn) {
            btn.title = `${modeloDocumento.mensagem} Aguardando o SIGADOC atualizar os textos padrão.`;
          }
          // A troca de modelo submete o formulário. A continuação acontece somente
          // após a nova tela informar que os controles foram reconstruídos.
          manterEstadoBotao = true;
          return;
        } else if (modeloDocumento.mensagem && btn) {
          btn.title = modeloDocumento.mensagem;
        }

        const selecao = selecionarTextoPadraoSeNecessario(pacote);
        if (selecao.mudou) {
          await storageSet({
            [PENDING_SIGADOC_KEY]: {
              criadoEm: new Date().toISOString(),
              processo: pacote.processo,
              assinar,
              fase: 'texto-padrao',
            },
          });

          atualizarBotao(btn, 'alerta', '...', 'Carregando modelo...');
          if (btn) {
            btn.title = `${selecao.mensagem} Aguardando o SIGADOC carregar conteúdo e classificação antes dos campos finais.`;
          }
          // O texto padrão preenche classificação e conteúdo por AJAX. Não usar
          // tempo fixo: o observador retomará quando os campos estiverem prontos.
          manterEstadoBotao = true;
          return;
        }

        if (selecao.mensagem && btn) btn.title = selecao.mensagem;
      }

      const mensagens = await preencherCamposSigadoc(pacote);
      if (assinar) {
        manterEstadoBotao = true;
        await iniciarFluxoAssinaturaComExpedienteSigadoc(pacote, btn);
        return;
      }

      atualizarBotao(btn, 'sucesso', 'OK', 'Pronto p/ conferir');
      if (btn) btn.title = mensagens.join(' ');
    } catch (erro) {
      console.error('[CDSP - Extrator] Falha ao preencher SIGADOC:', erro);
      atualizarBotao(btn, 'erro', '!', 'Erro no SIGADOC');
      const detalhe = erro.message || 'Falha ao preencher. Confira o console do navegador.';
      if (btn) btn.title = detalhe;
      atualizarStatusMenuSigadoc(`Erro no SIGADOC: ${detalhe}`, 'alerta');
    } finally {
      if (!manterEstadoBotao) {
        setTimeout(() => {
          restaurarBotaoPreenchimentoSigadoc(btn);
        }, 6000);
      }
    }
  }

  function restaurarBotaoPreenchimentoSigadoc(btn) {
    if (btn && btn.classList.contains('erro')) return;
    if (btn && btn.id === 'spa-sigadoc-assinar-btn') {
      restaurarBotaoAssinarSigadoc(btn);
      return;
    }
    restaurarBotaoSigadoc(btn);
  }

  function restaurarBotaoSigadoc(btn) {
    if (!btn) return;
    btn.classList.remove('copiando', 'sucesso', 'alerta', 'erro');
    btn.disabled = false;
    btn.title = 'Preencher a minuta com os dados salvos do SPA. Não grava, não assina e não tramita.';
    btn.innerHTML = '<span class="spa-icon">SPA</span> Preencher SIGADOC';
  }

  function restaurarBotaoAssinarSigadoc(btn) {
    if (!btn) return;
    btn.classList.remove('copiando', 'sucesso', 'alerta', 'erro');
    btn.disabled = false;
    btn.title = 'Preencher, assinar, baixar e tramitar quando o tipo de ofício estiver mapeado.';
    btn.innerHTML = '<span class="spa-icon">SIGA</span> Preencher + Assinar';
  }

  function paginaListaDocumentosSigadoc() {
    if (/\/sigaex\/app\/expediente\/doc\/listar/i.test(window.location.pathname)) return true;
    return normalizarTexto(document.title || '').includes('lista de expedientes') &&
      Boolean(document.querySelector('table.gt-table a[href*="/sigaex/app/expediente/doc/exibir?sigla="]'));
  }

  function elementoVisivel(elemento) {
    if (!elemento) return false;
    const rect = elemento.getBoundingClientRect();
    const estilo = window.getComputedStyle(elemento);
    return rect.width > 0 && rect.height > 0 && estilo.display !== 'none' && estilo.visibility !== 'hidden';
  }

  function coletarLinksListaDocumentosSigadoc() {
    const links = Array.from(document.querySelectorAll('a[href*="/sigaex/app/expediente/doc/exibir?sigla="]'));
    const vistos = new Set();
    const itens = [];

    links.forEach((link) => {
      if (!elementoVisivel(link)) return;
      const sigla = limparValorExtraido(link.textContent || '');
      if (!/^PGE-OFI-\d{4}\/\d+-[A-Z]$/i.test(sigla)) return;
      if (vistos.has(sigla)) return;
      vistos.add(sigla);
      itens.push({
        sigla,
        url: new URL(link.getAttribute('href'), window.location.origin).href,
      });
    });

    return itens;
  }

  function lerAutomacaoListaSigadoc() {
    try {
      const bruto = sessionStorage.getItem(SIGADOC_LIST_AUTOMATION_KEY);
      return bruto ? JSON.parse(bruto) : null;
    } catch (_erro) {
      return null;
    }
  }

  function salvarAutomacaoListaSigadoc(estado) {
    sessionStorage.setItem(SIGADOC_LIST_AUTOMATION_KEY, JSON.stringify({
      ...estado,
      atualizadoEm: new Date().toISOString(),
    }));
  }

  function limparAutomacaoListaSigadoc() {
    sessionStorage.removeItem(SIGADOC_LIST_AUTOMATION_KEY);
  }

  function atualizarStatusMenuSigadoc(texto, tom = '') {
    const status = document.getElementById('cdsp-sigadoc-menu-status');
    if (!status) return;
    status.textContent = texto || 'Pronto';
    status.dataset.tone = tom;
  }

  function atualizarResumoAutomacaoListaSigadoc() {
    const resumo = document.getElementById('cdsp-sigadoc-list-summary');
    if (!resumo) return;

    const estado = lerAutomacaoListaSigadoc();
    if (estado && estado.ativo) {
      resumo.textContent = `${Math.min(estado.indice || 0, estado.total || 0)}/${estado.total || 0} visitado(s).`;
      return;
    }

    if (paginaListaDocumentosSigadoc()) {
      const total = coletarLinksListaDocumentosSigadoc().length;
      resumo.textContent = `${total} documento(s) na lista.`;
      return;
    }

    resumo.textContent = 'Abra a lista de documentos para iniciar.';
  }

  function localizarLinkListaSigadoc(item) {
    const links = Array.from(document.querySelectorAll('a[href*="/sigaex/app/expediente/doc/exibir?sigla="]'));
    return links.find((link) => limparValorExtraido(link.textContent || '') === item.sigla) ||
      links.find((link) => new URL(link.getAttribute('href'), window.location.origin).href === item.url) ||
      null;
  }

  let timerAutomacaoListaSigadoc = null;

  function agendarAutomacaoListaSigadoc(delayMs = 700) {
    clearTimeout(timerAutomacaoListaSigadoc);
    timerAutomacaoListaSigadoc = setTimeout(processarAutomacaoListaSigadoc, delayMs);
  }

  function iniciarAutomacaoListaSigadoc(botao) {
    const itens = coletarLinksListaDocumentosSigadoc();
    if (!itens.length) {
      atualizarBotao(botao, 'alerta', '!', 'Nada na lista');
      atualizarStatusMenuSigadoc('Nenhum documento PGE-OFI visivel foi encontrado nesta lista.', 'alerta');
      setTimeout(() => renderizarMenuSigadoc(), 2500);
      return;
    }

    salvarAutomacaoListaSigadoc({
      ativo: true,
      indice: 0,
      total: itens.length,
      itens,
      urlLista: window.location.href,
      fase: 'lista',
      iniciadoEm: new Date().toISOString(),
    });

    atualizarBotao(botao, 'copiando', '...', 'Visitando...');
    atualizarStatusMenuSigadoc(`Automacao iniciada com ${itens.length} documento(s).`, 'ok');
    atualizarResumoAutomacaoListaSigadoc();
    agendarAutomacaoListaSigadoc(500);
  }

  function pararAutomacaoListaSigadoc() {
    limparAutomacaoListaSigadoc();
    renderizarMenuSigadoc();
    atualizarStatusMenuSigadoc('Automacao da lista interrompida.', 'alerta');
  }

  function processarAutomacaoListaSigadoc() {
    const estado = lerAutomacaoListaSigadoc();
    if (!estado || !estado.ativo) return;

    if (paginaListaDocumentosSigadoc()) {
      const itens = Array.isArray(estado.itens) ? estado.itens : [];
      if ((estado.indice || 0) >= itens.length) {
        limparAutomacaoListaSigadoc();
        renderizarMenuSigadoc();
        atualizarStatusMenuSigadoc(`Automacao concluida. ${itens.length} documento(s) visitado(s).`, 'ok');
        return;
      }

      const item = itens[estado.indice || 0];
      const link = localizarLinkListaSigadoc(item);
      if (!link) {
        salvarAutomacaoListaSigadoc({
          ...estado,
          indice: (estado.indice || 0) + 1,
          fase: 'lista',
          ultimoErro: `Link nao encontrado para ${item.sigla}`,
        });
        atualizarStatusMenuSigadoc(`Link nao encontrado para ${item.sigla}; seguindo para o proximo.`, 'alerta');
        agendarAutomacaoListaSigadoc(500);
        return;
      }

      salvarAutomacaoListaSigadoc({
        ...estado,
        indice: (estado.indice || 0) + 1,
        atual: item,
        fase: 'abrindo',
      });
      atualizarStatusMenuSigadoc(`Abrindo ${item.sigla} (${(estado.indice || 0) + 1}/${itens.length})...`, 'busy');
      atualizarResumoAutomacaoListaSigadoc();
      setTimeout(() => link.click(), 350);
      return;
    }

    if (estado.atual && estado.urlLista) {
      salvarAutomacaoListaSigadoc({
        ...estado,
        fase: 'voltando',
      });
      atualizarStatusMenuSigadoc(`${estado.atual.sigla} aberto. Voltando para a lista...`, 'busy');
      setTimeout(() => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.location.href = estado.urlLista;
      }, 1300);
    }
  }

  function aplicarEstadoMenuSigadoc(panel) {
    try {
      const posicao = JSON.parse(localStorage.getItem(SIGADOC_MENU_POSITION_KEY) || 'null');
      if (posicao && Number.isFinite(posicao.left) && Number.isFinite(posicao.top)) {
        panel.style.left = `${posicao.left}px`;
        panel.style.top = `${posicao.top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      }
    } catch (_erro) {
      // Posicao invalida: usa padrao visual.
    }

    panel.classList.toggle('is-collapsed', localStorage.getItem(SIGADOC_MENU_COLLAPSED_KEY) === '1');
  }

  function tornarMenuSigadocMovel(panel) {
    const header = panel.querySelector('.cdsp-sigadoc-menu__header');
    if (!header || header.dataset.dragReady === '1') return;
    header.dataset.dragReady = '1';

    let inicio = null;
    header.addEventListener('mousedown', (event) => {
      if (event.target.closest('button')) return;
      const rect = panel.getBoundingClientRect();
      inicio = {
        x: event.clientX,
        y: event.clientY,
        left: rect.left,
        top: rect.top,
      };
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
      if (!inicio) return;
      const left = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, inicio.left + event.clientX - inicio.x));
      const top = Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, inicio.top + event.clientY - inicio.y));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!inicio) return;
      const rect = panel.getBoundingClientRect();
      localStorage.setItem(SIGADOC_MENU_POSITION_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      inicio = null;
    });
  }

  function criarBotaoMenuSigadoc(id, html, title, onClick, extraClass = '') {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = id;
      btn.type = 'button';
      btn.addEventListener('click', () => onClick(btn));
    }
    btn.className = `cdsp-sigadoc-menu__button ${extraClass}`.trim();
    btn.innerHTML = html;
    btn.title = title;
    return btn;
  }

  function renderizarMenuSigadoc() {
    const panel = document.getElementById('cdsp-sigadoc-menu');
    if (!panel) return;

    const body = panel.querySelector('.cdsp-sigadoc-menu__body');
    if (!body || body.querySelector('.copiando')) return;
    const senhaEmEdicao = body.querySelector('#cdsp-sigadoc-session-password');
    if (senhaEmEdicao && document.activeElement === senhaEmEdicao) return;

    body.innerHTML = '';

    const acoes = document.createElement('div');
    acoes.className = 'cdsp-sigadoc-menu__section';
    const tituloAcoes = document.createElement('strong');
    tituloAcoes.textContent = 'Oficios';
    acoes.appendChild(tituloAcoes);

    const senhaWrapper = document.createElement('label');
    senhaWrapper.className = 'cdsp-sigadoc-menu__password';
    senhaWrapper.textContent = 'Senha do SIGADOC';
    const senhaInput = document.createElement('input');
    senhaInput.id = 'cdsp-sigadoc-session-password';
    senhaInput.type = 'password';
    senhaInput.autocomplete = 'current-password';
    senhaInput.placeholder = 'Opcional';
    senhaInput.value = obterSenhaDaSessaoSigadoc();
    senhaInput.title = 'Usada somente como segunda tentativa de assinatura nesta sessão do SIGADOC.';
    senhaInput.addEventListener('input', () => salvarSenhaDaSessaoSigadoc(senhaInput.value));
    senhaWrapper.appendChild(senhaInput);
    acoes.appendChild(senhaWrapper);

    acoes.appendChild(criarBotaoMenuSigadoc(
      'spa-sigadoc-btn',
      '<span class="spa-icon">SPA</span> Preencher SIGADOC',
      'Preencher a minuta com os dados salvos do SPA. Não grava, não assina e não tramita.',
      () => executarPreenchimentoSigadoc()
    ));

    const telaEdicao = Boolean(
      document.getElementById('btnGravar') &&
      (document.getElementById('descrDocumento') || obterTextareaConteudoSigadoc())
    );
    const btnAssinarAtual = document.getElementById('spa-sigadoc-assinar-btn');
    if (telaEdicao) {
      acoes.appendChild(criarBotaoMenuSigadoc(
        'spa-sigadoc-assinar-btn',
        '<span class="spa-icon">SIGA</span> Preencher + Assinar',
        'Preencher, assinar, baixar e tramitar quando o tipo de ofício estiver mapeado.',
        () => executarPreenchimentoSigadoc({ assinar: true }),
        'is-warning'
      ));
    } else if (btnAssinarAtual) {
      btnAssinarAtual.remove();
    }
    body.appendChild(acoes);

    const automacao = document.createElement('div');
    automacao.className = 'cdsp-sigadoc-menu__section';
    const tituloAutomacao = document.createElement('strong');
    tituloAutomacao.textContent = 'Lista de processos';
    automacao.appendChild(tituloAutomacao);

    const estado = lerAutomacaoListaSigadoc();
    const resumo = document.createElement('span');
    resumo.id = 'cdsp-sigadoc-list-summary';
    resumo.className = 'cdsp-sigadoc-menu__hint';
    automacao.appendChild(resumo);

    if (paginaListaDocumentosSigadoc()) {
      automacao.appendChild(criarBotaoMenuSigadoc(
        'cdsp-sigadoc-list-run-btn',
        '<span class="spa-icon">↗</span> Visitar lista',
        'Abrir cada PGE-OFI visível da lista e voltar para a página anterior automaticamente.',
        iniciarAutomacaoListaSigadoc,
        'is-primary'
      ));
    }

    if (estado && estado.ativo) {
      automacao.appendChild(criarBotaoMenuSigadoc(
        'cdsp-sigadoc-list-stop-btn',
        '<span class="spa-icon">■</span> Parar',
        'Interromper a automação da lista do SIGADOC.',
        pararAutomacaoListaSigadoc,
        'is-danger'
      ));
    }

    body.appendChild(automacao);

    const status = document.createElement('div');
    status.id = 'cdsp-sigadoc-menu-status';
    status.className = 'cdsp-sigadoc-menu__status';
    status.textContent = 'Pronto';
    body.appendChild(status);

    atualizarResumoAutomacaoListaSigadoc();
  }

  function injetarBotaoSigadoc() {
    let panel = document.getElementById('cdsp-sigadoc-menu');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'cdsp-sigadoc-menu';
      panel.className = 'cdsp-sigadoc-menu';
      panel.innerHTML = `
        <div class="cdsp-sigadoc-menu__header">
          <strong>CDSP</strong>
          <span>SIGADOC</span>
          <button type="button" class="cdsp-sigadoc-menu__minimize" title="Minimizar ou expandir">−</button>
        </div>
        <div class="cdsp-sigadoc-menu__body"></div>
      `;
      document.body.appendChild(panel);
      aplicarEstadoMenuSigadoc(panel);
      tornarMenuSigadocMovel(panel);

      const minimize = panel.querySelector('.cdsp-sigadoc-menu__minimize');
      if (minimize) {
        minimize.addEventListener('click', () => {
          panel.classList.toggle('is-collapsed');
          localStorage.setItem(SIGADOC_MENU_COLLAPSED_KEY, panel.classList.contains('is-collapsed') ? '1' : '0');
        });
      }
    }

    renderizarMenuSigadoc();
  }

  function formularioPendenteSigadocEstaPronto(pacote, fase) {
    if (fase === 'modelo') {
      const modelo = obterModeloDocumentoSigadoc(pacote);
      return Boolean(encontrarOpcaoModeloDocumentoSigadoc(modelo));
    }

    const modelo = resolverModeloSigadoc(pacote.tipoOficio || pacote.observacao);
    const assunto = obterCampoAssuntoSigadoc();
    const conteudo = obterTextareaConteudoSigadoc();
    if (!assunto || !conteudo) return false;
    if (modelo && modelo.conteudoProprio) return true;

    const select = document.getElementById('preenchimento');
    const { option } = encontrarOpcaoTextoPadrao(select, pacote);
    return Boolean(select && option && String(select.value) === String(option.value));
  }

  async function aguardarFormularioPendenteSigadoc(pacote, fase, timeoutMs = 12000) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      if (formularioPendenteSigadocEstaPronto(pacote, fase)) return true;
      await aguardar(250);
    }
    return false;
  }

  async function verificarPreenchimentoPendente() {
    if (preenchimentoSigadocPendenteEmAndamento) return;

    const resultado = await storageGet([PENDING_SIGADOC_KEY, STORAGE_KEY]);
    const pendente = resultado[PENDING_SIGADOC_KEY];
    const pacote = resultado[STORAGE_KEY];
    if (!pendente || !pacote) return;

    const idade = Date.now() - new Date(pendente.criadoEm).getTime();
    if (idade > 1000 * 60 * 5) {
      await storageRemove([PENDING_SIGADOC_KEY]);
      return;
    }

    preenchimentoSigadocPendenteEmAndamento = true;
    try {
      const pronto = await aguardarFormularioPendenteSigadoc(pacote, pendente.fase || 'texto-padrao');
      if (!pronto) {
        atualizarStatusMenuSigadoc('Aguardando o SIGADOC concluir o carregamento do formulário...', 'alerta');
        setTimeout(() => verificarPreenchimentoPendente(), 1000);
        return;
      }

      await executarPreenchimentoSigadoc({
        automatico: pendente.fase === 'texto-padrao',
        assinar: Boolean(pendente.assinar),
      });
    } finally {
      preenchimentoSigadocPendenteEmAndamento = false;
    }
  }

  // ─── Finalização do ofício no SPA ──────────────────────────────────────────

  function restaurarBotaoPreencherSpa(btn) {
    if (!btn) return;
    btn.classList.remove('copiando', 'sucesso', 'alerta', 'erro');
    btn.disabled = false;
    btn.title = 'Preencher no SPA com o PDF assinado salvo pela extensão.';
    btn.innerHTML = '<span class="spa-icon">SPA</span> Preencher SPA';
  }

  function etapaAtualSpa() {
    const form = document.getElementById('progress-form');
    return form ? String(form.getAttribute('data-step-id') || '') : '';
  }

  function encontrarLinkSpaPorTexto(textoProcurado) {
    const alvo = normalizarTexto(textoProcurado);
    return Array.from(document.querySelectorAll('a[href], a.link-submit-redirect')).find((link) => {
      const texto = normalizarTexto([
        link.textContent,
        link.getAttribute('data-title'),
        link.getAttribute('title'),
      ].filter(Boolean).join(' '));
      return texto.includes(alvo);
    }) || null;
  }

  async function atualizarFinalizacaoSpaPendente(alteracoes) {
    const atual = await obterFinalizacaoSpaPendente();
    if (!atual) throw new Error('Nenhum ofício assinado aguardando preenchimento no SPA.');

    const atualizado = {
      ...atual,
      ...alteracoes,
      atualizadoEm: new Date().toISOString(),
    };

    await storageSet({ [PENDING_SPA_FINALIZACAO_KEY]: atualizado });
    return atualizado;
  }

  async function obterArquivoFinalizacaoSpa(dados) {
    const resposta = await enviarMensagemExtensao({
      type: 'cdspOficioObterPdf',
      id: dados.arquivoId,
    });

    const pdf = resposta.pdf;
    const blob = base64ParaBlob(pdf.base64, pdf.mime || 'application/pdf');
    return new File([blob], dados.nomeArquivo || pdf.nomeArquivo || 'Oficio CDSP.pdf', {
      type: pdf.mime || 'application/pdf',
      lastModified: Date.now(),
    });
  }

  function anexarArquivoSpa(input, arquivo) {
    if (!input) throw new Error('Campo de anexos não encontrado no SPA.');

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(arquivo);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function preencherFormularioFinalizacaoSpa(dados, btn) {
    const inputAnexo = document.getElementById('progress_form_data_Anexos_0_ATR005190') ||
      document.querySelector('input[type="file"][name*="ATR005190"]');
    const numeroOficio = document.getElementById('progress_form_data_ATR007999');
    const numeroSigadoc = document.getElementById('progress_form_data_ATR005103');
    const encerrar = document.getElementById('btn-progress-save') ||
      document.querySelector('input[type="submit"][value*="Encerrar"]');

    if (!numeroOficio || !numeroSigadoc || !encerrar) {
      throw new Error('Campos finais do SPA não foram encontrados.');
    }

    const arquivo = await obterArquivoFinalizacaoSpa(dados);
    anexarArquivoSpa(inputAnexo, arquivo);

    const textoRegistro = dados.textoRegistroSpa ||
      montarTextoRegistroSpa(dados.numeroSigadoc, dados.nomeOficioEnviado);

    setValorCampo(numeroOficio, textoRegistro);
    setValorCampo(numeroSigadoc, textoRegistro);

    atualizarBotao(btn, 'sucesso', 'OK', 'Encerrando...');

    await storageRemove([PENDING_SPA_FINALIZACAO_KEY]);
    if (dados.arquivoId) {
      await enviarMensagemExtensao({
        type: 'cdspOficioApagarPdf',
        id: dados.arquivoId,
      }).catch((erro) => {
        console.warn('[CDSP - Extrator] Não foi possível apagar o PDF interno:', erro);
      });
    }

    await aguardar(350);
    encerrar.click();
  }

  async function continuarFinalizacaoSpa(dados, btn) {
    const etapa = etapaAtualSpa();

    if (etapa === '1245') {
      await atualizarFinalizacaoSpaPendente({ etapa: 'preencher-formulario' });
      await preencherFormularioFinalizacaoSpa(dados, btn);
      return;
    }

    if (etapa === '751') {
      const linkInserir = document.querySelector('a.link-submit-redirect[data-step="1245"]') ||
        encontrarLinkSpaPorTexto('Inserir dados e aguardar resposta de ofício');
      if (!linkInserir) {
        throw new Error('Opção "Inserir dados e aguardar resposta de ofício" não encontrada.');
      }

      await atualizarFinalizacaoSpaPendente({ etapa: 'preencher-formulario' });
      atualizarBotao(btn, 'copiando', '...', 'Avançando...');
      linkInserir.click();
      return;
    }

    const linkEncerrar = encontrarLinkSpaPorTexto('Encerrar respostas de oficio recebida');
    if (!linkEncerrar) {
      throw new Error('Etapa "Encerrar respostas de oficio recebida" não encontrada nesta página do SPA.');
    }

    await atualizarFinalizacaoSpaPendente({ etapa: 'selecionar-inserir' });
    atualizarBotao(btn, 'copiando', '...', 'Abrindo etapa...');
    linkEncerrar.click();
  }

  async function executarPreencherSpa(botaoOrigem) {
    const btn = botaoOrigem || document.getElementById('spa-preencher-btn');
    atualizarBotao(btn, 'copiando', '...', 'Preenchendo...');

    try {
      const dados = await obterFinalizacaoSpaPendente();
      if (!dados) {
        atualizarBotao(btn, 'alerta', '!', 'Nada pendente');
        if (btn) btn.title = 'Não há ofício assinado guardado para preencher no SPA.';
        return;
      }

      await continuarFinalizacaoSpa(dados, btn);
    } catch (erro) {
      console.error('[CDSP - Extrator] Falha ao preencher SPA:', erro);
      atualizarBotao(btn, 'erro', '!', 'Erro no SPA');
      if (btn) btn.title = erro.message || 'Falha ao preencher o SPA.';
    } finally {
      setTimeout(() => restaurarBotaoPreencherSpa(btn), 6000);
    }
  }

  function injetarBotaoPreencherSpa() {
    if (document.getElementById('spa-preencher-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'spa-preencher-btn';
    btn.innerHTML = '<span class="spa-icon">SPA</span> Preencher SPA';
    btn.title = 'Preencher no SPA com o PDF assinado salvo pela extensão.';
    btn.addEventListener('click', executarPreencherSpa);
    document.body.appendChild(btn);
  }

  let finalizacaoSpaEmAndamento = false;

  async function verificarFinalizacaoSpaPendente() {
    if (finalizacaoSpaEmAndamento) return;

    const dados = await obterFinalizacaoSpaPendente();
    if (!dados || dados.etapa === 'aguardando-botao') return;

    const etapa = etapaAtualSpa();
    const deveContinuar = (dados.etapa === 'selecionar-inserir' && etapa === '751') ||
      (dados.etapa === 'preencher-formulario' && etapa === '1245');

    if (!deveContinuar) return;

    finalizacaoSpaEmAndamento = true;
    try {
      await continuarFinalizacaoSpa(dados, document.getElementById('spa-preencher-btn'));
    } catch (erro) {
      console.error('[CDSP - Extrator] Falha na continuação automática do SPA:', erro);
      const btn = document.getElementById('spa-preencher-btn');
      atualizarBotao(btn, 'erro', '!', 'Erro no SPA');
      if (btn) btn.title = erro.message || 'Falha na continuação automática do SPA.';
    } finally {
      finalizacaoSpaEmAndamento = false;
    }
  }

  async function aguardarCamposProcessoSpa(timeoutMs = 15000) {
    const inicio = Date.now();
    let ultimo = extrairCamposDaPaginaProcesso();

    while (Date.now() - inicio < timeoutMs) {
      ultimo = extrairCamposDaPaginaProcesso();
      if (ultimo.processo && (ultimo.vara || ultimo.autor || ultimo.assuntoBruto)) return ultimo;
      await aguardar(300);
    }

    return ultimo;
  }

  async function extrairPacoteProcessoAtualParaResposta() {
    let campos = await aguardarCamposProcessoSpa();
    const algumEncontrado = Object.values(campos).some(Boolean);
    if (!algumEncontrado) {
      throw new Error('Nenhum campo encontrado na página do processo.');
    }

    campos = await enriquecerDadosPeloProcessoPrincipal(campos);
    return criarPacote(campos, 'pagina-processo-em-aba');
  }

  function instalarExtracaoRemotaSpa() {
    if (window.CDSP_EXTRATOR_REMOTE_LISTENER_INSTALLED) return;
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;

    window.CDSP_EXTRATOR_REMOTE_LISTENER_INSTALLED = true;
    chrome.runtime.onMessage.addListener((mensagem, _sender, sendResponse) => {
      if (!mensagem || mensagem.type !== 'CDSP_OFICIOS_EXTRAIR_PROCESSO_ATUAL') return false;

      extrairPacoteProcessoAtualParaResposta()
        .then((pacote) => sendResponse({ ok: true, pacote }))
        .catch((erro) => {
          sendResponse({
            ok: false,
            error: erro && erro.message ? erro.message : String(erro),
          });
        });

      return true;
    });
  }

  // ─── Inicialização ─────────────────────────────────────────────────────────

  function inicializarSpa() {
    instalarExtracaoRemotaSpa();
    instalarApiOficiosSpa();
    removerBotoesSpaSoltos();
    verificarFinalizacaoSpaPendente();

    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        removerBotoesSpaSoltos();
        verificarFinalizacaoSpaPendente();
        notificarMenuOficiosSpa();
      }, 350);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function inicializarSigadoc() {
    injetarBotaoSigadoc();
    verificarPreenchimentoPendente();
    verificarFluxoAssinaturaPendente();
    verificarFluxoPosAssinaturaSigadocPendente();
    verificarTramitacaoSigadocPendente();
    agendarAutomacaoListaSigadoc(900);

    if (!window.CDSP_SIGADOC_LIST_AUTOMATION_PAGESHOW) {
      window.CDSP_SIGADOC_LIST_AUTOMATION_PAGESHOW = true;
      window.addEventListener('pageshow', () => {
        injetarBotaoSigadoc();
        agendarAutomacaoListaSigadoc(700);
      });
    }

    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        injetarBotaoSigadoc();
        verificarPreenchimentoPendente();
        verificarFluxoAssinaturaPendente();
        verificarFluxoPosAssinaturaSigadocPendente();
        verificarTramitacaoSigadocPendente();
        atualizarResumoAutomacaoListaSigadoc();
      }, 400);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (window.location.hostname === 'spa.pge.mt.gov.br') {
    inicializarSpa();
  } else if (HOST_SIGADOC.test(window.location.hostname)) {
    inicializarSigadoc();
  }
})();

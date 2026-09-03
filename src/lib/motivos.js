// Compartilhado entre a rota /api/extrair e a tela da lista.
// Só NAO_ENCONTRADO e LINK_INVALIDO provam que o link morreu — os demais
// significam apenas "não deu para checar", e o link deve ser preservado.
export const MOTIVOS = {
  OK: "ok",
  SEM_DADOS: "sem_dados",
  BLOQUEADO: "bloqueado",
  NAO_ENCONTRADO: "nao_encontrado",
  LINK_INVALIDO: "link_invalido",
  INACESSIVEL: "inacessivel",
};

export const MOTIVO_MORTO = [MOTIVOS.NAO_ENCONTRADO, MOTIVOS.LINK_INVALIDO];

export const ehLinkMorto = (motivo) => MOTIVO_MORTO.includes(motivo);

export const TEXTO_MOTIVO = {
  [MOTIVOS.SEM_DADOS]: "loja não suportada pelo extrator",
  [MOTIVOS.BLOQUEADO]: "a loja bloqueou o robô",
  [MOTIVOS.INACESSIVEL]: "não respondeu agora",
  [MOTIVOS.NAO_ENCONTRADO]: "página não existe mais",
  [MOTIVOS.LINK_INVALIDO]: "link inválido",
};

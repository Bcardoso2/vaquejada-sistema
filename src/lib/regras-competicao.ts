/**
 * Configuração Oficial das Regras de Competição e Julgamento - Vaquejada Pro
 * 
 * ATENÇÃO: As regras abaixo refletem as práticas comuns de circuitos de vaquejada
 * (como ABVAQ e Portal Vaquejada) e estão marcadas como "A CONFIRMAR" para validação
 * final da comissão organizadora.
 */

export interface RegrasCompeticaoConfig {
  /**
   * Quantidade de bois na fase de classificação regular por senha.
   * [A CONFIRMAR]: Padrão histórico = 2 bois por senha (ou 4 bois no kit de 2 senhas).
   */
  boisClassificatoriosPorSenha: number;

  /**
   * Critério para avanço à Disputa Final / Mata-Mata.
   * [A CONFIRMAR]: Padrão = Apenas duplas com 100% de aproveitamento (2 'VALEU')
   * avançam para a rodada final eliminatória.
   */
  criterioAptidaoFinal: 'TODOS_VALEU' | 'PONTUACAO_MINIMA';

  /**
   * Se um 'ZERO' desclassifica imediatamente a senha da disputa final.
   * [A CONFIRMAR]: Padrão = true na vaquejada clássica.
   */
  zeroDesclassificaImediato: boolean;

  /**
   * Pontuação atribuída a cada tipo de descida na pista.
   * [A CONFIRMAR]: No regulamento sem notas decimais:
   * Valeu = 10 pontos; Zero = 0 pontos.
   */
  pontosPorResultado: {
    VALEU: number;
    ZERO: number;
    RETORNO: number;
  };

  /**
   * Tempo limite na porteira para entrada dos competidores (em segundos).
   * [A CONFIRMAR]: Padrão ABVAQ = 30 segundos após chamada.
   */
  tempoCancelaSegundos: number;

  /**
   * Tempo limite de pista para descer o boi na faixa (em segundos).
   * [A CONFIRMAR]: Padrão ABVAQ = 40 segundos para puxada na faixa.
   */
  tempoDescidaFaixaSegundos: number;
}

export const REGRAS_COMPETICAO: RegrasCompeticaoConfig = {
  boisClassificatoriosPorSenha: 2,
  criterioAptidaoFinal: 'TODOS_VALEU',
  zeroDesclassificaImediato: true,
  pontosPorResultado: {
    VALEU: 10,
    ZERO: 0,
    RETORNO: 0,
  },
  tempoCancelaSegundos: 30,
  tempoDescidaFaixaSegundos: 40,
};

/**
 * Função utilitária que avalia o status classificatório da dupla com base nas regras configuradas.
 */
export function avaliarClassificacaoDupla(valeuCount: number, zeroCount: number) {
  if (REGRAS_COMPETICAO.zeroDesclassificaImediato && zeroCount > 0) {
    return 'DESCLASSIFICADO';
  }
  if (valeuCount >= REGRAS_COMPETICAO.boisClassificatoriosPorSenha) {
    return 'CLASSIFICADO';
  }
  return 'EM_ANDAMENTO';
}

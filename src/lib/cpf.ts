/**
 * Utilitários de validação, formatação e mascaramento de CPF
 */

/**
 * Remove caracteres não numéricos do CPF
 */
export function limparCpf(cpf: string): string {
  return (cpf || '').replace(/\D/g, '');
}

/**
 * Formata CPF para o padrão 000.000.000-00
 */
export function formatarCpf(cpf: string): string {
  const limpo = limparCpf(cpf);
  if (limpo.length !== 11) return cpf;
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Valida se um CPF é matematicamente válido com base nos 2 dígitos verificadores
 */
export function validarCpf(cpf: string): boolean {
  const limpo = limparCpf(cpf);

  if (limpo.length !== 11) return false;

  // Rejeita sequências de números iguais conhecidas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  // Validação do 1º dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;

  // Validação do 2º dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(10), 10)) return false;

  return true;
}

/**
 * Mascara o CPF para privacidade/LGPD: ***.***.123-**
 */
export function mascararCpf(cpf: string): string {
  const limpo = limparCpf(cpf);
  if (limpo.length !== 11) return '***.***.***-**';
  return `***.***.${limpo.substring(6, 9)}-**`;
}

/**
 * Mascara telefone: (81) 9****-**45
 */
export function mascararTelefone(telefone?: string | null): string {
  if (!telefone) return '';
  const limpo = telefone.replace(/\D/g, '');
  if (limpo.length >= 10) {
    const ddd = limpo.substring(0, 2);
    const final = limpo.substring(limpo.length - 2);
    return `(${ddd}) 9****-**${final}`;
  }
  return '(**) *****-****';
}

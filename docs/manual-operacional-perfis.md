# Manuais Operacionais Rápidos por Perfil (1 Página por Função)

Este documento contém guias de referência rápida para os operadores do evento. Cada seção foi projetada para consulta imediata na bancada de trabalho.

---

## 📋 1. Manual do Operador de Secretaria (Caixa)

### Objetivo Principal:
Realizar a venda ágil de senhas, conferir recebimentos, imprimir comprovantes térmicos e fechar o caixa do dia com precisão.

### Fluxo de Trabalho Passo a Passo:

1. **Abertura e Login:**
   - Acesse o sistema pelo navegador: `http://IP-DO-SERVIDOR:3000/login`.
   - Entre com seu e-mail e senha atribuídos pelo administrador.
   - Caso seja o primeiro acesso, o sistema exigirá a definição de uma nova senha forte (mínimo 10 caracteres).

2. **Venda de Senhas e Kits:**
   - No menu lateral, acesse **Secretaria** > **Vendas**.
   - Digite o código da senha desejada ou selecione uma senha livre da grade.
   - Digite os nomes ou selecione o **Puxador**, o **Esteireiro** e o **Cavalo**.
   - Selecione a **Categoria** (Ex: *Profissional*, *Amador*, *Aspirante*).
   - Escolha a forma de pagamento: **PIX**, **DINHEIRO**, **CARTÃO** ou **VALE**.
   - Clique em **Confirmar Venda**.

3. **Impressão do Comprovante Térmico:**
   - Após a confirmação, o sistema abre automaticamente a tela do comprovante térmico (`/comprovante/[id]`).
   - O comprovante contém o **QR Code oficial de validação** e dados da dupla.
   - Clique em **Imprimir Comprovante** (Ctrl+P / Command+P) para imprimir na bobina térmica de 80mm ou 58mm.
   - Entregue o comprovante ao vaqueiro ou responsável pela equipe.

4. **Cancelamento de Senhas:**
   - Em caso de desistência ou erro antes da entrada na pista, localize a senha e clique em **Cancelar**.
   - É obrigatório preencher o motivo do cancelamento para fins de auditoria interna.

5. **Fechamento de Caixa:**
   - Ao término do expediente, acesse **Financeiro** > **Fechamento de Caixa**.
   - Confira o total arrecadado por forma de pagamento (PIX, Dinheiro, Cartão).
   - Clique em **Exportar XLSX** para abrir no Microsoft Excel ou **Exportar PDF** para gerar o relatório consolidado assinado.

---

## 🏇 2. Manual do Operador de Pista

### Objetivo Principal:
Conduzir a fila de apresentações, chamar as duplas no microfone, controlar a cancela de liberação dos bois e registrar os resultados operacionais imediatos.

### Fluxo de Trabalho Passo a Passo:

1. **Acompanhamento do Mapa e Baterias:**
   - Acesse **Pista** > **Mapa de Corridas**.
   - O sistema exibe as baterias organizadas com as duplas ordenadas e seus respectivos bois sorteados.

2. **Chamada da Dupla e Cancela:**
   - Identifique a próxima dupla e clique em **Chamar Pista**.
   - Quando os vaqueiros estiverem posicionados nos boxes, inicie a cancela.
   - O **Cronômetro da Cancela** começa a contagem regressiva sincronizada pelo servidor. Mesmo se você recarregar a página ou bloquear a tela, o tempo restante permanece exato.

3. **Lançamento do Resultado Oficial:**
   - Assim que o boi for puxado e cruzar as faixas:
     - Clique em **VALEU BOI** (Verde) se a puxada foi limpa dentro das faixas.
     - Clique em **ZERO** (Vermelho) se o boi levantou fora da faixa ou se houve falta técnica.
     - Clique em **RETORNO** (Amarelo) caso o boi tenha batido na cancela, sofrido acidente ou o juiz tenha ordenado boi novo. Ao marcar Retorno, o sistema cria automaticamente uma nova corrida no fim da bateria com outro boi vinculado.

4. **Correção de Toque Acidental (Desfazer 10s):**
   - Caso aperte um botão por engano no calor da prova, você tem **10 segundos** para clicar no botão **Desfazer Julgamento**. Após esse tempo, apenas o Juiz Oficial ou Administrador poderá alterar.

---

## ⚖️ 3. Manual do Juiz Oficial (Tribunal da Prova)

### Objetivo Principal:
Garantir o cumprimento rigoroso do regulamento da ABVAQ, homologar baterias e analisar recursos de vídeo contestados pelos competidores (Boi de TV).

### Fluxo de Trabalho Passo a Passo:

1. **Acesso ao Tribunal de Julgamento:**
   - Faça login com suas credenciais de Juiz Oficial.
   - Acesse o painel **Juiz** > **Tribunal de Julgamento / Boi de TV**.

2. **Análise de Contestação em Vídeo (Boi de TV):**
   - Quando um competidor entrar com recurso oficial para revisão de um resultado **ZERO**:
   - A contestação aparecerá destacada na lista com status *Pendente de Análise*.
   - Reproduza o vídeo da corrida em câmera lenta na interface integrada.
   - Avalie o ponto exato da queda: se as quatro patas do boi caíram dentro da faixa de cal e o esteira soltou no momento regulamentar.
   - Selecione a decisão oficial:
     - **Manter Decisão (ZERO Confirmado):** Se a penalidade foi correta.
     - **Reverter para VALEU BOI:** Se a revisão comprovar pontuação legal.
     - **Conceder BOI DE RETORNO:** Se houve irregularidade externa na pista.
   - Preencha a justificativa formal e clique em **Homologar Decisão**. A decisão é auditada e atualiza instantaneamente o telão e o ranking.

3. **Homologação e Fechamento de Bateria:**
   - Acesse **Baterias** e revise os resultados finais da bateria concluída.
   - Clique em **Exportar Súmula Oficial em PDF** para assinatura e arquivamento dos comissários.

---

## ⚙️ 4. Manual do Administrador Geral

### Objetivo Principal:
Parametrizar o evento, gerenciar usuários e acessos, monitorar a segurança das operações e acompanhar auditorias em tempo real.

### Painéis e Ações Críticas:

1. **Parâmetros da Vaquejada:**
   - Acesse **Vaquejadas** para editar o nome oficial, tempo de cancela (padrão 30s), permissão ou bloqueio de múltiplas inscrições da mesma dupla e valor das inscrições.

2. **Gestão de Usuários e Desbloqueio:**
   - Acesse **Usuários** no menu administrativo.
   - Cadastre novos operadores selecionando seu respectivo papel (*ADMIN*, *SECRETARIA*, *OPERADOR_PISTA*, *JUIZ*).
   - **Desbloqueio de Contas:** Em caso de bloqueio temporário por rate limit (múltiplas tentativas de senha incorreta), clique no botão **Desbloquear Acesso** na linha do usuário.
   - **Alteração de Senha/Perfil:** Modifique perfis ou desative acessos instantaneamente; o usuário perde a sessão imediatamente no servidor na próxima requisição.

3. **Auditoria Geral (Trilha Forense):**
   - Acesse **Auditoria** para visualizar todas as ações executadas no sistema (Vendas, Julgamentos, Cancelamentos, Estornos e Trocas de Senha).
   - Dados sensíveis como CPF são filtrados e não aparecem nos logs ou na tela de auditoria.

4. **Rotina de Backup:**
   - O sistema realiza backups automáticos a cada 24 horas via cron (`scripts/backup.sh`), mantendo os últimos 7 dias.
   - Para gerar um backup manual a qualquer instante antes da disputa final:
     ```bash
     ./scripts/backup.sh
     ```

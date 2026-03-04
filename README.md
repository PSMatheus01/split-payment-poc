<div align="center">

# Split Payment Tributário — Prova de Conceito
### Liquidação Atômica para o Split Payment da Reforma Tributária Brasileira (LC 214/2025)

*Contratos Inteligentes com Verificação Criptográfica de Assinatura Digital*

*Metodologia: Design Science Research (Hevner et al., 2004; Peffers et al., 2007)*

[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow?logo=hardhat)](https://hardhat.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue?logo=solidity)](https://soliditylang.org/)
[![Python](https://img.shields.io/badge/Python-Oracle-3776AB?logo=python)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-13%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/Branch%20Coverage-83%25-yellowgreen)]()

[Sobre](#sobre-o-projeto) · [Arquitetura](#arquitetura) · [Resultados](#resultados) · [Análise de Segurança](#análise-de-segurança) · [Escalabilidade](#escalabilidade) · [Comparação de Alternativas](#comparação-de-alternativas) · [Como Executar](#como-executar) · [Referência Legal](#referência-legal)

</div>

---

<a id="sobre-o-projeto"></a>
## Sobre o Projeto

Esta é uma **prova de conceito acadêmica** que demonstra a viabilidade técnica de utilizar contratos inteligentes para executar o mecanismo de **split payment tributário** previsto na **Lei Complementar nº 214/2025**, que regulamenta o IBS (Imposto sobre Bens e Serviços) e a CBS (Contribuição sobre Bens e Serviços) instituídos pela Emenda Constitucional nº 132/2023.

O projeto implementa a **liquidação atômica** de transações comerciais com **distribuição federativa automática** dos tributos entre União, estados e municípios, garantindo que o pagamento ao vendedor e a retenção do tributo aconteçam na mesma transação indivisível.

A PoC foi desenvolvida e avaliada segundo a abordagem de **Design Science Research** (Hevner et al., 2004; Peffers et al., 2007), com quatro sub-perguntas de pesquisa mensuráveis, critérios explícitos de avaliação e rastreabilidade de cada cenário de teste a requisitos da LC 214/2025.

### Problema que resolve

A sonegação fiscal no Brasil é estimada em **R$ 417 bilhões anuais** (IBPT, 2020). O split payment ataca a **inadimplência fiscal** — quando o contribuinte declara o tributo mas não paga — ao eliminar o intervalo temporal entre o fato gerador e o recolhimento.

A urgência se intensifica pela consolidação dos **marketplaces** como canal hegemônico do comércio eletrônico brasileiro (**90% dos usuários** em 2024, TIC Domicílios) e pela dominância do **Pix** como meio de pagamento (**84% dos usuários**), com liquidação imediata (D+0) que torna inviável o recolhimento tributário em prazo diferido.

> Esta POC demonstra que, com verificação criptográfica, **a adulteração dos dados fiscais entre a autorização da nota fiscal e a liquidação do pagamento é tecnicamente impossível**.

### Sub-perguntas de Pesquisa

| ID | Pergunta | Critério de Avaliação | Resultado |
|:---:|:---|:---|:---:|
| **SP1** | A liquidação garante atomicidade (indivisibilidade pagamento + retenção tributária)? | Soma dos fluxos = valor bruto em 100% dos cenários; falha parcial reverte tudo | **Sim** |
| **SP2** | A verificação criptográfica impede adulteração dos dados fiscais? | 100% das tentativas com dados modificados são rejeitadas | **Sim** |
| **SP3** | A compensação de créditos mantém proporcionalidade federativa? | Razão CBS:IBS-E:IBS-M preservada após dedução (diferença máx. 1 wei) | **Sim** |
| **SP4** | Qual o custo computacional por modalidade? | Gas mensurável, reprodutível e < 500.000 por transação | **Sim** |

---

<a id="arquitetura"></a>
## Arquitetura

**Separação de responsabilidades (Problema do Oráculo Fiscal):**

- O **Oráculo Fiscal** (SEFAZ/RFB) calcula os tributos *off-chain* e assina digitalmente o pacote de dados com chave ECDSA.
- O **Contrato Inteligente** apenas verifica a assinatura e executa a distribuição atômica.
- Isso evita armazenar tabelas de alíquotas *on-chain* (inviável computacionalmente e financeiramente).

![Arquitetura Detalhada do Split Payment](https://mermaid.ink/img/Z3JhcGggVEIKICAgIHN1YmdyYXBoIE9mZi1DaGFpbiBbQU1CSUVOVEUgT0ZGLUNIQUlOXQogICAgICAgIE5GRVsiTkYtZTxici8-KERvYy4gRmlzY2FsKSJdCiAgICAgICAgTU9UT1JbIk1vdG9yIGRlIFJlZ3Jhczxici8-VHJpYnV0YXJpYXM8YnIvPk5DTSwgQ0ZPUCwgVUYiXQogICAgICAgIE9SQUNMRVsiT3JhY3VsbyBGaXNjYWw8YnIvPihTRUZBWiAvIFJGQik8YnIvPkFzc2luYSBFQ0RTQSJdCiAgICBlbmQKCiAgICBzdWJncmFwaCBPbi1DaGFpbiBbQU1CSUVOVEUgT04tQ0hBSU5dCiAgICAgICAgU0NbIlNwbGl0UGF5bWVudEJyYXNpbC5zb2w8YnIvPjxici8-WzFdIFZlcmlmaWNhIEVDRFNBPGJyLz5bMl0gVmVyaWZpY2EgQWNjZXNzQ29udHJvbDxici8-WzNdIFZlcmlmaWNhIElkZW1wb3RlbmNpYTxici8-WzRdIENvbXBlbnNhIENyZWRpdG9zPGJyLz5bNV0gTGlxdWlkYWNhbyBBdG9taWNhPGJyLz5bNl0gRW1pdGUgRXZlbnRvIGRlIEF1ZGl0b3JpYSJdCiAgICBlbmQKCiAgICBzdWJncmFwaCBEZXN0aW5vIFtEZXN0aW5vIGRvcyBSZWN1cnNvc10KICAgICAgICBWRU5EWyJWZW5kZWRvcjxici8-KGxpcXVpZG8pIl0KICAgICAgICBVTklbIlVuaWFvPGJyLz4oQ0JTKSJdCiAgICAgICAgRVNUWyJFc3RhZG88YnIvPihJQlMtRSkiXQogICAgICAgIE1VTlsiTXVuaWNpcGlvPGJyLz4oSUJTLU0pIl0KICAgIGVuZAoKICAgIE5GRSAtLT4gTU9UT1IKICAgIE1PVE9SIC0tPiBPUkFDTEUKICAgIE9SQUNMRSAtLSAiRGFkb3MgKyBBc3NpbmF0dXJhIiAtLT4gU0MKICAgIFNDIC0tPiBWRU5ECiAgICBTQyAtLT4gVU5JCiAgICBTQyAtLT4gRVNUCiAgICBTQyAtLT4gTVVOCgogICAgc3R5bGUgT1JBQ0xFIGZpbGw6I2Y5ZixzdHJva2U6IzMzMyxzdHJva2Utd2lkdGg6MnB4CiAgICBzdHlsZSBTQyBmaWxsOiNiYmYsc3Ryb2tlOiMzMzMsc3Ryb2tlLXdpZHRoOjJweAogICAgc3R5bGUgVkVORCBmaWxsOiNkZmQsc3Ryb2tlOiMzMzMsc3Ryb2tlLXdpZHRoOjJweAogICAgc3R5bGUgVU5JIGZpbGw6I2ZmZCxzdHJva2U6IzMzMyxzdHJva2Utd2lkdGg6MnB4CiAgICBzdHlsZSBFU1QgZmlsbDojZmZkLHN0cm9rZTojMzMzLHN0cm9rZS13aWR0aDoycHgKICAgIHN0eWxlIE1VTiBmaWxsOiNmZmQsc3Ryb2tlOiMzMzMsc3Ryb2tlLXdpZHRoOjJweA)



### Fluxo do Split Padrão (Art. 32)

![Fluxo do Split Padrão](https://mermaid.ink/img/c2VxdWVuY2VEaWFncmFtCiAgICBwYXJ0aWNpcGFudCBPRiBhcyBPcmFjdWxvIEZpc2NhbAogICAgcGFydGljaXBhbnQgQyBhcyBDb21wcmFkb3IKICAgIHBhcnRpY2lwYW50IFNDIGFzIENvbnRyYXRvIFNwbGl0UGF5bWVudAogICAgcGFydGljaXBhbnQgQ08gYXMgQ29mcmVzIFB1YmxpY29zCgogICAgT0YtPj5PRjogMS4gQ2FsY3VsYSB0cmlidXRvcwogICAgT0YtPj5PRjogMi4gQXNzaW5hIEVDRFNBCiAgICBPRi0-PkM6IGRhZG9zICsgYXNzaW5hdHVyYQogICAgQy0-PlNDOiAzLiBleGVjdXRlU3RhbmRhcmRTcGxpdChkYXRhLCBzaWcpCiAgICBTQy0-PlNDOiA0LiBWYWxpZGEgKDcgY2hlY2tzKQogICAgU0MtPj5TQzogNS4gQ29tcGVuc2EgY3JlZGl0b3MKICAgIFNDLT4-U0M6IDYuIFJlY2FsY3VsYSBwcm9wb3JjYW8KICAgIFNDLT4-Q086IFZlbmRlZG9yIChsaXF1aWRvKQogICAgU0MtPj5DTzogQ0JTIChVbmlhbykKICAgIFNDLT4-Q086IElCUy1FIChFc3RhZG8pCiAgICBTQy0-PkNPOiBJQlMtTSAoTXVuaWNpcGlvKQogICAgU0MtPj5TQzogNy4gZW1pdCBTcGxpdFBheW1lbnRFeGVjdXRlZCAoOSBwYXJhbXMpCiAgICBOb3RlIG92ZXIgQyxDTzogU2UgcXVhbHF1ZXIgdHJhbnNmZXJlbmNpYSBmYWxoYXIgLT4gUkVWRVJUIHRvdGFs)


---

## Modalidades Implementadas

### 1. Split Padrão (Art. 32, LC 214/2025)

Liquidação atômica com consulta em tempo real ao sistema fiscal. O contrato executa **4 transferências simultâneas** (Vendedor + CBS + IBS Estadual + IBS Municipal) com cruzamento de débitos e créditos tributários e recálculo proporcional da repartição federativa.

**Função:** `executeStandardSplit(InvoiceTaxData calldata data, bytes calldata signature)`

**Blocos lógicos:** Guardas aritméticas → Idempotência → Verificação ECDSA → Compensação de créditos → Repartição proporcional → Liquidação atômica → Evento de auditoria.

### 2. Split Simplificado (Art. 33, LC 214/2025)

Modalidade para operações B2C com alíquota fixa em *basis points*. Executa **2 transferências** (Vendedor + Conta de Conciliação), com repartição federativa *a posteriori* pelo Comitê Gestor. Inclui sufixo `"SIMPLIFIED"` no hash para evitar colisão com o split padrão.

**Função:** `executeSimplifiedSplit(address seller, uint256 grossAmount, uint256 simplifiedRate, string calldata invoiceId, bytes calldata signature)`

---

<a id="resultados"></a>
## Resultados

### Testes Unitários — 13/13 passing

```text
SplitPaymentBrasil

  Deploy e Configuracao
    ✔ Deve fazer deploy com os enderecos corretos dos cofres publicos
    ✔ Deve registrar o oraculo fiscal com a role correta
    ✔ Deve ter distribuido saldo ao comprador

  Split Padrao — Art. 32, LC 214/2025
    ✔ Deve executar liquidacao atomica com reparticao federativa correta
    ✔ Deve emitir evento SplitPaymentExecuted com dados corretos

  Split Padrao com Creditos Tributarios
    ✔ Deve compensar creditos e reter apenas tributo liquido

  Split Simplificado — Art. 33, LC 214/2025
    ✔ Deve aplicar aliquota fixa e enviar tributo a conta de conciliacao

  Seguranca — Rejeicao de Fraude
    ✔ Deve rejeitar transacao se o valor do imposto for adulterado
    ✔ Deve rejeitar transacao se o valor bruto for adulterado

  Idempotencia — Rejeicao de Dupla Liquidacao
    ✔ Deve rejeitar tentativa de processar a mesma NF-e duas vezes

  Seguranca — Assinatura Nao Autorizada
    ✔ Deve rejeitar transacao assinada por entidade nao registrada

  Metricas de Performance
    ✔ Deve registrar custo de gas do Split Padrao
    ✔ Deve registrar custo de gas do Split Simplificado

  13 passing (845ms)
```

### Rastreabilidade dos Testes a Requisitos

| Cat. | Cenário | Requisito de Origem | Sub-pergunta | O que verifica |
|:---|:---:|:---|:---:|:---|
| Deploy | 1.1-1.3 | Pré-condição operacional | — | Cofres públicos, oráculo, saldo |
| Split Padrão | 2.1 | Art. 32 (atomicidade) | SP1 | 4 fluxos cuja soma = valor bruto |
| Split Padrão | 2.2 | Art. 32 (rastreabilidade) | SP1 | Evento com 9 parâmetros |
| Créditos | 3.1 | Art. 32, §2º (compensação) | SP3 | Tributo líquido com proporção mantida |
| Simplificado | 4.1 | Art. 33 (alíquota fixa B2C) | SP1 | Alíquota + conta de conciliação |
| Fraude | 5.1 | Integridade ECDSA | SP2 | Rejeição: CBS adulterado |
| Fraude | 5.2 | Integridade ECDSA | SP2 | Rejeição: valor bruto adulterado |
| Idempotência | 6.1 | Processamento único | SP1 | Rejeição: NF-e duplicada |
| Autorização | 7.1 | Governança (AccessControl) | SP2 | Rejeição: signatário não autorizado |
| Performance | 8.1 | Viabilidade computacional | SP4 | Gas do split padrão |
| Performance | 8.2 | Viabilidade computacional | SP4 | Gas do split simplificado |

### Métricas de Performance

| Modalidade | Gas Consumido | Transferências | Verificações | Razão vs. ERC-20 |
|:---|:---:|:---:|:---|:---:|
| **Split Padrão (Art. 32)** | `168.713` | 4 | ECDSA + Idempotência + Créditos + Proporção | 2,60× |
| **Split Simplificado (Art. 33)** | `114.268` | 2 | ECDSA + Idempotência | 1,76× |
| *Transferência ERC-20 (ref.)* | `~65.000` | 1 | Nenhuma | 1,00× |
| *Economia Simplificado vs. Padrão* | `−54.445 (−32,3%)` | −2 | Sem créditos, sem proporção | — |

### Métricas de Qualidade

| Métrica | Resultado |
|:---|:---|
| **Cobertura de branches** | 83% (10 de 12 caminhos condicionais exercitados) |
| **Cobertura de linhas** | 95% estimada |
| **Funções não testadas** | `updateTreasuryWallets` (cofres dinâmicos — escopo futuro) |
| **Branches não cobertas** | Rejeição por alíquota > 10.000 bps; rejeição por tributo > bruto |
| **Latência média por teste** | 65ms (Hardhat Network, sem rede/consenso) |
| **Latência estimada em Besu QBFT** | 2-5s (dominada pelo tempo de bloco) |

### Demonstração Interativa

Output do script de demonstração (`scripts/demo.js`):

```text
FASE 3: SPLIT PADRÃO (Art. 32) — Venda de R$ 1.000,00

Resultado da liquidação atômica:
├─ Vendedor:    +R$ 755,00
├─ CBS (União): +R$ 86,50
├─ IBS Estado:  +R$ 111,50
├─ IBS Munic.:  +R$ 47,00
└─ TOTAL:       R$ 1.000,00 (= valor bruto)

FASE 5: TENTATIVA DE FRAUDE — Adulteração do CBS

Dados originais:    CBS = R$ 43,25
Dados adulterados:  CBS = R$ 0,00
Resultado:          TRANSAÇÃO REJEITADA
Conclusão:          Sonegação por adulteração = IMPOSSÍVEL
```

---

## O que este projeto prova

| Propriedade | Como é garantida | Teste Ref. |
|:---|:---|:---:|
| **Atomicidade** | Todas as transferências ocorrem na mesma transação EVM ou nenhuma ocorre | 2.1 |
| **Integridade fiscal** | Verificação ECDSA impede adulteração de qualquer campo após assinatura | 5.1, 5.2 |
| **Idempotência** | Hash keccak256 da NF-e registrado em mapping; dupla liquidação impossível | 6.1 |
| **Autorização** | Apenas endereços com `FISCAL_ORACLE_ROLE` produzem assinaturas aceitas | 7.1 |
| **Compensação** | Créditos acumulados reduzem tributo líquido com recálculo proporcional | 3.1 |
| **Repartição** | CBS, IBS-E e IBS-M recebem frações exatas; município absorve resíduo de arredondamento | 2.1, 3.1 |
| **Rastreabilidade** | Eventos imutáveis `SplitPaymentExecuted` com 9 parâmetros indexados | 2.2 |

---

<a id="análise-de-segurança"></a>
## Análise de Segurança

### Análise Estática Manual (SWC Registry)

| Vulnerabilidade | Status | Justificativa |
|:---|:---:|:---|
| Reentrância (SWC-107) | **Não vulnerável** | `_transfer` do OpenZeppelin ERC-20 não invoca código externo |
| Dependência de timestamp (SWC-116) | **Não vulnerável** | `block.timestamp` usado apenas em evento, sem influenciar fluxo |
| Integer overflow (SWC-101) | **Não vulnerável** | Solidity 0.8.20 com verificação aritmética nativa |
| Checks-effects-interactions | **Respeitado** | `processedInvoices` atualizado antes das transferências |

### Superfície de Ataque e Mitigações Propostas

| Vetor de Ataque | Risco na PoC | Mitigação para Produção |
|:---|:---|:---|
| Comprometimento da chave do oráculo | Alto — oráculo único assina tudo | Multi-assinatura *threshold* (m-de-n) com HSM + ICP-Brasil |
| Alteração dos cofres públicos | `ADMIN_ROLE` controlada por único endereço | Multi-sig (Gnosis Safe) + TimelockController (48h de carência) |
| Ausência de mecanismo de pausa | Sem como interromper operações em emergência | Implementar OpenZeppelin `Pausable` com controle multi-sig |
| Imutabilidade do contrato | Correções exigem novo deploy + migração de estado | Padrão Proxy (UUPS ou TransparentUpgradeable) com timelock |

### Governança Multi-assinatura Proposta

Para produção, o oráculo fiscal deve implementar assinaturas *threshold* que reflitam a governança multisetorial:

```
Transação intraestadual:     2-de-3  (RFB + SEFAZ + CGIBS)
Transação interestadual:     2-de-4  (RFB + SEFAZ origem + SEFAZ destino + CGIBS)
Alteração de parâmetros:     3-de-4  ou  4-de-4
```

Essa arquitetura materializa em código o princípio de governança multisetorial de Infraestrutura Pública Digital (Vaz & Campagnucci, 2024).

---

<a id="escalabilidade"></a>
## Escalabilidade

### Estimativas Teóricas

| Métrica | Valor | Fonte |
|:---|:---|:---|
| Pico de Pix (transações/dia) | 252,13 milhões | Relatório Anual SPI, BCB (2024) |
| TPS de pico estimado | ~2.900 | 252M ÷ 86.400s |
| TPS do Besu QBFT (ERC-20 simples) | 200–750 | Web3 Labs (2023); LF Decentralized Trust (2024) |
| Razão de complexidade do split padrão | 2,6× vs. ERC-20 | 168.713 ÷ 65.000 gas |
| **TPS ajustado para split padrão** | **77–288** | (200÷2,6) a (750÷2,6) |
| **Lacuna demanda vs. capacidade** | **~10×** | 2.900 ÷ 288 |

### Estratégias de Mitigação

| Estratégia | Descrição | TPS Estimado |
|:---|:---|:---|
| **Sharding por UF** | Cada estado opera uma rede Besu independente | ~100-150 TPS/rede (2.900 ÷ 27) |
| **Processamento em lote** | Merkle tree agrupando múltiplas transações por bloco | TPS × tamanho do lote |
| **Modelo híbrido** | Smart contract como camada de auditoria; liquidação via SPI/Pix | Throughput do SPI (~2.900 TPS) |

> O modelo híbrido é o cenário mais provável para produção, alinhado à posição do BCB na fase 3 do DREX.

---

<a id="comparação-de-alternativas"></a>
## Comparação de Alternativas

| Critério | Smart Contract (DLT/Besu) | API Centralizada | SPI/Pix (extensão) |
|:---|:---|:---|:---|
| **Atomicidade** | Nativa (transação EVM) | Requer 2PC/Saga | Não nativa para multi-destinatário |
| **Verificabilidade** | Qualquer nó audita | Depende do operador | Parcial (BCB audita) |
| **Imutabilidade** | Hash encadeado | Controles internos | Finais, mas não encadeados |
| **Transparência** | Código auditável | Proprietário | ISO 20022 público, motor interno |
| **Latência** | 1-5s (tempo de bloco) | <100ms | ~2,8s (mediana SPI) |
| **TPS** | 200-750 | >10.000 | ~2.900 |
| **Privacidade** | Requer Tessera/ZKPs | Nativa | Nativa |
| **Governança** | Distribuída (nós) | Centralizada | Centralizada (BCB) |
| **Risco de centralização** | Baixo | Alto | Médio |
| **Maturidade regulatória** | Baixa | Alta | Alta |

---

## Contexto: Por que não Hyperledger Besu / DREX?

Em **novembro de 2025**, o Banco Central do Brasil desativou a plataforma DREX baseada em Hyperledger Besu após 4 anos de testes, considerando-a inadequada aos requisitos de privacidade e segurança. A fase 3 do projeto (2026) adotará abordagem "agnóstica quanto à tecnologia".

Esta POC é deliberadamente **independente de infraestrutura**. A lógica de liquidação atômica aqui demonstrada pode ser transposta para:

- Redes blockchain permissionadas (Corda, Fabric, ou futura plataforma do BCB).
- APIs REST com assinatura digital e banco de dados *append-only*.
- Camadas sobre o Pix com verificação criptográfica adicional.
- Modelos híbridos smart contracts + ISO 20022 (agenda de pesquisa).

---

## Estrutura do Projeto

```
split-payment-poc/
│
├── contracts/
│   └── SplitPaymentBrasil.sol      # Contrato: Split Padrão (Art. 32) + Simplificado (Art. 33)
│                                    # 234 linhas | Herda: ERC20, AccessControl | Usa: ECDSA
│
├── test/
│   └── SplitPaymentBrasil.test.js  # 13 testes unitários | Hardhat + Chai + Ethers.js
│                                    # Cobertura: 83% branches, 95% linhas
│
├── scripts/
│   └── demo.js                     # Demonstração interativa completa
│                                    # Deploy → Split Padrão → Simplificado → Fraude → Saldos
│
├── oracle/
│   ├── fiscal_oracle.py            # Oráculo Fiscal simulado | Python + web3.py + ECDSA
│   │                                # TaxEngine (alíquotas por setor) + FiscalOracle (assinador)
│   └── requirements.txt            # Dependências Python
│
├── docs/
│   └── split-payment-tributario.pdf # Artigo acadêmico completo
│
├── hardhat.config.js               # Solidity 0.8.20 | viaIR: true | optimizer: 200 runs
├── package.json                    # Dependências Node.js
├── LICENSE                         # MIT
└── README.md
```

---

<a id="como-executar"></a>
## Como Executar

### Pré-requisitos

- **Node.js** 18+ → [nodejs.org](https://nodejs.org)
- **Python** 3.9+ → [python.org](https://python.org) (apenas para simular o oráculo)

### Instalação

1. Clone o repositório e instale as dependências:
```bash
git clone https://github.com/PSMatheus01/split-payment-poc.git
cd split-payment-poc
npm install
```

2. Compile os contratos:
```bash
npx hardhat compile
```

3. Execute os testes (13 cenários):
```bash
npx hardhat test
```

4. Execute a demonstração interativa:
```bash
npx hardhat run scripts/demo.js
```

### (Opcional) Executar o Oráculo Fiscal

Para testar a geração de assinaturas off-chain:
```bash
cd oracle
pip install -r requirements.txt
python fiscal_oracle.py
```

---

<a id="referência-legal"></a>
## Referência Legal

| Dispositivo | Conteúdo | Implementação na POC |
|:---|:---|:---|
| **EC 132/2023** | Reforma Tributária — cria IBS e CBS | Contexto geral |
| **LC 214/2025, Art. 31** | Conceito do split payment | Arquitetura do contrato |
| **LC 214/2025, Art. 32** | Split Padrão (inteligente) | `executeStandardSplit()` |
| **LC 214/2025, Art. 32, §2º** | Compensação de créditos tributários | `registerTaxCredit()` + lógica de offset |
| **LC 214/2025, Art. 33** | Split Simplificado | `executeSimplifiedSplit()` |
| **LC 214/2025, Art. 34** | Regras complementares (parcelamento) | *Não implementado (escopo futuro)* |
| **LC 214/2025, Art. 35** | Governança e cronograma | Discussão na Seção 5 do artigo |

---

## Artigo Acadêmico

Esta POC é a base empírica do artigo:

> **"Liquidação Atômica para Split Payment Tributário: Uma Prova de Conceito com Contratos Inteligentes no Contexto da Reforma Tributária Brasileira (LC 214/2025)"**
>
> *Matheus Paixão Souza, \[Coautor\]*
>
> Metodologia: Design Science Research (Hevner et al., 2004; Peffers et al., 2007)
>
> O artigo completo está disponível em [docs/split-payment-tributario.pdf](docs/split-payment-tributario.pdf).

### Referências-chave do Artigo

| Referência | Uso no Projeto |
|:---|:---|
| Hevner et al. (2004); Peffers et al. (2007) | Fundamentação metodológica (Design Science Research) |
| Freitas & Vaz (2022) | Blockchain na gestão pública brasileira |
| Vaz & Campagnucci (2024) | Infraestrutura Pública Digital e governança multisetorial |
| CGI.br — TIC Domicílios (2024) | Dados: Pix 84%, Marketplaces 90%, conectividade 22% |
| BCB — Relatório Anual SPI (2024) | Métricas: 252M transações/dia, SLA 2,8s, custo R$0,001/tx |
| Web3 Labs (2023); LF Decentralized Trust (2024) | Benchmarks de TPS do Besu QBFT |

---

## Tecnologias

| Componente | Tecnologia | Versão |
|:---|:---|:---|
| Contrato Inteligente | **Solidity** | 0.8.20 |
| Framework | **Hardhat** | 2.22+ |
| Interação Blockchain | **Ethers.js** | 6.x |
| Asserções | **Chai** | 4.x |
| Oráculo Fiscal | **Python + web3.py** | 3.9+ / 6.15 |
| Criptografia | **ECDSA (secp256k1)** | — |
| Contratos Base | **OpenZeppelin** | 5.0 (ERC20, AccessControl, ECDSA) |

---

## Agenda de Pesquisa

Direções para trabalhos futuros, em ordem de prioridade:

1. **Testes de carga** em rede Besu permissionada com Hyperledger Caliper (transações de split, não ERC-20 simples).
2. **Integração com Pix Automático** — orquestração atômica entre arranjo Pix e verificação tributária on-chain.
3. **Modelos híbridos** smart contracts + ISO 20022 — hashes criptográficos em mensagens do SPI.
4. **Auditoria formal** — Slither, Mythril, Certora Prover para verificação de invariantes.
5. **Privacidade** — Zero-knowledge proofs e Private Channels para sigilo fiscal (Art. 198, CTN).
6. **Frontend Gov.br** — DApp de consulta de créditos tributários integrado ao ecossistema de governo digital.

---

## Licença

Este projeto está licenciado sob a **MIT License**.

---

<div align="center">

*Desenvolvido como prova de conceito acadêmica — Fevereiro/2026*

*Design Science Research · Solidity · Hardhat · LC 214/2025*

</div>

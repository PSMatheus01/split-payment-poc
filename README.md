<div align="center">

# Split Payment Tributário — Prova de Conceito
### Liquidação Atômica para o Split Payment da Reforma Tributária Brasileira (LC 214/2025)

*Contratos Inteligentes com Verificação Criptográfica de Assinatura Digital*

[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow?logo=hardhat)](https://hardhat.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue?logo=solidity)](https://soliditylang.org/)
[![Python](https://img.shields.io/badge/Python-Oracle-3776AB?logo=python)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-13%20passing-brightgreen)]()

[Sobre](#sobre-o-projeto) • [Arquitetura](#arquitetura) • [Resultados](#resultados) • [Como Executar](#como-executar) • [Referência Legal](#referência-legal)

</div>

---

<a id="sobre-o-projeto"></a>
##  Sobre o Projeto

Esta é uma **prova de conceito acadêmica** que demonstra a viabilidade técnica de utilizar contratos inteligentes para executar o mecanismo de **split payment tributário** previsto na **Lei Complementar nº 214/2025**, que regulamenta o IBS (Imposto sobre Bens e Serviços) e a CBS (Contribuição sobre Bens e Serviços) instituídos pela Emenda Constitucional nº 132/2023.

O projeto implementa a **liquidação atômica** de transações comerciais com **distribuição federativa automática** dos tributos entre União, estados e municípios, garantindo que o pagamento ao vendedor e a retenção do tributo aconteçam na mesma transação indivisível.

###  Problema que resolve

A sonegação fiscal no Brasil é estimada em **R$ 417 bilhões anuais** (IBPT, 2020). O split payment ataca a **inadimplência fiscal** — quando o contribuinte declara o tributo mas não paga — ao eliminar o intervalo temporal entre o fato gerador e o recolhimento.

> 🛡️ Esta POC demonstra que, com verificação criptográfica, **a adulteração dos dados fiscais entre a autorização da nota fiscal e a liquidação do pagamento é tecnicamente impossível**.

---

<a id="arquitetura"></a>
##  Arquitetura

**Separação de responsabilidades:**
- O **Oráculo Fiscal** (SEFAZ/RFB) calcula os tributos *off-chain* e assina digitalmente o pacote de dados.
- O **Contrato Inteligente** apenas verifica a assinatura e executa a distribuição atômica.
- Isso evita armazenar tabelas de alíquotas *on-chain* (inviável computacionalmente e financeiramente).

![Arquitetura do Split Payment](https://mermaid.ink/img/Z3JhcGggVEQKICAgIHN1YmdyYXBoIE9mZi1DaGFpbgogICAgICAgIFNFRkFaW1NFRkFaIC8gUkZCIDxici8+IE9yw6FjdWxvIEZpc2NhbF0KICAgICAgICBDT01QUkFET1JbQ29tcHJhZG9yXQogICAgZW5kCgogICAgc3ViZ3JhcGggT24tQ2hhaW4gW0xpcXVpZGHDp8OjbyBBdMO0bWljYV0KICAgICAgICBTQ1tDb250cmF0byBJbnRlbGlnZW50ZSA8YnIvPiBTcGxpdFBheW1lbnRCcmFzaWwuc29sXQogICAgZW5kCgogICAgc3ViZ3JhcGggQmVuZWZpY2lhcmlvcyBbRGVzdGlubyBkb3MgUmVjdXJzb3NdCiAgICAgICAgVkVORFtWRU5ERURPUiA8YnIvPiBWYWxvciBMw61xdWlkb10KICAgICAgICBVTklbVU5Jw4NPIDxici8+IENCU10KICAgICAgICBFU1RbRVNUQURPIDxici8+IElCUy1FXQogICAgICAgIE1VTltNVU5JQ8ONUElPIDxici8+IElCUy1NXQogICAgZW5kCgogICAgU0VGQVogLS0gMS4gQ2FsY3VsYSB0cmlidXRvcyBlIEFzc2luYSAoRUNEU0EpIC0tPiBDT01QUkFET1IKICAgIENPTVBSQURPUiAtLSAyLiBQYWdhIEJydXRvICsgQXNzaW5hdHVyYSAtLT4gU0MKICAgIFNDIC0tIDMuIFZlcmlmaWNhIEFzc2luYXR1cmEgZSBEaXZpZGUgLS0+IFZFTkQKICAgIFNDIC0tPiBVTkkKICAgIFNDIC0tPiBFU1QKICAgIFNDIC0tPiBNVU4KCiAgICBzdHlsZSBTRUZBWiBmaWxsOiNmOWYsc3Ryb2tlOiMzMzMsc3Ryb2tlLXdpZHRoOjJweAogICAgc3R5bGUgU0MgZmlsbDojYmJmLHN0cm9rZTojMzMzLHN0cm9rZS13aWR0aDoycHgKICAgIHN0eWxlIFZFTkQgZmlsbDojZGZkLHN0cm9rZTojMzMzLHN0cm9rZS13aWR0aDoycHg)


---

##  Modalidades Implementadas

### 1. Split Padrão (Art. 32, LC 214/2025)
Liquidação atômica com consulta em tempo real ao sistema fiscal. O contrato executa **4 transferências simultâneas** (Vendedor + CBS + IBS Estadual + IBS Municipal) com cruzamento de débitos e créditos tributários.

### 2. Split Simplificado (Art. 33, LC 214/2025)
Modalidade para operações B2C com alíquota fixa. Executa **2 transferências** (Vendedor + Conta de Conciliação), com repartição federativa *a posteriori* pelo Comitê Gestor.

---

<a id="resultados"></a>
## 📊 Resultados

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

### Métricas de Performance

| Modalidade | Gas Consumido | Transferências | Verificações |
|:---|:---:|:---:|:---|
| **Split Padrão (Art. 32)** | `168.713` | 4 | ECDSA + Idempotência + Créditos |
| **Split Simplificado (Art. 33)** | `114.268` | 2 | ECDSA + Idempotência |
| *Transferência ERC-20 (Ref)* | `~65.000` | 1 | Nenhuma |

> ⚡ O Split Simplificado é **32,3% mais eficiente** que o Padrão, o que é relevante para escalabilidade em operações B2C de alto volume.

### Demonstração Interativa — Liquidação Atômica

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
Resultado:          TRANSAÇÃO REJEITADA ❌
Conclusão:          Sonegação por adulteração = IMPOSSÍVEL
```

---

##  O que este projeto prova

| Propriedade | Como é garantida | Teste Ref. |
|---|---|:---:|
| **Atomicidade** | Todas as transferências ocorrem na mesma transação ou nenhuma ocorre | 2.1 |
| **Integridade fiscal** | Verificação ECDSA impede adulteração de qualquer valor | 5.1, 5.2 |
| **Idempotência** | Hash da NF-e é registrado; dupla liquidação é impossível | 6.1 |
| **Autorização** | Apenas oráculos com `FISCAL_ORACLE_ROLE` podem assinar | 7.1 |
| **Compensação** | Créditos acumulados reduzem tributo líquido proporcionalmente | 3.1 |
| **Repartição** | CBS, IBS-E e IBS-M recebem frações exatas da lei | 2.1 |
| **Rastreabilidade** | Eventos imutáveis com 9 parâmetros para auditoria completa | 2.2 |

---

##  Contexto: Por que não Hyperledger Besu / DREX?

Em **novembro de 2025**, o Banco Central do Brasil desativou a plataforma DREX baseada em Hyperledger Besu após 4 anos de testes, considerando-a inadequada aos requisitos de privacidade e segurança para este caso de uso específico. A fase 3 do projeto (2026) adotará abordagem "agnóstica quanto à tecnologia".

Esta POC é deliberadamente **independente de infraestrutura**. A lógica de liquidação atômica aqui demonstrada pode ser transposta para:
*   Redes blockchain permissionadas (Corda, Fabric, ou futura plataforma do BCB).
*   APIs REST com assinatura digital e banco de dados *append-only*.
*   Camadas sobre o Pix com verificação criptográfica adicional.

---

## 📂 Estrutura do Projeto

```ascii
split-payment-poc/
│
├── contracts/
│   └── SplitPaymentBrasil.sol   # Lógica do Split Padrão (Art. 32) e Simplificado (Art. 33)
│
├── test/
│   └── SplitPaymentBrasil.test.js # 13 testes unitários (Hardhat + Chai)
│
├── scripts/
│   └── demo.js                  # Demonstração interativa (Deploy -> Transações -> Fraude)
│
├── oracle/
│   ├── fiscal_oracle.py         # Oráculo Fiscal simulado (Python/ECDSA)
│   └── requirements.txt         # Dependências Python
│
├── hardhat.config.js            # Configuração do compilador Solidity
├── package.json                 # Dependências Node.js
└── README.md                    # Documentação
```

---

<a id="como-executar"></a>
##  Como Executar

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

Para testar a geração de assinaturas:
```bash
cd oracle
pip install -r requirements.txt
python fiscal_oracle.py
```

---

<a id="referência-legal"></a>
## ⚖️ Referência Legal

| Dispositivo | Conteúdo | Implementação na POC |
|---|---|---|
| **EC 132/2023** | Reforma Tributária — cria IBS e CBS | Contexto geral |
| **LC 214/2025, Art. 31** | Conceito do split payment | Arquitetura do contrato |
| **LC 214/2025, Art. 32** | Split Padrão (inteligente) | `executeStandardSplit()` |
| **LC 214/2025, Art. 33** | Split Simplificado | `executeSimplifiedSplit()` |
| **LC 214/2025, Art. 34** | Regras complementares (parcelamento) | *Não implementado (escopo futuro)* |

---

## 📚 Artigo Acadêmico

Esta POC é a base empírica do artigo:

> **"Liquidação Atômica para Split Payment Tributário: Uma Prova de Conceito com Contratos Inteligentes no Contexto da Reforma Tributária Brasileira (LC 214/2025)"**
>
> *Matheus Paixão Souza, [Coautor]*
>
> O artigo completo está disponível em [docs/split-payment-tributario.pdf](docs/split-payment-tributario.pdf).

---

##  Tecnologias

| Componente | Tecnologia | Versão |
|---|---|---|
| Contrato Inteligente | **Solidity** | 0.8.20 |
| Framework | **Hardhat** | 2.22+ |
| Interação Blockchain | **Ethers.js** | 6.x |
| Asserções | **Chai** | 4.x |
| Oráculo Fiscal | **Python + web3.py** | 3.9+ / 6.15 |
| Criptografia | **ECDSA (secp256k1)** | — |

---

## 📝 Licença

Este projeto está licenciado sob a **MIT License**.

*Desenvolvido como prova de conceito acadêmica — Fevereiro/2026*

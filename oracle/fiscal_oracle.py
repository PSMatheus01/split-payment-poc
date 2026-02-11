"""
============================================================================
ORÁCULO FISCAL SIMULADO — SEFAZ / RFB
============================================================================

Simula a autorização de NF-e com cálculo de split payment conforme
LC 214/2025 (Arts. 31-35).

Este módulo representa o "motor fiscal" que, em produção, seria operado
pela Receita Federal do Brasil e pelo Comitê Gestor do IBS.

Componentes:
  1. TaxEngine    — Motor de regras tributárias (alíquotas, setores, UFs)
  2. FiscalOracle — Assinador criptográfico (simula HSM + ICP-Brasil)
  3. CLI          — Interface de linha de comando para demonstração

Referência legal:
  - Art. 32 (Split Padrão): consulta em tempo real, cruzamento débito/crédito
  - Art. 33 (Split Simplificado): percentuais fixos para B2C
  - Art. 34 (Regras complementares): parcelamento, antecipação, responsabilidade
  - Art. 35 (Governança): cronograma e infraestrutura

Uso:
  python fiscal_oracle.py

Segurança em produção:
  - Chave privada em HSM (Hardware Security Module) com certificado ICP-Brasil
  - Multi-signature para transações acima de threshold configurável
  - Rotação periódica de chaves com revogação on-chain
  - Auditoria de todas as assinaturas emitidas

Autores: Matheus Paixão Souza et al.
Data: Fevereiro/2026
============================================================================
"""

from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
from dataclasses import dataclass, field
from typing import Optional, Dict, Tuple
from datetime import datetime
import secrets
import json
import sys


# ============================================================================
# 1. MOTOR DE REGRAS TRIBUTÁRIAS (TaxEngine)
# ============================================================================

class TaxEngine:
    """
    Motor de regras tributárias simplificado.
    
    Em produção, este componente consultaria:
    - Tabela de NCM (Nomenclatura Comum do Mercosul) para alíquotas por produto
    - CFOP (Código Fiscal de Operações) para tipo de operação
    - Alíquotas específicas por UF de destino e município de destino
    - Regimes especiais (Simples Nacional, ZFM, REPORTO, etc.)
    - Reduções de alíquota por setor (saúde, educação, cesta básica)
    - Imunidades e isenções constitucionais
    
    Para a POC, utiliza alíquotas de referência estimadas.
    """

    # Alíquotas de referência (valores ilustrativos)
    # A alíquota combinada IBS+CBS está estimada em ~26.5% pela RFB
    DEFAULT_RATES = {
        "CBS": 0.0865,           # ~8.65% (federal - Contribuição sobre Bens e Serviços)
        "IBS_ESTADO": 0.1115,    # ~11.15% (estadual)
        "IBS_MUNICIPIO": 0.0470, # ~4.70% (municipal)
    }

    # Alíquotas diferenciadas por setor (Art. 278 e seguintes, LC 214/2025)
    SECTOR_RATES = {
        "PADRAO": {"CBS": 0.0865, "IBS_ESTADO": 0.1115, "IBS_MUNICIPIO": 0.0470},
        "SAUDE": {"CBS": 0.0433, "IBS_ESTADO": 0.0558, "IBS_MUNICIPIO": 0.0235},
        "EDUCACAO": {"CBS": 0.0433, "IBS_ESTADO": 0.0558, "IBS_MUNICIPIO": 0.0235},
        "TRANSPORTE_COLETIVO": {"CBS": 0.0433, "IBS_ESTADO": 0.0558, "IBS_MUNICIPIO": 0.0235},
        "CESTA_BASICA": {"CBS": 0.0, "IBS_ESTADO": 0.0, "IBS_MUNICIPIO": 0.0},
        "COMBUSTIVEIS": {"CBS": 0.0865, "IBS_ESTADO": 0.1115, "IBS_MUNICIPIO": 0.0470},
    }

    # Alíquotas simplificadas por setor (Art. 33 - basis points)
    SIMPLIFIED_RATES_BPS = {
        "PADRAO": 2650,
        "SAUDE": 1325,
        "EDUCACAO": 1325,
        "TRANSPORTE_COLETIVO": 1325,
        "CESTA_BASICA": 0,
        "COMBUSTIVEIS": 2650,
    }

    @classmethod
    def calculate_standard(
        cls,
        gross_amount_wei: int,
        sector: str = "PADRAO",
        seller_credits_wei: int = 0
    ) -> Dict:
        """
        Calcula tributos para o Split Padrão (Art. 32).
        
        Retorna dicionário com todas as parcelas e o crédito a compensar.
        """
        rates = cls.SECTOR_RATES.get(sector, cls.SECTOR_RATES["PADRAO"])

        cbs_amount = int(gross_amount_wei * rates["CBS"])
        ibs_state_amount = int(gross_amount_wei * rates["IBS_ESTADO"])
        ibs_city_amount = int(gross_amount_wei * rates["IBS_MUNICIPIO"])
        total_tax = cbs_amount + ibs_state_amount + ibs_city_amount

        # Compensação de créditos (Art. 32, §2º)
        credit_offset = min(seller_credits_wei, total_tax)
        net_tax = total_tax - credit_offset
        net_to_seller = gross_amount_wei - net_tax

        return {
            "gross_amount": gross_amount_wei,
            "cbs_amount": cbs_amount,
            "ibs_state_amount": ibs_state_amount,
            "ibs_city_amount": ibs_city_amount,
            "total_tax": total_tax,
            "credit_offset": credit_offset,
            "net_tax": net_tax,
            "net_to_seller": net_to_seller,
            "effective_rate": total_tax / gross_amount_wei if gross_amount_wei > 0 else 0,
            "sector": sector,
        }

    @classmethod
    def calculate_simplified(
        cls,
        gross_amount_wei: int,
        sector: str = "PADRAO"
    ) -> Dict:
        """
        Calcula tributos para o Split Simplificado (Art. 33).
        """
        rate_bps = cls.SIMPLIFIED_RATES_BPS.get(sector, 2650)
        tax_amount = int(gross_amount_wei * rate_bps / 10000)
        net_to_seller = gross_amount_wei - tax_amount

        return {
            "gross_amount": gross_amount_wei,
            "rate_bps": rate_bps,
            "tax_amount": tax_amount,
            "net_to_seller": net_to_seller,
            "effective_rate": rate_bps / 10000,
            "sector": sector,
        }


# ============================================================================
# 2. ASSINADOR CRIPTOGRÁFICO (FiscalOracle)
# ============================================================================

@dataclass
class SignedInvoice:
    """Resultado da assinatura de uma NF-e pelo oráculo fiscal."""
    invoice_id: str
    seller: str
    gross_amount: int
    cbs_amount: int
    ibs_state_amount: int
    ibs_city_amount: int
    credit_offset: int
    signature: str
    signer_address: str
    timestamp: str
    mode: str  # "STANDARD" ou "SIMPLIFIED"
    # Campos extras para simplificado
    rate_bps: int = 0


class FiscalOracle:
    """
    Oráculo Fiscal — Simula a SEFAZ/RFB.
    
    Responsável por:
    1. Receber dados de uma transação comercial
    2. Calcular os tributos via TaxEngine
    3. Assinar digitalmente o pacote de dados
    4. Retornar a assinatura para submissão ao contrato inteligente
    
    Em produção:
    - Chave privada armazenada em HSM (Hardware Security Module)
    - Certificado digital ICP-Brasil vinculado à autoridade fazendária
    - Log de auditoria de todas as assinaturas emitidas
    - Rate limiting e controle de acesso por certificado do solicitante
    """

    def __init__(self, private_key: Optional[str] = None):
        if private_key:
            self.private_key = private_key
        else:
            # Gera chave efêmera para testes
            self.private_key = "0x" + secrets.token_hex(32)

        self.account = Account.from_key(self.private_key)
        self.address = self.account.address
        self.signatures_issued = 0

    def authorize_standard(
        self,
        invoice_id: str,
        seller_address: str,
        gross_amount_wei: int,
        sector: str = "PADRAO",
        seller_credits_wei: int = 0
    ) -> SignedInvoice:
        """
        Autoriza uma transação com Split Padrão (Art. 32).
        """
        # 1. Cálculo tributário
        tax = TaxEngine.calculate_standard(gross_amount_wei, sector, seller_credits_wei)

        # 2. Empacotamento (DEVE espelhar _computeInvoiceHash do Solidity)
        message_hash = Web3.solidity_keccak(
            ['string', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
            [
                invoice_id,
                seller_address,
                gross_amount_wei,
                tax["cbs_amount"],
                tax["ibs_state_amount"],
                tax["ibs_city_amount"],
                tax["credit_offset"],
            ]
        )

        # 3. Assinatura EIP-191
        message = encode_defunct(hexstr=message_hash.hex())
        signed = self.account.sign_message(message)

        self.signatures_issued += 1

        return SignedInvoice(
            invoice_id=invoice_id,
            seller=seller_address,
            gross_amount=gross_amount_wei,
            cbs_amount=tax["cbs_amount"],
            ibs_state_amount=tax["ibs_state_amount"],
            ibs_city_amount=tax["ibs_city_amount"],
            credit_offset=tax["credit_offset"],
            signature="0x" + signed.signature.hex(),
            signer_address=self.address,
            timestamp=datetime.now().isoformat(),
            mode="STANDARD",
        )

    def authorize_simplified(
        self,
        invoice_id: str,
        seller_address: str,
        gross_amount_wei: int,
        sector: str = "PADRAO"
    ) -> SignedInvoice:
        """
        Autoriza uma transação com Split Simplificado (Art. 33).
        """
        tax = TaxEngine.calculate_simplified(gross_amount_wei, sector)

        message_hash = Web3.solidity_keccak(
            ['string', 'address', 'uint256', 'uint256', 'string'],
            [invoice_id, seller_address, gross_amount_wei, tax["rate_bps"], "SIMPLIFIED"]
        )

        message = encode_defunct(hexstr=message_hash.hex())
        signed = self.account.sign_message(message)

        self.signatures_issued += 1

        return SignedInvoice(
            invoice_id=invoice_id,
            seller=seller_address,
            gross_amount=gross_amount_wei,
            cbs_amount=0,
            ibs_state_amount=0,
            ibs_city_amount=0,
            credit_offset=0,
            signature="0x" + signed.signature.hex(),
            signer_address=self.address,
            timestamp=datetime.now().isoformat(),
            mode="SIMPLIFIED",
            rate_bps=tax["rate_bps"],
        )


# ============================================================================
# 3. FORMATAÇÃO E RELATÓRIO
# ============================================================================

def wei_to_brl(wei: int) -> str:
    """Converte wei para formato monetário BRL."""
    value = wei / (10 ** 18)
    return f"R$ {value:,.2f}"


def print_header():
    print()
    print("=" * 70)
    print("  ORÁCULO FISCAL SIMULADO — SEFAZ / RFB")
    print("  Split Payment Tributário — LC 214/2025")
    print("  Prova de Conceito — Fevereiro/2026")
    print("=" * 70)


def print_standard_report(result: SignedInvoice, tax_details: Dict):
    print()
    print("-" * 70)
    print(f"  AUTORIZAÇÃO DE SPLIT PADRÃO (Art. 32)")
    print("-" * 70)
    print(f"  NF-e:                {result.invoice_id}")
    print(f"  Vendedor:            {result.seller[:10]}...{result.seller[-8:]}")
    print(f"  Timestamp:           {result.timestamp}")
    print(f"  Setor:               {tax_details['sector']}")
    print()
    print(f"  Valor bruto:         {wei_to_brl(result.gross_amount)}")
    print(f"  ├─ CBS (União):      {wei_to_brl(result.cbs_amount)}")
    print(f"  ├─ IBS Estado:       {wei_to_brl(result.ibs_state_amount)}")
    print(f"  ├─ IBS Município:    {wei_to_brl(result.ibs_city_amount)}")
    total_tax = result.cbs_amount + result.ibs_state_amount + result.ibs_city_amount
    print(f"  ├─ Total tributo:    {wei_to_brl(total_tax)}")
    print(f"  ├─ Créditos comp.:   {wei_to_brl(result.credit_offset)}")
    net_tax = total_tax - result.credit_offset
    print(f"  ├─ Tributo líquido:  {wei_to_brl(net_tax)}")
    net_seller = result.gross_amount - net_tax
    print(f"  └─ Vendedor recebe:  {wei_to_brl(net_seller)}")
    print()
    print(f"  Alíquota efetiva:    {tax_details['effective_rate']*100:.2f}%")
    print(f"  Assinatura:          {result.signature[:20]}...{result.signature[-16:]}")
    print(f"  Oráculo:             {result.signer_address[:10]}...{result.signer_address[-8:]}")
    print("-" * 70)


def print_simplified_report(result: SignedInvoice, tax_details: Dict):
    print()
    print("-" * 70)
    print(f"  AUTORIZAÇÃO DE SPLIT SIMPLIFICADO (Art. 33)")
    print("-" * 70)
    print(f"  NF-e:                {result.invoice_id}")
    print(f"  Vendedor:            {result.seller[:10]}...{result.seller[-8:]}")
    print(f"  Timestamp:           {result.timestamp}")
    print(f"  Setor:               {tax_details['sector']}")
    print()
    print(f"  Valor bruto:         {wei_to_brl(result.gross_amount)}")
    print(f"  Alíquota fixa:       {result.rate_bps/100:.2f}%")
    print(f"  ├─ Tributo retido:   {wei_to_brl(tax_details['tax_amount'])}")
    print(f"  └─ Vendedor recebe:  {wei_to_brl(tax_details['net_to_seller'])}")
    print()
    print(f"  Destino tributo:     Conta de conciliação (repartição a posteriori)")
    print(f"  Assinatura:          {result.signature[:20]}...{result.signature[-16:]}")
    print(f"  Oráculo:             {result.signer_address[:10]}...{result.signer_address[-8:]}")
    print("-" * 70)


def print_fraud_demo(oracle: FiscalOracle):
    print()
    print("-" * 70)
    print("  DEMONSTRAÇÃO DE SEGURANÇA — TENTATIVA DE FRAUDE")
    print("-" * 70)
    print()
    print("  Cenário: Comprador tenta submeter ao contrato inteligente os")
    print("  mesmos dados, mas com CBS alterada de R$ 86,50 para R$ 0,00.")
    print()
    print("  O que acontece:")
    print("  1. O contrato recalcula o hash dos dados RECEBIDOS")
    print("  2. Compara com a assinatura do oráculo (dados ORIGINAIS)")
    print("  3. Hashes divergem → ECDSA.recover retorna endereço errado")
    print("  4. Endereço não tem FISCAL_ORACLE_ROLE → REVERT")
    print()
    print("  Resultado: Transação REJEITADA automaticamente.")
    print("  Mensagem:  'Assinatura fiscal invalida'")
    print()
    print("  Conclusão: Sonegação por inadimplência = tecnicamente impossível")
    print("-" * 70)


# ============================================================================
# 4. EXECUÇÃO PRINCIPAL (CLI)
# ============================================================================

def main():
    print_header()

    # Inicializa o oráculo
    oracle = FiscalOracle()
    print(f"\n  Oráculo inicializado: {oracle.address}")
    print(f"  (Registre este endereço no contrato via registerFiscalOracle)")

    # Endereço de vendedor simulado
    vendedor = "0x1234567890123456789012345678901234567890"

    # ── CENÁRIO 1: Split Padrão (B2B) — R$ 1.000,00 ──
    valor_1 = Web3.to_wei(1000, 'ether')
    tax_1 = TaxEngine.calculate_standard(valor_1, "PADRAO", seller_credits_wei=0)
    auth_1 = oracle.authorize_standard(
        invoice_id="NFe35260112345678000195550010000000011234567890",
        seller_address=vendedor,
        gross_amount_wei=valor_1,
        sector="PADRAO",
        seller_credits_wei=0,
    )
    print_standard_report(auth_1, tax_1)

    # ── CENÁRIO 2: Split Padrão com Créditos — R$ 1.000,00, R$ 50 créditos ──
    creditos = Web3.to_wei(50, 'ether')
    tax_2 = TaxEngine.calculate_standard(valor_1, "PADRAO", seller_credits_wei=creditos)
    auth_2 = oracle.authorize_standard(
        invoice_id="NFe35260112345678000195550010000000021234567890",
        seller_address=vendedor,
        gross_amount_wei=valor_1,
        sector="PADRAO",
        seller_credits_wei=creditos,
    )
    print_standard_report(auth_2, tax_2)

    # ── CENÁRIO 3: Split Padrão — Setor Saúde (alíquota reduzida) ──
    tax_3 = TaxEngine.calculate_standard(valor_1, "SAUDE")
    auth_3 = oracle.authorize_standard(
        invoice_id="NFe35260112345678000195550010000000031234567890",
        seller_address=vendedor,
        gross_amount_wei=valor_1,
        sector="SAUDE",
    )
    print_standard_report(auth_3, tax_3)

    # ── CENÁRIO 4: Split Simplificado (B2C) — Varejo R$ 200,00 ──
    valor_4 = Web3.to_wei(200, 'ether')
    tax_4 = TaxEngine.calculate_simplified(valor_4, "PADRAO")
    auth_4 = oracle.authorize_simplified(
        invoice_id="NFe35260112345678000195650010000000041234567890",
        seller_address=vendedor,
        gross_amount_wei=valor_4,
        sector="PADRAO",
    )
    print_simplified_report(auth_4, tax_4)

    # ── CENÁRIO 5: Split Simplificado — Cesta Básica (isento) ──
    tax_5 = TaxEngine.calculate_simplified(valor_4, "CESTA_BASICA")
    auth_5 = oracle.authorize_simplified(
        invoice_id="NFe35260112345678000195650010000000051234567890",
        seller_address=vendedor,
        gross_amount_wei=valor_4,
        sector="CESTA_BASICA",
    )
    print_simplified_report(auth_5, tax_5)

    # ── CENÁRIO 6: Demonstração de segurança ──
    print_fraud_demo(oracle)

    # ── RESUMO ──
    print()
    print("=" * 70)
    print(f"  RESUMO: {oracle.signatures_issued} autorizações emitidas pelo oráculo")
    print("=" * 70)
    print()


if __name__ == "__main__":
    main()

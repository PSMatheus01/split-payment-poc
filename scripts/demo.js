import pkg from "hardhat";
const { ethers } = pkg;

/**
 * ============================================================================
 * DEMONSTRAÇÃO INTERATIVA — Split Payment Tributário (LC 214/2025)
 * ============================================================================
 * 
 * Este script executa o fluxo completo:
 * 1. Deploy do contrato
 * 2. Configuração dos atores (comprador, vendedor, oráculo, cofres)
 * 3. Execução de transações com split padrão e simplificado
 * 4. Relatório de saldos e auditoria
 * 
 * Uso: npx hardhat run scripts/demo.js
 * ============================================================================
 */

// ── Utilidades ──

function formatBRL(wei) {
  const value = Number(ethers.formatEther(wei));
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function separator(char = "─", length = 70) {
  console.log(char.repeat(length));
}

function header(text) {
  console.log();
  separator("═");
  console.log(`  ${text}`);
  separator("═");
}

function subheader(text) {
  console.log();
  separator("─");
  console.log(`  ${text}`);
  separator("─");
}

// ── Funções de Assinatura (espelham o oráculo) ──

async function signStandardInvoice(signer, invoiceId, seller, gross, cbs, ibsState, ibsCity, creditOffset) {
  const hash = ethers.solidityPackedKeccak256(
    ["string", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [invoiceId, seller, gross, cbs, ibsState, ibsCity, creditOffset]
  );
  return await signer.signMessage(ethers.getBytes(hash));
}

async function signSimplifiedInvoice(signer, invoiceId, seller, gross, rateBps) {
  const hash = ethers.solidityPackedKeccak256(
    ["string", "address", "uint256", "uint256", "string"],
    [invoiceId, seller, gross, rateBps, "SIMPLIFIED"]
  );
  return await signer.signMessage(ethers.getBytes(hash));
}

function calculateTax(grossEth) {
  const gross = ethers.parseEther(grossEth);
  const cbs = (gross * 865n) / 10000n;
  const ibsState = (gross * 1115n) / 10000n;
  const ibsCity = (gross * 470n) / 10000n;
  const totalTax = cbs + ibsState + ibsCity;
  const net = gross - totalTax;
  return { gross, cbs, ibsState, ibsCity, totalTax, net };
}

// ── Função Principal ──

async function main() {

  header("SPLIT PAYMENT TRIBUTÁRIO — DEMONSTRAÇÃO COMPLETA");
  console.log("  Lei Complementar nº 214/2025 | Arts. 31-35");
  console.log("  Prova de Conceito — Fevereiro/2026");
  console.log();

  // 1. SETUP
  subheader("FASE 1: CONFIGURAÇÃO DOS ATORES");

  const [admin, buyer, seller, oracleSigner, , cbsWallet, ibsStateWallet, ibsCityWallet] = await ethers.getSigners();

  console.log(`  Admin (deploy):      ${admin.address.slice(0, 14)}...`);
  console.log(`  Comprador:           ${buyer.address.slice(0, 14)}...`);
  console.log(`  Vendedor:            ${seller.address.slice(0, 14)}...`);
  console.log(`  Oráculo Fiscal:      ${oracleSigner.address.slice(0, 14)}...`);
  console.log(`  Cofre CBS (União):   ${cbsWallet.address.slice(0, 14)}...`);
  console.log(`  Cofre IBS Estado:    ${ibsStateWallet.address.slice(0, 14)}...`);
  console.log(`  Cofre IBS Município: ${ibsCityWallet.address.slice(0, 14)}...`);

  // 2. DEPLOY
  subheader("FASE 2: DEPLOY DO CONTRATO");

  const Factory = await ethers.getContractFactory("SplitPaymentBrasil");
  const contract = await Factory.deploy(cbsWallet.address, ibsStateWallet.address, ibsCityWallet.address);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`  Contrato deployado:  ${contractAddress.slice(0, 14)}...`);
  console.log(`  Token:               Real Digital Simulado (BRLs)`);

  // Registra oráculo e distribui fundos
  await contract.registerFiscalOracle(oracleSigner.address);
  console.log(`  Oráculo registrado:  OK`);

  await contract.mintForTesting(buyer.address, ethers.parseEther("100000"));
  console.log(`  Saldo comprador:     ${formatBRL(ethers.parseEther("100000"))}`);

  // 3. TRANSAÇÃO 1: Split Padrão — R$ 1.000,00
  subheader("FASE 3: SPLIT PADRÃO (Art. 32) — Venda de R$ 1.000,00");

  const tax1 = calculateTax("1000");
  const invoiceId1 = "NFe35260112345678000195550010000000011234567890";

  console.log(`  NF-e: ${invoiceId1.slice(0, 20)}...`);
  console.log();
  console.log(`  Valor bruto:         ${formatBRL(tax1.gross)}`);
  console.log(`  CBS (União):         ${formatBRL(tax1.cbs)}`);
  console.log(`  IBS Estado:          ${formatBRL(tax1.ibsState)}`);
  console.log(`  IBS Município:       ${formatBRL(tax1.ibsCity)}`);
  console.log(`  Vendedor (líquido):  ${formatBRL(tax1.net)}`);

  // Saldos ANTES
  const sellerBefore = await contract.balanceOf(seller.address);
  const cbsBefore = await contract.balanceOf(cbsWallet.address);
  const ibsSBefore = await contract.balanceOf(ibsStateWallet.address);
  const ibsCBefore = await contract.balanceOf(ibsCityWallet.address);

  // Assinatura e execução
  const sig1 = await signStandardInvoice(
    oracleSigner, invoiceId1, seller.address,
    tax1.gross, tax1.cbs, tax1.ibsState, tax1.ibsCity, 0n
  );

  const tx1 = await contract.connect(buyer).executeStandardSplit(
    {
      invoiceId: invoiceId1,
      seller: seller.address,
      grossAmount: tax1.gross,
      cbsAmount: tax1.cbs,
      ibsStateAmount: tax1.ibsState,
      ibsCityAmount: tax1.ibsCity,
      creditOffset: 0n,
    },
    sig1
  );
  const receipt1 = await tx1.wait();

  // Saldos DEPOIS
  const sellerAfter = await contract.balanceOf(seller.address);
  const cbsAfter = await contract.balanceOf(cbsWallet.address);
  const ibsSAfter = await contract.balanceOf(ibsStateWallet.address);
  const ibsCAfter = await contract.balanceOf(ibsCityWallet.address);

  console.log();
  console.log("  Resultado da liquidação atômica:");
  console.log(`  ├─ Vendedor:     +${formatBRL(sellerAfter - sellerBefore)}`);
  console.log(`  ├─ CBS (União):  +${formatBRL(cbsAfter - cbsBefore)}`);
  console.log(`  ├─ IBS Estado:   +${formatBRL(ibsSAfter - ibsSBefore)}`);
  console.log(`  ├─ IBS Munic.:   +${formatBRL(ibsCAfter - ibsCBefore)}`);
  const totalDist = (sellerAfter - sellerBefore) + (cbsAfter - cbsBefore) + (ibsSAfter - ibsSBefore) + (ibsCAfter - ibsCBefore);
  console.log(`  └─ TOTAL:         ${formatBRL(totalDist)} (= valor bruto)`);
  console.log();
  console.log(`  Gas consumido:   ${receipt1.gasUsed.toString()}`);
  console.log(`  Status:          SUCESSO`);

  // 4. TRANSAÇÃO 2: Split Simplificado — R$ 200,00
  subheader("FASE 4: SPLIT SIMPLIFICADO (Art. 33) — Venda B2C de R$ 200,00");

  const gross2 = ethers.parseEther("200");
  const rateBps = 2650n;
  const expectedTax2 = (gross2 * rateBps) / 10000n;
  const invoiceId2 = "NFe35260112345678000195650010000000021234567890";

  console.log(`  NF-e: ${invoiceId2.slice(0, 20)}...`);
  console.log();
  console.log(`  Valor bruto:         ${formatBRL(gross2)}`);
  console.log(`  Alíquota fixa:       26.50%`);
  console.log(`  Tributo estimado:    ${formatBRL(expectedTax2)}`);

  const sig2 = await signSimplifiedInvoice(oracleSigner, invoiceId2, seller.address, gross2, rateBps);

  const tx2 = await contract.connect(buyer).executeSimplifiedSplit(
    seller.address, gross2, rateBps, invoiceId2, sig2
  );
  const receipt2 = await tx2.wait();

  console.log();
  console.log(`  Gas consumido:   ${receipt2.gasUsed.toString()}`);
  console.log(`  Status:          SUCESSO`);

  // 5. TENTATIVA DE FRAUDE
  subheader("FASE 5: TENTATIVA DE FRAUDE — Adulteração do CBS");

  const tax3 = calculateTax("500");
  const invoiceId3 = "NFe35260112345678000195550010000000031234567890";

  const sig3 = await signStandardInvoice(
    oracleSigner, invoiceId3, seller.address,
    tax3.gross, tax3.cbs, tax3.ibsState, tax3.ibsCity, 0n
  );

  console.log(`  Dados originais: CBS = ${formatBRL(tax3.cbs)}`);
  console.log(`  Dados adulterados: CBS = R$ 0,00`);
  console.log();

  try {
    await contract.connect(buyer).executeStandardSplit(
      {
        invoiceId: invoiceId3,
        seller: seller.address,
        grossAmount: tax3.gross,
        cbsAmount: 0n,  // FRAUDE
        ibsStateAmount: tax3.ibsState,
        ibsCityAmount: tax3.ibsCity,
        creditOffset: 0n,
      },
      sig3
    );
    console.log("  ERRO: Transação deveria ter falhado!");
  } catch (error) {
    console.log(`  Resultado:       TRANSAÇÃO REJEITADA`);
    console.log(`  Motivo:          Assinatura fiscal invalida`);
    console.log(`  Conclusão:       Sonegação por adulteração = IMPOSSÍVEL`);
  }

  // 6. SALDOS FINAIS
  subheader("FASE 6: SALDOS FINAIS");

  const finalBuyer = await contract.balanceOf(buyer.address);
  const finalSeller = await contract.balanceOf(seller.address);
  const finalCbs = await contract.balanceOf(cbsWallet.address);
  const finalIbsS = await contract.balanceOf(ibsStateWallet.address);
  const finalIbsC = await contract.balanceOf(ibsCityWallet.address);

  console.log(`  Comprador:           ${formatBRL(finalBuyer)}`);
  console.log(`  Vendedor:            ${formatBRL(finalSeller)}`);
  console.log(`  CBS (União):         ${formatBRL(finalCbs)}`);
  console.log(`  IBS Estado:          ${formatBRL(finalIbsS)}`);
  console.log(`  IBS Município:       ${formatBRL(finalIbsC)}`);

  header("DEMONSTRAÇÃO CONCLUÍDA");
  console.log("  Todos os fluxos executados com sucesso.");
  console.log("  A sonegação por inadimplência é tecnicamente impossível");
  console.log("  nesta arquitetura de liquidação atômica.");
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

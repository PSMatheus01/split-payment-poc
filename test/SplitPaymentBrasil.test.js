import pkg from "hardhat";
const { ethers } = pkg;
import { expect } from "chai";


/**
 * SUITE DE TESTES — Split Payment Tributario (LC 214/2025)
 *
 * Cenarios testados:
 * 1. Deploy e configuracao inicial
 * 2. Split Padrao (Art. 32) — liquidacao atomica com reparticao federativa
 * 3. Split Padrao com compensacao de creditos tributarios
 * 4. Split Simplificado (Art. 33) — aliquota fixa B2C
 * 5. Rejeicao de fraude por adulteracao de dados
 * 6. Rejeicao de dupla liquidacao (idempotencia)
 * 7. Rejeicao de assinatura nao autorizada
 * 8. Metricas de gas (custo computacional)
 */

describe("SplitPaymentBrasil", function () {

  // --- VARIAVEIS GLOBAIS DO TESTE ---
  let contract;
  let admin, buyer, seller, oracleSigner, fakeSigner;
  let cbsWallet, ibsStateWallet, ibsCityWallet;

  /**
   * Funcao auxiliar: simula o oraculo fiscal (SEFAZ/RFB).
   * Calcula os tributos e assina o pacote de dados exatamente
   * como o contrato espera receber.
   */
  async function signInvoice(signer, invoiceId, sellerAddr, grossAmount, cbsAmt, ibsStateAmt, ibsCityAmt, creditOffset) {
    const messageHash = ethers.solidityPackedKeccak256(
      ["string", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [invoiceId, sellerAddr, grossAmount, cbsAmt, ibsStateAmt, ibsCityAmt, creditOffset]
    );
    const signature = await signer.signMessage(ethers.getBytes(messageHash));
    return signature;
  }

  /**
   * Funcao auxiliar para split simplificado.
   */
  async function signSimplifiedInvoice(signer, invoiceId, sellerAddr, grossAmount, rateBps) {
    const messageHash = ethers.solidityPackedKeccak256(
      ["string", "address", "uint256", "uint256", "string"],
      [invoiceId, sellerAddr, grossAmount, rateBps, "SIMPLIFIED"]
    );
    const signature = await signer.signMessage(ethers.getBytes(messageHash));
    return signature;
  }

  /**
   * Calcula os valores tributarios a partir do valor bruto.
   * Aliquotas: CBS 8.65%, IBS Estado 11.15%, IBS Municipio 4.70%
   * Total: 24.50% (simplificado para POC)
   */
  function calculateTax(grossAmountEth) {
    const gross = ethers.parseEther(grossAmountEth);
    const cbsAmt = (gross * 865n) / 10000n;
    const ibsStateAmt = (gross * 1115n) / 10000n;
    const ibsCityAmt = (gross * 470n) / 10000n;
    const totalTax = cbsAmt + ibsStateAmt + ibsCityAmt;
    const netToSeller = gross - totalTax;
    return { gross, cbsAmt, ibsStateAmt, ibsCityAmt, totalTax, netToSeller };
  }

  // ============================================================
  // SETUP: Executado antes de cada teste
  // ============================================================
  beforeEach(async function () {
    [admin, buyer, seller, oracleSigner, fakeSigner, cbsWallet, ibsStateWallet, ibsCityWallet] = await ethers.getSigners();

    const SplitPayment = await ethers.getContractFactory("SplitPaymentBrasil");
    contract = await SplitPayment.deploy(
      cbsWallet.address,
      ibsStateWallet.address,
      ibsCityWallet.address
    );
    await contract.waitForDeployment();

    await contract.registerFiscalOracle(oracleSigner.address);

    const buyerFunds = ethers.parseEther("100000");
    await contract.mintForTesting(buyer.address, buyerFunds);
  });

  // ============================================================
  // TESTE 1: Deploy e Configuracao
  // ============================================================
  describe("1. Deploy e Configuracao", function () {

    it("Deve fazer deploy com os enderecos corretos dos cofres publicos", async function () {
      expect(await contract.cbsWallet()).to.equal(cbsWallet.address);
      expect(await contract.ibsStateWallet()).to.equal(ibsStateWallet.address);
      expect(await contract.ibsCityWallet()).to.equal(ibsCityWallet.address);
    });

    it("Deve registrar o oraculo fiscal com a role correta", async function () {
      const FISCAL_ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FISCAL_ORACLE_ROLE"));
      expect(await contract.hasRole(FISCAL_ORACLE_ROLE, oracleSigner.address)).to.be.true;
    });

    it("Deve ter distribuido saldo ao comprador", async function () {
      const balance = await contract.balanceOf(buyer.address);
      expect(balance).to.equal(ethers.parseEther("100000"));
    });
  });

  // ============================================================
  // TESTE 2: Split Padrao (Art. 32) — Sem Creditos
  // ============================================================
  describe("2. Split Padrao — Art. 32, LC 214/2025", function () {

    it("Deve executar liquidacao atomica com reparticao federativa correta", async function () {
      const invoiceId = "NFe35260112345678000195550010000000011234567890";
      const tax = calculateTax("1000");
      const creditOffset = 0n;

      const signature = await signInvoice(
        oracleSigner, invoiceId, seller.address,
        tax.gross, tax.cbsAmt, tax.ibsStateAmt, tax.ibsCityAmt, creditOffset
      );

      const sellerBefore = await contract.balanceOf(seller.address);
      const cbsBefore = await contract.balanceOf(cbsWallet.address);
      const ibsStateBefore = await contract.balanceOf(ibsStateWallet.address);
      const ibsCityBefore = await contract.balanceOf(ibsCityWallet.address);

      const txData = {
        invoiceId: invoiceId,
        seller: seller.address,
        grossAmount: tax.gross,
        cbsAmount: tax.cbsAmt,
        ibsStateAmount: tax.ibsStateAmt,
        ibsCityAmount: tax.ibsCityAmt,
        creditOffset: creditOffset
      };

      await contract.connect(buyer).executeStandardSplit(txData, signature);

      const sellerAfter = await contract.balanceOf(seller.address);
      const cbsAfter = await contract.balanceOf(cbsWallet.address);
      const ibsStateAfter = await contract.balanceOf(ibsStateWallet.address);
      const ibsCityAfter = await contract.balanceOf(ibsCityWallet.address);

      expect(sellerAfter - sellerBefore).to.equal(tax.netToSeller);
      expect(cbsAfter - cbsBefore).to.equal(tax.cbsAmt);
      expect(ibsStateAfter - ibsStateBefore).to.equal(tax.ibsStateAmt);
      expect(ibsCityAfter - ibsCityBefore).to.equal(tax.ibsCityAmt);

      // Verifica que a soma bate com o valor bruto
      const totalDistributed = (sellerAfter - sellerBefore)
        + (cbsAfter - cbsBefore)
        + (ibsStateAfter - ibsStateBefore)
        + (ibsCityAfter - ibsCityBefore);
      expect(totalDistributed).to.equal(tax.gross);
    });

    it("Deve emitir evento SplitPaymentExecuted com dados corretos", async function () {
      const invoiceId = "NFe35260112345678000195550010000000021234567890";
      const tax = calculateTax("500");
      const creditOffset = 0n;

      const signature = await signInvoice(
        oracleSigner, invoiceId, seller.address,
        tax.gross, tax.cbsAmt, tax.ibsStateAmt, tax.ibsCityAmt, creditOffset
      );

      const txData = {
        invoiceId: invoiceId,
        seller: seller.address,
        grossAmount: tax.gross,
        cbsAmount: tax.cbsAmt,
        ibsStateAmount: tax.ibsStateAmt,
        ibsCityAmount: tax.ibsCityAmt,
        creditOffset: creditOffset
      };

      await expect(contract.connect(buyer).executeStandardSplit(txData, signature))
        .to.emit(contract, "SplitPaymentExecuted");
    });
  });

  // ============================================================
  // TESTE 3: Split Padrao com Compensacao de Creditos
  // ============================================================
  describe("3. Split Padrao com Creditos Tributarios", function () {

    it("Deve compensar creditos e reter apenas tributo liquido", async function () {
      const invoiceId = "NFe35260112345678000195550010000000031234567890";
      const tax = calculateTax("1000");
      const creditAmount = ethers.parseEther("50");

      // Oraculo registra creditos para o vendedor
      await contract.connect(oracleSigner).registerTaxCredit(seller.address, creditAmount);

      expect(await contract.taxCredits(seller.address)).to.equal(creditAmount);

      // Credito nao pode exceder o tributo total
      const creditOffset = creditAmount < tax.totalTax ? creditAmount : tax.totalTax;

      const signature = await signInvoice(
        oracleSigner, invoiceId, seller.address,
        tax.gross, tax.cbsAmt, tax.ibsStateAmt, tax.ibsCityAmt, creditOffset
      );

      const buyerBefore = await contract.balanceOf(buyer.address);

      const txData = {
        invoiceId: invoiceId,
        seller: seller.address,
        grossAmount: tax.gross,
        cbsAmount: tax.cbsAmt,
        ibsStateAmount: tax.ibsStateAmt,
        ibsCityAmount: tax.ibsCityAmt,
        creditOffset: creditOffset
      };

      await contract.connect(buyer).executeStandardSplit(txData, signature);

      const buyerAfter = await contract.balanceOf(buyer.address);
      const buyerSpent = buyerBefore - buyerAfter;

      // O comprador paga o valor bruto total
      expect(buyerSpent).to.equal(tax.gross);

      // Os creditos do vendedor foram consumidos
      const remainingCredits = await contract.taxCredits(seller.address);
      expect(remainingCredits).to.equal(creditAmount - creditOffset);
    });
  });

  // ============================================================
  // TESTE 4: Split Simplificado (Art. 33) — B2C
  // ============================================================
  describe("4. Split Simplificado — Art. 33, LC 214/2025", function () {

    it("Deve aplicar aliquota fixa e enviar tributo a conta de conciliacao", async function () {
      const invoiceId = "NFe35260112345678000195650010000000041234567890";
      const grossAmount = ethers.parseEther("200");
      const rateBps = 2650n;
      const expectedTax = (grossAmount * rateBps) / 10000n;
      const expectedNet = grossAmount - expectedTax;

      const signature = await signSimplifiedInvoice(
        oracleSigner, invoiceId, seller.address, grossAmount, rateBps
      );

      const sellerBefore = await contract.balanceOf(seller.address);
      const cbsBefore = await contract.balanceOf(cbsWallet.address);

      await contract.connect(buyer).executeSimplifiedSplit(
        seller.address,
        grossAmount,
        rateBps,
        invoiceId,
        signature
      );

      const sellerAfter = await contract.balanceOf(seller.address);
      const cbsAfter = await contract.balanceOf(cbsWallet.address);

      expect(sellerAfter - sellerBefore).to.equal(expectedNet);
      expect(cbsAfter - cbsBefore).to.equal(expectedTax);
    });
  });

  // ============================================================
  // TESTE 5: Rejeicao de Fraude — Adulteracao de Dados
  // ============================================================
  describe("5. Seguranca — Rejeicao de Fraude", function () {

    it("Deve rejeitar transacao se o valor do imposto for adulterado", async function () {
      const invoiceId = "NFe35260112345678000195550010000000051234567890";
      const tax = calculateTax("1000");
      const creditOffset = 0n;

      const signature = await signInvoice(
        oracleSigner, invoiceId, seller.address,
        tax.gross, tax.cbsAmt, tax.ibsStateAmt, tax.ibsCityAmt, creditOffset
      );

      // Comprador tenta chamar com CBS = 0 (fraude)
      const txData = {
        invoiceId: invoiceId,
        seller: seller.address,
        grossAmount: tax.gross,
        cbsAmount: 0n,
        ibsStateAmount: tax.ibsStateAmt,
        ibsCityAmount: tax.ibsCityAmt,
        creditOffset: creditOffset
      };

      await expect(
        contract.connect(buyer).executeStandardSplit(txData, signature)
      ).to.be.revertedWith("Assinatura fiscal invalida");
    });

    it("Deve rejeitar transacao se o valor bruto for adulterado", async function () {
      const invoiceId = "NFe35260112345678000195550010000000061234567890";
      const tax = calculateTax("1000");
      const creditOffset = 0n;

      const signature = await signInvoice(
        oracleSigner, invoiceId, seller.address,
        tax.gross, tax.cbsAmt, tax.ibsStateAmt, tax.ibsCityAmt, creditOffset
      );

      const txData = {
        invoiceId: invoiceId,
        seller: seller.address,
        grossAmount: ethers.parseEther("500"),
        cbsAmount: tax.cbsAmt,
        ibsStateAmount: tax.ibsStateAmt,
        ibsCityAmount: tax.ibsCityAmt,
        creditOffset: creditOffset
      };

      await expect(
        contract.connect(buyer).executeStandardSplit(txData, signature)
      ).to.be.revertedWith("Assinatura fiscal invalida");
    });
  });

  // ============================================================
  // TESTE 6: Idempotencia — Dupla Liquidacao
  // ============================================================
  describe("6. Idempotencia — Rejeicao de Dupla Liquidacao", function () {

    it("Deve rejeitar tentativa de processar a mesma NF-e duas vezes", async function () {
      const invoiceId = "NFe35260112345678000195550010000000071234567890";
      const tax = calculateTax("1000");
      const creditOffset = 0n;

      const signature = await signInvoice(
        oracleSigner, invoiceId, seller.address,
        tax.gross, tax.cbsAmt, tax.ibsStateAmt, tax.ibsCityAmt, creditOffset
      );

      const txData = {
        invoiceId: invoiceId,
        seller: seller.address,
        grossAmount: tax.gross,
        cbsAmount: tax.cbsAmt,
        ibsStateAmount: tax.ibsStateAmt,
        ibsCityAmount: tax.ibsCityAmt,
        creditOffset: creditOffset
      };

      // Primeira execucao: sucesso
      await contract.connect(buyer).executeStandardSplit(txData, signature);

      // Segunda execucao: deve falhar
      await expect(
        contract.connect(buyer).executeStandardSplit(txData, signature)
      ).to.be.revertedWith("NF-e ja liquidada");
    });
  });

  // ============================================================
  // TESTE 7: Rejeicao de Assinatura Nao Autorizada
  // ============================================================
  describe("7. Seguranca — Assinatura Nao Autorizada", function () {

    it("Deve rejeitar transacao assinada por entidade nao registrada", async function () {
      const invoiceId = "NFe35260112345678000195550010000000081234567890";
      const tax = calculateTax("1000");
      const creditOffset = 0n;

      // fakeSigner assina (NAO tem FISCAL_ORACLE_ROLE)
      const signature = await signInvoice(
        fakeSigner, invoiceId, seller.address,
        tax.gross, tax.cbsAmt, tax.ibsStateAmt, tax.ibsCityAmt, creditOffset
      );

      const txData = {
        invoiceId: invoiceId,
        seller: seller.address,
        grossAmount: tax.gross,
        cbsAmount: tax.cbsAmt,
        ibsStateAmount: tax.ibsStateAmt,
        ibsCityAmount: tax.ibsCityAmt,
        creditOffset: creditOffset
      };

      await expect(
        contract.connect(buyer).executeStandardSplit(txData, signature)
      ).to.be.revertedWith("Assinatura fiscal invalida");
    });
  });

  // ============================================================
  // TESTE 8: Metricas de Gas (Custo Computacional)
  // ============================================================
  describe("8. Metricas de Performance", function () {

    it("Deve registrar custo de gas do Split Padrao", async function () {
      const invoiceId = "NFe35260112345678000195550010000000091234567890";
      const tax = calculateTax("1000");
      const creditOffset = 0n;

      const signature = await signInvoice(
        oracleSigner, invoiceId, seller.address,
        tax.gross, tax.cbsAmt, tax.ibsStateAmt, tax.ibsCityAmt, creditOffset
      );

      const txData = {
        invoiceId: invoiceId,
        seller: seller.address,
        grossAmount: tax.gross,
        cbsAmount: tax.cbsAmt,
        ibsStateAmount: tax.ibsStateAmt,
        ibsCityAmount: tax.ibsCityAmt,
        creditOffset: creditOffset
      };

      const tx = await contract.connect(buyer).executeStandardSplit(txData, signature);
      const receipt = await tx.wait();

      console.log("\n  +------------------------------------------+");
      console.log("  | GAS USADO (Split Padrao): " + receipt.gasUsed.toString().padStart(14) + " |");
      console.log("  +------------------------------------------+\n");

      expect(receipt.gasUsed).to.be.lessThan(500000n);
    });

    it("Deve registrar custo de gas do Split Simplificado", async function () {
      const invoiceId = "NFe35260112345678000195650010000000101234567890";
      const grossAmount = ethers.parseEther("200");
      const rateBps = 2650n;

      const signature = await signSimplifiedInvoice(
        oracleSigner, invoiceId, seller.address, grossAmount, rateBps
      );

      const tx = await contract.connect(buyer).executeSimplifiedSplit(
        seller.address,
        grossAmount,
        rateBps,
        invoiceId,
        signature
      );
      const receipt = await tx.wait();

      console.log("\n  +-----------------------------------------------+");
      console.log("  | GAS USADO (Split Simplificado): " + receipt.gasUsed.toString().padStart(14) + " |");
      console.log("  +-----------------------------------------------+\n");

      expect(receipt.gasUsed).to.be.lessThan(400000n);
    });
  });
});

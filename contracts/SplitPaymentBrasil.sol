// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SplitPaymentBrasil
 * @dev Prova de conceito para split payment tributario conforme LC 214/2025.
 *      Modela a liquidacao atomica com distribuicao federativa (CBS + IBS estadual + IBS municipal).
 *
 *      IMPORTANTE: Esta e uma abstracao academica. O DREX (Hyperledger Besu) foi descontinuado
 *      pelo BCB em nov/2025. Este contrato demonstra a LOGICA de liquidacao atomica,
 *      que e independente da infraestrutura subjacente.
 */
contract SplitPaymentBrasil is ERC20, AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant FISCAL_ORACLE_ROLE = keccak256("FISCAL_ORACLE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Enderecos dos cofres publicos (simulacao)
    address public cbsWallet;      // Conta da Uniao (CBS - Contribuicao sobre Bens e Servicos)
    address public ibsStateWallet; // Conta do Estado de destino (IBS estadual)
    address public ibsCityWallet;  // Conta do Municipio de destino (IBS municipal)

    // Controle de idempotencia: cada NF-e so pode ser liquidada uma vez
    mapping(bytes32 => bool) public processedInvoices;

    // Controle de creditos tributarios acumulados por contribuinte
    mapping(address => uint256) public taxCredits;

    /**
     * @dev Estrutura que espelha os dados assinados pelo Oraculo Fiscal (SEFAZ/RFB).
     *      Reflete a reparticao federativa prevista na LC 214/2025.
     */
    struct InvoiceTaxData {
        string invoiceId;        // Chave de acesso da NF-e (44 digitos)
        address seller;          // Fornecedor (destinatario do valor liquido)
        uint256 grossAmount;     // Valor bruto da transacao
        uint256 cbsAmount;       // Parcela da CBS (Uniao)
        uint256 ibsStateAmount;  // Parcela do IBS estadual
        uint256 ibsCityAmount;   // Parcela do IBS municipal
        uint256 creditOffset;    // Creditos tributarios a compensar (debito - credito = liquido)
    }

    event SplitPaymentExecuted(
        bytes32 indexed invoiceHash,
        address indexed payer,
        address indexed seller,
        uint256 netToSeller,
        uint256 cbsCollected,
        uint256 ibsStateCollected,
        uint256 ibsCityCollected,
        uint256 creditOffset,
        uint256 timestamp
    );

    event TaxCreditRegistered(
        address indexed contributor,
        uint256 amount,
        uint256 timestamp
    );

    constructor(
        address _cbsWallet,
        address _ibsStateWallet,
        address _ibsCityWallet
    ) ERC20("Real Digital Simulado", "BRLs") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        cbsWallet = _cbsWallet;
        ibsStateWallet = _ibsStateWallet;
        ibsCityWallet = _ibsCityWallet;

        // Mint para testes - simula liquidez no sistema
        _mint(msg.sender, 10_000_000 * 10 ** 18);
    }

    /**
     * @dev Registra uma autoridade fiscal (SEFAZ, RFB) como oraculo autorizado.
     *      Em producao, seria vinculado a certificados ICP-Brasil.
     */
    function registerFiscalOracle(address _oracle) external onlyRole(ADMIN_ROLE) {
        _grantRole(FISCAL_ORACLE_ROLE, _oracle);
    }

    /**
     * @dev Atualiza os enderecos dos cofres publicos.
     *      Necessario para modelar operacoes interestaduais (destino variavel).
     */
    function updateTreasuryWallets(
        address _cbs,
        address _ibsState,
        address _ibsCity
    ) external onlyRole(ADMIN_ROLE) {
        cbsWallet = _cbs;
        ibsStateWallet = _ibsState;
        ibsCityWallet = _ibsCity;
    }

    /**
     * @dev Registra creditos tributarios para um contribuinte.
     *      Na LC 214/2025, o split inteligente cruza debitos e creditos,
     *      retendo apenas o valor liquido.
     */
    function registerTaxCredit(address _contributor, uint256 _amount)
        external
        onlyRole(FISCAL_ORACLE_ROLE)
    {
        taxCredits[_contributor] += _amount;
        emit TaxCreditRegistered(_contributor, _amount, block.timestamp);
    }

    /**
     * @dev SPLIT PAYMENT PADRAO (Art. 32, LC 214/2025)
     *      Liquidacao atomica com distribuicao federativa e compensacao de creditos.
     *
     * @param data Estrutura com os dados fiscais da transacao
     * @param signature Assinatura ECDSA do oraculo fiscal sobre os dados
     *
     * FLUXO:
     * 1. Oraculo fiscal (SEFAZ) calcula aliquotas off-chain e assina o pacote
     * 2. Contrato verifica assinatura e idempotencia
     * 3. Compensa creditos tributarios do vendedor
     * 4. Executa transferencias atomicas:
     *    - Comprador -> Vendedor (valor liquido)
     *    - Comprador -> Uniao (CBS)
     *    - Comprador -> Estado destino (IBS estadual)
     *    - Comprador -> Municipio destino (IBS municipal)
     * 5. Emite evento para auditoria
     */
    function executeStandardSplit(
        InvoiceTaxData calldata data,
        bytes calldata signature
    ) external {
        // --- VALIDACOES ---
        uint256 totalTax = data.cbsAmount + data.ibsStateAmount + data.ibsCityAmount;
        require(totalTax <= data.grossAmount, "Tributo excede valor bruto");
        require(balanceOf(msg.sender) >= data.grossAmount, "Saldo insuficiente");
        require(data.creditOffset <= totalTax, "Compensacao excede tributo devido");

        // Idempotencia: impede dupla liquidacao da mesma NF-e
        bytes32 invoiceHash = _computeInvoiceHash(data);
        require(!processedInvoices[invoiceHash], "NF-e ja liquidada");

        // --- VERIFICACAO CRIPTOGRAFICA DO ORACULO ---
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(invoiceHash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(hasRole(FISCAL_ORACLE_ROLE, signer), "Assinatura fiscal invalida");

        // --- COMPENSACAO DE CREDITOS (Art. 32, par. 2) ---
        uint256 netTax = totalTax - data.creditOffset;
        if (data.creditOffset > 0) {
            require(taxCredits[data.seller] >= data.creditOffset, "Creditos insuficientes");
            taxCredits[data.seller] -= data.creditOffset;
        }

        // --- REPARTICAO PROPORCIONAL DO IMPOSTO LIQUIDO ---
        uint256 netCbs;
        uint256 netIbsState;
        uint256 netIbsCity;

        if (netTax > 0 && totalTax > 0) {
            netCbs = (netTax * data.cbsAmount) / totalTax;
            netIbsState = (netTax * data.ibsStateAmount) / totalTax;
            netIbsCity = netTax - netCbs - netIbsState; // Evita erro de arredondamento
        }

        uint256 netToSeller = data.grossAmount - netTax;

        // --- LIQUIDACAO ATOMICA ---
        processedInvoices[invoiceHash] = true;

        _transfer(msg.sender, data.seller, netToSeller);

        if (netCbs > 0) _transfer(msg.sender, cbsWallet, netCbs);
        if (netIbsState > 0) _transfer(msg.sender, ibsStateWallet, netIbsState);
        if (netIbsCity > 0) _transfer(msg.sender, ibsCityWallet, netIbsCity);

        emit SplitPaymentExecuted(
            invoiceHash,
            msg.sender,
            data.seller,
            netToSeller,
            netCbs,
            netIbsState,
            netIbsCity,
            data.creditOffset,
            block.timestamp
        );
    }

    /**
     * @dev SPLIT PAYMENT SIMPLIFICADO (Art. 33, LC 214/2025)
     *      Usa percentuais fixos quando nao ha consulta em tempo real.
     *      Aplicavel a operacoes B2C (adquirente nao contribuinte).
     *
     * @param seller Endereco do vendedor
     * @param grossAmount Valor bruto da venda
     * @param simplifiedRate Aliquota simplificada (em basis points, ex: 2650 = 26.50%)
     * @param invoiceId Identificador da NF-e
     * @param signature Assinatura do oraculo fiscal
     */
    function executeSimplifiedSplit(
        address seller,
        uint256 grossAmount,
        uint256 simplifiedRate,
        string calldata invoiceId,
        bytes calldata signature
    ) external {
        require(simplifiedRate <= 10000, "Aliquota invalida");
        require(balanceOf(msg.sender) >= grossAmount, "Saldo insuficiente");

        bytes32 invoiceHash = keccak256(
            abi.encodePacked(invoiceId, seller, grossAmount, simplifiedRate, "SIMPLIFIED")
        );
        require(!processedInvoices[invoiceHash], "NF-e ja liquidada");

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(invoiceHash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(hasRole(FISCAL_ORACLE_ROLE, signer), "Assinatura fiscal invalida");

        uint256 totalTax = (grossAmount * simplifiedRate) / 10000;
        uint256 netToSeller = grossAmount - totalTax;

        // No simplificado, todo o tributo vai para conta unica de conciliacao
        // O Comite Gestor faz a reparticao federativa a posteriori
        processedInvoices[invoiceHash] = true;

        _transfer(msg.sender, seller, netToSeller);
        _transfer(msg.sender, cbsWallet, totalTax);

        emit SplitPaymentExecuted(
            invoiceHash,
            msg.sender,
            seller,
            netToSeller,
            totalTax,
            0,
            0,
            0,
            block.timestamp
        );
    }

    /**
     * @dev Computa o hash da NF-e para verificacao de assinatura.
     *      A ordem e os tipos devem ser IDENTICOS aos usados pelo oraculo off-chain.
     */
    function _computeInvoiceHash(InvoiceTaxData calldata data)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(
            data.invoiceId,
            data.seller,
            data.grossAmount,
            data.cbsAmount,
            data.ibsStateAmount,
            data.ibsCityAmount,
            data.creditOffset
        ));
    }

    // --- FUNCOES AUXILIARES PARA TESTES ---

    function mintForTesting(address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        _mint(to, amount);
    }

    function getInvoiceHash(InvoiceTaxData calldata data) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            data.invoiceId,
            data.seller,
            data.grossAmount,
            data.cbsAmount,
            data.ibsStateAmount,
            data.ibsCityAmount,
            data.creditOffset
        ));
    }
}
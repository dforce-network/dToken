const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const TOTAL_PROPORTION = 1000000n;
const DEFAULT_DTOKEN = '0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8';
const ETH_CHAIN_ID = '0x1';
const BSC_CHAIN_ID = '0x38';
const WALLET_REMEMBER_KEY = 'dtoken-dashboard-wallet-remembered';
const SIDE_MENU_COLLAPSED_KEY = 'dtoken-dashboard-side-menu-collapsed';

const HANDLER_NAMES = {
    '0x885dd179c76ee5949b9053f1958ba3a91e4cf592': 'Internal',
    '0xbcdd2a069a46e9b5d032d2f99725418508ce6aee': 'Compound',
    '0xbb7d75be4dc8eb15ff90422137c0a5bcbd316953': 'Aave',
    '0x8916a9b0064feab04b3bf3729adbb0be119ed12d': 'USR',
    '0xe3412d2751f6cfa117a4c5eb71e84aa63a5ee5ff': 'dForce',
    '0xc46751e2494897eb34e2297beb649672dbabf975': 'Internal',
    '0xde399d88ea8331fe2f18306793893a46d142cc5f': 'Cream'
};

const DTOKEN_ABI = [
    { name: 'token', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
    { name: 'dispatcher', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
    { name: 'authority', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
    { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
    { name: 'getBaseData', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ name: 'decimals', type: 'uint256' }, { name: 'exchangeRate', type: 'uint256' }, { name: 'mintFeeRate', type: 'uint256' }, { name: 'redeemFeeRate', type: 'uint256' }, { name: 'totalUnderlying', type: 'uint256' }] },
    { name: 'getHandlerInfo', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ name: 'handlers', type: 'address[]' }, { name: 'balances', type: 'uint256[]' }, { name: 'liquidities', type: 'uint256[]' }] },
    {
        name: 'rebalance',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_withdraw', type: 'address[]' },
            { name: '_withdrawAmount', type: 'uint256[]' },
            { name: '_deposit', type: 'address[]' },
            { name: '_depositAmount', type: 'uint256[]' }
        ],
        outputs: []
    }
];

const DISPATCHER_ABI = [
    { name: 'getHandlers', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: 'handlers', type: 'address[]' }, { name: 'proportions', type: 'uint256[]' }] },
    { name: 'defaultHandler', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
    { name: 'authority', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
    { name: 'updateProportions', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_handlers', type: 'address[]' }, { name: '_proportions', type: 'uint256[]' }], outputs: [] }
];

const HANDLER_ABI = [
    { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
    { name: 'tokenIsEnabled', type: 'function', stateMutability: 'view', inputs: [{ name: '_underlyingToken', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'cTokens', type: 'function', stateMutability: 'view', inputs: [{ name: '_token', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
    { name: 'iTokens', type: 'function', stateMutability: 'view', inputs: [{ name: '_token', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
    { name: 'aaveLendingPoolCore', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }
];

let readWeb3;
let walletWeb3;
let walletAccount = null;
let dTokenContract;
let dispatcherContract;
let state = null;

document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    restoreSideMenuState();
    setButtonsDisabled(true);
    logEvent('Loading Ethereum dUSDT live state...', 'info');
    await restoreWalletConnection();
    await loadLiveState();
});

function bindEvents() {
    byId('loadData').addEventListener('click', loadLiveState);
    byId('refreshData').addEventListener('click', loadLiveState);
    byId('connectWallet').addEventListener('click', connectWallet);
    byId('disconnectWallet').addEventListener('click', disconnectWallet);
    byId('hideSideMenu').addEventListener('click', () => setSideMenuCollapsed(true));
    byId('expandSideMenu').addEventListener('click', () => setSideMenuCollapsed(false));
    byId('simulateRebalance').addEventListener('click', simulateRebalance);
    byId('submitRebalance').addEventListener('click', submitRebalance);
    byId('clearLog').addEventListener('click', () => { byId('eventLog').innerHTML = ''; });
    byId('dTokenAddress').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loadLiveState();
    });
    document.querySelectorAll('.asset-button:not(.disabled)').forEach((button) => {
        button.addEventListener('click', () => selectAsset(button));
    });
    document.addEventListener('click', handleCopyClick);

    if (window.ethereum) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    }
}

function restoreSideMenuState() {
    setSideMenuCollapsed(localStorage.getItem(SIDE_MENU_COLLAPSED_KEY) === '1');
}

function setSideMenuCollapsed(collapsed) {
    document.body.classList.toggle('side-collapsed', collapsed);
    byId('expandSideMenu').classList.toggle('hidden', !collapsed);
    byId('hideSideMenu').setAttribute('aria-expanded', String(!collapsed));
    byId('expandSideMenu').setAttribute('aria-expanded', String(!collapsed));
    if (collapsed) {
        localStorage.setItem(SIDE_MENU_COLLAPSED_KEY, '1');
    } else {
        localStorage.removeItem(SIDE_MENU_COLLAPSED_KEY);
    }
}

function selectAsset(button) {
    document.querySelectorAll('.asset-button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    byId('dTokenAddress').value = button.dataset.dtoken || '';
    byId('rpcUrl').value = button.dataset.rpc || '';
    const chainLabel = getChainLabel(button.dataset.chain);
    byId('activeNetwork').textContent = chainLabel;
    byId('pageTitle').textContent = `d${button.dataset.asset} Allocation Console`;
    updateAssetLabels(button.dataset.asset);
    logEvent(`Selected ${chainLabel} ${button.dataset.asset}.`, 'info');
    loadLiveState();
}

async function loadLiveState() {
    const rpcUrl = byId('rpcUrl').value.trim();
    const dTokenAddress = byId('dTokenAddress').value.trim() || DEFAULT_DTOKEN;
    const activeAsset = getActiveAsset();

    if (!rpcUrl) {
        toast('Read RPC is required.', 'error');
        return;
    }

    readWeb3 = new Web3(rpcUrl);
    if (!readWeb3.utils.isAddress(dTokenAddress)) {
        toast('Enter a valid dToken address.', 'error');
        return;
    }

    setLoading(true);
    try {
        dTokenContract = new readWeb3.eth.Contract(DTOKEN_ABI, dTokenAddress);
        const [underlyingRaw, dispatcherRaw, dTokenOwnerRaw, dTokenAuthorityRaw, dTokenPaused, baseDataRaw, handlerInfoRaw] = await Promise.all([
            dTokenContract.methods.token().call(),
            dTokenContract.methods.dispatcher().call(),
            optionalCall(dTokenContract.methods.owner()),
            optionalCall(dTokenContract.methods.authority()),
            optionalCall(dTokenContract.methods.paused()),
            dTokenContract.methods.getBaseData().call(),
            dTokenContract.methods.getHandlerInfo().call()
        ]);
        const underlying = singleValue(underlyingRaw);
        const dispatcher = singleValue(dispatcherRaw);
        const dTokenOwner = singleValue(dTokenOwnerRaw);
        const dTokenAuthority = singleValue(dTokenAuthorityRaw);

        dispatcherContract = new readWeb3.eth.Contract(DISPATCHER_ABI, dispatcher);
        const [handlerConfigRaw, defaultHandlerRaw, dispatcherOwnerRaw, dispatcherAuthorityRaw] = await Promise.all([
            dispatcherContract.methods.getHandlers().call(),
            dispatcherContract.methods.defaultHandler().call(),
            optionalCall(dispatcherContract.methods.owner()),
            optionalCall(dispatcherContract.methods.authority())
        ]);
        const defaultHandler = singleValue(defaultHandlerRaw);
        const dispatcherOwner = singleValue(dispatcherOwnerRaw);
        const dispatcherAuthority = singleValue(dispatcherAuthorityRaw);

        const baseData = normalizeResult(baseDataRaw, 5);
        const handlerInfo = normalizeResult(handlerInfoRaw, 3);
        const handlerConfig = normalizeResult(handlerConfigRaw, 2);
        const decimals = Number(baseData[0]);
        const handlers = handlerInfo[0];
        const proportionsByHandler = mapValuesByAddress(handlerConfig[0], handlerConfig[1]);

        const handlerDetails = await Promise.all(handlers.map(async (address, index) => {
            const handler = new readWeb3.eth.Contract(HANDLER_ABI, address);
            const [pausedRaw, tokenEnabledRaw, marketToken] = await Promise.all([
                optionalCall(handler.methods.paused(), false),
                optionalCall(handler.methods.tokenIsEnabled(underlying), false),
                resolveMarketToken(handler, underlying, address)
            ]);
            const paused = singleValue(pausedRaw);
            const tokenEnabled = singleValue(tokenEnabledRaw);
            const balanceRaw = toBigInt(handlerInfo[1][index]);
            const liquidityRaw = toBigInt(handlerInfo[2][index]);
            const proportionRaw = toBigInt(proportionsByHandler[address.toLowerCase()] || '0');
            return {
                address,
                name: getHandlerName(address, index),
                balanceRaw,
                liquidityRaw,
                proportionRaw,
                paused: Boolean(paused),
                tokenEnabled: Boolean(tokenEnabled),
                marketToken
            };
        }));

        state = {
            dTokenAddress,
            assetSymbol: activeAsset.symbol,
            chainId: activeAsset.chainId,
            underlying,
            dispatcher,
            dTokenOwner,
            dTokenAuthority,
            dTokenPaused: Boolean(singleValue(dTokenPaused)),
            defaultHandler,
            dispatcherOwner,
            dispatcherAuthority,
            decimals,
            exchangeRateRaw: toBigInt(baseData[1]),
            mintFeeRaw: toBigInt(baseData[2]),
            redeemFeeRaw: toBigInt(baseData[3]),
            totalUnderlyingRaw: toBigInt(baseData[4]),
            handlers: handlerDetails
        };

        renderState();
        setButtonsDisabled(false);
        byId('rpcStatus').textContent = 'RPC live';
        logEvent(`Loaded ${handlerDetails.length} handlers from ${shortAddress(dispatcher)}.`, 'success');
    } catch (error) {
        console.error(error);
        byId('rpcStatus').textContent = 'RPC error';
        toast(readableError(error), 'error');
        logEvent(readableError(error), 'error');
    } finally {
        setLoading(false);
    }
}

async function resolveMarketToken(handler, underlying, handlerAddress) {
    const lower = handlerAddress.toLowerCase();
    if (lower === '0x885dd179c76ee5949b9053f1958ba3a91e4cf592') return 'Wallet balance';
    if (lower === '0xc46751e2494897eb34e2297beb649672dbabf975') return 'Wallet balance';
    if (lower === '0xbcdd2a069a46e9b5d032d2f99725418508ce6aee') {
        const cToken = singleValue(await optionalCall(handler.methods.cTokens(underlying)));
        return isRealAddress(cToken) ? cToken : '-';
    }
    if (lower === '0xde399d88ea8331fe2f18306793893a46d142cc5f') {
        const cToken = singleValue(await optionalCall(handler.methods.cTokens(underlying)));
        return isRealAddress(cToken) ? cToken : '-';
    }
    if (lower === '0xbb7d75be4dc8eb15ff90422137c0a5bcbd316953') {
        const aaveCore = singleValue(await optionalCall(handler.methods.aaveLendingPoolCore()));
        return isRealAddress(aaveCore) ? `Aave core ${shortAddress(aaveCore)}` : '-';
    }
    if (lower === '0xe3412d2751f6cfa117a4c5eb71e84aa63a5ee5ff') {
        const iToken = singleValue(await optionalCall(handler.methods.iTokens(underlying)));
        return isRealAddress(iToken) ? iToken : '-';
    }

    return '-';
}

function renderState() {
    if (!state) return;

    const totalLiquidityRaw = state.handlers.reduce((sum, handler) => sum + handler.liquidityRaw, 0n);
    const drifts = state.handlers.map((handler) => Math.abs(getActualPercent(handler) - getTargetPercent(handler)));
    const maxDrift = drifts.length ? Math.max(...drifts) : 0;

    updateAssetLabels(state.assetSymbol);
    byId('totalUnderlying').textContent = formatToken(state.totalUnderlyingRaw, state.decimals, state.assetSymbol);
    byId('totalLiquidity').textContent = formatToken(totalLiquidityRaw, state.decimals, state.assetSymbol);
    byId('exchangeRate').textContent = formatFixed(state.exchangeRateRaw, 18, 9);
    byId('largestDrift').textContent = `${maxDrift.toFixed(2)}%`;

    byId('lastUpdated').textContent = new Date().toLocaleString();

    renderHandlerRows();
    renderRebalanceRows();
    renderPermissions();
}

function renderHandlerRows() {
    const tbody = byId('handlerRows');
    tbody.innerHTML = '';

    state.handlers.forEach((handler) => {
        const actualPercent = getActualPercent(handler);
        const targetPercent = getTargetPercent(handler);
        const drift = actualPercent - targetPercent;
        const status = handler.paused ? 'Paused' : handler.tokenEnabled ? 'Enabled' : 'Token disabled';
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${handler.name}</td>
            <td>${renderAddressCell(handler.address)}</td>
            <td>${formatToken(handler.balanceRaw, state.decimals, state.assetSymbol)} <span class="muted">${actualPercent.toFixed(2)}%</span></td>
            <td>${targetPercent.toFixed(2)}%</td>
            <td class="${driftClass(drift)}">${signedPercent(drift)}</td>
            <td>${formatToken(handler.liquidityRaw, state.decimals, state.assetSymbol)}</td>
            <td><span class="status ${statusClass(handler)}">${status}</span></td>
            <td>${renderMarketTokenCell(handler.marketToken)}</td>
        `;
        tbody.appendChild(row);
    });
}

async function handleCopyClick(event) {
    const button = event.target.closest('[data-copy]');
    if (!button) return;

    const value = button.dataset.copy;
    try {
        await navigator.clipboard.writeText(value);
        toast('Address copied.', 'success');
    } catch (_error) {
        fallbackCopy(value);
        toast('Address copied.', 'success');
    }
}

function renderRebalanceRows() {
    const tbody = byId('rebalanceRows');
    tbody.innerHTML = '';

    state.handlers.forEach((handler) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${handler.name}</td>
            <td>${formatToken(handler.liquidityRaw, state.decimals, state.assetSymbol)}</td>
            <td><input class="numeric-input percent-input rebalance-withdraw-percent" data-handler="${handler.address}" type="number" min="0" max="100" step="0.01" placeholder="0.00"></td>
            <td><input class="numeric-input rebalance-withdraw" data-handler="${handler.address}" type="number" min="0" step="0.000001" placeholder="0.000000"></td>
            <td><input class="all-checkbox" data-handler="${handler.address}" type="checkbox" title="Withdraw all"></td>
            <td><input class="numeric-input rebalance-deposit" data-handler="${handler.address}" type="number" min="0" step="0.000001" placeholder="0.000000"></td>
        `;
        tbody.appendChild(row);
    });

    tbody.querySelectorAll('.rebalance-withdraw-percent').forEach((input) => {
        input.addEventListener('input', handleWithdrawPercentInput);
        input.addEventListener('change', handleWithdrawPercentInput);
    });
    tbody.querySelectorAll('.rebalance-withdraw, .rebalance-deposit, .all-checkbox').forEach((input) => {
        input.addEventListener('input', handleManualRebalanceInput);
        input.addEventListener('change', handleManualRebalanceInput);
    });
    updateRebalancePreview();
}

function handleWithdrawPercentInput(event) {
    const percentInput = event.target;
    const handler = getHandlerByAddress(percentInput.dataset.handler);
    if (!handler) return;

    const percent = clampNumber(Number(percentInput.value || 0), 0, 100);
    const withdrawInput = document.querySelector(`.rebalance-withdraw[data-handler="${handler.address}"]`);
    const allInput = document.querySelector(`.all-checkbox[data-handler="${handler.address}"]`);
    const amountRaw = handler.liquidityRaw * BigInt(Math.round(percent * 100)) / 10000n;

    withdrawInput.value = amountRaw > 0n ? formatFixed(amountRaw, state.decimals, state.decimals) : '';
    allInput.checked = percent === 100;
    updateRebalancePreview();
}

function handleManualRebalanceInput(event) {
    const input = event.target;
    const handler = getHandlerByAddress(input.dataset.handler);
    if (!handler) {
        updateRebalancePreview();
        return;
    }

    if (input.classList.contains('rebalance-withdraw')) {
        const percentInput = document.querySelector(`.rebalance-withdraw-percent[data-handler="${handler.address}"]`);
        const allInput = document.querySelector(`.all-checkbox[data-handler="${handler.address}"]`);
        const withdrawRaw = tokenInputToRaw(input.value, state.decimals);
        percentInput.value = handler.liquidityRaw > 0n && withdrawRaw > 0n
            ? rawPercent(withdrawRaw, handler.liquidityRaw)
            : '';
        allInput.checked = handler.liquidityRaw > 0n && withdrawRaw >= handler.liquidityRaw;
    }

    if (input.classList.contains('all-checkbox')) {
        const percentInput = document.querySelector(`.rebalance-withdraw-percent[data-handler="${handler.address}"]`);
        const withdrawInput = document.querySelector(`.rebalance-withdraw[data-handler="${handler.address}"]`);
        if (input.checked) {
            percentInput.value = '100.00';
            withdrawInput.value = formatFixed(handler.liquidityRaw, state.decimals, state.decimals);
        } else {
            percentInput.value = '';
            withdrawInput.value = '';
        }
    }

    updateRebalancePreview();
}

function renderPermissions() {
    if (!state) {
        byId('rebalancePermission').textContent = 'Wallet not connected';
        return;
    }
    const account = walletAccount ? walletAccount.toLowerCase() : null;
    const canRebalance = account && state.dTokenOwner && account === state.dTokenOwner.toLowerCase();

    byId('rebalancePermission').textContent = walletAccount
        ? canRebalance ? 'Owner wallet' : 'Owner or authority required'
        : 'Wallet not connected';
}

async function connectWallet() {
    if (!window.ethereum) {
        toast('No injected wallet found.', 'error');
        return;
    }

    const targetChainId = state?.chainId || getActiveAsset().chainId;
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== targetChainId) {
        await switchWalletChain(targetChainId);
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletAccount = accounts[0];
    walletWeb3 = new Web3(window.ethereum);
    localStorage.setItem(WALLET_REMEMBER_KEY, '1');
    updateWalletUi();
    renderPermissions();
    logEvent(`Wallet connected: ${shortAddress(walletAccount)}.`, 'success');
}

async function restoreWalletConnection() {
    if (!window.ethereum || localStorage.getItem(WALLET_REMEMBER_KEY) !== '1') return;

    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!accounts.length) return;

        walletAccount = accounts[0];
        walletWeb3 = new Web3(window.ethereum);
        updateWalletUi();
        logEvent(`Wallet restored: ${shortAddress(walletAccount)}.`, 'success');
    } catch (error) {
        console.warn('Wallet restore failed:', error);
    }
}

function disconnectWallet() {
    walletAccount = null;
    walletWeb3 = null;
    localStorage.removeItem(WALLET_REMEMBER_KEY);
    updateWalletUi();
    renderPermissions();
}

function handleAccountsChanged(accounts) {
    if (!accounts.length) {
        disconnectWallet();
        return;
    }
    walletAccount = accounts[0];
    walletWeb3 = new Web3(window.ethereum);
    localStorage.setItem(WALLET_REMEMBER_KEY, '1');
    updateWalletUi();
    renderPermissions();
}

async function switchWalletChain(chainId) {
    try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
    } catch (error) {
        if (chainId === BSC_CHAIN_ID && error?.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: BSC_CHAIN_ID,
                    chainName: 'BNB Smart Chain',
                    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                    rpcUrls: ['https://bsc-dataseed.binance.org'],
                    blockExplorerUrls: ['https://bscscan.com']
                }]
            });
            return;
        }
        throw error;
    }
}

function updateWalletUi() {
    if (walletAccount) {
        byId('connectWallet').classList.add('hidden');
        byId('walletPill').classList.remove('hidden');
        byId('walletAddress').textContent = shortAddress(walletAccount);
        return;
    }

    byId('connectWallet').classList.remove('hidden');
    byId('walletPill').classList.add('hidden');
    byId('walletAddress').textContent = '';
}

async function submitRebalance() {
    await ensureWalletChain();
    await sendTransaction(
        buildRebalanceMethod,
        'Submitted manual rebalance.'
    );
}

async function simulateRebalance() {
    try {
        await ensureWalletChain();
        const method = buildRebalanceMethod();
        logEvent('Simulating rebalance with eth_call...', 'info');
        await method.call({ from: walletAccount });
        const gas = await method.estimateGas({ from: walletAccount });
        const gasText = new Intl.NumberFormat('en-US').format(Number(gas));
        toast(`Simulation passed. Estimated gas: ${gasText}.`, 'success');
        logEvent(`Simulation passed. Estimated gas: ${gasText}.`, 'success');
    } catch (error) {
        console.error(error);
        toast(readableError(error), 'error');
        logEvent(`Simulation failed: ${readableError(error)}`, 'error');
    }
}

function buildRebalanceMethod() {
    if (!state || !walletAccount || !walletWeb3) {
        throw new Error('Connect wallet and load live state first.');
    }

    const { withdrawHandlers, withdrawAmounts, depositHandlers, depositAmounts } = collectRebalancePlan();
    if (!withdrawHandlers.length && !depositHandlers.length) {
        throw new Error('Set at least one withdraw or deposit amount.');
    }

    const contract = new walletWeb3.eth.Contract(DTOKEN_ABI, state.dTokenAddress);
    return contract.methods.rebalance(withdrawHandlers, withdrawAmounts, depositHandlers, depositAmounts);
}

async function ensureWalletChain() {
    if (!window.ethereum || !walletAccount || !state?.chainId) return;
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== state.chainId) {
        await switchWalletChain(state.chainId);
    }
}

async function sendTransaction(methodFactory, successMessage) {
    try {
        const method = methodFactory();
        logEvent('Simulating transaction with eth_call...', 'info');
        await method.call({ from: walletAccount });
        const gas = await method.estimateGas({ from: walletAccount });
        const receipt = await method.send({ from: walletAccount, gas: Math.ceil(Number(gas) * 1.2) });
        logEvent(`${successMessage} Tx: ${receipt.transactionHash}`, 'success');
        toast(successMessage, 'success');
        await loadLiveState();
    } catch (error) {
        console.error(error);
        toast(readableError(error), 'error');
        logEvent(readableError(error), 'error');
    }
}

function collectRebalancePlan() {
    const withdrawHandlers = [];
    const withdrawAmounts = [];
    const depositHandlers = [];
    const depositAmounts = [];

    state.handlers.forEach((handler) => {
        const withdrawInput = document.querySelector(`.rebalance-withdraw[data-handler="${handler.address}"]`);
        const allInput = document.querySelector(`.all-checkbox[data-handler="${handler.address}"]`);
        const depositInput = document.querySelector(`.rebalance-deposit[data-handler="${handler.address}"]`);

        if (allInput.checked) {
            withdrawHandlers.push(handler.address);
            withdrawAmounts.push(MAX_UINT256);
        } else {
            const withdrawRaw = tokenInputToRaw(withdrawInput.value, state.decimals);
            if (withdrawRaw > 0n) {
                withdrawHandlers.push(handler.address);
                withdrawAmounts.push(String(withdrawRaw));
            }
        }

        const depositRaw = tokenInputToRaw(depositInput.value, state.decimals);
        if (depositRaw > 0n) {
            depositHandlers.push(handler.address);
            depositAmounts.push(String(depositRaw));
        }
    });

    return { withdrawHandlers, withdrawAmounts, depositHandlers, depositAmounts };
}

function updateRebalancePreview() {
    if (!state) return;
    const plan = collectRebalancePlan();
    byId('rebalancePreview').textContent = `${plan.withdrawHandlers.length} withdraws, ${plan.depositHandlers.length} deposits`;
}

function getHandlerByAddress(address) {
    return state?.handlers.find((handler) => handler.address === address);
}

function rawPercent(part, total) {
    if (total === 0n) return '';
    const basisPoints = part * 1000000n / total;
    return (Number(basisPoints) / 10000).toFixed(2);
}

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function normalizeResult(result, length) {
    if (Array.isArray(result)) return result.slice(0, length);
    return Object.values(result).slice(0, length);
}

function singleValue(result) {
    if (result === null || result === undefined) return result;
    if (Array.isArray(result)) return result[0];
    if (typeof result === 'object') return result[0] ?? Object.values(result)[0];
    return result;
}

function mapValuesByAddress(addresses, values) {
    return addresses.reduce((map, address, index) => {
        map[address.toLowerCase()] = values[index];
        return map;
    }, {});
}

async function optionalCall(method, fallback = null) {
    try {
        return await method.call();
    } catch (_error) {
        return fallback;
    }
}

function getHandlerName(address, index) {
    return HANDLER_NAMES[address.toLowerCase()] || `Handler ${index + 1}`;
}

function getActualPercent(handler) {
    if (!state.totalUnderlyingRaw) return 0;
    return Number(handler.balanceRaw * 1000000n / state.totalUnderlyingRaw) / 10000;
}

function getTargetPercent(handler) {
    return Number(handler.proportionRaw * 10000n / TOTAL_PROPORTION) / 100;
}

function statusClass(handler) {
    if (handler.paused) return 'danger';
    if (!handler.tokenEnabled) return 'warning';
    return 'ok';
}

function driftClass(value) {
    if (Math.abs(value) < 0.01) return 'neutral';
    return value > 0 ? 'positive' : 'negative';
}

function signedPercent(value) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

function tokenInputToRaw(value, decimals) {
    const normalized = String(value || '').trim();
    if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) return 0n;
    const [whole, fraction = ''] = normalized.split('.');
    const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals);
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

function formatToken(raw, decimals, symbol) {
    return `${formatNumber(Number(formatFixed(raw, decimals, 6)))} ${symbol}`;
}

function formatFixed(raw, decimals, precision) {
    const value = toBigInt(raw);
    const scale = 10n ** BigInt(decimals);
    const whole = value / scale;
    const fraction = value % scale;
    const fractionText = fraction.toString().padStart(decimals, '0').slice(0, precision);
    return `${whole}.${fractionText}`.replace(/\.?0+$/, '');
}

function formatNumber(value) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value);
}

function formatMarketToken(value) {
    if (!value || value === '-') return '-';
    if (readWeb3 && readWeb3.utils.isAddress(value)) return shortAddress(value);
    return value;
}

function getActiveAsset() {
    const active = document.querySelector('.asset-button.active');
    const chain = active?.dataset.chain || 'ethereum';
    return {
        symbol: active?.dataset.asset || 'USDT',
        chain,
        chainId: active?.dataset.chainId || (chain === 'bsc' ? BSC_CHAIN_ID : ETH_CHAIN_ID)
    };
}

function getChainLabel(chain) {
    if (chain === 'ethereum') return 'Ethereum Mainnet';
    if (chain === 'bsc') return 'BSC Mainnet';
    return chain || 'Network';
}

function updateAssetLabels(symbol) {
    document.querySelectorAll('.asset-symbol').forEach((element) => {
        element.textContent = symbol;
    });
    document.querySelectorAll('.metric-note').forEach((element) => {
        if (element.textContent.includes('across handlers')) element.textContent = `${symbol} across handlers`;
    });
}

function renderAddressCell(address) {
    if (!address || !readWeb3 || !readWeb3.utils.isAddress(address)) {
        return '<span>-</span>';
    }

    return `
        <span class="address-inline">
            <code title="${address}">${shortAddress(address)}</code>
            <button class="copy-button" type="button" data-copy="${address}" title="Copy ${address}">Copy</button>
        </span>
    `;
}

function renderMarketTokenCell(value) {
    if (!value || value === '-') return '<span>-</span>';
    if (readWeb3 && readWeb3.utils.isAddress(value)) return renderAddressCell(value);

    const match = value.match(/^(.*?)(0x[a-fA-F0-9]{40})$/);
    if (!match) return `<span>${value}</span>`;

    return `
        <span class="address-inline">
            <span>${match[1].trim()}</span>
            <code title="${match[2]}">${shortAddress(match[2])}</code>
            <button class="copy-button" type="button" data-copy="${match[2]}" title="Copy ${match[2]}">Copy</button>
        </span>
    `;
}

function fallbackCopy(value) {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
}

function shortAddress(address) {
    if (!address || address === '-') return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isRealAddress(value) {
    return value && readWeb3 && readWeb3.utils.isAddress(value) && value !== ZERO_ADDRESS;
}

function toBigInt(value) {
    if (typeof value === 'bigint') return value;
    return BigInt(String(value));
}

function readableError(error) {
    const message = error?.data?.message || error?.message || String(error);
    return message.length > 220 ? `${message.slice(0, 220)}...` : message;
}

function setLoading(isLoading) {
    byId('loadData').disabled = isLoading;
    byId('refreshData').disabled = isLoading || !state;
    byId('loadData').textContent = isLoading ? 'Loading...' : 'Load Live State';
}

function setButtonsDisabled(disabled) {
    byId('refreshData').disabled = disabled;
    byId('simulateRebalance').disabled = disabled;
    byId('submitRebalance').disabled = disabled;
}

function logEvent(message, type = 'info') {
    const row = document.createElement('div');
    row.className = `log-row ${type}`;
    row.innerHTML = `<span>${new Date().toLocaleTimeString()}</span><p>${message}</p>`;
    byId('eventLog').prepend(row);
}

function toast(message, type = 'info') {
    const toastEl = document.createElement('div');
    toastEl.className = `toast ${type}`;
    toastEl.textContent = message;
    document.body.appendChild(toastEl);
    window.setTimeout(() => toastEl.remove(), 5000);
}

function byId(id) {
    return document.getElementById(id);
}

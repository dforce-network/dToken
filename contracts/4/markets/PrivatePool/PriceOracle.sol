pragma solidity ^0.4.24;

import "./Exponential.sol";

contract ExchangeRateModel {
    function scale() external view returns (uint256);

    function token() external view returns (address);

    function getExchangeRate() external view returns (uint256);

    function getMaxSwingRate(uint256 interval) external view returns (uint256);

    function getFixedInterestRate(uint256 interval)
        external
        view
        returns (uint256);

    function getFixedExchangeRate(uint256 interval)
        public
        view
        returns (uint256);
}

interface IERC20 {
    function decimals() external view returns (uint256);
}

contract PriceOracle is Exponential {
    /**
     * @dev flag for whether or not contract is paused
     *
     */
    bool public paused;

    uint256 public constant numBlocksPerPeriod = 240; // approximately 1 hour: 60 seconds/minute * 60 minutes/hour * 1 block/15 seconds

    uint256 public constant maxSwingMantissa = (10**17); // 0.1

    /**
     * @dev Mapping of asset addresses to exchange rate information. Dynamic changes in asset prices based on exchange rates.
     *
     * map: assetAddress -> ExchangeRateInfo
     */
    struct ExchangeRateInfo {
        address exchangeRateModel;
        uint256 exchangeRate;
        uint256 maxSwingRate;
        uint256 maxSwingDuration;
    }
    mapping(address => ExchangeRateInfo) public exchangeRates;

    /**
     * @dev Mapping of asset addresses and their corresponding price in terms of Eth-Wei
     *      which is simply equal to AssetWeiPrice * 10e18. For instance, if OMG token was
     *      worth 5x Eth then the price for OMG would be 5*10e18 or Exp({mantissa: 5000000000000000000}).
     * map: assetAddress -> Exp
     */
    mapping(address => Exp) public _assetPrices;

    constructor(address _poster) public {
        anchorAdmin = msg.sender;
        poster = _poster;
        maxSwing = Exp({mantissa: maxSwingMantissa});
    }

    /**
     * @notice Do not pay into PriceOracle
     */
    function() external payable {
        revert();
    }

    enum OracleError {NO_ERROR, UNAUTHORIZED, FAILED_TO_SET_PRICE}

    enum OracleFailureInfo {
        ACCEPT_ANCHOR_ADMIN_PENDING_ANCHOR_ADMIN_CHECK,
        SET_PAUSED_OWNER_CHECK,
        SET_PENDING_ANCHOR_ADMIN_OWNER_CHECK,
        SET_PENDING_ANCHOR_PERMISSION_CHECK,
        SET_PRICE_CALCULATE_SWING,
        SET_PRICE_CAP_TO_MAX,
        SET_PRICE_MAX_SWING_CHECK,
        SET_PRICE_NO_ANCHOR_PRICE_OR_INITIAL_PRICE_ZERO,
        SET_PRICE_PERMISSION_CHECK,
        SET_PRICE_ZERO_PRICE,
        SET_PRICES_PARAM_VALIDATION,
        SET_PRICE_IS_READER_ASSET
    }

    /**
     * @dev `msgSender` is msg.sender; `error` corresponds to enum OracleError; `info` corresponds to enum OracleFailureInfo, and `detail` is an arbitrary
     * contract-specific code that enables us to report opaque error codes from upgradeable contracts.
     */
    event OracleFailure(
        address msgSender,
        address asset,
        uint256 error,
        uint256 info,
        uint256 detail
    );

    /**
     * @dev use this when reporting a known error from the price oracle or a non-upgradeable collaborator
     *      Using Oracle in name because we already inherit a `fail` function from ErrorReporter.sol via Exponential.sol
     */
    function failOracle(
        address asset,
        OracleError err,
        OracleFailureInfo info
    ) internal returns (uint256) {
        emit OracleFailure(msg.sender, asset, uint256(err), uint256(info), 0);

        return uint256(err);
    }

    /**
     * @dev Use this when reporting an error from the money market. Give the money market result as `details`
     */
    function failOracleWithDetails(
        address asset,
        OracleError err,
        OracleFailureInfo info,
        uint256 details
    ) internal returns (uint256) {
        emit OracleFailure(
            msg.sender,
            asset,
            uint256(err),
            uint256(info),
            details
        );

        return uint256(err);
    }

    /**
     * @dev An administrator who can set the pending anchor value for assets.
     *      Set in the constructor.
     */
    address public anchorAdmin;

    /**
     * @dev pending anchor administrator for this contract.
     */
    address public pendingAnchorAdmin;

    /**
     * @dev Address of the price poster.
     *      Set in the constructor.
     */
    address public poster;

    /**
     * @dev maxSwing the maximum allowed percentage difference between a new price and the anchor's price
     *      Set only in the constructor
     */
    Exp public maxSwing;

    struct Anchor {
        // floor(block.number / numBlocksPerPeriod) + 1
        uint256 period;
        // Price in ETH, scaled by 10**18
        uint256 priceMantissa;
    }

    /**
     * @dev anchors by asset
     */
    mapping(address => Anchor) public anchors;

    /**
     * @dev pending anchor prices by asset
     */
    mapping(address => uint256) public pendingAnchors;

    /**
     * @dev emitted when a pending anchor is set
     * @param asset Asset for which to set a pending anchor
     * @param oldScaledPrice if an unused pending anchor was present, its value; otherwise 0.
     * @param newScaledPrice the new scaled pending anchor price
     */
    event NewPendingAnchor(
        address anchorAdmin,
        address asset,
        uint256 oldScaledPrice,
        uint256 newScaledPrice
    );

    /**
     * @notice provides ability to override the anchor price for an asset
     * @dev Admin function to set the anchor price for an asset
     * @param asset Asset for which to override the anchor price
     * @param newScaledPrice New anchor price
     * @return uint 0=success, otherwise a failure (see enum OracleError for details)
     */
    function _setPendingAnchor(address asset, uint256 newScaledPrice)
        public
        returns (uint256)
    {
        // Check caller = anchorAdmin. Note: Deliberately not allowing admin. They can just change anchorAdmin if desired.
        if (msg.sender != anchorAdmin) {
            return
                failOracle(
                    asset,
                    OracleError.UNAUTHORIZED,
                    OracleFailureInfo.SET_PENDING_ANCHOR_PERMISSION_CHECK
                );
        }

        uint256 oldScaledPrice = pendingAnchors[asset];
        pendingAnchors[asset] = newScaledPrice;

        emit NewPendingAnchor(
            msg.sender,
            asset,
            oldScaledPrice,
            newScaledPrice
        );

        return uint256(OracleError.NO_ERROR);
    }

    /**
     * @dev emitted for all exchangeRates changes
     */
    event SetExchangeRate(
        address asset,
        address exchangeRateModel,
        uint256 exchangeRate,
        uint256 maxSwingRate,
        uint256 maxSwingDuration
    );
    event SetMaxSwingRate(
        address asset,
        uint256 oldMaxSwingRate,
        uint256 newMaxSwingRate,
        uint256 maxSwingDuration
    );

    /**
     * @dev emitted for all price changes
     */
    event PricePosted(
        address asset,
        uint256 previousPriceMantissa,
        uint256 requestedPriceMantissa,
        uint256 newPriceMantissa
    );

    /**
     * @dev emitted if this contract successfully posts a capped-to-max price to the money market
     */
    event CappedPricePosted(
        address asset,
        uint256 requestedPriceMantissa,
        uint256 anchorPriceMantissa,
        uint256 cappedPriceMantissa
    );

    /**
     * @dev emitted when admin either pauses or resumes the contract; newState is the resulting state
     */
    event SetPaused(bool newState);

    /**
     * @dev emitted when pendingAnchorAdmin is changed
     */
    event NewPendingAnchorAdmin(
        address oldPendingAnchorAdmin,
        address newPendingAnchorAdmin
    );

    /**
     * @dev emitted when pendingAnchorAdmin is accepted, which means anchor admin is updated
     */
    event NewAnchorAdmin(address oldAnchorAdmin, address newAnchorAdmin);

    /**
     * @dev emitted when poster is changed
     */
    event NewPoster(address oldPoster, address newPoster);

    /**
     * @notice set `paused` to the specified state
     * @dev Admin function to pause or resume the market
     * @param requestedState value to assign to `paused`
     * @return uint 0=success, otherwise a failure
     */
    function _setPaused(bool requestedState) public returns (uint256) {
        // Check caller = anchorAdmin
        if (msg.sender != anchorAdmin) {
            return
                failOracle(
                    address(0x0),
                    OracleError.UNAUTHORIZED,
                    OracleFailureInfo.SET_PAUSED_OWNER_CHECK
                );
        }

        paused = requestedState;
        emit SetPaused(requestedState);

        return uint256(Error.NO_ERROR);
    }

    /**
     * @notice Begins transfer of anchor admin rights. The newPendingAnchorAdmin must call `_acceptAnchorAdmin` to finalize the transfer.
     * @dev Admin function to begin change of anchor admin. The newPendingAnchorAdmin must call `_acceptAnchorAdmin` to finalize the transfer.
     * @param newPendingAnchorAdmin New pending anchor admin.
     * @return uint 0=success, otherwise a failure
     *
     * TODO: Should we add a second arg to verify, like a checksum of `newAnchorAdmin` address?
     */
    function _setPendingAnchorAdmin(address newPendingAnchorAdmin)
        public
        returns (uint256)
    {
        // Check caller = anchorAdmin
        if (msg.sender != anchorAdmin) {
            return
                failOracle(
                    address(0x0),
                    OracleError.UNAUTHORIZED,
                    OracleFailureInfo.SET_PENDING_ANCHOR_ADMIN_OWNER_CHECK
                );
        }

        // save current value, if any, for inclusion in log
        address oldPendingAnchorAdmin = pendingAnchorAdmin;
        // Store pendingAdmin = newPendingAdmin
        pendingAnchorAdmin = newPendingAnchorAdmin;

        emit NewPendingAnchorAdmin(
            oldPendingAnchorAdmin,
            newPendingAnchorAdmin
        );

        return uint256(Error.NO_ERROR);
    }

    /**
     * @notice Accepts transfer of anchor admin rights. msg.sender must be pendingAnchorAdmin
     * @dev Admin function for pending anchor admin to accept role and update anchor admin
     * @return uint 0=success, otherwise a failure
     */
    function _acceptAnchorAdmin() public returns (uint256) {
        // Check caller = pendingAnchorAdmin
        // msg.sender can't be zero
        if (msg.sender != pendingAnchorAdmin) {
            return
                failOracle(
                    address(0x0),
                    OracleError.UNAUTHORIZED,
                    OracleFailureInfo
                        .ACCEPT_ANCHOR_ADMIN_PENDING_ANCHOR_ADMIN_CHECK
                );
        }

        // Save current value for inclusion in log
        address oldAnchorAdmin = anchorAdmin;
        // Store admin = pendingAnchorAdmin
        anchorAdmin = pendingAnchorAdmin;
        // Clear the pending value
        pendingAnchorAdmin = address(0x0);

        emit NewAnchorAdmin(oldAnchorAdmin, msg.sender);

        return uint256(Error.NO_ERROR);
    }

    /**
     * @notice Set new poster.
     * @dev Admin function to change of poster.
     * @param newPoster New poster.
     * @return uint 0=success, otherwise a failure
     *
     * TODO: Should we add a second arg to verify, like a checksum of `newAnchorAdmin` address?
     */
    function _setPoster(address newPoster) public returns (uint256) {
        assert(poster != newPoster);
        // Check caller = anchorAdmin
        if (msg.sender != anchorAdmin) {
            return
                failOracle(
                    address(0x0),
                    OracleError.UNAUTHORIZED,
                    OracleFailureInfo.SET_PENDING_ANCHOR_ADMIN_OWNER_CHECK
                );
        }

        // save current value, if any, for inclusion in log
        address oldPoster = poster;
        // Store poster = newPoster
        poster = newPoster;

        emit NewPoster(oldPoster, newPoster);

        return uint256(Error.NO_ERROR);
    }

    /**
     * @notice set new exchange rate model
     * @dev function to set exchangeRateModel for an asset
     * @param asset asset for which to set the exchangeRateModel
     * @param exchangeRateModel exchangeRateModel address, if the exchangeRateModel is address(0), cancel the exchangeRates
     * @param maxSwingDuration maxSwingDuration uint, Is a value greater than zero and less than a second of a week
     * @return uint 0=success, otherwise a failure (see enum OracleError for details)
     */
    function setExchangeRate(
        address asset,
        address exchangeRateModel,
        uint256 maxSwingDuration
    ) public returns (uint256) {
        // Fail when msg.sender is not poster
        if (msg.sender != anchorAdmin) {
            return
                failOracle(
                    asset,
                    OracleError.UNAUTHORIZED,
                    OracleFailureInfo.SET_PRICE_PERMISSION_CHECK
                );
        }

        require(
            exchangeRateModel != address(0),
            "setExchangeRate: exchangeRateModel cannot be a zero address."
        );
        require(
            maxSwingDuration > 0 && maxSwingDuration <= 604800,
            "setExchangeRate: maxSwingDuration cannot be zero, less than 31536000 (seconds per week)."
        );

        uint256 currentExchangeRate = ExchangeRateModel(exchangeRateModel)
            .getExchangeRate();
        require(
            currentExchangeRate > 0,
            "setExchangeRate: currentExchangeRate not zero."
        );

        uint256 maxSwingRate = ExchangeRateModel(exchangeRateModel)
            .getMaxSwingRate(maxSwingDuration);
        require(
            maxSwingRate > 0 &&
                maxSwingRate <=
                ExchangeRateModel(exchangeRateModel).getMaxSwingRate(604800),
            "setExchangeRate: maxSwingRate cannot be zero, less than 31536000 (seconds per week)."
        );

        exchangeRates[asset].exchangeRateModel = exchangeRateModel;
        exchangeRates[asset].exchangeRate = currentExchangeRate;
        exchangeRates[asset].maxSwingRate = maxSwingRate;
        exchangeRates[asset].maxSwingDuration = maxSwingDuration;

        emit SetExchangeRate(
            asset,
            exchangeRateModel,
            currentExchangeRate,
            maxSwingRate,
            maxSwingDuration
        );
        return uint256(OracleError.NO_ERROR);
    }

    /**
     * @notice set new exchange rate maxSwingRate
     * @dev function to set exchange rate maxSwingRate for an asset
     * @param asset asset for which to set the exchange rate maxSwingRate
     * @param maxSwingDuration Interval time
     * @return uint 0=success, otherwise a failure (see enum OracleError for details)
     */
    function setMaxSwingRate(address asset, uint256 maxSwingDuration)
        public
        returns (uint256)
    {
        // Fail when msg.sender is not poster
        if (msg.sender != anchorAdmin) {
            return
                failOracle(
                    asset,
                    OracleError.UNAUTHORIZED,
                    OracleFailureInfo.SET_PRICE_PERMISSION_CHECK
                );
        }

        require(
            maxSwingDuration > 0 && maxSwingDuration <= 604800,
            "setMaxSwingRate: maxSwingDuration cannot be zero, less than 31536000 (seconds per week)."
        );

        ExchangeRateModel exchangeRateModel = ExchangeRateModel(
            exchangeRates[asset].exchangeRateModel
        );
        uint256 newMaxSwingRate = exchangeRateModel.getMaxSwingRate(
            maxSwingDuration
        );
        uint256 oldMaxSwingRate = exchangeRates[asset].maxSwingRate;
        require(
            oldMaxSwingRate != newMaxSwingRate,
            "setMaxSwingRate: Old and new values cannot be the same."
        );
        require(
            newMaxSwingRate > 0 &&
                newMaxSwingRate <= exchangeRateModel.getMaxSwingRate(604800),
            "setMaxSwingRate: maxSwingRate cannot be zero, less than 31536000 (seconds per week)."
        );

        exchangeRates[asset].maxSwingRate = newMaxSwingRate;
        exchangeRates[asset].maxSwingDuration = maxSwingDuration;

        emit SetMaxSwingRate(
            asset,
            oldMaxSwingRate,
            newMaxSwingRate,
            maxSwingDuration
        );
        return uint256(OracleError.NO_ERROR);
    }

    /**
     * @notice retrieves price of an asset
     * @dev function to get price for an asset
     * @param asset Asset for which to get the price
     * @return uint mantissa of asset price (scaled by 1e18) or zero if unset or contract paused
     */
    function assetPrices(address asset) public view returns (uint256) {
        // Note: zero is treated by the money market as an invalid
        //       price and will cease operations with that asset
        //       when zero.
        //
        // We get the price as:
        //
        //  1. If the contract is paused, return 0.
        //  2. If the asset has an exchange rate model, the asset price is calculated based on the exchange rate.
        //  3. Return price in `_assetPrices`, which may be zero.

        if (paused) {
            return 0;
        } else {
            ExchangeRateInfo memory exchangeRateInfo = exchangeRates[asset];
            if (exchangeRateInfo.exchangeRateModel != address(0)) {
                uint256 scale = ExchangeRateModel(
                    exchangeRateInfo
                        .exchangeRateModel
                )
                    .scale();
                uint256 currentExchangeRate = ExchangeRateModel(
                    exchangeRateInfo
                        .exchangeRateModel
                )
                    .getExchangeRate();
                uint256 currentChangeRate;
                Error err;
                (err, currentChangeRate) = mul(currentExchangeRate, scale);
                if (err != Error.NO_ERROR) return 0;

                currentChangeRate =
                    currentChangeRate /
                    exchangeRateInfo.exchangeRate;
                // require(currentExchangeRate >= exchangeRateInfo.exchangeRate && currentChangeRate <= exchangeRateInfo.maxSwingRate, "assetPrices: Abnormal exchange rate.");
                if (
                    currentExchangeRate < exchangeRateInfo.exchangeRate ||
                    currentChangeRate > exchangeRateInfo.maxSwingRate
                ) return 0;

                uint256 price;
                (err, price) = mul(
                    _assetPrices[asset].mantissa,
                    currentExchangeRate
                );
                if (err != Error.NO_ERROR) return 0;

                return price / scale;
            } else {
                return _assetPrices[asset].mantissa;
            }
        }
    }

    /**
     * @notice retrieves price of an asset
     * @dev function to get price for an asset
     * @param asset Asset for which to get the price
     * @return uint mantissa of asset price (scaled by 1e18) or zero if unset or contract paused
     */
    function getPrice(address asset) public view returns (uint256) {
        return assetPrices(asset);
    }

    /**
     * @notice retrieves exchange rate info of an asset
     * @dev function to get exchange rate info for an asset
     * @param asset Asset for which to get the exchange rate info
     * @return exchange rate info
     */
    function getExchangeRateInfo(address asset, uint256 interval)
        public
        view
        returns (
            uint256,
            address,
            address,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            _assetPrices[asset].mantissa,
            exchangeRates[asset].exchangeRateModel,
            ExchangeRateModel(exchangeRates[asset].exchangeRateModel).token(),
            ExchangeRateModel(exchangeRates[asset].exchangeRateModel).scale(),
            ExchangeRateModel(exchangeRates[asset].exchangeRateModel)
                .getExchangeRate(),
            ExchangeRateModel(exchangeRates[asset].exchangeRateModel)
                .getFixedInterestRate(interval)
        );
    }

    struct SetPriceLocalVars {
        Exp price;
        Exp swing;
        Exp anchorPrice;
        uint256 anchorPeriod;
        uint256 currentPeriod;
        bool priceCapped;
        uint256 cappingAnchorPriceMantissa;
        uint256 pendingAnchorMantissa;
    }

    /**
     * @notice entry point for updating prices
     * @dev function to set price for an asset
     * @param asset Asset for which to set the price
     * @param requestedPriceMantissa requested new price, scaled by 10**18
     * @return uint 0=success, otherwise a failure (see enum OracleError for details)
     */
    function setPrice(address asset, uint256 requestedPriceMantissa)
        public
        returns (uint256)
    {
        // Fail when msg.sender is not poster
        if (msg.sender != poster) {
            return
                failOracle(
                    asset,
                    OracleError.UNAUTHORIZED,
                    OracleFailureInfo.SET_PRICE_PERMISSION_CHECK
                );
        }

        return setPriceInternal(asset, requestedPriceMantissa);
    }

    function setPriceInternal(address asset, uint256 requestedPriceMantissa)
        internal
        returns (uint256)
    {
        // re-used for intermediate errors
        Error err;
        SetPriceLocalVars memory localVars;
        // We add 1 for currentPeriod so that it can never be zero and there's no ambiguity about an unset value.
        // (It can be a problem in tests with low block numbers.)
        localVars.currentPeriod = (block.number / numBlocksPerPeriod) + 1;
        localVars.pendingAnchorMantissa = pendingAnchors[asset];
        localVars.price = Exp({mantissa: requestedPriceMantissa});

        if (exchangeRates[asset].exchangeRateModel != address(0)) {
            uint256 currentExchangeRate = ExchangeRateModel(
                exchangeRates[asset]
                    .exchangeRateModel
            )
                .getExchangeRate();
            uint256 scale = ExchangeRateModel(
                exchangeRates[asset]
                    .exchangeRateModel
            )
                .scale();
            uint256 currentChangeRate;
            (err, currentChangeRate) = mul(currentExchangeRate, scale);
            assert(err == Error.NO_ERROR);

            currentChangeRate =
                currentChangeRate /
                exchangeRates[asset].exchangeRate;
            require(
                currentExchangeRate >= exchangeRates[asset].exchangeRate &&
                    currentChangeRate <= exchangeRates[asset].maxSwingRate,
                "setPriceInternal: Abnormal exchange rate."
            );
            exchangeRates[asset].exchangeRate = currentExchangeRate;
        }

        if (localVars.pendingAnchorMantissa != 0) {
            // let's explicitly set to 0 rather than relying on default of declaration
            localVars.anchorPeriod = 0;
            localVars.anchorPrice = Exp({
                mantissa: localVars.pendingAnchorMantissa
            });

            // Verify movement is within max swing of pending anchor (currently: 10%)
            (err, localVars.swing) = calculateSwing(
                localVars.anchorPrice,
                localVars.price
            );
            if (err != Error.NO_ERROR) {
                return
                    failOracleWithDetails(
                        asset,
                        OracleError.FAILED_TO_SET_PRICE,
                        OracleFailureInfo.SET_PRICE_CALCULATE_SWING,
                        uint256(err)
                    );
            }

            // Fail when swing > maxSwing
            if (greaterThanExp(localVars.swing, maxSwing)) {
                return
                    failOracleWithDetails(
                        asset,
                        OracleError.FAILED_TO_SET_PRICE,
                        OracleFailureInfo.SET_PRICE_MAX_SWING_CHECK,
                        localVars.swing.mantissa
                    );
            }
        } else {
            localVars.anchorPeriod = anchors[asset].period;
            localVars.anchorPrice = Exp({
                mantissa: anchors[asset].priceMantissa
            });

            if (localVars.anchorPeriod != 0) {
                (err, localVars.priceCapped, localVars.price) = capToMax(
                    localVars.anchorPrice,
                    localVars.price
                );
                if (err != Error.NO_ERROR) {
                    return
                        failOracleWithDetails(
                            asset,
                            OracleError.FAILED_TO_SET_PRICE,
                            OracleFailureInfo.SET_PRICE_CAP_TO_MAX,
                            uint256(err)
                        );
                }
                if (localVars.priceCapped) {
                    // save for use in log
                    localVars.cappingAnchorPriceMantissa = localVars
                        .anchorPrice
                        .mantissa;
                }
            } else {
                // Setting first price. Accept as is (already assigned above from requestedPriceMantissa) and use as anchor
                localVars.anchorPrice = Exp({mantissa: requestedPriceMantissa});
            }
        }

        // Fail if anchorPrice or price is zero.
        // zero anchor represents an unexpected situation likely due to a problem in this contract
        // zero price is more likely as the result of bad input from the caller of this function
        if (isZeroExp(localVars.anchorPrice)) {
            // If we get here price could also be zero, but it does not seem worthwhile to distinguish the 3rd case
            return
                failOracle(
                    asset,
                    OracleError.FAILED_TO_SET_PRICE,
                    OracleFailureInfo
                        .SET_PRICE_NO_ANCHOR_PRICE_OR_INITIAL_PRICE_ZERO
                );
        }

        if (isZeroExp(localVars.price)) {
            return
                failOracle(
                    asset,
                    OracleError.FAILED_TO_SET_PRICE,
                    OracleFailureInfo.SET_PRICE_ZERO_PRICE
                );
        }

        // BEGIN SIDE EFFECTS

        // Set pendingAnchor = Nothing
        // Pending anchor is only used once.
        if (pendingAnchors[asset] != 0) {
            pendingAnchors[asset] = 0;
        }

        // If currentPeriod > anchorPeriod:
        //  Set anchors[asset] = (currentPeriod, price)
        //  The new anchor is if we're in a new period or we had a pending anchor, then we become the new anchor
        if (localVars.currentPeriod > localVars.anchorPeriod) {
            anchors[asset] = Anchor({
                period: localVars.currentPeriod,
                priceMantissa: localVars.price.mantissa
            });
        }

        uint256 previousPrice = _assetPrices[asset].mantissa;

        setPriceStorageInternal(asset, localVars.price.mantissa);

        emit PricePosted(
            asset,
            previousPrice,
            requestedPriceMantissa,
            localVars.price.mantissa
        );

        if (localVars.priceCapped) {
            // We have set a capped price. Log it so we can detect the situation and investigate.
            emit CappedPricePosted(
                asset,
                requestedPriceMantissa,
                localVars.cappingAnchorPriceMantissa,
                localVars.price.mantissa
            );
        }

        return uint256(OracleError.NO_ERROR);
    }

    // As a function to allow harness overrides
    function setPriceStorageInternal(address asset, uint256 priceMantissa)
        internal
    {
        _assetPrices[asset] = Exp({mantissa: priceMantissa});
    }

    // abs(price - anchorPrice) / anchorPrice
    function calculateSwing(Exp memory anchorPrice, Exp memory price)
        internal
        pure
        returns (Error, Exp memory)
    {
        Exp memory numerator;
        Error err;

        if (greaterThanExp(anchorPrice, price)) {
            (err, numerator) = subExp(anchorPrice, price);
            // can't underflow
            assert(err == Error.NO_ERROR);
        } else {
            (err, numerator) = subExp(price, anchorPrice);
            // Given greaterThan check above, price >= anchorPrice so can't underflow.
            assert(err == Error.NO_ERROR);
        }

        return divExp(numerator, anchorPrice);
    }

    function capToMax(Exp memory anchorPrice, Exp memory price)
        internal
        view
        returns (
            Error,
            bool,
            Exp memory
        )
    {
        Exp memory one = Exp({mantissa: mantissaOne});
        Exp memory onePlusMaxSwing;
        Exp memory oneMinusMaxSwing;
        Exp memory max;
        Exp memory min;
        // re-used for intermediate errors
        Error err;

        (err, onePlusMaxSwing) = addExp(one, maxSwing);
        if (err != Error.NO_ERROR) {
            return (err, false, Exp({mantissa: 0}));
        }

        // max = anchorPrice * (1 + maxSwing)
        (err, max) = mulExp(anchorPrice, onePlusMaxSwing);
        if (err != Error.NO_ERROR) {
            return (err, false, Exp({mantissa: 0}));
        }

        // If price > anchorPrice * (1 + maxSwing)
        // Set price = anchorPrice * (1 + maxSwing)
        if (greaterThanExp(price, max)) {
            return (Error.NO_ERROR, true, max);
        }

        (err, oneMinusMaxSwing) = subExp(one, maxSwing);
        if (err != Error.NO_ERROR) {
            return (err, false, Exp({mantissa: 0}));
        }

        // min = anchorPrice * (1 - maxSwing)
        (err, min) = mulExp(anchorPrice, oneMinusMaxSwing);
        // We can't overflow here or we would have already overflowed above when calculating `max`
        assert(err == Error.NO_ERROR);

        // If  price < anchorPrice * (1 - maxSwing)
        // Set price = anchorPrice * (1 - maxSwing)
        if (lessThanExp(price, min)) {
            return (Error.NO_ERROR, true, min);
        }

        return (Error.NO_ERROR, false, price);
    }

    /**
     * @notice entry point for updating multiple prices
     * @dev function to set prices for a variable number of assets.
     * @param assets a list of up to assets for which to set a price. required: 0 < assets.length == requestedPriceMantissas.length
     * @param requestedPriceMantissas requested new prices for the assets, scaled by 10**18. required: 0 < assets.length == requestedPriceMantissas.length
     * @return uint values in same order as inputs. For each: 0=success, otherwise a failure (see enum OracleError for details)
     */
    function setPrices(
        address[] memory assets,
        uint256[] memory requestedPriceMantissas
    ) public returns (uint256[] memory) {
        uint256 numAssets = assets.length;
        uint256 numPrices = requestedPriceMantissas.length;
        uint256[] memory result;

        // Fail when msg.sender is not poster
        if (msg.sender != poster) {
            result = new uint256[](1);
            result[0] = failOracle(
                address(0x0),
                OracleError.UNAUTHORIZED,
                OracleFailureInfo.SET_PRICE_PERMISSION_CHECK
            );
            return result;
        }

        if ((numAssets == 0) || (numPrices != numAssets)) {
            result = new uint256[](1);
            result[0] = failOracle(
                address(0x0),
                OracleError.FAILED_TO_SET_PRICE,
                OracleFailureInfo.SET_PRICES_PARAM_VALIDATION
            );
            return result;
        }

        result = new uint256[](numAssets);

        for (uint256 i = 0; i < numAssets; i++) {
            result[i] = setPriceInternal(assets[i], requestedPriceMantissas[i]);
        }

        return result;
    }
}

pragma solidity 0.5.12;

import "./library/DSAuth.sol";
import "./library/SafeMath.sol";
import "./library/ERC20SafeTransfer.sol";

import "./interface/IDToken.sol";

contract DFDistributor is DSAuth, ERC20SafeTransfer {
    using SafeMath for uint256;

    uint256 constant BASE = 10**18;

    address[] public dTokens;

    /// @notice The DF distribution speed for all DTokens in total
    uint256 public totalSpeed;

    /// @notice The DF distribution speed for each DToken
    mapping(address => uint256) public tokenSpeed;

    struct DTokenState {
        /// @notice The last index of token
        uint256 index;
        /// @notice The block number of the last index was updated
        uint256 block;
    }

    /// @notice The DF distribution index for each DToken
    mapping(address => DTokenState) public dTokenState;

    /// @notice The DF distribution index for each user of each DToken
    mapping(address => mapping(address => uint256)) public userIndex;

    mapping(address => uint256) public userAccrued;

    /**
     * @dev Authorized function to add DTokens
     * @param _dTokens the list of dTokens for DF distribution.
     */
    function addDTokens(address[] calldata _dTokens) external auth {
        for (uint256 i = 0; i < _dTokens.length; i++) {
            address dToken = _dTokens[i];
            require(dToken != address(0), "setDTokens: dToken address invalid");

            DTokenState storage state = dTokenState[dToken];

            require(
                state.index == 0 && state.block == 0,
                "setDTokens: dToken has already been added to distribution list"
            );

            dTokens.push(dToken);

            // Update the storage
            dTokenState[dToken] = DTokenState({block: block.number, index: 0});
        }

        updateDTokenSpeedByInterestContribution();
    }

    /**
     * @dev Authorized function to set how much DF will be distributed to all DTokens
     * @param speed the speed of DF distribution.
     */
    function setTotalSpeed(uint256 speed) external auth {
        uint256 oldSpeed = totalSpeed;
        totalSpeed = speed;

        updateDTokenSpeedByInterestContribution();
    }

    function updateDTokenSpeedByInterestContribution() internal {
        address[] memory _dTokens = dTokens;

        // Update all indexes, new speed will be used to calculate new indexes
        for (uint256 i = 0; i < _dTokens.length; i++) {
            updateDTokenIndex(_dTokens[i]);
        }

        // TODO: Set speed base on the interest contribution
        // Now just distribute evenly
        uint256 _tokenSpeed = totalSpeed.div(dTokens.length);

        for (uint256 i = 0; i < dTokens.length; i++) {
            tokenSpeed[_dTokens[i]] = _tokenSpeed;
        }
    }

    /**
     * @dev Authorized function to set how much DF will be distributed to each DToken.
     *      This will overwrite the speed set by `setGlobalSpeed()`
     * @param speeds the list of speeds for each dToken.
     */
    function setDTokenSpeeds(uint256[] calldata speeds) external auth {
        address[] memory _dTokens = dTokens;

        require(
            speeds.length == _dTokens.length,
            "updateDTokenSpeeds: speeds' length do not match dTokens length"
        );

        for (uint256 i = 0; i < dTokens.length; i++) {
            tokenSpeed[_dTokens[i]] = speeds[i];
        }
    }

    /**
     * @dev Internal function to update how much DF have been earned for each DToken.
     * @param dToken the dToken to be updated.
     */
    function updateDTokenIndex(address dToken) internal {
        DTokenState storage state = dTokenState[dToken];
        uint256 index;

        require(
            state.block > 0,
            "updateDTokenIndex: dToken is not in distribution list"
        );

        uint256 blockDelta = block.number - state.block;

        // Nothing to update
        if (blockDelta == 0) return;

        uint256 totalSupply = IDToken(dToken).totalSupply();
        uint256 speed = tokenSpeed[dToken];
        if (totalSupply > 0 && speed > 0) {
            uint256 accrued = speed * blockDelta;
            index = state.index + rdiv(accrued, totalSupply);
            state.index = index;
        }

        state.block = block.number;
    }

    /**
     * @dev Update the earned DF index of each DToken by adding extra DF distribution.
     *      typical case would be DF swap from other governance token earned.
     * @param dToken the dToken to be updated.
     * @param extra the extra amount to add.
     */
    function updateDTokenIndexExtra(address dToken, uint256 extra)
        external
        auth
    {
        DTokenState storage state = dTokenState[dToken];

        uint256 totalSupply = IDToken(dToken).totalSupply();
        if (totalSupply > 0) {
            state.index = state.index + rdiv(extra, totalSupply);
        }
    }

    /**
     * @dev Calculate the accrued DF for account
     * @param dToken the dToken to query.
     * @param account the account to query.
     */
    function updateAccruedDF(address dToken, address account) public {
        updateDTokenIndex(dToken);

        uint256 indexDelta = dTokenState[dToken].index -
            userIndex[dToken][account];
        uint256 accrued = rmul(IDToken(dToken).balanceOf(account), indexDelta);

        userIndex[dToken][account] = dTokenState[dToken].index;
        userAccrued[account] = userAccrued[account] + accrued;
    }

    function claimDF(address dToken, address account) external {
        updateAccruedDF(dToken, account);

        //Transfer accrued DF
        address DF = 0x6082731fdAba4761277Fb31299ebC782AD3bCf24;
        uint256 accrued = userAccrued[account];
        if (doTransferOut(DF, account, accrued)) {
            userAccrued[account] = 0;
        }
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(BASE).div(y);
    }

    function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(y) / BASE;
    }
}

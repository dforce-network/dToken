pragma solidity 0.5.12;

import "./library/DSAuth.sol";
import "./library/SafeMath.sol";
import "./library/ERC20SafeTransfer.sol";

import "./interface/IDToken.sol";

contract DFDistributor is DSAuth, ERC20SafeTransfer {
    using SafeMath for uint256;

    uint256 constant BASE = 10**18;

    address[] public dTokens;

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
    }

    /**
     * @dev Authorized function to set how much DF will be distributed to all DTokens
     * @param speed the speed of DF distribution.
     */
    function setGlobalSpeed(uint256 speed) external auth {
        address[] memory _dTokens = dTokens;

        // TODO: Set speed base on the interest contribution
        // Now just distribute evenly
        uint256 _tokenSpeed = speed.div(dTokens.length);

        for (uint256 i = 0; i < dTokens.length; i++) {
            tokenSpeed[_dTokens[i]] = _tokenSpeed;
        }
    }

    /**
     * @dev Authorized function to set how much DF will be distributed to each DToken.
     *      This will overwrite the speed set by `setGlobalSpeed()`
     * @param speeds the list of speeds for each dToken.
     */
    function updateDTokenSpeeds(uint256[] calldata speeds) external auth {
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

        uint256 totalSupply = IDToken(dToken).totalSupply();

        if (totalSupply > 0) {
            uint256 blockDelta = block.number - state.block;
            uint256 accrued = tokenSpeed[dToken] * blockDelta;
            index = state.index + rdiv(accrued, totalSupply);
            state.index = index;
        }

        // Update the storage
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
    function calculateAccruedDF(address dToken, address account)
        public
        returns (uint256 accrued)
    {
        updateDTokenIndex(dToken);

        uint256 indexDelta = dTokenState[dToken].index -
            userIndex[dToken][account];

        accrued = rmul(IDToken(dToken).balanceOf(account), indexDelta);
    }

    function updateUserIndex(address dToken, address account)
        internal
        returns (uint256)
    {
        userIndex[dToken][account] = dTokenState[dToken].index;
    }

    function claimDF(address dToken, address account) external {
        uint256 accrued = calculateAccruedDF(dToken, account);
        updateUserIndex(dToken, account);

        //Transfer accrued DF
        address DF = 0x6082731fdAba4761277Fb31299ebC782AD3bCf24;

        // TODO: Where should we transfer DF from or where should we store the DF
        // Should store the accured DF in case that there is not enough DF to transfer
        require(
            doTransferOut(DF, account, accrued),
            "claimDF: transfer to target handler failed"
        );
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(BASE).div(y);
    }

    function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(y) / BASE;
    }
}

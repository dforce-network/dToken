pragma solidity 0.5.12;

import "./library/DSAuth.sol";
import "./library/SafeMath.sol";
import "./library/ERC20SafeTransfer.sol";

import "./interface/IDToken.sol";

contract DFDistributor is DSAuth, ERC20SafeTransfer {
    using SafeMath for uint256;

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
    mapping(address => DTokenState) public tokenState;

    /// @notice The DF distribution index for each user of each DToken
    mapping(address => mapping(address => uint256)) public userIndex;

    /**
     * @dev Authorized function to set DTokens
     * @param _dTokens the list of dTokens for DF distribution.
     */
    function setDTokens(address[] calldata _dTokens) external auth {
        delete dTokens;

        for (uint256 i = 0; i < _dTokens.length; i++) {
            require(
                _dTokens[i] != address(0),
                "setDTokens: dToken address invalid"
            );

            //TODO: Do not allow to set the same address twice

            dTokens.push(_dTokens[i]);
        }
    }

    /**
     * @dev Authorized function to set how much DF will be distributed to all DTokens
     * @param speed the speed of DF distribution.
     */
    function setGlobalSpeed(uint256 speed) external auth {
        address[] memory _dTokens = dTokens;

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
    function updateDTokenSpeeds(uint256[] memory speeds) public auth {
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
        DTokenState storage state = tokenState[dToken];
        uint256 index;

        if (state.block != 0) {
            uint256 blockDelta = block.number - state.block;
            uint256 accrued = tokenSpeed[dToken] * blockDelta;
            index = state.index + accrued.div(IDToken(dToken).totalSupply());
        }

        // Update the storage
        state.block = block.number;
        state.index = index;
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
        DTokenState storage state = tokenState[dToken];
        state.index = state.index + extra.div(IDToken(dToken).totalSupply());
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

        uint256 indexDelta = tokenState[dToken].index -
            userIndex[dToken][account];

        accrued = IDToken(dToken).balanceOf(account).mul(indexDelta);
    }

    function updateUserIndex(address dToken, address account)
        internal
        returns (uint256)
    {
        userIndex[dToken][account] = tokenState[dToken].index;
    }

    function claimDF(address dToken, address account) external {
        uint256 accrued = calculateAccruedDF(dToken, account);
        updateUserIndex(dToken, account);

        //Transfer accrued DF
        address DF = 0x4607B8eBBC7953d709238937844327EA107462F9;

        // TODO: Where should we transfer DF from or where should we store the DF
        // Should store the accured DF in case that there is not enough DF to transfer
        require(
            doTransferOut(DF, account, accrued),
            "claimDF: transfer to target handler failed"
        );
    }
}

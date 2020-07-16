pragma solidity 0.5.12;

import "./library/Pausable.sol";
import "./library/ERC20SafeTransfer.sol";
import "./library/SafeMath.sol";
import "./interface/IDTokenController.sol";

contract Handler is ERC20SafeTransfer, Pausable {
    using SafeMath for uint256;
    bool private initialized; // Flags for initializing data
    address public dTokenController; // dToken mapping contract

    mapping(address => bool) private tokensEnable; // Supports token or not

    event NewdTokenAddresses(
        address indexed originalDToken,
        address indexed newDToken
    );
    event DisableToken(address indexed underlyingToken);
    event EnableToken(address indexed underlyingToken);

    // --- Init ---
    // This function is used with contract proxy, do not modify this function.
    function initialize(address _dTokenController) public {
        require(!initialized, "initialize: Already initialized!");
        owner = msg.sender;
        dTokenController = _dTokenController;
        initialized = true;
    }

    /**
     * @dev Update dToken mapping contract.
     * @param _newDTokenController The new dToken mapping contact.
     */
    function setDTokenController(address _newDTokenController) external auth {
        require(
            _newDTokenController != dTokenController,
            "setDTokenController: The same dToken mapping contract address!"
        );
        address _originalDTokenController = dTokenController;
        dTokenController = _newDTokenController;
        emit NewdTokenAddresses(
            _originalDTokenController,
            _newDTokenController
        );
    }

    /**
     * @dev Authorized function to disable some underlying tokens.
     * @param _underlyingTokens Tokens to disable.
     */
    function disableTokens(address[] calldata _underlyingTokens) external auth {
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _disableToken(_underlyingTokens[i]);
        }
    }

    /**
     * @dev Authorized function to enable some underlying tokens.
     * @param _underlyingTokens Tokens to enable.
     */
    function enableTokens(address[] calldata _underlyingTokens) external auth {
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            _enableToken(_underlyingTokens[i]);
        }
    }

    function _disableToken(address _underlyingToken) internal {
        require(
            tokensEnable[_underlyingToken],
            "disableToken: Has been disabled!"
        );
        tokensEnable[_underlyingToken] = false;
        emit DisableToken(_underlyingToken);
    }

    function _enableToken(address _underlyingToken) internal {
        require(
            !tokensEnable[_underlyingToken],
            "enableToken: Has been enabled!"
        );
        tokensEnable[_underlyingToken] = true;
        emit EnableToken(_underlyingToken);
    }

    /**
     * @dev The _underlyingToken approves to dToken contract.
     * @param _underlyingToken Token address to approve.
     */
    function approve(address _underlyingToken, uint256 amount) public auth {
        address _dToken = IDTokenController(dTokenController).getDToken(
            _underlyingToken
        );

        require(
            doApprove(_underlyingToken, _dToken, amount),
            "approve: Approve dToken failed!"
        );
    }

    /**
     * @dev Support token or not.
     * @param _underlyingToken Token to check.
     */
    function tokenIsEnabled(address _underlyingToken)
        public
        view
        returns (bool)
    {
        return tokensEnable[_underlyingToken];
    }
}

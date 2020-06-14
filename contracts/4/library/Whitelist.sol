pragma solidity ^0.4.24;

contract DSAuthority {
    function canCall(
        address src,
        address dst,
        bytes4 sig
    ) public view returns (bool);
}

contract DSAuthEvents {
    event LogSetAuthority(address indexed authority);
    event LogSetOwner(address indexed owner);
    event OwnerUpdate(address indexed owner, address indexed newOwner);
}

contract DSAuth is DSAuthEvents {
    DSAuthority public authority;
    address public owner;
    address public newOwner;

    constructor() public {
        owner = msg.sender;
        emit LogSetOwner(msg.sender);
    }

    // Warning: you should absolutely sure you want to give up authority!!!
    function disableOwnership() public onlyOwner {
        owner = address(0);
        emit OwnerUpdate(msg.sender, owner);
    }

    function transferOwnership(address newOwner_) public onlyOwner {
        require(newOwner_ != owner, "TransferOwnership: the same owner.");
        newOwner = newOwner_;
    }

    function acceptOwnership() public {
        require(
            msg.sender == newOwner,
            "AcceptOwnership: only new owner do this."
        );
        emit OwnerUpdate(owner, newOwner);
        owner = newOwner;
        newOwner = address(0x0);
    }

    ///[snow] guard is Authority who inherit DSAuth.
    function setAuthority(DSAuthority authority_) public onlyOwner {
        authority = authority_;
        emit LogSetAuthority(address(authority));
    }

    modifier onlyOwner {
        require(isOwner(msg.sender), "ds-auth-non-owner");
        _;
    }

    function isOwner(address src) internal view returns (bool) {
        return bool(src == owner);
    }

    modifier auth {
        require(isAuthorized(msg.sender, msg.sig), "ds-auth-unauthorized");
        _;
    }

    function isAuthorized(address src, bytes4 sig)
        internal
        view
        returns (bool)
    {
        if (src == address(this)) {
            return true;
        } else if (src == owner) {
            return true;
        } else if (authority == DSAuthority(0)) {
            return false;
        } else {
            return authority.canCall(src, address(this), sig);
        }
    }
}

contract Whitelist is DSAuth {
    bytes32 public constant ANY = bytes32(uint256(-1));

    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => bool)))
        private _whitelist;

    event WhitelistAdded(
        bytes32 indexed account,
        bytes32 indexed underlyingToken,
        bytes32 indexed functionName
    );

    event WhitelistRemoved(
        bytes32 indexed account,
        bytes32 indexed underlyingToken,
        bytes32 indexed functionName
    );

    function isWhitelist(
        address account,
        bytes4 functionName,
        address underlyingToken
    ) public view returns (bool) {
        bytes32 _account = bytes32(bytes20(account));
        bytes32 _underlyingToken = bytes32(bytes20(underlyingToken));

        return
            _whitelist[_account][functionName][_underlyingToken] ||
            _whitelist[_account][ANY][_underlyingToken] ||
            _whitelist[_account][functionName][ANY] ||
            _whitelist[_account][ANY][ANY];
    }

    function permitAll(address account) public auth {
        _addWhitelist(bytes32(bytes20(account)), ANY, ANY);
    }

    function forbidAll(address account) public auth {
        _removeWhitelist(bytes32(bytes20(account)), ANY, ANY);
    }

    function addWhitelists(
        address account,
        bytes32 functionName,
        address[] memory underlyingTokens
    ) public auth returns (bool) {
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            _addWhitelist(
                bytes32(bytes20(account)),
                functionName,
                bytes32(bytes20(underlyingTokens[i]))
            );
        }
    }

    function removeWhitelists(
        address account,
        bytes32 functionName,
        bytes32[] memory underlyingTokens
    ) public auth returns (bool) {
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            _removeWhitelist(
                bytes32(bytes20(account)),
                functionName,
                bytes32(bytes20(underlyingTokens[i]))
            );
        }
    }

    function _addWhitelist(
        bytes32 account,
        bytes32 functionName,
        bytes32 underlyingToken
    ) internal {
        _whitelist[account][functionName][underlyingToken] = true;
        emit WhitelistAdded(account, underlyingToken, functionName);
    }

    function _removeWhitelist(
        bytes32 account,
        bytes32 functionName,
        bytes32 underlyingToken
    ) internal {
        _whitelist[account][functionName][underlyingToken] = false;
        emit WhitelistRemoved(account, underlyingToken, functionName);
    }
}

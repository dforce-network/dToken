pragma solidity 0.5.12;

interface IController {
    function hasiToken(address _iToken) external view returns (bool);
    function rewardDistributor() external view returns (IRewardDistributor);
}

interface IRewardDistributor {
    function claimAllReward(address[] calldata _holders) external;
    function claimReward(address[] calldata _holders, address[] calldata _iTokens) external;

    function rewardToken() external view returns (address);
}

interface IiToken {
    function mint(address _recipient, uint256 _mintAmount) external;

    function redeem(address _from, uint256 _redeemiToken) external;

    function redeemUnderlying(address _from, uint256 _redeemUnderlying) external;

    function balanceOfUnderlying(address _account) external returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function getCash() external view returns (uint256);

    function controller() external view returns (IController);

    function underlying() external view returns (address);

    function isiToken() external view returns (bool);
}


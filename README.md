# dToken

[![CircleCI](https://circleci.com/gh/dforce-network/dToken/tree/dev.svg?style=svg)](<(https://circleci.com/gh/dforce-network/dToken/tree/dev.svg?style=svg)>)

## Usage

Install buidler and plugins

```
npm install
mv .example.env .env
```

Run the following commands to compile all contracts:

```
npx buidler compile
```

To run the tests:

```
npx buidler test
```

To deploy contracts, need to set basic config parameters in `.env`:

```
INFURA_APIKEY: Infura key.
PRIVATE_KEY: Private key of deployer account.
```

Deploy contracts at the local:

```
truffle migrate
```

Deploy contracts at the testnet: Kovan.

```
truffle migrate --network kovan
```

Run a local develop network with buidler EVM:

```
npx buidler node
```

## Ethereum Mainnet Contract(2020-07-23)

<table>
	<tr>
        <th>Contract Name</th>
    	<th>Contract Address</th>
	</tr>
	<tr>
		<td> DToken Controller </td>
		<td> 0x9b6bA9e66A2422F1D62f6F83a46A129De907967b </td>
	</tr>
	<tr>
		<td> Internal Handler </td>
		<td> 0x885dD179c76ee5949B9053F1958bA3a91e4CF592 </td>
	</tr>
	<tr>
		<td> Compound Handler </td>
		<td> 0xBcDD2a069a46E9b5D032D2F99725418508CE6Aee </td>
	</tr>
	<tr>
		<td> Aave Handler </td>
		<td> 0xbb7D75BE4dc8Eb15FF90422137C0a5BcBd316953 </td>
	</tr>
	<tr>
		<td> USR Handler </td>
		<td> 0x8916A9B0064Feab04b3BF3729ADBB0bE119eD12D </td>
	</tr>
	<tr>
		<td> DAI </td>
		<td> 0x6B175474E89094C44Da98b954EedeAC495271d0F </td>
	</tr>
	<tr>
		<td> dDAI </td>
		<td> 0x02285AcaafEB533e03A7306C55EC031297df9224 </td>
	</tr>
	<tr>
		<td> PAX </td>
		<td> 0x8E870D67F660D95d5be530380D0eC0bd388289E1 </td>
	</tr>
	<tr>
		<td> dPAX </td>
		<td> 0xF4dFc3Df8C83Be5a2ec2025491fd157c474f438a </td>
	</tr>
	<tr>
		<td> TUSD </td>
		<td> 0x0000000000085d4780B73119b644AE5ecd22b376 </td>
	</tr>
	<tr>
		<td> dTUSD </td>
		<td> 0x55BCf7173C8840d5517424eD19b7bbF11CFb9F2B </td>
	</tr>
	<tr>
		<td> USDC </td>
		<td> 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 </td>
	</tr>
	<tr>
		<td> dUSDC </td>
		<td> 0x16c9cF62d8daC4a38FB50Ae5fa5d51E9170F3179 </td>
	</tr>
	<tr>
		<td> USDT </td>
		<td> 0xdAC17F958D2ee523a2206206994597C13D831ec7 </td>
	</tr>
	<tr>
		<td> dUSDT </td>
		<td> 0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8 </td>
	</tr>
	<tr>
		<td> USDx </td>
		<td> 0xeb269732ab75A6fD61Ea60b06fE994cD32a83549 </td>
	</tr>
	<tr>
		<td> dUSDx </td>
		<td> 0x109917F7C3b6174096f9E1744e41ac073b3E1F72 </td>
	</tr>
</table>

## Ethereum Kovan Contract(2020-07-22)

<table>
	<tr>
        <th>Contract Name</th>
    	<th>Contract Address</th>
	</tr>
	<tr>
		<td> DToken Controller </td>
		<td> 0xF1b95BebBF98bCE74C31fdB0e6548Cf943d17a08 </td>
	</tr>
	<tr>
		<td> Internal Handler </td>
		<td> 0xe5683ccab068627d9EA9a35f988c371Fc1727aF5 </td>
	</tr>
	<tr>
		<td> Compound Handler </td>
		<td> 0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1 </td>
	</tr>
	<tr>
		<td> Market Handler </td>
		<td> 0x0d4c0A915c933FA197B965C294c933514CCCf4B1 </td>
	</tr>
	<tr>
		<td> Aave Handler </td>
		<td> 0xAfA9171828d3B2345638021647598F15F77c0e3A </td>
	</tr>
	<tr>
		<td> USR Handler </td>
		<td> 0xaD44F145C888116A74EA4d89eB9394c1A7a3E317 </td>
	</tr>
	<tr>
		<td> DAI </td>
		<td> 0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa </td>
	</tr>
	<tr>
		<td> dDAI </td>
		<td> 0x19205bFDaf1BC9fC8705eA9a73f560572fb8F455 </td>
	</tr>
	<tr>
		<td> TUSD </td>
		<td> 0x1c4a937d171752e1313D70fb16Ae2ea02f86303e </td>
	</tr>
	<tr>
		<td> dTUSD </td>
		<td> 0x938C3681fE2Ef6D3A722cb387F4AE79D16911c3A </td>
	</tr>
	<tr>
		<td> USDC </td>
		<td> 0xb7a4F3E9097C08dA09517b5aB877F7a917224ede </td>
	</tr>
	<tr>
		<td> dUSDC </td>
		<td> 0x48ace95b02dF44E1b6A0Abe4eCec6dd473A20591 </td>
	</tr>
	<tr>
		<td> USDT </td>
		<td> 0x07de306FF27a2B630B1141956844eB1552B956B5 </td>
	</tr>
	<tr>
		<td> dUSDT </td>
		<td> 0xD289A11665A2c19010a3762eE3b9B2164da41b63 </td>
	</tr>
	<tr>
		<td> USDx </td>
		<td> 0x617e288A149502eC0b7f8282Ccaef093C1C1fAbF </td>
	</tr>
	<tr>
		<td> dUSDx </td>
		<td> 0xA83D3183ef8f284bB2FeC3faB39160c7B6605c48 </td>
	</tr>
</table>


## [BSC Chain](https://bscscan.com/) Mainnet Contract(2020-11-28)

<table>
	<tr>
        <th>Contract Name</th>
    	<th>Contract Address</th>
	</tr>
	<tr>
		<td> DToken Controller </td>
		<td> 0x7F15bf6D40bfEE79099bCcA893a30B72Aee6C9Eb </td>
	</tr>
	<tr>
		<td> Internal Handler </td>
		<td> 0xC46751E2494897eB34E2297bEB649672dBabF975 </td>
	</tr>
	<tr>
		<td> Cream Handler </td>
		<td> 0xdE399d88eA8331fE2F18306793893a46D142cc5f </td>
	</tr>
	<tr>
		<td> BUSD </td>
		<td> 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56 </td>
	</tr>
	<tr>
		<td> dBUSD </td>
		<td> 0xce14792a280b20c4f8E1ae76805a6dfBe95729f5 </td>
	</tr>
	<tr>
		<td> DAI </td>
		<td> 0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3 </td>
	</tr>
	<tr>
		<td> dDAI </td>
		<td> 0x4E0B5BaFC52D09A8F18eA0b7a6A7dc23A1096f99 </td>
	</tr>
	<tr>
		<td> USDC </td>
		<td> 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d </td>
	</tr>
	<tr>
		<td> dUSDC </td>
		<td> 0x6c0F322442D10269Dd557C6e3A56dCC3a1198524 </td>
	</tr>
	<tr>
		<td> USDT </td>
		<td> 0x55d398326f99059fF775485246999027B3197955 </td>
	</tr>
	<tr>
		<td> dUSDT </td>
		<td> 0x6199cC917C12E4735B4e9cEfbe29E9F0F75Af9E5 </td>
	</tr>
</table>
 

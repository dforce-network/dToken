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

## Kovan Contract Address(2020-07-02)

<table>
	<tr>
        <th>Contract Name</th>
    	<th>Contract Address</th>
	</tr>
	<tr>
		<td> Base Data </td>
		<td> 0x80df99FAeaD7BDcf54FF18554860b3A24e4D68B5 </td>
	</tr>
	<tr>
		<td> DS Guard </td>
		<td> 0x9C5d3aa9f39c1502c88dc511EaaBDa2c43F6Da4C </td>
	</tr>
	<tr>
		<td> DToken Controller </td>
		<td> 0x03966E64a344BC5a441E3606cD1C32141974722E </td>
	</tr>
	<tr>
		<td> Internal Handler </td>
		<td> 0x4E84faB293525594d7eAD204fb7cF9715444f620 </td>
	</tr>
	<tr>
		<td> Compound Handler </td>
		<td> 0xB71E9176Df98E6e81B6262Ce19fcF5448f1cF5f1 </td>
	</tr>
	<tr>
		<td> Aave Handler </td>
		<td> 0x030D97028a509C48d361d999c2A63d312667802E </td>
	</tr>
	<tr>
		<td> dUSDC </td>
		<td> 0x4013066b115Aaa42481315611896aB59c37401c4 </td>
	</tr>
	<tr>
		<td> dUSDT </td>
		<td> 0x44bf230C56a235aB5136cfc41d5F02C7bA8a2143 </td>
	</tr>
</table>

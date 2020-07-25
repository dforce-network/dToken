function env() {
  if (process.env.NODE_ENV === "development") {
    return {
      ENV: "development",
      ADDRESS: {
        main: {
          // USDT: "0x545486F33f8Ac50fe706e7DC5902204879464f93",
          // dUSDT: "0x8f0400e5d3b7358a15e643DAA29f6943f758BD73",
          USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          dUSDT: "0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8",
          USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          dUSDC: "0x16c9cF62d8daC4a38FB50Ae5fa5d51E9170F3179",
          DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          dDAI: "0x02285AcaafEB533e03A7306C55EC031297df9224",
          DTokenCommonData: "0xd407884f6d74eb1b62680901e2ec6d14009b270e",
        },
        kovan: {
          USDT: "0x07de306FF27a2B630B1141956844eB1552B956B5",
          dUSDT: "0x4c153111272cB826A80627c4A51c48ccB7d3153B",
          USDC: "0xb7a4F3E9097C08dA09517b5aB877F7a917224ede",
          dUSDC: "0xc801DF89680D00ABEd5599e9EE6b35ecb54d49Fc",
          DAI: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
          dDAI: "0x19205bFDaf1BC9fC8705eA9a73f560572fb8F455",
          TUSD: "0x1c4a937d171752e1313D70fb16Ae2ea02f86303e",
          dTUSD: "0x938C3681fE2Ef6D3A722cb387F4AE79D16911c3A",
          baseData: "0x80df99FAeaD7BDcf54FF18554860b3A24e4D68B5",
          Aave_Handler: "0xAfA9171828d3B2345638021647598F15F77c0e3A",
          Compound_Handler: "0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1",
          Internal_Handler: "0xe5683ccab068627d9EA9a35f988c371Fc1727aF5",
          DTokenCommonData: "0xdfad38b0e85712a8dd1928842ef2eec45eddcfe3",
          Handler: {
            '0xe5683ccab068627d9EA9a35f988c371Fc1727aF5': "Internal",
            '0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1': "Compound",
            '0x0d4c0A915c933FA197B965C294c933514CCCf4B1': "Compound1",
            '0xAfA9171828d3B2345638021647598F15F77c0e3A': "Aave"
          }
        },
      },
      DECIMALS: {
        main: {
          USDT: 6,
          USDC: 6,
          DAI: 18
        },
        kovan: {
          USDT: 6,
          USDC: 6,
          DAI: 18
        }
      }
    };
  } else {
    return {
      ENV: "production",
      ADDRESS: {
        main: {
          USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          dUSDT: "0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8",
          USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          dUSDC: "0x16c9cF62d8daC4a38FB50Ae5fa5d51E9170F3179",
          DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          dDAI: "0x02285AcaafEB533e03A7306C55EC031297df9224",
          DTokenCommonData: "0xd407884f6d74eb1b62680901e2ec6d14009b270e",
        },
        kovan: {
          USDT: "0x07de306FF27a2B630B1141956844eB1552B956B5",
          dUSDT: "0x4c153111272cB826A80627c4A51c48ccB7d3153B",
          USDC: "0xb7a4F3E9097C08dA09517b5aB877F7a917224ede",
          dUSDC: "0xc801DF89680D00ABEd5599e9EE6b35ecb54d49Fc",
          DAI: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
          dDAI: "0x19205bFDaf1BC9fC8705eA9a73f560572fb8F455",
          TUSD: "0x1c4a937d171752e1313D70fb16Ae2ea02f86303e",
          dTUSD: "0x938C3681fE2Ef6D3A722cb387F4AE79D16911c3A",
          baseData: "0x80df99FAeaD7BDcf54FF18554860b3A24e4D68B5",
          Aave_Handler: "0xAfA9171828d3B2345638021647598F15F77c0e3A",
          Compound_Handler: "0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1",
          Internal_Handler: "0xe5683ccab068627d9EA9a35f988c371Fc1727aF5",
          DTokenCommonData: "0xdfad38b0e85712a8dd1928842ef2eec45eddcfe3",
          Handler: {
            0xe5683ccab068627d9EA9a35f988c371Fc1727aF5: "Internal",
            0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1: "Compound",
            0x0d4c0A915c933FA197B965C294c933514CCCf4B1: "Compound1",
            0xAfA9171828d3B2345638021647598F15F77c0e3A: "Aave"
          }
        },
      },
      DECIMALS: {
        main: {
          USDT: 6,
          USDC: 6,
          DAI: 18
        },
        kovan: {
          USDT: 6,
          USDC: 6,
          DAI: 18
        }
      }
    };
  }
}
export default env();

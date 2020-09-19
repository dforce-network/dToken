function env() {
  if (process.env.NODE_ENV === "development") {
    return {
      URL_getBanlanceInfo: "https://markets.dforce.network/api/v1/getBanlanceInfo/",
      ENV: "development",
      ADDRESS: {
        main: {
          // USDT: "0x545486F33f8Ac50fe706e7DC5902204879464f93",
          // dUSDT: "0x8f0400e5d3b7358a15e643DAA29f6943f758BD73",
          USDx: "0xeb269732ab75a6fd61ea60b06fe994cd32a83549",
          dUSDx: "0x109917F7C3b6174096f9E1744e41ac073b3E1F72",
          USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          dUSDT: "0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8",
          USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          dUSDC: "0x16c9cF62d8daC4a38FB50Ae5fa5d51E9170F3179",
          DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          dDAI: "0x02285AcaafEB533e03A7306C55EC031297df9224",
          USR_Handler: "0x8916A9B0064Feab04b3BF3729ADBB0bE119eD12D",
          DTokenCommonData: "0xbD27cE697a32476098b788b239e57AacC6dFCF72",
          Handler: {
            '0x885dD179c76ee5949B9053F1958bA3a91e4CF592': "Internal",
            '0xBcDD2a069a46E9b5D032D2F99725418508CE6Aee': "Compound",
            '0xbb7D75BE4dc8Eb15FF90422137C0a5BcBd316953': "Aave",
            "0x8916A9B0064Feab04b3BF3729ADBB0bE119eD12D": "USR Handler"
          },
          TUSD: "0x0000000000085d4780B73119b644AE5ecd22b376",
          dTUSD: "0x55BCf7173C8840d5517424eD19b7bbF11CFb9F2B",
          PAX: "0x8E870D67F660D95d5be530380D0eC0bd388289E1",
          dPAX: "0xF4dFc3Df8C83Be5a2ec2025491fd157c474f438a",
        },
        kovan: {
          USDx: "0x617e288A149502eC0b7f8282Ccaef093C1C1fAbF",
          dUSDx: "0xA83D3183ef8f284bB2FeC3faB39160c7B6605c48",
          USDT: "0x07de306FF27a2B630B1141956844eB1552B956B5",
          dUSDT: "0x4c153111272cB826A80627c4A51c48ccB7d3153B",
          USDC: "0xb7a4F3E9097C08dA09517b5aB877F7a917224ede",
          dUSDC: "0xc801DF89680D00ABEd5599e9EE6b35ecb54d49Fc",
          DAI: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
          dDAI: "0x19205bFDaf1BC9fC8705eA9a73f560572fb8F455",
          TUSD: "0x1c4a937d171752e1313D70fb16Ae2ea02f86303e",
          dTUSD: "0x938C3681fE2Ef6D3A722cb387F4AE79D16911c3A",
          PAX: "0xfc26E36DA58618b52C14aeB1802E38dc58dFE7b6",
          dPAX: "0xDbBd202ffb3AD785037c183A8496F403010B8e29",
          baseData: "0x80df99FAeaD7BDcf54FF18554860b3A24e4D68B5",
          Aave_Handler: "0xAfA9171828d3B2345638021647598F15F77c0e3A",
          Compound_Handler: "0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1",
          Internal_Handler: "0xe5683ccab068627d9EA9a35f988c371Fc1727aF5",
          USR_Handler: "0xaD44F145C888116A74EA4d89eB9394c1A7a3E317",
          DTokenCommonData: "0x1a5e2ebf46c48c617841e8942b2ee9a32b87d7e9",
          Handler: {
            '0xe5683ccab068627d9EA9a35f988c371Fc1727aF5': "Internal",
            '0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1': "Compound",
            '0x0d4c0A915c933FA197B965C294c933514CCCf4B1': "Compound1",
            '0xAfA9171828d3B2345638021647598F15F77c0e3A': "Aave",
            "0xaD44F145C888116A74EA4d89eB9394c1A7a3E317": "USR Handler"
          }
        },
      },
      DECIMALS: {
        main: {
          USDT: 6,
          USDC: 6,
          DAI: 18,
          TUSD: 18,
          PAX: 18,
          USDx: 18
        },
        kovan: {
          USDT: 6,
          USDC: 6,
          DAI: 18,
          TUSD: 18,
          PAX: 18,
          USDx: 18
        }
      }
    };
  } else {
    return {
      URL_getBanlanceInfo: "https://markets.dforce.network/api/v1/getBanlanceInfo/",
      ENV: "production",
      ADDRESS: {
        main: {
          USDx: "0xeb269732ab75a6fd61ea60b06fe994cd32a83549",
          dUSDx: "0x109917F7C3b6174096f9E1744e41ac073b3E1F72",
          USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          dUSDT: "0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8",
          USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          dUSDC: "0x16c9cF62d8daC4a38FB50Ae5fa5d51E9170F3179",
          DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          dDAI: "0x02285AcaafEB533e03A7306C55EC031297df9224",
          USR_Handler: "0x8916A9B0064Feab04b3BF3729ADBB0bE119eD12D",
          DTokenCommonData: "0xbD27cE697a32476098b788b239e57AacC6dFCF72",
          Handler: {
            '0x885dD179c76ee5949B9053F1958bA3a91e4CF592': "Internal",
            '0xBcDD2a069a46E9b5D032D2F99725418508CE6Aee': "Compound",
            '0xbb7D75BE4dc8Eb15FF90422137C0a5BcBd316953': "Aave",
            "0x8916A9B0064Feab04b3BF3729ADBB0bE119eD12D": "USR Handler"
          },
          TUSD: "0x0000000000085d4780B73119b644AE5ecd22b376",
          dTUSD: "0x55BCf7173C8840d5517424eD19b7bbF11CFb9F2B",
          PAX: "0x8E870D67F660D95d5be530380D0eC0bd388289E1",
          dPAX: "0xF4dFc3Df8C83Be5a2ec2025491fd157c474f438a",
        },
        kovan: {
          USDx: "0x617e288A149502eC0b7f8282Ccaef093C1C1fAbF",
          dUSDx: "0xA83D3183ef8f284bB2FeC3faB39160c7B6605c48",
          USDT: "0x07de306FF27a2B630B1141956844eB1552B956B5",
          dUSDT: "0x4c153111272cB826A80627c4A51c48ccB7d3153B",
          USDC: "0xb7a4F3E9097C08dA09517b5aB877F7a917224ede",
          dUSDC: "0xc801DF89680D00ABEd5599e9EE6b35ecb54d49Fc",
          DAI: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
          dDAI: "0x19205bFDaf1BC9fC8705eA9a73f560572fb8F455",
          TUSD: "0x1c4a937d171752e1313D70fb16Ae2ea02f86303e",
          dTUSD: "0x938C3681fE2Ef6D3A722cb387F4AE79D16911c3A",
          PAX: "0xfc26E36DA58618b52C14aeB1802E38dc58dFE7b6",
          dPAX: "0xDbBd202ffb3AD785037c183A8496F403010B8e29",
          baseData: "0x80df99FAeaD7BDcf54FF18554860b3A24e4D68B5",
          Aave_Handler: "0xAfA9171828d3B2345638021647598F15F77c0e3A",
          Compound_Handler: "0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1",
          Internal_Handler: "0xe5683ccab068627d9EA9a35f988c371Fc1727aF5",
          USR_Handler: "0xaD44F145C888116A74EA4d89eB9394c1A7a3E317",
          DTokenCommonData: "0x1a5e2ebf46c48c617841e8942b2ee9a32b87d7e9",
          Handler: {
            '0xe5683ccab068627d9EA9a35f988c371Fc1727aF5': "Internal",
            '0xfc2F818A8b9761fC0852D2702B82a5392dbbcfe1': "Compound",
            '0x0d4c0A915c933FA197B965C294c933514CCCf4B1': "Compound1",
            '0xAfA9171828d3B2345638021647598F15F77c0e3A': "Aave",
            "0xaD44F145C888116A74EA4d89eB9394c1A7a3E317": "USR Handler"
          }
        },
      },
      DECIMALS: {
        main: {
          USDT: 6,
          USDC: 6,
          DAI: 18,
          TUSD: 18,
          PAX: 18,
          USDx: 18
        },
        kovan: {
          USDT: 6,
          USDC: 6,
          DAI: 18,
          TUSD: 18,
          PAX: 18,
          USDx: 18
        }
      }
    };
  }
}
export default env();

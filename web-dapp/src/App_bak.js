import React from 'react';
import './App.scss';
import './header.scss';
import './style/main-content.scss';
import Web3 from 'web3';
import 'antd/dist/antd.css';
import USDT_logo from './images/USDT.svg';
import USDC_logo from './images/USDC.svg';
import logo_xswap from './images/logo-dforce.svg';
import close from './images/close.svg';
import close_new from './images/close-new.svg';
// png
import usdc from './images/usdc.png';
import tusd from './images/tusd.png';
// add i18n.
import { IntlProvider, FormattedMessage } from 'react-intl';
import en_US from './language/en_US.js';
import zh_CN from './language/zh_CN';
import History from './component/history';
import Top from './component/top';

import Twitter from './images/twitter.svg';
import Telegram from './images/telegram.svg';
import Medium from './images/medium.svg';
import Reddit from './images/Reddit.svg';
import Discord from './images/Discord.svg';
import LinkedIn from './images/LinkedIn.svg';
import Youtube from './images/Youtube.svg';
import erweima from './images/erweima.png';
import weixin from './images/weixin.svg';
import arrow_u from './images/up.svg';
import wallet_metamask from './images/wallet-metamask.svg';

import arrow_d from './images/arrow_d.svg';
import img_is_open from './images/img_is_open.svg';
import { Menu, Dropdown, Drawer, Collapse, Tabs, Input, Button, Modal } from 'antd';
import {
  get_nettype,
  init_contract,
  get_my_account,
  check_approve,
  get_my_balance,
  mint_change,
  getBaseData,
  mint_click,
  get_tokens_options,
  format_bn,
  format_num_to_K,
  redeem_change,
  redeem_click,
  mint_max,
  redeem_max,
  get_balance__mint_redeem
} from './utils.js';

import ReactEcharts from 'echarts-for-react';
import tips from './style/tips.scss';
// import { promises } from 'fs-extra';

const { TabPane } = Tabs;


export default class App extends React.Component {
  constructor(porps) {
    super(porps);

    this.state = {
      cur_mint_token: 'USDT',
      cur_redeem_token: 'dUSDT',
      cur_language: navigator.language === 'zh-CN' ? '中文' : 'English',
      showonly: false,
      meun1: true,
      meun2: true,
      meun3: true,
      is_open: true,
      token_logo: {
        USDT: USDT_logo,
        USDC: USDC_logo
      },
      decimals: {
        USDT: 18,
        dUSDT: 18,
        USDC: 6,
        dUSDC: 6
      },
      APY: {},
      my_balance_mint: {},
      my_balance_redeem: {},
      net_value: {},
      cur_Option: {}
    }


    this.new_web3 = window.new_web3 = new Web3(Web3.givenProvider || null);
    this.bn = this.new_web3.utils.toBN;

    // console.log((!(~+[]) + {})[--[~+""][+[]] * [~+[]] + ~~!+[]] + ({} + [])[[~!+[]] * ~+[]]);
  }




  componentDidMount = () => {
    this.init_metamask_wallet();
  }

  set_mint_token = (token) => {
    if (token === this.state.cur_mint_token) {
      return console.log('is choosed...');
    }
    this.setState({
      cur_mint_token: token
    }, () => {
      this.setState({
        choosen_token_mint: token,
        is_already: true,
        cur_BaseData: this.state.BaseData['d' + token],
      })
    })
  }

  set_redeem_token = (token) => {
    console.log(token);
    if (token === this.state.cur_redeem_token) {
      return console.log('is choosed...');
    }
    this.setState({
      cur_redeem_token: token
    }, () => {
      this.setState({
        choosen_token_redeem: token,
        is_already: true,
        cur_BaseData: this.state.BaseData[token],
      })
    })
  }

  init_metamask_wallet = async () => {
    this.setState({
      show_wallets: false
    })

    let nettype = await get_nettype(this.new_web3);
    // init contract
    let contract_USDT = await init_contract(this.new_web3, nettype, 'USDT');
    let contract_dUSDT = await init_contract(this.new_web3, nettype, 'dUSDT', true);
    let contract_USDC = await init_contract(this.new_web3, nettype, 'USDC');
    let contract_dUSDC = await init_contract(this.new_web3, nettype, 'dUSDC', true);
    // get account && get approve
    let my_account = await get_my_account(this.new_web3);
    let is_approve_USDT = await check_approve(contract_USDT, 'dUSDT', my_account, nettype, this.bn);
    let is_approve_USDC = await check_approve(contract_USDC, 'dUSDC', my_account, nettype, this.bn);
    // get balance
    let my_balance_USDT = await get_my_balance(contract_USDT, my_account, nettype);
    let my_balance_dUSDT = await get_my_balance(contract_dUSDT, my_account, nettype);
    let my_balance_USDC = await get_my_balance(contract_USDC, my_account, nettype);
    let my_balance_dUSDC = await get_my_balance(contract_dUSDC, my_account, nettype);
    // get BaseData
    let BaseData_dUSDT = await getBaseData(contract_dUSDT);
    let BaseData_dUSDC = await getBaseData(contract_dUSDC);

    // console.log(BaseData);

    this.setState({
      net_type: nettype,
      contract: {
        USDT: contract_USDT,
        dUSDT: contract_dUSDT,
        USDC: contract_USDC,
        dUSDC: contract_dUSDC
      },
      my_account: my_account,
      is_approve: {
        USDT: is_approve_USDT,
        USDC: is_approve_USDC
      },
      my_balance_mint: {
        USDT: my_balance_USDT,
        USDC: my_balance_USDC
      },
      my_balance_redeem: {
        dUSDT: my_balance_dUSDT,
        dUSDC: my_balance_dUSDC
      },
      choosen_token_mint: 'USDT',
      choosen_token_redeem: 'dUSDT',
      is_already: true,
      load_new_history: Math.random(),
      cur_BaseData: BaseData_dUSDT,
      net_value: {
        dUSDT: BaseData_dUSDT[1],
        dUSDC: BaseData_dUSDC[1]
      },
      BaseData: {
        dUSDT: BaseData_dUSDT,
        dUSDC: BaseData_dUSDC
      }
    }, () => {
      let timer_10s = setInterval(() => {
        get_tokens_options(this);
      }, 1000 * 10);

      let timer_5s = setInterval(() => {
        get_balance__mint_redeem(this);
      }, 1000 * 5);
    })
  }



  render() {
    return (
      <IntlProvider locale={'en'} messages={this.state.cur_language === '中文' ? zh_CN : en_US} >
        <Modal
          visible={this.state.show_wallets}
          onCancel={() => { this.setState({ show_wallets: false }) }}
          footer={false}
        >
          <div className={tips.title}>Connect Wallet</div>
          <div className={tips.wallets}>
            <div className={tips.wallets__item} onClick={() => { this.click_wallet('metamask') }}>
              <span className={tips.wallets__item_name}>{'MetaMask'}</span>
              <span className={tips.wallets__item_icon}>
                <img src={wallet_metamask} alt="" />
              </span>
            </div>
          </div>
        </Modal>

        {/* menu */}
        <div className={'header'}>
          <a href="/" className={'header__logo'}>
            <img src={logo_xswap} alt="logo" />
          </a>

          <div className={'header__menu'}>
            <Dropdown
              overlay={
                <Menu className={'header__overlay'}>
                  <Menu.Item>
                    <a target="_blank" rel="noopener noreferrer" href="https://usdx.dforce.network/" className={'header__overlay_item'}>
                      <span>USDT</span>
                      <label>
                        <FormattedMessage id='Portal' />
                      </label>
                    </a>
                  </Menu.Item>
                </Menu>
              }
            >
              <span className={'header__menu_item'}>
                <label><FormattedMessage id='dForce_Stablecoin' /></label>
                <img src={arrow_d} alt="down" />
              </span>
            </Dropdown>


            <Dropdown
              overlay={
                <Menu className={'header__overlay'}>
                  <Menu.Item>
                    <a rel="noopener noreferrer" href="https://trade.dforce.network/" className={'header__overlay_item'}>
                      <span>dForce Trade</span>
                      <label>
                        <FormattedMessage id='Instant_Swap_of_Stable_Assets' />
                      </label>
                    </a>
                  </Menu.Item>
                </Menu>
              }
            >
              <span className={'header__menu_item'}>
                <label>
                  <FormattedMessage id='Exchange_Market' />
                </label>
                <img src={arrow_d} alt="down" />
              </span>
            </Dropdown>


            <Dropdown
              overlay={
                <Menu className={'header__overlay'}>
                  <Menu.Item>
                    <a rel="noopener noreferrer" href="https://airdrop.dforce.network/" className={'header__overlay_item'}>
                      <span>Airdrop</span>
                      <label>
                        <FormattedMessage id='DF_token_distribute_system' />
                      </label>
                    </a>
                  </Menu.Item>
                </Menu>
              }
            >
              <span className={'header__menu_item'}>
                <label>
                  <FormattedMessage id='Governance' />
                </label>
                <img src={arrow_d} alt="down" />
              </span>
            </Dropdown>


            {
              this.state.my_account &&
              <a
                className={'header__menu_wallet'} target="_blank"
                href={
                  this.state.net_type !== 'rinkeby'
                    ? `https://etherscan.com/address/${this.state.my_account}`
                    : `https://rinkeby.etherscan.io/address/${this.state.my_account}`
                }
              >
                <div>
                  <i style={{ backgroundColor: this.state.net_type !== 'rinkeby' ? '#29B6AF' : '#e2bc73' }}></i>
                  {this.state.my_account.slice(0, 4) + '...' + this.state.my_account.slice(-4)}
                </div>
              </a>
            }
            {
              !this.state.my_account &&
              <a className={'header__menu_wallet'} onClick={() => { this.connect() }}>
                <FormattedMessage id='connect' />
              </a>
            }
          </div>
        </div>

        {/* mobile tips */}
        <div className={this.state.showonly ? 'mobile-only' : 'disn'}>
          <div className='wrap-mob'>
            <div className='only-left'>
              <img src={logo_xswap} alt='' />
            </div>
            <div className='only-right'>
              <img src={close_new} alt='' onClick={() => { this.setState({ showonly: false }) }} />
            </div>
            <div className='clear'></div>
          </div>
          <div className='only-kong'></div>

          <h1 onClick={() => { this.setState({ meun1: !this.state.meun1 }) }}>
            <FormattedMessage id='dForce_Stablecoin' />
            <span>
              <img src={this.state.meun1 ? arrow_u : arrow_d} />
            </span>
          </h1>
          <div className={this.state.meun1 ? 'meun1' : 'only1px'}>
            <div className='m-item'>
              <a href='https://usdx.dforce.network/' target='_blank' rel="noopener noreferrer">
                <span className='title'>USDT</span>
              </a>
              <span className='details'>
                <FormattedMessage id='Portal' />
              </span>
            </div>
          </div>


          <h1 onClick={() => { this.setState({ meun3: !this.state.meun3 }) }}>
            <FormattedMessage id='Exchange_Market' />
            <span>
              <img src={this.state.meun3 ? arrow_u : arrow_d} />
            </span>
          </h1>
          <div className={this.state.meun3 ? 'meun1' : 'only1px'}>
            <div className='m-item'>
              <a href='https://trade.dforce.network/' rel="noopener noreferrer">
                <span className='title'>dForce Trade</span>
              </a>
              <span className='details'>
                <FormattedMessage id='Instant_Swap_of_Stable_Assets' />
              </span>
            </div>
          </div>


          <h1 onClick={() => { this.setState({ meun2: !this.state.meun2 }) }}>
            <FormattedMessage id='Governance' />
            <span>
              <img src={this.state.meun2 ? arrow_u : arrow_d} />
            </span>
          </h1>
          <div className={this.state.meun2 ? 'meun1' : 'only1px'}>
            <div className='m-item'>
              <a href='https://airdrop.dforce.network/' rel="noopener noreferrer">
                <span className='title'>Airdrop</span>
              </a>
              <span className='details'>
                <FormattedMessage id='DF_token_distribute_system' />
              </span>
            </div>
          </div>

        </div>

        <div className="App">
          <div className='wrap-mob'>
            <div className='only-left'>
              <img src={logo_xswap} alt='' />
            </div>
            <div className='only-right'>
              <img src={close} alt='' onClick={() => { this.setState({ showonly: true }) }} />
            </div>
            <div className='clear'></div>
          </div>

          {/* main content */}
          <div className="main-content">
            <div className="content-left">
              <div className="action">
                <Tabs
                  defaultActiveKey={'1'}
                  tabBarStyle={{ fontSize: '16px', fontWeight: 'bold' }}
                >
                  <TabPane tab={this.state.cur_language === '中文' ? "存入" : "MINT"} key="1">
                    <div className="choose-token">
                      <div className="choose-token-left">
                        <Dropdown overlay={
                          <Menu>
                            <Menu.Item key="0">
                              <div onClick={() => { this.set_mint_token('USDT') }}>USDT</div>
                            </Menu.Item>

                            <Menu.Divider />
                            <Menu.Item key="1">
                              <div onClick={() => { this.set_mint_token('USDC') }}>USDC</div>
                            </Menu.Item>
                          </Menu>
                        } trigger={['click']}>
                          <a className="ant-dropdown-link" onClick={e => e.preventDefault()}>
                            <img className='choose-token-logo' src={this.state.token_logo[this.state.cur_mint_token]} alt='' />
                            <span className="cur-choosen-token">{this.state.cur_mint_token}</span>
                            <img className='arrow-down' src={arrow_d} alt="down" />
                          </a>
                        </Dropdown>
                      </div>
                      <div className="choose-token-right">
                        <span className="span-balance">
                          <FormattedMessage id='balance' />:&nbsp;
                        </span>
                        <span className="span-balance-num">
                          {
                            this.state.my_balance_mint[this.state.cur_mint_token] ?
                              format_num_to_K(format_bn(this.state.my_balance_mint[this.state.cur_mint_token], this.state.decimals[this.state.cur_mint_token], 2)) : '...'
                          }
                        </span>
                      </div>
                    </div>

                    <div className="input-wrap">
                      <Input
                        placeholder={'Amount'}
                        type='number'
                        value={this.state.value_mint}
                        onChange={(e) => { mint_change(this, e.target.value, this.state.decimals[this.state.choosen_token_mint]) }}
                      />
                      <span className="span-max" onClick={() => { mint_max(this) }}>MAX</span>
                      <span className="span-cloud-receive">
                        <FormattedMessage id='you_w_receive' />
                        <span className="span-cloud-receive-num">
                          {
                            this.state.mint_to_receive_bn ?
                              format_num_to_K(format_bn(this.state.mint_to_receive_bn, this.state.decimals[this.state.choosen_token_mint], 2)) : '...'
                          }
                        </span>
                        {' d' + this.state.cur_mint_token}
                      </span>
                    </div>

                    <div className="btn-wrap">
                      <Button
                        onClick={() => { mint_click(this) }}
                      >
                        <FormattedMessage id='MINT' />
                      </Button>
                    </div>
                  </TabPane>

                  <TabPane tab={this.state.cur_language === '中文' ? "取回" : "REDEEM"} key="2">
                    <div className="choose-token">
                      <div className="choose-token-left">
                        <Dropdown overlay={
                          <Menu>
                            <Menu.Item key="0">
                              <div onClick={() => { this.set_redeem_token('dUSDT') }}>dUSDT</div>
                            </Menu.Item>

                            <Menu.Divider />
                            <Menu.Item key="1">
                              <div onClick={() => { this.set_redeem_token('dUSDC') }}>dUSDC</div>
                            </Menu.Item>
                          </Menu>
                        } trigger={['click']}>
                          <a className="ant-dropdown-link" onClick={e => e.preventDefault()}>
                            <img className='choose-token-logo' src={this.state.token_logo[this.state.cur_redeem_token.slice(1)]} alt='' />
                            <span className="cur-choosen-token">{this.state.cur_redeem_token}</span>
                            <img className='arrow-down' src={arrow_d} alt="down" />
                          </a>
                        </Dropdown>
                      </div>
                      <div className="choose-token-right">
                        <span className="span-balance">
                          <FormattedMessage id='balance' />:&nbsp;
                        </span>
                        <span className="span-balance-num">
                          {
                            this.state.my_balance_redeem[this.state.cur_redeem_token] ?
                              format_num_to_K(format_bn(this.state.my_balance_redeem[this.state.cur_redeem_token], this.state.decimals[this.state.cur_redeem_token], 2)) : '...'
                          }
                        </span>
                      </div>
                    </div>

                    <div className="input-wrap">
                      <Input
                        placeholder={'Amount'}
                        type='number'
                        value={this.state.value_redeem}
                        onChange={(e) => { redeem_change(this, e.target.value, this.state.decimals[this.state.choosen_token_redeem]) }}
                      />
                      <span className="span-max" onClick={() => { redeem_max(this) }}>MAX</span>
                      <span className="span-cloud-receive">
                        <FormattedMessage id='you_w_receive' />
                        <span className="span-cloud-receive-num">
                          {
                            this.state.redeem_to_receive_bn ?
                              format_num_to_K(format_bn(this.state.redeem_to_receive_bn, this.state.decimals[this.state.choosen_token_redeem], 2)) : '...'
                          }
                        </span>
                        {' ' + this.state.cur_redeem_token.slice(1)}
                      </span>
                    </div>

                    <div className="btn-wrap">
                      <Button
                        onClick={() => { redeem_click(this) }}
                      >
                        <FormattedMessage id='REDEEM' />
                      </Button>
                    </div>
                  </TabPane>
                </Tabs>
              </div>
              <div className="history-wrap history-pc">
                <History
                  account={this.state.my_account}
                  net_type={this.state.net_type}
                  new_web3={this.new_web3}
                  load_new_history={this.state.load_new_history}
                  cur_language={this.state.cur_language}
                  decimals={this.state.decimals}
                />
              </div>
            </div>

            <div className="content-right">
              <div className="token-status">
                <div className="token-status-header">
                  <div className="title-name">
                    <FormattedMessage id='assets' />
                  </div>
                  <div className="title-balance">
                    <FormattedMessage id='net_value' />
                  </div>
                  <div className="title-rate">
                    <FormattedMessage id='APY' />
                  </div>
                </div>

                <div className="token-status-body">

                  <div className="token-status-body-item">
                    <span className="token-name">dUSDT</span>
                    <span className="token-balance">
                      <span style={{ fontWeight: 500 }}>
                        {this.state.net_value.dUSDT ? format_num_to_K(format_bn(this.state.net_value.dUSDT, 18, 6)) : '...'}
                      </span> USDT
                    </span>
                    <span className="token-rate">
                      <span style={{ fontWeight: 500 }}>
                        {this.state.APY.dUSDT ? this.state.APY.dUSDT : '...'}
                      </span>
                      {this.state.APY.dUSDT && ' %'}
                    </span>
                  </div>

                  <div className="token-status-body-item">
                    <span className="token-name">dUSDC</span>
                    <span className="token-balance">
                      <span style={{ fontWeight: 500 }}>
                        {this.state.net_value.dUSDC ? format_num_to_K(format_bn(this.state.net_value.dUSDC, 18, 6)) : '...'}
                      </span> USDC
                    </span>
                    <span className="token-rate">
                      <span style={{ fontWeight: 500 }}>
                        {this.state.APY.dUSDC ? this.state.APY.dUSDC : '...'}
                      </span>
                      {this.state.APY.dUSDC && ' %'}
                    </span>
                  </div>

                </div>
              </div>
              <div className="echarts-wrap echarts-pc">
                <ReactEcharts option={this.state.cur_Option} />
              </div>
            </div>
          </div>

          <div className="history-wrap history-mob">
            <History
              account={this.state.my_account}
              net_type={this.state.net_type}
              new_web3={this.new_web3}
              load_new_history={this.state.load_new_history}
              cur_language={this.state.cur_language}
              decimals={this.state.decimals}
            />
          </div>


          {/* foot */}
          <div className="foot">
            <div className="foot-item">
              <div className="foot-item-title">
                <FormattedMessage id='Resource' />
              </div>
              <div className="foot-item-content">
                <a href='https://github.com/dforce-network/xswap.git' target='_blank' rel="noopener noreferrer">
                  GitHub
                </a>
              </div>
              <div className="foot-item-content">
                <a
                  href={
                    this.state.cur_language === '中文' ?
                      'https://docn.dforce.network/dforce-trade'
                      :
                      'https://docs.dforce.network/dforce-trading-protocol/dforce-trade'
                  }
                  target='_blank'
                  rel="noopener noreferrer"
                >
                  FAQ
                </a>
              </div>
            </div>

            <div className="foot-item">
              <div className="foot-item-title">
                <FormattedMessage id='Community' />
              </div>
              <div className="foot-item-content icom-a">
                <a href='https://twitter.com/dForcenet' target='_blank' rel="noopener noreferrer">
                  <img alt='' src={Twitter} />
                </a>
                <a href='https://t.me/dforcenet' target='_blank' rel="noopener noreferrer">
                  <img alt='' src={Telegram} />
                </a>
                <a href='https://medium.com/dforcenet' target='_blank' rel="noopener noreferrer">
                  <img alt='' src={Medium} />
                </a>
                <a href='https://www.reddit.com/r/dForceNetwork' target='_blank' rel="noopener noreferrer">
                  <img alt='' src={Reddit} />
                </a>
                <a href='https://discord.gg/Gbtd3MR' target='_blank' rel="noopener noreferrer">
                  <img alt='' src={Discord} />
                </a>
                <a href='https://www.linkedin.com/company/dforce-network' target='_blank' rel="noopener noreferrer">
                  <img alt='' src={LinkedIn} />
                </a>
                <a href='https://www.youtube.com/channel/UCM6Vgoc-BhFGG11ZndUr6Ow' target='_blank' rel="noopener noreferrer">
                  <img alt='' src={Youtube} />
                </a>
                {
                  this.state.cur_language === '中文' &&
                  <span className='weixin-img-wrap'>
                    <img alt='' src={weixin} />
                    <img alt='' className='weixin-img' src={erweima} />
                  </span>
                }
              </div>

              <div className='footer-right-fixed'>
                <div className='fixed1'>
                  {
                    this.state.cur_language === '中文' ? '中文简体' : 'English'
                  }
                </div>
                <span className='fixed-img'>
                  <img alt='' src={arrow_u} />
                </span>
                <div className='fixed2'>
                  <ul>
                    <li onClick={() => { this.setState({ cur_language: '中文' }) }}>{'中文简体'}</li>
                    <li onClick={() => { this.setState({ cur_language: 'English' }) }}>{'English'}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="foot-item padding-left20">
              <div className="foot-item-title">
                <FormattedMessage id='Contract_US' />
              </div>
              <div className="foot-item-content">
                support@dforce.network
              </div>
              <div className="foot-item-content">
                bd@dforce.network
              </div>
              <div className="foot-item-content">
                tech@dforce.network
              </div>
            </div>
            <div className="clear"></div>
          </div>

        </div>
      </IntlProvider >
    )
  }
}

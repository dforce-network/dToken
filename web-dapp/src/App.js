import React from 'react';
import Web3 from 'web3';
import { Menu, Dropdown, Tabs, Input, Button, Modal } from 'antd';
import History from './component/history';
import ReactEcharts from 'echarts-for-react';
import CountUp from 'react-countup';
// add i18n.
import { IntlProvider, FormattedMessage } from 'react-intl';
import en_US from './language/en_US.js';
import zh_CN from './language/zh_CN';

import './App.scss';
import './header.scss';
import './style/main-content.scss';
import 'antd/dist/antd.css';
import tips from './style/tips.scss';

import DAI_logo from './images/DAI.svg';
import TUSD_logo from './images/TUSD.svg';
import USDT_logo from './images/USDT.svg';
import USDC_logo from './images/USDC.svg';
import logo_xswap from './images/logo-dforce.svg';
import close from './images/close.svg';
import close_new from './images/close-new.svg';
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
import arrow_down from './images/arrow_down.svg';
import no_history from './images/no-history.svg';
import no_support from './images/no_support.svg';

import {
  get_nettype,
  mint_change,
  mint_click,
  get_tokens_status,
  get_tokens_status_apy,
  format_bn,
  format_num_to_K,
  redeem_change,
  redeem_click,
  mint_max,
  redeem_max,
  init_metamask_wallet,
  set_show_data,
  accounts_changed,
  approve_click
} from './utils.js';

const { TabPane } = Tabs;


export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      // token_name: ['USDT', 'USDC', 'DAI', 'TUSD'],
      // token_d_name: ['dUSDT', 'dUSDC', 'dDAI', 'dTUSD'],
      token_name: ['USDT', 'USDC', 'DAI'],
      token_d_name: ['dUSDT', 'dUSDC', 'dDAI'],
      token_d_balance__prev: [0, 0, 0],
      token_logo: [USDT_logo, USDC_logo, DAI_logo, TUSD_logo],
      token_decimals: [],
      token_contract: [],
      token_d_contract: [],
      token_is_approve: [],
      token_balance: [],
      token_d_balance: [],
      token_BaseData: [],
      // cur_index_mint: 0,
      // cur_index_redeem: 0,
      // cur_show_data_index: 0,
      // cur_index_mint: props.location.state && props.location.state.cur_index || 0,
      // cur_index_redeem: props.location.state && props.location.state.cur_index || 0,
      // cur_show_data_index: props.location.state && props.location.state.cur_index || 0,
      cur_index_mint: this.getUrl(props),
      cur_index_redeem: this.getUrl(props),
      cur_show_data_index: this.getUrl(props),
      is_withdraw: props.location.state && props.location.state.is_withdraw || false,
      token_status: [],
      token_status_apy: [],
      options: {},

      cur_language: props.location.state && props.location.state.cur_language === '中文' ? '中文' : 'English',
      showonly: false,
      meun1: true,
      meun2: true,
      meun3: true,
    }

    this.new_web3 = window.new_web3 = new Web3(Web3.givenProvider || null);
    this.bn = this.new_web3.utils.toBN;

    // console.log(props.location.state)
    // console.log(window.location.href)
  }

  getUrl = (props) => {
    // console.log(props.location.state && props.location.state.cur_index || 0)

    if (props && props.location.state && props.location.state.cur_index) {
      console.log('props');
      return props.location.state && props.location.state.cur_index || 0;
    }

    if (window.location.href.toLowerCase().includes('dapp/dai')) {
      console.log('dapp/dai');
      return 2;
    } else if (window.location.href.toLowerCase().includes('dapp/usdc')) {
      console.log('dapp/usdc');
      return 1;
    } else {
      console.log('dapp/usdt');
      return 0;
    }

  }



  componentDidMount = async () => {
    if (!Web3.givenProvider) {
      return console.log('no web3 provider');
    }

    init_metamask_wallet(this);

    let nettype = await get_nettype(this.new_web3);
    this.setState({
      net_type: nettype,
    }, () => {
      get_tokens_status(this);
      get_tokens_status_apy(this);

      window.timer_10s = setInterval(() => {
        return console.log('window.timer_5s......');
        if (
          (
            this.state.start_arr.length !== this.state.token_name.length ||
            this.state.end_arr.length !== this.state.token_name.length ||
            this.state.token_d_balance.length !== this.state.token_name.length
          )
        ) { return console.log('not ready'); }
        let need_update = false;
        for (let i = 0; i < this.state.start_arr.length; i++) {
          if (this.bn(this.state.token_d_balance[i]).gt(this.bn(this.state.end_arr[i]))) {
            need_update = true;
          }
        }
        if (need_update) {
          console.log('need_update******...');
          this.setState({
            is_already_set_count: false
          }, () => {
            get_tokens_status_apy(this);
          })
        }
      }, 1000 * 5);
    })

    if (window.ethereum) {
      window.ethereum.autoRefreshOnNetworkChange = false;
      window.ethereum.on("chainChanged", (_chainId) => {
        if (window.sessionStorage.getItem("chainId") !== _chainId) {
          window.sessionStorage.setItem("chainId", _chainId);
          window.location.reload();
        }
      });
    }
  }


  set_mint_token = (index) => {
    if (!this.state.is_already && !this.state.token_status_is_ready) {
      return console.log('not already');
    }
    if (!Web3.givenProvider) {
      return console.log('no web3 provider');
    }
    if (index === this.state.cur_index_mint) {
      return console.log('cur_index_mint is choosed...');
    }
    if (!this.state.token_name[index]) {
      return console.log('not exist...');
    }
    console.log(index);
    this.setState({
      cur_index_mint: index,
      cur_index_redeem: index,
      value_mint: '',
      mint_to_receive_bn: '',
      is_btn_disabled_mint: false,
      is_already_set_count: false
    }, () => {
      set_show_data(this);
      get_tokens_status_apy(this);
      console.log(this.state.start_arr, this.state.end_arr)
    })
  }


  set_redeem_token = (index) => {
    if (!this.state.is_already) {
      return console.log('no is_already');
    }
    if (!Web3.givenProvider) {
      return console.log('no web3 provider');
    }
    if (index === this.state.cur_index_redeem) {
      return console.log('is choosed...');
    }
    if (!this.state.token_name[index]) {
      return console.log('not exist...');
    }
    console.log(index);
    this.setState({
      cur_index_redeem: index,
      cur_index_mint: index,
      value_redeem: '',
      redeem_to_receive_bn: '',
      is_btn_disabled_redeem: false,
      is_already_set_count: false
    }, () => {
      set_show_data(this);
      get_tokens_status_apy(this);
    })
  }


  set_show_index = (index) => {
    // console.log(document.body.clientWidth)
    if (document.body.clientWidth <= 767) {
      this.setState({
        show_overlay: true
      })
    }

    // console.log(index);
    if (this.state.cur_show_data_index === index) {
      return console.log('has set...')
    }
    this.setState({
      cur_show_data_index: index
    }, () => {
      set_show_data(this);
    })
  }


  empty_state = (activeKey) => {
    console.log(activeKey)

    this.setState({
      value_mint: '',
      mint_to_receive_bn: '',
      is_btn_disabled_mint: false,
      value_redeem: '',
      redeem_to_receive_bn: '',
      is_btn_disabled_redeem: false
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

        {/* overlay */}
        <Modal
          visible={this.state.show_overlay}
          onCancel={() => { this.setState({ show_overlay: false }) }}
          footer={false}
        >
          <ReactEcharts option={this.state.options} />
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
                      <span>USDx</span>
                      <label>
                        <FormattedMessage id='Portal' />
                      </label>
                    </a>
                  </Menu.Item>
                  <Menu.Item>
                    <a target="_blank" rel="noopener noreferrer" href="https://markets.dforce.network/" className={'header__overlay_item'}>
                      <span>
                        <FormattedMessage id='Yield_Markets' />
                      </span>
                      <label>
                        <FormattedMessage id='Yield_Markets_detail' />
                      </label>
                    </a>
                  </Menu.Item>
                  <Menu.Item>
                    <a target="_blank" rel="noopener noreferrer" href="https://goldx.dforce.network/" className={'header__overlay_item'}>
                      <span>
                        <FormattedMessage id='goldx' />
                      </span>
                      <label>
                        <FormattedMessage id='goldx_detail' />
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
              this.state.net_type && !(this.state.net_type === 'kovan' || this.state.net_type === 'main') &&
              <a className={'header__menu_wallet header__menu_wallet_notsup'} onClick={() => { return false; }} rel="noopener noreferrer" href='javascript:;'>
                <img src={no_support} alt='' />
                <span>Wrong Network</span>
              </a>
            }

            {
              this.state.net_type && (this.state.net_type === 'kovan' || this.state.net_type === 'main') &&
              <>
                {
                  this.state.my_account &&
                  <a
                    rel="noopener noreferrer"
                    className={'header__menu_wallet'} target="_blank"
                    href={
                      this.state.net_type !== 'rinkeby'
                        ? `https://etherscan.com/address/${this.state.my_account}`
                        : `https://rinkeby.etherscan.io/address/${this.state.my_account}`
                    }
                  >
                    <div>
                      <i style={{
                        backgroundColor:
                          this.state.net_type !== 'rinkeby' ?
                            this.state.net_type !== 'kovan' ? '#29B6AF' : '#7E3AA4'
                            :
                            '#e2bc73'
                      }}></i>
                      {this.state.my_account.slice(0, 4) + '...' + this.state.my_account.slice(-4)}
                    </div>
                  </a>
                }
                {
                  !this.state.my_account &&
                  <a className={'header__menu_wallet'} onClick={() => { this.connect() }} rel="noopener noreferrer" href=''>
                    <FormattedMessage id='connect' />
                  </a>
                }
              </>
            }

            {
              !this.state.net_type &&
              <a className={'header__menu_wallet'} onClick={() => { this.connect() }} rel="noopener noreferrer" href=''>
                <FormattedMessage id='connect' />
              </a>
            }

          </div>
        </div>

        {/* mobile tips */}
        <div className={this.state.showonly ? 'mobile-only' : 'disn'}>
          <div className='wrap-mob'>
            <div className='only-left'>
              <a href="/" className={'header__logo'}>
                <img src={logo_xswap} alt="logo" />
              </a>
              {/* <img src={logo_xswap} alt='' /> */}
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
              <img src={this.state.meun1 ? arrow_u : arrow_d} alt='' />
            </span>
          </h1>
          <div className={this.state.meun1 ? 'meun1' : 'only1px'}>
            <div className='m-item'>
              <a href='https://usdx.dforce.network/' target='_blank' rel="noopener noreferrer">
                <span className='title'>USDx</span>
              </a>
              <span className='details'>
                <FormattedMessage id='Portal' />
              </span>
            </div>
            <div className='m-item'>
              <a href='https://markets.dforce.network/' rel="noopener noreferrer">
                <span className='title'>
                  <FormattedMessage id='Yield_Markets' />
                </span>
              </a>
              <span className='details'>
                <FormattedMessage id='Yield_Markets_detail' />
              </span>
            </div>
            <div className='m-item'>
              <a href='https://goldx.dforce.network/' rel="noopener noreferrer">
                <span className='title'>
                  <FormattedMessage id='goldx' />
                </span>
              </a>
              <span className='details'>
                <FormattedMessage id='goldx_detail' />
              </span>
            </div>
          </div>


          <h1 onClick={() => { this.setState({ meun3: !this.state.meun3 }) }}>
            <FormattedMessage id='Exchange_Market' />
            <span>
              <img src={this.state.meun3 ? arrow_u : arrow_d} alt='' />
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
              <img src={this.state.meun2 ? arrow_u : arrow_d} alt='' />
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
              {/* <img src={logo_xswap} alt='' /> */}
              <a href="/" className={'header__logo'}>
                <img src={logo_xswap} alt="logo" />
              </a>
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
                  defaultActiveKey={this.state.is_withdraw ? '2' : '1'}
                  tabBarStyle={{ fontSize: '16px', fontWeight: 'bold' }}
                  onChange={(activeKey) => { this.empty_state(activeKey) }}
                >
                  <TabPane tab={this.state.cur_language === '中文' ? "存入" : "DEPOSIT"} key="1">
                    <div className="choose-token">
                      <div className="choose-token-left">
                        <Dropdown overlay={
                          <Menu className="menu">
                            <Menu.Item key={0}>
                              <div onClick={() => { this.set_mint_token(0) }}>
                                <img src={this.state.token_logo[0]} alt='' />
                                <span className="span-name">USDT</span>
                                {/* <span style={{ opacity: '0.7' }}> (Tether USD)</span> */}
                                <span className="span-number">
                                  {
                                    this.state.token_balance[0] ?
                                      format_num_to_K(format_bn(this.state.token_balance[0], this.state.token_decimals[0], 2)) : '...'
                                  }
                                </span>
                              </div>
                            </Menu.Item>
                            <Menu.Divider />

                            <Menu.Item key={1}>
                              <div onClick={() => { this.set_mint_token(1) }}>
                                <img src={this.state.token_logo[1]} alt='' />
                                <span className="span-name">USDC</span>
                                {/* <span style={{ opacity: '0.7' }}> (USDC)</span> */}
                                <span className="span-number">
                                  {
                                    this.state.token_balance[1] ?
                                      format_num_to_K(format_bn(this.state.token_balance[1], this.state.token_decimals[1], 2)) : '...'
                                  }
                                </span>
                              </div>
                            </Menu.Item>

                            <Menu.Item key={2}>
                              <div onClick={() => { this.set_mint_token(2) }}>
                                <img src={this.state.token_logo[2]} alt='' />
                                <span className="span-name">DAI</span>
                                {/* <span style={{ opacity: '0.7' }}> (USDC)</span> */}
                                <span className="span-number">
                                  {
                                    this.state.token_balance[2] ?
                                      format_num_to_K(format_bn(this.state.token_balance[2], this.state.token_decimals[2], 2)) : '...'
                                  }
                                </span>
                              </div>
                            </Menu.Item>

                            <Menu.Item key={3}>
                              <div onClick={() => { this.set_mint_token(3) }}>
                                <img src={this.state.token_logo[3]} alt='' />
                                <span className="span-name">TUSD</span>
                                {/* <span style={{ opacity: '0.7' }}> (USDC)</span> */}
                                <span className="span-number">
                                  {
                                    this.state.token_balance[3] ?
                                      format_num_to_K(format_bn(this.state.token_balance[3], this.state.token_decimals[3], 2)) : '...'
                                  }
                                </span>
                              </div>
                            </Menu.Item>

                          </Menu>
                        } trigger={['click']}>
                          <a className="ant-dropdown-link" onClick={e => e.preventDefault()} rel="noopener noreferrer">
                            <img className='choose-token-logo' src={this.state.token_logo[this.state.cur_index_mint]} alt='' />
                            <span className="cur-choosen-token">{this.state.token_name[this.state.cur_index_mint]}</span>
                            <img className='arrow-down' src={arrow_down} alt="down" />
                          </a>
                        </Dropdown>
                      </div>
                      <div className="choose-token-right">
                        <span className="span-balance">
                          <FormattedMessage id='balance' />:&nbsp;
                        </span>
                        <span className="span-balance-num">
                          {
                            this.state.token_balance[this.state.cur_index_mint] ?
                              format_num_to_K(format_bn(this.state.token_balance[this.state.cur_index_mint], this.state.token_decimals[this.state.cur_index_mint], 2)) : '...'
                          }
                        </span>
                      </div>
                    </div>

                    <div className="input-wrap">
                      <Input
                        placeholder={'Amount'}
                        type='text'
                        value={this.state.value_mint}
                        onChange={(e) => { mint_change(this, e.target.value, this.state.token_decimals[this.state.cur_index_mint]) }}
                      />
                      <span className="span-max" onClick={() => { mint_max(this) }}>MAX</span>
                      {/* <span className="span-cloud-receive">
                        <FormattedMessage id='you_w_receive' />
                        <span className="span-cloud-receive-num">
                          {
                            this.state.mint_to_receive_bn ?
                              format_num_to_K(format_bn(this.state.mint_to_receive_bn, this.state.token_decimals[this.state.cur_index_mint], 2)) : '...'
                          }
                        </span>
                        {' ' + this.state.token_d_name[this.state.cur_index_mint]}
                      </span> */}
                    </div>

                    {
                      !Web3.givenProvider &&
                      <div className="btn-wrap btn-wrap-plus">
                        <Button
                          disabled={this.state.is_btn_disabled_mint}
                          className={this.state.is_btn_disabled_mint ? 'btn_disabled' : ''}
                        >
                          <FormattedMessage id='ENABLE' />
                        </Button>
                      </div>
                    }

                    {
                      this.state.show_btn && this.state.token_is_approve[this.state.cur_index_mint] &&
                      <div className="btn-wrap btn-wrap-plus">
                        <Button
                          disabled={this.state.is_btn_disabled_mint}
                          className={this.state.is_btn_disabled_mint ? 'btn_disabled' : ''}
                          onClick={() => { mint_click(this) }}
                        >
                          {
                            this.state.is_approving ?
                              <FormattedMessage id='Enabling' /> : <FormattedMessage id='DEPOSIT' />
                          }
                        </Button>
                      </div>
                    }
                    {
                      this.state.show_btn && !this.state.token_is_approve[this.state.cur_index_mint] &&
                      <div className="btn-wrap btn-wrap-plus">
                        <Button
                          disabled={this.state.is_btn_disabled_mint}
                          className={this.state.is_btn_disabled_mint ? 'btn_disabled' : ''}
                          onClick={() => { approve_click(this) }}
                        >
                          {
                            this.state.is_approving ?
                              <FormattedMessage id='Enabling' /> : <FormattedMessage id='ENABLE' />
                          }
                        </Button>
                      </div>
                    }

                  </TabPane>

                  <TabPane tab={this.state.cur_language === '中文' ? "取回" : "WITHDRAW"} key="2">
                    <div className="choose-token">
                      <div className="choose-token-left">
                        <Dropdown overlay={
                          <Menu className="menu">
                            <Menu.Item key={0}>
                              <div onClick={() => { this.set_redeem_token(0) }}>
                                <img src={this.state.token_logo[0]} alt='' />
                                <span className="span-name">USDT</span>
                                <span className="span-number">
                                  {
                                    this.state.token_d_balance[0] ?
                                      format_num_to_K(format_bn(this.state.token_d_balance[0], this.state.token_decimals[0], 2)) : '...'
                                  }
                                </span>
                              </div>
                            </Menu.Item>
                            <Menu.Divider />

                            <Menu.Item key={1}>
                              <div onClick={() => { this.set_redeem_token(1) }}>
                                <img src={this.state.token_logo[1]} alt='' />
                                <span className="span-name">USDC</span>
                                <span className="span-number">
                                  {
                                    this.state.token_d_balance[1] ?
                                      format_num_to_K(format_bn(this.state.token_d_balance[1], this.state.token_decimals[1], 2)) : '...'
                                  }
                                </span>
                              </div>
                            </Menu.Item>

                            <Menu.Item key={2}>
                              <div onClick={() => { this.set_redeem_token(2) }}>
                                <img src={this.state.token_logo[2]} alt='' />
                                <span className="span-name">DAI</span>
                                <span className="span-number">
                                  {
                                    this.state.token_d_balance[2] ?
                                      format_num_to_K(format_bn(this.state.token_d_balance[2], this.state.token_decimals[2], 2)) : '...'
                                  }
                                </span>
                              </div>
                            </Menu.Item>

                            <Menu.Item key={3}>
                              <div onClick={() => { this.set_redeem_token(3) }}>
                                <img src={this.state.token_logo[3]} alt='' />
                                <span className="span-name">TUSD</span>
                                <span className="span-number">
                                  {
                                    this.state.token_d_balance[3] ?
                                      format_num_to_K(format_bn(this.state.token_d_balance[3], this.state.token_decimals[3], 2)) : '...'
                                  }
                                </span>
                              </div>
                            </Menu.Item>

                          </Menu>
                        } trigger={['click']}>
                          <a className="ant-dropdown-link" onClick={e => e.preventDefault()} rel="noopener noreferrer">
                            <img className='choose-token-logo' src={this.state.token_logo[this.state.cur_index_redeem]} alt='' />
                            <span className="cur-choosen-token">{this.state.token_d_name[this.state.cur_index_redeem].slice(1)}</span>
                            <img className='arrow-down' src={arrow_down} alt="down" />
                          </a>
                        </Dropdown>
                      </div>
                      <div className="choose-token-right">
                        <span className="span-balance">
                          <FormattedMessage id='withdraw_balance' />:&nbsp;
                        </span>
                        <span className="span-balance-num">
                          {
                            this.state.token_d_balance[this.state.cur_index_redeem] ?
                              format_num_to_K(format_bn(this.state.token_d_balance[this.state.cur_index_redeem], this.state.token_decimals[this.state.cur_index_redeem], 2)) : '...'
                          }
                        </span>
                      </div>
                    </div>

                    <div className="input-wrap">
                      <Input
                        placeholder={'Amount'}
                        type='text'
                        value={this.state.value_redeem}
                        onChange={(e) => { redeem_change(this, e.target.value, this.state.token_decimals[this.state.cur_index_redeem]) }}
                      />
                      <span className="span-max" onClick={() => { redeem_max(this) }}>MAX</span>
                      {/* <span className="span-cloud-receive">
                        <FormattedMessage id='you_w_receive' />
                        <span className="span-cloud-receive-num">
                          {
                            this.state.redeem_to_receive_bn ?
                              format_num_to_K(format_bn(this.state.redeem_to_receive_bn, this.state.token_decimals[this.state.cur_index_redeem], 2)) : '...'
                          }
                        </span>
                        {' ' + this.state.token_name[this.state.cur_index_redeem]}
                      </span> */}
                    </div>

                    <div className="btn-wrap btn-wrap-plus">
                      {
                        this.state.show_btn &&
                        <Button
                          disabled={this.state.is_btn_disabled_redeem}
                          className={this.state.is_btn_disabled_redeem ? 'btn_disabled' : ''}
                          onClick={() => { redeem_click(this) }}
                        >
                          <FormattedMessage id='WITHDRAW' />
                        </Button>
                      }
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
                  decimals={this.state.token_decimals}
                  token_name={this.state.token_name}
                  token_d_name={this.state.token_d_name}
                />
              </div>
            </div>

            <div className="content-right">

              <div className="token-status">
                <div className="token-status-header">
                  <div className="token-status-header-child">
                    <FormattedMessage id='You_have' />
                    {
                      // this.state.token_d_balance[this.state.cur_index_redeem] ?
                      //   <CountUp
                      //     className="account-balance"
                      //     start={
                      //       Number(format_bn(this.state.token_d_balance__prev[this.state.cur_index_mint], this.state.token_decimals[this.state.cur_index_mint], 6))
                      //     }
                      //     // start={
                      //     //   Number(format_bn(this.state.token_d_balance[this.state.cur_index_mint], this.state.token_decimals[this.state.cur_index_mint], 6))
                      //     // }
                      //     end={
                      //       Number(format_bn(this.state.token_d_balance[this.state.cur_index_mint], this.state.token_decimals[this.state.cur_index_mint], 6))
                      //     }
                      //     duration={Number(2)}
                      //     useGrouping={true}
                      //     separator=","
                      //     decimals={6}
                      //     decimal="."
                      //     update={
                      //       Number(format_bn(this.state.token_d_balance[this.state.cur_index_mint], this.state.token_decimals[this.state.cur_index_mint], 6))
                      //     }
                      //   />
                      //   : '...'
                    }

                    {
                      // this.state.token_d_balance[this.state.cur_index_redeem] && this.state.is_already_set_count ?
                      // this.state.is_already_set_count ?
                      //   <CountUp
                      //     className="account-balance"
                      //     start={Number(format_bn(this.state.start_arr[this.state.cur_index_mint], this.state.token_decimals[this.state.cur_index_mint], 6))}
                      //     end={Number(format_bn(this.state.end_arr[this.state.cur_index_mint], this.state.token_decimals[this.state.cur_index_mint], 6))}
                      //     duration={Number(24 * 60 * 60)}
                      //     useGrouping={true}
                      //     separator=","
                      //     decimals={6}
                      //     decimal="."
                      //   /> : '...'
                    }

                    {
                      this.state.token_d_balance[this.state.cur_index_redeem] ?
                        <span className="account-balance">
                          {
                            format_num_to_K(format_bn(
                              this.state.token_d_balance[this.state.cur_index_mint],
                              this.state.token_decimals[this.state.cur_index_mint],
                              6
                            ))
                          }
                        </span> : '...'
                    }
                  &nbsp;
                  {this.state.token_name[this.state.cur_index_redeem]}
                    <FormattedMessage id='brewing' />
                  </div>
                </div>

                <div className="token-status-body">
                  {
                    // this.state.token_status_apy.length > 0 &&
                    <div
                      className={"token-status-body-item"}
                    // key={index}
                    // onClick={() => { this.set_show_index(index) }}
                    >
                      {/* <div className="pool-wrap">
                        <span className="token-title"><FormattedMessage id='net_value' /></span>
                        <span className="token-balance">
                          <span style={{ fontWeight: 500 }}>
                            {
                              this.state.token_status_apy[this.state.cur_index_mint] ?
                                format_num_to_K(format_bn(this.state.token_status_apy[this.state.cur_index_mint].net_value, 0, 2))
                                : '...'
                            }
                          </span>
                          {' ' + this.state.token_name[this.state.cur_index_mint]}
                        </span>
                      </div> */}
                      <div className="pool-wrap">
                        <span className="token-title">
                          <FormattedMessage id='APY' />
                        </span>
                        <span className="token-rate">
                          <span style={{ fontWeight: 500 }}>
                            {
                              this.state.token_status_apy[this.state.cur_index_mint] ?
                                this.state.token_status_apy[this.state.cur_index_mint].now_apy
                                : '...'
                            }
                          </span>
                          {this.state.token_status_apy[this.state.cur_index_mint] && '%'}
                        </span>
                      </div>
                    </div>
                  }
                </div>
              </div>

              {
                !this.state.token_status_is_ready &&
                <div className="nodata-wrap">
                  <img alt='' src={no_history} />
                  <span className="no-data-span">
                    <FormattedMessage id='no_data' />
                  </span>
                </div>
              }

              <div className="echarts-wrap ">
                <ReactEcharts option={this.state.options} />
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
              decimals={this.state.token_decimals}
              token_name={this.state.token_name}
              token_d_name={this.state.token_d_name}
            />
          </div>


          {/* foot */}
          <div className="foot">
            <div className="foot-item">
              <div className="foot-item-title">
                <FormattedMessage id='Resource' />
              </div>
              <div className="foot-item-content">
                <a href='https://github.com/dforce-network/dToken.git' target='_blank' rel="noopener noreferrer">
                  GitHub
                </a>
              </div>
              <div className="foot-item-content">
                <a
                  href='https://github.com/dforce-network/dToken.git'
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

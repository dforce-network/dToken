import React from 'react';
import Web3 from 'web3';
import { Menu, Dropdown, Tabs, Input, Button, Modal } from 'antd';
// add i18n.
import { IntlProvider, FormattedMessage } from 'react-intl';
import en_US from '../../language/en_US.js';
import zh_CN from '../../language/zh_CN';

import Item from './Item';
import Item_BSC from './Item-bsc';
import FAQ from '../FAQ';

import '../../App.scss';
import '../../header.scss';
import '../../style/main-content.scss';
import 'antd/dist/antd.css';
import tips from '../../style/tips.scss';

import DAI_logo from '../../images/DAI.svg';
import TUSD_logo from '../../images/TUSD.svg';
import USDT_logo from '../../images/USDT.svg';
import USDC_logo from '../../images/USDC.svg';
import logo_xswap from '../../images/logo-dforce.svg';
import close from '../../images/close.svg';
import close_new from '../../images/close-new.svg';
import Twitter from '../../images/twitter.svg';
import Telegram from '../../images/telegram.svg';
import Medium from '../../images/medium.svg';
import Reddit from '../../images/Reddit.svg';
import Discord from '../../images/Discord.svg';
import LinkedIn from '../../images/LinkedIn.svg';
import Youtube from '../../images/Youtube.svg';
import erweima from '../../images/erweima.png';
import weixin from '../../images/weixin.svg';
import arrow_u from '../../images/up.svg';
// import wallet_metamask from './images/wallet-metamask.svg';
import arrow_d from '../../images/arrow_d.svg';
import arrow_down from '../../images/arrow_down.svg';
import no_history from '../../images/no-history.svg';
import switch_img from '../../images/witch.svg';

import { get_nettype } from '../../utils.js';


export default class Home extends React.Component {
    constructor(porps) {
        super(porps);

        this.state = {
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
            cur_index_mint: 0,
            cur_index_redeem: 0,
            token_status: [],
            token_status_apy: [],
            cur_show_data_index: 0,
            options: {},
            is_onETHChain: window.location.href.includes('/bsc') ? false : true,

            cur_language: navigator.language.toLowerCase() === 'zh-cn' ? '中文' : 'English',
            showonly: false,
            meun1: true,
            meun2: true,
            meun3: true,
        }

        this.new_web3 = window.new_web3 = new Web3(Web3.givenProvider || null);
        this.bn = this.new_web3.utils.toBN;
    }




    componentDidMount = async () => {
        if (!Web3.givenProvider) {
            return console.log('no web3 provider');
        }

        let nettype = await get_nettype(this.new_web3);
        this.setState({
            net_type: nettype,
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



    render() {
        return (
            <IntlProvider locale={'en'} messages={this.state.cur_language === '中文' ? zh_CN : en_US} >
                {/* menu */}
                <div className={'header'}>
                    <a href="https://dforce.network/" className={'header__logo'}>
                        <img src={logo_xswap} alt="logo" />
                    </a>

                    <div className={'header__menu'}>
                        <div className={'header__menu__singleLink'}>
                            <a href="https://app.dforce.network/#/lending" target="_blank">
                                <FormattedMessage id='LEND' />
                            </a>
                        </div>


                        <Dropdown
                            overlay={
                                <Menu className={'header__overlay'}>
                                    <Menu.Item>
                                        <a target="_blank" rel="noopener noreferrer" href="https://markets.dforce.network/" className={'header__overlay_item'}>
                                            <span>
                                                <FormattedMessage id='Yield_Markets' />
                                            </span>
                                        </a>
                                    </Menu.Item>
                                    <Menu.Item>
                                        <a target="_blank" rel="noopener noreferrer" href="https://usdx.dforce.network/" className={'header__overlay_item'}>
                                            <span>USDx</span>
                                        </a>
                                    </Menu.Item>
                                    <Menu.Item>
                                        <a target="_blank" rel="noopener noreferrer" href="https://goldx.dforce.network/" className={'header__overlay_item'}>
                                            <span>GOLDx</span>
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


                        <div className={'header__menu__singleLink'}>
                            <a href="https://trade.dforce.network/" target="_blank">
                                <FormattedMessage id='Exchange_Market' />
                            </a>
                        </div>

                        <div className={'header__menu__singleLink'}>
                            <a href="https://staking.dforce.network/" target="_blank">
                                <FormattedMessage id='FARM' />
                            </a>
                        </div>


                        <Dropdown
                            overlay={
                                <Menu className={'header__overlay'}>
                                    <Menu.Item>
                                        <a rel="noopener noreferrer" href="https://snapshot.page/#/dforce" className={'header__overlay_item'}>
                                            <span>
                                                <FormattedMessage id='VOTE' />
                                            </span>
                                        </a>
                                    </Menu.Item>
                                    <Menu.Item>
                                        <a rel="noopener noreferrer" href="https://airdrop.dforce.network/" className={'header__overlay_item'}>
                                            <span>
                                                <FormattedMessage id='Airdrop' />
                                            </span>
                                        </a>
                                    </Menu.Item>
                                    <Menu.Item>
                                        <a rel="noopener noreferrer" href="https://forum.dforce.network" className={'header__overlay_item'}>
                                            <span>
                                                <FormattedMessage id='FORUM' />
                                            </span>
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

                    </div>
                </div>

                {/* mobile tips */}
                <div className={this.state.showonly ? 'mobile-only' : 'disn'}>
                    <div className='wrap-mob'>
                        <div className='only-left'>
                            {/* <img src={logo_xswap} alt='' /> */}
                            <a href="https://dforce.network/" className={'header__logo'}>
                                <img src={logo_xswap} alt="logo" />
                            </a>
                        </div>
                        <div className='only-right'>
                            <img src={close_new} alt='' onClick={() => { this.setState({ showonly: false }) }} />
                        </div>
                        <div className='clear'></div>
                    </div>
                    <div className='only-kong'></div>

                    <h1>
                        <a style={{ color: '#070237', display: 'block', width: '100%', height: '100%' }} href="https://app.dforce.network/#/lending" target='_blank'>
                            <FormattedMessage id='LEND' />
                        </a>
                    </h1>

                    <h1 onClick={() => { this.setState({ meun1: !this.state.meun1 }) }}>
                        <FormattedMessage id='dForce_Stablecoin' />
                        <span>
                            <img src={this.state.meun1 ? arrow_u : arrow_d} alt='' />
                        </span>
                    </h1>
                    <div className={this.state.meun1 ? 'meun1' : 'only1px'}>
                        <div className='m-item'>
                            <a href='https://markets.dforce.network/' rel="noopener noreferrer">
                                <span className='title'>
                                    <FormattedMessage id='Yield_Markets' />
                                </span>
                            </a>
                        </div>
                        <div className='m-item'>
                            <a href='https://usdx.dforce.network/' target='_blank' rel="noopener noreferrer">
                                <span className='title'>USDx</span>
                            </a>
                        </div>
                        <div className='m-item'>
                            <a href='https://goldx.dforce.network/' rel="noopener noreferrer">
                                <span className='title'>GOLDx</span>
                            </a>
                        </div>
                    </div>

                    <h1>
                        <a
                            style={{ color: '#070237', display: 'block', width: '100%', height: '100%' }}
                            href="https://trade.dforce.network/" target='_blank'>
                            <FormattedMessage id='Exchange_Market' />
                        </a>
                    </h1>

                    <h1>
                        <a
                            style={{ color: '#070237', display: 'block', width: '100%', height: '100%' }}
                            href="https://staking.dforce.network/" target='_blank'>
                            <FormattedMessage id='FARM' />
                        </a>
                    </h1>

                    <h1 onClick={() => { this.setState({ meun2: !this.state.meun2 }) }}>
                        <FormattedMessage id='Governance' />
                        <span>
                            <img src={this.state.meun2 ? arrow_u : arrow_d} alt='' />
                        </span>
                    </h1>
                    <div className={this.state.meun2 ? 'meun1' : 'only1px'}>
                        <div className='m-item'>
                            <a href='https://snapshot.page/#/dforce' rel="noopener noreferrer" target='_blank'>
                                <span className='title'>
                                    <FormattedMessage id='VOTE' />
                                </span>
                            </a>
                        </div>
                        <div className='m-item'>
                            <a href='https://airdrop.dforce.network/' rel="noopener noreferrer" target='_blank'>
                                <span className='title'>
                                    <FormattedMessage id='Airdrop' />
                                </span>
                            </a>
                        </div>
                        <div className='m-item'>
                            <a href="https://forum.dforce.network/" rel="noopener noreferrer" target='_blank'>
                                <span className='title'>
                                    <FormattedMessage id='FORUM' />
                                </span>
                            </a>
                        </div>
                    </div>

                </div>

                <div className="App">
                    <div className='wrap-mob'>
                        <div className='only-left'>
                            {/* <img src={logo_xswap} alt='' /> */}
                            <a href="https://dforce.network/" className={'header__logo'}>
                                <img src={logo_xswap} alt="logo" />
                            </a>
                        </div>
                        <div className='only-right'>
                            <img src={close} alt='' onClick={() => { this.setState({ showonly: true }) }} />
                        </div>
                        <div className='clear'></div>
                    </div>

                    <div className='dtoken-slogan'>
                        <FormattedMessage id='slogan_title' />
                    </div>
                    <div className='dtoken-slogan-plus'>
                        <FormattedMessage id='slogan_title_plus' />
                    </div>

                    {/* <div className='switch-tips'>
                        <div className='switch-tips-right'
                            onClick={() => { window.history.pushState(null, null, '/dashboard'); }}
                        >
                            <>dashboard</>
                            <img alt='' src={switch_img} />
                        </div>
                    </div> */}
                    {
                        this.state.is_onETHChain &&
                        <div className='switch-tips'>
                            <div className='switch-tips-left'>
                                <FormattedMessage id='on_ETH' />
                            </div>
                            <div className='switch-tips-right'
                                onClick={() => {
                                    window.history.pushState(null, null, '/bsc');
                                    this.setState({ is_onETHChain: false });
                                }}
                            >
                                <FormattedMessage id='to_BSC' />
                                <img alt='' src={switch_img} />
                            </div>
                        </div>
                    }
                    {this.state.is_onETHChain && <Item language={this.state.cur_language} />}


                    {
                        !this.state.is_onETHChain &&
                        <div className='switch-tips'>
                            <div className='switch-tips-left'>
                                <FormattedMessage id='on_BSC' />
                            </div>
                            <div className='switch-tips-right'
                                onClick={() => {
                                    window.history.pushState(null, null, '/');
                                    this.setState({ is_onETHChain: true });
                                }}
                            >
                                <FormattedMessage id='to_ETH' />
                                <img alt='' src={switch_img} />
                            </div>
                        </div>
                    }
                    {!this.state.is_onETHChain && <Item_BSC language={this.state.cur_language} />}

                    <FAQ language={this.state.cur_language} />

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
                                    href='https://github.com/dforce-network/documents/blob/master/audit_report/dToken/dToken_Assessment_Summary.pdf'
                                    target='_blank'
                                    rel="noopener noreferrer"
                                >
                                    <FormattedMessage id='Audit_Reports' />
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
                                <a href='https://discord.gg/c2PC8SM' target='_blank' rel="noopener noreferrer">
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

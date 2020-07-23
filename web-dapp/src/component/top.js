import React, { Component } from "react";
import "./top.scss";
// add i18n.
import { IntlProvider, FormattedMessage } from 'react-intl';
import en_US from '../language/en_US.js';
import zh_CN from '../language/zh_CN';
import logo_xswap from '../images/logo-dforce.svg';
import arrow_down from '../images/arrow-down.svg';


export default class top extends Component {

    openOnEtherscan = (my_account) => {
        if (this.props.net_type === 'rinkeby') {
            my_account = 'https://rinkeby.etherscan.io/address/' + my_account;
        } else {
            my_account = 'https://etherscan.io/address/' + my_account;
        }
        window.open(my_account, "_blank");
    }

    render() {
        return (
            <IntlProvider locale={'en'} messages={navigator.language === 'zh-CN' ? zh_CN : en_US} >
                <div className="top">
                    <div className="top-left">
                        <img alt='' src={logo_xswap} />
                    </div>

                    {
                        this.props.account &&
                        <div className="top-right-connect">
                            <span className="top-dot" style={{ 'background': this.props.net_type === 'rinkeby' ? '#e8bb66' : '#27aaa0' }}></span>
                            <span onClick={() => { this.openOnEtherscan(this.props.account) }}>
                                {this.props.account.slice(0, 4) + '...' + this.props.account.slice(-4)}
                            </span>
                        </div>
                    }

                    {
                        !this.props.account &&
                        <div className="top-right-connect" onClick={() => { this.props.fn_connect() }}>
                            <FormattedMessage id='connect' />
                        </div>
                    }

                    <div className="top-meun">
                        <div className="top-meun-item">
                            <div className="item-fixed">
                                Yield Market
                                <img alt='' src={arrow_down} className='arrow-down img-right45' />
                            </div>
                            <div className="item-more">
                                <ul>
                                    <li>
                                        <a href='https://www.lendf.me/' target='_blank' rel="noopener noreferrer">
                                            <span className='title'>LendfMe</span>
                                        </a>
                                        <span className='details'>Lend and Borrow</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="top-meun-item">
                            <div className="item-fixed">
                                dForce Stablecoin
                                <img alt='' src={arrow_down} className='arrow-down' />
                            </div>
                            <div className="item-more">
                                <ul>
                                    <li>
                                        <a href='https://usdx.dforce.network/' target='_blank' rel="noopener noreferrer">
                                            <span className='title'>USDx</span>
                                        </a>
                                        <span className='details'>Portal</span>
                                    </li>
                                    <li>
                                        <a href='https://dip001.dforce.network/' target='_blank' rel="noopener noreferrer">
                                            <span className='title'>DIP001</span>
                                        </a>
                                        <span className='details'>Collateral Lending Dashboard</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="slogon">
                    <FormattedMessage id='slogon' />
                </div>
            </IntlProvider>
        )
    }
}


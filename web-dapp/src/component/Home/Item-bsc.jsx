import React, { Component } from "react";
import { Link } from "react-router-dom";
import { Button, } from 'antd';
import { IntlProvider, FormattedMessage } from 'react-intl';
import en_US from '../../language/en_US.js';
import zh_CN from '../../language/zh_CN';
import { format_num_to_K } from '../../utils';

import DAI_logo from '../../images/DAI.svg';
import USDT_logo from '../../images/USDT.svg';
import USDC_logo from '../../images/USDC.svg';
import USDx_logo from '../../images/USDx.svg';
import BUSD_logo from '../../images/BUSD.svg';

import './home.scss';


export default class Item extends Component {
  constructor(props) {
    super(props);

    this.state = {
      logo: {
        USDT: USDT_logo,
        USDC: USDC_logo,
        DAI: DAI_logo,
        USDx: USDx_logo,
        BUSD: BUSD_logo
      },
      token_d_name: ['dBUSD', 'dUSDT', 'dUSDC', 'dDAI'],
      source: 'web',
      add_url: '',
    };
  }

  handleURL = () => {
    const wallet_list = ['imtoken', 'bitpie', 'mykey', 'dapppocket', 'blocto', 'huobiwallet', 'abcwallet', 'tokenpocket', 'dappbirds', 'mathwallet', 'meetone'];

    let t_url = window.location.href;
    let arr_url = t_url.split('/');
    let source = 'web';
    for (let i = 0; i < arr_url.length; i++) {
      if (arr_url[i].toLowerCase().includes('utm_source=')) {
        for (let j = 0; j < wallet_list.length; j++) {
          if (arr_url[i].toLowerCase().includes(wallet_list[j])) {
            source = wallet_list[j]
          }
        }
      }
    }

    console.log(source);
    this.setState({
      source: source
    })
  }

  get_token_status = () => {
    let url_apy = 'https://markets.dforce.network/api/bsc/getApy/';

    fetch(url_apy)
      .then(res => res.text())
      .then((data) => {
        if (!(data && Object.keys(data).length > 0)) {
          return console.log('no data return...');
        }

        let obj_data = JSON.parse(data);
        // return console.log(obj_data);

        let token_data_arr = [];
        for (let i = 0; i < this.state.token_d_name.length; i++) {
          token_data_arr[i] = obj_data[this.state.token_d_name[i]]
        }
        // return console.log(token_data_arr);

        this.setState({ token_data_arr })
      })
  }

  format_str_to_kmb = (str_num) => {
    var t_num = Number(str_num);
    var out_a, out_b, t_index;


    if (t_num >= 1E9) {
      out_a = Math.floor(t_num / 1E9);
      if ((t_num % 1E9 / 1E9).toString().indexOf('.') > 0) {
        t_index = (t_num % 1E9 / 1E9).toString().indexOf('.') + 1;
        out_b = (t_num % 1E9 / 1E9).toString().substr(t_index, 2);
      } else {
        out_b = '00';
      }
      return out_a + '.' + out_b + 'G';
    }


    if (t_num >= 1E6) {
      out_a = Math.floor(t_num / 1E6);
      if ((t_num % 1E6 / 1E6).toString().indexOf('.') > 0) {
        t_index = (t_num % 1E6 / 1E6).toString().indexOf('.') + 1;
        out_b = (t_num % 1E6 / 1E6).toString().substr(t_index, 2);
      } else {
        out_b = '00';
      }
      return out_a + '.' + out_b + 'M';
    }


    if (t_num >= 1E3) {
      out_a = Math.floor(t_num / 1E3);
      if ((t_num % 1E3 / 1E3).toString().indexOf('.') > 0) {
        t_index = (t_num % 1E3 / 1E3).toString().indexOf('.') + 1;
        out_b = (t_num % 1E3 / 1E3).toString().substr(t_index, 2);
      } else {
        out_b = '00';
      }
      return out_a + '.' + out_b + 'K';
    }

    if (str_num.indexOf('.') > 0) {
      return str_num.slice(0, str_num.indexOf('.') + 3)
    }

    return str_num;

  }


  componentDidMount = () => {
    this.get_token_status();
    this.handleURL();

    window.timer = setInterval(() => {
      this.get_token_status();
    }, 1000 * 10);

    console.log(window.location.href) // http://localhost:3000/bsc/?utm_source=TokenPocket
    let href_arr = window.location.href.split('?')
    if (href_arr && href_arr[1]) {
      this.setState({
        add_url: href_arr[1]
      }, () => {
        console.log(this.state.add_url)
      })
    }
  }

  componentWillUnmount = () => {
    console.log('clear');
    clearInterval(window.timer);
  }



  render() {
    return (
      <IntlProvider locale={'en'} messages={this.props.language === '中文' ? zh_CN : en_US} >
        <div className={"warp"}>
          <section className={"content"}>
            <h3 className={"tabTitle"}>
              <FormattedMessage id='All_Markets' />
            </h3>
            <dl>
              <dt style={{ fontWeight: 'bold', fontSize: '18px' }}>
                <span className={"leftColumn"}>
                  <FormattedMessage id='Asset' />
                </span>
                <span>
                  <FormattedMessage id='Market_Size' />
                </span>
                <span>
                  <FormattedMessage id='APY' />
                </span>
                <span className={"btn-wrap"}></span>
              </dt>


              {
                this.state.token_data_arr && this.state.token_data_arr.length > 0 &&
                this.state.token_data_arr.map((item, index) => {
                  return (
                    <dd key={index} style={{ fontWeight: 'bold', fontSize: '18px' }}>
                      <div className={"leftColumn"}>
                        <img src={this.state.logo[this.state.token_d_name[index].slice(1)]} />
                        <div className={"rightText"}>
                          <h3>{this.state.token_d_name[index].slice(1)}</h3>
                        </div>
                      </div>
                      <span className={"spanflex"}>
                        {format_num_to_K(Number(this.state.token_data_arr[index].total_underlying).toFixed(2))}
                      </span>
                      <span className={"spanflex"}>
                        {Number(this.state.token_data_arr[index].now_apy).toFixed(2)}%
                      </span>
                      <span className={"btn-wrap bsc-spewrap"}>

                        <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: index, cur_language: this.props.language, source: this.state.source } }}>
                          <Button>
                            <FormattedMessage id='Deposit' />
                          </Button>
                        </Link>

                        <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: index, is_withdraw: true, cur_language: this.props.language, source: this.state.source } }}>
                          <Button>
                            <FormattedMessage id='Withdraw' />
                          </Button>
                        </Link>
                      </span>
                    </dd>
                  )
                })
              }

              {
                !(this.state.token_data_arr && this.state.token_data_arr.length > 0) &&
                <>
                  <dd style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    <div className={"leftColumn"}>
                      <img src={this.state.logo.USDx} />
                      <div className={"rightText"}>
                        <h3>{'BUSD'}</h3>
                      </div>
                    </div>
                    <span className={"spanflex"}>{'...'}</span>
                    <span className={"spanflex"}>{'...'}</span>
                    <span className={"btn-wrap"}>
                      <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: 0, cur_language: this.props.language, source: this.state.source } }}>
                        <Button><FormattedMessage id='DEPOSIT' /></Button>
                      </Link>
                      <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: 0, is_withdraw: true, cur_language: this.props.language, source: this.state.source } }}>
                        <Button><FormattedMessage id='WITHDRAW' /></Button>
                      </Link>
                    </span>
                  </dd>

                  <dd style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    <div className={"leftColumn"}>
                      <img src={this.state.logo.USDT} />
                      <div className={"rightText"}>
                        <h3>{'USDT'}</h3>
                      </div>
                    </div>
                    <span className={"spanflex"}>{'...'}</span>
                    <span className={"spanflex"}>{'...'}</span>
                    <span className={"btn-wrap"}>
                      <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: 1, cur_language: this.props.language, source: this.state.source } }}>
                        <Button><FormattedMessage id='DEPOSIT' /></Button>
                      </Link>
                      <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: 1, is_withdraw: true, cur_language: this.props.language, source: this.state.source } }}>
                        <Button><FormattedMessage id='WITHDRAW' /></Button>
                      </Link>
                    </span>
                  </dd>

                  <dd style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    <div className={"leftColumn"}>
                      <img src={this.state.logo.USDC} />
                      <div className={"rightText"}>
                        <h3>{'USDC'}</h3>
                      </div>
                    </div>
                    <span className={"spanflex"}>{'...'}</span>
                    <span className={"spanflex"}>{'...'}</span>
                    <span className={"btn-wrap"}>
                      <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: 2, cur_language: this.props.language, source: this.state.source } }}>
                        <Button><FormattedMessage id='DEPOSIT' /></Button>
                      </Link>
                      <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: 2, is_withdraw: true, cur_language: this.props.language, source: this.state.source } }}>
                        <Button><FormattedMessage id='WITHDRAW' /></Button>
                      </Link>
                    </span>
                  </dd>

                  <dd style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    <div className={"leftColumn"}>
                      <img src={this.state.logo.DAI} />
                      <div className={"rightText"}>
                        <h3>{'DAI'}</h3>
                      </div>
                    </div>
                    <span className={"spanflex"}>{'...'}</span>
                    <span className={"spanflex"}>{'...'}</span>
                    <span className={"btn-wrap"}>
                      <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: 3, cur_language: this.props.language, source: this.state.source } }}>
                        <Button><FormattedMessage id='DEPOSIT' /></Button>
                      </Link>
                      <Link to={{ pathname: `/dapp-bsc/?${this.state.add_url}`, state: { cur_index: 3, is_withdraw: true, cur_language: this.props.language, source: this.state.source } }}>
                        <Button><FormattedMessage id='WITHDRAW' /></Button>
                      </Link>
                    </span>
                  </dd>
                </>
              }
            </dl>
          </section>
        </div>
      </IntlProvider>
    );
  }
}

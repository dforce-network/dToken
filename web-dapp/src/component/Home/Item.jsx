import React, { Component } from "react";
import { Link } from "react-router-dom";
import DAI_logo from '../../images/DAI.svg';
import USDT_logo from '../../images/USDT.svg';
import USDC_logo from '../../images/USDC.svg';
import no_history from '../../images/no-history.svg';
import { Button, } from 'antd';
// add i18n.
import { IntlProvider, FormattedMessage } from 'react-intl';
import en_US from '../../language/en_US.js';
import zh_CN from '../../language/zh_CN';

import './home.scss';

let constance = require('../../abi/constance.json');

export default class Item extends Component {
  constructor(props) {
    super(props);

    this.state = {
      logo: {
        USDT: USDT_logo,
        USDC: USDC_logo,
        DAI: DAI_logo
      },
      token_d_name: ['dUSDT', 'dUSDC', 'dDAI'],
    };
  }



  get_token_status = () => {
    let url_apy = constance.url_apy + 'main';

    fetch(url_apy).then(res => res.text()).then((data) => {
      if (!(data && Object.keys(data).length > 0)) {
        return console.log('no data return...');
      }

      let obj_data = JSON.parse(data);
      let token_arr = Object.keys(obj_data);

      let token_data_arr = [];
      for (let i = 0; i < token_arr.length; i++) {
        token_data_arr[i] = obj_data[token_arr[i]]
      }

      this.setState({ token_arr, token_data_arr })
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

    setInterval(() => {
      this.get_token_status();
    }, 1000 * 5);
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

              {/* <div className="nodata-wrap">
              <img alt='' src={no_history} />
              <span className="no-data-span">
                <FormattedMessage id='no_data' />
                no_data
              </span>
            </div> */}

              {
                this.state.token_arr && this.state.token_arr.length > 0 &&
                this.state.token_arr.map((item, index) => {
                  return (
                    <dd key={index} style={{ fontWeight: 'bold', fontSize: '18px' }}>
                      <div className={"leftColumn"}>
                        <img src={this.state.logo[this.state.token_arr[index].slice(1)]} />
                        <div className={"rightText"}>
                          <h3>{this.state.token_arr[index].slice(1)}</h3>
                        </div>
                      </div>
                      <span>
                        {this.format_str_to_kmb(this.state.token_data_arr[index].net_value)}
                      </span>
                      <span>
                        {this.state.token_data_arr[index].now_apy}%
                    </span>
                      <span className={"btn-wrap"}>

                        <Link to={{ pathname: '/dapp', state: { cur_index: this.state.token_d_name.indexOf(this.state.token_arr[index]) } }}>
                          <Button>
                            <FormattedMessage id='DEPOSIT' />
                          </Button>
                        </Link>

                        <Link to={{ pathname: '/dapp', state: { cur_index: this.state.token_d_name.indexOf(this.state.token_arr[index]), is_withdraw: true } }}>
                          <Button>
                            <FormattedMessage id='WITHDRAW' />
                          </Button>
                        </Link>
                      </span>
                    </dd>
                  )
                })
              }
            </dl>
          </section>
        </div>
      </IntlProvider>
    );
  }
}

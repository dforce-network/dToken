import React, { Component } from 'react';
import { Button, Modal, Input } from 'antd';
import './style/admin.scss';
import './style/model.scss';
import Web3 from 'web3';
import {
    get_nettype,
    init_baseData_contract,
    format_bn,
    format_num_to_K,
    init_contract,
    get_decimals,
    get_my_account,
} from './utils.js';
import env from './abi/env';

let token_abi_d = require('./abi/tokensABI_d.json');
let address_map = env.ADDRESS;


class Admin extends Component {
    constructor(props) {
        super(props);

        this.state = {
            active_index: 0,
            token_name: ['USDT', 'USDC', 'DAI', 'TUSD', 'PAX', 'USDx'],
            show_rebalance: false,
            token_status: {}
        }

        this.new_web3 = window.new_web3 = new Web3(Web3.givenProvider || null);
        this.bn = this.new_web3.utils.toBN;
    }


    init_status = async () => {
        let nettype = await get_nettype(this.new_web3);
        for (let i = 0; i < this.state.token_name.length; i++) {
            // console.log(address_map[nettype][this.state.token_name[i]]);
            if (!address_map[nettype][this.state.token_name[i]]) {
                return console.log('no this address');
            }
        }
        if (!address_map[nettype]['DTokenCommonData']) {
            return console.log('no this address');
        }

        let baseData_contract = await init_baseData_contract(this.new_web3, nettype);
        let decimals_arr = [];
        let contract_arr = [];
        for (let i = 0; i < this.state.token_name.length; i++) {
            let t_contract = await init_contract(this.new_web3, nettype, this.state.token_name[i]);
            contract_arr.push(new this.new_web3.eth.Contract(token_abi_d, address_map[nettype]['d' + this.state.token_name[i]]));
            decimals_arr.push(await get_decimals(t_contract))
        }
        // console.log(contract_arr);
        let my_account = await get_my_account(this.new_web3);

        this.setState({
            net_type: nettype,
            baseData_contract: baseData_contract,
            decimals_arr: decimals_arr,
            my_account: my_account,
            contract_arr: contract_arr
        }, () => {
            for (let i = 0; i < this.state.token_name.length; i++) {
                this.get_token_BaseData(this.state.token_name[i], i);
            }
        })
    }
    get_token_BaseData = async (token, idx) => {
        let res_tokenData = await this.state.baseData_contract.methods.getDTokenData(address_map[this.state.net_type]['d' + token]).call();
        // console.log(contract);
        let total = res_tokenData[0];
        let dtoken_total = res_tokenData[1];
        let address_arr = res_tokenData[2];
        let percent_arr = res_tokenData[3];
        let cash_arr = res_tokenData[4];
        let supply_arr = res_tokenData[5];
        let borrow_arr = res_tokenData[6];
        let token_decimal = this.state.decimals_arr[idx];
        let t_obj = { total, dtoken_total, address_arr, percent_arr, cash_arr, supply_arr, borrow_arr, token_decimal }

        this.setState({
            token_status: {
                ...this.state.token_status,
                [token]: t_obj
            }
        }, () => {
            // console.log(Object.keys(this.state.token_status).length);
            if (Object.keys(this.state.token_status).length === this.state.token_name.length) {
                this.setState({
                    is_ok: true
                })
            }
        })
    }


    open_show_rebalance = (index) => {
        // console.log(this.state.token_status[this.state.token_name[index]]);
        let rebalance_data = JSON.parse(JSON.stringify(this.state.token_status[this.state.token_name[index]]));
        let action_arr = [];
        let action_arr__isMax = [];
        let action_arr__number = [];
        let action_arr__number__input = [];

        let action_arr__number__tobe = JSON.parse(JSON.stringify(rebalance_data.percent_arr));
        for (let i = 0; i < rebalance_data.percent_arr.length; i++) {
            if (i === 0) {
                action_arr[0] = '0';
                action_arr__number[0] = '0';
                action_arr__number__input[0] = '0';
                action_arr__isMax[0] = '0';
            } else {
                action_arr[i] = 'supply';
                action_arr__number[i] = '0';
                action_arr__number__input[i] = '0';
                action_arr__isMax[0] = '0';
            }
        }
        rebalance_data.action_arr = action_arr;
        rebalance_data.action_arr__number = action_arr__number;
        rebalance_data.action_arr__number__input = action_arr__number__input;
        rebalance_data.action_arr__number__tobe = action_arr__number__tobe;
        rebalance_data.action_arr__isMax = action_arr__isMax;
        this.setState({
            rebalance_data: rebalance_data,
            show_rebalance: true,
            cur_contract: this.state.contract_arr[index]
        }, () => {
            console.log(this.state.rebalance_data)
            this.number_changed('0', 0);
        })
    }

    i_will_widthdraw = (index) => {
        console.log('withdraw', index)
        console.log(this.state.rebalance_data)
        let action_arr = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr));
        action_arr[index] = 'withdraw';

        this.setState({
            rebalance_data: {
                ...this.state.rebalance_data,
                action_arr
            }
        }, () => {
            console.log(this.state.rebalance_data)
            this.number_changed('0', index)
        })
    }

    i_will_supply = (index) => {
        console.log('supply', index)
        console.log(this.state.rebalance_data)
        let action_arr = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr));
        let action_arr__isMax = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr__isMax));

        action_arr[index] = 'supply';
        action_arr__isMax[index] = '0';

        this.setState({
            rebalance_data: {
                ...this.state.rebalance_data,
                action_arr,
                action_arr__isMax
            }
        }, () => {
            console.log(this.state.rebalance_data)
            this.number_changed('0', index)
        })
    }

    number_changed = (value, index) => {
        // console.log(value, index)
        // console.log(this.state.rebalance_data.action_arr[index])
        // console.log(this.state.rebalance_data.token_decimal)
        // let value_bn = this.bn(value).mul(this.bn(10).pow(this.bn(t_decimal))).toString();
        let t_decimal = this.state.rebalance_data.token_decimal;

        let value_bn;
        if (value.indexOf('.') > 0) {
            var sub_num = value.length - value.indexOf('.') - 1; // 3
            value_bn = value.substr(0, value.indexOf('.')) + value.substr(value.indexOf('.') + 1); // '123456'
            value_bn = this.bn(value_bn).mul(this.bn(10 ** (t_decimal - sub_num))).toString(); // bn_'123456'
        } else {
            value_bn = this.bn(value).mul(this.bn(10).pow(this.bn(t_decimal))).toString();
        }


        let action_arr__isMax = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr__isMax));
        let action_arr__number = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr__number));
        let action_arr__number__input = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr__number__input));

        action_arr__number[index] = value_bn;
        action_arr__number__input[index] = value;
        action_arr__isMax[index] = '0';

        this.setState({
            rebalance_data: {
                ...this.state.rebalance_data,
                action_arr__number,
                action_arr__number__input,
                action_arr__isMax
            }
        }, () => {
            // console.log(this.state.rebalance_data);
            this.handle__tobe_data();
        })
    }

    number_changed__spe = (index) => {
        // console.log(value, index)
        // console.log(this.state.rebalance_data.action_arr[index])
        // console.log(this.state.rebalance_data.token_decimal)
        // let value_bn = this.bn(value).mul(this.bn(10).pow(this.bn(t_decimal))).toString();
        let t_decimal = this.state.rebalance_data.token_decimal;

        // let value_bn;
        // if (value.indexOf('.') > 0) {
        //     var sub_num = value.length - value.indexOf('.') - 1; // 3
        //     value_bn = value.substr(0, value.indexOf('.')) + value.substr(value.indexOf('.') + 1); // '123456'
        //     value_bn = this.bn(value_bn).mul(this.bn(10 ** (t_decimal - sub_num))).toString(); // bn_'123456'
        // } else {
        //     value_bn = this.bn(value).mul(this.bn(10).pow(this.bn(t_decimal))).toString();
        // }


        let action_arr__isMax = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr__isMax));
        let percent_arr = JSON.parse(JSON.stringify(this.state.rebalance_data.percent_arr));
        let action_arr__number = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr__number));
        let action_arr__number__input = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr__number__input));

        action_arr__isMax[index] = 'max';
        action_arr__number[index] = percent_arr[index];
        action_arr__number__input[index] = format_bn(percent_arr[index], t_decimal, 4);

        this.setState({
            rebalance_data: {
                ...this.state.rebalance_data,
                action_arr__number,
                action_arr__number__input,
                action_arr__isMax
            }
        }, () => {
            // console.log(this.state.rebalance_data);
            this.handle__tobe_data();
        })
    }


    handle__tobe_data = () => {
        let action_arr__number__tobe = [];

        for (let i = 0; i < this.state.rebalance_data.action_arr.length; i++) {
            if (i === 0) {
                action_arr__number__tobe[0] = '0';
            } else {
                if (this.state.rebalance_data.action_arr[i] === 'supply') {
                    let supply__amount = this.state.rebalance_data.action_arr__number[i];
                    // action_arr__number__tobe[0] = this.bn(this.state.rebalance_data.percent_arr[0]).sub(this.bn(supply__amount)).toString();
                    action_arr__number__tobe[i] = this.bn(this.state.rebalance_data.percent_arr[i]).add(this.bn(supply__amount)).toString();
                } else {
                    let withdraw__amount = this.state.rebalance_data.action_arr__number[i];
                    // action_arr__number__tobe[0] = this.bn(this.state.rebalance_data.percent_arr[0]).add(this.bn(withdraw__amount)).toString();
                    action_arr__number__tobe[i] = this.bn(this.state.rebalance_data.percent_arr[i]).sub(this.bn(withdraw__amount)).toString();
                }
            }
        }

        this.setState({
            rebalance_data: {
                ...this.state.rebalance_data,
                action_arr__number__tobe
            }
        }, () => {
            console.log(this.state.rebalance_data);

            this.check__before_send();
        })
    }

    check__before_send = () => {
        let rebalance_data = JSON.parse(JSON.stringify(this.state.rebalance_data));

        let total__exec0 = 0;
        for (let i = 0; i < rebalance_data.action_arr__number__tobe.length; i++) {
            if (i !== 0) {
                total__exec0 = this.bn(total__exec0).add(this.bn(rebalance_data.action_arr__number__tobe[i])).toString();
            }
        }
        // console.log(total__exec0);
        // console.log(rebalance_data.total);
        // console.log(this.bn(rebalance_data.total).sub(this.bn(total__exec0)).toString());

        rebalance_data.action_arr__number__tobe[0] = this.bn(rebalance_data.total).sub(this.bn(total__exec0)).toString();
        rebalance_data.checked = true;

        this.setState({
            rebalance_data
        }, () => {
            // console.log(this.state.rebalance_data);
            // this.package__data__send();
        })
    }

    package__data__send = () => {
        console.log(this.state.rebalance_data);
        console.log(this.state.rebalance_data.action_arr);

        let withdraw__arr = [];
        let withdraw__arr__amount = [];
        let supply__arr = [];
        let supply__arr__amount = [];

        for (let i = 0; i < this.state.rebalance_data.action_arr.length; i++) {
            if (i !== 0) {
                if (this.state.rebalance_data.action_arr[i] === 'supply') {
                    supply__arr.push(this.state.rebalance_data.address_arr[i]);
                    supply__arr__amount.push(this.state.rebalance_data.action_arr__number[i]);
                } else {
                    if (this.state.rebalance_data.action_arr__isMax[i] === 'max') {
                        withdraw__arr.push(this.state.rebalance_data.address_arr[i]);
                        withdraw__arr__amount.push('115792089237316195423570985008687907853269984665640564039457584007913129639935');
                    } else {
                        withdraw__arr.push(this.state.rebalance_data.address_arr[i]);
                        withdraw__arr__amount.push(this.state.rebalance_data.action_arr__number[i]);
                    }
                }
            }
        }

        console.log(withdraw__arr)
        console.log(withdraw__arr__amount)
        console.log(supply__arr)
        console.log(supply__arr__amount)

        this.state.cur_contract.methods.rebalance(withdraw__arr, withdraw__arr__amount, supply__arr, supply__arr__amount).send(
            {
                from: this.state.my_account,
                // gas: constance.gas
            }, (reject, res_hash) => {
                if (reject) { }
                if (res_hash) {
                    console.log(res_hash);
                    this.setState({
                        show_rebalance: false,
                    })
                }
            }
        )
    }



    componentDidMount = () => {
        if (!Web3.givenProvider) {
            return console.log('no web3 provider');
        }
        this.init_status();

        setInterval(() => {
            console.log('setInterval');
            if (!this.state.is_ok) { return console.log('not ok') }
            for (let i = 0; i < this.state.token_name.length; i++) {
                this.get_token_BaseData(this.state.token_name[i], i);
            }
        }, 1000 * 10);

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
            <>
                <Modal
                    visible={this.state.show_rebalance}
                    onCancel={() => { this.setState({ show_rebalance: false }) }}
                    footer={false}
                    maskClosable={false}
                >
                    <div className='modal-title'>Rebalance</div>

                    <InternalItem rebalance_data={this.state.rebalance_data} />

                    {
                        this.state.rebalance_data &&
                        this.state.rebalance_data.address_arr.map((address_item, index) => {
                            if (index === 0) { return false }
                            return (
                                <HandlerItem
                                    key={address_item}
                                    address_item={address_item}
                                    rebalance_data={this.state.rebalance_data}
                                    index={index}
                                    net_type={this.state.net_type}
                                    i_will_widthdraw={(index) => { this.i_will_widthdraw(index) }}
                                    i_will_supply={(index) => { this.i_will_supply(index) }}
                                    number_changed={(val, index) => { this.number_changed(val, index) }}
                                    number_changed__spe={(index) => { this.number_changed__spe(index) }}
                                />
                            )
                        })
                    }

                    <div className='btm-btn-wrap'>
                        {/* <Button onClick={() => { this.check__before_send() }}>
                            check
                        </Button> */}
                        <Button onClick={() => { this.package__data__send() }}>
                            Confirm
                        </Button>
                    </div>
                </Modal>


                <div className='admin'>
                    <div className='admin-left'>
                        {
                            this.state.token_name.map((item, idx) => {
                                return (
                                    <React.Fragment key={idx}>
                                        <div
                                            className={this.state.active_index === idx ? 'token-item active' : 'token-item'}
                                            onClick={() => { this.setState({ active_index: idx }) }}
                                        >
                                            {item}
                                        </div>
                                        {(idx !== this.state.token_name.length - 1) && <div className='line'></div>}
                                    </React.Fragment>
                                )
                            })
                        }
                    </div>

                    <div className='admin-right'>
                        {
                            this.state.token_status[this.state.token_name[this.state.active_index]] &&
                            <>
                                <div className='top'>
                                    <div className='total'>
                                        <span className='title'>Total: </span>
                                        <span className='value'>
                                            {
                                                format_num_to_K(format_bn(
                                                    this.state.token_status[this.state.token_name[this.state.active_index]].total,
                                                    this.state.token_status[this.state.token_name[this.state.active_index]].token_decimal,
                                                    2
                                                ))
                                            }
                                        </span>
                                    </div>
                                    <div className='dtoken-total'>
                                        <span className='title'>dToken Total: </span>
                                        <span className='value'>
                                            {
                                                format_num_to_K(format_bn(
                                                    this.state.token_status[this.state.token_name[this.state.active_index]].dtoken_total,
                                                    this.state.token_status[this.state.token_name[this.state.active_index]].token_decimal,
                                                    2
                                                ))
                                            }
                                        </span>
                                    </div>
                                    <div className='btn-wrap-admin'>
                                        <Button onClick={() => { this.open_show_rebalance(this.state.active_index) }}>Rebalance</Button>
                                    </div>
                                </div>


                                <div className='bottom'>
                                    <div className='pool'>
                                        <div className='pool-item'>
                                            <span className='pool-item-1'>Internal Pool</span>
                                            <span className='pool-item-2'>
                                                {
                                                    format_num_to_K(format_bn(
                                                        this.state.token_status[this.state.token_name[this.state.active_index]].percent_arr[0],
                                                        this.state.token_status[this.state.token_name[this.state.active_index]].token_decimal,
                                                        2
                                                    ))
                                                }
                                            </span>
                                            <span className='pool-item-3'>
                                                {
                                                    Number(
                                                        this.state.token_status[this.state.token_name[this.state.active_index]].percent_arr[0] /
                                                        this.state.token_status[this.state.token_name[this.state.active_index]].total *
                                                        100
                                                    ).toFixed(2)
                                                }%
                                            </span>
                                        </div>
                                    </div>

                                    <div className='card'>
                                        {
                                            this.state.token_status[this.state.token_name[this.state.active_index]].address_arr.map((item, idx) => {
                                                if (idx === 0) { return false }
                                                return (
                                                    <div className='card-item' key={idx}>
                                                        <div className='card-item-top'>
                                                            {/* <span className='card-item-1'>{item}</span> */}
                                                            <AddressToTokenName address={item} net={this.state.net_type} />
                                                            <span className='card-item-2'>
                                                                {format_num_to_K(format_bn(
                                                                    this.state.token_status[this.state.token_name[this.state.active_index]].percent_arr[idx],
                                                                    this.state.token_status[this.state.token_name[this.state.active_index]].token_decimal,
                                                                    2
                                                                ))}
                                                            </span>
                                                            <span className='card-item-3'>
                                                                {
                                                                    Number(
                                                                        this.state.token_status[this.state.token_name[this.state.active_index]].percent_arr[idx] /
                                                                        this.state.token_status[this.state.token_name[this.state.active_index]].total *
                                                                        100
                                                                    ).toFixed(2)
                                                                }%
                                                            </span>
                                                        </div>
                                                        <div className='card-item-bottom'>
                                                            <span className='card-item-1'>
                                                                <span className='title'>Cash</span>
                                                                <span className='value'>
                                                                    {format_num_to_K(format_bn(
                                                                        this.state.token_status[this.state.token_name[this.state.active_index]].cash_arr[idx],
                                                                        this.state.token_status[this.state.token_name[this.state.active_index]].token_decimal,
                                                                        2
                                                                    ))}
                                                                </span>
                                                            </span>
                                                            <span className='card-item-2'>
                                                                <span className='title'>Supply APR</span>
                                                                <span className='value'>
                                                                    {format_num_to_K(format_bn(
                                                                        this.state.token_status[this.state.token_name[this.state.active_index]].supply_arr[idx],
                                                                        16,
                                                                        2
                                                                    ))}%
                                                                </span>
                                                            </span>
                                                            <span className='card-item-3'>
                                                                <span className='title'>Borrow APR</span>
                                                                <span className='value'>
                                                                    {format_num_to_K(format_bn(
                                                                        this.state.token_status[this.state.token_name[this.state.active_index]].borrow_arr[idx],
                                                                        16,
                                                                        2
                                                                    ))}%
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        }

                                        <div className='clear'></div>

                                    </div>
                                </div>
                            </>
                        }





                        {
                            !this.state.is_ok &&
                            <>
                                <div className='top'>
                                    <div className='total'>
                                        <span className='title'>Total: </span>
                                        <span className='value'> ...</span>
                                    </div>
                                    <div className='dtoken-total'>
                                        <span className='title'>dToken Total: </span>
                                        <span className='value'> ...</span>
                                    </div>
                                </div>


                                <div className='bottom'>
                                    <div className='pool'>
                                        <div className='pool-item'>
                                            <span className='pool-item-1'>Internal Pool</span>
                                            <span className='pool-item-2'>...</span>
                                            <span className='pool-item-3'>...%</span>
                                        </div>
                                    </div>

                                    <div className='card'>

                                        <div className='card-item'>
                                            <div className='card-item-top'>
                                                <span className='card-item-1'>...</span>
                                                <span className='card-item-2'>...</span>
                                                <span className='card-item-3'>...%</span>
                                            </div>
                                            <div className='card-item-bottom'>
                                                <span className='card-item-1'>
                                                    <span className='title'>Cash</span>
                                                    <span className='value'>...</span>
                                                </span>
                                                <span className='card-item-2'>
                                                    <span className='title'>Supply APR</span>
                                                    <span className='value'>...%</span>
                                                </span>
                                                <span className='card-item-3'>
                                                    <span className='title'>Borrow APR</span>
                                                    <span className='value'>...%</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div className='clear'></div>

                                    </div>
                                </div>
                            </>
                        }



                    </div>
                </div>
            </>
        )
    }
}
export default Admin;

function AddressToTokenName(props) {
    return (
        <span className='card-item-1'>
            {address_map[props.net]['Handler'][props.address]}
        </span>
    )
}
function InternalItem(props) {
    return (
        <div className='InternalItem'>
            <div className='Item-wrap'>
                <span className='Item-1'>Internal Pool</span>
                <span className='Item-2'>
                    {
                        format_num_to_K(format_bn(props.rebalance_data.percent_arr[0], props.rebalance_data.token_decimal, 2))
                    }
                </span>
                <span className='Item-3'>
                    {
                        Number(props.rebalance_data.percent_arr[0] / props.rebalance_data.total * 100).toFixed(2)
                    }%
                </span>
            </div>
            {
                props.rebalance_data.checked &&
                <div className='Item-wrap tobe__color'>
                    <span className='Item-1' style={{ opacity: 0 }}>Internal Pool</span>
                    <span className='Item-2'>
                        {
                            format_num_to_K(format_bn(props.rebalance_data.action_arr__number__tobe[0], props.rebalance_data.token_decimal, 2))
                        }
                    </span>
                    <span className='Item-3'>
                        {
                            Number(props.rebalance_data.action_arr__number__tobe[0] / props.rebalance_data.total * 100).toFixed(2)
                        }%
                </span>
                </div>
            }
        </div>
    )
}
function HandlerItem(props) {
    return (
        <div className='HandlerItem'>
            <div className='Item-wrap'>
                <span className='Item-1'>
                    <AddressToTokenName address={props.address_item} net={props.net_type} />
                </span>
                <span className='Item-2'>
                    {
                        format_num_to_K(format_bn(props.rebalance_data.percent_arr[props.index], props.rebalance_data.token_decimal, 2))
                    }
                </span>
                <span className='Item-3'>
                    {
                        Number(props.rebalance_data.percent_arr[props.index] / props.rebalance_data.total * 100).toFixed(2)
                    }%
                    </span>
            </div>
            {
                props.rebalance_data.checked &&
                <div className='Item-wrap tobe__color'>
                    <span className='Item-1' style={{ opacity: 0 }}>Handler</span>
                    <span className='Item-2'>
                        {
                            format_num_to_K(format_bn(props.rebalance_data.action_arr__number__tobe[props.index], props.rebalance_data.token_decimal, 2))
                        }
                    </span>
                    <span className='Item-3'>
                        {
                            Number(props.rebalance_data.action_arr__number__tobe[props.index] / props.rebalance_data.total * 100).toFixed(2)
                        }%
                    </span>
                </div>
            }
            <div className='Reset-wrap'>
                <div className='reset-btn'>
                    <Button
                        className={props.rebalance_data.action_arr[props.index] === 'supply' ? 'btn-active' : 'btn-active-not'}
                        onClick={() => { props.i_will_supply(props.index) }}
                    >+</Button>
                    <Button
                        className={props.rebalance_data.action_arr[props.index] === 'withdraw' ? 'btn-active' : 'btn-active-not'}
                        onClick={() => { props.i_will_widthdraw(props.index) }}
                    >-</Button>
                </div>
                <div className='reset-input'>
                    <Input
                        value={props.rebalance_data.action_arr__number__input[props.index]}
                        type='number'
                        onChange={(e) => { props.number_changed(e.target.value, props.index) }}
                    />
                    {
                        props.rebalance_data.action_arr[props.index] === 'withdraw' &&
                        <span className='reset-input-max' onClick={() => { props.number_changed__spe(props.index) }}>MAX</span>
                    }
                </div>
                {/* <div className='reset-ok'>
                    OK
                </div> */}
            </div>
        </div>
    )
}

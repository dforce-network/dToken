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

let address_map = env.ADDRESS;
// let address_map = require('./abi/address_map.json');


class Admin extends Component {
    constructor(props) {
        super(props);

        this.state = {
            active_index: 0,
            token_name: ['USDT', 'USDC', 'DAI'],
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
        for (let i = 0; i < this.state.token_name.length; i++) {
            let t_contract = await init_contract(this.new_web3, nettype, this.state.token_name[i]);
            decimals_arr.push(await get_decimals(t_contract))
        }
        let my_account = await get_my_account(this.new_web3);

        this.setState({
            net_type: nettype,
            baseData_contract: baseData_contract,
            decimals_arr: decimals_arr,
            my_account: my_account
        }, () => {
            for (let i = 0; i < this.state.token_name.length; i++) {
                this.get_token_BaseData(this.state.token_name[i], i);
            }
        })
    }
    get_token_BaseData = async (token, idx) => {
        let res_tokenData = await this.state.baseData_contract.methods.getDTokenData(address_map[this.state.net_type]['d' + token]).call();
        // console.log(res_tokenData);
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
        let action_arr__number = [];
        let action_arr__number__tobe = JSON.parse(JSON.stringify(rebalance_data.percent_arr));
        for (let i = 0; i < rebalance_data.percent_arr.length; i++) {
            if (i === 0) {
                action_arr[0] = 'internal';
                action_arr__number[0] = 'internal';
            } else {
                action_arr[i] = 'supply';
                action_arr__number[i] = '0';
            }
        }
        rebalance_data.action_arr = action_arr;
        rebalance_data.action_arr__number = action_arr__number;
        rebalance_data.action_arr__number__tobe = action_arr__number__tobe;
        this.setState({
            rebalance_data: rebalance_data,
            show_rebalance: true
        }, () => {
            console.log(this.state.rebalance_data)
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
        })
    }

    i_will_supply = (index) => {
        console.log('supply', index)
        console.log(this.state.rebalance_data)
        let action_arr = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr));
        action_arr[index] = 'supply';

        this.setState({
            rebalance_data: {
                ...this.state.rebalance_data,
                action_arr
            }
        }, () => {
            console.log(this.state.rebalance_data)
        })
    }

    number_changed = (value, index) => {
        // console.log(value, index)
        // console.log(this.state.rebalance_data.action_arr[index])
        // console.log(this.state.rebalance_data.token_decimal)
        let t_decimal = this.state.rebalance_data.token_decimal;

        value = this.bn(value).mul(this.bn(10).pow(this.bn(t_decimal))).toString();

        let action_arr__number = JSON.parse(JSON.stringify(this.state.rebalance_data.action_arr__number));
        action_arr__number[index] = value;

        this.setState({
            rebalance_data: {
                ...this.state.rebalance_data,
                action_arr__number
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
                console.log('i===0')
            } else {
                if (this.state.rebalance_data.action_arr[i] === 'supply') {
                    let supply__amount = this.state.rebalance_data.action_arr__number[i];
                    action_arr__number__tobe[0] = this.bn(this.state.rebalance_data.action_arr__number__tobe[0]).sub(this.bn(supply__amount)).toString();
                    action_arr__number__tobe[i] = this.bn(this.state.rebalance_data.action_arr__number__tobe[i]).add(this.bn(supply__amount)).toString();
                } else {
                    let withdraw__amount = this.state.rebalance_data.action_arr__number[i];
                    action_arr__number__tobe[0] = this.bn(this.state.rebalance_data.action_arr__number__tobe[0]).add(this.bn(withdraw__amount)).toString();
                    action_arr__number__tobe[i] = this.bn(this.state.rebalance_data.action_arr__number__tobe[i]).sub(this.bn(withdraw__amount)).toString();
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
        })
    }






    click_confirm = () => {
        if (!((this.state.passed_part1 && this.state.passed_part2) || (this.state.passed_part3 && this.state.passed_part4))) {
            return console.log('not passed.');
        }

        let withdraw_str__to_arr = this.state.withdraw_str && this.state.withdraw_str.split(',') || [];
        let withdraw_amount_str__to_arr = this.state.withdraw_amount_str && this.state.withdraw_amount_str.split(',') || [];
        let supply_str__to_arr = this.state.supply_str && this.state.supply_str.split(',') || [];
        let supply_amount_str__to_arr = this.state.supply_amount_str && this.state.supply_amount_str.split(',') || [];

        this.setState({
            withdraw_str__to_arr: withdraw_str__to_arr,
            withdraw_amount_str__to_arr: withdraw_amount_str__to_arr,
            supply_str__to_arr: supply_str__to_arr,
            supply_amount_str__to_arr: supply_amount_str__to_arr,
            show_next: true
        })
        console.log('click_confirm')
    }


    // *** change ***
    withdraw_change = (val) => {
        // console.log(val)
        // console.log(val.split(',')) // "↵"

        this.setState({
            withdraw_str: val
        })

        if (this.state.cur_token === 'dUSDT') {
            let addr_Aave = address_map[this.state.net_type]['Aave_Handler'];
            if (val.split(',')[0] === addr_Aave) {
                this.setState({
                    passed_part1: true
                })
            } else {
                this.setState({
                    passed_part1: false
                })
            }
        } else if (this.state.cur_token === 'dUSDC') {
            let addr_Compound = address_map[this.state.net_type]['Compound_Handler'];
            if (val.split(',')[0] === addr_Compound) {
                this.setState({
                    passed_part1: true
                })
            } else {
                this.setState({
                    passed_part1: false
                })
            }
        }
    }
    withdraw_amount_change = (val) => {
        // console.log(val)
        // console.log(val.split(','))
        this.setState({
            withdraw_amount_str: val
        })

        if (Number(val) > 0) {
            this.setState({
                passed_part2: true
            })
        } else {
            this.setState({
                passed_part2: false
            })
        }
    }

    supply_change = (val) => {
        // console.log(val)
        this.setState({
            supply_str: val
        })

        if (this.state.cur_token === 'dUSDT') {
            let addr_Aave = address_map[this.state.net_type]['Aave_Handler'];
            if (val.split(',')[0] === addr_Aave) {
                this.setState({
                    passed_part3: true
                })
            } else {
                this.setState({
                    passed_part3: false
                })
            }
        } else if (this.state.cur_token === 'dUSDC') {
            let addr_Compound = address_map[this.state.net_type]['Compound_Handler'];
            if (val.split(',')[0] === addr_Compound) {
                this.setState({
                    passed_part3: true
                })
            } else {
                this.setState({
                    passed_part3: false
                })
            }
        }
    }
    supply_amount_change = (val) => {
        // console.log(val)
        this.setState({
            supply_amount_str: val
        })

        if (Number(val) > 0) {
            this.setState({
                passed_part4: true
            })
        } else {
            this.setState({
                passed_part4: false
            })
        }
    }


    click_confirm_final = () => {
        // console.log(
        //     this.state.withdraw_str.split(','),
        //     this.state.withdraw_amount_str.split(','),
        //     this.state.supply_str.split(','),
        //     this.state.supply_amount_str.split(','))

        let arr_1 = this.state.withdraw_str && this.state.withdraw_str.split(',') || [];
        let arr_2 = this.state.withdraw_amount_str && this.state.withdraw_amount_str.split(',') || [];
        let arr_3 = this.state.supply_str && this.state.supply_str.split(',') || [];
        let arr_4 = this.state.supply_amount_str && this.state.supply_amount_str.split(',') || [];

        for (let i = 0; i < arr_2.length; i++) {
            arr_2[i] = this.bn(arr_2[i]).mul(this.bn(10).pow(this.bn(this.state.cur_decimals))).toString();
        }
        for (let i = 0; i < arr_4.length; i++) {
            arr_4[i] = this.bn(arr_4[i]).mul(this.bn(10).pow(this.bn(this.state.cur_decimals))).toString();
        }

        console.log(arr_1)
        console.log(arr_2)
        console.log(arr_3)
        console.log(arr_4)


        this.state.cur_contract.methods.rebalance(arr_1, arr_2, arr_3, arr_4).send(
            {
                from: this.state.my_account,
                // gas: constance.gas
            }, (reject, res_hash) => {
                if (reject) { }
                if (res_hash) {
                    console.log(res_hash);
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
                                />
                            )
                        })
                    }

                    {
                        !this.state.show_next &&
                        <>
                            <div className='item-btn-wrap'>
                                <Button onClick={() => { this.click_confirm() }}>
                                    Confirm
                                </Button>
                            </div>
                        </>
                    }
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
                props.rebalance_data.percent_arr__to_be &&
                <div className='Item-wrap'>
                    <span className='Item-1' style={{ opacity: 0 }}>Internal Pool</span>
                    <span className='Item-2'>
                        {
                            format_num_to_K(format_bn(props.rebalance_data.percent_arr__to_be[0], props.rebalance_data.token_decimal, 2))
                        }
                    </span>
                    <span className='Item-3'>
                        {
                            Number(props.rebalance_data.percent_arr__to_be[0] / props.rebalance_data.total * 100).toFixed(2)
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
                props.rebalance_data.percent_arr__to_be &&
                <div className='Item-wrap'>
                    <span className='Item-1' style={{ opacity: 0 }}>Handler</span>
                    <span className='Item-2'>
                        {
                            format_num_to_K(format_bn(props.rebalance_data.percent_arr__to_be[props.index], props.rebalance_data.token_decimal, 2))
                        }
                    </span>
                    <span className='Item-3'>
                        {
                            Number(props.rebalance_data.percent_arr__to_be[props.index] / props.rebalance_data.total * 100).toFixed(2)
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
                    <Input type='number' onChange={(e) => { props.number_changed(e.target.value, props.index) }} />
                </div>
                <div className='reset-ok'>
                    OK
                </div>
            </div>
        </div>
    )
}

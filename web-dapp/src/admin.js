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

let address_map = require('./abi/address_map.json');


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



    open_show_rebalance = () => { }

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
                    onCancel={() => {
                        this.setState({
                            show_rebalance: false,
                            show_next: false,
                            withdraw_amount_str: '',
                            supply_amount_str: '',
                            // supply_str: '',
                            // withdraw_str: '',
                            passed_part2: false,
                            passed_part4: false,
                        })
                    }}
                    footer={false}
                    maskClosable={false}
                >
                    <div className='modal-title'>Rebalance</div>

                    {
                        !this.state.show_next &&
                        <>
                            <div className='item-addr'>
                                <span className='item-num-span'>Withdraw:</span>
                                <textarea
                                    placeholder='输入地址，英文逗号隔开'
                                    onChange={(e) => { this.withdraw_change(e.target.value) }}>
                                </textarea>
                            </div>
                            <div className='item-num'>
                                <span className='item-num-span'>WithdrawAmount:</span>
                                <Input
                                    placeholder='输入数量，英文逗号隔开'
                                    value={this.state.withdraw_amount_str}
                                    onChange={(e) => { this.withdraw_amount_change(e.target.value) }}
                                />
                            </div>


                            <div className='item-addr'>
                                <span className='item-num-span'>Supply:</span>
                                <textarea
                                    placeholder='输入地址，英文逗号隔开'
                                    onChange={(e) => { this.supply_change(e.target.value) }}>
                                </textarea>
                            </div>
                            <div className='item-num'>
                                <span className='item-num-span'>SupplyAmount:</span>
                                <Input
                                    placeholder='输入数量，英文逗号隔开'
                                    value={this.state.supply_amount_str}
                                    onChange={(e) => { this.supply_amount_change(e.target.value) }}
                                />
                            </div>

                            <div className='item-btn-wrap'>
                                <Button
                                    // disabled={(!this.state.passed_part1 || !this.state.passed_part2 || !this.state.passed_part3 || !this.state.passed_part4) ? true : false}
                                    disabled={
                                        !((this.state.passed_part1 && this.state.passed_part2) || (this.state.passed_part3 && this.state.passed_part4))
                                    }
                                    onClick={() => { this.click_confirm() }}
                                >
                                    Confirm
                                </Button>
                            </div>

                        </>
                    }


                    {
                        this.state.show_next &&
                        <>
                            <div className='item-addr'>
                                <span className='item-num-span' style={{ color: '#7B7D8F' }}>Withdraw:</span>
                                <div className='item-right-value'>
                                    {
                                        this.state.withdraw_str__to_arr.map((item, index) => {
                                            return (<span key={index} className='item-right-value-span'>{item}</span>)
                                        })
                                    }
                                </div>
                            </div>
                            <div className='item-addr'>
                                <span className='item-num-span' style={{ color: '#7B7D8F' }}>WithdrawAmount:</span>
                                <div className='item-right-value'>
                                    {
                                        this.state.withdraw_amount_str__to_arr.map((item, index) => {
                                            return (<span key={index} className='item-right-value-span'>{format_num_to_K(format_bn(item, 0, 2))}</span>)
                                        })
                                    }

                                    <div style={{ height: 0, borderBottom: '1px dashed #E0E1EC', marginTop: '25px', marginBottom: '10px' }}></div>
                                </div>
                            </div>

                            <div className='item-addr'>
                                <span className='item-num-span' style={{ color: '#7B7D8F' }}>Supply:</span>
                                <div className='item-right-value'>
                                    {
                                        this.state.supply_str__to_arr.map((item, index) => {
                                            return (<span key={index} className='item-right-value-span'>{item}</span>)
                                        })
                                    }
                                </div>
                            </div>
                            <div className='item-addr'>
                                <span className='item-num-span' style={{ color: '#7B7D8F' }}>SupplyAmount:</span>
                                <div className='item-right-value'>
                                    {
                                        this.state.supply_amount_str__to_arr.map((item, index) => {
                                            return (<span key={index} className='item-right-value-span'>{format_num_to_K(format_bn(item, 0, 2))}</span>)
                                        })
                                    }

                                    <div style={{ height: 0, borderBottom: '1px dashed #E0E1EC', marginTop: '25px', marginBottom: '10px' }}></div>
                                </div>
                            </div>

                            {/* <div className='item-msg'>
                                <span className='item-num-span' style={{ color: '#7B7D8F' }}>Internal Pool:</span>
                                <div className='item-right-value'>
                                    <span className='item-right-value1'>123,456,123.12</span>
                                    <span className='item-right-value2'>12.12%</span>
                                </div>
                            </div>
                            <div className='item-msg'>
                                <span className='item-num-span' style={{ color: '#7B7D8F' }}>Compound:</span>
                                <div className='item-right-value'>
                                    <span className='item-right-value1'>123,456,123.12</span>
                                    <span className='item-right-value2'>12.12%</span>
                                </div>
                            </div>
                            <div className='item-msg'>
                                <span className='item-num-span' style={{ color: '#7B7D8F' }}>Aave:</span>
                                <div className='item-right-value'>
                                    <span className='item-right-value1'>123,456,123.12</span>
                                    <span className='item-right-value2'>12.12%</span>
                                </div>
                            </div> */}


                            <div className='item-btn-wrap'>
                                <Button onClick={() => { this.click_confirm_final() }}>Confirm</Button>
                            </div>
                        </>
                    }


                </Modal>


                <div className='admin'>
                    <div className='admin-left'>
                        {
                            this.state.token_name.map((item, idx) => {
                                return (
                                    <>
                                        <div
                                            key={idx}
                                            className={this.state.active_index === idx ? 'token-item active' : 'token-item'}
                                            onClick={() => { this.setState({ active_index: idx }) }}
                                        >
                                            {item}
                                        </div>
                                        {(idx !== this.state.token_name.length - 1) && <div className='line'></div>}
                                    </>
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
                                    <div className='btn-wrap'>
                                        <Button disabled={true} onClick={() => { this.open_show_rebalance() }}>Rebalance</Button>
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
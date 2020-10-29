import env from './abi/env';
import moment from 'moment';
import axios from 'axios';

let address_map = env.ADDRESS;
let token_abi = require('./abi/tokensABI.json');
let token_abi_d = require('./abi/tokensABI_d.json');
let token_basedata_abi = require('./abi/DTokenCommonDataABI.json');


// *** get balance ***
export const get_balance__mint = async (that) => {
  let temp_balance_arr = [];
  for (let i = 0; i < that.state.token_name.length; i++) {
    temp_balance_arr.push(await get_my_balance(that.state.token_contract[i], that.state.my_account, that.state.net_type))
  }
  // console.log(temp_balance_arr);

  that.setState({
    token_balance: temp_balance_arr,
  })
}
export const get_balance__redeem = async (that) => {
  // let pre_arr = JSON.parse(JSON.stringify(that.state.token_d_balance)) || [];
  // if (pre_arr.length > 0) {
  //   that.setState({
  //     has_set_num: true
  //   })
  // }
  let temp_balance_d_arr = [];
  let temp_balance_d_arr_origin = [];
  for (let i = 0; i < that.state.token_name.length; i++) {
    temp_balance_d_arr.push(await get_my_balance(that.state.token_d_contract[i], that.state.my_account, that.state.net_type))
  }

  // if (!(pre_arr.length > 0)) { pre_arr = JSON.parse(JSON.stringify(that.state.token_d_balance)) }

  temp_balance_d_arr_origin = temp_balance_d_arr.toLocaleString().split(',');
  // console.log(temp_balance_d_arr);
  for (let i = 0; i < that.state.token_d_name.length; i++) {
    let cur_BaseData = that.state.token_BaseData[i];
    if (!cur_BaseData) {
      return console.log(cur_BaseData);
    }
    var base_data_1 = cur_BaseData[1];
    var base_data_3 = cur_BaseData[3];

    var redeem_to_receive_bn = that.bn(temp_balance_d_arr[i]).mul(that.bn(base_data_1)).div(that.bn(10).pow(that.bn(18)));
    redeem_to_receive_bn = redeem_to_receive_bn.sub(redeem_to_receive_bn.mul(that.bn(base_data_3)).div(that.bn(10).pow(that.bn(18))));
    temp_balance_d_arr[i] = redeem_to_receive_bn.toLocaleString();
  }

  that.setState({
    // token_d_balance__prev: pre_arr,
    token_d_balance: temp_balance_d_arr,
    token_d_balance_origin: temp_balance_d_arr_origin,
  })
}
export const get_token_BaseData = async (that) => {
  let temp_basedata_arr = [];
  for (let i = 0; i < that.state.token_d_name.length; i++) {
    temp_basedata_arr.push(await getBaseData(that.state.token_d_contract[i]))
  }

  that.setState({
    token_BaseData: temp_basedata_arr,
  })
}

// *** utils ***
export const init_contract = (instance_web3, nettype, token, is_dtoken = false) => {
  return new Promise((resolve, reject) => {
    let contract = new instance_web3.eth.Contract(is_dtoken ? token_abi_d : token_abi, address_map[nettype][token]);
    // console.log(contract);
    // if (!contract) { reject('err') }
    resolve(contract);
  })
}
export const init_baseData_contract = (instance_web3, nettype) => {
  return new Promise((resolve, reject) => {
    let contract = new instance_web3.eth.Contract(token_basedata_abi, address_map[nettype]['DTokenCommonData']);
    resolve(contract);
  })
}
export const get_my_account = (instance_web3) => {
  return new Promise((resolve, reject) => {
    instance_web3.givenProvider.enable().then((res_accounts) => {
      if (!res_accounts) { reject('err') };
      // console.log(res_accounts[0]);
      resolve(res_accounts[0]);
    })
  })
}
export const check_approve = (instance_contract, token, my_account, nettype, that_bn) => {
  return new Promise((resolve, reject) => {
    if (!instance_contract) { reject('no contract') }
    instance_contract.methods.allowance(my_account, address_map[nettype][token]).call((err, res_allowance) => {
      resolve(that_bn(res_allowance).gt(that_bn(0)));
    });
  })
}
export const get_my_balance = (contract, account) => {
  return new Promise((resolve, reject) => {
    contract.methods.balanceOf(account).call((err, res_balance) => {
      // console.log(contract, res_balance);
      resolve(res_balance)
    });
  })
}
export const getBaseData = (contract) => {
  return new Promise((resolve, reject) => {
    contract.methods.getBaseData().call((err, res_BaseData) => {
      // console.log(res_BaseData);
      resolve(res_BaseData);
    });
  })
}

// *** change ***
export const mint_change = (that, value, cur_decimals) => {
  var reg = new RegExp("[\\u4E00-\\u9FFF]+", "g");
  var rega_Z = /[a-z]/g;

  // alert(rega_Z.test(value));
  if (reg.test(value)) {
    return false;
  }
  if (rega_Z.test(value)) {
    return false;
  }

  if (!that.state.is_already) {
    return console.log('not already...');
  }
  if (value.indexOf('.') > 0) {
    var part2 = value.split('.')[1];
    if (part2.length > 6) {
      return console.log('>6');
    }
  }

  that.setState({
    i_mint_max: false,
  })

  var amount_bn;
  var temp_value = value;
  if (temp_value.indexOf('.') > 0) {
    var sub_num = temp_value.length - temp_value.indexOf('.') - 1;
    temp_value = temp_value.substr(0, temp_value.indexOf('.')) + temp_value.substr(value.indexOf('.') + 1);
    amount_bn = that.bn(temp_value).mul(that.bn(10 ** (cur_decimals - sub_num)));
  } else {
    amount_bn = that.bn(value).mul(that.bn(10 ** cur_decimals));
  }

  let cur_BaseData = that.state.token_BaseData[that.state.cur_index_mint];
  var base_data_1 = cur_BaseData[1];
  var base_data_2 = cur_BaseData[2];

  var mint_to_receive_bn = amount_bn.sub(amount_bn.mul(that.bn(base_data_2)).div(that.bn(10).pow(that.bn(18))));
  mint_to_receive_bn = mint_to_receive_bn.mul(that.bn(10).pow(that.bn(18))).div(that.bn(base_data_1));

  that.setState({
    value_mint: value,
    value_mint_bn: amount_bn,
    mint_to_receive_bn: mint_to_receive_bn,
    is_btn_disabled_mint: false
  }, () => {
    console.log('send: ', that.state.value_mint_bn.toLocaleString(), 'receive: ', that.state.mint_to_receive_bn.toLocaleString())
    if (amount_bn.gt(that.bn(that.state.token_balance[that.state.cur_index_mint]))) {
      console.log('extends...');
      mint_max(that);
    }
  })
}
export const mint_max = (that) => {
  // console.log(that.state.my_balance_paxg);
  if (!that.state.token_balance[that.state.cur_index_mint]) {
    return console.log('not get my_balance_paxg yet');
  }

  if (that.bn(that.state.token_balance[that.state.cur_index_mint]).lte(that.bn(0))) {
    console.log('balance is 0');
    that.setState({
      is_btn_disabled_mint: true
    })
  }

  that.setState({
    i_mint_max: true,
  })

  let cur_BaseData = that.state.token_BaseData[that.state.cur_index_mint];
  var amount_bn = that.bn(that.state.token_balance[that.state.cur_index_mint]);

  var base_data_1 = cur_BaseData[1];
  var base_data_2 = cur_BaseData[2];

  var mint_to_receive_bn = amount_bn.sub(amount_bn.mul(that.bn(base_data_2)).div(that.bn(10).pow(that.bn(18))));
  mint_to_receive_bn = mint_to_receive_bn.mul(that.bn(10).pow(that.bn(18))).div(that.bn(base_data_1));

  that.setState({
    value_mint: format_bn(amount_bn, that.state.token_decimals[that.state.cur_index_mint], 6),
    value_mint_bn: amount_bn,
    mint_to_receive_bn: mint_to_receive_bn,
  })
}
export const redeem_change = (that, value, cur_decimals) => {
  var reg = new RegExp("[\\u4E00-\\u9FFF]+", "g");
  var rega_Z = /[a-z]/g;

  // alert(rega_Z.test(value));
  if (reg.test(value)) {
    return false;
  }
  if (rega_Z.test(value)) {
    return false;
  }
  if (!that.state.is_already) {
    return console.log('not already...');
  }
  if (value.indexOf('.') > 0) {
    var part2 = value.split('.')[1];
    if (part2.length > 6) {
      return console.log('>6');
    }
  }

  that.setState({
    i_redeem_max: false,
  })

  var amount_bn;
  var temp_value = value;
  if (temp_value.indexOf('.') > 0) {
    var sub_num = temp_value.length - temp_value.indexOf('.') - 1;
    temp_value = temp_value.substr(0, temp_value.indexOf('.')) + temp_value.substr(value.indexOf('.') + 1);
    amount_bn = that.bn(temp_value).mul(that.bn(10 ** (cur_decimals - sub_num)));
  } else {
    amount_bn = that.bn(value).mul(that.bn(10 ** cur_decimals));
  }


  let cur_BaseData = that.state.token_BaseData[that.state.cur_index_redeem];
  var base_data_1 = cur_BaseData[1];
  var base_data_3 = cur_BaseData[3];

  var redeem_to_receive_bn = amount_bn.mul(that.bn(base_data_1)).div(that.bn(10).pow(that.bn(18)));
  redeem_to_receive_bn = redeem_to_receive_bn.sub(redeem_to_receive_bn.mul(that.bn(base_data_3)).div(that.bn(10).pow(that.bn(18))));

  that.setState({
    value_redeem: value,
    value_redeem_bn: amount_bn,
    redeem_to_receive_bn: redeem_to_receive_bn,
    is_btn_disabled_redeem: false
  }, () => {
    console.log('send: ', that.state.value_redeem_bn.toLocaleString(), 'receive: ', that.state.redeem_to_receive_bn.toLocaleString())
    if (amount_bn.gt(that.bn(that.state.token_d_balance[that.state.cur_index_redeem]))) {
      console.log('extends...');
      redeem_max(that);
    }
  })
}
export const redeem_max = (that) => {
  // console.log(that.state.my_balance_paxg);
  if (!that.state.token_d_balance[that.state.cur_index_redeem]) {
    return console.log('not get my_balance_paxg yet');
  }

  if (that.bn(that.state.token_d_balance[that.state.cur_index_redeem]).lte(that.bn(0))) {
    console.log('balance is 0');
    that.setState({
      is_btn_disabled_redeem: true
    })
  }

  that.setState({
    i_redeem_max: true,
  })

  let cur_BaseData = that.state.token_BaseData[that.state.cur_index_redeem];
  var amount_bn = that.bn(that.state.token_d_balance[that.state.cur_index_redeem]);

  var base_data_1 = cur_BaseData[1];
  var base_data_3 = cur_BaseData[3];
  var redeem_to_receive_bn = amount_bn.mul(that.bn(base_data_1)).div(that.bn(10).pow(that.bn(18)));
  redeem_to_receive_bn = redeem_to_receive_bn.sub(redeem_to_receive_bn.mul(that.bn(base_data_3)).div(that.bn(10).pow(that.bn(18))));

  that.setState({
    value_redeem: format_bn(amount_bn, that.state.token_decimals[that.state.cur_index_redeem], 6),
    value_redeem_bn: amount_bn,
    redeem_to_receive_bn: redeem_to_receive_bn,
  })
}

const updateDataToServer = (source, action, address) => {
  let obj = {
    "sources": source,
    "operation": action,
    "platforms": "markets",
    "address": address
  }

  console.log(JSON.stringify(obj));
  axios.post('https://analytics.dforce.network/update', JSON.stringify(obj))
    .then(res => { console.log(res) })
    .catch(error => { console.log(error) })
}

// *** click ***
export const mint_click = (that) => {
  if (!that.state.value_mint_bn) {
    return console.log('input num...');
  }
  if (Number(that.state.value_mint) === 0) {
    return console.log('num 0');
  }
  console.log(that.state.value_mint_bn.toLocaleString());
  console.log(that.state.token_is_approve[that.state.cur_index_mint]);

  let cur_mint_token = that.state.token_name[that.state.cur_index_mint];
  let max_num = that.bn(2).pow(that.bn(256)).sub(that.bn(1));

  that.setState({
    is_btn_disabled_mint: true,
    is_approving: false
  })

  // alert(that.state.value_mint_bn.toLocaleString())

  that.state.token_d_contract[that.state.cur_index_mint].methods.mint(that.state.my_account, that.state.value_mint_bn).estimateGas({
    from: that.state.my_account,
  }, (err, gasLimit) => {
    console.log(gasLimit);
    that.state.token_d_contract[that.state.cur_index_mint].methods.mint(that.state.my_account, that.state.value_mint_bn).send(
      {
        from: that.state.my_account,
        gas: Math.floor(gasLimit * 1.2)
      }, (reject, res_hash) => {
        if (reject) {
          that.setState({
            is_btn_disabled_mint: false
          })
        }
        if (res_hash) {
          console.log(res_hash);
          i_got_hash(
            that,
            'Deposit',
            cur_mint_token,
            that.state.value_mint_bn.toLocaleString(),
            'd' + cur_mint_token,
            that.state.mint_to_receive_bn.toLocaleString(),
            res_hash,
            'pendding'
          );
          that.setState({
            is_btn_disabled_mint: false,
            value_mint: '',
            mint_to_receive_bn: ''
          })
          updateDataToServer(that.state.source, 'mint', that.state.my_account);
        }
      }
    )
  })
}
export const redeem_click = (that) => {
  if (!that.state.value_redeem_bn) {
    return console.log('input num...');
  }
  if (Number(that.state.value_redeem) === 0) {
    return console.log('num 0');
  }
  console.log(that.state.value_redeem_bn.toLocaleString());
  let cur_redeem_token = that.state.token_d_name[that.state.cur_index_redeem];

  that.setState({
    is_btn_disabled_redeem: true,
  })

  var to_action = 'redeemUnderlying';
  if (that.state.i_redeem_max) {
    to_action = 'redeem';
  }
  console.log(to_action);

  that.state.token_d_contract[that.state.cur_index_redeem].methods[to_action](
    that.state.my_account, that.state.i_redeem_max ? that.state.token_d_balance_origin[that.state.cur_index_redeem] : that.state.value_redeem_bn
  ).estimateGas({
    from: that.state.my_account,
  }, (err, gasLimit) => {
    that.state.token_d_contract[that.state.cur_index_redeem].methods[to_action](
      that.state.my_account, that.state.i_redeem_max ? that.state.token_d_balance_origin[that.state.cur_index_redeem] : that.state.value_redeem_bn
    ).send(
      {
        from: that.state.my_account,
        gas: Math.floor(gasLimit * 1.2)
      }, (reject, res_hash) => {
        if (reject) {
          that.setState({
            is_btn_disabled_redeem: false,
          })
        }
        if (res_hash) {
          console.log(res_hash);
          i_got_hash(
            that,
            'Withdraw',
            cur_redeem_token,
            that.state.value_redeem_bn.toLocaleString(),
            cur_redeem_token.slice(1),
            that.state.redeem_to_receive_bn.toLocaleString(),
            res_hash,
            'pendding'
          );
          that.setState({
            is_btn_disabled_redeem: false,
            value_redeem: '',
            redeem_to_receive_bn: ''
          })
          updateDataToServer(that.state.source, 'redeem', that.state.my_account);
        }
      }
    )
  })
}
export const approve_click = (that) => {
  let cur_mint_token = that.state.token_name[that.state.cur_index_mint];
  let max_num = that.bn(2).pow(that.bn(256)).sub(that.bn(1));

  that.setState({
    is_btn_disabled_mint: true,
    is_approving: true
  })

  that.state.token_contract[that.state.cur_index_mint].methods.approve(address_map[that.state.net_type]['d' + cur_mint_token], max_num).estimateGas({
    from: that.state.my_account,
  }, (err, gasLimit) => {
    console.log(gasLimit)
    if (gasLimit) {
      that.state.token_contract[that.state.cur_index_mint].methods.approve(address_map[that.state.net_type]['d' + cur_mint_token], max_num).send({
        from: that.state.my_account,
        gas: Math.floor(gasLimit * 1.2)
      }, (rej, res_hash) => {
        if (res_hash) {
          console.log('approveing...');
          if (!that.state.value_mint_bn) {
            let t_token_is_approve = that.state.token_is_approve;
            t_token_is_approve[that.state.cur_index_mint] = true;
            that.setState({
              token_is_approve: t_token_is_approve,
              is_btn_disabled_mint: false,
              is_approving: false
            })
            return false
          }
          setTimeout(() => {
            let timer_trigger = setInterval(() => {
              console.log('i am checking approve_click...');
              that.new_web3.eth.getTransactionReceipt(res_hash, (err, data) => {
                console.log(data);
                if (data && data.status === true) {
                  clearInterval(timer_trigger);
                  console.log('mint_click...');
                  let t_token_is_approve = that.state.token_is_approve;
                  t_token_is_approve[that.state.cur_index_mint] = true;
                  that.setState({
                    token_is_approve: t_token_is_approve,
                    is_approving: false
                  }, () => {
                    mint_click(that);
                  })
                }
                if (data && data.status === false) {
                  clearInterval(timer_trigger);
                  let t_token_is_approve = that.state.token_is_approve;
                  t_token_is_approve[that.state.cur_index_mint] = false;
                  that.setState({
                    token_is_approve: t_token_is_approve,
                    is_btn_disabled_mint: false,
                    is_approving: false
                  })
                }
              })
            }, 2000);
          }, 1000)
        }
        if (rej) {
          that.setState({
            is_btn_disabled_mint: false,
            is_approving: false
          })
        }
      })
    }
  })
}


// init metamask wallet
export const init_metamask_wallet = async (that) => {
  let netID = await that.new_web3.eth.net.getId();
  if (netID !== 56) {
    return console.log('not on bsc net');
  }
  let nettype = 'bsc';
  let my_account = await get_my_account(that.new_web3);

  let temp_contract_arr = [];
  for (let i = 0; i < that.state.token_name.length; i++) {
    temp_contract_arr.push(await init_contract(that.new_web3, nettype, that.state.token_name[i]))
  }

  let temp_decimals_arr = [];
  for (let i = 0; i < that.state.token_name.length; i++) {
    temp_decimals_arr.push(env['DECIMALS'][nettype][that.state.token_name[i]])
  }

  // init contract_d
  let temp_contract_d_arr = [];
  for (let i = 0; i < that.state.token_d_name.length; i++) {
    temp_contract_d_arr.push(await init_contract(that.new_web3, nettype, that.state.token_d_name[i], true))
  }

  let temp_approve_arr = [];
  for (let i = 0; i < that.state.token_d_name.length; i++) {
    temp_approve_arr.push(await check_approve(temp_contract_arr[i], that.state.token_d_name[i], my_account, nettype, that.bn))
  }

  // get balance
  let temp_balance_arr = [];
  for (let i = 0; i < that.state.token_name.length; i++) {
    temp_balance_arr.push(await get_my_balance(temp_contract_arr[i], my_account, nettype))
  }
  that.setState({
    my_account: my_account,
    token_decimals: temp_decimals_arr,
    token_balance: temp_balance_arr,
  })

  let temp_balance_d_arr = [];
  let temp_balance_d_arr_origin = [];
  for (let i = 0; i < that.state.token_name.length; i++) {
    temp_balance_d_arr.push(await get_my_balance(temp_contract_d_arr[i], my_account, nettype))
  }
  temp_balance_d_arr_origin = temp_balance_d_arr.toLocaleString().split(',');

  let temp_basedata_arr = [];
  for (let i = 0; i < that.state.token_d_name.length; i++) {
    temp_basedata_arr.push(await getBaseData(temp_contract_d_arr[i]))
  }
  // console.log(temp_basedata_arr);

  if (!temp_contract_arr
    || !temp_contract_d_arr
    || !temp_approve_arr
    || !temp_balance_d_arr
    || !temp_balance_d_arr_origin
    || !temp_basedata_arr) {
    return false;
  }


  for (let i = 0; i < that.state.token_d_name.length; i++) {
    let cur_BaseData = temp_basedata_arr[i];
    if (!cur_BaseData) {
      return console.log(cur_BaseData);
    }
    var base_data_1 = cur_BaseData[1];
    var base_data_3 = cur_BaseData[3];

    var redeem_to_receive_bn = that.bn(temp_balance_d_arr[i]).mul(that.bn(base_data_1)).div(that.bn(10).pow(that.bn(18)));
    redeem_to_receive_bn = redeem_to_receive_bn.sub(redeem_to_receive_bn.mul(that.bn(base_data_3)).div(that.bn(10).pow(that.bn(18))));
    temp_balance_d_arr[i] = redeem_to_receive_bn.toLocaleString();
  }



  that.setState({
    show_btn: true,
    net_type: nettype,
    token_contract: temp_contract_arr,
    token_d_contract: temp_contract_d_arr,
    token_is_approve: temp_approve_arr,
    token_d_balance: temp_balance_d_arr,
    token_d_balance_origin: temp_balance_d_arr_origin,
    token_BaseData: temp_basedata_arr,
    is_already: true,
    load_new_history: Math.random(),
  }, () => {
    // accounts changed
    // return console.log('ttt',that.state);
    if (window.ethereum && window.ethereum.on) {
      console.log('accounts changed');
      accounts_changed(that);
    }

    get_tokens_status_apy(that);

    window.timer_5s = setInterval(() => {
      // console.log('window.timer_5s......');
      get_token_BaseData(that);
      get_balance__mint(that);
      get_balance__redeem(that);
      get_tokens_status_apy(that);
    }, 1000 * 15);
  })
}
export const accounts_changed = async (that) => {
  window.ethereum.on('accountsChanged', async (accounts) => {
    let my_account = accounts[0];
    that.setState({
      is_already: false,
      my_account: my_account,
      value_mint: '',
      mint_to_receive_bn: '',
      is_btn_disabled_mint: false,
      value_redeem: '',
      redeem_to_receive_bn: '',
      is_btn_disabled_redeem: false
    })
    // console.log(my_account);
    // console.log(window.timer_5s);
    if (window.timer_5s) {
      clearInterval(window.timer_5s);
    }

    // get approve
    let temp_approve_arr = [];
    for (let i = 0; i < that.state.token_d_name.length; i++) {
      temp_approve_arr.push(await check_approve(that.state.token_contract[i], that.state.token_d_name[i], my_account, that.state.net_type, that.bn))
    }
    let temp_balance_arr = [];
    for (let i = 0; i < that.state.token_name.length; i++) {
      temp_balance_arr.push(await get_my_balance(that.state.token_contract[i], my_account, that.state.net_type))
    }

    let temp_basedata_arr = [];
    for (let i = 0; i < that.state.token_d_name.length; i++) {
      temp_basedata_arr.push(await getBaseData(that.state.token_d_contract[i]))
    }

    let temp_balance_d_arr = [];
    let temp_balance_d_arr_origin = [];
    for (let i = 0; i < that.state.token_name.length; i++) {
      temp_balance_d_arr.push(await get_my_balance(that.state.token_d_contract[i], my_account, that.state.net_type))
    }
    temp_balance_d_arr_origin = temp_balance_d_arr.toLocaleString().split(',');

    for (let i = 0; i < that.state.token_d_name.length; i++) {
      let cur_BaseData = temp_basedata_arr[i];
      var base_data_1 = cur_BaseData[1];
      var base_data_3 = cur_BaseData[3];

      var redeem_to_receive_bn = that.bn(temp_balance_d_arr[i]).mul(that.bn(base_data_1)).div(that.bn(10).pow(that.bn(18)));
      redeem_to_receive_bn = redeem_to_receive_bn.sub(redeem_to_receive_bn.mul(that.bn(base_data_3)).div(that.bn(10).pow(that.bn(18))));
      temp_balance_d_arr[i] = redeem_to_receive_bn.toLocaleString();
    }

    that.setState({
      is_already: true,
      load_new_history: Math.random(),
      token_is_approve: temp_approve_arr,
      token_balance: temp_balance_arr,
      token_d_balance: temp_balance_d_arr,
      token_d_balance_origin: temp_balance_d_arr_origin,
      is_already_set_count: false
    }, () => {
      get_tokens_status(that);
      get_tokens_status_apy(that);
    })

    if (window.timer_5s) {
      console.log('clearInterval(window.timer_5s)');
      clearInterval(window.timer_5s)
    }

    window.timer_5s = setInterval(() => {
      console.log('window.timer_5s......');
      get_balance__mint(that);
      get_balance__redeem(that);
    }, 1000 * 5);
  })
}




export const set_show_data = (that) => {
  let temp_data = that.state.token_status[that.state.cur_index_mint];

  if (!temp_data.date) {
    return console.log('not ready...')
  }

  // date_arr
  let date_arr = [];
  for (let i = 0; i < temp_data.date.length; i++) {
    date_arr[i] = moment(temp_data.date[i] * 1000).format('YYYY/M/DD');
  }
  let apy_arr = [];
  for (let i = 0; i < temp_data.apy.length; i++) {
    apy_arr[i] = Number(temp_data.apy[i]).toFixed(2);
  }
  // console.log(date_arr);

  // let date_arr = temp_data.date;

  that.setState({
    options: {
      grid: {
        left: '5%',
        right: '10%',
        // bottom: '10%',
        containLabel: true
      },
      title: {
        text: ''
      },
      tooltip: {
        trigger: 'axis',
        // borderColor: '#ff0000',
        // animation: false,
        formatter: '{b0} APY:<br /> {c0}%'
      },
      legend: {
        data: []
      },
      xAxis: {
        splitLine: {
          show: false
        },
        type: 'category',
        boundaryGap: false,
        data: date_arr
      },
      yAxis: {
        splitLine: {
          show: false
        },
        axisLabel: {
          formatter: '{value} %',
          // padding: [0,0,0,10]
          width: 50
        },
        // offset: -10
        boundaryGap: true
      },
      series: [{
        name: 'APY',
        type: 'line',
        data: apy_arr,
        color: '#D4A454',
        smooth: true
      }],
      toolbox: {
        show: true
      }
    }
  })
}


export const get_tokens_status_apy = (that) => {
  if (!(that.state.net_type === 'bsc')) {
    return console.log('wrong net: not bsc chain');
  }

  let url_apy = 'https://markets.dforce.network/api/bsc/getApy/';

  fetch(url_apy).then(res => res.text())
    .then((data) => {
      if (!(data && Object.keys(data).length > 0)) {
        return console.log('no data return...');
      }

      let t_data_arr = [];
      for (let i = 0; i < that.state.token_name.length; i++) {
        t_data_arr[i] = JSON.parse(data)['d' + that.state.token_name[i]]
      }
      // return console.log(t_data_arr)
      that.setState({
        token_status_apy: t_data_arr,
      })
    })
    .catch(err => {
      console.log(err)
    })
}


export const get_tokens_status = (that) => {
  if (!(that.state.net_type === 'bsc')) {
    return console.log('wrong net: not bsc chain');
  }
  let url = 'https://markets.dforce.network/api/bsc/getApy_date/?net=main';

  fetch(url).then(res => res.text())
    .then((data) => {
      // return console.log(data)
      if (!(data && Object.keys(data).length > 0)) {
        return console.log('no data return...');
      }

      let t_data_arr = [];
      for (let i = 0; i < that.state.token_name.length; i++) {
        t_data_arr[i] = JSON.parse(data)['d' + that.state.token_name[i]]
      }
      // return console.log(t_data_arr);

      if (!t_data_arr[0]) { return console.log('no. data.') }

      // return;

      // data = JSON.parse(data).reverse();

      that.setState({
        token_status: t_data_arr,
        token_status_is_ready: true
      }, () => {
        set_show_data(that);
      })
    })
    .catch(err => {
      console.log(err)
    })
}


export const format_bn = (numStr, decimals, decimalPlace = decimals) => {
  numStr = numStr.toLocaleString().replace(/,/g, '');
  // decimals = decimals.toString();

  // var str = (10 ** decimals).toLocaleString().replace(/,/g, '').slice(1);
  var str = Number(`1e+${decimals}`).toLocaleString().replace(/,/g, '').slice(1);

  var res = (numStr.length > decimals ?
    numStr.slice(0, numStr.length - decimals) + '.' + numStr.slice(numStr.length - decimals) :
    '0.' + str.slice(0, str.length - numStr.length) + numStr).replace(/(0+)$/g, "");

  res = res.slice(-1) === '.' ? res + '00' : res;

  if (decimalPlace === 0)
    return res.slice(0, res.indexOf('.'));

  var length = res.indexOf('.') + 1 + decimalPlace;
  return res.slice(0, length >= res.length ? res.length : length);
  // return res.slice(-1) == '.' ? res + '00' : res;
}

export const i_got_hash = (that, action, send_token, send_amount, recive_token, recive_amount, hash, status) => {
  let timestamp = new Date().getTime();
  if (window.localStorage) {
    let key = that.state.my_account + '-' + that.state.net_type;
    let historyData = JSON.parse(window.localStorage.getItem(key)) || [];
    historyData.push({
      action: action,
      account: that.state.my_account,
      net_type: that.state.net_type,
      send_token: send_token,
      send_amount: send_amount,
      recive_token: recive_token,
      recive_amount: recive_amount,
      hash: hash,
      timestamp: timestamp,
      status: status
    });
    window.localStorage.setItem(key, JSON.stringify(historyData));
    console.log('got hash && setItem.');

    that.setState({ load_new_history: Math.random() });
  }
}


export const format_num_to_K = (str_num) => {
  var part_a = str_num.split('.')[0];
  var part_b = str_num.split('.')[1];

  var reg = /\d{1,3}(?=(\d{3})+$)/g;
  part_a = (part_a + '').replace(reg, '$&,');

  return part_a + '.' + part_b;
}


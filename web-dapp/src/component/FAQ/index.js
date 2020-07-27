import React, { Component } from 'react'
import './static/css/main.scss';
// add i18n.
import { IntlProvider, FormattedMessage } from 'react-intl';
import en_US from '../../language/en_US.js';
import zh_CN from '../../language/zh_CN';

import collapse from './svg/collapse.svg';
import faq1 from './svg/fqa1.svg';
import faq2 from './svg/fqa2.svg';
import faq3 from './svg/fqa3.svg';
import faq4 from './svg/fqa4.svg';
import faq5 from './svg/fqa5.svg';
import faq6 from './svg/fqa6.svg';
import faq7 from './svg/fqa7.svg';
import unfold from './svg/unfold.svg';



export default class FAQ1 extends Component {
    constructor(props) {
        super(props)

        this.state = {
            isCollapsed: [],
            icon: {
                collapse: collapse,
                faq1: faq1,
                faq2: faq2,
                faq3: faq3,
                faq4: faq4,
                faq5: faq5,
                faq6: faq6,
                faq7: faq7,
                unfold: unfold
            }
        }
    }


    handleClick(e) {
        const index = e.currentTarget.dataset.index;
        const { isCollapsed } = this.state;
        let newIndexArray = [...isCollapsed];
        newIndexArray.includes(index)
            ? (newIndexArray = newIndexArray.filter((n) => n !== index))
            : newIndexArray.push(index);
        this.setState({
            isCollapsed: newIndexArray,
        });
    }


    render() {
        const { isCollapsed } = this.state
        return (
            <IntlProvider locale={'en'} messages={this.props.language === '中文' ? zh_CN : en_US} >
                <div className={"faq"}>
                    <h2>
                        <FormattedMessage id='Frequently' />
                    </h2>
                    <ul>
                        <li
                            className={isCollapsed.includes("1") === false ? "" : "open"}
                            onClick={(e) => this.handleClick(e)}
                            data-index={"1"}
                        >
                            <div className={"faq_header"}>
                                <img className={"faq_l"} src={this.state.icon.faq1} />
                                <span><FormattedMessage id='what_is_df' /></span>
                                <img className={"faq_r"} src={isCollapsed.includes("1") ? this.state.icon.unfold : this.state.icon.collapse} />
                            </div>
                            <div className="collapse-content">
                                <p><FormattedMessage id='what_is_df_detail' /></p>
                            </div>
                        </li>

                        <li
                            className={isCollapsed.includes("2") === false ? "" : "open"}
                            onClick={(e) => this.handleClick(e)}
                            data-index={"2"}
                        >
                            <div className={"faq_header"}>
                                <img className={"faq_l"} src={this.state.icon.faq2} />
                                <span>
                                    <FormattedMessage id='what_is_yield' />
                                </span>
                                <img className={"faq_r"} src={isCollapsed.includes("2") ? this.state.icon.unfold : this.state.icon.collapse} />
                            </div>
                            <div className="collapse-content">
                                <p>
                                    <FormattedMessage id='what_is_yield_detail' />
                                </p>
                            </div>
                        </li>

                        <li
                            className={isCollapsed.includes("3") === false ? "" : "open"}
                            onClick={(e) => this.handleClick(e)}
                            data-index={"3"}
                        >
                            <div className={"faq_header"}>
                                <img className={"faq_l"} src={this.state.icon.faq3} />
                                <span>
                                    <FormattedMessage id='how_does' />
                                </span>
                                <img className={"faq_r"} src={isCollapsed.includes("3") ? this.state.icon.unfold : this.state.icon.collapse} />
                            </div>
                            <div className="collapse-content">
                                <p>
                                    <FormattedMessage id='what_is_yield_detail' />
                                </p>
                            </div>
                        </li>

                        <li
                            className={isCollapsed.includes("4") === false ? "" : "open"}
                            onClick={(e) => this.handleClick(e)}
                            data-index={"4"}
                        >
                            <div className={"faq_header"}>
                                <img className={"faq_l"} src={this.state.icon.faq4} />
                                <span>
                                    <FormattedMessage id='Highlights' />
                                </span>
                                <img className={"faq_r"} src={isCollapsed.includes("4") ? this.state.icon.unfold : this.state.icon.collapse} />
                            </div>
                            <div className="collapse-content">
                                <p>
                                    <FormattedMessage id='title1' />
                                </p>
                                <p>
                                    <FormattedMessage id='detail1' />
                                </p>

                                <p>
                                    <FormattedMessage id='title2' />
                                </p>
                                <p>
                                    <FormattedMessage id='detail2' />
                                </p>

                                <p>
                                    <FormattedMessage id='title3' />
                                </p>
                                <p>
                                    <FormattedMessage id='detail3' />
                                </p>

                                <p>
                                    <FormattedMessage id='title4' />
                                </p>
                                <p>
                                    <FormattedMessage id='detail4' />
                                </p>
                            </div>
                        </li>

                        <li
                            className={isCollapsed.includes("5") === false ? "" : "open"}
                            onClick={(e) => this.handleClick(e)}
                            data-index={"5"}
                        >
                            <div className={"faq_header"}>
                                <img className={"faq_l"} src={this.state.icon.faq5} />
                                <span>
                                    <FormattedMessage id='it_is' />
                                </span>
                                <img className={"faq_r"} src={isCollapsed.includes("5") ? this.state.icon.unfold : this.state.icon.collapse} />
                            </div>
                            <div className="collapse-content">
                                <p>
                                    <FormattedMessage id='it_is_detail1' />
                                </p>
                                <p>
                                    <FormattedMessage id='it_is_detail2' />
                                </p>
                            </div>
                        </li>







                    </ul>
                </div>
            </IntlProvider>
        )
    }
}

import React, { Component } from 'react';
import App from './App';
import Admin from './admin';
import Home from './component/Home';
import { BrowserRouter as Router, Route } from "react-router-dom";

class Entry extends Component {
    render() {
        return (
            <Router>
                {/* <Route exact path="/" render={() => <Home />} />
                <Route exact path="/dapp" render={() => <App />} />
                <Route exact path="/dashboard.html" render={() => <Admin />} /> */}
                <Route exact path="/" component={Home} />
                <Route path="/dapp" component={App} />
                <Route exact path="/dashboard" component={Admin} />
            </Router>
        )
    }
}
export default Entry;
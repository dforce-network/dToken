import React, { Component } from 'react';
import App from './App';
import Admin from './admin';
import { BrowserRouter as Router, Route } from "react-router-dom";

class Entry extends Component {
    render() {
        return (
            <Router>
                <Route exact path="/" render={() => <App />} />
                <Route exact path="/dashboard.html" render={() => <Admin />} />
            </Router>
        )
    }
}
export default Entry;
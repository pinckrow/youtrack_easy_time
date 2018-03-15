import 'babel-polyfill';
import DashboardAddons from 'hub-dashboard-addons';
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {render} from 'react-dom';
import Select from '@jetbrains/ring-ui/components/select/select';
import Panel from '@jetbrains/ring-ui/components/panel/panel';
import Button from '@jetbrains/ring-ui/components/button/button';
import Input from '@jetbrains/ring-ui/components/input/input';

import 'file-loader?name=[name].[ext]!../../manifest.json'; // eslint-disable-line import/no-unresolved
import styles from './app.css';
import sayHello from './sayHello';

const COLOR_OPTIONS = [
  {key: 'black', label: 'Black'},
  {key: 'red', label: 'Red'},
  {key: 'blue', label: 'Blue'}
];

class Widget extends Component {
  static propTypes = {
    dashboardApi: PropTypes.object,
    registerWidgetApi: PropTypes.func
  };

  constructor(props) {
    super(props);
    const {registerWidgetApi, dashboardApi} = props;

    this.state = {
      isConfiguring: false,
      selectedColor: COLOR_OPTIONS[0]
    };

    registerWidgetApi({
      onConfigure: () => this.setState({isConfiguring: true})
    });

    this.initialize(dashboardApi);
  }

  initialize(dashboardApi) {
    dashboardApi.readConfig().then(config => {
      if (!config) {
        return;
      }
      this.setState({selectedColor: config.selectedColor});
    });
  }

  saveConfig = async () => {
    const {selectedColor, username} = this.state;
    await this.props.dashboardApi.storeConfig({selectedColor, username});
    this.setState({isConfiguring: false});
  };

  cancelConfig = async () => {
    this.setState({isConfiguring: false});
    await this.props.dashboardApi.exitConfigMode();
    this.initialize(this.props.dashboardApi);
  };

  changeColor = selectedColor => this.setState({selectedColor});

  changeName = e => this.setState({
    username: e.target.value
  });

  renderConfiguration() {
    const {selectedColor, username} = this.state;

    return (
      <div className={styles.widget}>
        <Select
          data={COLOR_OPTIONS}
          selected={selectedColor}
          onChange={this.changeColor}
          label="Select text color"
        />
        <Input
          label="What is your name?"
          onChange={this.changeName}
          value={username}
        />
        <Panel>
          <Button blue={true} onClick={this.saveConfig}>{'Save'}</Button>
          <Button onClick={this.cancelConfig}>{'Cancel'}</Button>
        </Panel>
      </div>
    );
  }

  render() {
    const {selectedColor, username, isConfiguring} = this.state;

    if (isConfiguring) {
      return this.renderConfiguration();
    }

    return (
      <div className={styles.widget}>
        <h3>{`This Week: , ${username}`}</h3>
        <div className={styles.chip}>{'Mon: 7h'}</div>
        <div className={styles.chip}>{'Tue: 5h'}</div>
        <div className={styles.chip}>{'Wen: 6h'}</div>
        <div className={styles.chip}>{'Thu: 3h'}</div>
        <div className={styles.chip}>{'Fri: 0h'}</div>
        <a>{'See Full Task Info'}</a>
        <h3>{`Tasks in Progress: , ${username}`}</h3>
        <div style={{display: 'flex'}}>
          <div>{'Task 1: '}</div>
          <Button blue={true} onClick={this.saveConfig}>{'+1h'}</Button>
        </div>
        <h1 style={{color: selectedColor.key}}>{sayHello(username)}</h1>
        <p>{'Select "Edit..." option in widget dropdown to configure it'}</p>
      </div>
    );
  }
}

DashboardAddons.registerWidget((dashboardApi, registerWidgetApi) =>
  render(
    <Widget
      dashboardApi={dashboardApi}
      registerWidgetApi={registerWidgetApi}
    />,
    document.getElementById('app-container')
  )
);

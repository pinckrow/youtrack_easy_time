import React, {Component} from 'react';

import styles from './service-unavailable-screen.css';

export default class ServiceUnavailableScreen extends Component {
  render() {
    return (
      <div className={styles.serviceUnavailableScreen}>
        <div className={styles.serviceUnavailableMessage}>
          {'Ooops, Can\'t load information from service.'}
        </div>
      </div>
    );
  }
}

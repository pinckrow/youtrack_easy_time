import 'babel-polyfill';
import 'file-loader?name=[name].[ext]!../../manifest.json'; // eslint-disable-line import/no-unresolved

import DashboardAddons from 'hub-dashboard-addons';
import React from 'react';
import {render} from 'react-dom';

import EasyTimeWidget from './widget';

DashboardAddons.registerWidget(async (dashboardApi, registerWidgetApi) => {
  render(
    <EasyTimeWidget
      dashboardApi={dashboardApi}
      registerWidgetApi={registerWidgetApi}
    />,
    document.getElementById('app-container')
  );
});

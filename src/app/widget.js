import React, {Component} from 'react';
import PropTypes from 'prop-types';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import Button from '@jetbrains/ring-ui/components/button/button';
import Progress from 'react-progressbar';

import '@jetbrains/ring-ui/components/form/form.scss';
import '@jetbrains/ring-ui/components/input-size/input-size.scss';
import styles from './widget.css';
import {
  getYouTrackService,
  loadExtendedSprintData,
  loadInProgressIssues,
  loadTimeForIssue,
  loadCurrentUser,
  postWorkItem,
  loadAgile
} from './api';
import {
  getListOfBoardIssues,
  isCurrentSprint,
  getWeek,
  getWorkWeekStub,
  minsInHour,
  hoursInWeek
} from './service';
import ServiceUnavailableScreen from './service-unavailable-screen';
import ConfigurationForm from './configuration-form';


export default class EasyTimeWidget extends Component {
  static propTypes = {
    dashboardApi: PropTypes.object,
    registerWidgetApi: PropTypes.func
  };

  constructor(props) {
    super(props);
    const {registerWidgetApi} = props;

    this.state = {
      isConfiguring: false,
      isLoading: true,
      isLoadDataError: false
    };

    registerWidgetApi({
      onConfigure: () => this.setState({isConfiguring: true}),
      onRefresh: async () => {
        await this.loadSelectedSprintData();
        this.updateTitle();
      }
    });
  }

  componentDidMount() {
    this.initialize(this.props.dashboardApi);
  }

  async getYouTrack(config) {
    const {dashboardApi} = this.props;
    const configYouTrackId = config && config.youTrack && config.youTrack.id;
    const fetchHub = dashboardApi.fetchHub.bind(dashboardApi);
    return await getYouTrackService(fetchHub, configYouTrackId);
  }

  setYouTrack(youTrackService) {
    this.setState({
      youTrack: {
        id: youTrackService.id,
        homeUrl: youTrackService.homeUrl
      }
    });
  }

  fetchYouTrack = async (url, params) => {
    const {youTrack} = this.state;
    const {dashboardApi} = this.props;
    return dashboardApi.fetch(youTrack.id, url, params);
  };

  async initialize(dashboardApi) {
    this.setLoadingEnabled(true);
    const config = await dashboardApi.readConfig();
    const youTrackService = await this.getYouTrack(config);
    if (youTrackService && youTrackService.id) {
      this.setYouTrack(youTrackService);
      if (config && config.agileId) {
        await this.specifyBoard(
          config.agileId, config.sprintId, config.currentSprintMode
        );
      } else {
        this.setState({isConfiguring: true});
      }
    }
    this.setLoadingEnabled(false);
  }

  // need to have starting point for getting issues
  async specifyBoard(agileId, sprintId, currentSprintMode) {
    const agile = await loadAgile(this.fetchYouTrack, agileId);
    const selectedSprintId = currentSprintMode
      ? ((agile.sprints || []).filter(isCurrentSprint)[0] || {}).id
      : sprintId;
    this.setState({
      agile,
      currentSprintMode
    }, async () => {
      await this.loadSelectedSprintData(selectedSprintId);
      this.updateTitle();
    });
  }

  setLoadingEnabled(isLoading) {
    this.props.dashboardApi.setLoadingAnimationEnabled(isLoading);
    this.setState({isLoading});
  }

  saveConfig = async formModel => {
    const {agile, sprint, youTrack, currentSprintMode} = formModel;
    const agileId = agile.id;
    const sprintId = sprint && sprint.id;
    await this.props.dashboardApi.storeConfig({
      agileId,
      sprintId,
      currentSprintMode,
      youTrack
    });
    this.setState({
      isConfiguring: false,
      youTrack
    }, async () => {
      await this.specifyBoard(agileId, sprintId, currentSprintMode);
    });
  };

  addTime = async (issueId, date, hours) => {
    const {sprint} = this.state;
    this.setLoadingEnabled(true);

    const workItem = {
      date: date,
      duration: hours * minsInHour,
      description: 'auto logged from easy time widget',
      worktype: {
        name: 'Development'
      }
    };
    try {
      await postWorkItem(this.fetchYouTrack, issueId, workItem);
      this.loadWorkItemsData(sprint);
    } catch (err) {
      this.setLoadingEnabled(false);
      this.setState({isLoadDataError: true});
    }
  };

  cancelConfig = async () => {
    this.setState({isConfiguring: false});
    await this.props.dashboardApi.exitConfigMode();
    this.initialize(this.props.dashboardApi);
  };

  updateTitle() {
    const {
      agile, youTrack, user, totalTime
    } = this.state;
    if (agile && user) {
      const title = `Easy Time: ${user.login} worked ${totalTime / minsInHour} hours this week`;
      const link = `${youTrack.homeUrl}/agiles/${agile.id}`;
      this.props.dashboardApi.setTitle(title, link);
    }
  }

  renderConfiguration() {
    const {
      agile,
      sprint,
      currentSprintMode,
      youTrack
    } = this.state;

    return (
      <div className={styles.widget}>
        <ConfigurationForm
          agile={agile}
          sprint={sprint}
          currentSprintMode={currentSprintMode}
          onSubmit={this.saveConfig}
          onCancel={this.cancelConfig}
          dashboardApi={this.props.dashboardApi}
          youTrackId={youTrack.id}
        />
      </div>
    );
  }

  loadWorkItemsData(sprint) {
    const week = getWeek(Date.now());
    let user = {};
    let inProgressIssues = [];
    const issues = getListOfBoardIssues(sprint.board);
    const workItems = getWorkWeekStub();
    let totalTime = 0;
    Promise.all(issues.map(issue =>
      loadTimeForIssue(this.fetchYouTrack, issue))).then(results =>
      results.forEach(result => {
        result.filter(item => item.date >= week.start && item.date <= week.end).forEach(item => {
          if (item) {
            item.date = new Date(item.date);
            workItems[item.date.getDay() - 1].spent += item.duration;
            totalTime += item.duration;
          }
        });
      }), () => {
      this.setState({isLoadDataError: true});
    }).then(() => {
      loadCurrentUser(this.fetchYouTrack).then(result => {
        user = result;
      }).then(() => {
        loadInProgressIssues(this.fetchYouTrack).then(result => {
          inProgressIssues = result.issue;
        }).then(() => {
          this.setState({sprint, issues, workItems, totalTime, user, inProgressIssues});
          this.setLoadingEnabled(false);
          this.updateTitle();
        });
      });
    });
  }

  async loadSelectedSprintData(selectedSprintId) {
    const {agile} = this.state;
    try {
      const sprintId = selectedSprintId || (this.state.sprint || {}).id;
      const sprint = await loadExtendedSprintData(
        this.fetchYouTrack, agile.id, sprintId
      );
      this.loadWorkItemsData(sprint);
    } catch (err) {
      this.setState({isLoadDataError: true});
    }
  }

  renderLoader() {
    return <LoaderInline/>;
  }

  getPercent(value, total) {
    return 100 * (1.0 * value / minsInHour / total);
  }

  renderWidgetBody(workItems, inProgressIssues, totalTime) {
    const homeUrl = this.state.youTrack.homeUrl;
    return (
      <div className={styles.widget}>
        <div className={styles.widget}>
          <div className={styles.flexContainer}>
            {
              workItems.filter(item => item.spent > 0).map(item => (
                <div
                  key={`workItem_${item.day}`}
                  className={styles.chip}
                >{`${item.day} : ${item.spent / minsInHour} h`}</div>
              ))
            }
          </div>
        </div>
        <div className={styles.progressContainer}>
          <Progress color={'#82b3c9'} completed={this.getPercent(totalTime, hoursInWeek)}/>
        </div>
        <h3>{'Tasks in Progress'}</h3>
        <div className={styles.sprintCommonInfo}>
          {
            inProgressIssues.sort((x, y) => x.id > y.id).map(issue => (
              <div key={`issue_${issue.id}`}>
                <a href={`${homeUrl}/issue/${issue.id}`}>
                  {`${issue.id} : ${issue.field.find(f => f.name === 'summary').value}`}</a>
                <Button className={styles.button} blue={true} title={'click to log time'}
                        onClick={() => this.addTime(issue.id, Date.now(), 1)}>{'+1h'}</Button>
              </div>
            ))
          }
        </div>
        <p>{'Select "Edit..." option in widget dropdown to configure it'}</p>
      </div>
    );
  }

  renderLoadDataError() {
    return (
      <div className={styles.widget}>
        <ServiceUnavailableScreen/>
      </div>
    );
  }

  render() {
    const {
      isConfiguring,
      agile,
      sprint,
      workItems,
      inProgressIssues,
      totalTime,
      isLoading,
      isLoadDataError
    } = this.state;

    if (isLoadDataError) {
      return this.renderLoadDataError();
    }
    if (isLoading) {
      return this.renderLoader();
    }
    if (isConfiguring) {
      return this.renderConfiguration();
    }
    if (!agile || !sprint || !workItems) {
      return this.renderLoader();
    }
    return this.renderWidgetBody(
      workItems, inProgressIssues, totalTime
    );
  }
}

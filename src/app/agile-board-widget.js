import React, {Component} from 'react';
import PropTypes from 'prop-types';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import Button from '@jetbrains/ring-ui/components/button/button';
import Tooltip from '@jetbrains/ring-ui/components/tooltip/tooltip';
import Link from '@jetbrains/ring-ui/components/link/link';
import {SmartUserCardTooltip} from '@jetbrains/ring-ui/components/user-card/user-card';
import classNames from 'classnames';

import '@jetbrains/ring-ui/components/form/form.scss';
import '@jetbrains/ring-ui/components/input-size/input-size.scss';
import styles from './agile-board-widget.css';
import {
  countBoardProgress,
  getListOfBoardIssues,
  getColumnSearchUrl,
  areSprintsEnabled,
  isCurrentSprint,
  MAX_PROGRESS_BAR_HEIGHT
} from './agile-board-model';
import {
  getYouTrackService,
  loadExtendedSprintData,
  loadInProgressIssues,
  loadTimeForIssue,
  loadCurrentUser,
  postWorkItem,
  loadAgile,
  getHubUser
} from './resources';
import ServiceUnavailableScreen from './service-unavailable-screen';
import BoardStatusEditForm from './board-status-edit-form';


export default class AgileBoardWidget extends Component {
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

  async getYouTrack(config) {
    const {dashboardApi} = this.props;
    const configYouTrackId = config && config.youTrack && config.youTrack.id;
    const fetchHub = dashboardApi.fetchHub.bind(dashboardApi);
    return await getYouTrackService(fetchHub, configYouTrackId);
  }

  fetchYouTrack = async (url, params) => {
    const {youTrack} = this.state;
    const {dashboardApi} = this.props;
    return dashboardApi.fetch(youTrack.id, url, params);
  };

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

  setYouTrack(youTrackService) {
    this.setState({
      youTrack: {
        id: youTrackService.id,
        homeUrl: youTrackService.homeUrl
      }
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
    const minsInHour = 60;
    this.setLoadingEnabled(true);

    // const xmlWorkItem = `<workItem>
    //   <date>${date}</date>
    //   <duration>${hours * minsInHour}</duration>
    //   <description>auto logged from easy time widget</description>
    //   <worktype>
    //     <name>Development</name>
    //   </worktype>
    // </workItem>`;

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
      this.setLoadingEnabled(false);
    } catch (err) {
      console.log(err)
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
      agile, sprint, currentSprintMode, youTrack
    } = this.state;
    if (agile) {
      let title = `Board ${agile.name}`;
      let link = `${youTrack.homeUrl}/agiles/${agile.id}`;
      if (areSprintsEnabled(agile)) {
        if (sprint) {
          title += currentSprintMode
            ? `: Current sprint (${sprint.name})`
            : `: ${sprint.name}`;
          link += `/${sprint.id}`;
        } else if (currentSprintMode) {
          title += ': No current sprint found';
        }
      }
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
        <BoardStatusEditForm
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

  async loadSelectedSprintData(selectedSprintId) {
    const {agile} = this.state;
    try {
      const sprintId = selectedSprintId || (this.state.sprint || {}).id;
      const sprint = await loadExtendedSprintData(
        this.fetchYouTrack, agile.id, sprintId
      );

      let user = {};
      let inProgressIssues = [];
      const issues = getListOfBoardIssues(sprint.board);
      const workItems = [{day: 'Mon', spent: 0}, {day: 'Tue', spent: 0}, {day: 'Wed', spent: 0}, {day: 'Thu', spent: 0},
        {day: 'Fri', spent: 0}, {day: 'Sat', spent: 0}, {day: 'Sun', spent: 0}];
      let totalTime = 0;
      Promise.all(issues.map(issue =>
        loadTimeForIssue(this.fetchYouTrack, issue))).
        then(results =>
          results.forEach(result => {
            result.forEach(item => {
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
              // console.log(inProgressIssues)
            }).then(() => {
              this.setState({sprint, issues, workItems, totalTime, user, inProgressIssues});
            });
          });
        });
    } catch (err) {
      this.setState({isLoadDataError: true});
    }
  }

  renderLoader() {
    return <LoaderInline/>;
  }

  renderWidgetBody(agile, sprint, issues, workItems, totalTime, user, inProgressIssues) {
    const minsInHour = 60;
    const boardData = sprint.board;
    const boardProgressBars = countBoardProgress(boardData);

    const progressBarWrapperStyle = {
      height: `${MAX_PROGRESS_BAR_HEIGHT}px`
    };
    const tooltipHeight = 40;
    const plotWidthPercents = 100;
    const progressBarCSSWidthValue = `calc(${plotWidthPercents / boardProgressBars.length}% - 8px)`;
    const progressBarStyle = {
      height: `${MAX_PROGRESS_BAR_HEIGHT}px`,
      width: progressBarCSSWidthValue
    };
    const getProgressDataClassName = progressBarData => classNames(
      {
        [styles.sprintProgressData]: true,
        [styles.sprintProgressDataOverdue]: progressBarData.overdue
      }
    );

    const homeUrl = this.state.youTrack.homeUrl;
    const getColumnUrl = columnId => {
      const column = (boardData.columns || []).
        filter(currentColumn => currentColumn.id === columnId)[0];
      if (!column) {
        return '';
      }
      const searchUrl = getColumnSearchUrl(
        agile, sprint, column
      );
      return `${homeUrl}/issues?q=${searchUrl}`;
    };

    const dashboardApi = this.props.dashboardApi;
    const fetchHub = dashboardApi.fetchHub.bind(dashboardApi);
    const userSource = () =>
      getHubUser(fetchHub, agile.owner.ringId, homeUrl);

    return (
      <div className={styles.widget}>
        {
          sprint.goal &&
          <div className={styles.sprintCommonInfo}>
            {sprint.goal}
          </div>
        }
        <div className={styles.sprintCommonInfo}>
          <b>{'Owner:'}</b>&nbsp;
          <SmartUserCardTooltip userDataSource={userSource}>
            <Link
              href={`${homeUrl}/users/${agile.owner.ringId}`}
            >
              {agile.owner.fullName}
            </Link>
          </SmartUserCardTooltip>
        </div>
        <div
          className={styles.sprintProgress}
          style={progressBarWrapperStyle}
        >
          {
            boardProgressBars.map(boardProgressBar => (
              <Link
                key={`link-${boardProgressBar.columnId}`}
                href={getColumnUrl(boardProgressBar.columnId)}
              >
                <Tooltip
                  key={`tooltip-${boardProgressBar.columnId}`}
                  popupProps={{top: -(MAX_PROGRESS_BAR_HEIGHT + tooltipHeight)}}
                  title={boardProgressBar.title}
                >
                  <span
                    key={`bar-${boardProgressBar.columnId}`}
                    className={styles.sprintProgressBar}
                    style={progressBarStyle}
                  >
                    <span
                      key={`data-${boardProgressBar.columnId}`}
                      className={getProgressDataClassName(boardProgressBar)}
                      style={{height: `${boardProgressBar.height}px`}}
                    />
                  </span>
                </Tooltip>
              </Link>
            ))
          }
        </div>
        <div>
          {
            boardProgressBars.map(boardProgressBar => (
              <span
                key={`bar-label-${boardProgressBar.columnId}`}
                className={styles.sprintProgressBarLabel}
                style={{width: progressBarCSSWidthValue}}
              >
                {boardProgressBar.columnName}
              </span>
            ))
          }
        </div>

        <div className={styles.widget}>
          <h3>{`${user.login} this week. Total hours: ${totalTime / minsInHour} h`}</h3>
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
        <h3>{`${user.login} Tasks in Progress`}</h3>
        <div className={styles.sprintCommonInfo}>
          {
            inProgressIssues.map(issue => (
              <div key={`issue_${issue.id}`}>
                <a href={`${homeUrl}/issue/${issue.id}`}>
                  {`${issue.id} : ${issue.field.find(f => f.name === 'summary').value}`}</a>
                <Button className={styles.button} blue={true} onClick={() => this.addTime(issue.id, Date.now(), 1)}>{'+1h'}</Button>
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
      issues,
      workItems,
      totalTime,
      user,
      inProgressIssues,
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
      agile, sprint, issues, workItems, totalTime, user, inProgressIssues
    );
  }
}

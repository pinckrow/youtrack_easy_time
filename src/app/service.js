export const minsInHour = 60;
export const hoursInWeek = 40;

export function getWeek(date) {
  const weekLength = 7;
  const now = date ? new Date(date) : new Date();
  now.setHours(0, 0, 0, 0);
  // Get the previous Monday
  const monday = new Date(now);
  monday.setDate(monday.getDate() - monday.getDay() + 1);
  // Get next Sunday
  const sunday = new Date(now);
  sunday.setDate(sunday.getDate() - sunday.getDay() + weekLength);
  return {start: monday.getTime(), end: sunday.getTime()};
}

export function getWorkWeekStub() {
  return [{day: 'Mon', spent: 0}, {day: 'Tue', spent: 0}, {day: 'Wed', spent: 0}, {day: 'Thu', spent: 0},
    {day: 'Fri', spent: 0}, {day: 'Sat', spent: 0}, {day: 'Sun', spent: 0}];
}

export function getListOfBoardIssues(boardData) {
  const concatArrays = (array1, array2) => array1.concat(array2);
  const rows = concatArrays(
    boardData.swimlanes || [], boardData.orphanRow || []
  );

  const data = rows.map(row => row.cells || []).reduce(concatArrays, []).
    // filter(cell => cell.column.id === column.id).
    map(cell => cell.issues).reduce(concatArrays, []);

  return data.map(issue => issue.id);
}

export function areSprintsEnabled(board) {
  const sprintsSettings = board && board.sprintsSettings;
  return sprintsSettings ? !sprintsSettings.disableSprints : false;
}

export function isCurrentSprint(sprint) {
  const now = Date.now();
  return sprint.start < now && sprint.finish > now;
}


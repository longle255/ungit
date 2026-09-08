const ko = require('knockout');
const octicons = require('octicons');
const components = require('ungit-components');

components.register('activity', () => new ActivityViewModel());

const labels = {
  clone: 'Cloning repository',
  fetch: 'Fetching remote',
  push: 'Pushing changes',
  commit: 'Committing changes',
  checkout: 'Switching branch',
  'cherry-pick': 'Cherry-picking commit',
  merge: 'Merging changes',
  squash: 'Squashing changes',
  rebase: 'Rebasing changes',
  'merge-continue': 'Continuing merge',
  'rebase-continue': 'Continuing rebase',
  stash: 'Stashing changes',
  mergetool: 'Running merge tool',
};

class ActivityViewModel {
  constructor() {
    this.activities = ko.observableArray([]);
    this.selectedActivity = ko.observable(null);
    this.isOpen = ko.observable(false);
    this.elapsedTick = ko.observable(0);
    this.toggleIcon = ko.computed(() =>
      this.isOpen()
        ? octicons['chevron-down'].toSVG({ height: 15 })
        : octicons['chevron-up'].toSVG({ height: 15 })
    );
    this.terminalIcon = octicons.terminal.toSVG({ height: 16 });
    this.closeIcon = octicons.x.toSVG({ height: 15 });
    this.clearIcon = octicons.trash.toSVG({ height: 15 });
    this.checkIcon = octicons.check.toSVG({ height: 15 });
    this.errorIcon = octicons.alert.toSVG({ height: 15 });
    this.activeActivities = ko.computed(() => this.activities().filter((item) => item.isActive()));
    this.hasActivities = ko.computed(() => this.activities().length > 0);
    this.activeCount = ko.computed(() => this.activeActivities().length);
    this.summary = ko.computed(() => {
      const active = this.activeActivities();
      if (active.length === 1) return active[0].label;
      if (active.length > 1) return `${active.length} Git operations running`;
      return 'Git activity';
    });
    this.summaryDetail = ko.computed(() => {
      const active = this.activeActivities();
      if (active.length === 1) return active[0].detail();
      if (active.length > 1) return 'Output is available below';
      return 'Recent operations';
    });
    this._timer = setInterval(() => this.elapsedTick(this.elapsedTick() + 1), 1000);
  }

  updateNode(parentElement) {
    ko.renderTemplate('activity', this, {}, parentElement);
  }

  onProgramEvent(event) {
    if (!event.event || event.event.indexOf('git-operation-') !== 0) return;
    const data = event.data || {};
    if (!data.operationId) return;

    if (event.event === 'git-operation-started') {
      let activity = this._find(data.operationId);
      if (!activity) {
        activity = new ActivityItem(data, this);
        this.activities.unshift(activity);
      }
      this.selectedActivity(activity);
      this._trim();
    } else {
      const activity = this._find(data.operationId);
      if (!activity) return;
      if (event.event === 'git-operation-output') {
        this._appendOutput(activity, data);
      } else if (event.event === 'git-operation-step') {
        activity.steps(activity.steps() + 1);
      } else if (event.event === 'git-operation-finished') {
        activity.finish(data);
        this._trim();
      } else if (event.event === 'git-operation-failed') {
        activity.fail(data);
        this.selectedActivity(activity);
        this.isOpen(true);
        this._trim();
      }
    }
  }

  _appendOutput(activity, data) {
    const element = document.querySelector('.git-activity-output');
    const shouldStick =
      !element || element.scrollHeight - element.scrollTop - element.clientHeight < 24;
    activity.append(data.text || '', data.stream === 'stderr');
    if (shouldStick && this.isOpen() && this.selectedActivity() === activity) {
      setTimeout(() => {
        const output = document.querySelector('.git-activity-output');
        if (output) output.scrollTop = output.scrollHeight;
      }, 0);
    }
  }

  _find(operationId) {
    return this.activities().find((item) => item.operationId === operationId);
  }

  _trim() {
    const items = this.activities();
    if (items.length > 8) this.activities(items.slice(0, 8));
  }

  select(activity) {
    this.selectedActivity(activity);
  }

  toggle() {
    this.isOpen(!this.isOpen());
  }

  clearCompleted() {
    this.activities(this.activities().filter((item) => item.isActive()));
    if (!this.selectedActivity() || !this._find(this.selectedActivity().operationId)) {
      this.selectedActivity(this.activities()[0] || null);
    }
  }
}
class ActivityItem {
  constructor(data, owner) {
    this.owner = owner;
    this.operationId = data.operationId;
    this.action = data.action;
    this.repoPath = data.repoPath;
    this.startedAt = data.startedAt || Date.now();
    this.status = ko.observable('running');
    this.output = ko.observable('');
    this.steps = ko.observable(0);
    this.duration = ko.observable(null);
    this.errorMessage = ko.observable('');
    this.label = labels[this.action] || 'Running Git operation';
    this.isActive = ko.computed(() => this.status() === 'running');
    this.statusLabel = ko.computed(() => {
      if (this.status() === 'failed') return 'Failed';
      if (this.status() === 'finished') return 'Completed';
      if (this.output()) return 'Receiving output';
      return 'Waiting for output';
    });
    this.detail = ko.computed(() => {
      if (this.status() === 'failed') return this.errorMessage() || 'Git reported an error';
      if (this.status() === 'finished') return this.durationLabel();
      return this.output() ? 'Live output' : 'Git hooks may be running';
    });
    this.durationLabel = ko.computed(() => {
      owner.elapsedTick();
      const duration = this.duration() || Date.now() - this.startedAt;
      return `${(duration / 1000).toFixed(duration > 60000 ? 0 : 1)}s`;
    });
  }

  append(text, isError) {
    if (!text) return;
    const prefix = isError && this.output() && !this.output().endsWith('\n') ? '\n' : '';
    const next = `${this.output()}${prefix}${text}`;
    this.output(next.length > 262144 ? next.slice(-262144) : next);
  }

  finish(data) {
    this.status('finished');
    this.duration(data.duration || Date.now() - this.startedAt);
  }

  fail(data) {
    this.status('failed');
    this.duration(data.duration || Date.now() - this.startedAt);
    this.errorMessage(data.message || 'Git reported an error');
  }
}

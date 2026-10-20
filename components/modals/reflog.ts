import * as ko from 'knockout';
import moment = require('moment');
import { ModalViewModel } from './modalBase';
declare const ungit: any;

const PAGE_SIZE = 100;

ungit.components.register('reflogmodal', (args: any) => new ReflogModalViewModel(args));

class ReflogModalViewModel extends ModalViewModel {
  server: any;
  repoPath: string;
  isBareDir: boolean;
  entries: ko.ObservableArray<any>;
  seenShas: Set<string>;
  filter: ko.Observable<string>;
  filteredEntries: ko.Computed<any[]>;
  selected: ko.Observable<any>;
  branchName: ko.Observable<string>;
  isLoading: ko.Observable<boolean>;
  error: ko.Observable<string | null>;
  hasMore: ko.Observable<boolean>;
  nextSkip: number;
  template: string;

  constructor(args: any) {
    super('Recover lost commit', 'reflog-modal');
    this.server = args.server;
    this.repoPath = args.repoPath;
    this.isBareDir = Boolean(args.isBareDir);
    this.entries = ko.observableArray<any>([]);
    this.seenShas = new Set();
    this.filter = ko.observable('');
    this.filteredEntries = ko.computed(() => {
      const term = this.filter().trim().toLowerCase();
      if (!term) return this.entries();
      return this.entries().filter((entry) =>
        [
          entry.shortSha,
          entry.sha1,
          entry.action,
          entry.subject,
          entry.authorName,
          entry.authorEmail,
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(term)
        )
      );
    });
    this.selected = ko.observable(null);
    this.branchName = ko.observable('');
    this.isLoading = ko.observable(false);
    this.error = ko.observable(null);
    this.hasMore = ko.observable(false);
    this.nextSkip = 0;
    this.template = 'reflogModal';
    this.load();
  }

  async load() {
    if (this.isLoading()) return;
    this.isLoading(true);
    this.error(null);
    try {
      const res = await this.server.getPromise('/reflog', {
        path: this.repoPath,
        limit: PAGE_SIZE,
        skip: this.nextSkip,
      });
      const newEntries = (res.entries || []).filter((entry: any) => {
        if (this.seenShas.has(entry.sha1)) return false;
        this.seenShas.add(entry.sha1);
        return true;
      });
      this.entries(this.entries().concat(newEntries));
      this.hasMore(Boolean(res.hasMore));
      this.nextSkip += PAGE_SIZE;
    } catch (e: any) {
      this.error(e.errorSummary || e.message || 'Unable to load the reflog');
    } finally {
      this.isLoading(false);
    }
  }

  loadMore() {
    return this.load();
  }

  select(entry: any) {
    this.selected(entry);
    this.branchName(`recovered/${entry.shortSha}`);
  }

  entryDate(entry: any) {
    const date = moment(entry.reflogDate);
    return date.isValid() ? date.fromNow() : '';
  }

  absoluteDate(entry: any) {
    const date = moment(entry.reflogDate);
    return date.isValid() ? date.format('LLL') : entry.selector;
  }
}

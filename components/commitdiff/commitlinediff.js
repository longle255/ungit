const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const octicons = require('octicons');

class CommitLineDiff {
  constructor(args, fileLineDiff) {
    this.added = ko.observable(fileLineDiff.additions);
    this.removed = ko.observable(fileLineDiff.deletions);
    this.fileName = ko.observable(fileLineDiff.fileName);
    this.oldFileName = ko.observable(fileLineDiff.oldFileName);
    this.displayName = ko.observable(fileLineDiff.displayName);
    this.fileType = fileLineDiff.type;
    this.isNew = ko.observable(!!fileLineDiff.isNew);
    this.isShowingDiffs = ko.observable(false);
    this.repoPath = args.repoPath;
    this.server = args.server;
    this.sha1 = fileLineDiff.sha1 || args.sha1;
    this.textDiffType = args.textDiffType;
    this.wordWrap = args.wordWrap;
    this.whiteSpace = args.whiteSpace;
    this.applyFile = args.applyFile;
    this.canApplyFile = ko.observable(typeof this.applyFile === 'function');
    this.applyIcon = octicons.pencil.toSVG({ height: 14 });
    this.specificDiff = ko.observable(this.getSpecificDiff());
  }

  getSpecificDiff() {
    return components.create(`${this.fileType}diff`, {
      filename: this.fileName(),
      oldFilename: this.oldFileName(),
      repoPath: this.repoPath,
      server: this.server,
      sha1: this.sha1,
      textDiffType: this.textDiffType,
      isShowingDiffs: this.isShowingDiffs,
      whiteSpace: this.whiteSpace,
      wordWrap: this.wordWrap,
    });
  }

  fileNameClick() {
    this.isShowingDiffs(!this.isShowingDiffs());
    programEvents.dispatch({ event: 'graph-render' });
  }

  applyFileClick() {
    this.applyFile(this.fileName());
  }
}

exports.CommitLineDiff = CommitLineDiff;

const ko = require('knockout');
const components = require('ungit-components');
const diff2html = require('diff2html');
const sideBySideDiff = 'sidebysidediff';
const textDiff = 'textdiff';

components.register('textdiff', (args) => new TextDiffViewModel(args));
components.register('textdiff.type', () => new Type());
components.register('textdiff.wordwrap', () => new WordWrap());
components.register('textdiff.whitespace', () => new WhiteSpace());

const loadLimit = 100;

class WordWrap {
  constructor() {
    this.value = ko.observable(false);

    this.toggle = () => {
      console.log(
        `${new Date().toISOString()} [ACTION:UI TEXTDIFF] wordwrap toggle: ${!this.value()}`
      );
      this.value(!this.value());
    };
    this.text = ko.computed(() => (this.value() ? 'Wrap Lines' : 'No Wrap'));
    this.isActive = ko.computed(() => this.value());
  }
}

class Type {
  constructor() {
    if (
      !!ungit.config.diffType &&
      ungit.config.diffType !== textDiff &&
      ungit.config.diffType !== sideBySideDiff
    ) {
      ungit.config.diffType = textDiff;
      console.log('Config "diffType" must be either "textdiff" or "sidebysidediff".');
    }

    this.value = ko.observable(ungit.config.diffType || textDiff);

    this.toggle = () => {
      const nextType = this.value() === textDiff ? sideBySideDiff : textDiff;
      console.log(`${new Date().toISOString()} [ACTION:UI TEXTDIFF] diffType toggle: ${nextType}`);
      this.value(nextType);
    };
    this.text = ko.computed(() => (this.value() === textDiff ? 'Inline' : 'Side By Side'));
    this.isActive = ko.computed(() => this.value() === sideBySideDiff);
  }
}

class WhiteSpace {
  constructor() {
    this.value = ko.observable(ungit.config.ignoreWhiteSpaceDiff);

    this.toggle = () => {
      console.log(
        `${new Date().toISOString()} [ACTION:UI TEXTDIFF] whitespace toggle: ${!this.value()}`
      );
      this.value(!this.value());
    };
    this.text = ko.computed(() => (this.value() ? 'Show Whitespace' : 'Hide Whitespace'));
    this.isActive = ko.computed(() => this.value());
  }
}

class TextDiffViewModel {
  constructor(args) {
    this.filename = args.filename;
    this.oldFilename = args.oldFilename;
    this.repoPath = args.repoPath;
    this.server = args.server;
    this.sha1 = args.sha1;
    this.hasMore = ko.observable(false);
    this.diffJson = null;
    this.loadCount = loadLimit;
    this.textDiffType = args.textDiffType;
    this.whiteSpace = args.whiteSpace;
    this.isShowingDiffs = args.isShowingDiffs;
    this.editState = args.editState;
    this.wordWrap = args.wordWrap;
    this.patchLineList = args.patchLineList;
    this.numberOfSelectedPatchLines = 0;
    this.htmlSrc = undefined;
    this.isParsed = ko.observable(false);

    this.isShowingDiffs.subscribe((newValue) => {
      console.log(
        `${new Date().toISOString()} [ACTION:UI TEXTDIFF] isShowingDiffs changed to ${newValue} for "${this.filename}"`
      );
      if (newValue) this.render();
    });
    this.textDiffType.value.subscribe(() => {
      if (this.isShowingDiffs()) this.render();
    });
    this.whiteSpace.value.subscribe(() => {
      if (this.isShowingDiffs()) this.invalidateDiff();
    });

    if (this.isShowingDiffs()) {
      this.render();
    }
  }

  updateNode(parentElement) {
    ko.renderTemplate('textdiff', this, {}, parentElement);
  }

  getDiffArguments() {
    return {
      file: this.filename,
      oldFile: this.oldFilename,
      path: this.repoPath(),
      sha1: this.sha1 ? this.sha1 : '',
      whiteSpace: this.whiteSpace.value(),
    };
  }

  invalidateDiff() {
    console.log(
      `${new Date().toISOString()} [ACTION:UI TEXTDIFF] invalidateDiff for "${this.filename}"`
    );
    this.diffJson = null;
    if (this.isShowingDiffs()) this.render();
  }

  getDiffJson() {
    const fetchStart = Date.now();
    console.log(
      `${new Date().toISOString()} [ACTION:UI TEXTDIFF] getDiffJson START for "${this.filename}" (sha1: ${this.sha1 || 'unstaged'})`
    );
    return this.server
      .getPromise('/diff', this.getDiffArguments())
      .then((diffs) => {
        const fetchDuration = Date.now() - fetchStart;
        const diffLen = typeof diffs === 'string' ? diffs.length : 0;
        console.log(
          `${new Date().toISOString()} [ACTION:UI TEXTDIFF] getDiffJson RECEIVED for "${this.filename}" (${fetchDuration}ms, raw size: ${diffLen} bytes)`
        );
        if (typeof diffs !== 'string') {
          // Invalid value means there is no changes, show dummy diff without any changes
          diffs = `diff --git a/${this.filename} b/${this.filename}
                  index aaaaaaaa..bbbbbbbb 111111
                  --- a/${this.filename}
                  +++ b/${this.filename}`;
        }
        const parseStart = Date.now();
        console.log(
          `${new Date().toISOString()} [ACTION:UI TEXTDIFF] diff2html.parse START for "${this.filename}"`
        );
        this.diffJson = diff2html.parse(diffs);
        const parseDuration = Date.now() - parseStart;
        console.log(
          `${new Date().toISOString()} [ACTION:UI TEXTDIFF] diff2html.parse END for "${this.filename}" (${parseDuration}ms, blocks: ${this.diffJson ? this.diffJson.length : 0})`
        );
      })
      .catch((err) => {
        const fetchDuration = Date.now() - fetchStart;
        console.log(
          `${new Date().toISOString()} [ACTION:UI TEXTDIFF] getDiffJson ERROR for "${this.filename}" (${fetchDuration}ms):`,
          err
        );
        // The file existed before but has been removed, but we're trying to get a diff for it
        // Most likely it will just disappear with the next refresh of the staging area
        // so we just ignore the error here
        if (err.errorCode != 'no-such-file') {
          this.server.unhandledRejection(err);
        } else {
          ungit.logger.warn('diff, no such file', err);
        }
      });
  }

  render() {
    const renderStart = Date.now();
    console.log(
      `${new Date().toISOString()} [ACTION:UI TEXTDIFF] render START for "${this.filename}"`
    );
    return (!this.diffJson ? this.getDiffJson() : Promise.resolve()).then(() => {
      if (!this.diffJson || this.diffJson.length == 0) {
        console.log(
          `${new Date().toISOString()} [ACTION:UI TEXTDIFF] render SKIP (empty diffJson) for "${this.filename}"`
        );
        return;
      }

      if (!this.diffJson[0].allBlocks) {
        this.diffJson[0].allBlocks = this.diffJson[0].blocks;
      }

      const currentLoadCount = Math.max(this.loadCount, loadLimit);
      let lineCount = 0;
      let loadCount = 0;
      this.diffJson[0].blocks = this.diffJson[0].allBlocks.reduce((blocks, block) => {
        const length = block.lines.length;
        const remaining = currentLoadCount - lineCount;
        if (remaining > 0) {
          loadCount += length;
          blocks.push(block);
        }
        lineCount += length;
        return blocks;
      }, []);

      this.loadCount = loadCount;
      this.hasMore(lineCount > loadCount);

      const htmlStart = Date.now();
      console.log(
        `${new Date().toISOString()} [ACTION:UI TEXTDIFF] diff2html.html START for "${this.filename}"`
      );
      let html = diff2html.html(this.diffJson, {
        outputFormat:
          this.textDiffType.value() === sideBySideDiff ? 'side-by-side' : 'line-by-line',
        drawFileList: false,
      });
      const htmlDuration = Date.now() - htmlStart;
      console.log(
        `${new Date().toISOString()} [ACTION:UI TEXTDIFF] diff2html.html END for "${this.filename}" (${htmlDuration}ms, html size: ${html ? html.length : 0} chars)`
      );

      this.numberOfSelectedPatchLines = 0;
      let index = 0;

      // ko's binding resolution is not recursive, which means below ko.bind refresh method doesn't work for
      // data bind at getPatchCheckBox that is rendered with "html" binding.
      // which is reason why manually updating the html content and refreshing kobinding to have it render...
      if (this.patchLineList) {
        html = html.replace(/<span class="d2h-code-line-prefix">(\+|-)/g, (match, capture) => {
          if (this.patchLineList()[index] === undefined) {
            this.patchLineList()[index] = true;
          }

          return this.getPatchCheckBox(capture, index, this.patchLineList()[index++]);
        });
      }

      if (html !== this.htmlSrc) {
        // diff has changed since last we displayed and need refresh
        this.htmlSrc = html;
        this.isParsed(false);
        this.isParsed(true);
      }

      const totalRenderDuration = Date.now() - renderStart;
      console.log(
        `${new Date().toISOString()} [ACTION:UI TEXTDIFF] render COMPLETE for "${this.filename}" (total: ${totalRenderDuration}ms)`
      );
    });
  }

  loadMore() {
    console.log(
      `${new Date().toISOString()} [ACTION:UI TEXTDIFF] loadMore for "${this.filename}", new loadCount: ${this.loadCount + loadLimit}`
    );
    this.loadCount += loadLimit;
    this.render();
  }

  togglePatchLine(index) {
    console.log(
      `${new Date().toISOString()} [ACTION:UI TEXTDIFF] togglePatchLine for "${this.filename}" line ${index}`
    );
    this.patchLineList()[index] = !this.patchLineList()[index];

    if (this.patchLineList()[index]) {
      this.numberOfSelectedPatchLines++;
    } else {
      this.numberOfSelectedPatchLines--;
    }

    if (this.numberOfSelectedPatchLines === 0) {
      this.editState('none');
    }

    return true;
  }

  getPatchCheckBox(symbol, index, isActive) {
    if (isActive) {
      this.numberOfSelectedPatchLines++;
    }
    return `<span class="d2h-code-line-prefix"><span data-bind="visible: editState() !== 'patched'">${symbol}</span><input ${
      isActive ? 'checked' : ''
    } type="checkbox" data-bind="visible: editState() === 'patched', click: togglePatchLine.bind($data, ${index})">`;
  }
}

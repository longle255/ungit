const ko = require('knockout');
const octicons = require('octicons');
const components = require('ungit-components');

components.register(
  'tools',
  (args) => new ToolsViewModel(args.server, args.repoPath, args.isBareDir)
);

class ToolsViewModel {
  constructor(server, repoPath, isBareDir) {
    this.server = server;
    this.repoPath = repoPath;
    this.isBareDir = isBareDir;
    this.toolsIcon = octicons['kebab-horizontal'].toSVG({ height: 18 });
  }

  updateNode(parentElement) {
    ko.renderTemplate('tools', this, {}, parentElement);
  }

  openReflog(event) {
    if (event) event.preventDefault();
    components.showModal('reflogmodal', {
      server: this.server,
      repoPath: this.repoPath(),
      isBareDir: this.isBareDir,
    });
  }
}

import * as vscode from 'vscode';

export class SnapPanel {
  public static currentPanel: SnapPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    code: string,
    language: string,
    config: vscode.WorkspaceConfiguration
  ) {
    const column = vscode.ViewColumn.Beside;

    if (SnapPanel.currentPanel) {
      SnapPanel.currentPanel._panel.reveal(column);
      SnapPanel.currentPanel._update(code, language, config);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'codesnap',
      'CodeSnap',
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );

    SnapPanel.currentPanel = new SnapPanel(panel, extensionUri, code, language, config);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    code: string,
    language: string,
    config: vscode.WorkspaceConfiguration
  ) {
    this._panel = panel;
    this._update(code, language, config);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview (e.g., save button click)
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === 'save') {
          // The webview sends a base64 PNG data URL
          await this._saveImage(message.data);
        }
      },
      null,
      this._disposables
    );
  }

  private async _saveImage(dataUrl: string) {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('code-screenshot.png'),
      filters: { 'PNG Image': ['png'] },
    });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, buffer);
      vscode.window.showInformationMessage(`Screenshot saved to ${uri.fsPath}`);
    }
  }

  private _update(code: string, language: string, config: vscode.WorkspaceConfiguration) {
    this._panel.webview.html = this._getWebviewContent(code, language, config);
  }

  private _getWebviewContent(
    code: string,
    language: string,
    config: vscode.WorkspaceConfiguration
  ): string {
    const backgroundColor = config.get<string>('backgroundColor', '#ABB8C3');
    const showWindowControls = config.get<boolean>('showWindowControls', true);
    const fontFamily = config.get<string>('fontFamily', 'JetBrains Mono, monospace');
    const fontSize = config.get<number>('fontSize', 14);
    const showLineNumbers = config.get<boolean>('lineNumbers', true);

    // Escape HTML entities in the code
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lineNumbersHtml = showLineNumbers
      ? code.split('\n').map((_, i) => `<span>${i + 1}</span>`).join('\n')
      : '';

    const windowControls = showWindowControls
      ? `<div class="window-controls">
           <span class="dot red"></span>
           <span class="dot yellow"></span>
           <span class="dot green"></span>
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeSnap</title>

  <!-- Highlight.js for syntax highlighting -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

  <!-- html2canvas for exporting the screenshot -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #1e1e2e;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      font-family: system-ui, sans-serif;
      color: #cdd6f4;
    }

    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }

    .toolbar button {
      padding: 8px 18px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    }

    .btn-save {
      background: #89b4fa;
      color: #1e1e2e;
    }

    .btn-copy {
      background: #313244;
      color: #cdd6f4;
    }

    /* Outer container with the background color (what you see around the code window) */
    .snap-container {
      background: ${backgroundColor};
      padding: 40px;
      border-radius: 12px;
      display: inline-block;
    }

    /* The fake code editor window */
    .code-window {
      background: #282c34;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      min-width: 400px;
      max-width: 900px;
    }

    /* Title bar with window controls */
    .title-bar {
      background: #21252b;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .window-controls {
      display: flex;
      gap: 7px;
    }

    .dot {
      width: 13px;
      height: 13px;
      border-radius: 50%;
    }

    .dot.red    { background: #ff5f57; }
    .dot.yellow { background: #febc2e; }
    .dot.green  { background: #28c840; }

    .file-lang {
      color: #636d83;
      font-size: 13px;
      font-family: ${fontFamily};
    }

    /* Code content area */
    .code-body {
      display: flex;
      padding: 20px 0;
      overflow-x: auto;
    }

    /* Line number gutter */
    .line-numbers {
      display: ${showLineNumbers ? 'flex' : 'none'};
      flex-direction: column;
      align-items: flex-end;
      padding: 0 16px 0 20px;
      color: #636d83;
      font-size: ${fontSize}px;
      font-family: ${fontFamily};
      line-height: 1.6;
      user-select: none;
      min-width: 40px;
    }

    .line-numbers span {
      display: block;
    }

    /* The code itself */
    .code-content {
      flex: 1;
      padding: 0 24px 0 0;
      overflow-x: auto;
    }

    .code-content pre {
      margin: 0;
    }

    .code-content code {
      font-family: ${fontFamily} !important;
      font-size: ${fontSize}px !important;
      line-height: 1.6 !important;
      background: transparent !important;
      tab-size: 2;
    }

    /* Override highlight.js background */
    .hljs { background: transparent !important; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-save" onclick="saveImage()">💾 Save PNG</button>
    <button class="btn-copy" onclick="copyImage()">📋 Copy to Clipboard</button>
  </div>

  <div class="snap-container" id="snap">
    <div class="code-window">
      <div class="title-bar">
        ${windowControls}
        <span class="file-lang">${language}</span>
      </div>
      <div class="code-body">
        <div class="line-numbers">${lineNumbersHtml}</div>
        <div class="code-content">
          <pre><code class="language-${language}">${escapedCode}</code></pre>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Run highlight.js on the code block
    document.querySelectorAll('pre code').forEach((el) => {
      hljs.highlightElement(el);
    });

    async function saveImage() {
      const el = document.getElementById('snap');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const dataUrl = canvas.toDataURL('image/png');
      vscode.postMessage({ command: 'save', data: dataUrl });
    }

    async function copyImage() {
      const el = document.getElementById('snap');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
      });
    }
  </script>
</body>
</html>`;
  }

  public dispose() {
    SnapPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}
import * as vscode from 'vscode';
import { SnapPanel } from './snapPanel';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('codesnap-clone.snap', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No active editor found.');
      return;
    }

    // Get selected text, or fall back to entire document
    const selection = editor.selection;
    const code = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);

    const language = editor.document.languageId;
    const config = vscode.workspace.getConfiguration('codesnap-clone');

    SnapPanel.createOrShow(context.extensionUri, code, language, config);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
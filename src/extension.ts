/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import CompletionProvider from './Providers/Completion/index';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('langums', new CompletionProvider(context), '.', '\"'));
}

export function deactivate() {
	// nothing to do
}

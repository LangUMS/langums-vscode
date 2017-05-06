/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import CompletionProvider from './Providers/Completion/index';

const initialConfigurations = {
	version: '0.2.0',
	configurations: [
		{
			type: 'langums',
			request: 'launch',
			name: 'LangUMS Debug',
			langums: '${workspaceRoot}/langums.exe',
			map: '${workspaceRoot}/my_map.scx',
			lang: '${workspaceRoot}/my_map.l',
			dst: '${workspaceRoot}/my_map_release.scx'
		}
	]
};

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('langums', new CompletionProvider(context), '.', '\"'));

	context.subscriptions.push(vscode.commands.registerCommand('extension.langums.provideInitialConfigurations', () => {
		return [
			'// Use IntelliSense to learn about possible Mock debug attributes.',
			'// Hover to view descriptions of existing attributes.',
			JSON.stringify(initialConfigurations, null, '\t')
		].join('\n');
	}));
}

export function deactivate() {
	// nothing to do
}

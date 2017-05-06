/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {
	Logger, logger,
	DebugSession, LoggingDebugSession,
	InitializedEvent, TerminatedEvent, Thread, OutputEvent, Breakpoint,
	StoppedEvent, StackFrame, Source, Scope
} from 'vscode-debugadapter';

import {DebugProtocol} from 'vscode-debugprotocol';

import {DebuggerApi} from './debugger-api';

export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	langums: string; // langums.exe path
	map: string; // input .scx path
	lang: string; // input source path
	dst: string; // destination .scx path
	trace?: boolean; // enable protocol debug logging
}

class LangumsDebugSession extends LoggingDebugSession {
	private static THREAD_ID = 1;

	private api: DebuggerApi;
	private langPath: string;
	private stackFrames: any[];

	public constructor() {
		super("langums-debug.txt");
		this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);
	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		response.body = response.body || {};
		response.body.supportsConfigurationDoneRequest = true;
		this.sendResponse(response);
	}

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);

		this.langPath = args.lang;

		logger.warn('Launching LangUMS');
		this.api = new DebuggerApi(args.langums, args.map, args.lang, args.dst, logger);

		this.api.on('output', message => {
			this.sendEvent(new OutputEvent(message + '\n', "log"));
		});

		this.api.on('error', message => {
			this.sendEvent(new OutputEvent(message + '\n', "error"));
		});

		this.api.once('initialized', () => {
			logger.warn('Debugger initialized.');
			this.sendEvent(new InitializedEvent());
		});

		this.api.on('terminated', () => {
			this.sendEvent(new TerminatedEvent());
		});

		this.api.on('breakpoint-hit', () => {
			this.sendEvent(new StoppedEvent("breakpoint", LangumsDebugSession.THREAD_ID));
		});

		this.continueRequest(<DebugProtocol.ContinueResponse>response, { threadId: LangumsDebugSession.THREAD_ID });
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		if (!args.breakpoints) {
			return;
		}

		let reqBreakpoints: any[] = [];
		let nextBreakpointId = 1;

		for (let i = 0; i < args.breakpoints.length; i++) {
			reqBreakpoints.push({
				id: nextBreakpointId++,
				line: args.breakpoints[i].line
			});
		}

		this.api.dispatchCommand({
			type: 'set-breakpoints',
			breakpoints: reqBreakpoints
		});

		this.api.once('breakpoints-set', breakpoints => {
			const outBreakpoints = new Array<Breakpoint>();

			for (let i = 0; i < breakpoints.length; i++) {
				outBreakpoints.push(new Breakpoint(true, breakpoints[i].line));
			}

			response.body = {
				breakpoints: outBreakpoints
			};
			this.sendResponse(response);
		});
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		response.body = {
			threads: [
				new Thread(LangumsDebugSession.THREAD_ID, "LangUMS")
			]
		};

		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		this.api.dispatchCommand({
			type: 'get-stack'
		});

		this.api.once('stacktrace', frames => {
			this.stackFrames = frames;

			const outFrames = new Array<StackFrame>();

			for (let i = 0; i < frames.length; i++) {
				let frame = frames[i];
				outFrames.push(new StackFrame(frame.id, frame.name, new Source(this.langPath), frame.line));
			}

			response.body = {
				stackFrames: outFrames,
				totalFrames: outFrames.length
			};

			this.sendResponse(response);
		});
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		let frame: any = null;
		for (var i = 0; i < this.stackFrames.length; i++) {
			if (this.stackFrames[i].id == args.frameId) {
				frame = this.stackFrames[i];
				break;
			}
		}

		const scopes = new Array<Scope>();

		if (frame != null) {
			scopes.push(new Scope("Variables", frame.id, false));
		}

		response.body = {
			scopes: scopes
		};

		this.sendResponse(response);
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
		let frameId = args.variablesReference;

		let frame: any = null;
		for (let i = 0; i < this.stackFrames.length; i++) {
			if (this.stackFrames[i].id == frameId) {
				frame = this.stackFrames[i];
				break;
			}
		}

		const variables = new Array<DebugProtocol.Variable>();

		if (frame != null) {
			for (let i = 0; i < frame.variables.length; i++) {
				let variable = frame.variables[i];

				variables.push({
					name: variable.name,
					type: "integer",
					value: variable.value,
					variablesReference: 0
				});
			}
		}

		response.body = {
			variables: variables
		};

		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.api.dispatchCommand({
			type: 'continue'
		});

		this.sendResponse(response);
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this.api.dispatchCommand({
			type: 'next'
		});

		this.sendResponse(response);
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		if (args.terminateDebuggee) {
			this.api.kill();
		}

		this.sendResponse(response);
	}
}

DebugSession.run(LangumsDebugSession);

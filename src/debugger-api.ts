import {spawn, ChildProcess} from 'child_process';
import {EventEmitter} from 'events';

export class DebuggerApi extends EventEmitter {

	private process: ChildProcess;

	constructor(langumsPath, srcPath, langPath, dstPath, logger) {
		super();

		this.process = spawn(langumsPath, [
			'--debug-vscode',
			'--src', srcPath,
			'--lang', langPath,
			'--dst', dstPath
		]);

		this.process.on('close', exitCode => {
			this.emit('terminated', exitCode);
		});

		let buffer = "";
		this.process.stdout.on('data', data => {
			buffer += data;

			let newLine = buffer.indexOf('\n');
			while (newLine >= 0) {
				let line = buffer.substr(0, newLine + 1);
				let event = null;

				try {
					event = JSON.parse(line);
				} catch (ex) {
					this.emit('error', 'Error parsing debugger response: ' + ex);
					return;
				}

				this.processEvent(event);
				buffer = buffer.substr(newLine + 1);
				newLine = buffer.indexOf('\n');
				logger.warn(buffer);
			}
		});
	}

	kill() {
		this.process.kill();
	}

	dispatchCommand(cmd) {
		let json = JSON.stringify(cmd);
		this.process.stdin.write(json + '\n');
	}

	processEvent(event) {
		if (event.type == 'initialized') {
			this.emit('initialized');
		} else if (event.type == 'log') {
			this.emit('output', event.data.message);
		} else if (event.type == 'breakpoints-set') {
			this.emit('breakpoints', event.data.breakpoints);
		} else if (event.type == 'breakpoint-hit') {
			this.emit('breakpoint-hit');
		} else if (event.type == 'stacktrace') {
			this.emit('stacktrace', event.data.frames);
		}
	}

}

import ora, { Ora } from 'ora';
import { prompt } from 'enquirer';
import { container, Singleton } from '@baileyherbert/container';

const _info = console.info;
const _debug = console.debug;
const _error = console.error;

@Singleton()
export class Logger {
	private _spinner?: Ora;

	/**
	 * Prints informational output to stdout.
	 */
	public info(...args: any[]) {
		if (this._spinner) {
			this._spinner.clear();
			_info(...args);
			this._spinner.render();
		}
		else {
			_info(...args);
		}
	}

	/**
	 * Prints error output to stderr.
	 */
	public error(...args: any[]) {
		if (this._spinner) {
			this._spinner.clear();
			_error(...args);
			this._spinner.render();
		}
		else {
			_error(...args);
		}
	}

	/**
	 * Prints debugging output to stdout when verbose mode is enabled.
	 */
	public debug(...args: any[]) {
		if (!container.getContext('enableVerboseLogging')) {
			return;
		}

		if (this._spinner) {
			this._spinner.clear();
			_debug(...args);
			this._spinner.render();
		}
		else {
			_debug(...args);
		}
	}

	/**
	 * Starts or updates the spinner.
	 *
	 * @param message Sets or updates the message on the spinner.
	 * @returns
	 */
	public spin(message?: string) {
		if (this._spinner) {
			if (typeof message === 'string') {
				this._spinner.text = message;
			}

			this._spinner.start();
			return;
		}

		this._spinner = ora(message);
		this._spinner.start();
	}

	/**
	 * Stops and clears the spinner.
	 */
	public stop() {
		if (this._spinner) {
			this._spinner.stop();
			this._spinner = undefined;
		}
	}

	/**
	 * Stops and clears the spinner, but leaves the handle so it can be resumed.
	 */
	public pause() {
		if (this._spinner) {
			this._spinner.stop();
		}
	}

	/**
	 * Resumes the spinner.
	 */
	public resume() {
		if (this._spinner) {
			this._spinner.start();
		}
	}

	/**
	 * Prompts the user for information, and returns an object containing the inputs.
	 *
	 * If a spinner is active when this is called, the spinner is automatically paused and then resumed immediately
	 * before resolving.
	 */
	public async prompt<T = Record<string, any>>(questions: PromptOptions) {
		try {
			this.pause();
			return await prompt(questions) as T;
		}
		catch {
			throw new Error('Aborted');
		}
		finally {
			this.resume();
		}
	}

	/**
	 * Hijacks `console` functions to use the logger instead.
	 */
	public hijack() {
		console.log = this.info.bind(this);
		console.info = this.info.bind(this);
		console.debug = this.debug.bind(this);
		console.trace = this.debug.bind(this);
		console.warn = this.error.bind(this);
		console.error = this.error.bind(this);
	}
}

type PromptOptions = Parameters<typeof prompt>[0];

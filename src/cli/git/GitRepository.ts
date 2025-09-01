import { Singleton } from '@baileyherbert/container';
import { Logger } from '../foundation/Logger';
import { stat } from 'fs/promises';
import { resolve } from 'path';
import { sync as getCommandExists } from 'command-exists';
import createSimpleGit, { SimpleGit } from 'simple-git';

@Singleton()
export class GitRepository {
	private _client: SimpleGit;

	public constructor(protected readonly logger: Logger) {
		this._client = createSimpleGit();
	}

	/**
	 * The simple-git client for this process.
	 */
	public get client() {
		return this._client;
	}

	/**
	 * Validates that git is available in the current environment and that the working directory is a git repository.
	 * Throws an error if either of these conditions are false.
	 */
	public async validateWorkDir() {
		const target = await this._stat(resolve('.git'));

		if (target === null || !target.isDirectory()) {
			throw new Error('The working directory must be the root of a git repository!');
		}

		if (!getCommandExists('git')) {
			throw new Error('The "git" command was not found. Please ensure git is installed and available in this environment.');
		}
	}

	/**
	 * Returns the stats for the given file ordirectory, or `null` if it does not exist or could not be accessed.
	 */
	private async _stat(target: string) {
		try {
			return await stat(target);
		}
		catch (error) {
			this.logger.debug('Stat error on %s:', target, error);
			return null;
		}
	}
}

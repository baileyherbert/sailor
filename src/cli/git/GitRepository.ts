import { Singleton } from '@baileyherbert/container';
import { Logger } from '../foundation/Logger';
import { stat } from 'fs/promises';
import { resolve } from 'path';
import { sync as getCommandExists } from 'command-exists';
import { existsSync, statSync, unlinkSync } from 'fs';
import createSimpleGit, { SimpleGit } from 'simple-git';
import kleur from 'kleur';

@Singleton()
export class GitRepository {
	private _client: SimpleGit;
	private _gzipSupport?: boolean;

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

	public async createArchive(spec: string, options: CreateArchiveOptions = {}) {
		if (!spec.length) {
			throw new Error('Missing target ref (branch/commit/tag)');
		}

		this._assertReference(spec);

		const sha = await this._resolveSha(spec);
		const enableTarGz = (options.enableGzip ?? true) && await this.getGzipSupported();
		const outputFormat = enableTarGz ? 'tar.gz' : 'tar';
		const outputPath = this._dedupeName('sailor', outputFormat);

		this.logger.debug('Creating archive for spec:', spec);
		this.logger.debug('Target path:', outputPath);

		try {
			const response = await this._client.raw([
				'archive',
				`--format=${outputFormat}`,
				'--output',
				outputPath,
				spec
			]);

			this.logger.debug('Created archive with response:', response);

			return {
				path: outputPath,
				gzipped: enableTarGz,
				size: statSync(outputPath).size,
				sha,
			};
		}
		catch (error) {
			this.logger.error(kleur.red('Failed to create git archive!'));
			this.logger.error(kleur.red('Target path: %s'), outputPath);
			this.logger.error(kleur.red('The underlying error will be dumped below:'));
			this.logger.error(error);

			if (existsSync(outputPath)) {
				try {
					unlinkSync(outputPath);
				}
				catch {}
			}

			process.exit(1);
		}
	}

	private _assertReference(spec: string) {
		if (!/^[A-Za-z0-9._/\-]+$/.test(spec)) {
			throw new Error(`Invalid ref: ${spec}`);
		}

		if (spec.includes('..') || spec.includes('@{') || spec.startsWith('-')) {
			throw new Error(`Unsafe ref syntax: ${spec}`);
		}
	}

	private async _resolveSha(spec: string) {
		try {
			this.logger.debug('Resolving SHA for input spec "%s"...', spec);

			const sha = await this._client.revparse(['--verify', spec]);
			this.logger.debug('Resolved SHA:', sha);

			return sha;
		}
		catch (error) {
			this.logger.debug(error);
			throw new Error(`Could not find "${spec}"`);
		}
	}

	private _dedupeName(baseName: string, extension: string) {
		for (let i = 0; i < 10000; i++) {
			const suffix = i > 0 ? `.${i}` : '';
			const path = resolve(process.cwd(), `${baseName}${suffix}.${extension}`);

			if (!existsSync(path)) {
				return path;
			}
		}

		throw new Error(`Failed to find an available name for ${baseName}.${extension}`);
	}

	/**
	 * Returns true if the local git installation supports `tar.gz` as an archive format. The result of this method is
	 * cached internally.
	 */
	public async getGzipSupported() {
		if (typeof this._gzipSupport === 'boolean') {
			return this._gzipSupport;
		}

		const out = await this._client.raw(['archive', '--list']).catch(() => '');
		return this._gzipSupport = /\b(tar\.gz|tgz)\b/.test(out);
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

export interface CreateArchiveOptions {
	/**
	 * Whether or not to allow the creation of `tar.gz` files (when supported by the system and local git version).
	 */
	enableGzip?: boolean;
}

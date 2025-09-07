import { container } from '@baileyherbert/container';
import { SailorAction } from '../foundation/SailorAction';
import { GitRepository } from '../git/GitRepository';
import { promptBranch, promptEndpoint, promptServer, promptService } from '../support/prompts';
import { Portainer } from '../../portainer/Portainer';
import { PortainerFactory } from '../../portainer/PortainerFactory';
import { Endpoint } from '../../portainer/models/Endpoint';
import { Scalar } from 'yaml';
import kleur from 'kleur';
import { createReadStream, unlinkSync } from 'fs';

export class DeployAction extends SailorAction {
	public constructor() {
		super({
			actionName: 'deploy',
			summary: 'Deploy the current directory to a server',
			documentation: 'Deploy the current directory to a server'
		});
	}

	protected override async onExecuteAsync() {
		this.logger.spin('Checking repository');

		const git = container.resolve(GitRepository);
		await git.validateWorkDir();

		const servers = this.configuration.getServers();
		const branches = await git.client.branch();

		this.logger.stop();

		const registration = await promptServer(servers);
		const server = await PortainerFactory.createFromRegistration(registration);
		const endpoints = await this._getEndpoints(server);

		const endpoint = endpoints.length === 1 ? endpoints[0] : await promptEndpoint(endpoints);
		const service = await this._promptServiceFromEndpoint(server, endpoint);
		const serviceImageNode = service.configuration.get('image', true) as Scalar;

		const branchName = await promptBranch(branches);
		const archive = await git.createArchive(branchName, {
			enableGzip: false
		});

		this.logger.debug('Created archive at:', archive.path);
		this.logger.debug('Archive size: %d bytes', archive.size);
		this.logger.debug('Archive SHA:', archive.sha);
		this.logger.debug('Archive gzipped:', archive.gzipped ? 'Yes' : 'No');

		const archiveStream = createReadStream(archive.path);

		try {
			const startTime = Date.now();
			const elapsed = () => Math.round((Date.now() - startTime) / 10) / 100;

			this.logger.spin('Uploading image to the server...');
			const response = await server.build(service, archiveStream, archive.sha);

			try { unlinkSync(archive.path); }
			catch {}

			this.logger.spin('Building image (logs may be buffered)...');

			for await (const line of response.stream) {
				this.logger.stdout(this._getLine(line));
			}

			this.logger.info('Built image in %d seconds', elapsed());
			this.logger.spin(`Updating and restarting service...`);

			if (serviceImageNode.value) {
				serviceImageNode.comment = ' Previous image: ' + (serviceImageNode.value as string);
			}

			serviceImageNode.value = response.tags.short;

			const newYaml = service.stack.document.toString({ lineWidth: 0 });
			await server.updateStackFile(service.stack, newYaml);

			this.logger.stop();
			this.logger.info(kleur.green('Successfully deployed in %d seconds'), elapsed());
		}
		catch (error) {
			try { unlinkSync(archive.path); }
			catch {}

			throw error;
		}
	}

	private _getLine(input: string) {
		try {
			const parsed = JSON.parse(input);

			if (parsed.error || parsed.errorDetail) {
				throw new LogError(parsed.errorDetail?.message || parsed.error);
			}

			if (typeof parsed.stream === 'string') {
				return parsed.stream;
			}

			if (parsed.status) {
				const prefix = parsed.id ? `${parsed.id}:` : '';
				const progress = parsed.progress ?? '';
				const status = parsed.status;

				return [prefix, status.trim(), progress].filter((i) => i.length > 0).join(' ') + '\n';
			}

			if (parsed.aux) {
				if (parsed.aux.ID) {
					return `=> ${parsed.aux.ID}\n`;
				}
			}

			return input + '\n';
		} catch (error) {
			if (error instanceof LogError) {
				throw error;
			}

			return input + '\n';
		}
	}

	private async _getEndpoints(server: Portainer) {
		this.logger.spin('Retrieving endpoints');

		const endpoints = await server.getEndpoints();

		this.logger.stop();
		this.logger.debug('Received %d endpoints from server', endpoints.length);

		if (endpoints.length === 1) {
			this.logger.debug('The lone endpoint (%s - #%d) will be auto-selected', endpoints[0].Name, endpoints[0].Id);
		}

		return endpoints;
	}

	private async _promptServiceFromEndpoint(server: Portainer, endpoint: Endpoint) {
		this.logger.spin('Retrieving services');

		const services = await server.getServices(endpoint.Id);
		this.logger.stop();

		if (services.length === 0) {
			throw new Error('There are no services available on the target server!');
		}

		const service = await promptService(services);

		if (service.thirdparty) {
			this.logger.error(
				kleur.red('The service "%s" is not currently using an image built with sailor!'),
				service.name,
			);

			this.logger.error(kleur.red('If you continue, the current image (%s) will be replaced.'), service.image);

			const { response } = await this.logger.prompt<{ response: boolean }>({
				type: 'confirm',
				message: 'Continue anyway?',
				initial: false,
				name: 'response'
			});

			if (!response) {
				throw new Error('Aborted');
			}
		}

		return service;
	}
}

class LogError extends Error {}

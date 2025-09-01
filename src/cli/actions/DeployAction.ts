import { container } from '@baileyherbert/container';
import { SailorAction } from '../foundation/SailorAction';
import { GitRepository } from '../git/GitRepository';
import { promptBranch, promptEndpoint, promptServer, promptService } from '../support/prompts';
import { Portainer } from '../../portainer/Portainer';
import { PortainerFactory } from '../../portainer/PortainerFactory';
import { Endpoint } from '../../portainer/models/Endpoint';
import { Scalar } from 'yaml';
import kleur from 'kleur';

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

		// serviceImageNode.value = 'sailor-image:1.0';
		// service.stack.document.toString({ lineWidth: 0 })
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

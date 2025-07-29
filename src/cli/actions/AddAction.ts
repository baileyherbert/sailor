import { prompt } from 'enquirer';
import { SailorAction } from '../foundation/SailorAction';
import { parseUrlOrFail } from '../support/parsers';
import { PortainerFactory } from '../../portainer/PortainerFactory';

export class AddAction extends SailorAction {
	public constructor() {
		super({
			actionName: 'add',
			summary: 'Add a new server for deployments',
			documentation: 'Add a new server for deployments'
		});
	}

	protected override async onExecuteAsync() {
		const { url } = await prompt<{ url: string }>({
			type: 'input',
			name: 'url',
			message: 'Portainer URL',
			initial: 'http://localhost:9443',
			required: true
		});

		const { host } = parseUrlOrFail(url);
		const { name } = await prompt<{ name: string }>({
			type: 'input',
			name: 'name',
			message: 'Name',
			required: false,
			initial: host,
			validate: (input) => {
				if (!this.configuration.getNameAvailable(input)) {
					return 'That name is currently in use by another server!';
				}

				return true;
			}
		});

		const portainer = await PortainerFactory.createFromLogin(url);

		if (name) {
			portainer.name = name;
		}

		portainer.save();
		this.logger.info('Successfully added server!');
	}
}

import { prompt } from 'enquirer';
import { SailorAction } from '../foundation/SailorAction';
import { Portainer } from '../../portainer/Portainer';

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
			initial: 'https://portainer.nas.local',
			required: true
		});

		const portainer = new Portainer(url);

		if (portainer.saved) {
			this.logger.error('A server already exists with that URL. If you proceed, it will be updated.');
		}

		const { name } = await prompt<{ name: string }>({
			type: 'input',
			name: 'name',
			message: 'Name',
			required: false,
			initial: portainer.name,
		});

		await portainer.login();

		if (name) {
			portainer.name = name;
		}

		const existing = portainer.saved;
		portainer.save();

		this.logger.info('Successfully %s server!', existing ? 'updated' : 'added');
	}
}

import { CommandLineParser } from '@rushstack/ts-command-line';
import { AddAction } from './actions/AddAction';
import { DeployAction } from './actions/DeployAction';
import { RemoveAction } from './actions/RemoveAction';

export class SailorCommandLineParser extends CommandLineParser {
	public constructor() {
		super({
			toolFilename: 'sailor',
			toolDescription: 'Easily deploy projects to remote servers using portainer.'
		});

		this.addAction(new AddAction());
		this.addAction(new RemoveAction());
		this.addAction(new DeployAction());
	}

	protected override async onExecuteAsync() {
		return super.onExecuteAsync();
	}
}

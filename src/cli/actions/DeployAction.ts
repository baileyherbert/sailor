import { CommandLineAction } from '@rushstack/ts-command-line';

export class DeployAction extends CommandLineAction {
	public constructor() {
		super({
			actionName: 'deploy',
			summary: 'Deploy the current directory to a server',
			documentation: 'Deploy the current directory to a server'
		});
	}

	protected override async onExecuteAsync() {}
}

import { CommandLineFlagParameter, CommandLineParser } from '@rushstack/ts-command-line';
import { AddAction } from './actions/AddAction';
import { DeployAction } from './actions/DeployAction';
import { RemoveAction } from './actions/RemoveAction';
import { container } from '@baileyherbert/container';
import { Logger } from './foundation/Logger';
import kleur from 'kleur';

export class SailorCommandLineParser extends CommandLineParser {
	public readonly logger = container.resolve(Logger);
	private readonly _verbose: CommandLineFlagParameter;

	public constructor() {
		super({
			toolFilename: 'sailor',
			toolDescription: 'Easily deploy projects to remote servers using portainer.'
		});

		this._verbose = this.defineFlagParameter({
			parameterLongName: '--verbose',
			parameterShortName: '-v',
			description: 'Show extra logging output',
			environmentVariable: 'VERBOSE'
		});

		this.addAction(new AddAction());
		this.addAction(new RemoveAction());
		this.addAction(new DeployAction());
	}

	protected override async onExecuteAsync() {
		if (this._verbose.value) {
			container.setContext('enableVerboseLogging', true);
		}

		try {
			await super.onExecuteAsync();
		}
		catch (error) {
			this.logger.stop();

			if (error instanceof Error) {
				this.logger.error(kleur.red('%s: %s'), error.name, error.message);
			}
			else {
				this.logger.error(kleur.red('%s'), error);
			}

			process.exit(1);
		}
	}
}

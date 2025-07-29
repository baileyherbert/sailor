import { container } from '@baileyherbert/container';
import { CommandLineAction } from '@rushstack/ts-command-line';
import { Logger } from './Logger';
import { ConfigurationStore } from '../../stores/ConfigurationStore';

export abstract class SailorAction extends CommandLineAction {
	protected readonly logger = container.resolve(Logger);
	protected readonly configuration = container.resolve(ConfigurationStore);

    protected abstract override onExecuteAsync(): Promise<void>;
}

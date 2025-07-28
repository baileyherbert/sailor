import 'source-map-support/register.js';
import { SailorCommandLineParser } from './cli/SailorCommandLineParser';

const parser = new SailorCommandLineParser();

// Forward all console output to the logger
parser.logger.hijack();

// Execute the command with automatic exit codes
parser.executeAsync().then(
	() => {
		parser.logger.stop();
		process.exit(0);
	},
	(error) => {
		parser.logger.error(error);
		parser.logger.stop();

		process.exit(1);
	}
);

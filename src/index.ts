import 'source-map-support/register.js';
import { SailorCommandLineParser } from './cli/SailorCommandLineParser';

const parser = new SailorCommandLineParser();
parser.executeAsync();

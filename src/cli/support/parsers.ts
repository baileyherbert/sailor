/**
 * Parses the given URL or throws an error if invalid.
 */
export function parseUrlOrFail(input: string) {
	try {
		return new URL(input);
	}
	catch {
		throw new Error('Invalid URL');
	}
}

export interface AccessTokenResponse {
	rawAPIKey: string;
	apiKey: {
		dateCreated: number;
		description: string;
		digest: string;
		id: number;
		lastUsed: number;
		prefix: string;
		userId: number;
	};
}

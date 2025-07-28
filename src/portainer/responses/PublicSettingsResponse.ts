export interface PublicSettingsResponse {
	/**
	 * Active authentication method for the Portainer instance. Valid values are:
	 * - `1` for internal
	 * - `2` for LDAP
	 * - `3` for OAuth
	 */
	AuthenticationMethod: number;
}

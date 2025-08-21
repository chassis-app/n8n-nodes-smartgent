import axios from 'axios';
import qs from 'qs';
import { GraphAccessTokenOptions } from './types';

/**
 * Get Microsoft Graph API access token using client credentials flow
 * @param options - Token request options
 * @returns Promise resolving to access token string
 */
export const getGraphAccessToken = async (options: GraphAccessTokenOptions): Promise<string> => {
	const {
		tokenEndpoint,
		clientId,
		clientSecret,
		scope = 'https://graph.microsoft.com/.default',
		grantType = 'client_credentials'
	} = options;

	const data = {
		grant_type: grantType,
		client_id: clientId,
		scope,
		client_secret: clientSecret,
	};

	const requestOptions = {
		method: 'POST' as const,
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		data: qs.stringify(data),
		url: tokenEndpoint
	};

	try {
		const response = await axios(requestOptions);
		return response.data.access_token;
	} catch (error) {
		throw new Error(`Failed to get Graph access token: ${error}`);
	}
};

/**
 * Get Microsoft Graph API access token using environment variables
 * Requires: SC_TOKEN_ENDPOINT, SC_CLIENT_ID, SC_CLIENT_SECRET
 * @returns Promise resolving to access token string
 */
export const getGraphAccessTokenFromEnv = async (): Promise<string> => {
	const tokenEndpoint = process.env.SC_TOKEN_ENDPOINT;
	const clientId = process.env.SC_CLIENT_ID;
	const clientSecret = process.env.SC_CLIENT_SECRET;

	if (!tokenEndpoint || !clientId || !clientSecret) {
		throw new Error('Missing required environment variables: SC_TOKEN_ENDPOINT, SC_CLIENT_ID, SC_CLIENT_SECRET');
	}

	return getGraphAccessToken({
		tokenEndpoint,
		clientId,
		clientSecret
	});
};

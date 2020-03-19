/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { BaseClient } from "./BaseClient";
import { AuthorizationCodeUrlParameters } from "../request/AuthorizationCodeUrlParameters";
import { AuthorizationCodeParameters } from "../request/AuthorizationCodeParameters";
import { Authority } from "../authority/Authority";
import { ServerParamsGenerator } from "../server/ServerParamsGenerator";
import { RequestValidator } from "../request/RequestValidator";
import { GrantType } from "../utils/Constants";
import { Configuration } from "../config/Configuration";

/**
 *
 * AuthorizationCodeFlow class
 *
 * Object instance which will construct requests to send to and handle responses
 * from the Microsoft STS using the authorization code flow.
 */
export class AuthorizationCodeClient extends BaseClient {

    constructor(configuration: Configuration) {

        super({
            authOptions: configuration.authOptions,
            systemOptions: configuration.systemOptions,
            loggerOptions: configuration.loggerOptions,
            storageInterface: configuration.storageInterface,
            networkInterface: configuration.networkInterface,
            cryptoInterface: configuration.cryptoInterface
        });
    }

    /**
     * Creates a url for logging in a user.
     *  - scopes added by default: openid, profile and offline_access.
     *  - performs validation of the request parameters.
     * @param request
     */
    async getAuthCodeUrl(request: AuthorizationCodeUrlParameters): Promise<string> {

        const authority: Authority = await this.createAuthority(request && request.authority);
        const queryParamMap: Map<string, string> = this.generateAuthCodeUrlParams(request);
        const queryString: string = ServerParamsGenerator.createQueryString(queryParamMap);
        return authority.authorizationEndpoint + "?" + queryString;
    }

    /**
     * API to acquire a token in exchange of 'authorization_code` acquired by the user in the first leg of the authorization_code_grant
     * @param request
     */
    async acquireToken(request: AuthorizationCodeParameters): Promise<string> {

        const authority: Authority = await this.createAuthority(request && request.authority);
        const acquiredTokenResponse = this.executeTokenRequest(authority, request);
        return acquiredTokenResponse;

        // add response_handler here to send the response
    }

    /**
     *
     * @param tokenEndPoint
     * @param body
     * @param headers
     */
    private async executeTokenRequest(authority: Authority, requestParameters: AuthorizationCodeParameters): Promise<string> {

        const tokenParameters: Map<string, string> = this.generateAuthCodeParams(requestParameters);

        // generate body and headers for the POST request and perform token request
        const headers: Map<string, string> = new Map<string, string>();
        let acquiredTokenResponse;
        try {
            acquiredTokenResponse = this.networkClient.sendPostRequestAsync<string>(
                authority.tokenEndpoint,
                {
                    body: ServerParamsGenerator.createQueryString(tokenParameters),
                    headers: ServerParamsGenerator.createHeaders(headers)
                }
            );
            return acquiredTokenResponse;
        } catch (error) {
            console.log(error.response.data);
            return error.response.data;
        }
    }

    /**
     * Generates a map for all the params to be sent to the service
     * @param request
     * @param config
     */
    private generateAuthCodeParams(request: AuthorizationCodeParameters) : Map<string, string> {
        const paramsMap: Map<string, string> = new Map<string, string>();

        ServerParamsGenerator.addClientId(paramsMap, this.config.authOptions.clientId);

        // validate and add scopes
        const scopes = RequestValidator.validateAndGenerateScopes(
            request.scopes,
            this.config.authOptions.clientId
        );
        ServerParamsGenerator.addScopes(paramsMap, scopes);

        // validate the redirectUri (to be a non null value)
        RequestValidator.validateRedirectUri(request.redirectUri);
        ServerParamsGenerator.addRedirectUri(paramsMap, request.redirectUri);

        // add code: user set, not validated
        ServerParamsGenerator.addAuthorizationCode(paramsMap, request.code);

        // add code_verifier if passed
        if (request.codeVerifier) {
            ServerParamsGenerator.addCodeVerifier(paramsMap, request.codeVerifier);
        }

        // add client_secret (needed for web apps)
        if (request.clientSecret) {
            ServerParamsGenerator.addClientSecret(paramsMap, request.clientSecret);
        }

        ServerParamsGenerator.addGrantType(paramsMap, GrantType.AUTHORIZATION_CODE_GRANT);

        return paramsMap;
    }

    /**
     * This API validates the `AuthorizationCodeUrlParameters` and creates a URL
     * @param request
     * @param config
     */
    private generateAuthCodeUrlParams(request: AuthorizationCodeUrlParameters): Map<string, string>{
        const paramsMap: Map<string, string> = new Map<string, string>();

        ServerParamsGenerator.addClientId(paramsMap, this.config.authOptions.clientId);

        // validate and add scopes
        const scopes = RequestValidator.validateAndGenerateScopes(
            request.scopes,
            this.config.authOptions.clientId
        );
        ServerParamsGenerator.addScopes(paramsMap, scopes);

        // validate the redirectUri (to be a non null value)
        RequestValidator.validateRedirectUri(request.redirectUri);
        ServerParamsGenerator.addRedirectUri(paramsMap, request.redirectUri);

        // validate and pass code_challenge Params
        if (request.codeChallenge) {
            RequestValidator.validateCodeChallengeParams(request.codeChallenge, request.codeChallengeMethod);
            ServerParamsGenerator.addCodeChallengeParams(paramsMap, request.codeChallenge, request.codeChallengeMethod);
        }

        // add state - user set, no validation needed (preferably a UUID)
        if (request.state) {
            ServerParamsGenerator.addState(paramsMap, request.state);
        }

        // validate and add prompt
        if (request.prompt) {
            RequestValidator.validatePrompt(request.prompt);
            ServerParamsGenerator.addPrompt(paramsMap, request.prompt);
        }

        // add login_hint: user set, no validation needed
        if (request.loginHint) {
            ServerParamsGenerator.addLoginHint(paramsMap, request.loginHint);
        }

        // add domain_hint: user set, no validation needed
        if (request.domainHint) {
            ServerParamsGenerator.addDomainHint(paramsMap, request.domainHint);
        }

        // add domain_hint: user set, no validation needed (preferably a UUID)
        if (request.nonce) {
            ServerParamsGenerator.addNonce(paramsMap, request.nonce);
        }

        // generate the correlationId if not set by the user and add
        const correlationId = request.correlationId
            ? request.correlationId
            : this.config.cryptoInterface.createNewGuid();
        ServerParamsGenerator.addCorrelationId(paramsMap, correlationId);

        // add response_mode = fragment (currently hardcoded, have a future option to pass 'query' if the user chooses to)
        ServerParamsGenerator.addResponseMode(paramsMap);

        // add response_type = code
        ServerParamsGenerator.addResponseTypeCode(paramsMap);

        return paramsMap;
    }
}
import { SpotMeta, SpotClearinghouseState, SpotMetaAndAssetCtxs } from '../types';
import { HttpApi } from '../utils/helpers';
import * as CONSTANTS from '../types/constants';
import { SymbolConversion } from '../utils/symbolConversion';
import { RateLimiter } from '../utils/rateLimiter';

export class InfoAPI {
    private httpApi: HttpApi;
    private symbolConversion: SymbolConversion;

    constructor(testnet: boolean, symbolConversion: SymbolConversion, rateLimiter: RateLimiter) {
        const baseURL = testnet ? CONSTANTS.BASE_URLS.TESTNET : CONSTANTS.BASE_URLS.PRODUCTION;
        this.httpApi = new HttpApi(baseURL, CONSTANTS.ENDPOINTS.INFO, rateLimiter);
        this.symbolConversion = symbolConversion;
    }

    async getSpotMeta(rawResponse: boolean = false): Promise<SpotMeta> {
        const response = await this.httpApi.makeRequest({ type: CONSTANTS.InfoType.SPOT_META });
        return rawResponse ? response : await this.symbolConversion.convertResponse(response, ["name", "coin", "symbol"], "SPOT");
    }

    async getSpotClearinghouseState(user: string, rawResponse: boolean = false): Promise<SpotClearinghouseState> {
        const response = await this.httpApi.makeRequest({ type: CONSTANTS.InfoType.SPOT_CLEARINGHOUSE_STATE, user: user });
        return rawResponse ? response : await this.symbolConversion.convertResponse(response, ["name", "coin", "symbol"], "SPOT");
    }

    async getSpotMetaAndAssetCtxs(rawResponse: boolean = false): Promise<SpotMetaAndAssetCtxs> {
        const response = await this.httpApi.makeRequest({ type: CONSTANTS.InfoType.SPOT_META_AND_ASSET_CTXS });
        return rawResponse ? response : await this.symbolConversion.convertResponse(response);
    }

    async getTokenDetails(tokenId: string, rawResponse: boolean = false): Promise<any> {
        const response = await this.httpApi.makeRequest({ 
            type: CONSTANTS.InfoType.TOKEN_DETAILS,
            tokenId: tokenId
        }, 20);
        
        return rawResponse ? response : await this.symbolConversion.convertResponse(response);
    }
    
    async getSpotDeployState(user: string, rawResponse: boolean = false): Promise<any> {
        const response = await this.httpApi.makeRequest({ 
            type: CONSTANTS.InfoType.SPOT_DEPLOY_STATE,
            user: user
        }, 20);
        
        return rawResponse ? response : await this.symbolConversion.convertResponse(response);
    }
}

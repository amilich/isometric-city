/** SCIM 2.0 URNs and limits used by the IsoCity identity API. */

export const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
export const LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SP_CONFIG_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig';
export const RESOURCE_TYPE_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:ResourceType';
export const SCHEMA_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Schema';

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 200;
export const MAX_COUNT = 200;
export const MAX_BODY_BYTES = 1_000_000;

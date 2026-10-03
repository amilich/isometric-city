export interface NameAttribute {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

export interface MultiValuedAttribute {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface AddressAttribute {
  formatted?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: string;
  primary?: boolean;
}

/**
 * Persisted SCIM user. `passwordHash` is write-only storage and is never
 * copied onto API responses. Group membership is not stored.
 */
export interface StoredUser {
  id: string;
  userName: string;
  active: boolean;
  externalId?: string;
  name?: NameAttribute;
  displayName?: string;
  nickName?: string;
  profileUrl?: string;
  title?: string;
  userType?: string;
  preferredLanguage?: string;
  locale?: string;
  timezone?: string;
  passwordHash?: string;
  emails?: MultiValuedAttribute[];
  phoneNumbers?: MultiValuedAttribute[];
  ims?: MultiValuedAttribute[];
  photos?: MultiValuedAttribute[];
  addresses?: AddressAttribute[];
  entitlements?: MultiValuedAttribute[];
  roles?: MultiValuedAttribute[];
  x509Certificates?: MultiValuedAttribute[];
  created: string;
  lastModified: string;
  version: number;
}

export type SimpleName =
  | 'externalId'
  | 'displayName'
  | 'nickName'
  | 'profileUrl'
  | 'title'
  | 'userType'
  | 'preferredLanguage'
  | 'locale'
  | 'timezone';

export type MultiName =
  | 'emails'
  | 'phoneNumbers'
  | 'ims'
  | 'photos'
  | 'entitlements'
  | 'roles'
  | 'x509Certificates';

export const SIMPLE_NAMES: readonly SimpleName[] = [
  'externalId',
  'displayName',
  'nickName',
  'profileUrl',
  'title',
  'userType',
  'preferredLanguage',
  'locale',
  'timezone',
];

export const MULTI_NAMES: readonly MultiName[] = [
  'emails',
  'phoneNumbers',
  'ims',
  'photos',
  'entitlements',
  'roles',
  'x509Certificates',
];

export const NAME_FIELDS = [
  'formatted',
  'familyName',
  'givenName',
  'middleName',
  'honorificPrefix',
  'honorificSuffix',
] as const;

export type NameField = (typeof NAME_FIELDS)[number];

export const ADDRESS_FIELDS = [
  'formatted',
  'streetAddress',
  'locality',
  'region',
  'postalCode',
  'country',
  'type',
] as const;

export type AddressField = (typeof ADDRESS_FIELDS)[number];

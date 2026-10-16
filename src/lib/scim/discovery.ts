import {
  RESOURCE_TYPE_SCHEMA,
  SCHEMA_SCHEMA,
  SP_CONFIG_SCHEMA,
  USER_SCHEMA,
} from './constants';

interface SchemaAttribute {
  name: string;
  type: 'string' | 'boolean' | 'complex' | 'reference';
  multiValued: boolean;
  description: string;
  required: boolean;
  caseExact: boolean;
  mutability: 'readOnly' | 'readWrite' | 'writeOnly';
  returned: 'always' | 'never' | 'default' | 'request';
  uniqueness: 'none' | 'server' | 'global';
  subAttributes?: SchemaAttribute[];
  referenceTypes?: string[];
  canonicalValues?: string[];
}

export function serviceProviderConfig(base: string): Record<string, unknown> {
  return {
    schemas: [SP_CONFIG_SCHEMA],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: true },
    etag: { supported: true },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Send the configured bearer token in the Authorization header.',
        specUri: 'https://www.rfc-editor.org/info/rfc6750',
        primary: true,
      },
    ],
    meta: {
      resourceType: 'ServiceProviderConfig',
      location: `${base}/ServiceProviderConfig`,
    },
  };
}

export function userResourceType(base: string): Record<string, unknown> {
  return {
    schemas: [RESOURCE_TYPE_SCHEMA],
    id: 'User',
    name: 'User',
    endpoint: '/Users',
    description: 'User Account',
    schema: USER_SCHEMA,
    meta: {
      resourceType: 'ResourceType',
      location: `${base}/ResourceTypes/User`,
    },
  };
}

export function userSchemaDocument(base: string): Record<string, unknown> {
  return {
    schemas: [SCHEMA_SCHEMA],
    id: USER_SCHEMA,
    name: 'User',
    description: 'User Account',
    attributes: userAttributes(),
    meta: {
      resourceType: 'Schema',
      location: `${base}/Schemas/${encodeURIComponent(USER_SCHEMA)}`,
    },
  };
}

function userAttributes(): SchemaAttribute[] {
  return [
    stringAttr('id', {
      description: 'Unique identifier for the User, assigned by the service provider.',
      required: true,
      caseExact: true,
      mutability: 'readOnly',
      returned: 'always',
      uniqueness: 'global',
    }),
    stringAttr('externalId', {
      description: 'Identifier for the User in the provisioning client.',
      caseExact: true,
    }),
    stringAttr('userName', {
      description: 'Unique identifier for the User, typically used by the user to log in.',
      required: true,
      uniqueness: 'server',
    }),
    complexAttr('name', 'The components of the user\'s real name.', false, nameSubAttributes()),
    stringAttr('displayName', { description: 'The name of the User, suitable for display.' }),
    stringAttr('nickName', { description: 'The casual way to address the user.' }),
    {
      ...stringAttr('profileUrl', { description: 'A URI that is the user\'s profile.' }),
      type: 'reference',
      referenceTypes: ['external'],
    },
    stringAttr('title', { description: 'The user\'s title, such as "Vice President".' }),
    stringAttr('userType', { description: 'The organization-to-user relationship, such as employee or contractor.' }),
    stringAttr('preferredLanguage', { description: 'The User\'s preferred written or spoken language.' }),
    stringAttr('locale', { description: 'The User\'s default location for localizing items such as currency or dates.' }),
    stringAttr('timezone', { description: 'The User\'s time zone, in IANA Time Zone database format.' }),
    {
      name: 'active',
      type: 'boolean',
      multiValued: false,
      description: 'A Boolean indicating the User\'s administrative status.',
      required: false,
      caseExact: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'none',
    },
    stringAttr('password', {
      description: 'The User\'s cleartext password. Write only; never returned.',
      mutability: 'writeOnly',
      returned: 'never',
    }),
    complexAttr('emails', 'Email addresses for the user.', true, multiSubAttributes()),
    complexAttr('phoneNumbers', 'Phone numbers for the user.', true, multiSubAttributes()),
    complexAttr('ims', 'Instant messaging addresses for the user.', true, multiSubAttributes()),
    complexAttr('photos', 'URLs of photos of the user.', true, multiSubAttributes(), ['external']),
    complexAttr('addresses', 'A physical mailing address for this user.', true, addressSubAttributes()),
    complexAttr('groups', 'Groups the user belongs to. Membership is not assigned by this service provider.', true, groupSubAttributes(), ['User', 'Group'], 'readOnly'),
    complexAttr('entitlements', 'A list of entitlements for the user.', true, multiSubAttributes()),
    complexAttr('roles', 'A list of roles for the user.', true, multiSubAttributes()),
    complexAttr('x509Certificates', 'A list of certificates issued to the user.', true, multiSubAttributes()),
  ];
}

function stringAttr(name: string, extra: Partial<SchemaAttribute> = {}): SchemaAttribute {
  return {
    name,
    type: 'string',
    multiValued: false,
    description: extra.description ?? name,
    required: false,
    caseExact: false,
    mutability: 'readWrite',
    returned: 'default',
    uniqueness: 'none',
    ...extra,
  };
}

function complexAttr(
  name: string,
  description: string,
  multiValued: boolean,
  subAttributes: SchemaAttribute[],
  referenceTypes?: string[],
  mutability: SchemaAttribute['mutability'] = 'readWrite',
): SchemaAttribute {
  return {
    name,
    type: 'complex',
    multiValued,
    description,
    required: false,
    caseExact: false,
    mutability,
    returned: 'default',
    uniqueness: 'none',
    subAttributes,
    ...(referenceTypes ? { referenceTypes } : {}),
  };
}

function nameSubAttributes(): SchemaAttribute[] {
  return [
    stringAttr('formatted', { description: 'The full name, including all middle names, titles, and suffixes.' }),
    stringAttr('familyName', { description: 'The family name or last name of the User.' }),
    stringAttr('givenName', { description: 'The given name or first name of the User.' }),
    stringAttr('middleName', { description: 'The middle name of the User.' }),
    stringAttr('honorificPrefix', { description: 'The honorific prefix of the User.' }),
    stringAttr('honorificSuffix', { description: 'The honorific suffix of the User.' }),
  ];
}

function multiSubAttributes(): SchemaAttribute[] {
  return [
    stringAttr('value', { description: 'The attribute value.' }),
    stringAttr('display', { description: 'A human-readable name, primarily used for display purposes.' }),
    stringAttr('type', { description: 'A label indicating the attribute\'s function, such as work or home.' }),
    {
      name: 'primary',
      type: 'boolean',
      multiValued: false,
      description: 'A Boolean indicating the preferred value for this attribute.',
      required: false,
      caseExact: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'none',
    },
  ];
}

function addressSubAttributes(): SchemaAttribute[] {
  return [
    stringAttr('formatted', { description: 'The full mailing address, formatted for display.' }),
    stringAttr('streetAddress', { description: 'The full street address component.' }),
    stringAttr('locality', { description: 'The city or locality component.' }),
    stringAttr('region', { description: 'The state or region component.' }),
    stringAttr('postalCode', { description: 'The zip code or postal code component.' }),
    stringAttr('country', { description: 'The country name component.' }),
    stringAttr('type', { description: 'A label indicating the attribute\'s function, such as work or home.' }),
    {
      name: 'primary',
      type: 'boolean',
      multiValued: false,
      description: 'A Boolean indicating the preferred address.',
      required: false,
      caseExact: false,
      mutability: 'readWrite',
      returned: 'default',
      uniqueness: 'none',
    },
  ];
}

function groupSubAttributes(): SchemaAttribute[] {
  return [
    stringAttr('value', { description: 'The identifier of the group.', mutability: 'readOnly' }),
    {
      ...stringAttr('$ref', { description: 'The URI of the group.', mutability: 'readOnly' }),
      type: 'reference',
      referenceTypes: ['User', 'Group'],
    },
    stringAttr('display', { description: 'A human-readable name for the group.', mutability: 'readOnly' }),
    stringAttr('type', { description: 'A label indicating the type of group.', mutability: 'readOnly', canonicalValues: ['direct', 'indirect'] }),
  ];
}

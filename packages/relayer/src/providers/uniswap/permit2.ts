const PERMIT2_DOMAIN_NAME = 'Permit2';

export function permit2Domain(permit2Address: `0x${string}`, chainId: number) {
  return {
    name: PERMIT2_DOMAIN_NAME,
    chainId,
    verifyingContract: permit2Address,
  };
}

export const PERMIT_DETAILS = [
  { name: 'token', type: 'address' },
  { name: 'amount', type: 'uint160' },
  { name: 'expiration', type: 'uint48' },
  { name: 'nonce', type: 'uint48' },
];

export const PERMIT_TYPES = {
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: PERMIT_DETAILS,
};

export interface PermitDetails {
  token: `0x${string}`,
  amount: bigint,
  expiration: number,
  nonce: number;
}

export interface PermitSingle {
  details: PermitDetails;
  spender: `0x${string}`;
  sigDeadline: bigint;
}

const MaxUint48 = BigInt('0xffffffffffff');
const MaxUint160 = BigInt('0xffffffffffffffffffffffffffffffffffffffff');
const MaxAllowanceTransferAmount = MaxUint160;
const MaxAllowanceExpiration = MaxUint48;
const MaxOrderedNonce = MaxUint48;

export function validatePermitDetails(details: PermitDetails) {
  if (MaxOrderedNonce <= details.nonce) throw new Error('NONCE_OUT_OF_RANGE');
  if (MaxAllowanceTransferAmount <= details.amount) throw new Error('AMOUNT_OUT_OF_RANGE');
  if (MaxAllowanceExpiration <= details.expiration) throw new Error('EXPIRATION_OUT_OF_RANGE');
}

export function createPermitSingleData(permit: PermitSingle, permit2Address: `0x${string}`, chainId: number) {
  const domain = permit2Domain(permit2Address, chainId);
  validatePermitDetails(permit.details);
  return {
    domain,
    types: PERMIT_TYPES,
    values: permit,
  };
}

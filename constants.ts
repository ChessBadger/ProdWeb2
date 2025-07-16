import { Metric } from './types';

export const METRIC_OPTIONS: { value: Metric; label: string }[] = [
    { value: 'pieces', label: 'Pieces' },
    { value: 'dollars', label: 'Dollars' },
    { value: 'skus', label: 'SKUs' },
    { value: 'avg_delta', label: 'Average Delta' },
    { value: 'gap5_count', label: 'Gap > 5' },
    { value: 'gap10_count', label: 'Gap > 10' },
    { value: 'gap15_count', label: 'Gap > 15' },
];

/**
 * Defines groupings of related accounts. When a user filters by one
 * account in a group, all accounts in that group are included in the filter.
 *
 * NOTE: All account aliases here should be in lowercase for consistent matching,
 * as the source data's account names will be converted to lowercase for comparison.
 */
export const ACCOUNT_GROUPS: Record<string, string[]> = {
  "kroger": ["kroger", "mariano's"],
  "piggly wiggly": [
    "piggly wiggly",
    "piggly wiggly - franchise",
    "pigs coporate", // As provided, might be typo for 'corporate'
    "pigs dave s",
    "pigs fox brothers",
    "pigs jake b",
    "pigs malicki",
    "pigs migel",
    "pigs mike day",
    "pigs red",
    "pigs ryan o",
    "pigs stinebrinks",
    "pigs stoneridge",
    "pigs tietz",
  ],
  "ascension rx": [
    "ascension rx",
    "ascension rx - per k",
    "ascension rx - man hr",
  ],
  "fuel on": [
    "fuel on", 
    "relaince fuel, llc", // As provided, might be typo for 'reliance'
    "reliance fuel, llc", 
    "schierl"
  ],
  "single c-stores": [
    "single c-stores",
    "*single c-stores $-check",
    "*single c-stores $ cash",
  ],
};

// Create a reverse map for efficient lookup.
// Key: individual account name (lowercase), Value: array of all linked accounts in the group (lowercase).
const accountToGroupMap = new Map<string, string[]>();
for (const groupName in ACCOUNT_GROUPS) {
    const accountsInGroup = ACCOUNT_GROUPS[groupName];
    const lowercasedGroup = accountsInGroup.map(a => a.toLowerCase());
    for (const account of accountsInGroup) {
        accountToGroupMap.set(account.toLowerCase(), lowercasedGroup);
    }
}

/**
 * Gets all linked accounts for a given account name.
 * If the account is not part of a predefined group, it returns an array containing only the original account name.
 * @param accountName The name of the account from the filter.
 * @returns An array of lowercased account names to be used in the filter logic.
 */
export const getLinkedAccounts = (accountName: string): string[] => {
    const lowercasedAccount = accountName.toLowerCase();
    // Return the pre-calculated group, or an array with just the single account if not found.
    return accountToGroupMap.get(lowercasedAccount) || [lowercasedAccount];
};

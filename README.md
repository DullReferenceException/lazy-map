# lazy-map

Create object mappings that have lazily-evaluated properties


## Purpose

In JavaScript we're constantly building up and tearing down objects. This frequently occurs when you're passing data from one layer to another, converting between different domains:

```ts
async function fetchAccounts(params): Promise<Array<Account>> {
  const rows = await database.getAccounts({ customer_id: params.customerId });
  return rows.map(row => rowToAccount(row));
}
```

JavaScript is pretty good at this, but there are costs:

1. If the mapping function is CPU-costly, you risk blocking the event loop, especially if converting a large array of objects.
2. If the mapping results are large, you'll use up more memory and risk costly garbage collection cycles.
3. You may be doing calculations which are never used. For example, imagine this common scenario:

```ts
async function getSuspendedAccounts(customerId: string): Array<Account> {
  const accounts = await fetchAccounts(customerId);
  return accounts.filter(account => account.status === 'suspended');
}
```

Now imagine if there were a lot of rows in the database, the mapping function was expensive, and most of the accounts you're returning are not in a suspended status. You've performed calculations for data and stored it in memory for a bunch of irrelevant rows that are just going to be thrown away. Imagine if the consuming function is just doing this with the results:

```ts
async function getSuspendedAccountCount(customerId: string): boolean {
  const accounts = await getSuspendedAccounts(customerId);
  return accounts.length;
}
```

Since we're only using the `status` property for filtering and none of the other properties at all returned from the `rowToAccount` function, we may have wasted CPU cycles on nothing.

As you might be able to tell from this example, `lazy-map` comes from real world pains relating to JavaScript performance woes. Its goal is to enable you to perform lazy mappings so that consumers of the result objects can avoid potentially unnecessary computations and memory usage.

## Usage

To use this library, first define a mapping function using `mapping`. The `mapping` function takes an object describing how to convert a source object to a destination object on a property-by-property basis. It returns a new function you can use to create a lazily-mapped object.

```ts
import { mapping } from 'lazy-map';

const rowToAccount = mapping<AccountRow>({
  id: row => row.account_id,
  customerId: row => row.customer_id,
  status: row => normalizeStatus(row.state, row.billing_status),
  properties: row => JSON.parse(row.property_bag),
  relationships: row => JSON.parse(row.relationships),
  childAccountIds(row) { 
    return this.relationships
      .filter(rel => rel.type === 'child')
      .map(rel => rel.target.id)
  },
  parentAccountIds(row) {
    return this.relationships
      .filter(rel => rel.type === 'parent')
      .map(rel => rel.target.id)
  }
});
```

This mapping function can now be used as expected:

```ts
const account = rowToAccount(accountRow);
```

The resulting object from the mapping looks superficially the same as an eagerly-created object, but the calculation isn't invoked until you call the getter for the property, and the result is memoized so you don't absorb the cost of calculation if accessing the property multiple times.

Notice in this example that `childAccountIds` and `parentAccountIds` references `this.relationships` to avoid both of these properties having to do the JSON parsing. Supporting this requires not using arrow functions since those break `this` references.

# Security Specification - Aura POS

## Data Invariants
1. Products must have a positive price and a non-negative stock.
2. Sales must have at least one item.
3. Every document must have an `ownerId` that matches the authenticated user.
4. Timestamps (`createdAt`, `updatedAt`, `timestamp`) must use server timestamps.
5. SKUs must be unique within a user's inventory (enforced by application logic and query checks).
6. Document IDs must be valid (alphanumeric).

## The "Dirty Dozen" Payloads (Targeting products)

1. **Identity Spoofing**: Create a product with someone else's `ownerId`.
2. **Resource Poisoning**: Create a product with a 2MB name.
3. **Ghost Fields**: Create a product with an `isAdmin: true` field.
4. **State Shortcutting**: Update a product's `stock` directly without a sale (if we wanted to restrict that, but owners can edit inventory).
5. **Temporal Attack**: Set `updatedAt` to a future date.
6. **Negative Value**: Set `price: -100`.
7. **Negative Stock**: Set `stock: -5`.
8. **ID Poisoning**: Use a document ID that is a 10KB string.
9. **Blanket Read Attack**: Try to list all products without an `ownerId` filter.
10. **Cross-User Leak**: Try to read another user's product with a known ID.
11. **Shadow Update**: Update a product and change its `ownerId`.
12. **Null Byte Injection**: Use a null byte in a SKU or ID.

## Test Runner (Logic Verification)
Testing via the `firestore.rules` logic.

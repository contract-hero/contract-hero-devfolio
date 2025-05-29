---
title: Cadence 1 | Fungible Tokens Contracts Upgrade
date: '2024-08-27T12:00:00.00Z'
description: 'The TL;DR Enthusiasts guide to upgrading your Crypto’s Smart Contract #onFlow to Cadence 1.0'
---

# The TL;DR Enthusiasts guide to upgrading your Crypto’s Smart Contract #onFlow to Cadence 1.0

Cadence 1.0 is almost here, and it’s bringing some big changes to the Flow blockchain. If you’ve got a token contract lying around from the last bull run, now’s the time to give it a facelift. But don’t worry, we’re not diving into the nitty-gritty details of why things are changing — today, we’re just getting things done and living to code another day.

## Here’s your step-by-step guide:

### 1 Update Your Dependencies
First things first, ensure your project is using the latest dependencies, particularly the newest version of the Fungible Token standard. You can manage this with the Flow CLI’s dependency manager.

### 2 Switch to the New Import Notation
If you haven’t already, now’s a great time to update your contracts to use the new import notation. This is a minor tweak but keeps your code in line with the latest standards.

### 3 Update the Cadence Extension
Make sure your Cadence extension is up to date, and switch the interpreter to the Cadence 1.0 preview version. This will save you headaches later.  
*(Tip: Screenshot where you need to click — easy as pie!)*

### 4 Procrastinate! Let’s Start with the Simple Stuff
Access modifiers are now simplified. Everywhere you see `pub`, it’s now `access(all)`.  
Just scroll through your code, use the Quick Fix option in your IDE, and choose “Replace with access(all)”.  
It’s boring, but it’s the easiest part of the job!

### 5 Vault Resource Overhaul
This is where things get a little trickier, but nothing we can’t handle.

#### 5.1 Replace `provider` and `receiver` with `vault`
Interfaces can now implement other interfaces — progress!

#### 5.2 `withdraw` Function
Update it to `access(FungibleToken.Withdraw)`.  
It now returns `@{FungibleToken.Vault}` — an intersection type.

#### 5.3 `deposit` Function
Now takes `@{FungibleToken.Vault}` as a parameter.

#### 5.4 Remove `destroy` and Implement `burnCallback()`

#### 5.5 Add Missing Methods to Vault Resource
Hover over the `Vault` resource name, and your IDE will prompt you to add the missing methods to conform to the new `FungibleToken.Vault` specs. Use Quick Fix to add these:

- `createEmptyVault`:  
  ```cadence
  return <-create Vault(balance: 0.0)
  ```

- `isAvailableToWithdraw`:  
  ```cadence
  return amount <= self.balance
  ```

- `getViews` and `resolveView`:  
  ```cadence
  return []  
  return nil
  ```

### 6 Minting Tokens
Your `mint` function now returns `@{FungibleToken.Vault}`, an intersection type.  
This allows for more flexible and powerful contract design. *(Why? I’ll leave that as a mystery for you to unravel!)*

### 7 Storage Initialization
If you’re saving something to storage on `init`, it’s a quick fix.  
Your IDE will probably guide you through it.

### 8 Finishing Touches
You’re almost there! Just a couple of final tweaks:

#### 8.1 Add a `vaultType` Parameter
To the `createEmptyVault` method at the contract level.

#### 8.2 Add Missing Members
Use Quick Fix to add missing members for the `getContractViews` and `resolveContractView` methods.

### 9 Heads Up: Metadata Views
After these changes, your Fungible Token contract won’t fully support `MetadataViews` out of the box.  
If you need full support, check out the official guide on adding support for Metadata Views.

### 10 Wrapping Up
If you’ve made it this far and have been following along, you should have a fully upgraded contract ready to go. **Congrats!**

---

And there you have it! If this all sounds like too much or you’d rather spend your time building the next big thing, I’m available to help with your contract upgrades. Just shoot me a message.
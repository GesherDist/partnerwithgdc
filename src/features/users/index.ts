/**
 * Users Module - Barrel Export
 *
 * Public API for the Users module.
 */

// Types
export * from './types';

// Schemas
export * from './lib/schemas';

// Repository
export { userRepository } from './repositories/user.repository';

// Service
export { userService } from './services/user.service';

// Server Actions
export * from './actions';

// Hooks and components are deliberately NOT re-exported here.
// This barrel reaches the repository, and therefore the postgres driver, so
// anything a client component imports from it drags Node's `net` into the
// browser bundle and the build fails. Import them from their own paths:
//   import { UsersTable } from '@/features/users/components';
//   import { useUsers }   from '@/features/users/hooks';

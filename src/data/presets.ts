import type { FileKind, PermissionGroups, SpecialBits } from '../lib/permissions'

export type Preset = {
  id: string
  name: string
  octal: string
  explanation: string
  groups: PermissionGroups
  special: SpecialBits
  fileKind: FileKind
  warning?: string
}

export const presetList: Preset[] = [
  {
    id: 'private-file',
    name: 'Private File',
    octal: '600',
    explanation: 'Owner has full access while group and others are denied.',
    groups: {
      owner: { read: true, write: true, execute: false },
      group: { read: false, write: false, execute: false },
      others: { read: false, write: false, execute: false },
    },
    special: { setuid: false, setgid: false, sticky: false },
    fileKind: 'file',
  },
  {
    id: 'standard-readable-file',
    name: 'Standard Readable File',
    octal: '644',
    explanation: 'Common for configuration and data files readable by everyone, writable only by the owner.',
    groups: {
      owner: { read: true, write: true, execute: false },
      group: { read: true, write: false, execute: false },
      others: { read: true, write: false, execute: false },
    },
    special: { setuid: false, setgid: false, sticky: false },
    fileKind: 'file',
  },
  {
    id: 'private-directory',
    name: 'Private Directory',
    octal: '700',
    explanation: 'A private directory for a user and their project files, inaccessible to others.',
    groups: {
      owner: { read: true, write: true, execute: true },
      group: { read: false, write: false, execute: false },
      others: { read: false, write: false, execute: false },
    },
    special: { setuid: false, setgid: false, sticky: false },
    fileKind: 'directory',
  },
  {
    id: 'executable-script',
    name: 'Executable Script',
    octal: '755',
    explanation: 'Useful for scripts that should be runnable by others but not writable by them.',
    groups: {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      others: { read: true, write: false, execute: true },
    },
    special: { setuid: false, setgid: false, sticky: false },
    fileKind: 'file',
  },
  {
    id: 'shared-group-directory',
    name: 'Shared Group Directory',
    octal: '750',
    explanation: 'Owner has full access, the group can read and traverse, and others are restricted.',
    groups: {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      others: { read: false, write: false, execute: false },
    },
    special: { setuid: false, setgid: false, sticky: false },
    fileKind: 'directory',
  },
  {
    id: 'world-writable-directory',
    name: 'World-Writable Directory',
    octal: '1777',
    explanation: 'This grants write access to everyone and uses the sticky bit so only file owners can remove their own files.',
    groups: {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: true, execute: true },
      others: { read: true, write: true, execute: true },
    },
    special: { setuid: false, setgid: false, sticky: true },
    fileKind: 'directory',
    warning: 'The sticky bit and world-writable permission require care: files can be deleted by others only when the sticky bit is enabled, but this mode is still broad and should be treated as a deliberate security tradeoff.',
  },
  {
    id: 'fully-open-permissions',
    name: 'Fully Open Permissions',
    octal: '777',
    explanation: 'Everything is readable, writable, and executable for everyone. This is often too permissive for production systems.',
    groups: {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: true, execute: true },
      others: { read: true, write: true, execute: true },
    },
    special: { setuid: false, setgid: false, sticky: false },
    fileKind: 'directory',
    warning: 'This is a deliberately open mode. It should be used sparingly and only when the security model explicitly allows unrestricted access.',
  },
]

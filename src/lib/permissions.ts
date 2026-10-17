export type PermissionBits = {
  read: boolean
  write: boolean
  execute: boolean
}

export type PermissionGroupKey = 'owner' | 'group' | 'others'

export type PermissionGroups = Record<PermissionGroupKey, PermissionBits>

export type SpecialBits = {
  setuid: boolean
  setgid: boolean
  sticky: boolean
}

export type FileKind = 'file' | 'directory'

export const defaultGroups: PermissionGroups = {
  owner: { read: true, write: true, execute: true },
  group: { read: true, write: false, execute: true },
  others: { read: false, write: false, execute: false },
}

export const defaultSpecialBits: SpecialBits = {
  setuid: false,
  setgid: false,
  sticky: false,
}

export const groupLabels: Record<PermissionGroupKey, string> = {
  owner: 'Owner',
  group: 'Group',
  others: 'Others',
}

export function bitsToOctal(bits: PermissionBits): number {
  return Number(bits.read) * 4 + Number(bits.write) * 2 + Number(bits.execute)
}

export function bitsToSymbol(bits: PermissionBits): string {
  return `${bits.read ? 'r' : '-'}${bits.write ? 'w' : '-'}${bits.execute ? 'x' : '-'}`
}

export function symbolToBits(symbol: string): PermissionBits {
  return {
    read: symbol.includes('r'),
    write: symbol.includes('w'),
    execute: symbol.includes('x'),
  }
}

export function getFullModeString(
  groups: PermissionGroups,
  special: SpecialBits,
  fileKind: FileKind,
): string {
  const prefix = fileKind === 'directory' ? 'd' : '-'
  const owner = bitsToSymbol(groups.owner)
  const group = bitsToSymbol(groups.group)
  const others = bitsToSymbol(groups.others)

  const ownerChars = owner.split('')
  const groupChars = group.split('')
  const othersChars = others.split('')

  if (special.setuid) {
    ownerChars[2] = groups.owner.execute ? 's' : 'S'
  }

  if (special.setgid) {
    groupChars[2] = groups.group.execute ? 's' : 'S'
  }

  if (special.sticky) {
    othersChars[2] = groups.others.execute ? 't' : 'T'
  }

  return `${prefix}${ownerChars.join('')}${groupChars.join('')}${othersChars.join('')}`
}

export function getOctalMode(groups: PermissionGroups, special: SpecialBits): string {
  const digits = [
    bitsToOctal(groups.owner),
    bitsToOctal(groups.group),
    bitsToOctal(groups.others),
  ]

  const base = Number(digits.join(''))
  const specialValue = (special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0)

  return `${specialValue > 0 ? `${specialValue}${base}` : `${base}`}`
}

export function getSymbolicMode(groups: PermissionGroups, special: SpecialBits): string {
  const prefix = getFullModeString(groups, special, 'file').slice(0, 1)
  const rest = getFullModeString(groups, special, 'file').slice(1)
  return `${prefix}${rest}`
}

export function parseOctalMode(value: string): {
  valid: boolean
  permissions: PermissionGroups
  special: SpecialBits
  octal: string
} {
  const normalized = value.trim()
  if (!/^[0-7]{3,4}$/.test(normalized)) {
    return {
      valid: false,
      permissions: defaultGroups,
      special: defaultSpecialBits,
      octal: '755',
    }
  }

  const digits = normalized.split('').map(Number)
  if (digits.length === 3) {
    return {
      valid: true,
      permissions: {
        owner: parsePermissionDigit(digits[0]),
        group: parsePermissionDigit(digits[1]),
        others: parsePermissionDigit(digits[2]),
      },
      special: defaultSpecialBits,
      octal: normalized,
    }
  }

  const specialDigit = digits[0]
  const baseDigits = digits.slice(1)
  return {
    valid: true,
    permissions: {
      owner: parsePermissionDigit(baseDigits[0]),
      group: parsePermissionDigit(baseDigits[1]),
      others: parsePermissionDigit(baseDigits[2]),
    },
    special: {
      setuid: specialDigit >= 4,
      setgid: (specialDigit % 4) >= 2,
      sticky: (specialDigit % 2) === 1,
    },
    octal: normalized,
  }
}

export function parsePermissionDigit(value: number): PermissionBits {
  return {
    read: (value & 4) === 4,
    write: (value & 2) === 2,
    execute: (value & 1) === 1,
  }
}

export function parseSymbolicMode(value: string): {
  valid: boolean
  permissions: PermissionGroups
  special: SpecialBits
  symbolic: string
} {
  const trimmed = value.trim()
  const digits = trimmed.replace(/^[-dcbpls]/, '')

  if (!/^[r-][w-][xStsT-]{3}$/.test(digits) && !/^[r-][w-][xStsT-]{9}$/.test(trimmed)) {
    return {
      valid: false,
      permissions: defaultGroups,
      special: defaultSpecialBits,
      symbolic: 'rwxr-xr-x',
    }
  }

  const text = trimmed.startsWith('-') || trimmed.startsWith('d') || trimmed.startsWith('l') || trimmed.startsWith('c') || trimmed.startsWith('b') || trimmed.startsWith('p') || trimmed.startsWith('s')
    ? trimmed.slice(1)
    : trimmed

  const owner = text.slice(0, 3)
  const group = text.slice(3, 6)
  const others = text.slice(6, 9)

  const ownerPerms = parseSymbolChunk(owner)
  const groupPerms = parseSymbolChunk(group)
  const othersPerms = parseSymbolChunk(others)

  return {
    valid: true,
    permissions: {
      owner: ownerPerms,
      group: groupPerms,
      others: othersPerms,
    },
    special: {
      setuid: owner.includes('s') || owner.includes('S'),
      setgid: group.includes('s') || group.includes('S'),
      sticky: others.includes('t') || others.includes('T'),
    },
    symbolic: trimmed,
  }
}

export function parseSymbolChunk(chunk: string): PermissionBits {
  const read = chunk[0] === 'r'
  const write = chunk[1] === 'w'
  const execute = chunk[2] === 'x' || chunk[2] === 's' || chunk[2] === 'S' || chunk[2] === 't' || chunk[2] === 'T'

  return { read, write, execute }
}

export function getPermissionSummary(groups: PermissionGroups): string[] {
  return ['owner', 'group', 'others'].map((key) => {
    const group = groups[key as PermissionGroupKey]
    const octal = bitsToOctal(group)
    return `${groupLabels[key as PermissionGroupKey]}: ${bitsToSymbol(group)} (${octal})`
  })
}

export function fileNameToSafeShellToken(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return "''"

  const isSafe = /^[A-Za-z0-9._/@-]+$/.test(trimmed)
  if (isSafe) return trimmed

  return `'${trimmed.replace(/'/g, `'"'"'`)}'`
}

export function getModeExplanation(groups: PermissionGroups, fileKind: FileKind): string {
  const desc = fileKind === 'directory'
    ? 'Directory execute permission allows traversal and access to the contents, not execution as a program.'
    : 'This file can be opened or executed when the relevant execute bit is set.'

  const owner = bitsToSymbol(groups.owner)
  const group = bitsToSymbol(groups.group)
  const others = bitsToSymbol(groups.others)

  return `${desc} Effective access: owner ${owner}, group ${group}, others ${others}.`
}
